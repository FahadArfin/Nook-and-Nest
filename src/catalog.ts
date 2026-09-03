import { interiorRows,interiorWallIds,collectibleIds } from "./interiorCatalog";
import { outdoorRows } from "./outdoorCatalog";
import type { CatalogItem } from "./types";
import { kitchenRows,kitchenWallIds,kitchenSurfaceIds,kitchenCeilingIds,kitchenMountHeight } from "./kitchenCatalog";
export const isKitchenWall=(id:string)=>kitchenWallIds.has(id);
export const isCeilingMounted=(id:string)=>kitchenCeilingIds.has(id);
const rows: Array<[string,string,CatalogItem["category"],number,number,number,CatalogItem["shape"],string]> = [
  ...outdoorRows,
  ...interiorRows,
  ...kitchenRows,
  ["door-flush","Quiet flush door","Doors",950,160,2150,"door","Smooth modern door, thick jambs and a small lever; snaps into a wall"],
  ["door-shaker","Cottage Shaker door","Doors",950,160,2150,"door","Two framed panels with gentle mouldings"],
  ["door-six-panel","Heritage six-panel door","Doors",950,160,2150,"door","Traditional six-panel construction and independent trim colors"],
  ["door-french","Glazed French pair","Doors",1550,160,2150,"door","Double doors with translucent panes and glazing bars"],
  ["door-bifold","Folding four-panel door","Doors",1550,160,2150,"door","Four narrow hinged leaves for a closet or laundry opening"],
  ["door-pocket","Pocket sliding door","Doors",950,160,2150,"door","Flush sliding leaf with recessed pulls and an overhead track; shown closed"],
  ["stairs-traditional","Cottage closed-riser stairs","Stairs",1100,4200,3700,"stairs","Sixteen wood treads with closed risers and twin handrails"],
  ["stairs-switchback","Return-flight staircase","Stairs",2200,3200,3700,"stairs","Two stacked parallel flights joined by a broad landing"],
  ["stairs-l-turn","Quarter-turn staircase","Stairs",3200,3200,2800,"stairs","An L-shaped pair of flights with an open corner and square landing"],
  ["stairs-floating","Mono floating staircase","Stairs",1100,4200,3700,"stairs","Thick floating wood treads on one central metal stringer"],
  ["stairs-cantilever","Cantilever wood treads","Stairs",1100,4200,2800,"stairs","Wall-mounted tread plates; requires an engineered support wall"],
  ["stairs-led","Warm-lit cantilever stairs","Stairs",1100,4200,2800,"stairs","Warm under-nosing light strips beneath chunky cantilevered treads"],

  ["tv-55","Picture TV · 55 inch","Living",1238,280,795,"device","55-inch class screen with slim bezel and splayed feet; rests on a media bench"],
  ["tv-65","Picture TV · 65 inch","Living",1459,300,919,"device","65-inch class screen with a separate tintable screen, casing and feet"],
  ["tv-75","Picture TV · 75 inch","Living",1680,340,1044,"device","Large 75-inch class screen; check your media bench width"],
  ["compact-speaker","Pocket room speaker","Living",125,140,190,"device","Small rounded smart-style speaker for shelves or surround sound"],
  ["bookshelf-speaker","Duet bookshelf speaker","Living",200,250,340,"device","Two-driver speaker with a soft-edged wood enclosure; place a pair independently"],
  ["tower-speaker","Column tower speaker","Living",280,340,1050,"device","Three exposed drivers on an isolation plinth for a home cinema"],
  ["soundbar","Quiet cinema soundbar","Living",950,130,75,"device","Long low speaker with a continuous matte grille"],
  ["subwoofer","Deep note subwoofer","Living",360,400,420,"device","Floor-standing bass cabinet with a large recessed driver"],
  ["slatted-tv-stand","Tambour media bench","Living",1800,440,560,"storage","Slatted wood doors, open equipment shelf and rear cable passage"],
  ["open-media-bench","Low horizon media bench","Living",2100,450,380,"storage","Wide low open compartments for a 75-inch TV and accessories"],
  ["cane-tv-stand","Willow cane media bench","Living",1600,420,660,"storage","Framed woven doors, visible tapered feet and a central equipment shelf"],
  ["bath-mirror-rounded","Soft-corner bathroom mirror","Bathroom",700,60,900,"bathroom","Rounded rectangular frame with a softly tinted mirror"],
  ["bath-mirror-pill","Capsule bathroom mirror","Bathroom",550,50,950,"bathroom","Tall pill-shaped wall mirror"],
  ["bath-mirror-halo","Halo bathroom mirror","Bathroom",750,55,750,"bathroom","Round mirror with a warm light-style border"],
  ["bath-medicine-cabinet","Cottage mirror cabinet","Bathroom",800,160,800,"bathroom","Two mirrored doors with small pulls and concealed storage"],
  ["pedestal-sink","Classic pedestal sink","Bathroom",620,500,910,"bathroom","Hollow basin on a sculpted pedestal with a mixer tap"],
  ["wall-hung-sink","Little wall basin","Bathroom",600,450,360,"bathroom","Compact wall-mounted sink with a rear tap deck"],
  ["vessel-sink","Round vessel sink","Bathroom",460,460,160,"bathroom","Standalone countertop bowl; place on a cabinet or counter"],
  ["single-bath-vanity","Cottage single vanity","Bathroom",900,520,930,"bathroom","Drawer vanity with a vessel sink, worktop and faucet"],
  ["double-bath-vanity","Together double vanity","Bathroom",1400,520,930,"bathroom","Two basins and faucets above generous drawer storage"],
  ["floating-bath-vanity","Float bathroom vanity","Bathroom",900,520,600,"bathroom","Wall-mounted drawer vanity with a vessel basin"],
  ["two-piece-toilet","Classic two-piece toilet","Bathroom",400,720,810,"bathroom","Separate cistern, open seat and hollow bowl"],
  ["one-piece-toilet","Compact one-piece toilet","Bathroom",400,680,740,"bathroom","Integrated skirted base and low cistern"],
  ["wall-hung-toilet","Float wall-hung toilet","Bathroom",380,560,550,"bathroom","Raised toilet bowl with a separate dual-flush wall plate"],
  ["corner-shower","Corner shower enclosure","Bathroom",900,900,2050,"bathroom","Square standing shower with glass door, tray and rainfall head"],
  ["walk-in-shower","Open walk-in shower","Bathroom",1200,900,2050,"bathroom","Wider standing shower with a fixed splash screen and open entry"],
  ["alcove-bathtub","Everyday alcove bathtub","Bathroom",1520,760,580,"bathroom","Built-in style bath with a paneled front apron"],
  ["oval-freestanding-tub","Pebble freestanding bathtub","Bathroom",1650,780,660,"bathroom","Rounded soaking tub with a contrasting outer shell"],
  ["clawfoot-bathtub","Cottage clawfoot bathtub","Bathroom",1700,800,710,"bathroom","Vintage freestanding bath raised on four chunky feet"],
  ["bath-shower-combo","Everyday bath and shower","Bathroom",1520,760,2100,"bathroom","Alcove tub, glass splash screen and overhead shower"],
  ["drum-coffee-table","Fluted drum coffee table","Living",860,860,400,"table","Round wood top with a softly fluted drum base"],
  ["lift-coffee-table","Keepsake lift-top table","Living",1100,600,460,"table","Closed lift-top storage table with a recessed finger pull"],
  ["glass-coffee-table","Glass garden coffee table","Living",1050,600,430,"table","Smoked glass inset, wood rim and a lower shelf"],
  ["oval-coffee-table","Willow oval coffee table","Living",1200,600,420,"table","Oval wood top over a magazine shelf"],
  ["compact-computer-desk","Little computer desk","Office",1000,550,760,"table","Compact computer table with a keyboard tray"],
  ["gaming-desk","Quest gaming desk","Office",1600,800,760,"table","Broad desktop, angled sled legs and cable trough"],
  ["pedestal-computer-desk","Studio drawer desk","Office",1500,700,760,"table","A generous worktop over twin drawer pedestals"],
  ["desktop-monitor","Everyday monitor","Office",610,220,460,"device","Desktop monitor with a colorable frame and stand"],
  ["wide-monitor","Panorama ultrawide monitor","Office",820,250,450,"device","Wide-screen monitor for a spacious computer setup"],
  ["ergonomic-office-chair","Breeze office chair","Office",660,660,1120,"seat","Open woven back, lumbar support, headrest and casters"],
  ["gaming-chair","Quest gaming chair","Office",720,720,1240,"seat","High-back gaming chair with bolsters and a five-star base"],
  ["pc-tower","Studio PC tower","Office",230,450,470,"device","Desktop computer case with front fans, ports and side panel"],
  ["mini-pc","Pocket mini PC","Office",140,140,52,"device","Small desktop computer with vents and front ports"],
  ["laptop","Daylight laptop","Office",350,260,250,"device","Open laptop with keyboard, trackpad and screen"],
  ["tower-fan","Breeze tower fan","Living",290,290,1050,"fan","Slim tower fan with louvres and top controls"],
  ["pedestal-fan","Summer pedestal fan","Living",460,400,1250,"fan","Classic three-blade fan with a circular safety grille"],
  ["window-casement","Cottage casement","Windows",1200,220,1250,"window","Twin opening leaves with chunky frames and brass handles"],
  ["window-sash","Heritage sash","Windows",1000,220,1400,"window","Traditional six-pane double-hung window"],
  ["window-picture","Panorama picture window","Windows",1800,180,1100,"window","A broad uninterrupted pane in a softly chamfered frame"],
  ["window-arched","Storybook arch window","Windows",1000,220,1450,"window","A curved crown and fanlight above twin panes"],
  ["window-bay","Reading nook bay","Windows",1800,650,1300,"window","Three projecting glazed faces with a deep wooden sill"],
  ["window-awning","Little awning window","Windows",900,200,650,"window","Compact horizontal window with top hinges and a latch"],
  ["sofa","Cloud sofa","Living",2100,900,850,"seat","Deep and softly rounded"],["loveseat","Little loveseat","Living",1450,850,820,"seat","A snug two-seater"],["armchair","Nook chair","Living",880,820,900,"seat","A generous reading chair"],["ottoman","Puff ottoman","Living",650,500,420,"seat","Feet-up comfort"],["coffee-table","Pebble table","Living",1100,600,420,"table","Low rounded coffee table"],["side-table","Acorn side table","Living",480,480,520,"table","Small round companion"],
  ["modular-sectional","Hearth sectional","Living",2850,1900,820,"seat","A flexible L-shaped modular sofa"],["midcentury-sofa","Juniper sofa","Living",2050,860,830,"seat","Tailored cushions and splayed wood legs"],["sleeper-sofa","Foldaway sofa","Living",1980,920,840,"seat","A compact sofa with a pull-out bed"],
  ["nesting-tables","Nest tables","Living",620,480,560,"table","Two softly rounded tables that tuck together"],["tray-side-table","Tea tray table","Living",520,420,610,"table","A raised-edge tray on a folding frame"],["c-side-table","Cuddle-up table","Living",460,380,640,"table","Slides neatly beside a sofa"],["drawer-side-table","Keepsake table","Living",540,440,590,"storage","A compact end table with one drawer"],
  ["slim-tv","Picture TV","Living",1220,110,760,"decor","A slim screen on a warm easel stand"],["tv-stand","Hearth media bench","Living",1600,420,560,"storage","Sliding doors, open shelf and cable space"],
  ["queen-bed","Nest bed","Bedroom",1600,2100,760,"bed","Queen bed with soft headboard"],["single-bed","Daydream bed","Bedroom",1000,2000,700,"bed","Simple single bed"],["nightstand","Moon nightstand","Bedroom",520,430,560,"storage","One drawer and a shelf"],["dresser","Meadow dresser","Bedroom",1300,500,850,"storage","Low six-drawer dresser"],["wardrobe","Cottage wardrobe","Storage",1200,600,1900,"storage","Tall double-door storage"],["bookshelf","Story shelf","Storage",900,350,1800,"storage","Open shelves"],["cabinet","Linen cabinet","Storage",800,450,1200,"storage","Compact closed storage"],["bench","Entry bench","Storage",1100,420,520,"seat","Shoes below, seat above"],
  ["storage-platform-bed","Drawer platform bed","Bedroom",1650,2150,920,"bed","A low bed with deep under-bed drawers"],["arched-bed","Petal headboard bed","Bedroom",1650,2120,1200,"bed","A softly arched upholstered statement bed"],["daybed","Window daybed","Bedroom",2050,980,900,"bed","A sofa-like single bed with a bolster back"],["bunk-bed","Cottage bunk bed","Bedroom",1050,2100,1750,"bed","Two sturdy bunks with a built-in ladder"],
  ["dining-table","Harvest table","Dining",1600,900,760,"table","Room for six"],["round-table","Tea table","Dining",1050,1050,750,"table","Round four-seat table"],["dining-chair","Twig chair","Dining",480,520,880,"seat","Light wooden chair"],["bar-stool","Mushroom stool","Dining",420,420,720,"seat","Tucks under a counter"],["desk","Writing desk","Office",1300,650,760,"table","Calm work surface"],["office-chair","Leaf task chair","Office",620,620,950,"seat","A friendly desk chair"],
  ["standing-desk","Rise desk","Office",1400,700,1150,"table","An adjustable desk with chunky lift columns"],["trestle-desk","Maker trestle desk","Office",1500,720,760,"table","A broad wood top on open trestles"],["corner-desk","Corner studio desk","Office",1800,1500,760,"table","An L-shaped workspace with open shelving"],["secretary-desk","Fold-down secretary","Office",980,480,1480,"storage","Tall storage with a fold-down writing surface"],
  ["refrigerator","Pantry refrigerator","Kitchen",900,720,1850,"storage","Rounded French-door fridge with a freezer drawer"],["range-oven","Cottage range","Kitchen",760,680,920,"storage","Four-burner range with a windowed oven"],["dishwasher","Quiet dishwasher","Kitchen",600,620,860,"storage","Panel-front dishwasher with a simple control rail"],["base-cabinet","Base cabinet","Kitchen",900,620,910,"storage","Modular two-door kitchen base cabinet"],["wall-cabinet","Wall cabinet","Kitchen",800,360,760,"storage","Compact upper cabinet with framed doors"],["sink-cabinet","Apron sink cabinet","Kitchen",1000,640,930,"storage","Deep farmhouse sink over two cabinet doors"],["kitchen-counter","Prep counter","Kitchen",1200,650,930,"storage","Drawer-and-door counter with selectable worktop"],["kitchen-island","Gathering island","Kitchen",1800,900,940,"table","A substantial island with shelves and seating overhang"],
  ["washer","Meadow washer","Kitchen",680,700,900,"storage","Friendly front-loading washing machine"],["dryer","Warm-air dryer","Kitchen",680,700,900,"storage","Matching front-loading tumble dryer"],["stacked-laundry","Stacked laundry pair","Kitchen",700,720,1810,"storage","Space-saving washer and dryer tower"],
  ["floor-lamp","Bell floor lamp","Lighting",450,450,1550,"lamp","Warm pool of light"],["table-lamp","Glow lamp","Lighting",300,300,520,"lamp","Small cozy lamp"],["large-plant","Sunny plant","Decor",600,600,1300,"plant","A generous leafy plant"],["small-plant","Window plant","Decor",320,320,520,"plant","Fits anywhere"],["round-rug","Dewdrop rug","Decor",1800,1800,20,"rug","Soft round rug"],["runner-rug","Woven runner","Decor",800,2200,20,"rug","Long patterned runner"],["braided-rug","Hearth braid rug","Decor",1600,1000,25,"rug","Warm layered oval weave"],["scallop-rug","Petal edge rug","Decor",1700,1200,25,"rug","Playful scalloped border"],["checker-rug","Picnic check rug","Decor",1500,1500,25,"rug","Chunky cottage checks"],["mirror","Sunrise mirror","Decor",700,80,1100,"decor","Rounded standing mirror"],["pet-bed","Sleepy pet bed","Decor",700,550,180,"decor","A tiny nest for a companion"]
  ,["landscape-painting","Amber valley painting","Decor",900,70,650,"decor","A warm framed countryside painting"],["botanical-print","Garden study print","Decor",600,45,800,"decor","A quiet botanical illustration"],["abstract-poster","Shape & sun poster","Decor",600,35,850,"decor","Warm mid-century geometric art"],["coast-poster","Moon coast poster","Decor",650,35,900,"decor","A dreamy coastal night print"],["round-wall-mirror","Dewdrop wall mirror","Decor",720,55,720,"decor","Round mirror with a chunky wood rim"],["arch-wall-mirror","Window arch mirror","Decor",620,55,980,"decor","Tall softly arched wall mirror"],["whiteboard","Little plan board","Office",900,55,650,"decor","Whiteboard with tray, notes and markers"],["wall-shelf","Peg rail shelf","Storage",900,240,360,"storage","Wall shelf with pegs and a raised back"],["floating-shelves","Floating shelf pair","Storage",1000,240,720,"storage","Two staggered chunky floating shelves"],["books-upright","Storybook row","Decor",520,180,310,"decor","A varied row of standing books"],["books-stacked","Bedside book stack","Decor",420,280,260,"decor","Several books stacked horizontally"]
];
const wallMountedIds = new Set(["bath-mirror-rounded","bath-mirror-pill","bath-mirror-halo","bath-medicine-cabinet","wall-hung-sink","floating-bath-vanity","wall-hung-toilet","landscape-painting","botanical-print","abstract-poster","coast-poster","round-wall-mirror","arch-wall-mirror","whiteboard","wall-shelf","floating-shelves"]);
export const isDoor=(id:string)=>rows.some(row=>row[0]===id&&row[2]==="Doors");
export const isStairs=(id:string)=>rows.some(row=>row[0]===id&&row[2]==="Stairs");
export const isWallOpening=(id:string)=>isWindow(id)||isDoor(id);
export const isWindow = (catalogId: string) => rows.some(row=>row[0]===catalogId&&row[2]==="Windows");
export const isWallMounted = (catalogId: string) => wallMountedIds.has(catalogId)||interiorWallIds.has(catalogId)||isKitchenWall(catalogId)||isWallOpening(catalogId);
export const bathroomModelIds = new Set(rows.filter(row=>row[2]==="Bathroom").map(row=>row[0]));
export const defaultMountHeight = (id:string):number|undefined => kitchenMountHeight(id)??(id==="floating-nightstand"?350:isDoor(id)?0:id==="wall-hung-sink"?650:id==="floating-bath-vanity"?350:id==="wall-hung-toilet"?150:isWindow(id)?850:isWallMounted(id)?1100:undefined);
export const workspaceModelIds = new Set(rows.filter(row=>(row[6]==="device"&&row[2]==="Office")||row[6]==="fan"||["drum-coffee-table","lift-coffee-table","glass-coffee-table","oval-coffee-table","compact-computer-desk","gaming-desk","pedestal-computer-desk","ergonomic-office-chair","gaming-chair"].includes(row[0])).map(row=>row[0]));
export const isSurfaceMounted = (id:string) => collectibleIds.has(id)||["books-upright","books-stacked","small-plant"].includes(id)||kitchenSurfaceIds.has(id)||["tv-55","tv-65","tv-75","compact-speaker","bookshelf-speaker","soundbar","desktop-monitor","wide-monitor","pc-tower","mini-pc","laptop","vessel-sink"].includes(id);
export const hasModelPreview = (id:string) => rows.some(row=>row[0]===id);
export const catalog: CatalogItem[] = rows.map(([id,name,category,widthMm,depthMm,heightMm,shape,description]) => ({ id,name,category,widthMm,depthMm,heightMm,shape,description,icon:shape,mount:isCeilingMounted(id)?"ceiling":isWallMounted(id)?"wall":isSurfaceMounted(id)?"surface":"floor" }));
export const variants = {
  sage: "#97a67c", clay: "#c4775f", oat: "#d9c5a3", rose: "#c89490",
  ink: "#5d6965", navy: "#53687d", rust: "#9f5d47", cream: "#eee4d1",
};
