/**
 * Night-match Three.js scene — the original AGENTICFOOT look, rebuilt on the
 * sealed-broadcast pipeline: bright striped pitch with bold baked markings,
 * tiered stands full of colorful crowd dots, floodlight towers, Roblox-style
 * box players with swinging limbs and torso shirt numbers, pentagon ball —
 * plus the directed camera system (broadcast/tactical/goal mouth/behind
 * goal/replay close), possession ring, and ball trail.
 *
 * Pure rendering: this module draws sealed frame data and nothing else.
 */
import * as THREE from "three";
import { PITCH, type ActionCue, type BroadcastFrame, type FramePlayer } from "../../../lib/agenticfoot/domain";
import type { TeamPair } from "../../../lib/agenticfoot/broadcast";
import { lerp, lerpAngle, type FrameSample } from "./playback";
import { playerDisplay, shirtNumber, type SkinTone } from "./roster";

const GOAL_HALF_WIDTH = 3.66;
const GOAL_HEIGHT = 2.44;
const PENALTY_DEPTH = 16.5;
const PENALTY_HALF_WIDTH = 20.16;
const SIX_YARD_DEPTH = 5.5;
const SIX_YARD_HALF_WIDTH = 9.16;
const CIRCLE_RADIUS = 9.15;
/** Roblox rigs read larger than life — oversized on purpose for readability. */
const RIG_SCALE = 0.9;
const BALL_RADIUS = 0.28;
const PITCH_RUNOFF = 10;

// --- Pre-match ceremony: walkout → lineup → anthem → break to kickoff -------
/** Players have all emerged and reached the halfway line by this elapsed second. */
const CEREMONY_WALK_END = 8;
/** The two teams have settled into the line. */
const CEREMONY_LINEUP_END = 11;
/** Anthems finish; players break for their kickoff shape. */
const CEREMONY_ANTHEM_END = 17;
/** Total ceremony length; live kickoff playback takes over here. */
export const CEREMONY_TOTAL = 21;

export type CeremonyPhase = "walkout" | "lineup" | "anthem" | "break";

/** Which ceremony beat an elapsed second falls in (drives captions + audio). */
export function ceremonyPhase(elapsed: number): CeremonyPhase {
  if (elapsed < CEREMONY_WALK_END) return "walkout";
  if (elapsed < CEREMONY_LINEUP_END) return "lineup";
  if (elapsed < CEREMONY_ANTHEM_END) return "anthem";
  return "break";
}
/** Kick action animation length (seconds). */
const KICK_DUR = 0.5;
/** Bounce squash-and-stretch recovery time (seconds). */
const SQUASH_DUR = 0.18;
/** Goalkeeper dive animation length (seconds). */
const DIVE_DUR = 1.1;
/** Fall + get-up animation length (seconds). */
const FALL_DUR = 1.6;
/** Slide tackle animation length (seconds). */
const SLIDE_DUR = 0.85;
/** Aerial duel jump/landing animation length (seconds). */
const AERIAL_DUR = 0.75;
/** Goal celebration / dejection length (seconds). */
const CELEB_DUR = 3.5;
/** Signature scorer celebrations — picked per player from their seed. */
type CelebSig = "siu" | "kneeslide" | "armswide" | "heart" | "calm" | "flip" | "point";
/**
 * Selection pool weighted toward the acrobatic showpieces (CR7's leap-spin,
 * the knee slide, and the backflip appear ~2x as often as the calmer poses).
 */
const CELEB_SIGS: CelebSig[] = [
  "siu", "siu",
  "kneeslide", "kneeslide",
  "flip", "flip",
  "armswide", "heart", "calm", "point",
];
/** Contact stumble length (seconds). */
const STUMBLE_DUR = 0.5;
/** Arm-raise appeal length (seconds). */
const APPEAL_DUR = 1.2;

/** Smoothstep on [0,1]. */
function smooth01(x: number): number {
  const k = Math.min(Math.max(x, 0), 1);
  return k * k * (3 - 2 * k);
}
/** Ball trail point lifetime (match seconds). */
const TRAIL_LIFE_S = 0.35;
const MAX_TRAIL_PTS = 64;

/** Exponential smoothing factor for frame-rate-independent easing. */
function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

/** Wrap an angle delta onto [-PI, PI]. */
function shortAngle(d: number): number {
  d = d % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Kick leg curve over normalized time: wind back (+), snap forward through the
 * ball (−), then recover to neutral. +rotation.x swings the limb tip behind
 * the body; the strike is therefore the negative excursion. Timed so the foot
 * meets the ball ~0.12s in — right on the sealed frame where the ball's
 * velocity actually spikes.
 */
function kickCurve(t: number): number {
  if (t < 0.12) {
    const k = t / 0.12;
    return (1 - (1 - k) * (1 - k)) * 0.85; // snap backswing
  }
  if (t < 0.34) {
    const k = (t - 0.12) / 0.22;
    return 0.85 - k * k * 2.55; // accelerating strike to -1.7
  }
  const k = (t - 0.34) / 0.66;
  return -1.7 * (1 - k * k * (3 - 2 * k)); // smoothstep recovery
}

/** Overshooting spawn pop (0 → 1 with a small bounce past 1). */
function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export type SceneCameraMode =
  | "broadcast_wide"
  | "tactical_wide"
  | "goal_mouth"
  | "behind_goal"
  | "replay_close";

// ---------------------------------------------------------------------------
// Pitch — bright stripes with bold markings baked into the texture
// ---------------------------------------------------------------------------

function pitchTexture(): THREE.Texture {
  const W = 2100;
  const H = 1360;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;

  const stripes = 12;
  for (let i = 0; i < stripes; i++) {
    g.fillStyle = i % 2 ? "#85c456" : "#92d162";
    g.fillRect((W / stripes) * i, 0, W / stripes + 1, H);
  }

  // Bold white markings, drawn in pitch meters mapped to texture pixels.
  const textureLength = PITCH.length + PITCH_RUNOFF * 2;
  const textureWidth = PITCH.width + PITCH_RUNOFF * 2;
  const sx = W / textureLength;
  const sz = H / textureWidth;
  const px = (x: number) => (x + PITCH.halfLength + PITCH_RUNOFF) * sx;
  const pz = (z: number) => (z + PITCH.halfWidth + PITCH_RUNOFF) * sz;
  g.strokeStyle = "rgba(255,255,255,0.95)";
  g.fillStyle = "rgba(255,255,255,0.95)";
  g.lineWidth = 4;

  g.strokeRect(px(-PITCH.halfLength) + 2, pz(-PITCH.halfWidth) + 2, PITCH.length * sx - 4, PITCH.width * sz - 4);
  g.beginPath();
  g.moveTo(px(0), pz(-PITCH.halfWidth));
  g.lineTo(px(0), pz(PITCH.halfWidth));
  g.stroke();
  g.beginPath();
  g.ellipse(px(0), pz(0), CIRCLE_RADIUS * sx, CIRCLE_RADIUS * sz, 0, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(px(0), pz(0), 5, 0, Math.PI * 2);
  g.fill();

  for (const sign of [-1, 1] as const) {
    const goalX = PITCH.halfLength * sign;
    const boxX = goalX - sign * PENALTY_DEPTH;
    g.strokeRect(
      Math.min(px(goalX), px(boxX)),
      pz(-PENALTY_HALF_WIDTH),
      Math.abs(px(goalX) - px(boxX)),
      PENALTY_HALF_WIDTH * 2 * sz,
    );
    const sixX = goalX - sign * SIX_YARD_DEPTH;
    g.strokeRect(
      Math.min(px(goalX), px(sixX)),
      pz(-SIX_YARD_HALF_WIDTH),
      Math.abs(px(goalX) - px(sixX)),
      SIX_YARD_HALF_WIDTH * 2 * sz,
    );
    const spotX = goalX - sign * 11;
    g.beginPath();
    g.arc(px(spotX), pz(0), 5, 0, Math.PI * 2);
    g.fill();
    // Penalty arc (outside the box only).
    const arcHalf = Math.acos((PENALTY_DEPTH - 11) / CIRCLE_RADIUS);
    const facing = sign > 0 ? Math.PI : 0;
    g.beginPath();
    g.ellipse(px(spotX), pz(0), CIRCLE_RADIUS * sx, CIRCLE_RADIUS * sz, 0, facing - arcHalf, facing + arcHalf);
    g.stroke();
  }

  // Soft sheen toward the centre — keeps the bright, sunlit-arcade read.
  const grad = g.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1400);
  grad.addColorStop(0, "rgba(255,255,255,0.07)");
  grad.addColorStop(1, "rgba(20,40,10,0.12)");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Visual goal scale: the Roblox rigs are oversized for readability, so a
 * real-scale 2.44m goal reads tiny against them (the keeper's head clears the
 * crossbar). The rendered frame is enlarged to match the canon look and to
 * give keeper dives — low smothers and top-corner leaps — room to read.
 * Engine goal-line truth is unchanged; this is presentation only.
 */
const GOAL_VIS_WIDTH = 1.65;
const GOAL_VIS_HEIGHT = 2.35;

function buildGoal(sign: -1 | 1): THREE.Group {
  const hw = GOAL_HALF_WIDTH * GOAL_VIS_WIDTH;
  const height = GOAL_HEIGHT * GOAL_VIS_HEIGHT;
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0xf2f5f7, roughness: 0.4 });
  const postGeo = new THREE.CylinderGeometry(0.2, 0.2, height, 10);
  for (const z of [-hw, hw]) {
    const post = new THREE.Mesh(postGeo, material);
    post.position.set(PITCH.halfLength * sign, height / 2, z);
    post.castShadow = true;
    group.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, hw * 2 + 0.4, 10), material);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(PITCH.halfLength * sign, height, 0);
  bar.castShadow = true;
  group.add(bar);
  // Wireframe net box — the original look.
  const net = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, height, hw * 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.16 }),
  );
  net.position.set((PITCH.halfLength + 1.8) * sign, height / 2, 0);
  group.add(net);
  return group;
}

// ---------------------------------------------------------------------------
// Stands — colorful crowd-dot tiers under a dark roof
// ---------------------------------------------------------------------------

function crowdTexture(w: number, h: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0d1420";
  g.fillRect(0, 0, w, h);
  const cols = ["#a50044", "#f5f5f5", "#e8e1cf", "#c43b3b", "#3b62c4", "#d8c84a", "#777"];
  for (let i = 0; i < (w * h) / 38; i++) {
    g.fillStyle = cols[(Math.random() * cols.length) | 0]!;
    g.globalAlpha = 0.35 + Math.random() * 0.55;
    g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
  }
  return new THREE.CanvasTexture(c);
}

function buildStand(len: number, depth: number, x: number, z: number, rotY: number): THREE.Group {
  const grp = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const tier = new THREE.Mesh(
      new THREE.BoxGeometry(len, 1.8, depth / 5),
      new THREE.MeshStandardMaterial({ map: crowdTexture(256, 24), roughness: 1 }),
    );
    tier.position.set(0, 1.0 + i * 1.7, -i * (depth / 5));
    grp.add(tier);
  }
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(len + 3, 0.4, depth + 3),
    new THREE.MeshStandardMaterial({ color: 0x141c28, roughness: 0.7 }),
  );
  roof.position.set(0, 10.5, -depth / 2);
  grp.add(roof);
  grp.position.set(x, 0, z);
  grp.rotation.y = rotY;
  return grp;
}

