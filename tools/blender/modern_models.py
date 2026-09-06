"""Batch 12: original modern furniture assemblies in real metres.
Named components are retained in .blend; only the browser export is joined.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
from detailed_models import Geometry
ROOT=Path(__file__).resolve().parents[2]
MANIFEST=json.loads((ROOT/'tools/blender/modern_manifest.json').read_text())
PALETTE={'porcelain':(.81,.84,.84),'ivory':(.86,.84,.78),'slate':(.20,.25,.29),'charcoal':(.035,.046,.055),'blue':(.12,.25,.38),'moss':(.32,.46,.40),'lavender':(.49,.39,.62),'stone':(.67,.68,.65)}

def modern_builders(original,box,cyl,material):
 def build(row,m):
  id=row['id'];kind=row['type'];style=row['style'];w,d,h=[row[k]/1000 for k in ['widthMm','depthMm','heightMm']];color=PALETTE[row['color']]
  # Preserve existing material identifiers while replacing brown defaults.
  for key in ['wood','wood_dark','metal','fabric','linen','variant','counter','steel']:
   mat=m[key];bs=mat.node_tree.nodes.get('Principled BSDF')
   for link in list(bs.inputs['Base Color'].links):mat.node_tree.links.remove(link)
   c=(.055,.067,.075) if key in ['wood_dark','metal'] else (.62,.67,.70) if key=='steel' else (.90,.90,.86) if key=='linen' else (.74,.77,.76) if key=='counter' else color
   mat.diffuse_color=(*c,1);bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.94 if key in ['linen','fabric'] else .47
  chrome=material('modern-brushed-aluminum',(.54,.60,.65),None,.32,.78)
  dark=material('modern-recess-charcoal',(.018,.025,.032),None,.82)
  white=material('modern-porcelain-detail',(.91,.93,.92),None,.55)
  seam=material('modern-tailored-welting',tuple(c*.78 for c in color),None,.98)
  glass=material('modern-smoked-glass',(.29,.40,.46),None,.16,.05)
  gb=glass.node_tree.nodes.get('Principled BSDF');gb.inputs['Transmission Weight'].default_value=.72;gb.inputs['IOR'].default_value=1.46
  water=material('fountain-water',(.12,.58,.70),None,.17,.1)
  details=Geometry()
  def B(n,size,p,mat=None,b=.014,rot=(0,0,0)):return box(n,size,p,mat or m['wood'],min(b,min(size)*.26),rot)
  def C(n,r,depth,p,mat=None,rot=(0,0,0),taper=1):return cyl(n,r,depth,p,mat or chrome,32,rot,taper)
  def tube(n,pts,r,mat=None,closed=False):
   # Constant-radius tubes for metal joinery, seams and cables, not tapered branches.
   curve=bpy.data.curves.new(n,'CURVE');curve.dimensions='3D';curve.resolution_u=1;curve.bevel_depth=r;curve.bevel_resolution=2
   spline=curve.splines.new('POLY');spline.points.add(len(pts)-1)
   for p,co in zip(spline.points,pts):p.co=(*co,1)
   spline.use_cyclic_u=closed;ob=bpy.data.objects.new(n,curve);bpy.context.collection.objects.link(ob);curve.materials.append(mat or chrome)
   bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH');ob.select_set(False);return ob
  def ring(n,rx,ry,z,mat=None,r=.004,x=0,y=0):return tube(n,[(x+rx*math.cos(i*math.tau/48),y+ry*math.sin(i*math.tau/48),z) for i in range(48)],r,mat,True)
  def face_ring(n,rx,rz,y,z,mat=None,r=.004,x=0):return tube(n,[(x+rx*math.cos(i*math.tau/48),y,z+rz*math.sin(i*math.tau/48)) for i in range(48)],r,mat,True)
  def seam_box(n,sx,sy,z,x=0,y=0):
   r=min(sx,sy)*.13;pts=[]
   for cx,cy,a in [(sx/2-r,sy/2-r,0),(-sx/2+r,sy/2-r,90),(-sx/2+r,-sy/2+r,180),(sx/2-r,-sy/2+r,270)]:
    for j in range(6):t=math.radians(a+j*18);pts.append((x+cx+r*math.cos(t),y+cy+r*math.sin(t),z))
   tube(n,pts,min(.0025,szscale*.004),seam,True)
  szscale=min(w,d,h)
  def surface(n,verts,faces,mat):
   mesh=bpy.data.meshes.new(n);mesh.from_pydata(verts,[],faces);mesh.materials.append(mat);mesh.update();o=bpy.data.objects.new(n,mesh);bpy.context.collection.objects.link(o)
   for poly in mesh.polygons:poly.use_smooth=True
   return o
  def foot(x,y,z=.11):
   C('aluminum_foot',.022,z,(x,y,z/2));C('rubber_floor_glide',.025,.009,(x,y,.005),dark)
  def legs(z,spread=.38):
   for x in [-w*spread,w*spread]:
    for y in [-d*spread,d*spread]:foot(x,y,z)
  def ellip_top(n,z,thick=.035,mat=None,rx=None,ry=None):
   o=C(n,1,thick,(0,0,z),mat or m['counter']);o.scale.x=rx or w/2;o.scale.y=ry or d/2;return o
  def mesh_panel(n,sx,sz,y,z):
   for i in range(23):
    x=(i/22-.5)*sx;tube(n+'_vertical',[(x,y+.015*math.sin(j*math.pi/8),z+(j/8-.5)*sz) for j in range(9)],.0014,dark)
   for j in range(27):tube(n+'_horizontal',[(-sx/2,y,z+(j/26-.5)*sz),(0,y+.014,z+(j/26-.5)*sz),(sx/2,y,z+(j/26-.5)*sz)],.0013,dark)
  def chair(office=False):
   if id in ['wingback-chair','slat-lounge-chair','dining-chair','folding-chair','bench']:
    original[id](m);return
   seat_z=h*.46 if h<.9 else .46;swivel=office or any(k in style for k in ['swivel','barrel','glider']);is_mesh=any(k in style for k in ['mesh','aeron','ergonomic']);low=kind=='Sofas' or 'playsofa' in style
   if office:
    C('pneumatic_column',.034,seat_z-.12,(0,0,seat_z/2),chrome)
    for i in range(5):
     a=i*math.tau/5;x=w*.42*math.cos(a);y=d*.42*math.sin(a);tube('cast_aluminum_star',[(0,0,.18),(x*.65,y*.65,.11),(x,y,.07)],.022,chrome)
     for off in [-.015,.015]:C('twin_caster',.034,.025,(x+off,y,.038),dark,(math.pi/2,0,0))
    B('tilt_mechanism',(.22,.20,.075),(0,0,seat_z-.11),dark);tube('adjustment_lever',[(.08,0,seat_z-.1),(.25,0,seat_z-.09)],.009,dark)
   elif swivel:
    C('swivel_disc',min(w,d)*.32,.055,(0,0,.03),dark);C('swivel_column',.07,seat_z*.7,(0,0,seat_z*.35),chrome)
   elif 'cantilever' in style:
    for x in [-w*.36,w*.36]:tube('continuous_cantilever_tube',[(x,d*.35,.025),(x,-d*.38,.025),(x,-d*.4,seat_z-.05),(x,d*.3,seat_z-.05),(x,d*.32,h*.92)],.018,chrome)
   elif 'stool' in style or 'saddle' in style or id=='bar-stool':
    legs(seat_z);ring('footrest',w*.33,d*.33,seat_z*.42,chrome,.015)
   else:legs(seat_z-.035)
   sw=w*.80;sd=d*.76
   B('structural_seat_pan',(sw*.97,sd*.96,.045),(0,-d*.045,seat_z-.035),dark,.014)
   B('tailored_seat_cushion',(sw,sd,.12),(0,-d*.045,seat_z),m['fabric'],.045);seam_box('seat_double_welt',sw*.94,sd*.94,seat_z+.045,y=-d*.045)
   if id=='ottoman' or id=='bench' or 'saddle' in style:return
   bh=max(.19,h-seat_z-.08);by=d*.29
   if is_mesh:
    tube('molded_mesh_back_frame',[(-sw/2,by,seat_z+.08),(-sw*.49,by+.04,h*.85),(-sw*.34,by+.04,h*.98),(sw*.34,by+.04,h*.98),(sw*.49,by+.04,h*.85),(sw/2,by,seat_z+.08)],.025,dark)
    mesh_panel('woven_mesh',sw*.9,bh*.78,by,seat_z+.08+bh*.48)
    B('lumbar_support',(.28,.065,.085),(0,by+.03,seat_z+.23),dark)
    for ob in list(bpy.context.scene.objects):
     if ob.name.startswith('tailored_seat_cushion'):bpy.data.objects.remove(ob,do_unlink=True)
    for x in [-sw*.48,sw*.48]:B('molded_seat_side_rail',(.032,sd,.045),(x,-d*.045,seat_z+.01),dark,.013)
    for y in [-sd*.48,sd*.48]:B('molded_seat_cross_rail',(sw,.033,.045),(0,y-d*.045,seat_z+.01),dark,.013)
    for i in range(24):tube('tensioned_seat_mesh',[((i/23-.5)*sw*.92,-sd*.47-d*.045,seat_z+.03),((i/23-.5)*sw*.92,-d*.045,seat_z+.01),((i/23-.5)*sw*.92,sd*.47-d*.045,seat_z+.03)],.0015,dark)
    for j in range(22):tube('woven_seat_cross_mesh',[(-sw*.46,(j/21-.5)*sd*.94-d*.045,seat_z+.025),(sw*.46,(j/21-.5)*sd*.94-d*.045,seat_z+.025)],.0012,dark)
   elif 'embody' in style:
    B('flexible_back_cushion',(sw*.79,.12,bh),(0,by,seat_z+.07+bh/2),m['fabric'],.04)
    tube('central_back_spine',[(0,by+.09,seat_z),(0,by+.16,h*.7),(0,by+.15,h*.96)],.018,dark)
    for j in range(8):
     z=seat_z+.15+j*bh*.095;span=sw*(.22+.06*math.sin(j));tube('articulated_back_ribs',[(-span,by+.10,z),(0,by+.16,z-.03),(span,by+.10,z)],.009,dark)
   elif 'executive' in style or 'softpad' in style or 'gaming' in style:
    B('tall_upholstered_back',(sw*.89,.12,bh),(0,by,seat_z+.05+bh/2),dark,.04)
    for j in range(5):B('channel_back_pad',(sw*.84,.11,bh*.16),(0,by-.05,seat_z+.10+bh*(j+.5)/5),m['fabric'],.025)
   elif any(k in style for k in ['barrel','boucle','shell','glider','kidschair']):
    verts=[];sections=40;ringn=12
    for i in range(sections+1):
     a=math.pi*i/sections;rise=.58+.42*math.sin(a);mid=seat_z+bh*rise*.46
     for j in range(ringn):
      t=j*math.tau/ringn;radius=.055*math.cos(t)
      verts.append(((w*.41+radius)*math.cos(a),(d*.35+radius)*math.sin(a),mid+bh*rise*.48*math.sin(t)))
    faces=[(i*ringn+j,i*ringn+(j+1)%ringn,(i+1)*ringn+(j+1)%ringn,(i+1)*ringn+j) for i in range(sections) for j in range(ringn)]
    faces += [tuple(reversed(range(ringn))),tuple(range(sections*ringn,(sections+1)*ringn))]
    surface('continuous_tailored_wraparound_shell',verts,faces,m['fabric'])
    tube('curved_shell_top_welt',[(w*.41*math.cos(i*math.pi/40),d*.35*math.sin(i*math.pi/40),seat_z+bh*(.58+.42*math.sin(i*math.pi/40))*.94) for i in range(41)],.002,seam)
   else:B('tailored_back_cushion',(sw,.13,bh),(0,by,seat_z+.07+bh/2),m['fabric'],.04,(math.radians(-6),0,0))
   if office or row['category']=='Living' or 'glider' in style:
    for x in [-w*.44,w*.44]:
     tube('arm_support',[(x,0,seat_z-.04),(x,0,seat_z+.20),(x,d*.23,seat_z+.20)],.015,chrome)
     B('padded_armrest',(.07,d*.40,.05),(x,-d*.04,seat_z+.22),m['fabric'],.022)
  def sofa():
   if id in ['chester-sofa','midcentury-sofa','slat-day-sofa','sleeper-sofa']:
    original[id](m);return
   low='boneless' in style or style in ['low','playsofa','petsofa'];base=.06 if h<.6 else .10 if low else .16;seat=min(h*.52,.35 if low else .43)
   if not low:legs(base,.40)
   if 'curve' not in style:B('connected_upholstered_platform',(w*.96,d*.80,.19),(0,0,base+.09),m['fabric'],.05)
   n=1 if w<1 else 2 if w<2.0 else 3 if w<2.8 else 4;usable=w*.83;cw=usable/n
   for i in range(n):
    before=set(bpy.context.scene.objects);x=(i-(n-1)/2)*cw;offset=-.17*abs(i-(n-1)/2) if 'curve' in style else 0
    if 'curve' in style:B('curved_platform_module',(cw*1.08,d*.85,.19),(x,offset,base+.09),m['fabric'],.06)
    section='section' in style or style=='pit';chaise=(i==n-1 if 'right' in style else i==0) or ('u-' in style and i==n-1)
    dd=d*.73 if not section else d*(.92 if chaise else .48)
    offset += d*.38-.09-dd*.5 if section else 0
    B('individual_seat_cushion',(cw-.015,dd,.19),(x,-d*.05+offset,seat),m['fabric'],.065);seam_box('tailored_cushion_welt',cw-.04,dd*.94,seat+.065,x,-d*.05+offset)
    B('angled_back_cushion',(cw-.02,.18,h-seat-.05),(x,d*.33+(0 if section else offset),(h+seat)/2+.015),m['fabric'],.06,(math.radians(-7),0,0))
    if 'channel' in style or 'chester' in style:
     for j in range(4):tube('stitched_back_channel',[(x+(j-1.5)*cw/4,d*.225,seat+.12),(x+(j-1.5)*cw/4,d*.25,h-.06)],.002,seam)
    if 'curve' in style:
     from mathutils import Matrix
     angle=-(i-(n-1)/2)*.19;transform=Matrix.Translation(Vector((x,offset,0))) @ Matrix.Rotation(angle,4,'Z') @ Matrix.Translation(Vector((-x,-offset,0)))
     for ob in set(bpy.context.scene.objects)-before:ob.matrix_world=transform @ ob.matrix_world
   for x in [-w*.455,w*.455]:B('integrated_track_arm',(w*.09,d*.87,h*.43),(x,0,seat*.9),m['fabric'],.06)
   if 'metal' in style or 'slat' in style:
    for x in [-w*.47,w*.47]:tube('exposed_metal_side_frame',[(x,-d*.4,.1),(x,d*.4,.1),(x,d*.4,h*.73),(x,-d*.4,h*.73)],.022,chrome)
  def table():
   m['counter']=m['variant']
   isdesk=kind=='Desks';top=h-.028;roundish=(not isdesk or style=='curved') and any(x in style+' '+id for x in ['round','oval','pill','drum','pedestal','tulip','glass-disc','curved','playtable']);glass_top='glass' in style or 'sculpture' in style
   if roundish:ellip_top('shaped_slab_top',top,.05,glass if glass_top else m['counter'])
   elif 'corner-desk'==id:
    B('L_desk_main',(w,d*.4,.05),(0,-d*.3,top),m['counter']);B('L_desk_return',(w*.36,d*.6,.05),(-w*.32,d*.2,top),m['counter'])
   else:B('beveled_slab_top',(w,d,.05),(0,0,top),glass if glass_top else m['counter'],.02)
   if 'block' in style or 'waterfall' in style:
    if 'block' in style:B('monolithic_plinth',(w*.94,d*.94,h-.06),(0,0,(h-.06)/2),m['wood'],.022)
    else:
     for x in [-w*.475,w*.475]:B('waterfall_slab_leg',(w*.05,d,h-.045),(x,0,(h-.045)/2),m['counter'])
   elif 'arch' in style:
    for x in [-w*.30,w*.30]:
     for y in [-d*.27,d*.27]:B('arch_pier',(.09,d*.17,top*.75),(x,y,top*.375),m['counter'])
     tube('arched_stone_bridge',[(x,math.cos(i*math.pi/24)*d*.28,top*.52+math.sin(i*math.pi/24)*top*.29) for i in range(25)],.08,m['counter'])
   elif not isdesk and (roundish or 'pedestal' in style):
    C('weighted_elliptic_foot',min(w,d)*.34,.055,(0,0,.03),m['wood']);C('sculpted_center_pedestal',min(w,d)*(.16 if 'tulip' in style else .27),top-.07,(0,0,top/2),m['wood'],taper=.64)
    if 'rib' in style+' '+id or 'drum' in style:
     for i in range(40):a=i*math.tau/40;tube('modeled_pedestal_flute',[(math.cos(a)*min(w,d)*.273,math.sin(a)*min(w,d)*.273,.08),(math.cos(a)*min(w,d)*.18,math.sin(a)*min(w,d)*.18,top-.04)],.006,m['wood'])
   elif 'sculpture' in style:
    for x,a in [(-w*.18,.4),(w*.18,-.4)]:B('interlocking_sculptural_fin',(w*.32,.07,top-.035),(x,0,(top-.035)/2),chrome,.025,(0,0,a))
   elif style=='c' or id=='c-side-table':
    B('cantilever_foot',(w*.86,d*.86,.03),(0,0,.015),chrome)
    for x in [-w*.36,w*.36]:tube('cantilever_upright',[(x,d*.33,.02),(x,d*.33,top)],.014,chrome)
   elif not isdesk:
    for x in [-w*.39,w*.39]:
     tube('folded_steel_trestle',[(x,-d*.38,.025),(x,-d*.29,top-.035),(x,d*.29,top-.035),(x,d*.38,.025)],.023,chrome)
    B('under_top_support_frame',(w*.80,d*.64,.028),(0,0,top-.038),m['variant'])
    if 'coffee' in id or kind=='Side tables':
     B('inset_lower_shelf',(w*.74,d*.63,.024),(0,0,h*.25),m['wood'],.012)
     for x in [-w*.34,w*.34]:tube('shelf_mount',[(x,0,h*.25),(x,0,top-.02)],.008,chrome)
   else:
    for x in [-w*.38,w*.38]:
     B('powdercoated_box_section_leg',(.065,.075,top-.05),(x,0,(top-.05)/2),m['wood_dark'])
     B('steel_sled_foot',(.10,d*.83,.045),(x,0,.028),chrome)
     B('under_top_mount_plate',(.16,d*.70,.025),(x,0,top-.04),m['variant'])
    B('steel_cross_brace',(w*.76,.05,.06),(0,d*.12,top*.78),m['wood_dark'])
   if isdesk:
    if id=='trestle-desk':
     for x in [-w*.38,w*.38]:
      for side in [-1,1]:tube('splayed_trestle_leg',[(x,side*d*.39,.025),(x,0,top-.055)],.025,chrome)
    if id=='curved-executive-desk':B('executive_modesty_panel',(w*.68,.035,top*.48),(0,d*.20,top*.49),m['wood'],.016)
    if 'standing' in style or 'dual-motor' in id:
     for x in [-w*.38,w*.38]:B('telescopic_lift_stage',(.080,.089,top*.43),(x,0,top*.23),chrome,.005)
    if 'pedestal' in style:
     for x in [-w*.34,w*.34]:
      B('drawer_pedestal',(w*.23,d*.78,top*.92),(x,0,top*.46),m['wood'],.01)
      for j in range(3):
       B('individual_pedestal_drawer',(w*.22,.024,top*.27),(x,-d*.40,top*(.18+j*.28)),m['wood'],.004)
       B('drawer_pull',(w*.13,.01,.01),(x,-d*.416,top*(.26+j*.28)),chrome,.002)
    B('rear_cable_trough',(w*.66,.10,.065),(0,d*.32,top-.09),dark)
    for x in [-w*.32,w*.32]:ring('cable_grommet',.024,.024,h+.001,dark,.004,x,d*.31)
    B('height_control_display',(.095,.035,.025),(w*.30,-d*.48,top-.045),dark)
    for i in range(3):B('memory_key',(.011,.005,.006),(w*.28+i*.016,-d*.50,top-.046),white,.001)
   elif 'tray' in style:
    for y in [-d*.47,d*.47]:B('raised_tray_edge',(w,.016,.023),(0,y,h+.01),m['wood'])
  def cabinet():
   wall=row['mount']=='wall';kitchen=row['category']=='Kitchen';island='island' in id;openfront=any(k in style for k in ['open','hanging-module','shelf-module']);isglass='glass' in style;bodybottom=0 if wall else .09;top=h-.035
   if not wall:B('recessed_toe_kick',(w*.88,d*.76,.09),(0,d*.03,.045),dark)
   # True open carcass, no solid box behind glazing or shelves.
   for x in [-w/2+.012,w/2-.012]:B('finished_carcass_side',(.024,d,top-bodybottom),(x,0,(top+bodybottom)/2),m['wood'])
   B('carcass_back',(w-.04,.018,top-bodybottom),(0,d/2-.014,(top+bodybottom)/2),m['wood'])
   for z in [bodybottom+.012]+([] if 'sink' in id else [top]):B('carcass_horizontal_panel',(w,d,.024),(0,0,z),m['wood'])
   cols=max(1,round(w/.60));rows=3 if h>1.2 else 2 if 'drawer' in style or 'dresser' in style else 1
   for i in range(cols):
    cw=(w-.04)/cols;x=(i-(cols-1)/2)*cw
    if i:B('internal_divider',(.018,d-.04,top-bodybottom),(x-cw/2,0,(top+bodybottom)/2),m['wood'])
    for j in range(1,rows+1):B('adjustable_internal_shelf',(cw-.025,d-.07,.018),(x,.01,bodybottom+(top-bodybottom)*j/(rows+1)),m['wood'])
    if openfront:continue
    for j in range(rows):
     ch=(top-bodybottom-.025)/rows;z=bodybottom+(j+.5)*ch
     if isglass:
      for xx in [x-cw*.46,x+cw*.46]:B('metal_glazing_stile',(.020,.028,ch-.012),(xx,-d/2,z),chrome)
      for zz in [z-ch*.47,z+ch*.47]:B('metal_glazing_rail',(cw*.93,.028,.020),(x,-d/2,zz),chrome)
      B('smoked_door_glazing',(cw*.89,.009,ch*.90),(x,-d/2+.007,z),glass,.001)
      if 'ribbed' in id:
       for f in range(20):B('fluted_glass_reed',(.005,.005,ch*.88),(x+(f-9.5)*cw*.043,-d/2-.001,z),glass,.002)
     else:
      B('separate_door_or_drawer_front',(cw-.014,.024,ch-.014),(x,-d/2,z),m['wood'],.005)
      if 'shaker' in style or 'arched' in style:
       for xx in [x-cw*.41,x+cw*.41]:B('raised_door_stile',(.035,.012,ch*.86),(xx,-d/2-.016,z),m['wood'],.003)
       for zz in [z-ch*.42,z+ch*.42]:B('raised_door_rail',(cw*.86,.012,.035),(x,-d/2-.016,zz),m['wood'],.003)
      if any(k in style for k in ['rib','groove','flut','slat','cane']):
       for f in range(12):B('modeled_front_reed',(.008,.007,ch-.032),(x+(f-5.5)*cw/13,-d/2-.014,z),m['wood'],.002)
     B('recessed_finger_pull',(cw*.66,.014,.011),(x,-d/2-.014,z+ch*.40),dark,.003)
     for zz in [z-ch*.28,z+ch*.28]:B('concealed_hinge',(.028,.055,.05),(x-cw*.44,-d*.42,zz),chrome,.003)
   B('countertop_slab' if kitchen else 'inset_finished_top',(w,d,.034),(0,0,h-.017),m['counter'] if kitchen else m['wood'],.009)
   if island:
    B('seating_overhang',(w,d*.28,.035),(0,d*.40,h-.017),m['counter'])
    if 'waterfall' in style:
     for x in [-w*.485,w*.485]:B('waterfall_end_panel',(w*.03,d,h),(x,0,h/2),m['counter'])
   if 'sink' in id:
    # Undermount recess: remove top and build four surrounding slabs and basin walls.
    for ob in list(bpy.context.scene.objects):
     if ob.name.startswith('countertop_slab'):bpy.data.objects.remove(ob,do_unlink=True)
    bw=w*.57;bd=d*.61
    for x in [-(w+bw)/4,(w+bw)/4]:B('sink_side_counter',((w-bw)/2,d,.035),(x,0,h-.017),m['counter'])
    for y in [-(d+bd)/4,(d+bd)/4]:B('sink_front_rear_counter',(bw,(d-bd)/2,.035),(0,y,h-.017),m['counter'])
    B('recessed_basin_bottom',(bw*.95,bd*.95,.018),(0,0,h-.17),chrome)
    for x in [-bw*.49,bw*.49]:B('basin_side',(.018,bd,.15),(x,0,h-.09),chrome)
    for y in [-bd*.49,bd*.49]:B('basin_front_back',(bw,.018,.15),(0,y,h-.09),chrome)
    if 'double' in id:B('double_basin_center_partition',(.026,bd,.15),(0,0,h-.09),chrome)
    ring('drain_strainer',.024,.024,h-.159,dark,.003)
    tube('gooseneck_mixer',[(0,d*.38,h),(0,d*.38,h+.16),(0,d*.20,h+.21),(0,.06,h+.19)],.012,chrome)
   if 'hanging-module' in style:tube('chrome_hanging_rail',[(-w*.43,0,h*.85),(w*.43,0,h*.85)],.012,chrome)
   if not kitchen:
    B('rear_cable_port',(.065,.005,.035),(0,d*.51,h*.62),dark,.008)
  def bed():
   if any(k in style for k in ['bunk','house-bed','spindle','daybed','arched']):
    original[id](m);return
   floating='floating' in style;low='low' in style;base=.22 if low else .30
   B('recessed_structural_plinth',(w*.62,d*.64,.18),(0,0,.09),dark)
   B('upholstered_platform',(w,d,.15),(0,0,base),m['fabric'],.045)
   if floating:
    light=material('soft-underbed-light',(.8,.86,.72),None,.5);bs=light.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(.8,.86,.72,1);bs.inputs['Emission Strength'].default_value=.8
    seam_box('floating_platform_light',w*.86,d*.89,base-.078)
   B('mattress',(w*.91,d*.87,.22),(0,-d*.025,base+.17),white,.06)
   seam_box('mattress_upper_ticking',w*.88,d*.84,base+.27,y=-d*.025)
   seam_box('mattress_lower_ticking',w*.88,d*.84,base+.08,y=-d*.025)
   headh=max(.28,min(h-base,.72) if 'canopy' in style else h-base);B('padded_headboard',(w,.13,headh),(0,d*.45,base+headh/2),m['fabric'],.05)
   channels=10 if 'channel' in style else 5
   for i in range(channels):tube('headboard_tailored_channel',[((i-(channels-1)/2)*w/channels,d*.45-.068,base+.06),((i-(channels-1)/2)*w/channels,d*.45-.068,base+headh-.04)],.002,seam)
   if 'storage' in style:
    for x in [-w*.49,w*.49]:
     for y in [-d*.23,d*.15]:
      B('upholstered_storage_drawer',(.025,d*.34,.17),(x,y,base-.06),m['fabric'],.009)
      B('drawer_recessed_pull',(.013,d*.10,.015),(x*1.025,y,base-.035),dark,.003)
   for x in [-w*.235,w*.235]:
    B('gusseted_pillow',(w*.40,d*.20,.12),(x,d*.25,base+.32),white,.05);seam_box('pillow_welt',w*.37,d*.18,base+.36,x,d*.25)
   B('folded_duvet',(w*.94,d*.54,.065),(0,-d*.20,base+.305),m['fabric'],.022)
   for j in range(15):tube('duvet_quilt_stitch',[((j-7)*w*.058,-d*.44,base+.34),((j-7)*w*.058,d*.035,base+.34)],.0013,seam)
   if 'wing' in style:
    for x in [-w*.48,w*.48]:B('headboard_wing',(.07,.25,headh),(x,d*.40,base+headh/2),m['fabric'],.025)
   if 'canopy' in style:
    for x in [-w*.47,w*.47]:
     for y in [-d*.46,d*.46]:tube('canopy_steel_post',[(x,y,0),(x,y,h)],.016,chrome)
    for y in [-d*.46,d*.46]:tube('canopy_crossbar',[(-w*.47,y,h),(w*.47,y,h)],.016,chrome)
    for x in [-w*.47,w*.47]:tube('canopy_side_rail',[(x,-d*.46,h),(x,d*.46,h)],.016,chrome)
  def nursery():
   if style in ['glider','kidschair']:chair();return
   if style=='playsofa':sofa();return
   if style=='playtable':table();return
   if style=='changing':
    cabinet();B('changing_pad',(w*.75,d*.83,.07),(0,0,h+.04),white,.03)
    for x in [-w*.38,w*.38]:B('raised_pad_bolster',(.055,d*.80,.055),(x,0,h+.08),white,.025)
    return
   if style=='bassinet':
    for x in [-w*.30,w*.30]:tube('bassinet_splayed_metal_frame',[(x,-d*.42,.015),(x,0,h*.45),(x,d*.42,.015)],.018,chrome)
    B('bassinet_support_deck',(w*.86,d*.82,.035),(0,0,h*.47),m['wood'])
    B('bassinet_mattress',(w*.82,d*.75,.055),(0,0,h*.51),white,.022)
    for z in [h*.49,h*.96]:ring('rounded_bassinet_rail',w*.47,d*.46,z,m['wood'],.022)
    for i in range(96):
     a=i*math.tau/96;tube('fine_bassinet_mesh_vertical',[(w*.47*math.cos(a),d*.46*math.sin(a),h*.50),(w*.47*math.cos(a),d*.46*math.sin(a),h*.95)],.0015,white)
    for j in range(18):ring('fine_bassinet_mesh_weft',w*.47,d*.46,h*(.51+j*.025),white,.0012)
    return
   if style=='crib':
    legs(.22);B('crib_mattress',(w*.92,d*.90,.08),(0,0,h*.40),white,.025)
    for y in [-d*.47,d*.47]:
     for z in [h*.30,h-.025]:B('continuous_crib_rail',(w,.04,.045),(0,y,z),m['wood'],.015)
     for i in range(22):B('rounded_vertical_crib_slat',(.021,.022,h*.65),((i/21-.5)*w*.95,y,h*.65),m['wood'],.009)
    for x in [-w*.48,w*.48]:B('solid_crib_end',(.04,d,h*.71),(x,0,h*.64),m['wood'],.018)
   elif style=='bookrack':
    for x in [-w*.48,w*.48]:B('bookrack_side',(.035,d,h),(x,0,h/2),m['wood'],.014)
    B('bookrack_back',(w,.025,h),(0,d*.46,h/2),m['wood'])
    for j in range(3):
     z=h*(.08+j*.28);y=-d*.28+j*d*.17
     B('book_pocket_base',(w*.94,d*.39,.02),(0,y,z),m['wood']);B('book_pocket_front',(w*.94,.025,h*.14),(0,y-d*.18,z+h*.07),m['wood'])
     for i in range(4):
      x=(i-1.5)*w*.21;bookmat=[water,white,seam,m['fabric']][(i+j)%4]
      B('individual_picture_book',(w*.18,.025,h*.23),(x,y,z+h*.13),bookmat,.003,(math.radians(-8),0,0));B('book_cover_title',(w*.11,.002,.009),(x,y-.019,z+h*.18),white,.001)
   else:
    original[id](m)
  def speaker():
   isbar='soundbar' in style or style in ['arc-ultra','beam'] or id=='soundbar';sub='sub' in style or id=='subwoofer'
   if style=='headphones':
    tube('padded_headband',[(math.cos(i*math.pi/32)*w*.43,0,h*.50+math.sin(i*math.pi/32)*h*.43) for i in range(33)],.012,dark)
    for x in [-w*.42,w*.42]:
     o=C('oval_earcup',1,w*.20,(x,0,h*.27),m['wood'],(0,math.pi/2,0));o.scale.y=d*.48;o.scale.x=h*.23
     o=C('oval_memory_foam_ear_pad',1,w*.07,(x*.78,0,h*.27),dark,(0,math.pi/2,0));o.scale.y=d*.43;o.scale.x=h*.21
    return
   if style=='subhole':
    for x in [-w*.36,w*.36]:B('subwoofer_side_shell',(w*.28,d,h),(x,0,h/2),m['wood'],.035)
    for z in [h*.12,h*.88]:B('subwoofer_bridge',(w*.58,d,h*.24),(0,0,z),m['wood'],.032)
    B('force_canceling_inner_driver',(w*.05,d*.8,h*.32),(-w*.22,0,h/2),dark)
   elif style=='submini':
    C('cylindrical_subwoofer',w/2,h,(0,0,h/2),m['wood']);B('recessed_acoustic_tunnel',(w*.3,.006,h*.53),(0,-d*.5,h*.5),dark,.022)
   elif style=='hourglass':
    verts=[];n=64;sections=[(-.5,.96),(-.43,1),(-.23,.88),(0,.73),(.23,.87),(.43,.95),(.5,.90)]
    for yy,scale in sections:
     for i in range(n):
      a=i*math.tau/n;xx=math.copysign(abs(math.cos(a))**.55,math.cos(a));zz=math.copysign(abs(math.sin(a))**.55,math.sin(a));verts.append((xx*w*.5*scale,yy*d,h/2+zz*h*.5*scale))
    faces=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(sections)-1) for i in range(n)];faces += [tuple(reversed(range(n))),tuple(range((len(sections)-1)*n,len(sections)*n))];surface('continuous_hourglass_shell',verts,faces,m['wood'])
   elif 'ceiling'==style:
    C('ceiling_recessed_driver',w*.40,h*.92,(0,0,h*.54),dark)
    C('ceiling_faceplate',w/2,h*.06,(0,0,h*.03),m['wood'])
    for i in range(-18,19):
     for j in range(-18,19):
      if i*i+j*j>18*18:continue
      x=i*w/40;y=j*d/40;rr=w*.002
      details.add('circular_ceiling_grille_perforations',[(x+rr*math.cos(a*math.tau/6),y+rr*math.sin(a*math.tau/6),-.0001) for a in range(6)],[tuple(reversed(range(6)))],dark)
    return
   elif style=='oval':
    o=C('oval_acoustic_enclosure',1,h,(0,0,h/2),m['wood']);o.scale.x=w/2;o.scale.y=d/2
   else:B('rounded_acoustic_enclosure',(w,d,h),(0,0,h/2),m['wood'],min(w,d,h)*.25)
   if not sub:
    # Dense, bounded modeled perforation grid on the front grille.
    cols=64 if isbar else 22;nr=6 if isbar else 24
    for i in range(cols):
     for j in range(nr):
      x=(i/(cols-1)-.5)*w*.70;z=h*(.23+j/(nr-1)*.54)
      front=-d*.501
      if style=='oval':front=-d*.501*math.sqrt(max(0,1-(x/(w*.5))**2))
      rr=min(w/cols,h/nr)*.13;details.add('individual_grille_perforations',[(x+rr*math.cos(a*math.tau/6),front,z+rr*math.sin(a*math.tau/6)) for a in range(6)],[tuple(range(6))],dark)
   B('recessed_io_panel',(w*.36,.006,h*.19),(0,d*.501,h*.25),dark,.003)
   for i in range(3):B('connector_port',(w*.047,.004,h*.055),((i-1)*w*.09,d*.506,h*.25),chrome,.001)
   for i in range(3):B('top_touch_control',(min(.012,w*.08),min(.008,d*.08),.001),((i-1)*w*.12,0,h+.001),white,.001)
   for x in [-w*.34,w*.34]:B('rubber_isolation_foot',(w*.12,d*.46,.005),(x,0,.0025),dark,.001)
   if style=='portable':tube('rear_carry_loop',[(-w*.25,d*.50,h*.72),(-w*.25,d*.56,h*.94),(w*.25,d*.56,h*.94),(w*.25,d*.50,h*.72)],.007,dark)
  def pet():
   if style in ['feeder','dualfeeder']:
    B('sealed_food_hopper',(w*.66,d*.63,h*.91),(0,d*.16,h*.50),m['wood'],.025)
    B('removable_hopper_lid',(w*.68,d*.64,.025),(0,d*.16,h*.965),dark,.012)
    B('food_chute',(w*.23,.045,h*.18),(0,-d*.19,h*.20),dark,.01)
    for x in ([-w*.25,w*.25] if style=='dualfeeder' else [0]):
     C('stainless_bowl_bottom',w*.23,.012,(x,-d*.30,.015),chrome);ring('raised_food_bowl_rim',w*.23,d*.22,.045,chrome,.010,x,-d*.30)
    C('camera_lens',.014,.006,(0,-d*.162,h*.70),dark,(math.pi/2,0,0));B('status_display',(.045,.004,.016),(0,-d*.165,h*.58),water,.003)
   elif style=='fountain':
    B('water_reservoir',(w,d,h*.65),(0,0,h*.325),m['wood'],.04);B('stainless_filter_tray',(w*.92,d*.92,.013),(0,0,h*.67),chrome,.025)
    ring('pool_edge',w*.35,d*.35,h*.70,chrome,.008);C('water_pool',w*.34,.004,(0,0,h*.695),water)
    tube('water_spout',[(0,d*.23,h*.65),(0,d*.23,h*.95),(0,0,h*.95)],.012,chrome)
    stream=tube('continuous_water_stream',[(0,0,h*.94),(0,-.008,h*.83),(0,-.012,h*.71)],.006,water);stream['motion_role']='fountain_stream'
    for i in range(3):o=ring('animated_water_ripple',w*(.08+i*.07),d*(.08+i*.07),h*.707,water,.0015);o['motion_role']='fountain_ripple';o['motion_index']=i
   elif style=='litter':
    B('sealed_waste_drawer',(w*.86,d*.83,h*.23),(0,d*.02,h*.115),m['wood'],.045)
    # Hollow spherical drum with an open front: authored annular sections.
    rx=w*.46;rz=h*.37;z=h*.60
    verts=[];n=64;steps=24
    for j in range(steps):
     a=.80+(math.pi-.83)*j/(steps-1)
     for i in range(n):t=i*math.tau/n;verts.append((rx*math.sin(a)*math.cos(t),-d*.45*math.cos(a),z+rz*math.sin(a)*math.sin(t)))
    surface('smooth_rotating_drum_shell',verts,[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(steps-1) for i in range(n)],m['wood'])
    face_ring('thick_entry_lip',rx*math.sin(.80),rz*math.sin(.80),-d*.45*math.cos(.80),z,white,.032)
    B('dark_recessed_interior',(w*.64,.025,h*.47),(0,d*.30,z),dark,.07)
    B('entry_step',(w*.48,d*.26,.055),(0,-d*.36,h*.23),chrome,.015)
    for i in range(4):B('control_button',(.018,.005,.013),((i-1.5)*.032,-d*.404,h*.17),dark,.004)
   elif style=='petsofa':sofa()
   elif style=='catcondo':
    B('weighted_cat_tree_base',(w,d,.06),(0,0,.03),m['wood'],.03)
    for x,y,z in [(-w*.23,0,h*.40),(w*.23,d*.15,h*.72)]:
     C('sisal_wrapped_post',.045,z,(x,y,z/2),white)
     tube('continuous_sisal_rope',[(x+.046*math.cos(i*math.tau/12),y+.046*math.sin(i*math.tau/12),z*i/480) for i in range(481)],.002,white)
     B('padded_perch',(w*.60,d*.70,.08),(x,y,z),m['fabric'],.035)
    B('enclosed_cat_cubby',(w*.50,d*.65,h*.25),(0,-d*.10,h*.30),m['wood'],.04);face_ring('cubby_entry',w*.14,h*.10,-d*.43,h*.30,dark,.018)
   else:original[id](m)
  def collectible():
   if id in ['mecha-figurine','adventurer-figurine','model-sailboat','brick-roadster']:
    original[id](m);return
   ship=any(x in style for x in ['boat','ship','liner','frigate']);car=any(x in style for x in ['car','roadster','formula','rally']);figurine=not ship and not car and style!='starship'
   accent=material('collectible-enamel-accent',(.06,.35,.58),None,.38,.1)
   red=material('collectible-racing-red',(.65,.035,.045),None,.42)
   if car:
    carcolor=(.02,.14,.28) if 'hyper' in style else (.82,.84,.81) if 'rally' in style else (.68,.04,.07)
    red.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*carcolor,1);red.diffuse_color=(*carcolor,1)
    B('brick_chassis',(w*.90,d*.72,h*.25),(0,0,h*.35),dark,.012)
    B('layered_coachwork',(w*.91,d*.72,h*.35),(0,0,h*.55),red,.018)
    B('angled_windscreen',(w*.27,d*.60,h*.28),(0,0,h*.80),glass,.008,(0,-.17,0))
    for x in [-w*.30,w*.30]:
     for y in [-d*.43,d*.43]:
      C('rubber_tire',h*.23,d*.17,(x,y,h*.27),dark,(math.pi/2,0,0));C('machined_wheel_hub',h*.13,d*.18,(x,y,h*.27),chrome,(math.pi/2,0,0))
      for j in range(7):a=j*math.tau/7;tube('wheel_spoke',[(x,y*1.04,h*.27),(x+math.cos(a)*h*.12,y*1.04,h*.27+math.sin(a)*h*.12)],.0015,chrome)
    B('sculpted_front_hood',(w*.30,d*.69,h*.18),(-w*.30,0,h*.63),red,.022,(0,.12,0))
    B('rear_engine_cover',(w*.22,d*.70,h*.17),(w*.33,0,h*.64),red,.016)
    for side in [-1,1]:
     B('door_inset_panel',(w*.38,.006,h*.17),(0,side*d*.365,h*.49),red,.004)
     B('flush_door_handle',(w*.06,.005,h*.024),(w*.06,side*d*.37,h*.59),chrome,.001)
     B('side_air_intake',(w*.12,.005,h*.085),(w*.25,side*d*.37,h*.47),dark,.002)
     B('wing_mirror',(w*.04,d*.12,h*.06),(-w*.08,side*d*.43,h*.76),dark,.003)
    for j in range(9):B('engine_cover_vent',(.003,d*.50,.003),(w*(.26+j*.016),0,h*.733),dark,.001)
    for x in [-w*.44,w*.44]:
     for y in [-d*.24,d*.24]:B('individual_light_cluster',(.006,d*.15,h*.06),(x,y,h*.53),white,.002)
    for x in [-w*.35,w*.35]:B('aero_splitter',(.025,d*.95,.012),(x,0,h*.27),dark,.003)
    for i in range(12):
     for j in range(3):C('exposed_brick_stud',min(w/40,d/18),.004,((i-5.5)*w*.066,(j-1)*d*.20,h*.73),red)
    if 'formula' in style:B('front_formula_wing',(.045,d,.013),(-w*.44,0,h*.26),accent);B('rear_formula_wing',(.045,d*.85,.014),(w*.43,0,h*.78),accent)
    if 'formula' in style:
     for ob in list(bpy.context.scene.objects):
      if ob.name.startswith(('layered_coachwork','angled_windscreen','sculpted_front_hood','exposed_brick_stud','wing_mirror','door_inset_panel','flush_door_handle','side_air_intake')):bpy.data.objects.remove(ob,do_unlink=True)
     B('narrow_formula_monocoque',(w*.70,d*.30,h*.25),(0,0,h*.48),red,.008)
     B('tapered_formula_nose',(w*.34,d*.15,h*.10),(-w*.30,0,h*.40),red,.008)
     C('open_cockpit_recess',d*.11,.009,(w*.05,0,h*.625),dark)
     tube('cockpit_halo',[(w*.02,-d*.13,h*.66),(-w*.08,0,h*.78),(w*.02,d*.13,h*.66)],.003,dark)
     for side in [-1,1]:B('sculpted_sidepod',(w*.29,d*.20,h*.20),(w*.10,side*d*.25,h*.46),red,.01)
    if 'rally' in style:
     for y in [-d*.24,d*.24]:C('rally_spot_lamp',h*.045,.009,(-w*.468,y,h*.54),white,(0,math.pi/2,0))
     B('raised_rally_roof',(w*.35,d*.65,h*.16),(0,0,h*.95),white,.009)
     for y in [-d*.22,d*.22]:tube('roof_rack_rail',[(-w*.14,y,h*1.05),(w*.15,y,h*1.05)],.002,dark)
   elif ship or style=='starship':
    if style=='starship':
     verts=[(-w*.50,0,h*.35),(w*.44,-d*.48,h*.25),(w*.44,d*.48,h*.25),(-w*.42,0,h*.23),(w*.44,-d*.42,h*.13),(w*.44,d*.42,h*.13)]
     surface('wedge_starship_hull',verts,[(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)],m['wood'])
     for j in range(4):B('stepped_command_bridge',(w*(.28-j*.04),d*(.42-j*.06),h*.08),(w*.17,0,h*(.40+j*.08)),white,.004)
     for y in [-d*.23,0,d*.23]:C('recessed_engine_nozzle',h*.09,.013,(w*.44,y,h*.24),water,(0,math.pi/2,0))
     for i in range(18):
      x=-w*.30+i*w*.039
      for side in [-1,1]:B('individual_hull_panel',(.010,.022,.005),(x,side*d*(.07+i*.018),h*.31),chrome,.001)
     return
    # Closed, pointed hull sections, with separate strakes instead of a box.
    verts=[];n=32
    for j in range(8):
     for i in range(n):
      a=i*math.tau/n;xx=math.cos(a)*w*.49;yy=math.sin(a)*d*(.17+j*.044)*(1-.36*max(0,-math.cos(a)))
      verts.append((xx*(.78+j*.03),yy,h*(.10+j*.035)))
    surface('pointed_planked_ship_hull',verts,[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(7) for i in range(n)]+[tuple(reversed(range(n))),tuple(range(7*n,8*n))],m['wood_dark'])
    B('main_deck',(w*.94,d*.82,.009),(0,0,h*.35),white,.008)
    for side in [-1,1]:tube('deck_rail',[(x,side*d*.4,h*.43) for x in [-w*.43,0,w*.43]],.0016,chrome)
    for i in range(28):
     x=(i/27-.5)*w*.82
     for side in [-1,1]:tube('rail_stanchion',[(x,side*d*.4,h*.35),(x,side*d*.4,h*.43)],.0012,chrome)
    if 'frigate' in style or 'sailboat' in style:
     for x in [-w*.2,w*.15]:
      tube('tall_mast',[(x,0,h*.35),(x,0,h*.97)],.003,chrome)
      for z in [h*.64,h*.84]:
       tube('sail_yard',[(x,-d*.43,z),(x,d*.43,z)],.002,chrome);B('billowing_canvas_sail',(.013,d*.78,h*.18),(x,0,z-h*.10),white,.005)
      for y in [-d*.4,d*.4]:tube('standing_rigging',[(x,y,h*.36),(x,0,h*.94)],.0009,dark)
    else:
     for i in range(4):B('stepped_upper_deck',(w*(.65-i*.10),d*(.62-i*.08),h*.08),(w*.04,0,h*(.41+i*.085)),white,.006)
     for i in range(3):C('detailed_funnel',d*.10,h*.17,((i-1)*w*.18,0,h*.80),red)
     for i in range(16):B('bridge_windows',(.013,.002,.014),((i-7.5)*w*.034,-d*.26,h*.63),dark,.002)
   else:
    skin=material('figurine-porcelain-skin',(.84,.62,.52),None,.75);haircolor=(.75,.41,.58) if 'march' in style else (.22,.07,.40) if 'raiden' in style else (.025,.035,.04)
    hair=material('figurine-layered-hair',haircolor,None,.65);cloth=accent if 'march' in style else hair if 'raiden' in style else dark
    C('display_plinth',min(w,d)*.48,.013,(0,0,.007),dark)
    for x in [-w*.12,w*.12]:
     B('sculpted_boot',(.031,d*.26,h*.11),(x,-d*.06,h*.09),dark,.009)
     tube('posed_leg',[(x,0,h*.13),(x*1.15,0,h*.33),(x*.75,0,h*.48)],.013,skin)
    B('fitted_costume_bodice',(w*.35,d*.26,h*.22),(0,0,h*.57),cloth,.012)
    for i in range(12):
     a=i*math.tau/12;B('individual_pleated_skirt_panel',(w*.13,.009,h*.19),(math.cos(a)*w*.17,math.sin(a)*d*.16,h*.44),cloth,.003,(0,.12,a))
    for x in [-w*.22,w*.22]:tube('posed_sleeve',[(x*.55,0,h*.65),(x,-d*.02,h*.58),(x*1.1,-d*.10,h*.52)],.009,cloth);C('hand',.009,.018,(x*1.1,-d*.10,h*.51),skin)
    C('neck',.010,.016,(0,0,h*.71),skin)
    B('sculpted_anime_head',(w*.30,d*.29,h*.16),(0,0,h*.81),skin,.025)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=(0,.003,h*.846));cap=bpy.context.object;cap.name='closed_layered_hair_cap';cap.scale=(w*.17,d*.16,h*.083);cap.data.materials.append(hair)
    for v in cap.data.vertices:v.co.z=max(0,v.co.z)
    for i in range(13):
     a=-.12+(math.pi+.24)*i/12;tube('back_and_side_hair_locks',[(math.cos(a)*w*.11,math.sin(a)*d*.12,h*.89),(math.cos(a)*w*.17,math.sin(a)*d*.18,h*.80),(math.cos(a)*w*.16,math.sin(a)*d*.18,h*(.72 if 'ellen' in style else .62))],.008,hair)
    for i in range(6):
     x=(i-2.5)*w*.047;tube('short_swept_bang',[(x*.85,-d*.12,h*.89),(x,-d*.17,h*.86),(x+w*.02,-d*.16,h*(.843 if i%2 else .834))],.005,hair)
    for x in [-w*.066,w*.066]:B('painted_eye_white',(.012,.002,.007),(x,-d*.151,h*.82),white,.002);B('colored_eye_iris',(.005,.003,.006),(x,-d*.153,h*.82),accent,.002)
    tube('delicate_mouth',[(-w*.026,-d*.15,h*.775),(w*.026,-d*.15,h*.775)],.0009,seam)
    B('costume_collar',(w*.20,.017,.012),(0,-d*.10,h*.68),white,.002)
    for i in range(5):C('costume_buttons',.0018,.002,(0,-d*.14,h*(.53+i*.025)),chrome,(math.pi/2,0,0))
    if 'ellen' in style:
     B('white_maid_apron',(w*.25,.006,h*.20),(0,-d*.18,h*.45),white,.003)
     for side in [-1,1]:tube('oversized_scissor_blade',[(w*.30,-d*.12,h*.16),(w*(.30+side*.15),-d*.12,h*.76)],.004,chrome)
     tube('shark_tail',[(0,d*.10,h*.43),(w*.22,d*.20,h*.29),(w*.36,d*.13,h*.30)],.012,dark)
    if 'raiden' in style:tube('long_braided_hair',[(0,d*.14,h*.82),(0,d*.19,h*.62),(w*.1,d*.2,h*.35)],.012,hair)
    tube('display_weapon_or_staff',[(w*.34,-d*.1,h*.1),(w*.32,-d*.1,h*.88)],.003,chrome)
  def poster():
   B('slim_gallery_frame',(w,d,h),(0,0,h/2),dark,.004)
   path=ROOT/'assets-source/art/modern-anime-atlas.png'
   mat=material('original-anime-landscape-art',(1,1,1),None,.95)
   if path.exists():
    image=bpy.data.images.load(str(path),check_existing=True);tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;mat.node_tree.links.new(tex.outputs['Color'],mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
   verts=[(-w*.48,-d*.52,h*.02),(w*.48,-d*.52,h*.02),(w*.48,-d*.52,h*.98),(-w*.48,-d*.52,h*.98)]
   mesh=bpy.data.meshes.new('artwork_plane');mesh.from_pydata(verts,[],[(0,1,2,3)]);mesh.materials.append(mat);uv=mesh.uv_layers.new();idx=int(style[-1]);low=(2-idx)/3;high=(3-idx)/3
   for loop,co in zip(uv.data,[(0,low),(1,low),(1,high),(0,high)]):loop.uv=co
   ob=bpy.data.objects.new('original_landscape_artwork',mesh);bpy.context.collection.objects.link(ob)
  if kind=='Sofas':sofa()
  elif kind=='Chairs & stools':chair(row['category']=='Office')
  elif id=='secretary-desk':original[id](m)
  elif kind in ['Coffee tables','Tables','Desks'] or kind=='Side tables' and (not any(k in style for k in ['drawer','nightstand']) or 'pedestal' in style):table()
  elif kind=='Beds':bed()
  elif kind=='Baby & kids':nursery()
  elif kind=='Speakers & audio':speaker()
  elif kind=='Pet furniture' or id=='pet-bed':pet()
  elif kind=='Collectibles':collectible()
  elif style.startswith('poster'):poster()
  elif id=='open-pantry':original[id](m)
  else:cabinet()
  details.finish()
  # Any retained special builder also receives the modern non-brown palette.
  for mat in bpy.data.materials:
   if any(k in mat.name.lower() for k in ['walnut','honey','wood','bronze','brass','oak','brown']):
    bs=mat.node_tree.nodes.get('Principled BSDF') if mat.use_nodes else None
    if bs:
     for link in list(bs.inputs['Base Color'].links):mat.node_tree.links.remove(link)
     c=(.07,.09,.11) if any(k in mat.name for k in ['dark','bronze']) else color;bs.inputs['Base Color'].default_value=(*c,1);mat.diffuse_color=(*c,1)
  return w,d,h
 return {r['id']:(lambda m,r=r:build(r,m)) for r in MANIFEST['revisited']+MANIFEST['added'] if not r.get('retired')}
