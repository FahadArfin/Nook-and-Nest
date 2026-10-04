"""Build an exact-CI production upload stage without replacing active model paths."""
import argparse,hashlib,io,json,os,re,subprocess,tarfile,tempfile
from pathlib import Path,PurePosixPath

PROJECT='appgprj_6a96455b69c08191bac4a9aa7cdd7e43'
ORIGIN='https://nook-and-nest.fwad101.chatgpt.site'
BASE_COMMIT='e337a9292c79f0951facde01b6d9b5b340f2d984'
LIMIT=250*1024*1024
def sha(data):return hashlib.sha256(data).hexdigest()
def json_bytes(value):return (json.dumps(value,indent=2)+'\n').encode()
def read_json(path):return json.loads(Path(path).read_bytes())
def record(path):
 data=Path(path).read_bytes();return {'sha256':sha(data),'size':len(data)}

def read_dist_archive(data):
 files={};total=0
 with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
  for member in archive:
   name=member.name
   assert member.isfile() and name.startswith('dist/') and '\\' not in name and ':' not in name and '..' not in name.split('/') and str(PurePosixPath(name))==name,'Unsafe baseline archive member'
   relative=name[5:];assert relative and relative not in files,'Duplicate baseline archive member'
   total+=member.size;assert total<LIMIT,'Baseline archive exceeds 250 MiB'
   files[relative]=archive.extractfile(member).read()
 return files

def validate_manifest(manifest):
 assert manifest.get('schema')==1 and isinstance(manifest.get('assets'),dict) and manifest['assets'],'Library manifest missing'
 for name,asset in manifest['assets'].items():
  assert isinstance(name,str) and re.fullmatch(r'/[a-zA-Z0-9_./-]+',name) and not any(p in ('','.','..') for p in name[1:].split('/')),'Invalid library asset path'
  assert re.fullmatch('[a-f0-9]{64}',asset.get('sha256','')) and type(asset.get('size')) is int and 0<asset['size']<=32*1024*1024,'Library object must be 1 byte to 32 MiB with SHA256'
  assert re.fullmatch(r'[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+',asset.get('type','')),'Invalid library content type'

def alias_manifest(manifest,commit):
 validate_manifest(manifest);assert re.fullmatch('[a-f0-9]{40}',commit),'Exact staging commit required'
 prefix='/experiments/catalog-realism/'+commit
 return {'schema':1,'assets':{prefix+name:dict(asset) for name,asset in manifest['assets'].items()}}

def read_asset(directory,name,asset):
 root=Path(directory).resolve();file=root/name.lstrip('/')
 assert file.resolve().is_relative_to(root) and file.is_file() and not file.is_symlink(),'Invalid local asset path'
 data=file.read_bytes();assert len(data)==asset['size'],'Local asset size differs: '+name
 assert sha(data)==asset['sha256'],'Local asset hash differs: '+name
 return data

def load_baseline(root):
 directory=Path(root)/'assets-source/catalog-realism/promotion-baseline'
 meta=read_json(directory/'baseline.json')
 assert meta.get('schema')==1 and meta.get('project_id')==PROJECT and meta.get('origin')==ORIGIN and meta.get('version')==128 and meta.get('commit_sha')==BASE_COMMIT,'Reviewed public v128 baseline required'
 expected={'sites-release.tar.gz','release.json','library-manifest.json','r2-public-verification.json'}
 assert set(meta.get('files',{}))==expected,'Baseline input list differs'
 for name in expected:assert record(directory/name)==meta['files'][name],'Changed baseline input: '+name
 receipt=read_json(directory/'release.json');assert receipt['commit_sha']==BASE_COMMIT and receipt['project_id']==PROJECT,'Baseline release identity differs'
 files=read_dist_archive((directory/'sites-release.tar.gz').read_bytes());archive=receipt['archives']['sites-release.tar.gz']
 assert archive['sha256']==meta['files']['sites-release.tar.gz']['sha256'] and archive['file_count']==len(files) and archive['expanded_bytes']==sum(map(len,files.values())),'Baseline archive receipt differs'
 for name in ['client/index.html','server/index.js','.openai/hosting.json','.openai/drizzle/0000_lush_inhumans.sql']:assert name in files,'Incomplete baseline app'
 hosting=json.loads(files['.openai/hosting.json']);assert hosting.get('project_id')==PROJECT and hosting.get('d1')=='DB' and hosting.get('r2')=='LIBRARY','Baseline production bindings differ'
 manifest=read_json(directory/'library-manifest.json');validate_manifest(manifest)
 assert not any('client'+name in files for name in manifest['assets']),'Baseline must be the exact slim app'
 proof=read_json(directory/'r2-public-verification.json')
 assert proof['origin']==ORIGIN and proof['manifest_sha256']==meta['files']['library-manifest.json']['sha256'] and proof['completed']==len(manifest['assets']) and proof['bytes']==sum(a['size'] for a in manifest['assets'].values()),'Historical public baseline proof differs'
 return {'metadata':meta,'files':files,'manifest':manifest,'directory':directory}

