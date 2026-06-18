/**
 * Presentation director — turns sealed presentation cues into HUD state.
 *
 * The server decides WHAT airs (replay windows, camera suggestions,
 * commentary lines, crowd swells); the director only decides front-of-house
 * pacing: when the playhead crosses a cue, push it into the right store.
 * It never invents events, frames, or replay ranges.
 */
import type {
  ActionCue,
  CameraCue,
  CommentaryCue,
  CrowdCue,
  EventCue,
  ReplayCue,
  SecondPayload,
} from "../../../lib/agenticfoot/broadcast";
import {
  banner,
  commentary,
  replay,
  restartNotice,
  type Banner,
  type ReplayState,
  type RestartNotice,
} from "./stores";
import type { FramePlayback } from "./playback";

interface DirectorAudio {
  applyAction(action: ActionCue): void;
  applyCue(cue: CrowdCue): void;
  speakCommentary(cue: CommentaryCue): void;
}

const BANNER_MS: Record<Banner["kind"], number> = {
  goal: 6500,
  card: 4500,
  period: 6000,
  review: 5000,
  replay: 3000,
  offside: 4200,
  restart: 3200,
};
const RESTART_NOTICE_MS = 9500;

export class Director {
  private readonly seen = new Set<string>();
  private pendingReplays: ReplayCue[] = [];
  private pendingCameras: CameraCue[] = [];
  private pendingCommentary: CommentaryCue[] = [];
  private queuedCommentary: CommentaryCue[] = [];
  private pendingCrowd: CrowdCue[] = [];
  private pendingActions: ActionCue[] = [];
  private pendingBanners: { at: number; banner: Banner }[] = [];
  private pendingRestartNotices: { at: number; cue: EventCue }[] = [];
  private activeReplay:
    | (ReplayState & { realDurationMs: number; endSign: 1 | -1 })
    | undefined;
  private activeCameraCue: CameraCue | undefined;
  private activeCommentaryUntil = 0;

  private readonly playbackBuffer: FramePlayback;
  private readonly audio: DirectorAudio;

  constructor(playbackBuffer: FramePlayback, audio: DirectorAudio) {
    this.playbackBuffer = playbackBuffer;
    this.audio = audio;
  }

  /** Ingest one aired second's cues (dedupes on cue id across re-syncs). */
  ingest(payload: SecondPayload): void {
    const p = payload.presentation;
    for (const cue of p.replays) if (this.mark(`r:${cue.id}`)) this.pendingReplays.push(cue);
    for (const cue of p.cameras) if (this.mark(`c:${cue.id}`)) this.pendingCameras.push(cue);
    for (const cue of p.commentary) if (this.mark(`m:${cue.id}`)) this.pendingCommentary.push(cue);
    for (const cue of p.crowd) if (this.mark(`w:${cue.id}`)) this.pendingCrowd.push(cue);
    for (const action of payload.actions) {
      const player = action.playerId ?? "";
      if (this.mark(`a:${payload.second}:${action.kind}:${action.t}:${player}`)) this.pendingActions.push(action);
    }
    for (const cue of payload.cues) {
      const b = bannerFor(cue);
      if (b && this.mark(`b:${cue.id}`)) this.pendingBanners.push({ at: cue.matchSecond, banner: b });
      if (isRestartCue(cue) && this.mark(`n:${cue.id}`)) {
        this.pendingRestartNotices.push({ at: cue.matchSecond, cue });
      }
    }
  }

