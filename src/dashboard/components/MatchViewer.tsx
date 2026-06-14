import React, { Suspense, useRef, useMemo, useEffect, useCallback, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { useMatchRoom } from '../../hooks/useMatchRoom';
import type { DbMatchEvent } from '../../lib/matchRoom';
import type { BezierBall, FormationPlayer, MatchEventPayload, PlayerMover } from '../../models/models';

// ── Player state ───────────────────────────────────────────────────────────────

interface PlayerState {
  id: number; team: 'home' | 'away'; pos: string; num: number;
  x: number; z: number;
  formX: number; formZ: number; // home formation position
}

type PlayerStates = Map<number, PlayerState>;

// ── Active animation ───────────────────────────────────────────────────────────

interface EventAnim {
  duration: number;
  ball: BezierBall | null;       // null = ball stays put (goal celebration)
  movers: PlayerMover[];
  // pre-computed secondary targets for every non-mover (role-based contextual movement)
  secondaryTargets: Map<number, { tx: number; tz: number }>;
  eventType: string;
  onComplete?: () => void;
}

// ── Role-based off-ball movement weights ───────────────────────────────────────
// Returns how much (0–1) a player at this position shifts toward ball landing zone

function roleWeights(pos: string): { x: number; z: number; speed: number } {
  switch (pos) {
    case 'GK':  return { x: 0.08, z: 0.0,  speed: 1.0 }; // barely moves, tracks X only
    case 'CB':  return { x: 0.15, z: 0.08, speed: 1.8 };
    case 'LB':
    case 'RB':  return { x: 0.25, z: 0.15, speed: 2.2 };
    case 'CDM': return { x: 0.28, z: 0.18, speed: 2.4 };
    case 'CM':  return { x: 0.35, z: 0.25, speed: 2.6 };
    case 'LM':
    case 'RM':  return { x: 0.40, z: 0.28, speed: 2.8 };
    case 'CAM': return { x: 0.40, z: 0.30, speed: 3.0 };
    case 'LW':
    case 'RW':  return { x: 0.38, z: 0.35, speed: 3.2 };
    case 'ST':
    case 'CF':  return { x: 0.30, z: 0.40, speed: 3.0 };
    default:    return { x: 0.25, z: 0.20, speed: 2.4 };
  }
}

// ── Constants ──────────────────────────────────────────────────────────────────

const HAIR_COLORS = ['#222222', '#f4cb42', '#5a3825', '#d66013', '#cc9966', '#aaaaaa'];

// Ease-in-out quad
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// Quadratic bezier scalar
function bezier1D(t: number, s: number, p: number, e: number) {
  const u = 1 - t;
  return u * u * s + 2 * u * t * p + t * t * e;
}

// ── Camera that follows ball position ref ──────────────────────────────────────

function CameraRig({ ballPosRef }: { ballPosRef: React.RefObject<THREE.Vector3> }) {
  useFrame(({ camera }) => {
    const pos = ballPosRef.current;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, 40, 0.05);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 15, 0.05);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, pos.z, 0.06);
    camera.lookAt(pos.x, 1, pos.z);
  });
  return null;
}

// ── Pitch ──────────────────────────────────────────────────────────────────────

function PitchFloor() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 2048;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#227232'; ctx.fillRect(0, 0, 2048, 2048);
    ctx.fillStyle = '#29823b';
    for (let i = 0; i < 16; i += 2) ctx.fillRect(0, i * 128, 2048, 128);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 10;
    ctx.strokeRect(124, 124, 1800, 1800);
    ctx.beginPath(); ctx.moveTo(124, 1024); ctx.lineTo(1924, 1024); ctx.stroke();
    ctx.beginPath(); ctx.arc(1024, 1024, 180, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(1024, 1024, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeRect(524, 1524, 1000, 400); ctx.strokeRect(524, 124, 1000, 400);
    return Object.assign(new THREE.CanvasTexture(c), { anisotropy: 8 });
  }, []);

  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
      <boxGeometry args={[34, 52, 0.4]} />
      <meshStandardMaterial map={tex} roughness={0.85} />
    </mesh>
  );
}

