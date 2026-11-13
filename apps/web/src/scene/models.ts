/**
 * Which art the web client shows for each scene node. Keyed by the manifest's `node` names, so the
 * scene data stays engine-neutral (a Godot client would keep its own table like this one).
 *
 * Every model is scaled to fit the object's collider box from the manifest, so collision and
 * interaction never change when art is swapped. Sources and licenses: CREDITS.md.
 */
export type Vec3 = [number, number, number];

export type ArtSpec =
  /** A glTF/GLB file under apps/web/public/models. */
  | {
      kind: "model";
      url: string;
      /** "contain" keeps proportions (default); "stretch" fills the box exactly. */
      fit?: "contain" | "stretch";
      /** Extra turn (radians) so the model's front faces the object's front (+z in object space). */
      turn?: number;
      /** Repeat the model side by side along its width, e.g. a run of kitchen cabinets. */
      tiles?: number;
      /** Multiply all of the model's colors by this color. */
      tint?: string;
      /** Fit to this box (world space) instead of the object's own collider box. */
      box?: { center: Vec3; size: Vec3 };
    }
  /** A small prop modelled in code (see handmade.tsx). */
  | { kind: "handmade"; name: HandmadeName }
  /** Draw nothing: another object's art covers this collider. */
  | { kind: "none" };

export type HandmadeName =
  | "trophy"
  | "ribbon"
  | "sled"
  | "fishingRod"
  | "cookieJar"
  | "router"
  | "stickyNote"
  | "houseNumber"
  | "door"
  | "window"
  | "moonPlate";

const kaykit = (name: string) => `/models/kaykit/${name}.gltf`;
const kenney = (name: string) => `/models/kenney/${name}.glb`;

const HALF_TURN = Math.PI;
const QUARTER = Math.PI / 2;

export const ART: Record<string, ArtSpec> = {
  // furniture
  Rug: { kind: "model", url: kaykit("rug_rectangle_stripes_A"), fit: "stretch" },
  // The armchair is four colliders (seat, back, two arms); one model covers all of them.
  Armchair: { kind: "model", url: kaykit("armchair_pillows"), fit: "stretch", tint: "#c9a6d6", box: { center: [-2.6, 0.575, -1.98], size: [1.0, 1.15, 1.06] } },
  ArmchairBack: { kind: "none" },
  ArmchairArmL: { kind: "none" },
  ArmchairArmR: { kind: "none" },
  Sofa: { kind: "model", url: kaykit("couch_pillows"), fit: "stretch", tint: "#b8d0a8" },
  CoffeeTable: { kind: "model", url: kaykit("table_low"), fit: "stretch" },
  Sideboard: { kind: "model", url: kaykit("cabinet_medium"), fit: "stretch" },
  TvStand: { kind: "model", url: kenney("cabinetTelevision"), fit: "stretch", turn: -QUARTER },
  KitchenCounter: { kind: "model", url: kenney("kitchenCabinet"), fit: "stretch", turn: QUARTER, tiles: 3 },
  Fridge: { kind: "model", url: kenney("kitchenFridge"), fit: "stretch", turn: QUARTER },
  FloorLamp: { kind: "model", url: kaykit("lamp_standing") },
  FrontDoor: { kind: "handmade", name: "door" },
  Window: { kind: "handmade", name: "window" },
  MoonPlate: { kind: "handmade", name: "moonPlate" },

  // clues and the things you use
  PhotoAlbum: { kind: "model", url: kaykit("book_single"), fit: "stretch", tint: "#e07a6a" },
  WeddingPhoto: { kind: "model", url: kaykit("pictureframe_standing_A") },
  BowlingTrophy: { kind: "handmade", name: "trophy" },
  BlueRibbon: { kind: "handmade", name: "ribbon" },
  Sled: { kind: "handmade", name: "sled" },
  FishingRod: { kind: "handmade", name: "fishingRod" },
  TV: { kind: "model", url: kenney("televisionVintage"), turn: -QUARTER },
  HouseNumberSign: { kind: "handmade", name: "houseNumber" },
  CookieJar: { kind: "handmade", name: "cookieJar" },
  Router: { kind: "handmade", name: "router" },
  StickyNote: { kind: "handmade", name: "stickyNote" },

  // decoration only (no gameplay)
  Plant: { kind: "model", url: kenney("pottedPlant") },
  CoatRack: { kind: "model", url: kenney("coatRackStanding") },
  Doormat: { kind: "model", url: kenney("rugDoormat"), fit: "stretch", turn: HALF_TURN },
  WallFrameLarge: { kind: "model", url: kaykit("pictureframe_large_A") },
  WallFrameSmall: { kind: "model", url: kaykit("pictureframe_small_B") },
  Radio: { kind: "model", url: kenney("radio"), turn: QUARTER },
  BookSet: { kind: "model", url: kaykit("book_set") },
  CeilingLamp: { kind: "model", url: kenney("lampSquareCeiling") },
  TableLamp: { kind: "model", url: kaykit("lamp_table") },
};

export const MODEL_URLS = [...new Set(Object.values(ART).flatMap((a) => (a.kind === "model" ? [a.url] : [])))];
