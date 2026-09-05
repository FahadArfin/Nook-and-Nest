"""Preserve original RGBA renders and emit pixel-identical lossless WebP previews."""
from pathlib import Path
from PIL import Image
import os,sys
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets-source/previews';OUTPUT=ROOT/'public/models/previews'
def compress(path):
 image=Image.open(path).convert('RGBA');target=OUTPUT/(path.stem+'.webp');temporary=OUTPUT/('.'+path.stem+'.webp')
 if target.exists() and Image.open(target).convert('RGBA').tobytes()==image.tobytes():return path.stat().st_size,target.stat().st_size
 image.save(temporary,'WEBP',lossless=True,quality=100,method=6,exact=True)
 assert Image.open(temporary).convert('RGBA').tobytes()==image.tobytes(),path
 os.replace(temporary,target)
 return path.stat().st_size,target.stat().st_size
if __name__=='__main__':
 SOURCE.mkdir(parents=True,exist_ok=True)
 for path in OUTPUT.glob('*.png'):
  target=SOURCE/path.name
  if target.exists():raise RuntimeError('Duplicate original: '+str(target))
  path.rename(target)
 paths=[p for p in SOURCE.glob('*.png') if len(sys.argv)==1 or p.stem in sys.argv[1:]]
 with ThreadPoolExecutor(max_workers=4) as pool:totals=list(pool.map(compress,paths))
 print({'previews':len(totals),'before':sum(a for a,b in totals),'after':sum(b for a,b in totals),'pixel_identical':True})