  /**
   * Advance presentation to the live playhead. Returns the camera mode the
   * scene should use this frame plus the replay sample second, if replaying.
   */
  tick(
    playheadSecond: number,
    now: number,
  ): { camera: string; replaySecond?: number; replayEndSign?: 1 | -1 } {
    // Banners.
    this.pendingBanners = this.pendingBanners.filter((entry) => {
      if (entry.at <= playheadSecond) {
        banner.set({ ...entry.banner, until: now + BANNER_MS[entry.banner.kind] });
        return false;
      }
      return true;
    });
    banner.update((b) => (b && b.until < now ? undefined : b));
    restartNotice.update((n) => (n && n.until < now ? undefined : n));

    this.pendingRestartNotices = this.pendingRestartNotices.filter((entry) => {
      if (entry.at <= playheadSecond) {
        restartNotice.set(restartNoticeFor(entry.cue, now));
        return false;
      }
      return true;
    });

    // Commentary lower-third.
    this.pendingCommentary = this.pendingCommentary.filter((cue) => {
      if (cue.matchSecond <= playheadSecond) {
        this.queuedCommentary.push(cue);
        return false;
      }
      return true;
    });
    if (this.activeCommentaryUntil > 0 && this.activeCommentaryUntil < now) {
      this.activeCommentaryUntil = 0;
      commentary.set(undefined);
    }
    if (this.activeCommentaryUntil <= now && this.queuedCommentary.length > 0) {
      const cue = this.queuedCommentary.shift()!;
      const durationMs = Math.max(3500, Math.min(9000, cue.text.length * 65));
      this.activeCommentaryUntil = now + durationMs;
      commentary.set({
        id: cue.id,
        text: cue.text,
        intensity: cue.intensity,
        until: this.activeCommentaryUntil,
      });
      this.audio.speakCommentary(cue);
    }

    // Crowd.
    this.pendingCrowd = this.pendingCrowd.filter((cue) => {
      if (cue.matchSecond <= playheadSecond) {
        this.audio.applyCue(cue);
        return false;
      }
      return true;
    });

    this.pendingActions = this.pendingActions.filter((action) => {
      if (action.t <= playheadSecond) {
        this.audio.applyAction(action);
        return false;
      }
      return true;
    });

    // Replays: enter when due and the sealed tail covers the window. The
    // window runs past the event (e.g. a goal's +3s), so when the cue first
    // comes due those trailing frames usually aren't buffered yet — WAIT for
    // them to seal rather than discarding the cue (which dropped goal replays
    // intermittently). Only give up if the window's start has aged off the tail.
    if (!this.activeReplay) {
      const idx = this.pendingReplays.findIndex(
        (cue) => cue.matchSecond + (cue.holdSeconds ?? 0) <= playheadSecond,
      );
      if (idx >= 0) {
        const cue = this.pendingReplays[idx]!;
        if (this.playbackBuffer.hasWindow(cue.startSecond, cue.endSecond)) {
          this.pendingReplays.splice(idx, 1);
          const realDurationMs =
            ((cue.endSecond - cue.startSecond) / Math.max(cue.playbackSpeed, 0.05)) * 1000;
          // Lock the replay camera to the end the play resolves at (the ball's
          // position at the window's end — i.e. the goal). Without this the
          // close camera derives its end from the live ball each frame and can
          // open pointing away from goal or whip across midfield onto the stands.
          const endFrame = this.playbackBuffer.sampleAt(cue.endSecond);
          const endX = endFrame
            ? endFrame.a.ball.position.x +
              (endFrame.b.ball.position.x - endFrame.a.ball.position.x) * endFrame.alpha
            : 0;
          this.activeReplay = {
            cueId: cue.id,
            label: cue.label,
            startSecond: cue.startSecond,
            endSecond: cue.endSecond,
            playbackSpeed: cue.playbackSpeed,
            camera: cue.camera,
            startedAt: now,
            realDurationMs,
            endSign: endX >= 0 ? 1 : -1,
          };
          replay.set(this.activeReplay);
          // Freeze the live game: the viewer is watching the replay, so the
          // live picture holds at this second and resumes when the replay ends.
          this.playbackBuffer.pause(now);
        } else if ((this.playbackBuffer.oldestSecond ?? 0) > cue.startSecond) {
          // Start fell off the retained tail (late join / stream gap) — it can
          // never air without inventing frames, so drop it.
          this.pendingReplays.splice(idx, 1);
        }
        // Else: keep it pending until the trailing frames seal in.
      }
    }

    if (this.activeReplay) {
      const elapsed = now - this.activeReplay.startedAt;
      if (elapsed >= this.activeReplay.realDurationMs) {
        this.activeReplay = undefined;
        replay.set(undefined);
        // Replay over — resume live play from the second it was frozen at.
        this.playbackBuffer.resume(now);
      } else {
        const second =
          this.activeReplay.startSecond + (elapsed / 1000) * this.activeReplay.playbackSpeed;
        return {
          camera: this.activeReplay.camera,
          replaySecond: second,
          replayEndSign: this.activeReplay.endSign,
        };
      }
    }

    // Camera cues (live only; replays own the camera while active).
    this.pendingCameras = this.pendingCameras.filter((cue) => cue.endSecond > playheadSecond);
    const due = this.pendingCameras.find(
      (cue) => cue.startSecond <= playheadSecond && playheadSecond < cue.endSecond,
    );
    this.activeCameraCue = due;
    return { camera: this.activeCameraCue?.mode ?? "broadcast_wide" };
  }

