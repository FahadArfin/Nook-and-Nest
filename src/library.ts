import { catalog } from "./catalog";
import type { CatalogItem } from "./types";

export const libraryCategories = ["Living", "Bedroom", "Dining", "Office", "Kitchen", "Bathroom", "Storage", "Lighting", "Decor", "Windows"] as const;
export type LibraryShelf = "browse" | "favorites" | "plan";
export type LibrarySort = "collection" | "name" | "size";

// Human-readable types are intentionally independent of the render shape.
const families: Record<string, string[]> = {
  "Sofas": ["sofa","loveseat","modular-sectional","midcentury-sofa","sleeper-sofa"],
  "Chairs & stools": ["armchair","ottoman","dining-chair","bar-stool","office-chair","ergonomic-office-chair","gaming-chair","bench"],
  "Coffee tables": ["coffee-table","drum-coffee-table","lift-coffee-table","glass-coffee-table","oval-coffee-table"],
  "Side tables": ["side-table","nesting-tables","tray-side-table","c-side-table","drawer-side-table","nightstand"],
  "Beds": ["queen-bed","single-bed","storage-platform-bed","arched-bed","daybed","bunk-bed"],
  "Desks": ["desk","standing-desk","trestle-desk","corner-desk","secretary-desk","compact-computer-desk","gaming-desk","pedestal-computer-desk"],
  "Computers & screens": ["desktop-monitor","wide-monitor","pc-tower","mini-pc","laptop"],
  "TV & media": ["slim-tv","tv-stand"],
  "Fans": ["tower-fan","pedestal-fan"],
  "Tables": ["dining-table","round-table"],
  "Cabinets & storage": ["dresser","wardrobe","cabinet","base-cabinet","wall-cabinet"],
  "Counters & islands": ["kitchen-counter","kitchen-island","sink-cabinet"],
  "Appliances": ["refrigerator","range-oven","dishwasher"],
  "Laundry": ["washer","dryer","stacked-laundry"],
  "Mirrors": ["mirror","round-wall-mirror","arch-wall-mirror","bath-mirror-rounded","bath-mirror-pill","bath-mirror-halo","bath-medicine-cabinet"],
  "Sinks & vanities": ["pedestal-sink","wall-hung-sink","vessel-sink","single-bath-vanity","double-bath-vanity","floating-bath-vanity"],
  "Toilets": ["two-piece-toilet","one-piece-toilet","wall-hung-toilet"],
  "Showers": ["corner-shower","walk-in-shower"],
  "Bathtubs": ["alcove-bathtub","oval-freestanding-tub","clawfoot-bathtub","bath-shower-combo"],
  "Wall art & boards": ["landscape-painting","botanical-print","abstract-poster","coast-poster","whiteboard"],
  "Shelves & books": ["bookshelf","wall-shelf","floating-shelves","books-upright","books-stacked"],
  "Rugs": ["round-rug","runner-rug","braided-rug","scallop-rug","checker-rug"],
  "Plants & pets": ["large-plant","small-plant","pet-bed"],
  "Lamps": ["floor-lamp","table-lamp"],
  "Windows": ["window-casement","window-sash","window-picture","window-arched","window-bay","window-awning"],
};
const typeById = new Map(Object.entries(families).flatMap(([family, ids]) => ids.map(id => [id, family] as const)));
export const furnitureType = (item: CatalogItem) => typeById.get(item.id) ?? "Other pieces";
const synonyms: Record<string, string> = {
  couch:"sofa", settee:"sofa", washroom:"bathroom", restroom:"bathroom", lavatory:"toilet",
  television:"tv", fridge:"refrigerator", computer:"computer", tub:"bathtub", basin:"sink",
};
const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
export function matchesFurniture(item: CatalogItem, search: string) {
  const words = normalize(search).split(/\s+/).filter(Boolean).map(word => synonyms[word] ?? word);
  const text = normalize(`${item.id} ${item.name} ${item.category} ${item.description} ${furnitureType(item)}`);
  return words.every(word => text.includes(word));
}
export function filterLibrary(options: { search: string; category: string; type: string; shelf: LibraryShelf; favorites: string[]; inPlan: string[]; sort: LibrarySort }) {
  const { search, category, type, shelf, favorites, inPlan, sort } = options;
  const base = catalog.filter(item => (category === "All" || item.category === category) && matchesFurniture(item, search)
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
