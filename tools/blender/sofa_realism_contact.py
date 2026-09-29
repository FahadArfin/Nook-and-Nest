"""Compose already rendered original sofa views for visual review."""
import sys
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[2]

def contact(ids,output):
    size=360;canvas=Image.new('RGB',(size*4,(size+28)*len(ids)),(231,229,221));draw=ImageDraw.Draw(canvas)
    for row,id in enumerate(ids):
        for col,view in enumerate(['front','rear','underside','closeup']):
            path=ROOT/('assets-source/previews/'+id+'.png' if view=='front' else '.generated/sofa-review/'+id+'-'+view+'.png')
            im=Image.open(path).convert('RGBA');im.thumbnail((size,size))
            canvas.paste(im,(col*size,row*(size+28)),im)
            draw.text((col*size+6,row*(size+28)+size+3),id+' / '+view,fill=(12,16,19))
    target=ROOT/'.generated/sofa-review'/output;canvas.save(target,quality=94)
    print(target)

if __name__=='__main__':contact(sys.argv[2:],sys.argv[1])