  private mark(key: string): boolean {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
}

/** Map feed cues to over-pitch banners for the big moments only. */
function bannerFor(cue: EventCue): Banner | undefined {
  const kind = cue.kind;
  if (kind === "goal") {
    return { id: cue.id, kind: "goal", title: "GOAL", subtitle: cue.text, until: 0 };
  }
  if (kind === "card" || kind === "yellow_card" || kind === "red_card") {
    return { id: cue.id, kind: "card", title: kind === "red_card" ? "RED CARD" : "CAUTION", subtitle: cue.text, until: 0 };
  }
  if (kind === "period_end" || kind === "kickoff") {
    // Kickoff banner only for the very first second of a period.
    return {
      id: cue.id,
      kind: "period",
      title: kind === "period_end" ? "END OF THE HALF" : "KICK-OFF",
      subtitle: cue.text,
      until: 0,
    };
  }
  if (kind === "var_check" || kind === "review") {
    return { id: cue.id, kind: "review", title: "REVIEW", subtitle: cue.text, until: 0 };
  }
  if (kind === "offside") {
    return { id: cue.id, kind: "offside", title: "OFFSIDE", subtitle: cue.text, until: 0 };
  }
  if (
    kind === "direct_free_kick" ||
    kind === "indirect_free_kick" ||
    kind === "penalty_kick" ||
    kind === "corner_kick" ||
    kind === "throw_in" ||
    kind === "goal_kick"
  ) {
    return { id: cue.id, kind: "restart", title: restartTitle(kind), subtitle: cue.text, until: 0 };
  }
  return undefined;
}

function isRestartCue(cue: EventCue): boolean {
  return (
    cue.kind === "offside" ||
    cue.kind === "direct_free_kick" ||
    cue.kind === "indirect_free_kick" ||
    cue.kind === "penalty_kick" ||
    cue.kind === "corner_kick" ||
    cue.kind === "throw_in" ||
    cue.kind === "goal_kick"
  );
}

function restartNoticeFor(cue: EventCue, now: number): RestartNotice {
  const title = cue.kind === "offside" ? "OFFSIDE RESTART" : restartTitle(cue.kind);
  return {
    id: cue.id,
    title,
    reason: cue.text,
    until: now + RESTART_NOTICE_MS,
  };
}

function restartTitle(kind: EventCue["kind"]): string {
  switch (kind) {
    case "direct_free_kick":
      return "FREE KICK";
    case "indirect_free_kick":
      return "INDIRECT FREE KICK";
    case "penalty_kick":
      return "PENALTY";
    case "corner_kick":
      return "CORNER";
    case "throw_in":
      return "THROW-IN";
    case "goal_kick":
      return "GOAL KICK";
    default:
      return "RESTART";
  }
}
