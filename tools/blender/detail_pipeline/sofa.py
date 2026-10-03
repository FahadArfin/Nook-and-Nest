"""Original detailed oak sofa recipe with a dense, editable cloth master.

The accepted slat sofa source supplies the measured joinery envelope. This
recipe adds actual sculpted compression folds, projected seam threads, attached
welt geometry, underside woven support straps and an accessible cushion zipper.
Dense cloth and stitches are baked; silhouette, welts and construction survive
as deliberate browser geometry. No detail depends on an unexported shader.
"""
import hashlib
import math
import random
from pathlib import Path

import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

WOOD='wood-honey-textured'
FABRIC='upholstery-textured'
THREAD='tailored-tone-on-tone-stitch'
BRASS='joinery-aged-brass'


def validate_spec(root,spec):
    detail=spec['detail'];levels=detail['subdivisionLevels']
    if type(levels) is not int or not 0<=levels<=3:
        raise ValueError('Sofa subdivisionLevels must be an integer from 0 through 3')
    for key,low,high in [('stitchSpacingM',.004,.03),('threadRadiusM',.0001,.002),('foldDepthM',0,.015)]:
        value=detail[key]
        if type(value) not in (int,float) or not math.isfinite(value) or not low<=value<=high:
            raise ValueError(f'Sofa {key} must be finite and between {low} and {high} metres')


def input_paths(root,spec):
    """Declare recipe dependencies before any geometry is authored."""
    import json
    manifest=root/'assets-source/realism-materials.json'
    records=json.loads(manifest.read_text())['materials']
    paths={root/records[family][field] for family in ('oak','linen') for field in ('baseColor','normal','orm')}
    return [('material',manifest)]+[('material',p) for p in sorted(paths)]


def _key(material):
    return material.get('material_key',material.get('sofa_material_key',material.name.split('.')[0]))


def _append(ctx):
    source=ctx.root/ctx.spec['sourceBlend']
    with bpy.data.libraries.load(str(source),link=False) as (src,dst):
        dst.objects=list(src.objects)
    objects=[];materials={}
    for obj in dst.objects:
        if not obj:continue
        ctx.own(obj)
        if obj.type not in ('MESH','CURVE'):
            continue
        if any(word in obj.name.lower() for word in ('ground','camera','backdrop')):
            continue
        ctx.master.collection.objects.link(obj)
        obj.data=ctx.own(obj.data.copy())
        for index,old in enumerate(obj.data.materials):
            key=_key(old)
            if key not in ctx.spec['materialKeys']:raise ValueError('Unexpected source material '+key)
            if key not in materials:
                material=ctx.own(old.copy());material.name='Master '+key;material['material_key']=key
                materials[key]=material
                bs=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
                if 'Sheen Weight' in bs.inputs:bs.inputs['Sheen Weight'].default_value=0
            obj.data.materials[index]=materials[key]
        objects.append(obj)
    if set(materials)!=set(ctx.spec['materialKeys']):raise ValueError('Source must retain all four material keys')
    return objects,materials


