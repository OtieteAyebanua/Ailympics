/**
 * Single source of truth for pitch dimensions and coordinate conversion.
 *
 * 3D world (physicsTest.tsx / match simulation):
 *   X  -17  ←  left touchline       right touchline  →  +17   (width  34)
 *   Z  -26  ←  away goal (-24.2)    home goal (+24.2) → +26   (depth  52)
 *   Y   0   = ground
 *
 * 2D retro pitch (RetroPitchStrategy):
 *   x   0% = left   →  100% = right
 *   y   0% = top (home goal / positive Z)  →  100% = bottom (away goal / negative Z)
 *   Values are percentages (0–100), NOT fractions.
 *
 * The same formula works for both teams since DEFAULT_AWAY_433
 * already uses y > 50 for away-half positions.
 */

export const PITCH = {
  width:       34,          // X axis total  (-17 to +17)
  depth:       52,          // Z axis total  (-26 to +26)
  halfWidth:   17,
  halfDepth:   26,
  goalZ:       24.2,        // |Z| of goal line
  goalWidth:   7.2,         // post-to-post
  crossbarY:   2.44,        // height of crossbar
  playerY:     1.0,         // spawn height for player RigidBody centre
} as const;

export interface WorldPos {
  x: number;   // left/right
  y: number;   // height (0 = ground)
  z: number;   // depth  (positive = home end, negative = away end)
}

/**
 * Convert 2D retro-pitch percentage coordinates to 3D world coordinates.
 *
 * @param xPct  0–100  (left → right)
 * @param yPct  0–100  (home-goal top → away-goal bottom)
 */
export function pitchPctToWorld(xPct: number, yPct: number): WorldPos {
  return {
    x: (xPct / 100) * PITCH.width  - PITCH.halfWidth,
    y: PITCH.playerY,
    z: PITCH.halfDepth - (yPct / 100) * PITCH.depth,
  };
}

/**
 * Convert 3D world coordinates back to 2D retro-pitch percentages.
 * Useful for displaying simulation positions on the 2D board.
 */
export function worldToPitchPct(x: number, z: number): { xPct: number; yPct: number } {
  return {
    xPct: ((x + PITCH.halfWidth) / PITCH.width)  * 100,
    yPct: ((PITCH.halfDepth - z) / PITCH.depth)  * 100,
  };
}

/**
 * Convert a full PlayerPos[] from the strategy board into world positions,
 * keyed by player id.
 */
export function strategyPositionsToWorld(
  positions: { id: number; x: number; y: number; num: number }[],
): Map<number, WorldPos> {
  const map = new Map<number, WorldPos>();
  for (const p of positions) {
    map.set(p.id, pitchPctToWorld(p.x, p.y));
  }
  return map;
}
