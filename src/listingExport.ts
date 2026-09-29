import { strToU8, zipSync } from 'fflate';
import { geometryKey, roomGroups } from './blueprint';
import { isDoor, isWallOpening } from './catalog';
import { formatLength } from './domain';
import { floorBoundaryWalls, floorRects } from './floorGeometry';
import { doorAperture } from './homeCollection';
import { MAX_LISTING_MEDIA, hasPairedOriginal, mediaLabels, type ListingDocument, type ListingMedia } from './listingTypes';
import { ringOf, shapeArea } from './polygonGeometry';
import type { FloorPlan, PlanDocumentV1 } from './types';
import { windowProblem } from './windows';

const MEASUREMENT_NOTE = 'Planning estimate from the editable design. Verify dimensions on site. Not an appraisal, survey or certified living-area measurement.';
const MEDIA_NOTE = 'Design renders and AI imagery illustrate possibilities; they are not photographs of the existing property. Review dimensions, permanent features and required local disclosures before publishing.';
const escapeHtml = (text: unknown) => String(text ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const jsonInHtml = (data: unknown) => JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
const number = (value: number) => Number(value.toFixed(2));
const slug = (text: string) => text.normalize('NFKD').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'listing';
const duration = (seconds: number) => Number.isFinite(seconds) ? Math.min(30, Math.max(2, seconds)) : 5;
const publicDetails = (doc: ListingDocument) => {
  const { title, address, price, beds, baths, area, highlights, description, agentName, agentEmail, agentPhone, agency } = doc.details;
  return { title, address, price, beds, baths, area, highlights, description, ...(doc.branded ? { agentName, agentEmail, agentPhone, agency } : {}) };
};

function decodeImage(image: string): { bytes: Uint8Array; extension: string } {
  const match = /^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/]+={0,2})$/.exec(image);
  if (!match || match[2].length % 4 !== 0) throw new Error('Listing images must be PNG, JPEG or WebP images.');
  if (match[2].length > 28_000_000) throw new Error('An image is too large to export. Use an image smaller than 20 MB.');
  const binary = atob(match[2]);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const valid = match[1] === 'png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
    : match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : binary.startsWith('RIFF') && binary.slice(8, 12) === 'WEBP';
  if (!valid) throw new Error('An image file is damaged or does not match its PNG, JPEG or WebP type.');
  return { bytes, extension: match[1] === 'jpeg' ? 'jpg' : match[1] };
}

