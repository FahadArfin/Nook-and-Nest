"""Arrange unmodified catalog renders for review (no retouching)."""
import sys
from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[2]
ids=sys.argv[1:]
out=Image.new('RGB',(1440,320*((len(ids)+2)//3)),'#e9e7e1');draw=ImageDraw.Draw(out)
for j,id in enumerate(ids):
 im=Image.open(root/'assets-source/previews'/f'{id}.png').convert('RGBA');im.thumbnail((440,290));out.paste(im,((j%3)*480+20,(j//3)*320),im);draw.text(((j%3)*480+20,(j//3)*320+295),id,fill='black')
out.save(root/'.generated/studio-samples.jpg')
