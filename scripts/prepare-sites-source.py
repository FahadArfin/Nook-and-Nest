"""Create a small forward-only hosting source commit from an exact CI artifact.

Does not alter the application worktree, GitHub branches or previous hosting
history. The parent must be the freshly verified hosting branch head.
"""
import argparse,hashlib,json,os,subprocess,tarfile,tempfile
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('release_directory',type=Path)
p.add_argument('--parent',required=True)
p.add_argument('--output',type=Path,required=True)
p.add_argument('--phase',choices=['staging','final'])
p.add_argument('--storage-proof',type=Path)
a=p.parse_args()
receipt=json.loads((a.release_directory/'release.json').read_text())
source=a.release_directory/'sites-source.tar.gz'
assert hashlib.sha256(source.read_bytes()).hexdigest()==receipt['archives']['sites-source.tar.gz']['sha256']
phase_record=None
if receipt.get('catalog_staging'):
    assert a.phase and a.storage_proof, 'Catalog release requires a phase and verified public storage proof'
    with tempfile.TemporaryDirectory(prefix='nook-release-gate-') as check_directory:
        check=Path(check_directory)/'gate.json'
        subprocess.check_call(['node',str(Path(__file__).with_name('catalog-production-delivery.mjs')),
                               'gate-'+a.phase,str(a.release_directory.resolve()),
                               str(a.storage_proof.resolve()),str(check)])
        phase_record=json.loads(check.read_text())
    phase_record['source_archive_sha256']=receipt['archives']['sites-source.tar.gz']['sha256']
else:
    assert not a.phase and not a.storage_proof, 'Phase arguments require a staged catalog release'
def git(*args,data=None,env=None):
    return subprocess.check_output(['git',*args],input=data,env=env).decode().strip()
assert git('cat-file','-t',a.parent)=='commit'
parent_hosting=json.loads(git('show',a.parent+':.openai/hosting.json'))
assert parent_hosting['project_id']==receipt['project_id'], 'Hosting parent belongs to another project'
if a.phase=='staging':
    assert a.parent==receipt['catalog_staging']['baseline']['hosting_source'], 'Pinned public baseline is no longer the hosting head'
elif a.phase=='final':
    prior_phase=json.loads(git('show',a.parent+':DEPLOYMENT_PHASE.json'))
    assert prior_phase['phase']=='staging' and prior_phase['release_sha256']==phase_record['release_sha256'], 'Final snapshot must follow this exact release staging snapshot'
with tarfile.open(source) as tar:
    source_hosting=json.load(tar.extractfile('.openai/hosting.json'))
    provenance=json.load(tar.extractfile('SOURCE_PROVENANCE.json'))
    assert source_hosting['project_id']==receipt['project_id'], 'Source archive belongs to another project'
    assert provenance['github_commit']==receipt['commit_sha'], 'Source archive commit differs'
with tempfile.TemporaryDirectory(prefix='nook-source-index-') as temp:
    env=dict(os.environ,GIT_INDEX_FILE=str(Path(temp)/'index'))
    git('read-tree','--empty',env=env)
    with tarfile.open(source) as tar:
        for member in tar.getmembers():
            assert member.isfile() and not member.name.startswith('/') and '..' not in member.name.split('/')
            blob=git('hash-object','-w','--stdin',data=tar.extractfile(member).read())
            git('update-index','--add','--cacheinfo','100644',blob,member.name,env=env)
    if phase_record:
        blob=git('hash-object','-w','--stdin',data=(json.dumps(phase_record,indent=2)+'\n').encode())
        git('update-index','--add','--cacheinfo','100644',blob,'DEPLOYMENT_PHASE.json',env=env)
    tree=git('write-tree',env=env)
    sha=git('commit-tree',tree,'-p',a.parent,'-m','Sites source for GitHub '+receipt['commit_sha'])
    # Protect the prepared commit locally without switching any working branch.
    git('update-ref','refs/heads/codex/sites-source-'+receipt['commit_sha'][:12]+('-'+a.phase if a.phase else ''),sha)
    a.output.write_text(json.dumps(dict(commit_sha=sha,github_commit=receipt['commit_sha'],parent=a.parent,phase=a.phase),indent=2))
    print(sha)
