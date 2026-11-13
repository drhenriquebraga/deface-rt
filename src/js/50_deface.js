/* =========================================================================
   Motor de desfiguração

   Princípio de projeto: a fronteira do recorte é uma superfície SUAVIZADA,
   não a superfície original deslocada. Uma fronteira que acompanha o contorno
   real reproduz a geometria da face na própria borda do corte — e a geometria
   é o dado biométrico. Suavizar antes de cortar elimina esse vazamento.
   ========================================================================= */
'use strict';

/* ---- acumulador esparso de alterações ---------------------------------- */
class Delta {
  constructor(constante) {
    this.blocosI = []; this.blocosV = [];
    this.bi = new Int32Array(1 << 19); this.bv = null;
    this.const = (constante === undefined) ? null : constante;
    if (this.const === null) this.bv = new Int16Array(1 << 19);
    this.p = 0; this.n = 0;
  }
  add(i, v) {
    if (this.p === this.bi.length) {
      this.blocosI.push(this.bi); if (this.bv) this.blocosV.push(this.bv);
      this.bi = new Int32Array(1 << 19);
      if (this.const === null) this.bv = new Int16Array(1 << 19);
      this.p = 0;
    }
    this.bi[this.p] = i;
    if (this.const === null) this.bv[this.p] = v;
    this.p++; this.n++;
  }
  fechar() {
    this.blocosI.push(this.bi.subarray(0, this.p));
    if (this.bv) this.blocosV.push(this.bv.subarray(0, this.p));
    const I = new Int32Array(this.n); let o = 0;
    for (const b of this.blocosI) { I.set(b, o); o += b.length; }
    let V = null;
    if (this.const === null) { V = new Int16Array(this.n); o = 0; for (const b of this.blocosV) { V.set(b, o); o += b.length; } }
    this.blocosI = null; this.blocosV = null; this.bi = null; this.bv = null;
    return { idx: I, val: V, cte: this.const, n: this.n };
  }
}

function materializar(vol, d) {
  const out = new Int16Array(vol.pix);
  if (!d) return out;
  if (d.cte !== null && d.cte !== undefined) { for (let i = 0; i < d.n; i++) out[d.idx[i]] = d.cte; }
  else for (let i = 0; i < d.n; i++) out[d.idx[i]] = d.val[i];
  return out;
}

/* ---- limiar de pele ------------------------------------------------------
   TC tem unidade física: −400 UH separa ar de tecido em qualquer aparelho.
   RM não tem unidade — o limiar sai de Otsu sobre o histograma do volume. */
function limiarAutomatico(vol) {
  if ((vol.modalidade || 'CT').toUpperCase().startsWith('CT')) return -400;
  const pix = vol.pix, N = pix.length, passo = Math.max(1, Math.floor(N / 900000));
  let mx = 0;
  for (let i = 0; i < N; i += passo) if (pix[i] > mx) mx = pix[i];
  if (mx <= 0) return 1;
  const nb = 256, h = new Float64Array(nb); let tot = 0;
  for (let i = 0; i < N; i += passo) {
    const v = pix[i]; if (v <= 0) continue;
    h[Math.min(nb - 1, Math.floor(v / mx * (nb - 1)))]++; tot++;
  }
  if (!tot) return 1;
  let soma = 0; for (let i = 0; i < nb; i++) soma += i * h[i];
  let sB = 0, wB = 0, max = -1, lim = 0;
  for (let t = 0; t < nb; t++) {
    wB += h[t]; if (!wB) continue;
    const wF = tot - wB; if (!wF) break;
    sB += t * h[t];
    const mB = sB / wB, mF = (soma - sB) / wF;
    const entre = wB * wF * (mB - mF) * (mB - mF);
    if (entre > max) { max = entre; lim = t; }
  }
  return Math.max(1, Math.round(lim / (nb - 1) * mx));
}

