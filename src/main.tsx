import React from "react";
import { createRoot } from "react-dom/client";
import {PublicEntry} from './PublicEntry';
const Welcome=React.lazy(()=>import('./Welcome').then(m=>({default:m.Welcome})));
const ArPreviewPage=React.lazy(()=>import('./ArPiecePreview').then(m=>({default:m.ArPreviewPage})));
const Editor=React.lazy(()=>import('./App').then(m=>({default:m.EditorApp})));
const DebugApp=React.lazy(()=>import('./App').then(m=>({default:m.App})));
class EditorBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true}}render(){return this.state.failed?<main role="alert"><h1>Your editor could not open</h1><p>Check your connection and try again. Saved projects are still on this device.</p><button onClick={()=>location.reload()}>Try again</button></main>:this.props.children}}
function LazyEditor(props:{onHome?:()=>void}){return <EditorBoundary><React.Suspense fallback={<p role="status">Opening your home…</p>}><Editor {...props}/></React.Suspense></EditorBoundary>}
function NormalApp(){return import.meta.env.DEV&&new URLSearchParams(location.search).has('showcase')?<React.Suspense fallback={<p role="status">Opening preview…</p>}><DebugApp/></React.Suspense>:<React.Suspense fallback={<p role="status">Opening Nook &amp; Nest…</p>}><Welcome Editor={LazyEditor}/></React.Suspense>}
function App(){if(new URLSearchParams(location.search).get('piece-preview')==='1')return <EditorBoundary><React.Suspense fallback={<p role="status">Opening your piece…</p>}><ArPreviewPage/></React.Suspense></EditorBoundary>;return <PublicEntry><NormalApp/></PublicEntry>;}

import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/fraunces/600.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<React.StrictMode><React.Suspense fallback={<p role="status">Opening Nook &amp; Nest…</p>}><App /></React.Suspense></React.StrictMode>);
