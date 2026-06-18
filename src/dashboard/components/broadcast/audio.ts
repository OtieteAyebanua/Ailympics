/**
 * Stadium atmosphere driven by bundled football-match samples.
 *
 * Audio starts only after a user action: `enable()` must be called from a
 * click handler, and `disable()` suspends the graph.
 */
import type { ActionCue, CommentaryCue, CrowdCue } from "../../../lib/agenticfoot/broadcast";
import ambientCrowdUrl from "./assets/audio/ambient-sports-crowd.mp3";
import kickUrl from "./assets/audio/soccer-ball-kick.mp3";
import chantRoarUrl from "./assets/audio/stadium-chant-roar.mp3";
import stadiumYellUrl from "./assets/audio/stadium-yell.mp3";
import whistleUrl from "./assets/audio/referee-whistle.mp3";
import { resolveAudioUrl } from "./stream";

type SampleKey = "crowd" | "kick" | "roar" | "yell" | "whistle";

const SAMPLE_URLS: Readonly<Record<SampleKey, string>> = {
  crowd: ambientCrowdUrl,
  kick: kickUrl,
  roar: chantRoarUrl,
  yell: stadiumYellUrl,
  whistle: whistleUrl,
};

export class StadiumAudio {
  private ctx: AudioContext | undefined;
  private master: GainNode | undefined;
  private crowdGain: GainNode | undefined;
  private samples: Map<SampleKey, AudioBuffer> | undefined;
  private commentarySamples = new Map<string, AudioBuffer>();
  private anthemVoices: OscillatorNode[] = [];
  private crowdGainBeforeSpeech: number | undefined;
  private readonly baseIntensity = 0.24;
  private readonly lastActionAt = new Map<ActionCue["kind"], number>();
  private readonly spokenCommentaryIds = new Set<string>();

  get enabled(): boolean {
    return this.ctx !== undefined && this.ctx.state === "running";
  }

  /** Must be invoked from a user gesture. */
  async enable(): Promise<void> {
    if (this.ctx) {
      await this.ctx.resume();
      return;
    }

    const ctx = new AudioContext();
    this.ctx = ctx;
    this.samples = await loadSamples(ctx);

    this.master = ctx.createGain();
    this.master.gain.value = 0.72;
    this.master.connect(ctx.destination);

    const crowd = ctx.createBufferSource();
    crowd.buffer = this.samples.get("crowd")!;
    crowd.loop = true;
    crowd.playbackRate.value = 0.98;

    const crowdFilter = ctx.createBiquadFilter();
    crowdFilter.type = "lowpass";
    crowdFilter.frequency.value = 3400;

    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = this.baseIntensity;

    crowd.connect(crowdFilter).connect(this.crowdGain).connect(this.master);
    crowd.start();
  }

  async disable(): Promise<void> {
    if (this.ctx) await this.ctx.suspend();
  }

  /** Follow a sealed crowd cue: ramp ambience and add stadium one-shots. */
  applyCue(cue: CrowdCue): void {
    if (!this.ctx || !this.crowdGain || this.ctx.state !== "running") return;

    const now = this.ctx.currentTime;
    const target = 0.14 + cue.intensity * 0.42;
    const gain = this.crowdGain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);

