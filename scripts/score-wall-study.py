"""Score private results only after inference; reference data never reaches the model."""
import json,statistics,sys
from pathlib import Path
import numpy as np
report=json.loads(Path(sys.argv[1]).read_text());root=Path(sys.argv[2]);rows=[]
for name in ['apartment','cross-hall','courtyard']:
    fixture=report['fixtures'][name];w,h=fixture['w'],fixture['h'];reference=fixture['reference'];kinds=sorted(set(r['kind'] for r in reference))
    for variant in ['baseline','upstream','supported','topology','topology-mask']:
        records=[]
        for path in sorted((root/name/variant).glob('run-*.json')):
            data=json.loads(path.read_text());result=data.get('result')
            if not result:continue
            scores={}
            for kind in kinds:
                masks=[]
                for rooms in [reference,result['rooms']]:
                    mask=np.zeros((h,w),bool)
                    for r in rooms:
                        if r['kind']!=kind:continue
                        if 'outline' in r:
                            xs=np.arange(w)[None,:]+.5;ys=np.arange(h)[:,None]+.5;poly=np.zeros((h,w),bool);points=r['outline']
                            for a,b in zip(points,points[1:]+points[:1]):
                                if a['y']!=b['y']:poly^=((a['y']>ys)!=(b['y']>ys))&(xs<(b['x']-a['x'])*(ys-a['y'])/(b['y']-a['y'])+a['x'])
                            mask|=poly
                        else:
                            x,y,rw,rh=[round(r[k]) for k in ['x','y','width','height']];mask[max(0,y):min(h,y+rh),max(0,x):min(w,x+rw)]=1
                    if name=='apartment' and kind=='Hall':mask[755:]=False
                    masks.append(mask)
                a,b=masks;scores[kind]=float((a&b).sum()/max(1,(a|b).sum()))
            cost=0
            for stage in data['stages']:
                u=stage['usage'];d=u.get('input_tokens_details',{});cached=d.get('cached_tokens',0);writes=d.get('cache_write_tokens',0);cost+=((u['input_tokens']-cached)*.2+cached*.02+writes*.05+u['output_tokens']*1.2)/1e6
            metric=(scores['Bedroom']+scores['Hall'])/2 if name=='apartment' else statistics.mean(scores.values())
            records.append(dict(run=data['run'],seconds=data['seconds'],estimatedUsd=cost,score=metric,perKind=scores))
        if records:rows.append(dict(fixture=name,variant=variant,metric='Bedroom/Hall IoU' if name=='apartment' else 'Macro kind IoU',mean=statistics.mean(r['score'] for r in records),minimum=min(r['score'] for r in records),maximum=max(r['score'] for r in records),seconds=statistics.mean(r['seconds'] for r in records),estimatedUsd=statistics.mean(r['estimatedUsd'] for r in records),runs=records))
(root/'scores.json').write_text(json.dumps(rows,indent=2));print(json.dumps([{k:v for k,v in row.items() if k!='runs'} for row in rows],indent=2))

