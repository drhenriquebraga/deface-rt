/* Integração dos casos didáticos: fonte DICOM -> volume -> cinco métodos ->
   métricas -> exportação -> releitura. Não depende de DOM nem de rede. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
global.ImageData = class { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } };
global.document = { createElement: () => ({ getContext: () => ({}) }), addEventListener() {} };
const raiz = path.resolve(__dirname, '..');
const modulos = ['10_core.js','20_dict.js','30_dicom.js','40_volume.js','50_deface.js','60_render.js','70_write.js','75_exemplos.js'];
const fonte = modulos.map(n => fs.readFileSync(path.join(raiz, 'src/js', n), 'utf8')).join('\n');
const nomes = ['gerarCasoSintetico','montarZIPExemplo','montarVolume','LeitorDICOM','auditar','limiarAutomatico','analisar',
  'fundoDoVolume','faixaDaFace','aplicarMetodo','materializar','medir','METODOS','escreverCorte','escreverNIfTI','MapaUID'];
eval(fonte + '\nObject.assign(global, {' + nomes.join(',') + '});');

async function testar(modalidade) {
  const arquivos = await gerarCasoSintetico(modalidade);
  assert.equal(arquivos.length, 112);
  const brutos = await Promise.all(arquivos.map(async a => ({ nome: a.name, buf: await a.arrayBuffer() })));
  /* Embaralhar a ordem exige que a montagem use as posições DICOM. */
  const vol = await montarVolume(brutos.slice().reverse());
  assert.deepEqual([vol.nx, vol.ny, vol.nz], [128,128,112]);
  assert.equal(vol.modalidade, modalidade);
  assert.equal(vol.irregular, false);
  assert.equal(vol.diag.falhas.length, 0);
  assert.equal(vol.refLeitor.txt('00100010'), 'FANTOMA^SINTETICO');
  assert.equal(vol.refLeitor.txt('00280301'), 'NO');
  assert.equal(vol.refLeitor.txt('00280300'), 'YES');
  const audit = auditar(vol.refLeitor);
  assert.ok(audit.crit > 0 && audit.priv >= 2, 'O exemplo precisa ensinar identidade e tags privadas');
  assert.ok(audit.qi.length > 0, 'O exemplo precisa expor quase-identificadores');
  const limiar = limiarAutomatico(vol);
  const an = await analisar(vol, { limiar, espMin: 6 });
  assert.ok(!an.suspeito, 'O fantoma precisa ter marcos faciais plausíveis: ' + JSON.stringify({altura:an.alturaCabeca,rel:an.relNariz}));
  const faixa = faixaDaFace(vol, an, { prof:25, orelhas:false });
  const fundo = fundoDoVolume(vol, limiar);
  const medidas = [];
  for (const met of METODOS) {
    const delta = await aplicarMetodo(vol, an, faixa, met.id, { fundo, semente:'AULA-DEFACE-2026', desloc:0 });
    const pix = materializar(vol, delta);
    const m = medir(vol, an, faixa, pix, delta);
    assert.ok(delta.n > 0 && m.voxels > 0, met.id + ' precisa alterar voxels');
    assert.ok(Number.isFinite(m.rms) && m.rms > 0, met.id + ' precisa permitir medir o deslocamento');
    assert.ok(m.voxelsPct > 0 && m.voxelsPct < 30, met.id + ' precisa preservar a maior parte do volume');
    const k = Math.floor(vol.nz/2), n = vol.nx * vol.ny;
    const bytes = escreverCorte(vol.cortes[k].leitor, pix.subarray(k*n,(k+1)*n), vol.nx, vol.ny, {
      modalidade, uids:new MapaUID(), nomePseudo:'FANTOMA^DERIVADO', idPseudo:'AULA-SAIDA', metodoTxt:met.nome
    });
    const ld = new LeitorDICOM(bytes.buffer, 'derivado.dcm'); await ld.ler(); ld.prepararTexto();
    assert.equal(ld.txt('00100010'),'FANTOMA^DERIVADO');
    assert.equal(ld.txt('00100020'),'AULA-SAIDA');
    assert.equal(ld.txt('00120062'),'YES');
    assert.ok(!ld.elems.has('00091001'), 'A tag privada deve sair');
    assert.notEqual(ld.txt('0020000E'), vol.refLeitor.txt('0020000E'));
    const relido = await ld.lerPixels();
    assert.deepEqual(relido.pix, pix.subarray(k*n,(k+1)*n));
    const nifti = await escreverNIfTI(vol, pix);
    const descomprimido = new Uint8Array(await new Response(new Blob([nifti]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    const cab = new DataView(descomprimido.buffer);
    assert.equal(cab.getInt32(0,true),348);
    assert.equal(cab.getInt16(42,true),128);
    assert.equal(cab.getInt16(46,true),112);
    assert.equal(descomprimido.length,352+pix.byteLength);
    medidas.push({modalidade,metodo:met.id,limiar,rms:+m.rms.toFixed(2),alterados:+m.voxelsPct.toFixed(2)});
  }
  const novamente = await gerarCasoSintetico(modalidade);
  assert.deepEqual(new Uint8Array(await novamente[55].arrayBuffer()), new Uint8Array(brutos[55].buf), 'Fonte didática determinística');
  const zip = await montarZIPExemplo(modalidade);
  const zipBytes = new Uint8Array(await zip.arrayBuffer());
  assert.equal(new DataView(zipBytes.buffer).getUint32(0,true),0x04034b50);
  assert.equal(new DataView(zipBytes.buffer).getUint16(zipBytes.length-12,true),113);
  console.table(medidas);
  return { modalidade, cortes:112, bytesZIP:zipBytes.length, medidas };
}

(async () => {
  const resultados = [];
  for (const modalidade of ['CT','MR']) resultados.push(await testar(modalidade));
  const anotados = await gerarCasoSintetico('CT',{textoNosPixels:true});
  const comTexto = new LeitorDICOM(await anotados[55].arrayBuffer(),'anotado.dcm');
  await comTexto.ler(); comTexto.prepararTexto();
  assert.equal(comTexto.txt('00280301'),'YES');
  assert.ok(auditar(comTexto).achados.some(a=>a.n==='Anotação queimada na imagem'));
  const pxAnotado=await comTexto.lerPixels();
  assert.equal(pxAnotado.pix[4+4*128],1200,'A palavra fictícia DEMO está nos pixels');
  const exportado=escreverCorte(comTexto,pxAnotado.pix,128,128,{
    modalidade:'CT',uids:new MapaUID(),nomePseudo:'FANTOMA^DERIVADO',idPseudo:'AULA-SAIDA',metodoTxt:'TESTE DE CABECALHO'
  });
  const apenasCabecalho=new LeitorDICOM(exportado.buffer,'revisar.dcm'); await apenasCabecalho.ler(); apenasCabecalho.prepararTexto();
  assert.equal(apenasCabecalho.txt('00280301'),'YES');
  assert.equal((await apenasCabecalho.lerPixels()).pix[4+4*128],1200,'A limpeza do cabeçalho não remove texto do pixel');
  console.log('PASSOU: TC e RM sintéticas, 10 combinações de método, metadados, determinismo, DICOM e NIfTI.');
  console.log('PASSOU: texto fictício gravado nos pixels gera alerta e persiste após limpeza de cabeçalho.');
  if (process.argv.includes('--relatorio')) {
    fs.mkdirSync(path.join(raiz,'exemplos'),{recursive:true});
    fs.writeFileSync(path.join(raiz,'exemplos','verificacao.json'),JSON.stringify({resultados},null,2)+'\n');
  }
})().catch(e => { console.error(e); process.exitCode=1; });
