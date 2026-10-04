"""Production staging preserves the pinned app and binds every upload byte."""
import hashlib,io,json,runpy,tarfile,tempfile,unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT=Path(__file__).resolve().parents[1]/'scripts/catalog_production_staging.py'
def sha(data):return hashlib.sha256(data).hexdigest()
def encoded(value):return (json.dumps(value,indent=2)+'\n').encode()

class ProductionStagingTests(unittest.TestCase):
 def module(self):return runpy.run_path(str(SCRIPT))
 def fixture(self,directory):
  root=Path(directory);base=root/'assets-source/catalog-realism/promotion-baseline';base.mkdir(parents=True)
  project='appgprj_6a96455b69c08191bac4a9aa7cdd7e43';commit='e337a9292c79f0951facde01b6d9b5b340f2d984'
  files={'client/index.html':b'old public app','server/index.js':b'export default {fetch(){return new Response("old")}};', '.openai/hosting.json':encoded({'project_id':project,'d1':'DB','r2':'LIBRARY'}),'.openai/drizzle/0000_lush_inhumans.sql':b'original migration'}
  with tarfile.open(base/'sites-release.tar.gz','w:gz') as tar:
   for name,data in files.items():
    info=tarfile.TarInfo('dist/'+name);info.size=len(data);tar.addfile(info,io.BytesIO(data))
  asset={'sha256':sha(b'old asset'),'size':9,'type':'model/gltf-binary'};manifest={'schema':1,'assets':{'/models/furniture/old.glb':asset}}
  release={'commit_sha':commit,'project_id':project,'archives':{'sites-release.tar.gz':{'sha256':sha((base/'sites-release.tar.gz').read_bytes()),'expanded_bytes':sum(map(len,files.values())),'file_count':len(files)}}}
  (base/'release.json').write_bytes(encoded(release));(base/'library-manifest.json').write_bytes(encoded(manifest))
  proof={'manifest_sha256':sha((base/'library-manifest.json').read_bytes()),'completed':1,'bytes':9,'origin':'https://nook-and-nest.fwad101.chatgpt.site','verified_at':'2026-10-03T07:24:23.896Z'}
  (base/'r2-public-verification.json').write_bytes(encoded(proof))
  meta={'schema':1,'project_id':project,'version':128,'commit_sha':commit,'origin':proof['origin'],'hosting_source':'086f6d58eed84bc29ff5862ff2c14cde7ece9260','files':{n:{'sha256':sha((base/n).read_bytes()),'size':(base/n).stat().st_size} for n in ['sites-release.tar.gz','release.json','library-manifest.json','r2-public-verification.json']}}
  (base/'baseline.json').write_bytes(encoded(meta));return root,base,files,meta
 def test_baseline_archive_and_all_pinned_inputs_are_verified(self):
  with tempfile.TemporaryDirectory() as d:
   root,base,files,meta=self.fixture(d);m=self.module();actual=m['load_baseline'](root)
   self.assertEqual(actual['files'],files)
   (base/'library-manifest.json').write_bytes(b'changed')
   with self.assertRaisesRegex(AssertionError,'baseline input'):m['load_baseline'](root)
 def test_unsafe_duplicate_or_link_members_are_rejected(self):
  m=self.module()
  for name,link in [('dist/../escape',False),('dist/client/x',True)]:
   data=io.BytesIO()
   with tarfile.open(fileobj=data,mode='w:gz') as tar:
    info=tarfile.TarInfo(name)
    if link:info.type=tarfile.SYMTYPE;info.linkname='outside'
    else:info.size=1
    tar.addfile(info,io.BytesIO(b'x') if not link else None)
   with self.assertRaisesRegex(AssertionError,'Unsafe'):m['read_dist_archive'](data.getvalue())
  data=io.BytesIO()
  with tarfile.open(fileobj=data,mode='w:gz') as tar:
   for _ in range(2):
    info=tarfile.TarInfo('dist/client/x');info.size=1;tar.addfile(info,io.BytesIO(b'x'))
  with self.assertRaisesRegex(AssertionError,'Duplicate'):m['read_dist_archive'](data.getvalue())
 def test_every_final_asset_gets_a_prefix_without_changing_canonical_routes(self):
  m=self.module();manifest={'schema':1,'assets':{'/models/furniture/test.glb':{'sha256':'a'*64,'size':2,'type':'model/gltf-binary'},'/textures/new.jpg':{'sha256':'b'*64,'size':3,'type':'image/jpeg'}}}
  original=json.loads(json.dumps(manifest));upload=m['alias_manifest'](manifest,'c'*40)
  self.assertEqual(manifest,original);self.assertEqual(len(upload['assets']),2)
  self.assertIn('/experiments/catalog-realism/'+'c'*40+'/textures/new.jpg',upload['assets'])
  bad={'schema':1,'assets':{'/../escape':manifest['assets']['/textures/new.jpg']}}
  with self.assertRaisesRegex(AssertionError,'asset path'):m['alias_manifest'](bad,'c'*40)
 def test_asset_size_and_bound_bytes_fail_closed(self):
  m=self.module()
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);p=root/'textures';p.mkdir();(p/'x.jpg').write_bytes(b'abc')
   record={'sha256':sha(b'abc'),'size':3,'type':'image/jpeg'}
   self.assertEqual(m['read_asset'](root,'/textures/x.jpg',record),b'abc')
   (p/'x.jpg').write_bytes(b'abd')
   with self.assertRaisesRegex(AssertionError,'hash'):m['read_asset'](root,'/textures/x.jpg',record)
   with self.assertRaisesRegex(AssertionError,'32 MiB'):m['validate_manifest']({'schema':1,'assets':{'/textures/x.jpg':{**record,'size':32*1024*1024+1}}})
 def production_fixture(self,directory):
  root,base,old,meta=self.fixture(directory)
  def save(name,data):
   file=root/name;file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(data);return file
  candidate=b'new reviewed model';auxiliary=b'future shared texture'
  assets={name:{'sha256':sha(data),'size':len(data),'type':mime} for name,data,mime in [('/models/furniture/new.glb',candidate,'model/gltf-binary'),('/textures/future.jpg',auxiliary,'image/jpeg')]}
  for name,data in [('/models/furniture/new.glb',candidate),('/textures/future.jpg',auxiliary)]:save('dist/client'+name,data)
  delivery={'assets':{'/models/furniture/new.glb':assets['/models/furniture/new.glb']},'models':[{'id':'model-'+str(i)} for i in range(902)],'featureCommit':'d'*40,'catalogSha256':'c'*64,'review':{'decision':'approved','assetSetSha256':'a'*64}}
  file=save('assets-source/catalog-realism/production-delivery.json',encoded(delivery))
  promotion={'version':1,'scope':'production','assets':delivery['assets'],'models':delivery['models'],'sourceFeatureCommit':delivery['featureCommit'],'catalogSha256':delivery['catalogSha256'],'reviewedManifestSha256':sha(file.read_bytes()),'assetSetSha256':'a'*64}
  save('.generated/catalog-realism-promotion.json',encoded(promotion));save('.generated/library-manifest.json',encoded({'schema':1,'assets':assets}))
  helper=save('scripts/build-catalog-production-staging.mjs',b'// source binding');worker=save('dist/server/index.js',b'final403worker')
  save('.generated/catalog-production-final-server.json',encoded({'enabled':True,'outputSha256':sha(worker.read_bytes()),'promotionSha256':sha(encoded(promotion)),'helperSha256':sha(helper.read_bytes())}))
  return root,old
 def test_staging_archive_preserves_clients_migrations_and_uploads_all_final_assets(self):
  with tempfile.TemporaryDirectory() as directory:
   root,old=self.production_fixture(directory);output=root/'release';output.mkdir();m=self.module()
   def compile_wrapper(args,**kwargs):Path(args[-1]).write_bytes(b'compiled wrapper delegating pinned prior')
   with patch.dict('os.environ',{'NOOK_CATALOG_RELEASE_MODE':'production-staging'}),patch('subprocess.run',side_effect=compile_wrapper):
    metadata,archives=m['package_staging'](root,output,'b'*40)
   with tarfile.open(output/'sites-upload-staging.tar.gz') as tar:
    self.assertEqual(set(tar.getnames()),{'dist/'+name for name in old})
    for name,data in old.items():
     if name!='server/index.js':self.assertEqual(tar.extractfile('dist/'+name).read(),data)
   with tarfile.open(output/'catalog-upload-assets.tar.gz') as tar:
    self.assertEqual(len(tar.getnames()),2)
    self.assertEqual(tar.extractfile('experiments/catalog-realism/'+'b'*40+'/textures/future.jpg').read(),b'future shared texture')
   self.assertEqual(metadata['catalogCount'],902);self.assertEqual(len(metadata['catalog_model_ids']),902)
   self.assertEqual((output/'catalog-staging-prerequisites.json').read_bytes(),(root/'assets-source/catalog-realism/promotion-baseline/library-manifest.json').read_bytes())
   for name,entry in archives.items():self.assertEqual(entry['sha256'],sha((output/name).read_bytes()))
 def test_stale_promotion_or_missing_final_denial_is_rejected(self):
  with tempfile.TemporaryDirectory() as directory:
   root,old=self.production_fixture(directory);m=self.module();library=json.loads((root/'.generated/library-manifest.json').read_bytes())
   m['validate_promotion'](root,library)
   (root/'dist/server/index.js').write_bytes(b'changed unguarded worker')
   with self.assertRaisesRegex(AssertionError,'upload-denial'):m['validate_promotion'](root,library)

if __name__=='__main__':unittest.main()