// ── Goals ──────────────────────────────────────────────────────────────────────

function Goal({ z, flip }: { z: number; flip: boolean }) {
  const postMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.2 }), []);
  const netTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const ctx = c.getContext('2d')!;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, 32, 32);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(16, 8); return t;
  }, []);

  return (
    <group position={[0, 0, z]} rotation={[0, flip ? Math.PI : 0, 0]}>
      <mesh castShadow position={[-3.6, 1.22, 0]}><cylinderGeometry args={[0.06, 0.06, 2.44, 16]} /><primitive object={postMat} attach="material" /></mesh>
      <mesh castShadow position={[3.6, 1.22, 0]}><cylinderGeometry args={[0.06, 0.06, 2.44, 16]} /><primitive object={postMat} attach="material" /></mesh>
      <mesh castShadow position={[0, 2.44, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.06, 0.06, 7.2, 16]} /><primitive object={postMat} attach="material" /></mesh>
      <mesh position={[0, 1.22, -1]}>
        <boxGeometry args={[7.2, 2.44, 2]} />
        <meshStandardMaterial map={netTex} transparent opacity={0.35} side={THREE.DoubleSide} wireframe />
      </mesh>
    </group>
  );
}

// ── Minifigure ─────────────────────────────────────────────────────────────────

interface MiniProps {
  team: 'home' | 'away'; hairStyle: number; hairColor: string;
  leftLegRef?: React.RefObject<THREE.Group | null>;
  rightLegRef?: React.RefObject<THREE.Group | null>;
}

function Minifigure({ team, hairStyle, hairColor, leftLegRef, rightLegRef }: MiniProps) {
  const jersey = team === 'home' ? '#0055ff' : '#cc1133';
  const skin  = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffdd00', roughness: 0.15 }), []);
  const cloth = useMemo(() => new THREE.MeshStandardMaterial({ color: jersey, roughness: 0.15 }), [jersey]);
  const pants = useMemo(() => new THREE.MeshStandardMaterial({ color: '#dddddd', roughness: 0.2 }), []);
  const hair  = useMemo(() => new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.2 }), [hairColor]);

  return (
    <group>
      <mesh castShadow position={[0, 1.15, 0]}><cylinderGeometry args={[0.26, 0.40, 0.8, 4, 1, false, Math.PI / 4]} /><primitive object={cloth} attach="material" /></mesh>
      <group position={[0, 1.85, 0]}>
        <mesh castShadow><cylinderGeometry args={[0.26, 0.26, 0.45, 16]} /><primitive object={skin} attach="material" /></mesh>
        <mesh position={[-0.1, 0.05, 0.25]}><sphereGeometry args={[0.03, 8, 8]} /><meshBasicMaterial color="#111" /></mesh>
        <mesh position={[0.1, 0.05, 0.25]}><sphereGeometry args={[0.03, 8, 8]} /><meshBasicMaterial color="#111" /></mesh>
        {hairStyle === 0
          ? <mesh castShadow position={[0, 0.15, -0.02]}><boxGeometry args={[0.56, 0.22, 0.56]} /><primitive object={hair} attach="material" /></mesh>
          : <mesh castShadow position={[0, 0.22, 0]}><boxGeometry args={[0.54, 0.12, 0.54]} /><primitive object={hair} attach="material" /></mesh>}
      </group>
      <group position={[-0.42, 1.45, 0]}><mesh castShadow position={[0, -0.25, 0]}><cylinderGeometry args={[0.09, 0.08, 0.5, 12]} /><primitive object={cloth} attach="material" /></mesh></group>
      <group position={[0.42, 1.45, 0]}><mesh castShadow position={[0, -0.25, 0]}><cylinderGeometry args={[0.09, 0.08, 0.5, 12]} /><primitive object={cloth} attach="material" /></mesh></group>
      <group ref={leftLegRef}  position={[-0.18, 0.75, 0]}><mesh castShadow position={[0, -0.35, 0]}><boxGeometry args={[0.24, 0.7, 0.30]} /><primitive object={pants} attach="material" /></mesh></group>
      <group ref={rightLegRef} position={[0.18, 0.75, 0]}><mesh castShadow position={[0, -0.35, 0]}><boxGeometry args={[0.24, 0.7, 0.30]} /><primitive object={pants} attach="material" /></mesh></group>
    </group>
  );
}

