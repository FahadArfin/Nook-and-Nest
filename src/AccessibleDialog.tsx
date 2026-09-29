import {useEffect,useRef,type ReactNode,type RefObject} from 'react';
export function AccessibleDialog({label,onClose,children,returnFocus,className=''}:{label:string;onClose():void;children:ReactNode;returnFocus?:RefObject<HTMLElement|null>;className?:string}){
 const ref=useRef<HTMLDialogElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>{ref.current?.close();(returnFocus?.current??previous)?.focus()}},[]);
 return <dialog ref={ref} className={`dialog ux-dialog ${className}`} aria-label={label} onCancel={e=>{e.preventDefault();close.current()}} onKeyDown={e=>e.stopPropagation()}>{children}</dialog>;
}
