// TrackAudioStore holds decoded audio (one AudioBuffer per track).
//
// Phase 11: this is the shared home for decoded PCM. The Player side
// (AudioEngine) reads AudioBuffers from here to build buffer sources. The
// future Analyzer side must NOT receive Web Audio types (see the 2026-07-10
// decision), so it gets plain PCM via pcmFor() instead.
//
// The store is deliberately in-memory only: a picked file must be picked
// again after a reload. Persistent audio storage (e.g. IndexedDB) is a
// future phase that would slot in behind this same interface.

/** Plain PCM for the Analyzer boundary: no Web Audio types cross it. */
export type TrackPcm = {
  samples: Float32Array;
  sampleRate: number;
};

export class TrackAudioStore {
  private buffers = new Map<string, AudioBuffer>();

  /** Store the decoded audio for a track, replacing any previous buffer. */
  set(trackId: string, buffer: AudioBuffer): void {
    this.buffers.set(trackId, buffer);
  }

  /** The decoded audio for a track, or null when none was imported. */
  get(trackId: string): AudioBuffer | null {
    return this.buffers.get(trackId) ?? null;
  }

  has(trackId: string): boolean {
    return this.buffers.has(trackId);
  }

  /**
   * The track's audio as plain PCM (first channel only), or null when none
   * was imported. This is the entry point a future Analyzer will consume.
   */
  pcmFor(trackId: string): TrackPcm | null {
    const buffer = this.buffers.get(trackId);
    if (!buffer) return null;
    return {
      samples: buffer.getChannelData(0),
      sampleRate: buffer.sampleRate,
    };
  }
}
