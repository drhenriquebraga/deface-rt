/* Gera os ZIPs de aula com o mesmo módulo offline do aplicativo. */
const fs = require('node:fs');
const path = require('node:path');
global.document = { createElement: () => ({ getContext: () => ({}) }) };
const raiz = path.resolve(__dirname, '..');
const modulos = ['10_core.js','20_dict.js','30_dicom.js','40_volume.js','50_deface.js','60_render.js','70_write.js','75_exemplos.js'];
const fonte = modulos.map(n => fs.readFileSync(path.join(raiz,'src/js',n),'utf8')).join('\n');
eval(fonte+'\nglobal.montarZIPExemplo = montarZIPExemplo;');
(async () => {
  const destino = path.join(raiz,'exemplos','sinteticos');
  fs.mkdirSync(destino,{recursive:true});
  for (const mod of ['CT','MR']) {
    const dados = new Uint8Array(await (await montarZIPExemplo(mod)).arrayBuffer());
    const nome = 'FANTOMA_' + (mod === 'CT' ? 'TC' : 'RM') + '_SINTETICO.zip';
    fs.writeFileSync(path.join(destino,nome),dados);
    console.log(nome + ': ' + dados.length + ' bytes');
  }
  const anotado = new Uint8Array(await (await montarZIPExemplo('CT', {textoNosPixels:true})).arrayBuffer());
  fs.writeFileSync(path.join(destino,'FANTOMA_TC_TEXTO_NOS_PIXELS.zip'),anotado);
  console.log('FANTOMA_TC_TEXTO_NOS_PIXELS.zip: ' + anotado.length + ' bytes');
})().catch(e => { console.error(e); process.exitCode=1; });
