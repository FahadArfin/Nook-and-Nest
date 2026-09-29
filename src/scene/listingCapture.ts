interface VisibilityNode {
  isEnabled(checkAncestors?: boolean): boolean;
  setEnabled(enabled: boolean): void;
}
interface CaptureMesh extends VisibilityNode {
  name: string;
  renderOutline: boolean;
  showBoundingBox: boolean;
}

/** Capture synchronously so temporary presentation flags never reach saved state. */
export function withCleanListingCapture<T>(meshes: CaptureMesh[], editorRoots: Array<VisibilityNode | undefined>, capture: () => T): T {
  const hidden = new Map<VisibilityNode, boolean>();
  for (const node of editorRoots) if (node) hidden.set(node, node.isEnabled(false));
  for (const mesh of meshes) if (/^(edit-grid$|fit-review-guide$|rotation-|wall-draft|wall-snap|inside-wall-preview$|empty-floor-guide$|tile-draft|measured-|paint-selection$|clearance$|draft-footprint$)/.test(mesh.name)) hidden.set(mesh, mesh.isEnabled(false));
  const outlined = meshes.filter(m => m.renderOutline), boxed = meshes.filter(m => m.showBoundingBox);
  hidden.forEach((_, node) => node.setEnabled(false));
  outlined.forEach(m => m.renderOutline = false);
  boxed.forEach(m => m.showBoundingBox = false);
  try { return capture(); }
  finally {
    hidden.forEach((enabled, node) => node.setEnabled(enabled));
    outlined.forEach(m => m.renderOutline = true);
    boxed.forEach(m => m.showBoundingBox = true);
  }
}