// ── Animated player — pure Three.js group, no physics ─────────────────────────

function AnimatedPlayer({
  playerId, team, playerStatesRef,
}: {
  playerId: number; team: 'home' | 'away';
  playerStatesRef: React.MutableRefObject<PlayerStates>;
}) {
  const groupRef  = useRef<THREE.Group>(null);
  const leftLeg   = useRef<THREE.Group | null>(null);
  const rightLeg  = useRef<THREE.Group | null>(null);
  const prevX     = useRef(0);
  const prevZ     = useRef(0);

  const hs = playerId % 2;
  const hc = HAIR_COLORS[playerId % HAIR_COLORS.length];

  useFrame((state, delta) => {
    const s = playerStatesRef.current.get(playerId);
    if (!s || !groupRef.current) return;

    groupRef.current.position.set(s.x, 1.2, s.z);

    const dx = s.x - prevX.current;
    const dz = s.z - prevZ.current;
    const speed = Math.hypot(dx, dz) / Math.max(delta, 0.001);

    if (speed > 0.3) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y, Math.atan2(dx, dz), 0.2,
      );
    }

    const swing = speed > 0.5
      ? Math.sin(state.clock.getElapsedTime() * (4 + speed * 0.3)) * Math.min(0.65, speed * 0.07)
      : 0;
    if (leftLeg.current)  leftLeg.current.rotation.x  = THREE.MathUtils.lerp(leftLeg.current.rotation.x,  swing,  0.3);
    if (rightLeg.current) rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, -swing, 0.3);

    prevX.current = s.x;
    prevZ.current = s.z;
  });

  const init = playerStatesRef.current.get(playerId);

  return (
    <group ref={groupRef} position={[init?.x ?? 0, 1.2, init?.z ?? 0]}>
      <Minifigure
        team={team} hairStyle={hs} hairColor={hc}
        leftLegRef={leftLeg as React.RefObject<THREE.Group>}
        rightLegRef={rightLeg as React.RefObject<THREE.Group>}
      />
    </group>
  );
}

// ── Ball — pure Three.js mesh, moves via bezier in MatchScene ─────────────────

function AnimatedBall({ meshRef }: { meshRef: React.RefObject<THREE.Mesh | null> }) {
  return (
    <mesh ref={meshRef} position={[0, 0.42, 0]} castShadow>
      <sphereGeometry args={[0.42, 16, 16]} />
      <meshStandardMaterial color="#ffffff" roughness={0.2} />
      <mesh>
        <sphereGeometry args={[0.425, 8, 8]} />
        <meshBasicMaterial color="#333" wireframe />
      </mesh>
    </mesh>
  );
}

// ── Ball shadow (blob on ground) ───────────────────────────────────────────────

function BallShadow({ meshRef }: { meshRef: React.RefObject<THREE.Mesh | null> }) {
  const shadowRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!meshRef.current || !shadowRef.current) return;
    const h = meshRef.current.position.y;
    const scale = Math.max(0.1, 1 - h * 0.08);
    shadowRef.current.position.set(meshRef.current.position.x, 0.01, meshRef.current.position.z);
    shadowRef.current.scale.set(scale, 1, scale);
  });
  return (
    <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.5, 16]} />
      <meshBasicMaterial color="#000" transparent opacity={0.25} />
    </mesh>
  );
}

