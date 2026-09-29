import {expect,it,vi} from 'vitest';
// @ts-expect-error Worker entry is JavaScript.
import {analyzeRegions} from '../worker/region-review.js';
const review={version:'region-review-v1',room:'Bedroom',hall:'Hall',door:{ax:20,ay:20,bx:20,by:40},regions:[{id:'region-1',added:true,rects:[{x:20,y:10,width:20,height:20}]}],annotated:'data:image/jpeg;base64,YQ=='};
const answer={selectedIds:['region-1'],confidence:'high',note:'Open passage on the bedroom side.'};
const envelope=(value:unknown)=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});
it('limits Luna to candidate IDs and sends both source and annotated image without storage',async()=>{const fetcher=vi.fn(async(_url:string,_init:RequestInit)=>envelope(answer));expect(await analyzeRegions('data:image/jpeg;base64,YQ==',100,100,review,'test',fetcher)).toEqual(answer);const body=JSON.parse(fetcher.mock.calls[0][1].body as string);expect(body.model).toBe('gpt-6-luna');expect(body.store).toBe(false);expect(body.input[0].content.filter((c:{type:string})=>c.type==='input_image')).toHaveLength(2);expect(body.text.format.schema.properties.selectedIds.items.enum).toEqual(['region-1']);await expect(analyzeRegions('image',100,100,review,'test',async()=>envelope({...answer,selectedIds:['new-area']}))).rejects.toThrow();});
