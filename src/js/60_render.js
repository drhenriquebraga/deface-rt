/* =========================================================================
   Métricas e renderização

   A métrica existe porque comparação visual é prova fraca: o olho vê um
   borrão e conclui que está anonimizado. O deslocamento medido da superfície
   facial diz outra coisa — e é essa divergência que o aplicativo ensina.
   ========================================================================= */
'use strict';

/* mapa de superfície sobre um volume já modificado (mesma regra do original) */
function mapaSuperficieSimples(pixMod, vol, limiar, espMin, s0, s1, l0, l1) {
  const m = vol.mapa, nA = m.nA, nL = m.nL;
  const espVox = Math.max(1, Math.round(espMin / m.mmA));
  const D = new Int32Array((s1 - s0 + 1) * (l1 - l0 + 1)).fill(-1);
  for (let s = s0; s <= s1; s++) {
    for (let l = l0; l <= l1; l++) {
      let achou = -1;
      for (let a = nA - 1; a >= espVox; a--) {
        if (pixMod[vol.idx(a, s, l)] <= limiar) continue;
        let faltas = 0, ok = true;
        for (let t = 1; t < espVox; t++)
          if (pixMod[vol.idx(a - t, s, l)] <= limiar) { faltas++; if (faltas > 1) { ok = false; break; } }
        if (ok) { achou = a; break; }
      }
      D[(s - s0) * (l1 - l0 + 1) + (l - l0)] = achou;
    }
  }
  return D;
}

function medir(vol, an, faixa, pixMod, delta) {
  const m = vol.mapa, nL = an.nL, mmA = m.mmA;
  const s0 = faixa.s0, s1 = faixa.s1, l0 = faixa.l0, l1 = faixa.l1;
  const W = l1 - l0 + 1;
  const Dn = mapaSuperficieSimples(pixMod, vol, an.limiar, 6, s0, s1, l0, l1);

  const desl = [];
  let preservada = 0, area = 0, somaQ = 0, maxD = 0;
  for (let s = s0; s <= s1; s++) for (let l = l0; l <= l1; l++) {
    const idm = s * nL + l;
    if (faixa.peso[idm] < 0.6) continue;               /* só o miolo da faixa, sem a transição */
    const o = an.D[idm]; if (o < 0) continue;
    const n = Dn[(s - s0) * W + (l - l0)];
    const d = (n < 0) ? (o - 0) * mmA : Math.abs(o - n) * mmA;
    area++; somaQ += d * d; desl.push(d);
    if (d > maxD) maxD = d;
    if (d < 2) preservada++;
  }
  desl.sort((a, b) => a - b);
  const p95 = desl.length ? desl[Math.min(desl.length - 1, Math.floor(desl.length * 0.95))] : 0;
  const mediana = desl.length ? desl[Math.floor(desl.length / 2)] : 0;

  /* ponta do nariz */
  const oN = an.D[an.sNose * nL + an.lNose];
  let nariz = null;
  if (an.sNose >= s0 && an.sNose <= s1 && an.lNose >= l0 && an.lNose <= l1) {
    const nN = Dn[(an.sNose - s0) * W + (an.lNose - l0)];
    nariz = (nN < 0) ? Infinity : Math.abs(oN - nN) * mmA;
  }

  const areaMM = area * m.mmS * m.mmL;
  return {
    rms: area ? Math.sqrt(somaQ / area) : 0,
    mediana, p95, max: maxD,
    preservada: area ? preservada / area * 100 : 0,
    areaCM2: areaMM / 100,
    nariz,
    voxels: delta.n,
    voxelsPct: delta.n / vol.pix.length * 100,
    Dn, s0, s1, l0, l1, W
  };
}

