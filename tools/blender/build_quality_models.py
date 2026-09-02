import math
import os
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
        "fabric": material("upholstery-textured", (0.56, 0.65, 0.45), "handpainted-neutral-weave.png", 0.96),
        "linen": material("linen-textured", (0.92, 0.83, 0.68), "handpainted-cream-linen.png", 0.98),
        "clay": material("terracotta", (0.66, 0.29, 0.18), None, 0.92),
        "mustard": material("mustard-cloth", (0.72, 0.52, 0.2), "handpainted-cream-linen.png", 0.96),
        "metal": material("aged-bronze", (0.2, 0.16, 0.12), None, 0.72, 0.16),
        "green": material("leaf-green", (0.25, 0.42, 0.21), None, 0.94),
        "green_light": material("leaf-light", (0.43, 0.56, 0.31), None, 0.94),
        "rose": material("dusty-rose", (0.68, 0.38, 0.36), "handpainted-cream-linen.png", 0.96),
        "blue": material("smoky-mirror", (0.36, 0.55, 0.57), None, 0.28, 0.72),
    }


def build_sofa(m):
    w, d, h = 2.1, 0.9, 0.85
    rounded_box("sofa_continuous_upholstered_base", (w * 0.92, d * 0.78, 0.24), (0, 0, 0.25), m["fabric"], 0.07)
    rounded_box("sofa_wood_lower_frame", (w * 0.86, d * 0.7, 0.10), (0, 0.01, 0.12), m["wood_dark"], 0.025)
    rounded_box("sofa_back_shell", (w * 0.86, 0.2, h * 0.58), (0, d * 0.31, h * 0.56), m["fabric"], 0.07)
    arm_w = 0.24
    for side in (-1, 1):
        cushion(f"sofa_arm_{side}", (arm_w, d * 0.78, 0.47), (side * (w / 2 - arm_w / 2), 0, 0.43), m["fabric"])
        rounded_box(f"sofa_arm_cap_{side}", (arm_w * 0.86, d * 0.57, 0.045), (side * (w / 2 - arm_w / 2), -0.01, 0.68), m["linen"], 0.014)
    inner = w - arm_w * 2.1
    each = inner / 3
    for i in range(3):
        x = -inner / 2 + each / 2 + i * each
        cushion(f"sofa_seat_cushion_{i}", (each * 0.94, d * 0.61, 0.18), (x, -0.045, 0.42), m["fabric"], (0, 0, (i - 1) * 0.01))
        cushion(f"sofa_back_cushion_{i}", (each * 0.91, 0.17, 0.39), (x, d * 0.24, 0.68), m["fabric"], (-0.09, 0, (i - 1) * 0.012))
    for side in (-1, 1):
        cushion(f"sofa_throw_pillow_{side}", (0.3, 0.12, 0.31), (side * 0.66, 0.12, 0.58), m["mustard" if side < 0 else "clay"], (0.05, 0, side * 0.16))
    for x in (-w * 0.39, w * 0.39):
        for y in (-d * 0.27, d * 0.27):
            add_leg("sofa_tapered_foot", (x, y, 0.07), 0.14, 0.09, m["wood_dark"], (0.02 if y > 0 else -0.02, 0.02 if x > 0 else -0.02))
    return (w, d, h)


def build_armchair(m):
    w, d, h = 0.88, 0.82, 0.9
    rounded_box("chair_upholstered_base", (w * 0.88, d * 0.76, 0.23), (0, 0, 0.27), m["fabric"], 0.065)
    rounded_box("chair_back_shell", (w * 0.72, 0.2, h * 0.58), (0, d * 0.3, h * 0.59), m["fabric"], 0.07)
    cushion("chair_seat_cushion", (w * 0.59, d * 0.57, 0.18), (0, -0.03, 0.44), m["fabric"])
    cushion("chair_back_cushion", (w * 0.58, 0.17, h * 0.4), (0, d * 0.22, 0.7), m["fabric"], (-0.1, 0, 0.02))
    for side in (-1, 1):
        cushion(f"chair_arm_{side}", (0.19, d * 0.7, 0.47), (side * (w / 2 - 0.095), 0, 0.46), m["fabric"])
        rounded_box(f"chair_arm_cap_{side}", (0.16, d * 0.52, 0.04), (side * (w / 2 - 0.095), -0.01, 0.7), m["linen"], 0.012)
    cushion("chair_reading_pillow", (0.34, 0.11, 0.31), (0.1, 0.09, 0.64), m["mustard"], (0.06, 0, -0.18))
    for x in (-w * 0.34, w * 0.34):
        for y in (-d * 0.27, d * 0.27):
            add_leg("chair_tapered_foot", (x, y, 0.075), 0.15, 0.075, m["wood_dark"], (0.02 if y > 0 else -0.02, 0.02 if x > 0 else -0.02))
    return (w, d, h)


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
    w, d, h = 1.45, .85, .82
    rounded_box("loveseat_connected_base", (w*.92, d*.78, .23), (0, 0, .25), m["fabric"], .065)
    rounded_box("loveseat_back_shell", (w*.84, .19, h*.57), (0, d*.3, h*.57), m["fabric"], .065)
    arm=.22
    for side in (-1,1):
        cushion(f"loveseat_arm_{side}",(arm,d*.75,.46),(side*(w/2-arm/2),0,.43),m["fabric"])
        add_leg("loveseat_foot",(side*w*.36,-d*.27,.07),.14,.075,m["wood_dark"]);add_leg("loveseat_foot",(side*w*.36,d*.27,.07),.14,.075,m["wood_dark"])
    for i,x in enumerate((-w*.2,w*.2)):
        cushion(f"loveseat_seat_{i}",(w*.36,d*.58,.18),(x,-.04,.42),m["fabric"],(0,0,(i-.5)*.018))
        cushion(f"loveseat_back_{i}",(w*.36,.16,.37),(x,d*.23,.67),m["fabric"],(-.09,0,(i-.5)*.025))
    cushion("loveseat_throw",(.28,.11,.28),(w*.25,.08,.58),m["rose"],(.05,0,-.16))
    return (w,d,h)


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
    "mirror": build_mirror,
    "pet-bed": build_pet_bed,
}


def export_model(catalog_id, builder):
    reset_scene()
    mats = common_materials()
    dimensions = builder(mats)
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
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
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
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_OUT / f"{catalog_id}.glb"),
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
    print(f"EXPORTED {catalog_id}: {dimensions}")


def main():
    BLEND_OUT.mkdir(parents=True, exist_ok=True)
    GLB_OUT.mkdir(parents=True, exist_ok=True)
    prepare_web_textures()
    for catalog_id, builder in BUILDERS.items():
        export_model(catalog_id, builder)


if __name__ == "__main__":
    main()
