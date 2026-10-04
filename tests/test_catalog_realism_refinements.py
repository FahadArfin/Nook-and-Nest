"""Independent model corrections cannot silently reuse old approval evidence."""
import json
from pathlib import Path
import runpy
import tempfile
import unittest

M = runpy.run_path(str(Path(__file__).resolve().parents[1]/'tools/blender/catalog_realism/refinements.py'))


class ModelRefinementTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.directory = self.root/M['DIRECTORY']
        self.directory.mkdir(parents=True)

    def put(self, name, value):
        (self.directory/name).write_text(value, encoding='utf-8')

    def test_absence_addition_removal_and_unrelated_recipe(self):
        self.assertTrue(M['current'](self.root,'chair',{}))
        self.put('table.py','# unrelated')
        self.assertTrue(M['current'](self.root,'chair',{}))
        self.put('chair.py','# corrected chair')
        self.assertFalse(M['current'](self.root,'chair',{}))
        bound=M['inputs'](self.root,'chair')
        self.assertTrue(M['current'](self.root,'chair',{'modelRefinementInputs':bound}))
        (self.directory/'chair.py').unlink()
        self.assertFalse(M['current'](self.root,'chair',{'modelRefinementInputs':bound}))

    def test_declared_shared_dependency_changes_only_consumers(self):
        self.put('chair.py','# chair')
        self.put('table.py','# table')
        self.put('chair.json',json.dumps({'version':1,'dependencies':['turned.py']}))
        self.put('turned.py','# first shared helper')
        chair=M['inputs'](self.root,'chair');table=M['inputs'](self.root,'table')
        self.put('turned.py','# changed shared helper')
        self.assertFalse(M['current'](self.root,'chair',{'modelRefinementInputs':chair}))
        self.assertTrue(M['current'](self.root,'table',{'modelRefinementInputs':table}))

    def test_invalid_dependencies_fail_before_execution(self):
        self.put('chair.py','# chair')
        for deps in [['../escape.py'],['chair.py'],['same.py','same.py'],['missing.py']]:
            self.put('chair.json',json.dumps({'version':1,'dependencies':deps}))
            with self.assertRaises((ValueError,FileNotFoundError)):
                M['inputs'](self.root,'chair')

    def test_changed_executable_cannot_use_old_binding(self):
        self.put('chair.py','def apply(*args):\n    return [{"kind":"source-correction"}]\n')
        bound=M['inputs'](self.root,'chair')
        self.assertEqual(M['apply'](self.root,None,{'id':'chair'},{},{},bound),[{'kind':'source-correction'}])
        self.put('chair.py','raise AssertionError("must not execute stale source")\n')
        with self.assertRaisesRegex(ValueError,'changed before authoring'):
            M['apply'](self.root,None,{'id':'chair'},{},{},bound)


if __name__=='__main__':
    unittest.main()
