"""Silhouette, continuous textile and seam topology checks for five reviewed IDs."""
from collections import Counter
from pathlib import Path
import math
import json
import runpy
import unittest

ROOT=Path(__file__).resolve().parents[1]
HELPER=ROOT/'tools/blender/catalog_realism/refinements/textile_turning.py'


class TextileTurningTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.h=runpy.run_path(str(HELPER))

    def closed(self,mesh):
        vertices,faces=mesh;edges=Counter();directions=Counter();volume=0
        for f in faces:
            self.assertEqual(len(f),len(set(f)))
            for a,b in zip(f,f[1:]+f[:1]):edges[tuple(sorted((a,b)))]+=1;directions[(a,b)]+=1
            a=vertices[f[0]]
            for i in range(1,len(f)-1):
                b,c=vertices[f[i]],vertices[f[i+1]]
                volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6
        self.assertEqual(set(edges.values()),{2})
        for a,b in edges:self.assertEqual(directions[(a,b)],directions[(b,a)])
        self.assertGreater(volume,0)

    def test_flames_have_pointed_closed_asymmetric_silhouettes_and_exact_bounds(self):
        box={'min':[-.0068,-.012,.12499],'max':[.0068,.012,.14875]}
        for i in range(3):
            mesh=self.h['flame'](box,i);self.closed(mesh)
            self.assertEqual(self.h['bounds'](mesh[0]),box)
            tips=[v for v in mesh[0] if abs(v[2]-box['max'][2])<1e-10]
            self.assertEqual(len(tips),1)
            self.assertGreater(abs(tips[0][0]),.0003)
            self.assertLess(len(mesh[0]),600)

    def test_radial_profiles_preserve_measured_stations_and_increase_roundness(self):
        box={'min':[-1.1,-.55,.71],'max':[1.1,.55,.76]}
        profile=[(0,0),(.97,0),(1,.1),(1,.9),(.97,1),(0,1)]
        original=self.h['lathe'](profile,box,32)
        recovered=self.h['recover_profile'](original[0],box)
        mesh=self.h['lathe'](recovered,box,128);self.closed(mesh)
        self.assertEqual(self.h['bounds'](mesh[0]),box)
        self.assertGreater(len(mesh[0]),len(original[0])*3)
        modified=list(original[0]);modified[5]=(modified[5][0]*.9,modified[5][1],modified[5][2])
        with self.assertRaises(ValueError):self.h['recover_profile'](modified,box)

    def test_ring_topology_is_recovered_without_assuming_vertex_order(self):
        points=[];edges=[]
        for i in range(24):
            a=i*math.tau/24
            for j in range(8):
                t=j*math.tau/8;points.append(((.2+.002*math.cos(t))*math.cos(a),(.2+.002*math.cos(t))*math.sin(a),.4+.002*math.sin(t)))
                edges += [(i*8+j,i*8+(j+1)%8),(i*8+j,((i+1)%24)*8+j)]
        permutation=list(reversed(range(len(points))));lookup={old:new for new,old in enumerate(permutation)}
        centers,radius=self.h['welt_centerline']([points[i] for i in permutation],[(lookup[a],lookup[b]) for a,b in edges])
        self.assertEqual(len(centers),24);self.assertAlmostEqual(radius,.002)
        sampled=self.h['resample_closed'](centers,.008)
        self.assertTrue(all(math.dist(a,b)<=.008001 for a,b in zip(sampled,sampled[1:]+sampled[:1])))
        with self.assertRaises(ValueError):self.h['welt_centerline'](points,edges[:-1])

    def test_checker_panels_meet_with_identical_boundary_heights(self):
        tiles=[]
        for row in range(4):
            for col in range(4):
                mesh=self.h['checker_panel'](row,col);self.closed(mesh);tiles.append(mesh)
                self.assertLess(len(mesh[0]),800)
        for row in range(4):
            for col in range(3):
                x=-.75+(col+1)*.375
                a={tuple(round(v,9) for v in p) for p in tiles[row*4+col][0] if abs(p[0]-x)<1e-9}
                b={tuple(round(v,9) for v in p) for p in tiles[row*4+col+1][0] if abs(p[0]-x)<1e-9}
                self.assertEqual(a,b)
                for p in a:
                    if p[2]>.03:
                        height,normal=self.h['checker_surface'](p[0],p[1])
                        self.assertAlmostEqual(height,p[2],places=8)
                        self.assertAlmostEqual(sum(v*v for v in normal),1)
        self.assertAlmostEqual(max(p[2] for m in tiles for p in m[0]),.04)

    def test_fringe_is_seven_shaped_yarns_with_original_outer_extent(self):
        box={'min':[-.0165,.73875,.007],'max':[.0165,.82125,.025]}
        mesh=self.h['yarn_fringe'](box);self.closed(mesh)
        self.assertEqual(self.h['bounds'](mesh[0]),box)
        self.assertLess(len(mesh[0]),1000)
        # Seven disconnected closed strands, rather than one rectangular slab.
        groups=self.h['components'](len(mesh[0]),[(a,b) for f in mesh[1] for a,b in zip(f,f[1:]+f[:1])])
        self.assertEqual(len(groups),7)

    def test_exact_sources_and_rug_cost_remain_bounded(self):
        inventory=json.loads((ROOT/'assets-source/catalog-realism/source-inventory.json').read_text())['models']
        manifest=json.loads((ROOT/'assets-source/catalog-realism/catalog.json').read_text())
        for ident in ['candle-trio','cantilever-dining-chair','cantilever-lounge-chair','ceramic-oval-dining-table','checker-rug']:
            entry=HELPER.with_name(ident+'.py')
            if not entry.exists():entry=ROOT/'.generated/catalog-realism/textile-entrypoints'/(ident+'.py')
            module=runpy.run_path(str(entry));self.assertEqual(module['CATALOG_ID'],ident)
            self.assertEqual(json.loads(entry.with_suffix('.json').read_text()),{'version':1,'dependencies':['textile_turning.py','curved_construction.py']})
            originals={r['name']:r for r in inventory[ident]['objects']}
            for spec in module['SOURCE_COMPONENTS']:
                actual=originals[spec['name']]
                self.h['_curves']['validate_source'](actual['name'],actual['vertices'],actual['materials'],actual['bounds'],spec)
            if ident=='checker-rug':
                cost=0
                for spec in module['SOURCE_COMPONENTS']:
                    if spec['kind']=='patch':
                        i=spec['patternIndex'];mesh=self.h['checker_panel'](i//4,i%4)
                    elif spec['kind']=='fringe':mesh=self.h['yarn_fringe'](spec['bounds'])
                    else:continue
                    cost+=sum(len(f)-2 for f in mesh[1])
                baseline=next(r for r in manifest['items'] if r['id']==ident)['baselineCost']['triangles']
                self.assertLess(cost+1000,baseline+20000,'Keep room for the existing backing and export bevels')


if __name__=='__main__':unittest.main()