def validate_promotion(root,library):
 root=Path(root);promotion_file=root/'.generated/catalog-realism-promotion.json';promotion=read_json(promotion_file)
 delivery_path=root/'assets-source/catalog-realism/production-delivery.json';delivery=read_json(delivery_path)
 assert promotion.get('version')==1 and promotion.get('scope')=='production','Production promotion receipt required'
 assert promotion['reviewedManifestSha256']==sha(delivery_path.read_bytes()),'Promotion review file changed'
 assert promotion['assets']==delivery['assets'] and promotion['models']==delivery['models'] and promotion['sourceFeatureCommit']==delivery['featureCommit'] and promotion['catalogSha256']==delivery['catalogSha256'],'Promotion differs from reviewed delivery'
 assert promotion['assetSetSha256']==delivery['review']['assetSetSha256'] and delivery['review']['decision']=='approved','Delivery approval missing'
 models=promotion['models'];ids=[row['id'] for row in models]
 assert len(ids)==902 and len(set(ids))==902 and all(re.fullmatch('[a-z0-9-]+',name) for name in ids),'All 902 unique catalog models required'
 for name,asset in promotion['assets'].items():assert library['assets'].get(name)==asset,'Promoted asset differs from final library: '+name
 for name,asset in library['assets'].items():read_asset(root/'dist/client',name,asset)
 proof=read_json(root/'.generated/catalog-production-final-server.json')
 assert proof.get('enabled') is True and proof['outputSha256']==sha((root/'dist/server/index.js').read_bytes()) and proof['promotionSha256']==sha(promotion_file.read_bytes()) and proof['helperSha256']==sha((root/'scripts/build-catalog-production-staging.mjs').read_bytes()),'Final upload-denial wrapper missing or stale'
 return promotion

def prepare_staging(root,commit):
 root=Path(root).resolve();assert os.environ.get('NOOK_CATALOG_RELEASE_MODE')=='production-staging','Explicit production-staging release mode required'
 library=read_json(root/'.generated/library-manifest.json');validate_manifest(library)
 promotion=validate_promotion(root,library);baseline=load_baseline(root)
 files=dict(baseline['files']);upload=alias_manifest(library,commit);prefix='/experiments/catalog-realism/'+commit
 with tempfile.TemporaryDirectory(prefix='nook-production-stage-') as temporary:
  directory=Path(temporary);prior=directory/'prior.mjs';manifest=directory/'upload.json';worker=directory/'worker.mjs'
  prior.write_bytes(files['server/index.js']);manifest.write_bytes(json_bytes(upload))
  subprocess.run(['node',str(root/'scripts/build-catalog-production-staging.mjs'),'wrapper',str(prior),str(root/'worker/library-assets.js'),str(manifest),prefix,str(worker)],cwd=root,check=True)
  assert prior.read_bytes()==files['server/index.js'],'Prior worker input changed'
  files['server/index.js']=worker.read_bytes()
 for name,data in baseline['files'].items():
  if name!='server/index.js':assert files[name]==data,'Staging changed a baseline client/migration file'
 expanded=sum(map(len,files.values()));assert expanded<LIMIT,'Staging archive exceeds 250 MiB'
 model_ids=[row['id'] for row in promotion['models']]
 metadata={'version':1,'scope':'production','commit_sha':commit,'project_id':PROJECT,'origin':ORIGIN,
  'baseline':{k:baseline['metadata'][k] for k in ['project_id','origin','version','commit_sha','hosting_source']},
  'baseline_input_sha256':sha((baseline['directory']/'baseline.json').read_bytes()),
  'baseline_archive_sha256':baseline['metadata']['files']['sites-release.tar.gz']['sha256'],
  'prior_worker_sha256':sha(baseline['files']['server/index.js']),'staging_worker_sha256':sha(files['server/index.js']),
  'prefix':prefix,'prerequisites':'catalog-staging-prerequisites.json','upload_manifest':'catalog-upload-manifest.json',
  'upload_archive':'catalog-upload-assets.tar.gz','staging_archive':'sites-upload-staging.tar.gz','final_archive':'sites-release.tar.gz',
  'catalogRevision':promotion['assetSetSha256'],'catalogCount':902,'catalog_model_ids':model_ids,
  'catalogSha256':promotion['catalogSha256'],'sourceFeatureCommit':promotion['sourceFeatureCommit'],
  'promotion_sha256':sha((root/'.generated/catalog-realism-promotion.json').read_bytes()),
  'reviewed_manifest_sha256':promotion['reviewedManifestSha256'],
  'final_manifest_sha256':sha((root/'.generated/library-manifest.json').read_bytes()),
  'staging_expanded_bytes':expanded,'limitation':'The pinned historical R2 proof is not the fresh deployment gate. Verify current public identity and all prerequisites before staging.'}
 return {'files':files,'metadata':metadata,'upload':upload,'library':library,'baseline':baseline}

