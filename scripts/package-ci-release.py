"""Package only verified build output, with an exact-commit receipt for Sites handoff."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import tarfile

root = Path(__file__).resolve().parents[1]
build = root / 'dist'
required = ['client/index.html', 'server/index.js', '.openai/hosting.json',
            '.openai/drizzle/0000_lush_inhumans.sql']
for name in required:
    assert (build / name).is_file(), f'Missing build output: {name}'
source = json.loads((root / '.openai/hosting.json').read_text())
manifest = json.loads((build / '.openai/hosting.json').read_text())
assert manifest['project_id'] == source['project_id']
assert manifest['d1'] == 'DB'
sha = subprocess.check_output(['git', 'rev-parse', '--verify', 'HEAD'], cwd=root, text=True).strip()
if os.environ.get('GITHUB_SHA'):
    assert sha == os.environ['GITHUB_SHA'], 'Build does not match workflow commit'
files = sorted(p for p in build.rglob('*') if p.is_file())
assert not any(p.is_symlink() for p in build.rglob('*')), 'Symlinks are not release assets'
expanded = sum(p.stat().st_size for p in files)
assert expanded < 250 * 1024 * 1024, 'Release exceeds size guard'
output = root / 'release'
output.mkdir(exist_ok=True)
archive = output / 'sites-release.tar.gz'
with tarfile.open(archive, 'w:gz') as tar:
    for path in files:
        tar.add(path, arcname='dist/' + path.relative_to(build).as_posix(), recursive=False)
with tarfile.open(archive) as tar:
    assert set(tar.getnames()) == {'dist/' + p.relative_to(build).as_posix() for p in files}
    assert sum(m.size for m in tar.getmembers()) == expanded
    for path in files:
        name = 'dist/' + path.relative_to(build).as_posix()
        assert tar.extractfile(name).read() == path.read_bytes(), f'Archive mismatch: {name}'
receipt = dict(commit_sha=sha, project_id=manifest['project_id'],
               archive_sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),
               expanded_bytes=expanded, file_count=len(files),
               run_id=os.environ.get('GITHUB_RUN_ID'))
(output / 'release.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))

