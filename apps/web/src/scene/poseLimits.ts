/**
 * Limits on Grandma's head, neck and spine (clipping plan step 2, docs/11). Her moods, nods, idle sway, dozing
 * and looking at the player all add up; without limits the sum can push her chin into the cardigan or her hair
 * into her collar. Like Godot's LookAtModifier3D, a limit is soft: motion slows as it nears the edge instead
 * of stopping dead. Like VRM avatars, a look is shared between neck and head rather than all on the neck.
 *
 * All angles in radians. Pure functions, unit-tested.
 */
export const LIMITS = {
  /** Turning to look at the player, either way. */
  yaw: 0.75,
  /** The neck's share of a turn; the head does the rest. */
  neckShare: 0.35,
  /** Head nodding down (positive) and tipping back (negative). */
  pitchDown: 0.5,
  pitchUp: 0.22,
  /** Head tilting to either side. */
  tilt: 0.28,
  /** Spine leaning forward (positive) or back. */
  leanForward: 0.2,
  leanBack: 0.1,
  /** The neck dropping forward while she dozes. */
  neckDoze: 0.3,
};

/** Smoothly limits `x` to (-max, max): almost unchanged near zero, never past the limit. */
export function soft(x: number, max: number): number {
  return max * Math.tanh(x / max);
}

/** `soft` with a different limit each way. */
export function softRange(x: number, below: number, above: number): number {
  return x >= 0 ? soft(x, above) : -soft(-x, below);
}

export interface HeadInput {
  /** Turn toward the player. */
  yaw: number;
  /** Everything that nods the head: mood, idle sway, thinking, nodding while talking, dozing. */
  pitch: number;
  tilt: number;
  /** Everything that bends the spine: breathing, laughing, mood, dozing. */
  lean: number;
  /** How far she has dozed off (0 to 1). */
  doze: number;
}

export interface HeadPose {
  neckYaw: number;
  neckPitch: number;
  headYaw: number;
  headPitch: number;
  headTilt: number;
  spineLean: number;
}

export function limitHead(i: HeadInput): HeadPose {
  const yaw = soft(i.yaw, LIMITS.yaw);
  return {
    neckYaw: yaw * LIMITS.neckShare,
    headYaw: yaw * (1 - LIMITS.neckShare),
    neckPitch: soft(i.doze * 0.35, LIMITS.neckDoze),
    headPitch: softRange(i.pitch, LIMITS.pitchUp, LIMITS.pitchDown),
    headTilt: soft(i.tilt, LIMITS.tilt),
    spineLean: softRange(i.lean, LIMITS.leanBack, LIMITS.leanForward),
  };
}
