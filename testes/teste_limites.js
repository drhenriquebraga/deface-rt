/* Regressao: entradas fora do intervalo suportado devem falhar, nao corromper. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(__dirname, '..');
const codigo = ['10_core.js','20_dict.js','30_dicom.js'].map(n =>
  fs.readFileSync(path.join(raiz,'src/js',n),'utf8')).join('\n');
eval(codigo + '\nglobalThis.apiLimites = {LeitorDICOM,decodJPEGSemPerdas,decodRLE};');

function leitorBruto(valor, extras = {}) {
  const buf = new ArrayBuffer(2);
  new DataView(buf).setUint16(0, valor, true);
  const l = new apiLimites.LeitorDICOM(buf, 'FICTICIO.dcm');
  const tags = {'00280011':1,'00280010':1,'00280100':16,'00280101':16,'00280103':0,'00280002':1,...extras};
  l.us = tag => tags[tag] || 0;
  l.txt = tag => tag === '00280008' ? String(tags[tag] || 1) : '';
  l.pixel = {off:0,encapsulado:false}; l.ts = {be:false};
  return l;
}
function rle(valor) {
  const b = new Uint8Array(68); const d = new DataView(b.buffer);
  d.setUint32(0,2,true);d.setUint32(4,64,true);d.setUint32(8,66,true);
  b.set([0,valor>>8,0,valor&255],64);return b;
}
(async () => {
  assert.equal((await leitorBruto(32000).lerPixels()).pix[0],32000);
  await assert.rejects(() => leitorBruto(50000).lerPixels(), /32767|intervalo/i);
  assert.equal(apiLimites.decodRLE(rle(32000),1,1,16,0)[0],32000);
  assert.throws(() => apiLimites.decodRLE(rle(50000),1,1,16,0), /32767|intervalo/i);
  // Marcador DRI com intervalo nao nulo: o decodificador antigo seguia sem
  // reinicializar a predicao e alterava pixels silenciosamente.
  assert.throws(() => apiLimites.decodJPEGSemPerdas(
    Uint8Array.from([255,216,255,221,0,4,0,2,255,217]),1,1,0), /rein[ií]cio|DRI/i);
  await assert.rejects(() => leitorBruto(1,{'00280008':2}).lerPixels(), /multiquadro/i);
  console.log('Limites: valores suportados preservados; unsigned alto, DRI e multiquadro recusados.');
})().catch(e => {console.error(e);process.exitCode=1;});
