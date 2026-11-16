/**
 * Browser storage that never throws. With cookies blocked (or in some private modes) even reading
 * `localStorage` throws, which used to blank the title screen and stop the game from loading
 * (review, iteration 39). Here every read and write is guarded; when the browser refuses, values are
 * kept in memory for this tab instead, so settings, mute and the daily record still work until reload.
 */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

export function safeStorage(get: () => KeyValueStore | undefined = () => globalThis.localStorage): KeyValueStore {
  const memory = new Map<string, string>();
  return {
    getItem(key) {
      try {
        const store = get();
        if (store) return store.getItem(key);
      } catch {
        // blocked: fall through to memory
      }
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      memory.set(key, value);
      try {
        get()?.setItem(key, value);
      } catch {
        // blocked or full: memory keeps it for this tab
      }
    },
  };
}

/** The app's storage. */
export const storage = safeStorage();
