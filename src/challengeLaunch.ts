import type {ChallengeLaunch} from './CreativeChallengesPanel';
import type {PlanDocumentV1} from './types';

/** Save both projects before switching; never overwrite a newer editor state after an async write. */
export async function launchCreativeProject(request:ChallengeLaunch, bridge:{current():PlanDocumentV1;save(plan:PlanDocumentV1):Promise<void>;open(plan:PlanDocumentV1):void}):Promise<boolean> {
  const fresh=()=>!request.signal.aborted&&bridge.current()===request.base;
  if(!fresh())throw new Error('The project changed. Review the challenge again.');
  const candidate=request.createPlan();
  await bridge.save(request.base);
  if(!fresh()){await bridge.save(bridge.current());return false;}
  await bridge.save(candidate);
  if(!fresh()){await bridge.save(bridge.current());return false;}
  bridge.open(candidate);
  return true;
}
