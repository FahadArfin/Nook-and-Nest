/** The intentionally small JSON Schema subset used by our WebMCP contract.
 * Validate again in the app: browser schema validation is not a security boundary. */
export type Schema = { type?: string; properties?: Record<string, Schema>; required?: string[]; additionalProperties?: boolean | Schema; items?: Schema; minItems?: number; maxItems?: number; minLength?: number; maxLength?: number; minimum?: number; maximum?: number; enum?: unknown[]; anyOf?: Schema[]; pattern?: string };
export const object = (properties: Record<string, Schema>, required: string[] = []): Schema => ({type:'object',properties,required,additionalProperties:false});
export const text = (maxLength=160): Schema => ({type:'string',minLength:1,maxLength});
export const number = (minimum=-100000,maximum=100000): Schema => ({type:'number',minimum,maximum});
export const integer = (minimum=0,maximum=100000): Schema => ({type:'integer',minimum,maximum});
export const choice = (...values: string[]): Schema => ({type:'string',enum:values});
export const array = (items:Schema,maxItems=100,minItems=1):Schema => ({type:'array',items,maxItems,minItems});
export function validateInput(value:unknown,schema:Schema,path='input'):void {
  const fail=(message:string):never=>{throw new Error(`${path}: ${message}`)};
  if(schema.anyOf){for(const branch of schema.anyOf){try{validateInput(value,branch,path);return;}catch{ /* Try the other explicitly supported operation. */ }}fail('does not match a supported operation; check required fields and unknown keys.');}
  if(schema.enum&&!schema.enum.includes(value))fail(`choose ${schema.enum.join(', ')}.`);
  if(schema.type==='object'){
    if(!value||typeof value!=='object'||Array.isArray(value))fail('expected an object.');
    const obj=value as Record<string,unknown>;
    for(const key of schema.required??[])if(!Object.hasOwn(obj,key))fail(`missing ${key}.`);
    for(const [key,v] of Object.entries(obj)){
      if(['__proto__','constructor','prototype'].includes(key))fail('unsupported property.');
      const sub=schema.properties?.[key];
      if(sub)validateInput(v,sub,`${path}.${key}`);
      else if(typeof schema.additionalProperties==='object')validateInput(v,schema.additionalProperties,`${path}.${key}`);
      else if(schema.additionalProperties===false)fail(`unknown field ${key}.`);
    }
  }else if(schema.type==='array'){
    if(!Array.isArray(value))fail('expected an array.');
    const list=value as unknown[];
    if(list.length<(schema.minItems??0)||list.length>(schema.maxItems??Infinity))fail('invalid number of entries.');
    list.forEach((v,i)=>validateInput(v,schema.items!,`${path}[${i}]`));
  }else if(schema.type==='string'){
    if(typeof value!=='string')fail('expected text.');const s=value as string;
    if(s.length<(schema.minLength??0)||s.length>(schema.maxLength??Infinity)||schema.pattern&&!new RegExp(schema.pattern).test(s))fail('invalid text length or format.');
  }else if(schema.type==='number'||schema.type==='integer'){
    if(typeof value!=='number'||!Number.isFinite(value)||(schema.type==='integer'&&!Number.isInteger(value))||value<(schema.minimum??-Infinity)||value>(schema.maximum??Infinity))fail('expected a finite number in the permitted range.');
  }else if(schema.type==='boolean'&&typeof value!=='boolean')fail('expected true or false.');
}
