"""Add new material controls without rewriting existing saved color contracts."""
import json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]
original=json.loads(subprocess.check_output(['git','show','HEAD:src/modelMaterials.json'],cwd=root))
generated=json.loads((root/'src/modelMaterials.json').read_text())
ids=json.loads((root/'assets-source/studio-model-audit.json').read_text())
old={id:original[id] for id in ids if id in original}
(root/'tools/blender/studio-previous-materials.json').write_text(json.dumps(old,indent=2)+'\n')
for id in ids:
 if id not in original:original[id]=generated[id]
(root/'src/modelMaterials.json').write_text(json.dumps(dict(sorted(original.items())),indent=2)+'\n')
