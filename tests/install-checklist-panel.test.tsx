// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createSamplePlan } from '../src/domain';
import { captureInstallChecklist, type InstallPlan } from '../src/installChecklist';
import { InstallChecklistPanel } from '../src/InstallChecklistPanel';
import { preparePersonalPhoto } from '../src/personalMedia';
import { importPersonalAssets } from '../src/personalStorage';
vi.mock('../src/personalStorage', () => ({ loadPersonalPhoto: vi.fn(async () => undefined), importPersonalAssets: vi.fn(async () => {}) }));
vi.mock('../src/personalMedia', () => ({ preparePersonalPhoto: vi.fn() }));
afterEach(cleanup);
function fixture(): InstallPlan { const plan = createSamplePlan('Private apartment', 'metric'); plan.furniture = [{ id: 'table', floorId: plan.floors[0].id, catalogId: 'side-table', x: 500, z: 500, rotation: 0, widthMm: 500, depthMm: 450, heightMm: 600, variant: 'oat' }]; return plan; }

it('requires deliberate capture and keeps template selection out of the project until Create', () => {
  const plan = fixture(), onChange = vi.fn(); render(<InstallChecklistPanel plan={plan} onChange={onChange} onClose={() => {}}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Ready for photos' })); expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Choose matching items' })); expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Create checklist' }));
  expect(onChange).toHaveBeenCalledOnce(); const [base, next] = onChange.mock.calls[0]; expect(base).toBe(plan); expect(next.furniture).toBe(plan.furniture); expect(next.installChecklist.template).toBe('photo-day'); expect(next.installChecklist.items[0].packing).toBe('unknown');
});

it('keeps stale captures visible and rejects a task edit after a concurrent project change', () => {
  const plan = fixture(); plan.installChecklist = captureInstallChecklist(plan, 'install', ['table']); const onChange = vi.fn(), view = render(<InstallChecklistPanel plan={plan} onChange={onChange} onClose={() => {}}/>);
  fireEvent.click(screen.getByRole('button', { name: `Edit ${plan.installChecklist.tasks[0].title}` }));
  fireEvent.change(screen.getByLabelText('Responsible person'), { target: { value: 'Alex' } });
  const changed = { ...plan, furniture: plan.furniture.map(i => ({ ...i, x: 2500 })) };
  view.rerender(<InstallChecklistPanel plan={changed} onChange={onChange} onClose={() => {}}/>);
  expect(screen.getByText(/The layout changed:/)).toBeTruthy(); expect(screen.getByRole('alert').textContent).toContain('Cancel and reopen');
  fireEvent.submit(screen.getByRole('button', { name: 'Save task' }).closest('form')!);
  expect(onChange).not.toHaveBeenCalled(); expect(screen.getAllByRole('alert').some(e => e.textContent?.includes('Reopen'))).toBe(true);
  expect(changed.installChecklist!.items[0].signature).toBe(plan.installChecklist.items[0].signature);
});

it('saves task facts only on Save and requires deliberate confirmation before replacing the checklist', () => {
  const plan = fixture(); plan.installChecklist = captureInstallChecklist(plan, 'install', ['table']); const onChange = vi.fn(); render(<InstallChecklistPanel plan={plan} onChange={onChange} onClose={() => {}}/>);
  fireEvent.click(screen.getByRole('button', { name: `Edit ${plan.installChecklist.tasks[0].title}` }));
  fireEvent.click(within(screen.getByRole('group', { name: 'Task progress' })).getByRole('button', { name: 'Done' }));
  fireEvent.change(screen.getByLabelText('Responsible person'), { target: { value: 'Alex' } }); expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save task' })); expect(onChange).toHaveBeenCalledOnce();
  expect(onChange.mock.calls[0][1].installChecklist.tasks[0]).toMatchObject({ state: 'done', assignee: 'Alex' }); expect(onChange.mock.calls[0][1].furniture).toBe(plan.furniture);
  fireEvent.click(screen.getByRole('button', { name: 'Review captured items' }));
  expect((screen.getByRole('button', { name: 'Replace checklist' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText('Replace this checklist and its task records with a new template'));
  expect((screen.getByRole('button', { name: 'Replace checklist' }) as HTMLButtonElement).disabled).toBe(false);
});

it('rejects late photo attachment after a project change and cancels attachment on unmount', async () => {
  for (const unmount of [false, true]) {
    vi.mocked(importPersonalAssets).mockClear();
    const plan = fixture(); plan.installChecklist = captureInstallChecklist(plan, 'install', ['table']); const onChange = vi.fn();
    let resolve!: (value: Awaited<ReturnType<typeof preparePersonalPhoto>>) => void;
    vi.mocked(preparePersonalPhoto).mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const view = render(<InstallChecklistPanel plan={plan} onChange={onChange} onClose={() => {}}/>);
    fireEvent.click(screen.getByRole('button', { name: `Edit ${plan.installChecklist.tasks[0].title}` }));
    fireEvent.change(screen.getByLabelText('Add local photo'), { target: { files: [new File(['photo'], 'room.png', { type: 'image/png' })] } });
    if (unmount) view.unmount(); else view.rerender(<InstallChecklistPanel plan={{ ...plan }} onChange={onChange} onClose={() => {}}/>);
    await act(async () => resolve({ version: 1, id: 'sha256:' + 'a'.repeat(64), createdAt: '2026-09-29T12:00:00Z', original: '', preview: '', width: 10, height: 10 }));
    expect(importPersonalAssets).not.toHaveBeenCalled(); expect(onChange).not.toHaveBeenCalled();
    if (!unmount) { expect(screen.getAllByRole('alert').some(e => e.textContent?.includes('Reopen the task'))).toBe(true); view.unmount(); }
  }
});
