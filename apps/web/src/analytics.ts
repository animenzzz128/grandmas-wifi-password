/**
 * Page views with GoatCounter, only when the server says the operator turned it on (GOATCOUNTER_CODE; README,
 * "Play stats"). GoatCounter sets no cookies and keeps no personal data; it counts page views, where visitors
 * came from, browsers, screen sizes and countries. A few game moments are counted as events (a visit started, a
 * note solved), with the difficulty and nothing else: never what anyone typed.
 *
 * Play data itself (funnel, solves, questions, cost) comes from the server's own logs: /admin.
 */
type GoatCounter = { count(vars: { path: string; title?: string; event?: boolean }): void };

let loaded = false;

/** Load GoatCounter's script once, for the count URL the server gave. */
export function startPageViews(countUrl: string | undefined): void {
  if (loaded || !countUrl || typeof document === "undefined") return;
  if (!/^https:\/\/[a-z0-9-]+\.goatcounter\.com\/count$/.test(countUrl)) return;
  loaded = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.dataset.goatcounter = countUrl;
  document.head.appendChild(s);
}

/** Count a game moment ("visit-easy", "solved-hard") as a GoatCounter event; nothing happens when it's off. */
export function countEvent(name: string): void {
  if (!loaded || typeof window === "undefined") return;
  const gc = (window as unknown as { goatcounter?: GoatCounter }).goatcounter;
  gc?.count({ path: `event/${name}`, title: name, event: true });
}
