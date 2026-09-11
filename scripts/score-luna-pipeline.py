"""Score private diagnostic outputs against a supplied reference; no model calls."""
import argparse,json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
p=argparse.ArgumentParser();p.add_argument('report');p.add_argument('image');p.add_argument('results');a=p.parse_args()
reference=json.loads(Path(a.report).read_text())['fixtures']['apartment']['reference'];out=Path(a.results);summary=[]
for path in sorted(out.glob('run-*.json')):
    data=json.loads(path.read_text());result=data.get('result')
    if not result:continue
    im=Image.open(a.image).convert('RGBA');width,height=im.size;scores={}
    for kind in ['Bedroom','Hall','Laundry']:
        masks=[]
        for rooms in [reference,result['rooms']]:
            mask=np.zeros((height,width),dtype=bool)
            for r in rooms:
                if r['kind']==kind:
                    x,y,w,h=[int(round(r[k])) for k in ['x','y','width','height']];mask[y:y+h,x:x+w]=1
            if kind=='Hall':mask[755:]=False
            masks.append(mask)
        left,right=masks;scores[kind]=float((left&right).sum()/max(1,(left|right).sum()))
    overlay=Image.new('RGBA',im.size);draw=ImageDraw.Draw(overlay)
    for r in result['rooms']:
        color={'Bedroom':(30,100,255,65),'Hall':(255,130,0,100),'Laundry':(180,0,220,100)}.get(r['kind'],(30,180,80,40));x,y,w,h=[r[k] for k in ['x','y','width','height']];draw.rectangle((x,y,x+w,y+h),fill=color,outline=color[:3]+(255,),width=2)
    Image.alpha_composite(im,overlay).save(out/f'{path.stem}-overlay.png')
    cost=0
    for stage in data['stages']:
        u=stage['usage'];details=u.get('input_tokens_details',{});cached=details.get('cached_tokens',0);writes=details.get('cache_write_tokens',0)
        cost+=((u['input_tokens']-cached)*.2+cached*.02+writes*.05+u['output_tokens']*1.2)/1e6
    summary.append(dict(run=data['run'],seconds=data['seconds'],estimatedUsd=cost,coreIoU=(scores['Bedroom']+scores['Hall'])/2,scores=scores))
(out/'scores.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary,indent=2))
