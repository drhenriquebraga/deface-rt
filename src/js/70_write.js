/* =========================================================================
   Anonimização de cabeçalho e escrita das séries entregues
   ========================================================================= */
'use strict';

/* VRs de texto que carregam identidade quando o atributo é desconhecido.
   Tag fora do dicionário com um destes VRs é removida — é mais seguro perder
   um campo técnico do que entregar um campo livre preenchido pelo operador. */
const VR_ARRISCADO = new Set(['PN', 'LT', 'ST', 'UT', 'LO', 'SH', 'UC']);

function acaoDe(chave, vr) {
  const d = DIC[chave];
  if (d) return { acao: d[3], risco: d[2], nome: d[1] };
  const g = parseInt(chave.slice(0, 4), 16);
  if (g & 1) return { acao: 'P', risco: 'A', nome: 'Atributo privado' };
  if (VR_ARRISCADO.has(vr)) return { acao: 'X', risco: 'A', nome: 'Atributo não catalogado (texto livre)' };
  return { acao: 'K', risco: 'B', nome: 'Atributo não catalogado' };
}

/* Levanta o inventário de um corte de referência: é o que a aba Cabeçalhos mostra */
function auditar(ld) {
  const linhas = [];
  let crit = 0, alto = 0, medio = 0, priv = 0, seq = 0, naoCat = 0;
  for (const chave of ld.ordem) {
    const el = ld.elems.get(chave);
    if (!el) continue;
    const vr = el.vr || 'UN';
    const a = acaoDe(chave, vr);
    let valor;
    if (el.pixel) valor = '‹' + (el.len ? bytesLegivel(el.len) : 'encapsulado') + ' de pixels›';
    else if (vr === 'SQ') { valor = '‹sequência com ' + (el.itens ? el.itens.length : 0) + ' item(ns)›'; seq++; }
    else if (VR_TEXTO.has(vr)) valor = ld.txt(chave) || '‹vazio›';
    else if (el.len === 0) valor = '‹vazio›';
    else if (vr === 'US' || vr === 'SS') valor = String(ld.us(chave));
    else valor = '‹' + el.len + ' bytes›';

    if (a.acao === 'P') priv++;
    if (!DIC[chave] && !(parseInt(chave.slice(0, 4), 16) & 1)) naoCat++;
    if (a.risco === 'C') crit++; else if (a.risco === 'A') alto++; else if (a.risco === 'M') medio++;
    linhas.push({ chave, tag: tagBonita(chave), vr, nome: a.nome, valor, risco: a.risco, acao: a.acao, len: el.len });
  }
  /* achados que não são uma tag isolada */
  const achados = [];
  const bia = ld.txt('00280301');
  if (bia && bia.toUpperCase() === 'YES')
    achados.push({ n: 'Anotação queimada na imagem', d: 'A tag (0028,0301) declara texto gravado nos próprios pixels. Nenhuma limpeza de cabeçalho remove isso — só recorte ou tarja sobre a imagem.', g: 'C' });
  else if (!bia)
    achados.push({ n: 'Anotação queimada não declarada', d: 'A tag (0028,0301) está ausente. Não se pode afirmar que não há texto gravado nos pixels; confira visualmente os cortes das extremidades e as imagens de localização.', g: 'A' });
  const csa = ld.ordem.filter((k) => k.startsWith('0029'));
  if (csa.length)
    achados.push({ n: 'Cabeçalhos privados Siemens (grupo 0029)', d: csa.length + ' elemento(s) do bloco CSA. Guardam parâmetros de aquisição e, com frequência, cópias de campos de identificação em formato binário próprio. São removidos por inteiro.', g: 'A' });
  if (priv)
    achados.push({ n: 'Atributos privados', d: priv + ' elemento(s) de grupo ímpar. Não têm significado padronizado e podem conter qualquer coisa que o fabricante decida gravar. São removidos por inteiro.', g: 'A' });
  if (seq)
    achados.push({ n: 'Sequências aninhadas', d: seq + ' sequência(s). Costumam referenciar estudo, procedimento e operador, e a limpeza plana as ignora. São removidas por inteiro.', g: 'A' });
  if (naoCat)
    achados.push({ n: 'Atributos fora do dicionário', d: naoCat + ' elemento(s) padronizados que este aplicativo não cataloga. Os de texto livre são removidos; os numéricos são mantidos. Numa entrega real, revise a lista.', g: 'M' });

  /* quase-identificadores: sobrevivem à limpeza e continuam identificando */
  const qi = [];
  const par = [['00101010', 'idade'], ['00100040', 'sexo'], ['00181030', 'protocolo'],
  ['00081090', 'modelo do equipamento'], ['00080070', 'fabricante'], ['00180050', 'espessura de corte'],
  ['0008103E', 'descrição da série'], ['00081030', 'descrição do estudo']];
  for (const [k, n] of par) { const v = ld.txt(k); if (v) qi.push(n + ': ' + v); }

  return { linhas, crit, alto, medio, priv, seq, naoCat, achados, qi };
}

