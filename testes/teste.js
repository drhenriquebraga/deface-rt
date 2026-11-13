/* Banco de teste: fantoma de crânio sintético, sem DICOM, para exercitar
   mapeamento anatômico, marcos, faixa facial, métodos e métricas. */
global.ImageData = class { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } };
global.document = { createElement: () => ({ getContext: () => ({}) }) };

const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../dist/_all.js', 'utf8')
  .replace(/document\.addEventListener\('DOMContentLoaded', iniciar\);/, '');
const EXPORTA = ['Volume','limiarAutomatico','analisar','fundoDoVolume','faixaDaFace',
  'aplicarMetodo','materializar','medir','METODOS','parametrosFace','alturaFace',
  'escreverCorte','montarVolume','montarZIP','MapaUID','EscritorDICOM','reordenar','escreverNIfTI','acaoDe','LeitorDICOM','auditar','veredito','novoUID',
  'prng','sementeAleatoria','nf','laco','cede','DIC','TS','VR_LONGO','VR_TEXTO','crc32'];
eval(src + '\nObject.assign(global, {' + EXPORTA.join(',') + '});');

/* ---------- fantoma ---------- */
function fantoma(orient) {
  const v = new Volume();
  v.nx = 256; v.ny = 256; v.nz = 140;
  v.px = 0.9; v.py = 0.9; v.pz = 1.5;
  v.modalidade = 'CT';
  if (orient === 'axial') { v.dirLin = [1, 0, 0]; v.dirCol = [0, 1, 0]; v.dirNor = [0, 0, 1]; }
  else if (orient === 'axialFF') { v.dirLin = [-1, 0, 0]; v.dirCol = [0, -1, 0]; v.dirNor = [0, 0, 1]; }
  else { v.dirLin = [1, 0, 0]; v.dirCol = [0, 0, -1]; v.dirNor = [0, 1, 0]; }  /* coronal */
  v.origem = [-115, -115, -105];
  v.pix = new Int16Array(v.nx * v.ny * v.nz).fill(-1000);
  v.mapearAnatomia();

  const m = v.mapa;
  const cA = m.nA / 2, cS = m.nS / 2, cL = m.nL / 2;
  const rL = 74, rA = 92, rS = 104;                 /* mm */
  const narizS = 6, narizProj = 23, narizLarg = 11, narizComp = 40;

  for (let s = 0; s < m.nS; s++) {
    const zz = (s - cS) * m.mmS;
    for (let l = 0; l < m.nL; l++) {
      const xx = (l - cL) * m.mmL;
      for (let a = 0; a < m.nA; a++) {
        const yy = (a - cA) * m.mmA;
        const q = (xx / rL) ** 2 + (yy / rA) ** 2 + (zz / rS) ** 2;
        let dentro = q <= 1;
        if (!dentro && yy > 0) {
          /* nariz: crista mediossagital projetada para anterior */
          const perfil = (zz > narizS + narizComp) ? 0
            : (zz > narizS ? (narizS + narizComp - zz) / narizComp : Math.exp(-(((zz - narizS) / 14) ** 2)));
          const h = narizProj * Math.exp(-((xx / narizLarg) ** 2)) * perfil;
          const ySup = rA * Math.sqrt(Math.max(0, 1 - (xx / rL) ** 2 - (zz / rS) ** 2));
          if (yy <= ySup + h && yy > 0) dentro = true;
        }
        if (dentro) {
          const casca = q > 0.82 && q <= 1;
          v.pix[v.idx(a, s, l)] = casca ? 900 : 45;   /* osso na periferia, tecido dentro */
        }
      }
    }
  }
  return v;
}

