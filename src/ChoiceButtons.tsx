/** Small mutually exclusive choices, with visible labels and keyboard-native buttons. */
export function ChoiceButtons<T extends string>({label,value,options,onChange,disabled=false}:{label:string;value:T;options:ReadonlyArray<{value:T;label:string}>;onChange(value:T):void;disabled?:boolean}){
  return <div className="choice-field"><span>{label}</span><div className="choice-buttons" role="group" aria-label={label}>{options.map(option=><button type="button" key={option.value} disabled={disabled} aria-pressed={value===option.value} onClick={()=>onChange(option.value)}>{option.label}</button>)}</div></div>;
}
