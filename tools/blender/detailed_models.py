"""Batch 8: authored botanical structures, horology and masonry details.

Foliage is explicit folded leaf/needle geometry grouped by material. Branches,
petals, bark, dials and architectural details remain named editable meshes.
"""
import json, math, random
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
VEGETATION={
 'spruce-tree':(1.8,1.8,3.6),'maple-tree':(3.5,3.2,4.3),'sakura-tree':(3.4,3.2,4),
 'birch-tree':(2.3,2.1,4.5),'weeping-willow':(3.5,3.3,4.2),
 'christmas-tree':(1,1,1.9),'christmas-slim-tree':(.65,.65,1.25),
 'lavender-clump':(.55,.5,.65),'daisy-clump':(.5,.45,.5),'tulip-planter':(.45,.45,.65),
 'raised-flowerbed':(1.6,.7,.65),'balcony-flowerbox':(1,.3,.42),
 'garden-hedge':(1.5,.55,1.1),'flowering-shrub':(.9,.85,1),
 'hydrangea-border':(1,.7,.8),'wildflower-patch':(1,.8,.55),'fern-clump':(.75,.65,.65),
 'grass-clump':(.3,.3,.18), 'large-plant':(.6,.6,1.3),'small-plant':(.32,.32,.52)
}

class Geometry:
    def __init__(self):self.groups={}
    def add(self,name,verts,faces,mat):
        key=(name,mat.name)
        if key not in self.groups:self.groups[key]=[[],[],mat]
        v,f,_=self.groups[key];offset=len(v);v.extend([tuple(p) for p in verts]);f.extend([tuple(offset+i for i in face) for face in faces])
    def tube(self,name,points,radius,mat,sides=7):
        points=[Vector(p) for p in points];verts=[]
        for i,p in enumerate(points):
            tangent=(points[min(i+1,len(points)-1)]-points[max(i-1,0)]).normalized()
            u=tangent.cross(Vector((0,0,1)))
            if u.length<.01:u=tangent.cross(Vector((0,1,0)))
            u.normalize();v=tangent.cross(u);r=radius*(1-.80*i/(len(points)-1))
            for j in range(sides):a=j*math.tau/sides;verts.append(p+(u*math.cos(a)+v*math.sin(a))*r*(1+.07*math.sin(j*17+i)))
        faces=[]
        for i in range(len(points)-1):
            for j in range(sides):k=i*sides+j;n=i*sides+(j+1)%sides;faces.append((k,n,n+sides,k+sides))
        faces.extend([tuple(reversed(range(sides))),tuple(range((len(points)-1)*sides,len(points)*sides))]);self.add(name,verts,faces,mat)
    def leaf(self,name,p,direction,length,width,mat,serrated=False):
        p=Vector(p);axis=Vector(direction).normalized();u=axis.cross(Vector((.17,.23,1)))
        if u.length<.01:u=axis.cross(Vector((0,1,0)))
        u.normalize();normal=u.cross(axis).normalized()
        outline=[(0,0),(.22,.55),(.37,.39),(.52,1),(.65,.52),(.85,.43),(1,0),(.85,-.43),(.65,-.52),(.52,-1),(.37,-.39),(.22,-.55)] if serrated else [(0,0),(.23,.65),(.55,1),(.84,.55),(1,0),(.84,-.55),(.55,-1),(.23,-.65)]
        verts=[p+axis*length*.52+normal*width*.17]+[p+axis*(x*length)+u*(y*width/2)+normal*(math.sin(x*math.pi)*width*.04) for x,y in outline]
        self.add(name,verts,[(0,i+1,(i+1)%len(outline)+1) for i in range(len(outline))],mat)
        if 'leav' in name or 'leaf' in name or 'pinnule' in name:
            # Raised midrib catches soft light without a painted vein texture.
            self.add('raised_leaf_midribs',[p+normal*width*.025,p+axis*length*.52+normal*width*.19-u*width*.016,p+axis*length*.97,p+axis*length*.52+normal*width*.19+u*width*.016],([(0,1,2)] if 'willow' in name else [(0,1,2),(0,2,3)]),mat)
    def needle(self,p,direction,length,width,mat):
        p=Vector(p);axis=Vector(direction).normalized();side=axis.cross(Vector((.23,.57,1))).normalized()*width
        self.add('individual_conifer_needles',[p-side,p+side,p+axis*length,p+axis*length*.4+Vector((0,0,width*.7))],[(0,3,2),(3,1,2)],mat)
    def finish(self):
        for (name,_),(verts,faces,mat) in self.groups.items():
            mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.materials.append(mat);mesh.update()
            ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob)

