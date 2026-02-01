export interface NoteInfo {
  pitchClass: string;
  accidental: string | null;
  octave: number;
  displayName: string;
  toneJsName: string;
  midiNote: number;
}

const ACCID_MAP: Record<string, string> = {
  s: '#',
  f: 'b',
  ss: '##',
  x: '##',
  ff: 'bb',
  n: '',
};

const PITCH_CLASS_SEMITONES: Record<string, number> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
};

const ACCID_SEMITONE_OFFSET: Record<string, number> = {
  s: 1,
  f: -1,
  ss: 2,
  x: 2,
  ff: -2,
  n: 0,
};

// Key signature: fifths > 0 = sharps, fifths < 0 = flats
const SHARP_ORDER = ['f', 'c', 'g', 'd', 'a', 'e', 'b'];
const FLAT_ORDER = ['b', 'e', 'a', 'd', 'g', 'c', 'f'];

export type KeySignature = Record<string, string>;

export function parseKeySignature(fifths: number): KeySignature {
  const accidentals: KeySignature = {};
  if (fifths > 0) {
    for (let i = 0; i < fifths && i < SHARP_ORDER.length; i++) {
      accidentals[SHARP_ORDER[i]] = 's';
    }
  } else if (fifths < 0) {
    for (let i = 0; i < -fifths && i < FLAT_ORDER.length; i++) {
      accidentals[FLAT_ORDER[i]] = 'f';
    }
  }
  return accidentals;
}

export function meiAttrToNoteInfo(
  pname: string,
  oct: number,
  accid: string | null,
  accidGes: string | null,
  keySig?: KeySignature,
): NoteInfo {
  // accid.ges = sounding accidental (from key signature)
  // accid = written accidental (printed on score)
  // Use accid.ges for correct pitch, fall back to accid, then key signature
  let effectiveAccid = accidGes || accid || null;

  // If no explicit accidental, apply key signature
  if (!effectiveAccid && keySig) {
    effectiveAccid = keySig[pname.toLowerCase()] || null;
  }

  const pitchClass = pname.toUpperCase();
  const accidental = effectiveAccid ? (ACCID_MAP[effectiveAccid] || null) : null;
  const displayName = pitchClass + (accidental || '');

  const toneJsName = displayName + oct;

  const baseSemitone = PITCH_CLASS_SEMITONES[pname.toLowerCase()] ?? 0;
  const accidOffset = effectiveAccid
    ? (ACCID_SEMITONE_OFFSET[effectiveAccid] ?? 0)
    : 0;
  const midiNote = (oct + 1) * 12 + baseSemitone + accidOffset;

  return { pitchClass, accidental, octave: oct, displayName, toneJsName, midiNote };
}