/* leitura clínica do resultado — o texto muda com o número, não com o método */
function veredito(metodo, M) {
  const r = M.rms, pres = M.preservada;
  if (metodo === 'suave') {
    return {
      t: r < 6 ? 'A face continua reconstruível' : 'Geometria atenuada, não removida',
      p: 'A suavização deslocou a superfície apenas ' + nf(r, 1) + ' mm em média — ' +
        'ordens de grandeza abaixo dos ' + nf(20, 0) + ' mm que a remoção produz — e manteve ' + nf(pres, 0) +
        '% da área facial dentro de 2 mm do original. Reconhecimento facial trabalha com a geometria da ' +
        'superfície, não com a nitidez: as proporções entre olhos, nariz e queixo sobrevivem ao borrão. ' +
        'É o método que melhor demonstra por que inspeção visual não substitui medida.'
    };
  }
  if (metodo === 'generica') {
    return {
      t: 'Superfície substituída, volume íntegro',
      p: 'A face média deslocou a superfície ' + nf(r, 1) + ' mm em média (máximo ' + nf(M.max, 1) + ' mm). ' +
        'Só ' + nf(pres, 0) + '% da área facial permanece a 2 mm ou menos do original. Diferente do recorte, ' +
        'o volume mantém contorno externo plausível — registro deformável e autossegmentação continuam ' +
        'funcionando. Em contrapartida, todos os pacientes ficam com o mesmo rosto.'
    };
  }
  if (metodo === 'plano') {
    return {
      t: 'Corte previsível, anatomia sacrificada em bloco',
      p: 'O plano deslocou a superfície ' + nf(r, 1) + ' mm em média e alterou ' +
        nf(M.voxelsPct, 2) + '% dos voxels. É o método mais previsível de todos: sem modelo, sem semente, ' +
        'mesmo resultado sempre — o que o torna auditável. O custo é anatômico e não geométrico: ' +
        'o corte é reto e leva junto mandíbula e parte anterior do pescoço, independentemente de onde ' +
        'estava a face. Inviabiliza leitura de cabeça e pescoço.'
    };
  }
  return {
    t: r > 12 ? 'Face removida' : 'Remoção parcial — revise os parâmetros',
    p: 'A camada facial foi substituída por ' + (metodo === 'ruido' ? 'ruído de ar' : 'ar') +
      ', com deslocamento médio de ' + nf(r, 1) + ' mm e ' + nf(pres, 0) + '% da área ainda a 2 mm do original. ' +
      (metodo === 'ruido'
        ? 'O ruído evita a superfície de corte perfeitamente lisa, que por si só denuncia o procedimento e ajuda um ataque de reconstrução a localizar a região alterada.'
        : 'A borda lisa resultante é o rastro mais visível do procedimento.')
  };
}

/* =========================================================================
   MPR
   ========================================================================= */
function fatiaMPR(vol, pix, plano, indice, jan, niv) {
  const m = vol.mapa, nA = m.nA, nS = m.nS, nL = m.nL;
  let W, H, mmW, mmH, ler;
  if (plano === 'ax') {
    W = nL; H = nA; mmW = m.mmL; mmH = m.mmA;
    ler = (x, y) => pix[vol.idx(nA - 1 - y, indice, x)];
  } else if (plano === 'co') {
    W = nL; H = nS; mmW = m.mmL; mmH = m.mmS;
    ler = (x, y) => pix[vol.idx(indice, nS - 1 - y, x)];
  } else {
    W = nA; H = nS; mmW = m.mmA; mmH = m.mmS;
    ler = (x, y) => pix[vol.idx(nA - 1 - x, nS - 1 - y, indice)];
  }
  const lo = niv - jan / 2, esc = 255 / Math.max(1, jan);
  const img = new Uint8ClampedArray(W * H * 4);
  for (let y = 0, o = 0; y < H; y++) for (let x = 0; x < W; x++, o += 4) {
    let g = (ler(x, y) - lo) * esc;
    g = g < 0 ? 0 : (g > 255 ? 255 : g);
    img[o] = g; img[o + 1] = g; img[o + 2] = g; img[o + 3] = 255;
  }
  return { img: new ImageData(img, W, H), W, H, mmW, mmH };
}

function pintarMPR(cv, f) {
  const alvo = 460;
  const pw = f.W * f.mmW, ph = f.H * f.mmH;
  const k = alvo / Math.max(pw, ph);
  const dw = Math.max(1, Math.round(pw * k)), dh = Math.max(1, Math.round(ph * k));
  const tmp = document.createElement('canvas');
  tmp.width = f.W; tmp.height = f.H;
  tmp.getContext('2d').putImageData(f.img, 0, 0);
  cv.width = dw; cv.height = dh;
  const cx = cv.getContext('2d');
  cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
  cx.drawImage(tmp, 0, 0, dw, dh);
}

/* =========================================================================
   Reconstrução 3D — lançamento de raios com parada na primeira superfície

   Sem WebGL de propósito: as estações das clínicas variam muito em GPU e
   driver, e um renderizador que falha na hora da aula não serve. O custo é
   tempo de CPU, que aqui sobra.
   ========================================================================= */
