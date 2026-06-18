/**
 * @agenticfoot/broadcast — broadcast timeline over sealed segments.
 *
 * Pure presentation state: given sealed match truth (segments) and a broadcast
 * clock that lags the simulation clock, derive what goes to air each second —
 * frame batches, event feed cues, scorebug state, and viewer sync packets.
 *
 * This package never simulates. It reads sealed frames/events only, and it
 * refuses to advance the broadcast clock past sealed truth.
 */
import type { ActionCue, MatchEvent, MatchFact, MatchSegment, RuleDecision, TeamId, Vec2 } from "./domain";

export type { ActionCue, ActionCueKind } from "./domain";

// ---------------------------------------------------------------------------
// Presentation types (broadcast-model.md)
// ---------------------------------------------------------------------------

/** Display identity for one team. The sim only knows "home"/"away". */
export interface TeamPresentation {
  clubId: string;
  name: string;
  shortName: string;
  /** Primary kit color as a CSS hex string. */
  color: string;
}

export interface TeamPair {
  home: TeamPresentation;
  away: TeamPresentation;
}

export type BroadcastState = "pre_match" | "live_play" | "fulltime";

export interface ScoreState {
  home: number;
  away: number;
}

export interface TeamBroadcastState extends TeamPresentation {
  score: number;
}

export interface ScorebugState {
  home: TeamBroadcastState;
  away: TeamBroadcastState;
  /** Broadcast clock, formatted MM:SS. */
  clock: string;
  phase: "1H" | "2H" | "FT";
  status: "LIVE" | "PRE" | "FT";
}

/** Late joiners snap to this shared clock state. */
export interface BroadcastSyncPacket {
  matchId: string;
  broadcastSecond: number;
  activeSegmentId: string | undefined;
  serverTime: number;
  score: ScoreState;
  state: BroadcastState;
  /** Sealed truth ahead of the broadcast clock, in virtual seconds. */
  bufferSeconds: number;
  /** Connected live viewers (stamped by the broadcaster, not the timeline). */
  viewers?: number;
}

/** A feed-worthy happening derived from sealed MatchEvents. */
export interface EventCue {
  id: string;
  matchSecond: number;
  kind: string;
  teamId?: TeamId;
  text: string;
  /** 0..1 — drives feed emphasis and crowd/HUD treatment. */
  importance: number;
}

export type CameraMode = "broadcast_wide" | "tactical_wide" | "goal_mouth" | "behind_goal" | "replay_close";

export interface ReplayCue {
  id: string;
  eventId: string;
  matchSecond: number;
  startSecond: number;
  endSecond: number;
  playbackSpeed: number;
  camera: CameraMode;
  label: string;
  /**
   * Seconds to hold past `matchSecond` before airing the replay — used to let
   * the live goal celebration play out first. Defaults to 0 (air immediately).
   */
  holdSeconds?: number;
}

export interface CameraCue {
  id: string;
  matchSecond: number;
  startSecond: number;
  endSecond: number;
  mode: CameraMode;
  focusPlayerIds: string[];
  priority: number;
}

export interface CommentaryCue {
  id: string;
  eventId?: string;
  matchSecond: number;
  layer?: "template" | "llm_color" | "llm_storyline";
  voice?: "play_by_play" | "color" | "stadium";
  text: string;
  intensity: number;
  audioUrl?: string;
}

export interface CrowdCue {
  id: string;
  matchSecond: number;
  intensity: number;
  texture: "anticipation" | "celebration" | "whistle" | "fulltime";
  durationSeconds: number;
}

export interface OverlayCue {
  id: string;
  matchSecond: number;
  kind: "score" | "replay" | "analytics" | "period";
  title: string;
  value: string;
  teamId?: TeamId;
}

export interface PresentationCues {
  replays: ReplayCue[];
  cameras: CameraCue[];
  commentary: CommentaryCue[];
  crowd: CrowdCue[];
  overlays: OverlayCue[];
}

export interface BroadcastQaIssue {
  code:
    | "segment_status"
    | "event_order"
    | "scorebug_mismatch"
    | "replay_event_missing"
    | "replay_window_invalid"
    | "camera_window_invalid"
    | "commentary_event_missing"
    | "overlay_event_missing"
    | "payload_frames"
    | "payload_second";
  severity: "error";
  message: string;
  segmentId?: string;
  eventId?: string;
  cueId?: string;
  second?: number;
}

export interface BroadcastQaReport {
  ok: boolean;
  matchId: string;
  checked: {
    segments: number;
    events: number;
    payloads: number;
    replays: number;
    cameras: number;
    commentary: number;
    crowd: number;
    overlays: number;
  };
  issues: BroadcastQaIssue[];
}

/** Everything that airs during one broadcast second. */
export interface SecondPayload {
  /** Virtual second this payload covers: [second, second + 1). */
  second: number;
  frames: MatchSegment["frames"][number][];
  cues: EventCue[];
  actions: ActionCue[];
  presentation: PresentationCues;
  scorebug: ScorebugState;
}

// ---------------------------------------------------------------------------
// Event feed cue derivation
// ---------------------------------------------------------------------------

/**
 * Loose view of a MatchEvent so the broadcast layer stays forward-compatible:
 * the domain may grow new event kinds; unknown kinds are ignored gracefully.
 */
type LooseEvent = { id: string; matchSecond: number; kind: string } & Record<string, unknown>;
type LooseFact = { id: string; matchSecond: number; kind: string } & Record<string, unknown>;

function formatMinute(matchSecond: number): string {
  return `${Math.floor(matchSecond / 60) + 1}'`;
}

function teamIdOf(raw: LooseEvent): TeamId | undefined {
  const value = raw["teamId"];
  return value === "home" || value === "away" ? value : undefined;
}

function teamIdValue(value: unknown): TeamId | undefined {
  return value === "home" || value === "away" ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function positionValue(value: unknown): Vec2 | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return typeof record["x"] === "number" && typeof record["z"] === "number"
    ? { x: record["x"], z: record["z"] }
    : undefined;
}

function firstString(values: unknown): string | undefined {
  return Array.isArray(values) && typeof values[0] === "string" ? values[0] : undefined;
}

function secondString(values: unknown): string | undefined {
  return Array.isArray(values) && typeof values[1] === "string" ? values[1] : undefined;
}

function decisionAt(
  decisions: readonly RuleDecision[],
  matchSecond: number,
  predicate: (decision: RuleDecision) => boolean,
): RuleDecision | undefined {
  return decisions.find((decision) => Math.abs(decision.matchTime - matchSecond) < 1e-6 && predicate(decision));
}

function restartLabel(restart: RuleDecision["restart"]): string {
  switch (restart) {
    case "kickoff":
      return "Kick-off";
    case "direct_free_kick":
      return "Free kick";
    case "indirect_free_kick":
      return "Indirect free kick";
    case "penalty_kick":
      return "Penalty";
    case "dropped_ball":
      return "Dropped ball";
    case "throw_in":
      return "Throw-in";
    case "goal_kick":
      return "Goal kick";
    case "corner_kick":
      return "Corner";
    default:
      return "Restart";
  }
}

function isNoGoalReview(decision: RuleDecision): boolean {
  return decision.law === "Law 10" && decision.reason.toLowerCase().startsWith("no goal");
}

function sanctionLabel(card: string): string {
  return card === "red" ? "Red card" : card === "yellow" ? "Yellow card" : "Card";
}