async function roda(orient) {
  console.log('\n═══ ORIENTAÇÃO: ' + orient + ' ═══');
  const v = fantoma(orient);
  const m = v.mapa;
  console.log('mapa  A→eixo' + m.A.eixo + '(' + (m.A.sinal > 0 ? '+' : '-') + ')  S→eixo' + m.S.eixo +
    '(' + (m.S.sinal > 0 ? '+' : '-') + ')  L→eixo' + m.L.eixo + '(' + (m.L.sinal > 0 ? '+' : '-') + ')' +
    '  oblíquo=' + m.obliquo);
  console.log('dims  nA=' + m.nA + ' nS=' + m.nS + ' nL=' + m.nL +
    '  mm ' + m.mmA.toFixed(2) + '/' + m.mmS.toFixed(2) + '/' + m.mmL.toFixed(2));

  const lim = limiarAutomatico(v);
  console.log('limiar automático = ' + lim + ' (esperado -400 em TC)');

  const t0 = Date.now();
  const an = await analisar(v, { limiar: lim, espMin: 6 }, null);
  console.log('análise em ' + (Date.now() - t0) + ' ms');
  console.log('  fração da grade ocupada pela cabeça: ' + (an.fracaoCabeca * 100).toFixed(1) + '%');
  console.log('  altura da cabeça: ' + an.alturaCabeca.toFixed(0) + ' mm (esperado ~208)');
  console.log('  nariz  aNose=' + an.aNose + '  sNose=' + an.sNose + '  lNose=' + an.lNose +
    '  (centro esperado sNose≈' + Math.round(m.nS / 2 + 6 / m.mmS) + ', lNose≈' + Math.round(m.nL / 2) + ')');
  console.log('  posição relativa do nariz na altura: ' + (an.relNariz * 100).toFixed(0) + '%  suspeito=' + an.suspeito);

  const fundo = fundoDoVolume(v, lim);
  console.log('  fundo: média ' + fundo.media.toFixed(0) + '  dp ' + fundo.dp.toFixed(1));

  const fx = faixaDaFace(v, an, { prof: 25, orelhas: false });
  console.log('  faixa facial: ' + ((fx.s1 - fx.s0) * m.mmS).toFixed(0) + ' × ' +
    ((fx.l1 - fx.l0) * m.mmL).toFixed(0) + ' mm');

  const linhas = [];
  for (const met of METODOS) {
    const d = await aplicarMetodo(v, an, fx, met.id, { fundo, semente: 'TESTE-1234', desloc: 0 }, null);
    const pm = materializar(v, d);
    const M = medir(v, an, fx, pm, d);
    linhas.push({
      metodo: met.curto,
      rms: +M.rms.toFixed(1), max: +M.max.toFixed(1), p95: +M.p95.toFixed(1),
      pres2mm: +M.preservada.toFixed(0),
      nariz: M.nariz === Infinity ? 'rem.' : M.nariz.toFixed(1),
      voxels: +M.voxelsPct.toFixed(2)
    });
  }
  console.table(linhas);
  return { v, an, fx, fundo };
}

async function testaSemente(ctx) {
  console.log('\n═══ SEMENTE: determinismo do preenchimento e da face média ═══');
  const { v, an, fx, fundo } = ctx;

  /* o ruído é o método que consome a semente: mesma semente tem de dar o mesmo volume */
  const volumes = [];
  for (const s of ['ALFA-0001', 'ALFA-0001', 'BETA-0002']) {
    const d = await aplicarMetodo(v, an, fx, 'ruido', { fundo, semente: s }, null);
    volumes.push({ s, pix: materializar(v, d) });
  }
  const difere = (a, b) => {
    let n = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
    return n;
  };
  const mesma = difere(volumes[0].pix, volumes[1].pix);
  const outra = difere(volumes[0].pix, volumes[2].pix);
  console.log('   ' + (mesma === 0 ? '✓' : '✗') +
    ' mesma semente (ALFA vs ALFA): ' + mesma + ' voxel(s) diferente(s) → deve ser 0');
  console.log('   ' + (outra > 0 ? '✓' : '✗') +
    ' sementes diferentes (ALFA vs BETA): ' + outra + ' voxel(s) diferente(s) → deve ser > 0');

  /* a face genérica não usa semente: os 14 parâmetros são o meio de cada faixa */
  const a = parametrosFace(), b = parametrosFace();
  const iguais = Object.keys(a).every((k) => a[k] === b[k]);
  console.log('   ' + (iguais ? '✓' : '✗') + ' face média reprodutível: 14 parâmetros idênticos');
  console.log('  proj. do nariz na face média: ' + a.narProj.toFixed(1) + ' mm');
}

