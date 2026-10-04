"""Beta source handoff tests; no Git repository is modified."""
import hashlib
import io
import json
from pathlib import Path
import runpy
import tarfile
import tempfile
import unittest
from unittest.mock import patch

SCRIPT=Path(__file__).resolve().parents[1]/'scripts/catalog-realism-source.py'
API=runpy.run_path(str(SCRIPT)) if SCRIPT.exists() else {}
COMMIT='a'*40
PROJECT='appgprj_6aa3491b56808191b9322b08eb92e7ef'

class BetaSourceTests(unittest.TestCase):
    def archive(self,directory):
        target=Path(directory)/'feature.tar.gz'
        files={'src/app.ts':b'export const app=true;', '.openai/hosting.json':b'{"project_id":"production"}',
               'SOURCE_PROVENANCE.json':json.dumps({'github_commit':COMMIT,'scope':'beta-only','external_inputs':{'public/experiments/catalog-realism/models/x.glb':{'sha256':'b'*64,'size':100}}}).encode()}
        with tarfile.open(target,'w:gz') as archive:
            for name,value in files.items():
                info=tarfile.TarInfo(name);info.size=len(value);archive.addfile(info,io.BytesIO(value))
        return target,hashlib.sha256(target.read_bytes()).hexdigest()

    def test_mode_bound_source_snapshots_preserve_source_and_external_hashes(self):
        with tempfile.TemporaryDirectory() as temp:
            source,digest=self.archive(temp)
            for mode in ['staging','final']:
                target=Path(temp)/(mode+'.tar.gz')
                context={'version':1,'scope':'beta-only','mode':mode,'project_id':PROJECT,'commit_sha':COMMIT,'archive':{'sha256':'c'*64}}
                API['package_release_source'](source,digest,context,{'project_id':PROJECT,'d1':'DB','r2':'LIBRARY'},target)
                with tarfile.open(target) as archive:
                    self.assertEqual(archive.extractfile('src/app.ts').read(),b'export const app=true;')
                    self.assertEqual(json.load(archive.extractfile('BETA_RELEASE_PROVENANCE.json')),context)
                    self.assertEqual(json.load(archive.extractfile('.openai/hosting.json'))['project_id'],PROJECT)
                    self.assertEqual(json.load(archive.extractfile('SOURCE_PROVENANCE.json'))['external_inputs']['public/experiments/catalog-realism/models/x.glb']['sha256'],'b'*64)
            self.assertNotEqual((Path(temp)/'staging.tar.gz').read_bytes(),(Path(temp)/'final.tar.gz').read_bytes())

    def test_source_archive_rejects_wrong_hash_identity_and_unsafe_members(self):
        with tempfile.TemporaryDirectory() as temp:
            source,digest=self.archive(temp)
            context={'version':1,'scope':'beta-only','mode':'final','project_id':PROJECT,'commit_sha':COMMIT,'archive':{'sha256':'c'*64}}
            hosting={'project_id':PROJECT,'d1':'DB','r2':'LIBRARY'}
            with self.assertRaisesRegex(AssertionError,'hash'):
                API['package_release_source'](source,'0'*64,context,hosting,Path(temp)/'bad.tar.gz')
            with self.assertRaisesRegex(AssertionError,'commit'):
                API['package_release_source'](source,digest,{**context,'commit_sha':'d'*40},hosting,Path(temp)/'bad.tar.gz')
            with self.assertRaisesRegex(AssertionError,'Beta'):
                API['package_release_source'](source,digest,context,{**hosting,'project_id':'production'},Path(temp)/'bad.tar.gz')
            unsafe=Path(temp)/'unsafe.tar.gz'
            with tarfile.open(unsafe,'w:gz') as archive:
                info=tarfile.TarInfo('../escape');info.size=1;archive.addfile(info,io.BytesIO(b'x'))
            with self.assertRaisesRegex(AssertionError,'Unsafe'):
                API['archive_members'](unsafe)

    def test_feature_archive_reads_exact_commit_blobs_and_externalizes_candidates(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);files={'src/app.ts':b'exact source\n','public/experiments/catalog-realism/models/a.glb':b'glTF'}
            for name,data in files.items():
                (root/name).parent.mkdir(parents=True,exist_ok=True);(root/name).write_bytes(data)
            tree=b'';batch=b''
            for index,(name,data) in enumerate(files.items()):
                blob=(str(index+1)*40).encode();tree+=b'100644 blob '+blob+b'\t'+name.encode()+b'\0';batch+=blob+b' blob '+str(len(data)).encode()+b'\n'+data+b'\n'
            def git(root,*args,**kwargs):
                if args==('rev-parse','HEAD'):return COMMIT.encode()+b'\n'
                if args==('status','--porcelain'):return b''
                if args==('ls-tree','-rz',COMMIT):return tree
                raise AssertionError(args)
            class Process:
                def __init__(self,*args,**kwargs):self.stdin=io.BytesIO();self.stdout=io.BytesIO(batch)
                def wait(self):return 0
            with patch.dict(API['package_feature_source'].__globals__,{'git':git}),patch('subprocess.Popen',Process):
                target=root/'feature.tar.gz';record=API['package_feature_source'](root,COMMIT,target)
                self.assertEqual(record['sha256'],hashlib.sha256(target.read_bytes()).hexdigest())
                members=API['archive_members'](target)
                self.assertEqual(members['src/app.ts'],files['src/app.ts'])
                self.assertNotIn('public/experiments/catalog-realism/models/a.glb',members)
                self.assertEqual(json.loads(members['SOURCE_PROVENANCE.json'])['external_inputs']['public/experiments/catalog-realism/models/a.glb']['sha256'],hashlib.sha256(b'glTF').hexdigest())
                (root/'src/app.ts').write_bytes(b'changed source')
                with self.assertRaisesRegex(AssertionError,'Uncommitted release source'):
                    API['package_feature_source'](root,COMMIT,root/'changed.tar.gz')

    def test_forward_snapshot_binds_parent_mode_and_exact_artifact_without_checkout(self):
        with tempfile.TemporaryDirectory() as temp:
            directory=Path(temp);source,digest=self.archive(temp);artifact=b'exact deployment bytes'
            (directory/'sites-catalog-realism-beta.tar.gz').write_bytes(artifact)
            context={'version':1,'scope':'beta-only','mode':'staging','project_id':PROJECT,'commit_sha':COMMIT,'archive':{'sha256':hashlib.sha256(artifact).hexdigest()}}
            record=API['package_release_source'](source,digest,context,{'project_id':PROJECT,'d1':'DB','r2':'LIBRARY'},directory/'sites-source.tar.gz')
            (directory/'release.json').write_text(json.dumps({**context,'archives':{'sites-source.tar.gz':record,'sites-catalog-realism-beta.tar.gz':context['archive']}}))
            parent='b'*40;new_commit='d'*40;calls=[]
            def git(root,*args,**kwargs):
                calls.append(args)
                if args==('cat-file','-t',parent):return b'commit\n'
                if args==('show',parent+':.openai/hosting.json'):return json.dumps({'project_id':PROJECT}).encode()
                if args[0]=='hash-object':return b'c'*40+b'\n'
                if args[0]=='write-tree':return b'e'*40+b'\n'
                if args[0]=='commit-tree':return new_commit.encode()+b'\n'
                if args[0] in ('read-tree','update-index','update-ref'):return b''
                raise AssertionError(args)
            with patch.dict(API['prepare_snapshot'].__globals__,{'git':git}):
                result=API['prepare_snapshot'](directory,parent,directory/'snapshot.json',directory)
            commit_call=next(call for call in calls if call[0]=='commit-tree')
            self.assertEqual(commit_call[2:4],('-p',parent));self.assertEqual(result['mode'],'staging')
            self.assertEqual(result['commit_sha'],new_commit);self.assertEqual(result['github_commit'],COMMIT)
            self.assertFalse(any(call[0] in ('checkout','switch','reset','clean','push') for call in calls))
            (directory/'sites-catalog-realism-beta.tar.gz').write_bytes(b'changed')
            with self.assertRaisesRegex(AssertionError,'artifact hash'):
                API['verify_release_source'](directory)

if __name__=='__main__':unittest.main()