function sanctionText(sanction: NonNullable<RuleDecision["sanction"]>[number]): string {
  const suffix = sanction.reason ? ` — ${sanction.reason}` : "";
  return `${sanctionLabel(sanction.card)} to ${sanction.playerId}${suffix}`;
}

function decisionCueKind(decision: RuleDecision): string | undefined {
  if (isNoGoalReview(decision)) return "no_goal";
  if (decision.advantage === true) return "advantage";
  if (decision.law === "Law 11" && decision.restart === "indirect_free_kick") return "offside";
  if (decision.law === "Law 12" && decision.restart) return decision.restart;
  return decision.restart;
}

function decisionText(decision: RuleDecision, teams: TeamPair): string {
  const minute = formatMinute(decision.matchTime);
  const team = decision.team ? teams[decision.team].shortName : "Team";
  if (isNoGoalReview(decision)) {
    const restart = decision.restart ? ` — ${restartLabel(decision.restart).toLowerCase()} for ${team}` : "";
    return `${minute} No goal — review complete${restart}`;
  }
  if (decision.advantage === true) {
    return `${minute} Advantage played for ${team}`;
  }
  if (decision.law === "Law 11" && decision.restart === "indirect_free_kick") {
    const player = decision.affectedPlayers[0] ? ` — ${decision.affectedPlayers[0]}` : "";
    return `${minute} Offside — indirect free kick for ${team}${player}`;
  }
  if (decision.law === "Law 12" && decision.restart) {
    const offender = decision.affectedPlayers[0] ? ` after ${decision.affectedPlayers[0]}` : "";
    const card = decision.sanction?.[0] ? ` — ${sanctionLabel(decision.sanction[0].card)} to ${decision.sanction[0].playerId}` : "";
    return `${minute} Foul — ${restartLabel(decision.restart).toLowerCase()} for ${team}${offender}${card}`;
  }
  if (!decision.restart) return `${minute} ${decision.reason}`;
  return `${minute} ${restartLabel(decision.restart)} for ${team}`;
}

function decisionImportance(decision: RuleDecision): number {
  if (isNoGoalReview(decision)) return 0.9;
  if (decision.sanction?.some((sanction) => sanction.card === "red")) return 0.95;
  if (decision.sanction?.some((sanction) => sanction.card === "yellow")) return 0.82;
  if (decision.advantage === true) return 0.58;
  if (decision.law === "Law 11") return 0.72;
  if (decision.restart === "penalty_kick") return 0.95;
  if (decision.law === "Law 12") return 0.74;
  if (decision.restart === "corner_kick") return 0.62;
  if (decision.restart === "goal_kick") return 0.42;
  if (decision.restart === "throw_in") return 0.38;
  return decision.restart ? 0.5 : 0.35;
}

function shouldReplayDecision(decision: RuleDecision): boolean {
  return (
    isNoGoalReview(decision) ||
    (decision.law === "Law 11" && decision.restart === "indirect_free_kick") ||
    (decision.law === "Law 12" && decision.advantage !== true) ||
    decision.restart === "penalty_kick" ||
    decision.restart === "corner_kick"
  );
}

function decisionReplayLabel(decision: RuleDecision, teams: TeamPair): string {
  const team = decision.team ? teams[decision.team].shortName : "Team";
  if (isNoGoalReview(decision)) return `No goal review — ${team}`;
  if (decision.law === "Law 11") return "Offside replay";
  if (decision.restart === "penalty_kick") return `Penalty replay — ${team}`;
  if (decision.law === "Law 12") return `Foul replay — ${team}`;
  if (decision.restart === "corner_kick") return `Corner replay — ${team}`;
  return `${restartLabel(decision.restart)} replay`;
}

/**
 * Derive feed cues from sealed events. Meaningful kinds only — routine
 * pass_completed / possession_change events are far too noisy for the feed.
 * Unknown event kinds (the domain grows additively) are silently skipped.
 */
export function deriveEventCues(
  events: readonly MatchEvent[],
  teams: TeamPair,
  ruleDecisions: readonly RuleDecision[] = [],
): EventCue[] {
  const cues: EventCue[] = [];
  for (const raw of events as readonly LooseEvent[]) {
    const minute = formatMinute(raw.matchSecond);
    const teamId = teamIdOf(raw);
    const team = teamId ? teams[teamId].shortName : "";
    switch (raw.kind) {
      case "kickoff":
        cues.push({
          id: raw.id,
          matchSecond: raw.matchSecond,
          kind: raw.kind,
          ...(teamId ? { teamId } : {}),
          text: `${minute} Kickoff — ${team} get us underway`,
          importance: 0.6,
        });
        break;
      case "goal": {
        const scorer = typeof raw["scorerId"] === "string" ? raw["scorerId"] : "unknown";
        cues.push({
          id: raw.id,
          matchSecond: raw.matchSecond,
          kind: raw.kind,
          ...(teamId ? { teamId } : {}),
          text: `${minute} GOAL! ${team} — ${scorer} finds the net`,
          importance: 1,
        });
        break;
      }
      case "period_end": {
        const period = raw["period"];
        const label =
          period === "first_half"
            ? "Halftime"
            : period === "second_half" || period === "full_time"
              ? "Full time"
              : "End of period";
        cues.push({
          id: raw.id,
          matchSecond: raw.matchSecond,
          kind: raw.kind,
          text: `${minute} ${label}`,
          importance: 0.8,
        });
        break;
      }
      // Known-noisy kinds: never feed-worthy.
      case "pass_completed":
      case "possession_change":
        break;
      // Unknown kinds from future domain extensions: ignore gracefully.
      default:
        break;
    }
  }
  for (const decision of ruleDecisions) {
    const kind = decisionCueKind(decision);
    if (kind) {
      cues.push({
        id: decision.id,
        matchSecond: decision.matchTime,
        kind,
        ...(decision.team ? { teamId: decision.team } : {}),
        text: decisionText(decision, teams),
        importance: decisionImportance(decision),
      });
    }
    for (const [index, sanction] of (decision.sanction ?? []).entries()) {
      cues.push({
        id: `${decision.id}-sanction-${index}`,
        matchSecond: decision.matchTime,
        kind: `${sanction.card}_card`,
        text: `${formatMinute(decision.matchTime)} ${sanctionText(sanction)}`,
        importance: sanction.card === "red" ? 0.95 : 0.82,
      });
    }
  }
  return cues.sort((a, b) => a.matchSecond - b.matchSecond);
}

const MAX_ACTIONS_PER_SECOND = 24;
const DROPPABLE_ACTIONS = new Set<ActionCue["kind"]>(["contact", "kick"]);
const PLAY_BY_PLAY_WINDOW_SECONDS = 4;
const RECENT_PLAY_BY_PLAY_LINES = 8;

function capActionCues(actions: ActionCue[]): ActionCue[] {
  if (actions.length <= MAX_ACTIONS_PER_SECOND) return actions;
  const capped = actions.filter((action) => !DROPPABLE_ACTIONS.has(action.kind));
  if (capped.length >= MAX_ACTIONS_PER_SECOND) return capped;
  for (const kind of ["kick", "contact"] as const) {
    for (const action of actions) {
      if (capped.length >= MAX_ACTIONS_PER_SECOND) break;
      if (action.kind === kind) capped.push(action);
    }
  }
  return capped;
}

function sortActions(actions: ActionCue[]): ActionCue[] {
  return actions.sort((a, b) => a.t - b.t || actionRank(a.kind) - actionRank(b.kind));
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1);
}