function dicomSintetico(cols, rows) {
  const d = new EscritorDICOM();
  d.texto('00080005','CS','ISO_IR 100');
  d.texto('00080008','CS','ORIGINAL\\PRIMARY\\AXIAL');
  d.texto('00080016','UI','1.2.840.10008.5.1.4.1.1.2');
  d.texto('00080018','UI','1.2.3.4.5.6.7');
  d.texto('00080020','DA','20240115');
  d.texto('00080060','CS','CT');
  d.texto('00080080','LO','HOSPITAL EXEMPLO');
  d.texto('00080090','PN','SILVA^JOAO^MEDICO');
  d.texto('00081010','SH','CT-SALA-3');
  d.texto('00100010','PN','SOBRENOME^NOME DO PACIENTE');
  d.texto('00100020','LO','PRONT-99887');
  d.texto('00100030','DA','19701122');
  d.texto('00100040','CS','M');
  d.texto('00101010','AS','054Y');
  d.texto('00181000','LO','SN-ABC-12345');
  d.texto('0020000D','UI','1.2.3.4.5.1');
  d.texto('0020000E','UI','1.2.3.4.5.2');
  d.texto('00200032','DS','-115\\-115\\-105');
  d.texto('00200037','DS','1\\0\\0\\0\\1\\0');
  d.texto('00200052','UI','1.2.3.4.5.9');
  d.us('00280002',1);
  d.texto('00280004','CS','MONOCHROME2');
  d.us('00280010',rows); d.us('00280011',cols);
  d.texto('00280030','DS','0.9\\0.9');
  d.us('00280100',16); d.us('00280101',12); d.us('00280102',11); d.us('00280103',0);
  d.texto('00281050','DS','40'); d.texto('00281051','DS','400');
  d.texto('00281052','DS','-1024'); d.texto('00281053','DS','1');
  d.elem('00090010','LO', new TextEncoder().encode('BLOCO PRIVADO'));
  const corpo = reordenar(d.montar());
  const px = new Uint8Array(cols*rows*2);
  const pv = new DataView(px.buffer);
  for (let i=0;i<cols*rows;i++) pv.setUint16(i*2, 24, true);
  pv.setUint16(10*2, 1024+1234, true);
  const ep = new EscritorDICOM(); ep.elem('7FE00010','OW',px);
  const bloco = ep.montar();
  const m = new EscritorDICOM();
  m.elem('00020001','OB',new Uint8Array([0,1]));
  m.texto('00020002','UI','1.2.840.10008.5.1.4.1.1.2');
  m.texto('00020003','UI','1.2.3.4.5.6.7');
  m.texto('00020010','UI','1.2.840.10008.1.2.1');
  const mc = m.montar();
  const mg = new EscritorDICOM();
  const lb = new Uint8Array(4); new DataView(lb.buffer).setUint32(0, mc.length, true);
  mg.elem('00020000','UL',lb);
  const mh = mg.montar();
  const out = new Uint8Array(132+mh.length+mc.length+corpo.length+bloco.length);
  let o=128; out[o++]=0x44;out[o++]=0x49;out[o++]=0x43;out[o++]=0x4D;
  out.set(mh,o);o+=mh.length; out.set(mc,o);o+=mc.length;
  out.set(corpo,o);o+=corpo.length; out.set(bloco,o);
  return out;
}

