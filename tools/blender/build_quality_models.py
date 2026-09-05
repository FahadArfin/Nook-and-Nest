import math
import os
import sys
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
TEXTURES = ROOT / "assets-source" / "textures"
WEB_TEXTURES = TEXTURES / "web"
BLEND_OUT = ROOT / "assets-source" / "blender"
GLB_OUT = ROOT / "public" / "models" / "furniture"


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)
    for block in bpy.data.images:
        if block.name != "Render Result":
            bpy.data.images.remove(block)


def material(name, color, texture=None, roughness=0.88, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1.0)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if texture:
        image = bpy.data.images.load(str(WEB_TEXTURES / texture), check_existing=True)
        image.colorspace_settings.name = "sRGB"
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = image
        tex.interpolation = "Linear"
        tex.extension = "REPEAT"
        mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def prepare_web_textures():
    WEB_TEXTURES.mkdir(parents=True, exist_ok=True)
    for source in TEXTURES.glob("handpainted-*.png"):
        destination = WEB_TEXTURES / source.name
        image = bpy.data.images.load(str(source), check_existing=False)
        image.scale(512, 512)
        image.filepath_raw = str(destination)
        image.file_format = "PNG"
        image.save()
        bpy.data.images.remove(image)


def finish_mesh(obj, bevel=0.025, segments=3, uv_scale=1.0):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        mod = obj.modifiers.new("soft-handmade-edges", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(island_margin=0.03)
    bpy.ops.object.mode_set(mode="OBJECT")
    if obj.data.uv_layers.active:
        for loop in obj.data.uv_layers.active.data:
            loop.uv *= uv_scale
    obj.select_set(False)
    return obj


def rounded_box(name, dims, loc, mat, bevel=None, rot=(0, 0, 0), uv_scale=2.0):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    obj.data.materials.append(mat)
    smallest = min(dims)
    return finish_mesh(obj, min(bevel if bevel is not None else smallest * 0.16, smallest * 0.34), 3, uv_scale)


def cylinder(name, radius, height, loc, mat, vertices=14, rot=(0, 0, 0), taper=1.0, uv_scale=2.0):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius * taper, depth=height, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return finish_mesh(obj, min(radius * 0.12, height * 0.12), 2, uv_scale)


def cushion(name, dims, loc, mat, rot=(0, 0, 0), uv_scale=3.0):
    obj = rounded_box(name, dims, loc, mat, min(dims) * 0.28, rot, uv_scale)
    # A slightly relaxed silhouette without the old ellipsoid/blob construction.
    obj.scale.x *= 1.0 + ((hash(name) & 7) - 3) * 0.002
    return obj


def add_leg(name, loc, height, width, mat, lean=(0, 0)):
    return rounded_box(name, (width, width, height), loc, mat, width * 0.22, (lean[0], lean[1], 0), 2.0)


def add_knob(name, loc, radius, mat):
    return cylinder(name, radius, radius * 1.15, loc, mat, 12, (math.pi / 2, 0, 0), 2.0)


def leaf(name, width, height, loc, mat, rot=(0, 0, 0)):
    outline = [(0, .5), (.32, .31), (.5, 0), (.28, -.3), (0, -.5), (-.28, -.3), (-.5, 0), (-.32, .31)]
    verts = [(x * width, 0, z * height) for x, z in outline]
    faces = [tuple(range(8))]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    solid = obj.modifiers.new("leaf-thickness", "SOLIDIFY")
    solid.thickness = min(width, height) * .055
    bevel_mod = obj.modifiers.new("leaf-soft-edge", "BEVEL")
    bevel_mod.width = min(width, height) * .035
    bevel_mod.segments = 2
    bpy.ops.object.modifier_apply(modifier=solid.name)
    bpy.ops.object.modifier_apply(modifier=bevel_mod.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj.select_set(False)
    return obj


def common_materials():
    return {
        "wood": material("wood-honey-textured", (0.72, 0.43, 0.2), "handpainted-honey-oak.png", 0.82),
        "wood_dark": material("wood-dark", (0.24, 0.12, 0.075), None, 0.9),
        "fabric": material("upholstery-textured", (0.56, 0.65, 0.45), None, 0.98),
        "linen": material("linen-textured", (0.92, 0.83, 0.68), "handpainted-cream-linen.png", 0.98),
        "clay": material("terracotta", (0.66, 0.29, 0.18), None, 0.92),
        "mustard": material("mustard-cloth", (0.72, 0.52, 0.2), "handpainted-cream-linen.png", 0.96),
        "metal": material("aged-bronze", (0.2, 0.16, 0.12), None, 0.72, 0.16),
        "green": material("leaf-green", (0.25, 0.42, 0.21), None, 0.94),
        "green_light": material("leaf-light", (0.43, 0.56, 0.31), None, 0.94),
        "rose": material("dusty-rose", (0.68, 0.38, 0.36), "handpainted-cream-linen.png", 0.96),
        "blue": material("smoky-mirror", (0.36, 0.55, 0.57), None, 0.28, 0.72),
        "variant": material("variant-surface", (0.56, 0.65, 0.45), None, 0.94),
        "counter": material("countertop-surface", (0.78, 0.72, 0.62), None, 0.88),
        "steel": material("brushed-steel", (0.48, 0.5, 0.48), None, 0.58, 0.35),
        "screen": material("television-screen", (0.035, 0.045, 0.05), None, 0.32, 0.12),
        "art_landscape": material("artwork-landscape", (1, 1, 1), "wall-art-landscape.png", 0.92),
        "art_botanical": material("artwork-botanical", (1, 1, 1), "wall-art-botanical.png", 0.92),
        "art_abstract": material("artwork-abstract", (1, 1, 1), "wall-art-abstract.png", 0.92),
        "art_coast": material("artwork-coast", (1, 1, 1), "wall-art-coast.png", 0.92),
    }


def build_upholstered_seat(m, prefix, w, d, h, seat_count):
    """Original deep-seat family with low arms and clean, readable construction."""
    rounded_box(f"{prefix}_continuous_base", (w * 0.94, d * 0.78, 0.23), (0, 0, 0.25), m["fabric"], 0.055)
    rounded_box(f"{prefix}_lower_wood_rail", (w * 0.88, d * 0.69, 0.085), (0, 0.015, 0.125), m["wood_dark"], 0.022)
    rounded_box(f"{prefix}_back_shell", (w * 0.88, 0.18, h * 0.56), (0, d * 0.31, h * 0.57), m["fabric"], 0.052)
    arm_w = max(0.18, w * 0.115)
    for side in (-1, 1):
        rounded_box(f"{prefix}_integrated_arm_{side}", (arm_w, d * 0.77, h * 0.48), (side * (w / 2 - arm_w / 2), -0.01, h * 0.39), m["fabric"], 0.055)
    inner = w - arm_w * 2 - 0.08
    gap = 0.028
    cushion_width = (inner - gap * (seat_count - 1)) / seat_count
    start_x = -inner / 2 + cushion_width / 2
    for i in range(seat_count):
        x = start_x + i * (cushion_width + gap)
        tilt = (i - (seat_count - 1) / 2) * 0.008
        cushion(f"{prefix}_seat_cushion_{i}", (cushion_width * 0.98, d * 0.62, 0.17), (x, -0.055, 0.43), m["fabric"], (0, 0, tilt))
        cushion(f"{prefix}_back_cushion_{i}", (cushion_width * 0.96, 0.16, h * 0.39), (x, d * 0.235, h * 0.68), m["fabric"], (-0.085, 0, tilt))
    for x in (-w * 0.39, w * 0.39):
        for y in (-d * 0.27, d * 0.27):
            add_leg(f"{prefix}_tapered_foot", (x, y, 0.075), 0.15, 0.08, m["wood_dark"], (0.018 if y > 0 else -0.018, 0.018 if x > 0 else -0.018))
    return (w, d, h)


def build_sofa(m):
    return build_upholstered_seat(m, "sofa", 2.1, 0.9, 0.85, 2)


def build_armchair(m):
    return build_upholstered_seat(m, "armchair", 0.88, 0.82, 0.9, 1)


def build_bed(m):
    w, d, h = 1.6, 2.1, 0.76
    rounded_box("bed_connected_frame", (w, d * 0.93, 0.2), (0, 0, 0.24), m["wood"], 0.04, uv_scale=1.4)
    rounded_box("bed_footboard", (w, 0.14, 0.3), (0, -d * 0.46, 0.28), m["wood_dark"], 0.035)
    rounded_box("bed_headboard_frame", (w, 0.16, h * 0.8), (0, d * 0.45, h * 0.61), m["wood"], 0.055, uv_scale=1.5)
    cushion("bed_headboard_upholstery", (w * 0.84, 0.09, h * 0.54), (0, d * 0.395, h * 0.64), m["fabric"])
    cushion("bed_mattress", (w * 0.92, d * 0.82, 0.22), (0, -0.03, 0.43), m["linen"], uv_scale=4.0)
    cushion("bed_duvet", (w * 0.88, d * 0.52, 0.1), (0, -d * 0.13, 0.57), m["fabric"], uv_scale=4.0)
    for side in (-1, 1):
        cushion(f"bed_pillow_{side}", (w * 0.35, d * 0.2, 0.13), (side * w * 0.22, d * 0.27, 0.62), m["linen"], (-0.04, 0, side * 0.04), 4.0)
    for x in (-w * 0.42, w * 0.42):
        for y in (-d * 0.41, d * 0.41):
            add_leg("bed_wood_foot", (x, y, 0.08), 0.16, 0.08, m["wood_dark"])
    for x in (-w * 0.22, w * 0.22):
        for z in (h * 0.54, h * 0.73):
            add_knob("headboard_tuft", (x, d * 0.346, z), 0.025, m["linen"])
    return (w, d, h)


def build_dining_table(m):
    w, d, h = 1.6, 0.9, 0.76
    rounded_box("table_thick_textured_top", (w, d, 0.12), (0, 0, h - 0.06), m["wood"], 0.035, uv_scale=1.2)
    rounded_box("table_under_apron", (w * 0.84, d * 0.72, 0.1), (0, 0, h - 0.16), m["wood_dark"], 0.02)
    for x in (-w * 0.34, w * 0.34):
        rounded_box("table_trestle_post", (0.14, d * 0.18, h * 0.72), (x, 0, h * 0.4), m["wood"], 0.025, uv_scale=1.4)
        rounded_box("table_trestle_foot", (w * 0.2, d * 0.75, 0.085), (x, 0, 0.06), m["wood_dark"], 0.022)
        rounded_box("table_trestle_cap", (w * 0.2, d * 0.7, 0.075), (x, 0, h - 0.19), m["wood_dark"], 0.018)
    rounded_box("table_long_stretcher", (w * 0.68, 0.11, 0.11), (0, 0, h * 0.35), m["wood_dark"], 0.022)
    cylinder("table_ceramic_vase", 0.1, 0.18, (0.13, 0, h + 0.09), m["clay"], 12, taper=0.72)
    return (w, d, h + 0.18)


def build_dresser(m):
    w, d, h = 1.3, 0.5, 0.85
    rounded_box("dresser_connected_carcass", (w * 0.94, d * 0.9, h * 0.76), (0, 0.02, h * 0.48), m["wood"], 0.045, uv_scale=1.4)
    rounded_box("dresser_overhanging_top", (w, d, 0.08), (0, 0, h - 0.04), m["wood"], 0.025, uv_scale=1.2)
    rounded_box("dresser_lower_plinth", (w * 0.98, d * 0.92, 0.08), (0, 0, 0.15), m["wood_dark"], 0.02)
    front_y = -d * 0.445
    for row in range(3):
        for col in range(2):
            x = (col - 0.5) * w * 0.43
            z = h * (0.29 + row * 0.22)
            rounded_box(f"dresser_drawer_{row}_{col}", (w * 0.39, 0.055, h * 0.17), (x, front_y, z), m["fabric"] if row == 1 else m["wood"], 0.018, uv_scale=1.8)
            add_knob(f"dresser_knob_{row}_{col}", (x, front_y - 0.045, z), 0.032, m["metal"])
    for x in (-w * 0.38, w * 0.38):
        for y in (-d * 0.31, d * 0.31):
            add_leg("dresser_tapered_foot", (x, y, 0.065), 0.13, 0.085, m["wood_dark"], (0.018 if y > 0 else -0.018, 0.018 if x > 0 else -0.018))
    return (w, d, h)


def build_loveseat(m):
    return build_upholstered_seat(m, "loveseat", 1.45, 0.85, 0.82, 2)


def build_ottoman(m):
    w,d,h=.65,.5,.42
    rounded_box("ottoman_connected_base",(w*.88,d*.86,h*.44),(0,0,h*.25),m["wood_dark"],.055)
    cushion("ottoman_upholstered_top",(w,d,h*.55),(0,0,h*.66),m["fabric"],uv_scale=3.5)
    for x in (-w*.31,w*.31):
        for y in (-d*.3,d*.3):add_leg("ottoman_foot",(x,y,.06),.12,.065,m["wood_dark"])
    for x in (-w*.2,w*.2):
        for y in (-d*.18,d*.18):cylinder("ottoman_tuft",.018,.015,(x,y,h*.96),m["metal"],10)
    return (w,d,h)


def build_coffee_table(m):
    w,d,h=1.1,.6,.42
    rounded_box("coffee_table_soft_top",(w,d,.1),(0,0,h-.05),m["wood"],.04,uv_scale=1.4)
    rounded_box("coffee_table_lower_shelf",(w*.76,d*.68,.055),(0,0,h*.31),m["wood"],.018,uv_scale=1.8)
    for x in (-w*.39,w*.39):
        for y in (-d*.34,d*.34):add_leg("coffee_table_leg",(x,y,(h-.1)/2),h-.1,.075,m["wood_dark"],(.018 if y>0 else -.018,.018 if x>0 else -.018))
    rounded_box("coffee_table_book",(.28,.22,.045),(-.18,.03,h+.025),m["rose"],.012)
    cylinder("coffee_table_cup",.07,.1,(.24,-.08,h+.05),m["linen"],12,taper=.86)
    return (w,d,h+.1)


def build_side_table(m):
    w=d=.48;h=.52
    cylinder("side_table_round_top",w*.48,.09,(0,0,h-.045),m["wood"],18,uv_scale=1.4)
    cylinder("side_table_pedestal",w*.085,h*.74,(0,0,h*.45),m["wood"],10,taper=.78)
    for i in range(3):
        a=math.pi/2+i*math.tau/3
        rounded_box("side_table_tripod_foot",(w*.32,w*.08,.055),(math.cos(a)*w*.14,math.sin(a)*d*.14,.045),m["wood_dark"],.015,(0,0,-a))
    cylinder("side_table_acorn_bowl",w*.12,.09,(0,0,h+.045),m["clay"],12,taper=.75)
    return (w,d,h+.09)


def build_single_bed(m):
    w,d,h=1.0,2.0,.7
    rounded_box("single_bed_connected_frame",(w,d*.92,.19),(0,0,.23),m["wood"],.04,uv_scale=1.4)
    rounded_box("single_bed_mattress",(w*.91,d*.81,.21),(0,-.03,.42),m["linen"],.065,uv_scale=4)
    cushion("single_bed_duvet",(w*.87,d*.52,.09),(0,-d*.12,.56),m["fabric"],uv_scale=4)
    cushion("single_bed_pillow",(w*.62,d*.2,.13),(0,d*.27,.62),m["linen"],(-.04,0,.04),4)
    for side in (-1,1):rounded_box("single_bed_head_post",(.075,.12,h*.78),(side*w*.43,d*.45,h*.59),m["wood"],.02)
    rounded_box("single_bed_head_crest",(w*.92,.14,.09),(0,d*.45,h*.92),m["wood"],.025)
    for i in range(4):rounded_box("single_bed_spindle",(.055,.075,h*.47),((i-1.5)*w*.19,d*.45,h*.64),m["wood_dark"],.014,(0,(i-1.5)*.015,0))
    return (w,d,h)


def build_nightstand(m):
    w,d,h=.52,.43,.56
    rounded_box("nightstand_connected_carcass",(w*.92,d*.86,h*.76),(0,.01,h*.49),m["wood"],.035,uv_scale=1.5)
    rounded_box("nightstand_top",(w,d,.065),(0,0,h-.032),m["wood"],.022)
    rounded_box("nightstand_drawer",(w*.75,.055,h*.19),(0,-d*.44,h*.68),m["fabric"],.016)
    add_knob("nightstand_knob",(0,-d*.49,h*.68),.032,m["metal"])
    rounded_box("nightstand_open_cubby",(w*.72,d*.72,.055),(0,0,h*.31),m["wood_dark"],.016)
    for x in (-w*.38,w*.38):
        for y in (-d*.31,d*.31):add_leg("nightstand_foot",(x,y,.055),.11,.065,m["wood_dark"])
    rounded_box("nightstand_book",(.19,.25,.035),(-.1,.01,h+.018),m["rose"],.01)
    return (w,d,h+.04)


def build_wardrobe(m):
    w,d,h=1.2,.6,1.9
    rounded_box("wardrobe_connected_body",(w*.94,d*.92,h*.86),(0,.01,h*.49),m["wood"],.045,uv_scale=1.2)
    rounded_box("wardrobe_crown",(w*1.04,d*1.02,.11),(0,0,h-.055),m["wood_dark"],.025)
    rounded_box("wardrobe_plinth",(w,d*.96,.1),(0,0,.13),m["wood_dark"],.022)
    for side in (-1,1):
        x=side*w*.235
        rounded_box("wardrobe_door",(w*.42,.06,h*.72),(x,-d*.47,h*.52),m["fabric"] if side>0 else m["wood"],.025)
        rounded_box("wardrobe_inset_panel",(w*.31,.035,h*.58),(x,-d*.505,h*.52),m["wood"] if side>0 else m["fabric"],.018)
        add_knob("wardrobe_knob",(x-side*w*.13,-d*.545,h*.54),.033,m["metal"])
    return (w,d,h)


def build_bookshelf(m):
    w,d,h=.9,.35,1.8;post=.08;shelf=.055
    rounded_box("bookshelf_back",(w*.78,.045,h*.88),(0,d*.43,h*.5),m["wood_dark"],.014,uv_scale=1.5)
    for x in (-w*.44,w*.44):rounded_box("bookshelf_side_post",(post,d,h*.94),(x,0,h*.49),m["wood"],.02,uv_scale=1.4)
    for z in (.08,.43,.76,1.09,1.42,1.73):rounded_box("bookshelf_shelf",(w*.82,d*.9,shelf),(0,0,z),m["wood"],.016,uv_scale=1.6)
    rounded_box("bookshelf_crest",(w*.46,d*.72,.09),(0,0,h+.025),m["fabric"],.025)
    colors=(m["rose"],m["green"],m["mustard"],m["linen"])
    idx=0
    for row,z in enumerate((.13,.48,.81,1.14)):
        for col in range(6):
            bw=.065+(col%2)*.014;bh=.19+(col%3)*.035
            rounded_box(f"book_{idx}",(bw,d*.42,bh),(-w*.32+col*.115,-d*.14,z+bh/2),colors[idx%4],.008,(0,0,(col-2.5)*.015),3);idx+=1
    cylinder("bookshelf_pot",.075,.11,(w*.25,-.04,1.53),m["clay"],10,taper=.82)
    return (w,d,h+.08)


def build_cabinet(m):
    w,d,h=.8,.45,1.2
    rounded_box("cabinet_connected_body",(w*.94,d*.9,h*.82),(0,.01,h*.5),m["wood"],.04,uv_scale=1.4)
    rounded_box("cabinet_top",(w,d,.075),(0,0,h-.038),m["wood"],.024)
    for side in (-1,1):
        x=side*w*.235;rounded_box("cabinet_door",(w*.42,.055,h*.65),(x,-d*.46,h*.52),m["fabric"] if side>0 else m["wood"],.022)
        rounded_box("cabinet_panel",(w*.3,.03,h*.5),(x,-d*.495,h*.52),m["wood"] if side>0 else m["fabric"],.016)
        add_knob("cabinet_knob",(x-side*w*.13,-d*.53,h*.52),.028,m["metal"])
    cylinder("cabinet_vase",.07,.13,(w*.22,0,h+.065),m["clay"],10,taper=.72)
    return (w,d,h+.13)


def build_bench(m):
    w,d,h=1.1,.42,.52
    rounded_box("bench_connected_seat_frame",(w*.96,d*.86,.11),(0,0,h*.66),m["wood"],.028)
    cushion("bench_textured_cushion",(w*.9,d*.8,.15),(0,0,h*.81),m["fabric"],uv_scale=3.5)
    rounded_box("bench_lower_shelf",(w*.78,d*.7,.055),(0,0,h*.27),m["wood"],.016)
    for x in (-w*.4,w*.4):
        for y in (-d*.3,d*.3):add_leg("bench_leg",(x,y,h*.33),h*.66,.075,m["wood_dark"])
    for x,mat in ((-.2,m["linen"]),(.18,m["clay"])):rounded_box("bench_storage_basket",(.28,d*.5,.2),(x,0,h*.41),mat,.04)
    return (w,d,h)


def build_round_table(m):
    w=d=1.05;h=.75
    cylinder("round_table_textured_top",w*.5,.105,(0,0,h-.052),m["wood"],20,uv_scale=1.4)
    cylinder("round_table_pedestal",w*.085,h*.78,(0,0,h*.43),m["wood"],10,taper=.8)
    for i in range(4):
        a=i*math.pi/2;rounded_box("round_table_foot",(w*.34,w*.09,.06),(math.cos(a)*w*.14,math.sin(a)*d*.14,.05),m["wood_dark"],.017,(0,0,-a))
    cylinder("round_table_bud_vase",.065,.13,(0,0,h+.065),m["clay"],10,taper=.7)
    return (w,d,h+.13)


def build_dining_chair(m):
    w,d,h=.48,.52,.88;seat=.45
    rounded_box("dining_chair_seat_frame",(w*.9,d*.76,.1),(0,0,seat),m["wood"],.026)
    cushion("dining_chair_seat_pad",(w*.72,d*.57,.07),(0,-.01,seat+.08),m["fabric"])
    for x in (-w*.34,w*.34):
        for y in (-d*.28,d*.28):add_leg("dining_chair_leg",(x,y,seat/2),seat,.055,m["wood_dark"],(.025 if y>0 else -.025,.018 if x>0 else -.018))
    for x in (-w*.35,w*.35):rounded_box("dining_chair_back_post",(.058,.065,h-seat+.08),(x,d*.32,seat+(h-seat)/2),m["wood"],.016,(.07,0,0))
    rounded_box("dining_chair_crest",(w*.72,.075,.08),(0,d*.34,h*.93),m["wood"],.022)
    for i in range(3):rounded_box("dining_chair_back_slat",(.07,.055,h*.31),((i-1)*w*.2,d*.33,h*.72),m["fabric"] if i==1 else m["wood"],.017,(0,(i-1)*.03,0))
    return (w,d,h)


def build_bar_stool(m):
    w=d=.42;h=.72
    cylinder("stool_mushroom_seat_base",w*.43,.11,(0,0,h-.07),m["wood"],16,taper=.88)
    cylinder("stool_textured_seat_pad",w*.48,.07,(0,0,h-.015),m["fabric"],16,taper=.88)
    for i in range(3):
        a=math.pi/2+i*math.tau/3;add_leg("stool_splayed_leg",(math.cos(a)*w*.25,math.sin(a)*d*.25,h*.41),h*.82,.065,m["wood_dark"],(.05*math.sin(a),-.05*math.cos(a)))
    cylinder("stool_foot_ring",w*.3,.04,(0,0,h*.35),m["wood"],14)
    return (w,d,h)


def build_desk(m):
    w,d,h=1.3,.65,.76
    rounded_box("desk_textured_top",(w,d,.1),(0,0,h-.05),m["wood"],.032,uv_scale=1.3)
    rounded_box("desk_connected_drawer_bank",(w*.3,d*.7,h*.55),(w*.28,0,h*.39),m["wood"],.035)
    for i,z in enumerate((h*.31,h*.51)):
        rounded_box("desk_drawer",(w*.24,.055,h*.17),(w*.28,-d*.37,z),m["fabric"] if i else m["wood"],.016);add_knob("desk_knob",(w*.28,-d*.41,z),.027,m["metal"])
    for x in (-w*.39,w*.08):
        for y in (-d*.31,d*.31):add_leg("desk_leg",(x,y,(h-.1)/2),h-.1,.075,m["wood_dark"])
    rounded_box("desk_book",(.28,.22,.038),(-w*.2,.04,h+.02),m["green"],.01)
    cylinder("desk_pencil_cup",.055,.11,(w*.34,.05,h+.055),m["clay"],10,taper=.88)
    return (w,d,h+.11)


def build_office_chair(m):
    w=d=.62;h=.95;seat=.48
    cushion("task_chair_seat",(w*.76,d*.66,.13),(0,0,seat),m["fabric"])
    cushion("task_chair_back",(w*.68,.15,h*.34),(0,d*.28,h*.76),m["fabric"],(-.08,0,0))
    rounded_box("task_chair_back_brace",(.07,.07,.35),(0,d*.24,h*.62),m["metal"],.016)
    cylinder("task_chair_column",.045,.3,(0,0,.32),m["metal"],10,taper=.85)
    cylinder("task_chair_hub",.09,.12,(0,0,.16),m["wood_dark"],10,taper=.75)
    for i in range(5):
        a=i*math.tau/5;rounded_box("task_chair_spoke",(w*.33,.065,.04),(math.cos(a)*w*.14,math.sin(a)*d*.14,.1),m["metal"],.012,(0,0,-a))
        cylinder("task_chair_wheel",.04,.055,(math.cos(a)*w*.31,math.sin(a)*d*.31,.055),m["wood_dark"],10,(math.pi/2,0,a))
    for side in (-1,1):
        rounded_box("task_chair_arm_post",(.055,.055,.2),(side*w*.36,0,.59),m["wood"],.014)
        cushion("task_chair_arm_pad",(.16,d*.32,.05),(side*w*.36,-.02,.7),m["fabric"])
    return (w,d,h)


def build_floor_lamp(m):
    w=d=.45;h=1.55
    cylinder("floor_lamp_weighted_base",w*.34,.07,(0,0,.035),m["metal"],18,taper=.88)
    cylinder("floor_lamp_wood_pole",.035,h*.69,(0,0,h*.39),m["wood"],10,taper=.78)
    rounded_box("floor_lamp_offset_arm",(w*.36,.055,.055),(w*.15,0,h*.76),m["wood"],.014,(0,-.18,0))
    cylinder("floor_lamp_bell_shade",w*.44,h*.23,(w*.3,0,h*.86),m["fabric"],16,taper=.43)
    cylinder("floor_lamp_shade_rim",w*.46,.025,(w*.3,0,h*.745),m["linen"],16)
    return (w,d,h)


def build_table_lamp(m):
    w=d=.3;h=.52
    cylinder("table_lamp_foot",w*.3,.04,(0,0,.02),m["wood_dark"],16,taper=.85)
    cylinder("table_lamp_ceramic_body",w*.28,h*.35,(0,0,h*.23),m["clay"],12,taper=.68)
    cylinder("table_lamp_neck",w*.075,h*.11,(0,0,h*.46),m["wood"],10,taper=.8)
    cylinder("table_lamp_linen_shade",w*.48,h*.34,(0,0,h*.76),m["linen"],16,taper=.56)
    return (w,d,h)


def build_plant(m,large):
    w=d=.6 if large else .32;h=1.3 if large else .52;pot_h=h*(.27 if large else .33);pot_w=w*(.62 if large else .68)
    cylinder("plant_textured_pot",pot_w/2,pot_h,(0,0,pot_h/2),m["clay"] if large else m["fabric"],12,taper=.82)
    cylinder("plant_pot_rim",pot_w*.54,pot_h*.16,(0,0,pot_h*.88),m["linen"],12,taper=.94)
    count=9 if large else 5
    for i in range(count):
        a=i*2.399;stem_h=h*((.3+(i%4)*.075) if large else (.25+(i%3)*.085));sx=math.cos(a)*w*.07;sy=math.sin(a)*d*.07
        cylinder("plant_stem",.012 if large else .009,stem_h,(sx,sy,pot_h+stem_h/2),m["green"],7,taper=.65)
        leaf("plant_leaf",w*(.39 if large else .45),h*(.25 if large else .28),(sx+math.cos(a)*w*.18,sy+math.sin(a)*d*.14,pot_h+stem_h),m["green_light"] if i%3 else m["green"],(0,-a,math.cos(a)*.45))
        if large or i%2==0:
            sa=a+math.pi*.78;leaf("plant_side_leaf",w*(.3 if large else .34),h*(.2 if large else .21),(sx+math.cos(sa)*w*.13,sy+math.sin(sa)*d*.11,pot_h+stem_h*.68),m["green"],(0,-sa,math.cos(sa)*.5))
    return (w,d,h)


def build_large_plant(m):return build_plant(m,True)
def build_small_plant(m):return build_plant(m,False)


def build_round_rug(m):
    w=d=1.8;h=.02
    cylinder("round_rug_textured_base",w*.5,.025,(0,0,.013),m["fabric"],32,uv_scale=5)
    cylinder("round_rug_inner_field",w*.35,.014,(0,0,.032),m["linen"],28,uv_scale=5)
    cylinder("round_rug_medallion",w*.15,.012,(0,0,.044),m["clay"],18)
    for i in range(8):
        a=i*math.pi/4;cylinder("round_rug_dot",w*.028,.012,(math.cos(a)*w*.24,math.sin(a)*d*.24,.045),m["mustard"] if i%2 else m["green"],8)
    return (w,d,h)


def build_runner_rug(m):
    w,d,h=.8,2.2,.02
    rounded_box("runner_rug_textured_base",(w,d,.025),(0,0,.013),m["fabric"],.055,uv_scale=6)
    rounded_box("runner_rug_inner_field",(w*.72,d*.83,.014),(0,0,.031),m["linen"],.035,uv_scale=6)
    for i in range(-3,4):rounded_box("runner_rug_stripe",(w*.66,d*.035,.012),(0,i*d*.105,.044),m["clay"] if i%2 else m["green"],.006)
    for i in range(12):
        x=-w*.44+i*w*.08
        for side in (-1,1):rounded_box("runner_rug_fringe",(w*.025,d*.055,.018),(x,side*d*.52,.018),m["linen"],.004)
    return (w,d,h)


def build_braided_rug(m):
    w,d,h=1.6,1.0,.025
    base=cylinder("braided_rug_connected_base",w*.5,.025,(0,0,.013),m["wood_dark"],36,uv_scale=6)
    base.scale.y=d/w
    for index,(scale,mat) in enumerate(((.84,m["fabric"]),(.66,m["linen"]),(.46,m["clay"]),(.25,m["mustard"]))):
        ring=cylinder(f"braided_rug_layer_{index}",w*.5*scale,.011,(0,0,.03+index*.011),mat,32,uv_scale=5)
        ring.scale.y=d/w
    return (w,d,h)


def build_scallop_rug(m):
    w,d,h=1.7,1.2,.025
    rounded_box("scallop_rug_connected_field",(w*.86,d*.82,.025),(0,0,.013),m["linen"],.13,uv_scale=5)
    for side in (-1,1):
        for i in range(6):
            x=-w*.36+i*w*.145
            cylinder("scallop_rug_petal",w*.09,.024,(x,side*d*.43,.014),m["fabric"] if i%2 else m["rose"],16)
    for side in (-1,1):
        for i in range(3):
            y=-d*.24+i*d*.24
            cylinder("scallop_rug_side_petal",d*.1,.024,(side*w*.43,y,.014),m["fabric"] if i%2 else m["rose"],16)
    rounded_box("scallop_rug_inner_panel",(w*.64,d*.56,.014),(0,0,.034),m["linen"],.12,uv_scale=4)
    return (w,d,h)


def build_checker_rug(m):
    w=d=1.5;h=.025
    rounded_box("checker_rug_connected_base",(w,d,.025),(0,0,.013),m["wood_dark"],.09,uv_scale=5)
    cell=w/4
    for row in range(4):
        for col in range(4):
            rounded_box("checker_rug_patch",(cell*.94,cell*.94,.014),(-w*.5+cell*(col+.5),-d*.5+cell*(row+.5),.033),m["linen"] if (row+col)%2 else m["clay"],.035,uv_scale=2)
    for i in range(14):
        x=-w*.45+i*w*.07
        for side in (-1,1):
            rounded_box("checker_rug_fringe",(w*.022,d*.055,.018),(x,side*d*.52,.016),m["linen"],.004)
    return (w,d,h)


def build_mirror(m):
    w,d,h=.7,.08,1.1;frame=.06
    rounded_box("mirror_reflective_surface",(w-frame*2,d*.2,h-frame*2),(0,-d*.18,h*.5),m["blue"],.07)
    rounded_box("mirror_bottom_frame",(w,d,h*.055),(0,0,h*.05),m["wood_dark"],.018)
    rounded_box("mirror_top_frame",(w,d,h*.065),(0,0,h*.95),m["wood"],.02)
    for x in (-w/2+frame/2,w/2-frame/2):rounded_box("mirror_side_frame",(frame,d,h),(x,0,h*.5),m["wood"],.018)
    cylinder("mirror_sun_medallion",w*.095,d*.65,(0,-.005,h+frame*.5),m["clay"],14,(math.pi/2,0,0))
    for i in range(7):
        a=math.pi*(.15+i*.116);rounded_box("mirror_sun_ray",(frame*.38,d*.45,h*.11),(math.cos(a)*w*.24,0,h+frame*.5+math.sin(a)*w*.24),m["wood"],.01,(0,a-math.pi/2,0))
    for x in (-w*.3,w*.3):rounded_box("mirror_stand_foot",(w*.22,d*2.2,h*.055),(x,d*.35,h*.04),m["wood_dark"],.014)
    return (w,d,h+.25)


def build_pet_bed(m):
    w,d,h=.7,.55,.18
    cushion("pet_bed_connected_base",(w*.9,d*.88,h*.32),(0,0,h*.16),m["wood_dark"])
    cushion("pet_bed_inner_cushion",(w*.68,d*.63,h*.36),(0,0,h*.28),m["linen"],uv_scale=3.5)
    cushion("pet_bed_back_bolster",(w*.8,d*.2,h*.52),(0,d*.34,h*.46),m["fabric"])
    for side in (-1,1):cushion("pet_bed_side_bolster",(w*.19,d*.66,h*.44),(side*w*.39,0,h*.38),m["fabric"])
    cushion("pet_bed_front_bolster",(w*.46,d*.17,h*.32),(0,-d*.34,h*.27),m["fabric"])
    rounded_box("pet_bed_patch",(w*.16,d*.12,.016),(w*.15,-.03,h*.49),m["rose"],.018)
    return (w,d,h*.72)


# Expanded catalog: recognizable silhouettes inspired by broad furniture
# typologies, while every mesh and construction detail remains original.
def build_modular_sectional(m):
    w,d,h=2.85,1.9,.82
    rounded_box("sectional_connected_plinth",(w*.94,.82,.18),(0,.45,.2),m["wood_dark"],.045)
    rounded_box("sectional_chaise_plinth",(.92,d*.92,.18),(-w*.34,-.25,.2),m["wood_dark"],.045)
    for i,x in enumerate((-.92,0,.92)):
        cushion(f"sectional_seat_{i}",(.84,.78,.2),(x,.42,.39),m["fabric"])
        cushion(f"sectional_back_{i}",(.82,.18,.43),(x,.76,.65),m["fabric"],(-.08,0,(i-1)*.008))
    cushion("sectional_chaise_cushion",(.84,1.18,.2),(-.92,-.46,.39),m["fabric"])
    rounded_box("sectional_back_shell",(w*.88,.16,.48),(0,.79,.55),m["fabric"],.05)
    rounded_box("sectional_outer_arm",(.22,d*.88,.5),(-w*.465,.03,.48),m["fabric"],.055)
    rounded_box("sectional_return_arm",(.22,.82,.5),(w*.465,.43,.48),m["fabric"],.055)
    return (w,d,h)


def build_midcentury_sofa(m):
    w,d,h=2.05,.86,.83
    rounded_box("juniper_wood_frame",(w*.94,d*.72,.13),(0,0,.28),m["wood"],.028)
    for x in (-w*.39,w*.39):
        for y in (-d*.28,d*.28): add_leg("juniper_splayed_leg",(x,y,.15),.3,.075,m["wood_dark"],(.04 if y>0 else -.04,.035 if x>0 else -.035))
    for i,x in enumerate((-.5,.5)):
        cushion(f"juniper_tailored_seat_{i}",(.92,d*.61,.16),(x,-.03,.42),m["fabric"])
        cushion(f"juniper_tailored_back_{i}",(.9,.15,.4),(x,d*.28,.66),m["fabric"],(-.06,0,(i-.5)*.012))
    for side in (-1,1):
        rounded_box("juniper_open_arm_post",(.08,.08,.43),(side*w*.46,-.02,.48),m["wood"],.018)
        rounded_box("juniper_arm_rail",(.12,d*.66,.08),(side*w*.46,0,.68),m["wood"],.02)
    return (w,d,h)


def build_sleeper_sofa(m):
    w,d,h=1.98,.92,.84
    build_upholstered_seat(m,"sleeper",w,d,h,2)
    rounded_box("sleeper_pullout_front",(w*.68,.08,.17),(0,-d*.43,.27),m["wood_dark"],.025)
    rounded_box("sleeper_mattress_hint",(w*.58,.05,.07),(0,-d*.48,.39),m["linen"],.018)
    rounded_box("sleeper_pull_strap",(.18,.035,.07),(0,-d*.525,.29),m["metal"],.012)
    return (w,d,h)


def bed_layers(m,prefix,w,d,h,headboard=None):
    rounded_box(f"{prefix}_frame",(w,d*.94,.22),(0,0,.25),m["wood"],.045)
    cushion(f"{prefix}_mattress",(w*.92,d*.82,.22),(0,-.02,.45),m["linen"])
    cushion(f"{prefix}_duvet",(w*.88,d*.55,.1),(0,-d*.13,.59),m["fabric"])
    for side in (-1,1): cushion(f"{prefix}_pillow_{side}",(w*.34,d*.2,.13),(side*w*.22,d*.27,.64),m["linen"],(-.04,0,side*.025))
    if headboard: headboard()


def build_storage_platform_bed(m):
    w,d,h=1.65,2.15,.92
    bed_layers(m,"drawer_bed",w,d,h,lambda: rounded_box("drawer_bed_slat_headboard",(w,.13,.58),(0,d*.45,.65),m["wood"],.04))
    for side in (-1,1):
        for i in range(2):
            y=(-.25+i*.58)*d
            rounded_box("underbed_drawer",(w*.44,.055,.25),(side*w*.48,y,.27),m["variant"],.022,(0,0,math.pi/2))
            add_knob("underbed_pull",(side*w*.515,y,.27),.026,m["metal"])
    for i in range(5): rounded_box("headboard_slat",(w*.13,.04,.45),((i-2)*w*.17,d*.515,.67),m["wood_dark"],.015)
    return (w,d,h)


def build_arch_bed(m):
    w,d,h=1.65,2.12,1.2
    bed_layers(m,"petal_bed",w,d,h)
    rounded_box("petal_headboard_stem",(w*.94,.16,.68),(0,d*.45,.73),m["fabric"],.08)
    for i in range(5):
        x=(i-2)*w*.17; z=.91+(.16 if i==2 else .09 if i in (1,3) else 0)
        cylinder("petal_headboard_arch",w*.115,.12,(x,d*.45,z),m["fabric"],18,(math.pi/2,0,0))
    for x in (-w*.27,0,w*.27): add_knob("petal_tuft",(x,d*.36,.82),.025,m["linen"])
    return (w,d,h)


def build_daybed(m):
    w,d,h=2.05,.98,.9
    rounded_box("daybed_frame",(w*.96,d*.88,.2),(0,0,.28),m["wood"],.045)
    cushion("daybed_mattress",(w*.88,d*.76,.2),(0,-.02,.48),m["fabric"])
    cushion("daybed_back_bolster",(w*.78,.2,.34),(0,d*.34,.69),m["linen"])
    for side in (-1,1):
        rounded_box("daybed_end_frame",(.15,d*.9,.62),(side*w*.45,0,.56),m["wood"],.04)
        cushion("daybed_end_cushion",(.19,d*.55,.32),(side*w*.4,.05,.65),m["fabric"])
    for x in (-w*.36,w*.36): rounded_box("daybed_drawer",(w*.62,.06,.2),(x,-d*.46,.25),m["variant"],.02)
    return (w,d,h)


def build_bunk_bed(m):
    w,d,h=1.05,2.1,1.75
    for z in (.42,1.22):
        rounded_box("bunk_rail_frame",(w,d*.94,.15),(0,0,z),m["wood"],.035)
        cushion("bunk_mattress",(w*.88,d*.82,.16),(0,-.02,z+.14),m["linen"])
        cushion("bunk_blanket",(w*.84,d*.45,.08),(0,-d*.17,z+.25),m["fabric"])
    for x in (-w*.44,w*.44):
        for y in (-d*.43,d*.43): rounded_box("bunk_post",(.09,.09,h),(x,y,h/2),m["wood_dark"],.022)
    for i in range(5): rounded_box("bunk_ladder_rung",(w*.56,.07,.07),(w*.18,-d*.49,.45+i*.25),m["wood"],.018)
    for x in (-w*.1,w*.46): rounded_box("bunk_ladder_side",(.07,.07,1.34),(x,-d*.49,.87),m["wood_dark"],.018)
    rounded_box("bunk_guard_rail",(w*.72,.07,.08),(-w*.1,-d*.43,1.58),m["wood"],.018)
    return (w,d,h)


def build_nesting_tables(m):
    w,d,h=.62,.48,.56
    for i,(scale,x,y,z) in enumerate(((1,-.07,.03,h),(.72,.18,-.08,h*.72))):
        rounded_box(f"nest_table_top_{i}",(w*scale,d*scale,.07),(x,y,z-.035),m["wood"] if i==0 else m["variant"],.025)
        for sx in (-1,1):
            for sy in (-1,1): add_leg(f"nest_table_leg_{i}",(x+sx*w*scale*.38,y+sy*d*scale*.34,(z-.07)/2),z-.07,.045,m["wood_dark"])
    return (w,d,h)


def build_tray_table(m):
    w,d,h=.52,.42,.61
    rounded_box("tray_table_top",(w,d,.07),(0,0,h-.035),m["variant"],.04)
    for side in (-1,1):
        rounded_box("tray_table_long_edge",(.06,d,.12),(side*w*.46,0,h+.005),m["wood"],.018)
        rounded_box("tray_table_cross_leg",(.055,d*.9,h*.82),(side*w*.22,0,h*.43),m["wood_dark"],.015,(side*.22,0,0))
    rounded_box("tray_table_short_edge",(w,.05,.12),(0,d*.44,h+.005),m["wood"],.018)
    return (w,d,h+.065)


def build_c_table(m):
    w,d,h=.46,.38,.64
    rounded_box("c_table_base",(w,d,.07),(0,0,.04),m["wood_dark"],.022)
    rounded_box("c_table_spine",(.09,d*.2,h*.88),(w*.37,d*.27,h*.48),m["wood"],.025)
    rounded_box("c_table_top",(w,d,.075),(0,0,h-.038),m["variant"],.03)
    return (w,d,h)


def build_drawer_side_table(m):
    w,d,h=.54,.44,.59
    rounded_box("keepsake_body",(w*.92,d*.9,h*.56),(0,0,h*.58),m["wood"],.04)
    rounded_box("keepsake_top",(w,d,.075),(0,0,h-.038),m["variant"],.025)
    rounded_box("keepsake_drawer",(w*.76,.055,h*.2),(0,-d*.47,h*.67),m["variant"],.018)
    add_knob("keepsake_knob",(0,-d*.52,h*.67),.03,m["metal"])
    for x in (-w*.36,w*.36):
        for y in (-d*.31,d*.31): add_leg("keepsake_leg",(x,y,h*.2),h*.4,.06,m["wood_dark"])
    return (w,d,h)


def build_standing_desk(m):
    w,d,h=1.4,.7,1.15
    rounded_box("standing_desk_top",(w,d,.09),(0,0,h-.045),m["wood"],.032)
    for x in (-w*.36,w*.36):
        rounded_box("standing_desk_column",(.13,.13,h*.72),(x,0,h*.48),m["steel"],.025)
        rounded_box("standing_desk_foot",(w*.22,d*.78,.075),(x,0,.05),m["wood_dark"],.02)
    rounded_box("standing_desk_control",(.16,.11,.055),(w*.27,-d*.46,h-.12),m["screen"],.012)
    return (w,d,h)


def build_trestle_desk(m):
    w,d,h=1.5,.72,.76
    rounded_box("maker_desk_top",(w,d,.1),(0,0,h-.05),m["wood"],.032)
    for x in (-w*.35,w*.35):
        rounded_box("maker_trestle_beam",(.1,d*.72,.09),(x,0,.12),m["wood_dark"],.02)
        for y in (-d*.27,d*.27): rounded_box("maker_trestle_leg",(.075,.075,h*.75),(x,y,h*.39),m["wood"],.02,(.06 if y>0 else -.06,0,0))
        rounded_box("maker_trestle_cap",(.18,d*.72,.075),(x,0,h-.15),m["wood_dark"],.018)
    rounded_box("maker_long_stretcher",(w*.68,.08,.08),(0,0,h*.32),m["wood_dark"],.018)
    return (w,d,h)


def build_corner_desk(m):
    w,d,h=1.8,1.5,.76
    rounded_box("corner_desk_main_top",(w,.65,.09),(0,d*.27,h-.045),m["wood"],.032)
    rounded_box("corner_desk_return_top",(.62,d*.78,.09),(-w*.33,-d*.21,h-.045),m["wood"],.032)
    for x,y in ((w*.43,d*.27),(-w*.43,d*.27),(-w*.33,-d*.43)):
        for sy in (-1,1): add_leg("corner_desk_leg",(x,y+sy*.2,(h-.09)/2),h-.09,.07,m["wood_dark"])
    for z in (.22,.43,.64): rounded_box("corner_desk_shelf",(.48,d*.34,.055),(-w*.33,-d*.42,z),m["variant"],.016)
    return (w,d,h)


def build_secretary_desk(m):
    w,d,h=.98,.48,1.48
    rounded_box("secretary_tall_body",(w*.94,d*.9,h*.88),(0,.02,h*.52),m["wood"],.045)
    for z in (.31,.55):
        rounded_box("secretary_lower_drawer",(w*.76,.055,.17),(0,-d*.46,z),m["variant"],.018); add_knob("secretary_pull",(0,-d*.51,z),.028,m["metal"])
    rounded_box("secretary_fold_surface",(w*.78,d*.9,.08),(0,-d*.42,h*.63),m["variant"],.025,(math.pi*.08,0,0))
    for x in (-w*.25,w*.25):
        for z in (1.0,1.24): rounded_box("secretary_cubby",(w*.38,d*.52,.055),(x,.03,z),m["wood_dark"],.016)
    return (w,d,h)


def build_tv(m):
    w,d,h=1.22,.11,.76
    rounded_box("tv_warm_frame",(w,.075,h*.72),(0,0,h*.61),m["wood"],.035)
    rounded_box("tv_dark_screen",(w*.92,.025,h*.58),(0,-.052,h*.61),m["screen"],.025)
    rounded_box("tv_easel_post",(.09,.09,h*.72),(0,.02,h*.3),m["wood_dark"],.02)
    for side in (-1,1): rounded_box("tv_easel_foot",(w*.28,.075,.075),(side*w*.18,.01,.06),m["wood_dark"],.018,(0,side*.16,0))
    cylinder("tv_control_button",.018,.012,(w*.42,-.078,h*.36),m["metal"],10,(math.pi/2,0,0))
    return (w,d,h)


def build_tv_stand(m):
    w,d,h=1.6,.42,.56
    rounded_box("media_bench_carcass",(w*.96,d*.9,h*.68),(0,0,h*.5),m["wood"],.04)
    rounded_box("media_bench_top",(w,d,.075),(0,0,h-.038),m["wood"],.025)
    rounded_box("media_open_shelf",(w*.3,d*.72,h*.19),(0,-.02,h*.61),m["wood_dark"],.025)
    for side in (-1,1):
        rounded_box("media_sliding_door",(w*.29,.055,h*.46),(side*w*.31,-d*.47,h*.53),m["variant"],.022)
        add_knob("media_door_pull",(side*w*.22,-d*.515,h*.53),.025,m["metal"])
    rounded_box("media_console",(w*.22,d*.42,.07),(0,-.02,h*.61),m["screen"],.015)
    for x in (-w*.4,w*.4):
        for y in (-d*.3,d*.3): add_leg("media_bench_leg",(x,y,.1),.2,.065,m["wood_dark"])
    return (w,d,h)


def cabinet_box(m,prefix,w,d,h,wall=False):
    rounded_box(f"{prefix}_carcass",(w*.96,d*.92,h*.92),(0,0,h*.5),m["wood"],.035)
    front=-d*.47
    for side in (-1,1):
        rounded_box(f"{prefix}_door",(w*.43,.055,h*.74),(side*w*.235,front,h*.52),m["variant"],.02)
        rounded_box(f"{prefix}_door_panel",(w*.32,.025,h*.58),(side*w*.235,front-.035,h*.52),m["wood"],.014)
        add_knob(f"{prefix}_knob",(side*w*.1,front-.065,h*.52),.022,m["metal"])
    if not wall: rounded_box(f"{prefix}_toe_kick",(w*.86,d*.72,.1),(0,d*.06,.08),m["wood_dark"],.018)


def counter_top(m,prefix,w,d,z):
    rounded_box(f"{prefix}_countertop-surface",(w,d,.075),(0,0,z),m["counter"],.025,uv_scale=1.2)


def build_refrigerator(m):
    w,d,h=.9,.72,1.85
    rounded_box("fridge_connected_body",(w*.96,d*.92,h*.96),(0,.02,h*.5),m["steel"],.065)
    for side in (-1,1):
        rounded_box("fridge_upper_door",(w*.46,.055,h*.59),(side*w*.235,-d*.47,h*.65),m["variant"],.028)
        rounded_box("fridge_long_handle",(.035,.035,h*.34),(side*w*.09,-d*.515,h*.68),m["metal"],.012)
    rounded_box("fridge_freezer_drawer",(w*.84,.06,h*.23),(0,-d*.475,h*.19),m["variant"],.025)
    rounded_box("fridge_freezer_handle",(w*.42,.035,.035),(0,-d*.52,h*.25),m["metal"],.012)
    return (w,d,h)


def build_range(m):
    w,d,h=.76,.68,.92
    rounded_box("range_body",(w*.96,d*.92,h*.82),(0,.02,h*.45),m["variant"],.045)
    rounded_box("range_cooktop",(w,d,.075),(0,0,h-.04),m["screen"],.022)
    for x in (-w*.23,w*.23):
        for y in (-d*.22,d*.22): cylinder("range_burner",w*.12,.018,(x,y,h+.008),m["metal"],16)
    rounded_box("range_oven_window",(w*.68,.035,h*.36),(0,-d*.47,h*.38),m["screen"],.04)
    rounded_box("range_oven_handle",(w*.58,.04,.04),(0,-d*.52,h*.66),m["metal"],.014)
    for x in (-w*.28,-w*.09,w*.09,w*.28): cylinder("range_control_knob",.035,.035,(x,-d*.5,h*.79),m["metal"],12,(math.pi/2,0,0))
    return (w,d,h)


def build_dishwasher(m):
    w,d,h=.6,.62,.86
    rounded_box("dishwasher_body",(w*.96,d*.92,h*.94),(0,0,h*.5),m["steel"],.035)
    rounded_box("dishwasher_panel",(w*.9,.06,h*.78),(0,-d*.48,h*.47),m["variant"],.025)
    rounded_box("dishwasher_control_rail",(w*.78,.035,.09),(0,-d*.525,h*.79),m["screen"],.018)
    for x in (-w*.21,-w*.13,-w*.05): cylinder("dishwasher_button",.012,.012,(x,-d*.55,h*.79),m["linen"],8,(math.pi/2,0,0))
    return (w,d,h)


def build_base_cabinet(m):
    w,d,h=.9,.62,.91
    cabinet_box(m,"base_cabinet",w,d,h-.075)
    counter_top(m,"base_cabinet",w,d,h-.038)
    return (w,d,h)


def build_wall_cabinet(m):
    w,d,h=.8,.36,.76
    cabinet_box(m,"wall_cabinet",w,d,h,True)
    rounded_box("wall_cabinet_crown",(w,d,.065),(0,0,h-.032),m["wood_dark"],.02)
    return (w,d,h)


def build_sink_cabinet(m):
    w,d,h=1.0,.64,.93
    cabinet_box(m,"sink_cabinet",w,d,h-.075)
    counter_top(m,"sink_cabinet",w,d,h-.038)
    rounded_box("apron_sink_basin",(w*.58,d*.58,.19),(0,-d*.04,h-.04),m["linen"],.045)
    cylinder("sink_faucet_stem",.025,.3,(0,d*.28,h+.13),m["steel"],10)
    rounded_box("sink_faucet_spout",(.04,d*.26,.04),(0,d*.18,h+.27),m["steel"],.015)
    return (w,d,h+.29)


def build_kitchen_counter(m):
    w,d,h=1.2,.65,.93
    rounded_box("prep_counter_carcass",(w*.96,d*.9,h*.78),(0,.02,h*.46),m["wood"],.04)
    counter_top(m,"prep_counter",w,d,h-.038)
    for x in (-w*.28,w*.28):
        rounded_box("prep_counter_drawer",(w*.42,.055,h*.18),(x,-d*.46,h*.72),m["variant"],.018); add_knob("prep_counter_pull",(x,-d*.51,h*.72),.024,m["metal"])
        rounded_box("prep_counter_door",(w*.42,.055,h*.4),(x,-d*.46,h*.38),m["variant"],.022)
    rounded_box("prep_counter_toe_kick",(w*.84,d*.62,.09),(0,.05,.07),m["wood_dark"],.018)
    return (w,d,h)


def build_kitchen_island(m):
    w,d,h=1.8,.9,.94
    rounded_box("island_connected_body",(w*.72,d*.76,h*.76),(-w*.08,.05,h*.46),m["wood"],.045)
    counter_top(m,"island",w,d,h-.04)
    for x in (-.52,0,.52):
        rounded_box("island_front_panel",(w*.25,.055,h*.48),(x,-d*.4,h*.44),m["variant"],.022)
        add_knob("island_pull",(x,-d*.445,h*.55),.024,m["metal"])
    for z in (.22,.5): rounded_box("island_open_shelf",(w*.48,d*.26,.06),(w*.31,d*.17,z),m["wood_dark"],.018)
    for x in (-w*.42,w*.42): rounded_box("island_overhang_leg",(.085,.085,h*.82),(x,d*.36,h*.43),m["wood_dark"],.02)
    return (w,d,h)


def build_framed_art(m,prefix,w,d,h,art,frame=True):
    if frame:
        rounded_box(f"{prefix}_frame",(w,d,h),(0,0,h/2),m["wood_dark"],.025)
        rounded_box(f"{prefix}_mat",(w*.9,d*.72,h*.86),(0,-d*.22,h/2),m["linen"],.012)
        rounded_box(f"{prefix}_art",(w*.84,d*.22,h*.79),(0,-d*.48,h/2),art,.008,uv_scale=.9)
    else:
        rounded_box(f"{prefix}_paper",(w,d,h),(0,0,h/2),m["linen"],.018)
        rounded_box(f"{prefix}_art",(w*.96,d*.35,h*.96),(0,-d*.42,h/2),art,.01,uv_scale=.9)
        for x in (-w*.42,w*.42): cylinder(f"{prefix}_pin",.018,d*.7,(x,-d*.38,h*.91),m["metal"],10,(math.pi/2,0,0))
    return (w,d,h)


def build_landscape_painting(m): return build_framed_art(m,"valley",.9,.07,.65,m["art_landscape"])
def build_botanical_print(m): return build_framed_art(m,"botanical",.6,.045,.8,m["art_botanical"])
def build_abstract_poster(m): return build_framed_art(m,"abstract",.6,.035,.85,m["art_abstract"],False)
def build_coast_poster(m): return build_framed_art(m,"coast",.65,.035,.9,m["art_coast"],False)


def build_round_wall_mirror(m):
    w=d2=h=.72;depth=.055
    cylinder("round_mirror_frame",w*.5,depth,(0,0,h*.5),m["wood"],28,(math.pi/2,0,0))
    cylinder("round_mirror_glass",w*.42,depth*.32,(0,-depth*.55,h*.5),m["blue"],28,(math.pi/2,0,0))
    cylinder("round_mirror_hanger",w*.055,depth*.45,(0,depth*.18,h*.98),m["metal"],10,(math.pi/2,0,0))
    return (w,depth,h)


def build_arch_wall_mirror(m):
    w,d,h=.62,.055,.98
    rounded_box("arch_mirror_frame",(w,d,h*.78),(0,0,h*.39),m["wood"],.055)
    cylinder("arch_mirror_crown",w*.5,d,(0,0,h*.78),m["wood"],28,(math.pi/2,0,0))
    rounded_box("arch_mirror_glass",(w*.82,d*.34,h*.68),(0,-d*.55,h*.4),m["blue"],.045)
    cylinder("arch_mirror_glass_crown",w*.41,d*.34,(0,-d*.55,h*.76),m["blue"],28,(math.pi/2,0,0))
    return (w,d,h)


def build_whiteboard(m):
    w,d,h=.9,.055,.65
    rounded_box("whiteboard_frame",(w,d,h),(0,0,h/2),m["wood"],.025)
    rounded_box("whiteboard_surface",(w*.9,d*.3,h*.84),(0,-d*.55,h*.52),m["linen"],.015)
    rounded_box("whiteboard_tray",(w*.56,d*2.8,.055),(0,-d*.15,.02),m["wood_dark"],.014)
    for i,mat in enumerate((m["clay"],m["green"],m["blue"])): rounded_box("whiteboard_marker",(w*.13,.025,.025),((-1+i)*w*.14,-d*1.5,.055),mat,.006)
    for i,(x,z,mat) in enumerate(((-.22,.43,m["mustard"]),(.18,.32,m["rose"]))): rounded_box(f"whiteboard_note_{i}",(.14,d*.08,.12),(x,-d*.76,z),mat,.008,(0,0,(i-.5)*.06))
    return (w,d,h)


def build_wall_shelf(m):
    w,d,h=.9,.24,.36
    rounded_box("peg_shelf_back",(w,.07,h*.72),(0,d*.42,h*.56),m["wood"],.025)
    rounded_box("peg_shelf_board",(w,d,.075),(0,0,h*.68),m["wood"],.022)
    for x in (-w*.32,0,w*.32):
        cylinder("peg_shelf_peg",.025,d*.48,(x,-d*.2,h*.22),m["wood_dark"],10,(math.pi/2,0,0))
        cylinder("peg_shelf_cap",.04,.035,(x,-d*.45,h*.22),m["variant"],10,(math.pi/2,0,0))
    return (w,d,h)


def build_floating_shelves(m):
    w,d,h=1.0,.24,.72
    for i,(x,z) in enumerate(((-.1,.18),(.1,.58))):
        rounded_box(f"floating_board_{i}",(w*(.82 if i else 1),d,.085),(x,0,z),m["wood"],.025)
        for sx in (-1,1): rounded_box("floating_hidden_bracket",(.08,d*.5,.16),(x+sx*w*(.34 if i else .43),d*.32,z-.08),m["metal"],.015)
    return (w,d,h)


def build_books_upright(m):
    w,d,h=.52,.18,.31
    colors=(m["rose"],m["green"],m["mustard"],m["blue"],m["linen"]);cursor=-w*.46
    for i in range(7):
        bw=.055+(i%3)*.012;bh=h*(.7+(i%4)*.08)
        rounded_box(f"upright_book_{i}",(bw,d*(.82-(i%2)*.08),bh),(cursor+bw/2,0,bh/2),colors[i%len(colors)],.009,(0,0,(i-3)*.018),uv_scale=3);cursor+=bw+.012
        rounded_box(f"upright_book_spine_{i}",(bw*.68,.012,.018),(cursor-bw*.5,-d*.45,bh*.72),m["linen"],.003)
    return (w,d,h)


def build_books_stacked(m):
    w,d,h=.42,.28,.26
    colors=(m["green"],m["rose"],m["mustard"],m["blue"],m["linen"])
    for i in range(5):
        bw=w*(.78+(i%3)*.09);bd=d*(.76+(i%2)*.12);z=.027+i*.05
        rounded_box(f"stacked_book_{i}",(bw,bd,.045),(((i%2)-.5)*.025,0,z),colors[i],.008,(0,0,(i-2)*.022),uv_scale=3)
        rounded_box(f"stacked_pages_{i}",(bw*.88,bd*.94,.026),(((i%2)-.5)*.025,-.005,z),m["linen"],.005)
    return (w,d,h)


def laundry_machine(m,prefix,w=.68,d=.7,h=.9,dryer=False):
    rounded_box(f"{prefix}_body",(w*.96,d*.94,h*.95),(0,0,h*.5),m["variant"],.055)
    rounded_box(f"{prefix}_control_band",(w*.86,.055,h*.15),(0,-d*.49,h*.82),m["linen"],.02)
    cylinder(f"{prefix}_door_rim",w*.31,.055,(0,-d*.5,h*.46),m["steel"],24,(math.pi/2,0,0))
    cylinder(f"{prefix}_door_glass",w*.24,.025,(0,-d*.55,h*.46),m["screen"],24,(math.pi/2,0,0))
    cylinder(f"{prefix}_dial",.055,.035,(w*.25,-d*.54,h*.82),m["metal"],14,(math.pi/2,0,0))
    for i in range(3): cylinder(f"{prefix}_button",.012,.012,(-w*.27+i*.055,-d*.54,h*.82),m["green"] if dryer else m["blue"],8,(math.pi/2,0,0))
    if dryer:
        for i in range(5): rounded_box("dryer_vent",(w*.2,.018,.012),(0,-d*.555,h*.27+i*.035),m["metal"],.003)
    else: rounded_box("washer_detergent_drawer",(w*.22,.025,h*.07),(-w*.23,-d*.54,h*.82),m["variant"],.01)
    return (w,d,h)


def build_washer(m): return laundry_machine(m,"washer")
def build_dryer(m): return laundry_machine(m,"dryer",dryer=True)
def build_stacked_laundry(m):
    w,d,h=.7,.72,1.81
    laundry_machine(m,"stacked_washer",w,d,.88,False)
    # Build the dryer at local origin, then lift its newly created objects.
    before=set(bpy.context.scene.objects)
    laundry_machine(m,"stacked_dryer",w,d,.88,True)
    for obj in set(bpy.context.scene.objects)-before: obj.location.z+=.9
    rounded_box("stacking_joiner",(w*.94,d*.9,.065),(0,0,.9),m["wood_dark"],.018)
    return (w,d,h)


BUILDERS = {
    "sofa": build_sofa,
    "loveseat": build_loveseat,
    "armchair": build_armchair,
    "ottoman": build_ottoman,
    "coffee-table": build_coffee_table,
    "side-table": build_side_table,
    "queen-bed": build_bed,
    "single-bed": build_single_bed,
    "nightstand": build_nightstand,
    "dining-table": build_dining_table,
    "dresser": build_dresser,
    "wardrobe": build_wardrobe,
    "bookshelf": build_bookshelf,
    "cabinet": build_cabinet,
    "bench": build_bench,
    "round-table": build_round_table,
    "dining-chair": build_dining_chair,
    "bar-stool": build_bar_stool,
    "desk": build_desk,
    "office-chair": build_office_chair,
    "floor-lamp": build_floor_lamp,
    "table-lamp": build_table_lamp,
    "large-plant": build_large_plant,
    "small-plant": build_small_plant,
    "round-rug": build_round_rug,
    "runner-rug": build_runner_rug,
    "braided-rug": build_braided_rug,
    "scallop-rug": build_scallop_rug,
    "checker-rug": build_checker_rug,
    "mirror": build_mirror,
    "pet-bed": build_pet_bed,
    "modular-sectional": build_modular_sectional,
    "midcentury-sofa": build_midcentury_sofa,
    "sleeper-sofa": build_sleeper_sofa,
    "storage-platform-bed": build_storage_platform_bed,
    "arched-bed": build_arch_bed,
    "daybed": build_daybed,
    "bunk-bed": build_bunk_bed,
    "nesting-tables": build_nesting_tables,
    "tray-side-table": build_tray_table,
    "c-side-table": build_c_table,
    "drawer-side-table": build_drawer_side_table,
    "standing-desk": build_standing_desk,
    "trestle-desk": build_trestle_desk,
    "corner-desk": build_corner_desk,
    "secretary-desk": build_secretary_desk,
    "slim-tv": build_tv,
    "tv-stand": build_tv_stand,
    "refrigerator": build_refrigerator,
    "range-oven": build_range,
    "dishwasher": build_dishwasher,
    "base-cabinet": build_base_cabinet,
    "wall-cabinet": build_wall_cabinet,
    "sink-cabinet": build_sink_cabinet,
    "kitchen-counter": build_kitchen_counter,
    "kitchen-island": build_kitchen_island,
    "washer": build_washer,
    "dryer": build_dryer,
    "stacked-laundry": build_stacked_laundry,
    "landscape-painting": build_landscape_painting,
    "botanical-print": build_botanical_print,
    "abstract-poster": build_abstract_poster,
    "coast-poster": build_coast_poster,
    "round-wall-mirror": build_round_wall_mirror,
    "arch-wall-mirror": build_arch_wall_mirror,
    "whiteboard": build_whiteboard,
    "wall-shelf": build_wall_shelf,
    "floating-shelves": build_floating_shelves,
    "books-upright": build_books_upright,
    "books-stacked": build_books_stacked,
}


# Blender's script runner does not always include this directory on sys.path.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from window_models import window_builders
BUILDERS.update(window_builders(rounded_box, cylinder, material, finish_mesh))
from workspace_models import workspace_builders
WORKSPACE_BUILDERS = workspace_builders(rounded_box, cylinder, material, finish_mesh)
BUILDERS.update(WORKSPACE_BUILDERS)
from bathroom_models import bathroom_builders
BATHROOM_BUILDERS = bathroom_builders(rounded_box, cylinder, material, finish_mesh)
BUILDERS.update(BATHROOM_BUILDERS)
from media_models import media_builders
MEDIA_BUILDERS = media_builders(rounded_box, cylinder, material, finish_mesh)
BUILDERS.update(MEDIA_BUILDERS)
from building_models import building_builders
BUILDING_BUILDERS = building_builders(rounded_box, cylinder, material, finish_mesh)
BUILDERS.update(BUILDING_BUILDERS)
from kitchen_models import kitchen_builders
KITCHEN_BUILDERS = kitchen_builders(rounded_box, cylinder, material, finish_mesh)
BUILDERS.update(KITCHEN_BUILDERS)
from interior_models import interior_builders
INTERIOR_BUILDERS = interior_builders(rounded_box, cylinder, material, finish_mesh)
BUILDERS.update(INTERIOR_BUILDERS)
from outdoor_models import outdoor_builders
OUTDOOR_BUILDERS = outdoor_builders(rounded_box, cylinder, material, finish_mesh)
BUILDERS.update(OUTDOOR_BUILDERS)
from cozy_models import cozy_builders
COZY_BUILDERS = cozy_builders(rounded_box, cylinder, material, finish_mesh)
from detailed_models import detailed_builders
DETAILED_BUILDERS = detailed_builders(rounded_box, cylinder, material, finish_mesh)
COZY_BUILDERS.update(DETAILED_BUILDERS)
from garden_collection import garden_builders
COZY_BUILDERS.update(garden_builders(rounded_box, cylinder, material, finish_mesh))
from aquarium_models import aquarium_builders
COZY_BUILDERS.update(aquarium_builders(rounded_box, cylinder, material, finish_mesh))
BUILDERS.update(COZY_BUILDERS)
from interior_refinement import refined_builders
REFINED_BUILDERS=refined_builders(BUILDERS,rounded_box,cylinder,material)
COZY_BUILDERS.update(REFINED_BUILDERS)
BUILDERS.update(REFINED_BUILDERS)
from home_collection import home_builders
HOME_BUILDERS=home_builders(rounded_box,cylinder,material)
COZY_BUILDERS.update(HOME_BUILDERS)
BUILDERS.update(HOME_BUILDERS)
from holiday_models import holiday_builders
HOLIDAY_BUILDERS=holiday_builders(rounded_box,cylinder,material)
COZY_BUILDERS.update(HOLIDAY_BUILDERS)
BUILDERS.update(HOLIDAY_BUILDERS)


def export_model(catalog_id, builder):
    reset_scene()
    bpy.context.preferences.filepaths.save_version = 0
    mats = common_materials()
    dimensions = builder(mats)
    if catalog_id.startswith("window-") or catalog_id in WORKSPACE_BUILDERS or catalog_id in BATHROOM_BUILDERS or catalog_id in MEDIA_BUILDERS or catalog_id in BUILDING_BUILDERS or catalog_id in KITCHEN_BUILDERS or catalog_id in INTERIOR_BUILDERS or catalog_id in OUTDOOR_BUILDERS or catalog_id in COZY_BUILDERS:
        # Fit the authored outer envelope to the advertised real dimensions.
        # Keep the Y=0 wall attachment plane, including for projecting bay models.
        from mathutils import Vector
        bpy.context.view_layer.update()
        meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        bounds = [obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
        low = [min(p[i] for p in bounds) for i in range(3)]
        high = [max(p[i] for p in bounds) for i in range(3)]
        factors = [dimensions[i] / (high[i] - low[i]) for i in range(3)]
        for obj in meshes:
            # Bake transforms first: non-uniform world scaling must not distort
            # the orientation of angled bay returns or the curved crown.
            matrix = obj.matrix_world.copy()
            if obj.get("shared_geometry"):
                from mathutils import Matrix
                obj.matrix_world=Matrix.Diagonal(Vector((*factors,1))) @ Matrix.Translation(Vector((-(low[0]+high[0])/2,-(low[1]+high[1])/2,-low[2]))) @ matrix
                continue
            for vertex in obj.data.vertices:
                point = matrix @ vertex.co
                y_center = (low[1]+high[1])/2 if catalog_id in WORKSPACE_BUILDERS or catalog_id in BATHROOM_BUILDERS or catalog_id in MEDIA_BUILDERS or catalog_id in BUILDING_BUILDERS or catalog_id in KITCHEN_BUILDERS or catalog_id in INTERIOR_BUILDERS or catalog_id in OUTDOOR_BUILDERS or catalog_id in COZY_BUILDERS else 0
                vertex.co = ((point.x-(low[0]+high[0])/2)*factors[0], (point.y-y_center)*factors[1], (point.z-low[2])*factors[2])
            obj.matrix_world.identity()
        bpy.context.view_layer.update()
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            obj["catalog_id"] = catalog_id
            obj["nominal_width_m"] = dimensions[0]
            obj["nominal_depth_m"] = dimensions[1]
            obj["nominal_height_m"] = dimensions[2]
            obj.select_set(True)
    bpy.context.scene["catalog_id"] = catalog_id
    bpy.context.scene["nominal_dimensions_m"] = dimensions
    # Keep the .blend source fully editable with named component objects.
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_OUT / f"{catalog_id}.blend"), check_existing=False)

    # The browser does not need every cushion, leg, book, and leaf as a separate
    # draw object. Join only the exported copy into one multi-material mesh;
    # Blender preserves all material slots, UVs, and the connected silhouette.
    all_export_meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    shared = [obj for obj in all_export_meshes if obj.get("shared_geometry")]
    moving = [obj for obj in all_export_meshes if obj.get("motion_role")]
    for obj in moving:
        bpy.ops.object.select_all(action="DESELECT");obj.select_set(True);bpy.context.view_layer.objects.active=obj
        bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY",center="BOUNDS")
    meshes = [obj for obj in all_export_meshes if not obj.get("motion_role") and not obj.get("shared_geometry")]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    export_mesh = bpy.context.view_layer.objects.active
    export_mesh.name = catalog_id
    export_mesh["catalog_id"] = catalog_id
    export_mesh["nominal_width_m"] = dimensions[0]
    export_mesh["nominal_depth_m"] = dimensions[1]
    export_mesh["nominal_height_m"] = dimensions[2]
    for obj in moving+shared:obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_OUT / f".{catalog_id}-new.glb"),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )
    # Atomic replacement avoids truncating a live asset while OneDrive or the
    # preview server briefly holds the previous file open.
    import time
    for attempt in range(5):
        try:
            os.replace(GLB_OUT / f".{catalog_id}-new.glb", GLB_OUT / f"{catalog_id}.glb")
            break
        except OSError:
            if attempt == 4:
                raise
            time.sleep(.25 * (attempt + 1))
    print(f"EXPORTED {catalog_id}: {dimensions}")


def main():
    BLEND_OUT.mkdir(parents=True, exist_ok=True)
    GLB_OUT.mkdir(parents=True, exist_ok=True)
    prepare_web_textures()
    requested = set(sys.argv[sys.argv.index("--") + 1:]) if "--" in sys.argv else set()
    for catalog_id, builder in BUILDERS.items():
        if requested and catalog_id not in requested:
            continue
        export_model(catalog_id, builder)


if __name__ == "__main__":
    main()
