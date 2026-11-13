/* Audita os ZIPs públicos baixados: todos os metadados livres são confrontados
   com os valores do gerador de fantoma publicado na revisão registrada. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { inflateRawSync } = require('node:zlib');
const { createHash } = require('node:crypto');
global.document = { createElement: () => ({ getContext: () => ({}) }) };
const raiz = path.resolve(__dirname,'..');
const fonte = ['10_core.js','20_dict.js','30_dicom.js','40_volume.js','50_deface.js','60_render.js','70_write.js']
  .map(n => fs.readFileSync(path.join(raiz,'src/js',n),'utf8')).join('\n');
eval(fonte+'\nObject.assign(global,{LeitorDICOM,montarVolume,limiarAutomatico,analisar,VR_TEXTO});');
const diretorio = path.join(raiz,'exemplos/publicos/cbctsynth-rt');
const manifest = JSON.parse(fs.readFileSync(path.join(diretorio,'PROVENIENCIA.json'),'utf8'));

function extrair(buf) {
  const itens = [];
  let pos = 0;
  while (pos+30 < buf.length && buf.readUInt32LE(pos) === 0x04034b50) {
    const tamanho = buf.readUInt32LE(pos+18), tamNome = buf.readUInt16LE(pos+26), tamExtra = buf.readUInt16LE(pos+28);
    const nome = buf.subarray(pos+30,pos+30+tamNome).toString('utf8');
    const metodo = buf.readUInt16LE(pos+8), ini = pos+30+tamNome+tamExtra;
    const comp = buf.subarray(ini,ini+tamanho);
    const bytes = metodo === 8 ? inflateRawSync(comp) : comp;
    if (nome.endsWith('.dcm')) itens.push({nome,bytes,buf:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length)});
    pos=ini+tamanho;
  }
  return itens;
}

const conhecidos = new Map([
  ['00020013','PYDICOM 3.0.2'], ['00080008','DERIVED\\SECONDARY'], ['00080060','CT'],
  ['00100010','PHANTOM^SYNTHETIC'], ['00100020','DEMO-PHANTOM-001'], ['00100030',''],
  ['00280004','MONOCHROME2'], ['00281054','HU'],
  ['00204000','SYNTHETIC PHANTOM - RESEARCH / NOT FOR DIAGNOSIS']
]);
const numericos = new Set(['UI','DS','IS']);
const relatos=[];
(async()=>{
  for (const serie of manifest.arquivos) {
    const zip = fs.readFileSync(path.join(diretorio,serie.nome));
    assert.equal(createHash('sha256').update(zip).digest('hex'),serie.sha256);
    const brutos = extrair(zip);
    assert.equal(brutos.length,44);
    const textos = {};
    for (const arq of brutos) {
      assert.equal(createHash('sha256').update(arq.bytes).digest('hex'),serie.dicom.find(d=>d.nome===arq.nome).sha256);
      assert.ok(arq.bytes.subarray(0,128).every(b=>b===0),'O preâmbulo não pode esconder conteúdo');
      const ld = new LeitorDICOM(arq.buf,arq.nome); await ld.ler(); ld.prepararTexto();
      for (const chave of ld.ordem) {
        const el = ld.elems.get(chave);
        assert.equal(parseInt(chave.slice(0,4),16)%2,0,'Amostra pública contém tag privada inesperada: '+chave);
        assert.notEqual(el.vr,'SQ','Sequência inesperada precisa revisão');
        if (!VR_TEXTO.has(el.vr)) continue;
        const valor = ld.txt(chave);
        if (numericos.has(el.vr)) {
          assert.ok(/^[0-9.\\+ eE-]*$/.test(valor),'Identificador ou medida inesperado: '+chave);
        } else if (chave==='0008103E') {
          assert.ok(['DEMO planning CT (synthetic phantom)','DEMO CBCT (synthetic phantom)'].includes(valor));
        } else if (chave==='00020013') {
          assert.ok(/^PYDICOM [0-9.]+$/.test(valor));
        } else {
          assert.equal(valor,conhecidos.get(chave),'Texto livre não previsto pelo gerador: '+chave);
        }
        if (!numericos.has(el.vr)) textos[chave]=valor;
      }
    }
    const vol = await montarVolume(brutos);
    assert.deepEqual([vol.nx,vol.ny,vol.nz],[140,140,44]);
    const an=await analisar(vol,{limiar:limiarAutomatico(vol),espMin:6});
    relatos.push({nome:serie.nome,arquivos:44,dimensoes:[140,140,44],textos_verificados:textos,
      altura_mm:an.alturaCabeca,marcos_suspeitos:an.suspeito,
      observacao:'Fantoma público sem nariz, não mede eficácia de desfiguração em humanos.'});
    if (process.argv.includes('--preview')) {
      /* Plano central para inspeção visual: pixels sem metadados pessoais. */
      const k=22,n=vol.nx*vol.ny, pixels=[];
      for(let i=0;i<n;i++) pixels.push(Math.max(0,Math.min(255,Math.round((vol.pix[k*n+i]+160)/400*255))));
      fs.writeFileSync(path.join(diretorio,serie.nome.replace('.zip','_corte.pgm')),Buffer.concat([
        Buffer.from('P5\n140 140\n255\n'),Buffer.from(pixels)]));
    }
  }
  fs.writeFileSync(path.join(diretorio,'AUDITORIA.json'),JSON.stringify({revisao:manifest.revisao,resultados:relatos},null,2)+'\n');
  console.log('PASSOU: 88 DICOM públicos; SHA-256, metadados, ausência de tags privadas/sequências, leitura das duas séries.');
  console.log(relatos.map(r=>({nome:r.nome,altura:r.altura_mm,suspeito:r.marcos_suspeitos})));
})().catch(e=>{console.error(e);process.exitCode=1;});
