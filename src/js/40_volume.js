/* =========================================================================
   Volume — montagem a partir dos cortes e espaço de índices anatômico

   O DICOM entrega o volume no referencial LPS do paciente:
     +x = esquerda   +y = posterior   +z = superior

   Em vez de reamostrar o volume (caro e destrutivo), descobrimos qual eixo
   de voxel corresponde a cada eixo anatômico e trabalhamos num espaço de
   índices (A, S, L):
     A cresce para anterior · S cresce para superior · L cresce para a esquerda
   Isso faz o motor de desfiguração funcionar igual em aquisição axial,
   coronal, sagital ou levemente oblíqua, sem um único caso especial.
   ========================================================================= */
'use strict';

function cruz(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function ponto(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norma(a) {
  const n = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
}

class Volume {
  constructor() {
    this.pix = null;                 // Int16Array — i + j*nx + k*nx*ny
    this.nx = 0; this.ny = 0; this.nz = 0;
    this.px = 1; this.py = 1; this.pz = 1;
    this.dirLin = [1, 0, 0];         // cosseno diretor da linha (índice i)
    this.dirCol = [0, 1, 0];         // cosseno diretor da coluna (índice j)
    this.dirNor = [0, 0, 1];         // normal do corte (índice k)
    this.origem = [0, 0, 0];
    this.modalidade = 'CT';
    this.cortes = [];                // metadados por corte, na ordem
    this.mapa = null;                // mapeamento anatômico
  }

  /* ---- mapeia (A,S,L) -> índice linear no arranjo de voxels ---- */
  mapearAnatomia() {
    const eixos = [this.dirLin, this.dirCol, this.dirNor];
    const dim = [this.nx, this.ny, this.nz];
    const esp = [this.px, this.py, this.pz];
    const passo = [1, this.nx, this.nx * this.ny];

    const alvo = { A: [0, -1, 0], S: [0, 0, 1], L: [1, 0, 0] };
    const usado = new Set();
    const m = {};
    for (const nome of ['A', 'S', 'L']) {
      let melhor = -1, mv = -1, sinal = 1;
      for (let a = 0; a < 3; a++) {
        if (usado.has(a)) continue;
        const d = ponto(eixos[a], alvo[nome]);
        if (Math.abs(d) > mv) { mv = Math.abs(d); melhor = a; sinal = d >= 0 ? 1 : -1; }
      }
      usado.add(melhor);
      m[nome] = { eixo: melhor, sinal, n: dim[melhor], mm: esp[melhor], alinh: mv };
    }
    /* deslocamento base e passos com sinal, para converter (a,s,l) em índice linear */
    let base = 0;
    for (const nome of ['A', 'S', 'L']) {
      const x = m[nome];
      x.passo = x.sinal > 0 ? passo[x.eixo] : -passo[x.eixo];
      if (x.sinal < 0) base += (dim[x.eixo] - 1) * passo[x.eixo];
    }
    m.base = base;
    m.nA = m.A.n; m.nS = m.S.n; m.nL = m.L.n;
    m.mmA = m.A.mm; m.mmS = m.S.mm; m.mmL = m.L.mm;
    m.obliquo = Math.min(m.A.alinh, m.S.alinh, m.L.alinh) < 0.86;
    this.mapa = m;
    return m;
  }

  /* índice linear a partir de coordenadas anatômicas */
  idx(a, s, l) { const m = this.mapa; return m.base + a * m.A.passo + s * m.S.passo + l * m.L.passo; }
  valor(a, s, l) { return this.pix[this.idx(a, s, l)]; }

  /* posição LPS de um voxel (i,j,k) — usada na escrita NIfTI */
  posLPS(i, j, k) {
    return [
      this.origem[0] + i * this.px * this.dirLin[0] + j * this.py * this.dirCol[0] + k * this.pz * this.dirNor[0],
      this.origem[1] + i * this.px * this.dirLin[1] + j * this.py * this.dirCol[1] + k * this.pz * this.dirNor[1],
      this.origem[2] + i * this.px * this.dirLin[2] + j * this.py * this.dirCol[2] + k * this.pz * this.dirNor[2]
    ];
  }
}

/* -------------------------------------------------------------------------
   Monta o volume a partir dos arquivos lidos.
   Rejeita mistura de séries: um volume, uma SeriesInstanceUID.
   ------------------------------------------------------------------------- */
async function montarVolume(arquivos, prog) {
  const porSerie = new Map();
  let ignorados = 0, falhas = [];

  for (let i = 0; i < arquivos.length; i++) {
    const a = arquivos[i];
    let ld;
    try {
      if (!LeitorDICOM.ehDICOM(new Uint8Array(a.buf))) { ignorados++; continue; }
      ld = new LeitorDICOM(a.buf, a.nome);
      await ld.ler();
      ld.prepararTexto();
      if (ld.erro) { falhas.push(a.nome + ': ' + ld.erro); continue; }
      if (!ld.pixel) { ignorados++; continue; }          /* DICOMDIR, laudo, RTSTRUCT etc. */
    } catch (e) { falhas.push(a.nome + ': ' + e.message); continue; }

    const su = ld.txt('0020000E') || 'sem-serie';
    if (!porSerie.has(su)) porSerie.set(su, []);
    porSerie.get(su).push(ld);
    if (i % 24 === 0) { prog && prog(i / arquivos.length, 'lendo ' + (i + 1) + '/' + arquivos.length); await cede(); }
  }

  if (!porSerie.size) {
    throw new Error('Nenhuma imagem DICOM válida encontrada' +
      (falhas.length ? ' — primeira falha: ' + falhas[0] : '') + '.');
  }

  /* escolhe a série com mais cortes */
  let melhor = null, nMax = 0;
  for (const [uid, lista] of porSerie) if (lista.length > nMax) { nMax = lista.length; melhor = uid; }
  const lista = porSerie.get(melhor);
  const extras = porSerie.size - 1;

  if (lista.length < 12) {
    throw new Error('A série tem apenas ' + lista.length + ' corte(s). ' +
      'A reconstrução 3D e a desfiguração precisam de um volume — carregue a série completa.');
  }

  const ref = lista[0];
  const iop = ref.nums('00200037');
  const dirLin = iop.length === 6 ? norma(iop.slice(0, 3)) : [1, 0, 0];
  const dirCol = iop.length === 6 ? norma(iop.slice(3, 6)) : [0, 1, 0];
  const dirNor = norma(cruz(dirLin, dirCol));

  /* ordena por projeção da posição na normal do corte */
  for (const l of lista) {
    const ipp = l.nums('00200032');
    l._pos = ipp.length === 3 ? ponto(ipp, dirNor) : (l.num('00201041') || 0);
    l._ipp = ipp.length === 3 ? ipp : [0, 0, l._pos];
  }
  lista.sort((a, b) => a._pos - b._pos);

  /* remove cortes duplicados na mesma posição (reconstruções sobrepostas) */
  const limpo = [lista[0]];
  for (let i = 1; i < lista.length; i++)
    if (Math.abs(lista[i]._pos - limpo[limpo.length - 1]._pos) > 1e-4) limpo.push(lista[i]);
  const dup = lista.length - limpo.length;

  const cols = ref.us('00280011'), rows = ref.us('00280010');
  const ps = ref.nums('00280030');
  const vol = new Volume();
  vol.nx = cols; vol.ny = rows; vol.nz = limpo.length;
  vol.px = ps.length === 2 ? ps[1] : 1;      /* (0028,0030) = [espaçamento entre linhas, entre colunas] */
  vol.py = ps.length === 2 ? ps[0] : 1;
  vol.dirLin = dirLin; vol.dirCol = dirCol; vol.dirNor = dirNor;
  vol.origem = limpo[0]._ipp;
  vol.modalidade = ref.txt('00080060') || 'CT';

  /* espaçamento entre cortes: mediana das diferenças reais, não a tag */
  if (limpo.length > 1) {
    const dif = [];
    for (let i = 1; i < limpo.length; i++) dif.push(Math.abs(limpo[i]._pos - limpo[i - 1]._pos));
    dif.sort((a, b) => a - b);
    vol.pz = dif[Math.floor(dif.length / 2)] || (ref.num('00180050') || 1);
    const irr = dif[dif.length - 1] - dif[0];
    vol.irregular = irr > 0.35 * vol.pz;
  } else vol.pz = ref.num('00180050') || 1;

  const n = cols * rows;
  vol.pix = new Int16Array(n * limpo.length);

  for (let k = 0; k < limpo.length; k++) {
    const l = limpo[k];
    let r;
    try { r = await l.lerPixels(); }
    catch (e) { throw new Error('Corte ' + (k + 1) + ': ' + e.message); }
    if (r.cols !== cols || r.rows !== rows)
      throw new Error('Corte ' + (k + 1) + ' tem tamanho diferente (' + r.cols + '×' + r.rows + ').');

    /* aplica reescala para trazer TC a unidades Hounsfield */
    const b = l.num('00281052'), m = l.num('00281053');
    const inc = b === null ? 0 : b, incl = m === null ? 1 : m;
    const off = k * n;
    if (inc !== 0 || incl !== 1) {
      for (let i = 0; i < n; i++) {
        const v = r.pix[i] * incl + inc;
        vol.pix[off + i] = v < -32768 ? -32768 : (v > 32767 ? 32767 : v);
      }
    } else vol.pix.set(r.pix, off);

    vol.cortes.push({ leitor: l, ipp: l._ipp, pos: l._pos, inc, incl });
    if (k % 8 === 0) { prog && prog(k / limpo.length, 'montando volume ' + (k + 1) + '/' + limpo.length); await cede(); }
  }

  vol.mapearAnatomia();
  vol.refLeitor = ref;
  vol.diag = { ignorados, falhas, extras, dup, nSeries: porSerie.size };
  return vol;
}
