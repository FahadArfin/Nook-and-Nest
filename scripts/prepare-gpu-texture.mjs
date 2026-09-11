import {execFileSync} from 'node:child_process';
// Point KTX_TOKTX to Khronos KTX-Software 4.4.2's official encoder.
const encoder=process.env.KTX_TOKTX;if(!encoder)throw Error('Set KTX_TOKTX to the official toktx executable');
execFileSync(encoder,['--t2','--encode','uastc','--uastc_quality','2','--genmipmap','--threads','4','public/textures/toronto/aerial-2022.ktx2','public/textures/toronto/aerial-2022.jpg'],{stdio:'inherit'});
