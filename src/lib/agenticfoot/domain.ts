/**
 * @agenticfoot/domain — shared types, constants, IDs, pitch dimensions, zod schemas.
 *
 * Conventions:
 * - Engine-authoritative: these schemas describe sealed match truth and the
 *   command vocabulary brains may propose. Nothing here mutates state.
 * - All cross-package payloads validate against these schemas.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Pitch dimensions and coordinate conventions
// ---------------------------------------------------------------------------
/**
 * Pitch: 105m x 68m.
 * Origin: pitch centre (the centre spot).
 * Axes:  +x points toward the AWAY goal, -x toward the HOME goal
 *        (x in [-52.5, 52.5], along the touchlines).
 *        +z points toward the far touchline as seen from the broadcast camera
 *        (z in [-34, 34], along the goal lines).
 * Units: metres; seconds for time; m/s for velocity.
 */
export const PITCH = {
  length: 105,
  width: 68,
  halfLength: 52.5,
  halfWidth: 34,
} as const;

// ---------------------------------------------------------------------------
// IDs and primitives
// ---------------------------------------------------------------------------
export const TeamIdSchema = z.enum(["home", "away"]);
export type TeamId = z.infer<typeof TeamIdSchema>;

export const PlayerIdSchema = z.string().min(1);
export type PlayerId = z.infer<typeof PlayerIdSchema>;

export const MatchIdSchema = z.string().min(1);
export type MatchId = z.infer<typeof MatchIdSchema>;

export const SegmentIdSchema = z.string().min(1);
export type SegmentId = z.infer<typeof SegmentIdSchema>;

/** 2D pitch-plane vector. x along pitch length, z along pitch width. */
export const Vec2Schema = z.object({
  x: z.number(),
  z: z.number(),
});
export type Vec2 = z.infer<typeof Vec2Schema>;

/** Normalized 0..1 scalar used for power/urgency/risk. */
export const NormalizedSchema = z.number().min(0).max(1);
export type Normalized = z.infer<typeof NormalizedSchema>;

/** Player execution attributes on the authored 1..95 simulation scale. */
const AttributeSchema = z.number().int().min(1).max(95);

export const PlayerAttributesSchema = z.object({
  pace: AttributeSchema,
  acceleration: AttributeSchema,
  stamina: AttributeSchema,
  strength: AttributeSchema,
  agility: AttributeSchema,

  firstTouch: AttributeSchema,
  dribbling: AttributeSchema,
  passing: AttributeSchema,
  vision: AttributeSchema,
  crossing: AttributeSchema,
  finishing: AttributeSchema,
  shotPower: AttributeSchema,
  heading: AttributeSchema,
  weakFoot: AttributeSchema,

  defending: AttributeSchema,
  tackling: AttributeSchema,
  marking: AttributeSchema,
  positioning: AttributeSchema,
  anticipation: AttributeSchema,

  reflexes: AttributeSchema,
  handling: AttributeSchema,
  goalkeeperPositioning: AttributeSchema,
  distribution: AttributeSchema,
});
export type PlayerAttributes = z.infer<typeof PlayerAttributesSchema>;

export const PlayerMentalitySchema = z.object({
  risk: AttributeSchema,
  aggression: AttributeSchema,
  discipline: AttributeSchema,
  composure: AttributeSchema,
  confidence: AttributeSchema,
  selfishness: AttributeSchema,
  flair: AttributeSchema,
  bravery: AttributeSchema,
  concentration: AttributeSchema,
  workRate: AttributeSchema,
  pressureTolerance: AttributeSchema,
});
export type PlayerMentality = z.infer<typeof PlayerMentalitySchema>;

// ---------------------------------------------------------------------------
// Team tactics (team-tactics-model.md)
// ---------------------------------------------------------------------------
export const TeamMentalitySchema = z.enum([
  "very_defensive",
  "defensive",
  "balanced",
  "positive",
  "attacking",
  "desperate",
]);
export type TeamMentality = z.infer<typeof TeamMentalitySchema>;

export const FormationIdSchema = z.enum(["433", "4231", "442", "352", "343", "4141", "541"]);
export type FormationId = z.infer<typeof FormationIdSchema>;

export const TacticalRoleSchema = z.enum([
  "goalkeeper_defend",
  "sweeper_keeper",
  "center_back_defend",
  "ball_playing_defender",
  "fullback_support",
  "wingback_attack",
  "inverted_fullback",
  "holding_midfielder",
  "deep_playmaker",
  "box_to_box_midfielder",
  "advanced_playmaker",
  "wide_winger",
  "inside_forward",
  "false_nine",
  "poacher",
  "complete_forward",
]);
export type TacticalRole = z.infer<typeof TacticalRoleSchema>;

