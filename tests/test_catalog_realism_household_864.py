"""Measured source fixtures; native Blender builds remain a separate gate."""
from collections import Counter
from pathlib import Path
import json,math,runpy,unittest
ROOT=Path(__file__).resolve().parents[1]
HELPER=ROOT/'tools/blender/catalog_realism/refinements/household_864.py'
H=runpy.run_path(str(HELPER)) if HELPER.exists() else {}
FIXTURE=json.loads((ROOT/'tests/fixtures/catalog-realism-household-864.json').read_text())

class Household864Tests(unittest.TestCase):
    def closed(self,geometry):
        points,faces=geometry;edges=Counter();directions=Counter();volume=0
        for face in faces:
            self.assertEqual(len(set(face)),len(face))
            for a,b in zip(face,face[1:]+face[:1]):edges[tuple(sorted((a,b)))]+=1;directions[a,b]+=1
            for i in range(1,len(face)-1):
                a,b,c=(points[j] for j in (face[0],face[i],face[i+1]))
                cross=H['_d']['cross'](H['_d']['sub'](b,a),H['_d']['sub'](c,a))
                self.assertGreater(math.dist(cross,(0,0,0)),1e-13)
                volume+=H['_d']['dot'](a,H['_d']['cross'](b,c))/6
        self.assertEqual(set(edges.values()),{2})
        for a,b in edges:self.assertEqual(directions[a,b],directions[b,a])
        self.assertGreater(volume,0)

    def test_washer_rounds_measured_rings_and_seats_gaskets_without_changing_door_bounds(self):
        objects={o['name']:o for o in FIXTURE['washer']['objects']};rim=objects['washer_door_rim']['bounds']
        for name,obj in objects.items():
            geometry,detail=H['washer_geometry'](name,obj['vertices'],obj['bounds'],rim);self.closed(geometry)
            if name.startswith('Fine perimeter gasket'):
                self.assertGreater(len(geometry[0]),1000)
                for x,y,z in geometry[0]:
                    self.assertTrue(rim['min'][0]<=x<=rim['max'][0] and rim['min'][2]<=z<=rim['max'][2])
                box=H['bounds'](geometry[0]);self.assertLess(box['min'][1],rim['min'][1]);self.assertGreater(box['max'][1],rim['min'][1])
            else:
                self.assertEqual(detail['radialSegments'],96)
                for side in ('min','max'):
                    for a in range(3):self.assertAlmostEqual(H['bounds'](geometry[0])[side][a],obj['bounds'][side][a],places=9)
        with self.assertRaises(ValueError):H['washer_geometry']('washer_door_rim',objects['washer_door_rim']['vertices'][:-1],rim,rim)

    def test_reel_hoses_are_closed_smooth_twelve_sided_tubes_with_exact_connection_centers(self):
        model=FIXTURE['wall-hose-reel'];total=0
        for obj in model['objects']:
            geometry,detail=H['hose_geometry'](obj['vertices'],model['modelBounds'],obj['name']=='short stowed hose');self.closed(geometry)
            points,faces=geometry;self.assertEqual(len(points)%12,0);self.assertGreater(len(points),240)
            for center,ring in zip(detail['originalEndpointsM'],[points[:12],points[-12:]]):
                actual=tuple(sum(p[a]for p in ring)/12 for a in range(3));self.assertLess(math.dist(center,actual),1e-12)
            for point in points:
                for a in range(3):self.assertGreaterEqual(point[a],model['modelBounds']['min'][a]-1e-8);self.assertLessEqual(point[a],model['modelBounds']['max'][a]+1e-8)
            if obj['name']=='short stowed hose':self.assertAlmostEqual(H['bounds'](points)['min'][1],model['modelBounds']['min'][1],places=10)
            path=[tuple(sum(p[a]for p in points[i:i+12])/12 for a in range(3))for i in range(0,len(points),12)]
            tangents=[H['_d']['unit'](H['_d']['sub'](b,a))for a,b in zip(path,path[1:])]
            self.assertLess(max(math.acos(max(-1,min(1,H['_d']['dot'](a,b))))for a,b in zip(tangents,tangents[1:])),.24)
            curve_radii=[]
            for a,b,c in zip(path,path[1:],path[2:]):
                cross=H['_d']['cross'](H['_d']['sub'](b,a),H['_d']['sub'](c,a));area2=math.dist(cross,(0,0,0))
                if area2>1e-12:curve_radii.append(math.dist(a,b)*math.dist(b,c)*math.dist(c,a)/(2*area2))
            self.assertGreater(min(curve_radii),detail['tubeRadiusM']*1.02)
            total+=sum(len(f)-2 for f in faces)
        self.assertLess(total,5000)
        with self.assertRaises(ValueError):H['hose_geometry'](model['objects'][0]['vertices'][:-1],model['modelBounds'],True)

    def test_stove_matches_the_accepted_five_log_topology_and_rejects_extra_geometry(self):
        obj=next(o for o in FIXTURE['wood-stove']['objects'] if o['name']=='charred_round_log')
        parts=H['validate_logs'](obj['vertices'],obj['faces'])
        self.assertEqual(len(parts),5);self.assertEqual([len(p)for p in parts],[30]*5)
        with self.assertRaises(ValueError):H['validate_logs'](obj['vertices']+[(0,0,0)],obj['faces'])

    def test_entries_bind_only_the_nine_reviewed_components_and_frozen_dependencies(self):
        directory=HELPER.parent
        for ident,count in [('washer',5),('wood-stove',2),('wall-hose-reel',2)]:
            entry=runpy.run_path(str(directory/(ident+'.py')));evidence=entry['EVIDENCE']
            self.assertEqual(evidence['sourceBlend'],FIXTURE[ident]['sourceBlend']);self.assertEqual(len(evidence['objects']),count)
            self.assertEqual([o['name']for o in evidence['objects']],[o['name']for o in FIXTURE[ident]['objects']])
            dependencies=json.loads((directory/(ident+'.json')).read_text())['dependencies']
            self.assertIn('household_864.py',dependencies);self.assertIn('household_756.py',dependencies)
            self.assertTrue(all((directory/name).is_file()for name in dependencies))

if __name__=='__main__':unittest.main()
