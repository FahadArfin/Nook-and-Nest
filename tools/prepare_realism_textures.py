"""Prepare licensed 1K scans, neutral tintable textiles and packed PBR maps.

This is deterministic color calibration/channel packing, not artwork synthesis.
Run after downloading the exact CC0 files recorded in the provenance receipts.
"""
import hashlib, io, json, zipfile
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps, ImageFile
ImageFile.MAXBLOCK=4*1024*1024

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/textures/realism'
OUT.mkdir(parents=True,exist_ok=True)
MATERIALS={
 'linen':('rough_linen',.271,.38),'chenille':('Fabric030',.28,.38),
 'twill':('Fabric082A',.30,.26),'velvet':('velour_velvet',.274,.22),
 'canvas':('Fabric036',.32,.38),'corduroy':('ribbed_corduroy',.267,.40),
 'oak':('oak_veneer_01',1.83,.4),'walnut':('walnut_veneer_02',1.,.38),
 'teak':('teak_veneer',1.,.4),
}

def read_maps(asset):
    downloads=asset['downloads'];maps={}
    for download in downloads:
        path=Path(download['result']['path'])
        if hashlib.sha256(path.read_bytes()).hexdigest()!=download['result']['sha256']:
            raise ValueError('Downloaded hash mismatch: '+str(path))
        if path.suffix=='.zip':
            with zipfile.ZipFile(path) as archive:
                for kind,suffix in [('color','_Color.'),('normal','_NormalGL.'),('roughness','_Roughness.')]:
                    name=next(n for n in archive.namelist() if suffix in n)
                    maps[kind]=Image.open(io.BytesIO(archive.read(name))).convert('RGB')
        else:
            kind='color' if 'Diffuse' in path.name else 'normal' if 'nor_gl' in path.name else 'roughness'
            maps[kind]=Image.open(path).convert('RGB')
    if set(maps)!={'color','normal','roughness'}:raise ValueError(asset['asset']['id'])
    return maps

def neutral(image,low=180,high=246):
    a=np.asarray(image.convert('L'),dtype=np.float32);p,q=np.percentile(a,[.5,99.5])
    a=np.clip((a-p)/max(q-p,1),0,1)*(high-low)+low
    return Image.fromarray(a.astype('uint8')).convert('RGB')

def save_maps(id,maps):
    record={}
    for kind,im in maps.items():
        path=OUT/f'{id}-{kind}.jpg';im.save(path,quality=92,subsampling=0,optimize=True)
        record[kind]='public/'+path.relative_to(ROOT/'public').as_posix()
    rough=maps['roughness'].convert('L')
    orm=Image.merge('RGB',(Image.new('L',rough.size,255),rough,Image.new('L',rough.size,0)))
    path=OUT/f'{id}-orm.jpg';orm.save(path,quality=94,subsampling=0,optimize=True)
    record['orm']='public/'+path.relative_to(ROOT/'public').as_posix()
    record['size']=list(maps['color'].size)
    return record

def main():
    assets=[]
    for file in ['realism-texture-provenance.json','realism-stone-provenance.json']:
        assets+=json.loads((ROOT/'assets-source'/file).read_text())['assets']
    scan_records={};material_records={}
    for asset in assets:
        id=asset['asset']['id'];maps=read_maps(asset);record=save_maps(id,maps)
        record.update(source=asset['asset']['url'],license='CC0-1.0',dimensions=asset['asset'].get('dimensions'))
        scan_records[id]=record
        for family,(source,repeat,strength) in MATERIALS.items():
            if source!=id:continue
            calibrated=dict(maps)
            if family not in {'oak','walnut','teak'}:
                calibrated['color']=neutral(maps['color'])
            rec=save_maps('material-'+family,calibrated)
            material_records[family]={'baseColor':rec['color'],'normal':rec['normal'],'roughness':rec['roughness'],
               'orm':rec['orm'],'repeatM':repeat,'normalStrength':strength,'grainAxis':'u' if family in {'walnut','teak'} else 'v',
               'source':record['source'],'license':'CC0-1.0'}
    # Shared neutral microstructure keeps legacy paint/fabric colors editable.
    for family,source,low,high in [('paint','painted_plaster_wall',236,252),('carpet','Carpet016',176,246)]:
        asset=next(a for a in assets if a['asset']['id']==source);maps=read_maps(asset)
        maps['color']=neutral(maps['color'],low,high);scan_records['neutral-'+family]=save_maps('neutral-'+family,maps)
    asset=next(a for a in assets if a['asset']['id']=='wooden_floor_02');maps=read_maps(asset)
    maps['color']=neutral(maps['color'],185,248)
    scan_records['bleached-floor']=save_maps('bleached-floor',maps)
    # Honed outdoor tops retain the scan variation without polished softbox glare.
    for family,source,minimum in [('limestone','Travertine009',158),('basalt','Marble012',158),('ceramic','Marble012',102)]:
        record=dict(scan_records[source]);orm=Image.open(ROOT/record['orm']).convert('RGB')
        r,g,b=orm.split();g=g.point(lambda value:max(value,minimum))
        path=OUT/f'material-honed-{family}-orm.jpg'
        Image.merge('RGB',(r,g,b)).save(path,quality=94,subsampling=0,optimize=True)
        record['orm']='public/'+path.relative_to(ROOT/'public').as_posix()
        scan_records['honed-'+family]=record
    manifest={'version':1,'materials':material_records}
    (ROOT/'assets-source/realism-materials.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (ROOT/'assets-source/realism-scans.json').write_text(json.dumps({'version':1,'scans':scan_records},indent=2)+'\n')
    total=sum(p.stat().st_size for p in OUT.iterdir())
    print(json.dumps({'scans':len(scan_records),'materialFamilies':len(material_records),'bytes':total}))

if __name__=='__main__':main()