export const RoleFocusSchema = z.enum(["defend", "support", "attack", "roam", "press", "conserve"]);
export type RoleFocus = z.infer<typeof RoleFocusSchema>;

export const TacticalPhaseSchema = z.enum([
  "in_possession_build_up",
  "in_possession_attack",
  "rest_defense",
  "out_of_possession_high_press",
  "out_of_possession_low_block",
]);
export type TacticalPhase = z.infer<typeof TacticalPhaseSchema>;

export const PressingDutySchema = z.enum([
  "lead_press",
  "second_press",
  "screen",
  "mark",
  "cover",
  "rest_defense",
  "none",
]);
export type PressingDuty = z.infer<typeof PressingDutySchema>;

export const MarkingDutySchema = z.object({
  type: z.enum(["zonal", "man", "hybrid"]),
  targetSlot: z.string().min(1).optional(),
  zone: z.string().min(1).optional(),
});
export type MarkingDuty = z.infer<typeof MarkingDutySchema>;

export const RoleAssignmentSchema = z.object({
  playerId: PlayerIdSchema,
  slotId: z.string().min(1),
  role: TacticalRoleSchema,
  focus: RoleFocusSchema,
  freedom: NormalizedSchema,
  pressingDuty: PressingDutySchema,
  markingDuty: MarkingDutySchema.optional(),
});
export type RoleAssignment = z.infer<typeof RoleAssignmentSchema>;

export const ShapeDefinitionSchema = z.object({
  label: z.string().min(1),
  slots: z.record(z.string().min(1), Vec2Schema),
  compactness: NormalizedSchema,
  width: NormalizedSchema,
  lineHeight: NormalizedSchema,
});
export type ShapeDefinition = z.infer<typeof ShapeDefinitionSchema>;

export const PhaseShapesSchema = z.object({
  inPossessionBuildUp: ShapeDefinitionSchema,
  inPossessionAttack: ShapeDefinitionSchema,
  restDefense: ShapeDefinitionSchema,
  outOfPossessionHighPress: ShapeDefinitionSchema,
  outOfPossessionLowBlock: ShapeDefinitionSchema,
});
export type PhaseShapes = z.infer<typeof PhaseShapesSchema>;

export const BuildUpPlanSchema = z.object({
  style: z.enum(["short", "mixed", "direct"]),
  tempo: NormalizedSchema,
  goalkeeperDistribution: z.enum(["short", "mixed", "long"]),
  centerBackSplit: NormalizedSchema,
  pivotDrops: z.boolean(),
  fullbackBehavior: z.enum(["hold", "invert", "overlap", "asymmetric"]),
  preferredSide: z.enum(["left", "right", "center", "balanced"]),
  risk: NormalizedSchema,
});
export type BuildUpPlan = z.infer<typeof BuildUpPlanSchema>;

export const ChanceCreationPatternSchema = z.enum([
  "wide_isolation",
  "overlap_cross",
  "underlap_cutback",
  "central_combinations",
  "early_through_balls",
  "direct_crosses",
  "counterattack",
]);
export type ChanceCreationPattern = z.infer<typeof ChanceCreationPatternSchema>;

export const ChanceCreationPlanSchema = z.object({
  primaryPattern: ChanceCreationPatternSchema,
  secondaryPattern: ChanceCreationPatternSchema.optional(),
  crossingFrequency: NormalizedSchema,
  cutbackPreference: NormalizedSchema,
  throughBallPreference: NormalizedSchema,
  shotPatience: NormalizedSchema,
  boxOccupation: NormalizedSchema,
  farPostRuns: NormalizedSchema,
  edgeOfBoxRuns: NormalizedSchema,
});
export type ChanceCreationPlan = z.infer<typeof ChanceCreationPlanSchema>;

export const BoxDefensePlanSchema = z.object({
  trackRunners: NormalizedSchema,
  blockShots: NormalizedSchema,
  protectCutbacks: NormalizedSchema,
  aerialAggression: NormalizedSchema,
});
export type BoxDefensePlan = z.infer<typeof BoxDefensePlanSchema>;

export const DefensivePlanSchema = z.object({
  block: z.enum(["high", "mid", "low"]),
  compactness: NormalizedSchema,
  lineHeight: NormalizedSchema,
  width: NormalizedSchema,
  marking: z.enum(["zonal", "man_oriented", "hybrid"]),
  protectCentralZones: NormalizedSchema,
  forceDirection: z.enum(["inside", "outside", "weak_foot", "none"]),
  boxDefense: BoxDefensePlanSchema,
});
export type DefensivePlan = z.infer<typeof DefensivePlanSchema>;

export const PressingTriggerSchema = z.enum([
  "pass_into_marked_zone",
  "heavy_touch",
  "back_pass",
  "bad_touch",
  "wide_trap",
  "goalkeeper_touch",
  "slow_center_back",
  "loose_ball",
  "always",
  "never",
]);
export type PressingTrigger = z.infer<typeof PressingTriggerSchema>;