/* ---- escrita de elementos em Explícito VR Little Endian ----------------- */
class EscritorDICOM {
  constructor() { this.partes = []; this.tam = 0; }
  put(u8) { this.partes.push(u8); this.tam += u8.length; }
  elem(chave, vr, dados) {
    const g = parseInt(chave.slice(0, 4), 16), e = parseInt(chave.slice(4), 16);
    let d = dados || new Uint8Array(0);
    if (d.length % 2) {                                   /* comprimento sempre par */
      const p = new Uint8Array(d.length + 1);
      p.set(d); p[d.length] = (vr === 'UI') ? 0x00 : 0x20;
      d = p;
    }
    const longo = VR_LONGO.has(vr);
    const cab = new Uint8Array(longo ? 12 : 8);
    const dv = new DataView(cab.buffer);
    dv.setUint16(0, g, true); dv.setUint16(2, e, true);
    cab[4] = vr.charCodeAt(0); cab[5] = vr.charCodeAt(1);
    if (longo) { dv.setUint16(6, 0, true); dv.setUint32(8, d.length, true); }
    else dv.setUint16(6, d.length, true);
    this.put(cab); this.put(d);
  }
  texto(chave, vr, s) { this.elem(chave, vr, new TextEncoder().encode(String(s))); }
  us(chave, v) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); this.elem(chave, 'US', b); }
  montar() {
    const out = new Uint8Array(this.tam); let o = 0;
    for (const p of this.partes) { out.set(p, o); o += p.length; }
    return out;
  }
}

/* ---- monta um arquivo DICOM desidentificado para um corte -------------- */
function escreverCorte(ld, pixSlice, cols, rows, cfg) {
  const ds = new EscritorDICOM();
  const sopClasse = ld.txt('00080016') || (cfg.modalidade === 'MR'
    ? '1.2.840.10008.5.1.4.1.1.4' : '1.2.840.10008.5.1.4.1.1.2');
  const novoSOP = cfg.uids.de(ld.txt('00080018') || novoUID());

  const PULAR = new Set(['7FE00010', '00280106', '00280107', '00281052', '00281053',
    '00280100', '00280101', '00280102', '00280103', '00080008',
    '00120062', '00120063', '00120064', '00281054']);
  if (cfg.atribuicaoPublica) PULAR.add('00082111');

  for (const chave of ld.ordem) {
    const el = ld.elems.get(chave);
    if (!el || el.pixel) continue;
    const g = parseInt(chave.slice(0, 4), 16);
    if (g === 0x0002) continue;
    if (PULAR.has(chave)) continue;
    const vr = el.vr || 'UN';
    if (vr === 'SQ') continue;                              /* sequências: removidas por inteiro */
    const a = acaoDe(chave, vr);
    if (a.acao === 'X' || a.acao === 'P') continue;
    if (a.acao === 'Z') { ds.elem(chave, vr, new Uint8Array(0)); continue; }
    if (a.acao === 'U') { ds.texto(chave, 'UI', cfg.uids.de(ld.txt(chave))); continue; }
    if (a.acao === 'D') {
      if (chave === '00100010') ds.texto(chave, 'PN', cfg.nomePseudo);
      else if (chave === '00100020') ds.texto(chave, 'LO', cfg.idPseudo);
      else ds.elem(chave, vr, new Uint8Array(0));
      continue;
    }
    const cru = ld.cru(chave);
    ds.elem(chave, vr, cru || new Uint8Array(0));
  }

  /* atributos reescritos ou acrescentados */
  ds.texto('00080008', 'CS', 'DERIVED\\SECONDARY\\DEFACED');
  ds.texto('00120062', 'CS', 'YES');
  ds.texto('00120063', 'LO', cfg.metodoTxt);
  if (cfg.atribuicaoPublica) ds.texto('00082111', 'ST', cfg.atribuicaoPublica);
  ds.us('00280100', 16); ds.us('00280101', 16); ds.us('00280102', 15); ds.us('00280103', 1);
  ds.texto('00281052', 'DS', '0');
  ds.texto('00281053', 'DS', '1');
  if (cfg.modalidade === 'CT') ds.texto('00281054', 'LO', 'HU');

  /* corpo ordenado por tag, como o padrão exige */
  const corpo = reordenar(ds.montar());

  /* pixels: valores já estão na unidade de saída (UH na TC) */
  const n = cols * rows;
  const px = new Uint8Array(n * 2);
  const pdv = new DataView(px.buffer);
  for (let i = 0; i < n; i++) pdv.setInt16(i * 2, pixSlice[i], true);
  const ep = new EscritorDICOM();
  ep.elem('7FE00010', 'OW', px);
  const blocoPixel = ep.montar();

  /* meta de arquivo — (0002,0000) conta TODOS os bytes que vêm depois dele,
     inclusive (0002,0001); medir o buffer é mais seguro do que somar à mão. */
  const m = new EscritorDICOM();
  m.elem('00020001', 'OB', new Uint8Array([0, 1]));
  m.elem('00020002', 'UI', new TextEncoder().encode(sopClasse));
  m.elem('00020003', 'UI', new TextEncoder().encode(novoSOP));
  m.elem('00020010', 'UI', new TextEncoder().encode('1.2.840.10008.1.2.1'));
  m.elem('00020012', 'UI', new TextEncoder().encode('1.2.826.0.1.3680043.10.1337.1'));
  m.elem('00020013', 'SH', new TextEncoder().encode('DEFACE_RT_1_0'));
  const metaCorpo = m.montar();
  const mg = new EscritorDICOM();
  const lenBuf = new Uint8Array(4); new DataView(lenBuf.buffer).setUint32(0, metaCorpo.length, true);
  mg.elem('00020000', 'UL', lenBuf);
  const metaCab = mg.montar();

  const total = 132 + metaCab.length + metaCorpo.length + corpo.length + blocoPixel.length;
  const out = new Uint8Array(total);
  let o = 128;
  out[o++] = 0x44; out[o++] = 0x49; out[o++] = 0x43; out[o++] = 0x4D;
  out.set(metaCab, o); o += metaCab.length;
  out.set(metaCorpo, o); o += metaCorpo.length;
  out.set(corpo, o); o += corpo.length;
  out.set(blocoPixel, o);
  return out;
}

