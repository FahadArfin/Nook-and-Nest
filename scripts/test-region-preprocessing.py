"""Synthetic geometry regression checks; no paid API access."""
import importlib.util,unittest
from pathlib import Path
import numpy as np
spec=importlib.util.spec_from_file_location('regions',Path(__file__).with_name('prepare-region-experiment.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class RegionTests(unittest.TestCase):
    def plan(self):
        p=np.full((400,500,3),255,np.uint8)
        p[40:48,40:460]=0;p[350:358,40:460]=0;p[40:358,40:48]=0;p[40:358,452:460]=0
        return p
    def test_two_rooms_with_doorway_are_candidates(self):
        p=self.plan();p[40:190,245:253]=0;p[215:358,245:253]=0
        regions,_,_=module.regions_from_pixels(p)
        self.assertEqual(len(regions),2)
        self.assertTrue(all(40<r['x']<460 and r['area']>20000 for r in regions))
    def test_exterior_and_blank_are_excluded(self):
        regions,_,_=module.regions_from_pixels(np.full((400,500,3),255,np.uint8));self.assertEqual(regions,[])
        regions,_,_=module.regions_from_pixels(self.plan());self.assertEqual(len(regions),1)
    def test_thin_grid_does_not_create_rooms(self):
        p=self.plan()
        for x in range(60,450,20):p[60:340,x]=0
        for y in range(60,340,20):p[y,60:450]=0
        regions,_,_=module.regions_from_pixels(p);self.assertEqual(len(regions),1)
    def test_anchors_stay_inside_nonrectangular_region(self):
        p=self.plan();p[40:220,40:220]=0
        regions,labels,_=module.regions_from_pixels(p);self.assertEqual(len(regions),1)
        r=regions[0];x,y=r['anchor'];self.assertEqual(labels[y,x],r['label']);self.assertGreater(len(r['polygon']),4)

if __name__=='__main__':unittest.main()