function actionPlayer(action: ActionCue, fallback: string): string {
  return action.playerId ?? fallback;
}

function actionRecipient(action: ActionCue): string | undefined {
  return action.secondaryId;
}

function attackingX(teamId: TeamId | undefined, x: number): number {
  return teamId === "away" ? -x : x;
}

function isWide(position: Vec2 | undefined): boolean {
  return position !== undefined && Math.abs(position.z) >= 20;
}

function isCentral(position: Vec2 | undefined): boolean {
  return position !== undefined && Math.abs(position.z) <= 10;
}

function inFinalThird(action: ActionCue): boolean {
  const position = actionTargetPosition(action) ?? action.position;
  if (!position) return false;
  return attackingX(action.teamId, position.x) >= 24;
}

function actionTargetPosition(action: ActionCue): Vec2 | undefined {
  const x = action.flags?.["targetX"];
  const z = action.flags?.["targetZ"];
  return typeof x === "number" && typeof z === "number" ? { x, z } : undefined;
}

function completedPasses(actions: readonly ActionCue[]): ActionCue[] {
  return actions.filter(
    (action) => action.kind === "kick" && action.flags?.["source"] === "pass" && action.flags?.["completed"] !== false,
  );
}

function incompletePasses(actions: readonly ActionCue[]): ActionCue[] {
  return actions.filter(
    (action) => action.kind === "kick" && action.flags?.["source"] === "pass" && action.flags?.["completed"] === false,
  );
}

function shotActions(actions: readonly ActionCue[]): ActionCue[] {
  return actions.filter((action) => action.kind === "kick" && action.flags?.["source"] === "shot");
}

function chooseLine(candidates: readonly string[], seed: string, recentTexts: ReadonlySet<string>): string {
  const start = hashString(seed) % candidates.length;
  for (let offset = 0; offset < candidates.length; offset++) {
    const candidate = candidates[(start + offset) % candidates.length]!;
    if (!recentTexts.has(candidate.toLowerCase())) return candidate;
  }
  return candidates[start]!;
}

function describeShot(action: ActionCue, save: ActionCue | undefined, assistPass: ActionCue | undefined): string[] {
  const shooter = actionPlayer(action, "the attacker");
  const onTarget = action.flags?.["onTarget"] === true;
  const highValue = typeof action.flags?.["xg"] === "number" && action.flags["xg"] >= 0.25;
  const passer = assistPass ? actionPlayer(assistPass, "the passer") : undefined;
  const suppliedBy = passer ? `${passer} sets up ${shooter}, and ` : "";
  if (save) {
    const keeper = actionPlayer(save, "the keeper");
    return save.flags?.["held"] === true
      ? [
          `${suppliedBy}${shooter} strikes it, but ${keeper} gathers cleanly.`,
          `${suppliedBy}${shooter} tests the keeper, and ${keeper} holds on.`,
          `${suppliedBy}${shooter} gets the shot away, straight into ${keeper}'s gloves.`,
        ]
      : [
          `${suppliedBy}${shooter} lets fly and ${keeper} has to push it away.`,
          `${suppliedBy}${shooter} drives it through traffic, saved by ${keeper}.`,
          `${keeper} reacts sharply to deny ${shooter} after the pass from ${passer ?? "the midfield"}.`,
        ];
  }
  if (!onTarget) {
    return highValue
      ? [
          `${suppliedBy}${shooter} has a real sight of goal and sends it wide.`,
          `${suppliedBy}${shooter} should hit the target from there, but it drifts away.`,
          `${suppliedBy}${shooter} opens up the angle and misses the chance.`,
        ]
      : [
          `${suppliedBy}${shooter} takes it on, but it is never troubling the keeper.`,
          `${suppliedBy}${shooter} tries his luck and pulls it away from goal.`,
          `${suppliedBy}${shooter} goes for goal, but the effort is off target.`,
        ];
  }
  return highValue
    ? [
        `${suppliedBy}${shooter} works the opening and hits the target.`,
        `${suppliedBy}${shooter} gets the chance away and makes the keeper deal with it.`,
        `${suppliedBy}${shooter} finds space in the box and gets the shot on goal.`,
      ]
    : [
        `${suppliedBy}${shooter} takes the shot on and keeps it on target.`,
        `${suppliedBy}${shooter} gets it out of his feet and shoots.`,
        `${suppliedBy}${shooter} sends one goalward.`,
      ];
}

function describePassingSequence(actions: readonly ActionCue[]): string[] {
  const passes = completedPasses(actions);
  const last = passes.at(-1);
  const first = passes[0];
  if (!last) return [];

  const passer = actionPlayer(last, "the passer");
  const receiver = actionRecipient(last);
  const lead = receiver ? `${passer} into ${receiver}` : `${passer} keeps it moving`;
  const lastTarget = actionTargetPosition(last) ?? last.position;
  const firstX = first?.position ? attackingX(first.teamId, first.position.x) : undefined;
  const lastX = lastTarget ? attackingX(last.teamId, lastTarget.x) : undefined;
  const progress = firstX !== undefined && lastX !== undefined ? lastX - firstX : 0;
  const wide = isWide(lastTarget);
  const central = isCentral(lastTarget);

  if (passes.length >= 3 && progress >= 18) {
    return [
      `That is a sharp passing move, ${lead}, and the attack is gathering speed.`,
      `They play through the pressure neatly, ${lead}, and suddenly there is space ahead.`,
      `The move has real rhythm now, ${lead}, with runners joining around him.`,
    ];
  }
  if (wide && progress >= 10) {
    return [
      `${passer} works it out wide${receiver ? ` for ${receiver}` : ""}, stretching the back line.`,
      `They shift the ball to the flank through ${passer}${receiver ? ` and ${receiver}` : ""}.`,
      `${passer} finds the wide option${receiver ? ` in ${receiver}` : ""}, and the pitch opens up.`,
    ];
  }
  if (central && inFinalThird(last)) {
    return [
      `${lead} between the lines, and that is a dangerous pocket.`,
      `${passer} punches the pass inside${receiver ? ` to ${receiver}` : ""}.`,
      `A clever central pass from ${passer}${receiver ? ` into ${receiver}` : ""}, right where it hurts.`,
    ];
  }
  if (passes.length >= 2) {
    return [
      `They keep the ball moving, ${lead}.`,
      `Patient possession here, with ${lead}.`,
      `${passer} recycles it cleanly${receiver ? ` through ${receiver}` : ""}.`,
    ];
  }
  return receiver
    ? [
        `${passer} finds ${receiver}.`,
        `${passer} feeds it into ${receiver}.`,
        `${passer} moves it on to ${receiver}.`,
      ]
    : [`${passer} keeps possession ticking over.`, `${passer} plays the simple ball.`, `${passer} moves it on quickly.`];
}

function describeTurnover(action: ActionCue): string[] {
  const passer = actionPlayer(action, "the passer");
  return [
    `${passer} tries to force the pass and it is cut out.`,
    `${passer} gives it away under pressure.`,
    `${passer} looks for the forward ball, but the lane closes.`,
    `The pass from ${passer} will not get through.`,
  ];
}

function describeDuel(action: ActionCue): string[] {
  const winner = actionPlayer(action, "the defender");
  const loser = actionRecipient(action);
  return loser
    ? [
        `${winner} steps in on ${loser} and wins it cleanly.`,
        `${winner} gets tight to ${loser} and comes away with the ball.`,
        `${winner} times the challenge on ${loser}.`,
      ]
    : [
        `${winner} wins the challenge.`,
        `${winner} comes away with it in midfield.`,
        `${winner} steps in strongly.`,
      ];
}

