import materials from './modelMaterials.json';
export {personalArtModels,validateSurfaceForPiece} from './personalSurfaceValidation';
const materialMap=materials as Record<string,{id:string;label:string;color:string}[]>;
export const moodboardMaterialSlots=(catalogId:string)=>materialMap[catalogId]??[];
export const swatchMaterialSlots=(catalogId:string)=>moodboardMaterialSlots(catalogId).filter(m=>/upholstery|fabric|linen|cloth|cotton|wool|carpet|leather|velvet/i.test(m.id)&&!m.id.includes('artwork'));
