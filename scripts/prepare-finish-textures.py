from pathlib import Path
from PIL import Image
import json,shutil
root=Path('.');out=root/'public/textures/finishes';out.mkdir(parents=True,exist_ok=True)
source=root/'assets-source/finishes';source.mkdir(parents=True,exist_ok=True)
base=source
sets=[('exec-8d8a66da-348c-4d22-a9be-cdd0b2840281.png',4,['ivory-porcelain','marble-check','sage-hex','blue-star','white-subway','clay-herringbone','travertine','confetti-terrazzo','oat-loop','charcoal-cut','rose-plush','cream-berber','moss-loop','navy-rib','taupe-chevron','ivory-diamond']),('exec-8e509c27-1576-481c-81b4-250f9a00529f.png',4,['natural-oak','smoked-walnut','oak-parquet','cherry-plank','lime-stone','weathered-brick','cream-beadboard','slate-stack','sage-vines','blue-linen','rose-deco','plaster-neutral','emerald-zellige','penny-round','navy-hex','sand-basket']),('exec-bcf24fbc-3e92-4682-9f32-b00a49386af8.png',2,['gold-vein-marble','silver-vein-marble','taupe-marble','noir-marble'])]
for filename,n,names in sets:
 im=Image.open(base/filename).convert('RGB');w,h=im.size
 for i,name in enumerate(names):
  x=i%n;y=i//n;piece=im.crop((round(x*w/n),round(y*h/n),round((x+1)*w/n),round((y+1)*h/n)))
  piece.save(out/(name+'.jpg'),quality=94)
  if n==2:
   # Neutral 2 mm grout margin on a 600 mm slab; engine repeats in world units.
   import PIL.ImageDraw as D
   d=D.Draw(piece);d.line((0,0,piece.width,0),fill=(177,175,168),width=2);d.line((0,0,0,piece.height),fill=(177,175,168),width=2);piece.save(out/(name+'-tile.jpg'),quality=94)
# Texture atlas segmentation is asset preparation; keep full generated originals.
floors=[];walls=[]
def add(target,id,name,family,repeat=(1.2,1.2),texture=None,color=None):
 d=dict(id=id,name=name,family=family,texture='/textures/finishes/'+(texture or id)+'.jpg',scale=1,repeatMeters=repeat)
 if color:d['color']=color
 target.append(d)
for id,name in [('ivory-porcelain','Ivory porcelain'),('marble-check','Marble checkerboard'),('sage-hex','Sage hexagon'),('blue-star','Blue star encaustic'),('clay-herringbone','Terracotta herringbone'),('travertine','Sand travertine'),('confetti-terrazzo','Confetti terrazzo'),('penny-round','Ivory penny mosaic'),('navy-hex','Midnight hexagon'),('sand-basket','Stone basketweave')]:add(floors,id,name,'Tile')
for id,name in [('gold-vein-marble','Golden vein marble'),('silver-vein-marble','Silver vein marble'),('taupe-marble','Warm taupe marble'),('noir-marble','Noir marble')]:
 for suffix,label,repeat in [('large','60 × 120 cm',(.6,1.2)),('square','90 × 90 cm',(.9,.9))]:add(floors,id+'-'+suffix,name+' · '+label,'Large marble',repeat,id+'-tile')
 add(walls,'wall-'+id,name+' slab','Stone',(1.2,2.4),id)
for id,name in [('oat-loop','Oat loop pile'),('charcoal-cut','Charcoal cut pile'),('rose-plush','Rose plush'),('cream-berber','Cream berber'),('moss-loop','Moss loop pile'),('navy-rib','Navy ribbed'),('taupe-chevron','Taupe herringbone'),('ivory-diamond','Ivory diamond')]:add(floors,id,name,'Carpet',(.6,.6))
for id,name,color in [('linen-berber','Linen berber','#e4d2b8'),('silver-berber','Silver berber','#c5cbd0'),('sage-berber','Sage berber','#c0cbbb'),('blush-diamond','Blush diamond','#e4bac0'),('blue-diamond','Powder blue diamond','#b9cdda'),('honey-loop','Honey loop pile','#e8c99c'),('lavender-plush','Lavender plush','#d4c1df'),('sage-plush','Sage plush','#b0c8ab')]:
 tex='rose-plush' if 'plush' in id else 'ivory-diamond' if 'diamond' in id else 'oat-loop' if 'loop' in id else 'cream-berber';add(floors,id,name,'Carpet',(.6,.6),tex,color)
for id,name in [('natural-oak','Natural wide oak'),('smoked-walnut','Smoked walnut'),('oak-parquet','Oak herringbone'),('cherry-plank','Cherry planks')]:add(floors,id,name,'Wood',(1.8,1.8))
for id,name,fam in [('lime-stone','Limewashed limestone','Stone'),('weathered-brick','Weathered brick','Masonry'),('cream-beadboard','Cream beadboard','Paneling'),('slate-stack','Stacked slate','Stone'),('sage-vines','Sage sprigs','Wallpaper'),('blue-linen','Blue pinstripe linen','Wallpaper'),('rose-deco','Rose art deco','Wallpaper'),('white-subway','White subway','Tile'),('emerald-zellige','Emerald zellige','Tile'),('penny-round','Penny round mosaic','Tile'),('navy-hex','Navy hex mosaic','Tile'),('sand-basket','Sand basketweave','Tile')]:add(walls,'wall-'+id,name,fam,(1.2,1.2),id)
for f in floors:
 if 'color' in f:
  from PIL import ImageChops
  im=Image.open(root/('public'+f['texture'])).convert('RGB');rgb=tuple(int(f['color'][i:i+2],16) for i in [1,3,5]);ImageChops.multiply(im,Image.new('RGB',im.size,rgb)).save(out/(f['id']+'.jpg'),quality=94);f['texture']='/textures/finishes/'+f['id']+'.jpg';del f['color']
(root/'src/finishExpansion.json').write_text(json.dumps(dict(floors=floors,walls=walls),indent=2)+'\n',encoding='utf-8')
print('Added',len(floors),'floor finishes and',len(walls),'wall finishes plus unlimited paint')
