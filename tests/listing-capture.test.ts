import { expect, it } from 'vitest';
import { withCleanListingCapture } from '../src/scene/listingCapture';

function mesh(name: string, enabled = true, outlined = false, boxed = false) {
  return { name, enabled, renderOutline: outlined, showBoundingBox: boxed,
    isEnabled() { return this.enabled; }, setEnabled(value: boolean) { this.enabled = value; } };
}
it('captures the actual furniture with editing helpers, drafts, and outlines hidden, then restores them', () => {
  const chair = mesh('item:chair', true, true, true), grid = mesh('edit-grid'), inactiveGuide = mesh('wall-draft', false);
  const draft = mesh('furniture-preview-root'), rotation = mesh('rotation-root');
  const image = withCleanListingCapture([chair, grid, inactiveGuide], [draft, rotation], () => {
    expect(chair.enabled).toBe(true); expect(chair.renderOutline).toBe(false); expect(chair.showBoundingBox).toBe(false);
    expect([grid, inactiveGuide, draft, rotation].every(m => !m.enabled)).toBe(true);
    return 'data:image/png;base64,captured';
  });
  expect(image).toContain('captured'); expect(chair.renderOutline).toBe(true); expect(chair.showBoundingBox).toBe(true);
  expect([grid, draft, rotation].every(m => m.enabled)).toBe(true); expect(inactiveGuide.enabled).toBe(false);
});
it('restores exact helper visibility after a failed screenshot without exposing an already hidden draft', () => {
  const chair = mesh('chair', true, true), guide = mesh('clearance'), draft = mesh('draft', false);
  expect(() => withCleanListingCapture([chair, guide], [draft], () => { throw new Error('canvas export denied'); })).toThrow('canvas export denied');
  expect(chair.renderOutline).toBe(true); expect(guide.enabled).toBe(true); expect(draft.enabled).toBe(false);
});
it('preserves a child guide own visibility when its parent was already hidden', () => {
  const parent = mesh('rotation-root', false), child = { ...mesh('rotation-ring'), isEnabled(checkAncestors = true) { return this.enabled && (!checkAncestors || parent.enabled); } };
  withCleanListingCapture([child], [parent], () => {});
  expect(parent.enabled).toBe(false); expect(child.enabled).toBe(true);
  parent.setEnabled(true); expect(child.isEnabled()).toBe(true);
});
