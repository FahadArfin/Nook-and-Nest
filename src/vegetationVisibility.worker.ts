import {visibleField,type FieldView} from './vegetationVisibility';
import type {VegetationField} from './vegetationField';
let field:VegetationField={cells:{},removed:{}};
self.onmessage=({data}:{data:{revision:number;field?:VegetationField;view:FieldView}})=>{
 if(data.field)field=data.field;
 self.postMessage({revision:data.revision,candidates:visibleField(field,data.view)});
};