export const PressingPlanSchema = z.object({
  intensity: NormalizedSchema,
  triggers: z.array(PressingTriggerSchema).min(1),
  firstLineShape: z.enum(["one", "two", "three"]),
  secondManPress: NormalizedSchema,
  counterpress: NormalizedSchema,
  trapSide: z.enum(["left", "right", "touchline", "center", "none"]),
  staminaLimit: NormalizedSchema,
});
export type PressingPlan = z.infer<typeof PressingPlanSchema>;

export const TransitionPlanSchema = z.object({
  onRegain: z.enum(["secure", "counter", "direct"]),
  onLoss: z.enum(["counterpress", "recover_shape", "tactical_foul_bias"]),
  firstForwardPassRisk: NormalizedSchema,
  runnerCommitment: NormalizedSchema,
  restDefensePriority: NormalizedSchema,
});
export type TransitionPlan = z.infer<typeof TransitionPlanSchema>;

export const TacticalConstraintsSchema = z.object({
  maxPlayersAheadOfBall: z.number().int().min(0).max(10),
  maxBoxAttackers: z.number().int().min(0).max(10),
  minRestDefenders: z.number().int().min(0).max(10),
  fullbackSimultaneousAttack: z.boolean(),
  centerBackCarryLimit: NormalizedSchema,
  shotDistanceLimit: z.number().positive().optional(),
  protectLeadAfterMinute: z.number().int().positive().optional(),
});
export type TacticalConstraints = z.infer<typeof TacticalConstraintsSchema>;

export const CornerPlanSchema = z.object({
  takerPriority: z.array(PlayerIdSchema).min(1),
  delivery: z.enum(["near_post", "far_post", "six_yard", "edge_cutback", "short"]),
  primaryTarget: PlayerIdSchema.optional(),
  crowdKeeper: NormalizedSchema,
  edgeProtection: NormalizedSchema,
  restDefense: z.array(PlayerIdSchema),
});
export type CornerPlan = z.infer<typeof CornerPlanSchema>;

export const FreeKickPlanSchema = z.object({
  directShotTakers: z.array(PlayerIdSchema),
  crossingTakers: z.array(PlayerIdSchema),
  routine: z.enum(["direct_shot", "cross", "layoff", "short_recycle"]),
});
export type FreeKickPlan = z.infer<typeof FreeKickPlanSchema>;

export const ThrowInPlanSchema = z.object({
  style: z.enum(["safe", "line_progression", "long_throw"]),
  nearbySupport: NormalizedSchema,
  runnerDepth: NormalizedSchema,
});
export type ThrowInPlan = z.infer<typeof ThrowInPlanSchema>;

export const PenaltyPlanSchema = z.object({
  takerPriority: z.array(PlayerIdSchema).min(1),
  defaultStrategy: z.enum(["placement", "power", "keeper_read"]),
});
export type PenaltyPlan = z.infer<typeof PenaltyPlanSchema>;

export const SetPiecePlanSchema = z.object({
  corners: CornerPlanSchema,
  freeKicks: FreeKickPlanSchema,
  throwIns: ThrowInPlanSchema,
  penalties: PenaltyPlanSchema,
});
export type SetPiecePlan = z.infer<typeof SetPiecePlanSchema>;

export const TeamTacticSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mentality: TeamMentalitySchema,
  baseFormation: FormationIdSchema,
  phaseShapes: PhaseShapesSchema,
  roleAssignments: z.array(RoleAssignmentSchema).min(11),
  buildUp: BuildUpPlanSchema,
  chanceCreation: ChanceCreationPlanSchema,
  defending: DefensivePlanSchema,
  pressing: PressingPlanSchema,
  transitions: TransitionPlanSchema,
  setPieces: SetPiecePlanSchema,
  constraints: TacticalConstraintsSchema,
});
export type TeamTactic = z.infer<typeof TeamTacticSchema>;

// ---------------------------------------------------------------------------
// Clocks
// ---------------------------------------------------------------------------
/** Rolling-lookahead clock state: simulation runs ahead of broadcast. */
export const MatchClockSchema = z.object({
  simulationSecond: z.number().min(0),
  broadcastSecond: z.number().min(0),
  bufferSeconds: z.number(),
  targetBufferSeconds: z.number().min(0),
  minimumSafeBufferSeconds: z.number().min(0),
});
export type MatchClock = z.infer<typeof MatchClockSchema>;

