"""Convert the intermediate JSON into indexed numeric mesh chunks for Blender."""
import ijson,numpy as np,json
from pathlib import Path
root=Path(__file__).resolve().parents[1];data=root/'assets-source/geodata';names=[]
with (data/'toronto-massing-mesh.json').open('rb') as source:
 for name,(vertices,faces) in ijson.kvitems(source,'',use_float=True):
  points=np.asarray(vertices,dtype=np.float32);del vertices
  unique,inverse=np.unique(points,axis=0,return_inverse=True);del points
  tris=[]
  for f in faces:
   tris.append(f[:3])
   if len(f)==4:tris.append([f[0],f[2],f[3]])
  indices=inverse[np.asarray(tris,dtype=np.uint32)].astype(np.uint32);del tris,faces,inverse
  np.savez_compressed(data/(name+'.npz'),vertices=unique,faces=indices)
  names.append(name);print(name,len(unique),len(indices),flush=True)
(data/'massing-chunks.json').write_text(json.dumps(names))
