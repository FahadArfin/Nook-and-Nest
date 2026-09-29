import { describe, expect, it, vi } from 'vitest';
import { catalog } from '../src/catalog';
import { challengeBrief, challengeDefinitions, challengeProgress, createChallengeProject, parseCreativeChallenge, updateCreativeChallenge, withoutCreativeChallenge } from '../src/creativeChallenges';
import { validatePlan } from '../src/planValidation';

describe('private creative briefs', () => {
  it('uses deterministic original briefs and verified available assets, while launches get separate document identities', () => {
    for (const definition of challengeDefinitions) {
      const brief = challengeBrief(definition.id, 9123); expect(brief).toEqual(challengeBrief(definition.id, 9123)); expect(brief.available).toBe(true);
      expect(brief.requirements.every(r => catalog.some(c => c.id === r.suggestion))).toBe(true);
      const first = createChallengeProject(brief, 'metric'), second = createChallengeProject(brief, 'metric'); expect(first.id).not.toBe(second.id); expect(first.floors[0].id).not.toBe(second.floors[0].id); expect(first.floors[0].cells).toEqual(second.floors[0].cells); expect(first.furniture).toEqual([]); validatePlan(first);
    }
    expect(challengeBrief('reading-nook', 1, new Set()).available).toBe(false);
    for (const seed of [-1, 1.2, Infinity, 0x100000000]) expect(() => challengeBrief('reading-nook', seed)).toThrow();
  });
  it('checks catalog roles, rotated footprint containment and piece counts without a taste score or eligibility claim', () => {
    const brief = challengeBrief('reading-nook', 5), plan = createChallengeProject(brief, 'metric');
    expect(challengeProgress(plan)!.goals.filter(g => g.id.startsWith('role')).every(g => !g.complete)).toBe(true);
    plan.furniture = brief.requirements.map((r, index) => { const c = catalog.find(c => c.id === r.suggestion)!; return { id: `piece-${index}`, catalogId: c.id, floorId: plan.floors[0].id, x: brief.widthMm / 2, z: brief.depthMm / 2, rotation: index === 0 ? 45 : 0, widthMm: c.widthMm, depthMm: c.depthMm, heightMm: c.heightMm, variant: 'sage' }; });
    const progress = challengeProgress(plan)!; expect(progress.goals.every(g => g.complete)).toBe(true); expect(progress).not.toHaveProperty('score');
    plan.furniture[0].x = 1; expect(challengeProgress(plan)!.goals.find(g => g.id === 'inside')?.complete).toBe(false);
    plan.furniture = Array.from({ length: 301 }, (_, i) => ({ ...plan.furniture[0], id: `piece-${i}` })); expect(challengeProgress(plan)?.bounded).toBe(false);
  });
  it('makes hints/removal explicit metadata edits with stale guards, and excludes progress from public copies', () => {
    const plan = createChallengeProject(challengeBrief('one-color-studio', 7), 'metric'), before = structuredClone(plan), validate = vi.fn();
    const next = updateCreativeChallenge(plan, plan, { ...plan.creativeChallenge!, hintsDismissed: true }, validate); expect(next.furniture).toBe(plan.furniture); expect(next.floors).toBe(plan.floors); expect(plan).toEqual(before);
    expect(() => updateCreativeChallenge(plan, { ...plan }, undefined, validate)).toThrow('changed'); expect(withoutCreativeChallenge(next)).not.toHaveProperty('creativeChallenge'); expect(next.creativeChallenge?.hintsDismissed).toBe(true);
    expect(updateCreativeChallenge(next, next, undefined, validate)).not.toHaveProperty('creativeChallenge');
    for (const value of [{ ...plan.creativeChallenge, ranking: 1 }, { ...plan.creativeChallenge, seed: 1.5 }, { ...plan.creativeChallenge, startedAt: 'not-a-date' }]) expect(() => parseCreativeChallenge(value)).toThrow();
  });
});