// ---------------------------------------------------------------------------
// Player commands (player-action-model.md)
// ---------------------------------------------------------------------------
export const PossessionActionSchema = z.enum([
  "move",
  "dribble",
  "shield",
  "turn",
  "pass",
  "through_ball",
  "lobbed_pass",
  "cross",
  "cutback",
  "shoot",
  "clear",
  "skill_move",
  "dummy",
  "let_run",
  "feint",
  "disguised_pass",
  "hold_and_bait",
]);
export const OffBallAttackActionSchema = z.enum([
  "hold_shape",
  "support",
  "come_short",
  "run_in_behind",
  "overlap",
  "underlap",
  "rotate",
  "attack_near_post",
  "attack_far_post",
  "crash_box",
  "hold_cutback_zone",
  "pull_marker",
  "dummy_run",
]);
export const DefensiveActionSchema = z.enum([
  "hold_line",
  "drop",
  "step_up",
  "cover",
  "mark",
  "track_runner",
  "block_lane",
  "press",
  "second_man_press",
  "jockey",
  "stand_tackle",
  "slide_tackle",
  "intercept",
  "block_shot",
  "clear_danger",
]);
export const GoalkeeperActionSchema = z.enum([
  "hold_position",
  "adjust_angle",
  "rush_out",
  "sweep",
  "claim_cross",
  "punch",
  "catch",
  "parry",
  "short_distribute",
  "throw_distribute",
  "long_distribute",
  "delay_release",
]);
export const RestartActionSchema = z.enum([
  "take_kickoff",
  "take_free_kick",
  "take_penalty",
  "take_throw_in",
  "take_goal_kick",
  "take_corner",
  "set_piece_run",
  "set_piece_screen",
  "set_piece_mark",
  "set_piece_zone",
]);

export const PlayerActionSchema = z.union([
  PossessionActionSchema,
  OffBallAttackActionSchema,
  DefensiveActionSchema,
  GoalkeeperActionSchema,
  RestartActionSchema,
]);
export type PlayerAction = z.infer<typeof PlayerActionSchema>;
export type PossessionAction = z.infer<typeof PossessionActionSchema>;
export type OffBallAttackAction = z.infer<typeof OffBallAttackActionSchema>;
export type DefensiveAction = z.infer<typeof DefensiveActionSchema>;
export type GoalkeeperAction = z.infer<typeof GoalkeeperActionSchema>;
export type RestartAction = z.infer<typeof RestartActionSchema>;

/** Validation category an action belongs to (drives context-sensitive rules). */
export const ActionCategorySchema = z.enum([
  "possession",
  "off_ball_attack",
  "defensive",
  "goalkeeper",
  "restart",
]);
export type ActionCategory = z.infer<typeof ActionCategorySchema>;

const ACTION_CATEGORY: Readonly<Record<PlayerAction, ActionCategory>> = {
  ...Object.fromEntries(PossessionActionSchema.options.map((a) => [a, "possession"])),
  ...Object.fromEntries(OffBallAttackActionSchema.options.map((a) => [a, "off_ball_attack"])),
  ...Object.fromEntries(DefensiveActionSchema.options.map((a) => [a, "defensive"])),
  ...Object.fromEntries(GoalkeeperActionSchema.options.map((a) => [a, "goalkeeper"])),
  ...Object.fromEntries(RestartActionSchema.options.map((a) => [a, "restart"])),
} as Record<PlayerAction, ActionCategory>;

export function actionCategory(action: PlayerAction): ActionCategory {
  return ACTION_CATEGORY[action];
}

export const ActionModifierSchema = z.enum([
  "sprint",
  "controlled",
  "shield",
  "finesse",
  "chip",
  "driven",
  "lob",
  "first_time",
  "dummy",
  "safe",
  "aggressive",
]);
export type ActionModifier = z.infer<typeof ActionModifierSchema>;

/** A single proposed player action. The engine clamps and may reject it. */
export const PlayerCommandSchema = z.object({
  playerId: PlayerIdSchema,
  action: PlayerActionSchema,
  targetPlayerId: PlayerIdSchema.optional(),
  targetZone: Vec2Schema.optional(),
  direction: Vec2Schema.optional(),
  power: NormalizedSchema.optional(),
  urgency: NormalizedSchema.optional(),
  risk: NormalizedSchema.optional(),
  modifier: ActionModifierSchema.optional(),
});
export type PlayerCommand = z.infer<typeof PlayerCommandSchema>;

// ---------------------------------------------------------------------------
// Command rejection (player-action-model.md "Validation Rules")
// ---------------------------------------------------------------------------
/** Machine-readable reasons the engine rejects a proposed command. */
export const CommandRejectionReasonSchema = z.enum([
  "schema_invalid",
  "unknown_player",
  "not_ball_carrier",
  "is_ball_carrier",
  "team_not_in_possession",
  "team_in_possession",
  "ball_not_in_open_play",
  "not_goalkeeper",
  "goalkeeper_not_carrier",
  "no_ball_in_flight",
  "outside_penalty_area",
  "not_in_restart",
  "restart_mismatch",
  "not_restart_taker",
  "target_required",
  "target_player_not_found",
  "target_not_teammate",
  "target_not_opponent",
  "tackle_out_of_range",
  "player_sent_off",
]);
export type CommandRejectionReason = z.infer<typeof CommandRejectionReasonSchema>;