def write_archive(target,entries,limit=None):
 expanded=0;count=0;inventory={}
 with tarfile.open(target,'w:gz',compresslevel=6) as archive:
  for name,data in entries:
   assert name not in inventory,'Duplicate output archive member';expanded+=len(data);count+=1
   if limit:assert expanded<limit,'Publishable archive exceeds 250 MiB'
   info=tarfile.TarInfo(name);info.size=len(data);info.mode=0o644;archive.addfile(info,io.BytesIO(data));inventory[name]={'sha256':sha(data),'size':len(data)}
 with tarfile.open(target) as archive:
  assert len(archive.getmembers())==count,'Output archive count differs'
  for member in archive:
   data=archive.extractfile(member).read();assert {'sha256':sha(data),'size':len(data)}==inventory[member.name],'Output archive bytes differ'
 result={**record(target),'expanded_bytes':expanded,'file_count':count}
 if limit:assert result['size']<limit,'Compressed publishable archive exceeds 250 MiB'
 return result

def package_staging(root,output,commit):
 root=Path(root);output=Path(output);prepared=prepare_staging(root,commit);metadata=prepared['metadata'];archives={}
 def save(name,data):
  (output/name).write_bytes(data);archives[name]=record(output/name)
 # Preserve the prior public manifest's original bytes for an exact live gate.
 save('catalog-staging-prerequisites.json',(prepared['baseline']['directory']/'library-manifest.json').read_bytes())
 save('catalog-upload-manifest.json',json_bytes(prepared['upload']))
 save('catalog-promotion-baseline.json',json_bytes(prepared['baseline']['metadata']))
 save('catalog-staging-artifact-inventory.json',json_bytes({'files':{name:{'sha256':sha(data),'size':len(data)} for name,data in prepared['files'].items()}}))
 archives['sites-upload-staging.tar.gz']=write_archive(output/'sites-upload-staging.tar.gz',(('dist/'+name,data) for name,data in sorted(prepared['files'].items())),LIMIT)
 def upload_entries():
  for name,asset in prepared['library']['assets'].items():yield metadata['prefix'].lstrip('/')+name,read_asset(root/'dist/client',name,asset)
 archives['catalog-upload-assets.tar.gz']=write_archive(output/'catalog-upload-assets.tar.gz',upload_entries())
 save('catalog-staging.json',json_bytes(metadata))
 return metadata,archives

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('command',choices=['preflight']);parser.add_argument('--root',default=str(Path(__file__).resolve().parents[1]));args=parser.parse_args()
 root=Path(args.root);commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip();result=prepare_staging(root,commit)
 print(json.dumps({'mode':'production-staging','promotionVerified':True,'stagingBytes':result['metadata']['staging_expanded_bytes']}))