def detailed_builders(box,cyl,material,finish):
    rows={r[0]:r for r in json.loads((ROOT/'src/cozyExpansion.json').read_text())}
    def palette(m):
        return {**m,'bark':material('bark-umber',(.21,.12,.065),None,.97),
          'deep':material('foliage-shadow',(.08,.20,.070),None,.98),
          'leaf':material('foliage-main',(.16,.32,.11),None,.98),
          'tip':material('foliage-new-growth',(.28,.44,.16),None,.98),
          'white':material('warm-porcelain',(.89,.85,.74),None,.93),
          'gold':material('antique-brass',(.50,.29,.085),None,.49,.55),
          'black':material('cast-iron',(.028,.034,.033),None,.79,.18),
          'walnut':material('walnut-case',(.20,.091,.039),None,.85),
          'stone':material('warm-limestone',(.66,.60,.48),None,.98),
          'grout':material('mortar',(.27,.26,.22),None,1),
          'pink':material('petal-blush',(.78,.32,.39),None,.94),
          'purple':material('lavender-florets',(.39,.21,.53),None,.94)}
    def B(name,size,p,mat,bevel=.01):return box(name,size,p,mat,min(bevel,min(size)*.20))
    def torus(name,r,thickness,p,mat,front=False,segments=64):
        bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=thickness,major_segments=segments,minor_segments=6,location=p,rotation=(math.pi/2,0,0) if front else (0,0,0));o=bpy.context.object;o.name=name;o.data.materials.append(mat);return o
    def disc(name,r,depth,p,mat):return cyl(name,r,depth,p,mat,64,rot=(math.pi/2,0,0))
    def lathe(name,profile,mat,n=40):
        verts=[(r*math.cos(i*math.tau/n),r*math.sin(i*math.tau/n),z) for r,z in profile for i in range(n)]
        g=Geometry();g.add(name,verts,[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(profile)-1) for i in range(n)],mat);g.finish()
    def botanical(id,m):
        m=palette(m);g=Geometry();rng=random.Random(id);w,d,h=VEGETATION[id];greens=[m['deep'],m['leaf'],m['tip']]
        def tube(name,pts,r,mat=None,sides=7):g.tube(name,pts,r,mat or m['bark'],sides)
        def flower(p,r,kind='daisy'):
            p=Vector(p);petals=13 if kind=='daisy' else 4 if kind=='hydrangea' else 5
            for i in range(petals):
                a=i*math.tau/petals+rng.random()*.12
                g.leaf('cupped_flower_petals',p,(math.cos(a),math.sin(a),.25 if kind=='daisy' else .65),r,r*.65,m['white'] if kind=='daisy' else m['pink'])
            for i in range(25 if kind=='daisy' else 5):
                a=i*2.4;rr=r*.22*math.sqrt((i+1)/25);g.needle(p+Vector((rr*math.cos(a),rr*math.sin(a),r*.04)),(0,0,1),r*.10,r*.045,m['gold'])
        if id in ['spruce-tree','christmas-tree','christmas-slim-tree']:
            holiday=id!='spruce-tree';base=h*.10 if holiday else .12
            tube('tapered_barked_trunk',[(0,0,0),(.012,0,h*.4),(-.007,.01,h*.75),(0,0,h)],w*.035,sides=12)
            # Irregular whorls branch into many cylindrical needle-bearing shoots.
            for tier in range(13):
                t=tier/13;z=base+(h-base)*(.07+t*.89);reach=w*.49*(1-t)**.82
                for b in range(6):
                    a=b*math.tau/6+tier*2.399+rng.uniform(-.13,.13);v=Vector((math.cos(a),math.sin(a),0));side=Vector((-v.y,v.x,0));start=Vector((0,0,z));tip=start+v*reach+Vector((0,0,-h*.035+rng.random()*h*.03))
                    tube('barked_primary_bough',[start,start.lerp(tip,.45)+Vector((0,0,.025)),tip],w*.010*(1-t*.7))
                    for j in range(1,9):
                        u=j/9;p=start.lerp(tip,u);l=reach*(.34*(1-u)+.13)
                        for sign in [-1,0,1]:
                            direction=(v*.50+side*sign*.86+Vector((0,0,.5 if sign==0 else .14))).normalized();end=p+direction*l
                            tube('secondary_needle_shoot',[p,end],w*.0022,sides=4)
                            for k in range(18):
                                q=p.lerp(end,(k+.3)/18);phase=k*2.4
                                needleDir=(direction*.35+side*math.cos(phase)+Vector((0,0,math.sin(phase)))).normalized()
                                g.needle(q,needleDir,w*rng.uniform(.048,.070),w*.0058,greens[(k+j+b)%3])
                    # Bright fresh tip terminates each branch.
                    for k in range(16):a2=k*2.4;g.needle(tip, v*.4+side*math.cos(a2)+Vector((0,0,math.sin(a2))),w*.035,w*.003,m['tip'])
            for level in range(12):
                z=h*(.92+level*.006);p=(0,0,z)
                for i in range(16):a=i*2.4;g.needle(p,(math.cos(a),math.sin(a),.8),w*.038*(1-level/15),w*.004,m['tip'])
            if holiday:
                lathe('woven_tree_basket',[(w*.15,0),(w*.19,h*.02),(w*.20,h*.105),(w*.19,h*.115),(w*.17,h*.108),(w*.16,.02)],m['wood'])
                for level in range(9):torus('basket_weave',w*(.157+level*.004),w*.003,(0,0,h*.013+level*h*.01),m['walnut'],segments=32)
                light=material('warm-light',(1,.68,.25),None,.3);bs=light.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(1,.48,.08,1);bs.inputs['Emission Strength'].default_value=3
                wire=[]
                for i in range(140):
                    t=i/139;a=t*math.tau*6;r=w*.49*(1-t*.91);p=(r*math.cos(a),r*math.sin(a),h*(.15+t*.76));wire.append(p)
                    if i%2==0:
                        g.leaf('fairy_light_bulbs',p,(0,0,1),w*.013,w*.013,light)
                    if i%8==0:
                        rr=w*.020;latheName='glass_bauble';o=cyl(latheName,rr,rr*1.8,(p[0],p[1],p[2]-.025),m['pink'] if i%16 else m['gold'],12);torus('bauble_cap',rr*.3,rr*.15,(p[0],p[1],p[2]),m['gold'],segments=16)
                tube('spiral_light_cord',wire,w*.002,m['deep'],4)
                verts=[(0,-.005,h*.95)];
                for i in range(10):a=math.pi/2+i*math.pi/5;r=w*(.070 if i%2==0 else .031);verts.append((r*math.cos(a),0,h*.95+r*math.sin(a)))
                g.add('faceted_five_point_star',verts,[(0,i+1,(i+1)%10+1) for i in range(10)],m['gold'])
        elif id in ['birch-tree','maple-tree','sakura-tree','weeping-willow']:
            birch=id=='birch-tree';willow=id=='weeping-willow';sakura=id=='sakura-tree'
            colors=greens if id!='maple-tree' else [material('maple-ochre',(.58,.27,.06)),material('maple-russet',(.40,.12,.045)),material('maple-gold',(.70,.43,.08))]
            trunks=3 if birch else 1
            for trunk in range(trunks):
                shift=Vector(((trunk-(trunks-1)/2)*w*.065,0,0));lean=Vector(((trunk-1)*w*.09 if birch else w*.04,w*.03,h))
                tube('silver_birch_bark' if birch else 'sculpted_tree_trunk',[shift,shift+lean*.35,shift+lean*.72,shift+lean],w*(.022 if birch else .046),m['white'] if birch else m['bark'],12)
                if birch:
                    for i in range(24):
                        t=rng.uniform(.03,.8);p=shift+lean*t;r=w*.023*(1-t*.8);a=rng.random()*math.tau
                        tube('birch_dark_lenticels',[p+Vector((r*math.cos(a),r*math.sin(a),0)),p+Vector((r*math.cos(a+.8),r*math.sin(a+.8),.007))],.005,m['black'],4)
                for b in range(14 if birch else 25):
                    a=b*2.399+trunk;z=h*(.30+.60*b/(14 if birch else 25));start=shift+lean*(z/h);r=w*.45*math.sin((z/h-.15)*math.pi)*rng.uniform(.75,1.1)
                    end=start+Vector((r*math.cos(a),r*math.sin(a),h*.08));tube('forked_canopy_limb',[start,start.lerp(end,.55)+Vector((0,0,.10)),end],w*.008)
                    for twig in range(6 if willow else 4):
                        angle=a+(twig-1.5)*.48;tip=(start.lerp(end,.35+twig*.13) if willow else end)+Vector((w*.12*math.cos(angle),w*.12*math.sin(angle),h*(.025+twig*.008)))
                        tube('fine_canopy_twigs',[start.lerp(end,.6),tip],w*.0026)
                        for leaf in range(40 if willow else 32 if birch else 12 if sakura else 32):
                            if willow:
                                t=leaf/40;p=tip+Vector((w*.05*math.sin(t*6+twig),w*.05*math.cos(t*6+twig),-h*.33*t));direction=(math.cos(angle)*.5,math.sin(angle)*.5,-1);ll=w*.057;ww=ll*.19
                                if leaf==0:tube('hanging_willow_switch',[tip,tip+Vector((0,0,-h*.26))],w*.0013)
                            else:
                                phi=rng.random()*math.tau;rr=rng.random()**.5*w*.14;p=tip+Vector((rr*math.cos(phi),rr*math.sin(phi),rng.uniform(-h*.065,h*.065)));direction=(math.cos(phi),math.sin(phi),rng.uniform(-.6,.7));ll=w*rng.uniform(.052,.078);ww=ll*(.7 if birch else .85)
                            if not willow and leaf%3==0:tube('leaf_bearing_petioles',[tip,p],w*.00065,m['bark'],3)
                            g.leaf('serrated_birch_leaves' if birch else 'lobed_maple_leaves' if id=='maple-tree' else 'willow_lanceolate_leaves' if willow else 'cherry_leaves',p,direction,ll,ww,colors[(leaf+b)%3],birch or id=='maple-tree')
                            if willow:g.leaf('paired_willow_leaves',p,(-math.cos(angle)*.7,-math.sin(angle)*.7,-.5),ll,ww,colors[(leaf+b+1)%3])
                            if sakura and leaf%2==0:flower(p+Vector((0,0,.025)),w*.022,'cherry')
        elif id=='grass-clump':
            for i in range(220):
                a=rng.random()*math.tau;r=rng.random()*.085;p=Vector((r*math.cos(a),r*math.sin(a),0));bh=rng.uniform(.06,h);bend=Vector((math.cos(a),math.sin(a),0))*bh*.42;side=Vector((-math.sin(a),math.cos(a),0))*.004
                verts=[p-side,p+side,p+bend*.25+Vector((0,0,bh*.5))-side*.65,p+bend*.25+Vector((0,0,bh*.5))+side*.65,p+bend+Vector((0,0,bh))]
                g.add('curved_tapered_grass_blades',verts,[(0,1,3,2),(2,3,4)],greens[1+i%2])
        elif id=='fern-clump':
            for frond in range(17):
                a=frond*2.4;size=rng.uniform(.72,1);points=[]
                for i in range(14):
                    t=i/13;p=Vector((w*.46*t*math.cos(a)*size,d*.46*t*math.sin(a)*size,h*math.sin(t*2.1)*size));points.append(p)
                    if i>0:
                        for sign in [-1,1]:
                            direction=Vector((math.cos(a+sign*1.05),math.sin(a+sign*1.05),.12));length=w*.19*(1-t*.8);end=p+direction*length;tube('fern_pinna_midrib',[p,end],.0015,m['tip'],4)
                            for j in range(6):
                                q=p.lerp(end,j/6)
                                for side in [-1,1]:g.leaf('individual_fern_pinnules',q,(math.cos(a+sign*1.05+side*.8),math.sin(a+sign*1.05+side*.8),.12),length*.37*(1-j*.09),length*.13,greens[i%3],True)
                tube('arching_fern_rachis',points,.005,m['tip'],5)
        else:
            planter=id in ['tulip-planter','raised-flowerbed','balcony-flowerbox','large-plant','small-plant'];base=h*.27 if planter else 0
            if planter:
                if id in ['raised-flowerbed','balcony-flowerbox']:
                    for row in range(3):
                        for y in [-d*.47,d*.47]:B('planter_tongue_and_groove',(w,.033,base/3-.006),(0,y,(row+.5)*base/3),m['wood'])
                        for x in [-w*.48,w*.48]:B('planter_end_board',(.035,d,base/3-.006),(x,0,(row+.5)*base/3),m['wood'])
                    B('potting_soil',(w*.94,d*.86,.026),(0,0,base-.025),m['bark'])
                else:
                    r=min(w,d)*.37;lathe('handthrown_terracotta_pot',[(r*.65,0),(r*.92,base*.8),(r,base*.85),(r,base),(r*.87,base),(r*.83,base*.12)],m['clay']);cyl('dark_potting_soil',r*.84,.02,(0,0,base*.89),m['bark'],32)
            if id in ['garden-hedge','flowering-shrub']:
                for stem in range(42):
                    x=rng.uniform(-w*.45,w*.45);y=rng.uniform(-d*.35,d*.35);top=Vector((x,y,h*rng.uniform(.65,1)));tube('woody_shrub_stem',[(x*.4,y*.4,0),top],.009)
                    for j in range(35):
                        p=top+Vector((rng.uniform(-w*.13,w*.13),rng.uniform(-d*.14,d*.14),-rng.random()*h*.6));a=rng.random()*math.tau;g.leaf('dense_shrub_leaves',p,(math.cos(a),math.sin(a),.35),.09,.046,greens[j%3])
                        if id=='flowering-shrub' and j%10==0:flower(p,.042,'cherry')
            elif id in ['large-plant','small-plant']:
                for i in range(19):
                    a=i*2.4;top=Vector((w*.29*math.cos(a),d*.29*math.sin(a),base+(h-base)*rng.uniform(.4,.9)));tube('houseplant_petiole',[(0,0,base*.9),top],w*.009,m['leaf'])
                    g.leaf('veined_houseplant_leaf',top,(math.cos(a),math.sin(a),.6),w*.43,w*.23,greens[i%3]);tube('leaf_midrib',[top,top+Vector((math.cos(a),math.sin(a),.6)).normalized()*w*.40],w*.002,m['tip'],4)
            else:
                count=65 if id in ['raised-flowerbed','wildflower-patch'] else 34 if id=='lavender-clump' else 19
                if id=='hydrangea-border':count=14
                for i in range(count):
                    x=rng.uniform(-w*.39,w*.39);y=rng.uniform(-d*.38,d*.38);z=base+(h-base)*rng.uniform(.48,.92);p=Vector((x,y,z));tube('curved_flower_stalk',[(x*.7,y*.7,base),(x*.9,y*.8,z*.72),p],.004,m['leaf'],5)
                    for j in range(6):
                        a=i*2.4+j*1.8;hydrangea=id=='hydrangea-border';ll=h*(.28 if hydrangea else .20);ww=h*(.17 if hydrangea else .038 if id=='lavender-clump' else .070)
                        g.leaf('veined_stem_leaves',(x,y,base+(z-base)*(.15+j*.11)),(math.cos(a),math.sin(a),.35),ll,ww,greens[j%3],hydrangea)
                    if id not in ['lavender-clump','hydrangea-border']:
                        for j in range(3):
                            a=i*2.4+j*2.1;g.leaf('basal_rosette_leaves',(x,y,base),(math.cos(a)*.5,math.sin(a)*.5,1),h*.39,h*.066,greens[j])
                    if id=='lavender-clump':
                        for j in range(9):
                            for k in range(3):a=k*math.tau/3+j*.8;g.leaf('lavender_individual_florets',p+Vector((.012*math.cos(a),.012*math.sin(a),-j*.012)),(math.cos(a),math.sin(a),.4),.028,.021,m['purple'])
                    elif id=='hydrangea-border':
                        for j in range(55):a=j*2.4;rr=.12*math.sqrt(j/55);flower(p+Vector((rr*math.cos(a),rr*math.sin(a),.105*math.sqrt(1-j/55))),.035,'hydrangea')
                    elif id=='tulip-planter':
                        for j in range(6):a=j*math.tau/6;g.leaf('cupped_tulip_petals',p,(.4*math.cos(a),.4*math.sin(a),1),.11,.066,m['pink'] if i%2 else m['white'])
                    else:flower(p,.040 if id!='balcony-flowerbox' else .029,'daisy' if i%3 else 'cherry')
        # Buttress roots and bark furrows integrate trees with the soil.
        if id.endswith('tree') or id=='weeping-willow':
            for i in range(9):
                a=i*2.399;reach=w*rng.uniform(.075,.14);tube('flared_surface_roots',[(0,0,.15),(reach*.5*math.cos(a),reach*.5*math.sin(a),.035),(reach*math.cos(a),reach*math.sin(a),.008)],w*.012)
            if id=='spruce-tree':
                for i in range(14):
                    a=i*2.399;z=h*(.18+i*.035);r=w*.29*(1-z/h);p=Vector((r*math.cos(a),r*math.sin(a),z))
                    for j in range(24):
                        aa=j*2.399;q=p+Vector((.028*math.cos(aa),.028*math.sin(aa),-j*.004));g.leaf('overlapping_pinecone_scales',q,(math.cos(aa),math.sin(aa),-.5),.027,.022,m['bark'])
        g.finish();return w,d,h

    def clock(id,m):
        m=palette(m);w,d,h=[n/1000 for n in rows[id][3:6]];g=Geometry();wood=m['walnut'];gold=m['gold'];front=-d*.49
        def rod(name,a,b,r,mat):g.tube(name,[a,b],r,mat,8)
        def text(label,x,z,size,mat,y):
            cu=bpy.data.curves.new('engraved_numeral','FONT');cu.body=label;cu.size=size;cu.align_x='CENTER';cu.align_y='CENTER';cu.extrude=size*.018;cu.resolution_u=3
            ob=bpy.data.objects.new('dial_numeral_'+label,cu);bpy.context.collection.objects.link(ob);ob.location=(x,y,z);ob.rotation_euler=(math.pi/2,0,0);ob.data.materials.append(mat);bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.convert(target='MESH');ob.select_set(False)
        tall=id=='grandfather-clock';cuckoo=id=='cuckoo-clock';pendulum=id=='pendulum-wall-clock'
        if id=='wall-clock':
            disc('turned_walnut_clock_case',w*.49,d*.7,(0,0,h*.5),wood);center=h*.5;r=w*.42
            for i in range(48):a=i*math.tau/48;B('scalloped_case_reeding',(.012,d*.65,.020),(w*.475*math.sin(a),0,center+w*.475*math.cos(a)),wood,.003)
        elif tall or pendulum:
            for z,width,depth,hh in [(h*.025,w,d,h*.05),(h*.065,w*.94,d*.93,h*.03),(h*.84,w,d,h*.055),(h*.91,w*.96,d*.95,h*.07)]:B('layered_case_moulding',(width,depth,hh),(0,0,z),wood)
            B('case_back',(w*.83,.035,h*.82),(0,d*.40,h*.45),wood)
            for x in [-w*.40,w*.40]:
                B('case_stile',(.055,d*.82,h*.80),(x,0,h*.45),wood)
                for j in range(5):rod('fluted_column',(x+(j-2)*w*.016,front-.004,h*.12),(x+(j-2)*w*.016,front-.004,h*.69),w*.008,gold)
            center=h*.765;r=w*.34
            rod('pendulum_rod',(0,front+.025,h*.65),(0,front+.025,h*.24),w*.010,gold);disc('polished_pendulum_bob',w*.18,.012,(0,front+.020,h*.24),gold);torus('bob_concentric_rim',w*.14,w*.008,(0,front+.008,h*.24),wood,True)
            for x in [-w*.20,w*.20]:rod('weight_chain',(x,front+.03,h*.63),(x,front+.03,h*.43),w*.004,gold);cyl('clock_weight',w*.043,h*.13,(x,front+.025,h*.39),gold,24)
            # Open glazed door frame leaves weights and pendulum readable.
            for x in [-w*.33,w*.33]:B('pendulum_door_frame',(.019,.020,h*.47),(x,front,h*.38),gold,.004)
            for z in [h*.15,h*.615]:B('pendulum_door_frame',(w*.67,.020,.025),(0,front,z),gold,.004)
            disc('arched_pediment',w*.34,d*.5,(0,0,h*.91),wood)
        elif cuckoo:
            B('chalet_case',(w*.73,d*.72,h*.47),(0,0,h*.57),wood);center=h*.56;r=w*.24
            for sign in [-1,1]:rod('carved_roof_beam',(sign*w*.49,front,h*.73),(0,front,h*.96),w*.039,wood)
            for sign in [-1,1]:
                slope=sign*math.atan2(h*.23,w*.49)
                roof=B('pitched_chalet_roof',(math.hypot(w*.49,h*.23),d*1.1,.023),(sign*w*.245,0,h*.845),wood);roof.rotation_euler.y=slope
                for row in range(5):
                    for col in range(5):
                        t=(row+.5)/5;x=sign*w*.49*t;z=h*.96-h*.23*t;shingle=B('overlapping_roof_shingle',(w*.115,d*.22,.008),(x,-d*.44+col*d*.22,z+.013),wood,.003);shingle.rotation_euler.y=slope
            for x in [-w*.29,w*.29]:
                    for j in range(6):
                        z=h*(.33+j*.06);l=w*.13;ww=w*.06
                        verts=[(x,front-.055,z+l*.5),(x,front-.025,z),(x-ww,front-.025,z+l*.35),(x-ww*.7,front-.025,z+l*.65),(x,front-.025,z+l),(x+ww*.7,front-.025,z+l*.65),(x+ww,front-.025,z+l*.35)]
                        g.add('relief_carved_oak_leaf',verts,[(0,i+1,(i+1)%6+1) for i in range(6)],wood)
            disc('cuckoo_opening',w*.07,.02,(0,front-.015,h*.79),m['black']);g.leaf('little_cuckoo_bird',(0,front-.04,h*.79),(.5,-.2,.1),w*.10,w*.055,m['white'])
            for x in [-w*.13,w*.13]:rod('hanging_chain',(x,0,h*.34),(x,0,h*.08),.004,gold);cyl('pinecone_weight',w*.04,h*.13,(x,0,h*.10),wood,12)
            rod('cuckoo_pendulum',(0,front,h*.32),(0,front,h*.07),.005,gold);g.leaf('pendulum_leaf',(-w*.07,front,h*.055),(1,0,.2),w*.14,w*.10,wood,True)
        else:
            # Tambour arch mantle case with stepped foot and turned columns.
            B('mantel_plinth',(w,d,h*.075),(0,0,h*.038),wood);B('plinth_bead',(w*.96,d*.96,h*.035),(0,0,h*.095),gold)
            B('arched_case_lower',(w*.80,d*.82,h*.45),(0,0,h*.36),wood);disc('arched_upper_case',w*.40,d*.82,(0,0,h*.57),wood);center=h*.57;r=w*.31
            for x in [-w*.35,w*.35]:
                cyl('turned_case_column',w*.035,h*.32,(x,front,h*.33),wood,24);torus('column_cap',w*.044,w*.009,(x,front,h*.49),gold)
        disc('ivory_porcelain_dial',r,.012,(0,front-.025,center),m['white'])
        for rr,th,mat in [(r*1.05,r*.028,gold),(r*.98,r*.013,wood),(r*.72,r*.007,gold)]:torus('turned_bezel',rr,th,(0,front-.039,center),mat,True)
        for i in range(60):
            a=i*math.tau/60;length=r*(.07 if i%5==0 else .032);ob=B('minute_track',(.002 if r<.15 else .003,.003,length),(r*.9*math.sin(a),front-.042,center+r*.9*math.cos(a)),m['black'],.0004);ob.rotation_euler.y=a
        roman=['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI']
        for i in range(12):a=i*math.tau/12;text(roman[i],r*.79*math.sin(a),center+r*.79*math.cos(a),r*.15,m['black'],front-.045)
        for angle,length,width in [(-math.pi/3,r*.52,r*.038),(math.pi/3,r*.75,r*.023)]:
            end=(math.sin(angle)*length,front-.062,center+math.cos(angle)*length);rod('tapered_clock_hand',(0,front-.062,center),end,width,m['black']);torus('pierced_hand_detail',r*.035,r*.009,(end[0]*.63,front-.065,center+(end[2]-center)*.63),gold,True)
        disc('hand_pivot',r*.05,.01,(0,front-.070,center),gold)
        g.finish();return w,d,h

    def fireplace(id,m):
        m=palette(m);w,d,h=[n/1000 for n in rows[id][3:6]];g=Geometry();stone=m['stone'];iron=m['black'];gold=m['gold'];rng=random.Random(id)
        stove=id in ['wood-stove','tiled-corner-stove'];linear=id=='linear-fireplace';arched=id=='stone-arch-fireplace';victorian=id=='cast-iron-fireplace';front=-d*.48
        ember=material('warm-light',(.95,.15,.008),None,.95);bs=ember.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(1,.12,.003,1);bs.inputs['Emission Strength'].default_value=2.6
        flame=material('golden-flame',(1,.53,.025),None,.9);bs=flame.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(1,.37,.012,1);bs.inputs['Emission Strength'].default_value=2.4
        fireHeight=h*.39 if stove else h*.54 if not linear else h*.51;fireBase=h*.12;fw=w*.65
        B('slate_hearth',(w,d,.055),(0,0,.028),iron)
        if stove:
            bodyH=h*.54;B('stove_rear',(w*.87,.055,bodyH),(0,d*.39,fireBase+bodyH/2),iron)
            for x in [-w*.40,w*.40]:B('stove_cast_side',(.065,d*.8,bodyH),(x,0,fireBase+bodyH/2),iron)
            B('stove_top',(w*.95,d*.90,.06),(0,0,fireBase+bodyH),iron)
            for x in [-w*.36,w*.36]:
                for y in [-d*.3,d*.3]:g.tube('splayed_stove_leg',[(x*.82,y*.8,fireBase+.03),(x,y,.02)],.030,iron,9)
            cyl('flue_pipe',w*.12,h-(fireBase+bodyH),(0,d*.2,(h+fireBase+bodyH)/2),iron,40)
            for z in [h*.73,h*.92]:torus('flue_collar',w*.124,w*.013,(0,d*.2,z),iron)
            if id=='tiled-corner-stove':
                tile=material('glazed-sage-tile',(.17,.32,.24),None,.42)
                for side in [-1,1]:
                    for row in range(7):
                        for col in range(3):B('individual_stove_ceramic_tile',(.035,d*.24,bodyH/7-.008),(side*w*.44,-d*.26+col*d*.26,fireBase+(row+.5)*bodyH/7),tile,.006)
        else:
            surround=iron if victorian else stone if arched else m['white'] if not linear else m['walnut']
            for x in [-w*.43,w*.43]:
                B('structural_jamb',(w*.14,d*.82,h*.86),(x,0,h*.46),surround)
                if not linear:
                    for layer in range(3):B('jamb_base_moulding',(w*(.18-layer*.012),d*.92,.035),(x,-d*.02,.07+layer*.035),surround)
                if not linear:
                    for j in range(5):B('reeded_pilaster',(.009,.018,h*.59),(x+(j-2)*w*.020,front,h*.48),surround,.003)
                    B('column_capital',(w*.19,d*.91,.050),(x,0,h*.82),surround)
            for z,width,depth,hh in ([(h*.90,w,d,h*.18)] if linear else [(h*.85,w*.89,d*.81,h*.12),(h*.925,w*.96,d*.91,h*.038),(h*.963,w,d,h*.043)]):B('layered_mantel_cornice',(width,depth,hh),(0,0,z),surround)
            if arched:
                radius=fw*.51;spring=h*.45
                for i in range(13):
                    a=i*math.pi/13;b=(i+1)*math.pi/13;ri=radius;ro=radius+w*.085
                    verts=[(r*math.cos(t),y,spring+r*math.sin(t)) for y in [front,.02] for r,t in [(ri,a+.008),(ri,b-.008),(ro,b-.008),(ro,a+.008)]]
                    g.add('individual_arch_voussoir',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],stone)
            if victorian:
                for sign in [-1,1]:
                    for i in range(5):a=i*.55;g.leaf('cast_iron_acanthus',(sign*w*.41,front-.015,h*(.35+i*.08)),(sign*.55,0,1),w*.10,w*.065,gold,True)
                disc('cast_rosette',w*.055,.015,(0,front,h*.865),gold)
        # Recessed firebrick, individual staggered courses, exposed mortar.
        B('firebox_mortar_back',(fw,.035,fireHeight),(0,d*.31,fireBase+fireHeight/2),m['grout'])
        brick=iron if linear else material('firebrick-ochre',(.37,.23,.13),None,.99)
        for row in range(7):
            for col in range(7):
                bw=fw/7;x=-fw/2+(col+.5)*bw+(bw*.30 if row%2 else 0)
                if x+bw/2>fw/2:continue
                B('individual_refractory_brick',(bw-.006,.023,fireHeight/7-.006),(x,d*.28,fireBase+(row+.5)*fireHeight/7),brick,.003)
        if stove:
            for x in [-fw*.52,fw*.52]:B('raised_door_frame',(.024,.030,fireHeight*1.04),(x,front,fireBase+fireHeight/2),iron)
            for z in [fireBase,fireBase+fireHeight]:B('raised_door_frame',(fw*1.09,.030,.024),(0,front,z),iron)
            g.tube('brass_door_latch',[(fw*.57,front-.02,fireBase+fireHeight*.5),(fw*.57,front-.09,fireBase+fireHeight*.5)],.015,gold,8)
            for z in [fireBase+.05,fireBase+fireHeight-.05]:cyl('door_hinge',.014,.06,(-fw*.55,front,z),gold,12)
        # Bark-covered round logs, end-grain rings, grate and layered flame tongues.
        for i in range(5):
            x=(i-2)*fw*.13;a=Vector((x-fw*.12,-d*.20,fireBase+.065));b=Vector((x+fw*.12,d*.10,fireBase+.10));g.tube('charred_round_log',[a,a.lerp(b,.5),b],w*.025,m['bark'],10)
            for k in range(4):g.tube('split_log_bark_ridge',[a+Vector((.008*k,0,.013)),b+Vector((.008*k,0,.013))],.003,iron,4)
            for j in range(3):
                p=Vector((x+rng.uniform(-.025,.025),rng.uniform(-d*.16,d*.12),fireBase+.09));height=fireHeight*rng.uniform(.20,.48);verts=[]
                for ring in range(7):
                    t=ring/6;radius=w*.026*math.sin((t*.94+.06)*math.pi)*(1-t*.8);center=p+Vector((math.sin(t*6+i)*w*.025*t,.008*math.sin(t*4),height*t))
                    for seg in range(6):a=seg*math.tau/6;verts.append(center+Vector((radius*math.cos(a),radius*.5*math.sin(a),0)))
                g.add('sculpted_curving_flame',verts,[(ring*6+seg,ring*6+(seg+1)%6,(ring+1)*6+(seg+1)%6,(ring+1)*6+seg) for ring in range(6) for seg in range(6)],ember if j%2 else flame)
        for i in range(9):x=(i-4)*fw*.095;g.tube('fire_grate_bar',[(x,-d*.26,fireBase+.06),(x,d*.18,fireBase+.06)],.007,iron,6)
        for x in [-fw*.42,fw*.42]:g.tube('andirons',[(x,front+.025,fireBase),(x,front+.025,fireBase+.22)],.010,iron,7);disc('andiron_finial',.023,.02,(x,front+.02,fireBase+.22),gold)
        if linear:
            for z in [fireBase-.01,fireBase+fireHeight+.02]:B('linear_fire_trim',(fw*1.06,.018,.024),(0,front,z),iron,.004)
        g.finish();return w,d,h
    clocks=['mantel-clock','wall-clock','grandfather-clock','cuckoo-clock','pendulum-wall-clock']
    fires=['cottage-fireplace','wood-stove','linear-fireplace','stone-arch-fireplace','cast-iron-fireplace','tiled-corner-stove']
    return {**{id:(lambda m,id=id:botanical(id,m)) for id in VEGETATION},**{id:(lambda m,id=id:clock(id,m)) for id in clocks},**{id:(lambda m,id=id:fireplace(id,m)) for id in fires}}
