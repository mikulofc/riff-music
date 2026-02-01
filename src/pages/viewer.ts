import { getScore, saveScore } from '../api';
import { navigate } from '../router';
import { loadFromFile, loadFromUrl, type LoadedScore } from '../music-xml-loader';
import { renderScore } from '../sheet-renderer';
import { createPianoKeyboard } from '../piano-keyboard';
import { playNote, ensureAudioStarted } from '../audio-player';
import { addNoteLabels } from '../note-label-overlay';
import type { NoteInfo } from '../note-data';

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
        <button id="start-audio-btn" class="btn-audio">Enable Audio</button>
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

  document.getElementById('back-btn')!.addEventListener('click', () => navigate('/library'));

  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) {
      handleLoad(async () => {
        const score = await loadFromFile(file);
        // Keep the raw text for saving
        if (!score.isCompressed) {
          currentMusicXmlText = score.data as string;
        } else {
          currentMusicXmlText = null; // Can't easily save compressed as text
        }
        return score;
      });
    }
  });

  const urlInput = document.getElementById('url-input') as HTMLInputElement;
  document.getElementById('load-url-btn')!.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (url) handleLoad(async () => {
      const score = await loadFromUrl(url);
      if (!score.isCompressed) {
        currentMusicXmlText = score.data as string;
      } else {
        currentMusicXmlText = null;
      }
      return score;
    });
  });
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const url = urlInput.value.trim();
      if (url) handleLoad(async () => {
        const score = await loadFromUrl(url);
        if (!score.isCompressed) {
          currentMusicXmlText = score.data as string;
        } else {
          currentMusicXmlText = null;
        }
        return score;
      });
    }
  });

  document.getElementById('start-audio-btn')!.addEventListener('click', async () => {
    await ensureAudioStarted();
    const btn = document.getElementById('start-audio-btn')!;
    btn.textContent = 'Audio Ready';
    btn.classList.add('audio-ready');
    (btn as HTMLButtonElement).disabled = true;
  });

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
        if (!score.isCompressed) currentMusicXmlText = score.data as string;
        else currentMusicXmlText = null;
        return score;
      });
    }
  });

  function onNoteClick(noteInfo: NoteInfo, _svgElement: SVGGElement): void {
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
    playNote(noteInfo);
  }

  async function handleLoad(loader: () => Promise<LoadedScore>) {
    sheetContainer.innerHTML = '<p class="loading">Loading sheet music...</p>';
    try {
      currentScore = await loader();
      const keySig = await renderScore(sheetContainer, currentScore, onNoteClick);
      addNoteLabels(sheetContainer, keySig);
      addSaveButton();
    } catch (err) {
      sheetContainer.innerHTML = `<p class="error">Error: ${(err as Error).message}</p>`;
    }
  }

  function addSaveButton() {
    if (!currentMusicXmlText) return;
    // Remove existing save bar if any
    document.getElementById('save-bar')?.remove();

    const saveBar = document.createElement('div');
    saveBar.id = 'save-bar';
    saveBar.className = 'save-bar';
    saveBar.innerHTML = `
      <input type="text" id="score-title" placeholder="Score title" />
      <button id="save-score-btn" class="btn-primary">Save to Library</button>
    `;

    const toolbar = container.querySelector('.viewer-toolbar');
    if (toolbar) toolbar.after(saveBar);

    document.getElementById('save-score-btn')!.addEventListener('click', async () => {
      const titleInput = document.getElementById('score-title') as HTMLInputElement;
      const title = titleInput.value.trim();
      if (!title) { titleInput.focus(); return; }
      if (!currentMusicXmlText) return;

      const btn = document.getElementById('save-score-btn') as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {
        const result = await saveScore(title, currentMusicXmlText);
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
        <button id="start-audio-btn" class="btn-audio">Enable Audio</button>
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

  document.getElementById('back-btn')!.addEventListener('click', () => navigate('/library'));

  document.getElementById('start-audio-btn')!.addEventListener('click', async () => {
    await ensureAudioStarted();
    const btn = document.getElementById('start-audio-btn')!;
    btn.textContent = 'Audio Ready';
    btn.classList.add('audio-ready');
    (btn as HTMLButtonElement).disabled = true;
  });

  function onNoteClick(noteInfo: NoteInfo, _svgElement: SVGGElement): void {
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
    playNote(noteInfo);
  }

  renderScore(sheetContainer, score, onNoteClick).then((keySig) => {
    addNoteLabels(sheetContainer, keySig);
  });
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
