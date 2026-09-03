import type { CatalogItem } from './types';
type Row=[string,string,CatalogItem['category'],number,number,number,CatalogItem['shape'],string];
export const outdoorRows:Row[]=[
 ['lavender-clump','Lavender drift','Outdoor',550,500,650,'plant','Upright purple flower spikes and narrow leaves'],
 ['daisy-clump','Sunny daisy patch','Outdoor',500,450,500,'plant','Cream petals, gold centers and leafy stems'],
 ['tulip-planter','Spring tulip pot','Outdoor',450,450,650,'plant','Colorful cup-shaped tulips in a terracotta planter'],
 ['raised-flowerbed','Timber flower bed','Outdoor',1600,700,650,'plant','Layered wood planter with soil, daisies and lavender'],
 ['balcony-flowerbox','Balcony flower box','Outdoor',1000,300,420,'plant','Compact slatted planter filled with summer flowers'],
 ['garden-hedge','Leafy garden hedge','Outdoor',1500,550,1100,'plant','Dense small-leaf hedge with a clipped rectangular silhouette'],
 ['flowering-shrub','Blossom garden bush','Outdoor',900,850,1000,'plant','Branching shrub with leaves and scattered pink flowers'],
 ['spruce-tree','Mountain spruce','Outdoor',1800,1800,3600,'plant','Layered conifer boughs, angular needles and a visible trunk'],
 ['maple-tree','Autumn maple','Outdoor',3500,3200,4300,'plant','Spreading branches with individually shaped warm maple leaves'],
 ['sakura-tree','Spring sakura','Outdoor',3400,3200,4000,'plant','Open branching cherry tree with clusters of five-petal blossoms'],
 ['patio-dining-chair','Terrace slat chair','Outdoor',580,620,850,'seat','Thick timber frame and a slatted seat and back'],
 ['adirondack-chair','Lakeside lounge chair','Outdoor',800,950,950,'seat','Reclined fan-shaped back, low seat and generous arms'],
 ['patio-loveseat','Sunday patio loveseat','Outdoor',1600,800,850,'seat','Open wood frame with fitted matte cushions'],
 ['patio-chaise','Sunbreak chaise lounge','Outdoor',720,1950,850,'seat','Long slatted lounger with a raised back and cushion'],
 ['patio-bistro-table','Balcony bistro table','Outdoor',700,700,740,'table','Round slatted wood top on a central pedestal'],
 ['patio-dining-table','Terrace dining table','Outdoor',1800,900,760,'table','Wide plank top, thick legs and a low stretcher'],
 ['garden-bench','Orchard garden bench','Outdoor',1500,550,850,'seat','Slatted seat and curved-looking fan back with arm rests'],
 ['patio-parasol','Sunshade patio umbrella','Outdoor',2400,2400,2450,'decor','Eight-panel fabric canopy, center pole and weighted foot'],
 ['gas-bbq','Gathering gas barbecue','Outdoor',1400,650,1150,'appliance','Closed curved lid, side shelves, controls and twin-door cart'],
 ['kettle-bbq','Little kettle barbecue','Outdoor',650,700,950,'appliance','Round lidded kettle, vent, handle and wheeled tripod'],
 ['patio-fire-bowl','Ember garden fire bowl','Outdoor',800,800,480,'decor','Open metal bowl with stacked logs; decorative only, no flames'],
 ['cobble-patio','River cobble patio module','Outdoor',2000,2000,70,'rug','Mixed-size rounded stone paving; duplicate modules without adding walls'],
 ['concrete-patio','Modern concrete patio module','Outdoor',2000,2000,70,'rug','Large concrete slabs with shallow joints'],
 ['brick-patio','Basket-weave brick patio module','Outdoor',2000,2000,60,'rug','Alternating woven brick pattern with contrasting joints'],
 ['deck-patio','Timber deck module','Outdoor',2000,2000,90,'rug','Alternating slatted deck tiles, with a low supporting base'],
 ['stepping-stones','Garden stepping stones','Outdoor',700,2400,60,'rug','Four separate irregular stepping slabs for a garden path'],
 ['grass-clump','Little grass tuft','Outdoor',300,300,180,'plant','Low-poly tapered grass blades; place individually or enable garden grass'],
];
export const outdoorIds=new Set(outdoorRows.map(r=>r[0]));
export const pavingIds=new Set(['cobble-patio','concrete-patio','brick-patio','deck-patio']);
export const sceneryOptions=['plain','city','suburban','rural','farm','medieval'] as const;
export type Scenery=typeof sceneryOptions[number];