async function testaEscrita() {
  console.log('\n\u2550\u2550\u2550 IDA E VOLTA DICOM \u2550\u2550\u2550');
  const N = 24;
  const orig = dicomSintetico(N, N);
  const r0 = new LeitorDICOM(orig.buffer.slice(orig.byteOffset, orig.byteOffset+orig.length), 'orig.dcm');
  await r0.ler(); r0.prepararTexto();
  console.log('  origem: sintaxe = ' + r0.ts.nome + ' | ' + r0.ordem.length + ' elementos | privadas=' + r0.privadas.length);
  const p0 = await r0.lerPixels();
  console.log('  origem: pixels ' + p0.cols + '\u00d7' + p0.rows + ' amostra[10]=' + p0.pix[10] + ' (bruto, esperado 2258)');
  const aud = auditar(r0);
  console.log('  auditoria: ' + aud.crit + ' cr\u00edtico(s), ' + aud.alto + ' alto(s), ' + aud.medio +
    ' quase-id, ' + aud.priv + ' privado(s), ' + aud.achados.length + ' achado(s)');
  console.log('  quase-identificadores: ' + aud.qi.join(' | '));

  const cfg = { uids:new MapaUID(), modalidade:'CT', nomePseudo:'ANONIMO^DEFACE^RT',
                idPseudo:'DFRT-TESTE01', metodoTxt:'DeFace RT 1.0 / teste' };
  const fatia = new Int16Array(N*N).fill(-1000);
  fatia[10] = 1234;
  const saida = escreverCorte(r0, fatia, N, N, cfg);
  console.log('  escrito: ' + saida.length + ' bytes');

  const r1 = new LeitorDICOM(saida.buffer.slice(saida.byteOffset, saida.byteOffset+saida.length), 'saida.dcm');
  await r1.ler(); r1.prepararTexto();
  const checa = (rot, obtido, esperado) => {
    const ok = String(obtido) === String(esperado);
    console.log('   ' + (ok?'\u2713':'\u2717') + ' ' + rot.padEnd(30) + ' "' + obtido + '"' + (ok?'':'  esperado "'+esperado+'"'));
    return ok;
  };
  let tudo = true;
  tudo &= checa('sintaxe', r1.ts ? r1.ts.nome : '-', 'Expl\u00edcito VR Little Endian');
  tudo &= checa('PatientName', r1.txt('00100010'), 'ANONIMO^DEFACE^RT');
  tudo &= checa('PatientID', r1.txt('00100020'), 'DFRT-TESTE01');
  tudo &= checa('PatientIdentityRemoved', r1.txt('00120062'), 'YES');
  tudo &= checa('ImageType', r1.txt('00080008'), 'DERIVED\\SECONDARY\\DEFACED');
  tudo &= checa('RescaleIntercept', r1.txt('00281052'), '0');
  tudo &= checa('PixelRepresentation', r1.us('00280103'), 1);
  tudo &= checa('geometria preservada (IOP)', r1.txt('00200037'), '1\\0\\0\\0\\1\\0');
  tudo &= checa('data do estudo esvaziada', r1.txt('00080020'), '');
  tudo &= checa('institui\u00e7\u00e3o removida', r1.txt('00080080'), '');
  tudo &= checa('m\u00e9dico removido', r1.txt('00080090'), '');
  tudo &= checa('n\u00famero de s\u00e9rie removido', r1.txt('00181000'), '');
  tudo &= checa('privada removida', r1.txt('00090010'), '');
  tudo &= checa('sexo mantido (quase-id)', r1.txt('00100040'), 'M');
  const uidNovo = r1.txt('0020000D') !== '1.2.3.4.5.1' && r1.txt('0020000D').startsWith('2.25.');
  console.log('   ' + (uidNovo?'\u2713':'\u2717') + ' ' + 'StudyInstanceUID renovado'.padEnd(30) + ' "' + r1.txt('0020000D') + '"');
  tudo &= uidNovo;

  const p1 = await r1.lerPixels();
  const okPx = p1.pix[10] === 1234 && p1.pix[0] === -1000;
  console.log('   ' + (okPx?'\u2713':'\u2717') + ' ' + 'pixels em UH diretas'.padEnd(30) +
    ' amostra[10]=' + p1.pix[10] + ' fundo=' + p1.pix[0]);
  tudo &= okPx;

  const z = montarZIP([{nome:'IM00001.dcm', dados:saida},{nome:'LEIAME.txt', dados:new TextEncoder().encode('ola')}]);
  console.log('  zip: ' + z.size + ' bytes, 2 entradas');
  console.log(tudo ? '  RESULTADO: ida e volta \u00edntegra' : '  RESULTADO: FALHAS ACIMA');
}