/* reordena elementos por (grupo, elemento) — exigência do VR explícito */
function reordenar(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const els = [];
  let p = 0;
  while (p + 8 <= buf.length) {
    const g = dv.getUint16(p, true), e = dv.getUint16(p + 2, true);
    const vr = String.fromCharCode(buf[p + 4], buf[p + 5]);
    const longo = VR_LONGO.has(vr);
    const len = longo ? dv.getUint32(p + 8, true) : dv.getUint16(p + 6, true);
    const cab = longo ? 12 : 8;
    els.push({ ord: ((g << 16) >>> 0) + e, bytes: buf.subarray(p, p + cab + len) });
    p += cab + len;
  }
  els.sort((a, b) => a.ord - b.ord);
  let tot = 0; for (const x of els) tot += x.bytes.length;
  const out = new Uint8Array(tot); let o = 0;
  for (const x of els) { out.set(x.bytes, o); o += x.bytes.length; }
  return out;
}

/* ---- NIfTI-1, arquivo único, comprimido em gzip ------------------------ */
async function escreverNIfTI(vol, pix) {
  const cab = new ArrayBuffer(352);
  const dv = new DataView(cab);
  const u8 = new Uint8Array(cab);
  dv.setInt32(0, 348, true);
  dv.setInt16(40, 3, true);
  dv.setInt16(42, vol.nx, true); dv.setInt16(44, vol.ny, true); dv.setInt16(46, vol.nz, true);
  dv.setInt16(48, 1, true); dv.setInt16(50, 1, true); dv.setInt16(52, 1, true); dv.setInt16(54, 1, true);
  dv.setInt16(70, 4, true);      /* datatype 4 = int16 com sinal */
  dv.setInt16(72, 16, true);     /* bitpix */
  dv.setFloat32(76, 1, true);
  dv.setFloat32(80, vol.px, true); dv.setFloat32(84, vol.py, true); dv.setFloat32(88, vol.pz, true);
  dv.setFloat32(108, 352, true); /* vox_offset */
  dv.setFloat32(112, 1, true);   /* scl_slope */
  dv.setFloat32(116, 0, true);   /* scl_inter */
  dv.setInt16(252, 0, true);     /* qform_code */
  dv.setInt16(254, 1, true);     /* sform_code */
  const dl = vol.dirLin, dc = vol.dirCol, dn = vol.dirNor, or = vol.origem;
  /* DICOM entrega LPS; NIfTI espera RAS — invertem-se as duas primeiras linhas */
  const sr = [
    [-vol.px * dl[0], -vol.py * dc[0], -vol.pz * dn[0], -or[0]],
    [-vol.px * dl[1], -vol.py * dc[1], -vol.pz * dn[1], -or[1]],
    [vol.px * dl[2], vol.py * dc[2], vol.pz * dn[2], or[2]]
  ];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) dv.setFloat32(280 + r * 16 + c * 4, sr[r][c], true);
  const desc = new TextEncoder().encode('DeFace RT 1.0 - serie derivada');
  u8.set(desc.subarray(0, 79), 148);
  u8[344] = 0x6E; u8[345] = 0x2B; u8[346] = 0x31; u8[347] = 0x00;   /* 'n+1\0' */

  const dados = new Uint8Array(pix.buffer, pix.byteOffset, pix.byteLength);
  const bruto = new Blob([u8, dados]);
  const cs = new CompressionStream('gzip');
  const resp = new Response(bruto.stream().pipeThrough(cs));
  return new Uint8Array(await resp.arrayBuffer());
}