/* ---- valor de fundo: amostra o ar real nos cantos do volume ------------- */
function fundoDoVolume(vol, limiar) {
  const { nx, ny, nz } = vol, p = vol.pix;
  const amostras = [];
  const mx = Math.max(2, Math.floor(nx * 0.06)), my = Math.max(2, Math.floor(ny * 0.06));
  for (let k = 0; k < nz; k += Math.max(1, Math.floor(nz / 12))) {
    for (let j = 0; j < my; j++) for (let i = 0; i < mx; i++) {
      amostras.push(p[k * nx * ny + j * nx + i]);
      amostras.push(p[k * nx * ny + j * nx + (nx - 1 - i)]);
    }
  }
  if (!amostras.length) return { media: limiar - 600, dp: 12 };
  let s = 0; for (const v of amostras) s += v;
  const m = s / amostras.length;
  let q = 0; for (const v of amostras) q += (v - m) * (v - m);
  return { media: m, dp: Math.max(3, Math.sqrt(q / amostras.length)) };
}

/* ---- componente conexo da cabeça, em grade reduzida --------------------- */
async function mascaraCabeca(vol, limiar, prog) {
  const { nx, ny, nz } = vol, p = vol.pix;
  const f = Math.max(1, Math.ceil(Math.max(nx, ny) / 112));
  const fz = Math.max(1, Math.ceil(nz / 112));
  const gx = Math.ceil(nx / f), gy = Math.ceil(ny / f), gz = Math.ceil(nz / fz);
  const g = new Uint8Array(gx * gy * gz);

  await laco(nz, 8, (k) => {
    const kz = Math.floor(k / fz), base = k * nx * ny;
    for (let j = 0; j < ny; j++) {
      const jy = Math.floor(j / f), lb = base + j * nx, gb = kz * gx * gy + jy * gx;
      for (let i = 0; i < nx; i++) if (p[lb + i] > limiar) g[gb + Math.floor(i / f)] = 1;
    }
  }, (t) => prog && prog(t * 0.5));

  /* rotulagem por varredura em largura; guarda o maior componente */
  const rot = new Int32Array(gx * gy * gz);
  const fila = new Int32Array(gx * gy * gz);
  let melhorRot = 0, melhorTam = 0, r = 0;
  const viz = [1, -1, gx, -gx, gx * gy, -gx * gy];
  for (let s = 0; s < g.length; s++) {
    if (!g[s] || rot[s]) continue;
    r++; let ini = 0, fim = 0, tam = 0;
    fila[fim++] = s; rot[s] = r;
    while (ini < fim) {
      const c = fila[ini++]; tam++;
      const cz = Math.floor(c / (gx * gy)), cy = Math.floor((c % (gx * gy)) / gx), cx = c % gx;
      for (let d = 0; d < 6; d++) {
        const nxt = c + viz[d];
        if (nxt < 0 || nxt >= g.length || !g[nxt] || rot[nxt]) continue;
        const nz2 = Math.floor(nxt / (gx * gy)), ny2 = Math.floor((nxt % (gx * gy)) / gx), nx2 = nxt % gx;
        if (Math.abs(nz2 - cz) + Math.abs(ny2 - cy) + Math.abs(nx2 - cx) !== 1) continue;
        rot[nxt] = r; fila[fim++] = nxt;
      }
    }
    if (tam > melhorTam) { melhorTam = tam; melhorRot = r; }
  }
  prog && prog(1);
  return {
    dentro(i, j, k) {
      return rot[Math.floor(k / fz) * gx * gy + Math.floor(j / f) * gx + Math.floor(i / f)] === melhorRot;
    },
    fracao: melhorTam / (gx * gy * gz)
  };
}

/* ---- mapa de profundidade da superfície --------------------------------
   Percorre de anterior para posterior e aceita como superfície o primeiro
   voxel que tenha espessura contínua mínima atrás de si. É essa regra que
   descarta máscara termoplástica, lençol, tubo e ruído: todos finos.        */
