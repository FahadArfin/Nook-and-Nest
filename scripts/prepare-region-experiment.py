"""Deterministic, private diagnostic inputs. No model calls or reference-answer geometry."""
import argparse,base64,io,json,time
from pathlib import Path
import cv2
import numpy as np
from PIL import Image,ImageDraw,ImageFont

def regions_from_pixels(rgb):
    h,w=rgb.shape[:2];longest=max(w,h)
    ink=(cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)<150).astype('uint8')
    thick=max(3,round(longest*.0045));length=max(18,round(longest*.038))
    horizontal=cv2.morphologyEx(ink,cv2.MORPH_OPEN,np.ones((thick,length),np.uint8))
    vertical=cv2.morphologyEx(ink,cv2.MORPH_OPEN,np.ones((length,thick),np.uint8))
    # Close only collinear gaps, not all nearby black strokes. These remain hypotheses.
    gap=max(12,round(longest*.075))
    base=cv2.morphologyEx(ink,cv2.MORPH_OPEN,np.ones((thick,thick),np.uint8))
    mask=base.copy()
    # A long wall may terminate at a short perpendicular jamb. Accept that support,
    # but do not fill every narrow closet simply because two vertical walls are close.
    for axis,directional in [(0,horizontal),(1,vertical)]:
        b=base if axis==0 else base.T;d=directional if axis==0 else directional.T;m=mask if axis==0 else mask.T
        for y in range(b.shape[0]):
            occupied=np.flatnonzero(b[y]);breaks=np.flatnonzero(np.diff(occupied)>1)
            for j in breaks:
                left,right=int(occupied[j]),int(occupied[j+1])
                if right-left<=gap and (d[y,left] or d[y,right]):m[y,left:right+1]=1
    count,labels,stats,centres=cv2.connectedComponentsWithStats(1-mask,connectivity=4)
    regions=[]
    for i in range(1,count):
        x,y,rw,rh,area=map(int,stats[i])
        if x==0 or y==0 or x+rw==w or y+rh==h or area<w*h*.0015 or min(rw,rh)<longest*.018:continue
        # A centroid may fall outside an L-shaped room; use the deepest interior point.
        component=(labels==i).astype('uint8');distance=cv2.distanceTransform(component,cv2.DIST_L2,3)
        ay,ax=np.unravel_index(distance.argmax(),distance.shape)
        contours,_=cv2.findContours(component,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
        contour=max(contours,key=cv2.contourArea);poly=cv2.approxPolyDP(contour,max(1,longest*.001),True).reshape(-1,2)
        regions.append(dict(label=i,x=x,y=y,width=rw,height=rh,area=area,anchor=[int(ax),int(ay)],polygon=poly.tolist()))
    regions=sorted(regions,key=lambda r:(r['y']//max(1,round(longest*.025)),r['x']))[:40]
    for i,r in enumerate(regions,1):r['id']=f'R{i}'
    return regions,labels,mask

def encode(im):
    output=io.BytesIO();im.save(output,format='JPEG',quality=85)
    return 'data:image/jpeg;base64,'+base64.b64encode(output.getvalue()).decode()

def prepare(input_path,output):
    start=time.perf_counter();data=json.loads(Path(input_path).read_text());out=Path(output);out.mkdir(parents=True,exist_ok=True)
    original=Image.open(io.BytesIO(base64.b64decode(data['image'].split(',',1)[1]))).convert('RGB')
    sw,sh=original.size;scale=min(1,1600/max(sw,sh));im=original.resize((round(sw*scale),round(sh*scale)));w,h=im.size
    regions,labels,mask=regions_from_pixels(np.array(im));overlay=im.convert('RGBA');color_layer=Image.new('RGBA',im.size);draw=ImageDraw.Draw(color_layer)
    colors=[(45,135,230),(230,125,35),(135,65,205),(30,170,120),(205,75,105)]
    for i,r in enumerate(regions):
        color=colors[i%len(colors)];draw.polygon([tuple(p) for p in r['polygon']],fill=color+(48,),outline=color+(255,))
    overlay=Image.alpha_composite(overlay,color_layer);draw=ImageDraw.Draw(overlay);font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',max(14,round(max(w,h)*.014)))
    for r in regions:
        ax,ay=r['anchor'];box=draw.textbbox((ax,ay),r['id'],font=font);draw.rectangle((box[0]-3,box[1]-3,box[2]+3,box[3]+3),fill='white');draw.text((ax,ay),r['id'],font=font,fill='black')
    overlay.convert('RGB').save(out/'regions-overlay.jpg',quality=92);Image.fromarray(mask*255).save(out/'wall-mask.png')
    source=[]
    for r in regions:
        source.append({**{k:v for k,v in r.items() if k not in ['label','area','polygon','anchor','x','y','width','height']},**{k:round(r[k]/scale,1) for k in ['x','y','width','height']},'anchor':[round(v/scale,1) for v in r['anchor']],'polygon':[[round(v/scale,1) for v in p] for p in r['polygon']]})
    # Four small or irregular regions, spatially distinct. Original still covers the whole plan.
    ranked=sorted(regions,key=lambda r:(r['area']/(r['width']*r['height'])>.85,r['area']))
    crops=[];selected=[]
    for r in ranked:
        pad=round(max(w,h)*.045);x=max(0,r['x']-pad);y=max(0,r['y']-pad);x2=min(w,r['x']+r['width']+pad);y2=min(h,r['y']+r['height']+pad)
        if any(abs((x+x2)-(a+c))<.12*w and abs((y+y2)-(b+d))<.12*h for a,b,c,d in selected):continue
        selected.append((x,y,x2,y2));sx,sy,ex,ey=[round(v/scale) for v in [x,y,x2,y2]];crop=original.crop((sx,sy,ex,ey));crop.thumbnail((1000,1000));crop.save(out/f'target-{len(crops)+1}.jpg')
        crops.append(dict(image=encode(crop),x=sx,y=sy,width=ex-sx,height=ey-sy))
        if len(crops)==4:break
    experiment={**data,'regions':source,'regionOverlay':encode(overlay.convert('RGB')),'targetCrops':crops,'preprocessMs':(time.perf_counter()-start)*1000}
    (out/'input.json').write_text(json.dumps(experiment));(out/'regions.json').write_text(json.dumps(source,indent=2))
    print(json.dumps({'regions':len(regions),'targetCrops':len(crops),'preprocessMs':experiment['preprocessMs']}))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('input');p.add_argument('output');a=p.parse_args();prepare(a.input,a.output)