    switch (cue.texture) {
      case "celebration":
        gain.linearRampToValueAtTime(Math.max(target, 0.68), now + 0.4);
        gain.exponentialRampToValueAtTime(this.baseIntensity, now + Math.max(cue.durationSeconds, 4));
        this.play("roar", now, 0.44 + cue.intensity * 0.2);
        break;
      case "anticipation":
        gain.linearRampToValueAtTime(target, now + 0.75);
        gain.linearRampToValueAtTime(this.baseIntensity, now + Math.max(cue.durationSeconds, 3));
        if (cue.intensity >= 0.8) this.play("yell", now + 0.1, 0.18 + cue.intensity * 0.12);
        break;
      case "whistle":
        this.play("whistle", now, 0.58);
        gain.linearRampToValueAtTime(target, now + 0.25);
        gain.linearRampToValueAtTime(this.baseIntensity, now + 2.4);
        break;
      case "fulltime":
        this.play("whistle", now, 0.58);
        this.play("whistle", now + 0.46, 0.54);
        this.play("whistle", now + 0.96, 0.62);
        this.play("roar", now + 0.35, 0.42);
        gain.linearRampToValueAtTime(Math.max(target, 0.56), now + 1.2);
        gain.linearRampToValueAtTime(0.2, now + 10);
        break;
    }
  }

  /**
   * Swell the stadium ambience for the pre-match anthems — a sustained crowd
   * hum that rises, holds, and settles. No music asset is played; this is just
   * the crowd. Best-effort: silent until the viewer enables audio.
   */
  anthem(durationSeconds: number): void {
    if (!this.ctx || !this.crowdGain || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    // Hold the crowd a touch below the anthem music so the fanfare sits on top.
    const gain = this.crowdGain.gain;
    const hold = Math.max(2, durationSeconds - 2);
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0.34, now + 2);
    gain.setValueAtTime(0.34, now + hold);
    gain.linearRampToValueAtTime(this.baseIntensity, now + durationSeconds);
    this.play("yell", now + 0.3, 0.14);
    this.playAnthemMusic(durationSeconds);
  }

  /**
   * Synthesize an original ceremonial fanfare for the anthem — a solemn brass
   * pad stepping through a slow A-major progression. Deliberately NOT a real
   * national anthem (those are copyrighted recordings); this is a generated
   * placeholder. Swap in a licensed track here if one is provided.
   */
  private playAnthemMusic(durationSeconds: number): void {
    if (!this.ctx || !this.master || this.ctx.state !== "running") return;
    this.stopAnthemMusic();
    const ctx = this.ctx;
    const start = ctx.currentTime + 0.05;
    const end = start + durationSeconds;

    // Warm brass-pad bus: voices → lowpass → swell envelope → master.
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1150;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, start);
    bus.gain.linearRampToValueAtTime(0.17, start + 1.6);
    bus.gain.setValueAtTime(0.17, Math.max(start + 1.6, end - 1.8));
    bus.gain.linearRampToValueAtTime(0.0001, end);
    filter.connect(bus).connect(this.master);

    // Slow hymn-like A-major progression: each chord is three sustained voices
    // (bass, mid, top) that step their frequency at the chord boundaries.
    const chords: [number, number, number][] = [
      [110.0, 164.81, 277.18], // A
      [146.83, 220.0, 293.66], // D
      [164.81, 246.94, 329.63], // E
      [110.0, 220.0, 277.18], // A
      [146.83, 220.0, 349.23], // D (add)
      [164.81, 246.94, 329.63], // E
      [110.0, 164.81, 277.18], // A
    ];
    const step = Math.max(1.4, durationSeconds / chords.length);

    this.anthemVoices = [0, 1, 2].map((voice) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      const vGain = ctx.createGain();
      vGain.gain.value = voice === 0 ? 0.5 : 0.32;
      osc.connect(vGain).connect(filter);
      chords.forEach((chord, ci) => {
        const at = start + ci * step;
        if (at < end) osc.frequency.setValueAtTime(chord[voice]!, at);
      });
      osc.start(start);
      osc.stop(end + 0.1);
      return osc;
    });
  }

  private stopAnthemMusic(): void {
    for (const osc of this.anthemVoices) {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    }
    this.anthemVoices = [];
  }

  /** Add close-up match texture from sealed action cues. */
  applyAction(action: ActionCue): void {
    if (!this.ctx || this.ctx.state !== "running") return;

    const now = this.ctx.currentTime;
    const last = this.lastActionAt.get(action.kind) ?? -Infinity;
    if (now - last < 0.08) return;
    this.lastActionAt.set(action.kind, now);

    switch (action.kind) {
      case "kick":
      case "restart":
        this.play("kick", now, action.flags?.["source"] === "shot" ? 0.34 : 0.22, action.kind === "restart" ? 0.92 : 1);
        break;
      case "contact":
      case "duel":
        this.play("kick", now, 0.12, 0.72);
        break;
      case "save":
        this.play("yell", now, 0.2);
        break;
      case "foul":
      case "offside":
        this.play("whistle", now, 0.48);
        break;
      case "goal":
        this.play("roar", now, 0.5);
        break;
      case "ball_out":
        break;
    }
  }

  /** Speak lower-third commentary above the stadium mix. */
  speakCommentary(cue: CommentaryCue): void {
    if (!this.ctx || this.ctx.state !== "running") return;
    if (this.spokenCommentaryIds.has(cue.id)) return;
    if (!cue.audioUrl) {
      console.warn(`Commentary cue ${cue.id} has no pregenerated audioUrl`);
      return;
    }
    this.spokenCommentaryIds.add(cue.id);
    void this.playCommentary(cue.audioUrl).catch((error) => {
      console.warn(error instanceof Error ? error.message : String(error));
    });
  }

  private play(key: SampleKey, at: number, volume: number, rate = 1): void {
    if (!this.ctx || !this.master || !this.samples) return;
    const buffer = this.samples.get(key);
    if (!buffer) throw new Error(`Missing stadium audio sample: ${key}`);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.001, volume), at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + Math.min(buffer.duration / rate, 3.5));

    source.connect(gain).connect(this.master);
    source.start(at);
  }

  private duckCrowdForSpeech(): void {
    if (!this.ctx || !this.crowdGain) return;
    const now = this.ctx.currentTime;
    const gain = this.crowdGain.gain;
    this.crowdGainBeforeSpeech = Math.max(this.baseIntensity, gain.value);
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0.09, now + 0.18);
  }

  private restoreCrowdAfterSpeech(): void {
    if (!this.ctx || !this.crowdGain) return;
    const now = this.ctx.currentTime;
    const gain = this.crowdGain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(this.crowdGainBeforeSpeech ?? this.baseIntensity, now + 0.35);
    this.crowdGainBeforeSpeech = undefined;
  }

  private async playCommentary(audioUrl: string): Promise<void> {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const url = resolveAudioUrl(audioUrl);
    let buffer = this.commentarySamples.get(url);
    if (!buffer) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Unable to load pregenerated commentary audio: ${response.status}`);
      buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      this.commentarySamples.set(url, buffer);
    }
    const now = ctx.currentTime;
    this.duckCrowdForSpeech();
    this.playBuffer(buffer, now, 0.88);
    window.setTimeout(() => this.restoreCrowdAfterSpeech(), Math.ceil(buffer.duration * 1000) + 180);
  }

  private playBuffer(buffer: AudioBuffer, at: number, volume: number): void {
    if (!this.ctx || !this.master) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.001, volume), at);
    gain.gain.setValueAtTime(Math.max(0.001, volume), at + Math.max(0, buffer.duration - 0.08));
    gain.gain.linearRampToValueAtTime(0.001, at + buffer.duration);
    source.connect(gain).connect(this.master);
    source.start(at);
  }
}

async function loadSamples(ctx: AudioContext): Promise<Map<SampleKey, AudioBuffer>> {
  const entries = await Promise.all(
    Object.entries(SAMPLE_URLS).map(async ([key, url]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Unable to load stadium audio sample ${key}: ${response.status}`);
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      return [key as SampleKey, buffer] as const;
    }),
  );
  return new Map(entries);
}