async function testaSerieCompleta(ctx) {
  console.log('\n\u2550\u2550\u2550 CADEIA COMPLETA: s\u00e9rie DICOM \u2192 volume \u2192 an\u00e1lise \u2550\u2550\u2550');
  const vp = ctx.v, m = vp.mapa;
  const cols = vp.nx, rows = vp.ny, nz = vp.nz;
  const arqs = [];
  const uidSerie = '1.2.3.9.9.1';
  for (let k = 0; k < nz; k++) {
    const d = new EscritorDICOM();
    d.texto('00080005','CS','ISO_IR 100');
    d.texto('00080016','UI','1.2.840.10008.5.1.4.1.1.2');
    d.texto('00080018','UI','1.2.3.9.9.2.' + k);
    d.texto('00080060','CS','CT');
    d.texto('00100010','PN','TESTE^FANTOMA');
    d.texto('0020000D','UI','1.2.3.9.9.0');
    d.texto('0020000E','UI',uidSerie);
    d.texto('00200013','IS',String(k+1));
    d.texto('00200032','DS', (-115) + '\\\\' + (-115) + '\\\\' + (-105 + k*vp.pz));
    d.texto('00200037','DS','1\\\\0\\\\0\\\\0\\\\1\\\\0');
    d.us('00280002',1); d.texto('00280004','CS','MONOCHROME2');
    d.us('00280010',rows); d.us('00280011',cols);
    d.texto('00280030','DS', vp.py + '\\\\' + vp.px);
    d.us('00280100',16); d.us('00280101',16); d.us('00280102',15); d.us('00280103',0);
    d.texto('00280050','DS',String(vp.pz));
    d.texto('00281052','DS','-1024'); d.texto('00281053','DS','1');
    const corpo = reordenar(d.montar());
    const px = new Uint8Array(cols*rows*2), pv = new DataView(px.buffer);
    for (let i = 0; i < cols*rows; i++) pv.setUint16(i*2, vp.pix[k*cols*rows + i] + 1024, true);
    const ep = new EscritorDICOM(); ep.elem('7FE00010','OW',px);
    const bloco = ep.montar();
    const mm2 = new EscritorDICOM();
    mm2.elem('00020001','OB',new Uint8Array([0,1]));
    mm2.texto('00020002','UI','1.2.840.10008.5.1.4.1.1.2');
    mm2.texto('00020003','UI','1.2.3.9.9.2.'+k);
    mm2.texto('00020010','UI','1.2.840.10008.1.2.1');
    const mc = mm2.montar();
    const mg = new EscritorDICOM();
    const lb = new Uint8Array(4); new DataView(lb.buffer).setUint32(0, mc.length, true);
    mg.elem('00020000','UL',lb);
    const mh = mg.montar();
    const out = new Uint8Array(132+mh.length+mc.length+corpo.length+bloco.length);
    let o=128; out[o++]=0x44;out[o++]=0x49;out[o++]=0x43;out[o++]=0x4D;
    out.set(mh,o);o+=mh.length; out.set(mc,o);o+=mc.length;
    out.set(corpo,o);o+=corpo.length; out.set(bloco,o);
    arqs.push({ nome: 'IM' + String(k).padStart(4,'0') + '.dcm',
                buf: out.buffer.slice(out.byteOffset, out.byteOffset + out.length) });
  }
  /* embaralha: a ordenação tem de vir da geometria, não do nome do arquivo */
  for (let i = arqs.length-1; i > 0; i--) { const j = (i*7919)%(i+1); const t=arqs[i];arqs[i]=arqs[j];arqs[j]=t; }
  console.log('  ' + arqs.length + ' arquivos gerados e embaralhados');

  const t0 = Date.now();
  const v2 = await montarVolume(arqs, null);
  console.log('  volume remontado em ' + (Date.now()-t0) + ' ms: ' + v2.nx+'\u00d7'+v2.ny+'\u00d7'+v2.nz +
    '  voxel ' + v2.px.toFixed(2)+'/'+v2.py.toFixed(2)+'/'+v2.pz.toFixed(2) + ' mm');
  let dif = 0, maxd = 0;
  for (let i = 0; i < vp.pix.length; i += 13) {
    const d2 = Math.abs(v2.pix[i] - vp.pix[i]);
    if (d2 > 0) dif++; if (d2 > maxd) maxd = d2;
  }
  console.log('   ' + (dif===0?'\u2713':'\u2717') + ' pixels id\u00eanticos ao fantoma (amostragem 1/13): ' +
    dif + ' diferen\u00e7a(s), m\u00e1x ' + maxd + ' UH');
  const m2 = v2.mapa;
  const okMapa = m2.A.eixo===m.A.eixo && m2.A.sinal===m.A.sinal && m2.S.eixo===m.S.eixo && m2.L.eixo===m.L.eixo;
  console.log('   ' + (okMapa?'\u2713':'\u2717') + ' mapeamento anat\u00f4mico id\u00eantico ao original');
  const an2 = await analisar(v2, { limiar: -400, espMin: 6 }, null);
  const okNariz = Math.abs(an2.sNose - ctx.an.sNose) <= 1 && Math.abs(an2.lNose - ctx.an.lNose) <= 1;
  console.log('   ' + (okNariz?'\u2713':'\u2717') + ' nariz no mesmo lugar: sNose=' + an2.sNose +
    ' lNose=' + an2.lNose + ' (fantoma ' + ctx.an.sNose + '/' + ctx.an.lNose + ')');
}

