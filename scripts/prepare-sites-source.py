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
a=p.parse_args()
receipt=json.loads((a.release_directory/'release.json').read_text())
source=a.release_directory/'sites-source.tar.gz'
assert hashlib.sha256(source.read_bytes()).hexdigest()==receipt['archives']['sites-source.tar.gz']['sha256']
def git(*args,data=None,env=None):
    return subprocess.check_output(['git',*args],input=data,env=env).decode().strip()
assert git('cat-file','-t',a.parent)=='commit'
with tempfile.TemporaryDirectory(prefix='nook-source-index-') as temp:
    env=dict(os.environ,GIT_INDEX_FILE=str(Path(temp)/'index'))
    git('read-tree','--empty',env=env)
    with tarfile.open(source) as tar:
        for member in tar.getmembers():
            assert member.isfile() and not member.name.startswith('/') and '..' not in member.name.split('/')
            blob=git('hash-object','-w','--stdin',data=tar.extractfile(member).read())
            git('update-index','--add','--cacheinfo','100644',blob,member.name,env=env)
    tree=git('write-tree',env=env)
    sha=git('commit-tree',tree,'-p',a.parent,'-m','Sites source for GitHub '+receipt['commit_sha'])
    # Protect the prepared commit locally without switching any working branch.
    git('update-ref','refs/heads/codex/sites-source-'+receipt['commit_sha'][:12],sha)
    a.output.write_text(json.dumps(dict(commit_sha=sha,github_commit=receipt['commit_sha'],parent=a.parent),indent=2))
    print(sha)
