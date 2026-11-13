/* Pixels reais autorizados: igualdade com a fonte fixada e cinco métodos. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const raiz = path.resolve(__dirname, '..');
global.document = { createElement: () => ({ getContext: () => ({}) }) };
const modulos = ['10_core.js','20_dict.js','30_dicom.js','40_volume.js','50_deface.js','60_render.js','70_write.js','76_caso_publico_dados.js','77_caso_publico.js'];
const nomes = ['carregarCasoPublico','carregarPixelsCasoPublico','montarVolume','LeitorDICOM','limiarAutomatico','analisar','fundoDoVolume','faixaDaFace','aplicarMetodo','materializar','medir','METODOS','escreverCorte','escreverNIfTI','MapaUID','CREDITO_CASO_PUBLICO','ATRIBUICAO_DICOM_PUBLICO'];
eval(modulos.map(n => fs.readFileSync(path.join(raiz,'src/js',n),'utf8')).join('\n') + '\nObject.assign(global, {' + nomes.join(',') + '});');
const hash = p => createHash('sha256').update(new Uint8Array(p.buffer, p.byteOffset, p.byteLength)).digest('hex');
(async () => {
  const arquivos = await carregarCasoPublico();
  assert.equal(arquivos.length, 53);
  const brutos = await Promise.all(arquivos.map(async a => ({nome:a.name,buf:await a.arrayBuffer()})));
  const vol = await montarVolume(brutos.slice().reverse());
  assert.deepEqual([vol.nx,vol.ny,vol.nz], [208,260,53]);
  assert.deepEqual([vol.px,vol.py,vol.pz], [0.976562,0.976562,3]);
  assert.deepEqual(vol.origem, [-87.402344,-318.433594,-603]);
  assert.equal(vol.modalidade,'CT');
  const fonteHash = '262ed0d317a0b5d8095cee6afe7930ba29fb631d178445434c7e4766083dd30b';
  assert.equal(hash(vol.pix), fonteHash, 'DICOM mantém cada voxel do recorte público autorizado.');
  assert.equal(vol.refLeitor.txt('00100010'),'PUBLICO^PAT8');
  assert.equal(vol.refLeitor.txt('00280302'),'YES', 'A face real continua reconhecível.');
  assert.ok(!vol.refLeitor.txt('00100030'), 'Não fabricar data de nascimento.');
  assert.ok(CREDITO_CASO_PUBLICO.includes('CC BY 4.0') && CREDITO_CASO_PUBLICO.includes('consentimento'));
  const limiar = limiarAutomatico(vol), an = await analisar(vol,{limiar,espMin:6});
  const faixa = faixaDaFace(vol,an,{prof:25,orelhas:false}), fundo = fundoDoVolume(vol,limiar);
  const resultados = [];
  for (const met of METODOS) {
    const delta = await aplicarMetodo(vol,an,faixa,met.id,{fundo,semente:'AULA-DEFACE-2026',desloc:0});
    const pix = materializar(vol,delta), m = medir(vol,an,faixa,pix,delta);
    assert.ok(delta.n > 0 && Number.isFinite(m.rms) && m.rms > 0);
    assert.equal(hash(vol.pix),fonteHash,'Aplicar um método nunca altera a origem.');
    const k = Math.floor(vol.nz/2), n = vol.nx*vol.ny;
    const bytes = escreverCorte(vol.cortes[k].leitor,pix.subarray(k*n,(k+1)*n),vol.nx,vol.ny,{
      modalidade:'CT',uids:new MapaUID(),nomePseudo:'DERIVADO^DIDATICO',idPseudo:'AULA-PAT8',metodoTxt:met.nome,
      atribuicaoPublica:ATRIBUICAO_DICOM_PUBLICO
    });
    const ld = new LeitorDICOM(bytes.buffer,'derivado.dcm'); await ld.ler(); ld.prepararTexto();
    assert.deepEqual((await ld.lerPixels()).pix,pix.subarray(k*n,(k+1)*n));
    assert.ok(ld.txt('00082111').includes('CC BY 4.0') && ld.txt('00082111').includes('10.6084/m9.figshare.8857007.v2'));
    resultados.push({metodo:met.id,voxels:delta.n,rms:+m.rms.toFixed(2)});
  }
  const nii = await escreverNIfTI(vol,vol.pix);
  const plain = await new Response(new Blob([nii]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const cab = new DataView(plain);
  assert.deepEqual([cab.getInt16(42,true),cab.getInt16(44,true),cab.getInt16(46,true)],[208,260,53]);
  assert.equal(plain.byteLength,352+vol.pix.byteLength);
  console.log(JSON.stringify({caso:'Pat8',cortes:53,fonteHash,alturaCabeca:an.alturaCabeca,alertaGeometria:an.suspeito,resultados},null,2));
  console.log('PASSOU: caso real autorizado, fidelidade dos pixels, cinco métodos isolados, DICOM e NIfTI.');
})().catch(e => { console.error(e); process.exitCode = 1; });