function describePlayByPlay(actions: readonly ActionCue[], windowStart: number, recentTexts: ReadonlySet<string>): string | undefined {
  const sorted = [...actions].sort((a, b) => a.t - b.t);
  const save = sorted.find((action) => action.kind === "save");
  const shot = shotActions(sorted).at(-1);
  const turnover = incompletePasses(sorted).at(-1);
  const duel = sorted.find((action) => action.kind === "duel");
  const passes = completedPasses(sorted);

  let candidates: string[] = [];
  let seedKey = "";
  if (shot) {
    const assistPass = completedPasses(sorted)
      .filter((action) => action.t <= shot.t && action.secondaryId === shot.playerId)
      .at(-1);
    candidates = describeShot(shot, save, assistPass);
    seedKey = `shot:${shot.playerId ?? ""}:${shot.t}`;
  } else if (save) {
    const keeper = actionPlayer(save, "the keeper");
    candidates =
      save.flags?.["held"] === true
        ? [`${keeper} gathers it and slows everything down.`, `${keeper} takes it securely.`, `${keeper} claims it without a rebound.`]
        : [`${keeper} pushes it away from danger.`, `${keeper} gets a strong hand to it.`, `${keeper} parries it clear.`];
    seedKey = `save:${save.playerId ?? ""}:${save.t}`;
  } else if (turnover) {
    candidates = describeTurnover(turnover);
    seedKey = `turnover:${turnover.playerId ?? ""}:${turnover.t}`;
  } else if (duel) {
    candidates = describeDuel(duel);
    seedKey = `duel:${duel.playerId ?? ""}:${duel.t}`;
  } else if (passes.length > 0) {
    candidates = describePassingSequence(sorted);
    seedKey = `pass:${passes.map((action) => `${action.playerId ?? ""}:${action.secondaryId ?? ""}:${action.t}`).join("|")}`;
  }

  if (candidates.length === 0) return undefined;
  return chooseLine(candidates, `${windowStart}:${seedKey}`, recentTexts);
}

function playByPlayImportance(actions: readonly ActionCue[]): number {
  if (actions.some((action) => action.kind === "goal")) return 1;
  if (actions.some((action) => action.kind === "foul" || action.kind === "offside" || action.kind === "save")) return 0.82;
  if (actions.some((action) => action.kind === "duel" || action.kind === "contact")) return 0.58;
  if (actions.some((action) => action.kind === "kick" && action.flags?.["source"] === "shot")) return 0.76;
  return 0.48;
}

function derivePlayByPlayCommentary(
  windowStart: number,
  actions: readonly ActionCue[],
  recentTexts: readonly string[] = [],
): CommentaryCue[] {
  if (windowStart < 1 || Math.floor(windowStart) % PLAY_BY_PLAY_WINDOW_SECONDS !== 0) return [];
  const majorAction = actions.some((action) =>
    action.kind === "goal" ||
    action.kind === "foul" ||
    action.kind === "offside" ||
    action.kind === "restart",
  );
  if (majorAction) return [];

  const meaningful = actions
    .filter((action) => action.kind !== "contact" && action.kind !== "ball_out")
    .sort((a, b) => a.t - b.t);
  const playable = meaningful.filter((action) => action.kind === "kick" || action.kind === "duel" || action.kind === "save");
  if (playable.length === 0) return [];

  const text = describePlayByPlay(playable, windowStart, new Set(recentTexts.map((recent) => recent.toLowerCase())));
  if (!text) return [];
  return [
    {
      id: `pbp-${Math.floor(windowStart).toString().padStart(4, "0")}`,
      matchSecond: windowStart + 0.15,
      layer: "template",
      voice: "play_by_play",
      text: capitalize(text),
      intensity: playByPlayImportance(playable),
    },
  ];
}

function applyCommentaryDisplayText(
  cue: CommentaryCue,
  playerDisplayNames: Readonly<Record<string, string>>,
  teams: TeamPair,
): CommentaryCue {
  let text = cue.text.replace(
    /\b(?:real-madrid|barcelona|home|away)-\d+\b/gi,
    (id) => playerDisplayNames[id.toLowerCase()] ?? id,
  );
  text = text
    .replace(new RegExp(`\\b${escapeRegExp(teams.home.shortName)}\\b`, "g"), spokenTeamName(teams.home))
    .replace(new RegExp(`\\b${escapeRegExp(teams.away.shortName)}\\b`, "g"), spokenTeamName(teams.away));
  return text === cue.text ? cue : { ...cue, text };
}

