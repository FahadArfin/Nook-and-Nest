import './realism-lab.css';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { HDRCubeTexture } from '@babylonjs/core/Materials/Textures/hdrCubeTexture';
import type { Material } from '@babylonjs/core/Materials/material';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { MeshoptCompression } from '@babylonjs/core/Meshes/Compression/meshoptCompression';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { preserveCatalogCoordinates } from '../scene/planCoordinates';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/loaders/glTF/2.0';

type Family = 'sectional' | 'sofa' | 'table';
type VariantId = 'sofa-sectional-current' | 'sofa-sectional-rebuilt' | 'sofa-current' | 'sofa-material' | 'sofa-refined' | 'sofa-pipeline' | 'sofa-rebuilt' | 'table-current' | 'table-material' | 'table-refined';
type Dimensions = { width: number; depth: number; height: number };
type VariantResult = {
  id: VariantId; label?: string; note?: string; dimensionsMm?: Dimensions;
  triangles?: number; bytes?: number; materialKeys?: string[]; tintMaterialKeys?: string[]; findings?: string[];
};
type Results = { version: 1; generatedAt?: string; summary?: string; variants: VariantResult[]; notes?: string[] };
type Variant = { id: VariantId; family: Family; label: string; caption: string; note: string; dimensionsMm?: Dimensions };
const ASSETS = '/experiments/realism-lab/';
const SECTIONAL_DIMENSIONS: Dimensions = { width: 2800, depth: 2200, height: 930 };
const FAMILY_DEFAULTS: Record<Family, { variant: VariantId; tint: string | null; label: string }> = {
  sectional: { variant: 'sofa-sectional-rebuilt', tint: '#5f6465', label: 'Sectional' },
  sofa: { variant: 'sofa-rebuilt', tint: '#405e42', label: 'Sofa' },
  table: { variant: 'table-current', tint: null, label: 'Table' },
};
const VARIANTS: Variant[] = [
  { id: 'sofa-sectional-current', family: 'sectional', label: 'Before', caption: 'Original sectional export', dimensionsMm: SECTIONAL_DIMENSIONS, note: 'The unchanged everyday track-arm sectional export. Both versions use the same catalog dimensions, blue-grey upholstery tint, lighting and camera view.' },
  { id: 'sofa-sectional-rebuilt', family: 'sectional', label: 'After', caption: 'Sectional study', dimensionsMm: SECTIONAL_DIMENSIONS, note: 'A new Blender construction study of the same L-shaped sectional. Compare the cushion shape, fabric response, seams and supporting frame using the same view and upholstery color.' },
  { id: 'sofa-current', family: 'sofa', label: 'Current', caption: 'Original export', note: 'The current exported mesh and fabric response, with the same catalog upholstery tint used by every sofa version.' },
  { id: 'sofa-material', family: 'sofa', label: 'Calibrated fabric', caption: 'Same mesh · corrected sheen', note: 'The current sofa geometry with calibrated exported fabric sheen. This control separates material response from the geometry changes.' },
  { id: 'sofa-refined', family: 'sofa', label: 'Reference assisted', caption: 'Geometry + materials', note: 'An original Blender study informed by a generated visual reference. Dimensions are checked independently of the image.' },
  { id: 'sofa-pipeline', family: 'sofa', label: 'Previous study', caption: 'Detailed construction · rated 4/10', note: 'The previous detailed study, kept unchanged for comparison. Fine surface detail was baked onto a separate browser mesh.' },
  { id: 'sofa-rebuilt', family: 'sofa', label: 'Realism revision', caption: 'Shaped cushions · woven wool · sculpted oak', note: 'Six individually shaped cushions, inclined back pillows, sewn edges and a rebuilt timber frame. Photographed wool and oak retain their physical texture scale. Compare with Previous study using the same view.' },
  { id: 'table-current', family: 'table', label: 'Current', caption: 'Catalog baseline', note: 'The current catalog table, with its exported geometry and materials.' },
  { id: 'table-material', family: 'table', label: 'Materials only', caption: 'Surface study', note: 'A material treatment of the existing table. Compare grain, roughness, and light response before assessing the geometry study.' },
  { id: 'table-refined', family: 'table', label: 'Construction detail', caption: 'Construction study', note: 'An original Blender construction study. Look at the edges, joinery, and silhouette from several angles.' },
];
const app = document.querySelector<HTMLDivElement>('#model-lab')!;
app.innerHTML = `
  <header class="lab-header">
    <a class="brand" href="/" aria-label="Return to Nook and Nest"><span class="brand-mark" aria-hidden="true">n.</span><span>Nook & Nest<span class="brand-subtitle">THE MODEL WORKSHOP</span></span></a>
    <span class="beta-badge"><i aria-hidden="true"></i> Beta 1 · Experimental</span>
  </header>
  <main class="lab-layout">
    <section class="viewer-panel" aria-label="Interactive furniture model">
      <div class="viewer-heading"><div><span class="eyebrow">THE DETAIL PIPELINE</span><h1>Built up close.</h1></div><p>Turn it around.<br>See what holds up.</p></div>
      <div class="canvas-wrap" id="canvas-wrap">
        <canvas id="model-canvas" tabindex="0" aria-label="3D furniture preview. Drag to orbit, scroll or pinch to zoom. Use the view buttons for fixed angles."></canvas>
        <div class="model-caption"><span id="model-caption">Catalog baseline</span><span class="render-indicator" id="render-indicator">Starting renderer</span></div>
        <div class="load-message" id="load-message" role="status" aria-live="polite"><span id="load-text">Preparing the model…</span><button type="button" id="retry-load" hidden>Try again</button></div>
        <div class="camera-controls" role="group" aria-label="Camera views">
          <button type="button" data-view="overview" aria-pressed="true">Overview</button><button type="button" data-view="front" aria-pressed="false">Front</button><button type="button" data-view="rear" aria-pressed="false">Rear</button><button type="button" data-view="detail" aria-pressed="false">Detail</button><button type="button" data-view="underside" aria-pressed="false">Under</button>
        </div>
      </div>
      <div class="viewer-footer"><span><span aria-hidden="true">↔</span> Drag to orbit · scroll or pinch to zoom</span><span>Live 3D mesh</span></div>
    </section>
    <aside class="controls-panel" aria-label="Comparison controls">
      <div class="study-heading"><span class="eyebrow">FURNITURE STUDIES / 01—03</span><h2>Compare the craft</h2><p>One piece, the same view. <br>Switch versions to judge the change.</p></div>
      <section class="control-section"><h3>01 <span>Choose a piece</span></h3><div class="family-switch" role="group" aria-label="Furniture family"><button type="button" data-family="sectional" aria-pressed="true">Sectional</button><button type="button" data-family="sofa" aria-pressed="false">Sofa</button><button type="button" data-family="table" aria-pressed="false">Table</button></div></section>
      <section class="control-section"><h3>02 <span>Compare versions</span></h3><div class="variant-list" id="variant-list" role="group" aria-label="Model version"></div><p class="variant-note" id="variant-note"></p></section>
      <section class="control-section"><h3>03 <span>Look beneath the finish</span></h3>
        <div class="select-row"><label for="lighting">Lighting</label><select id="lighting"><option value="neutral">Neutral studio</option><option value="app">Nook & Nest day</option></select></div>
        <p class="lighting-note" id="lighting-note" role="status">Preparing the studio lighting…</p>
        <div class="inspection-toggles"><label><input type="checkbox" id="clay"/><span>Clay surface</span></label><label><input type="checkbox" id="wireframe"/><span>Wireframe</span></label><label><input type="checkbox" id="surface-detail" checked/><span>Surface normals</span></label></div>
        <fieldset class="tint-controls"><legend id="tint-label">Upholstery</legend><div id="color-swatches" class="color-swatches"></div><p id="tint-note">Catalog blue-grey is applied equally to both sectional versions.</p></fieldset>
      </section>
      <section class="control-section measurement-section"><h3>04 <span>Measured, not imagined</span></h3><dl class="measurements"><div class="wide"><dt>Loaded mesh · W × D × H</dt><dd id="mesh-dimensions">—</dd></div><div class="wide" id="envelope-row" hidden><dt>Catalog envelope · W × D × H</dt><dd id="catalog-dimensions">—</dd></div><div><dt>Triangles</dt><dd id="triangle-count">—</dd></div><div><dt>GLB size</dt><dd id="download-size">—</dd></div><div><dt>Mesh parts</dt><dd id="mesh-count">—</dd></div><div><dt>Fetch + decode</dt><dd id="load-time">—</dd></div></dl><p class="measurement-note">Measured from the loaded GLB. Load time reflects this browser and cache, not a performance benchmark.</p><ul id="findings" class="findings" hidden></ul></section>
      <details class="reference-details pipeline-details" id="pipeline-details" open><summary>How this model is made <span aria-hidden="true">↗</span></summary><ol><li><strong>Measure.</strong> Fix dimensions, material names and contact points.</li><li><strong>Construct.</strong> Keep the frame, cushion shapes and seams editable.</li><li><strong>Bake.</strong> Transfer fine detail from the master onto the browser mesh.</li><li><strong>Inspect.</strong> Check the exported geometry, maps and five rendered views.</li></ol><p id="pipeline-evidence" class="measurement-note">Loading the build record…</p><p class="measurement-note">Surface normals changes the lighting detail without changing the mesh. Use clay and the underside view to inspect construction.</p></details>
      <details class="reference-details" id="rebuilt-details" open><summary>What changed <span aria-hidden="true">↗</span></summary><ol><li><strong>Shape.</strong> Individually crowned cushions, relaxed seams and inclined back pillows.</li><li><strong>Construction.</strong> Shaped armrests, splayed legs and separate timber members.</li><li><strong>Texture.</strong> Photographed wool and oak at measured scale, with surface detail retained in the browser export.</li></ol><p id="rebuilt-evidence" class="measurement-note">Loading the revision record…</p><p class="measurement-note">An original study informed by <a href="https://www.carlhansen.com/en/en/collection/sofas-daybeds/ch293" target="_blank" rel="noreferrer">solid-oak sofa construction</a>. Your next rating will determine how close it comes.</p></details>
      <details class="reference-details pipeline-details" id="sectional-details" open><summary>How this study is made <span aria-hidden="true">↗</span></summary><ol><li><strong>Research and measure.</strong> Study real sectional construction and several views, while preserving the original 2800 × 2200 × 930 mm catalog envelope.</li><li><strong>Construct the shape.</strong> Model the frame, individual cushions, compression, seams and feet in editable Blender geometry.</li><li><strong>Calibrate fabric scale.</strong> Repeat licensed color, roughness and normal maps at a calibrated fabric scale, retaining fine surface detail in the GLB.</li><li><strong>Review the export.</strong> Inspect clay, close-up, rear and underside views, then compare the actual browser model under identical lighting.</li><li><strong>Validate and publish.</strong> Check dimensions, material controls and browser costs, run the release tests, then publish the experiment to Beta.</li></ol><p id="sectional-evidence" class="measurement-note">Loading the sectional build record…</p><p class="measurement-note">Generated images can guide the design; measured references establish dimensions. The Before version is preserved for comparison. Your rating judges the result.</p></details>
      <details class="reference-details" id="reference-details"><summary>See the visual reference <span aria-hidden="true">↗</span></summary><figure><img src="${ASSETS}sofa-reference.png" alt="Generated multi-view sofa design reference used for the reference-assisted Blender study" loading="lazy"/><figcaption>AI-generated concept reference. This image guides the design; it does not prove dimensions or multi-view accuracy.</figcaption></figure></details>
      <p class="isolation-note">A separate Beta 1 experiment. These controls only affect this preview; your home and saved projects stay as they are.</p>
      <p id="metadata-note" class="metadata-note" role="status"></p>
    </aside>
  </main>`;

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = element<HTMLCanvasElement>('model-canvas');
const message = element<HTMLDivElement>('load-message');
let family: Family = 'sectional';
let selected: VariantId = FAMILY_DEFAULTS.sectional.variant;
let results: Results | null = null;
let container: AssetContainer | null = null;
let disposed = false;
let requestId = 0;
let activeRequest: AbortController | null = null;
let loadQueue: Promise<void> = Promise.resolve();
let frame = 0;
let renderUntil = 0;
let visible = true;
let boundsCenter = new Vector3(0, .45, 0);
let boundsSize = new Vector3(2.4, .9, 1);
let loadedFamily: Family | null = null;
let activeTint: string | null = FAMILY_DEFAULTS.sectional.tint;
const pointers = new Set<number>();
const originalMaterials = new Map<AbstractMesh, Material | null>();
const originalColors = new Map<PBRMaterial, Color3>();
const formatNumber = new Intl.NumberFormat('en-US');

