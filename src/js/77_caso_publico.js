/* TC real publicada para reconstrução facial, com consentimento declarado
   pelos autores e licença CC BY 4.0. O payload contém somente pixels e
   geometria do recorte documentado; os cabeçalhos DICOM são recriados aqui. */
'use strict';

const CREDITO_CASO_PUBLICO = [
  'Medical Augmented Reality Facial Data Collection, v2 — caso Pat8.',
  'Jan Egger, Christina Gsaxner e Jürgen Wallner (2019). CC BY 4.0.',
  'Dados: https://doi.org/10.6084/m9.figshare.8857007.v2',
  'Artigo e consentimento: https://pmc.ncbi.nlm.nih.gov/articles/PMC6901520/',
  'Licença: https://creativecommons.org/licenses/by/4.0/',
  'Gsaxner et al., Scientific Data 6:310 (2019), doi:10.1038/s41597-019-0327-8.',
  'Gsaxner et al., MICCAI (2019), pp.236–244, doi:10.1007/978-3-030-32254-0_27.',
  'TC REAL, com face reconhecível. Os autores declaram consentimento de todos os participantes para publicação desses dados identificáveis.',
  'Adaptação DeFace RT: recorte de face e pescoço, orientação e conversão do NRRD para DICOM. Intensidades preservadas, sem gerar anatomia.',
  'O recorte didático não inclui a calota superior completa. Não foi completada artificialmente.',
  'Os cabeçalhos são de conversão; não são os cabeçalhos originais do hospital. PUBLICO^PAT8 e MAR-PAT8 são rótulos didáticos.',
  'Os autores da coleção não endossam este aplicativo. Uso educacional; os métodos não comprovam anonimato.'
].join('\n');

const ATRIBUICAO_DICOM_PUBLICO = 'Medical Augmented Reality Facial Data Collection v2, Pat8; Egger, Gsaxner e Wallner (2019). https://doi.org/10.6084/m9.figshare.8857007.v2 ; CC BY 4.0 https://creativecommons.org/licenses/by/4.0/ . Adaptacao DeFace RT: recorte, conversao DICOM e metodo didatico indicado em (0012,0063). Consentimento de publicacao facial declarado em doi:10.1038/s41597-019-0327-8. Sem endosso.';

let pixelsCasoPublico = null;
async function carregarPixelsCasoPublico() {
  if (!pixelsCasoPublico) pixelsCasoPublico = (async () => {
    const texto = atob(CASO_PUBLICO_DADOS.pixelsBase64);
    const bytes = Uint8Array.from(texto, c => c.charCodeAt(0));
    const fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const bruto = await new Response(fluxo).arrayBuffer();
    const n = CASO_PUBLICO_DADOS.dimensoes.reduce((a, b) => a * b, 1);
    if (bruto.byteLength !== n * 2) throw new Error('O caso público embutido está incompleto.');
    const leitura = new DataView(bruto), pixels = new Int16Array(n);
    for (let i = 0; i < n; i++) pixels[i] = leitura.getInt16(i * 2, true);
    return pixels;
  })().catch(e => { pixelsCasoPublico = null; throw e; });
  return pixelsCasoPublico;
}

