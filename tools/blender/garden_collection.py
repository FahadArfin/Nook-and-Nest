"""Batch 9 original outdoor construction and botanical additions. Metres, Z up."""
import math, random
import bpy
from mathutils import Vector
from detailed_models import Geometry

SIZES={'woven-patio-chair':(.84,.85,.92),'sling-patio-chair':(.66,.90,.96),'patio-corner-sofa':(2.2,1.65,.86),
 'patio-fire-table':(1.2,.8,.6),'pizza-oven-cart':(1.0,.80,1.55),'griddle-cart':(1.35,.65,1.0),'garden-potting-bench':(1.25,.6,1.5),
 'fountain-grass':(.85,.8,1.15),'blue-fescue':(.5,.5,.4),'coneflower-drift':(.9,.75,.9)}
OLD={'patio-dining-chair':(.58,.62,.85),'adirondack-chair':(.8,.95,.95),'patio-loveseat':(1.6,.8,.85),'patio-chaise':(.72,1.95,.85),'garden-bench':(1.5,.55,.85),'patio-bistro-table':(.7,.7,.74),'patio-dining-table':(1.8,.9,.76),'patio-parasol':(2.4,2.4,2.45),'gas-bbq':(1.4,.65,1.15),'kettle-bbq':(.65,.7,.95),'patio-fire-bowl':(.8,.8,.48)}