/** Uses the same measured footprints and wall openings as the editor, in millimetres. */
export function listingFloorPlanSvg(plan: PlanDocumentV1, floor: FloorPlan): string {
  const rects = floorRects(floor, plan.gridSizeMm);
  const points = rects.flatMap(ringOf);
  const bounds = points.reduce((box, point) => ({ left: Math.min(box.left, point.x), right: Math.max(box.right, point.x), top: Math.min(box.top, point.z), bottom: Math.max(box.bottom, point.z) }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
  if (!points.length) Object.assign(bounds, { left: 0, right: 5000, top: 0, bottom: 3000 });
  const width = bounds.right - bounds.left, depth = bounds.bottom - bounds.top;
  const scale = Math.max(width / 900, depth / 640, 1), padding = scale * 80;
  const line = (x1: number, y1: number, x2: number, y2: number, attributes = '') => `<line x1="${number(x1)}" y1="${number(y1)}" x2="${number(x2)}" y2="${number(y2)}" ${attributes}/>`;
  const text = (x: number, y: number, content: string, size = 14, attributes = '') => `<text x="${number(x)}" y="${number(y)}" font-size="${number(size * scale)}" ${attributes}>${escapeHtml(content)}</text>`;
  const walls = [...floorBoundaryWalls(floor, plan.gridSizeMm), ...floor.walls];
  const wallLines = walls.map(w => line(w.ax * plan.gridSizeMm, w.az * plan.gridSizeMm, w.bx * plan.gridSizeMm, w.bz * plan.gridSizeMm)).join('');
  const openings: Array<{ x: number; z: number; ux: number; uz: number; width: number; kind: 'door' | 'window'; doorless?: boolean }> = [];
  for (const opening of floor.openings) {
    const wall = walls.find(w => w.id === opening.wallKey || `${w.ax}:${w.az}:${w.bx}:${w.bz}` === opening.wallKey);
    if (!wall) continue;
    const dx = wall.bx - wall.ax, dz = wall.bz - wall.az, length = Math.hypot(dx, dz);
    if (!length) continue;
    openings.push({ x: (wall.ax + dx * opening.offset) * plan.gridSizeMm, z: (wall.az + dz * opening.offset) * plan.gridSizeMm, ux: dx / length, uz: dz / length, width: opening.widthMm, kind: opening.kind });
  }
  for (const item of plan.furniture.filter(item => item.floorId === floor.id && isWallOpening(item.catalogId) && !windowProblem(plan, item))) {
    const angle = item.rotation * Math.PI / 180, ux = Math.cos(angle), uz = -Math.sin(angle);
    const aperture = doorAperture(item, true), offset = item.catalogId.startsWith('door-barn-') ? item.widthMm * .25 : 0;
    openings.push({ x: item.x + ux * offset, z: item.z + uz * offset, ux, uz, width: aperture.width, kind: isDoor(item.catalogId) ? 'door' : 'window', doorless: item.doorless });
  }
  const openingLines = openings.map(o => {
    const ax = o.x - o.ux * o.width / 2, az = o.z - o.uz * o.width / 2, bx = o.x + o.ux * o.width / 2, bz = o.z + o.uz * o.width / 2;
    const gap = line(ax, az, bx, bz, `stroke="#fff" stroke-width="${number(scale * 8)}"`);
    const symbol = o.kind === 'window' ? line(ax, az, bx, bz, `stroke="#397892" stroke-width="${number(scale * 2)}"`) : line(ax, az, bx, bz, `stroke="#916c39" stroke-width="${number(scale)}" stroke-dasharray="${number(scale * 5)} ${number(scale * 4)}"`);
    return `<g data-opening="${o.kind}" aria-label="${o.doorless ? 'Open entrance' : o.kind}">${gap}${symbol}</g>`;
  }).join('');
  const rooms = floor.blueprint?.geometryKey === geometryKey(floor) ? roomGroups(floor.blueprint.rooms) : [];
  const roomLabels = rooms.map(room => {
    const part = [...room.parts].sort((a, b) => shapeArea(b) - shapeArea(a))[0];
    const ring = ringOf(part), center = ring.reduce((p, next) => ({ x: p.x + next.x / ring.length, z: p.z + next.z / ring.length }), { x: 0, z: 0 });
    return text(center.x, center.z, room.name, 13, 'text-anchor="middle"');
  }).join('');
  const area = rects.reduce((total, rect) => total + shapeArea(rect), 0) / 1_000_000;
  const areaLabel = plan.units === 'metric' ? `${area.toFixed(1)} m²` : `${(area * 10.7639104).toFixed(0)} sq ft`;
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title description" viewBox="${number(bounds.left - padding)} ${number(bounds.top - padding * 1.6)} ${number(width + padding * 2)} ${number(depth + padding * 3.2)}">
<title id="title">${escapeHtml(floor.name)} — schematic floor plan</title><desc id="description">${escapeHtml(MEASUREMENT_NOTE)}</desc>
<rect x="${number(bounds.left - padding)}" y="${number(bounds.top - padding * 1.6)}" width="${number(width + padding * 2)}" height="${number(depth + padding * 3.2)}" fill="white"/>
<g font-family="Arial, sans-serif" fill="#22392f">${text(bounds.left, bounds.top - padding, floor.name, 23)}${text(bounds.left, bounds.top - padding * .58, points.length ? `Drawn floor footprint: ${areaLabel} · overall extents ${formatLength(width, plan.units)} × ${formatLength(depth, plan.units)}` : 'No measurements available until a floor is drawn.', 13)}
<g fill="#f3f2ed" data-layer="floor">${rects.map(rect => `<polygon points="${ringOf(rect).map(p => `${number(p.x)},${number(p.z)}`).join(' ')}"/>`).join('')}</g>
<g stroke="#22392f" stroke-width="${number(scale * 5)}" fill="none" stroke-linecap="butt" data-layer="walls">${wallLines}</g>${openingLines}${roomLabels}
${!points.length ? text(2500, 1500, 'No floor geometry drawn yet', 18, 'text-anchor="middle"') : ''}
${text(bounds.left, bounds.bottom + padding * .65, 'Blue: window · dashed: door / entrance · furniture omitted', 12)}
${text(bounds.left, bounds.bottom + padding, 'Planning estimate. Verify dimensions on site.', 12)}${text(bounds.left, bounds.bottom + padding * 1.3, 'Not an appraisal, survey or certified living-area measurement.', 11)}
</g></svg>`;
}

interface PackSlide { title: string; caption: string; label: string; kind: ListingMedia['kind']; seconds: number; path: string; sourcePath?: string; originalPath?: string; floor?: string }
const presentationCss = `:root{color-scheme:light;font-family:system-ui,sans-serif;color:#253b32;background:#f5f3ed}*{box-sizing:border-box}body{margin:0}main{max-width:1100px;padding:clamp(16px,4vw,48px);margin:auto}h1{font-family:Georgia,serif;font-size:clamp(28px,5vw,48px);margin:0 0 12px}h2{font-size:23px}p{line-height:1.6;white-space:pre-line}header{margin-bottom:24px}.facts{display:flex;flex-wrap:wrap;gap:12px}.facts span{padding:8px 14px;background:white;border:1px solid #d6ddd5;border-radius:8px}.stage{background:#14281f;border-radius:18px;overflow:hidden;position:relative;max-height:72vh;display:grid;place-items:center;margin:auto}.stage img{width:100%;height:100%;object-fit:contain;min-height:0}.disclosure{display:inline-block;background:#e6eddf;color:#233e2d;padding:6px 10px;border-radius:5px;font-size:13px}.controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:16px 0}button,.link{font:inherit;cursor:pointer;background:#fff;border:1px solid #b8c8bb;border-radius:8px;padding:11px 16px;color:#203e2d}button:hover,.link:hover{background:#e6eddf}button:focus-visible,a:focus-visible{outline:3px solid #8d682d;outline-offset:3px}button:disabled{opacity:.5;cursor:default}.primary{background:#284c3c;color:#fff}#count{margin-left:auto}.caption{min-height:50px}.note{font-size:13px;color:#506257}a{color:#285f47}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}figure{margin:0}figure img{width:100%;display:block;background:white;border-radius:10px}figcaption{font-size:13px;line-height:1.5;margin-top:7px}.floor{background:white;border-radius:12px;padding:10px}.contact{border-top:1px solid #cdd6ca;margin-top:28px;padding-top:15px}.contact p{margin:4px 0}.print-only{display:none}[hidden]{display:none!important}@media print{body{background:white}main{padding:0}.controls,.no-print{display:none!important}.print-only{display:block}.grid{grid-template-columns:1fr 1fr}figure,.floor{break-inside:avoid}h1{font-size:30px}a{color:inherit;text-decoration:none}.stage{max-height:350px}footer{font-size:11px}}`;
function detailsHtml(doc: ListingDocument): string {
  const d = publicDetails(doc), facts = [[d.price, ''], [d.beds, ' beds'], [d.baths, ' baths'], [d.area, '']].filter(([value]) => value !== '' && value != null);
  return `<header><h1>${escapeHtml(d.title || 'Property presentation')}</h1>${d.address ? `<p>${escapeHtml(d.address)}</p>` : ''}<div class="facts">${facts.map(([value, unit]) => `<span>${escapeHtml(value)}${unit}</span>`).join('')}</div></header>`;
}
function contactHtml(doc: ListingDocument): string {
  if (!doc.branded) return '';
  const d = doc.details, values = [d.agentName, d.agency, d.agentPhone, d.agentEmail].filter(Boolean);
  return values.length ? `<section class="contact" aria-label="Contact"><h2>Get in touch</h2>${values.map(value => `<p>${escapeHtml(value)}</p>`).join('')}</section>` : '';
}
function floorsHtml(floors: Array<{ name: string; path: string }>): string {
  return `<section><h2>Floor plans</h2><p class="note">${MEASUREMENT_NOTE}</p><div class="grid">${floors.map(floor => `<figure class="floor"><a href="${floor.path}" target="_blank" rel="noopener"><img src="${floor.path}" alt="${escapeHtml(floor.name)} floor plan" loading="lazy"/></a><figcaption>${escapeHtml(floor.name)}</figcaption></figure>`).join('')}</div></section>`;
}
function page(title: string, body: string, script = ''): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escapeHtml(title)}</title><style>${presentationCss}</style></head><body><main>${body}</main>${script}</body></html>`;
}
function slideshowHtml(doc: ListingDocument, slides: PackSlide[], floors: Array<{ name: string; path: string }>): string {
  const ratio = doc.format === 'portrait' ? '9/16' : doc.format === 'square' ? '1/1' : '16/9';
  const first = slides[0];
  const viewer = first ? `<section aria-label="Property slideshow"><div class="stage" id="stage" style="aspect-ratio:${ratio}"><img id="photo" src="${first.path}" alt="${escapeHtml(first.title)}"></div><div class="controls"><button id="previous" aria-label="Previous image">← Previous</button><button id="play" class="primary" aria-pressed="false">Play slideshow</button><button id="next" aria-label="Next image">Next →</button><span id="count" aria-live="polite">1 / ${slides.length}</span></div><span id="label" class="disclosure">${escapeHtml(first.label)}</span><button id="original" ${first.originalPath ? '' : 'hidden'}>Show original photo</button><div class="caption"><h2 id="title">${escapeHtml(first.title)}</h2><p id="caption">${escapeHtml(first.caption)}</p></div><p class="note">Use the arrow keys or swipe to browse. Space plays or pauses. Each slide uses its saved duration.</p></section>` : '<p>Add property photos or design renders to create a slideshow.</p>';
  const body = `${detailsHtml(doc)}${viewer}<section><h2>About the property</h2><p>${escapeHtml(doc.details.description)}</p>${doc.details.highlights ? `<p>${escapeHtml(doc.details.highlights)}</p>` : ''}</section>${floorsHtml(floors)}${contactHtml(doc)}<footer><p class="note">${MEDIA_NOTE}</p><p class="no-print"><a href="property-sheet.html">Open printable property sheet</a> · <a href="listing.txt" download>Download listing text</a></p></footer>`;
  const script = `<script type="application/json" id="slides">${jsonInHtml(slides)}</script><script>(()=>{
const slides=JSON.parse(document.getElementById('slides').textContent);if(!slides.length)return;
let index=0,playing=false,timer,showOriginal=false,touchX=null;
const byId=id=>document.getElementById(id),photo=byId('photo'),play=byId('play'),original=byId('original');
function schedule(){clearTimeout(timer);if(playing)timer=setTimeout(()=>{index=(index+1)%slides.length;showOriginal=false;render();schedule()},slides[index].seconds*1000)}
function setPlaying(value){playing=value;play.textContent=playing?'Pause slideshow':'Play slideshow';play.setAttribute('aria-pressed',String(playing));schedule()}
function render(){const slide=slides[index];photo.src=showOriginal&&slide.originalPath?slide.originalPath:slide.path;photo.alt=slide.title+(showOriginal?' — original photo':'');byId('title').textContent=slide.title;byId('caption').textContent=slide.caption;byId('label').textContent=showOriginal?'Original photo':slide.label;byId('count').textContent=(index+1)+' / '+slides.length;original.hidden=!slide.originalPath;original.textContent=showOriginal?'Show edited image':'Show original photo'}
function move(direction){index=(index+direction+slides.length)%slides.length;showOriginal=false;render();schedule()}
byId('previous').onclick=()=>move(-1);byId('next').onclick=()=>move(1);play.onclick=()=>setPlaying(!playing);original.onclick=()=>{showOriginal=!showOriginal;setPlaying(false);render()};
document.addEventListener('keydown',event=>{if(/INPUT|TEXTAREA|SELECT|BUTTON|A/.test(event.target.tagName))return;if(event.key==='ArrowRight'){event.preventDefault();move(1)}if(event.key==='ArrowLeft'){event.preventDefault();move(-1)}if(event.code==='Space'){event.preventDefault();setPlaying(!playing)}});
byId('stage').addEventListener('touchstart',event=>{touchX=event.touches.length===1?event.touches[0].clientX:null},{passive:true});byId('stage').addEventListener('touchend',event=>{if(touchX!==null&&event.changedTouches.length){const dx=event.changedTouches[0].clientX-touchX;if(Math.abs(dx)>50)move(dx<0?1:-1)}touchX=null},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)setPlaying(false)});if(slides.length===1){byId('previous').disabled=true;byId('next').disabled=true;play.disabled=true}
})();</script>`;
  return page(doc.details.title || 'Property presentation', body, script);
}

/** Pure export builder: private references, raw plan backups and account data are never copied. */
export function buildListingPackFiles(doc: ListingDocument, plan: PlanDocumentV1): Record<string, Uint8Array> {
  if (doc.planId !== plan.id) throw new Error('Open the matching home before exporting this listing.');
  if (doc.media.length > MAX_LISTING_MEDIA) throw new Error(`Export up to ${MAX_LISTING_MEDIA} images in one listing pack.`);
  const files: Record<string, Uint8Array> = {}, slides: PackSlide[] = [];
  let byteCount = 0;
  const addImage = (image: string, stem: string) => {
    const decoded = decodeImage(image); byteCount += decoded.bytes.length;
    if (byteCount > 160_000_000) throw new Error('This pack is too large. Export fewer or smaller images.');
    const path = `media/${stem}.${decoded.extension}`; files[path] = decoded.bytes; return path;
  };
  doc.media.forEach((media, index) => {
    const stem = `${String(index + 1).padStart(2, '0')}-${slug(media.title)}`;
    const path = addImage(media.image, `${stem}-${media.kind}`);
    const sourcePath = media.sourceImage ? addImage(media.sourceImage, `${stem}-source`) : undefined;
    const originalPath = hasPairedOriginal(media) ? addImage(media.originalImage!, `${stem}-original`) : undefined;
    slides.push({ title: media.title, caption: media.caption, label: mediaLabels[media.kind], kind: media.kind, seconds: duration(media.seconds), path, ...(sourcePath ? { sourcePath } : {}), ...(originalPath ? { originalPath } : {}), ...(media.floorId ? { floor: plan.floors.find(floor => floor.id === media.floorId)?.name } : {}) });
  });
  const floors = plan.floors.map((floor, index) => {
    const path = `floorplans/${String(index + 1).padStart(2, '0')}-${slug(floor.name)}.svg`;
    files[path] = strToU8(listingFloorPlanSvg(plan, floor)); return { name: floor.name, path };
  });
  const d = publicDetails(doc);
  const text = [d.title, d.address, d.price, d.beds !== '' ? `${d.beds} beds` : '', d.baths !== '' ? `${d.baths} baths` : '', d.area ? `Area supplied by agent: ${d.area}` : '', d.description, d.highlights, ...(doc.branded ? [doc.details.agentName, doc.details.agency, doc.details.agentPhone, doc.details.agentEmail] : []), '', 'MEDIA DISCLOSURES', ...slides.map((slide, i) => `${i + 1}. ${slide.title}: ${slide.label}${slide.caption ? ` — ${slide.caption}` : ''}${slide.originalPath ? ` (original: ${slide.originalPath})` : ''}`), '', MEDIA_NOTE, MEASUREMENT_NOTE].filter(value => value != null).join('\n');
  files['listing.txt'] = strToU8(text);
  files['index.html'] = strToU8(slideshowHtml(doc, slides, floors));
  const sheet = `${detailsHtml(doc)}<p>${escapeHtml(d.description)}</p><p>${escapeHtml(d.highlights)}</p><div class="grid">${slides.map(slide => `<figure><img src="${slide.path}" alt="${escapeHtml(slide.title)}"><figcaption><strong>${escapeHtml(slide.title)}</strong> · ${escapeHtml(slide.label)}<br>${escapeHtml(slide.caption)}</figcaption></figure>${slide.originalPath ? `<figure><img src="${slide.originalPath}" alt="${escapeHtml(slide.title)} original photo"><figcaption>${escapeHtml(slide.title)} · Original photo</figcaption></figure>` : ''}`).join('')}</div>${floorsHtml(floors)}${contactHtml(doc)}<footer><p class="note">${MEDIA_NOTE}</p><p class="no-print">Use your browser’s Print command to print or save this property sheet as PDF. <a href="index.html">Return to slideshow</a></p></footer>`;
  files['property-sheet.html'] = strToU8(page(d.title || 'Property sheet', sheet));
  files['provenance.json'] = strToU8(JSON.stringify({ version: 1, details: d, branded: doc.branded, format: doc.format, updatedAt: doc.updatedAt, media: slides, floors, measurementNote: MEASUREMENT_NOTE, mediaNote: MEDIA_NOTE }, null, 2));
  files['seedance-storyboard.txt'] = strToU8([
    'SEEDANCE / VIDEO EDITOR STORYBOARD', 'This is an export for a separate video service, not a generated video. No images have been sent to an AI provider.',
    `Property: ${d.title}`, `Format: ${doc.format === 'portrait' ? '9:16' : doc.format === 'square' ? '1:1' : '16:9'}`, `Suggested sequence duration: ${slides.reduce((total, slide) => total + slide.seconds, 0)} seconds`,
    '', 'CREATIVE DIRECTION', 'Produce a calm property presentation with restrained camera motion and photorealistic furniture materials. Preserve the source room dimensions, wall positions, doors, windows, fixtures, furniture placement and exterior views. Never invent rooms, widen spaces, remove defects or imply unverified renovations. Treat each image as an independent shot; do not invent a continuous path between unrelated rooms.',
    'Where the input is a 3D render, identify the output as a concept visualization. Keep virtual staging disclosed on every altered shot. Use only supplied property facts. No people, logos, third-party music or new text unless separately provided and licensed.',
    '', 'SHOT LIST', ...slides.flatMap((slide, index) => [`${index + 1}. ${slide.path} — ${slide.seconds}s`, `Title: ${slide.title}`, `Caption: ${slide.caption}`, `Disclosure: ${slide.label}`, ...(slide.originalPath ? [`Original reference: ${slide.originalPath}`] : [])]),
    '', 'REVIEW BEFORE PUBLISHING', 'Compare every generated clip with its source. Reject changes to structure, dimensions, condition or permanent features. Keep original photos with staged images. Confirm image rights and local listing-platform requirements. Add approved narration/captions, review the complete video, then publish manually.',
    ...(doc.branded ? ['', 'OPTIONAL CLOSING CARD', ...[doc.details.agentName, doc.details.agency, doc.details.agentPhone, doc.details.agentEmail].filter(Boolean)] : ['', 'UNBRANDED OUTPUT', 'Do not add agent, brokerage, logo, phone, email or promotional closing cards.']),
  ].join('\n'));
  files['README.txt'] = strToU8('LISTING MEDIA PACK\n\nExtract the entire ZIP into one folder, then open index.html for the offline slideshow. Keep the media and floorplans folders alongside it. The presentation needs no account, server or internet connection. Use property-sheet.html and your browser Print command for a PDF.\n\nMedia files are the selected source images, with paired originals when supplied. Captions and disclosures are in listing.txt and provenance.json; image pixels are not stamped with a watermark by this export. Keep these disclosures when uploading.\n\nseedance-storyboard.txt is a ready-to-review brief for a separate video service. It does not contain a generated video.\n\nUnbranded packs omit the dedicated agent/contact fields. Review free-form text and uploaded images for baked-in logos or contact details before sharing. Local MLS requirements vary; this pack is not a compliance certification.\n\n' + MEDIA_NOTE + '\n' + MEASUREMENT_NOTE);
  return files;
}

export async function exportListingPack(doc: ListingDocument, plan: PlanDocumentV1): Promise<void> {
  const files = buildListingPackFiles(doc, plan);
  // Media is already compressed. Store it unchanged to avoid wasting time and image fidelity.
  const zip = zipSync(files, { level: 0 });
  const url = URL.createObjectURL(new Blob([new Uint8Array(zip)], { type: 'application/zip' }));
  const link = document.createElement('a'); link.href = url; link.download = `${slug(doc.details.title || plan.name)}-${doc.branded ? 'branded' : 'unbranded'}-listing.zip`;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
