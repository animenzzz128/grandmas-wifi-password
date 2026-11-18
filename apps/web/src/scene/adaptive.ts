/**
 * Adaptive resolution (iteration 48). If the frame rate stays low (a weak or software-rendered GPU, a laptop
 * on battery), render fewer pixels; when it recovers, step back up. Measured over windows of about two
 * seconds, with hysteresis: one slow window steps down, three good windows in a row step up, so a single
 * hitch (loading a model) can't make the picture pump. It never locks at the bottom.
 */
export const ADAPT = {
  /** Seconds of frames per decision. */
  window: 2,
  /** Below this average, step down. */
  slowFps: 45,
  /** At or above this average for `goodWindows` windows in a row, step up. */
  goodFps: 55,
  goodWindows: 3,
  step: 0.05,
  /** Below about 0.6 the room turns to mush, and on a busy GPU it barely helps (iteration 56): Low quality does more. */
  min: 0.6,
};

/**
 * Frame rate of a window from its median frame time, not its average (iteration 56): a few long frames caused by
 * something else on the machine (a live wallpaper, another tab) shouldn't make the game cut its own resolution.
 */
export function medianFps(frameSeconds: number[]): number {
  if (!frameSeconds.length) return 0;
  const s = [...frameSeconds].sort((a, b) => a - b);
  const m = s[Math.floor(s.length / 2)]!;
  return m > 0 ? 1 / m : 0;
}

/** Frames per second the game draws at most. Faster screens (120, 144, 240 Hz) only spend the GPU on frames nobody needs. */
export const FPS_CAP = 60;

/**
 * Whether to draw on this screen refresh (iteration 56): when at least one cap interval has passed since the
 * last drawn frame, less half a refresh, so it lands on the nearest refresh instead of the one after.
 * 60 Hz → every refresh; 120 Hz → every 2nd (60 fps); 144 Hz → every 2nd (72); 240 Hz → every 4th (60).
 * Measured by time, not by counting refreshes: a refresh the browser skips while drawing doesn't push it to 48.
 */
export function shouldDraw(sinceLastMs: number, refreshMs: number, cap = FPS_CAP): boolean {
  const r = refreshMs > 0 ? Math.min(refreshMs, 1000 / cap) : 0;
  return sinceLastMs >= 1000 / cap - r / 2;
}

export interface AdaptState {
  scale: number;
  goodStreak: number;
}

/** The next resolution scale after one measuring window with this average frame rate. */
export function adapt(state: AdaptState, fps: number, max: number): AdaptState {
  // Above 1 (a high-density screen on High), bigger steps: from 2 down to 1 takes a few windows, not twenty.
  const step = state.scale > 1 ? Math.max(ADAPT.step, round(state.scale * 0.12)) : ADAPT.step;
  if (fps < ADAPT.slowFps) return { scale: Math.max(ADAPT.min, round(state.scale - step)), goodStreak: 0 };
  if (fps < ADAPT.goodFps) return { scale: state.scale, goodStreak: 0 };
  const goodStreak = state.goodStreak + 1;
  if (goodStreak >= ADAPT.goodWindows && state.scale < max) return { scale: Math.min(max, round(state.scale + ADAPT.step)), goodStreak: 0 };
  return { scale: state.scale, goodStreak };
}

const round = (x: number) => Math.round(x * 100) / 100;

/**
 * Automatic quality (iteration 54): two measuring windows in a row under this frame rate step the graphics
 * quality down one level (High → Medium → Low), unless the player chose a quality themselves. Fewer pixels
 * alone can't rescue a GPU that struggles with the shadows and the ambient occlusion.
 */
export const QUALITY_DOWN_FPS = 30;

export function qualityStep(slowStreak: number, fps: number): { slowStreak: number; down: boolean } {
  if (fps >= QUALITY_DOWN_FPS) return { slowStreak: 0, down: false };
  const n = slowStreak + 1;
  return n >= 2 ? { slowStreak: 0, down: true } : { slowStreak: n, down: false };
}
