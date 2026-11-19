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
  EventRequest,
  GuessRequest,
  ItemRequest,
  fill,
  maybeMishear,
  wearGlasses,
  RULES,
  ShowRequest,
  asksForPassword,
  asksForHarm,
  mentionsSelfHarm,
  costUsd,
  notEnglish,
  checkGuessParts,
  stallNudge,
  varyOpener,
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
  isGibberish,
  recipeById,
  rng,
  spendStamina,
  toPublicScene,
  toRunView,
  VoiceRequest,
  discoverTopics,
  noteText,
  pickTopicFact,
  topicById,
  topicReadable,
  worldTopics,
  callMichael,
} from "@gwp/engine";
import type { AskRequest as AskBody, AskResponse, GrandmaWorld, GuessResponse, ItemResponse, LookResponse, Recipe, RunState, TurnInput } from "@gwp/engine";
import type { GameData } from "./data.ts";
import type { GrandmaBrain } from "./grandma.ts";
import type { RunStore } from "./store.ts";
import { VoiceUnavailable } from "./voice.ts";

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
  /** Sites allowed to show the game in a frame, e.g. ["https://itch.io", "https://*.itch.zone"]. Default: none. */
  embedOrigins?: string[];
  /** Grandma's spoken voice (ElevenLabs). Without it the client uses the browser's voice. */
  voice?: { say(text: string, mood: string): Promise<Uint8Array> };
  /** Per-IP voice requests per minute (default 40). */
  voicePerMinute?: number;
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
        // Nobody may frame the game, unless EMBED_ORIGINS lists who may (an itch.io page; design plan F2).
        frameAncestors: deps.embedOrigins?.length ? deps.embedOrigins : ["'none'"],
      },
      // X-Frame-Options can only say "same site" or "no one", so it's left off when embedding is allowed.
      xFrameOptions: deps.embedOrigins?.length ? false : "SAMEORIGIN",
      // Voice input needs the microphone on this site only.
      permissionsPolicy: { microphone: ["self"], camera: [], geolocation: [] },
    }),
  );
  app.use(
    "/api/*",
    bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: "That's far too long for Grandma." }, 413) }),
  );

  /**
   * A canned line from a bank: each bank starts somewhere random for the visit and then goes round in order, so
   * the same line doesn't come up twice before the others have (review 3, F6: one deflection three times running).
   */
  const lineFor = (run: RunState, bank: readonly string[], salt: string) => {
    if (bank.length <= 1) return bank[0] ?? "";
    const turns = (run.lineTurns ??= {});
    const start = Math.floor(rng(hashString(`${run.id}:${salt}`))() * bank.length);
    const n = turns[salt] ?? 0;
    turns[salt] = n + 1;
    return bank[(start + n) % bank.length]!;
  };

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
    return c.json({ ok: true, grandmaMode: brain.mode, model: brain.model, ...(degraded ? { degraded } : {}), voice: deps.voice ? "elevenlabs" : "browser" });
  });

  // Grandma's lines, spoken (iteration 53). Only lines she said in this visit, or her canned reactions.
  const reactions = new Set(Object.entries(data.strings.ui).filter(([k]) => k.startsWith("bark.")).map(([, v]) => v));
  const limitVoice = rateLimiter(deps.voicePerMinute ?? 40, "Grandma needs a sip of tea before she says more.");
  app.post("/api/runs/:id/voice", async (c) => {
    if (!deps.voice) throw new HttpError(404, "Grandma's voice isn't set up here.");
    limitVoice(clientIp(c));
    const req = await body(c, VoiceRequest);
    const { run } = loadRun(c.req.param("id"));
    const said = new Set(run.history.filter((t) => t.role === "grandma").map((t) => t.text));
    if (!req.lines.every((l) => said.has(l) || reactions.has(l))) throw new HttpError(400, "Grandma never said that.");
    try {
      const audio = await deps.voice.say(req.lines.join(" "), req.mood ?? "happy");
      return c.body(audio as unknown as ArrayBuffer, 200, { "content-type": "audio/mpeg", "cache-control": "private, max-age=86400" });
    } catch (err) {
      if (err instanceof VoiceUnavailable) throw new HttpError(429, "Grandma's voice is resting. Her words are on screen.");
      throw err;
    }
  });

  /** The sticky notes to choose from (title screen). Only what the player reads anyway: no answers. */
  app.get("/api/notes", (c) => {
    const world = data.worlds.get("rosie") ?? [...data.worlds.values()][0];
    if (!world) throw new HttpError(404, "No Grandmas available.");
    const order = { easy: 0, medium: 1, hard: 2, expert: 3 } as const;
    const notes = [...world.recipes]
      .sort((a, b) => order[a.difficulty] - order[b.difficulty])
      .map((r) => ({ id: r.id, difficulty: r.difficulty, text: r.smudged_text ?? r.note_text }));
    return c.json({ notes });
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
    let recipe!: Recipe;
    let daily: number | undefined;
    if (req.daily) {
      const t = today();
      ({ world, recipe } = t);
      daily = t.d.number;
    } else {
      world = data.worlds.get(req.grandmaId ?? "rosie") ?? [...data.worlds.values()][0];
      if (!world) throw new HttpError(404, "No Grandmas available.");
    }
    const id = randomUUID();
    if (!req.daily) {
      const w = world!;
      // Each difficulty has several puzzles; a visit gets one at random, avoiding the one just played (design plan D1).
      const pinned = req.recipeId ? recipeById(w, req.recipeId) : undefined;
      if (req.recipeId && !pinned) throw new HttpError(404, "No such puzzle.");
      const pool = w.recipes.filter((r) => r.difficulty === (req.difficulty ?? "easy"));
      const last = req.after ? store.get(req.after)?.recipeId : undefined;
      const fresh = pool.filter((r) => r.id !== last);
      recipe = pinned ?? (fresh.length ? pick(fresh, rng(hashString(id))) : pool[0]) ?? w.recipes[0]!;
    }
    const sceneId = data.sceneForWorld.get(world.id);
    if (!sceneId) throw new HttpError(404, `No room for ${world.id}.`);
    // Everyone gets the same greeting on the same daily.
    const greeting = pick(lines.greeting, rng(hashString(daily ? `daily:${daily}` : id)));
    const run = createRunState({ id, world, recipe, sceneId, greeting, relaxed: req.relaxed, daily });
    store.save(run);
    // The top of the play funnel (design plan E3): when each visit started, and which puzzle.
    store.log({ ts: new Date().toISOString(), runId: id, worldId: world.id, recipeId: recipe.id, kind: "start", input: "", stamina: run.stamina, status: run.status, ...(daily ? { daily } : {}) });
    return c.json(view(run, world, recipe));
  });

  /** Browser-only steps of the play funnel: read the note, inspect an object, pin, open the notebook, share. */
  // Pick a visit up again after a reload (iteration 56). The visit id is the key, as for every other call.
  app.get("/api/runs/:id", (c) => {
    limitActions(clientIp(c));
    const { run, world, recipe } = loadRun(c.req.param("id"));
    requirePlaying(run);
    const history = run.history.map((t) => ({ role: t.role, text: t.text, ...(t.mood ? { mood: t.mood } : {}) }));
    return c.json({ run: view(run, world, recipe), history });
  });

  app.post("/api/runs/:id/event", async (c) => {
    limitActions(clientIp(c));
    const req = await body(c, EventRequest);
    const { run, world, recipe } = loadRun(c.req.param("id"));
    const scene = data.scenes.get(run.sceneId);
    const objectId = req.kind === "inspect" && scene?.interactables.some((i) => i.id === req.objectId) ? req.objectId : undefined;
    const key = `${req.kind}:${objectId ?? ""}`;
    // Each event once per visit, so repeating one can't grow the log.
    if (!(run.events ?? []).includes(key)) {
      run.events = [...(run.events ?? []), key];
      store.save(run);
      store.log({ ts: new Date().toISOString(), runId: run.id, worldId: world.id, recipeId: recipe.id, kind: "event", event: req.kind, ...(objectId ? { objectId } : {}), input: "", stamina: run.stamina, status: run.status, ...(run.daily ? { daily: run.daily } : {}) });
    }
    return c.body(null, 204);
  });

  /**
   * Cards a text brings up (topics.ts): added to the visit, marked new, and returned as labels for the toast.
   */
  function unlockTopics(run: RunState, world: GrandmaWorld, text: string): string[] {
    const found = discoverTopics(world, text, run.topics ?? []);
    if (!found.length) return [];
    run.topics = [...(run.topics ?? []), ...found];
    run.freshTopics = [...(run.freshTopics ?? []), ...found];
    const labels = new Map(worldTopics(world).map((t) => [t.id, t.label]));
    return found.map((id) => labels.get(id) ?? id);
  }

  /** Looking closely at an object: names on it become topic cards. Free, and logged once like other events. */
  app.post("/api/runs/:id/look", async (c) => {
    limitActions(clientIp(c));
    const req = await body(c, EventRequest);
    const { run, world, recipe } = loadRun(c.req.param("id"));
    const scene = data.scenes.get(run.sceneId);
    const obj = scene?.interactables.find((i) => i.id === req.objectId);
    if (!obj) throw new HttpError(400, "There's nothing like that here.");
    return oneAtATime(run.id, () => {
      const newTopics = run.status === "playing" && obj.inspect_text ? unlockTopics(run, world, obj.inspect_text) : [];
      const key = `inspect:${obj.id}`;
      if (newTopics.length || !(run.events ?? []).includes(key)) {
        if (!(run.events ?? []).includes(key)) {
          run.events = [...(run.events ?? []), key];
          store.log({ ts: new Date().toISOString(), runId: run.id, worldId: world.id, recipeId: recipe.id, kind: "event", event: "inspect", objectId: obj.id, input: "", stamina: run.stamina, status: run.status, ...(run.daily ? { daily: run.daily } : {}) });
        }
        store.save(run);
      }
      const res: LookResponse = { newTopics, run: view(run, world, recipe) };
      return c.json(res);
    });
  });

  async function talk(c: Context, runId: string, input: TurnInput, voice?: { confidence: number }, card?: AskBody["topic"]): Promise<AskResponse> {
    limit(clientIp(c));
    const { run, world, recipe } = loadRun(runId);
    requirePlaying(run);
    if (run.questionCount >= RULES.maxQuestionsPerRun) throw new HttpError(409, lines.bedtime[0] ?? "Visit over.");

    const playerText = playerTurnText(input);
    const cost = questionCost(world, input.kind === "ask" ? input.text : (input.text ?? input.object.label), run.lastFactIds);
    /** A topic card's canned answer (smudged part, no date), instead of asking her brain. */
    let cardLine: { reply: string; mood: AskResponse["mood"]; free?: boolean } | undefined;
    if (card && input.kind === "ask") {
      if (!(run.topics ?? []).includes(card.id)) throw new HttpError(400, "You haven't heard about that yet, dear.");
      const topic = topicById(world, recipe, noteText(run, recipe).text, card.id);
      if (!topic) throw new HttpError(400, "You haven't heard about that yet, dear.");
      // A card follows up the last card: asking the same card again is cheaper, like any follow-up.
      // So is a card for something her last reply mentioned ("…Walt proposed…" → the proposal card).
      cost.followUp = card.id === run.lastTopic || (run.lastMentioned ?? []).includes(card.id) ? -RULES.followUpDiscount : 0;
      cost.total = Math.max(1, cost.base + cost.long + cost.rude + cost.followUp);
      if (!topicReadable(topic)) cardLine = { reply: lineFor(run, lines.smudged_card, "smudged"), mood: "confused", free: true };
      else {
        const picked = pickTopicFact(world, topic, card.mode, run.heard ?? [], run.heardWhen ?? []);
        if (picked.kind === "no_year") {
          cardLine = { reply: lineFor(run, lines.no_year, "noyear"), mood: "confused" };
          Object.assign(cost, { base: RULES.noYearCost, followUp: 0, total: RULES.noYearCost });
        } else if (picked.kind === "fact") {
          input.focus = { factId: picked.factId, mode: card.mode, ...(picked.repeat ? { repeat: true } : {}) };
          if (picked.repeat) Object.assign(cost, { base: RULES.retellCost, long: 0, followUp: 0, total: RULES.retellCost + cost.rude });
        }
      }
      run.freshTopics = (run.freshTopics ?? []).filter((id) => id !== card.id);
    }

    let reply: string;
    let mood: AskResponse["mood"];
    let factIds: string[] = [];
    /** The reply came from her brain (model or mock), not a canned line. */
    let fromBrain = false;
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
    } else if (cardLine) {
      reply = cardLine.reply;
      mood = cardLine.mood;
      if (cardLine.free) free = true;
    } else if (!card && asksForPassword(said)) {
      reply = lineFor(run, lines.password_deflect, "pw");
      mood = "suspicious";
    } else if (!card && lines.harm && asksForHarm(said)) {
      // How to make something dangerous or hurt someone: a firm no in her voice, no model call (iteration 62).
      reply = lineFor(run, lines.harm, "harm");
      mood = "worried";
    } else if (!card && input.kind === "ask" && lines.gibberish && isGibberish(input.text)) {
      // A keyboard mash: she asks again, free, like a mishearing (iteration 56). No model call, no facts.
      reply = lineFor(run, lines.gibberish, "gibberish");
      mood = "confused";
      free = true;
    } else if (!card && input.kind === "ask" && lines.rude && cost.rude > 0) {
      // Rude words at her: an answer in character, not a memory as if nothing happened. The penalty stands.
      reply = lineFor(run, lines.rude, "rude");
      mood = "suspicious";
    } else {
      fromBrain = true;
      const result = await brain.reply({ world, recipe, run, input, lines });
      // She lost her train of thought (the model failed or every try was rejected): the player shouldn't pay for that.
      // Only up to a point, though: questions built to fail every check would otherwise buy model calls for nothing
      // (security review B). Past the limit a fallback is charged and counted like any question.
      if (result.fallback && (run.freeFallbacks ?? 0) < RULES.maxFreeFallbacks) {
        free = true;
        run.freeFallbacks = (run.freeFallbacks ?? 0) + 1;
      }
      // A catchphrase she just used doesn't open this reply too (docs/14, P6). Cutting a leading phrase adds nothing.
      reply = varyOpener(
        result.output.reply,
        run.history.filter((t) => t.role === "grandma").map((t) => t.text),
        world.profile.verbal_tics,
      );
      mood = result.output.mood;
      factIds = result.output.fact_ids_used;
      // The mock says "I told you that one already" itself only through the prompt; say it here for both.
      if (input.kind === "ask" && input.focus?.repeat && !result.fallback && brain.mode === "mock") reply = `${lineFor(run, lines.repeat, "repeat")} ${reply}`;
      meta = {
        latencyMs: result.latencyMs,
        attempts: result.attempts,
        validatorErrors: result.validatorErrors.length ? result.validatorErrors : undefined,
        fallback: result.fallback || undefined,
        usage: result.usage,
        costUsd: result.usage ? costUsd(result.usage) : undefined,
      };
    }

    // She told no memory at all (didn't know, small talk): it costs less than a question that got one (review 2, F4).
    if (fromBrain && !free && !card && input.kind === "ask" && !factIds.length && cost.base > RULES.noFactCost) {
      cost.base = RULES.noFactCost;
      cost.total = Math.max(1, cost.base + cost.long + cost.rude + cost.followUp);
    }
    run.history.push(
      { role: "player", text: misheard ? typedText(misheard.heard) : playerText, objectId: input.kind === "show" ? input.object.id : undefined },
      { role: "grandma", text: reply, factIds, mood },
    );
    if (factIds.length) run.lastFactIds = factIds;
    run.heard = [...new Set([...(run.heard ?? []), ...factIds])];
    if (input.kind === "ask" && input.focus?.mode === "when" && factIds.includes(input.focus.factId)) run.heardWhen = [...new Set([...(run.heardWhen ?? []), input.focus.factId])];
    run.lastTopic = card?.id;
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
    // Names she just said become topic cards.
    const newTopics = unlockTopics(run, world, [reply, after ?? "", nudge ?? ""].join(" "));
    run.lastMentioned = discoverTopics(world, reply, []);
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
    return { reply, mood: napped ? "sleepy" : mood, cost: cost.total, costParts: free ? undefined : costParts, napped, after, nudge, misheard, ...(newTopics.length ? { newTopics } : {}), run: view(run, world, recipe) };
  }

  app.post("/api/runs/:id/ask", async (c) => {
    const req = await body(c, AskRequest);
    const id = c.req.param("id");
    return c.json(await oneAtATime(id, () => talk(c, id, { kind: "ask", text: req.text }, req.topic ? undefined : req.voice, req.topic)));
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
      if (req.item === "phone") {
        // Uncle Michael on the hall phone (from the Godot edition): one of the note's nudges, twice a visit, free.
        // His words aren't Grandma's, so they stay out of her conversation history.
        const call = callMichael(run, recipe);
        if ("none" in call) {
          return c.json({ line: lineFor(run, lines.phone_none, "phone"), who: "michael", run: view(run, world, recipe) } satisfies ItemResponse);
        }
        // He's quoting her, so her words sit in inner quotes (review F14: the voices ran together).
        line = `${lineFor(run, lines.phone_lead, "phone")} ‘${call.hint}’”`;
        const newTopics = unlockTopics(run, world, call.hint);
        store.save(run);
        store.log({ ts: new Date().toISOString(), runId: run.id, worldId: world.id, recipeId: recipe.id, kind: "item", input: "phone", reply: line, stamina: run.stamina, status: run.status, ...(run.daily ? { daily: run.daily } : {}) });
        return c.json({ line, who: "michael", ...(newTopics.length ? { newTopics } : {}), run: view(run, world, recipe) } satisfies ItemResponse);
      }
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
    const res: GuessResponse = { correct, line, partsCorrect: partial?.partsCorrect, partsTotal: partial?.partsTotal, partsRight: partial?.partsRight, run: view(run, world, recipe) };
    return c.json(res);
  }

  return app;
}