function escreverCorteCasoPublico(pixels, corte) {
  const [nx, ny] = CASO_PUBLICO_DADOS.dimensoes;
  const [px, py, pz] = CASO_PUBLICO_DADOS.espaco;
  const origem = CASO_PUBLICO_DADOS.origemLPS;
  const raiz = '2.25.281245607148902346176528901345071418';
  const classe = '1.2.840.10008.5.1.4.1.1.2', sop = raiz + '.4.' + (corte + 1);
  const d = new EscritorDICOM();
  d.texto('00080005', 'CS', 'ISO_IR 192');
  d.texto('00080008', 'CS', 'DERIVED\\SECONDARY');
  d.texto('00080016', 'UI', classe); d.texto('00080018', 'UI', sop);
  d.texto('00080060', 'CS', 'CT');
  d.texto('00080070', 'LO', 'DEFACE RT - CONVERSAO DIDATICA');
  d.texto('00081030', 'LO', 'TC REAL PUBLICA - FACE COM CONSENTIMENTO');
  d.texto('0008103E', 'LO', 'MAR FACIAL PAT8 - RECORTE DIDATICO');
  d.texto('00082111', 'ST', 'Recorte NRRD de Pat8, Medical Augmented Reality Facial Data Collection v2, CC BY 4.0. Pixels preservados; cabecalhos recriados. DOI 10.6084/m9.figshare.8857007.v2');
  d.texto('00100010', 'PN', 'PUBLICO^PAT8');
  d.texto('00100020', 'LO', 'MAR-PAT8');
  d.texto('00120062', 'CS', 'YES');
  d.texto('00120063', 'LO', 'Cabecalhos recriados; face publica consentida e reconhecivel');
  d.texto('00180050', 'DS', String(pz)); d.texto('00185100', 'CS', 'HFS');
  d.texto('0020000D', 'UI', raiz + '.1'); d.texto('0020000E', 'UI', raiz + '.2');
  d.texto('00200052', 'UI', raiz + '.3');
  d.texto('00200011', 'IS', '1'); d.texto('00200013', 'IS', String(corte + 1));
  d.texto('00200032', 'DS', [origem[0], origem[1], origem[2] + corte * pz].join('\\'));
  d.texto('00200037', 'DS', '1\\0\\0\\0\\1\\0');
  d.us('00280002', 1); d.texto('00280004', 'CS', 'MONOCHROME2');
  d.us('00280010', ny); d.us('00280011', nx); d.texto('00280030', 'DS', py + '\\' + px);
  d.us('00280100', 16); d.us('00280101', 16); d.us('00280102', 15); d.us('00280103', 1);
  d.texto('00280300', 'CS', 'NO'); d.texto('00280301', 'CS', 'NO'); d.texto('00280302', 'CS', 'YES');
  d.texto('00281050', 'DS', '40'); d.texto('00281051', 'DS', '400');
  d.texto('00281052', 'DS', '0'); d.texto('00281053', 'DS', '1');
  const corpo = reordenar(d.montar());
  const pxBytes = new Uint8Array(pixels.length * 2), dv = new DataView(pxBytes.buffer);
  for (let i = 0; i < pixels.length; i++) dv.setInt16(i * 2, pixels[i], true);
  const ep = new EscritorDICOM(); ep.elem('7FE00010', 'OW', pxBytes);
  const meta = new EscritorDICOM(); meta.elem('00020001', 'OB', new Uint8Array([0, 1]));
  meta.texto('00020002', 'UI', classe); meta.texto('00020003', 'UI', sop);
  meta.texto('00020010', 'UI', '1.2.840.10008.1.2.1');
  meta.texto('00020012', 'UI', '2.25.281245607148902346176528901345071410');
  meta.texto('00020013', 'SH', 'DEFACE_PUBLICO');
  const mc = meta.montar(), tamanho = new Uint8Array(4);
  new DataView(tamanho.buffer).setUint32(0, mc.length, true);
  const grupo = new EscritorDICOM(); grupo.elem('00020000', 'UL', tamanho);
  const partes = [grupo.montar(), mc, corpo, ep.montar()];
  const saida = new Uint8Array(132 + partes.reduce((n, p) => n + p.length, 0));
  saida.set([68, 73, 67, 77], 128);
  let pos = 132;
  for (const parte of partes) { saida.set(parte, pos); pos += parte.length; }
  return saida;
}

async function carregarCasoPublico() {
  const pixels = await carregarPixelsCasoPublico();
  const [nx, ny, nz] = CASO_PUBLICO_DADOS.dimensoes, n = nx * ny, arquivos = [];
  for (let k = 0; k < nz; k++) {
    const bytes = escreverCorteCasoPublico(pixels.subarray(k * n, (k + 1) * n), k);
    arquivos.push(new File([bytes], 'MAR_PAT8_CT_' + String(k + 1).padStart(4, '0') + '.dcm',
      { type: 'application/dicom', lastModified: Date.UTC(2019, 11, 9) }));
    if (k % 8 === 0) await cede();
  }
  return arquivos;
}

async function montarZIPCasoPublico() {
  const arquivos = await carregarCasoPublico(), itens = [];
  for (const arquivo of arquivos) itens.push({ nome: arquivo.name, dados: new Uint8Array(await arquivo.arrayBuffer()) });
  itens.push({ nome: 'FONTE_LICENCA_E_CONSENTIMENTO.txt', dados: new TextEncoder().encode(CREDITO_CASO_PUBLICO) });
  return montarZIP(itens);
}