async function mapaSuperficie(vol, limiar, mm, espMin, prog) {
  const m = vol.mapa, nA = m.nA, nS = m.nS, nL = m.nL;
  const espVox = Math.max(1, Math.round(espMin / m.mmA));
  const D = new Int32Array(nS * nL).fill(-1);
  const pix = vol.pix;

  await laco(nS, 4, (s) => {
    for (let l = 0; l < nL; l++) {
      let achou = -1;
      for (let a = nA - 1; a >= espVox; a--) {
        if (pix[vol.idx(a, s, l)] <= limiar) continue;
        let ok = true, faltas = 0;
        for (let t = 1; t < espVox; t++) {
          if (pix[vol.idx(a - t, s, l)] <= limiar) { faltas++; if (faltas > 1) { ok = false; break; } }
        }
        if (ok && mm.dentro2(a, s, l)) { achou = a; break; }
      }
      D[s * nL + l] = achou;
    }
  }, prog);
  return D;
}

/* suavização 2D do mapa de profundidade (caixa repetida ~ gaussiana) */
function suavizarMapa(D, nS, nL, raioS, raioL) {
  let cur = Float32Array.from(D), tmp = new Float32Array(nS * nL);
  const validos = Float32Array.from(D, (v) => (v >= 0 ? 1 : 0));
  for (let i = 0; i < cur.length; i++) if (D[i] < 0) cur[i] = 0;
  let pesoCur = validos, pesoTmp = new Float32Array(nS * nL);
  for (let passe = 0; passe < 3; passe++) {
    for (const eixo of [0, 1]) {
      const r = eixo === 0 ? raioS : raioL;
      const n1 = eixo === 0 ? nS : nL, n2 = eixo === 0 ? nL : nS;
      for (let b = 0; b < n2; b++) {
        for (let a = 0; a < n1; a++) {
          let sv = 0, sw = 0;
          const lo = Math.max(0, a - r), hi = Math.min(n1 - 1, a + r);
          for (let t = lo; t <= hi; t++) {
            const id = eixo === 0 ? (t * nL + b) : (b * nL + t);
            sv += cur[id]; sw += pesoCur[id];
          }
          const idd = eixo === 0 ? (a * nL + b) : (b * nL + a);
          tmp[idd] = sv; pesoTmp[idd] = sw;
        }
      }
      const t1 = cur; cur = tmp; tmp = t1;
      const t2 = pesoCur; pesoCur = pesoTmp; pesoTmp = t2;
    }
  }
  const out = new Float32Array(nS * nL);
  for (let i = 0; i < out.length; i++) out[i] = pesoCur[i] > 0.001 ? cur[i] / pesoCur[i] : -1;
  return out;
}

/* =========================================================================
   Análise: limiar, cabeça, superfície, marcos, faixa da face
   ========================================================================= */