/** Bright fan-shirt palette for viewer avatars, picked deterministically. */
const VIEWER_SHIRTS = [
  "#e74c3c", "#3498db", "#f1c40f", "#9b59b6", "#1abc9c",
  "#e67e22", "#2ecc71", "#fd79a8", "#74b9ff", "#a29bfe",
];
/** Seats per row and at most this many rows of live-viewer avatars. */
const VIEWER_SEATS_PER_ROW = 16;
const VIEWER_MAX = 48;

/**
 * A live viewer in the stands: a mini box fan with arms up, cheering. Each
 * connected broadcast viewer gets one. Deterministic look per seat index.
 */
function makeViewerAvatar(index: number): THREE.Group {
  const grp = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({
    color: new THREE.Color(VIEWER_SHIRTS[index % VIEWER_SHIRTS.length]!),
    roughness: 0.7,
  });
  const skin = new THREE.MeshStandardMaterial({ color: 0xf7d149, roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.45), shirt);
  torso.position.y = 0.85;
  grp.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), skin);
  head.position.y = 1.62;
  grp.add(head);
  // Arms thrown up — they came to cheer.
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), shirt);
    arm.position.set(side * 0.55, 1.45, 0);
    arm.rotation.z = side * 2.6;
    grp.add(arm);
  }
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x20262e, roughness: 0.8 }),
  );
  legs.position.y = 0.2;
  grp.add(legs);
  return grp;
}

// ---------------------------------------------------------------------------
// Players — Roblox-style box rigs with swinging limbs
// ---------------------------------------------------------------------------



/**
 * Club kits, modeled 1:1 on the real home strips (colors and patterns only —
 * no crests or sponsor marks). Shirts render as vertical stripes (a single
 * entry = solid shirt); legs split into shorts / skin / socks bands.
 */
interface KitSpec {
  /** Vertical shirt stripes, left to right. */
  shirt: string[];
  sleeves: string;
  shorts: string;
  socks: string;
  /** Turnover band at the top of the socks. */
  sockTrim: string;
  number: string;
  numberOutline: string;
}

const CLUB_KITS: Record<string, KitSpec> = {
  // Blaugrana: garnet/blue striped shirt, gold numbers, blue shorts and socks.
  barcelona: {
    shirt: ["#a50044", "#004d98", "#a50044", "#004d98", "#a50044", "#004d98"],
    sleeves: "#004d98",
    shorts: "#004d98",
    socks: "#004d98",
    sockTrim: "#a50044",
    number: "#f4c20d",
    numberOutline: "#1a1230",
  },
  // Los Blancos: all white with deep-navy numbers and trim.
  "real-madrid": {
    shirt: ["#f7f8fa"],
    sleeves: "#f7f8fa",
    shorts: "#f7f8fa",
    socks: "#f7f8fa",
    sockTrim: "#14214e",
    number: "#14214e",
    numberOutline: "#f7f8fa",
  },
};

/** Keeper strips stay full-kit single color, one per end so they never clash. */
const GK_KITS: Record<"home" | "away", KitSpec> = {
  home: {
    shirt: ["#27c468"],
    sleeves: "#27c468",
    shorts: "#16302a",
    socks: "#27c468",
    sockTrim: "#16302a",
    number: "#10241c",
    numberOutline: "#bff1d4",
  },
  away: {
    shirt: ["#ff8b1f"],
    sleeves: "#ff8b1f",
    shorts: "#33200e",
    socks: "#ff8b1f",
    sockTrim: "#33200e",
    number: "#2b1604",
    numberOutline: "#ffd9ae",
  },
};

function kitFor(
  playerId: string,
  teamId: "home" | "away",
  isKeeper: boolean,
  teams: TeamPair | undefined,
): KitSpec {
  if (isKeeper) return GK_KITS[teamId];
  const clubId = playerId.replace(/-\d+$/, "");
  const kit = CLUB_KITS[clubId];
  if (kit) return kit;
  // Unknown club: fall back to the broadcast team color as a solid strip.
  const color = (teamId === "home" ? teams?.home.color : teams?.away.color) ?? "#888888";
  const dark = new THREE.Color(color).getHSL({ h: 0, s: 0, l: 0 }).l > 0.55;
  return {
    shirt: [color],
    sleeves: color,
    shorts: "#1c2430",
    socks: color,
    sockTrim: "#1c2430",
    number: dark ? "#161a20" : "#ffffff",
    numberOutline: dark ? "#ffffff" : "#161a20",
  };
}