def _subdivide_and_sculpt(ctx,obj,index):
    ctx.use(ctx.master);ctx.select([obj],obj)
    if ctx.spec['detail']['subdivisionLevels']:
        modifier=obj.modifiers.new('Dense editable cloth sampling','SUBSURF')
        modifier.subdivision_type='SIMPLE';modifier.levels=ctx.spec['detail']['subdivisionLevels']
        modifier.render_levels=modifier.levels
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.shape_key_add(name='Uncompressed sewn cover')
    sculpt=obj.shape_key_add(name='Corner tension and foam compression')
    sculpt.value=1
    points=[v.co for v in obj.data.vertices]
    half=Vector([max(abs(v[a]) for v in points) for a in range(3)])
    back='back' in obj.name.lower();depth=ctx.spec['detail']['foldDepthM']
    rng=random.Random(ctx.spec['seed']+index*97)
    phases=[rng.uniform(-.004,.004) for _ in range(4)]
    for vertex in sculpt.data:
        p=vertex.co.copy()
        if back:
            front=max(0,min(1,(-p.y-half.y*.25)/(half.y*.65)))
            dz=p.z+half.z
            displacement=0
            for anchor in (-.68,-.31,.13,.57):
                x=p.x-anchor
                line=x-.24*dz
                envelope=math.exp(-(dz/.17)**2)
                displacement+=depth*.70*math.exp(-(line/.010)**2)*envelope
                displacement-=depth*.22*math.exp(-((line-.014)/.015)**2)*envelope
            for side in (-1,1):
                dx=half.x-side*p.x
                for offset in (.036,.085):
                    line=dz-.67*dx-offset
                    displacement+=depth*.65*math.exp(-(line/.009)**2)*math.exp(-(dx+dz)/.19)
            p.y+=displacement*front
        else:
            top=max(0,min(1,(p.z-half.z*.15)/(half.z*.7)))
            displacement=0
            for side in (-1,1):
                dx=half.x-side*p.x
                for front in (-1,1):
                    dy=half.y+front*p.y
                    phase=phases[(0 if side<0 else 2)+(0 if front<0 else 1)]
                    for offset,weight in ((.025,1),(.069,.68),(.110,.38)):
                        line=dy-.66*dx-offset-phase
                        envelope=math.exp(-(dx+dy)/.16)
                        displacement-=depth*weight*math.exp(-(line/.008)**2)*envelope
                        displacement+=depth*.29*weight*math.exp(-((line-.011)/.011)**2)*envelope
            p.z+=displacement*top
            # A shallow front boxing crease and corner puckering genuinely
            # change geometry; the browser carries these through tangent bake.
            front=max(0,min(1,(-p.y-half.y*.78)/(half.y*.17)))
            p.y+=depth*.42*math.exp(-((p.z+.010)/.010)**2)*front
            for side in (-1,1):
                dx=half.x-side*p.x
                p.y+=depth*.35*math.sin(dx*95+p.z*20)*math.exp(-dx/.07)*front*math.exp(-(p.z/.05)**2)
        vertex.co=p
    for polygon in obj.data.polygons:polygon.use_smooth=True
    obj['construction']=f'Dense editable foam compression and corner-tension shape key; {depth*1000:.1f} mm maximum authored folds'
    bpy.context.view_layer.update()


def _curve(ctx,name,paths,radius,material,scene,resolution=1):
    data=ctx.own(bpy.data.curves.new(name+' editable paths','CURVE'))
    data.dimensions='3D';data.resolution_u=1;data.bevel_depth=radius;data.bevel_resolution=resolution
    data.use_fill_caps=True
    for points,closed in paths:
        spline=data.splines.new('POLY');spline.points.add(len(points)-1)
        for p,co in zip(spline.points,points):p.co=(*co,1)
        spline.use_cyclic_u=closed
    obj=ctx.own(bpy.data.objects.new(name,data));scene.collection.objects.link(obj);data.materials.append(material)
    return obj


def _sample_polyline(points,spacing):
    lengths=[(points[(i+1)%len(points)]-p).length for i,p in enumerate(points)]
    total=sum(lengths);count=max(1,int(total/spacing));step=total/count
    samples=[]
    for i in range(count):
        distance=i*step;segment=0
        while distance>lengths[segment] and segment<len(lengths)-1:
            distance-=lengths[segment];segment+=1
        a=points[segment];b=points[(segment+1)%len(points)]
        tangent=(b-a).normalized();samples.append((a+tangent*distance,tangent,step))
    return samples


def _threads(ctx,cushion,welts,material,index):
    ctx.use(ctx.master);graph=bpy.context.evaluated_depsgraph_get();graph.update()
    tree=BVHTree.FromObject(cushion,graph)
    inverse=cushion.matrix_world.inverted();world=cushion.matrix_world
    center=cushion.location.copy();paths=[]
    for welt in welts:
        if 'lower' in welt.name.lower():continue
        points=[inverse@(welt.matrix_world@Vector(point.co[:3])) for point in welt.data.splines[0].points]
        back='back' in cushion.name.lower()
        for point in points:
            if back:
                point.x*=.985;point.z*=.953;point.y-=.006
            else:
                point.x*=.958;point.y*=.958;point.z+=.014
        for p,tangent,step in _sample_polyline(points,ctx.spec['detail']['stitchSpacingM']):
            dash=[]
            for along,burial in ((-.32,-.92),(-.16,-.15),(0,.35),(.16,-.15),(.32,-.92)):
                location,normal,_,_=tree.find_nearest(p+tangent*(step*along))
                if location is None:continue
                # Stitch ends pierce the cover instead of exposing vertical
                # cylinder caps, which bake as conspicuous black pinpricks.
                dash.append(world@(location+normal*(ctx.spec['detail']['threadRadiusM']*burial)))
            if len(dash)==5:paths.append((dash,False))
    obj=_curve(ctx,f'Cover {index+1} individually sewn machine stitches',paths,
               ctx.spec['detail']['threadRadiusM'],material,ctx.master,resolution=1)
    obj['construction']='Projected five-point arched stitches with ends buried into the cover; selected-to-active source detail'
    return obj


