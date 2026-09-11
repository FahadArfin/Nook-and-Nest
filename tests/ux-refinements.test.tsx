// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {LengthInput} from '../src/LengthInput';
import {parseFraction,readableLength} from '../src/measurement';
import {createExamplePlan} from '../src/examplePlan';
import {validatePlan} from '../src/planValidation';
import {AccessibleDialog} from '../src/AccessibleDialog';
afterEach(cleanup);
it('formats carry and negative lengths without displaying decimal feet',()=>{expect(readableLength(3048,'imperial')).toBe('10′ 0″');expect(readableLength(-3048,'imperial')).toBe('−10′ 0″');expect(parseFraction('6 1/2')).toBe(6.5);expect(parseFraction('1/0')).toBe(Infinity)});
it('leaves imported precision untouched on blur and unit changes, then accepts a fractional edit',()=>{const change=vi.fn();const view=render(<LengthInput label="Width" value={2742.83} units="imperial" onChange={change}/>);fireEvent.blur(screen.getByLabelText('Width inches'));expect(change).not.toHaveBeenCalled();view.rerender(<LengthInput label="Width" value={2742.83} units="metric" onChange={change}/>);fireEvent.blur(screen.getByLabelText('Width metres'));expect(change).not.toHaveBeenCalled();view.rerender(<LengthInput label="Width" value={2742.83} units="imperial" onChange={change}/>);fireEvent.change(screen.getByLabelText('Width inches'),{target:{value:'6 1/2'}});fireEvent.blur(screen.getByLabelText('Width inches'));expect(change).toHaveBeenCalledWith(Math.round((9*12+6.5)*25.4))});
it('rejects malformed fractional input without corrupting dimensions',()=>{const change=vi.fn();render(<LengthInput label="Depth" value={3048} units="imperial" onChange={change}/>);fireEvent.change(screen.getByLabelText('Depth inches'),{target:{value:'1/0'}});fireEvent.blur(screen.getByLabelText('Depth inches'));expect(change).not.toHaveBeenCalled()});
it('makes an independent valid furnished example',()=>{const a=createExamplePlan(),b=createExamplePlan();validatePlan(a);expect(a.id).not.toBe(b.id);expect(a.furniture.length).toBeGreaterThan(0);expect(a.furniture.every(p=>p.floorId===a.floors[0].id)).toBe(true)});
it('names dialogs and handles native Escape cancellation',()=>{HTMLDialogElement.prototype.showModal=vi.fn(function(this:HTMLDialogElement){this.setAttribute('open','')});HTMLDialogElement.prototype.close=vi.fn();const close=vi.fn();render(<AccessibleDialog label="Help" onClose={close}><button>Search</button></AccessibleDialog>);fireEvent(screen.getByRole('dialog',{name:'Help',hidden:true}),new Event('cancel',{cancelable:true}));expect(close).toHaveBeenCalledOnce()});