async function reconstruir3D(vol, pix, opc) {
  const m = vol.mapa;
  const nA = m.nA, nS = m.nS, nL = m.nL;
  const mmA = m.mmA, mmS = m.mmS, mmL = m.mmL;
  const W = opc.W, H = opc.H, limiar = opc.limiar;
  const LX = nL * mmL, LY = nA * mmA, LZ = nS * mmS;
  const cx = LX / 2, cy = LY / 2, cz = LZ / 2;

  const ya = (opc.yaw || 0) * Math.PI / 180, pi = (opc.pitch || 0) * Math.PI / 180;
  const cy1 = Math.cos(ya), sy1 = Math.sin(ya);
  let dir = [-sy1, -cy1, 0];
  let right = [cy1, -sy1, 0];
  let up = [0, 0, 1];
  const cp = Math.cos(pi), sp = Math.sin(pi);
  dir = [dir[0] * cp + up[0] * sp, dir[1] * cp + up[1] * sp, dir[2] * cp + up[2] * sp];
  up = cruz(right, dir).map((v) => -v);
  up = norma(up);

  const diag = Math.hypot(LX, LY, LZ);
  const escala = (Math.max(LX, LY, LZ) * 1.06) / Math.min(W, H);
  const passo = Math.min(mmA, mmS, mmL) * 0.85;
  const nPassos = Math.ceil(diag / passo);

  const prof = new Float32Array(W * H).fill(-1);
  const conf = new Uint8Array(W * H);
  const normais = new Float32Array(W * H * 3);
  // Confirma apenas a vizinhança (~1,5–2 mm na grade usual): uma barreira
  // de 4 mm apagava pálpebras e bordas de orelhas que existem no volume.
  const espVox = Math.max(1, Math.round(2 / Math.min(mmA, mmS, mmL)));

  /* Interpolação só na vizinhança da superfície. O percurso pelo ar continua
     barato; refinar o limiar elimina os degraus de voxel do primeiro impacto.
     Os centros dos voxels ficam a meio espaçamento da borda do volume. */
  const strideL = m.L.passo, strideA = m.A.passo, strideS = m.S.passo;
  function amostrar(X, Y, Z) {
    const l = Math.max(0, Math.min(nL - 1, X / mmL - 0.5));
    const a = Math.max(0, Math.min(nA - 1, Y / mmA - 0.5));
    const s = Math.max(0, Math.min(nS - 1, Z / mmS - 0.5));
    const il = Math.floor(l), ia = Math.floor(a), is = Math.floor(s);
    const fl = l - il, fa = a - ia, fs = s - is;
    const dl = il + 1 < nL ? strideL : 0;
    const da = ia + 1 < nA ? strideA : 0;
    const ds = is + 1 < nS ? strideS : 0;
    const id = m.base + il * strideL + ia * strideA + is * strideS;
    const v00 = pix[id] * (1 - fl) + pix[id + dl] * fl;
    const v10 = pix[id + da] * (1 - fl) + pix[id + da + dl] * fl;
    const v01 = pix[id + ds] * (1 - fl) + pix[id + ds + dl] * fl;
    const v11 = pix[id + ds + da] * (1 - fl) + pix[id + ds + da + dl] * fl;
    return (v00 * (1 - fa) + v10 * fa) * (1 - fs) + (v01 * (1 - fa) + v11 * fa) * fs;
  }

  let t0 = performance.now();
  for (let py = 0; py < H; py++) {
    if (performance.now() - t0 > 45) {
      if (opc.prog) opc.prog(py / H);
      await cede(); t0 = performance.now();
    }
    const v = (H / 2 - py) * escala;
    for (let px = 0; px < W; px++) {
      const u = (px - W / 2) * escala;
      let X = cx + right[0] * u + up[0] * v - dir[0] * diag * 0.5;
      let Y = cy + right[1] * u + up[1] * v - dir[1] * diag * 0.5;
      let Z = cz + right[2] * u + up[2] * v - dir[2] * diag * 0.5;
      const dX = dir[0] * passo, dY = dir[1] * passo, dZ = dir[2] * passo;
      let t = -1;
      for (let s = 0; s < nPassos; s++) {
        X += dX; Y += dY; Z += dZ;
        if (X < 0 || Y < 0 || Z < 0 || X >= LX || Y >= LY || Z >= LZ) continue;
        const l = (X / mmL) | 0, a = (Y / mmA) | 0, sz = (Z / mmS) | 0;
        if (pix[vol.idx(a, sz, l)] <= limiar) continue;
        /* Confirma ao menos um vizinho, preservando superfícies finas. */
        let bons = 0;
        for (let q = 1; q <= espVox; q++) {
          const X2 = X + dX * q, Y2 = Y + dY * q, Z2 = Z + dZ * q;
          if (X2 < 0 || Y2 < 0 || Z2 < 0 || X2 >= LX || Y2 >= LY || Z2 >= LZ) break;
          if (pix[vol.idx((Y2 / mmA) | 0, (Z2 / mmS) | 0, (X2 / mmL) | 0)] > limiar) bons++;
        }
        if (bons < Math.max(1, espVox - 1)) continue;
        if (amostrar(X, Y, Z) <= limiar) continue;

        /* O vizinho mais próximo pode ultrapassar a isosuperfície por até
           meio voxel. Localiza o intervalo local antes da bissecção. */
        let atras = passo;
        const maxAtras = Math.max(passo * 4, Math.max(mmA, mmS, mmL) * 1.5);
        while (atras < maxAtras && amostrar(X - dir[0] * atras, Y - dir[1] * atras, Z - dir[2] * atras) > limiar)
          atras += passo;
        const temIntervalo = amostrar(X - dir[0] * atras, Y - dir[1] * atras, Z - dir[2] * atras) <= limiar;
        let lo = temIntervalo ? -atras : 0, hi = 0;
        for (let q = 0; q < 7; q++) {
          const meio = (lo + hi) * 0.5;
          if (amostrar(X + dir[0] * meio, Y + dir[1] * meio, Z + dir[2] * meio) > limiar) hi = meio;
          else lo = meio;
        }
        const ajuste = (lo + hi) * 0.5;
        t = (s + 1) * passo + ajuste;
        break;
      }
      prof[py * W + px] = t;
      conf[py * W + px] = t >= 0 ? 1 : 0;
    }
  }
  /* Ajuste local de um plano na superfície já refinada. Trabalha em mm,
     preserva planos oblíquos e reduz oscilações subvoxel da luz sem alterar
     o mapa de profundidade nem os pixels DICOM. A janela é pequena e não
     cruza saltos de profundidade ou a silhueta. Normais por intensidade,
     ao contrário, podem enviesar um plano em voxels anisotrópicos. */
  const pesos = [1, 4, 6, 4, 1];
  const salto = Math.max(Math.min(mmA, mmS, mmL) * 3, escala * 8);
  for (let y = 0; y < H; y++) {
    if (performance.now() - t0 > 45) { await cede(); t0 = performance.now(); }
    for (let x = 0; x < W; x++) {
      const i = y * W + x, z = prof[i];
      if (z < 0) continue;
      let sw = 0, sx = 0, sy = 0, sz = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= H) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= W) continue;
          const nz = prof[yy * W + xx]; if (nz < 0 || Math.abs(nz - z) > salto) continue;
          const w = pesos[dx + 2] * pesos[dy + 2], dz = nz - z;
          sw += w; sx += w * dx; sy += w * dy; sz += w * dz;
          sxx += w * dx * dx; syy += w * dy * dy; sxy += w * dx * dy;
          sxz += w * dx * dz; syz += w * dy * dz;
        }
      }
      if (!sw) continue;
      const xx = sxx - sx * sx / sw, yy = syy - sy * sy / sw, xy = sxy - sx * sy / sw;
      const xz = sxz - sx * sz / sw, yz = syz - sy * sz / sw, det = xx * yy - xy * xy;
      if (det <= 1e-6) continue;
      const gx = (xz * yy - yz * xy) / det / escala, gy = (yz * xx - xz * xy) / det / escala;
      const gn = Math.hypot(gx, gy, 1), ni = i * 3;
      normais[ni] = gx / gn; normais[ni + 1] = -gy / gn; normais[ni + 2] = 1 / gn;
    }
  }
  if (opc.prog) opc.prog(1);
  return { prof, conf, normais, W, H, escala, diag };
}