/* ---- ZIP sem compressão (método 0) -------------------------------------
   O conteúdo é imagem médica de 16 bits: o ganho do deflate não compensa o
   custo de processar centenas de arquivos, e "store" nunca falha. */
function montarZIP(itens) {
  const enc = new TextEncoder();
  const partes = [], central = [];
  let off = 0;

  for (const it of itens) {
    const nome = enc.encode(it.nome);
    const dados = it.dados;
    const crc = crc32(dados);
    const lh = new Uint8Array(30 + nome.length);
    const dv = new DataView(lh.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true);   /* nome em UTF-8 */
    dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true); dv.setUint16(12, 0x2821, true);   /* data fixa: não vaza horário */
    dv.setUint32(14, crc, true);
    dv.setUint32(18, dados.length, true); dv.setUint32(22, dados.length, true);
    dv.setUint16(26, nome.length, true); dv.setUint16(28, 0, true);
    lh.set(nome, 30);
    partes.push(lh, dados);

    const cd = new Uint8Array(46 + nome.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true); cv.setUint16(14, 0x2821, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, dados.length, true); cv.setUint32(24, dados.length, true);
    cv.setUint16(28, nome.length, true);
    cv.setUint32(42, off, true);
    cd.set(nome, 46);
    central.push(cd);
    off += lh.length + dados.length;
  }

  let tamCd = 0; for (const c of central) tamCd += c.length;
  const eo = new Uint8Array(22);
  const ev = new DataView(eo.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, itens.length, true); ev.setUint16(10, itens.length, true);
  ev.setUint32(12, tamCd, true); ev.setUint32(16, off, true);
  return new Blob([...partes, ...central, eo], { type: 'application/zip' });
}

function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 3000);
}

function leiame(cfg, met, M, aud) {
  return [
    'DeFace RT ' + APP.versao + ' — série derivada e desidentificada',
    'Gerado em ' + new Date().toLocaleString('pt-BR'),
    '',
    'MÉTODO DE DESFIGURAÇÃO: ' + met.nome,
    met.desc,
    '',
    'MEDIDAS DA SUPERFÍCIE FACIAL',
    '  deslocamento médio (RMS) ....... ' + nf(M.rms, 1) + ' mm',
    '  deslocamento máximo ............ ' + nf(M.max, 1) + ' mm',
    '  percentil 95 ................... ' + nf(M.p95, 1) + ' mm',
    '  área facial a menos de 2 mm .... ' + nf(M.preservada, 1) + ' %',
    '  ponta do nariz ................. ' + (M.nariz === null ? 'fora da faixa'
      : (M.nariz === Infinity ? 'removida' : nf(M.nariz, 1) + ' mm de deslocamento')),
    '  voxels alterados ............... ' + M.voxels.toLocaleString('pt-BR') +
    ' (' + nf(M.voxelsPct, 2) + ' % do volume)',
    '',
    'CABEÇALHO',
    '  Perfil Básico de Confidencialidade, DICOM PS3.15 Anexo E.',
    '  ' + aud.crit + ' atributo(s) de risco crítico e ' + aud.alto + ' de risco alto tratados.',
    '  ' + aud.priv + ' atributo(s) privado(s) e ' + aud.seq + ' sequência(s) removidos por inteiro.',
    '  Novos identificadores de estudo, série, instância e referencial.',
    '  PatientIdentityRemoved = YES.',
    '',
    'O QUE ESTE ARQUIVO NÃO GARANTE',
    '  1. Quase-identificadores permanecem e podem re-identificar em coorte pequena:',
    '     ' + (aud.qi.length ? aud.qi.join('; ') : 'nenhum detectado'),
    '  2. Texto queimado nos pixels não é removido por limpeza de cabeçalho.',
    '  3. A desfiguração altera a superfície; não impede que uma reconstrução',
    '     estatística proponha um rosto plausível a partir do crânio remanescente.',
    '  4. O vínculo com o exame de origem continua existindo fora deste arquivo.',
    '',
    'USO EDUCACIONAL. Confira o resultado antes de qualquer divulgação.',
    'Radioterapia.AI — https://radioterapia.ai'
  ].join('\n');
}
