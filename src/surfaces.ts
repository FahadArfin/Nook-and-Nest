export interface SurfaceFinish {
  id: string;
  name: string;
  family: string;
  texture: string;
  scale: number;
}

export const wallFinishes: SurfaceFinish[] = [
  { id: "cream-plaster", name: "Warm cream", family: "Paint", texture: "/textures/cream-plaster.jpg", scale: 1.5 },
  { id: "sage-plaster", name: "Soft sage", family: "Paint", texture: "/textures/sage-plaster.jpg", scale: 1.5 },
  { id: "terracotta-plaster", name: "Dusty clay", family: "Paint", texture: "/textures/terracotta-plaster.jpg", scale: 1.5 },
  { id: "blue-plaster", name: "Mist blue", family: "Paint", texture: "/textures/blue-plaster.jpg", scale: 1.5 },
  { id: "handmade-brick", name: "Old brick", family: "Masonry", texture: "/textures/handmade-brick.jpg", scale: 1 },
  { id: "pale-limestone", name: "Pale stone", family: "Masonry", texture: "/textures/pale-limestone.jpg", scale: 1 },
  { id: "botanical-wallpaper", name: "Little vines", family: "Wallpaper", texture: "/textures/botanical-wallpaper.jpg", scale: 1 },
  { id: "sage-floral-wallpaper", name: "Meadow bloom", family: "Wallpaper", texture: "/textures/sage-floral-wallpaper.jpg", scale: 1 },
];

export const floorFinishes: SurfaceFinish[] = [
  { id: "honey-oak", name: "Honey oak", family: "Wood", texture: "/textures/honey-oak.jpg", scale: 1 },
  { id: "light-oak", name: "Light oak", family: "Wood", texture: "/textures/light-oak.jpg", scale: 1 },
  { id: "walnut-laminate", name: "Walnut", family: "Laminate", texture: "/textures/walnut-laminate.jpg", scale: 1 },
  { id: "whitewashed-wood", name: "Whitewash", family: "Laminate", texture: "/textures/whitewashed-wood.jpg", scale: 1 },
  { id: "terracotta-checker-tile", name: "Cottage check", family: "Tile", texture: "/textures/terracotta-checker-tile.jpg", scale: 1 },
  { id: "blue-encaustic-tile", name: "Blue bloom", family: "Tile", texture: "/textures/blue-encaustic-tile.jpg", scale: 1 },
  { id: "oatmeal-carpet", name: "Oatmeal", family: "Carpet", texture: "/textures/oatmeal-carpet.jpg", scale: 1.5 },
  { id: "moss-carpet", name: "Moss", family: "Carpet", texture: "/textures/moss-carpet.jpg", scale: 1.5 },
];

export const defaultWallFinish = wallFinishes[0];
export const defaultFloorFinish = floorFinishes[0];

export function findWallFinish(id?: string) {
  return wallFinishes.find((finish) => finish.id === id) ?? defaultWallFinish;
}

export function findFloorFinish(id?: string) {
  return floorFinishes.find((finish) => finish.id === id) ?? defaultFloorFinish;
}