// ── Stadium ────────────────────────────────────────────────────────────────────

function useCrowdTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 512, 256);
    const palette = ['#0044cc','#ffffff','#cc1133','#ffcc00','#888','#002288','#ff6680'];
    const cols = 48, rows = 18, cw = 512 / cols, ch = 256 / rows;
    for (let r = 0; r < rows; r++)
      for (let col = 0; col < cols; col++) {
        ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
        ctx.fillRect(col * cw + 1, r * ch + 1, cw - 2, ch - 2);
      }
    return new THREE.CanvasTexture(c);
  }, []);
}

function Stand({ length, position, rotationY }: { length: number; position: [number,number,number]; rotationY: number }) {
  const crowdTex = useCrowdTexture();
  const concrete = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1e1e1e', roughness: 0.95 }), []);
  const roofMat  = useMemo(() => new THREE.MeshStandardMaterial({ color: '#141414', metalness: 0.5, roughness: 0.6 }), []);
  const TIERS = 5;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {Array.from({ length: TIERS }, (_, i) => {
        const zOff = (TIERS - 1 - i) * 1.6 + 1;
        const yPos = i * 2.4 + 1.2;
        const isTop = i === TIERS - 1;
        const mats = [
          concrete, concrete, concrete, concrete,
          isTop ? new THREE.MeshStandardMaterial({ map: crowdTex, roughness: 0.9 }) : concrete,
          concrete,
        ];
        return (
          <mesh key={i} castShadow receiveShadow position={[0, yPos, zOff]}>
            <boxGeometry args={[length, 2.4, 1.8]} />
            {mats.map((m, mi) => <primitive key={mi} object={m} attach={`material-${mi}`} />)}
          </mesh>
        );
      })}
      <mesh receiveShadow position={[0, TIERS * 2.4 + 0.8, 1.5]} rotation={[-0.12, 0, 0]}>
        <boxGeometry args={[length + 2, 0.35, TIERS * 1.6 + 2]} />
        <primitive object={roofMat} attach="material" />
      </mesh>
    </group>
  );
}

function FloodlightPylon({ position }: { position: [number,number,number] }) {
  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: '#777', metalness: 0.8, roughness: 0.3 }), []);
  const glow  = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff8e0', emissive: '#fff8e0', emissiveIntensity: 3 }), []);
  const H = 20;
  return (
    <group position={position}>
      <mesh castShadow position={[0, H / 2, 0]}><cylinderGeometry args={[0.18, 0.28, H, 8]} /><primitive object={metal} attach="material" /></mesh>
      <mesh position={[0, H + 0.3, 0]}><boxGeometry args={[2.5, 0.5, 1.6]} /><primitive object={glow} attach="material" /></mesh>
      <pointLight position={[0, H + 0.5, 0]} intensity={900} distance={90} color="#fff8ee" castShadow={false} />
    </group>
  );
}

function Stadium() {
  const ground = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0d0d0d', roughness: 1 }), []);
  return (
    <>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, 0]}>
        <planeGeometry args={[110, 110]} />
        <primitive object={ground} attach="material" />
      </mesh>
      <Stand length={58} position={[-24, 0, 0]} rotationY={-Math.PI / 2} />
      <Stand length={46} position={[0, 0, -33]} rotationY={0} />
      <Stand length={46} position={[0, 0,  33]} rotationY={Math.PI} />
      <FloodlightPylon position={[-26, 0, -35]} />
      <FloodlightPylon position={[ 44, 0, -35]} />
      <FloodlightPylon position={[-26, 0,  35]} />
      <FloodlightPylon position={[ 44, 0,  35]} />
    </>
  );
}

// ── Convert raw event to EventAnim ─────────────────────────────────────────────

