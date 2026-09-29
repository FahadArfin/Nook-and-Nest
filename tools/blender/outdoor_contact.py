"""Contact sheet of already-rendered outdoor inspection views (no model edits)."""
import sys
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[2]


def contact(ids,output):
    cell=410;views=('front','rear','underside')
    canvas=Image.new('RGB',(cell*3,(cell+29)*len(ids)),(236,233,225));draw=ImageDraw.Draw(canvas)
    for row,id in enumerate(ids):
        for col,view in enumerate(views):
            source=ROOT/('assets-source/previews/'+id+'.png' if view=='front' else '.generated/outdoor-review/'+id+'-'+view+'.png')
            im=Image.open(source).convert('RGBA');im.thumbnail((cell,cell))
            canvas.paste(im,(col*cell+(cell-im.width)//2,row*(cell+29)),im)
            draw.text((col*cell+6,row*(cell+29)+cell+5),id+' / '+view,fill=(16,20,22))
    target=ROOT/'.generated/outdoor-review'/output;target.parent.mkdir(parents=True,exist_ok=True)
    canvas.save(target,quality=94);print(target)


if __name__=='__main__':contact(sys.argv[2:],sys.argv[1])
