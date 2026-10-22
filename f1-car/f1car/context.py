"""Build context: owns the scene, root empty, per-part collections and the material library."""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from .materials import MaterialLibrary
from .utils import geo


class Ctx:
    def __init__(self, scene=None):
        self.scene = scene or bpy.context.scene
        self.root = bpy.data.objects.new("F1_CAR", None)
        self.root.empty_display_type = "ARROWS"
        self.root.empty_display_size = 0.5
        self.car_collection = self._new_collection("F1_Car", self.scene.collection)
        self.car_collection.objects.link(self.root)
        self.scene_root = bpy.data.objects.new("STUDIO_ROOT", None)
        self.scene_root.empty_display_size = 0.3
        self.car_collection.objects.link(self.scene_root)
        self.mats = MaterialLibrary(self.root)
        self._part_collections = {}
        self.objects = {}          # name -> object, for lookups by later parts / animation

    # ------------------------------------------------------------- collections
    def _new_collection(self, name, parent):
        col = bpy.data.collections.new(name)
        parent.children.link(col)
        return col

    def part_collection(self, part):
        if part not in self._part_collections:
            self._part_collections[part] = self._new_collection("F1_" + part, self.car_collection)
        return self._part_collections[part]

    def mat(self, key):
        return self.mats.get(key)

    # ------------------------------------------------------------- objects
    def add_bm(self, part, name, bm, mats=(), parent=None, smooth=True, angle=50.0,
               bevel=None, location=None, rotation=None, flip_y=False):
        """Convert a bmesh to an object inside the part's collection.
        `mats` is a list of material keys -> slot order. `bevel` = (width, segments)."""
        if flip_y:
            for v in bm.verts:
                v.co.y = -v.co.y
            bmesh.ops.reverse_faces(bm, faces=bm.faces)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        if smooth:
            for p in me.polygons:
                p.use_smooth = True
            if hasattr(me, "use_auto_smooth"):
                me.use_auto_smooth = True
                me.auto_smooth_angle = math.radians(angle)
        for m in mats:
            me.materials.append(self.mat(m) if isinstance(m, str) else m)
        ob = bpy.data.objects.new(name, me)
        self.part_collection(part).objects.link(ob)
        ob.parent = parent or self.root
        if location is not None:
            ob.location = location
        if rotation is not None:
            ob.rotation_euler = rotation
        if bevel:
            self.add_bevel(ob, *bevel)
        self.objects[name] = ob
        return ob

    def add_bevel(self, ob, width, segments=2, angle=35.0):
        md = ob.modifiers.new("Bevel", "BEVEL")
        md.width = width
        md.segments = segments
        md.limit_method = "ANGLE"
        md.angle_limit = math.radians(angle)
        return md

    def add_empty(self, part, name, parent=None, location=(0, 0, 0), rotation=(0, 0, 0), size=0.1):
        e = bpy.data.objects.new(name, None)
        e.empty_display_size = size
        e.empty_display_type = "PLAIN_AXES"
        self.part_collection(part).objects.link(e)
        e.parent = parent or self.root
        e.location = location
        e.rotation_euler = rotation
        self.objects[name] = e
        return e

    # ------------------------------------------------------------- modifier baking
    def bake(self, ob):
        """Apply all modifiers to `ob` (evaluated mesh becomes the object's mesh)."""
        if not ob.modifiers:
            return ob
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        ev = ob.evaluated_get(dg)
        new_me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
        old = ob.data
        ob.modifiers.clear()
        ob.data = new_me
        new_me.name = old.name
        if old.users == 0:
            bpy.data.meshes.remove(old)
        return ob

    def cut(self, ob, cutters, operation="DIFFERENCE", solver="EXACT"):
        """Boolean `ob` with cutter bmeshes / objects and bake the result."""
        made = []
        for i, c in enumerate(cutters):
            if isinstance(c, bmesh.types.BMesh):
                me = bpy.data.meshes.new("_cutter")
                c.to_mesh(me)
                c.free()
                co = bpy.data.objects.new("_cutter%d" % i, me)
                me.materials.append(self.mat("carbon_matte"))
                self.scene.collection.objects.link(co)
                co.parent = ob            # cutters are authored in the target's local space
                made.append(co)
                c = co
            md = ob.modifiers.new("Bool%d" % i, "BOOLEAN")
            md.operation = operation
            md.solver = solver
            md.object = c
            if solver == "EXACT":
                md.use_self = False
        self.bake(ob)
        for co in made:
            me = co.data
            bpy.data.objects.remove(co)
            bpy.data.meshes.remove(me)
        return ob

    def mirror(self, ob, name, part=None):
        """Mirror an object across the centre-plane (y -> -y) with correct normals."""
        self.bake(ob)
        me = ob.data.copy()
        bm = bmesh.new()
        bm.from_mesh(me)
        for v in bm.verts:
            v.co.y = -v.co.y
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        new = bpy.data.objects.new(name, me)
        col = ob.users_collection[0]
        col.objects.link(new)
        new.parent = ob.parent
        loc = ob.location.copy()
        loc.y = -loc.y
        new.location = loc
        new.rotation_euler = ob.rotation_euler
        self.objects[name] = new
        return new

    def add_pair(self, part, name, bm, mats=(), **kw):
        """Add `bm` (defined on the +Y / left side) and its mirrored right-hand twin."""
        bevel = kw.pop("bevel", None)
        left = self.add_bm(part, name + "_L", bm, mats, **kw)
        right = self.mirror(left, name + "_R")
        if bevel:
            for ob in (left, right):
                self.add_bevel(ob, *bevel)
        return left, right
