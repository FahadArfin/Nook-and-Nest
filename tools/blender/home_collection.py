"""Original Batch 11 appliances, lighting, window dressings and sliding joinery."""
import json,math
from pathlib import Path
import bpy
from mathutils import Vector
from detailed_models import Geometry
ROWS=json.loads((Path(__file__).resolve().parents[2]/'src/homeExpansion.json').read_text())

def home_builders(box,cyl,material):
 def build(row,m):
  id=row[0];w,d,h=[v/1000 for v in row[3:6]];g=Geometry();metal=material('brushed-nickel-hardware',(.47,.49,.44),None,.46,.6);dark=material('graphite-enamel',(.055,.071,.066),None,.79,.12)
  gold=material('aged-brass-fitting',(.45,.30,.12),None,.56,.5);cloth=m['fabric'];wood=m['wood'];ivory=material('ivory-detail',(.82,.81,.72),None,.92)
  if row[6]=='window':wood=material('variant-surface-wood',(.45,.30,.16),None,.88)
  glass=material('window-glazing' if row[6]=='window' else 'clear-inset-glass',(.53,.73,.73),None,.19);glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.17
  opal=material('opal-light-diffuser',(.89,.85,.69),None,.6);bs=opal.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(1,.73,.36,1);bs.inputs['Emission Strength'].default_value=.65
  def B(n,size,p,mat=wood,b=.009,rot=None):return box(n,size,p,mat,min(b,min(size)*.2),**({'rot':rot} if rot else {}))
  def tube(n,pts,r=.006,mat=metal):g.tube(n,pts,r,mat,8)
  def ring(n,r,p,mat=metal,th=.003,front=False):
   x,y,z=p;tube(n,[(x+r*math.cos(i*math.tau/48),y if front else y+r*math.sin(i*math.tau/48),z+r*math.sin(i*math.tau/48) if front else z) for i in range(49)],th,mat)
  def lathe(n,profile,mat,x=0,y=0):
   v=[(x+r*math.cos(i*math.tau/48),y+r*math.sin(i*math.tau/48),z) for r,z in profile for i in range(48)];g.add(n,v,[(j*48+i,j*48+(i+1)%48,(j+1)*48+(i+1)%48,(j+1)*48+i) for j in range(len(profile)-1) for i in range(48)],mat)
  def knob(x,y,z,r=.023):
   cyl('control_bezel',r,.015,(x,y,z),metal,32,rot=(math.pi/2,0,0));B('control_index',(.003,.003,r*.55),(x,y-.009,z+r*.2),ivory,.0005)
   for j in range(9):a=j*math.pi/6;B('calibrated_control_tick',(.002,.002,.004),(x+r*1.2*math.cos(a),y,z+r*1.2*math.sin(a)),ivory,.0003)
  def frame(n,x,z,ww,hh,y=0,mat=wood):
   for xx in [x-ww/2,x+ww/2]:B(n+'_stile',(.042,.055,hh+.04),(xx,y,z),mat)
   for zz in [z-hh/2,z+hh/2]:B(n+'_rail',(ww,.055,.042),(x,y,zz),mat)
  def join_moving(before,index,travel):
   g.finish();g.groups={};objects=[o for o in bpy.context.scene.objects if o not in before and o.type=='MESH'];bpy.ops.object.select_all(action='DESELECT')
   for o in objects:o.select_set(True)
   bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name='sliding_leaf_'+str(index);o['motion_role']='sliding_leaf';o['slide_travel']=travel
  if row[2]=='Kitchen':
   if id in ['food-processor','countertop-blender']:
    B('motor_housing',(w*.87,d*.80,h*.32),(0,0,h*.16),dark,.035);knob(0,-d*.42,h*.17,.032)
    r=w*.36;lathe('open_processing_jug',[(r*.70,h*.30),(r,h*.39),(r,h*.86),(r*.95,h*.88),(r*.86,h*.86),(r*.84,h*.40),(r*.61,h*.33)],glass)
    ring('jug_locking_collar',r*.79,(0,0,h*.33),metal,.010);cyl('sealed_jug_lid',r*1.03,.021,(0,0,h*.88),dark,48)
    tube('loop_jug_handle',[(r,0,h*.78),(r*1.28,0,h*.78),(r*1.30,0,h*.48),(r*.92,0,h*.48)],.013,dark)
    if id=='food-processor':B('feed_chute',(w*.27,d*.28,h*.12),(0,0,h*.95),glass);B('feed_pusher',(w*.23,d*.24,.022),(0,0,h*.995),dark)
    else:cyl('removable_lid_cap',r*.31,.029,(0,0,h*.93),glass,32)
    for i in range(6):B('jug_measure_mark',(.015,.002,.003),(-r*.22,-r*.93,h*(.44+i*.055)),ivory,.0004)
    for i in range(3):B('processing_blade',(w*.42,.020,.006),(0,0,h*.40),metal,.001,rot=(0,.12,i*math.tau/3))
   elif id in ['toaster-oven','wine-fridge']:
    B('insulated_case',(w,d,h),(0,0,h/2),dark,.025)
    # Open front housing reveals individually modeled shelves behind the glazing.
    # Replace solid housing with thick side/rear/top panels.
    o=bpy.data.objects.get('insulated_case');bpy.data.objects.remove(o,do_unlink=True)
    for x in [-w*.47,w*.47]:B('case_side',(.055,d,h),(x,0,h/2),dark)
    for z in [.025,h-.025]:B('case_horizontal',(w,d,.05),(0,0,z),dark)
    B('case_back',(w,.035,h),(0,d*.47,h/2),dark)
    frame('front_door',0,h*.52,w*.86,h*.84,-d*.48,metal);B('door_glazing',(w*.85,.008,h*.81),(0,-d*.49,h*.52),glass,.001)
    tube('insulated_door_handle',[(-w*.3,-d*.53,h*.91),(-w*.3,-d*.60,h*.91),(w*.3,-d*.60,h*.91),(w*.3,-d*.53,h*.91)],.012,metal)
    for level in range(5 if id=='wine-fridge' else 2):
     z=h*(.17+level*(.15 if id=='wine-fridge' else .30))
     for j in range(11):tube('rack_wire_or_slat',[((j-5)*w*.065,-d*.36,z),((j-5)*w*.065,d*.37,z)],.006,wood if id=='wine-fridge' else metal)
     if id=='wine-fridge':
      for j in range(4):
       x=(j-1.5)*w*.19;cyl('wine_bottle_body',w*.064,d*.52,(x,0,z+.035),m['green'],20,rot=(math.pi/2,0,0));cyl('wine_bottle_neck',w*.025,d*.17,(x,-d*.33,z+.035),m['green'],16,rot=(math.pi/2,0,0))
    if id=='toaster-oven':
     for x in [-w*.25,0,w*.25]:knob(x,-d*.51,h*.07,.021)
    else:
     for j in range(18):B('lower_vent',(.012,.004,.025),((j-8.5)*w*.042,-d*.51,h*.04),metal,.001)
   elif id=='waffle-iron':
    lathe('rounded_waffle_base',[(0,0),(w*.46,.02),(w*.48,h*.28),(w*.45,h*.36),(0,h*.36)],dark)
    cyl('waffle_cooking_plate',w*.42,.018,(0,0,h*.38),metal,48)
    for i in range(9):
     x=(i-4)*w*.08;reach=math.sqrt(max(.001,(w*.38)**2-x*x));B('waffle_grid_bar',(.009,reach*2,.012),(x,0,h*.43),dark,.001);B('waffle_grid_bar',(reach*2,.009,.012),(0,x,h*.43),dark,.001)
    # Raised rear-hinged lid leaves the patterned cooking plate readable.
    lid=cyl('hinged_waffle_lid',w*.45,.035,(0,d*.18,h*.64),dark,48,rot=(.60,0,0));tube('cool_touch_handle',[(-w*.24,-d*.27,h*.66),(-w*.24,-d*.37,h*.66),(w*.24,-d*.37,h*.66),(w*.24,-d*.27,h*.66)],.018,wood)
   elif id=='citrus-press':
    B('cast_press_base',(w,d,.04),(0,0,.02),dark,.025);cyl('press_column',.023,h*.91,(0,d*.30,h*.47),metal,24)
    lathe('juice_collection_bowl',[(.03,h*.22),(w*.40,h*.30),(w*.41,h*.39),(w*.38,h*.40),(w*.35,h*.32),(.02,h*.28)],metal)
    for j in range(18):a=j*math.tau/18;tube('reamer_rib',[(.015*math.cos(a),.015*math.sin(a),h*.50),(.052*math.cos(a),.052*math.sin(a),h*.35)],.004,ivory)
    tube('lever_press_link',[(0,d*.30,h*.82),(0,0,h*.82),(0,-d*.34,h*.65)],.015,metal);B('lever_grip',(.04,.13,.04),(0,-d*.36,h*.67),dark,.012);cyl('upper_press_cup',w*.32,.07,(0,0,h*.65),metal,32)
   elif id=='induction-hob':
    B('induction_chassis',(w,d,h),(0,0,h/2),dark,.018);B('ceramic_glass_hob',(w*.94,d*.93,.006),(0,0,h-.005),dark,.009)
    for r in [.09,.105,.12]:ring('etched_cooking_zone',r,(0,d*.06,h),ivory,.001)
    for j in range(5):B('touch_control_glyph',(.012,.006,.001),((j-2)*.038,-d*.34,h),ivory,.0002)
   else:
    B('coffee_machine_body',(w,d*.84,h*.83),(0,d*.03,h*.46),dark,.035);B('clear_bean_hopper',(w*.77,d*.48,h*.16),(0,d*.10,h*.91),glass,.025);B('hopper_seal',(w*.80,d*.51,.017),(0,d*.10,h*.99),dark)
    B('coffee_display',(w*.37,.007,h*.16),(0,-d*.40,h*.72),m['blue'],.005)
    for x in [-.032,.032]:cyl('paired_coffee_spout',.011,.065,(x,-d*.42,h*.43),metal,20)
    B('drip_tray',(w*.87,d*.26,.035),(0,-d*.32,h*.065),metal)
    for j in range(14):B('drip_tray_slot',(.007,d*.20,.003),((j-6.5)*w*.05,-d*.32,h*.086),dark,.001)
    tube('steam_wand',[(w*.39,-d*.3,h*.56),(w*.44,-d*.43,h*.44),(w*.43,-d*.45,h*.26)],.008,metal)
  elif row[2]=='Lighting':
   def globe(x,y,z,r):lathe('opal_glass_globe',[(r*math.sin(j*math.pi/24),z-r*math.cos(j*math.pi/24)) for j in range(25)],opal,x,y)
   def shade(z,r,hh):
    lathe('lined_linen_lampshade',[(r*.75,z+hh),(r,z),(r-.008,z),(r*.75-.008,z+hh)],cloth)
    for zz,rr in [(z,r),(z+hh,r*.75)]:ring('bound_shade_hem',rr,(0,0,zz),ivory,.006)
   if id=='tripod-floor-lamp':
    for j in range(3):a=j*math.tau/3;tube('splayed_timber_tripod',[(w*.42*math.cos(a),d*.42*math.sin(a),0),(.04*math.cos(a),.04*math.sin(a),h*.78)],.023,wood)
    ring('tripod_spreader',w*.13,(0,0,h*.36),gold,.012);shade(h*.72,w*.49,h*.28)
   elif id in ['articulated-task-lamp','reading-wall-lamp']:
    wall=id=='reading-wall-lamp';cyl('stepped_base',w*.19,.028,(0,d*.35 if wall else 0,h*.25 if wall else .014),gold,32,rot=(math.pi/2,0,0) if wall else (0,0,0))
    pts=[(0,d*.28,h*.27 if wall else .045),(-w*.26,d*.05,h*.65),(w*.10,-d*.20,h*.91)]
    for i in range(2):
     for yoff in [-.014,.014]:tube('balanced_parallel_arm',[(p[0],p[1]+yoff,p[2]) for p in pts[i:i+2]],.008,gold)
    for p in pts:cyl('friction_pivot',.018,.045,p,dark,24,rot=(math.pi/2,0,0))
    lathe('spun_task_shade',[(.022,h*.96),(w*.18,h*.76),(w*.18-.006,h*.76),(.018,h*.95)],dark,w*.10,-d*.20);globe(w*.10,-d*.20,h*.79,.025)
   elif id=='opal-wall-sconce':
    cyl('stepped_wall_rose',w*.23,.035,(0,d*.42,h*.30),gold,40,rot=(math.pi/2,0,0));tube('curved_sconce_arm',[(0,d*.40,h*.30),(0,-d*.12,h*.30),(0,-d*.16,h*.62)],.012,gold);globe(0,-d*.15,h*.70,w*.42)
   elif id=='linen-flush-light':
    shade(.025,w*.48,h*.70);cyl('frosted_bottom_diffuser',w*.46,.009,(0,0,.027),opal,64);cyl('ceiling_rose',w*.24,.045,(0,0,h-.023),gold,40)
   elif id=='double-opal-pendant':
    B('ceiling_plate',(w*.54,.07,.03),(0,0,h-.015),gold)
    for x in [-w*.33,w*.33]:tube('pendant_suspension',[(x,0,h*.91),(x,0,h*.37)],.004,dark);globe(x,0,h*.20,d*.48)
    tube('brass_cross_bridge',[(-w*.36,0,h*.90),(w*.36,0,h*.90)],.008,gold)
   else:
    ring('chandelier_circular_frame',w*.39,(0,0,h*.25),gold,.015);cyl('ceiling_rose',.09,.023,(0,0,h-.012),gold,40)
    for j in range(6):
     a=j*math.tau/6;x=w*.39*math.cos(a);y=d*.39*math.sin(a);tube('candle_stem',[(x,y,h*.24),(x,y,h*.47)],.009,gold);globe(x,y,h*.54,.042)
     if j%2==0:tube('suspension_chain',[(x,y,h*.25),(0,0,h*.95)],.003,gold)
  elif row[2]=='Windows' and row[6]=='decor':
   curtain=id.startswith('curtain');
   if curtain:
    tube('curtain_rod',[(-w*.49,0,h*.97),(w*.49,0,h*.97)],.016,metal)
    for side in [-1,1]:
     verts=[];cols=64;rowsn=30
     for zrow in range(rowsn+1):
      t=zrow/rowsn
      for j in range(cols+1):
       u=j/cols;x=side*w*(.19+u*.29)+.013*math.sin(t*5+u*4)*t;y=-d*.26+d*.22*math.sin(u*math.pi*16)*(1-.12*t);verts.append((x,y,.022+t*h*.91))
     g.add('weighted_wave_fold_drapery',verts,[(r*(cols+1)+j,r*(cols+1)+j+1,(r+1)*(cols+1)+j+1,(r+1)*(cols+1)+j) for r in range(rowsn) for j in range(cols)],cloth)
     if id=='curtain-blackout-pair':
      g.add('separate_blackout_lining',[(x,y+.008,z) for x,y,z in verts],[(r*(cols+1)+j,r*(cols+1)+j+1,(r+1)*(cols+1)+j+1,(r+1)*(cols+1)+j) for r in range(rowsn) for j in range(cols)],ivory)
     for j in range(9):
      x=side*w*(.19+j/8*.29);ring('curtain_hanging_ring',.022,(x,0,h*.95),metal,.003,True)
     tube('weighted_curtain_hem',[(verts[j][0],verts[j][1],.025) for j in range(cols+1)],.003,ivory)
   else:
    B('blind_headrail',(w,d*.65,.05),(0,0,h-.025),wood);B('weighted_bottom_rail',(w,d*.50,.025),(0,0,.014),wood)
    if id=='blind-venetian':
     for j in range(30):B('individual_tilted_wood_slat',(w*.98,d*.52,.009),(0,0,.043+j*(h-.10)/29),wood,.002,rot=(.28,0,0))
     for x in [-w*.32,w*.32]:B('woven_lift_tape',(.022,.006,h*.94),(x,-d*.29,h*.49),ivory,.001)
    elif id=='shade-cellular':
     for j in range(33):
      z=.02+j*(h-.06)/33;hh=(h-.06)/33;v=[(x,y,z+zz) for x in [-w*.49,w*.49] for y,zz in [(-d*.32,hh*.5),(0,0),(d*.32,hh*.5),(0,hh)]];g.add('open_honeycomb_cell',v,[(i,(i+1)%4,(i+1)%4+4,i+4) for i in range(4)],cloth)
    elif id=='blind-roman':
     for j in range(7):
      z=j*(h-.05)/7;hh=(h-.05)/7;v=[]
      for k in range(13):t=k/12;v.extend([(-w*.49,-d*.35*math.sin(t*math.pi),z+hh*t),(w*.49,-d*.35*math.sin(t*math.pi),z+hh*t)])
      g.add('roman_shade_soft_fold',v,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(12)],cloth)
    else:
     B('roller_fabric',(w*.97,.007,h*.94),(0,0,h*.49),cloth,.001);cyl('fabric_wrapped_roller',.027,w,(0,0,h-.027),cloth,32,rot=(0,math.pi/2,0));tube('beaded_control_loop',[(w*.46,.015,h*.91),(w*.46,.018,h*.42),(w*.44,.018,h*.40),(w*.43,.015,h*.91)],.003,ivory)
  elif row[2]=='Windows':
   frame('layered_outer_frame',0,h/2,w-.05,h-.05,0,wood);B('projecting_sill',(w,d,.033),(0,0,.018),wood)
   panels=3 if id=='window-clerestory' else 2 if id=='window-glider' else 1
   for i in range(panels):
    ww=(w-.10)/panels;x=(i-(panels-1)/2)*ww;y=(i%2-.5)*.036;frame('compression_sash',x,h*.51,ww-.045,h-.15,y,wood);B('clear_glazing',(ww-.080,.007,h-.19),(x,y,h*.51),glass,.001)
    frame('glazing_spacer',x,h*.51,ww-.070,h-.178,y-.026,metal)
    if panels==1 or id=='window-glider':tube('window_lever',[(x+ww*.34,y-.055,h*.46),(x+ww*.34,y-.075,h*.55)],.008,gold)
   if id=='window-transom':
    for j in range(5):a=(j+1)*math.pi/6;tube('fanlight_radial_muntin',[(0,-.04,h*.18),(w*.43*math.cos(a),-.04,h*.18+h*.68*math.sin(a))],.013,wood)
   if id=='window-tilt-turn':
    for z in [h*.20,h*.80]:B('corner_sash_hinge',(.023,.025,.090),(-w*.43,-.045,z),metal,.003)
   if id=='window-glider':
    for y in [-.04,.04]:B('sash_roller_track',(w*.93,.009,.015),(0,y,.049),metal,.002)
  else:
   barn='barn' in id;pocket='pocket' in id;multi='multislide' in id;count=2 if 'double' in id or (not barn and not pocket and not multi) else 3 if multi else 1
   aperture=w*.48 if barn else w;cx=-w*.25 if barn else 0;frame('door_casing',cx,h*.47,aperture-.05,h*.92,0,m['wood_dark'])
   if barn:
    B('exposed_flat_track',(w,.025,.045),(0,-d*.27,h*.965),dark)
    for j in range(7):cyl('track_standoff',.014,.045,((j-3)*w*.145,-d*.12,h*.965),metal,16,rot=(math.pi/2,0,0))
   else:
    for y in [-d*.24,0,d*.24]:B('recessed_sill_track',(w,.009,.016),(0,y,.025),metal,.002)
   g.finish();g.groups={}
   for i in range(count):
    before=set(bpy.context.scene.objects);ww=(aperture-.08)/count;x=cx+(i-(count-1)/2)*ww;y=-d*.36 if barn else (i-(count-1)/2)*.042
    leafmat=material('door-surface',(.39,.24,.12),None,.86);frame('sliding_leaf_frame',x,h*.46,ww-.025,h*.87,y,leafmat);glazed='glazed' in id or 'patio' in id
    if glazed:
     B('sliding_glazed_panel',(ww-.065,.008,h*.83),(x,y,h*.46),glass,.001)
     for z in ([h*.30,h*.60] if barn else []):B('glazed_leaf_muntin',(ww-.04,.026,.023),(x,y,z),wood,.003)
    else:
     B('sliding_door_core',(ww-.055,.032,h*.83),(x,y,h*.46),leafmat)
     for z in [h*.25,h*.65]:frame('shaker_recess_moulding',x,z,ww*.80,h*.30,y-.025,leafmat)
     if barn:tube('diagonal_barn_brace',[(x-ww*.39,y-.027,h*.08),(x+ww*.39,y-.027,h*.86)],.025,leafmat)
    if pocket:
     B('recessed_cup_shadow',(.038,.003,.10),(x+ww*.34,y-.024,h*.46),dark,.008);tube('cup_pull_rim',[(x+ww*.34+dx,y-.029,h*.46+dz) for dx,dz in [(-.018,-.044),(.018,-.044),(.018,.044),(-.018,.044),(-.018,-.044)]],.003,metal)
    else:tube('sliding_pull_handle',[(x+ww*.33,y-.03,h*.37),(x+ww*.33,y-.085,h*.37),(x+ww*.33,y-.085,h*.58),(x+ww*.33,y-.03,h*.58)],.012,dark)
    if barn:
     for xx in [x-ww*.29,x+ww*.29]:
      B('roller_hanger',(.026,.025,h*.11),(xx,y,h*.90),dark,.003);cyl('exposed_track_roller',.028,.024,(xx,y,h*.965),dark,32,rot=(math.pi/2,0,0));cyl('roller_axle',.009,.027,(xx,y,h*.965),gold,16,rot=(math.pi/2,0,0))
    travel=(w*.47 if barn else (ww*.93*(1 if i==0 else -1) if pocket else ww*.87 if i<count-1 else 0))
    join_moving(before,i,travel)
  g.finish();return w,d,h
 return {r[0]:lambda m,r=r:build(r,m) for r in ROWS}