def _seat_welts(ctx,cushion,welts):
    ctx.use(ctx.master);graph=bpy.context.evaluated_depsgraph_get();graph.update()
    tree=BVHTree.FromObject(cushion,graph);inverse=cushion.matrix_world.inverted();world=cushion.matrix_world
    for welt in welts:
        welt_inverse=welt.matrix_world.inverted()
        for spline in welt.data.splines:
            for point in spline.points:
                local=inverse@(welt.matrix_world@Vector(point.co[:3]))
                position,normal,_,_=tree.find_nearest(local)
                if position is not None:
                    # Tube center penetrates its sewn cover slightly; no loose
                    # floating piping even on the curved rounded corners.
                    position=welt_inverse@(world@(position+normal*welt.data.bevel_depth*.32))
                    point.co=(*position,1)


def _box(ctx,name,size,center,material,bevel=.001):
    x,y,z=[d/2 for d in size]
    vertices=[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]
    faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    obj=ctx.mesh_object(name,vertices,faces,material,ctx.master);obj.location=center
    if bevel:
        mod=obj.modifiers.new('Machined edge','BEVEL');mod.width=bevel;mod.segments=2
        mod=obj.modifiers.new('Weighted construction normals','WEIGHTED_NORMAL')
    return obj


def _construction(ctx,mats):
    parts=[]
    # Visible from below: broad woven support straps, fastened below the slats.
    # Their crossing deflection is actual geometry and stays in the browser.
    for index in range(11):
        x=-.79+index*.158;verts=[];faces=[]
        for j in range(25):
            y=-.321+j*.642/24
            z=.2605+.0012*math.sin(j*math.pi/4+index*math.pi)
            for offset in (-.021,.021):verts.append((x+offset,y,z))
        for j in range(24):faces.append((j*2,j*2+1,j*2+3,j*2+2))
        obj=ctx.mesh_object(f'Underside woven longitudinal strap {index+1:02d}',verts,faces,mats[THREAD],ctx.master)
        mod=obj.modifiers.new('Real strap thickness','SOLIDIFY');mod.thickness=.0014
        parts.append(obj)
        for y in (-.318,.318):
            parts.append(_box(ctx,f'Strap staple {index+1} {y}',(.025,.003,.0015),(x,y,.2625),mats[BRASS],.0005))
    for index,y in enumerate((-.22,0,.22)):
        verts=[];faces=[]
        for j in range(45):
            x=-.86+j*1.72/44;z=.2605-.0012*math.sin(j*math.pi/2+index*math.pi)
            for offset in (-.020,.020):verts.append((x,y+offset,z))
        for j in range(44):faces.append((j*2,j*2+1,j*2+3,j*2+2))
        obj=ctx.mesh_object(f'Underside woven transverse strap {index+1}',verts,faces,mats[THREAD],ctx.master)
        mod=obj.modifiers.new('Real strap thickness','SOLIDIFY');mod.thickness=.0014;parts.append(obj)
    # Zipper resides at the accessible rear edge of the centre cushion, within
    # its measured envelope. Tape, paired teeth and pull are independent parts.
    parts.append(_box(ctx,'Centre seat concealed zipper tape',(.38,.008,.012),(0,.292,.333),mats[THREAD],.001))
    for side in (-1,1):
        for index in range(36):
            parts.append(_box(ctx,f'Zipper {side} tooth {index+1:02d}',(.0036,.0032,.002),(-.173+index*.0099,.286,.333+side*.0019),mats[BRASS],.0004))
    parts.append(_box(ctx,'Zipper slider',(.011,.006,.009),(.171,.283,.333),mats[BRASS],.0012))
    pull=[Vector((.172,.278,.331)),Vector((.184,.276,.327)),Vector((.187,.276,.314)),Vector((.175,.278,.315))]
    parts.append(_curve(ctx,'Zipper loop pull',[(pull,True)],.0012,mats[BRASS],ctx.master,1))
    return parts