/* ---------- VR implícito com sequência aninhada ----------------------------
   Reproduz a estrutura que aparece em série real de RM e de TC exportada de
   PACS: uma sequência de comprimento indefinido contendo OUTRA sequência de
   comprimento indefinido. É o caso que fazia o leitor abandonar o arquivo em
   silêncio — ver armadilha 10.

   O que vem DEPOIS da sequência é o que interessa: identificação, o grupo
   0028 e os pixels. Se o leitor errar o fim da sequência, some tudo isso. */
function implicito(g, e, valor) {
  const b = new Uint8Array(8 + valor.length);
  const dv = new DataView(b.buffer);
  dv.setUint16(0, g, true); dv.setUint16(2, e, true);
  dv.setUint32(4, valor.length, true);
  b.set(valor, 8);
  return b;
}
function marcador(g, e) {
  const b = new Uint8Array(8);
  const dv = new DataView(b.buffer);
  dv.setUint16(0, g, true); dv.setUint16(2, e, true);
  dv.setUint32(4, 0, true);
  return b;
}
function abreIndef(g, e) {
  const b = new Uint8Array(8);
  const dv = new DataView(b.buffer);
  dv.setUint16(0, g, true); dv.setUint16(2, e, true);
  dv.setUint32(4, 0xFFFFFFFF, true);
  return b;
}
function junta(lista) {
  let n = 0;
  for (const p of lista) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of lista) { out.set(p, o); o += p.length; }
  return out;
}

