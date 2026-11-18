"""
Make a lighter copy of a glTF model for the web: every mesh over a triangle budget is decimated (Blender's
Collapse decimate), keeping node names, pivots and material names (the game finds parts and materials by name).

    blender -b --factory-startup --python tools/decimate-glb.py -- in.glb out.glb [budget] [ratio]

budget: meshes with more triangles than this are reduced (default 3000).
ratio: how much of them to keep (default 0.45); very dense meshes (over 8x the budget) keep half of that.

Used on the Godot edition's room.glb and grandma.glb (iteration 54). Drafted with Claude Code under
Jacky Yao's direction.
"""
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :]
src, dst = argv[0], argv[1]
budget = int(argv[2]) if len(argv) > 2 else 3000
ratio = float(argv[3]) if len(argv) > 3 else 0.45

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

before = after = 0
for obj in list(bpy.data.objects):
    if obj.type != "MESH":
        continue
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    before += tris
    if tris > budget:
        keep = ratio * (0.5 if tris > budget * 8 else 1.0)
        # Meshes can be shared between objects; decimate a copy so the others keep theirs.
        if obj.data.users > 1:
            obj.data = obj.data.copy()
        mod = obj.modifiers.new("web", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = keep
        mod.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    after += sum(len(p.vertices) - 2 for p in obj.data.polygons)

bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_apply=True, export_yup=True, export_extras=True)
print(f"DECIMATE {src}: {before} -> {after} triangles")