/** A rejected command, logged so behavior stays explainable. */
export const RejectedCommandSchema = z.object({
  playerId: PlayerIdSchema,
  /** Raw action string — may be outside the action space for schema_invalid. */
  action: z.string(),
  reason: CommandRejectionReasonSchema,
  detail: z.string().optional(),
  tick: z.number().int().min(0),
});
export type RejectedCommand = z.infer<typeof RejectedCommandSchema>;

// ---------------------------------------------------------------------------
// Match facts (physics-resolution-model.md) — emitted by resolution layer
// ---------------------------------------------------------------------------
const factBase = {
  id: z.string().min(1),
  matchSecond: z.number().min(0),
};

/** Restart vocabulary (game-rules.md). Declared with facts: facts reference it. */
export const RestartTypeSchema = z.enum([
  "kickoff",
  "dropped_ball",
  "direct_free_kick",
  "indirect_free_kick",
  "penalty_kick",
  "throw_in",
  "goal_kick",
  "corner_kick",
]);
export type RestartType = z.infer<typeof RestartTypeSchema>;

/** IFAB contact severity scale (game-rules.md "Fouls"). */
export const ContactSeveritySchema = z.enum([
  "trifling",
  "careless",
  "reckless",
  "excessive_force",
]);
export type ContactSeverity = z.infer<typeof ContactSeveritySchema>;

/** Likely offence family a contact suggests; the rules layer interprets it. */
export const FoulOffenceSchema = z.enum([
  "trip",
  "kick",
  "push",
  "hold",
  "charge",
  "dangerous_play",
  "handball",
  "impeding",
]);
export type FoulOffence = z.infer<typeof FoulOffenceSchema>;

/** Tactical context of a foul candidate (drives card interpretation). */
export const TacticalImpactSchema = z.enum(["none", "promising_attack", "dogso"]);
export type TacticalImpact = z.infer<typeof TacticalImpactSchema>;

/** Which boundary line the whole ball crossed. */
export const PitchLineSchema = z.enum(["touchline", "goal_line"]);
export type PitchLine = z.infer<typeof PitchLineSchema>;

/** Offside-position candidate frozen at the moment of a teammate's touch. */
export const OffsideCandidateSchema = z.object({
  playerId: PlayerIdSchema,
  position: Vec2Schema,
});
export type OffsideCandidate = z.infer<typeof OffsideCandidateSchema>;

export const TouchSourceSchema = z.enum(["foot", "header", "goalkeeper_throw"]);
export type TouchSource = z.infer<typeof TouchSourceSchema>;

