import data from './personalSurfaceSlots.json';
// Intern repeated authored role names without loading full material/color metadata at startup.
export const personalSurfaceSlots:Record<string,string[]>=Object.fromEntries(
 Object.entries(data.models).map(([id,indices])=>[id,indices.map(index=>data.roles[index])])
);
