/**
 * HTTP API (technical design §4). All rules run here; clients only send actions and render RunView.
 */
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import type { Context } from "hono";
import type { z } from "zod";
import {
  AskRequest,
  CreateRunRequest,
  GuessRequest,
  ItemRequest,
  fill,
  maybeMishear,
  wearGlasses,
  RULES,
  ShowRequest,
  asksForPassword,
  mentionsSelfHarm,
  costUsd,
  notEnglish,
  checkGuessParts,
  stallNudge,
  checkGuess,
  createRunState,
  endAtQuestionCap,
  DAILY_STATS_MIN,
  dailyPick,
  secondsToNextDaily,
  giveCookie,
  hashString,
  pick,
  playerTurnText,
  typedText,
  questionCost,
  recipeById,
  rng,
  spendStamina,
  toPublicScene,
  toRunView,
} from "@gwp/engine";
import type { AskResponse, GrandmaWorld, GuessResponse, ItemResponse, Recipe, RunState, TurnInput } from "@gwp/engine";
import type { GameData } from "./data.ts";
import type { GrandmaBrain } from "./grandma.ts";
import type { RunStore } from "./store.ts";

export interface AppDeps {
  data: GameData;
  brain: GrandmaBrain;
  store: RunStore;
  asksPerMinute: number;
  /** Per-IP asks per day (default 300). */
  asksPerDay?: number;
  /** Per-IP new visits per minute (default 10). */
  runsPerMinute?: number;
  /** Per-IP guesses and item uses per minute (default 60). */
  actionsPerMinute?: number;
  /** Questions per minute from everyone together (default 120). */
  serverAsksPerMinute?: number;
  /** Clock for the Daily Grandma (tests). */
  now?: () => Date;
}

/** Largest request body accepted. The biggest real one is a 280-character question. */
export const MAX_BODY_BYTES = 8 * 1024;

class HttpError extends Error {
  constructor(
    public status: 400 | 404 | 409 | 413 | 429,
    message: string,
  ) {
    super(message);
  }
}

async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    json = {};
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  return parsed.data;
}

/** Simple fixed-window limiter per client IP, for the endpoints that cost API money. */
/**
 * The client's address for rate limits. On Fly.io the proxy sets Fly-Client-IP (trustworthy); elsewhere
 * fall back to the first X-Forwarded-For hop, which a client can spoof, so limits are best-effort there.
 */