/** Striped shirt canvas; with a number it becomes the back-of-shirt face. */
function jerseyTexture(kit: KitSpec, num?: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d")!;
  const stripeW = 96 / kit.shirt.length;
  kit.shirt.forEach((color, i) => {
    g.fillStyle = color;
    g.fillRect(Math.floor(i * stripeW), 0, Math.ceil(stripeW), 96);
  });
  if (num !== undefined) {
    g.font = "900 60px 'Saira Condensed', monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 7;
    g.strokeStyle = kit.numberOutline;
    g.strokeText(String(num), 48, 52);
    g.fillStyle = kit.number;
    g.fillText(String(num), 48, 52);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Leg canvas: shorts over bare knee over club socks with a turnover band. */
function legTexture(kit: KitSpec, tone: SkinTone): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = kit.shorts;
  g.fillRect(0, 0, 32, 26); // shorts
  g.fillStyle = SKIN_TONES[tone];
  g.fillRect(0, 26, 32, 10); // knee
  g.fillStyle = kit.sockTrim;
  g.fillRect(0, 36, 32, 6); // sock turnover
  g.fillStyle = kit.socks;
  g.fillRect(0, 42, 32, 22); // socks
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Avatar skin tones, matched to each real player via roster skinTone. */
const SKIN_TONES: Record<SkinTone, string> = {
  classic: "#f7d149", // legacy LEGO yellow
  tan: "#e0a85c",
  brown: "#8d5524",
  dark: "#5c3a21",
};

function faceTexture(tone: SkinTone): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = SKIN_TONES[tone];
  g.fillRect(0, 0, 128, 128);
  // Classic face lines stay dark; on deep tones they get a light ink so the
  // smile still reads from the broadcast camera.
  const ink = tone === "dark" || tone === "brown" ? "#f5e9d6" : "#161a20";
  g.fillStyle = ink;
  g.beginPath();
  g.arc(44, 50, 7, 0, Math.PI * 2);
  g.arc(84, 50, 7, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = ink;
  g.lineWidth = 5;
  g.beginPath();
  g.arc(64, 68, 26, 0.25 * Math.PI, 0.75 * Math.PI);
  g.stroke();
  return new THREE.CanvasTexture(c);
}

interface Limbs {
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
}

interface PlayerRig {
  /** Root transform: pitch position + yaw. */
  group: THREE.Group;
  /** Inner transform: lean, turn roll, and run bob without disturbing yaw. */
  body: THREE.Group;
  limbs: Limbs;
  /** Running-cycle phase (radians). */
  phase: number;
  /** Smoothed ground speed (m/s) derived from sealed frame velocity. */
  speed: number;
  /** Smoothed render yaw with rotational inertia. */
  yaw: number;
  /** Smoothed yaw rate (rad/s) used to lean into turns. */
  yawVel: number;
  lastX: number;
  lastZ: number;
  /** Spawn pop-in progress 0..1. */
  spawnT: number;
  /** Smoothed forward component of movement relative to facing (-1..1). */
  fwd: number;
  /** Smoothed lateral component of movement relative to facing (-1..1). */
  lat: number;
  /** Smoothed ground acceleration (m/s^2) — drives the deceleration skid. */
  accel: number;
  /** Seconds since the current strike action started (>= KICK_DUR = idle). */
  kickT: number;
  kickFoot: -1 | 1;
  /** Striking, receiving, winning a challenge, or taking a throw-in. */
  kickStyle: "kick" | "header" | "trap" | "chest" | "tackle" | "throw";
  /** Strike intensity: dribble toe-taps swing small, shots follow through. */
  kickPower: number;
  /** Arm-raise appeal timer (fouls, offside flags). */
  appealT: number;
  appealArm: -1 | 1;
  teamId: "home" | "away";
  /** Keeper dive timer/direction (>= DIVE_DUR = idle). */
  diveT: number;
  diveDir: -1 | 1;
  /** Dive elevation 0..1 from sealed ball height: smother low, leap high. */
  diveLift: number;
  /** Fall + get-up timer (lost duel / fouled). */
  fallT: number;
  /** Slide tackle timer for committed sliding challenges. */
  slideT: number;
  slideDir: -1 | 1;
  /** Aerial duel timer for jumps and landings. */
  aerialT: number;
  aerialLift: number;
  /** Contact stumble timer and wobble side. */
  stumbleT: number;
  stumbleSide: -1 | 1;
  /** Goal celebration / dejection timer and style. */
  celebT: number;
  celebStyle: "score" | "concede";
  /** Scorer's signature celebration; null = generic teammate joy. */
  celebSig: CelebSig | null;
  /** Locked wheel-away heading (rad); NaN until a celebration starts. */
  celebDir: number;
  /** Cosmetic celebration displacement off the sealed position, eased back after. */
  celebOX: number;
  celebOZ: number;
  /** Per-player phase offset so idle breathing isn't synchronized. */
  seed: number;
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

interface CameraPose {
  position: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
}

function replayClosePose(bx: number, bz: number, endSign?: 1 | -1): CameraPose {
  const hl = PITCH.halfLength;
  const hw = PITCH.halfWidth;
  const targetX = THREE.MathUtils.clamp(bx, -hl - 1.4, hl + 1.4);
  const targetZ = THREE.MathUtils.clamp(bz, -hw - 0.4, hw + 0.4);
  // Lock to the resolving end during a replay so the camera never opens away
  // from goal or pans across the stands as the ball crosses midfield.
  const endDir = endSign ?? (targetX >= 0 ? 1 : -1);
  const sideDir = Math.abs(targetZ) > hw - 8 ? -Math.sign(targetZ || 1) : 1;
  return {
    position: new THREE.Vector3(
      THREE.MathUtils.clamp(targetX - endDir * 11, -hl + 6, hl - 6),
      7.2,
      THREE.MathUtils.clamp(targetZ + sideDir * 13, -hw + 6, hw - 6),
    ),
    look: new THREE.Vector3(targetX, 1.15, targetZ),
    fov: 32,
  };
}

export function replayCloseCameraDebug(bx: number, bz: number): {
  position: { x: number; y: number; z: number };
  look: { x: number; y: number; z: number };
  fov: number;
} {
  const pose = replayClosePose(bx, bz);
  return {
    position: { x: pose.position.x, y: pose.position.y, z: pose.position.z },
    look: { x: pose.look.x, y: pose.look.y, z: pose.look.z },
    fov: pose.fov,
  };
}

export class BroadcastScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly players = new Map<string, PlayerRig>();
  private readonly ball: THREE.Mesh;
  private readonly ballShadow: THREE.Mesh;
  private readonly possessionRing: THREE.Mesh;
  private readonly trail: THREE.Line;
  private readonly trailGeo: THREE.BufferGeometry;
  private readonly trailPositions = new Float32Array(MAX_TRAIL_PTS * 3);
  private trailPts: { x: number; y: number; z: number; t: number }[] = [];
  private lastNow: number | undefined;
  /** Presentation clock (seconds) for idle sway / ring pulse. */
  private clock = 0;
  private prevBallH = 0;
  /** Seconds since the last ground bounce (drives squash-and-stretch). */
  private squashT = SQUASH_DUR;
  /** Last sealed frame second checked for kick events. */
  private lastKickSecond = -1;
  /** Last rendered match second, to detect replay seeks. */
  private lastSampleT: number | undefined;
  /** Cached playerId map for the current `b` frame (avoids per-frame allocs). */
  private nextCache: { frame: BroadcastFrame; map: Map<string, FramePlayer> } | undefined;
  private readonly seenIds = new Set<string>();
  /** Live world position of the scorer mid-celebration, so teammates can mob. */
  private celebFocus: { x: number; z: number } | undefined;
  /** Clock time the mob focus was last refreshed; stale → celebration over. */
  private celebFocusAt = 0;
  private readonly ringPos = new THREE.Vector3();
  private readonly spinAxis = new THREE.Vector3();
  private readonly spinQ = new THREE.Quaternion();
  private readonly cameraTarget = new THREE.Vector3(0, 0, 0);
  private readonly cameraPos = new THREE.Vector3(0, 42, 78);
  private readonly faces = new Map<SkinTone, THREE.CanvasTexture>();
  /** One avatar per connected live viewer, seated on the far stand. */
  private readonly viewerGallery = new THREE.Group();
  private readonly viewerRigs: { grp: THREE.Group; phase: number; spawnT: number; seatY: number }[] =
    [];
  private teams: TeamPair | undefined;
  /** Active pre-match ceremony choreography, or undefined during live play. */
  private ceremony:
    | {
        players: {
          rig: PlayerRig;
          tunnel: { x: number; z: number };
          line: { x: number; z: number };
          kickoff: { x: number; z: number };
          emergeDelay: number;
          lastX: number;
          lastZ: number;
          walkPhase: number;
          yaw: number;
          seed: number;
        }[];
      }
    | undefined;
  private mode: SceneCameraMode = "broadcast_wide";
  private modeBlend = 1;
  /** Goal-end the active replay resolves at, locking the close-camera side. */
  private replayEndSign: 1 | -1 | undefined;
  private pendingCut = false;
  /** Player currently nearest the ball (presentation focus only). */
  focusPlayerId: string | undefined;
  /** Screen-space anchor (CSS px) above the focus player's head, if visible. */
  focusScreenPos: { x: number; y: number } | undefined;
  private readonly projection = new THREE.Vector3();
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1018);
    this.scene.fog = new THREE.Fog(0x0a1018, 180, 420);

    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 700);
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(0, 0, 0);

    // Bright arcade lighting: strong sky + ambient, one warm key light that
    // throws the long soft player shadows, floodlight towers as set dressing.
    this.scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x4a7a36, 0.95));
    this.scene.add(new THREE.AmbientLight(0x8fa0b5, 0.85));
    const key = new THREE.DirectionalLight(0xfff2dd, 1.5);
    key.position.set(-42, 70, 30);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -70;
    key.shadow.camera.right = 70;
    key.shadow.camera.top = 50;
    key.shadow.camera.bottom = -50;
    key.shadow.camera.far = 200;
    key.shadow.radius = 4;
    this.scene.add(key);
    for (const [x, z] of [
      [-45, -42],
      [45, -42],
      [-45, 42],
      [45, 42],
    ] as const) {
      this.scene.add(this.floodlight(x, z));
    }

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(PITCH.length + PITCH_RUNOFF * 2, PITCH.width + PITCH_RUNOFF * 2),
      new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: 0x0b1610, roughness: 1 }),
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.05;
    apron.receiveShadow = true;
    this.scene.add(apron);

    this.scene.add(buildGoal(-1), buildGoal(1));

    const hl = PITCH.halfLength;
    const hw = PITCH.halfWidth;
    this.scene.add(buildStand(PITCH.length + 16, 12, 0, -(hw + 10), 0));
    this.scene.add(buildStand(PITCH.length + 16, 12, 0, hw + 10, Math.PI));
    this.scene.add(buildStand(PITCH.width + 16, 12, -(hl + 10), 0, -Math.PI / 2));
    this.scene.add(buildStand(PITCH.width + 16, 12, hl + 10, 0, Math.PI / 2));

    // Viewer gallery: live viewers get avatars on the camera-facing stand.
    this.viewerGallery.position.set(0, 0, -(hw + 10));
    this.scene.add(this.viewerGallery);

    // Ball: pentagon-patterned, casts a real shadow.
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 24, 24),
      new THREE.MeshStandardMaterial({ map: this.ballTexture(), roughness: 0.45 }),
    );
    this.ball.castShadow = true;
    this.ball.position.set(0, BALL_RADIUS, 0);
    this.scene.add(this.ball);

    // Soft contact-shadow blob: keeps the ball grounded when airborne, where
    // the directional shadow drifts away from the landing spot on screen.
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 128;
    const sg = shadowCanvas.getContext("2d")!;
    const grad = sg.createRadialGradient(64, 64, 6, 64, 64, 62);
    grad.addColorStop(0, "rgba(0,0,0,0.6)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    sg.fillStyle = grad;
    sg.fillRect(0, 0, 128, 128);
    this.ballShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(shadowCanvas),
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      }),
    );
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.y = 0.021;
    this.scene.add(this.ballShadow);

    // Possession ring: sits under the player nearest the ball.
    this.possessionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.22, 28),
      new THREE.MeshBasicMaterial({ color: 0xf3d97c, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    this.possessionRing.rotation.x = -Math.PI / 2;
    this.possessionRing.position.y = 0.06;
    this.possessionRing.visible = false;
    this.scene.add(this.possessionRing);

    // Ball trail: short fading ribbon, presentation only. Points are
    // timestamped in match seconds so the trail length is independent of
    // display refresh rate, and only fast/airborne balls leave one.
    this.trailGeo = new THREE.BufferGeometry();
    this.trailGeo.setAttribute("position", new THREE.BufferAttribute(this.trailPositions, 3));
    this.trailGeo.setDrawRange(0, 0);
    this.trail = new THREE.Line(
      this.trailGeo,
      new THREE.LineBasicMaterial({ color: 0xbfd9ff, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    this.trail.frustumCulled = false;
    this.scene.add(this.trail);
  }

  private floodlight(x: number, z: number): THREE.Group {
    const tower = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.5, 36, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a3340, roughness: 0.8 }),
    );
    pole.position.set(x, 18, z);
    tower.add(pole);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 2.6, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x111820, emissive: 0xcfe8ff, emissiveIntensity: 2.2 }),
    );
    head.position.set(x, 36.5, z);
    head.lookAt(0, 0, 0);
    tower.add(head);

    const spot = new THREE.SpotLight(0xeaf4ff, 500, 200, 0.55, 0.45, 1.6);
    spot.position.set(x, 38, z);
    spot.target.position.set(x * 0.15, 0, z * 0.15);
    spot.castShadow = false; // the directional key light owns shadows
    tower.add(spot, spot.target);
    return tower;
  }

  private ballTexture(): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#f4f6f8";
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#161a20";
    for (let i = 0; i < 14; i++) {
      const x = (i % 5) * 60 + (i % 2) * 24;
      const y = ((i / 5) | 0) * 78 + 20;
      g.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
        if (k === 0) g.moveTo(x + Math.cos(a) * 18, y + Math.sin(a) * 18);
        else g.lineTo(x + Math.cos(a) * 18, y + Math.sin(a) * 18);
      }
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  setTeams(teams: TeamPair): void {
    this.teams = teams;
    // Kits are baked per-rig; rebuild any rigs created before the manifest.
    for (const [id, rig] of this.players) {
      this.scene.remove(rig.group);
      this.players.delete(id);
    }
  }

  /** Seat one cheering avatar per connected live viewer (server-reported). */
  setViewerCount(count: number): void {
    const target = Math.max(0, Math.min(VIEWER_MAX, count));
    while (this.viewerRigs.length > target) {
      const rig = this.viewerRigs.pop()!;
      this.viewerGallery.remove(rig.grp);
    }
    while (this.viewerRigs.length < target) {
      const i = this.viewerRigs.length;
      const grp = makeViewerAvatar(i);
      const row = Math.floor(i / VIEWER_SEATS_PER_ROW);
      const col = i % VIEWER_SEATS_PER_ROW;
      // Center each row's occupied seats; rows climb the tiers.
      const x = (col - (VIEWER_SEATS_PER_ROW - 1) / 2) * 2.1 + (row % 2) * 1.05;
      const seatY = 1.9 + row * 1.7;
      grp.position.set(x, seatY, -row * 2.4);
      this.viewerGallery.add(grp);
      this.viewerRigs.push({ grp, phase: i * 1.37, spawnT: this.clock, seatY });
    }
  }

  setCameraMode(mode: SceneCameraMode): void {
    if (mode !== this.mode) {
      this.mode = mode;
      this.modeBlend = 0;
    }
  }

  /** Lock the replay close-camera to a goal end (undefined = follow the ball). */
  setReplayEndSign(sign: 1 | -1 | undefined): void {
    this.replayEndSign = sign;
  }

  /** Hard camera cut: jump straight to the active mode's pose next frame. */
  cut(): void {
    this.pendingCut = true;
  }

  resize(): void {
    const { clientWidth, clientHeight } = this.canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
  }

  private makeRig(playerId: string, teamId: "home" | "away"): PlayerRig {
    const display = playerDisplay(playerId);
    const isKeeper = display?.broadPosition === "GK";
    const kit = kitFor(playerId, teamId, isKeeper, this.teams);
    const tone = display?.skinTone ?? "classic";

    const grp = new THREE.Group();
    // All parts hang off an inner body group: the root carries position+yaw,
    // the body carries lean / turn roll / run bob.
    const body = new THREE.Group();
    grp.add(body);
    const jersey = new THREE.MeshStandardMaterial({
      map: jerseyTexture(kit),
      roughness: 0.65,
    });
    const skin = new THREE.MeshStandardMaterial({
      color: new THREE.Color(SKIN_TONES[tone]),
      roughness: 0.7,
    });
    const leg = new THREE.MeshStandardMaterial({ map: legTexture(kit, tone), roughness: 0.7 });

    // Torso: striped club jersey, with the shirt number baked onto the back.
    const numMat = new THREE.MeshStandardMaterial({
      map: jerseyTexture(kit, shirtNumber(playerId)),
      roughness: 0.65,
    });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 0.7), [
      jersey,
      jersey,
      jersey,
      jersey,
      jersey,
      numMat,
    ]);
    torso.position.y = 1.75;
    torso.castShadow = true;
    body.add(torso);

    // Box head in the player's own skin tone, classic face on the front.
    let face = this.faces.get(tone);
    if (!face) {
      face = faceTexture(tone);
      this.faces.set(tone, face);
    }
    const faceMat = new THREE.MeshStandardMaterial({ map: face, roughness: 0.7 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), [skin, skin, skin, skin, faceMat, skin]);
    head.position.y = 2.85;
    head.castShadow = true;
    body.add(head);

    const limb = (w: number, h: number, mat: THREE.Material, x: number, y: number): THREE.Group => {
      const pivot = new THREE.Group();
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
      m.position.y = -h / 2;
      m.castShadow = true;
      pivot.add(m);
      pivot.position.set(x, y, 0);
      body.add(pivot);
      return pivot;
    };
    const sleeve = new THREE.MeshStandardMaterial({
      color: new THREE.Color(kit.sleeves),
      roughness: 0.65,
    });
    const limbs: Limbs = {
      armL: limb(0.42, 1.25, sleeve, -0.88, 2.35),
      armR: limb(0.42, 1.25, sleeve, 0.88, 2.35),
      legL: limb(0.5, 1.1, leg, -0.35, 1.1),
      legR: limb(0.5, 1.1, leg, 0.35, 1.1),
    };

    grp.scale.setScalar(RIG_SCALE);
    const rig: PlayerRig = {
      group: grp,
      body,
      limbs,
      phase: Math.random() * Math.PI * 2,
      speed: 0,
      yaw: 0,
      yawVel: 0,
      fwd: 1,
      lat: 0,
      accel: 0,
      lastX: Number.NaN,
      lastZ: Number.NaN,
      spawnT: 0,
      kickT: KICK_DUR,
      kickFoot: 1,
      kickStyle: "kick",
      kickPower: 1,
      appealT: APPEAL_DUR,
      appealArm: 1,
      teamId,
      diveT: DIVE_DUR,
      diveDir: 1,
      diveLift: 0,
      fallT: FALL_DUR,
      slideT: SLIDE_DUR,
      slideDir: 1,
      aerialT: AERIAL_DUR,
      aerialLift: 0,
      stumbleT: STUMBLE_DUR,
      stumbleSide: 1,
      celebT: CELEB_DUR,
      celebStyle: "score",
      celebSig: null,
      celebDir: Number.NaN,
      celebOX: 0,
      celebOZ: 0,
      seed: Math.random() * Math.PI * 2,
    };
    this.players.set(playerId, rig);
    this.scene.add(grp);
    return rig;
  }

  /** Compute the directed camera pose for the active mode. */
  /** Tight side-on follow on the scorer's celebration. */
  private celebrationPose(cx: number, cz: number): CameraPose {
    const targetX = THREE.MathUtils.clamp(cx, -40, 40);
    return {
      position: new THREE.Vector3(THREE.MathUtils.clamp(targetX, -26, 26), 12, 33),
      look: new THREE.Vector3(targetX, 2, THREE.MathUtils.clamp(cz, -12, 20)),
      fov: 30,
    };
  }

  private cameraPose(bx: number, bz: number): CameraPose {
    const hl = PITCH.halfLength;
    const end = bx >= 0 ? 1 : -1;
    switch (this.mode) {
      case "tactical_wide":
        return { position: new THREE.Vector3(0, 92, 46), look: new THREE.Vector3(0, 0, 0), fov: 42 };
      case "goal_mouth": {
        const gx = hl * end;
        return {
          position: new THREE.Vector3(gx - end * 26, 9, 26),
          look: new THREE.Vector3(gx - end * 5, 1.2, 0),
          fov: 34,
        };
      }
      case "behind_goal": {
        const gx = hl * end;
        return {
          position: new THREE.Vector3(gx + end * 16, 8.5, 0),
          look: new THREE.Vector3(gx - end * 16, 1, bz * 0.4),
          fov: 46,
        };
      }
      case "replay_close":
        return replayClosePose(bx, bz, this.replayEndSign);
      case "broadcast_wide":
      default: {
        // TV tele camera: side-on at the halfway gantry, shallow angle, pans
        // with the ball — how football actually airs.
        const targetX = THREE.MathUtils.clamp(bx, -42, 42);
        const targetZ = THREE.MathUtils.clamp(bz * 0.5, -14, 14);
        return {
          position: new THREE.Vector3(
            THREE.MathUtils.clamp(targetX * 0.88, -34, 34),
            24,
            56,
          ),
          look: new THREE.Vector3(targetX, 1, targetZ),
          fov: 33,
        };
      }
    }
  }

  /**
   * Start action-driven animations from sealed cues that just aired.
   * Dives, falls, tackles, stumbles, and celebrations all key off engine
   * truth here — never off invented client state.
   */
  private applyActions(actions: readonly ActionCue[], bx: number, bz: number, bh: number): void {
    for (const cue of actions) {
      switch (cue.kind) {
        case "save": {
          const rig = cue.playerId ? this.players.get(cue.playerId) : undefined;
          if (rig && rig.diveT >= DIVE_DUR) {
            // Dive toward the ball's side of the keeper's facing, at the
            // ball's elevation: smother along the turf or leap for the bar.
            const facing = Math.PI / 2 - rig.yaw;
            const side =
              (bx - rig.lastX) * -Math.sin(facing) + (bz - rig.lastZ) * Math.cos(facing);
            const saveHeight =
              typeof cue.flags?.["height"] === "number" ? cue.flags["height"] : bh;
            rig.diveDir = side >= 0 ? 1 : -1;
            rig.diveLift = THREE.MathUtils.clamp((saveHeight - 0.35) / 1.65, 0, 1);
            rig.diveT = 0;
          }
          break;
        }
        case "duel": {
          const source = cue.flags?.["source"];
          const actorId = typeof cue.flags?.["actorId"] === "string" ? cue.flags["actorId"] : undefined;
          const winner = cue.playerId ? this.players.get(cue.playerId) : undefined;
          if (source === "aerial") {
            for (const [id, lift] of [
              [cue.playerId, 1],
              [cue.secondaryId, 0.72],
            ] as const) {
              const rig = id ? this.players.get(id) : undefined;
              if (!rig || rig.aerialT < AERIAL_DUR) continue;
              rig.aerialT = 0;
              rig.aerialLift = lift;
            }
            break;
          }
          if (source === "slide_tackle") {
            const tackler = actorId ? this.players.get(actorId) : winner;
            if (tackler && tackler.slideT >= SLIDE_DUR) {
              tackler.slideT = 0;
              tackler.slideDir = tackler.seed > Math.PI ? 1 : -1;
            }
          } else if (winner && winner.kickT >= KICK_DUR) {
            winner.kickT = 0;
            winner.kickStyle = "tackle";
          }
          const loser = cue.secondaryId ? this.players.get(cue.secondaryId) : undefined;
          if (loser && loser.stumbleT >= STUMBLE_DUR && loser.fallT >= FALL_DUR) {
            loser.stumbleT = 0;
            loser.stumbleSide = loser.seed > Math.PI ? 1 : -1;
          }
          break;
        }
        case "foul": {
          const victim = cue.secondaryId ? this.players.get(cue.secondaryId) : undefined;
          if (victim && victim.fallT >= FALL_DUR) victim.fallT = 0;
          const offender = cue.playerId ? this.players.get(cue.playerId) : undefined;
          if (offender && cue.flags?.["offence"] === "trip" && offender.slideT >= SLIDE_DUR) {
            offender.slideT = 0;
            offender.slideDir = offender.seed > Math.PI ? 1 : -1;
          }
          // The fouled side's nearby players throw their arms up at the ref.
          if (cue.teamId) this.triggerAppeals(cue.teamId, cue.position, 9);
          break;
        }
        case "offside": {
          // Defenders near the flag raise an arm for the line.
          if (cue.teamId) this.triggerAppeals(cue.teamId, cue.position, 14);
          break;
        }
        case "kick": {
          // Attributed touches: dribble taps swing small, passes normal,
          // shots get the full follow-through. The velocity heuristic catches
          // most strikes first; this upgrades or fills in the rest.
          const rig = cue.playerId ? this.players.get(cue.playerId) : undefined;
          if (!rig) break;
          const source = cue.flags?.["source"];
          const power = source === "shot" ? 1.25 : source === "pass" ? 1 : 0.6;
          if (rig.kickT >= KICK_DUR) {
            rig.kickT = 0;
            rig.kickStyle = "kick";
            rig.kickPower = power;
            const facing = Math.PI / 2 - rig.yaw;
            const side =
              (bx - rig.lastX) * -Math.sin(facing) + (bz - rig.lastZ) * Math.cos(facing);
            rig.kickFoot = side >= 0 ? 1 : -1;
          } else if (rig.kickStyle === "kick") {
            rig.kickPower = Math.max(rig.kickPower, power);
          }
          break;
        }
        case "restart": {
          if (cue.flags?.["restart"] !== "throw_in") break;
          const rig = cue.playerId ? this.players.get(cue.playerId) : undefined;
          if (rig) {
            rig.kickT = 0;
            rig.kickStyle = "throw";
          }
          break;
        }
        case "contact": {
          const severity = cue.flags?.["severity"];
          for (const id of [cue.playerId, cue.secondaryId]) {
            const rig = id ? this.players.get(id) : undefined;
            if (!rig) continue;
            if (
              (severity === "reckless" || severity === "excessive_force") &&
              rig.fallT >= FALL_DUR
            ) {
              rig.fallT = 0;
            } else if (rig.stumbleT >= STUMBLE_DUR && rig.fallT >= FALL_DUR) {
              rig.stumbleT = 0;
              rig.stumbleSide = rig.seed > Math.PI ? 1 : -1;
            }
          }
          break;
        }
        case "goal": {
          if (!cue.teamId) break;
          for (const rig of this.players.values()) {
            const scored = rig.teamId === cue.teamId;
            rig.celebStyle = scored ? "score" : "concede";
            rig.celebSig = null;
            // Scorer celebrates longest; teammates join shorter; the
            // conceding side drops their heads briefly.
            rig.celebT = scored ? CELEB_DUR * 0.45 : CELEB_DUR * 0.55;
          }
          const scorer = cue.playerId ? this.players.get(cue.playerId) : undefined;
          if (scorer) {
            scorer.celebT = 0;
            // Each player owns a fixed signature, picked from their seed —
            // the same striker always breaks out the same routine.
            scorer.celebSig =
              CELEB_SIGS[Math.floor((scorer.seed / (Math.PI * 2)) * CELEB_SIGS.length) % CELEB_SIGS.length]!;
          }
          break;
        }
        default:
          break;
      }
    }
  }

  /** Up to three players of the non-offending team appeal near a position. */
  private triggerAppeals(
    offendingTeam: "home" | "away",
    pos: { x: number; z: number } | undefined,
    radius: number,
  ): void {
    if (!pos) return;
    let raised = 0;
    for (const rig of this.players.values()) {
      if (rig.teamId === offendingTeam) continue;
      const dx = rig.lastX - pos.x;
      const dz = rig.lastZ - pos.z;
      if (dx * dx + dz * dz > radius * radius) continue;
      if (rig.appealT < APPEAL_DUR || rig.fallT < FALL_DUR) continue;
      rig.appealT = 0;
      rig.appealArm = rig.seed > Math.PI ? 1 : -1;
      if (++raised >= 3) break;
    }
  }

  /**
   * Begin the pre-match ceremony from the kickoff frame: build a rig per player
   * and plot their tunnel start, halfway-line lineup spot, and kickoff target.
   * The break phase eases everyone onto their kickoff position so the hand-off
   * to live playback is seamless.
   */
  beginCeremony(
    players: readonly { playerId: string; teamId: "home" | "away"; position: { x: number; z: number } }[],
  ): void {
    // Tunnel mouth sits on the visible pitch (just inside the far touchline) so
    // the walkout actually plays on camera rather than off in the distance.
    const TUNNEL = { x: 0, z: -26 };
    const ROW_Z = 4;
    const SPACING = 2.4;
    const CENTRE_GAP = 2.6;
    const built: NonNullable<typeof this.ceremony>["players"] = [];
    const place = (
      list: readonly { playerId: string; teamId: "home" | "away"; position: { x: number; z: number } }[],
      side: -1 | 1,
    ): void => {
      list.forEach((p, i) => {
        const rig = this.players.get(p.playerId) ?? this.makeRig(p.playerId, p.teamId);
        rig.group.position.set(TUNNEL.x, 0, TUNNEL.z);
        rig.group.rotation.y = 0;
        rig.group.scale.setScalar(0.001);
        built.push({
          rig,
          tunnel: { ...TUNNEL },
          // Home fans out left of centre, away to the right; the players
          // closest to the centre line emerge first.
          line: { x: side * (CENTRE_GAP + i * SPACING), z: ROW_Z },
          kickoff: { x: p.position.x, z: p.position.z },
          emergeDelay: i * 0.3 + (side < 0 ? 0 : 0.1),
          lastX: TUNNEL.x,
          lastZ: TUNNEL.z,
          walkPhase: rig.seed,
          yaw: 0,
          seed: rig.seed,
        });
      });
    };
    place(players.filter((p) => p.teamId === "home"), -1);
    place(players.filter((p) => p.teamId === "away"), 1);
    this.ceremony = { players: built };

    // Park the ball on the centre spot; no possession ring / trail pre-match.
    this.ball.position.set(0, BALL_RADIUS, 0);
    this.ballShadow.position.set(0, 0.021, 0);
    this.ballShadow.scale.setScalar(1);
    this.possessionRing.visible = false;
    this.trailGeo.setDrawRange(0, 0);
    this.focusPlayerId = undefined;
    this.focusScreenPos = undefined;
  }

  /**
   * Drive the ceremony choreography at `elapsed` seconds and render one frame.
   * Walkout eases players from the tunnel onto the line, the anthem holds them
   * facing the main stand, and the break eases them onto their kickoff spots.
   */
  renderCeremony(elapsed: number): void {
    const cer = this.ceremony;
    if (!cer) return;
    const now = performance.now();
    const dt = Math.min(Math.max((now - (this.lastNow ?? now)) / 1000, 0.0001), 0.05);
    this.lastNow = now;
    this.clock += dt;

    // Viewer avatars cheer on their own clock during the build-up too.
    for (const v of this.viewerRigs) {
      const age = this.clock - v.spawnT;
      v.grp.scale.setScalar(Math.max(0.01, Math.min(1, easeOutBack(Math.min(age / 0.45, 1)))));
      v.grp.position.y = v.seatY + Math.max(0, Math.sin(this.clock * 4.2 + v.phase)) * 0.22;
    }

    const phase = ceremonyPhase(elapsed);
    for (const cp of cer.players) {
      const rig = cp.rig;
      let x = cp.line.x;
      let z = cp.line.z;
      let visible = true;

      if (phase === "walkout") {
        if (elapsed < cp.emergeDelay) {
          visible = false;
          x = cp.tunnel.x;
          z = cp.tunnel.z;
        } else {
          const p = smooth01((elapsed - cp.emergeDelay) / 4.5);
          x = lerp(cp.tunnel.x, cp.line.x, p);
          z = lerp(cp.tunnel.z, cp.line.z, p);
        }
      } else if (phase === "break") {
        const p = smooth01((elapsed - CEREMONY_ANTHEM_END) / (CEREMONY_TOTAL - CEREMONY_ANTHEM_END));
        x = lerp(cp.line.x, cp.kickoff.x, p);
        z = lerp(cp.line.z, cp.kickoff.z, p);
      }
      // lineup / anthem hold the line spot (defaults above).

      // Pop-in on emerge, then hold full size.
      const targetScale = visible ? RIG_SCALE : 0.001;
      rig.group.scale.setScalar(lerp(rig.group.scale.x, targetScale, Math.min(1, dt * 12)));
      rig.group.visible = rig.group.scale.x > 0.01;

      // Walk cycle + facing from the per-frame positional delta.
      const dx = x - cp.lastX;
      const dz = z - cp.lastZ;
      const speed = Math.hypot(dx, dz) / dt;
      cp.lastX = x;
      cp.lastZ = z;
      rig.group.position.set(x, 0, z);

      const moving = speed > 0.25;
      const targetYaw = moving ? -Math.atan2(dz, dx) + Math.PI / 2 : 0;
      cp.yaw += shortAngle(targetYaw - cp.yaw) * Math.min(1, dt * 8);
      rig.group.rotation.y = cp.yaw;

      const amp = Math.min(speed / 4, 1);
      if (moving) cp.walkPhase += dt * (2.4 + speed * 2.4);
      const stride = Math.sin(cp.walkPhase) * amp;
      const breathe = Math.sin(this.clock * 1.6 + cp.seed) * (1 - amp);
      const L = rig.limbs;
      L.legL.rotation.x = -stride;
      L.legR.rotation.x = stride;
      L.legL.rotation.z = -0.04;
      L.legR.rotation.z = 0.04;
      L.armL.rotation.x = stride * 0.7;
      L.armR.rotation.x = -stride * 0.7;
      L.armL.rotation.z = -0.07 - breathe * 0.03;
      L.armR.rotation.z = 0.07 + breathe * 0.03;
      rig.body.rotation.x = amp * 0.12;
      rig.body.rotation.z = 0;
      rig.body.position.y = amp * 0.04 + Math.cos(cp.walkPhase * 2) * 0.04 * amp + breathe * 0.012;
    }

    this.updateCeremonyCamera(elapsed);
    this.renderer.render(this.scene, this.camera);
  }

  /** Slow broadcast dolly over the line-up, pulling wide for the kickoff cut. */
  private updateCeremonyCamera(elapsed: number): void {
    const keys: { t: number; pos: [number, number, number]; tgt: [number, number, number] }[] = [
      // Walkout: frame the far half so players are seen streaming from the
      // tunnel; then dolly in over the line for the anthem; pull wide for kickoff.
      { t: 0, pos: [0, 28, 60], tgt: [0, 4, -10] },
      { t: CEREMONY_WALK_END, pos: [0, 22, 48], tgt: [0, 5, -2] },
      { t: CEREMONY_ANTHEM_END, pos: [0, 15, 38], tgt: [0, 6, 4] },
      { t: CEREMONY_TOTAL, pos: [0, 40, 74], tgt: [0, 2, 0] },
    ];
    let a = keys[0]!;
    let b = keys[keys.length - 1]!;
    for (let i = 0; i + 1 < keys.length; i++) {
      if (elapsed >= keys[i]!.t && elapsed <= keys[i + 1]!.t) {
        a = keys[i]!;
        b = keys[i + 1]!;
        break;
      }
    }
    const u = smooth01((elapsed - a.t) / Math.max(b.t - a.t, 1e-6));
    this.cameraPos.set(lerp(a.pos[0], b.pos[0], u), lerp(a.pos[1], b.pos[1], u), lerp(a.pos[2], b.pos[2], u));
    this.cameraTarget.set(lerp(a.tgt[0], b.tgt[0], u), lerp(a.tgt[1], b.tgt[1], u), lerp(a.tgt[2], b.tgt[2], u));
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraTarget);
  }

  /** Tear down ceremony state and cut the camera to the live match. */
  endCeremony(): void {
    if (!this.ceremony) return;
    this.ceremony = undefined;
    for (const rig of this.players.values()) {
      // Let the first live frame snap cleanly instead of animating the jump.
      rig.lastX = Number.NaN;
      rig.lastZ = Number.NaN;
      rig.group.scale.setScalar(RIG_SCALE);
      rig.group.visible = true;
    }
    this.lastSampleT = undefined;
    this.cut();
  }

  /** Apply an interpolated sealed-frame sample, fire aired actions, render. */
  render(sample: FrameSample | undefined, actions: readonly ActionCue[] = []): void {
    const now = performance.now();
    const dt = Math.min(Math.max((now - (this.lastNow ?? now)) / 1000, 0.0001), 0.05);
    this.lastNow = now;
    this.clock += dt;

    // Viewer avatars cheer on their own clock (they exist outside match time):
    // pop-in on arrival, then an offset idle bounce.
    for (const v of this.viewerRigs) {
      const age = this.clock - v.spawnT;
      v.grp.scale.setScalar(Math.max(0.01, Math.min(1, easeOutBack(Math.min(age / 0.45, 1)))));
      v.grp.position.y = v.seatY + Math.max(0, Math.sin(this.clock * 4.2 + v.phase)) * 0.22;
    }

    if (sample) {
      const { a, b, alpha } = sample;
      const span = Math.max(b.matchSecond - a.matchSecond, 1e-6);
      const t = sample.matchSecond;
      // Replay seeks jump the playhead; don't infer bounces across the cut.
      const seeked = this.lastSampleT !== undefined && Math.abs(t - this.lastSampleT) > 0.5;
      this.lastSampleT = t;

      // --- Ball: position, velocity-driven roll, bounce squash, shadow ---
      const bx = lerp(a.ball.position.x, b.ball.position.x, alpha);
      const bz = lerp(a.ball.position.z, b.ball.position.z, alpha);
      const bh = lerp(a.ball.height, b.ball.height, alpha);
      const displayBh = bh * GOAL_VIS_HEIGHT;
      this.ball.position.set(bx, BALL_RADIUS + displayBh, bz);

      const bvx = lerp(a.ball.velocity.x, b.ball.velocity.x, alpha);
      const bvz = lerp(a.ball.velocity.z, b.ball.velocity.z, alpha);
      const ballSpeed = Math.hypot(bvx, bvz);
      if (ballSpeed > 0.05) {
        // Roll without slipping on the ground; retain a slower flight spin
        // around the same axis while airborne.
        this.spinAxis.set(bvz, 0, -bvx).normalize();
        const rate =
          bh < 0.06 ? ballSpeed / BALL_RADIUS : Math.min(ballSpeed / BALL_RADIUS, 26) * 0.5;
        this.spinQ.setFromAxisAngle(this.spinAxis, rate * dt);
        this.ball.quaternion.premultiply(this.spinQ);
      }

      // Squash on landing, recovering over SQUASH_DUR.
      if (!seeked && this.prevBallH > 0.18 && bh < 0.07 && bh < this.prevBallH) this.squashT = 0;
      this.prevBallH = bh;
      this.squashT += dt;
      if (this.squashT < SQUASH_DUR) {
        const u = Math.pow(1 - this.squashT / SQUASH_DUR, 1.4);
        this.ball.scale.set(1 + 0.22 * u, 1 - 0.38 * u, 1 + 0.22 * u);
      } else {
        this.ball.scale.setScalar(1);
      }

      this.ballShadow.position.set(bx, 0.021, bz);
      this.ballShadow.scale.setScalar(1 + displayBh * 0.32);
      (this.ballShadow.material as THREE.MeshBasicMaterial).opacity = 0.34 / (1 + displayBh * 0.9);

      // Trail: timestamped in match seconds, only for fast or airborne balls.
      const lastPt = this.trailPts[this.trailPts.length - 1];
      if (lastPt && lastPt.t > t + 0.01) this.trailPts = []; // replay rewind
      if ((ballSpeed > 9 || bh > 0.5) && (!lastPt || t - lastPt.t > 0.016)) {
        this.trailPts.push({ x: bx, y: 0.3 + displayBh, z: bz, t });
        if (this.trailPts.length > MAX_TRAIL_PTS) this.trailPts.shift();
      }
      while (this.trailPts.length && this.trailPts[0]!.t < t - TRAIL_LIFE_S) this.trailPts.shift();
      const n = this.trailPts.length;
      for (let i = 0; i < n; i++) {
        const p = this.trailPts[i]!;
        this.trailPositions[i * 3] = p.x;
        this.trailPositions[i * 3 + 1] = p.y;
        this.trailPositions[i * 3 + 2] = p.z;
      }
      this.trailGeo.setDrawRange(0, n > 1 ? n : 0);
      this.trailGeo.attributes.position!.needsUpdate = true;
      (this.trail.material as THREE.LineBasicMaterial).opacity = Math.min(0.55, ballSpeed * 0.025);

      // --- Kick detection: a sealed ball-velocity spike next to a player ---
      // Once per sealed frame pair, never re-derived from invented state.
      if (a.matchSecond !== this.lastKickSecond) {
        this.lastKickSecond = a.matchSecond;
        const sa = Math.hypot(a.ball.velocity.x, a.ball.velocity.z);
        const sb = Math.hypot(b.ball.velocity.x, b.ball.velocity.z);
        const spike = sb - sa;
        if (Math.abs(spike) > 4 && a.ball.height < 2.3) {
          let toucher: { id: string; d2: number; rx: number; rz: number; facing: number } | undefined;
          for (const p of a.players) {
            const rx = a.ball.position.x - p.position.x;
            const rz = a.ball.position.z - p.position.z;
            const d2 = rx * rx + rz * rz;
            if (!toucher || d2 < toucher.d2) toucher = { id: p.playerId, d2, rx, rz, facing: p.facing };
          }
          if (toucher && toucher.d2 < 6.25) {
            const rig = this.players.get(toucher.id);
            if (rig && rig.kickT >= KICK_DUR) {
              rig.kickT = 0;
              // Ball accelerating = a strike (ground kick / jumping header);
              // ball killed dead = a receive (cushioned trap / chest control).
              rig.kickStyle =
                spike > 0
                  ? a.ball.height < 0.9
                    ? "kick"
                    : "header"
                  : a.ball.height > 0.8
                    ? "chest"
                    : "trap";
              // Swing intensity follows how hard the ball was struck.
              rig.kickPower = THREE.MathUtils.clamp(Math.abs(spike) / 10, 0.6, 1.3);
              // Pick the foot on the ball's side of the facing direction.
              const side = toucher.rx * -Math.sin(toucher.facing) + toucher.rz * Math.cos(toucher.facing);
              rig.kickFoot = side >= 0 ? 1 : -1;
            }
          }
        }
      }

      // Sealed action cues that just aired start their animations now.
      if (actions.length) this.applyActions(actions, bx, bz, bh);

      // --- Players: locomotion, lean, idle sway, kicks, possession ring ---
      if (this.nextCache?.frame !== b) {
        this.nextCache = { frame: b, map: new Map(b.players.map((p) => [p.playerId, p])) };
      }
      const next = this.nextCache.map;
      this.seenIds.clear();
      let nearest: { id: string; x: number; z: number; d: number } | undefined;
      for (const pa of a.players) {
        this.seenIds.add(pa.playerId);
        const pb = next.get(pa.playerId) ?? pa;
        const rig = this.players.get(pa.playerId) ?? this.makeRig(pa.playerId, pa.teamId);
        const px = lerp(pa.position.x, pb.position.x, alpha);
        const pz = lerp(pa.position.z, pb.position.z, alpha);

        // Ground speed from the sealed frame pair (display-rate independent).
        const frameSpeed =
          Math.hypot(pb.position.x - pa.position.x, pb.position.z - pa.position.z) / span;
        const targetYaw = -lerpAngle(pa.facing, pb.facing, alpha) + Math.PI / 2;

        // Replay cut / first frame: snap, don't animate across the jump.
        const jump = Math.hypot(px - rig.lastX, pz - rig.lastZ);
        if (!Number.isFinite(jump) || jump > 4) {
          rig.speed = frameSpeed;
          rig.yaw = targetYaw;
          rig.yawVel = 0;
          rig.kickT = KICK_DUR;
          rig.diveT = DIVE_DUR;
          rig.fallT = FALL_DUR;
          rig.slideT = SLIDE_DUR;
          rig.aerialT = AERIAL_DUR;
          rig.stumbleT = STUMBLE_DUR;
          // A goal snaps every player to their kickoff anchor on the same frame
          // the goal action fires — that teleport must NOT cancel a celebration
          // that just started (celebrations are cosmetic and ease back on their
          // own). Only abort an already-running celebration (e.g. a replay cut).
          if (rig.celebT > 1) rig.celebT = CELEB_DUR;
          rig.appealT = APPEAL_DUR;
        }
        rig.lastX = px;
        rig.lastZ = pz;

        // Smoothed speed and yaw with rotational inertia: direction changes
        // read as turns instead of instant snaps. The accel estimate uses the
        // smoothing residual: speed approaches frameSpeed at rate 9/s, so
        // (frameSpeed - speed) * 9 ~ d(speed)/dt.
        rig.accel += ((frameSpeed - rig.speed) * 9 - rig.accel) * damp(6, dt);
        rig.speed += (frameSpeed - rig.speed) * damp(9, dt);
        const step = shortAngle(targetYaw - rig.yaw) * damp(13, dt);
        rig.yaw += step;
        rig.yawVel += (step / dt - rig.yawVel) * damp(7, dt);

        // Gait direction: movement vector relative to facing. Forward run,
        // backpedal, and side shuffle all fall out of this decomposition —
        // the engine already separates where players look from where they go.
        const facingNow = lerpAngle(pa.facing, pb.facing, alpha);
        if (frameSpeed > 0.3) {
          const moveAng = Math.atan2(pb.position.z - pa.position.z, pb.position.x - pa.position.x);
          const rel = shortAngle(moveAng - facingNow);
          rig.fwd += (Math.cos(rel) - rig.fwd) * damp(8, dt);
          rig.lat += (Math.sin(rel) - rig.lat) * damp(8, dt);
        } else {
          rig.fwd += (1 - rig.fwd) * damp(2, dt);
          rig.lat += (0 - rig.lat) * damp(2, dt);
        }

        // Deceleration skid: hard braking splits the legs and throws the
        // arms out for balance.
        const skid = THREE.MathUtils.clamp((-rig.accel - 4) / 6, 0, 1);

        // Run cycle: stride frequency and swing amplitude scale with speed;
        // backpedal strides are shorter, shuffles swing the legs laterally.
        const amp = Math.min(rig.speed / 7, 1);
        rig.phase += dt * (2.2 + rig.speed * 2.6) * (1 - skid * 0.7);
        const stride = Math.sin(rig.phase) * amp * 1.05;
        const sag = stride * (rig.fwd >= 0 ? rig.fwd : rig.fwd * 0.65);
        const side = stride * rig.lat * 0.6;
        const idle = 1 - Math.min(amp * 6, 1);
        const breathe = Math.sin(this.clock * 1.7 + rig.seed) * idle;
        // Defensive footwork (backpedal/shuffle) sinks into a slight crouch.
        const crouch = (Math.max(-rig.fwd, 0) * 0.7 + Math.abs(rig.lat) * 0.5) * amp;

        const L = rig.limbs;
        L.armL.rotation.x = sag * 0.85;
        L.armR.rotation.x = -sag * 0.85;
        L.armL.rotation.z = -(0.05 + amp * 0.14 + crouch * 0.3) - breathe * 0.035 + side * 0.4;
        L.armR.rotation.z = 0.05 + amp * 0.14 + crouch * 0.3 + breathe * 0.035 + side * 0.4;
        L.legL.rotation.x = -sag;
        L.legR.rotation.x = sag;
        L.legL.rotation.z = -0.04 - side;
        L.legR.rotation.z = 0.04 - side;
        if (skid > 0.01) {
          L.legL.rotation.x = lerp(L.legL.rotation.x, -0.55, skid);
          L.legR.rotation.x = lerp(L.legR.rotation.x, 0.3, skid);
          L.armL.rotation.x = lerp(L.armL.rotation.x, -0.5, skid);
          L.armR.rotation.x = lerp(L.armR.rotation.x, -0.5, skid);
        }

        // Body: lean into the run (back when backpedaling or braking), roll
        // into turns, run bob, defensive crouch, idle breath.
        rig.body.rotation.x = amp * (rig.fwd >= 0 ? 0.16 : 0.12) * rig.fwd - skid * 0.12;
        rig.body.rotation.y = 0;
        rig.body.rotation.z = THREE.MathUtils.clamp(-rig.yawVel * 0.05, -0.22, 0.22) * amp;
        rig.body.position.y =
          amp * 0.05 +
          Math.cos(rig.phase * 2) * 0.05 * amp -
          crouch * 0.07 -
          skid * 0.08 +
          breathe * 0.012;

        // Strike action overlays the run cycle.
        if (rig.kickT < KICK_DUR) {
          rig.kickT += dt;
          const t01 = Math.min(rig.kickT / KICK_DUR, 1);
          if (rig.kickStyle === "header") {
            // Jumping header: leap, arms up, sharp nod through the ball.
            const rise = Math.sin(Math.PI * Math.min(t01 / 0.7, 1));
            const nod = Math.exp(-Math.pow((t01 - 0.3) / 0.12, 2));
            rig.body.position.y += rise * 0.5;
            rig.body.rotation.x += nod * 0.45;
            L.armL.rotation.x = -rise * 0.9;
            L.armR.rotation.x = -rise * 0.9;
            L.legL.rotation.x = rise * 0.35;
            L.legR.rotation.x = rise * 0.35;
          } else if (rig.kickStyle === "trap") {
            // Cushioned first touch: receiving foot rises to kill the ball.
            const raise = Math.sin(Math.PI * Math.min(t01 / 0.6, 1));
            const leg = rig.kickFoot === 1 ? L.legR : L.legL;
            leg.rotation.x = -raise * 0.55;
            rig.body.rotation.x -= raise * 0.05;
          } else if (rig.kickStyle === "chest") {
            // Chest control: arch back, arms flare while the ball drops.
            const arch = Math.sin(Math.PI * Math.min(t01 / 0.7, 1));
            rig.body.rotation.x -= arch * 0.3;
            L.armL.rotation.x = -arch * 0.5;
            L.armR.rotation.x = -arch * 0.5;
            L.armL.rotation.z = -(0.05 + arch * 0.4);
            L.armR.rotation.z = 0.05 + arch * 0.4;
          } else if (rig.kickStyle === "tackle") {
            // Standing tackle: drop low and stab the leg through the ball.
            const lunge = Math.sin(Math.PI * t01);
            const leg = rig.kickFoot === 1 ? L.legR : L.legL;
            leg.rotation.x = -lunge * 1.2;
            rig.body.rotation.x += lunge * 0.22;
            rig.body.position.y -= lunge * 0.3;
            L.armL.rotation.x = lunge * 0.4;
            L.armR.rotation.x = lunge * 0.4;
          } else if (rig.kickStyle === "throw") {
            // Throw-in: both arms wind overhead, then snap through together.
            const windup = Math.min(t01 / 0.45, 1);
            const release = smooth01((t01 - 0.45) / 0.3);
            const settle = 1 - smooth01((t01 - 0.78) / 0.22);
            const armX = (-3.4 + release * 1.3) * windup * settle;
            L.armL.rotation.x = armX;
            L.armR.rotation.x = armX;
            L.armL.rotation.z = -0.15;
            L.armR.rotation.z = 0.15;
            rig.body.rotation.x += (-0.18 + release * 0.34) * windup * settle;
          } else {
            const k = kickCurve(t01) * rig.kickPower;
            const kicking = rig.kickFoot === 1 ? L.legR : L.legL;
            const planted = rig.kickFoot === 1 ? L.legL : L.legR;
            const counterArm = rig.kickFoot === 1 ? L.armL : L.armR;
            kicking.rotation.x = k;
            planted.rotation.x *= 0.25;
            counterArm.rotation.x = -k * 0.5;
            // Wind-up leans slightly in, the strike leans back through the ball.
            rig.body.rotation.x += k * 0.06;
          }
        }

        // Appeal: one arm thrown up at the referee or linesman.
        if (rig.appealT < APPEAL_DUR) {
          rig.appealT += dt;
          const u = Math.sin(Math.PI * Math.min(rig.appealT / APPEAL_DUR, 1));
          const arm = rig.appealArm === 1 ? L.armR : L.armL;
          arm.rotation.z = rig.appealArm * u * 2.6;
          arm.rotation.x *= 1 - u;
        }

        // Contact stumble: quick off-balance wobble.
        if (rig.stumbleT < STUMBLE_DUR) {
          rig.stumbleT += dt;
          const w = Math.sin((rig.stumbleT / STUMBLE_DUR) * Math.PI);
          rig.body.rotation.z += w * 0.2 * rig.stumbleSide;
          rig.body.position.y -= w * 0.06;
        }

        // Slide tackle: the tackler commits low along the turf, then pops
        // back up. This is separate from the victim's fall/stumble.
        if (rig.slideT < SLIDE_DUR) {
          rig.slideT += dt;
          const f = Math.min(rig.slideT / SLIDE_DUR, 1);
          const ext =
            f < 0.2
              ? 1 - (1 - f / 0.2) * (1 - f / 0.2)
              : f < 0.72
                ? 1
                : 1 - smooth01((f - 0.72) / 0.28);
          rig.body.rotation.x += ext * 0.82;
          rig.body.rotation.z += rig.slideDir * ext * 0.34;
          rig.body.position.y -= ext * 0.34;
          L.legL.rotation.x = lerp(L.legL.rotation.x, -1.45, ext);
          L.legR.rotation.x = lerp(L.legR.rotation.x, -0.35, ext);
          L.legL.rotation.z = lerp(L.legL.rotation.z, -0.22 * rig.slideDir, ext);
          L.legR.rotation.z = lerp(L.legR.rotation.z, 0.18 * rig.slideDir, ext);
          L.armL.rotation.x = lerp(L.armL.rotation.x, 0.85, ext);
          L.armR.rotation.x = lerp(L.armR.rotation.x, 0.45, ext);
        }

        // Aerial duel: jump, lean into the contest, and land with a small
        // compression instead of flattening the loser onto the pitch.
        if (rig.aerialT < AERIAL_DUR) {
          rig.aerialT += dt;
          const f = Math.min(rig.aerialT / AERIAL_DUR, 1);
          const jump = Math.sin(f * Math.PI) * (0.34 + rig.aerialLift * 0.46);
          const contest = Math.sin(Math.min(f / 0.55, 1) * Math.PI);
          const landing = f > 0.72 ? smooth01((f - 0.72) / 0.28) : 0;
          rig.body.position.y += jump - landing * 0.12;
          rig.body.rotation.x -= contest * 0.28 * rig.aerialLift;
          rig.body.rotation.z += contest * 0.12 * (rig.seed > Math.PI ? 1 : -1);
          L.armL.rotation.z = lerp(L.armL.rotation.z, -1.2, contest);
          L.armR.rotation.z = lerp(L.armR.rotation.z, 1.2, contest);
          L.legL.rotation.x = lerp(L.legL.rotation.x, 0.28, contest);
          L.legR.rotation.x = lerp(L.legR.rotation.x, 0.22, contest);
        }

        // Fall and get back up (lost duel / fouled): trip forward onto the
        // turf with a sideways roll, throw the arms out to break the fall, sell
        // it with a brief clutch, then climb back to feet — not a stiff plank.
        if (rig.fallT < FALL_DUR) {
          rig.fallT += dt;
          const f = Math.min(rig.fallT / FALL_DUR, 1);
          const side = rig.stumbleSide;
          const down =
            f < 0.2
              ? 1 - (1 - f / 0.2) * (1 - f / 0.2)
              : f < 0.58
                ? 1
                : 1 - smooth01((f - 0.58) / 0.42);
          // The forward tip lays the torso on the turf (1.75·cos(~1.3) ≈ torso
          // half-depth); the small sideways roll keeps it off a flat face-plant.
          rig.body.rotation.x = down * 1.28;
          rig.body.rotation.z += down * 0.4 * side;
          rig.body.position.y -= down * 0.05;
          // Arms reach out to break the fall; they swing in over the get-up.
          L.armL.rotation.x = -down * 1.15;
          L.armR.rotation.x = -down * 1.15;
          L.armL.rotation.z = -down * 0.7;
          L.armR.rotation.z = down * 0.9;
          // One leg tucks under, the other trails — never frozen straight.
          L.legL.rotation.x = lerp(L.legL.rotation.x, side > 0 ? 0.7 : 0.18, down);
          L.legR.rotation.x = lerp(L.legR.rotation.x, side > 0 ? 0.18 : 0.7, down);
          // Sell the foul: a small writhe while grounded.
          if (f > 0.2 && f < 0.58) {
            rig.body.rotation.z += Math.sin(this.clock * 6.5 + rig.seed) * 0.07 * side;
          }
        }

        // Goalkeeper dive: spring sideways at the ball's elevation — a low
        // dive lays out flat along the turf, a high dive leaps for the bar.
        if (rig.diveT < DIVE_DUR) {
          rig.diveT += dt;
          const f = Math.min(rig.diveT / DIVE_DUR, 1);
          const ext =
            f < 0.28
              ? 1 - (1 - f / 0.28) * (1 - f / 0.28)
              : f < 0.55
                ? 1
                : 1 - smooth01((f - 0.55) / 0.45);
          const sink = smooth01((f - 0.15) / 0.35);
          const lift = rig.diveLift;
          // Low dives tip further over; high dives stay more upright
          // mid-leap. Tip angle is capped so the rotated torso rests on the
          // turf rather than sinking through it (sideways half-extent 0.65).
          rig.body.rotation.z = -rig.diveDir * ext * (1.1 - lift * 0.3);
          rig.body.position.y += ext * ((1 - lift) * (0.2 - sink * 0.3) + lift * 1.0);
          L.armL.rotation.z = rig.diveDir * ext * (2.0 + (1 - lift) * 0.4);
          L.armR.rotation.z = rig.diveDir * ext * (2.0 + (1 - lift) * 0.4);
          L.armL.rotation.x *= 1 - ext;
          L.armR.rotation.x *= 1 - ext;
          // Trailing legs tuck slightly on the leap.
          L.legL.rotation.x = lerp(L.legL.rotation.x, lift * 0.5, ext);
          L.legR.rotation.x = lerp(L.legR.rotation.x, lift * 0.5, ext);
        }

        // Goal celebration: the scorer wheels away and breaks out a signature
        // finish, teammates sprint over to mob them, the conceding side sags.
        // Movement is cosmetic — layered on the sealed position and eased back
        // before live play resumes (a goal is a dead-ball stoppage).
        if (rig.celebT < CELEB_DUR) {
          rig.celebT += dt;
          const t = this.clock;
          const clamp01 = (v: number) => THREE.MathUtils.clamp(v, 0, 1);
          // Quick sprint-cycle limbs reused by the wheel-away and the mob.
          const sprint = (legAmp: number) => {
            const rp = t * 13 + rig.seed;
            const sw = Math.sin(rp);
            L.legL.rotation.x = sw * legAmp;
            L.legR.rotation.x = -sw * legAmp;
            L.legL.rotation.z = 0;
            L.legR.rotation.z = 0;
            rig.body.rotation.x += 0.2;
            rig.body.position.y += Math.abs(Math.cos(rp)) * 0.06;
          };

          if (rig.celebStyle !== "score") {
            // Dejection: heads and shoulders sag.
            rig.body.rotation.x += 0.2;
          } else if (rig.celebSig) {
            const p = rig.celebT / CELEB_DUR; // 0..1 routine progress
            // Lock the wheel-away heading toward the nearest corner flag.
            if (Number.isNaN(rig.celebDir)) {
              const cx = px >= 0 ? PITCH.halfLength - 6 : -(PITCH.halfLength - 6);
              const cz = pz >= 0 ? PITCH.halfWidth - 3 : -(PITCH.halfWidth - 3);
              rig.celebDir = Math.atan2(cz - pz, cx - px);
            }
            // Fraction of the routine spent sprinting away before the finish.
            const runEnd =
              rig.celebSig === "armswide" ? 1
              : rig.celebSig === "kneeslide" ? 0.4
              : rig.celebSig === "siu" ? 0.42
              : rig.celebSig === "flip" ? 0.4
              : 0.32;
            // Cosmetic travel: full speed while running, momentum into the slide.
            let v = 0;
            if (p < runEnd) v = rig.celebSig === "armswide" ? 4.5 : 6;
            else if (rig.celebSig === "kneeslide" && p < 0.62) v = lerp(7, 0, clamp01((p - 0.4) / 0.22));
            const dist = Math.hypot(rig.celebOX, rig.celebOZ);
            if (v > 0 && dist < 11) {
              rig.celebOX += Math.cos(rig.celebDir) * v * dt;
              rig.celebOZ += Math.sin(rig.celebDir) * v * dt;
            }
            const fp = clamp01((p - runEnd) / Math.max(1 - runEnd, 0.001)); // finish progress

            if (p < runEnd && rig.celebSig !== "armswide") {
              // Wheel away: sprint with arms flung wide and a touch back.
              sprint(0.95);
              L.armL.rotation.z = -1.3;
              L.armR.rotation.z = 1.3;
              L.armL.rotation.x = -0.2;
              L.armR.rotation.x = -0.2;
            } else {
              switch (rig.celebSig) {
                case "siu": {
                  // Leap with a half spin, land in the wide arms-back stance.
                  const jump = Math.exp(-Math.pow((fp - 0.25) / 0.16, 2));
                  rig.body.position.y += jump * 1.05;
                  rig.body.rotation.y = smooth01(clamp01(fp / 0.4)) * Math.PI;
                  const land = smooth01(clamp01((fp - 0.4) / 0.2));
                  L.armL.rotation.z = lerp(-0.1, 0.75, land);
                  L.armR.rotation.z = lerp(0.1, -0.75, land);
                  L.armL.rotation.x = lerp(0, 0.35, land) - jump * 0.5;
                  L.armR.rotation.x = lerp(0, 0.35, land) - jump * 0.5;
                  L.legL.rotation.z = -0.3 * land;
                  L.legR.rotation.z = 0.3 * land;
                  L.legL.rotation.x = jump * 0.5;
                  L.legR.rotation.x = jump * 0.5;
                  break;
                }
                case "kneeslide": {
                  // Slide along the grass, lean back, arms wide, then fist-pump.
                  const slide = smooth01(clamp01((0.5 - fp) / 0.5));
                  rig.body.position.y -= slide * 0.6;
                  rig.body.rotation.x -= slide * 0.6;
                  const pump = clamp01((fp - 0.5) / 0.5) * Math.abs(Math.sin(t * 8 + rig.seed));
                  L.armL.rotation.z = -2.0 - pump * 0.4;
                  L.armR.rotation.z = 2.0 + pump * 0.4;
                  L.armL.rotation.x = -0.3 - pump * 0.5;
                  L.armR.rotation.x = -0.3 - pump * 0.5;
                  L.legL.rotation.x = slide * 1.5;
                  L.legR.rotation.x = slide * 1.5;
                  break;
                }
                case "armswide": {
                  // Aeroplane: jog on with arms locked out, banking side to side.
                  sprint(0.55);
                  L.armL.rotation.z = -1.55;
                  L.armR.rotation.z = 1.55;
                  L.armL.rotation.x = 0;
                  L.armR.rotation.x = 0;
                  rig.body.rotation.z += Math.sin(t * 3 + rig.seed) * 0.28;
                  break;
                }
                case "heart": {
                  // Hands joined overhead into a heart, gentle sway.
                  L.armL.rotation.z = -2.7;
                  L.armR.rotation.z = 2.7;
                  L.armL.rotation.x = -0.55;
                  L.armR.rotation.x = -0.55;
                  rig.body.rotation.z += Math.sin(t * 2 + rig.seed) * 0.16;
                  rig.body.position.y += Math.abs(Math.sin(t * 3)) * 0.1;
                  break;
                }
                case "calm": {
                  // Arms folded, slow swagger turn — ice cold.
                  L.armL.rotation.z = 1.15;
                  L.armR.rotation.z = -1.15;
                  L.armL.rotation.x = 0.9;
                  L.armR.rotation.x = 0.9;
                  rig.body.rotation.y = Math.sin(t * 1.2 + rig.seed) * 0.25;
                  rig.body.position.y += Math.abs(Math.sin(t * 2)) * 0.04;
                  break;
                }
                case "flip": {
                  // Plant and launch a full backflip, land with arms up.
                  const w = clamp01(fp / 0.6);
                  const air = Math.sin(Math.PI * w);
                  rig.body.rotation.x -= smooth01(w) * Math.PI * 2;
                  rig.body.position.y += air * 1.6;
                  L.legL.rotation.x = air * 1.7;
                  L.legR.rotation.x = air * 1.7;
                  L.armL.rotation.x = -air * 1.1;
                  L.armR.rotation.x = -air * 1.1;
                  const finUp = clamp01((fp - 0.68) / 0.32);
                  L.armL.rotation.z = lerp(L.armL.rotation.z, -2.4, finUp);
                  L.armR.rotation.z = lerp(L.armR.rotation.z, 2.4, finUp);
                  break;
                }
                case "point": {
                  // Both arms thrust to the sky, head back, small jumps.
                  L.armL.rotation.z = -3.0;
                  L.armR.rotation.z = 3.0;
                  L.armL.rotation.x = 0;
                  L.armR.rotation.x = 0;
                  rig.body.rotation.x -= 0.22;
                  rig.body.position.y += Math.abs(Math.sin(t * 5 + rig.seed)) * 0.2;
                  break;
                }
              }
            }
            // Publish the scorer's live position so teammates know where to mob.
            this.celebFocus = { x: px + rig.celebOX, z: pz + rig.celebOZ };
            this.celebFocusAt = t;
          } else {
            // Teammates sprint over to the scorer and pile in, arms aloft.
            const fresh = this.celebFocus && t - this.celebFocusAt < 0.3;
            if (fresh) {
              const cx = px + rig.celebOX;
              const cz = pz + rig.celebOZ;
              const gap = Math.hypot(this.celebFocus!.x - cx, this.celebFocus!.z - cz);
              const dir = Math.atan2(this.celebFocus!.z - cz, this.celebFocus!.x - cx);
              rig.celebDir = dir; // face the scorer while converging
              if (gap > 3) {
                rig.celebOX += Math.cos(dir) * 6 * dt;
                rig.celebOZ += Math.sin(dir) * 6 * dt;
                sprint(0.9);
                L.armL.rotation.z = -1.6;
                L.armR.rotation.z = 1.6;
                L.armL.rotation.x = -0.3;
                L.armR.rotation.x = -0.3;
              } else {
                // Arrived: bounce and mob with arms up.
                const hop = Math.abs(Math.sin(t * 6 + rig.seed));
                rig.body.position.y += hop * 0.3;
                L.armL.rotation.z = -2.5;
                L.armR.rotation.z = 2.5;
                L.armL.rotation.x = 0;
                L.armR.rotation.x = 0;
              }
            } else {
              // No located scorer (e.g. own goal): celebrate in place.
              const hop = Math.abs(Math.sin(t * 6 + rig.seed));
              rig.body.position.y += hop * 0.3;
              L.armL.rotation.z = -2.5;
              L.armR.rotation.z = 2.5;
              L.armL.rotation.x = 0;
              L.armR.rotation.x = 0;
            }
          }
        } else if (rig.celebOX !== 0 || rig.celebOZ !== 0) {
          // Celebration over: ease the cosmetic displacement back to the sealed
          // position so live play is never desynced, and arm a fresh heading.
          const k = damp(3, dt);
          rig.celebOX -= rig.celebOX * k;
          rig.celebOZ -= rig.celebOZ * k;
          if (Math.abs(rig.celebOX) < 0.02 && Math.abs(rig.celebOZ) < 0.02) {
            rig.celebOX = 0;
            rig.celebOZ = 0;
          }
          rig.celebDir = Number.NaN;
        }

        // Ground contact: when an overlay lowered the body (crouch, skid,
        // tackle, stumble), bend the stance so the feet meet the pitch
        // instead of sinking through it — a leg swung by θ shortens its
        // vertical reach to 1.1·cos(θ), so the bend that absorbs drop d is
        // acos(1 - d/1.1). Falls and dives manage their own geometry.
        if (rig.body.position.y < 0 && rig.fallT >= FALL_DUR && rig.diveT >= DIVE_DUR && rig.celebT >= CELEB_DUR) {
          const bend = Math.acos(Math.max(1 + rig.body.position.y / 1.1, 0));
          const dirL = Math.abs(L.legL.rotation.x) > 0.05 ? Math.sign(L.legL.rotation.x) : 1;
          const dirR = Math.abs(L.legR.rotation.x) > 0.05 ? Math.sign(L.legR.rotation.x) : -1;
          L.legL.rotation.x += dirL * bend;
          L.legR.rotation.x += dirR * bend;
        }

        // Spawn pop-in with a slight overshoot.
        if (rig.spawnT < 1) {
          rig.spawnT = Math.min(rig.spawnT + dt / 0.3, 1);
          rig.group.scale.setScalar(RIG_SCALE * Math.max(easeOutBack(rig.spawnT), 0.01));
        }

        rig.group.position.x = px + rig.celebOX;
        rig.group.position.z = pz + rig.celebOZ;
        // Face the wheel-away heading while a scorer celebration is in flight.
        rig.group.rotation.y =
          rig.celebT < CELEB_DUR && rig.celebStyle === "score" && !Number.isNaN(rig.celebDir)
            ? rig.celebDir
            : rig.yaw;
        const d = (px - bx) * (px - bx) + (pz - bz) * (pz - bz);
        if (!nearest || d < nearest.d) nearest = { id: pa.playerId, x: px, z: pz, d };
      }
      // Hide rigs for players no longer in the sealed frame (sub / sent off);
      // re-run the spawn pop when one returns.
      for (const [id, rig] of this.players) {
        const present = this.seenIds.has(id);
        if (present && !rig.group.visible) {
          rig.spawnT = 0;
          rig.lastX = Number.NaN;
        }
        rig.group.visible = present;
      }
      if (nearest && nearest.d < 9 && bh < 1.6) {
        // Ring glides to its new owner and pulses gently.
        if (!this.possessionRing.visible) this.ringPos.set(nearest.x, 0, nearest.z);
        this.ringPos.x += (nearest.x - this.ringPos.x) * damp(14, dt);
        this.ringPos.z += (nearest.z - this.ringPos.z) * damp(14, dt);
        this.possessionRing.visible = true;
        this.possessionRing.position.x = this.ringPos.x;
        this.possessionRing.position.z = this.ringPos.z;
        const pulse = 1 + Math.sin(this.clock * 5.5) * 0.05;
        this.possessionRing.scale.setScalar(pulse);
        (this.possessionRing.material as THREE.MeshBasicMaterial).opacity =
          0.7 + Math.sin(this.clock * 5.5) * 0.15;
        this.focusPlayerId = nearest.id;
      } else {
        this.possessionRing.visible = false;
        this.focusPlayerId = undefined;
        this.focusScreenPos = undefined;
      }

      // Directed camera: hard cut on demand, smooth blend otherwise. While the
      // scorer is mid-celebration on the live feed (not during a replay), follow
      // them so the wheel-away and the mob are actually on screen.
      const celebrating =
        this.celebFocus !== undefined &&
        t - this.celebFocusAt < 0.25 &&
        this.mode !== "replay_close";
      const pose = celebrating
        ? this.celebrationPose(this.celebFocus!.x, this.celebFocus!.z)
        : this.cameraPose(bx, bz);
      if (this.pendingCut) {
        this.pendingCut = false;
        this.modeBlend = 1;
        this.cameraPos.copy(pose.position);
        this.cameraTarget.copy(pose.look);
        this.camera.fov = pose.fov;
      }
      this.modeBlend = Math.min(1, this.modeBlend + dt * 2.1);
      const ease = damp(2.4 + this.modeBlend * 1.2, dt);
      this.cameraPos.lerp(pose.position, ease);
      this.cameraTarget.lerp(pose.look, Math.min(ease * 1.25, 1));
      this.camera.position.copy(this.cameraPos);
      this.camera.fov += (pose.fov - this.camera.fov) * damp(3, dt);
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(this.cameraTarget);

      // Project the focus player's head into CSS pixels for the floating tag.
      if (this.focusPlayerId && nearest) {
        this.projection.set(nearest.x, 2.4, nearest.z).project(this.camera);
        if (this.projection.z < 1) {
          this.focusScreenPos = {
            x: ((this.projection.x + 1) / 2) * this.canvas.clientWidth,
            y: ((1 - this.projection.y) / 2) * this.canvas.clientHeight,
          };
        } else {
          this.focusScreenPos = undefined;
        }
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
