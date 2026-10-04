"""Loveseat-only follow-up after the reviewed construction pass.

The first pilot's 8-sided/8-mm piping consumed the export cover budget, leaving
the covers at their 15% reduction floor. Six-sided/12-mm piping retains the
source nominal radius and frees triangles for the actual cover silhouette.
"""
import math
from pathlib import Path
import runpy

_base=runpy.run_path(str(Path(__file__).with_name('reviewed_living.py')))


def smooth_resample(points, spacing=.012):
    if len(points)<12 or not .008<=spacing<=.014:raise ValueError('Bounded existing sewn loop required')
    # Convex local averaging removes ray/nearest switches at source corners;
    # native authoring then projects every result back onto its own cover.
    smooth=[tuple((points[i-1][a]+2*p[a]+points[(i+1)%len(points)][a])/4 for a in range(3)) for i,p in enumerate(points)]
    lengths=[math.dist(a,b) for a,b in zip(smooth,smooth[1:]+smooth[:1])]
    total=sum(lengths)
    if min(lengths)<1e-9 or total<=0:raise ValueError('Sewn perimeter must be a noncollapsed cycle')
    count=math.ceil(total/spacing);result=[];edge=0;distance=0.
    for i in range(count):
        target=i*total/count
        while edge<len(smooth)-1 and distance+lengths[edge]<target:
            distance+=lengths[edge];edge+=1
        t=(target-distance)/lengths[edge];a,b=smooth[edge],smooth[(edge+1)%len(smooth)]
        result.append(tuple(a[k]+(b[k]-a[k])*t for k in range(3)))
    return result


def apply(scene,item,keys,names):
    if item['id']!='library-reading-loveseat':raise ValueError('Wrong reviewed sewn-loop source')
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    objects={names.get(o.name,o.name):o for o in scene.objects if o.type=='MESH'}
    records=[]
    for prefix in ('tailored back cushion','separate seat cushion'):
        for suffix in ('','.001'):
            name=prefix+' sewn welt'+suffix;obj=objects[name];pad=objects[prefix+suffix]
            if [keys[m.name] for m in obj.data.materials]!=['seam'] or len(obj.data.vertices)%8:
                raise ValueError('Expected the immediately preceding reviewed eight-sided piping')
            old_points=[obj.matrix_world@v.co for v in obj.data.vertices]
            centers=[tuple(sum(old_points[i:i+8],Vector())/8) for i in range(0,len(old_points),8)]
            if len(centers) not in (242,326):raise ValueError('First reviewed sewn-loop sample count changed')
            old_hash=_base['_geometry_hash'](obj);pad.data.calc_loop_triangles()
            points=[pad.matrix_world@v.co for v in pad.data.vertices]
            tree=BVHTree.FromPolygons(points,[tuple(t.vertices) for t in pad.data.loop_triangles],all_triangles=True)
            surface=[];normals=[];max_movement=0.;radius=.0024;offset=radius*.30
            for point in smooth_resample(centers):
                hit=tree.find_nearest(Vector(point))
                if hit[0] is None or hit[3]>.02:raise ValueError('Smoothed piping lost contact with its matching cover')
                normal=hit[1].normalized();surface.append(hit[0]);normals.append(normal)
                max_movement=max(max_movement,hit[3])
            # Smooth only the frame normal, then measure center offsets against
            # each exact cover face. Geometry remains seated, not merely bounded.
            frame_normals=[(normals[i-1]+2*n+normals[(i+1)%len(normals)]).normalized() for i,n in enumerate(normals)]
            new_centers=[tuple(p+n*offset) for p,n in zip(surface,normals)]
            geometry=_base['sewn_tube'](new_centers,[tuple(n) for n in frame_normals],radius,sides=6)
            box=_base['bounds'](points);allowed={'min':[v-.004 for v in box['min']],'max':[v+.004 for v in box['max']]}
            if not _base['_inside'](_base['bounds'](geometry[0]),allowed):raise ValueError('Sewn loop left its matching cover envelope')
            inverse=obj.matrix_world.inverted();old=obj.data
            obj.data=_base['_new_mesh'](obj.name,([tuple(inverse@Vector(p)) for p in geometry[0]],geometry[1]),list(old.materials))
            for face in obj.data.polygons:face.use_smooth=True
            records.append({'component':name,'cover':prefix+suffix,'beforeGeometrySha256':old_hash,'afterGeometrySha256':_base['_geometry_hash'](obj),
                            'oldSections':len(centers),'newSections':len(new_centers),'sectionSides':6,'nominalRadiusM':radius,
                            'centerSurfaceOffsetM':offset,'maximumNearestProjectionM':max_movement,
                            'maximumActualCenterSpacingM':max(math.dist(a,b) for a,b in zip(new_centers,new_centers[1:]+new_centers[:1]))})
    return [{'kind':'source-evidenced-contact','construction':'four continuous sewn loops smoothed and reseated with bounded source-radius geometry',
             'components':records,'reason':'First pilot spent too many triangles on piping and reduced cover surfaces to their minimum export budget.',
             'preserved':['all original cover geometry and UVs','source nominal 2.4mm piping radius','material keys and images','closed sewn loop topology','overall dimensions']}]
