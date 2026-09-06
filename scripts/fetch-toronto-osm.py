"""Reproducible OSM waterfront context extract; no building duplication."""
import json, urllib.request, urllib.parse
from pathlib import Path
query = '''[out:json][timeout:180];(
way["highway"~"^(primary|secondary|tertiary|residential|pedestrian)$"](43.625,-79.425,43.675,-79.35);
way["natural"="coastline"](43.61,-79.44,43.69,-79.33);
way["leisure"="park"](43.625,-79.425,43.675,-79.35);
);out tags geom;'''
req=urllib.request.Request('https://overpass.kumi.systems/api/interpreter', data=urllib.parse.urlencode({'data':query}).encode(),headers={'User-Agent':'NookAndNestSceneryResearch/1.0'})
with urllib.request.urlopen(req,timeout=220) as response:
 data=json.load(response)
Path('assets-source/geodata/toronto-osm-context.json').write_text(json.dumps(data,separators=(',',':')),encoding='utf-8')
print('OSM context ways:',len(data.get('elements',[])))

