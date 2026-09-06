import urllib.request,urllib.parse,json
from pathlib import Path
q='[out:json][timeout:180];relation["natural"="water"]["name"="Lake Ontario"](43.5,-79.8,44,-78.8);out geom;'
r=urllib.request.Request('https://overpass.kumi.systems/api/interpreter',data=urllib.parse.urlencode({'data':q}).encode(),headers={'User-Agent':'NookAndNestSceneryResearch/1.0'})
with urllib.request.urlopen(r,timeout=220) as f:d=json.load(f)
Path('assets-source/geodata/toronto-osm-lake.json').write_text(json.dumps(d,separators=(',',':')),encoding='utf-8')
print('Lake relations:',len(d['elements']))

