"""Extract only images from an external benchmark; references never enter model inputs."""
import base64,io,json,sys
from pathlib import Path
from PIL import Image
report=json.loads(Path(sys.argv[1]).read_text());root=Path(sys.argv[2]);root.mkdir(parents=True,exist_ok=True)
for name in ['cross-hall','courtyard']:
    fixture=report['fixtures'][name];image=fixture['image'];im=Image.open(io.BytesIO(base64.b64decode(image.split(',',1)[1]))).convert('RGBA');w,h=im.size;out=root/name;out.mkdir(exist_ok=True);im.save(out/'original.png');rgba=out/'pixels.rgba';rgba.write_bytes(im.tobytes());crops=[]
    for row in range(2):
        for col in range(2):
            margin=round(min(w,h)*.07);x=max(0,col*w//2-margin);y=max(0,row*h//2-margin);right=min(w,(col+1)*w//2+margin);bottom=min(h,(row+1)*h//2+margin);crop=im.crop((x,y,right,bottom)).convert('RGB');crop.thumbnail((1000,1000));buffer=io.BytesIO();crop.save(buffer,format='JPEG',quality=85);crops.append(dict(image='data:image/jpeg;base64,'+base64.b64encode(buffer.getvalue()).decode(),x=x,y=y,width=right-x,height=bottom-y))
    (out/'base-input.json').write_text(json.dumps(dict(image=image,width=w,height=h,pixelWidth=w,pixelHeight=h,rgbaFile=str(rgba),crops=crops)))
    print(name)
