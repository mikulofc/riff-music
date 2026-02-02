import { getToolkit } from './verovio-init';
import { meiAttrToNoteInfo, parseKeySignature, type NoteInfo, type KeySignature } from './note-data';
import type { LoadedScore } from './music-xml-loader';

export type NoteClickCallback = (noteInfo: NoteInfo, svgElement: SVGGElement) => void;

export async function renderScore(
  container: HTMLElement,
  score: LoadedScore,
  onNoteClick: NoteClickCallback,
): Promise<KeySignature> {
  const tk = await getToolkit();

  if (score.isCompressed) {
    tk.loadZipDataBuffer(score.data as ArrayBuffer);
  } else {
    tk.loadData(score.data as string);
  }

  const pageCount = tk.getPageCount();
  container.innerHTML = '';

  // Parse key signature from MEI using regex (querySelector fails on namespaced XML)
  let keySig: KeySignature = {};
  try {
    const mei = tk.getMEI();
    let keySigValue: string | null = null;
    // Try key.sig attribute on staffDef
    const staffDefMatch = mei.match(/key\.sig="(\d+[sf])"/);
    if (staffDefMatch) {
      keySigValue = staffDefMatch[1];
    }
    // Try sig attribute on keySig element
    if (!keySigValue) {
      const keySigElMatch = mei.match(/<keySig[^>]*\ssig="(\d+[sf])"/);
      if (keySigElMatch) {
        keySigValue = keySigElMatch[1];
      }
    }
    if (keySigValue) {
      const match = keySigValue.match(/^(\d+)(s|f)$/);
      if (match) {
        const fifths = parseInt(match[1], 10) * (match[2] === 'f' ? -1 : 1);
        keySig = parseKeySignature(fifths);
      }
    }
  } catch { /* proceed without key signature */ }

  for (let i = 1; i <= pageCount; i++) {
    const pageDiv = document.createElement('div');
    pageDiv.className = 'sheet-page';
    pageDiv.innerHTML = tk.renderToSVG(i);
    container.appendChild(pageDiv);
  }

  container.addEventListener('click', (event) => {
    const target = event.target as SVGElement;
    const noteGroup = target.closest('g.note') as SVGGElement | null;
    if (!noteGroup) return;

    const pname = noteGroup.getAttribute('data-pname');
    const oct = noteGroup.getAttribute('data-oct');
    let accid = noteGroup.getAttribute('data-accid');
    let accidGes = noteGroup.getAttribute('data-accid.ges');

    // Check child accid element (Verovio stores explicit accidentals as child elements)
    if (!accid && !accidGes) {
      const accidEl = noteGroup.querySelector('g.accid');
      if (accidEl) {
        accid = accidEl.getAttribute('data-accid');
        accidGes = accidEl.getAttribute('data-accid.ges');
      }
    }

    // Last resort: try Verovio's MEI attributes directly
    if (!accid && !accidGes) {
      const noteId = noteGroup.getAttribute('id');
      if (noteId) {
        try {
          const attrs = tk.getElementAttr(noteId);
          if (attrs['accid.ges']) accidGes = attrs['accid.ges'];
          if (attrs['accid']) accid = attrs['accid'];
        } catch { /* proceed without */ }
      }
    }

    if (!pname || !oct) return;

    const noteInfo = meiAttrToNoteInfo(
      pname,
      parseInt(oct, 10),
      accid || null,
      accidGes || null,
      keySig,
    );

    container.querySelectorAll('g.note.selected').forEach((el) =>
      el.classList.remove('selected'),
    );
    noteGroup.classList.add('selected');

    onNoteClick(noteInfo, noteGroup);
  });

  return keySig;
}

export function getNoteInfosFromIds(container: HTMLElement, noteIds: string[], keySig: KeySignature): NoteInfo[] {
  const results: NoteInfo[] = [];
  for (const id of noteIds) {
    const el = container.querySelector(`[id="${id}"]`) as SVGGElement | null;
    if (!el) continue;
    const pname = el.getAttribute('data-pname');
    const oct = el.getAttribute('data-oct');
    if (!pname || !oct) continue;

    let accid = el.getAttribute('data-accid');
    let accidGes = el.getAttribute('data-accid.ges');
    if (!accid && !accidGes) {
      const accidEl = el.querySelector('g.accid');
      if (accidEl) {
        accid = accidEl.getAttribute('data-accid');
        accidGes = accidEl.getAttribute('data-accid.ges');
      }
    }

    results.push(meiAttrToNoteInfo(pname, parseInt(oct, 10), accid || null, accidGes || null, keySig));
  }
  return results;
}

export function highlightPlayingNotes(container: HTMLElement, noteIds: string[]): void {
  container.querySelectorAll('g.note.playing').forEach(el =>
    el.classList.remove('playing'),
  );
  for (const id of noteIds) {
    const el = container.querySelector(`[id="${id}"]`);
    if (el) {
      el.classList.add('playing');
    }
  }
}

export function highlightPlayingMeasure(container: HTMLElement, noteIds: string[]): void {
  container.querySelectorAll('g.measure.playing-measure').forEach(el =>
    el.classList.remove('playing-measure'),
  );
  const measures = new Set<Element>();
  for (const id of noteIds) {
    const el = container.querySelector(`[id="${id}"]`);
    if (el) {
      const measure = el.closest('g.measure');
      if (measure) measures.add(measure);
    }
  }
  measures.forEach(m => m.classList.add('playing-measure'));
}

export interface ScrollState {
  userScrolledAt: number;
  programmatic: boolean;
}

export function createScrollState(container: HTMLElement): ScrollState {
  const state: ScrollState = { userScrolledAt: 0, programmatic: false };
  container.addEventListener('scroll', () => {
    if (!state.programmatic) {
      state.userScrolledAt = Date.now();
    }
  });
  return state;
}

export function scrollToPlayingNote(container: HTMLElement, noteIds: string[], scrollState?: ScrollState): void {
  if (noteIds.length === 0) return;
  if (scrollState && Date.now() - scrollState.userScrolledAt < 3000) return;

  const el = container.querySelector(`[id="${noteIds[0]}"]`);
  if (!el) return;

  const containerRect = container.getBoundingClientRect();
  const elRect = (el as Element).getBoundingClientRect();

  if (elRect.top < containerRect.top || elRect.bottom > containerRect.bottom) {
    if (scrollState) scrollState.programmatic = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (scrollState) requestAnimationFrame(() => { scrollState.programmatic = false; });
  }
}