async function analisar(vol, opc, prog) {
  const m = vol.mapa;
  const limiar = (opc.limiar !== undefined && opc.limiar !== null) ? opc.limiar : limiarAutomatico(vol);
  prog && prog(0.02, 'isolando a cabeça');
  const cab = await mascaraCabeca(vol, limiar, (t) => prog && prog(0.02 + t * 0.28));

  /* adaptador: aceita coordenadas anatômicas */
  const mm = {
    dentro2(a, s, l) {
      const idxLin = vol.idx(a, s, l);
      const k = Math.floor(idxLin / (vol.nx * vol.ny));
      const j = Math.floor((idxLin - k * vol.nx * vol.ny) / vol.nx);
      const i = idxLin - k * vol.nx * vol.ny - j * vol.nx;
      return cab.dentro(i, j, k);
    }
  };

  prog && prog(0.32, 'mapeando a superfície');
  const D = await mapaSuperficie(vol, limiar, mm, opc.espMin || 6, (t) => prog && prog(0.32 + t * 0.4));

  const nS = m.nS, nL = m.nL;
  /* caixa da cabeça e centro em L */
  let sMin = 1e9, sMax = -1, lMin = 1e9, lMax = -1, somaL = 0, cnt = 0, aMax = -1;
  for (let s = 0; s < nS; s++) for (let l = 0; l < nL; l++) {
    const d = D[s * nL + l]; if (d < 0) continue;
    if (s < sMin) sMin = s; if (s > sMax) sMax = s;
    if (l < lMin) lMin = l; if (l > lMax) lMax = l;
    if (d > aMax) aMax = d;
    somaL += l; cnt++;
  }
  if (!cnt) throw new Error('Nenhuma superfície detectada. Ajuste o limiar de pele — o valor atual (' + limiar + ') pode não separar ar de tecido nesta série.');
  const lMid = Math.round(somaL / cnt);

  /* ponta do nariz: máximo anterior na faixa mediossagital */
  const fx = Math.max(2, Math.round(14 / m.mmL));
  let aNose = -1, sNose = 0, lNose = lMid;
  for (let s = sMin; s <= sMax; s++) {
    for (let l = Math.max(0, lMid - fx); l <= Math.min(nL - 1, lMid + fx); l++) {
      const d = D[s * nL + l];
      if (d > aNose) { aNose = d; sNose = s; lNose = l; }
    }
  }
  const alturaCabeca = (sMax - sMin) * m.mmS;
  const relNariz = (sNose - sMin) / Math.max(1, sMax - sMin);
  const suspeito = alturaCabeca < 90 || relNariz < 0.12 || relNariz > 0.94;

  return {
    limiar, D, mm, nS, nL, sMin, sMax, lMin, lMax, lMid, aMax,
    aNose, sNose, lNose, alturaCabeca, relNariz, suspeito, fracaoCabeca: cab.fracao
  };
}

/* faixa da face + fronteira suavizada de corte + peso de transição */
function faixaDaFace(vol, an, opc) {
  const m = vol.mapa, nS = an.nS, nL = an.nL;
  const mmS = m.mmS, mmL = m.mmL, mmA = m.mmA;
  const supMM = opc.sup !== undefined ? opc.sup : 78;    /* acima da ponta do nariz */
  const infMM = opc.inf !== undefined ? opc.inf : 92;    /* abaixo da ponta do nariz */
  const latMM = opc.orelhas ? 999 : (opc.lat !== undefined ? opc.lat : 88);
  const prof = opc.prof !== undefined ? opc.prof : 25;   /* profundidade removida */
  const tap = 14;                                        /* transição em mm */

  const s0 = Math.max(an.sMin, Math.round(an.sNose - infMM / mmS));
  const s1 = Math.min(an.sMax, Math.round(an.sNose + supMM / mmS));
  const l0 = Math.max(an.lMin, Math.round(an.lNose - latMM / mmL));
  const l1 = Math.min(an.lMax, Math.round(an.lNose + latMM / mmL));

  const rS = Math.max(1, Math.round(26 / mmS)), rL = Math.max(1, Math.round(26 / mmL));
  const Dsuave = suavizarMapa(an.D, nS, nL, rS, rL);

  const profVox = prof / mmA;
  const corte = new Float32Array(nS * nL).fill(-1);
  const peso = new Float32Array(nS * nL);

  for (let s = s0; s <= s1; s++) {
    const dS = Math.min((s - s0) * mmS, (s1 - s) * mmS);
    for (let l = l0; l <= l1; l++) {
      const id = s * nL + l;
      if (an.D[id] < 0 || Dsuave[id] < 0) continue;
      const dL = Math.min((l - l0) * mmL, (l1 - l) * mmL);
      const t = Math.min(1, Math.min(dS, dL) / tap);
      const w = t <= 0 ? 0 : (t >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * t));
      peso[id] = w;
      /* na borda a fronteira volta para a superfície original: sem degrau */
      corte[id] = Dsuave[id] - profVox * w;
    }
  }
  return { s0, s1, l0, l1, corte, peso, Dsuave, profVox, prof };
}

/* =========================================================================
   Face paramétrica — nunca copiada de um rosto real
   14 parâmetros descrevem cristas e volumes; a face genérica usa o ponto médio
   de cada faixa, de modo que todo paciente recebe exatamente o mesmo rosto.
   ========================================================================= */
