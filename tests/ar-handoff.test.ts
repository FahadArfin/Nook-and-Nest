import {describe,it,expect} from 'vitest';
import {allowedArResource,arCatalogEntry,arHandoffUrl,arModels,arPieceFromSelection,arPieceFromUrl,arScale,decodeArPiece,encodeArPiece,validateArPiece,verifyArDimensions,type ArPiece} from '../src/arHandoff';
import {configurePieceViewer,type PieceModelViewer} from '../src/arModelViewer';
import {createPieceQr} from '../src/arQr';
const selected={catalogId:'sofa',widthMm:2400,depthMm:950,heightMm:900,variant:'moss',materialColors:{'upholstery-textured':'#805020'}};
describe('one-piece phone handoff',()=>{
  it('copies only an allowlisted catalog ID, physical dimensions and supported color factors',()=>{
    const privateSelection={...selected,id:'secret-placement',projectId:'secret-project',name:'private name',x:100,z:200,cloudSave:'secret-cloud'};
    const {piece}=arPieceFromSelection(privateSelection),link=arHandoffUrl(piece,'https://home.example/private/project?token=secret#plan=private');expect(Object.keys(piece)).toEqual(['v','model','widthMm','depthMm','heightMm','colors']);expect(link).toMatch(/^https:\/\/home\.example\/\?piece-preview=1#piece=/);expect(link).not.toMatch(/secret|private|project/);expect(arPieceFromUrl(link)).toEqual(piece);
    expect(()=>arPieceFromUrl(link.replace('?piece-preview=1','?piece-preview=1&project=secret'))).toThrow(/not a piece/);
  });
  it('rejects personal surfaces/items, arbitrary models, extra fields and unsupported texture tint',()=>{
    expect(()=>arPieceFromSelection({...selected,personalSurface:{image:'private-photo'}})).toThrow(/personal artwork/);expect(()=>arPieceFromSelection({...selected,personalItem:{private:'asset'}})).toThrow(/private item/);expect(()=>arPieceFromSelection({...selected,catalogId:'../../account'})).toThrow(/collection/);expect(()=>validateArPiece({...arPieceFromSelection(selected).piece,url:'https://evil.test/model.glb'})).toThrow(/invalid/);
    const entry=arCatalogEntry('nesting-tables');expect(entry.materials.some(m=>m.textured)).toBe(true);const out=arPieceFromSelection({...selected,catalogId:'nesting-tables',widthMm:620,depthMm:480,heightMm:560,materialColors:{'wood-honey-textured':'#ff0000'}});expect(out.piece.colors['wood-honey-textured']).toBeUndefined();expect(out.omissions.join(' ')).toContain('tint is not transferred');
  });
  it('bounds malformed links, dimensions and colors',()=>{
    const piece=arPieceFromSelection(selected).piece;expect(()=>decodeArPiece('a'.repeat(2401))).toThrow(/large/);expect(()=>decodeArPiece('not%base64')).toThrow(/invalid/);expect(()=>validateArPiece({...piece,widthMm:0})).toThrow(/dimensions/);expect(()=>validateArPiece({...piece,heightMm:Infinity})).toThrow(/dimensions/);expect(()=>validateArPiece({...piece,colors:{'upholstery-textured':[2,0,0]}})).toThrow(/color/);expect(()=>arHandoffUrl(piece,'http://insecure.example/path')).toThrow(/HTTPS/);
  });
  it('uses the audited X width, Y height, Z depth rather than a guessed millimetre conversion',()=>{
    const piece=arPieceFromSelection(selected).piece,scale=arScale(piece),size=arCatalogEntry(piece.model).authoredSizeM;expect(scale[0]*size[0]).toBeCloseTo(2.4,8);expect(scale[1]*size[1]).toBeCloseTo(.9,8);expect(scale[2]*size[2]).toBeCloseTo(.95,8);expect(verifyArDimensions(piece,{x:2.4,y:.9,z:.95})).toBe(true);expect(verifyArDimensions(piece,{x:2400,y:900,z:950})).toBe(false);expect(verifyArDimensions(piece,{x:2.4,y:.95,z:.9})).toBe(false);
  });
  it('keeps runtime geometry changes out of AR when measured dimensions disagree',async()=>{
    const piece=arPieceFromSelection({...selected,materialColors:{'modern-tailored-welting':'#805020'}}).piece,values:number[][]=[];const viewer={scale:'',updateComplete:Promise.resolve(true),updateFraming:()=>{},getDimensions:()=>({x:24,y:9,z:9.5}),model:{materials:[{name:'modern-tailored-welting',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],setBaseColorFactor:(v:number[])=>values.push(v)}}]}} as unknown as PieceModelViewer;
    await expect(configurePieceViewer(viewer,piece)).rejects.toThrow(/dimensions differ/);expect(values[0][3]).toBe(1);
  });
  it('blocks arbitrary and third-party resource URLs, while allowing local authored assets and local embedded images',()=>{
    expect(allowedArResource(arCatalogEntry('sofa').assetPath,'https://home.example')).toContain('/models/furniture/sofa.glb');expect(allowedArResource('data:image/png;base64,a','https://home.example')).toContain('data:image');expect(()=>allowedArResource('https://evil.example/model.glb','https://home.example')).toThrow(/unsupported/);expect(()=>allowedArResource('/api/projects','https://home.example')).toThrow(/unsupported/);expect(()=>allowedArResource('/models/furniture/../../api/projects','https://home.example')).toThrow(/unsupported/);
  });
  it('uses a local deterministic QR generator for the sanitized link',async()=>{
    const piece=arPieceFromSelection(selected).piece,link=arHandoffUrl(piece,'https://home.example'),qr=await createPieceQr(link);expect(qr).toEqual(await createPieceQr(link));expect(qr.size).toBeGreaterThan(21);expect(qr.path).toMatch(/^M\d+ \d+h1v1h-1z/);expect(qr.path).not.toContain('http');
  });
  it('has an explicit bounded pilot allowlist with independently measured source provenance',()=>{
    expect(Object.keys(arModels)).toHaveLength(20);for(const entry of Object.values(arModels)){expect(entry.authoredMinM[1]).toBeCloseTo(0,3);expect(entry.sourceSha256).toMatch(/^[a-f0-9]{64}$/);expect(entry.assetPath).toMatch(/^\/models\/furniture\/[a-z0-9-]+\.glb\?/);}
  });
});
