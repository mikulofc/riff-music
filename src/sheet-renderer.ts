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

  // Parse key signature from MEI
  let keySig: KeySignature = {};
  try {
    const mei = tk.getMEI();
    const parser = new DOMParser();
    const doc = parser.parseFromString(mei, 'text/xml');
    // Try staffDef keySig attribute or keySig element
    const staffDef = doc.querySelector('staffDef[key\\.sig], staffDef[keysig]');
    const keySigAttr = staffDef?.getAttribute('key.sig') || staffDef?.getAttribute('keysig');
    if (keySigAttr) {
      const match = keySigAttr.match(/^(\d+)(s|f)$/);
      if (match) {
        const fifths = parseInt(match[1], 10) * (match[2] === 'f' ? -1 : 1);
        keySig = parseKeySignature(fifths);
      }
    }
    if (!keySigAttr) {
      const keySigEl = doc.querySelector('keySig[sig]');
      const sig = keySigEl?.getAttribute('sig');
      if (sig) {
        const match = sig.match(/^(\d+)(s|f)$/);
        if (match) {
          const fifths = parseInt(match[1], 10) * (match[2] === 'f' ? -1 : 1);
          keySig = parseKeySignature(fifths);
        }
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
