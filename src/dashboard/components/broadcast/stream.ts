/**
 * Broadcast stream client — SSE consumer for /broadcast/stream.
 *
 * The frontend NEVER simulates match truth: it receives sealed frames, cues,
 * sync packets, and scorebug state from the server and renders them.
 * EventSource reconnects automatically; we surface the state so the HUD can
 * show RECONNECTING without tearing down the scene.
 */
import type {
  ActionCue,
  BroadcastSyncPacket,
  ScorebugState,
  SecondPayload,
  TeamPair,
} from "../../../lib/agenticfoot/broadcast";
import type { MatchManifest } from "../../../lib/agenticfoot/domain";
import { env, JWT_KEY } from "../../../lib/env";

export type { ActionCue, BroadcastSyncPacket, ScorebugState, SecondPayload, TeamPair };

export interface ManifestResponse {
  manifest: MatchManifest;
  teams: TeamPair;
}

// Two connection modes:
//  • Direct  — NEXT_PUBLIC_BROADCAST_URL points straight at the agenticfoot VPS
//              (e.g. local dev); endpoints are <base>/broadcast/{manifest,stream}.
//  • Relay   — default; we go through the Next `/api/broadcast-stream` route,
//              which proxies the VPS and enforces auth. EventSource can't set
//              headers, so the app JWT rides as a `?token=` query param.
// Trailing slash tolerated — ngrok/VPS URLs are often pasted by hand.
const DIRECT_URL = env.broadcastUrl?.replace(/\/+$/, "") || undefined;
const RELAY_URL  = `${env.apiUrl}/api/broadcast-stream`;

/** Relay URL with the resource + app JWT as query params (relative-safe). */
function relayUrl(resource: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ resource });
  const token = typeof localStorage !== "undefined" ? localStorage.getItem(JWT_KEY) : null;
  if (token) params.set("token", token);
  for (const [k, v] of Object.entries(extra ?? {})) params.set(k, v);
  return `${RELAY_URL}?${params.toString()}`;
}

/** Build the URL for a broadcast resource. */
export function endpoint(resource: "manifest" | "stream"): string {
  if (DIRECT_URL) return `${DIRECT_URL}/broadcast/${resource}`;
  return relayUrl(resource);
}

/**
 * Resolve a commentary-audio URL (relative to the broadcast server) into a
 * fetchable URL — direct to the VPS, or proxied through the relay.
 */
export function resolveAudioUrl(relative: string): string {
  if (DIRECT_URL) return new URL(relative, DIRECT_URL).toString();
  return relayUrl('audio', { path: relative });
}

export async function fetchManifest(): Promise<ManifestResponse> {
  const res = await fetch(endpoint("manifest"));
  if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
  return (await res.json()) as ManifestResponse;
}

export interface StreamHandlers {
  onSync(packet: BroadcastSyncPacket): void;
  onSecond(payload: SecondPayload): void;
  onEnd(data: { scorebug: ScorebugState }): void;
  onStatus(status: "connecting" | "live" | "reconnecting"): void;
}

function parseSecondPayload(data: string): SecondPayload {
  const payload = JSON.parse(data) as Omit<SecondPayload, "actions"> & { actions?: ActionCue[] };
  return { ...payload, actions: payload.actions ?? [] };
}

/** Connect to the shared broadcast stream. Returns a disposer. */
export function connectBroadcast(handlers: StreamHandlers): () => void {
  handlers.onStatus("connecting");
  const source = new EventSource(endpoint("stream"));
  let everOpened = false;

  source.addEventListener("open", () => {
    everOpened = true;
    handlers.onStatus("live");
  });
  source.addEventListener("error", () => {
    // EventSource retries on its own; report the right flavor of waiting.
    handlers.onStatus(everOpened ? "reconnecting" : "connecting");
  });
  source.addEventListener("sync", (e) => {
    handlers.onSync(JSON.parse((e as MessageEvent<string>).data) as BroadcastSyncPacket);
  });
  source.addEventListener("second", (e) => {
    handlers.onSecond(parseSecondPayload((e as MessageEvent<string>).data));
  });
  source.addEventListener("end", (e) => {
    handlers.onEnd(JSON.parse((e as MessageEvent<string>).data) as { scorebug: ScorebugState });
    source.close();
  });

  return () => source.close();
}
