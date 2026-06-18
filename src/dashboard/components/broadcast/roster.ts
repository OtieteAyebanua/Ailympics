/**
 * Display roster — names, shirt numbers, and kit identity for HUD use.
 *
 * Sourced at build time from the authored club data files. This is display
 * identity only (who is "real-madrid-9"); match truth still arrives solely
 * through sealed frames and events.
 */
import realMadridPlayers from "./data/real-madrid.json";
import barcelonaPlayers from "./data/barcelona.json";

export type SkinTone = "classic" | "tan" | "brown" | "dark";

export interface PlayerDisplay {
  id: string;
  name: string;
  displayName: string;
  number: number;
  broadPosition: string;
  skinTone: SkinTone;
}

interface RawPlayer {
  id: string;
  name: string;
  displayName: string;
  number: number;
  broadPosition: string;
  skinTone?: SkinTone;
}

const index = new Map<string, PlayerDisplay>();

for (const file of [realMadridPlayers, barcelonaPlayers]) {
  const players = (file as { players: RawPlayer[] }).players ?? (file as unknown as RawPlayer[]);
  for (const p of players) {
    index.set(p.id, {
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      number: p.number,
      broadPosition: p.broadPosition,
      skinTone: p.skinTone ?? "classic",
    });
  }
}

/** Look up display identity for a sealed-frame player id. */
export function playerDisplay(playerId: string): PlayerDisplay | undefined {
  return index.get(playerId);
}

/** Short HUD label: "9 · Mbappé" (falls back to the raw id). */
export function playerLabel(playerId: string): string {
  const p = index.get(playerId);
  return p ? `${p.number} · ${p.displayName}` : playerId;
}

/** Shirt number for avatar decals; undefined for unknown ids. */
export function shirtNumber(playerId: string): number | undefined {
  return index.get(playerId)?.number;
}

const ID_PATTERN = /\b(?:real-madrid|barcelona)-\d+\b/g;

/** Replace raw player ids inside sealed cue text with display names. */
export function prettifyText(text: string): string {
  return text.replace(ID_PATTERN, (id) => index.get(id)?.displayName ?? id);
}
