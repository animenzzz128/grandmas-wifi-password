/** Thin client for the server API. Responses are checked against the shared zod contract. */
import { AskResponse, DailyInfo, GuessResponse, HealthResponse, ItemResponse, PublicScene, RunView } from "@gwp/engine";
import type { z } from "zod";
import { t } from "./strings.ts";

async function request<T extends z.ZodType>(schema: T, path: string, payload?: unknown): Promise<z.infer<T>> {
  let res: Response;
  try {
    res = await fetch(path, payload === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  } catch {
    throw new Error(t("error.network"));
  }
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errorMessage(res.status, (json as { error?: unknown }).error));
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    if (import.meta.env.DEV) console.warn(`unexpected response from ${path}`, parsed.error);
    throw new Error(t("error.server"));
  }
  return parsed.data;
}

/**
 * What to tell the player when a request fails. Our server's 4xx messages are written for players
 * ("Too many questions. Grandma needs a breather."), so they pass through; anything else (a proxy's
 * HTML page, a crash) becomes one plain sentence.
 */
export function errorMessage(status: number, serverMessage: unknown): string {
  if (status < 500 && typeof serverMessage === "string" && serverMessage.trim() && serverMessage.length < 200) return serverMessage;
  return t("error.server");
}

export const api = {
  health: () => request(HealthResponse, "/api/health"),
  scene: (id: string) => request(PublicScene, `/api/scenes/${id}`),
  daily: () => request(DailyInfo, "/api/daily"),
  createRun: (difficulty: "easy" | "medium" | "hard", relaxed = false) => request(RunView, "/api/runs", { difficulty, relaxed }),
  createDaily: (relaxed = false) => request(RunView, "/api/runs", { daily: true, relaxed }),
  ask: (runId: string, text: string, voice?: { confidence: number }) => request(AskResponse, `/api/runs/${runId}/ask`, voice ? { text, voice } : { text }),
  show: (runId: string, objectId: string, text?: string) => request(AskResponse, `/api/runs/${runId}/show`, { objectId, text }),
  cookie: (runId: string) => request(ItemResponse, `/api/runs/${runId}/item`, { item: "cookie" }),
  glasses: (runId: string) => request(ItemResponse, `/api/runs/${runId}/item`, { item: "glasses" }),
  guess: (runId: string, parts: string[]) => request(GuessResponse, `/api/runs/${runId}/guess`, { parts }),
};
