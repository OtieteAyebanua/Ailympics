/**
 * Client presentation state — Svelte stores only.
 *
 * Everything here is derived from sealed server packets or local viewer
 * settings. Nothing in these stores ever feeds back into match truth.
 */
import { writable } from "./store";
import type { EventCue, ScorebugState } from "../../../lib/agenticfoot/broadcast";

export type ConnectionState =
  | "connecting"
  | "live"
  | "reconnecting"
  | "buffering"
  | "fulltime";

export const connection = writable<ConnectionState>("connecting");
export const scorebug = writable<ScorebugState | undefined>(undefined);
export const feed = writable<EventCue[]>([]);
export const bufferSeconds = writable(0);

/** Banner shown over the pitch for major moments (goal, card, period, VAR). */
export interface Banner {
  id: string;
  kind: "goal" | "card" | "period" | "review" | "replay" | "offside" | "restart";
  title: string;
  subtitle?: string;
  accent?: string;
  /** Wall-clock ms when the banner should leave. */
  until: number;
}
export const banner = writable<Banner | undefined>(undefined);

/** Short-lived restart context so a reset never looks unexplained. */
export interface RestartNotice {
  id: string;
  title: string;
  reason: string;
  until: number;
}
export const restartNotice = writable<RestartNotice | undefined>(undefined);

/** Lower-third commentary line. */
export interface CommentaryLine {
  id: string;
  text: string;
  intensity: number;
  until: number;
}
export const commentary = writable<CommentaryLine | undefined>(undefined);

/** Replay presentation state (frames are sealed history, never invented). */
export interface ReplayState {
  cueId: string;
  label: string;
  startSecond: number;
  endSecond: number;
  playbackSpeed: number;
  camera: string;
  /** performance.now() when replay playback began. */
  startedAt: number;
}
export const replay = writable<ReplayState | undefined>(undefined);

/** Viewer settings — local presentation choices only. */
export const audioEnabled = writable(false);
export const feedCollapsed = writable(false);
export const debugMode = writable(
  typeof location !== "undefined" && new URLSearchParams(location.search).has("debug"),
);
