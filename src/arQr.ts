/** Generates the QR locally from the already sanitized piece link. No QR service receives the link. */
export async function createPieceQr(link:string):Promise<{size:number;path:string}> {
  if(link.length>3000)throw new Error('The phone link is too long for this QR preview.');
  const {default:qr}=await import('qrcode'),code=qr.create(link,{errorCorrectionLevel:'M'}),size=code.modules.size;
  let path='';for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(code.modules.get(y,x))path+=`M${x+4} ${y+4}h1v1h-1z`;
  return {size:size+8,path};
}
