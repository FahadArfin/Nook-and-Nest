import type { CatalogItem } from './types';
type Row=[string,string,CatalogItem['category'],number,number,number,CatalogItem['shape'],string];
export const interiorRows:Row[]=[
  ['diamond-wool-rug','Atlas diamond wool rug','Decor',2000,2800,24,'rug','Warm wool-style pile with a restrained Moroccan-inspired diamond lattice'],
  ['kilim-rug','Trail woven kilim','Decor',1800,2600,18,'rug','Flat-woven bands, terracotta diamonds and hand-tied-looking fringe'],
  ['jute-rug','Harvest jute rug','Decor',2000,2000,18,'rug','Round natural-fiber style rug with concentric woven rings'],
  ['arch-color-rug','Sunrise arch rug','Decor',2000,2800,24,'rug','Layered sage, clay and cream arches with a thick soft border'],
  ['wide-check-rug','Sunday checker rug','Decor',2400,3000,24,'rug','Generous muted two-tone checks in a bound rectangular rug'],
  ['display-bookcase','Gallery display bookcase','Storage',1200,420,1900,'storage','Three tall open bays for plants, books and collectibles; selectable shelf levels'],
  ['ladder-display-shelf','Leaning ladder shelf','Storage',800,460,1800,'storage','Four graduated shelves with thick leaning uprights and raised back lips'],
  ['cube-display-shelf','Nine-nook cubby shelf','Storage',1320,360,1320,'storage','Nine separately usable square cubbies in a chunky wood frame'],
  ['adventurer-figurine','Sky traveler figurine','Decor',150,140,270,'decor','Original anime-inspired adventurer in a scarf, on a small display plinth'],
  ['mecha-figurine','Little guardian robot','Decor',180,150,290,'decor','Original articulated-looking mecha collectible with broad armor and a visor'],
  ['model-sailboat','Voyager model ship','Decor',440,180,360,'decor','Display sailboat with a shaped hull, mast, cream sails and timber cradle'],
  ['brick-roadster','Brickwork roadster','Decor',280,150,110,'decor','Original brick-style car model with visible studs, wheels and a little windshield'],
  ['twin-full-bunk','Camp twin-over-full bunk','Bedroom',1530,2160,1900,'bed','Wider lower bed, narrow upper bunk, chunky guard rails and an attached ladder'],
  ['storage-bunk','Keepsake storage bunk','Bedroom',1130,2160,1860,'bed','Two bunks with framed headboards, deep under-bed drawers and a side ladder'],
  ['low-kids-bunk','Little cabin low bunk','Bedroom',1130,2080,1450,'bed','Low floor-level bottom bed, upper guard rails and short easy-to-read ladder'],
  ['cane-nightstand','Willow bedside cabinet','Bedroom',540,440,590,'storage','Woven cane drawer front, open lower shelf and four warm tapered legs'],
  ['floating-nightstand','Float bedside drawer','Bedroom',520,380,230,'storage','Wall-mounted bedside drawer with a recessed pull and raised-edge top'],
  ['pedestal-nightstand','Drum bedside table','Bedroom',460,460,550,'table','Round fluted pedestal and a shallow drawer with a brass knob'],
  ['valley-panorama','Evening valley panorama','Decor',1600,60,1100,'decor','Large original gouache-style landscape in a deep wood frame'],
  ['starlight-poster','Last train to starlight','Decor',600,35,900,'decor','Original anime-inspired sky traveler print in a slim frame'],
  ['singer-poster','After hours music print','Decor',600,35,900,'decor','Original fictional soul singer in a warm retro screen-print style'],
  ['basketball-poster','Above the rim print','Decor',600,35,900,'decor','Original unbranded basketball illustration with bold diagonal movement'],
  ['left-chaise-sectional','Haven left-chaise sectional','Living',2850,1850,850,'seat','Tailored three-seat sofa with a long left chaise and connected upholstered arms'],
  ['right-chaise-sectional','Haven right-chaise sectional','Living',2850,1850,850,'seat','Mirrored right-chaise layout with broad cushions and low wood feet'],
  ['u-sectional','Gather-around U sectional','Living',3600,2200,850,'seat','Generous U-shaped conversation sofa with two deep chaise ends'],
  ['boneless-loveseat','Cloudfold boneless loveseat','Living',1900,1050,780,'seat','Low foam-style sofa with a folded cushioned shell and subtle channel seams'],
  ['boneless-chaise','Cloudfold boneless chaise','Living',1150,1750,780,'seat','Deep foam-style lounge with a sloped back, quilted seat and no visible legs'],
];
export const interiorArtIds=new Set(['valley-panorama','starlight-poster','singer-poster','basketball-poster']);
export const collectibleIds=new Set(['adventurer-figurine','mecha-figurine','model-sailboat','brick-roadster']);
export const shelfIds=new Set(['display-bookcase','ladder-display-shelf','cube-display-shelf']);
export const interiorWallIds=new Set([...interiorArtIds,'floating-nightstand']);
