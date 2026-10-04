"""Immutable Beta source archives and forward hosting snapshots. Never uploads."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile
import tempfile

BETA_PROJECT='appgprj_6aa3491b56808191b9322b08eb92e7ef'
LIMIT=250*1024*1024
EXTERNAL=('assets-source/','public/models/','public/textures/','public/data/toronto/','public/experiments/catalog-realism/')

def sha(data):return hashlib.sha256(data).hexdigest()
def json_bytes(value):return (json.dumps(value,indent=2)+'\n').encode()
def git(root,*args,**kwargs):return subprocess.check_output(['git',*args],cwd=root,**kwargs)

def archive_members(source):
    result={}
    data=source if isinstance(source,bytes) else Path(source).read_bytes()
    with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
        total=0
        for member in archive:
            name=member.name
            assert member.isfile() and name and '\\' not in name and ':' not in name and not name.startswith('/') and '..' not in name.split('/') and str(PurePosixPath(name))==name, 'Unsafe source archive member'
            assert name not in result and member.size<=12*1024*1024,'Duplicate or oversized source member'
            total+=member.size
            assert total<LIMIT,'Source archive exceeds 250 MiB'
            result[name]=archive.extractfile(member).read()
    return result

def write_archive(target,files):
    target=Path(target)
    assert not target.exists(),'Output exists; use a new immutable output'
    assert sum(map(len,files.values()))<LIMIT,'Source archive exceeds 250 MiB'
    target.parent.mkdir(parents=True,exist_ok=True)
    with tarfile.open(target,'x:gz') as archive:
        for name,data in sorted(files.items()):
            info=tarfile.TarInfo(name);info.size=len(data);info.mode=0o644
            archive.addfile(info,io.BytesIO(data))
    assert target.stat().st_size<LIMIT,'Compressed source archive exceeds 250 MiB'
    return {'sha256':sha(target.read_bytes()),'size':target.stat().st_size,'file_count':len(files)}

def package_feature_source(root,commit,target):
    root=Path(root)
    assert re.fullmatch('[a-f0-9]{40}',commit),'Exact feature commit required'
    assert git(root,'rev-parse','HEAD').decode().strip()==commit,'Feature HEAD differs'
    assert not git(root,'status','--porcelain').strip(),'Feature source must be clean'
    entries=git(root,'ls-tree','-rz',commit).split(b'\0')
    files={};external={}
    # One cat-file process avoids spawning thousands of Git processes for the
    # render and editable-source hashes. Every blob still matches disk exactly.
    process=subprocess.Popen(['git','cat-file','--batch'],cwd=root,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
    try:
        for entry in filter(None,entries):
            metadata,name_bytes=entry.split(b'\t',1);mode,kind,object_id=metadata.split()
            assert mode in (b'100644',b'100755') and kind==b'blob','Source links and submodules are forbidden'
            name=name_bytes.decode('utf-8')
            process.stdin.write(object_id+b'\n');process.stdin.flush()
            header=process.stdout.readline().split();assert len(header)==3 and header[1]==b'blob','Missing source blob'
            size=int(header[2]);data=process.stdout.read(size);assert len(data)==size and process.stdout.read(1)==b'\n','Truncated source blob'
            assert (root/name).read_bytes()==data,'Uncommitted release source: '+name
            if name.startswith(EXTERNAL):external[name]={'sha256':sha(data),'size':size}
            else:
                if name=='public/experiments/realism-lab/sofa-pipeline.glb':
                    review=json.loads((root/'assets-source/model-pipeline/sofa.review.json').read_text())
                    assert review['decision']=='approved' and review['artifactHashes']['glb']==sha(data) and data[:4]==b'glTF' and size<=12*1024*1024,'Unreviewed sofa source'
                else:assert size<10*1024*1024,'Unexpected large source input: '+name
                files[name]=data
    finally:
        process.stdin.close();process.stdout.close();assert process.wait()==0,'Git source reader failed'
    assert git(root,'rev-parse','HEAD').decode().strip()==commit and not git(root,'status','--porcelain').strip(),'Feature source changed during packaging'
    files['SOURCE_PROVENANCE.json']=json_bytes({'version':1,'scope':'beta-only','github_commit':commit,'github_repository':'https://github.com/FahadArfin/Nook-and-Nest','external_inputs':external})
    return write_archive(target,files)

def validate_context(context):
    assert context.get('version')==1 and context.get('scope')=='beta-only' and context.get('project_id')==BETA_PROJECT,'Beta-only release required'
    assert context.get('mode') in ('staging','final') and re.fullmatch('[a-f0-9]{40}',context.get('commit_sha','')),'Invalid Beta release identity'

def package_release_source(source,expected_sha,context,hosting,target):
    validate_context(context)
    source_bytes=Path(source).read_bytes()
    assert sha(source_bytes)==expected_sha,'Feature source archive hash differs'
    files=archive_members(source_bytes);provenance=json.loads(files['SOURCE_PROVENANCE.json'])
    assert provenance.get('scope')=='beta-only' and provenance.get('github_commit')==context['commit_sha'],'Feature source commit differs'
    assert hosting.get('project_id')==BETA_PROJECT and hosting.get('d1')=='DB' and hosting.get('r2')=='LIBRARY','Beta hosting binding required'
    assert 'BETA_RELEASE_PROVENANCE.json' not in files,'Feature archive is already a release snapshot'
    # Source bytes remain exact except for the explicitly bound Beta deployment
    # config. Mode and artifact hashes make staging and final distinct snapshots.
    files['.openai/hosting.json']=json_bytes(hosting)
    files['BETA_RELEASE_PROVENANCE.json']=json_bytes(context)
    return write_archive(target,files)

def verify_release_source(directory):
    directory=Path(directory);receipt=json.loads((directory/'release.json').read_text());validate_context(receipt)
    archive=directory/'sites-source.tar.gz'
    source_bytes=archive.read_bytes()
    assert sha(source_bytes)==receipt['archives']['sites-source.tar.gz']['sha256'],'Release source archive hash differs'
    files=archive_members(source_bytes);context=json.loads(files['BETA_RELEASE_PROVENANCE.json'])
    expected={key:value for key,value in receipt.items() if key not in ('archives','sourceArchive')}
    assert context==expected,'Release source provenance differs'
    hosting=json.loads(files['.openai/hosting.json'])
    assert hosting.get('project_id')==BETA_PROJECT and hosting.get('d1')=='DB' and hosting.get('r2')=='LIBRARY','Beta hosting differs'
    assert receipt['archives'].get('sites-catalog-realism-beta.tar.gz')==receipt['archive'],'Deployment archive records differ'
    artifact=directory/'sites-catalog-realism-beta.tar.gz'
    assert sha(artifact.read_bytes())==receipt['archive']['sha256'],'Release artifact hash differs'
    return receipt,files

def prepare_snapshot(directory,parent,output,root):
    receipt,files=verify_release_source(directory)
    assert re.fullmatch('[a-f0-9]{40}',parent) and git(root,'cat-file','-t',parent).strip()==b'commit','Verified hosting parent commit required'
    parent_hosting=json.loads(git(root,'show',parent+':.openai/hosting.json'))
    assert parent_hosting.get('project_id')==BETA_PROJECT,'Hosting parent must belong to Beta 1'
    assert not Path(output).exists(),'Snapshot receipt already exists'
    with tempfile.TemporaryDirectory(prefix='nook-beta-index-') as temp:
        env=dict(os.environ,GIT_INDEX_FILE=str(Path(temp)/'index'))
        git(root,'read-tree','--empty',env=env)
        for name,data in sorted(files.items()):
            blob=git(root,'hash-object','-w','--stdin',input=data).decode().strip()
            git(root,'update-index','--add','--cacheinfo','100644',blob,name,env=env)
        tree=git(root,'write-tree',env=env).decode().strip()
        commit=git(root,'commit-tree',tree,'-p',parent,'-m',f"Beta catalog {receipt['mode']} for GitHub {receipt['commit_sha']}").decode().strip()
        ref=f"refs/heads/codex/sites-beta-{receipt['mode']}-{commit[:12]}"
        git(root,'update-ref',ref,commit,'0'*40)
    result={'scope':'beta-only','project_id':BETA_PROJECT,'mode':receipt['mode'],'commit_sha':commit,'github_commit':receipt['commit_sha'],'parent':parent,'ref':ref,'release_sha256':sha((Path(directory)/'release.json').read_bytes())}
    Path(output).write_bytes(json_bytes(result));return result

def main():
    parser=argparse.ArgumentParser(description=__doc__);commands=parser.add_subparsers(dest='command',required=True)
    feature=commands.add_parser('feature');feature.add_argument('--root',required=True);feature.add_argument('--commit',required=True);feature.add_argument('--output',required=True)
    release=commands.add_parser('release');release.add_argument('--source',required=True);release.add_argument('--sha256',required=True);release.add_argument('--context',required=True);release.add_argument('--hosting',required=True);release.add_argument('--output',required=True)
    prepare=commands.add_parser('prepare');prepare.add_argument('directory');prepare.add_argument('--parent',required=True);prepare.add_argument('--output',required=True);prepare.add_argument('--root',default=str(Path(__file__).resolve().parents[1]))
    args=parser.parse_args()
    if args.command=='feature':result=package_feature_source(args.root,args.commit,args.output)
    elif args.command=='release':result=package_release_source(args.source,args.sha256,json.loads(Path(args.context).read_text()),json.loads(Path(args.hosting).read_text()),args.output)
    else:result=prepare_snapshot(args.directory,args.parent,args.output,args.root)
    print(json.dumps(result))

if __name__=='__main__':main()
