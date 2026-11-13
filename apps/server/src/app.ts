/**
 * HTTP API (technical design §4). All rules run here; clients only send actions and render RunView.
 */
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { Context } from "hono";
import type { z } from "zod";
import {
  AskRequest,
  CreateRunRequest,
  GuessRequest,
  ItemRequest,
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
  giveCookie,
  hashString,
  pick,
  playerTurnText,
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
}

class HttpError extends Error {
  constructor(
    public status: 400 | 404 | 409 | 429,
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
function clientIp(c: Context): string {
  return c.req.header("fly-client-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
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
  const limit = (ip: string) => {
    limitAsks(ip);
    limitDay(ip);
  };
  const app = new Hono();

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

  app.get("/api/health", (c) => c.json({ ok: true, grandmaMode: brain.mode, model: brain.model }));

  app.get("/api/scenes/:id", (c) => {
    const scene = data.scenes.get(c.req.param("id"));
    if (!scene) throw new HttpError(404, "No such scene.");
    return c.json(toPublicScene(scene));
  });

  app.post("/api/runs", async (c) => {
    limitRuns(clientIp(c));
    const req = await body(c, CreateRunRequest);
    const world = data.worlds.get(req.grandmaId ?? "rosie") ?? [...data.worlds.values()][0];
    if (!world) throw new HttpError(404, "No Grandmas available.");
    const recipe = world.recipes.find((r) => r.difficulty === (req.difficulty ?? "easy")) ?? world.recipes[0]!;
    const sceneId = data.sceneForWorld.get(world.id);
    if (!sceneId) throw new HttpError(404, `No room for ${world.id}.`);
    const id = randomUUID();
    const greeting = pick(lines.greeting, rng(hashString(id)));
    const run = createRunState({ id, world, recipe, sceneId, greeting, relaxed: req.relaxed });
    store.save(run);
    return c.json(toRunView(run, world, recipe));
  });

  async function talk(c: Context, runId: string, input: TurnInput): Promise<AskResponse> {
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
    if (input.kind === "ask" && mentionsSelfHarm(input.text)) {
      // Safety first, and free: no model call, no tea, no question counted.
      const reply = lines.crisis[0] ?? "";
      run.history.push({ role: "player", text: playerText }, { role: "grandma", text: reply, mood: "worried" });
      store.save(run);
      return { reply, mood: "worried", cost: 0, napped: false, run: toRunView(run, world, recipe) };
    }
    if (input.kind === "ask" && notEnglish(input.text)) {
      const reply = lineFor(run, lines.pardon, "pardon");
      run.history.push({ role: "player", text: playerText }, { role: "grandma", text: reply, mood: "confused" });
      store.save(run);
      return { reply, mood: "confused", cost: 0, napped: false, run: toRunView(run, world, recipe) };
    }
    if (input.kind === "ask" && asksForPassword(input.text)) {
      reply = lineFor(run, lines.password_deflect, "pw");
      mood = "suspicious";
    } else {
      const result = await brain.reply({ world, recipe, run, input, lines });
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
      { role: "player", text: playerText, objectId: input.kind === "show" ? input.object.id : undefined },
      { role: "grandma", text: reply, factIds, mood },
    );
    if (factIds.length) run.lastFactIds = factIds;
    const { napped, bedtime } = spendStamina(run, cost.total);
    const after = bedtime ? lineFor(run, lines.bedtime, "bed") : napped ? lineFor(run, lines.nap, "nap") : undefined;
    if (after) run.history.push({ role: "grandma", text: after, mood: "sleepy" });
    // Stuck for a few turns? Grandma brings up the first hop herself (not while she's dozing off).
    const nudge = !after && run.status === "playing" ? stallNudge(run, world, recipe, factIds) : undefined;
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
      ...meta,
    });
    const costParts = { base: cost.base, long: cost.long, rude: cost.rude, followUp: cost.followUp };
    return { reply, mood: napped ? "sleepy" : mood, cost: cost.total, costParts, napped, after, nudge, run: toRunView(run, world, recipe) };
  }

  app.post("/api/runs/:id/ask", async (c) => {
    const req = await body(c, AskRequest);
    return c.json(await talk(c, c.req.param("id"), { kind: "ask", text: req.text }));
  });

  app.post("/api/runs/:id/show", async (c) => {
    const req = await body(c, ShowRequest);
    const { run } = loadRun(c.req.param("id"));
    const scene = data.scenes.get(run.sceneId);
    const obj = scene?.interactables.find((i) => i.id === req.objectId && (i.kind === "clue" || i.kind === "cookie_jar"));
    if (!obj) throw new HttpError(400, "Grandma squints. She can't see that from here.");
    return c.json(
      await talk(c, run.id, {
        kind: "show",
        object: { id: obj.id, label: obj.label, inspectText: obj.inspect_text ?? obj.label, factIds: obj.fact_ids ?? [] },
        text: req.text || undefined,
      }),
    );
  });

  app.post("/api/runs/:id/item", async (c) => {
    await body(c, ItemRequest);
    const { run, world, recipe } = loadRun(c.req.param("id"));
    requirePlaying(run);
    const ok = giveCookie(run);
    const line = lineFor(run, ok ? lines.cookie : lines.no_cookie, "cookie");
    if (ok) run.history.push({ role: "grandma", text: line, mood: "happy" });
    store.save(run);
    store.log({ ts: new Date().toISOString(), runId: run.id, worldId: world.id, recipeId: recipe.id, kind: "item", input: "cookie", reply: line, stamina: run.stamina, status: run.status });
    const res: ItemResponse = { line, run: toRunView(run, world, recipe) };
    return c.json(res);
  });

  app.post("/api/runs/:id/guess", async (c) => {
    const req = await body(c, GuessRequest);
    const { run, world, recipe } = loadRun(c.req.param("id"));
    requirePlaying(run);
    const partial = req.parts ? checkGuessParts(run, world, recipe, req.parts) : undefined;
    const correct = partial ? partial.correct : checkGuess(run, recipe, req.password!);
    const bank = correct ? lines.solved : run.status === "failed" ? lines.out_of_guesses : lines.wrong_guess;
    const line = lineFor(run, bank, "guess");
    run.history.push({ role: "grandma", text: line, mood: correct ? "happy" : "confused" });
    store.save(run);
    // Log only whether the guess was right, not the text, so logs never hold the password.
    store.log({ ts: new Date().toISOString(), runId: run.id, worldId: world.id, recipeId: recipe.id, kind: "guess", input: correct ? "(correct)" : "(wrong)", reply: line, stamina: run.stamina, status: run.status });
    const res: GuessResponse = { correct, line, partsCorrect: partial?.partsCorrect, partsTotal: partial?.partsTotal, run: toRunView(run, world, recipe) };
    return c.json(res);
  });

  return app;
}
