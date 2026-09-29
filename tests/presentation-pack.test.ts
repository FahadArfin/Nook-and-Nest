// @vitest-environment jsdom
import {webcrypto} from 'node:crypto';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createSamplePlan,rectangleCells} from '../src/domain';
import {createListing} from '../src/listingTypes';
import {defaultPresentation,loadBrandTemplates,parsePresentationSettings,saveBrandTemplate} from '../src/presentationTypes';
import {buildPresentationPack} from '../src/presentationPack';
import {defaultSpecification} from '../src/selectionSchedule';
import type {PersonalPhotoAsset} from '../src/personalMedia';
import type {MoodboardPlan} from '../src/moodboards';
import type {SurveyPlan} from '../src/siteSurvey';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQJ8AAAAASUVORK5CYII=';
const original='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgQIAZ+X6WQAAAABJRU5ErkJggg==';
const date='2026-09-29T00:00:00.000Z';
function plan():SurveyPlan&MoodboardPlan{const p=createSamplePlan('Home','metric');p.gridSizeMm=1000;p.furniture=[];p.floors=[{...p.floors[0],id:'floor',cells:rectangleCells(4,3),walls:[{id:'w',ax:1,az:0,bx:1,bz:2}],openings:[],stairs:[]}];return p;}
async function asset():Promise<PersonalPhotoAsset>{const bytes=Uint8Array.from(atob(original.split(',')[1]),c=>c.charCodeAt(0)),hash=Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');return {version:1,id:'sha256:'+hash,original,preview:image,width:1,height:1,createdAt:date};}
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});
describe('reviewed presentation snapshots',()=>{
  it('strips dedicated unbranded contact fields and raw originals across every file while escaping text',async()=>{
    const p=plan(),listing=createListing(p.id,'Listing');listing.details.agentName='PRIVATE AGENT';listing.details.agency='PRIVATE BROKER';listing.media=[{id:'shot',title:'<img onerror=bad()>',caption:'Owner-provided facts <script>bad()</script>',kind:'staged',image,sourceImage:original,originalImage:original,seconds:5}];
    const settings={...defaultPresentation(),floorIds:['floor'],listingMediaIds:['shot'],brand:{name:'SECRET NAME',organization:'SECRET FIRM',contact:'SECRET PHONE',accent:'#426653'}};
    const result=await buildPresentationPack(p,listing,settings,{generatedAt:date}),contents=Object.values(result.files).map(f=>new TextDecoder().decode(f)).join('\n');expect(contents).not.toMatch(/PRIVATE AGENT|PRIVATE BROKER|SECRET NAME|SECRET FIRM|SECRET PHONE/);expect(contents).not.toContain(original);expect(result.html).toContain('Virtually staged');expect(result.html).toContain('Caption is author-supplied');const doc=new DOMParser().parseFromString(result.html,'text/html');expect(doc.querySelectorAll('script,img[onerror]')).toHaveLength(0);expect(doc.querySelectorAll('section.page footer')).toHaveLength(result.pageCount);expect([...doc.querySelectorAll('footer')].every(f=>f.textContent?.includes(result.revision))).toBe(true);
    const branded=await buildPresentationPack(p,listing,{...settings,branded:true},{generatedAt:date});expect(branded.html).toContain('SECRET FIRM');expect(branded.html).not.toContain('PRIVATE BROKER');
  });
  it('loads only separately opted-in private images and includes previews, never originals or hidden notes',async()=>{
    vi.stubGlobal('crypto',webcrypto);const a=await asset(),p=plan();p.moodboards={version:1,boards:[{id:'board',name:'Warm room',createdAt:date,updatedAt:date,pins:[{id:'pin',kind:'image',assetId:a.id,label:'Fabric',sourceUrl:'https://private.example/source'}],palette:[],bindings:[]}]};p.siteSurvey={version:1,areas:[],notes:[{id:'note',target:{kind:'wall',floorId:'floor',id:'w'},title:'Wall photo',text:'VISIBLE SURVEY',photoAssetIds:[a.id],checks:[]},{id:'hidden',target:{kind:'wall',floorId:'floor',id:'w'},title:'Hidden',text:'DO NOT EXPORT',photoAssetIds:['sha256:'+'1'.repeat(64)],checks:[]}]};
    const loader=vi.fn(async()=>a),settings={...defaultPresentation(),boardIds:['board'],surveyNoteIds:['note']};const safe=await buildPresentationPack(p,undefined,settings,{loadPhoto:loader});expect(loader).not.toHaveBeenCalled();expect(safe.html).not.toContain(image);expect(safe.html).not.toContain('DO NOT EXPORT');
    const selected=await buildPresentationPack(p,undefined,{...settings,includeBoardImages:true},{loadPhoto:loader});expect(loader).toHaveBeenCalledTimes(1);expect(selected.assets).toHaveLength(1);expect(selected.html).toContain(image);expect(selected.html).not.toContain(original);expect(selected.html).not.toContain('private.example');expect(selected.html).toContain('Private survey photos omitted');
  });
  it('keeps missing media visible, refuses cross-project listing data and cancels delayed loads',async()=>{
    const p=plan(),id='sha256:'+'a'.repeat(64);p.moodboards={version:1,boards:[{id:'b',name:'Board',createdAt:date,updatedAt:date,palette:[],bindings:[],pins:[{id:'p',kind:'image',assetId:id,label:'Missing photo'}]}]};const s={...defaultPresentation(),boardIds:['b','removed'],layoutIds:['removed'],listingMediaIds:['missing'],includeBoardImages:true};const result=await buildPresentationPack(p,undefined,s,{loadPhoto:async()=>undefined});expect(result.warnings.join(' ')).toContain('Restore');expect(result.warnings.join(' ')).toContain('not substituted');expect(result.assets[0].image).toBeUndefined();await expect(buildPresentationPack(p,createListing('other','Other'),s)).rejects.toThrow(/another project/);
    let resolve!:(v:undefined)=>void;const controller=new AbortController(),running=buildPresentationPack(p,undefined,s,{signal:controller.signal,loadPhoto:()=>new Promise(r=>resolve=r)});controller.abort();resolve(undefined);await expect(running).rejects.toMatchObject({name:'AbortError'});
  });
  it('uses a fixed chosen snapshot and keeps prices and product URLs opt-in with separate currency totals',async()=>{
    const p=plan();p.furniture=[{id:'chair',catalogId:'armchair',floorId:'floor',x:2000,z:1500,rotation:0,widthMm:800,depthMm:800,heightMm:900,variant:'cream',specification:{...defaultSpecification(),productName:'=HYPERLINK("bad")',productUrl:'https://private.example/product',currency:'USD',unitPriceMinor:12500,checkedOn:'2026-09-29'}},{id:'other',catalogId:'armchair',floorId:'floor',x:3000,z:1500,rotation:0,widthMm:800,depthMm:800,heightMm:900,variant:'cream',specification:{...defaultSpecification(),currency:'CAD',unitPriceMinor:9000,checkedOn:'2026-09-29'}}];const settings={...defaultPresentation(),floorIds:['floor'],includeSchedule:true};const safe=await buildPresentationPack(p,undefined,settings,{generatedAt:date});expect(safe.html).not.toContain('USD');expect(safe.html).not.toContain('private.example');
    const full=await buildPresentationPack(p,undefined,{...settings,includePrices:true,includeProductSources:true},{generatedAt:date});expect(full.html).toContain('USD');expect(full.html).toContain('CAD');expect(full.html).toContain('125.00');const csv=new TextDecoder().decode(full.files['selections.csv']);expect(csv).toContain('"\'=HYPERLINK(""bad"")"');expect(csv).toContain('12500');expect(full.revision).toBe(safe.revision);
  });
  it('validates explicit bounded choices and saves reusable templates only on an explicit successful write',()=>{
    expect(()=>parsePresentationSettings({...defaultPresentation(),brand:{name:'',organization:'',contact:'',accent:'red;background:url(evil)'}})).toThrow();expect(()=>parsePresentationSettings({...defaultPresentation(),layoutIds:Array.from({length:7},(_,i)=>String(i))})).toThrow();const template={version:1 as const,id:'studio',name:'Studio',brand:{name:'Me',organization:'Firm',contact:'Phone',accent:'#334455'}};expect(loadBrandTemplates()).toEqual([]);saveBrandTemplate(template);expect(loadBrandTemplates()).toEqual([template]);expect(()=>saveBrandTemplate(template,{getItem:()=>null,setItem:()=>{throw new Error('storage full')}})).toThrow('storage full');
  });
});