function dicomImplicitoAninhado(cols, rows) {
  const t = (s) => new TextEncoder().encode(s.length % 2 ? s + ' ' : s);
  const us = (v) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); return b; };

  const px = new Uint8Array(cols * rows * 2);
  const pv = new DataView(px.buffer);
  for (let i = 0; i < cols * rows; i++) pv.setUint16(i * 2, 24, true);
  pv.setUint16(10 * 2, 1024 + 1234, true);

  const corpo = junta([
    implicito(0x0008, 0x0005, t('ISO_IR 100')),
    implicito(0x0008, 0x0016, t('1.2.840.10008.5.1.4.1.1.2')),
    implicito(0x0008, 0x0018, t('1.2.3.4.5.6.7')),
    implicito(0x0008, 0x0060, t('CT')),

    /* sequência externa, comprimento indefinido */
    abreIndef(0x0008, 0x1250),
    abreIndef(0xFFFE, 0xE000),                      /* item externo, indefinido */
    /*   sequência ANINHADA, também indefinida */
    abreIndef(0x0008, 0x1140),
    abreIndef(0xFFFE, 0xE000),                      /* item interno, indefinido */
    implicito(0x0008, 0x1150, t('1.2.840.10008.5.1.4.1.1.2')),
    implicito(0x0008, 0x1155, t('1.2.3.4.5.6.8')),
    marcador(0xFFFE, 0xE00D),                       /* fecha o item interno */
    marcador(0xFFFE, 0xE0DD),                       /* fecha a sequência aninhada */
    implicito(0x0020, 0x000D, t('1.2.3.4.5.1')),    /* ainda dentro do item externo */
    marcador(0xFFFE, 0xE00D),                       /* fecha o item externo */
    marcador(0xFFFE, 0xE0DD),                       /* fecha a sequência externa */

    /* tudo daqui para baixo só é lido se o fim da sequência estiver certo */
    implicito(0x0010, 0x0010, t('SOBRENOME^NOME')),
    implicito(0x0010, 0x0020, t('PRONT-77')),
    implicito(0x0020, 0x0032, t('-115\\-115\\-105')),
    implicito(0x0020, 0x0037, t('1\\0\\0\\0\\1\\0')),
    implicito(0x0028, 0x0010, us(rows)),
    implicito(0x0028, 0x0011, us(cols)),
    implicito(0x0028, 0x0100, us(16)),
    implicito(0x0028, 0x0101, us(12)),
    implicito(0x0028, 0x0102, us(11)),
    implicito(0x0028, 0x0103, us(0)),
    implicito(0x0028, 0x1052, t('-1024')),
    implicito(0x0028, 0x1053, t('1')),
    implicito(0x7FE0, 0x0010, px),
  ]);

  const m = new EscritorDICOM();
  m.elem('00020001', 'OB', new Uint8Array([0, 1]));
  m.texto('00020002', 'UI', '1.2.840.10008.5.1.4.1.1.2');
  m.texto('00020003', 'UI', '1.2.3.4.5.6.7');
  m.texto('00020010', 'UI', '1.2.840.10008.1.2');     /* IMPLÍCITO */
  const mc = m.montar();
  const mg = new EscritorDICOM();
  const lb = new Uint8Array(4); new DataView(lb.buffer).setUint32(0, mc.length, true);
  mg.elem('00020000', 'UL', lb);
  const mh = mg.montar();

  const out = new Uint8Array(132 + mh.length + mc.length + corpo.length);
  let o = 128;
  out[o++] = 0x44; out[o++] = 0x49; out[o++] = 0x43; out[o++] = 0x4D;
  out.set(mh, o); o += mh.length;
  out.set(mc, o); o += mc.length;
  out.set(corpo, o);
  return out;
}

