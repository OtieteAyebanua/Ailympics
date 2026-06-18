/**
 * Frame playback buffer — interpolates sealed 15fps frames up to render fps.
 *
 * Interpolation only: positions are blended between two sealed frames. The
 * client never extrapolates beyond the last sealed frame and never invents
 * match state. A tail of aired frames is retained so replay cues can re-air
 * sealed history.
 */
import type { BroadcastFrame } from "../../../lib/agenticfoot/domain";
import type { ActionCue, SecondPayload } from "../../../lib/agenticfoot/broadcast";

export interface FrameSample {
  a: BroadcastFrame;
  b: BroadcastFrame;
  /** 0..1 blend between a and b. */
  alpha: number;
  /** Virtual second being rendered. */
  matchSecond: number;
}

/**
 * Render behind the newest aired second enough to absorb normal 1Hz SSE jitter.
 * Startup headstart is produced server-side; the client should not add a
 * permanent 30s glass-to-glass delay.
 */
const RENDER_LATENCY_S = 1.25;
/** Aired-frame retention so replay windows stay sampleable. */
const TRIM_TAIL_S = 90;

export class FramePlayback {
  private frames: BroadcastFrame[] = [];
  private actions: ActionCue[] = [];
  private anchor: { second: number; at: number } | undefined;
  /**
   * When set, the playhead advances at 1x from `second` starting at wall-time
   * `at` (performance.now() ms) instead of tracking the live edge. The
   * pre-match ceremony uses this to play forward from kickoff; push() keeps
   * ingesting new sealed seconds, so the playhead simply trails the live edge
   * by the pin offset rather than skipping the opening minutes.
   */
  private pin: { second: number; at: number } | undefined;
  /**
   * While a replay is on screen the live game must FREEZE — the viewer is
   * watching the past, so the live playhead is held at the second it stood on
   * when the replay began and resumes from there when the replay ends. `hold`
   * pins the frozen second for the duration; `replayLagMs` accumulates every
   * paused stretch so, after each replay, the playhead trails the live edge by
   * the total replay time rather than snapping forward (a sealed match has no
   * real-time deadline, so falling further behind "live" is invisible).
   */
  private hold: { second: number; at: number } | undefined;
  private replayLagMs = 0;

  /** Ingest one aired broadcast second (15 frames + its clock anchor). */
  push(payload: SecondPayload): void {
    // Frames arrive in broadcast order; drop any duplicates from re-sync.
    const lastSecond = this.frames.at(-1)?.matchSecond ?? -1;
    for (const frame of payload.frames) {
      if (frame.matchSecond > lastSecond) this.frames.push(frame);
    }
    const lastActionSecond = this.actions.at(-1)?.t ?? -1;
    for (const action of payload.actions) {
      if (action.t > lastActionSecond) this.actions.push(action);
    }
    this.actions.sort((a, b) => a.t - b.t);
    this.anchor = { second: payload.second, at: performance.now() };
  }

  get hasFrames(): boolean {
    return this.frames.length > 1;
  }

  /**
   * Pin the playhead to advance at 1x from `second`, starting at wall-time
   * `now` (performance.now() ms). Call once when the pre-match ceremony ends so
   * the broadcast plays from kickoff instead of jumping to the live edge.
   */
  pinPlayhead(second: number, now: number): void {
    this.pin = { second, at: now };
  }

  /**
   * Freeze the live playhead while a replay airs. Call once when a replay
   * begins; the picture under the replay stops advancing so no live play is
   * skipped. Idempotent — repeated calls during one replay are ignored.
   */
  pause(now: number): void {
    if (this.hold) return;
    const second = this.playheadRaw(now);
    if (second === undefined) return;
    this.hold = { second, at: now };
  }

  /**
   * Resume live play after a replay, continuing from the frozen second. The
   * paused span is banked into `replayLagMs` so the playhead picks up exactly
   * where it stopped instead of jumping to the (now-advanced) live edge.
   */
  resume(now: number): void {
    if (!this.hold) return;
    this.replayLagMs += now - this.hold.at;
    this.hold = undefined;
  }

  /** Raw (unclamped) playhead second at wall-time `now`. */
  private playheadRaw(now: number): number | undefined {
    if (this.hold) return this.hold.second;
    const lag = this.replayLagMs / 1000;
    if (this.pin) return this.pin.second + (now - this.pin.at) / 1000 - lag;
    if (!this.anchor) return undefined;
    return this.anchor.second + (now - this.anchor.at) / 1000 - RENDER_LATENCY_S - lag;
  }

  /** Newest sealed second available (playhead upper bound). */
  get newestSecond(): number | undefined {
    return this.frames.at(-1)?.matchSecond;
  }

  /** Oldest sealed second still retained (replay windows below it are gone). */
  get oldestSecond(): number | undefined {
    return this.frames[0]?.matchSecond;
  }

  /**
   * True when the live playhead has caught the end of sealed truth — the
   * broadcast should show a buffering state rather than freeze silently.
   */
  isStalled(now: number): boolean {
    if (this.frames.length < 2) return false;
    const t = this.playheadRaw(now);
    if (t === undefined) return false;
    return t > this.frames[this.frames.length - 1]!.matchSecond + 0.75;
  }

  /** Does the retained tail fully cover [start, end]? */
  hasWindow(start: number, end: number): boolean {
    if (this.frames.length < 2) return false;
    return this.frames[0]!.matchSecond <= start && this.frames[this.frames.length - 1]!.matchSecond >= end;
  }

  /** Retained sealed actions in [t0, t1), for live playback and replays. */
  actionsBetween(t0: number, t1: number): ActionCue[] {
    const start = Math.min(t0, t1);
    const end = Math.max(t0, t1);
    return this.actions.filter((action) => action.t >= start && action.t < end);
  }

  /** Sample an arbitrary sealed match second (replay playback). */
  sampleAt(matchSecond: number): FrameSample | undefined {
    if (this.frames.length < 2) return undefined;
    const first = this.frames[0]!;
    const last = this.frames[this.frames.length - 1]!;
    const t = Math.min(Math.max(matchSecond, first.matchSecond), last.matchSecond);
    return this.bracket(t);
  }

  /** Sample the live playback clock at real time `now` (performance.now() ms). */
  sample(now: number): FrameSample | undefined {
    const raw = this.playheadRaw(now);
    if (raw === undefined || this.frames.length < 2) return undefined;
    const first = this.frames[0]!;
    const last = this.frames[this.frames.length - 1]!;
    const t = Math.min(Math.max(raw, first.matchSecond), last.matchSecond);

    // Trim aired frames well behind the playhead (retention covers replays).
    let drop = 0;
    while (drop + 2 < this.frames.length && this.frames[drop + 1]!.matchSecond < t - TRIM_TAIL_S) {
      drop++;
    }
    if (drop > 0) this.frames.splice(0, drop);
    this.actions = this.actions.filter((action) => action.t >= t - TRIM_TAIL_S);

    return this.bracket(t);
  }

  private bracket(t: number): FrameSample {
    // Find the bracketing pair (frames are sorted by matchSecond).
    let lo = 0;
    let hi = this.frames.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (this.frames[mid]!.matchSecond <= t) lo = mid;
      else hi = mid;
    }
    const a = this.frames[lo]!;
    const b = this.frames[lo + 1]!;
    const span = b.matchSecond - a.matchSecond;
    const alpha = span > 0 ? Math.min(Math.max((t - a.matchSecond) / span, 0), 1) : 0;
    return { a, b, alpha, matchSecond: t };
  }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-path angle interpolation for player facing. */
export function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
