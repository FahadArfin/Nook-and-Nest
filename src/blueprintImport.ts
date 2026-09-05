export interface PlanReference { url:string; width:number; height:number; pages:number; name:string }
export const MAX_REFERENCE_BYTES=25*1024*1024;
export function checkReferenceFile(file:Pick<File,'name'|'size'|'type'>) {
  if(file.size>MAX_REFERENCE_BYTES)throw new Error('Choose a floor plan smaller than 25 MB.');
  if(!file.size)throw new Error('This file is empty.');
  if(!/\.(pdf|png|jpe?g|webp)$/i.test(file.name))throw new Error('Use a PDF, PNG, JPG or WebP floor plan.');
}
/** Render locally. No document scripts, links, annotations, or uploads to a server. */
export async function renderReference(file:File,pageNumber=1,rotation=0):Promise<PlanReference> {
  checkReferenceFile(file);
  const canvas=document.createElement('canvas');
  let pages=1;
  if(/\.pdf$/i.test(file.name)) {
    const pdfjs=await import('pdfjs-dist');
    const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
    const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),stopAtErrors:true,maxImageSize:32_000_000});
    try {
      const pdf=await task.promise;pages=pdf.numPages;
      if(pages>200)throw new Error('Choose a PDF with 200 pages or fewer. Export the floor-plan page from a larger document.');
      if(pageNumber<1||pageNumber>pages)throw new Error('Choose an existing PDF page.');
      const page=await pdf.getPage(pageNumber),native=page.getViewport({scale:1,rotation:(page.rotate+rotation)%360});
      const viewport=page.getViewport({scale:Math.min(2,2400/Math.max(native.width,native.height)),rotation:(page.rotate+rotation)%360});
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      const context=canvas.getContext('2d');if(!context)throw new Error('Your browser cannot render this floor plan.');
      await page.render({canvas,canvasContext:context,viewport,annotationMode:pdfjs.AnnotationMode.DISABLE}).promise;
    } finally {await task.destroy();}
  } else {
    const bitmap=await createImageBitmap(file);
    try {
      if(bitmap.width*bitmap.height>40_000_000)throw new Error('This image is too large. Resize it to under 40 megapixels.');
      const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height)),w=bitmap.width*scale,h=bitmap.height*scale,quarter=rotation%180!==0;
      canvas.width=Math.round(quarter?h:w);canvas.height=Math.round(quarter?w:h);
      const context=canvas.getContext('2d');if(!context)throw new Error('Your browser cannot render this image.');
      context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.translate(canvas.width/2,canvas.height/2);context.rotate(rotation*Math.PI/180);context.drawImage(bitmap,-w/2,-h/2,w,h);
    } finally {bitmap.close();}
  }
  return {url:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height,pages,name:file.name};
}
