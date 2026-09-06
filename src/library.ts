import {cozyType} from "./cozyCatalog";
import { catalog } from "./catalog";
import type { CatalogItem } from "./types";

export const libraryCategories = ["Living", "Bedroom", "Dining", "Office", "Kitchen", "Bathroom", "Storage", "Lighting", "Decor", "Outdoor", "Windows", "Doors", "Stairs"] as const;
export type LibraryShelf = "browse" | "favorites" | "plan";
export type LibrarySort = "collection" | "name" | "size";

// Human-readable types are intentionally independent of the render shape.
const families: Record<string, string[]> = {
  "Balcony railings": catalog.filter(item=>item.id.startsWith('balcony-rail-')).map(item=>item.id),
  "Air conditioning": ["balcony-mini-split"],
  "Closet doors": ["door-closet-single","door-closet-double","door-closet-sliding"],
  "Garden plants": ["lavender-clump","daisy-clump","tulip-planter","raised-flowerbed","balcony-flowerbox","garden-hedge","flowering-shrub","grass-clump"],
  "Trees": ["spruce-tree","maple-tree","sakura-tree"],
  "Patio seating": ["patio-dining-chair","adirondack-chair","patio-loveseat","patio-chaise","garden-bench"],
  "Patio tables & shade": ["patio-bistro-table","patio-dining-table","patio-parasol"],
  "Barbecues & fire bowls": ["gas-bbq","kettle-bbq","patio-fire-bowl"],
  "Patios & pathways": ["cobble-patio","concrete-patio","brick-patio","deck-patio","stepping-stones"],
  "Kitchen cabinets": ["push-base-cabinet","shaker-drawer-cabinet","arched-base-cabinet","tall-pantry-cabinet","glass-wall-cabinet","open-wall-cabinet"],
  "Hoods": ["chimney-hood","under-cabinet-hood","microwave-hood"],
  "Closet modules": ["sliding-closet","double-door-closet","closet-hanging-module","closet-shelf-module","closet-corner-module"],
  "Dressers & chests": ["wide-fluted-dresser","tall-drawer-chest"],
  "Countertop appliances": ["two-slot-toaster","espresso-machine","filter-coffee-maker","knife-block","countertop-microwave","stand-mixer","glass-air-fryer"],
  "Pendant lights": ["dome-pendant","linear-pendant"],
  "Backsplashes": ["backsplash-subway","backsplash-stacked","backsplash-slab"],
  "Inside doors": ["door-slim","door-flush","door-shaker","door-six-panel","door-french","door-bifold","door-pocket"],
  "Staircases": ["stairs-traditional","stairs-switchback","stairs-l-turn","stairs-floating","stairs-cantilever","stairs-led"],
  "Collectibles": ["adventurer-figurine","mecha-figurine","model-sailboat","brick-roadster"],
  "Sofas": ["left-chaise-sectional","right-chaise-sectional","u-sectional","boneless-loveseat","boneless-chaise","sofa","loveseat","modular-sectional","midcentury-sofa","sleeper-sofa"],
  "Chairs & stools": ["solarium-rocker","breakfast-chair","armchair","ottoman","dining-chair","bar-stool","office-chair","ergonomic-office-chair","gaming-chair","bench"],
  "Coffee tables": ["coffee-table","drum-coffee-table","lift-coffee-table","glass-coffee-table","oval-coffee-table"],
  "Side tables": ["cane-nightstand","floating-nightstand","pedestal-nightstand","side-table","nesting-tables","tray-side-table","c-side-table","drawer-side-table","nightstand"],
  "Beds": ["twin-full-bunk","storage-bunk","low-kids-bunk","queen-bed","single-bed","storage-platform-bed","arched-bed","daybed","bunk-bed"],
  "Desks": ["desk","standing-desk","trestle-desk","corner-desk","secretary-desk","compact-computer-desk","gaming-desk","pedestal-computer-desk"],
  "Computers & screens": ["desktop-monitor","wide-monitor","pc-tower","mini-pc","laptop"],
  "TV & media": ["slim-tv","tv-stand","tv-55","tv-65","tv-75","slatted-tv-stand","open-media-bench","cane-tv-stand"],
  "Speakers & audio": ["compact-speaker","bookshelf-speaker","tower-speaker","soundbar","subwoofer"],
  "Fans": ["tower-fan","pedestal-fan"],
  "Tables": ["breakfast-table","dining-table","round-table"],
  "Cabinets & storage": ["dresser","wardrobe","cabinet","base-cabinet","wall-cabinet"],
  "Counters & islands": ["kitchen-counter","kitchen-island","sink-cabinet"],
  "Appliances": ["refrigerator","range-oven","dishwasher"],
  "Laundry": ["washer","dryer","stacked-laundry"],
  "Mirrors": ["mirror","round-wall-mirror","arch-wall-mirror","bath-mirror-rounded","bath-mirror-pill","bath-mirror-halo","bath-medicine-cabinet"],
  "Sinks & vanities": ["pedestal-sink","wall-hung-sink","vessel-sink","single-bath-vanity","double-bath-vanity","floating-bath-vanity"],
  "Toilets": ["two-piece-toilet","one-piece-toilet","wall-hung-toilet"],
  "Showers": ["corner-shower","walk-in-shower"],
  "Bathtubs": ["alcove-bathtub","oval-freestanding-tub","clawfoot-bathtub","bath-shower-combo"],
  "Wall art & boards": ["valley-panorama","starlight-poster","singer-poster","basketball-poster","landscape-painting","botanical-print","abstract-poster","coast-poster","whiteboard"],
  "Shelves & books": ["display-bookcase","ladder-display-shelf","cube-display-shelf","bookshelf","wall-shelf","floating-shelves","books-upright","books-stacked"],
  "Rugs": ["low-pile-carpet","diamond-wool-rug","kilim-rug","jute-rug","arch-color-rug","wide-check-rug","round-rug","runner-rug","braided-rug","scallop-rug","checker-rug"],
  "Plants & pets": ["large-plant","small-plant","pet-bed"],
  "Lamps": ["floor-lamp","table-lamp"],
  "Windows": ["window-solarium","window-casement","window-sash","window-picture","window-arched","window-bay","window-awning"],
};
const typeById = new Map(Object.entries(families).flatMap(([family, ids]) => ids.map(id => [id, family] as const)));
export const furnitureType = (item: CatalogItem) => cozyType(item.id) ?? typeById.get(item.id) ?? "Other pieces";
const synonyms: Record<string, string> = {
  couch:"sofa", settee:"sofa", washroom:"bathroom", restroom:"bathroom", lavatory:"toilet",
  television:"tv", fridge:"refrigerator", computer:"computer", tub:"bathtub", basin:"sink",
};
const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const singular = (word:string) => word.endsWith('ies') ? word.slice(0,-3)+'y' : word.endsWith('s') && !word.endsWith('ss') ? word.slice(0,-1) : word;
const tokens = (text:string) => normalize(text).split(/\s+/).filter(Boolean).map(w=>synonyms[singular(w)]??singular(w));
export function matchesFurniture(item: CatalogItem, search: string) {
  const words=tokens(search);
  const text=tokens(`${item.id} ${item.name} ${item.category} ${item.description} ${furnitureType(item)}`);
  return words.every(word => {
    // Category intent wins over incidental prose (e.g. outdoor, French-door fridge).
    if(word==='door')return item.category==='Doors';
    if(word==='window')return item.category==='Windows' && item.shape==='window';
    return text.some(token=>token===word || (word.length>=3 && token.startsWith(word)));
  });
}
export function filterLibrary(options: { search: string; category: string; type: string; shelf: LibraryShelf; favorites: string[]; inPlan: string[]; sort: LibrarySort }) {
  const { search, category, type, shelf, favorites, inPlan, sort } = options;
  const base = catalog.filter(item => (item.id!=="nesting-tables"||shelf==="plan") && (category === "All" || item.category === category) && matchesFurniture(item, search)
    && (shelf === "browse" || (shelf === "favorites" ? favorites : inPlan).includes(item.id)));
  const types = [...new Set(base.map(furnitureType))].sort();
  const items = base.filter(item => type === "All" || furnitureType(item) === type);
  if (sort === "name") items.sort((a,b) => a.name.localeCompare(b.name));
  if (sort === "size") items.sort((a,b) => a.widthMm*a.depthMm-b.widthMm*b.depthMm || a.name.localeCompare(b.name));
  return { items, types };
}
export const favoritesKey = "nook-library-favorites-v1";
export function parseFavorites(raw: string | null): string[] {
  try { const value: unknown = JSON.parse(raw ?? "[]"); return Array.isArray(value) ? [...new Set(value.filter((id):id is string => typeof id === "string" && catalog.some(item => item.id === id)))] : []; }
  catch { return []; }
}