export const MatchFactSchema = z.discriminatedUnion("kind", [
  z.object({ ...factBase, kind: z.literal("kickoff"), teamId: TeamIdSchema }),
  z.object({ ...factBase, kind: z.literal("tick"), tick: z.number().int().min(0) }),
  z.object({
    ...factBase,
    kind: z.literal("touch"),
    playerId: PlayerIdSchema,
    teamId: TeamIdSchema,
    position: Vec2Schema,
    /** Set when this touch IS a restart delivery (direct-goal/offside rules). */
    restart: RestartTypeSchema.optional(),
    source: TouchSourceSchema.optional(),
  }),
  z.object({
    ...factBase,
    kind: z.literal("pass"),
    fromPlayerId: PlayerIdSchema,
    toPlayerId: PlayerIdSchema.optional(),
    teamId: TeamIdSchema,
    completed: z.boolean(),
    origin: Vec2Schema,
    target: Vec2Schema,
  }),
  z.object({
    ...factBase,
    kind: z.literal("shot"),
    playerId: PlayerIdSchema,
    teamId: TeamIdSchema,
    onTarget: z.boolean(),
    origin: Vec2Schema,
    xg: NormalizedSchema.optional(),
  }),
  z.object({
    ...factBase,
    kind: z.literal("contact"),
    players: z.array(PlayerIdSchema).min(1),
    position: Vec2Schema,
    severity: ContactSeveritySchema,
    ballPlayable: z.boolean(),
  }),
  z.object({
    ...factBase,
    kind: z.literal("foul_candidate"),
    offenderId: PlayerIdSchema,
    offenderTeamId: TeamIdSchema,
    victimId: PlayerIdSchema,
    position: Vec2Schema,
    severity: ContactSeveritySchema,
    offence: FoulOffenceSchema,
    /** Whether the offence involved physical contact with the opponent. */
    contact: z.boolean().optional(),
    /** Whether the offender was attempting to play/challenge for the ball. */
    challengeForBall: z.boolean().optional(),
    tacticalImpact: TacticalImpactSchema,
  }),
  z.object({
    ...factBase,
    kind: z.literal("ball_out"),
    /** Deflections/saves count: the very last touch before crossing. */
    lastTouchPlayerId: PlayerIdSchema,
    lastTouchTeamId: TeamIdSchema,
    /** Crossing point, clamped onto the boundary line. */
    position: Vec2Schema,
    line: PitchLineSchema,
    /** Goal-line crossings only: whole ball between the posts, under the bar. */
    goalMouth: z.boolean(),
  }),
  z.object({
    ...factBase,
    kind: z.literal("goalkeeper_hand_timeout"),
    keeperId: PlayerIdSchema,
    teamId: TeamIdSchema,
    position: Vec2Schema,
    secondsHeld: z.number().min(0),
  }),
  z.object({
    ...factBase,
    kind: z.literal("offside_snapshot"),
    passerId: PlayerIdSchema,
    teamId: TeamIdSchema,
    /** Ball x at the moment of the touch. */
    ballX: z.number(),
    /** x of the second-last opponent at the moment of the touch. */
    secondLastOpponentX: z.number(),
    /** Players in an offside position (not an offence until involvement). */
    candidates: z.array(OffsideCandidateSchema).min(1),
    /** Direct receipt from these restarts is exempt (throw-in/goal kick/corner). */
    exemptRestart: RestartTypeSchema.optional(),
  }),
  z.object({
    ...factBase,
    kind: z.literal("save"),
    keeperId: PlayerIdSchema,
    teamId: TeamIdSchema,
    /** Ball height in metres when the keeper made contact. */
    height: z.number().min(0),
    held: z.boolean(),
  }),
  z.object({
    ...factBase,
    kind: z.literal("duel"),
    winnerId: PlayerIdSchema,
    loserId: PlayerIdSchema,
    position: Vec2Schema,
    source: z.enum(["aerial", "dribble", "stand_tackle", "slide_tackle"]).optional(),
    actorId: PlayerIdSchema.optional(),
  }),
]);
export type MatchFact = z.infer<typeof MatchFactSchema>;

// ---------------------------------------------------------------------------
// Broadcast animation actions — additive renderer cues over sealed truth
// ---------------------------------------------------------------------------
export const ActionCueKindSchema = z.enum([
  "kick",
  "save",
  "duel",
  "contact",
  "foul",
  "goal",
  "ball_out",
  "restart",
  "offside",
]);
export type ActionCueKind = z.infer<typeof ActionCueKindSchema>;

export const ActionCueFlagValueSchema = z.union([z.string(), z.boolean(), z.number()]);
export type ActionCueFlagValue = z.infer<typeof ActionCueFlagValueSchema>;

export const ActionCueSchema = z.object({
  /** Match second, frame-aligned (same clock as BroadcastFrame.matchSecond). */
  t: z.number().min(0),
  kind: ActionCueKindSchema,
  playerId: PlayerIdSchema.optional(),
  secondaryId: PlayerIdSchema.optional(),
  teamId: TeamIdSchema.optional(),
  /** Pitch position if the source fact has one. */
  position: Vec2Schema.optional(),
  /** Kind-specific booleans/enums, e.g. { held: true }, { restart: "corner" }. */
  flags: z.record(ActionCueFlagValueSchema).optional(),
});
export type ActionCue = z.infer<typeof ActionCueSchema>;

// ---------------------------------------------------------------------------
// Resolution events — explainable physics outcomes emitted by the engine
// ---------------------------------------------------------------------------
export const PressureStateSchema = z.object({
  nearestOpponentDistance: z.number().min(0),
  opponentCountWithin2m: z.number().int().min(0),
  opponentCountWithin5m: z.number().int().min(0),
  closingSpeed: z.number(),
  frontalPressure: NormalizedSchema,
  backPressure: NormalizedSchema,
  lanePressure: NormalizedSchema,
  contactPressure: NormalizedSchema,
});
export type PressureState = z.infer<typeof PressureStateSchema>;

export const ResolutionEventKindSchema = z.enum([
  "pass",
  "first_touch",
  "dribble",
  "tackle",
  "shot",
  "save",
  "aerial_duel",
  "collision",
  "deception",
]);
export type ResolutionEventKind = z.infer<typeof ResolutionEventKindSchema>;

export const ResolutionOutcomeSchema = z.enum([
  "completed",
  "failed",
  "turnover",
  "intercepted",
  "blocked",
  "saved",
  "goal",
  "wide",
  "foul",
  "advantage",
  "out_of_play",
  "restart",
  "held",
  "parried",
  "loose",
]);
export type ResolutionOutcome = z.infer<typeof ResolutionOutcomeSchema>;

