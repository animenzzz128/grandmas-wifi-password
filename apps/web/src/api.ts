/** Thin client for the server API. Responses are checked against the shared zod contract. */
import { AskResponse, GuessResponse, HealthResponse, ItemResponse, PublicScene, RunView } from "@gwp/engine";
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
  if (!res.ok) throw new Error((json as { error?: string }).error ?? res.statusText);
  return schema.parse(json);
}

export const api = {
  health: () => request(HealthResponse, "/api/health"),
  scene: (id: string) => request(PublicScene, `/api/scenes/${id}`),
  createRun: (difficulty: "easy" | "medium" | "hard", relaxed = false) => request(RunView, "/api/runs", { difficulty, relaxed }),
  ask: (runId: string, text: string) => request(AskResponse, `/api/runs/${runId}/ask`, { text }),
  show: (runId: string, objectId: string, text?: string) => request(AskResponse, `/api/runs/${runId}/show`, { objectId, text }),
  cookie: (runId: string) => request(ItemResponse, `/api/runs/${runId}/item`, { item: "cookie" }),
  guess: (runId: string, parts: string[]) => request(GuessResponse, `/api/runs/${runId}/guess`, { parts }),
};
