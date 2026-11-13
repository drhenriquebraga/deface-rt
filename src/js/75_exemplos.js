/* =========================================================================
   Casos didáticos gerados no dispositivo. A anatomia é um fantoma geométrico
   autoral: não é exame de paciente nem cópia de um rosto. Os identificadores
   deliberadamente fictícios permitem observar a limpeza do cabeçalho.
   ========================================================================= */
'use strict';

const EXEMPLO_DIDATICO = {
  nome: 'Fantoma sintético DeFace RT',
  descricao: 'Geometria simplificada, sem dados de paciente. Não representa anatomia diagnóstica.',
  dimensoes: [128, 128, 112], espaco: [1.8, 1.8, 2],
  semente: 'AULA-DEFACE-2026'
};

/* Produz arquivos completos para exercitar o MESMO leitor usado na abertura
   de uma série externa. Não injeta um volume pronto no estado da interface. */
async function gerarCasoSintetico(modalidade = 'CT', opcoes = {}) {
  if (modalidade !== 'CT' && modalidade !== 'MR')
    throw new Error('O exemplo didático aceita apenas TC ou RM.');
  const [nx, ny, nz] = EXEMPLO_DIDATICO.dimensoes;
  const [px, py, pz] = EXEMPLO_DIDATICO.espaco;
  const rm = modalidade === 'MR';
  const aleatorio = prng(EXEMPLO_DIDATICO.semente + modalidade);
  const arquivos = [];
  /* UIDs de UUIDs constantes exclusivos deste fantoma, nunca de pessoa. */
  const raizUID = '2.25.281245607148902346176528901345071' + (opcoes.textoNosPixels ? (rm ? '204' : '203') : (rm ? '202' : '201'));
  for (let k = 0; k < nz; k++) {
    const z = (k - (nz - 1) / 2) * pz;
    const pixels = new Int16Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      const a = ((ny - 1) / 2 - j) * py; // anterior = -Y em LPS
      for (let i = 0; i < nx; i++) {
        const l = (i - (nx - 1) / 2) * px;
        const q = (l / 74) ** 2 + (a / 90) ** 2 + (z / 104) ** 2;
        const superficie = 90 * Math.sqrt(Math.max(0, 1 - (l / 74) ** 2 - (z / 104) ** 2));
        const perfilNariz = z > 46 ? 0 : z > 6 ? (46 - z) / 40 : Math.exp(-(((z - 6) / 14) ** 2));
        const nariz = 23 * Math.exp(-((l / 11) ** 2)) * perfilNariz;
        const dentro = q <= 1 || (a > 0 && a <= superficie + nariz && perfilNariz > 0.001 && Math.abs(l) < 30);
        let valor = rm ? 0 : -1000;
        if (dentro) {
          const casca = q > 0.82 && q <= 0.95;
          const variacao = Math.round((aleatorio() - 0.5) * (rm ? 30 : 10));
          valor = rm ? (casca ? 80 : 690) + variacao : (casca ? 900 : 45) + variacao;
          /* Ventriculos, órbitas e seios são elipsoides didáticos. */
          const ventriculo = (l / 10) ** 2 + ((a + 6) / 22) ** 2 + ((z - 20) / 11) ** 2 < 1;
          const olho = ((Math.abs(l) - 27) / 13) ** 2 + ((a - 64) / 15) ** 2 + ((z - 17) / 13) ** 2 < 1;
          const seio = (l / 14) ** 2 + ((a - 69) / 12) ** 2 + ((z + 6) / 12) ** 2 < 1;
          if (ventriculo) valor = rm ? 220 : 10;
          if (olho) valor = rm ? 900 : 20;
          if (seio) valor = rm ? 0 : -900;
        }
        pixels[i + j * nx] = valor;
      }
    }
    if (opcoes.textoNosPixels) {
      /* Palavra DEMO desenhada longe da face: a limpeza dos cabeçalhos não
         pode removê-la. A anotação é inventada e não identifica ninguém. */
      const letras = ['110101101101110', '111100110100111', '101111111101101', '111101101101111'];
      for (let letra = 0; letra < letras.length; letra++)
        for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++)
          if (letras[letra][y * 3 + x] === '1')
            for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++)
              pixels[4 + letra * 8 + x * 2 + dx + (4 + y * 2 + dy) * nx] = rm ? 1000 : 1200;
    }
    const bytes = escreverExemploSintetico(pixels, k, modalidade, raizUID, opcoes);
    arquivos.push(new File([bytes], 'FANTOMA_' + modalidade + '_' + String(k + 1).padStart(4, '0') + '.dcm',
      { type: 'application/dicom', lastModified: Date.UTC(2026, 0, 1) }));
    if (k % 8 === 0) await cede();
  }
  return arquivos;
}