function spokenTeamName(team: TeamPresentation): string {
  if (team.clubId === "barcelona") return "Barcelona";
  if (team.clubId === "real-madrid") return "Real Madrid";
  return team.name.replace(/\b(?:FC|CF)\b/g, "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function actionRank(kind: ActionCue["kind"]): number {
  switch (kind) {
    case "goal":
      return 0;
    case "save":
      return 1;
    case "duel":
      return 2;
    case "foul":
      return 3;
    case "offside":
      return 4;
    case "ball_out":
      return 5;
    case "restart":
      return 6;
    case "kick":
      return 7;
    case "contact":
      return 8;
  }
}

/**
 * Derive animation-relevant player actions from sealed facts/events/decisions.
 * Unknown future kinds are ignored so the broadcast payload can grow safely.
 */
export function deriveActionCues(
  facts: readonly MatchFact[],
  events: readonly MatchEvent[] = [],
  ruleDecisions: readonly RuleDecision[] = [],
): ActionCue[] {
  const actions: ActionCue[] = [];

  for (const raw of facts as readonly LooseFact[]) {
    switch (raw.kind) {
      case "pass": {
        const target = positionValue(raw["target"]);
        const cue: ActionCue = {
          t: raw.matchSecond,
          kind: "kick",
          playerId: stringValue(raw["fromPlayerId"]),
          secondaryId: stringValue(raw["toPlayerId"]),
          teamId: teamIdValue(raw["teamId"]),
          position: positionValue(raw["origin"]),
          flags: {
            source: "pass",
            completed: booleanValue(raw["completed"]) ?? false,
            ...(target ? { targetX: target.x, targetZ: target.z } : {}),
          },
        };
        actions.push(cue);
        break;
      }
      case "shot": {
        const flags: NonNullable<ActionCue["flags"]> = {
          source: "shot",
          onTarget: booleanValue(raw["onTarget"]) ?? false,
        };
        const xg = numberValue(raw["xg"]);
        if (xg !== undefined) flags["xg"] = xg;
        actions.push({
          t: raw.matchSecond,
          kind: "kick",
          playerId: stringValue(raw["playerId"]),
          teamId: teamIdValue(raw["teamId"]),
          position: positionValue(raw["origin"]),
          flags,
        });
        break;
      }
      case "touch": {
        const restart = stringValue(raw["restart"]);
        actions.push({
          t: raw.matchSecond,
          kind: restart ? "restart" : "kick",
          playerId: stringValue(raw["playerId"]),
          teamId: teamIdValue(raw["teamId"]),
          position: positionValue(raw["position"]),
          flags: restart ? { restart } : { source: "touch" },
        });
        break;
      }
      case "save":
        actions.push({
          t: raw.matchSecond,
          kind: "save",
          playerId: stringValue(raw["keeperId"]),
          teamId: teamIdValue(raw["teamId"]),
          flags: {
            held: booleanValue(raw["held"]) ?? false,
            height: numberValue(raw["height"]) ?? 0,
          },
        });
        break;
      case "duel":
        actions.push({
          t: raw.matchSecond,
          kind: "duel",
          playerId: stringValue(raw["winnerId"]),
          secondaryId: stringValue(raw["loserId"]),
          position: positionValue(raw["position"]),
          flags: {
            source: stringValue(raw["source"]) ?? "unknown",
            actorId: stringValue(raw["actorId"]) ?? "",
          },
        });
        break;
      case "contact":
        actions.push({
          t: raw.matchSecond,
          kind: "contact",
          playerId: firstString(raw["players"]),
          secondaryId: secondString(raw["players"]),
          position: positionValue(raw["position"]),
          flags: {
            severity: stringValue(raw["severity"]) ?? "unknown",
            ballPlayable: booleanValue(raw["ballPlayable"]) ?? false,
          },
        });
        break;
      case "foul_candidate": {
        const decision = decisionAt(
          ruleDecisions,
          raw.matchSecond,
          (candidate) =>
            (candidate.law === "Law 12" || candidate.law === "Law 14") &&
            !!candidate.restart &&
            candidate.advantage !== true,
        );
        if (!decision) break;
        const flags: NonNullable<ActionCue["flags"]> = {
          offence: stringValue(raw["offence"]) ?? "unknown",
          severity: stringValue(raw["severity"]) ?? "unknown",
          tacticalImpact: stringValue(raw["tacticalImpact"]) ?? "unknown",
        };
        if (decision.restart) flags["restart"] = decision.restart;
        actions.push({
          t: decision.matchTime,
          kind: "foul",
          playerId: stringValue(raw["offenderId"]),
          secondaryId: stringValue(raw["victimId"]),
          teamId: teamIdValue(raw["offenderTeamId"]),
          position: positionValue(raw["position"]),
          flags,
        });
        break;
      }
      case "ball_out": {
        const decision = decisionAt(
          ruleDecisions,
          raw.matchSecond,
          (candidate) => !!candidate.restart && !candidate.goal,
        );
        const flags: NonNullable<ActionCue["flags"]> = {
          line: stringValue(raw["line"]) ?? "unknown",
          goalMouth: booleanValue(raw["goalMouth"]) ?? false,
        };
        if (decision?.restart) flags["restart"] = decision.restart;
        actions.push({
          t: raw.matchSecond,
          kind: "ball_out",
          playerId: stringValue(raw["lastTouchPlayerId"]),
          teamId: teamIdValue(raw["lastTouchTeamId"]),
          position: positionValue(raw["position"]),
          flags,
        });
        break;
      }
      default:
        break;
    }
  }

  for (const raw of events as readonly LooseEvent[]) {
    if (raw.kind !== "goal") continue;
    actions.push({
      t: raw.matchSecond,
      kind: "goal",
      playerId: stringValue(raw["scorerId"]),
      teamId: teamIdOf(raw),
    });
  }

  for (const decision of ruleDecisions) {
    if (decision.law !== "Law 11" || decision.restart !== "indirect_free_kick") continue;
    actions.push({
      t: decision.matchTime,
      kind: "offside",
      playerId: decision.affectedPlayers[0],
      secondaryId: decision.affectedPlayers[1],
      teamId: decision.team,
      position: decision.restartSpot,
      flags: { restart: decision.restart },
    });
  }

  for (const decision of ruleDecisions) {
    if (!decision.sanction?.length) continue;
    const alreadySurfaced = actions.some(
      (action) => action.kind === "foul" && Math.abs(action.t - decision.matchTime) < 1e-6,
    );
    if (alreadySurfaced) continue;
    const firstSanction = decision.sanction[0]!;
    const flags: NonNullable<ActionCue["flags"]> = {
      card: firstSanction.card,
      sanctionReason: firstSanction.reason,
    };
    if (decision.restart) flags["restart"] = decision.restart;
    actions.push({
      t: decision.matchTime,
      kind: "foul",
      playerId: firstSanction.playerId,
      secondaryId: decision.affectedPlayers.find((playerId) => playerId !== firstSanction.playerId),
      position: decision.restartSpot,
      flags,
    });
  }

  return sortActions(capActionCues(sortActions(actions)));
}

export interface PresentationCueOptions {
  generatedCommentary?: readonly CommentaryCue[] | undefined;
}

/**
 * Hold the live picture on the scorer's celebration before cutting to the goal
 * replay — otherwise the replay covers the entire celebration and viewers never
 * see the wheel-away. Sized to outlast the client celebration animation.
 */
const GOAL_CELEBRATION_DWELL_SECONDS = 4;

export function derivePresentationCues(
  events: readonly MatchEvent[],
  teams: TeamPair,
  ruleDecisionsOrOptions: readonly RuleDecision[] | PresentationCueOptions = [],
  options: PresentationCueOptions = {},
): PresentationCues {
  const decisionListArg = Array.isArray(ruleDecisionsOrOptions);
  const ruleDecisions: readonly RuleDecision[] = decisionListArg
    ? (ruleDecisionsOrOptions as readonly RuleDecision[])
    : [];
  const cueOptions: PresentationCueOptions = decisionListArg
    ? options
    : (ruleDecisionsOrOptions as PresentationCueOptions);
  const replays: ReplayCue[] = [];
  const cameras: CameraCue[] = [];
  const commentary: CommentaryCue[] = [];
  const crowd: CrowdCue[] = [];
  const overlays: OverlayCue[] = [];

  for (const raw of events as readonly LooseEvent[]) {
    const teamId = teamIdOf(raw);
    const team = teamId ? teams[teamId].shortName : undefined;
    switch (raw.kind) {
      case "goal": {
        const scorer = typeof raw["scorerId"] === "string" ? raw["scorerId"] : "unknown";
        replays.push({
          id: `${raw.id}-replay`,
          eventId: raw.id,
          matchSecond: raw.matchSecond,
          startSecond: Math.max(0, raw.matchSecond - 6),
          // End while the ball is still shown nestled in the goal (the engine's
          // ~1.2s goal-display hold), NOT 3s later when the sim has reset to the
          // centre spot and play has resumed — otherwise the "replay" shows live
          // midfield play instead of the goal.
          endSecond: raw.matchSecond + 1,
          playbackSpeed: 0.55,
          camera: "replay_close",
          label: `Goal replay — ${team ?? "team"}`,
          // Hold the live celebration before cutting to the replay.
          holdSeconds: GOAL_CELEBRATION_DWELL_SECONDS,
        });
        cameras.push({
          id: `${raw.id}-camera`,
          matchSecond: raw.matchSecond,
          startSecond: Math.max(0, raw.matchSecond - 2),
          endSecond: raw.matchSecond + 4,
          mode: "goal_mouth",
          focusPlayerIds: [scorer],
          priority: 1,
        });
        commentary.push({
          id: `${raw.id}-commentary`,
          eventId: raw.id,
          matchSecond: raw.matchSecond,
          layer: "template",
          voice: "play_by_play",
          text: `${team ?? "A team"} score through ${scorer}.`,
          intensity: 1,
        });
        crowd.push({
          id: `${raw.id}-crowd`,
          matchSecond: raw.matchSecond,
          intensity: 1,
          texture: "celebration",
          durationSeconds: 8,
        });
        overlays.push({
          id: `${raw.id}-overlay`,
          matchSecond: raw.matchSecond,
          kind: "score",
          title: "Goal",
          value: `${team ?? "Team"} — ${scorer}`,
          ...(teamId ? { teamId } : {}),
        });
        break;
      }
      case "kickoff":
        cameras.push({
          id: `${raw.id}-camera`,
          matchSecond: raw.matchSecond,
          startSecond: raw.matchSecond,
          endSecond: raw.matchSecond + 5,
          mode: "broadcast_wide",
          focusPlayerIds: [],
          priority: 0.4,
        });
        commentary.push({
          id: `${raw.id}-commentary`,
          eventId: raw.id,
          matchSecond: raw.matchSecond,
          layer: "template",
          voice: "play_by_play",
          text: `${team ?? "The side"} get the match underway.`,
          intensity: 0.45,
        });
        crowd.push({
          id: `${raw.id}-crowd`,
          matchSecond: raw.matchSecond,
          intensity: 0.48,
          texture: "anticipation",
          durationSeconds: 5,
        });
        break;
      case "period_end": {
        const period = raw["period"];
        const value = period === "first_half" ? "Halftime" : "Full time";
        overlays.push({
          id: `${raw.id}-overlay`,
          matchSecond: raw.matchSecond,
          kind: "period",
          title: value,
          value,
        });
        cameras.push({
          id: `${raw.id}-camera`,
          matchSecond: raw.matchSecond,
          startSecond: raw.matchSecond,
          endSecond: raw.matchSecond + 4,
          mode: "tactical_wide",
          focusPlayerIds: [],
          priority: 0.7,
        });
        commentary.push({
          id: `${raw.id}-commentary`,
          eventId: raw.id,
          matchSecond: raw.matchSecond,
          layer: "template",
          voice: "play_by_play",
          text: value,
          intensity: 0.7,
        });
        crowd.push({
          id: `${raw.id}-crowd`,
          matchSecond: raw.matchSecond,
          intensity: period === "first_half" ? 0.55 : 0.75,
          texture: period === "first_half" ? "whistle" : "fulltime",
          durationSeconds: 6,
        });
        break;
      }
      default:
        break;
    }
  }
  for (const decision of ruleDecisions) {
    const kind = decisionCueKind(decision);
    if (!kind) continue;
    const importance = decisionImportance(decision);
    if (shouldReplayDecision(decision)) {
      replays.push({
        id: `${decision.id}-replay`,
        eventId: decision.id,
        matchSecond: decision.matchTime,
        startSecond: Math.max(0, decision.matchTime - (decision.law === "Law 11" ? 5 : 4)),
        endSecond: decision.matchTime + 2,
        playbackSpeed: decision.restart === "corner_kick" ? 0.7 : 0.6,
        camera: decision.restart === "corner_kick" ? "goal_mouth" : "replay_close",
        label: decisionReplayLabel(decision, teams),
      });
    }
    cameras.push({
      id: `${decision.id}-camera`,
      matchSecond: decision.matchTime,
      startSecond: decision.matchTime,
      endSecond: decision.matchTime + (importance >= 0.7 ? 5 : 3),
      mode:
        isNoGoalReview(decision) || decision.restart === "corner_kick" || decision.restart === "penalty_kick"
          ? "goal_mouth"
          : "tactical_wide",
      focusPlayerIds: decision.affectedPlayers,
      priority: importance,
    });
    commentary.push({
      id: `${decision.id}-commentary`,
      eventId: decision.id,
      matchSecond: decision.matchTime,
      layer: "template",
      voice: "play_by_play",
      text: decisionText(decision, teams).replace(/^(\d+\+\d+|\d+)' /, ""),
      intensity: importance,
    });
    crowd.push({
      id: `${decision.id}-crowd`,
      matchSecond: decision.matchTime,
      intensity: importance,
      texture: importance >= 0.7 ? "whistle" : "anticipation",
      durationSeconds: importance >= 0.7 ? 5 : 3,
    });
    if (isNoGoalReview(decision)) {
      overlays.push({
        id: `${decision.id}-overlay`,
        matchSecond: decision.matchTime,
        kind: "replay",
        title: "No goal",
        value: decision.restart
          ? `Review complete — ${restartLabel(decision.restart).toLowerCase()} for ${
              decision.team ? teams[decision.team].shortName : "Team"
            }`
          : "Review complete",
        ...(decision.team ? { teamId: decision.team } : {}),
      });
    }
    if (decision.advantage === true) {
      overlays.push({
        id: `${decision.id}-advantage`,
        matchSecond: decision.matchTime,
        kind: "analytics",
        title: "Advantage",
        value: decision.team ? teams[decision.team].shortName : "Played",
        ...(decision.team ? { teamId: decision.team } : {}),
      });
    }
    for (const [index, sanction] of (decision.sanction ?? []).entries()) {
      const cardImportance = sanction.card === "red" ? 0.95 : 0.82;
      commentary.push({
        id: `${decision.id}-sanction-${index}-commentary`,
        eventId: decision.id,
        matchSecond: decision.matchTime,
        layer: "template",
        voice: "play_by_play",
        text: sanctionText(sanction),
        intensity: cardImportance,
      });
      overlays.push({
        id: `${decision.id}-card-${index}`,
        matchSecond: decision.matchTime,
        kind: "analytics",
        title: sanctionLabel(sanction.card),
        value: sanction.playerId,
      });
    }
  }

  const currentEventIds = eventIds(events);
  for (const generated of cueOptions.generatedCommentary ?? []) {
    const eventId = generated.eventId ?? referencedEventId(generated.id);
    if (!eventId || !currentEventIds.has(eventId)) continue;
    commentary.push(generated);
  }

  const bySecond = <T extends { matchSecond: number }>(a: T, b: T) => a.matchSecond - b.matchSecond;
  return {
    replays: replays.sort(bySecond),
    cameras: cameras.sort(bySecond),
    commentary: commentary.sort(bySecond),
    crowd: crowd.sort(bySecond),
    overlays: overlays.sort(bySecond),
  };
}

function addIssue(issues: BroadcastQaIssue[], issue: BroadcastQaIssue): void {
  issues.push(issue);
}

function eventIds(events: readonly MatchEvent[]): Set<string> {
  return new Set(events.map((event) => event.id));
}

function presentationAnchorIds(events: readonly MatchEvent[], ruleDecisions: readonly RuleDecision[] = []): Set<string> {
  return new Set([...events.map((event) => event.id), ...ruleDecisions.map((decision) => decision.id)]);
}

function referencedEventId(cueId: string): string | undefined {
  return /^(.*)-(?:commentary|overlay)$/.exec(cueId)?.[1];
}

export function auditPresentationCues(input: {
  events: readonly MatchEvent[];
  ruleDecisions?: readonly RuleDecision[];
  presentation: PresentationCues;
  matchLengthSeconds: number;
}): BroadcastQaIssue[] {
  const issues: BroadcastQaIssue[] = [];
  const ids = presentationAnchorIds(input.events, input.ruleDecisions ?? []);

  for (const replay of input.presentation.replays) {
    if (!ids.has(replay.eventId)) {
      addIssue(issues, {
        code: "replay_event_missing",
        severity: "error",
        message: `replay ${replay.id} references missing event or decision ${replay.eventId}`,
        cueId: replay.id,
        eventId: replay.eventId,
      });
    }
    if (
      replay.startSecond < 0 ||
      replay.endSecond <= replay.startSecond ||
      replay.matchSecond < replay.startSecond ||
      replay.matchSecond > replay.endSecond ||
      replay.endSecond > input.matchLengthSeconds + 10
    ) {
      addIssue(issues, {
        code: "replay_window_invalid",
        severity: "error",
        message: `replay ${replay.id} has invalid window ${replay.startSecond}-${replay.endSecond}`,
        cueId: replay.id,
        eventId: replay.eventId,
      });
    }
  }

  for (const camera of input.presentation.cameras) {
    if (
      camera.startSecond < 0 ||
      camera.endSecond <= camera.startSecond ||
      camera.matchSecond < camera.startSecond ||
      camera.matchSecond > camera.endSecond ||
      camera.endSecond > input.matchLengthSeconds + 10
    ) {
      addIssue(issues, {
        code: "camera_window_invalid",
        severity: "error",
        message: `camera ${camera.id} has invalid window ${camera.startSecond}-${camera.endSecond}`,
        cueId: camera.id,
      });
    }
  }

  for (const commentary of input.presentation.commentary) {
    const id = commentary.eventId ?? referencedEventId(commentary.id);
    if (id && !ids.has(id)) {
      addIssue(issues, {
        code: "commentary_event_missing",
        severity: "error",
        message: `commentary ${commentary.id} references missing event or decision ${id}`,
        cueId: commentary.id,
        eventId: id,
      });
    }
  }

  for (const overlay of input.presentation.overlays) {
    const id = referencedEventId(overlay.id);
    if (id && !ids.has(id)) {
      addIssue(issues, {
        code: "overlay_event_missing",
        severity: "error",
        message: `overlay ${overlay.id} references missing event or decision ${id}`,
        cueId: overlay.id,
        eventId: id,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Score + scorebug derivation from sealed events
// ---------------------------------------------------------------------------

/** Score after airing all events strictly before `broadcastSecond`. */
export function deriveScore(events: readonly MatchEvent[], broadcastSecond: number): ScoreState {
  const score: ScoreState = { home: 0, away: 0 };
  for (const event of events) {
    if (event.kind === "goal" && event.matchSecond < broadcastSecond) {
      score[event.teamId]++;
    }
  }
  return score;
}

export function formatClock(broadcastSecond: number): string {
  const total = Math.max(0, Math.floor(broadcastSecond));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export interface ScorebugInput {
  teams: TeamPair;
  events: readonly MatchEvent[];
  broadcastSecond: number;
  matchLengthSeconds: number;
}

export function deriveScorebug(input: ScorebugInput): ScorebugState {
  const { teams, events, broadcastSecond, matchLengthSeconds } = input;
  const score = deriveScore(events, broadcastSecond);
  const finished = broadcastSecond >= matchLengthSeconds;
  const phase: ScorebugState["phase"] = finished
    ? "FT"
    : broadcastSecond < matchLengthSeconds / 2
      ? "1H"
      : "2H";
  return {
    home: { ...teams.home, score: score.home },
    away: { ...teams.away, score: score.away },
    clock: formatClock(Math.min(broadcastSecond, matchLengthSeconds)),
    phase,
    status: finished ? "FT" : broadcastSecond <= 0 ? "PRE" : "LIVE",
  };
}

// ---------------------------------------------------------------------------
// Broadcast timeline
// ---------------------------------------------------------------------------

const AIRABLE = new Set<MatchSegment["status"]>(["sealed", "broadcasting", "aired"]);

export interface BroadcastTimelineOptions {
  matchId: string;
  /** Sealed-truth provider (e.g. SegmentStore#list bound to the match). */
  segments: () => readonly MatchSegment[];
  matchLengthSeconds: number;
  teams: TeamPair;
  /** Player id/alias -> commentary display name. */
  playerDisplayNames?: Readonly<Record<string, string>>;
  /** Optional pre-generated LLM commentary over sealed events. */
  generatedCommentary?: () => readonly CommentaryCue[];
  /** Broadcast clock start (late-start broadcasts). Default 0. */
  startSecond?: number;
}

/**
 * The shared broadcast clock over sealed segments.
 *
 * One timeline instance per match per server — every viewer reads the same
 * clock, score, and cue stream. `advance()` airs exactly one virtual second
 * and refuses to move past sealed truth (returns undefined instead).
 */
export class BroadcastTimeline {
  readonly matchId: string;
  readonly matchLengthSeconds: number;
  readonly teams: TeamPair;
  private second: number;
  private readonly provider: () => readonly MatchSegment[];
  private readonly commentaryProvider: () => readonly CommentaryCue[];
  private readonly playerDisplayNames: Readonly<Record<string, string>>;
  private readonly recentPlayByPlayTexts: string[] = [];

  constructor(options: BroadcastTimelineOptions) {
    this.matchId = options.matchId;
    this.matchLengthSeconds = options.matchLengthSeconds;
    this.teams = options.teams;
    this.second = options.startSecond ?? 0;
    this.provider = options.segments;
    this.commentaryProvider = options.generatedCommentary ?? (() => []);
    this.playerDisplayNames = options.playerDisplayNames ?? {};
  }

  /** Current broadcast second (the next second to air). */
  get broadcastSecond(): number {
    return this.second;
  }

  get state(): BroadcastState {
    if (this.second <= 0) return "pre_match";
    if (this.second >= this.matchLengthSeconds) return "fulltime";
    return "live_play";
  }

  private airableSegments(): MatchSegment[] {
    return this.provider()
      .filter((s) => s.matchId === this.matchId && AIRABLE.has(s.status))
      .sort((a, b) => a.index - b.index);
  }

  /** End of contiguous sealed truth starting from second 0. */
  sealedEndSecond(): number {
    let end = 0;
    for (const segment of this.airableSegments()) {
      if (segment.startSecond > end + 1e-9) break; // gap — cannot air past it
      end = Math.max(end, segment.endSecond);
    }
    return end;
  }

  /** Sealed truth ahead of the broadcast clock (broadcast lag). */
  get bufferSeconds(): number {
    return Math.max(0, this.sealedEndSecond() - this.second);
  }

  /** Segment covering the current broadcast second, if any. */
  activeSegment(): MatchSegment | undefined {
    const probe = Math.min(this.second, this.matchLengthSeconds - 1e-9);
    return this.airableSegments().find((s) => s.startSecond <= probe && probe < s.endSecond);
  }

  /** All sealed events aired so far (matchSecond < broadcastSecond). */
  private airedEvents(): MatchEvent[] {
    return this.eventsBefore(this.second);
  }

  private eventsBefore(second: number): MatchEvent[] {
    const events: MatchEvent[] = [];
    for (const segment of this.airableSegments()) {
      if (segment.startSecond >= second) break;
      for (const event of segment.events) {
        if (event.matchSecond < second) events.push(event);
      }
    }
    return events;
  }

  score(): ScoreState {
    return deriveScore(this.airedEvents(), this.second);
  }

  scorebug(): ScorebugState {
    return deriveScorebug({
      teams: this.teams,
      events: this.airedEvents(),
      broadcastSecond: this.second,
      matchLengthSeconds: this.matchLengthSeconds,
    });
  }

  syncPacket(serverTime: number): BroadcastSyncPacket {
    return {
      matchId: this.matchId,
      broadcastSecond: this.second,
      activeSegmentId: this.activeSegment()?.id,
      serverTime,
      score: this.score(),
      state: this.state,
      bufferSeconds: this.bufferSeconds,
    };
  }

  /** True when the whole match has been aired. */
  get finished(): boolean {
    return this.second >= this.matchLengthSeconds;
  }

  /**
   * Air one broadcast second: the frames and cues in
   * [broadcastSecond, broadcastSecond + 1). Returns undefined when that second
   * is not fully covered by sealed truth (broadcast must wait — never
   * extrapolate) or when the match has finished.
   */
  advance(): SecondPayload | undefined {
    if (this.finished) return undefined;
    const payload = this.previewSecond(this.second);
    if (!payload) return undefined;
    this.second = this.second + 1;
    for (const cue of payload.presentation.commentary) {
      if (cue.id.startsWith("pbp-")) this.rememberPlayByPlay(cue.text);
    }
    return payload;
  }

  private rememberPlayByPlay(text: string): void {
    this.recentPlayByPlayTexts.unshift(text);
    this.recentPlayByPlayTexts.splice(RECENT_PLAY_BY_PLAY_LINES);
  }

  previewSecond(start: number): SecondPayload | undefined {
    if (start >= this.matchLengthSeconds) return undefined;
    const end = start + 1;
    if (this.sealedEndSecond() + 1e-9 < end) return undefined;

    const frames: SecondPayload["frames"] = [];
    const events: MatchEvent[] = [];
    const facts: MatchFact[] = [];
    const ruleDecisions: RuleDecision[] = [];
    const actionWindowEvents: MatchEvent[] = [];
    const actionWindowFacts: MatchFact[] = [];
    const actionWindowDecisions: RuleDecision[] = [];
    const actionWindowStart = Math.max(0, start - (PLAY_BY_PLAY_WINDOW_SECONDS - 1));
    for (const segment of this.airableSegments()) {
      if (segment.endSecond <= start || segment.startSecond >= end) continue;
      for (const frame of segment.frames) {
        if (frame.matchSecond >= start - 1e-9 && frame.matchSecond < end - 1e-9) {
          frames.push(frame);
        }
      }
      for (const event of segment.events) {
        if (event.matchSecond >= start && event.matchSecond < end) {
          events.push(event);
        }
      }
      for (const fact of segment.facts) {
        if (fact.matchSecond >= start && fact.matchSecond < end) {
          facts.push(fact);
        }
      }
      for (const decision of segment.ruleDecisions) {
        if (decision.matchTime >= start && decision.matchTime < end) {
          ruleDecisions.push(decision);
        }
      }
    }
    for (const segment of this.airableSegments()) {
      if (segment.endSecond <= actionWindowStart || segment.startSecond >= end) continue;
      for (const event of segment.events) {
        if (event.matchSecond >= actionWindowStart && event.matchSecond < end) {
          actionWindowEvents.push(event);
        }
      }
      for (const fact of segment.facts) {
        if (fact.matchSecond >= actionWindowStart && fact.matchSecond < end) {
          actionWindowFacts.push(fact);
        }
      }
      for (const decision of segment.ruleDecisions) {
        if (decision.matchTime >= actionWindowStart && decision.matchTime < end) {
          actionWindowDecisions.push(decision);
        }
      }
    }
    frames.sort((a, b) => a.matchSecond - b.matchSecond);
    const actions = deriveActionCues(facts, events, ruleDecisions);
    const actionWindow = deriveActionCues(actionWindowFacts, actionWindowEvents, actionWindowDecisions);
    const presentation = derivePresentationCues(events, this.teams, ruleDecisions, {
      generatedCommentary: this.commentaryProvider(),
    });
    presentation.commentary.push(...derivePlayByPlayCommentary(start, actionWindow, this.recentPlayByPlayTexts));
    presentation.commentary = presentation.commentary
      .map((cue) => applyCommentaryDisplayText(cue, this.playerDisplayNames, this.teams))
      .sort((a, b) => a.matchSecond - b.matchSecond);

    return {
      second: start,
      frames,
      cues: deriveEventCues(events, this.teams, ruleDecisions),
      actions,
      presentation,
      scorebug: deriveScorebug({
        teams: this.teams,
        events: this.eventsBefore(end),
        broadcastSecond: end,
        matchLengthSeconds: this.matchLengthSeconds,
      }),
    };
  }
}

export function auditBroadcast(input: {
  matchId: string;
  segments: readonly MatchSegment[];
  teams: TeamPair;
  matchLengthSeconds: number;
  generatedCommentary?: readonly CommentaryCue[];
  payloads?: readonly SecondPayload[];
}): BroadcastQaReport {
  const issues: BroadcastQaIssue[] = [];
  const segments = [...input.segments]
    .filter((segment) => segment.matchId === input.matchId)
    .sort((a, b) => a.index - b.index);
  const events: MatchEvent[] = [];
  const ruleDecisions: RuleDecision[] = [];
  let previousEvent: MatchEvent | undefined;

  for (const segment of segments) {
    if (!AIRABLE.has(segment.status)) {
      addIssue(issues, {
        code: "segment_status",
        severity: "error",
        message: `segment ${segment.id} is not airable`,
        segmentId: segment.id,
      });
    }
    for (const event of segment.events) {
      if (previousEvent && event.matchSecond < previousEvent.matchSecond) {
        addIssue(issues, {
          code: "event_order",
          severity: "error",
          message: `event ${event.id} is earlier than previous event ${previousEvent.id}`,
          eventId: event.id,
        });
      }
      previousEvent = event;
      events.push(event);
    }
    ruleDecisions.push(...segment.ruleDecisions);
  }
  events.sort((a, b) => a.matchSecond - b.matchSecond);
  ruleDecisions.sort((a, b) => a.matchTime - b.matchTime);

  const presentation = derivePresentationCues(events, input.teams, ruleDecisions, {
    generatedCommentary: input.generatedCommentary,
  });
  issues.push(
    ...auditPresentationCues({
      events,
      ruleDecisions,
      presentation,
      matchLengthSeconds: input.matchLengthSeconds,
    }),
  );

  for (const payload of input.payloads ?? []) {
    if (payload.second < 0 || payload.second >= input.matchLengthSeconds) {
      addIssue(issues, {
        code: "payload_second",
        severity: "error",
        message: `payload second ${payload.second} is outside match length`,
        second: payload.second,
      });
    }
    if (payload.frames.length === 0) {
      addIssue(issues, {
        code: "payload_frames",
        severity: "error",
        message: `payload second ${payload.second} has no frames`,
        second: payload.second,
      });
    }
    const expectedScore = deriveScore(events, payload.second + 1);
    if (payload.scorebug.home.score !== expectedScore.home || payload.scorebug.away.score !== expectedScore.away) {
      addIssue(issues, {
        code: "scorebug_mismatch",
        severity: "error",
        message:
          `payload second ${payload.second} scorebug is ` +
          `${payload.scorebug.home.score}-${payload.scorebug.away.score}, expected ${expectedScore.home}-${expectedScore.away}`,
        second: payload.second,
      });
    }
    issues.push(
      ...auditPresentationCues({
        events: events.filter((event) => event.matchSecond >= payload.second && event.matchSecond < payload.second + 1),
        ruleDecisions: ruleDecisions.filter(
          (decision) => decision.matchTime >= payload.second && decision.matchTime < payload.second + 1,
        ),
        presentation: payload.presentation,
        matchLengthSeconds: input.matchLengthSeconds,
      }),
    );
  }

  return {
    ok: issues.length === 0,
    matchId: input.matchId,
    checked: {
      segments: segments.length,
      events: events.length,
      payloads: input.payloads?.length ?? 0,
      replays: presentation.replays.length,
      cameras: presentation.cameras.length,
      commentary: presentation.commentary.length,
      crowd: presentation.crowd.length,
      overlays: presentation.overlays.length,
    },
    issues,
  };
}
