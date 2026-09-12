"""Prepare private wall masks for a bounded comparative study, without model calls."""
import argparse,base64,io,json,sys,time
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

def encode(im):
    out=io.BytesIO();im.save(out,format='PNG');return 'data:image/png;base64,'+base64.b64encode(out.getvalue()).decode()

def supported_mask(rgb):
    # Standard binary opening followed by component filtering. Never closes gaps.
    h,w=rgb.shape[:2];gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)
    _,ink=cv2.threshold(gray,0,255,cv2.THRESH_BINARY_INV|cv2.THRESH_OTSU)
    size=max(3,round(max(w,h)*.0035));size+=1-size%2
    opened=cv2.morphologyEx(ink,cv2.MORPH_OPEN,np.ones((size,size),np.uint8))
    count,labels,stats,_=cv2.connectedComponentsWithStats(opened,connectivity=4)
    mask=np.zeros((h,w),np.uint8)
    for i in range(1,count):
        x,y,rw,rh,area=stats[i]
        if max(rw,rh)>=max(w,h)*.045 and area>=w*h*.00015:mask[labels==i]=255
    return mask

def main():
    p=argparse.ArgumentParser();p.add_argument('input');p.add_argument('upstream');p.add_argument('output');a=p.parse_args()
    data=json.loads(Path(a.input).read_text());out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
    im=Image.open(io.BytesIO(base64.b64decode(data['image'].split(',',1)[1]))).convert('RGB');rgb=np.array(im)
    sys.path.insert(0,str(Path(a.upstream).resolve()))
    from FloorplanToBlenderLib.detect import wall_filter
    start=time.perf_counter();upstream=wall_filter(cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY));upstream_ms=(time.perf_counter()-start)*1000
    start=time.perf_counter();supported=supported_mask(rgb);supported_ms=(time.perf_counter()-start)*1000
    for name,mask in [('upstream',upstream),('supported',supported)]:
        evidence=Image.fromarray(255-mask);evidence.save(out/f'{name}.png');data[name+'Mask']=encode(evidence)
    (out/'input.json').write_text(json.dumps(data));print(json.dumps({'upstreamMs':upstream_ms,'supportedMs':supported_ms}))

if __name__=='__main__':main()
