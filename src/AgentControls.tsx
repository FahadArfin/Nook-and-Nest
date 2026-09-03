import { useEffect } from 'react';
import { Robot, X, Check, ArrowCounterClockwise } from '@phosphor-icons/react';
import { agentTools, applyProposal, browserModelContext, discardProposal, registerAgentTools, useAgent } from './webmcp';
import { usePlanner } from './store';
import './agent.css';

export function AgentControls({busy}:{busy:boolean}) {
  const agent=useAgent();const past=usePlanner(s=>s.past.length);
  useEffect(()=>registerAgentTools(browserModelContext()),[]);
  useEffect(()=>{useAgent.setState({busy});},[busy]);
  const pending=agent.pending;
  const apply=()=>{if(!pending)return;try{applyProposal(pending.id);}catch(e){useAgent.setState({message:(e as Error).message});}};
  return <div className="agent-entry">
    <button onClick={()=>useAgent.setState({open:!agent.open})} aria-label="Decorate with an agent" aria-expanded={agent.open} className={pending?'agent-has-proposal':''}><Robot/><span>Agent</span>{pending&&<span className="agent-dot"/>}</button>
    {agent.open&&<section className="agent-panel" aria-labelledby="agent-heading">
      <div className="agent-heading"><div><span className="eyebrow">A second pair of creative eyes</span><h2 id="agent-heading">Decorate together</h2></div><button aria-label="Close agent panel" onClick={()=>useAgent.setState({open:false})}><X/></button></div>
      <p>Ask your browser’s agent to furnish your apartment. It can choose from all 216 pieces, arrange a room, style individual parts, and place the little finishing touches.</p>
      <div className="agent-connection" role="status">{agent.status==='ready'?`${agentTools.length} native tools connected`:agent.status==='unsupported'?'This browser does not expose WebMCP yet':agent.status==='error'?'Agent connection unavailable':'Connecting native tools…'}</div>
      {agent.status==='unsupported'&&<p>Open this site in ChatGPT’s in-app browser or a browser with WebMCP enabled. Manual decorating still works normally.</p>}
      <label className="agent-permission"><input type="checkbox" checked={agent.allowApply} disabled={agent.paused} onChange={e=>useAgent.setState({allowApply:e.target.checked})}/><span><strong>Let my agent apply designs</strong><small>{agent.allowApply?'Direct edits allowed for this project in this tab. You can undo them.':'Review first: only you can apply the proposal.'}</small></span></label>
      <label className="agent-permission"><input type="checkbox" checked={agent.paused} onChange={e=>{useAgent.setState({paused:e.target.checked,allowApply:false});if(e.target.checked)discardProposal();}}/><span>Pause agent tools</span></label>
      <p className="agent-example">Try asking: “Give this apartment a warm, bookish feel. Add a reading corner, a practical workspace, and a rug. Keep the windows clear.”</p>
      <p className="agent-message" aria-live="polite">{agent.message}</p>
      {pending&&<div className="agent-proposal"><span className="eyebrow">Unsaved design preview</span><h3>{pending.label}</h3><p>{pending.operationCount} edits · {pending.plan.furniture.length} total pieces · one undo step</p>{pending.warnings.length>0&&<details><summary>{pending.warnings.length} layout notes — review the fit</summary><ul>{pending.warnings.map((w,i)=><li key={i}>{w.message}</li>)}</ul></details>}<div className="agent-buttons"><button className="primary" disabled={busy||agent.paused} onClick={apply}><Check/> Apply design</button><button onClick={discardProposal}><X/> Discard</button></div></div>}
      {!pending&&past>0&&<button className="agent-undo" disabled={busy} onClick={()=>usePlanner.getState().undo()}><ArrowCounterClockwise/> Undo last edit</button>}
      <small className="agent-privacy">Tools work only on the open apartment, not your account or other saved projects. Changes autosave on this device after applying. Online saving and sharing stay in Project and Share. No API key needed here.</small>
    </section>}
  </div>;
}

export function AgentPreviewNotice(){const pending=useAgent(s=>s.pending);if(!pending)return null;return <div className="agent-preview-shield"><div role="status"><Robot/> Previewing “{pending.label}” — not saved <button onClick={()=>useAgent.setState({open:true})}>Review design</button><button onClick={discardProposal}>Discard</button></div></div>;}