function toAnim(ev: DbMatchEvent, states: PlayerStates, ballPos: THREE.Vector3): EventAnim | null {
  const p = ev.payload as MatchEventPayload;

  if (ev.event_type === 'kickoff' || ev.event_type === 'full_time') return null;

  if (ev.event_type === 'goal') {
    // Celebration pause — ball stays in net, then reset to centre
    const _states = states;
    return {
      duration: 3.5,
      ball: null,
      movers: [],
      secondaryTargets: new Map(),
      eventType: 'goal',
      onComplete: () => {
        ballPos.set(0, 0.42, 0);
        for (const [, s] of _states) { s.x = s.formX; s.z = s.formZ; }
      },
    };
  }

  if (!p.ball && !p.movers?.length) return null;

  const ball = p.ball ?? null;
  const movers = p.movers ?? [];

  // Fill and sanitize primary movers
  const filledMovers = movers.map(m => {
    const s = states.get(m.id);
    const filled = {
      ...m,
      fx: m.fx ?? s?.x ?? 0,
      fz: m.fz ?? s?.z ?? 0,
    };

    const isStationary = filled.tx === filled.fx && filled.tz === filled.fz;
    if (isStationary && ball) {
      if (ev.event_type === 'pass' && m.id === p.to) {
        filled.tx = ball.ex;
        filled.tz = ball.ez;
      } else if (ev.event_type === 'pass' && m.id === p.from) {
        const dx = ball.ex - ball.sx;
        const dz = ball.ez - ball.sz;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        filled.tx = filled.fx + (dx / len) * 1.5;
        filled.tz = filled.fz + (dz / len) * 1.5;
      } else if (ev.event_type === 'shot' && m.id === p.shooter) {
        const dz = ball.ez - ball.sz;
        filled.tz = filled.fz + Math.sign(dz) * 4;
      } else if ((ev.event_type === 'tackle' || ev.event_type === 'foul') && m.id === (p.tackler ?? p.fouler)) {
        filled.tx = ball.sx;
        filled.tz = ball.sz;
      }
    }

    return filled;
  });

  // Pre-compute secondary targets for every non-mover based on role + ball destination
  const moverSet = new Set(filledMovers.map(m => m.id));
  const secondaryTargets = new Map<number, { tx: number; tz: number }>();
  const bex = ball?.ex ?? 0;
  const bez = ball?.ez ?? 0;
  for (const [id, s] of states) {
    if (moverSet.has(id)) continue;
    const w = roleWeights(s.pos);
    // GK: only track X (stay on goal line via formZ)
    const tx = s.formX + (bex - s.formX) * w.x;
    const tz = s.pos === 'GK' ? s.formZ : s.formZ + (bez - s.formZ) * w.z;
    secondaryTargets.set(id, { tx, tz });
  }

  return {
    duration: p.duration ?? 1.5,
    ball,
    movers: filledMovers,
    secondaryTargets,
    eventType: ev.event_type,
  };
}

// ── Match scene ────────────────────────────────────────────────────────────────

