// @vitest-environment jsdom
import {beforeEach,it,expect} from 'vitest';
import {readAmbience,calendarDay,sceneForDay,HOME_AMBIENCE_KEY} from '../src/HomeAmbience';
beforeEach(()=>localStorage.clear());
it('starts at fireside and rotates on every second local calendar day',()=>{
 const p={anchor:calendarDay(new Date(2026,8,10)),pinned:null,paused:false};
 expect([0,1,2,3,4,5,6].map(n=>sceneForDay(p,p.anchor+n))).toEqual([0,0,1,1,2,2,0]);
 expect(calendarDay(new Date(2026,10,2))-calendarDay(new Date(2026,9,31))).toBe(2);
});
it('holds a manual background across days and restores stored pause state',()=>{
 const p={anchor:100,pinned:2,paused:true};localStorage.setItem(HOME_AMBIENCE_KEY,JSON.stringify(p));
 expect(readAmbience()).toEqual(p);expect(sceneForDay(readAmbience(),10000)).toBe(2);
});
it('rejects damaged or out-of-range stored preferences',()=>{
 localStorage.setItem(HOME_AMBIENCE_KEY,'{broken');expect(readAmbience().pinned).toBeNull();
 localStorage.setItem(HOME_AMBIENCE_KEY,JSON.stringify({anchor:'bad',pinned:7,paused:'yes'}));
 expect(readAmbience()).toEqual({anchor:calendarDay(),pinned:null,paused:false});
});