def garden_builders(box,cyl,material,finish):
 def build(id,m):
  w,d,h=(SIZES|OLD)[id];g=Geometry();rng=random.Random(id)
  wood=m['wood'];iron=material('powder-coated-charcoal',(.052,.063,.057),None,.86,.12);brass=material('weathered-fasteners',(.36,.30,.20),None,.6,.4)
  rope=material('woven-flax-rope',(.46,.36,.22),None,.97);cloth=m['fabric'];seam=material('canvas-piping',(.55,.53,.39),None,.99)
  green=material('garden-leaves',(.18,.32,.12),None,.98);tip=material('fresh-leaf-tips',(.34,.44,.19),None,.98)
  def B(n,s,p,mat=wood,b=.008,rot=None):return box(n,s,p,mat,min(b,min(s)*.22),**({'rot':rot} if rot else {}))
  def rod(n,a,b,r=.01,mat=wood):g.tube(n,[a,b],r,mat,8)
  def path(n,points,r,mat):g.tube(n,points,r,mat,6)
  def ring(n,r,z,mat=iron,x=0,y=0,th=.007):path(n,[(x+r*math.cos(i*math.tau/48),y+r*math.sin(i*math.tau/48),z) for i in range(49)],th,mat)
  def lathe(n,profile,mat,x=0,y=0):
   count=48;v=[(x+r*math.cos(i*math.tau/count),y+r*math.sin(i*math.tau/count),z) for r,z in profile for i in range(count)]
   g.add(n,v,[(j*count+i,j*count+(i+1)%count,(j+1)*count+(i+1)%count,(j+1)*count+i) for j in range(len(profile)-1) for i in range(count)],mat)
  def bolt(x,y,z):cyl('recessed_brass_joinery_pin',.006,.003,(x,y,z),brass,10,rot=(math.pi/2,0,0))
  def cushion(x,y,z,ww,dd,hh):
   B('tailored_box_cushion',(ww,dd,hh),(x,y,z),cloth,.04)
   # Rounded rectangular stitched perimeter, following the inset bevel.
   pts=[]
   for cx,cy,start in [(ww/2-.04,dd/2-.04,0),(-ww/2+.04,dd/2-.04,90),(-ww/2+.04,-dd/2+.04,180),(ww/2-.04,-dd/2+.04,270)]:
    for j in range(7):a=math.radians(start+j*15);pts.append((x+cx+.035*math.cos(a),y+cy+.035*math.sin(a),z+hh*.36))
   path('sewn_cushion_welt',pts+[pts[0]],.0028,seam)
  def legs(top,ww=w,dd=d):
   for x in [-ww*.41,ww*.41]:
    for y in [-dd*.37,dd*.37]:
     B('tapered_joined_leg',(.055,.055,top),(x,y,top/2),wood,.009);B('protective_foot_pad',(.056,.056,.012),(x,y,.006),iron,.003)
    B('mortised_side_apron',(.042,dd*.83,.082),(x,0,top-.06));bolt(x,-dd*.416,top-.055)
  if id in ['fountain-grass','blue-fescue','coneflower-drift']:
   blue=id=='blue-fescue';flower=id=='coneflower-drift';leafm=material('blue_fescue_glaucous_leaf',(.24,.39,.40),None,.99) if blue else green
   for n in range(32 if flower else 125):
    a=n*2.399;rr=rng.uniform(.01,w*.28);base=Vector((rr*math.cos(a),rr*math.sin(a),0));height=h*rng.uniform(.5,1);end=base+Vector((w*.15*math.cos(a),d*.15*math.sin(a),height))
    if flower:
     path('branching_coneflower_stalk',[base,base.lerp(end,.6),end],.004,green)
     for j in range(4):g.leaf('serrated_coneflower_leaf',base.lerp(end,.2+j*.14),(math.cos(a+j),math.sin(a+j),.4),.18,.06,green,True)
     petal=material('echinacea_rose_petals',(.62,.19,.32),None,.98)
     for j in range(14):a2=j*math.tau/14;g.leaf('drooping_ray_floret',end,(math.cos(a2),math.sin(a2),-.7),.105,.032,petal)
     for j in range(70):a2=j*2.399;r=.042*math.sqrt(j/70);p=end+Vector((r*math.cos(a2),r*math.sin(a2),.05*(1-j/70)));g.needle(p,(0,0,1),.018,.005,brass)
    else:
     pts=[base,base+Vector((0,0,height*.42)),end+Vector((w*.12*math.cos(a),d*.12*math.sin(a),-height*.18))];side=Vector((-math.sin(a),math.cos(a),0))*(.003 if blue else .006)
     g.add('arching_strap_blade',[pts[0]-side,pts[0]+side,pts[1]-side*.7,pts[1]+side*.7,pts[2]],[(0,1,3,2),(2,3,4)],leafm if n%3 else tip)
     if not blue and n%5==0:
      path('arching_flower_culm',[base,end],.002,tip)
      for k in range(140):
       p=end+Vector((.012*math.sin(k),.012*math.cos(k),k*.0015));g.needle(p,(math.cos(k*2.4),math.sin(k*2.4),.6),.040*math.sin((k+1)*math.pi/142),.0018,seam)
  elif id in ['patio-dining-chair','adirondack-chair','patio-loveseat','patio-chaise','garden-bench','woven-patio-chair','sling-patio-chair','patio-corner-sofa']:
   low=id in ['adirondack-chair','patio-chaise'];seat=.31 if low else .40;chaise=id=='patio-chaise';woven=id=='woven-patio-chair';sling=id=='sling-patio-chair';corner=id=='patio-corner-sofa'
   legs(seat);back=d*.34
   for y in [-d*.35,d*.30]:B('seat_cross_rail',(w*.87,.055,.07),(0,y,seat-.035))
   if sling:
    for x in [-w*.44,w*.44]:path('continuous_sling_side_frame',[(x,-d*.43,0),(x,-d*.31,seat),(x,d*.22,seat),(x,d*.43,h)],.023,iron)
    for j in range(24):
     y=-d*.30+j*d*.53/24;B('taut_woven_sling_seat',(w*.79,d*.53/24+.001,.012),(0,y,seat-.025*math.sin(j*math.pi/24)),cloth,.002)
    for j in range(30):t=j/29;B('reclined_canvas_back',(w*.79,.02,(h-seat)/29),(0,d*(.22+.19*t),seat+(h-seat)*t),cloth,.002)
   else:
    for j in range(11 if chaise else 7):
     count=11 if chaise else 7;B('rounded_teak_seat_slat',(w*.87,d*.68/count-.009,.032),(0,-d*.36+(j+.5)*d*.68/count,seat))
    for j in range(0 if woven else 11 if w>1 else 7):
     count=11 if w>1 else 7;x=(j/(count-1)-.5)*w*.79;bh=h-seat-.03-(abs(x)/w*.22 if id=='adirondack-chair' else 0)
     B('fan_back_slat' if low else 'vertical_back_slat',(w*.76/count-.008,.038,bh),(x,back,seat+bh/2),wood,.008,(-.28 if low else -.10,0,0));bolt(x,back-.024,seat+.08)
    for x in [-w*.46,w*.46]:
     B('arm_stile',(.052,.06,.26),(x,-d*.28,seat+.11));B('hand_finished_arm_cap',(.11,d*.79,.045),(x,0,seat+.26))
    if woven:
     for x in [-w*.405,w*.405]:B('woven_back_frame_post',(.044,.045,h-seat),(x,back,(h+seat)/2))
     B('woven_back_top_rail',(w*.85,.047,.035),(0,back,h-.017))
     # Rope wraps cross as a true open weave around the solid timber frame.
     for n in range(27):
      z=seat+.03+n*(h-seat-.05)/27;path('horizontal_woven_back',[(x,back+.012*math.sin(j*math.pi),z) for j,x in enumerate([(-.39+j/16*.78)*w for j in range(17)])],.0045,rope)
     for n in range(23):
      x=(-.38+n/22*.76)*w;path('vertical_woven_back',[(x,back+.012*math.cos(j*math.pi),seat+.03+j*(h-seat-.05)/26) for j in range(27)],.0045,rope)
     for sign in [-1,1]:
      for n in range(16):y=-d*.28+n*d*.56/15;rod('woven_arm_screen',(sign*w*.445,y,seat+.02),(sign*w*.445,y,seat+.24),.004,rope)
    if id in ['patio-loveseat','woven-patio-chair','patio-chaise','patio-corner-sofa']:
     count=3 if corner else 2 if w>1 else 1
     for n in range(count):cushion((n-(count-1)/2)*w*.82/count,-d*.035,seat+.08,w*.80/count,d*.59,.14)
     if not chaise and not woven:
      for n in range(count):B('fitted_seamed_back_pad',(w*.80/count,.13,h-seat-.18),((n-(count-1)/2)*w*.82/count,back-.085,(h+seat+.14)/2),cloth,.036)
    if corner:
     # Return arm is an upholstered bench along the left side, creating an L in plan.
     cushion(-w*.31,-d*.29,seat+.12,w*.32,d*.69,.17)
     B('return_front_crossmember',(w*.32,.055,.07),(-w*.31,-d*.61,seat-.015))
     for x in [-w*.44,-w*.18]:B('return_support_leg',(.055,.055,seat),(x,-d*.60,seat/2))
     for x in [-w*.44,-w*.18]:B('return_side_rail',(.05,d*.72,.07),(x,-d*.26,seat-.025))
     B('return_back_frame',(.07,d*.72,h-seat),(-w*.46,-d*.10,(h+seat)/2));B('return_back_pad',(.13,d*.68,h-seat-.15),(-w*.39,-d*.10,(h+seat+.13)/2),cloth,.032)
   for x in [-w*.41,w*.41]:rod('underseat_diagonal_brace',(x,-d*.32,.14),(x,d*.28,seat-.06),.017)
  elif id in ['patio-bistro-table','patio-dining-table','garden-potting-bench']:
   pot=id=='garden-potting-bench';top=.88 if pot else h
   legs(top-.05,w*.77,d*.77) if id=='patio-bistro-table' else legs(top-.05)
   if id=='patio-bistro-table':
    # Individual boards clipped to a circular perimeter, with visible narrow joints.
    for j in range(11):y=(j-5)*d*.087;length=2*math.sqrt(max(.001,(w*.49)**2-(abs(y)+d*.04)**2));B('circular_clipped_top_board',(length,d*.079,.042),(0,y,top-.021))
    ring('round_table_edge',w*.49,top-.018,wood,th=.018)
   else:
    for j in range(7):B('breadboard_table_plank',(w,d/7-.009,.045),(0,-d/2+(j+.5)*d/7,top-.023))
    for x in [-w*.46,w*.46]:B('breadboard_end',(.07,d,.049),(x,0,top-.025))
   for j in range(5 if pot else 1):B('lower_shelf_board' if pot else 'low_stretcher',(w*.84,.065,.035),(0,(j-2)*.095 if pot else 0,.20))
   if pot:
    for x in [-w*.44,w*.44]:B('tool_board_upright',(.055,.045,h), (x,d*.42,h/2))
    for j in range(6):B('potting_back_board',(w,.024,.06),(0,d*.44,1.02+j*.078))
    B('upper_seed_shelf',(w,.22,.033),(0,d*.3,h-.025))
    for i in range(4):
     x=-w*.33+i*w*.22;lathe('stacked_terracotta_seed_pot',[(.045,.89),(.065,1.00),(.07,1.01),(.07,1.03),(.06,1.03),(.04,.91)],m['clay'],x=x,y=-.08)
    for x in [-.35,0,.35]:path('brass_tool_hook',[(x,d*.405,1.25),(x,d*.30,1.25),(x,d*.29,1.28)],.007,brass)
  elif id=='patio-parasol':
   cyl('weighted_parasol_base',.31,.10,(0,0,.05),iron,48);cyl('teak_parasol_mast',.028,h,(0,0,h/2),wood,16)
   for n in range(8):
    a=n*math.tau/8;v=[]
    for row in range(7):
     t=row/6
     for k in range(7):ang=a+k*math.tau/48;r=w*.49*t;v.append((r*math.cos(ang),r*math.sin(ang),h-.39*t**.7-.035*math.sin(k*math.pi/6)*t))
    g.add('curved_sewn_canopy_gore',v,[(j*7+k,j*7+k+1,(j+1)*7+k+1,(j+1)*7+k) for j in range(6) for k in range(6)],cloth if n%2 else seam)
    path('canopy_rib_and_seam',[v[j*7] for j in range(7)],.009,wood);rod('opening_stretcher',(0,0,h-.68),v[4*7],.011,iron)
   ring('vent_cap_binding',.18,h-.015,cloth,th=.016);cyl('runner_collar',.047,.1,(0,0,h-.68),brass,24);path('crank_handle',[(.035,0,1.1),(.11,0,1.1),(.11,0,1.02)],.012,brass)
  else:
   fire=id in ['patio-fire-bowl','patio-fire-table'];kettle=id=='kettle-bbq';pizza=id=='pizza-oven-cart';griddle=id=='griddle-cart'
   if fire or kettle:
    z=h*.65;r=min(w,d)*.46
    if id=='patio-fire-table':
     B('fire_table_plinth',(w*.86,d*.84,h*.72),(0,0,h*.36),iron,.03);B('stone_surround',(w,d,.065),(0,0,h-.033),m['stone'] if 'stone' in m else m['clay'],.014);z=h+.01;r=.26
    else:
     for j in range(3):a=j*math.tau/3;rod('splayed_bowl_leg',(r*.5*math.cos(a),r*.5*math.sin(a),z-r*.3),(r*.75*math.cos(a),r*.75*math.sin(a),.02),.024,iron)
    lathe('double_walled_spun_bowl',[(r*.30,z-r*.46),(r*.73,z-r*.31),(r,z),(r-.018,z),(r*.70,z-r*.27),(r*.30,z-r*.40)],iron);ring('rolled_bowl_lip',r,z,iron)
    if kettle:
     lathe('domed_enamel_kettle_lid',[(r,z+.008),(r*.94,z+.065),(r*.72,z+.15),(r*.36,z+.21),(0,z+.225)],iron)
     path('insulated_lid_grip',[(-.09,0,z+.20),(-.09,0,z+.27),(.09,0,z+.27),(.09,0,z+.20)],.018,wood)
     cyl('lid_vent_damper',.053,.007,(.105,0,z+.20),brass,24)
     for j in range(4):cyl('vent_opening',.008,.009,(.10+.021*math.cos(j*math.pi/2),.021*math.sin(j*math.pi/2),z+.205),iron,12)
     lathe('removable_ash_catcher',[(.07,.13),(.13,.17),(.13,.22),(.12,.23)],brass)
     rod('wheel_axle',(-.22,.18,.07),(.22,.18,.07),.015,iron)
     for x in [-.22,.22]:cyl('rubber_wheel',.068,.028,(x,.18,.07),iron,32,rot=(0,math.pi/2,0));cyl('wheel_hub',.026,.032,(x,.18,.07),brass,20,rot=(0,math.pi/2,0))
    else:
     for j in range(7):
      y=(j-3)*r*.18;length=math.sqrt(max(.001,r*r*.72-y*y));rod('steel_fire_grate',(-length,y,z-.055),(length,y,z-.055),.007,iron)
     for j in range(4):rod('split_firewood',(-r*.6,(j-1.5)*r*.22,z-.025),(r*.6,(j-1.5)*r*.22,z+.035),.033,wood)
   else:
    top=.84 if pizza else h*.73;body=w*.61
    for x in [-body*.45,body*.45]:
     for y in [-d*.36,d*.36]:
      B('welded_cart_upright',(.038,.038,top),(x,y,top/2),iron);cyl('locking_caster',.044,.028,(x,y,.05),iron,24,rot=(math.pi/2,0,0))
    B('cart_lower_shelf',(body,d*.78,.035),(0,0,.17),iron)
    for x in [-body*.25,body*.25]:
     B('folded_cart_door',(body*.48,.026,top*.62),(x,-d*.39,top*.46),iron,.015);rod('bar_door_handle',(x-.07,-d*.43,top*.66),(x+.07,-d*.43,top*.66),.011,brass)
    B('stainless_worktop',(w,d,.035),(0,0,top),brass,.012)
    if pizza:
     # Barrel-vault oven: true open arched mouth and thick refractory reveal.
     radius=body*.48;v=[]
     for y in [-d*.31,d*.34]:
      for rr in [radius,radius-.06]:
       for j in range(25):a=j*math.pi/24;v.append((rr*math.cos(a),y,top+.08+rr*math.sin(a)))
     faces=[]
     for j in range(24):faces.extend([(j,j+1,51+j,50+j),(25+j,75+j,76+j,26+j),(j,25+j,26+j,j+1)])
     g.add('refractory_barrel_vault',v,faces,m['clay']);B('pizza_baking_stone',(body*.88,d*.71,.06),(0,0,top+.04),material('refractory_baking_stone',(.64,.58,.45),None,.99))
     B('oven_dark_back',(body*.80,.035,radius*.76),(0,d*.31,top+radius*.40),iron)
     cyl('oven_flue',.059,h-top-radius*.5,(0,d*.18,(h+top+radius*.5)/2),iron,32);cyl('rain_cap',.10,.027,(0,d*.18,h-.014),iron,32)
    elif griddle:
     B('seasoned_flat_top',(body,d*.76,.024),(0,0,top+.05),iron)
     for x in [-body/2,body/2]:B('griddle_splash_guard',(.014,d*.78,.08),(x,0,top+.08),iron)
     B('rear_splash_guard',(body,.014,.08),(0,d*.38,top+.08),iron);B('grease_trough',(body,.055,.035),(0,-d*.39,top+.024),iron)
    else:
     B('grill_firebox',(body,d*.83,.13),(0,0,top+.08),iron,.03)
     B('rounded_enamel_hood',(body,d*.82,h-top-.11),(0,0,(h+top+.11)/2),iron,.09)
     path('supported_hood_handle',[(-body*.25,-d*.40,h-.08),(-body*.25,-d*.49,h-.08),(body*.25,-d*.49,h-.08),(body*.25,-d*.40,h-.08)],.014,wood)
     cyl('hood_temperature_gauge',.034,.009,(0,-d*.425,h-.07),brass,32,rot=(math.pi/2,0,0))
    for j in range(3):
     x=(j-1)*body*.27;cyl('burner_control_bezel',.026,.016,(x,-d*.44,top-.045),brass,24,rot=(math.pi/2,0,0));B('knob_indicator',(.003,.003,.015),(x,-d*.45,top-.039),cloth,.0005)
    for x in [-w*.42,w*.42]:
     for j in range(3):B('side_shelf_drain_slot',(.014,.19,.004),(x+(j-1)*.03,0,top+.02),iron,.001)
  g.finish();return w,d,h
 return {id:lambda m,id=id:build(id,m) for id in SIZES|OLD}
