"""Export-only metric UV repairs, tested without importing native Blender."""
from pathlib import Path
import runpy
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
MATERIALS = runpy.run_path(str(ROOT/'tools/blender/catalog_realism/materials.py'))


class Material(dict):
    @property
    def original(self):
        return self


class Layers(list):
    def __init__(self, mesh):
        super().__init__()
        self.mesh = mesh

    def new(self, name):
        value = SimpleNamespace(name=name, data=[SimpleNamespace(uv=None) for _ in range(self.mesh.loop_count)])
        self.append(value)
        return value


class Mesh:
    def __init__(self, name):
        self.name, self.materials, self.polygons = name, [], []
        self.uv_layers = Layers(self)
        self.normals = None

    def from_pydata(self, vertices, edges, faces):
        self.vertices = [SimpleNamespace(co=point) for point in vertices]
        self.loop_count = 0
        for face in faces:
            self.polygons.append(SimpleNamespace(loop_indices=list(range(self.loop_count, self.loop_count+len(face)))))
            self.loop_count += len(face)

    def normals_split_custom_set(self, normals):
        self.normals = normals

    def update(self):
        pass


class ExportUvTests(unittest.TestCase):
    def setUp(self):
        bpy = SimpleNamespace(data=SimpleNamespace(meshes=SimpleNamespace(new=Mesh)))
        with patch.dict(sys.modules, {'bpy': bpy, 'mathutils': SimpleNamespace(Matrix=object)}):
            self.build = runpy.run_path(str(ROOT/'tools/blender/catalog_realism/build.py'))

    def repair(self, points, coordinates, scale=(1,1,1), profile='fabric', longest_axis=2, density=1):
        return self.build['repair_metric_triangle_uv'](points, coordinates, scale, profile,
            longest_axis, MATERIALS['project_metres'], density)

    def test_narrow_bevel_retains_its_real_2_point_4_mm_depth(self):
        points=[(0,0,0),(0,.01,0),(0,.01,.0024)]
        values=self.repair(points,[(0,0),(.01,0),(.01,0)])
        self.assertEqual(values,[(0,0),(.01,0),(.01,.0024)])

    def test_nonuniform_object_scale_is_applied_in_part_local_metres(self):
        points=[(0,0,0),(0,.01,0),(0,.01,.0024)]
        values=self.repair(points,[(0,0)]*3,scale=(2,3,.5))
        self.assertEqual(values,[(0,0),(.03,0),(.03,.0012)])

    def test_wood_uses_the_original_longest_part_axis_for_grain(self):
        points=[(0,0,0),(.5,0,0),(.5,.2,0)]
        self.assertEqual(self.repair(points,[(0,0)]*3,profile='wood',longest_axis=0),
                         [(0,0),(0,.5),(.2,.5)])

    def test_tagged_paper_density_is_retained_on_repaired_faces(self):
        points=[(0,0,0),(0,.01,0),(0,.01,.0024)]
        values=self.repair(points,[(0,0)]*3,profile='paper',density=12)
        self.assertEqual(values,[(0,0),(.12,0),(.12,.0024*12)])

    def test_healthy_even_very_narrow_uv_chart_is_never_reprojected(self):
        points=[(0,0,0),(0,.01,0),(0,.01,.0024)]
        self.assertIsNone(self.repair(points,[(7,8),(7.01,8),(7.01,8.00000001)]))

    def test_degenerate_geometry_does_not_invent_uvs(self):
        with self.assertRaisesRegex(ValueError,'Collapsed geometry'):
            self.repair([(0,0,0),(0,0,0),(0,1,0)],[(0,0)]*3)

    def source(self, profiled=True):
        material=Material(material_key='seam')
        if profiled:
            material['catalog_realism_profile']='fabric'
        points=[(0,0,0),(0,.01,0),(0,.01,.0024),(0,0,0),(0,.02,0),(0,.02,.003)]
        uv0=[(4,5),(4,5),(4,5),(11,12),(13,14),(15,16)]
        metric=[(0,0),(.01,0),(.01,0),(20,20),(21,20),(21,21)]
        layers=[SimpleNamespace(name=name,data=[SimpleNamespace(uv=value) for value in values])
                for name,values in [('UVMap',uv0),('RealismUV',metric),('OriginalOther',uv0)]]
        triangles=[SimpleNamespace(index=index,vertices=tuple(range(index*3,index*3+3)),
                    loops=tuple(range(index*3,index*3+3)),material_index=1,polygon_index=index) for index in range(2)]
        source=SimpleNamespace(vertices=[SimpleNamespace(co=point) for point in points],materials=[None,material],
            polygons=[SimpleNamespace(use_smooth=True),SimpleNamespace(use_smooth=False)],uv_layers=layers,
            has_custom_normals=True,corner_normals=[SimpleNamespace(vector=(1,0,0)) for _ in range(6)],attributes={})
        return source,triangles,uv0,metric

    def test_subset_only_repairs_bad_metric_triangle_preserving_uv0_normals_and_unused_slots(self):
        source,triangles,uv0,metric=self.source(); repairs=[]
        mesh=self.build['subset_mesh'](source,triangles,'fixture',material_helpers=MATERIALS,uv_repairs=repairs)
        layers={layer.name:[entry.uv for entry in layer.data] for layer in mesh.uv_layers}
        self.assertEqual(layers['UVMap'],uv0)
        self.assertEqual(layers['OriginalOther'],uv0)
        self.assertEqual(layers['RealismUV'][3:],metric[3:])
        self.assertEqual(layers['RealismUV'][:3],[(0,0),(.01,0),(.01,.0024)])
        self.assertEqual([entry.uv for entry in source.uv_layers[1].data],metric)
        self.assertEqual(mesh.normals,[(1,0,0)]*6)
        self.assertEqual([face.material_index for face in mesh.polygons],[0,0])
        self.assertEqual([face.use_smooth for face in mesh.polygons],[True,False])
        self.assertEqual(repairs,[{'triangle':0,'materialKey':'seam'}])

    def test_unused_realism_channel_on_unprofiled_material_is_preserved(self):
        source,triangles,_,metric=self.source(profiled=False);repairs=[]
        mesh=self.build['subset_mesh'](source,triangles,'fixture',material_helpers=MATERIALS,uv_repairs=repairs)
        self.assertEqual([entry.uv for entry in mesh.uv_layers[1].data],metric)
        self.assertEqual(repairs,[])


if __name__ == '__main__':
    unittest.main()