const FAIXAS_FACE = {
  narProj: [15, 27], narLarg: [7.5, 13], narComp: [30, 46], narPonte: [0.45, 0.8],
  sobProj: [2, 6.5], sobAlt: [15, 25],
  malProj: [3, 9], malLat: [27, 45], malAlt: [-13, -1],
  quProj: [3, 9.5], quAlt: [-60, -45], quLarg: [13, 25],
  labProj: [1.5, 4.5], larg: [70, 88]
};
function parametrosFace() {
  const p = {};
  for (const k in FAIXAS_FACE) {
    const [a, b] = FAIXAS_FACE[k];
    p[k] = (a + b) / 2;
  }
  return p;
}
function alturaFace(u, v, p) {
  /* u = mm para a esquerda do eixo mediossagital ; v = mm acima da ponta do nariz */
  const wu = p.larg, wv = 104, vc = -8;
  let t = 1 - (u / wu) * (u / wu) - ((v - vc) / wv) * ((v - vc) / wv);
  if (t <= 0) return 0;
  let h = 9 * Math.sqrt(t);                                        /* ovoide de base */

  const perfil = (v > p.narComp) ? 0
    : (v > 2 ? (p.narComp - v) / (p.narComp - 2) * p.narPonte + (1 - p.narPonte) * 0.15
      : Math.exp(-Math.pow((v - 2) / 13, 2)));
  h += p.narProj * Math.exp(-Math.pow(u / p.narLarg, 2)) * perfil;  /* dorso e ponta */

  h += p.sobProj * Math.exp(-Math.pow((v - p.sobAlt) / 11, 2)) *
    (0.55 + 0.45 * Math.exp(-Math.pow(u / 34, 2)));                 /* arco superciliar */

  h += p.malProj * (Math.exp(-(Math.pow((u - p.malLat) / 21, 2) + Math.pow((v - p.malAlt) / 19, 2)))
    + Math.exp(-(Math.pow((u + p.malLat) / 21, 2) + Math.pow((v - p.malAlt) / 19, 2))));

  h += p.quProj * Math.exp(-(Math.pow(u / p.quLarg, 2) + Math.pow((v - p.quAlt) / 17, 2)));
  h += p.labProj * Math.exp(-(Math.pow(u / 21, 2) + Math.pow((v + 24) / 9, 2)));
  return h;
}

/* =========================================================================
   Métodos
   ========================================================================= */
const METODOS = [
  {
    id: 'plano', nome: 'Plano de corte', curto: 'Plano',
    desc: 'Remove tudo que está à frente de um plano oblíquo, na linha do método quickshear. Determinístico e sem modelo.'
  },
  {
    id: 'recorte', nome: 'Recorte de face', curto: 'Recorte',
    desc: 'Apaga a camada superficial da face e a substitui por ar, na linha das ferramentas de remoção de face em neuroimagem. É a remoção mais completa e a que mais interfere em registro e autossegmentação.'
  },
  {
    id: 'ruido', nome: 'Preenchimento com ruído', curto: 'Ruído',
    desc: 'Variação do recorte: substitui a mesma camada por ruído com média e desvio do ar real da imagem. Evita a borda perfeitamente lisa que denuncia o procedimento.'
  },
  {
    id: 'suave', nome: 'Suavização de superfície', curto: 'Suavização',
    desc: 'Mantém a face e apenas borra a geometria, como fazem as abordagens de borramento de superfície. Parece anonimizado ao olho — e é o método que a métrica desmente.'
  },
  {
    id: 'generica', nome: 'Face genérica', curto: 'Genérica',
    desc: 'Enxerta uma face média paramétrica, na linha das ferramentas que substituem a face em vez de removê-la. Todo paciente recebe o mesmo rosto, o que preserva o pipeline mas torna a coorte indistinguível.'
  }
];

