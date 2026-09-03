import { Wall } from "@phosphor-icons/react";
import { usePlanner } from "./store";
import { getWallVisibility, nextWallVisibility, wallVisibilityActions, wallVisibilityLabels, wallVisibilityModes } from "./wallVisibility";
import "./wallVisibility.css";

export function WallVisibilityControl() {
  const camera = usePlanner(state => state.plan.camera);
  const cycle = usePlanner(state => state.cycleWallVisibility);
  const mode = getWallVisibility(camera);
  const label = wallVisibilityLabels[mode];
  const next = wallVisibilityActions[nextWallVisibility(mode)];
  return <button type="button" className={`wall-visibility-control ${mode === "all-visible" ? "" : "active"}`}
    onClick={cycle} aria-label={`Walls: ${label}. ${next}`} title={`${label} · Click to ${next.toLowerCase()}`}>
    <Wall aria-hidden="true" />
    <span className="wall-visibility-step" aria-hidden="true">{wallVisibilityModes.indexOf(mode) + 1}</span>
    <span className="wall-visibility-tooltip" aria-hidden="true">{label}<small>Next: {next.toLowerCase()}</small></span>
    <span className="wall-visibility-status" role="status">{label}</span>
  </button>;
}
