/* Empacota a TC pública autorizada pelo mesmo escritor usado no aplicativo. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(__dirname, '..');
global.document = { createElement: () => ({ getContext: () => ({}) }) };
const modulos = ['10_core.js','20_dict.js','30_dicom.js','40_volume.js','50_deface.js','60_render.js','70_write.js','76_caso_publico_dados.js','77_caso_publico.js'];
eval(modulos.map(n => fs.readFileSync(path.join(raiz, 'src/js', n), 'utf8')).join('\n') + '\nglobal.montarZIPCasoPublico = montarZIPCasoPublico;');
(async () => {
  const arquivo = path.join(raiz, 'exemplos/publicos/mar-facial-pat8/TC_REAL_PAT8_DIDATICA.zip');
  const blob = await montarZIPCasoPublico();
  fs.writeFileSync(arquivo, new Uint8Array(await blob.arrayBuffer()));
  console.log(path.basename(arquivo) + ': ' + blob.size + ' bytes');
})().catch(e => { console.error(e); process.exitCode = 1; });
