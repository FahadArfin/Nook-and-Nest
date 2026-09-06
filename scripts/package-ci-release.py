"""Package only verified build output, with an exact-commit receipt for Sites handoff."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import tarfile
import io

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
archive = output / 'sites-bridge.tar.gz'
with tarfile.open(archive, 'w:gz') as tar:
    for path in files:
        tar.add(path, arcname='dist/' + path.relative_to(build).as_posix(), recursive=False)
with tarfile.open(archive) as tar:
    assert set(tar.getnames()) == {'dist/' + p.relative_to(build).as_posix() for p in files}
    assert sum(m.size for m in tar.getmembers()) == expanded
    for path in files:
        name = 'dist/' + path.relative_to(build).as_posix()
        assert tar.extractfile(name).read() == path.read_bytes(), f'Archive mismatch: {name}'
library = json.loads((root / '.generated/library-manifest.json').read_text())
asset_names = {'client' + name for name in library['assets']}
slim_files = [p for p in files if p.relative_to(build).as_posix() not in asset_names]
# The incremental bridge packages every new/changed asset. Omitted baseline
# objects are explicit prerequisites, verified live before the release is used.
baseline = json.loads((root / 'docs/r2-baseline.json').read_text())
reused = {name: asset for name, asset in library['assets'].items()
          if baseline['assets'].get(name) == asset}
reused_names = {'client' + name for name in reused}
incremental_files = [p for p in files if p.relative_to(build).as_posix() not in reused_names]
prerequisites = dict(schema=1, assets=reused, commit_sha=sha)
(output/'incremental-prerequisites.json').write_text(json.dumps(prerequisites,indent=2))
archives = {}
for filename, selected, prefix, base in [
    ('sites-release.tar.gz', slim_files, 'dist/', build),
    ('sites-incremental-bridge.tar.gz', incremental_files, 'dist/', build),
    ('library-assets.tar.gz', [build / name for name in sorted(asset_names)], '', build / 'client'),
]:
    with tarfile.open(output / filename, 'w:gz') as tar:
        for p in selected:
            tar.add(p, arcname=prefix+p.relative_to(base).as_posix(), recursive=False)
    with tarfile.open(output / filename) as tar:
        assert set(tar.getnames()) == {prefix+p.relative_to(base).as_posix() for p in selected}
        for p in selected:
            assert tar.extractfile(prefix+p.relative_to(base).as_posix()).read() == p.read_bytes()
    archives[filename] = dict(sha256=hashlib.sha256((output / filename).read_bytes()).hexdigest(),
                             expanded_bytes=sum(p.stat().st_size for p in selected), file_count=len(selected))
archives['sites-bridge.tar.gz'] = dict(sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),
                                     expanded_bytes=expanded, file_count=len(files))
archives['incremental-prerequisites.json'] = dict(sha256=hashlib.sha256((output/'incremental-prerequisites.json').read_bytes()).hexdigest())
# The hosting snapshot contains the exact application source plus explicit
# provenance for external inputs. It has no ancestry link to the heavy GitHub
# history: its parent will be the existing hosting branch, via a normal push.
source_paths = subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
external = {}
with tarfile.open(output / 'sites-source.tar.gz','w:gz') as tar:
    for name in sorted(filter(None,source_paths)):
        p = root / name
        committed = subprocess.check_output(['git','show',sha+':'+name],cwd=root)
        assert p.read_bytes() == committed, 'Uncommitted release source: '+name
        if name.startswith(('assets-source/','public/models/','public/textures/','public/data/toronto/')):
            external[name] = dict(sha256=hashlib.sha256(committed).hexdigest(),size=len(committed))
            continue
        assert len(committed)<10*1024*1024, 'Unexpected large source input: '+name
        tar.add(p,arcname=name,recursive=False)
    # Generated asset manifest is also retained as independently verifiable provenance.
    tar.add(root / '.generated/library-manifest.json',arcname='.generated/library-manifest.json',recursive=False)
    provenance = json.dumps(dict(github_commit=sha,github_repository='https://github.com/FahadArfin/Nook-and-Nest',
                                 archives=archives,external_inputs=external),indent=2).encode()
    info=tarfile.TarInfo('SOURCE_PROVENANCE.json');info.size=len(provenance);tar.addfile(info,io.BytesIO(provenance))
archives['sites-source.tar.gz'] = dict(sha256=hashlib.sha256((output/'sites-source.tar.gz').read_bytes()).hexdigest())
(output/'library-manifest.json').write_text(json.dumps(library,indent=2))
receipt = dict(commit_sha=sha, project_id=manifest['project_id'],archives=archives,
               run_id=os.environ.get('GITHUB_RUN_ID'))
(output / 'release.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))

