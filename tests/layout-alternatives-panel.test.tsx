// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBlankPlan } from '../src/domain';
import { validatePlan } from '../src/planValidation';
import { saveLayoutAlternative } from '../src/layoutAlternatives';
import * as alternativeHelpers from '../src/layoutAlternatives';
import { LayoutAlternativesPanel } from '../src/LayoutAlternativesPanel';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const fixture = () => {
  const plan = createBlankPlan('Ideas', 'metric');
  return saveLayoutAlternative(plan, 'Open room', plan.floors[0].id, validatePlan, { id: 'open-room' });
};
describe('layout idea confirmation', () => {
  it('does not rescan saved layouts while the user types an idea name', () => {
    const plan = fixture(), compare = vi.spyOn(alternativeHelpers, 'layoutDifference');
    render(<LayoutAlternativesPanel plan={plan} activeFloorId={plan.floors[0].id} onApply={vi.fn()} onChange={vi.fn()} />);
    expect(compare).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByRole('textbox', { name: 'Idea name' }), { target: { value: 'Another option' } });
    expect(compare).toHaveBeenCalledOnce();
  });

  it('does not apply or discard anything until confirmation, and cancel leaves the parent untouched', () => {
    const plan = fixture(), onApply = vi.fn(), onChange = vi.fn();
    render(<LayoutAlternativesPanel plan={plan} activeFloorId={plan.floors[0].id} onApply={onApply} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use Open room' }));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep working' }));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Use Open room' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm layout change' }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onApply.mock.calls[0][0]).toBe(plan);
    expect(onApply.mock.calls[0][1].id).toBe(plan.id);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects confirmation if the plan changed while the confirmation was open', () => {
    const plan = fixture(), onApply = vi.fn(), onChange = vi.fn();
    const view = render(<LayoutAlternativesPanel plan={plan} activeFloorId={plan.floors[0].id} onApply={onApply} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use Open room' }));
    view.rerender(<LayoutAlternativesPanel plan={{ ...plan, name: 'Another revision' }} activeFloorId={plan.floors[0].id} onApply={onApply} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm layout change' }));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toMatch(/project changed/i);
  });
});
