/** Loads a glTF model and scales it into an object's collider box. */
import { Component, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, Color, Group, Mesh, Vector3 } from "three";
import type { Material, MeshStandardMaterial, Object3D } from "three";
import type { ArtSpec, Vec3 } from "./models.ts";

type ModelSpec = Extract<ArtSpec, { kind: "model" }>;

const noRaycast = () => undefined;

/** Copies the model so each placement owns its materials (needed for tint and highlight). */
function prepare(src: Object3D, tint?: string): Object3D {
  const copy = src.clone(true);
  const tintColor = tint ? new Color(tint) : null;
  copy.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    o.raycast = noRaycast; // hits use the invisible collider box instead (cheaper, matches the game)
    const one = (m: Material) => {
      const c = m.clone() as MeshStandardMaterial;
      if (tintColor && c.color) c.color.multiply(tintColor);
      return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
  });
  return copy;
}

/**
 * Builds: outer (scale + offset) > turned (spec.turn) > tiles of the model.
 * `size` is the box to fill, in the object's own space, centered on the object's position.
 */
export function fitModel(src: Object3D, spec: ModelSpec, size: Vec3, offset: Vec3 = [0, 0, 0]): Group {
  const turned = new Group();
  const tiles = Math.max(1, spec.tiles ?? 1);
  const one = new Box3().setFromObject(src);
  const step = one.max.x - one.min.x;
  for (let i = 0; i < tiles; i++) {
    const m = prepare(src, spec.tint);
    m.position.x = (i - (tiles - 1) / 2) * step;
    turned.add(m);
  }
  turned.rotation.y = spec.turn ?? 0;
  turned.updateMatrixWorld(true);

  const box = new Box3().setFromObject(turned);
  const have = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const [w, h, d] = size;
  let sx = w / Math.max(have.x, 1e-6);
  let sy = h / Math.max(have.y, 1e-6);
  let sz = d / Math.max(have.z, 1e-6);
  if (spec.fit !== "stretch") sx = sy = sz = Math.min(sx, sy, sz);

  const outer = new Group();
  outer.add(turned);
  outer.scale.set(sx, sy, sz);
  // Center horizontally, stand on the bottom of the box.
  outer.position.set(-center.x * sx + offset[0], -box.min.y * sy - h / 2 + offset[1], -center.z * sz + offset[2]);
  return outer;
}

/** Glows the model a little while the player is looking at it. */
export function useHighlight(root: Object3D | null, on: boolean, color = "#3a3010") {
  useEffect(() => {
    if (!root) return;
    const c = new Color(on ? color : "#000000");
    root.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if ("emissive" in m && m.emissive instanceof Color) m.emissive.copy(c);
      }
    });
  }, [root, on, color]);
}

export function GltfModel({
  spec,
  size,
  position,
  highlight = false,
}: {
  spec: ModelSpec;
  size: Vec3;
  position: Vec3;
  highlight?: boolean;
}) {
  const gltf = useGLTF(spec.url);
  const fitted = useMemo(() => {
    // `box` is in world space; convert it to this object's space (objects using it aren't rotated).
    const s = spec.box?.size ?? size;
    const c = spec.box?.center;
    const off: Vec3 = c ? [c[0] - position[0], c[1] - position[1], c[2] - position[2]] : [0, 0, 0];
    return fitModel(gltf.scene, spec, s, off);
  }, [gltf, spec, size, position]);
  useHighlight(fitted, highlight);
  return <primitive object={fitted} />;
}

/** If a model file is missing or broken, show the grey box instead of crashing the room. */
export class ArtBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(err: unknown) {
    console.warn("[art] falling back to a grey box:", err);
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
