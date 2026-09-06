import type { CatalogItem } from "./types";
type Row=[string,string,CatalogItem['category'],number,number,number,CatalogItem['shape'],string];
export const kitchenRows:Row[]=[
  ['push-base-cabinet','Quiet push-front cabinet','Kitchen',800,620,910,'storage','Handleless twin doors, recessed toe kick and selectable worktop'],
  ['shaker-drawer-cabinet','Cottage drawer cabinet','Kitchen',900,620,910,'storage','Three framed drawers with warm brass pulls and a separate worktop'],
  ['arched-base-cabinet','Heirloom arched cabinet','Kitchen',900,620,910,'storage','Twin arched mouldings, carved corner blocks and a stone worktop'],
  ['tall-pantry-cabinet','Full-height pantry','Kitchen',800,620,2200,'storage','Four framed doors, crown trim and generous full-height storage'],
  ['glass-wall-cabinet','Glazed wall cabinet','Kitchen',800,350,750,'storage','Glazed framed doors reveal real shelves; snaps against a wall'],
  ['open-wall-cabinet','Open kitchen cubbies','Kitchen',900,330,700,'storage','Open divided shelving with thick panels and a timber interior'],
  ['chimney-hood','Chimney extractor hood','Kitchen',900,500,800,'appliance','Tapered canopy, chimney, filters and small task lights'],
  ['under-cabinet-hood','Slim extractor hood','Kitchen',760,480,160,'appliance','Low-profile under-cabinet extractor with twin filters'],
  ['microwave-hood','Over-range microwave hood','Kitchen',760,400,430,'appliance','Wall-mounted microwave with an integrated extraction grille'],
  ['sliding-closet','Sliding-door closet','Storage',1800,650,2300,'storage','Two overlapping sliding leaves, tracks and inset finger pulls'],
  ['double-door-closet','Paneled double closet','Storage',1200,620,2300,'storage','Full-height paneled double doors and framed plinth'],
  ['closet-hanging-module','Walk-in hanging module','Storage',900,600,2200,'storage','Open wardrobe bay with clothes rail, upper shelf and two drawers'],
  ['closet-shelf-module','Walk-in shelf module','Storage',600,600,2200,'storage','Open adjustable-look shelves and a low drawer; combine into a closet'],
  ['closet-corner-module','Walk-in corner module','Storage',1000,1000,2200,'storage','L-shaped open shelving; combine with hanging and shelf modules'],
  ['wide-fluted-dresser','Reeded wide dresser','Storage',1500,480,850,'storage','Six drawers with vertical fluting, brass pulls and tapered feet'],
  ['tall-drawer-chest','Tall five-drawer chest','Storage',700,470,1250,'storage','Five stacked framed drawers on chunky wood feet'],
  ['two-slot-toaster','Toast & honey toaster','Kitchen',300,200,210,'appliance','Two real recessed slots, lever and browning dial'],
  ['espresso-machine','Little espresso station','Kitchen',300,380,380,'appliance','Group head, portafilter, steam wand, drip tray and pressure dial'],
  ['filter-coffee-maker','Morning drip coffee maker','Kitchen',220,300,360,'appliance','Raised filter basket and translucent carafe with handle'],
  ['knife-block','Oak knife block','Kitchen',180,220,340,'appliance','Five individual knife handles seated in a warm wood block'],
  ['countertop-microwave','Countertop microwave','Kitchen',510,400,300,'appliance','Rounded enamel body, dark window, handle and control keys'],
  ['stand-mixer','Sunday baking mixer','Kitchen',260,380,360,'appliance','Tilt-head style mixer with a hollow bowl, beater and sturdy pedestal'],
  ['glass-air-fryer','Glass-bowl air fryer','Kitchen',300,340,340,'appliance','Clear cooking bowl, removable tray, top heater and easy-grip handle'],
  ['dome-pendant','Harvest dome pendant','Lighting',400,400,750,'lamp','Open metal dome shade, warm diffuser, cord and ceiling canopy'],
  ['linear-pendant','Gathering linear pendant','Lighting',1200,160,650,'lamp','Long warm diffuser suspended on two cords over an island'],
  ['backsplash-subway','Handmade subway backsplash','Kitchen',1200,24,600,'backsplash','Staggered beveled ceramic tiles; resize, recolor and snap against a wall'],
  ['backsplash-stacked','Stacked tile backsplash','Kitchen',1200,24,600,'backsplash','Vertical stacked ceramic tiles with softly recessed grout'],
  ['backsplash-slab','Stone slab backsplash','Kitchen',1200,24,600,'backsplash','Continuous slab with selectable marble, granite, laminate or concrete'],
];
export const kitchenModelIds=new Set(kitchenRows.map(r=>r[0]));
export const kitchenWallIds=new Set(['wall-cabinet','glass-wall-cabinet','open-wall-cabinet','chimney-hood','under-cabinet-hood','microwave-hood','backsplash-subway','backsplash-stacked','backsplash-slab']);
export const kitchenSurfaceIds=new Set(['two-slot-toaster','espresso-machine','filter-coffee-maker','knife-block','countertop-microwave','stand-mixer','glass-air-fryer']);
export const kitchenTopIds=new Set(['push-base-cabinet','shaker-drawer-cabinet','arched-base-cabinet']);
export const kitchenCeilingIds=new Set(['dome-pendant','linear-pendant']);
export const isBacksplash=(id:string)=>['backsplash-subway','backsplash-stacked','backsplash-slab'].includes(id);
export const kitchenMountHeight=(id:string):number|undefined=>isBacksplash(id)?910:kitchenWallIds.has(id)?1500:undefined;
