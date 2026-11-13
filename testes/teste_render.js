/* Superfícies analíticas, sem arquivos de pacientes ou dependências externas.
   Verifica precisão geométrica, iluminação e bordas do raycast DICOM. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

const raiz = path.resolve(__dirname, '..');
const contexto = {
  performance, console, Float32Array, Uint8Array, Uint8ClampedArray, Math,
  cede: async () => {},
  ImageData: class { constructor(data, width, height) { Object.assign(this, { data, width, height }); } },
  norma: (a) => { const n = Math.hypot(...a) || 1; return a.map(v => v / n); },
  cruz: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
};
vm.createContext(contexto);
vm.runInContext(fs.readFileSync(path.join(raiz, 'src/js/60_render.js'), 'utf8'), contexto);
const { reconstruir3D, sombrear } = contexto;
const hash = (p) => createHash('sha256').update(new Uint8Array(p.buffer)).digest('hex');

function volume(mm = [1, 1, 1], tipo = 'esfera', invertido = false) {
  const [mmL, mmA, mmS] = mm, [nL, nA, nS] = mm.map(v => Math.ceil(144 / v));
  const sinal = invertido ? -1 : 1;
  const m = { nL, nA, nS, mmL, mmA, mmS, base: invertido ? nL * nA * nS - 1 : 0,
    L: { passo: sinal }, A: { passo: sinal * nL }, S: { passo: sinal * nL * nA } };
  const v = { mapa: m, idx: (a, s, l) => m.base + a * m.A.passo + s * m.S.passo + l * m.L.passo };
  v.pix = new Int16Array(nL * nA * nS);
  for (let s = 0; s < nS; s++) for (let a = 0; a < nA; a++) for (let l = 0; l < nL; l++) {
    const x = (l + 0.5) * mmL - nL * mmL / 2;
    const y = (a + 0.5) * mmA - nA * mmA / 2;
    const z = (s + 0.5) * mmS - nS * mmS / 2;
    let d = 52 - Math.hypot(x, y, z);
    if (tipo === 'plano') d = Math.min(d, 18 + z * 0.3 - y);
    if (tipo === 'degrau') d = Math.min(d, (x < 0 ? 18 : 34) - y);
    if (tipo === 'lamina') d = Math.min(d, y - 18, 20 - y);
    if (tipo === 'cortado') d = 30;
    if (tipo === 'vazio') d = -30;
    // Volume parcial: o limiar -400 está exatamente na superfície analítica.
    v.pix[v.idx(a, s, l)] = Math.round(-400 + Math.max(-600, Math.min(460, d * 530)));
  }
  return v;
}

function erroEsfera(rec) {
  let erro = 0, n = 0;
  const { W, H, escala } = rec;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, u = (x - W / 2) * escala, v = (H / 2 - y) * escala;
    const q = u * u + v * v;
    if (q > 45 * 45 || rec.prof[i] < 0) continue;
    const z = Math.sqrt(52 * 52 - q), ref = [u / 52, v / 52, z / 52];
    erro += Math.hypot(...ref.map((a, k) => rec.normais[i * 3 + k] - a)); n++;
  }
  assert.ok(n > 1000, 'A esfera precisa ser reconstruída, não apenas produzir valores finitos.');
  return erro / n;
}

function conferirPlano(rec) {
  const ref = [0, -0.3 / Math.hypot(1, 0.3), 1 / Math.hypot(1, 0.3)];
  let erroNormal = 0, erroProfundidade = 0, n = 0;
  for (let y = 85; y < 155; y++) for (let x = 75; x < 125; x++) {
    const i = y * rec.W + x, v = (rec.H / 2 - y) * rec.escala;
    erroNormal += Math.hypot(...ref.map((a, k) => rec.normais[i * 3 + k] - a));
    erroProfundidade += Math.abs(rec.prof[i] - (rec.diag / 2 - (18 + v * 0.3))); n++;
  }
  assert.ok(erroNormal / n < 0.06, 'Um plano oblíquo precisa continuar plano sob a iluminação.');
  assert.ok(erroProfundidade / n < 0.16, 'Refinar a superfície não pode deslocar o plano de corte.');
  return { normal: erroNormal / n, profundidade_mm: erroProfundidade / n };
}

function capturar(rec, nome) {
  if (!process.argv.includes('--capturas')) return;
  const img = sombrear(rec, {}).data, rgb = Buffer.alloc(rec.W * rec.H * 3);
  for (let i = 0; i < rec.W * rec.H; i++) {
    const o = i * 4;
    const g = rec.prof[i] < 0 ? 8 : Math.round(img[o] * 0.2126 + img[o + 1] * 0.7152 + img[o + 2] * 0.0722);
    rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = g;
  }
  const pasta = path.join(raiz, 'dist/qa'); fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(path.join(pasta, nome + '.ppm'), Buffer.concat([Buffer.from(`P6\n${rec.W} ${rec.H}\n255\n`), rgb]));
}

(async () => {
  const relatos = [];
  for (const mm of [[1, 1, 1], [1, 1, 2.4], [1.8, 1.8, 2]]) {
    const vol = volume(mm), opc = { W: 200, H: 240, limiar: -400, yaw: 30, pitch: 8 };
    const antes = hash(vol.pix), inicio = performance.now();
    const rec = await reconstruir3D(vol, vol.pix, opc);
    const erro = erroEsfera(rec);
    assert.ok(erro < 0.08, 'A iluminação deve seguir a curvatura da esfera, inclusive com voxels anisotrópicos.');
    assert.ok(rec.prof.every(Number.isFinite));
    assert.equal(hash(vol.pix), antes, 'Renderizar nunca modifica o volume DICOM.');
    const inv = volume(mm, 'esfera', true), recInv = await reconstruir3D(inv, inv.pix, opc);
    assert.deepEqual(Array.from(recInv.prof), Array.from(rec.prof), 'Inverter os índices LPS não muda a reconstrução anatômica.');
    const plano = volume(mm, 'plano');
    const recPlano = await reconstruir3D(plano, plano.pix, { ...opc, yaw: 0, pitch: 0 });
    const erroPlano = conferirPlano(recPlano);
    const semNormais = { ...rec }; delete semNormais.normais;
    assert.equal(sombrear(semNormais, {}).data.length, rec.W * rec.H * 4, 'Mapas antigos mantêm o sombreamento de fallback.');
    relatos.push({ mm, erro_normal_esfera: +erro.toFixed(5), erro_plano: erroPlano, ms: Math.round(performance.now() - inicio) });
    if (mm[2] === 1) { capturar(rec, 'render-esfera-1mm'); capturar(recPlano, 'render-plano-1mm'); }
  }
  const opc = { W: 200, H: 240, limiar: -400, yaw: 0, pitch: 0 };
  const degrau = volume([1, 1, 1], 'degrau'), rd = await reconstruir3D(degrau, degrau.pix, opc);
  const esquerda = 120 * 200 + 98, direita = 120 * 200 + 102;
  assert.ok(Math.abs(rd.prof[esquerda] - rd.prof[direita] - 16) < 0.05, 'Um degrau de 16 mm não pode ser apagado pelo refinamento visual.');
  // Admite o volume parcial de um voxel no encontro, mas não a rampa falsa
  // que resultaria de misturar os dois lados separados por 16 mm.
  assert.ok(rd.normais[esquerda * 3 + 2] > 0.98 && rd.normais[direita * 3 + 2] > 0.98,
    'A iluminação deve preservar os dois lados do salto de profundidade.');
  capturar(rd, 'render-degrau-1mm');
  const lamina = volume([1, 1, 1], 'lamina'), rl = await reconstruir3D(lamina, lamina.pix, opc);
  assert.equal(rl.conf[120 * 200 + 100], 1, 'Uma lâmina de 2 mm precisa aparecer, como uma pálpebra ou borda de orelha.');
  assert.ok(Math.abs(rl.prof[120 * 200 + 100] - (rl.diag / 2 - 20)) < 0.03,
    'Mostrar uma superfície fina não pode deslocá-la ou fabricar um preenchimento atrás dela.');
  const cortado = volume([1, 1, 1], 'cortado'), rc = await reconstruir3D(cortado, cortado.pix, opc);
  assert.ok(rc.prof[120 * 200 + 100] > rc.diag / 2 - 72 - 1, 'Tecido tocando a borda não pode gerar superfície extrapolada fora do volume.');
  const vazio = volume([1, 1, 1], 'vazio'), rv = await reconstruir3D(vazio, vazio.pix, opc);
  assert.ok(rv.prof.every(v => v === -1) && rv.conf.every(v => v === 0), 'Ar puro não pode inventar uma superfície.');
  console.log(JSON.stringify(relatos, null, 2));
  console.log('PASSOU: esfera, plano oblíquo, degrau, lâmina fina, anisotropia, orientação invertida, volume cortado e ar puro; pixels preservados.');
})().catch(e => { console.error(e); process.exitCode = 1; });
