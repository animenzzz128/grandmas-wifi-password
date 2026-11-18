import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { useGame } from "./store.ts";
import { useSettings } from "./settings.ts";
import "./styles.css";
import "./house.css";

// Dev only: poke the game state from the browser console, e.g. __game.getState().openPanel({ type: "note" }).
if (import.meta.env.DEV) Object.assign(window, { __game: useGame, __settings: useSettings });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