async function testaSequenciaAninhada() {
  console.log('\n═══ VR IMPLÍCITO COM SEQUÊNCIA ANINHADA ═══');
  const N = 16;
  const bruto = dicomImplicitoAninhado(N, N);
  const r = new LeitorDICOM(bruto.buffer.slice(bruto.byteOffset, bruto.byteOffset + bruto.length), 'aninhado.dcm');
  await r.ler(); r.prepararTexto();

  let tudo = true;
  const checa = (rot, cond, obtido) => {
    console.log('   ' + (cond ? '✓' : '✗') + ' ' + rot.padEnd(42) + ' ' + obtido);
    tudo = tudo && cond;
  };
  checa('sintaxe reconhecida', r.ts && r.ts.uid === '1.2.840.10008.1.2', r.ts ? r.ts.nome : '-');
  checa('leitor não relatou erro', !r.erro, r.erro || '(nenhum)');
  checa('nome do paciente lido após a sequência',
    r.txt('00100010') === 'SOBRENOME^NOME', '"' + r.txt('00100010') + '"');
  checa('prontuário lido após a sequência',
    r.txt('00100020') === 'PRONT-77', '"' + r.txt('00100020') + '"');
  checa('geometria lida (IOP)', r.txt('00200037') === '1\\0\\0\\0\\1\\0', '"' + r.txt('00200037') + '"');
  checa('dimensões lidas', r.us('00280010') === N && r.us('00280011') === N,
    r.us('00280011') + '×' + r.us('00280010'));
  checa('dados de pixel encontrados', !!r.pixel, r.pixel ? 'sim' : 'AUSENTE');

  let px = null;
  try { px = await r.lerPixels(); } catch (e) {
    console.log('   ✗ lerPixels lançou: ' + e.message);
    tudo = false;
  }
  if (px) {
    checa('pixels decodificados', px.cols === N && px.rows === N,
      px.cols + '×' + px.rows);
    checa('valor de sonda preservado', px.pix[10] === 1024 + 1234, 'amostra[10]=' + px.pix[10]);
  }
  /* a sequência em si é removida na limpeza; o que não pode é ela levar o resto junto */
  checa('sequência externa reconhecida como SQ',
    (r.elems.get('00081250') || {}).vr === 'SQ', (r.elems.get('00081250') || {}).vr || '-');

  /* --- dois casos que a revisão do próprio conserto levantou --- */

  /* item indefinido que não tem ITEM_FIM: quem fecha é o SEQ_FIM da sequência.
     Se a busca passar por cima dele, engole o resto do arquivo — o mesmo
     estrago do defeito original, por outra porta. */
  const semFim = junta([
    implicito(0x0008, 0x0060, new TextEncoder().encode('CT')),
    abreIndef(0x0008, 0x1250),
    abreIndef(0xFFFE, 0xE000),
    implicito(0x0008, 0x1150, new TextEncoder().encode('1.2.3 ')),
    marcador(0xFFFE, 0xE0DD),
    implicito(0x0010, 0x0010, new TextEncoder().encode('DEPOIS^DO^SEM^FIM')),
  ]);
  const rs = new LeitorDICOM(semFim.buffer.slice(semFim.byteOffset, semFim.byteOffset + semFim.length), 'x');
  rs.ts = TS['1.2.840.10008.1.2'];
  rs.lerConjunto(0, semFim.length, false, false, rs.elems, rs.ordem);
  rs.prepararTexto();
  checa('item sem ITEM_FIM não engole o resto',
    rs.txt('00100010') === 'DEPOIS^DO^SEM^FIM', '"' + rs.txt('00100010') + '"');

  /* aninhamento profundo: a busca do delimitador é recursiva e corre sobre
     arquivo de terceiro. Tem de degradar sem lançar. */
  const fundo = [];
  for (let i = 0; i < 400; i++) fundo.push(abreIndef(0x0008, 0x1250), abreIndef(0xFFFE, 0xE000));
  for (let i = 0; i < 400; i++) fundo.push(marcador(0xFFFE, 0xE00D), marcador(0xFFFE, 0xE0DD));
  const prof = junta(fundo);
  let lancou = null;
  try {
    const rp = new LeitorDICOM(prof.buffer.slice(prof.byteOffset, prof.byteOffset + prof.length), 'x');
    rp.lerConjunto(0, prof.length, false, false, rp.elems, rp.ordem);
  } catch (e) { lancou = e.constructor.name; }
  checa('aninhamento profundo não estoura a pilha', lancou === null,
    lancou || 'sem exceção');

  console.log(tudo ? '  RESULTADO: sequência aninhada não interrompe a leitura'
    : '  RESULTADO: FALHAS ACIMA — o leitor abandona o arquivo na sequência aninhada');
  if (!tudo) process.exitCode = 1;
}

(async () => {
  const ctx = await roda('axial');
  await roda('axialFF');
  await roda('coronal');
  await testaSemente(ctx);
  await testaEscrita();
  await testaSequenciaAninhada();
  await testaSerieCompleta(ctx);
})();