function MatchScene({
  events,
  onScore,
  onNarrative,
}: {
  events: DbMatchEvent[];
  onScore: (h: number, a: number) => void;
  onNarrative: (s: string) => void;
}) {
  const ballMeshRef     = useRef<THREE.Mesh | null>(null);
  const ballPosRef      = useRef(new THREE.Vector3(0, 0.42, 0));
  const playerStatesRef = useRef<PlayerStates>(new Map());
  const queueRef        = useRef<DbMatchEvent[]>([]);
  const lastQueuedRef   = useRef(-1);
  const currentAnimRef  = useRef<EventAnim | null>(null);
  const progressRef     = useRef(0);
  const homeScoreRef    = useRef(0);
  const awayScoreRef    = useRef(0);
  // Stable refs for callbacks (avoid stale closure in useFrame)
  const onScoreRef      = useRef(onScore);
  const onNarrativeRef  = useRef(onNarrative);
  useEffect(() => { onScoreRef.current = onScore; }, [onScore]);
  useEffect(() => { onNarrativeRef.current = onNarrative; }, [onNarrative]);

  // Extract formation from kickoff event
  const formation = useMemo<FormationPlayer[]>(() => {
    const ko = events.find(e => e.event_type === 'kickoff');
    const f = (ko?.payload as unknown as Record<string, unknown>)?.formation;
    return Array.isArray(f) ? (f as FormationPlayer[]) : [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.find(e => e.event_type === 'kickoff')?.seq ?? -1]);

  // Initialise player states from formation
  useEffect(() => {
    if (!formation.length) return;
    const m = playerStatesRef.current;
    m.clear();
    for (const fp of formation) {
      m.set(fp.id, {
        id: fp.id, team: fp.team, pos: fp.pos, num: fp.num,
        x: fp.x, z: fp.z, formX: fp.x, formZ: fp.z,
      });
    }
  }, [formation]);

  useFrame((_, delta) => {
    // Drain new events into queue
    for (const ev of events) {
      if (ev.seq <= lastQueuedRef.current) continue;
      queueRef.current.push(ev);
      lastQueuedRef.current = ev.seq;
    }

    const anim = currentAnimRef.current;

    if (anim) {
      progressRef.current += delta / anim.duration;
      const raw = Math.min(progressRef.current, 1.0);
      const t   = easeInOut(raw);

      // Move ball along bezier
      if (anim.ball && ballMeshRef.current) {
        const b = anim.ball;
        const x = bezier1D(t, b.sx, b.px, b.ex);
        const y = bezier1D(t, b.sy, b.py, b.ey);
        const z = bezier1D(t, b.sz, b.pz, b.ez);
        ballMeshRef.current.position.set(x, y, z);
        ballPosRef.current.set(x, y, z);
      }

      // Move active players
      for (const mover of anim.movers) {
        const s = playerStatesRef.current.get(mover.id);
        if (s) {
          s.x = THREE.MathUtils.lerp(mover.fx, mover.tx, t);
          s.z = THREE.MathUtils.lerp(mover.fz, mover.tz, t);
        }
      }

      // Non-movers: lerp toward their pre-computed role-based secondary target
      const moverIds = new Set(anim.movers.map(m => m.id));
      for (const [id, s] of playerStatesRef.current) {
        if (moverIds.has(id)) continue;
        const target = anim.secondaryTargets.get(id);
        if (!target) continue;
        const w = roleWeights(s.pos);
        s.x = THREE.MathUtils.lerp(s.x, target.tx, delta * w.speed);
        s.z = THREE.MathUtils.lerp(s.z, target.tz, delta * w.speed);
      }

      if (raw >= 1.0) {
        // Commit final mover positions AND update their formation anchor
        // so they stay where they moved to instead of drifting back to kickoff
        for (const mover of anim.movers) {
          const s = playerStatesRef.current.get(mover.id);
          if (s) {
            s.x = mover.tx; s.z = mover.tz;
            s.formX = mover.tx; s.formZ = mover.tz;
          }
        }
        anim.onComplete?.();
        currentAnimRef.current = null;
        progressRef.current    = 0;
      }
    } else {
      // Start next queued event first (no drift between back-to-back events)
      if (queueRef.current.length > 0) {
        const next = queueRef.current.shift()!;

        // Score / narrative side-effects
        const p = next.payload as MatchEventPayload;
        if (next.event_type === 'goal') {
          homeScoreRef.current = p.home_score ?? homeScoreRef.current;
          awayScoreRef.current = p.away_score ?? awayScoreRef.current;
          onScoreRef.current(homeScoreRef.current, awayScoreRef.current);
        }
        if (next.event_type === 'full_time') {
          homeScoreRef.current = p.home_score ?? homeScoreRef.current;
          awayScoreRef.current = p.away_score ?? awayScoreRef.current;
          onScoreRef.current(homeScoreRef.current, awayScoreRef.current);
        }
        if (p.narrative) onNarrativeRef.current(p.narrative);

        const anim = toAnim(next, playerStatesRef.current, ballPosRef.current);
        if (anim) {
          currentAnimRef.current = anim;
          progressRef.current    = 0;
        }
      } else {
        // Queue empty — players drift back to formation anchor (slower settle)
        for (const [, s] of playerStatesRef.current) {
          s.x = THREE.MathUtils.lerp(s.x, s.formX, delta * 1.5);
          s.z = THREE.MathUtils.lerp(s.z, s.formZ, delta * 1.5);
        }
      }
    }
  });

  return (
    <>
      <ambientLight intensity={1.2} color="#cce0ff" />
      <directionalLight
        position={[0, 40, 10]} intensity={1.4} color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048] as [number, number]}
        shadow-camera-left={-40} shadow-camera-right={40}
        shadow-camera-top={60}   shadow-camera-bottom={-60}
      />

      <Stadium />
      <PitchFloor />
      <Goal z={-24.2} flip={false} />
      <Goal z={24.2}  flip />

      <AnimatedBall meshRef={ballMeshRef} />
      <BallShadow   meshRef={ballMeshRef} />
      <CameraRig    ballPosRef={ballPosRef} />

      {formation.map(fp => (
        <AnimatedPlayer
          key={fp.id}
          playerId={fp.id}
          team={fp.team}
          playerStatesRef={playerStatesRef}
        />
      ))}
    </>
  );
}

