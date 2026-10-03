import runpy
import math
import struct
import tempfile
from pathlib import Path
import unittest

t = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'tools/blender/catalog_realism/tangents.py'))
g = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'tools/blender/catalog_realism/glb.py'))


def fixture(path, tangent=(1,0,0,-1), collapsed_uv=False):
    """Native-like interleaved FLOAT attributes and indexed mirrored UV1 chart."""
    normal = (.9992, 0, math.sqrt(1-.9992**2))
    points = [(0,0,0),(1,0,0),(0,1,0)]
    uv = [(0,0)]*3 if collapsed_uv else [(0,0),(-1,0),(0,1)]
    valid = (-normal[2],0,normal[0],-1)
    binary = bytearray(b'HEAD')
    for index in range(3):
        binary.extend(struct.pack('<14f',*points[index],*normal,0,0,*uv[index],*(tangent if index==0 else valid)))
    index_offset = len(binary); binary.extend(struct.pack('<3H',0,1,2))
    document = {'asset':{'version':'2.0'},'buffers':[{'byteLength':len(binary)}],
        'bufferViews':[{'buffer':0,'byteOffset':4,'byteLength':3*56,'byteStride':56,'target':34962},
                       {'buffer':0,'byteOffset':index_offset,'byteLength':6,'target':34963}],
        'accessors':[{'bufferView':0,'byteOffset':offset,'componentType':5126,'count':3,'type':kind}
                     for offset,kind in [(0,'VEC3'),(12,'VEC3'),(24,'VEC2'),(32,'VEC2'),(40,'VEC4')]] +
                    [{'bufferView':1,'componentType':5123,'count':3,'type':'SCALAR'}],
        'materials':[{'name':'seam','normalTexture':{'index':0,'texCoord':0,
            'extensions':{'KHR_texture_transform':{'texCoord':1}}}}],
        'meshes':[{'primitives':[{'attributes':{'POSITION':0,'NORMAL':1,'TEXCOORD_0':2,'TEXCOORD_1':3,'TANGENT':4},'indices':5,'material':0}]}]}
    g['write_glb'](path,document,binary)
    return normal, bytes(binary)


class TangentBasis(unittest.TestCase):
    def test_surface_basis_is_unit_orthogonal_and_oriented(self):
        _, basis = t['triangle_basis']([(0,0,0),(1,0,0),(0,1,0)], [(0,0),(1,0),(0,1)], (0,0,1))
        self.assertEqual(basis,[1,0,0,1])

    def test_mirrored_chart_keeps_handedness(self):
        _, basis = t['triangle_basis']([(0,0,0),(1,0,0),(0,1,0)], [(0,0),(-1,0),(0,1)], (0,0,1))
        self.assertEqual(basis,[-1,0,0,-1])

    def test_degenerate_geometry_or_uv_never_invents_a_basis(self):
        self.assertIsNone(t['triangle_basis']([(0,0,0),(0,0,0),(0,1,0)], [(0,0),(1,0),(0,1)], (0,0,1)))
        self.assertIsNone(t['triangle_basis']([(0,0,0),(1,0,0),(0,1,0)], [(0,0),(0,0),(0,0)], (0,0,1)))

    def test_binary_nonzero_parallel_tangent_repair_keeps_mirrored_handedness_and_other_bytes(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'seam.glb';normal,before=fixture(path)
            records=t['repair'](path,g)
            self.assertEqual(records[0]['vertices'],1)
            _,after=g['read_glb'](path)
            result=struct.unpack_from('<4f',after,44)
            self.assertAlmostEqual(math.sqrt(sum(v*v for v in result[:3])),1,places=6)
            self.assertAlmostEqual(sum(n*v for n,v in zip(normal,result)),0,places=6)
            self.assertEqual(result[3],-1)
            self.assertEqual(before[:44],after[:44]);self.assertEqual(before[60:],after[60:])
            self.assertEqual(t['repair'](path,g),[])

    def test_binary_nonunit_tangent_is_repaired_from_chart(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'nonunit.glb';fixture(path,tangent=(0,2,0,-1))
            self.assertEqual(t['repair'](path,g)[0]['vertices'],1)
            _,binary=g['read_glb'](path)
            result=struct.unpack_from('<4f',binary,44)
            self.assertAlmostEqual(math.sqrt(sum(v*v for v in result[:3])),1,places=6)
            self.assertEqual(result[3],-1)

    def test_parallel_tangent_with_all_uv_collapsed_fails_without_rewriting_glb(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'collapsed.glb';fixture(path,collapsed_uv=True)
            original=path.read_bytes()
            with self.assertRaisesRegex(ValueError,'nondegenerate tangent chart'):
                t['repair'](path,g)
            self.assertEqual(path.read_bytes(),original)


if __name__ == '__main__':
    unittest.main()