export const ResolutionProbabilitiesSchema = z.object({
  success: NormalizedSchema.optional(),
  turnover: NormalizedSchema.optional(),
  foul: NormalizedSchema.optional(),
  card: NormalizedSchema.optional(),
  shotOnTarget: NormalizedSchema.optional(),
  goal: NormalizedSchema.optional(),
  save: NormalizedSchema.optional(),
  interception: NormalizedSchema.optional(),
  control: NormalizedSchema.optional(),
  loose: NormalizedSchema.optional(),
});
export type ResolutionProbabilities = z.infer<typeof ResolutionProbabilitiesSchema>;

export const ResolutionFactorSchema = z.object({
  name: z.string().min(1),
  value: z.number(),
  weight: z.number().optional(),
});
export type ResolutionFactor = z.infer<typeof ResolutionFactorSchema>;

export const ResolutionEventSchema = z.object({
  id: z.string().min(1),
  matchSecond: z.number().min(0),
  tick: z.number().int().min(0),
  kind: ResolutionEventKindSchema,
  actorId: PlayerIdSchema,
  teamId: TeamIdSchema,
  command: PlayerCommandSchema.optional(),
  targetPlayerId: PlayerIdSchema.optional(),
  relatedPlayerIds: z.array(PlayerIdSchema),
  position: Vec2Schema,
  pressure: PressureStateSchema,
  probabilities: ResolutionProbabilitiesSchema,
  roll: NormalizedSchema.optional(),
  outcome: ResolutionOutcomeSchema,
  factors: z.array(ResolutionFactorSchema),
  factIds: z.array(z.string().min(1)),
  explanation: z.array(z.string().min(1)),
});
export type ResolutionEvent = z.infer<typeof ResolutionEventSchema>;

// ---------------------------------------------------------------------------
// Match events — broadcast-grade happenings derived from facts/rules
// ---------------------------------------------------------------------------
const eventBase = {
  id: z.string().min(1),
  matchSecond: z.number().min(0),
};

export const MatchEventSchema = z.discriminatedUnion("kind", [
  z.object({ ...eventBase, kind: z.literal("kickoff"), teamId: TeamIdSchema }),
  z.object({
    ...eventBase,
    kind: z.literal("pass_completed"),
    teamId: TeamIdSchema,
    fromPlayerId: PlayerIdSchema,
    toPlayerId: PlayerIdSchema,
  }),
  z.object({
    ...eventBase,
    kind: z.literal("possession_change"),
    fromTeamId: TeamIdSchema,
    toTeamId: TeamIdSchema,
    playerId: PlayerIdSchema,
  }),
  z.object({
    ...eventBase,
    kind: z.literal("goal"),
    teamId: TeamIdSchema,
    scorerId: PlayerIdSchema,
  }),
  z.object({
    ...eventBase,
    kind: z.literal("period_end"),
    period: z.enum(["first_half", "second_half", "full_time"]),
  }),
]);
export type MatchEvent = z.infer<typeof MatchEventSchema>;

// ---------------------------------------------------------------------------
// Rule decisions (game-rules.md)
// ---------------------------------------------------------------------------
export const SanctionSchema = z.object({
  playerId: PlayerIdSchema,
  card: z.enum(["yellow", "red"]),
  reason: z.string(),
});
export type Sanction = z.infer<typeof SanctionSchema>;

/** Supporting facts behind a goal decision (broadcast review checks). */
export const GoalReviewSchema = z.object({
  /** The ball_out fact proving the whole ball crossed the goal line. */
  crossingFactId: z.string().min(1),
  /** The shot fact that produced the crossing, when one exists. */
  shotFactId: z.string().optional(),
  lastTouchPlayerId: PlayerIdSchema,
  /** Offside check result for the scoring touch chain. */
  offside: z.enum(["onside", "no_snapshot"]),
  /** Set when the goal came directly from a restart (legality was checked). */
  restartSource: RestartTypeSchema.optional(),
});
export type GoalReview = z.infer<typeof GoalReviewSchema>;

export const GoalDecisionSchema = z.object({
  /** Team credited with the goal (for own goals: the benefiting team). */
  teamId: TeamIdSchema,
  scorerId: PlayerIdSchema.optional(),
  ownGoal: z.boolean(),
  review: GoalReviewSchema,
});
export type GoalDecision = z.infer<typeof GoalDecisionSchema>;

/**
 * Every stoppage resolves to a rule decision. `team` is always the team
 * awarded the restart (for goals that is the CONCEDING team's kickoff).
 */
