import * as Tone from 'tone';
import type { NoteInfo } from './note-data';

let synth: Tone.Synth | null = null;
let polySynth: Tone.PolySynth | null = null;
let audioStarted = false;

export async function ensureAudioStarted(): Promise<void> {
  if (!audioStarted) {
    await Tone.start();
    audioStarted = true;
  }
  if (!synth) {
    synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.5 },
    }).toDestination();
  }
  if (!polySynth) {
    polySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.5 },
    }).toDestination();
  }
}

export function getPolySynth(): Tone.PolySynth {
  if (!polySynth) {
    throw new Error('Audio not started. Call ensureAudioStarted() first.');
  }
  return polySynth;
}

export function isAudioStarted(): boolean {
  return audioStarted;
}

export async function playNote(note: NoteInfo): Promise<void> {
  await ensureAudioStarted();
  synth!.triggerAttackRelease(note.toneJsName, '8n');
}
