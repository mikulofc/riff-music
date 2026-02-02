import { getScore, saveScore } from '../api';
import { navigate } from '../router';
import { loadFromFile, loadFromUrl, extractMusicXmlFromMxl, type LoadedScore } from '../music-xml-loader';
import { renderScore, highlightPlayingNotes, highlightPlayingMeasure, scrollToPlayingNote, createScrollState, getNoteInfosFromIds } from '../sheet-renderer';
import { createPianoKeyboard } from '../piano-keyboard';
import { playNote, ensureAudioStarted, getPolySynth } from '../audio-player';
import { addNoteLabels } from '../note-label-overlay';
import { getToolkit } from '../verovio-init';
import { MidiPlaybackController, type PlaybackState } from '../midi-playback';
import * as Tone from 'tone';
import type { NoteInfo, KeySignature } from '../note-data';

export async function renderViewerPage(container: HTMLElement, scoreId: string): Promise<void> {
  container.innerHTML = '<p class="loading">Loading score...</p>';

  const score = await getScore(scoreId);
  if (!score) {
    container.innerHTML = '<p class="error">Score not found.</p>';
    return;
  }

  renderViewerUI(container, score.title, { data: score.musicxml, isCompressed: false });
}

export function renderNewScorePage(container: HTMLElement): void {
  container.innerHTML = `
    <div class="viewer-page">
      <div class="viewer-toolbar">
        <button id="back-btn">Back to Library</button>
        <div class="input-group">
          <label for="file-input" class="file-label">
            <span>Upload MusicXML</span>
            <input type="file" id="file-input" accept=".musicxml,.xml,.mxl" />
          </label>
        </div>
        <div class="input-group url-group">
          <input type="text" id="url-input" placeholder="Paste MusicXML URL" />
          <button id="load-url-btn">Load URL</button>
        </div>
        <div class="playback-controls" id="playback-controls" style="display:none;">
          <button id="prev-note-btn" title="Previous note" class="btn-playback">&#9664;&#9664;</button>
          <button id="stop-btn" title="Stop" class="btn-playback btn-stop">&#9632;</button>
          <button id="play-pause-btn" title="Play" class="btn-playback btn-play">&#9654;</button>
          <button id="next-note-btn" title="Next note" class="btn-playback">&#9654;&#9654;</button>
        </div>
      </div>
      <main class="viewer-main">
        <div id="sheet-music">
          <p class="placeholder">Upload a MusicXML file or paste a URL.</p>
        </div>
        <aside id="sidebar">
          <div id="info-panel">
            <h2>Note Info</h2>
            <p class="placeholder">Click a note on the sheet music.</p>
          </div>
          <div id="piano-container"><h2>Keyboard</h2></div>
        </aside>
      </main>
    </div>
  `;

  const sheetContainer = document.getElementById('sheet-music')!;
  const pianoContainer = document.getElementById('piano-container')!;
  const infoPanel = document.getElementById('info-panel')!;
  const piano = createPianoKeyboard(pianoContainer);

  let currentScore: LoadedScore | null = null;
  let currentMusicXmlText: string | null = null;
  let playbackController: MidiPlaybackController | null = null;
  let currentKeySig: KeySignature = {};
  const scrollState = createScrollState(sheetContainer);

  document.getElementById('back-btn')!.addEventListener('click', () => {
    playbackController?.dispose();
    navigate('/library');
  });

  function extractText(score: LoadedScore) {
    currentMusicXmlText = score.isCompressed
      ? extractMusicXmlFromMxl(score.data as ArrayBuffer)
      : score.data as string;
  }

  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) {
      handleLoad(async () => {
        const score = await loadFromFile(file);
        extractText(score);
        return score;
      });
    }
  });

  const urlInput = document.getElementById('url-input') as HTMLInputElement;
  document.getElementById('load-url-btn')!.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (url) handleLoad(async () => {
      const score = await loadFromUrl(url);
      extractText(score);
      return score;
    });
  });
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const url = urlInput.value.trim();
      if (url) handleLoad(async () => {
        const score = await loadFromUrl(url);
        extractText(score);
        return score;
      });
    }
  });

  setupPlaybackButtons();

  // Drag and drop
  sheetContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    sheetContainer.classList.add('drag-over');
  });
  sheetContainer.addEventListener('dragleave', () => sheetContainer.classList.remove('drag-over'));
  sheetContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    sheetContainer.classList.remove('drag-over');
    const file = e.dataTransfer?.files[0];
    if (file && (file.name.endsWith('.musicxml') || file.name.endsWith('.xml') || file.name.endsWith('.mxl'))) {
      handleLoad(async () => {
        const score = await loadFromFile(file);
        extractText(score);
        return score;
      });
    }
  });

  function onNoteClick(noteInfo: NoteInfo, svgElement: SVGGElement): void {
    infoPanel.innerHTML = `
      <h2>Note Info</h2>
      <div class="note-detail">
        <span class="note-name">${noteInfo.displayName}${noteInfo.octave}</span>
        <table>
          <tr><td>Pitch</td><td>${noteInfo.pitchClass}</td></tr>
          <tr><td>Accidental</td><td>${noteInfo.accidental || 'Natural'}</td></tr>
          <tr><td>Octave</td><td>${noteInfo.octave}</td></tr>
          <tr><td>MIDI #</td><td>${noteInfo.midiNote}</td></tr>
        </table>
      </div>
    `;
    piano.highlightKey(noteInfo);

    if (playbackController && Tone.getTransport().state !== 'stopped') {
      const noteId = svgElement.getAttribute('id');
      if (noteId) {
        playbackController.seekToElement(noteId);
      }
    } else {
      playNote(noteInfo);
    }
  }

  async function initPlayback() {
    if (playbackController) {
      playbackController.dispose();
    }
    const tk = await getToolkit();
    const polySynth = getPolySynth();

    playbackController = new MidiPlaybackController(tk, polySynth, {
      onStateChange: updatePlaybackButtons,
      onHighlight(noteIds, _page) {
        highlightPlayingNotes(sheetContainer, noteIds);
        highlightPlayingMeasure(sheetContainer, noteIds);
        scrollToPlayingNote(sheetContainer, noteIds, scrollState);
        const notes = getNoteInfosFromIds(sheetContainer, noteIds, currentKeySig);
        if (notes.length > 0) piano.highlightKeys(notes);
        else piano.clearHighlight();
      },
    });
    playbackController.prepare();

    const controls = document.getElementById('playback-controls');
    if (controls) controls.style.display = '';
  }

  function setupPlaybackButtons() {
    document.getElementById('play-pause-btn')!.addEventListener('click', async () => {
      if (Tone.getTransport().state === 'started') {
        playbackController?.pause();
      } else {
        await ensureAudioStarted();
        if (!playbackController) await initPlayback();
        playbackController?.play();
      }
    });

    document.getElementById('stop-btn')!.addEventListener('click', () => {
      playbackController?.stop();
      highlightPlayingMeasure(sheetContainer, []);
      piano.clearHighlight();
    });

    document.getElementById('next-note-btn')!.addEventListener('click', () => {
      playbackController?.nextNote();
    });

    document.getElementById('prev-note-btn')!.addEventListener('click', () => {
      playbackController?.prevNote();
    });
  }

  function updatePlaybackButtons(state: PlaybackState) {
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (!playPauseBtn) return;

    if (state === 'playing') {
      playPauseBtn.innerHTML = '&#9646;&#9646;';
      playPauseBtn.title = 'Pause';
      playPauseBtn.classList.remove('btn-play');
      playPauseBtn.classList.add('btn-pause');
    } else {
      playPauseBtn.innerHTML = '&#9654;';
      playPauseBtn.title = 'Play';
      playPauseBtn.classList.remove('btn-pause');
      playPauseBtn.classList.add('btn-play');
    }
  }

  async function handleLoad(loader: () => Promise<LoadedScore>) {
    sheetContainer.innerHTML = '<p class="loading">Loading sheet music...</p>';
    if (playbackController) {
      playbackController.dispose();
      playbackController = null;
    }
    try {
      currentScore = await loader();
      currentKeySig = await renderScore(sheetContainer, currentScore, onNoteClick);
      addNoteLabels(sheetContainer, currentKeySig);
      addSaveButton();
      const controls = document.getElementById('playback-controls');
      if (controls) controls.style.display = '';
    } catch (err) {
      sheetContainer.innerHTML = `<p class="error">Error: ${(err as Error).message}</p>`;
    }
  }

  function addSaveButton() {
    if (!currentMusicXmlText) return;
    document.getElementById('save-bar')?.remove();

    const meta = parseMusicXmlMetadata(currentMusicXmlText);

    const saveBar = document.createElement('div');
    saveBar.id = 'save-bar';
    saveBar.className = 'save-bar';
    saveBar.innerHTML = `
      <div class="save-fields">
        <input type="text" id="score-title" placeholder="Score title" value="${escapeAttr(meta.title)}" />
        <input type="text" id="score-composer" placeholder="Composer" value="${escapeAttr(meta.composer)}" />
        <input type="text" id="score-arranger" placeholder="Arranger" value="${escapeAttr(meta.arranger)}" />
      </div>
      <button id="save-score-btn" class="btn-primary">Save to Library</button>
    `;

    const toolbar = container.querySelector('.viewer-toolbar');
    if (toolbar) toolbar.after(saveBar);

    document.getElementById('save-score-btn')!.addEventListener('click', async () => {
      const titleInput = document.getElementById('score-title') as HTMLInputElement;
      const title = titleInput.value.trim();
      if (!title) { titleInput.focus(); return; }
      if (!currentMusicXmlText) return;

      const composer = (document.getElementById('score-composer') as HTMLInputElement).value.trim();
      const arranger = (document.getElementById('score-arranger') as HTMLInputElement).value.trim();
      const updatedXml = updateMusicXmlMetadata(currentMusicXmlText, { title, composer, arranger });

      const btn = document.getElementById('save-score-btn') as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {
        const result = await saveScore(title, updatedXml);
        playbackController?.dispose();
        navigate(`/viewer/${result.id}`);
      } catch {
        btn.disabled = false;
        btn.textContent = 'Save to Library';
      }
    });
  }
}