function escreverExemploSintetico(pixels, corte, modalidade, raizUID, opcoes = {}) {
  const [nx, ny] = EXEMPLO_DIDATICO.dimensoes;
  const [px, py, pz] = EXEMPLO_DIDATICO.espaco;
  const sopClasse = '1.2.840.10008.5.1.4.1.1.' + (modalidade === 'MR' ? '4' : '2');
  const sop = raizUID + '.4.' + (corte + 1);
  const d = new EscritorDICOM();
  d.texto('00080005', 'CS', 'ISO_IR 192');
  d.texto('00080008', 'CS', 'DERIVED\\SECONDARY\\SYNTHETIC');
  d.texto('00080016', 'UI', sopClasse); d.texto('00080018', 'UI', sop);
  d.texto('00080020', 'DA', '20000101'); d.texto('00080030', 'TM', '120000');
  d.texto('00080050', 'SH', 'AULA-FICTICIA');
  d.texto('00080060', 'CS', modalidade);
  d.texto('00080070', 'LO', 'GERADOR SINTETICO');
  d.texto('00080080', 'LO', 'INSTITUICAO FICTICIA PARA ENSINO');
  d.texto('00080090', 'PN', 'DOCENTE^FICTICIO');
  d.texto('00081030', 'LO', 'CASO SINTETICO - NAO E PACIENTE');
  d.texto('0008103E', 'LO', 'FANTOMA DIDATICO ' + modalidade);
  d.texto('00081090', 'LO', 'MODELO GEOMETRICO');
  d.texto('00100010', 'PN', 'FANTOMA^SINTETICO');
  d.texto('00100020', 'LO', 'EXEMPLO-FICTICIO-' + modalidade);
  d.texto('00100030', 'DA', '19500101');
  d.texto('00100040', 'CS', 'O');
  d.texto('00101010', 'AS', '050Y');
  d.texto('00181030', 'LO', 'PROTOCOLO DIDATICO');
  d.texto('00180050', 'DS', String(pz));
  d.texto('00185100', 'CS', 'HFS');
  d.texto('0020000D', 'UI', raizUID + '.1');
  d.texto('0020000E', 'UI', raizUID + '.2');
  d.texto('00200052', 'UI', raizUID + '.3');
  d.texto('00200011', 'IS', '1'); d.texto('00200013', 'IS', String(corte + 1));
  d.texto('00200032', 'DS', [-(nx - 1) * px / 2, -(ny - 1) * py / 2,
    (corte - (EXEMPLO_DIDATICO.dimensoes[2] - 1) / 2) * pz].join('\\'));
  d.texto('00200037', 'DS', '1\\0\\0\\0\\1\\0');
  d.us('00280002', 1); d.texto('00280004', 'CS', 'MONOCHROME2');
  d.us('00280010', ny); d.us('00280011', nx);
  d.texto('00280030', 'DS', py + '\\' + px);
  d.us('00280100', 16); d.us('00280101', 16); d.us('00280102', 15); d.us('00280103', 1);
  d.texto('00280300', 'CS', 'YES');
  d.texto('00280301', 'CS', opcoes.textoNosPixels ? 'YES' : 'NO');
  if (opcoes.textoNosPixels) d.texto('00204000', 'LT', 'TEXTO SINTETICO NOS PIXELS: DEMO');
  d.texto('00281050', 'DS', modalidade === 'MR' ? '450' : '40');
  d.texto('00281051', 'DS', modalidade === 'MR' ? '900' : '400');
  d.texto('00281052', 'DS', '0'); d.texto('00281053', 'DS', '1');
  d.texto('00090010', 'LO', 'DEFACE_RT_EXEMPLO');
  d.texto('00091001', 'LO', 'IDENTIFICADOR FICTICIO EM TAG PRIVADA');
  const corpo = reordenar(d.montar());
  const pxBytes = new Uint8Array(pixels.length * 2);
  const dv = new DataView(pxBytes.buffer);
  for (let i = 0; i < pixels.length; i++) dv.setInt16(i * 2, pixels[i], true);
  const ep = new EscritorDICOM(); ep.elem('7FE00010', 'OW', pxBytes);
  const meta = new EscritorDICOM();
  meta.elem('00020001', 'OB', new Uint8Array([0, 1]));
  meta.texto('00020002', 'UI', sopClasse); meta.texto('00020003', 'UI', sop);
  meta.texto('00020010', 'UI', '1.2.840.10008.1.2.1');
  meta.texto('00020012', 'UI', '2.25.281245607148902346176528901345071200');
  meta.texto('00020013', 'SH', 'DEFACE_EXEMPLO');
  const mc = meta.montar();
  const tamanho = new Uint8Array(4); new DataView(tamanho.buffer).setUint32(0, mc.length, true);
  const grupo = new EscritorDICOM(); grupo.elem('00020000', 'UL', tamanho);
  const partes = [grupo.montar(), mc, corpo, ep.montar()];
  const saida = new Uint8Array(132 + partes.reduce((n, p) => n + p.length, 0));
  saida.set([68, 73, 67, 77], 128);
  let pos = 132;
  for (const parte of partes) { saida.set(parte, pos); pos += parte.length; }
  return saida;
}

async function montarZIPExemplo(modalidade = 'CT', opcoes = {}) {
  const arquivos = await gerarCasoSintetico(modalidade, opcoes);
  const itens = [];
  for (const arq of arquivos) itens.push({ nome: arq.name, dados: new Uint8Array(await arq.arrayBuffer()) });
  itens.push({ nome: 'LEIAME_SINTETICO.txt', dados: new TextEncoder().encode([
    EXEMPLO_DIDATICO.nome, EXEMPLO_DIDATICO.descricao,
    'Modalidade simulada: ' + modalidade + '. 128 x 128 x 112 voxels; 1,8 x 1,8 x 2 mm.',
    'Todos os identificadores, datas, nomes e pixels foram fabricados para ensino.',
    'Abra o ZIP inteiro no DeFace RT e compare os cinco metodos, os cabecalhos e a geometria.',
    'Semente sugerida para resultados reproduziveis: ' + EXEMPLO_DIDATICO.semente,
    opcoes.textoNosPixels ? 'Este caso tem a palavra ficticia DEMO gravada nos pixels. A limpeza de cabecalho NAO a remove.' : 'Este caso nao contem anotacao gravada nos pixels.',
    'Uso educacional. Nao demonstra eficacia em pacientes nem anonimato.',
    'Os ZIPs sinteticos nao contem as amostras publicas de terceiros; consulte exemplos/publicos.'
  ].join('\n')) });
  return montarZIP(itens);
}