// ── Score HUD ──────────────────────────────────────────────────────────────────

function ScoreHUD({ homeScore, awayScore, status, narrative }: {
  homeScore: number; awayScore: number; status: string; narrative: string | null;
}) {
  const isLive     = status === 'live';
  const isFinished = status === 'finished';
  return (
    <>
      <div style={{
        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
        padding: '8px 28px', display: 'flex', alignItems: 'center', gap: 20,
        zIndex: 10, color: '#fff', fontFamily: 'monospace', userSelect: 'none',
      }}>
        <span style={{ fontSize: 12, color: '#6699ff', fontWeight: 700 }}>HOME</span>
        <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: 6 }}>
          {homeScore} – {awayScore}
        </span>
        <span style={{ fontSize: 12, color: '#ff5566', fontWeight: 700 }}>AWAY</span>
        <span style={{
          fontSize: 10, fontWeight: 700, marginLeft: 4, padding: '2px 7px', borderRadius: 4,
          color:      isLive ? '#ff4d4d' : isFinished ? '#44bb66' : '#888',
          background: isLive ? 'rgba(255,77,77,0.15)' : 'transparent',
          border:     `1px solid ${isLive ? '#ff4d4d55' : 'transparent'}`,
        }}>
          {isLive ? '● LIVE' : isFinished ? 'FULL TIME' : status.toUpperCase()}
        </span>
      </div>

      {narrative && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
          padding: '8px 20px', maxWidth: 580, zIndex: 10,
          color: '#fff', fontSize: 13, fontStyle: 'italic', textAlign: 'center',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {narrative}
        </div>
      )}
    </>
  );
}

// ── MatchViewer ────────────────────────────────────────────────────────────────

