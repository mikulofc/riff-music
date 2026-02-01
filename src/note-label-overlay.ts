import { meiAttrToNoteInfo, type KeySignature } from './note-data';

export function addNoteLabels(container: HTMLElement, keySig?: KeySignature): void {
  const noteGroups = container.querySelectorAll('g.note');

  noteGroups.forEach((noteGroup) => {
    const pname = noteGroup.getAttribute('data-pname');
    const oct = noteGroup.getAttribute('data-oct');
    let accid = noteGroup.getAttribute('data-accid');
    let accidGes = noteGroup.getAttribute('data-accid.ges');

    // Check child accid element for explicit accidentals
    if (!accid && !accidGes) {
      const accidEl = noteGroup.querySelector('g.accid');
      if (accidEl) {
        accid = accidEl.getAttribute('data-accid');
        accidGes = accidEl.getAttribute('data-accid.ges');
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

    // Find the notehead element to position the label
    const useEl = noteGroup.querySelector('use');
    if (!useEl) return;

    const x = parseFloat(useEl.getAttribute('x') || '0');
    const y = parseFloat(useEl.getAttribute('y') || '0');

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(x));
    label.setAttribute('y', String(y - 300));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'note-label');
    label.setAttribute('font-size', '200');
    label.setAttribute('fill', '#4a90d9');
    label.textContent = noteInfo.displayName;

    noteGroup.appendChild(label);
  });
}
