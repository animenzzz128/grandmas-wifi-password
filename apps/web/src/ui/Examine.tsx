/**
 * The examine card (iteration 49): looking at an object shows it up close in 3D on the left, which you can turn
 * and zoom, with what you notice about it on the right. Some objects have more to see: the wedding photo turns
 * over, the album has pages, the fridge stands open.
 *
 * The close-up is its own small canvas. The room behind stops redrawing while a card is open (GameCanvas).
 */
import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Center, Html, OrbitControls } from "@react-three/drei";
import { useGame } from "../store.ts";
import { t, hasString } from "../strings.ts";
import { Art } from "../scene/Room.tsx";
import { RoomNode } from "../scene/House.tsx";
import { OpenAlbum } from "../scene/props.tsx";
import { facingTurn, stepView, viewCount, viewer, viewsFor } from "../examine.ts";
import type { PublicScene } from "@gwp/engine";

type Item = PublicScene["interactables"][number];

function Subject({ item, view, turn }: { item: Item; view: number; turn: number }) {
  if (item.node === "PhotoAlbum") return <OpenAlbum spread={view} />;
  const detail = item.node === "WeddingPhoto" ? { flipped: view === 1 } : item.kind === "fixture" ? { open: true } : undefined;
  // The room model's own object, except where the close-up shows more than the room does (the photo's back,
  // the open fridge).
  const own = item.model && !detail;
  return (
    <group rotation={[0, turn, 0]}>
      {own ? <RoomNode name={item.model!} /> : <Art item={item} detail={detail} />}
    </group>
  );
}

function Stage({ item, view }: { item: Item; view: number }) {
  // Show the side the player was looking at in the room (the TV's screen, not its back).
  const [turn] = useState(() => facingTurn(item.position[0], item.position[2], item.rotation_y ?? 0, viewer.x, viewer.z));
  return (
    <Canvas
      className="examine-canvas"
      dpr={[1, 1.5]}
      flat
      gl={{ antialias: true }}
      camera={{ fov: 32, position: [0.35, 0.25, 2], near: 0.01, far: 50 }}
      aria-label={t("examine.view", { label: item.label })}
      role="img"
    >
      <color attach="background" args={["#2a2018"]} />
      <hemisphereLight args={["#fff1d6", "#4a3426", 1.4]} />
      <directionalLight position={[1.5, 2.2, 2.5]} intensity={2.4} color="#fff4e0" />
      <directionalLight position={[-2, 1, -1.5]} intensity={0.7} color="#c8d8ff" />
      <Suspense
        fallback={
          <Html center>
            <div className="loading-pill">{t("examine.loading")}</div>
          </Html>
        }
      >
        {/* Fit once per object; turning pages or flipping the photo keeps the camera where the player put it. */}
        <Bounds fit clip observe margin={item.kind === "fixture" ? 1.15 : item.node === "PhotoAlbum" ? 1.02 : 1.3}>
          <Center>
            <Subject item={item} view={view} turn={turn} />
          </Center>
        </Bounds>
      </Suspense>
      <OrbitControls makeDefault enablePan={false} enableDamping minDistance={0.05} maxDistance={8} />
    </Canvas>
  );
}

export function ExamineCard({ objectId }: { objectId: string }) {
  const scene = useGame((s) => s.scene);
  const run = useGame((s) => s.run)!;
  const { openPanel, setOpened, showObject, offerCookie, callMichael } = useGame();
  const busy = useGame((s) => s.busy);
  const [view, setView] = useState(0);
  const it = scene?.interactables.find((i) => i.id === objectId);
  // ← and → turn the album's pages (or the photo over), as the buttons do (review 3, F12).
  useEffect(() => {
    if (!it) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (document.activeElement instanceof HTMLInputElement) return;
      e.preventDefault();
      setView((v) => stepView(it.node, v, e.key === "ArrowRight" ? 1 : -1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [it]);
  if (!it) return null;
  const views = viewsFor(it.node);
  const n = viewCount(it.node);

  return (
    <div className="card examine-card">
      <div className="examine-stage">
        <Stage item={it} view={view} />
        <div className="examine-hint">{t("examine.hint")}</div>
      </div>
      <div className="examine-text">
        <h3 id="panel-title" className="cap">
          {it.label}
        </h3>
        {views?.kind === "sides" && (
          <div className="examine-tabs" role="group">
            {views.labels.map((key, i) => (
              <button key={key} className={i === view ? "" : "ghost"} aria-pressed={i === view} onClick={() => setView(i)}>
                {t(key)}
              </button>
            ))}
          </div>
        )}
        {views?.kind === "pages" && (
          <div className="examine-tabs" role="group">
            <button className="ghost" aria-label={t("examine.prev")} onClick={() => setView(stepView(it.node, view, -1))}>
              ◀
            </button>
            <span aria-live="polite">{t("examine.page", { n: view + 1, total: n })}</span>
            <button className="ghost" aria-label={t("examine.next")} onClick={() => setView(stepView(it.node, view, 1))}>
              ▶
            </button>
          </div>
        )}
        {/* An album page says what's on that page (review F9); the whole card text goes to the notebook. */}
        <p>{views?.kind === "pages" && hasString(`examine.pages.${it.id}.${view + 1}`) ? t(`examine.pages.${it.id}.${view + 1}`) : it.inspect_text}</p>
        <div className="examine-actions">
          {it.kind === "glasses" ? (
            <button disabled={run.glasses || !run.note.smudged} onClick={() => void useGame.getState().putOnGlasses()}>
              {run.glasses ? t("glasses.wearing") : run.note.smudged ? t("glasses.putOn") : t("glasses.notNeeded")}
            </button>
          ) : it.kind === "phone" ? (
            <button disabled={busy || run.callsLeft <= 0 || run.status !== "playing"} onClick={() => void callMichael()}>
              {run.callsLeft > 0 ? t("phone.call", { n: run.callsLeft }) : t("phone.none")}
            </button>
          ) : it.kind === "cookie_jar" ? (
            <button disabled={run.cookies <= 0 || busy} onClick={() => void offerCookie()}>
              {run.cookies <= 0 ? t("cookie.none") : t("cookie.give")}
            </button>
          ) : it.kind === "fixture" ? (
            <button
              onClick={() => {
                setOpened(it.id, false);
                openPanel(null);
              }}
            >
              {t("fixture.close", { label: it.label })}
            </button>
          ) : (
            <button disabled={busy || run.status !== "playing"} onClick={() => void showObject(it.id)}>
              {t("inspect.show")}
            </button>
          )}
          <button className="ghost" onClick={() => openPanel(null)}>
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