export function clientIp(c: Context): string {
  return limitKey(c.req.header("fly-client-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local");
}

/**
 * The key an address is limited under. An IPv6 user usually holds a whole /64 (2^64 addresses), so each
 * /64 counts as one client; IPv4 addresses count one by one (security review B).
 */
export function limitKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  const bare = ip.replace(/^\[|\](:\d+)?$/g, "").split("%")[0]!.toLowerCase();
  if (/^::ffff:\d+\.\d+\.\d+\.\d+$/.test(bare)) return bare.slice(7); // IPv4 written as IPv6
  const [head = "", tail] = bare.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = tail === undefined ? left : [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "") || "0").join(":")}::/64`;
}

/** Per-IP cap per UTC day (eval plan / technical design §4: 300 asks a day). */
function dailyCap(perDay: number, message: string) {
  const hits = new Map<string, { day: string; count: number }>();
  return (key: string) => {
    const day = new Date().toISOString().slice(0, 10);
    const h = hits.get(key);
    if (!h || h.day !== day) hits.set(key, { day, count: 1 });
    else if (++h.count > perDay) throw new HttpError(429, message);
  };
}

function rateLimiter(perMinute: number, message = "Too many questions. Grandma needs a breather.") {
  const hits = new Map<string, { windowStart: number; count: number }>();
  return (key: string) => {
    const now = Date.now();
    const h = hits.get(key);
    if (!h || now - h.windowStart > 60_000) {
      hits.set(key, { windowStart: now, count: 1 });
      return;
    }
    h.count += 1;
    if (h.count > perMinute) throw new HttpError(429, message);
  };
}

export function createApp(deps: AppDeps) {
  const { data, brain, store } = deps;
  const lines = data.strings.grandma;
  const limitAsks = rateLimiter(deps.asksPerMinute);
  const limitDay = dailyCap(deps.asksPerDay ?? 300, "Grandma has talked enough for today. Come back tomorrow.");
  const limitRuns = rateLimiter(deps.runsPerMinute ?? 10, "Slow down, sweetheart. One visit at a time.");
  // All players together: whatever the addresses, spend can't outrun this (security review B).
  const limitServer = rateLimiter(deps.serverAsksPerMinute ?? 120, "Grandma has a lot of visitors right now. Try again in a minute, dear.");
  const limit = (ip: string) => {
    limitAsks(ip);
    limitDay(ip);
    limitServer("all");
  };
  // Guesses and items cost no model money but write to disk; a person never needs more than a few a minute.
  const limitActions = rateLimiter(deps.actionsPerMinute ?? 60, "Slow down, sweetheart.");
  /** Runs with a request being handled. One at a time per run, so parallel requests can't skip the rules. */
  const busy = new Set<string>();
  async function oneAtATime<T>(runId: string, work: () => Promise<T> | T): Promise<T> {
    if (busy.has(runId)) throw new HttpError(409, "Grandma's still answering. One thing at a time, dear.");
    busy.add(runId);
    try {
      return await work();
    } finally {
      busy.delete(runId);
    }
  }
  const app = new Hono();
  // Security headers on every response, the built web client included (security review P3). The game loads
  // nothing from other sites; three.js turns embedded textures into blob: URLs, and React sets inline styles.
  // The model loader decodes meshes with WebAssembly, which needs 'wasm-unsafe-eval' (it doesn't allow JS eval).
  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "data:", "blob:"],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
      // Voice input needs the microphone on this site only.
      permissionsPolicy: { microphone: ["self"], camera: [], geolocation: [] },
    }),
  );
  app.use(
    "/api/*",
    bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: "That's far too long for Grandma." }, 413) }),
  );

  const lineFor = (run: RunState, bank: readonly string[], salt: string) =>
    pick(bank, rng(hashString(`${run.id}:${run.questionCount}:${run.guesses.length}:${salt}`)));

  function loadRun(id: string): { run: RunState; world: GrandmaWorld; recipe: Recipe } {
    const run = store.get(id);
    if (!run) throw new HttpError(404, "No such visit.");
    const world = data.worlds.get(run.worldId);
    const recipe = world && recipeById(world, run.recipeId);
    if (!world || !recipe) throw new HttpError(404, "This Grandma is no longer available.");
    return { run, world, recipe };
  }

  function requirePlaying(run: RunState) {
    if (run.status !== "playing") throw new HttpError(409, lines.run_over[0] ?? "The visit is over.");
  }

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: "Something went wrong." }, 500);
  });

  app.get("/api/health", (c) => {
    const degraded = (brain as { degraded?: "budget" | "kill" }).degraded;
    return c.json({ ok: true, grandmaMode: brain.mode, model: brain.model, ...(degraded ? { degraded } : {}) });
  });

  app.get("/api/scenes/:id", (c) => {
    const scene = data.scenes.get(c.req.param("id"));
    if (!scene) throw new HttpError(404, "No such scene.");
    return c.json(toPublicScene(scene));
  });

  const now = () => (deps.now ? deps.now() : new Date());
  const today = () => {
    const d = dailyPick(data.worlds.values(), now());
    if (!d) throw new HttpError(404, "No Grandmas available.");
    const world = data.worlds.get(d.worldId)!;
    return { d, world, recipe: recipeById(world, d.recipeId)! };
  };

  /** The player's view of a run. A daily that wasn't solved keeps its password secret until the next daily. */
  const view = (run: RunState, world: GrandmaWorld, recipe: Recipe) => {
    const secret = run.daily !== undefined && run.status !== "solved" && dailyPick(data.worlds.values(), now())?.number === run.daily;
    return toRunView(run, world, recipe, { hidePassword: secret });
  };

  app.get("/api/daily", (c) => {
    const { d, world } = today();
    const stats = store.dailyStats(d.number);
    return c.json({
      number: d.number,
      date: d.date,
      grandma: { name: world.profile.name, nickname: world.profile.nickname },
      difficulty: d.difficulty,
      resetsInSeconds: secondsToNextDaily(now()),
      ...(stats.finished >= DAILY_STATS_MIN ? { stats } : {}),
    });
  });

  app.post("/api/runs", async (c) => {
    limitRuns(clientIp(c));
    const req = await body(c, CreateRunRequest);
    let world: GrandmaWorld | undefined;
    let recipe: Recipe;
    let daily: number | undefined;
    if (req.daily) {
      const t = today();
      ({ world, recipe } = t);
      daily = t.d.number;
    } else {
      world = data.worlds.get(req.grandmaId ?? "rosie") ?? [...data.worlds.values()][0];
      if (!world) throw new HttpError(404, "No Grandmas available.");
      recipe = world.recipes.find((r) => r.difficulty === (req.difficulty ?? "easy")) ?? world.recipes[0]!;
    }
    const sceneId = data.sceneForWorld.get(world.id);
    if (!sceneId) throw new HttpError(404, `No room for ${world.id}.`);
    const id = randomUUID();
    // Everyone gets the same greeting on the same daily.
    const greeting = pick(lines.greeting, rng(hashString(daily ? `daily:${daily}` : id)));
    const run = createRunState({ id, world, recipe, sceneId, greeting, relaxed: req.relaxed, daily });
    store.save(run);
    return c.json(view(run, world, recipe));
  });

  async function talk(c: Context, runId: string, input: TurnInput, voice?: { confidence: number }): Promise<AskResponse> {
    limit(clientIp(c));
    const { run, world, recipe } = loadRun(runId);
    requirePlaying(run);
    if (run.questionCount >= RULES.maxQuestionsPerRun) throw new HttpError(409, lines.bedtime[0] ?? "Visit over.");

    const playerText = playerTurnText(input);
    const cost = questionCost(world, input.kind === "ask" ? input.text : (input.text ?? input.object.label), run.lastFactIds);

    let reply: string;
    let mood: AskResponse["mood"];
    let factIds: string[] = [];
    let meta: Partial<Parameters<RunStore["log"]>[0]> = {};
    /** Turns that are Grandma's fault, not the player's, cost no tea and don't count: mishears and fallbacks. */
    let free = false;
    // What the player typed, also when they show an object with a question (security review F).
    const said = input.kind === "ask" ? input.text : (input.text ?? "");
    if (mentionsSelfHarm(said)) {
      // Safety first, and free: no model call, no tea, no question counted.
      const reply = lines.crisis[0] ?? "";
      run.history.push({ role: "player", text: playerText }, { role: "grandma", text: reply, mood: "worried" });
      store.save(run);
      return { reply, mood: "worried", cost: 0, napped: false, run: view(run, world, recipe) };
    }
    if (said && notEnglish(said)) {
      const reply = lineFor(run, lines.pardon, "pardon");
      run.history.push({ role: "player", text: playerText }, { role: "grandma", text: reply, mood: "confused" });
      store.save(run);
      return { reply, mood: "confused", cost: 0, napped: false, run: view(run, world, recipe) };
    }
    // Voice mode: she may mishear one word (a capped rule, after the safety checks above).
    // She reacts to what she heard with a canned line: no model call and no facts, so the free turn gives nothing away.
    const misheard = input.kind === "ask" ? maybeMishear(run, input.text, voice?.confidence, data.strings.mishears) : undefined;
    if (misheard) {
      const as = misheard.as;
      reply = fill(lineFor(run, lines.misheard, "mishear"), { as, As: as.charAt(0).toUpperCase() + as.slice(1) });
      mood = "confused";
    } else if (asksForPassword(said)) {
      reply = lineFor(run, lines.password_deflect, "pw");
      mood = "suspicious";
    } else {
      const result = await brain.reply({ world, recipe, run, input, lines });
      // She lost her train of thought (the model failed or every try was rejected): the player shouldn't pay for that.
      // Only up to a point, though: questions built to fail every check would otherwise buy model calls for nothing
      // (security review B). Past the limit a fallback is charged and counted like any question.
      if (result.fallback && (run.freeFallbacks ?? 0) < RULES.maxFreeFallbacks) {
        free = true;
        run.freeFallbacks = (run.freeFallbacks ?? 0) + 1;
      }
      reply = result.output.reply;
      mood = result.output.mood;
      factIds = result.output.fact_ids_used;
      meta = {
        latencyMs: result.latencyMs,
        attempts: result.attempts,
        validatorErrors: result.validatorErrors.length ? result.validatorErrors : undefined,
        fallback: result.fallback || undefined,
        usage: result.usage,
        costUsd: result.usage ? costUsd(result.usage) : undefined,
      };
    }

    run.history.push(
      { role: "player", text: misheard ? typedText(misheard.heard) : playerText, objectId: input.kind === "show" ? input.object.id : undefined },
      { role: "grandma", text: reply, factIds, mood },
    );
    if (factIds.length) run.lastFactIds = factIds;
    // Her ears' (or her memory's) fault, not the player's: a misheard question or a fallback costs no tea.
    if (misheard) free = true;
    if (free) Object.assign(cost, { total: 0, base: 0, long: 0, rude: 0, followUp: 0 });
    const spent = spendStamina(run, cost.total);
    const napped = spent.napped;
    if (free) run.questionCount -= 1; // nor does it count against her star rating
    // The 40th question ends the visit (also in relaxed mode, where the tea never runs out).
    const bedtime = spent.bedtime || endAtQuestionCap(run);
    const after = bedtime ? lineFor(run, lines.bedtime, "bed") : napped ? lineFor(run, lines.nap, "nap") : undefined;
    if (after) run.history.push({ role: "grandma", text: after, mood: "sleepy" });
    // Stuck for a few turns? Grandma brings up the first hop herself (not while she's dozing off).
    const nudge = !after && !free && run.status === "playing" ? stallNudge(run, world, recipe, factIds) : undefined;
    if (nudge) run.history.push({ role: "grandma", text: nudge, mood: "nostalgic" });
    store.save(run);
    store.log({
      ts: new Date().toISOString(),
      runId: run.id,
      worldId: world.id,
      recipeId: recipe.id,
      kind: input.kind,
      input: playerText,
      reply,
      factIds,
      cost: cost.total,
      stamina: run.stamina,
      status: run.status,
      grandmaMode: brain.mode,
      ...(run.daily ? { daily: run.daily } : {}),
      ...meta,
    });
    const costParts = { base: cost.base, long: cost.long, rude: cost.rude, followUp: cost.followUp };
    return { reply, mood: napped ? "sleepy" : mood, cost: cost.total, costParts: free ? undefined : costParts, napped, after, nudge, misheard, run: view(run, world, recipe) };
  }

  app.post("/api/runs/:id/ask", async (c) => {
    const req = await body(c, AskRequest);
    const id = c.req.param("id");
    return c.json(await oneAtATime(id, () => talk(c, id, { kind: "ask", text: req.text }, req.voice)));
  });

  app.post("/api/runs/:id/show", async (c) => {
    const req = await body(c, ShowRequest);
    const { run } = loadRun(c.req.param("id"));
    const scene = data.scenes.get(run.sceneId);
    const obj = scene?.interactables.find((i) => i.id === req.objectId && (i.kind === "clue" || i.kind === "cookie_jar"));
    if (!obj) throw new HttpError(400, "Grandma squints. She can't see that from here.");
    const turn: TurnInput = {
      kind: "show",
      object: { id: obj.id, label: obj.label, inspectText: obj.inspect_text ?? obj.label, factIds: obj.fact_ids ?? [] },
      text: req.text || undefined,
    };
    return c.json(await oneAtATime(run.id, () => talk(c, run.id, turn)));
  });

  app.post("/api/runs/:id/item", async (c) => {
    limitActions(clientIp(c));
    const req = await body(c, ItemRequest);
    const { run, world, recipe } = loadRun(c.req.param("id"));
    return oneAtATime(run.id, () => {
      requirePlaying(run);
      let line: string;
      let changed: boolean;
      if (req.item === "glasses") {
        const result = wearGlasses(run, recipe);
        changed = result === "on";
        line = lineFor(run, changed ? lines.glasses_on : lines.glasses_not_needed, "glasses");
      } else {
        const result = giveCookie(run);
        changed = result === "given";
        line = lineFor(run, result === "given" ? lines.cookie : result === "full" ? lines.cookie_full : lines.no_cookie, "cookie");
      }
      // Only real changes are saved and logged, so repeating a no-op can't fill the disk (security review C).
      if (changed) {
        run.history.push({ role: "grandma", text: line, mood: "happy" });
        store.save(run);
        store.log({ ts: new Date().toISOString(), runId: run.id, worldId: world.id, recipeId: recipe.id, kind: "item", input: req.item, reply: line, stamina: run.stamina, status: run.status, ...(run.daily ? { daily: run.daily } : {}) });
      }
      const res: ItemResponse = { line, run: view(run, world, recipe) };
      return c.json(res);
    });
  });

  app.post("/api/runs/:id/guess", async (c) => {
    limitActions(clientIp(c));
    const req = await body(c, GuessRequest);
    const { run, world, recipe } = loadRun(c.req.param("id"));
    return oneAtATime(run.id, () => guessTurn(c, req, run, world, recipe));
  });

  function guessTurn(c: Context, req: z.infer<typeof GuessRequest>, run: RunState, world: GrandmaWorld, recipe: Recipe) {
    requirePlaying(run);
    const partial = req.parts ? checkGuessParts(run, world, recipe, req.parts) : undefined;
    const correct = partial ? partial.correct : checkGuess(run, recipe, req.password!);
    const bank = correct ? lines.solved : run.status === "failed" ? lines.out_of_guesses : lines.wrong_guess;
    const line = lineFor(run, bank, "guess");
    run.history.push({ role: "grandma", text: line, mood: correct ? "happy" : "confused" });
    store.save(run);
    // Log only whether the guess was right, not the text, so logs never hold the password.
    store.log({ ts: new Date().toISOString(), runId: run.id, worldId: world.id, recipeId: recipe.id, kind: "guess", input: correct ? "(correct)" : "(wrong)", reply: line, stamina: run.stamina, status: run.status, ...(run.daily ? { daily: run.daily } : {}) });
    const res: GuessResponse = { correct, line, partsCorrect: partial?.partsCorrect, partsTotal: partial?.partsTotal, run: view(run, world, recipe) };
    return c.json(res);
  }

  return app;
}