export default function MatchViewer({ matchId, height = '100%', onFinished }: { matchId?: string; height?: string; onFinished?: () => void }) {
  const { events, status, starting, error, startMatch } = useMatchRoom(matchId);
  const [hudScore,     setHudScore]     = useState({ home: 0, away: 0 });
  const [hudNarrative, setHudNarrative] = useState('');

  // Reset HUD when a new match begins
  useEffect(() => { setHudScore({ home: 0, away: 0 }); setHudNarrative(''); }, [matchId]);

  // Notify parent when a new simulation finishes
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current !== 'finished' && status === 'finished' && !matchId) {
      onFinished?.();
    }
    prevStatus.current = status;
  }, [status, matchId, onFinished]);

  const handleScore     = useCallback((h: number, a: number) => setHudScore({ home: h, away: a }), []);
  const handleNarrative = useCallback((s: string) => setHudNarrative(s), []);

  // status is the source of truth — 'finished' means all events downloaded
  const isFinished  = status === 'finished';
  const isBuffering = status === 'live' || status === 'pending';

  // Only feed MatchScene after all events are in memory → zero-gap playback
  const sceneEvents = isFinished ? events : [];
  const displayStatus = isFinished ? 'finished' : status;


  return (
    <div style={{ position: 'relative', width: '100%', height, background: '#050a12', borderRadius: 12, overflow: 'hidden' }}>
      <Canvas camera={{ position: [40, 15, 0], fov: 50 }} shadows onCreated={({ gl }) => { gl.shadowMap.type = THREE.PCFShadowMap; }}>
        <Suspense fallback={null}>
          <MatchScene
            key={matchId ?? 'idle'}
            events={sceneEvents}
            onScore={handleScore}
            onNarrative={handleNarrative}
          />
        </Suspense>
      </Canvas>

      {/* Score HUD — only show once match is actually playing back */}
      {isFinished && (
        <ScoreHUD
          homeScore={hudScore.home} awayScore={hudScore.away}
          status={displayStatus}
          narrative={hudNarrative || null}
        />
      )}

      {/* Idle overlay */}
      {status === 'idle' && !starting && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
          background: 'rgba(0,0,0,0.55)',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>Ready to simulate?</div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: 0 }}>
            AI animates every touch — full bezier trajectories, no physics guesswork
          </p>
          <button
            className="q-btn primary"
            style={{ fontSize: 14, padding: '12px 36px', justifyContent: 'center', marginTop: 8 }}
            onClick={() => startMatch(null)}
          >
            Kick Off vs AI
          </button>
        </div>
      )}

      {/* Buffering overlay — shown while AI generates events */}
      {(starting || isBuffering) && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
          background: 'rgba(5,10,18,0.92)',
        }}>
          {/* Stadium icon */}
          <svg width={48} height={48} viewBox="0 0 48 48" fill="none">
            <ellipse cx={24} cy={30} rx={20} ry={8} stroke="#1a4a2a" strokeWidth={2} fill="#0a1e12" />
            <ellipse cx={24} cy={30} rx={13} ry={5} stroke="#2a6a3a" strokeWidth={1.5} fill="none" />
            <rect x={20} y={18} width={8} height={12} rx={1} fill="#1a4a2a" />
            <rect x={22} y={14} width={4} height={6} rx={0.5} fill="#2a6a3a" />
            <circle cx={24} cy={30} r={2} fill="#3a8a4a" />
            <line x1={4} y1={30} x2={4} y2={20} stroke="#1a3a2a" strokeWidth={2} />
            <line x1={44} y1={30} x2={44} y2={20} stroke="#1a3a2a" strokeWidth={2} />
            <line x1={4} y1={20} x2={24} y2={14} stroke="#1a3a2a" strokeWidth={1.5} />
            <line x1={44} y1={20} x2={24} y2={14} stroke="#1a3a2a" strokeWidth={1.5} />
          </svg>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>
              {starting ? 'Setting up match…' : 'Generating match…'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
              {starting ? 'Connecting to AI engine' : 'AI is scripting every touch, pass and goal'}
            </div>
          </div>

          {/* Indeterminate progress bar */}
          <div style={{ width: 240, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: 'var(--accent, #4488ff)',
              animation: 'slide 1.6s ease-in-out infinite',
            }} />
          </div>

          {/* Pulsing dots */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--accent, #4488ff)',
                opacity: 0.7,
                animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{
          position: 'absolute', bottom: 70, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, background: 'rgba(255,50,50,0.12)',
          border: '1px solid #ff5555', borderRadius: 8,
          padding: '8px 16px', color: '#ff8888', fontSize: 12,
        }}>
          {error}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50%       { transform: scale(1.4); opacity: 1; }
        }
        @keyframes slide {
          0%   { width: 0%;   margin-left: 0%; }
          50%  { width: 60%;  margin-left: 20%; }
          100% { width: 0%;   margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}