export const RuleDecisionSchema = z.object({
  id: z.string().min(1),
  matchTime: z.number().min(0),
  law: z.string().min(1),
  reason: z.string().min(1),
  team: TeamIdSchema.optional(),
  restart: RestartTypeSchema.optional(),
  restartSpot: Vec2Schema.optional(),
  sanction: z.array(SanctionSchema).optional(),
  advantage: z.boolean().optional(),
  /** Present iff this decision awards a goal. */
  goal: GoalDecisionSchema.optional(),
  /** Present iff this decision ends a period of play. */
  period: z.enum(["first_half", "second_half", "full_time"]).optional(),
  affectedPlayers: z.array(PlayerIdSchema),
});
export type RuleDecision = z.infer<typeof RuleDecisionSchema>;

// ---------------------------------------------------------------------------
// Broadcast frames (broadcast-model.md) — stored at 15fps, rendered higher
// ---------------------------------------------------------------------------
export const FrameBallSchema = z.object({
  position: Vec2Schema,
  height: z.number().min(0),
  velocity: Vec2Schema,
});
export type FrameBall = z.infer<typeof FrameBallSchema>;

export const FramePlayerSchema = z.object({
  playerId: PlayerIdSchema,
  teamId: TeamIdSchema,
  position: Vec2Schema,
  /** Facing angle in radians; 0 points toward +x. */
  facing: z.number(),
  stamina: NormalizedSchema.optional(),
  sprintDebt: NormalizedSchema.optional(),
});
export type FramePlayer = z.infer<typeof FramePlayerSchema>;

export const BroadcastFrameSchema = z.object({
  matchSecond: z.number().min(0),
  /** Engine tick index this frame was captured at (exact continuity key). */
  tick: z.number().int().min(0),
  ball: FrameBallSchema,
  players: z.array(FramePlayerSchema),
});
export type BroadcastFrame = z.infer<typeof BroadcastFrameSchema>;

// ---------------------------------------------------------------------------
// Segments (rolling-lookahead-model.md)
// ---------------------------------------------------------------------------
export const SegmentStatusSchema = z.enum([
  "pending",
  "simulating",
  "waiting_for_ai",
  "repairing_ai_output",
  "validating",
  "failed",
  "sealed",
  "broadcasting",
  "aired",
]);
export type SegmentStatus = z.infer<typeof SegmentStatusSchema>;

export const MatchSegmentSchema = z.object({
  id: SegmentIdSchema,
  matchId: MatchIdSchema,
  index: z.number().int().min(0),
  startSecond: z.number().min(0),
  endSecond: z.number().min(0),
  status: SegmentStatusSchema,
  /** Seed used by the deterministic engine for this segment's simulation. */
  seed: z.number().int().nonnegative(),
  frames: z.array(BroadcastFrameSchema),
  events: z.array(MatchEventSchema),
  facts: z.array(MatchFactSchema),
  resolutionEvents: z.array(ResolutionEventSchema).optional(),
  ruleDecisions: z.array(RuleDecisionSchema),
  checksum: z.string(),
  createdAt: z.string(),
  sealedAt: z.string().optional(),
});
export type MatchSegment = z.infer<typeof MatchSegmentSchema>;

export const SegmentSealReportSchema = z.object({
  segmentId: SegmentIdSchema,
  seed: z.number().int().nonnegative(),
  frameCount: z.number().int().min(0),
  eventCount: z.number().int().min(0),
  factCount: z.number().int().min(0),
  aiCallCount: z.number().int().min(0),
  localBridgeTicks: z.number().int().min(0).optional(),
  droppedStaleCount: z.number().int().min(0).optional(),
  decisionLatencyMsTotal: z.number().min(0).optional(),
  decisionLatencyMsMax: z.number().min(0).optional(),
  consecutiveFailures: z.number().int().min(0).optional(),
  rejectedCommandCount: z.number().int().min(0),
  ruleDecisionCount: z.number().int().min(0),
  checksum: z.string().min(1),
});
export type SegmentSealReport = z.infer<typeof SegmentSealReportSchema>;

export const MatchSegmentSummarySchema = z.object({
  id: SegmentIdSchema,
  index: z.number().int().min(0),
  startSecond: z.number().min(0),
  endSecond: z.number().min(0),
  status: SegmentStatusSchema,
  checksum: z.string().optional(),
});
export type MatchSegmentSummary = z.infer<typeof MatchSegmentSummarySchema>;

export const MatchManifestSchema = z.object({
  matchId: MatchIdSchema,
  /** [home club id, away club id] — display identity, not TeamId. */
  teams: z.tuple([z.string().min(1), z.string().min(1)]),
  startedAt: z.string(),
  seed: z.number().int().nonnegative(),
  matchLengthSeconds: z.number().positive(),
  segmentLengthSeconds: z.number().positive(),
  status: z.enum(["prebuffering", "broadcasting", "complete", "failed"]),
  segments: z.array(MatchSegmentSummarySchema),
});
export type MatchManifest = z.infer<typeof MatchManifestSchema>;