/* sombreamento a partir do mapa de profundidade + anéis orbitais ao fundo */
function sombrear(rec, opc) {
  const { prof, conf, W, H, escala } = rec;
  const img = new Uint8ClampedArray(W * H * 4);

  /* cobertura desfocada: modula os anéis para eles sumirem antes da silhueta */
  let cob = Float32Array.from(conf);
  const tmp = new Float32Array(W * H);
  const r = 9;
  for (let passe = 0; passe < 2; passe++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0, c = 0;
      for (let t = -r; t <= r; t++) { const xx = x + t; if (xx < 0 || xx >= W) continue; s += cob[y * W + xx]; c++; }
      tmp[y * W + x] = s / c;
    }
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
      let s = 0, c = 0;
      for (let t = -r; t <= r; t++) { const yy = y + t; if (yy < 0 || yy >= H) continue; s += tmp[yy * W + x]; c++; }
      cob[y * W + x] = s / c;
    }
  }

  let dMin = 1e9, dMax = -1e9;
  for (let i = 0; i < prof.length; i++) if (prof[i] >= 0) { if (prof[i] < dMin) dMin = prof[i]; if (prof[i] > dMax) dMax = prof[i]; }
  const faixa = Math.max(1, dMax - dMin);

  const LUZ = norma([-0.42, 0.5, 0.76]);
  const anelCX = W * 0.5, anelCY = H * 0.47;
  const aneis = [
    { rx: W * 0.455, ry: H * 0.4, w: 1.15, i: 0.5, gir: 0.16 },
    { rx: W * 0.36, ry: H * 0.47, w: 0.95, i: 0.36, gir: -0.3 }
  ];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, o = i * 4;
      const z = prof[i];

      if (z < 0) {
        /* fundo: gradiente Nocturne + anéis orbitais que se dissolvem no sujeito */
        const rr = Math.hypot((x - W * 0.5) / (W * 0.5), (y - H * 0.46) / (H * 0.5));
        const f = Math.max(0, 1 - rr * 0.82);
        let R = 4 + 10 * f, G = 8 + 20 * f, B = 18 + 42 * f;
        const livre = Math.max(0, 1 - cob[i] * 2.4);
        if (livre > 0.02) {
          for (const an of aneis) {
            const dx = (x - anelCX), dy = (y - anelCY);
            const rx2 = dx * Math.cos(an.gir) - dy * Math.sin(an.gir);
            const ry2 = dx * Math.sin(an.gir) + dy * Math.cos(an.gir);
            const q = Math.hypot(rx2 / an.rx, ry2 / an.ry);
            const dist = Math.abs(q - 1) * Math.min(an.rx, an.ry);
            if (dist < an.w * 2.4) {
              const inten = Math.max(0, 1 - dist / (an.w * 2.4)) * an.i * livre;
              const mixX = 0.5 + rx2 / (an.rx * 2);
              R += inten * (10 + 26 * mixX); G += inten * (42 + 169 * mixX); B += inten * (107 + 131 * mixX);
            }
          }
        }
        img[o] = R; img[o + 1] = G; img[o + 2] = B; img[o + 3] = 255;
        continue;
      }

      /* normal a partir do gradiente de profundidade */
      const zl = prof[i - 1] >= 0 && x > 0 ? prof[i - 1] : z;
      const zr = prof[i + 1] >= 0 && x < W - 1 ? prof[i + 1] : z;
      const zu = y > 0 && prof[i - W] >= 0 ? prof[i - W] : z;
      const zd = y < H - 1 && prof[i + W] >= 0 ? prof[i + W] : z;
      const gx = (zr - zl) / (2 * escala), gy = (zd - zu) / (2 * escala);
      const nl = Math.hypot(gx, gy, 1);
      let nX = gx / nl, nY = -gy / nl, nZ = 1 / nl;
      /* Reconstruções antigas continuam válidas. A normal suavizada evita
         que diferenças de profundidade quantizadas virem faixas de luz. */
      if (rec.normais && rec.normais[i * 3 + 2] > 0) {
        nX = rec.normais[i * 3]; nY = rec.normais[i * 3 + 1]; nZ = rec.normais[i * 3 + 2];
      }

      let lam = nX * LUZ[0] + nY * LUZ[1] + nZ * LUZ[2];
      lam = lam < 0 ? 0 : lam;
      const dif = Math.pow(lam, 0.82);
      const esp = Math.pow(lam, 34) * 0.5;
      const prox = 1 - (z - dMin) / faixa;
      const amb = 0.13 + 0.2 * prox;
      const borda = Math.pow(1 - nZ, 2.4) * 0.42;

      const k = Math.min(1, amb + dif * 0.86 + esp);
      /* rampa fria: sombra azul profunda -> meio azul-aço -> alta luz quase branca */
      let R, G, B;
      if (k < 0.5) { const q = k / 0.5; R = 11 + q * 62; G = 27 + q * 96; B = 51 + q * 122; }
      else { const q = (k - 0.5) / 0.5; R = 73 + q * 163; G = 123 + q * 128; B = 173 + q * 77; }
      R += borda * 12; G += borda * 132; B += borda * 168;
      const nev = 0.72 + 0.28 * prox;
      img[o] = R * nev + 5 * (1 - nev);
      img[o + 1] = G * nev + 12 * (1 - nev);
      img[o + 2] = B * nev + 28 * (1 - nev);
      img[o + 3] = 255;
    }
  }
  return new ImageData(img, W, H);
}