// The main application hosts this pinned decoder locally as well.
MeshoptCompression.Configuration = { decoder: { url: '/vendor/meshopt-decoder-1.2.0.js' } };

async function start() {
  if (!Engine.isSupported()) {
    element('load-text').textContent = 'This browser cannot start WebGL. Try a browser with hardware-accelerated 3D enabled.';
    return;
  }
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, powerPreference: 'low-power' }, false);
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  const camera = new ArcRotateCamera('lab-camera', Math.PI * .68, 1.12, 4.1, boundsCenter, scene);
  camera.attachControl(canvas, true);
  camera.minZ = .01;
  camera.lowerRadiusLimit = .25;
  camera.upperRadiusLimit = 12;
  camera.lowerBetaLimit = .08;
  camera.upperBetaLimit = Math.PI / 2 - .025;
  camera.wheelDeltaPercentage = .012;
  camera.pinchDeltaPercentage = .01;
  camera.panningSensibility = 900;
  camera.inertia = .72;
  const sky = new HemisphericLight('sky', new Vector3(.2, 1, .1), scene);
  const sun = new DirectionalLight('sun', new Vector3(-.8, -1.5, .7), scene);
  sun.position = new Vector3(10, 18, -10);
  const shadow = new ShadowGenerator(1024, sun);
  shadow.useBlurExponentialShadowMap = true;
  shadow.blurKernel = 24;
  shadow.setDarkness(.3);
  const ground = MeshBuilder.CreateGround('studio-ground', { width: 100, height: 100 }, scene);
  ground.position.y = -.006;
  ground.isPickable = false;
  ground.receiveShadows = true;
  const groundMaterial = new PBRMaterial('studio-floor', scene);
  groundMaterial.albedoColor = new Color3(.23, .22, .20);
  groundMaterial.metallic = 0;
  groundMaterial.roughness = 1;
  groundMaterial.environmentIntensity = .65;
  ground.material = groundMaterial;
  const clayMaterial = new StandardMaterial('inspection-clay', scene);
  // StandardMaterial accepts display-space diffuse colors; PBR tints below are linear.
  clayMaterial.diffuseColor = Color3.FromHexString('#c8c3b7');
  clayMaterial.specularColor = new Color3(.06, .06, .06);
  let studioEnvironment: HDRCubeTexture | null = null;
  let environmentReady = false;
  let environmentFailed = false;

  function moving() {
    return pointers.size > 0 || [camera.inertialAlphaOffset, camera.inertialBetaOffset, camera.inertialRadiusOffset, camera.inertialPanningX, camera.inertialPanningY].some(value => Math.abs(value) > .00001);
  }
  function tick(now: number) {
    frame = 0;
    if (disposed || document.hidden || !visible) return;
    engine.beginFrame();
    scene.render();
    engine.endFrame();
    if (moving() || now < renderUntil) {
      element('render-indicator').textContent = 'Rendering';
      frame = requestAnimationFrame(tick);
    } else {
      element('render-indicator').textContent = 'Still · rendering paused';
    }
  }
  function invalidate(duration = 140) {
    // A resize or restored page can invalidate an observer's last entry before
    // its next callback. Recheck on interaction so a visible canvas can resume.
    const rect = canvas.getBoundingClientRect();
    visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
    renderUntil = Math.max(renderUntil, performance.now() + duration);
    if (!frame && !disposed && !document.hidden && visible) frame = requestAnimationFrame(tick);
  }
  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    pointers.clear();
    element('render-indicator').textContent = 'Rendering paused';
  }
  function refreshShadow() {
    const map = shadow.getShadowMap();
    if (map) map.refreshRate = 0;
    map?.resetRefreshCounter();
  }
  function setLighting() {
    const appProfile = element<HTMLSelectElement>('lighting').value === 'app';
    // These day-profile values match SceneController's default constructor.
    sky.intensity = appProfile ? .62 : .18;
    sky.diffuse = appProfile ? new Color3(1, .91, .78) : Color3.White();
    sky.groundColor = appProfile ? new Color3(.3, .37, .28) : new Color3(.38, .38, .38);
    sun.intensity = appProfile ? .72 : 4.5;
    // An off-axis key gives cushion shape and visible grounding. PBR's diffuse
    // key needs more energy than the unshadowed hemisphere and environment fill.
    // Apply the same rig to both variants; keep the app profile unchanged.
    sun.direction.set(...(appProfile ? [-.8, -1.5, .7] : [-.9, -1.5, -.65]) as [number, number, number]);
    sun.position.set(...(appProfile ? [10, 18, -10] : [10, 18, 8]) as [number, number, number]);
    // A studio piece occupies metres, not the camera's default 10 km depth
    // range. Keep shadow bias at millimetre scale and retain the app profile.
    sun.shadowMinZ = appProfile ? .01 : 10;
    sun.shadowMaxZ = appProfile ? 10000 : 40;
    sun.diffuse = appProfile ? new Color3(1, .86, .68) : Color3.White();
    scene.ambientColor = appProfile ? new Color3(.12, .11, .09) : new Color3(.08, .08, .08);
    scene.imageProcessingConfiguration.exposure = appProfile ? .72 : 1;
    scene.imageProcessingConfiguration.contrast = appProfile ? 1.12 : 1;
    scene.clearColor = new Color4(.949, .937, .906, 1);
    scene.environmentTexture = !appProfile && environmentReady ? studioEnvironment : null;
    scene.environmentIntensity = appProfile ? 1 : .6;
    // ESM exponentials can underflow in half-float textures with a close studio
    // depth range. PCSS compares depth directly and softens distant shadows.
    if (appProfile) shadow.useBlurExponentialShadowMap = true;
    else {
      shadow.useContactHardeningShadow = true;
      shadow.contactHardeningLightSizeUVRatio = .12;
      shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    }
    shadow.bias = appProfile ? .00005 : .00015;
    shadow.normalBias = appProfile ? 0 : .003;
    shadow.blurKernel = appProfile ? 24 : 32;
    shadow.setDarkness(appProfile ? .3 : .22);
    element('lighting-note').textContent = appProfile ? 'The app’s default day lights, exposure, and contrast.' : environmentReady ? 'Soft studio illumination · Poly Haven, CC0.' : environmentFailed ? 'Studio environment unavailable; using the direct-light fallback.' : 'Preparing the studio lighting…';
    refreshShadow();
    invalidate();
  }
  function setView(view: string) {
    camera.inertialAlphaOffset = camera.inertialBetaOffset = camera.inertialRadiusOffset = 0;
    camera.inertialPanningX = camera.inertialPanningY = 0;
    const aspect = Math.max(.5, engine.getRenderWidth() / engine.getRenderHeight());
    const fitRadius = Math.max(boundsSize.y, boundsSize.x / aspect, boundsSize.z) / (2 * Math.tan(camera.fov / 2)) * (family === 'sectional' ? 1.30 : 1.65);
    camera.setTarget(view === 'detail'
      ? boundsCenter.add(new Vector3(-boundsSize.x * .2, boundsSize.y * .06, boundsSize.z * .18))
      : boundsCenter.clone());
    camera.alpha = view === 'rear' ? -Math.PI / 2 : view === 'front' ? Math.PI / 2 : Math.PI * .68;
    camera.beta = view === 'front' || view === 'rear' ? Math.PI / 2 - .04 : 1.12;
    ground.setEnabled(view !== 'underside');
    camera.upperBetaLimit = view === 'underside' ? Math.PI - .12 : Math.PI / 2 - .01;
    camera.radius = Math.max(.8, fitRadius);
    if (view === 'detail') {
      camera.radius = Math.max(.45, fitRadius * .43);
    }
    if (view === 'underside') camera.beta = 2.3;
    document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
    invalidate();
  }
  function tintKeys() {
    const explicit = results?.variants.find(item => item.id === selected)?.tintMaterialKeys;
    if (explicit?.length) return new Set(explicit);
    if (family === 'sectional') return new Set(['soft-grey-chenille', 'seam']);
    return family === 'sofa'
      ? new Set(['upholstery-textured', 'tailored-tone-on-tone-stitch'])
      : new Set(['honey-oak', 'walnut']);
  }
  function applySurface() {
    const keys = tintKeys();
    let tintable = 0;
    for (const [material, original] of originalColors) {
      const key = material.name.replace(/\.\d{3}$/, '');
      const matches = keys.has(key) || (family === 'sofa' && key.includes('upholstery-textured'));
      material.albedoColor = original.clone();
      if (matches) {
        tintable++;
        if (activeTint) {
          material.albedoColor = Color3.FromHexString(activeTint).toLinearSpace();
          if (key === 'tailored-tone-on-tone-stitch' || (family === 'sectional' && key === 'seam')) material.albedoColor.scaleInPlace(.72);
        }
      }
      material.wireframe = element<HTMLInputElement>('wireframe').checked;
      material.disableBumpMap = !element<HTMLInputElement>('surface-detail').checked;
    }
    clayMaterial.wireframe = element<HTMLInputElement>('wireframe').checked;
    for (const [mesh, material] of originalMaterials) {
      if (material) material.wireframe = element<HTMLInputElement>('wireframe').checked;
      mesh.material = element<HTMLInputElement>('clay').checked ? clayMaterial : material;
    }
    document.querySelectorAll<HTMLButtonElement>('[data-tint]').forEach(button => {
      button.disabled = !tintable || element<HTMLInputElement>('clay').checked;
      button.setAttribute('aria-pressed', String((button.dataset.tint || null) === activeTint));
    });
    element('tint-note').textContent = !container ? 'Color controls activate after the model loads.' : !tintable ? 'No matching editable material keys were found in this asset.' : family === 'sectional' ? 'Catalog blue-grey is the default for both sectional versions. Color changes preserve the texture maps.' : family === 'sofa' ? 'Catalog moss is the default for all sofa variants. Color changes preserve the texture maps.' : 'Wood tint changes preserve the texture maps. Original restores the exported finish.';
    refreshShadow();
    invalidate();
  }
  function updateMetadata() {
    const info = results?.variants.find(item => item.id === selected);
    const variant = VARIANTS.find(item => item.id === selected)!;
    element('variant-note').textContent = info?.note || variant.note;
    const dimensions = info?.dimensionsMm || variant.dimensionsMm;
    const validDimensions = dimensions && [dimensions.width, dimensions.depth, dimensions.height].every(value => Number.isFinite(value) && value > 0);
    element('envelope-row').hidden = !validDimensions;
    element('catalog-dimensions').textContent = validDimensions ? `${dimensions.width} × ${dimensions.depth} × ${dimensions.height} mm` : '—';
    const findings = element<HTMLUListElement>('findings');
    findings.replaceChildren();
    for (const finding of (info?.findings || []).slice(0, 5)) {
      const item = document.createElement('li');
      item.textContent = finding;
      findings.append(item);
    }
    findings.hidden = !findings.children.length;
  }
  function renderControls() {
    const list = element('variant-list');
    list.replaceChildren();
    VARIANTS.filter(variant => variant.family === family).forEach(variant => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.variant = variant.id;
      button.setAttribute('aria-pressed', String(variant.id === selected));
      const label = document.createElement('span');
      label.textContent = variant.label;
      const caption = document.createElement('small');
      caption.textContent = variant.caption;
      button.append(label, caption);
      button.addEventListener('click', () => selectVariant(variant.id));
      list.append(button);
    });
    document.querySelectorAll<HTMLButtonElement>('[data-family]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.family === family)));
    element('model-caption').textContent = `${FAMILY_DEFAULTS[family].label} / ${VARIANTS.find(variant => variant.id === selected)!.caption}`;
    element('tint-label').textContent = family === 'table' ? 'Wood finish' : 'Upholstery';
    const swatches = element('color-swatches');
    swatches.replaceChildren();
    const colors = family === 'sectional' ? [['Blue-grey', '#5f6465'], ['Moss', '#405e42'], ['Terracotta', '#9b6250']] : family === 'sofa' ? [['Moss', '#405e42'], ['Ochre', '#aa7b3c'], ['Blue', '#456e85']] : [['Original', ''], ['Oak', '#b9915f'], ['Walnut', '#6f4931']];
    for (const [label, color] of colors) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.tint = color;
      button.setAttribute('aria-label', `${label} ${family === 'table' ? 'wood tint' : 'upholstery'}`);
      const swatch = document.createElement('i');
      swatch.style.background = color || 'linear-gradient(125deg, #c8a774, #725034)';
      swatch.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.textContent = label;
      button.append(swatch, name);
      button.addEventListener('click', () => { activeTint = color || null; applySurface(); });
      swatches.append(button);
    }
    element('reference-details').hidden = selected !== 'sofa-refined';
    element('pipeline-details').hidden = selected !== 'sofa-pipeline';
    element('rebuilt-details').hidden = selected !== 'sofa-rebuilt';
    element('sectional-details').hidden = family !== 'sectional';
    updateMetadata();
    applySurface();
  }
  function unload() {
    originalMaterials.clear();
    originalColors.clear();
    const map = shadow.getShadowMap();
    if (map) map.renderList = [];
    container?.dispose();
    container = null;
    ['mesh-dimensions', 'triangle-count', 'download-size', 'mesh-count', 'load-time'].forEach(id => { element(id).textContent = '—'; });
  }
  function selectVariant(id: VariantId, force = false) {
    if (id === selected && container && !force) return;
    const variant = VARIANTS.find(item => item.id === id)!;
    if (family !== variant.family) activeTint = FAMILY_DEFAULTS[variant.family].tint;
    family = variant.family;
    selected = id;
    activeRequest?.abort();
    const ownRequest = ++requestId;
    unload();
    renderControls();
    message.hidden = false;
    element('load-text').textContent = `Loading ${variant.label.toLowerCase()} ${family}…`;
    element('retry-load').hidden = true;
    invalidate();
    // Serialize decode as well as download. Rapid A/B clicks cannot accumulate containers.
    loadQueue = loadQueue.then(async () => {
      if (ownRequest !== requestId || disposed) return;
      const abort = new AbortController();
      activeRequest = abort;
      const timeout = window.setTimeout(() => abort.abort(), 45000);
      const started = performance.now();
      try {
        const response = await fetch(`${ASSETS}${id}.glb`, { signal: abort.signal });
        if (!response.ok) throw new Error(`Asset request returned ${response.status}.`);
        const announcedBytes = Number(response.headers.get('content-length'));
        if (announcedBytes > 64 * 1024 * 1024) throw new Error('This asset exceeds the 64 MB study limit.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength > 64 * 1024 * 1024) throw new Error('This asset exceeds the 64 MB study limit.');
        if (ownRequest !== requestId || disposed) return;
        // Refuse codecs that would otherwise ask Babylon to fetch a CDN decoder.
        const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (bytes.byteLength < 20 || header.getUint32(0, true) !== 0x46546c67) throw new Error('The response is not a GLB model.');
        const jsonLength = header.getUint32(12, true);
        const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength))) as { extensionsUsed?: string[] };
        if (gltf.extensionsUsed?.some(key => key === 'KHR_draco_mesh_compression' || key === 'KHR_texture_basisu')) throw new Error('This study needs an export without Draco or KTX2 textures. No remote decoder was requested.');
        const asset = await LoadAssetContainerAsync(bytes, scene, { pluginExtension: '.glb', rootUrl: ASSETS, name: `${id}.glb`, pluginOptions: { gltf: { animationStartMode: 0 } } });
        if (ownRequest !== requestId || disposed) { asset.dispose(); return; }
        container = asset;
        preserveCatalogCoordinates(asset);
        asset.addAllToScene();
        asset.animationGroups.forEach(animation => animation.stop());
        const meshes = asset.meshes.filter(mesh => mesh.getTotalVertices() > 0);
        let min = new Vector3(Infinity, Infinity, Infinity);
        let max = new Vector3(-Infinity, -Infinity, -Infinity);
        let triangles = 0;
        for (const mesh of meshes) {
          mesh.computeWorldMatrix(true);
          const box = mesh.getBoundingInfo().boundingBox;
          min = Vector3.Minimize(min, box.minimumWorld);
          max = Vector3.Maximize(max, box.maximumWorld);
          triangles += mesh.getTotalIndices() / 3;
          originalMaterials.set(mesh, mesh.material);
          shadow.addShadowCaster(mesh, false);
          mesh.receiveShadows = true;
        }
        if (!meshes.length) throw new Error('This GLB contains no renderable mesh.');
        for (const material of asset.materials) if (material instanceof PBRMaterial) originalColors.set(material, material.albedoColor.clone());
        const measuredSize = max.subtract(min);
        // Sectional cameras use one catalog envelope in both versions. Keep
        // reporting the actual loaded bounds so differences remain visible.
        boundsSize = family === 'sectional'
          ? new Vector3(SECTIONAL_DIMENSIONS.width / 1000, SECTIONAL_DIMENSIONS.height / 1000, SECTIONAL_DIMENSIONS.depth / 1000)
          : measuredSize;
        boundsCenter = family === 'sectional'
          ? new Vector3(0, SECTIONAL_DIMENSIONS.height / 2000, 0)
          : min.add(max).scale(.5);
        ground.position.y = min.y - .006;
        element('mesh-dimensions').textContent = `${Math.round(measuredSize.x * 1000)} × ${Math.round(measuredSize.z * 1000)} × ${Math.round(measuredSize.y * 1000)} mm`;
        element('triangle-count').textContent = formatNumber.format(Math.round(triangles));
        element('download-size').textContent = `${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB`;
        element('mesh-count').textContent = formatNumber.format(meshes.length);
        element('load-time').textContent = `${((performance.now() - started) / 1000).toFixed(2)} s`;
        applySurface();
        if (loadedFamily !== family) setView('overview');
        loadedFamily = family;
        message.hidden = true;
        refreshShadow();
        invalidate(500);
        scene.executeWhenReady(() => invalidate());
      } catch (error) {
        if (ownRequest !== requestId || disposed) return;
        unload();
        element('load-text').textContent = `${error instanceof Error && error.name === 'AbortError' ? 'The model request timed out.' : error instanceof Error ? error.message : 'The model could not load.'} Choose another version or try again.`;
        element('retry-load').hidden = false;
        message.hidden = false;
        invalidate();
      } finally {
        window.clearTimeout(timeout);
        if (activeRequest === abort) activeRequest = null;
      }
    });
  }

  document.querySelectorAll<HTMLButtonElement>('[data-family]').forEach(button => button.addEventListener('click', () => selectVariant(FAMILY_DEFAULTS[button.dataset.family as Family].variant)));
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view!)));
  element('lighting').addEventListener('change', setLighting);
  element('clay').addEventListener('change', applySurface);
  element('wireframe').addEventListener('change', applySurface);
  element('surface-detail').addEventListener('change', applySurface);
  element('retry-load').addEventListener('click', () => selectVariant(selected, true));
  canvas.addEventListener('pointerdown', event => { pointers.add(event.pointerId); invalidate(); });
  canvas.addEventListener('pointermove', () => { if (pointers.size) invalidate(); });
  const release = (event: PointerEvent) => { pointers.delete(event.pointerId); invalidate(250); };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', () => invalidate(350), { passive: true });
  canvas.addEventListener('keydown', () => invalidate(350));
  window.addEventListener('blur', stop);
  window.addEventListener('focus', () => invalidate());
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : invalidate());
  const observer = new IntersectionObserver(() => { invalidate(); if (!visible) stop(); }, { threshold: .01 });
  observer.observe(canvas);
  const resize = new ResizeObserver(() => { engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 1.5)); engine.resize(); invalidate(); });
  resize.observe(element('canvas-wrap'));
  window.addEventListener('pagehide', event => {
    stop();
    if (event.persisted) return;
    disposed = true;
    requestId++;
    activeRequest?.abort();
    observer.disconnect();
    resize.disconnect();
    unload();
    studioEnvironment?.dispose();
    scene.dispose();
    engine.dispose();
  });
  window.addEventListener('pageshow', () => invalidate());
  // Same licensed 1K panorama for every variant. Generate one bounded 256px
  // linear cubemap, harmonics for diffuse IBL, and roughness-filtered specular.
  studioEnvironment = new HDRCubeTexture(`${ASSETS}studio-neutral.hdr`, scene, 256, false, true, false, true,
    () => { if (!disposed) { environmentReady = true; setLighting(); invalidate(500); } },
    () => { if (!disposed) { environmentFailed = true; setLighting(); } },
  );
  studioEnvironment.rotationY = .45;
  setLighting();
  selectVariant(selected);
  const metadataAbort = new AbortController();
  const metadataTimeout = window.setTimeout(() => metadataAbort.abort(), 10000);
  try {
    const response = await fetch(`${ASSETS}results.json`, { signal: metadataAbort.signal });
    if (!response.ok) throw new Error('Study notes are unavailable.');
    const parsed = await response.json() as Results;
    if (disposed) return;
    if (parsed.version !== 1 || !Array.isArray(parsed.variants)) throw new Error('Study notes use an unsupported format.');
    results = parsed;
    const pipelineResponse = await fetch(`${ASSETS}pipeline.json`, { signal: metadataAbort.signal });
    if (pipelineResponse.ok) {
      const pipeline = await pipelineResponse.json() as { version: number; variant: VariantResult; masterTriangles: number; browserTriangles: number; bakeResolution: number; reviewedViews: number };
      if (pipeline.version === 1 && pipeline.variant?.id === 'sofa-pipeline' && [pipeline.masterTriangles,pipeline.browserTriangles,pipeline.bakeResolution,pipeline.reviewedViews].every(Number.isFinite)) {
        results.variants.push(pipeline.variant);
        element('pipeline-evidence').textContent = `This build: ${formatNumber.format(pipeline.masterTriangles)} master triangles → ${formatNumber.format(pipeline.browserTriangles)} browser triangles, with ${pipeline.bakeResolution}px baked maps. ${pipeline.reviewedViews} exported views reviewed.`;
      } else throw new Error('Unsupported pipeline record.');
    } else throw new Error('Pipeline record unavailable.');
    const rebuiltResponse = await fetch(`${ASSETS}rebuilt.json`, { signal: metadataAbort.signal });
    if (!rebuiltResponse.ok) throw new Error('Realism revision record unavailable.');
    const rebuilt = await rebuiltResponse.json() as { version: number; variant: VariantResult; reviewedViews: number; textureResolution: number };
    if (rebuilt.version !== 1 || rebuilt.variant?.id !== 'sofa-rebuilt' || rebuilt.reviewedViews !== 5 || !Number.isFinite(rebuilt.textureResolution)) throw new Error('Unsupported realism revision record.');
    results.variants.push(rebuilt.variant);
    element('rebuilt-evidence').textContent = `${rebuilt.textureResolution}px tiled material maps. Five views of the exported model reviewed; editable Blender construction preserved.`;
    const sectionalResponse = await fetch(`${ASSETS}sectional.json`, { signal: metadataAbort.signal });
    if (!sectionalResponse.ok) throw new Error('Sectional study record unavailable.');
    const sectional = await sectionalResponse.json() as { version: number; variant: VariantResult; reviewedViews: number; textureResolution: number };
    if (sectional.version !== 1 || sectional.variant?.id !== 'sofa-sectional-rebuilt' || sectional.reviewedViews !== 5 || !Number.isFinite(sectional.textureResolution)) throw new Error('Unsupported sectional study record.');
    results.variants.push(sectional.variant);
    element('sectional-evidence').textContent = `${sectional.textureResolution}px tiled material maps. Five views of the exported sectional reviewed; editable Blender construction and catalog dimensions preserved.`;
    updateMetadata();
    applySurface();
    element('metadata-note').textContent = parsed.generatedAt ? `Study record · ${parsed.generatedAt.slice(0, 10)}` : '';
  } catch {
    element('metadata-note').textContent = 'Study notes are unavailable. The values above are still measured from the loaded model.';
    element('pipeline-evidence').textContent = 'Build record unavailable. Inspect the loaded model using the controls above.';
    element('rebuilt-evidence').textContent = 'Revision record unavailable. Inspect the loaded model using the controls above.';
    element('sectional-evidence').textContent = 'Sectional build record unavailable. Inspect the loaded model using the controls above.';
  } finally {
    window.clearTimeout(metadataTimeout);
  }
}

start().catch(error => {
  element('load-text').textContent = `The 3D viewer could not start. ${error instanceof Error ? error.message : 'Please reload to try again.'}`;
  message.hidden = false;
});