async function aplicarMetodo(vol, an, faixa, id, opc, prog) {
  const m = vol.mapa, nA = m.nA, nS = an.nS, nL = an.nL;
  const fundo = opc.fundo;
  const arV = Math.round(fundo.media);

  if (id === 'plano') return planoDeCorte(vol, an, opc, arV, prog);
  if (id === 'suave') return suavizarSuperficie(vol, an, faixa, opc, prog);

  const d = new Delta(id === 'recorte' ? arV : undefined);
  const r = prng((opc.semente || 'x') + '|' + id);
  const p = (id === 'generica') ? parametrosFace() : null;
  const enxertar = !!p;
  const mmA = m.mmA, mmS = m.mmS, mmL = m.mmL;

  /* valor de tecido para o enxerto: média do que existe logo atrás da fronteira */
  let tecido = 40;
  if (enxertar) {
    let s = 0, c = 0;
    for (let ss = faixa.s0; ss <= faixa.s1; ss += 3) for (let ll = faixa.l0; ll <= faixa.l1; ll += 3) {
      const id2 = ss * nL + ll; if (faixa.corte[id2] < 0 || faixa.peso[id2] < 0.9) continue;
      const a0 = Math.floor(faixa.corte[id2]);
      for (let t = 1; t <= 3; t++) {
        const a = a0 - t; if (a < 0) continue;
        const v = vol.pix[vol.idx(a, ss, ll)];
        if (v > an.limiar) { s += v; c++; }
      }
    }
    if (c > 40) tecido = Math.round(s / c);
  }

  await laco(faixa.s1 - faixa.s0 + 1, 2, (ss) => {
    const s = faixa.s0 + ss;
    const v = (s - an.sNose) * mmS;
    for (let l = faixa.l0; l <= faixa.l1; l++) {
      const idm = s * nL + l;
      const corte = faixa.corte[idm];
      if (corte < 0 || faixa.peso[idm] <= 0) continue;
      const aCorte = Math.floor(corte);

      let aNovo = -1;
      if (enxertar) {
        const u = (l - an.lNose) * mmL;
        const h = alturaFace(u, v, p) * faixa.peso[idm];
        aNovo = aCorte + h / mmA;
      }
      for (let a = aCorte + 1; a < nA; a++) {
        const li = vol.idx(a, s, l);
        const orig = vol.pix[li];
        if (enxertar && a <= aNovo) {
          if (orig !== tecido) d.add(li, tecido + Math.round((r() - 0.5) * 22));
          continue;
        }
        if (orig <= an.limiar && Math.abs(orig - arV) < 3 * fundo.dp) continue;  /* já é ar */
        if (id === 'recorte') d.add(li, 0);
        else d.add(li, Math.round(fundo.media + (r() * 2 - 1) * fundo.dp * 1.6));
      }
    }
  }, (t) => prog && prog(t));

  return d.fechar();
}

/* ---- plano de corte ----------------------------------------------------- */
function planoDeCorte(vol, an, opc, arV, prog) {
  const m = vol.mapa, nA = m.nA, nS = an.nS, nL = an.nL;
  const mmA = m.mmA, mmS = m.mmS;
  const desl = (opc.desloc || 0) / mmA;

  /* dois pontos no plano mediossagital, em índices */
  const s1 = Math.min(an.sMax, Math.round(an.sNose + 62 / mmS));
  const a1 = (an.D[s1 * nL + an.lNose] >= 0 ? an.D[s1 * nL + an.lNose] : an.aNose) - 9 / mmA - desl;
  const s2 = Math.max(an.sMin, Math.round(an.sNose - 75 / mmS));
  const a2 = an.aNose - 62 / mmA - desl;

  const f = (s, a) => (s - s1) * (a2 - a1) - (a - a1) * (s2 - s1);
  const sinalFora = Math.sign(f(an.sNose, an.aNose)) || 1;

  const d = new Delta(arV);
  for (let s = an.sMin; s <= Math.min(an.sMax, s1); s++) {
    for (let l = an.lMin; l <= an.lMax; l++) {
      for (let a = nA - 1; a >= 0; a--) {
        if (Math.sign(f(s, a)) !== sinalFora) break;
        const li = vol.idx(a, s, l);
        if (vol.pix[li] > an.limiar) d.add(li, 0);
      }
    }
    if (prog && s % 12 === 0) prog((s - an.sMin) / Math.max(1, s1 - an.sMin));
  }
  prog && prog(1);
  return d.fechar();
}

