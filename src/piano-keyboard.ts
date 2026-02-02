import type { NoteInfo } from './note-data';

const WHITE_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_KEY_OFFSETS: Record<string, number> = {
  'C#': 0,
  'D#': 1,
  'F#': 3,
  'G#': 4,
  'A#': 5,
};

const WHITE_KEY_WIDTH = 40;
const WHITE_KEY_HEIGHT = 150;
const BLACK_KEY_WIDTH = 24;
const BLACK_KEY_HEIGHT = 95;
const OCTAVES_TO_SHOW = 4;
const START_OCTAVE = 2;

const FLAT_TO_SHARP: Record<string, string> = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
};

function normalizeToSharp(name: string): string {
  return FLAT_TO_SHARP[name] || name;
}

export function createPianoKeyboard(container: HTMLElement) {
  const totalWhiteKeys = WHITE_KEYS.length * OCTAVES_TO_SHOW;
  const svgWidth = totalWhiteKeys * WHITE_KEY_WIDTH;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${svgWidth} ${WHITE_KEY_HEIGHT}`);
  svg.setAttribute('class', 'piano-keyboard');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // White keys
  for (let octIdx = 0; octIdx < OCTAVES_TO_SHOW; octIdx++) {
    const oct = START_OCTAVE + octIdx;
    WHITE_KEYS.forEach((noteName, keyIdx) => {
      const x = (octIdx * 7 + keyIdx) * WHITE_KEY_WIDTH;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', '0');
      rect.setAttribute('width', String(WHITE_KEY_WIDTH - 1));
      rect.setAttribute('height', String(WHITE_KEY_HEIGHT));
      rect.setAttribute('class', 'piano-key white');
      rect.setAttribute('data-note', `${noteName}${oct}`);
      rect.setAttribute('rx', '3');
      svg.appendChild(rect);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(x + WHITE_KEY_WIDTH / 2));
      text.setAttribute('y', String(WHITE_KEY_HEIGHT - 8));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('class', 'piano-key-label');
      text.textContent = noteName + oct;
      svg.appendChild(text);
    });
  }

  // Black keys (drawn on top)
  for (let octIdx = 0; octIdx < OCTAVES_TO_SHOW; octIdx++) {
    const oct = START_OCTAVE + octIdx;
    Object.entries(BLACK_KEY_OFFSETS).forEach(([noteName, offset]) => {
      const whiteKeyX = (octIdx * 7 + offset) * WHITE_KEY_WIDTH;
      const x = whiteKeyX + WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', '0');
      rect.setAttribute('width', String(BLACK_KEY_WIDTH));
      rect.setAttribute('height', String(BLACK_KEY_HEIGHT));
      rect.setAttribute('class', 'piano-key black');
      rect.setAttribute('data-note', `${noteName}${oct}`);
      rect.setAttribute('rx', '2');
      svg.appendChild(rect);
    });
  }

  container.appendChild(svg);

  function highlightKey(note: NoteInfo) {
    clearHighlight();
    const normalizedName = normalizeToSharp(note.displayName) + note.octave;
    const key = svg.querySelector(`[data-note="${normalizedName}"]`);
    if (key) key.classList.add('active');
  }

  function highlightKeys(notes: NoteInfo[]) {
    clearHighlight();
    for (const note of notes) {
      const normalizedName = normalizeToSharp(note.displayName) + note.octave;
      const key = svg.querySelector(`[data-note="${normalizedName}"]`);
      if (key) key.classList.add('active');
    }
  }

  function clearHighlight() {
    svg.querySelectorAll('.active').forEach((el) => el.classList.remove('active'));
  }

  return { highlightKey, highlightKeys, clearHighlight };
}
