import {create} from 'zustand';

// Runtime status only: never serialize Google content, session tokens or credentials.
export const useGoogleScenery = create<{
  paused:boolean; status:string; credits:string; visible:boolean; requests:number;
  restart:number; pause:()=>void; resume:()=>void; newSession:()=>void;
}>(set=>({paused:false,status:'Ready to load',credits:'',visible:false,requests:0,restart:0,
  pause:()=>set({paused:true}),resume:()=>set({paused:false}),
  newSession:()=>set(s=>({restart:s.restart+1,paused:false})),
}));

export function googleFrameAllowed(active:boolean, paused:boolean, hidden:boolean, expired:boolean) {
  return active && !paused && !hidden && !expired;
}
