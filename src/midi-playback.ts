import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import type { VerovioToolkit } from 'verovio/esm';

export type PlaybackState = 'stopped' | 'playing' | 'paused';

export interface PlaybackCallbacks {
  onStateChange: (state: PlaybackState) => void;
  onHighlight: (noteIds: string[], page: number) => void;
}

export class MidiPlaybackController {
  private tk: VerovioToolkit;
  private polySynth: Tone.PolySynth;
  private part: Tone.Part | null = null;
  private animFrameId: number | null = null;
  private callbacks: PlaybackCallbacks;
  private totalDurationSec: number = 0;
  private allNoteTimesSec: number[] = [];

  constructor(tk: VerovioToolkit, polySynth: Tone.PolySynth, callbacks: PlaybackCallbacks) {
    this.tk = tk;
    this.polySynth = polySynth;
    this.callbacks = callbacks;
  }

  prepare(): void {
    const base64Midi = this.tk.renderToMIDI();
    const binaryStr = atob(base64Midi);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const midi = new Midi(bytes.buffer);

    const events: Array<{ time: number; note: string; duration: number; velocity: number }> = [];
    let maxEndTime = 0;

    for (const track of midi.tracks) {
      for (const note of track.notes) {
        events.push({
          time: note.time,
          note: note.name,
          duration: note.duration,
          velocity: note.velocity,
        });
        maxEndTime = Math.max(maxEndTime, note.time + note.duration);
      }
    }

    this.totalDurationSec = maxEndTime;

    const onsetSet = new Set(events.map(e => e.time));
    this.allNoteTimesSec = [...onsetSet].sort((a, b) => a - b);

    const transport = Tone.getTransport();
    transport.cancel(0);
    transport.stop();
    transport.seconds = 0;

    if (midi.header.tempos.length > 0) {
      transport.bpm.value = midi.header.tempos[0].bpm;
    }

    this.part = new Tone.Part((time, event) => {
      this.polySynth.triggerAttackRelease(
        event.note,
        event.duration,
        time,
        event.velocity
      );
    }, events.map(e => ({ time: e.time, note: e.note, duration: e.duration, velocity: e.velocity })));

    this.part.start(0);

    transport.scheduleOnce(() => {
      this.stop();
    }, this.totalDurationSec + 0.5);
  }

  play(): void {
    Tone.getTransport().start();
    this.startHighlightLoop();
    this.callbacks.onStateChange('playing');
  }

  pause(): void {
    Tone.getTransport().pause();
    this.stopHighlightLoop();
    this.callbacks.onStateChange('paused');
  }

  stop(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.seconds = 0;
    this.polySynth.releaseAll();
    this.stopHighlightLoop();
    this.callbacks.onHighlight([], 0);
    this.callbacks.onStateChange('stopped');
  }

  nextNote(): void {
    const currentSec = Tone.getTransport().seconds;
    const next = this.allNoteTimesSec.find(t => t > currentSec + 0.01);
    if (next !== undefined) {
      this.seekToTime(next);
    }
  }

  prevNote(): void {
    const currentSec = Tone.getTransport().seconds;
    let prev: number | undefined;
    for (let i = this.allNoteTimesSec.length - 1; i >= 0; i--) {
      if (this.allNoteTimesSec[i] < currentSec - 0.01) {
        prev = this.allNoteTimesSec[i];
        break;
      }
    }
    if (prev !== undefined) {
      this.seekToTime(prev);
    }
  }

  seekToElement(xmlId: string): void {
    const timeMs = this.tk.getTimeForElement(xmlId);
    if (timeMs >= 0) {
      this.seekToTime(timeMs / 1000);
    }
  }

  dispose(): void {
    this.stopHighlightLoop();
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    if (this.part) {
      this.part.dispose();
      this.part = null;
    }
    this.polySynth.releaseAll();
  }

  private seekToTime(seconds: number): void {
    const transport = Tone.getTransport();
    const wasPlaying = transport.state === 'started';

    transport.pause();
    this.polySynth.releaseAll();
    transport.seconds = seconds;

    if (wasPlaying) {
      transport.start();
      this.startHighlightLoop();
      this.callbacks.onStateChange('playing');
    } else {
      this.updateHighlight();
      this.callbacks.onStateChange('paused');
    }
  }

  private startHighlightLoop(): void {
    if (this.animFrameId !== null) return;

    const tick = () => {
      this.updateHighlight();
      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  private stopHighlightLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private updateHighlight(): void {
    const currentMs = Tone.getTransport().seconds * 1000;
    const result = this.tk.getElementsAtTime(currentMs);
    this.callbacks.onHighlight(result.notes || [], result.page || 0);
  }
}