function renderViewerUI(container: HTMLElement, title: string, score: LoadedScore): void {
  container.innerHTML = `
    <div class="viewer-page">
      <div class="viewer-toolbar">
        <button id="back-btn">Back to Library</button>
        <span class="viewer-title">${escapeHtml(title)}</span>
        <div class="playback-controls" id="playback-controls" style="display:none;">
          <button id="prev-note-btn" title="Previous note" class="btn-playback">&#9664;&#9664;</button>
          <button id="stop-btn" title="Stop" class="btn-playback btn-stop">&#9632;</button>
          <button id="play-pause-btn" title="Play" class="btn-playback btn-play">&#9654;</button>
          <button id="next-note-btn" title="Next note" class="btn-playback">&#9654;&#9654;</button>
        </div>
      </div>
      <main class="viewer-main">
        <div id="sheet-music">
          <p class="loading">Rendering...</p>
        </div>
        <aside id="sidebar">
          <div id="info-panel">
            <h2>Note Info</h2>
            <p class="placeholder">Click a note on the sheet music.</p>
          </div>
          <div id="piano-container"><h2>Keyboard</h2></div>
        </aside>
      </main>
    </div>
  `;

  const sheetContainer = document.getElementById('sheet-music')!;
  const pianoContainer = document.getElementById('piano-container')!;
  const infoPanel = document.getElementById('info-panel')!;
  const piano = createPianoKeyboard(pianoContainer);

  let playbackController: MidiPlaybackController | null = null;
  let scoreKeySig: KeySignature = {};
  const scrollState = createScrollState(sheetContainer);

  document.getElementById('back-btn')!.addEventListener('click', () => {
    playbackController?.dispose();
    navigate('/library');
  });

  function onNoteClick(noteInfo: NoteInfo, svgElement: SVGGElement): void {
    infoPanel.innerHTML = `
      <h2>Note Info</h2>
      <div class="note-detail">
        <span class="note-name">${noteInfo.displayName}${noteInfo.octave}</span>
        <table>
          <tr><td>Pitch</td><td>${noteInfo.pitchClass}</td></tr>
          <tr><td>Accidental</td><td>${noteInfo.accidental || 'Natural'}</td></tr>
          <tr><td>Octave</td><td>${noteInfo.octave}</td></tr>
          <tr><td>MIDI #</td><td>${noteInfo.midiNote}</td></tr>
        </table>
      </div>
    `;
    piano.highlightKey(noteInfo);

    if (playbackController && Tone.getTransport().state !== 'stopped') {
      const noteId = svgElement.getAttribute('id');
      if (noteId) {
        playbackController.seekToElement(noteId);
      }
    } else {
      playNote(noteInfo);
    }
  }

  async function initPlayback() {
    if (playbackController) {
      playbackController.dispose();
    }
    const tk = await getToolkit();
    const polySynth = getPolySynth();

    playbackController = new MidiPlaybackController(tk, polySynth, {
      onStateChange: updatePlaybackButtons,
      onHighlight(noteIds, _page) {
        highlightPlayingNotes(sheetContainer, noteIds);
        highlightPlayingMeasure(sheetContainer, noteIds);
        scrollToPlayingNote(sheetContainer, noteIds, scrollState);
        const notes = getNoteInfosFromIds(sheetContainer, noteIds, scoreKeySig);
        if (notes.length > 0) piano.highlightKeys(notes);
        else piano.clearHighlight();
      },
    });
    playbackController.prepare();

    const controls = document.getElementById('playback-controls');
    if (controls) controls.style.display = '';
  }

  function setupPlaybackButtons() {
    document.getElementById('play-pause-btn')!.addEventListener('click', async () => {
      if (Tone.getTransport().state === 'started') {
        playbackController?.pause();
      } else {
        await ensureAudioStarted();
        if (!playbackController) await initPlayback();
        playbackController?.play();
      }
    });

    document.getElementById('stop-btn')!.addEventListener('click', () => {
      playbackController?.stop();
      highlightPlayingMeasure(sheetContainer, []);
      piano.clearHighlight();
    });

    document.getElementById('next-note-btn')!.addEventListener('click', () => {
      playbackController?.nextNote();
    });

    document.getElementById('prev-note-btn')!.addEventListener('click', () => {
      playbackController?.prevNote();
    });
  }

  function updatePlaybackButtons(state: PlaybackState) {
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (!playPauseBtn) return;

    if (state === 'playing') {
      playPauseBtn.innerHTML = '&#9646;&#9646;';
      playPauseBtn.title = 'Pause';
      playPauseBtn.classList.remove('btn-play');
      playPauseBtn.classList.add('btn-pause');
    } else {
      playPauseBtn.innerHTML = '&#9654;';
      playPauseBtn.title = 'Play';
      playPauseBtn.classList.remove('btn-pause');
      playPauseBtn.classList.add('btn-play');
    }
  }

  setupPlaybackButtons();

  renderScore(sheetContainer, score, onNoteClick).then((keySig) => {
    scoreKeySig = keySig;
    addNoteLabels(sheetContainer, keySig);
    const controls = document.getElementById('playback-controls');
    if (controls) controls.style.display = '';
  });
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

interface MusicXmlMetadata {
  title: string;
  composer: string;
  arranger: string;
}

function parseMusicXmlMetadata(xml: string): MusicXmlMetadata {
  const getTag = (tag: string) => {
    const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return match ? match[1] : '';
  };
  const getCreator = (type: string) => {
    const match = xml.match(new RegExp(`<creator[^>]+type="${type}"[^>]*>([^<]*)</creator>`));
    return match ? match[1] : '';
  };
  return {
    title: getTag('work-title') || getTag('movement-title'),
    composer: getCreator('composer'),
    arranger: getCreator('arranger'),
  };
}

function updateMusicXmlMetadata(xml: string, meta: MusicXmlMetadata): string {
  let result = xml;

  // Update or insert work-title
  if (result.includes('<work-title>')) {
    result = result.replace(/<work-title>[^<]*<\/work-title>/, `<work-title>${escapeXml(meta.title)}</work-title>`);
  } else if (result.includes('<work>')) {
    result = result.replace(/<work>/, `<work>\n    <work-title>${escapeXml(meta.title)}</work-title>`);
  }

  // Update movement-title too if it exists
  if (result.includes('<movement-title>')) {
    result = result.replace(/<movement-title>[^<]*<\/movement-title>/, `<movement-title>${escapeXml(meta.title)}</movement-title>`);
  }

  // Update or insert composer
  if (result.match(/<creator[^>]+type="composer"/)) {
    result = result.replace(/<creator([^>]+type="composer"[^>]*)>[^<]*<\/creator>/, `<creator$1>${escapeXml(meta.composer)}</creator>`);
  } else if (meta.composer && result.includes('<identification>')) {
    result = result.replace(/<identification>/, `<identification>\n      <creator type="composer">${escapeXml(meta.composer)}</creator>`);
  }

  // Update or insert arranger
  if (result.match(/<creator[^>]+type="arranger"/)) {
    result = result.replace(/<creator([^>]+type="arranger"[^>]*)>[^<]*<\/creator>/, `<creator$1>${escapeXml(meta.arranger)}</creator>`);
  } else if (meta.arranger && result.includes('<identification>')) {
    result = result.replace(/<identification>/, `<identification>\n      <creator type="arranger">${escapeXml(meta.arranger)}</creator>`);
  }

  return result;
}
