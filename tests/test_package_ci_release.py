"""End-to-end source archive tests; fake Git reads, no repository mutation."""
import hashlib
import io
import json
from pathlib import Path
import runpy
import tarfile
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1]/'scripts/package-ci-release.py'
COMMIT = 'a'*40


class SourceArchiveTests(unittest.TestCase):
    def fixture(self, directory, candidate='public/experiments/catalog-realism/models/willow.glb'):
        root=Path(directory)
        def write(name, value):
            file=root/name;file.parent.mkdir(parents=True,exist_ok=True)
            file.write_bytes(value if isinstance(value,bytes) else value.encode())
        hosting=json.dumps({'project_id':'unchanged-project','d1':'DB','r2':'LIBRARY'})
        production=b'glTF production asset'
        asset={'sha256':hashlib.sha256(production).hexdigest(),'size':len(production),'type':'model/gltf-binary'}
        manifest={'schema':1,'assets':{'/models/furniture/ordinary.glb':asset}}
        write('scripts/package-ci-release.py',SCRIPT.read_bytes())
        for name,content in {'client/index.html':'<html>same application</html>','server/index.js':'export default {};',
                             '.openai/hosting.json':hosting,'.openai/drizzle/0000_lush_inhumans.sql':'CREATE TABLE sample (id int);',
                             'client/models/furniture/ordinary.glb':production}.items():write('dist/'+name,content)
        write('.generated/library-manifest.json',json.dumps(manifest))
        write('docs/r2-baseline.json',json.dumps(manifest))
        committed={'.openai/hosting.json':hosting.encode(),'src/app.ts':b'export const unchanged = true;',
                   'public/models/furniture/ordinary.glb':production,
                   'public/experiments/catalog-realism-other/keep.html':b'<html>unrelated retained route</html>',
                   candidate:b'glTF'+bytes(10*1024*1024)}
        for name,content in committed.items():write(name,content)
        def git(args,**kwargs):
            if args==['git','rev-parse','--verify','HEAD']:return COMMIT+'\n'
            if args==['git','ls-files','-z']:return ('\0'.join(committed)+'\0').encode()
            if args[:2]==['git','show']:
                revision,name=args[2].split(':',1);self.assertEqual(revision,COMMIT);return committed[name]
            raise AssertionError('Unexpected Git command: '+str(args))
        def run():
            with patch('subprocess.check_output',side_effect=git),patch.dict('os.environ',{'GITHUB_SHA':COMMIT,'GITHUB_RUN_ID':'test-run'}),redirect_stdout(io.StringIO()):
                runpy.run_path(str(root/'scripts/package-ci-release.py'),run_name='__main__')
        return root,committed,run

    def test_large_catalog_candidates_are_external_hash_inputs_without_changing_production_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            root,committed,run=self.fixture(directory);run()
            candidate='public/experiments/catalog-realism/models/willow.glb'
            with tarfile.open(root/'release/sites-source.tar.gz') as archive:
                self.assertNotIn(candidate,archive.getnames())
                self.assertIn('public/experiments/catalog-realism-other/keep.html',archive.getnames())
                self.assertIn('src/app.ts',archive.getnames())
                provenance=json.load(archive.extractfile('SOURCE_PROVENANCE.json'))
                for name in (candidate,'public/models/furniture/ordinary.glb'):
                    self.assertEqual(provenance['external_inputs'][name],{'sha256':hashlib.sha256(committed[name]).hexdigest(),'size':len(committed[name])})
                self.assertEqual(provenance['github_commit'],COMMIT)
            with tarfile.open(root/'release/library-assets.tar.gz') as archive:
                self.assertEqual(archive.getnames(),['models/furniture/ordinary.glb'])
                self.assertEqual(archive.extractfile(archive.getnames()[0]).read(),committed['public/models/furniture/ordinary.glb'])
            receipt=json.loads((root/'release/release.json').read_text())
            self.assertEqual(receipt['archives']['sites-source.tar.gz']['sha256'],hashlib.sha256((root/'release/sites-source.tar.gz').read_bytes()).hexdigest())

    def test_changed_candidate_bytes_are_rejected_even_though_they_are_externalized(self):
        with tempfile.TemporaryDirectory() as directory:
            root,committed,run=self.fixture(directory)
            (root/'public/experiments/catalog-realism/models/willow.glb').write_bytes(b'changed candidate')
            with self.assertRaisesRegex(AssertionError,'Uncommitted release source: public/experiments/catalog-realism/'):
                run()

    def test_large_unrelated_experimental_source_remains_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root,committed,run=self.fixture(directory,candidate='public/experiments/catalog-realism-other/large.glb')
            with self.assertRaisesRegex(AssertionError,'Unexpected large source input: public/experiments/catalog-realism-other/'):
                run()


if __name__=='__main__':
    unittest.main()