def _join_atlas(ctx,parts):
    ctx.use(ctx.browser)
    for index,obj in enumerate(parts):
        group=obj.vertex_groups.new(name=f'bake_pair_{index}')
        group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    ctx.select(parts,parts[0]);bpy.ops.object.join();target=bpy.context.object;target.name='Browser cloth with shared bake atlas'
    # Unique UV islands across all four low-poly cushions, distinct from the
    # original physical textile UV retained on the dense source covers.
    uv=target.data.uv_layers.new(name='BakeAtlas');target.data.uv_layers.active=uv
    ctx.select([target],target);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    try:
        bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.012,correct_aspect=True,scale_to_bounds=True)
    finally:
        bpy.ops.object.mode_set(mode='OBJECT')
    target.data.uv_layers.active=target.data.uv_layers['BakeAtlas']
    target.data.uv_layers['BakeAtlas'].active_render=True
    return target


def build(ctx):
    source_parts,mats=_append(ctx);ctx.use(ctx.master)
    cushions=sorted([o for o in source_parts if o.type=='MESH' and ('crowned tailored' in o.name or 'Continuous raked back' in o.name)],key=lambda o:o.name)
    if len(cushions)!=4:raise ValueError('Expected exactly three seat covers and one continuous back')
    # Browser silhouettes are evaluated before the dense sculpt, preserving
    # the accepted support contact and catalog envelope exactly.
    low_cushions=[ctx.evaluated_copy(o,ctx.browser,'Browser '+o.name) for o in cushions]
    bake_groups=[];stitches=[]
    for index,cushion in enumerate(cushions):
        prefix='Back perimeter' if 'back' in cushion.name.lower() else cushion.name.split(' crowned')[0]
        welts=[o for o in source_parts if o.type=='CURVE' and o.name.startswith(prefix)]
        _subdivide_and_sculpt(ctx,cushion,index)
        _seat_welts(ctx,cushion,welts)
        sewn=_threads(ctx,cushion,welts,mats[THREAD],index);stitches.append(sewn)
        bake_groups.append({'name':cushion.name,'sources':[cushion,sewn],'vertexGroup':f'bake_pair_{index}'})
    additions=_construction(ctx,mats)
    master_parts=source_parts+stitches+additions
    remaining=[o for o in source_parts if o not in cushions]+additions
    browser_parts=[ctx.evaluated_copy(o,ctx.browser,'Browser '+o.name) for o in remaining]
    # Material slots are copied so the source stays independently editable.
    browser_mats={}
    for obj in browser_parts+low_cushions:
        for index,material in enumerate(obj.data.materials):
            key=_key(material)
            if key not in browser_mats:
                copy=ctx.own(material.copy());copy.name='Browser '+key;copy['material_key']=key;browser_mats[key]=copy
            obj.data.materials[index]=browser_mats[key]
    target=_join_atlas(ctx,low_cushions);browser_parts.append(target)
    records=__import__('json').loads((ctx.root/'assets-source/realism-materials.json').read_text())['materials']
    retained=[]
    for kind,field in [('baseColor','baseColor'),('normal','normal'),('orm','orm')]:
        path=ctx.root/records['oak'][field]
        retained.append({'path':path.relative_to(ctx.root).as_posix(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                         'bytes':path.stat().st_size,'kind':kind,'materialKey':WOOD,'method':'retained measured CC0 oak map'})
    # Explicit glTF AO connection shares the already-packed G/B ORM texture.
    material=browser_mats[WOOD];nodes=material.node_tree.nodes;links=material.node_tree.links
    orm=next(n for n in nodes if n.type=='TEX_IMAGE' and n.image and 'oak-orm' in n.image.name)
    split=nodes.new('ShaderNodeSeparateColor');links.new(orm.outputs['Color'],split.inputs[0])
    from io_scene_gltf2.blender.com.material_helpers import create_settings_group
    group=ctx.own(create_settings_group('glTF Material Output'))
    node=nodes.new('ShaderNodeGroup');node.node_tree=group;links.new(split.outputs['Red'],node.inputs['Occlusion'])
    tint=tuple(mats[FABRIC].diffuse_color)
    return {'master_parts':master_parts,'browser_parts':browser_parts,
            'bake_sources':[o for pair in bake_groups for o in pair['sources']], 'bake_groups':bake_groups,
            'bake_target':target,'bake_material_key':FABRIC,'fabric_tint':tint,
            'neutral_bake_materials':[(mats[FABRIC],1),(mats[THREAD],.88)],
            'retained_map_receipts':retained}
