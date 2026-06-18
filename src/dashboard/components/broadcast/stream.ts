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

export type { ActionCue, BroadcastSyncPacket, ScorebugState, SecondPayload, TeamPair };

export interface ManifestResponse {
  manifest: MatchManifest;
  teams: TeamPair;
}

const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;

// Two connection modes:
//  • Direct  — VITE_BROADCAST_URL points straight at the agenticfoot VPS
//              (e.g. local dev); endpoints are <base>/broadcast/{manifest,stream}.
//  • Relay   — default; we go through the Supabase `broadcast-stream` edge
//              function, which proxies the VPS and enforces auth. EventSource
//              can't set headers, so credentials ride as query params.
const DIRECT_URL   = viteEnv?.["VITE_BROADCAST_URL"];
const SUPABASE_URL = viteEnv?.["VITE_SUPABASE_URL"];
const ANON_KEY     = viteEnv?.["VITE_SUPABASE_ANON_KEY"];
const RELAY_URL    = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/broadcast-stream` : undefined;

/** Build the URL for a broadcast resource, with relay auth params when needed. */
export function endpoint(resource: "manifest" | "stream"): string {
  if (DIRECT_URL) return `${DIRECT_URL}/broadcast/${resource}`;
  if (!RELAY_URL) return `http://localhost:8787/broadcast/${resource}`;
  const url = new URL(RELAY_URL);
  url.searchParams.set("resource", resource);
  if (ANON_KEY) url.searchParams.set("apikey", ANON_KEY);
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("ailympics_jwt") : null;
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

/**
 * Resolve a commentary-audio URL (relative to the broadcast server) into a
 * fetchable URL — direct to the VPS, or proxied through the relay.
 */
export function resolveAudioUrl(relative: string): string {
  if (DIRECT_URL) return new URL(relative, DIRECT_URL).toString();
  if (!RELAY_URL) return new URL(relative, 'http://localhost:8787').toString();
  const url = new URL(RELAY_URL);
  url.searchParams.set('resource', 'audio');
  url.searchParams.set('path', relative);
  if (ANON_KEY) url.searchParams.set('apikey', ANON_KEY);
  return url.toString();
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