/* ---- suavização da superfície ------------------------------------------ */
async function suavizarSuperficie(vol, an, faixa, opc, prog) {
  const m = vol.mapa, nA = m.nA, nL = an.nL;
  const banda = 34;                                   /* mm de tecido tratado */
  const bandaVox = Math.max(2, Math.round(banda / m.mmA));
  const sig = { a: 5.5 / m.mmA, s: 5.5 / m.mmS, l: 5.5 / m.mmL };

  let aLo = 1e9, aHi = -1;
  for (let s = faixa.s0; s <= faixa.s1; s++) for (let l = faixa.l0; l <= faixa.l1; l++) {
    const id = s * nL + l; if (faixa.corte[id] < 0) continue;
    const c = Math.floor(faixa.corte[id]);
    if (c - 4 < aLo) aLo = c - 4;
    if (an.D[id] + 4 > aHi) aHi = an.D[id] + 4;
  }
  aLo = Math.max(0, Math.min(aLo, nA - 2)); aHi = Math.min(nA - 1, Math.max(aHi, aLo + 1));
  const nAv = aHi - aLo + 1, nSv = faixa.s1 - faixa.s0 + 1, nLv = faixa.l1 - faixa.l0 + 1;
  const sub = new Float32Array(nAv * nSv * nLv);
  const at = (a, s, l) => (s * nLv + l) * nAv + a;

  for (let s = 0; s < nSv; s++) for (let l = 0; l < nLv; l++)
    for (let a = 0; a < nAv; a++) sub[at(a, s, l)] = vol.pix[vol.idx(aLo + a, faixa.s0 + s, faixa.l0 + l)];

  const tmp = new Float32Array(sub.length);
  const caixa = (raio, eixo) => {
    const r = Math.max(1, Math.round(raio));
    for (let s = 0; s < nSv; s++) for (let l = 0; l < nLv; l++) for (let a = 0; a < nAv; a++) {
      let acc = 0, c = 0;
      for (let t = -r; t <= r; t++) {
        let aa = a, ss = s, ll = l;
        if (eixo === 0) aa += t; else if (eixo === 1) ss += t; else ll += t;
        if (aa < 0 || aa >= nAv || ss < 0 || ss >= nSv || ll < 0 || ll >= nLv) continue;
        acc += sub[at(aa, ss, ll)]; c++;
      }
      tmp[at(a, s, l)] = acc / c;
    }
    sub.set(tmp);
  };
  for (let passe = 0; passe < 2; passe++) {
    caixa(sig.a, 0); await cede(); prog && prog((passe * 3 + 1) / 6);
    caixa(sig.s, 1); await cede(); prog && prog((passe * 3 + 2) / 6);
    caixa(sig.l, 2); await cede(); prog && prog((passe * 3 + 3) / 6);
  }

  const d = new Delta();
  for (let s = faixa.s0; s <= faixa.s1; s++) for (let l = faixa.l0; l <= faixa.l1; l++) {
    const id = s * nL + l;
    const w = faixa.peso[id]; if (w <= 0 || an.D[id] < 0) continue;
    const topo = an.D[id], base = Math.max(aLo, topo - bandaVox);
    for (let a = base; a <= Math.min(topo + 3, aHi); a++) {
      const li = vol.idx(a, s, l);
      const orig = vol.pix[li];
      const suav = sub[at(a - aLo, s - faixa.s0, l - faixa.l0)];
      const nv = Math.round(orig * (1 - w) + suav * w);
      if (nv !== orig) d.add(li, nv);
    }
  }
  prog && prog(1);
  return d.fechar();
}
