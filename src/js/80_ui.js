/* =========================================================================
   Controlador da interface
   ========================================================================= */
'use strict';

const E = {
  modalidade: 'CT', formato: 'dicom', semente: '', fontePublica: false,
  vol: null, an: null, faixa: null, fundo: null,
  resultados: new Map(), atual: null, pixAtual: null, metodoEscolhido: null,
  cortes: { ax: 0, co: 0, sa: 0 },
  jan: 400, niv: 40, limiar: -400, yaw: 0, pitch: 0,
  ocupado: false, token: 0, tokens: { L: 0, R: 0 }, rec3L: null, rec3R: null,
  exemplo: false, licao: 0
};
const $ = (id) => document.getElementById(id);

/* ---------------------------------------------------------------- entrada */
async function coletarDeEntradas(entradas) {
  const arqs = [];
  async function anda(ent, caminho) {
    if (ent.isFile) {
      const f = await new Promise((r, j) => ent.file(r, j));
      arqs.push(f);
    } else if (ent.isDirectory) {
      const rd = ent.createReader();
      let lote;
      do {
        lote = await new Promise((r, j) => rd.readEntries(r, j));
        for (const e of lote) await anda(e, caminho + '/' + ent.name);
      } while (lote.length);
    }
  }
  for (const e of entradas) if (e) await anda(e, '');
  return arqs;
}

function ehZip(u8) { return u8.length > 4 && u8[0] === 0x50 && u8[1] === 0x4B && (u8[2] === 3 || u8[2] === 5 || u8[2] === 7); }

async function extrairZIP(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let eo = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--)
    if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; }
  if (eo < 0) throw new Error('Arquivo .zip ilegível (fim de diretório não encontrado).');
  const nEnt = dv.getUint16(eo + 10, true);
  let p = dv.getUint32(eo + 16, true);
  const saida = [];
  for (let i = 0; i < nEnt; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(p + 10, true);
    const tamComp = dv.getUint32(p + 20, true);
    const nLen = dv.getUint16(p + 28, true);
    const eLen = dv.getUint16(p + 30, true);
    const cLen = dv.getUint16(p + 32, true);
    const lhOff = dv.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nLen));
    p += 46 + nLen + eLen + cLen;
    if (nome.endsWith('/') || nome.split('/').pop().startsWith('.')) continue;
    if (dv.getUint32(lhOff, true) !== 0x04034b50) continue;
    const lnLen = dv.getUint16(lhOff + 26, true), leLen = dv.getUint16(lhOff + 28, true);
    const ini = lhOff + 30 + lnLen + leLen;
    const bruto = u8.subarray(ini, ini + tamComp);
    let dados;
    if (metodo === 0) dados = bruto.slice();
    else if (metodo === 8) {
      const ds = new DecompressionStream('deflate-raw');
      const r = new Response(new Blob([bruto]).stream().pipeThrough(ds));
      dados = new Uint8Array(await r.arrayBuffer());
    } else continue;
    saida.push({ nome: nome.split('/').pop(), buf: dados.buffer });
    if (i % 20 === 0) await cede();
  }
  return saida;
}

async function receber(lista, opcoes = {}) {
  if (E.ocupado) return false;
  E.ocupado = true;
  $('boasVindas').hidden = false; $('estudio').hidden = true;
  E.vol = null; E.atual = null; E.pixAtual = null; E.metodoEscolhido = null; E.resultados.clear(); E.fontePublica = false;
  E.tokens.L++; E.tokens.R++;
  $('RmprEmpty').style.display = 'flex';
  $('revisaoConfirmada').checked = false;
  $('statusInicio').classList.remove('error');
  atualizarControles();
  try {
    LOG.destaque('Recebidos ' + lista.length + ' arquivo(s).');
    prog(0.02); msgR('Lendo arquivos…');
    let brutos = [];
    for (let i = 0; i < lista.length; i++) {
      const f = lista[i];
      const buf = await f.arrayBuffer();
      if (ehZip(new Uint8Array(buf))) {
        LOG.info('Extraindo ' + f.name + '…');
        const dentro = await extrairZIP(buf);
        LOG.info(dentro.length + ' arquivo(s) dentro do .zip.');
        brutos = brutos.concat(dentro);
      } else brutos.push({ nome: f.name, buf });
      if (i % 12 === 0) { prog(0.02 + 0.18 * i / lista.length); await cede(); }
    }
    if (!brutos.length) throw new Error('Nenhum arquivo utilizável.');

    msgR('Montando o volume…');
    const vol = await montarVolume(brutos, (t, m) => { prog(0.2 + t * 0.45); if (m) LOG.info(m); });
    E.vol = vol;
    E.fontePublica = !!opcoes.exemplo || vol.refLeitor.txt('00082111').includes('10.6084/m9.figshare.8857007.v2');

    const modDICOM = (vol.modalidade || '').toUpperCase();
    const esperado = E.modalidade;
    if (modDICOM && !modDICOM.startsWith(esperado))
      LOG.aviso('A série declara modalidade ' + modDICOM + ', e a seleção é ' + (esperado === 'CT' ? 'TC' : 'RM') +
        '. Os parâmetros seguem a seleção da série — confira se é isso mesmo.');
    if (vol.diag.extras) LOG.aviso(vol.diag.extras + ' outra(s) série(s) no lote foram ignoradas; usei a mais longa.');
    if (vol.diag.dup) LOG.aviso(vol.diag.dup + ' corte(s) em posição repetida foram descartados.');
    if (vol.diag.falhas.length) LOG.aviso(vol.diag.falhas.length + ' arquivo(s) falharam: ' + vol.diag.falhas[0]);
    if (vol.irregular) LOG.aviso('Espaçamento entre cortes irregular — a geometria do volume é aproximada.');
    if (vol.mapa.obliquo) LOG.aviso('Aquisição oblíqua: os eixos anatômicos foram estimados pelo alinhamento dominante.');

    LOG.ok('Volume ' + vol.nx + '×' + vol.ny + '×' + vol.nz + ' — ' +
      nf(vol.px, 2) + '×' + nf(vol.py, 2) + '×' + nf(vol.pz, 2) + ' mm — ' +
      (vol.refLeitor.ts ? vol.refLeitor.ts.nome : '?'));

    E.limiar = limiarAutomatico(vol);
    $('thr').min = E.modalidade === 'CT' ? -900 : 0;
    $('thr').max = E.modalidade === 'CT' ? 900 : Math.max(50, E.limiar * 4);
    $('thr').value = E.limiar; $('vThr').textContent = E.limiar;

    msgR('Localizando a face…');
    E.an = await analisar(vol, { limiar: E.limiar, espMin: 6 }, (t, m) => { prog(0.65 + t * 0.3); if (m) LOG.info(m); });
    E.fundo = fundoDoVolume(vol, E.limiar);
    E.faixa = faixaDaFace(vol, E.an, { prof: 25, orelhas: false });

    if (E.an.suspeito)
      LOG.aviso('Os marcos anatômicos ficaram fora do esperado (altura ' + nf(E.an.alturaCabeca, 0) +
        ' mm). Se não for um exame de crânio, o resultado não vale.');
    LOG.ok('Ponta do nariz localizada; faixa facial com ' +
      nf((E.faixa.s1 - E.faixa.s0) * vol.mapa.mmS, 0) + ' × ' +
      nf((E.faixa.l1 - E.faixa.l0) * vol.mapa.mmL, 0) + ' mm.');

    E.cortes = { ax: E.an.sNose, co: Math.round(E.an.aNose - 40 / vol.mapa.mmA), sa: E.an.lNose };
    ajustarPreset(true);
    prepararSliders();
    invalidarResultado('Os dois painéis mostram o original. Clique em um card para aplicar um método.');
    $('LmprEmpty').style.display = 'none';
    $('srcInfo').textContent = vol.nz + ' cortes · ' + (vol.modalidade || E.modalidade);
    msgR('Escolha um card. Cada método parte sempre da imagem original.');
    prog(0);

    E.exemplo = !!opcoes.exemplo;
    $('tipoEstudo').textContent = E.exemplo ? 'TC real · Pat8 · publicação facial consentida pelos participantes · CC BY 4.0' : 'Série local — confira a modalidade e a geometria';
    $('btnBaixarExemplo').hidden = !E.exemplo;
    $('boasVindas').hidden = true; $('estudio').hidden = false;
    marcarEtapa('etapaRevisar');
    montarTabelaOrigem();
    await mostrarVista('d3');
    definirLicao(0);
    return true;
  } catch (e) {
    LOG.erro(e.message);
    msgR(e.message);
    $('statusInicio').classList.add('error');
    return false;
  } finally { E.ocupado = false; atualizarControles(); }
}

/* --------------------------------------------------------- processamento */
async function processar(id) {
  if (E.ocupado || !E.vol) return;
  const met = METODOS.find(m => m.id === id);
  if (!met) return;
  const card = $('methodCards').querySelector('[data-metodo="' + id + '"]');
  const devolverFoco = document.activeElement === card;
  E.ocupado = true;
  invalidarResultado('Aplicando ' + met.nome + ' à imagem original…');
  E.metodoEscolhido = id;
  atualizarControles();
  marcarEtapa('etapaRevisar');
  const semente = ($('seed').value || '').trim() || sementeAleatoria();
  $('seed').value = semente; E.semente = semente;
  LOG.destaque('Semente: ' + semente);

  try {
    // O original fica visível enquanto a nova comparação é calculada.
    desenharMPR('R');
    await desenhar3D('R');
    // O limiar também define a máscara e a superfície usadas pelos métodos.
    // Uma mudança no visor exige nova análise antes de produzir uma saída.
    if (!E.an || E.an.limiar !== E.limiar) {
      msgR('Recalculando a superfície com o novo limiar…');
      E.an = await analisar(E.vol, { limiar: E.limiar, espMin: 6 },
        (t, m) => { prog(t * 0.15); if (m) LOG.info(m); });
      E.fundo = fundoDoVolume(E.vol, E.limiar);
      E.faixa = faixaDaFace(E.vol, E.an, { prof: 25, orelhas: false });
      if (E.an.suspeito) LOG.aviso('Os marcos ficaram fora do esperado com este limiar. Confira a geometria.');
      montarNotaGeometria();
    }
    msgR('Aplicando ' + met.nome + ' à imagem original…');
    LOG.info('Aplicando somente ' + met.nome + ' ao volume original…');
    const t0 = performance.now();

      const delta = await aplicarMetodo(E.vol, E.an, E.faixa, id,
        { fundo: E.fundo, semente, desloc: 0 },
        (t) => prog(0.15 + t * 0.65));

      const pixMod = materializar(E.vol, delta);
      prog(0.85);
      await cede();
      const M = medir(E.vol, E.an, E.faixa, pixMod, delta);
      const V = veredito(id, M);
      E.resultados.set(id, { delta, M, V, met });
      LOG.ok(met.nome + ': RMS ' + nf(M.rms, 1) + ' mm · ' + nf(M.preservada, 0) +
        '% da face a menos de 2 mm · ' + nf((performance.now() - t0) / 1000, 1) + ' s');
      prog(1);
      await cede();
    $('RmprEmpty').style.display = 'none';
    await selecionar(id);
    $('methodStatus').textContent = met.nome + ': ' + METODO_AULA[id].licao;
    msgR('Compare com o original. Outro card substitui este método, sem acumular efeitos.');
    await mostrarVista('d3');
    LOG.destaque('Concluído — somente ' + met.nome + '. Escolha outro card para comparar.');
  } catch (e) {
    invalidarResultado('Não foi possível aplicar o método. Escolha um card para tentar novamente.');
    desenharMPR('R'); await desenhar3D('R');
    LOG.erro(e.message); msgR(e.message);
  } finally {
    E.ocupado = false; atualizarControles(); prog(0);
    if (devolverFoco) card.focus({ preventScroll: true });
  }
}

async function selecionar(id) {
  const r = E.resultados.get(id);
  if (!r) return;
  E.atual = id;
  $('revisaoConfirmada').checked = false;
  atualizarControles();
  E.metodoEscolhido = id;
  E.pixAtual = materializar(E.vol, r.delta);
  $('rmprTag').textContent = r.met.nome;
  $('rd3tag').textContent = r.met.nome;
  desenharMPR('R');
  montarMetricas();
  montarTabelaResultado();
  await desenhar3D('R');
}

/* -------------------------------------------------------------- desenho */
function desenharMPR(lado) {
  const vol = E.vol; if (!vol) return;
  const pix = lado === 'L' ? vol.pix : E.pixAtual;
  if (!pix) return;
  const pref = lado === 'L' ? { ax: 'cAx', co: 'cCo', sa: 'cSa' } : { ax: 'rAx', co: 'rCo', sa: 'rSa' };
  const rot = lado === 'L' ? { ax: 'iAx', co: 'iCo', sa: 'iSa' } : { ax: 'riAx', co: 'riCo', sa: 'riSa' };
  const m = vol.mapa;
  const lim = { ax: m.nS - 1, co: m.nA - 1, sa: m.nL - 1 };
  for (const p of ['ax', 'co', 'sa']) {
    const idx = Math.max(0, Math.min(lim[p], E.cortes[p]));
    pintarMPR($(pref[p]), fatiaMPR(vol, pix, p, idx, E.jan, E.niv));
    $(rot[p]).textContent = (idx + 1) + '/' + (lim[p] + 1);
  }
}

async function desenhar3D(lado, previa) {
  const vol = E.vol; if (!vol) return;
  const pix = lado === 'L' ? vol.pix : E.pixAtual;
  if (!pix) return;
  const tok = ++E.tokens[lado];
  const W = previa ? 176 : 424, H = previa ? 220 : 530;
  const rec = await reconstruir3D(vol, pix, {
    W, H, limiar: E.limiar, yaw: E.yaw, pitch: E.pitch,
    prog: previa ? null : (t) => prog(t)
  });
  if (tok !== E.tokens[lado]) return;
  const img = sombrear(rec, {});
  // O Estúdio reserva cor para os controles; a superfície fica neutra.
  // Altera apenas a apresentação, nunca o volume nem o mapa de profundidade.
  for (let i = 0; i < rec.prof.length; i++) {
    const o = i * 4;
    if (rec.prof[i] < 0) { img.data[o] = 8; img.data[o + 1] = 15; img.data[o + 2] = 25; }
    else {
      const cinza = Math.round(img.data[o] * 0.2126 + img.data[o + 1] * 0.7152 + img.data[o + 2] * 0.0722);
      img.data[o] = cinza; img.data[o + 1] = cinza; img.data[o + 2] = cinza;
    }
  }
  const cv = $(lado === 'L' ? 'c3L' : 'c3R');
  cv.width = W; cv.height = H;
  cv.getContext('2d').putImageData(img, 0, 0);
  cv.style.width = '424px'; cv.style.height = '530px';
  if (!previa) prog(0);
}

async function desenharTudo(previa) {
  desenharMPR('L');
  if (E.pixAtual) desenharMPR('R');
  const aba = document.querySelector('#tabsL button[aria-selected="true"]').dataset.v;
  const abaR = document.querySelector('#tabsR button[aria-selected="true"]').dataset.v;
  if (aba === 'd3') await desenhar3D('L', previa);
  if (abaR === 'd3' && E.pixAtual) await desenhar3D('R', previa);
  montarNotaGeometria();
}

/* --------------------------------------------------------------- tabelas */
let filtroRisco = null;
function montarTabelaOrigem() {
  const ld = E.vol.refLeitor;
  const aud = auditar(ld);
  E.aud = aud;
  const tb = $('tblHdr').querySelector('tbody');
  tb.innerHTML = '';
  let mostrados = 0;
  for (const l of aud.linhas) {
    if (filtroRisco && l.risco !== filtroRisco) continue;
    mostrados++;
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="tag">' + l.tag + '</td>' +
      '<td class="nm">' + esc(l.nome) + '</td>' +
      '<td class="vl">' + esc(String(l.valor).slice(0, 160)) + '</td>' +
      '<td><span class="pill ' + RISCO_CLS[l.risco] + '">' + RISCO_NOME[l.risco] + '</span></td>' +
      '<td class="tag">' + ACAO_NOME[l.acao] + '</td>';
    tb.appendChild(tr);
  }
  $('hdrCount').textContent = mostrados + ' de ' + aud.linhas.length + ' atributos';

  const f = $('hdrFilters');
  f.innerHTML = '';
  const opts = [[null, 'Todos', aud.linhas.length], ['C', 'Crítico', aud.crit],
  ['A', 'Alto', aud.alto], ['M', 'Quase-id.', aud.medio]];
  for (const [k, nome, n] of opts) {
    const b = document.createElement('button');
    b.className = 'btn'; b.textContent = nome + ' ' + n;
    if (filtroRisco === k) b.style.borderColor = 'var(--grad-b)';
    b.onclick = () => { filtroRisco = k; montarTabelaOrigem(); };
    f.appendChild(b);
  }
  if (aud.achados.length) {
    const cx = document.createElement('span');
    cx.className = 'kick'; cx.style.marginLeft = '8px';
    cx.textContent = aud.achados.length + ' achado(s) além das tags';
    f.appendChild(cx);
  }
  montarNotaGeometria();
}

function montarTabelaResultado() {
  const tb = $('tblHdrR').querySelector('tbody');
  tb.innerHTML = '';
  if (!E.aud) return;
  const r = E.resultados.get(E.atual);
  if (!r) return;
  const cfg = identidadeDaEntrega(r);
  const fix = [
    ['(0010,0010)', 'Nome do paciente', cfg.nomePseudo, 'substituído'],
    ['(0010,0020)', 'Prontuário do paciente', cfg.idPseudo, 'substituído'],
    ['(0012,0062)', 'Paciente desidentificado', 'YES', 'acrescentado'],
    ['(0012,0063)', 'Método de desidentificação', cfg.metodoTxt, 'acrescentado'],
    ['(0008,0008)', 'Tipo de imagem', 'DERIVED\\SECONDARY\\DEFACED', 'reescrito'],
    ['(0020,000D)', 'Instância do estudo', '‹novo identificador›', 'novo identificador'],
    ['(0020,000E)', 'Instância da série', '‹novo identificador›', 'novo identificador'],
    ['(0008,0018)', 'Instância SOP', '‹novo por corte›', 'novo identificador'],
    ['(0020,0052)', 'Referencial de coordenadas', '‹novo identificador›', 'novo identificador']
  ];
  if (E.fontePublica) fix.push(['(0008,2111)', 'Fonte pública e licença', ATRIBUICAO_DICOM_PUBLICO, 'crédito preservado']);
  for (const [t, n, v, a] of fix) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td class="tag">' + t + '</td><td class="nm">' + n +
      '</td><td class="vl">' + esc(v) + '</td><td class="tag">' + a + '</td>';
    tb.appendChild(tr);
  }
  for (const l of E.aud.linhas) {
    if (l.acao === 'K') continue;
    if (fix.some((f) => f[0] === l.tag)) continue;
    const tr = document.createElement('tr');
    const vazio = l.acao === 'X' || l.acao === 'P';
    tr.innerHTML = '<td class="tag">' + l.tag + '</td><td class="nm">' + esc(l.nome) +
      '</td><td class="vl gone">' + (vazio ? '‹ausente na entrega›' : '‹vazio›') +
      '</td><td class="tag">' + ACAO_NOME[l.acao] + '</td>';
    tb.appendChild(tr);
  }
}

function montarNotaGeometria() {
  const el = $('geomNote'); if (!E.vol) { el.innerHTML = ''; return; }
  const v = E.vol, m = v.mapa, an = E.an;
  const eixo = (x) => ['linha', 'coluna', 'corte'][x];
  let h = '<div class="kick">Geometria e marcos</div>';
  h += '<div class="mgrid" style="grid-template-columns:1fr 1fr">';
  h += cel('Volume', v.nx + '×' + v.ny + '×' + v.nz, 'voxels');
  h += cel('Voxel', nf(v.px, 2) + ' × ' + nf(v.py, 2) + ' × ' + nf(v.pz, 2), 'mm');
  h += cel('Limiar de pele', String(E.limiar), v.modalidade === 'CT' ? 'UH' : 'intensidade');
  if (an && an.limiar === E.limiar) h += cel('Altura da cabeça', nf(an.alturaCabeca, 0), 'mm');
  else h += cel('Análise da superfície', 'Pendente', 'processe com o novo limiar');
  h += '</div>';
  h += '<div class="kick" style="margin-top:4px">Eixos anatômicos</div>';
  h += '<div style="font-size:11.5px;color:var(--ink-soft);line-height:1.6">' +
    'Anterior &rarr; ' + eixo(m.A.eixo) + (m.A.sinal < 0 ? ' invertido' : '') + ' · ' +
    'Superior &rarr; ' + eixo(m.S.eixo) + (m.S.sinal < 0 ? ' invertido' : '') + ' · ' +
    'Esquerda &rarr; ' + eixo(m.L.eixo) + (m.L.sinal < 0 ? ' invertido' : '') +
    (m.obliquo ? '<br><span style="color:var(--alto)">Aquisição oblíqua — eixos estimados.</span>' : '') +
    '</div>';
  if (E.aud && E.aud.achados.length) {
    h += '<div class="kick" style="margin-top:6px">Achados além das tags</div>';
    for (const a of E.aud.achados)
      h += '<div style="font-size:11px;line-height:1.5;margin-top:5px"><span class="pill ' +
        RISCO_CLS[a.g] + '">' + RISCO_NOME[a.g] + '</span> <b style="color:var(--ink)">' +
        esc(a.n) + '</b><br><span style="color:var(--ink-dim)">' + esc(a.d) + '</span></div>';
  }
  el.innerHTML = h;
}

function cel(k, v, s) {
  return '<div class="mcell"><div class="k">' + k + '</div><div class="v flat" style="font-size:17px">' +
    v + '</div><div class="s">' + (s || '') + '</div></div>';
}

function montarMetricas() {
  const r = E.resultados.get(E.atual); if (!r) return;
  const M = r.M, V = r.V;
  let h = '<div class="verdict"><h4>' + esc(V.t) + '</h4><p>' + esc(V.p) + '</p></div>';
  h += '<div class="mgrid">';
  h += cel2('Deslocamento médio', nf(M.rms, 1), 'mm', 'raiz do erro quadrático na faixa facial');
  h += cel2('Deslocamento máximo', nf(M.max, 1), 'mm', 'percentil 95 em ' + nf(M.p95, 1) + ' mm');
  h += cel2('Face a menos de 2 mm', nf(M.preservada, 1), '%', 'quanto maior, mais geometria sobreviveu');
  h += cel2('Ponta do nariz', M.nariz === Infinity ? 'removida' : (M.nariz === null ? '—' : nf(M.nariz, 1)),
    M.nariz === Infinity || M.nariz === null ? '' : 'mm', 'marco mais saliente da face');
  h += cel2('Voxels alterados', nf(M.voxelsPct, 2), '%', M.voxels.toLocaleString('pt-BR') + ' voxels');
  h += cel2('Área avaliada', nf(M.areaCM2, 0), 'cm²', 'projeção da faixa facial');
  h += '</div>';
  h += '<div class="verdict" style="border-left-color:var(--alto)"><h4>O que a medida não cobre</h4><p>' +
    'O deslocamento de superfície mede o que mudou na geometria — não prova irreversibilidade. ' +
    'Trabalhos publicados reconstroem faces plausíveis a partir de volumes desfigurados, e o crânio ' +
    'remanescente prevê boa parte dos tecidos moles. Some a isso os quase-identificadores que sobrevivem ' +
    'à limpeza de cabeçalho' + (E.aud && E.aud.qi.length ? ' — nesta série: ' + esc(E.aud.qi.join('; ')) : '') +
    '. Numa coorte pequena, esse conjunto identifica sem precisar de rosto nenhum.</p></div>';
  h += '<div class="verdict" style="border-left-color:var(--rule)"><h4>' + esc(r.met.nome) + '</h4><p>' +
    esc(r.met.desc) + '</p></div>';
  $('metrics').innerHTML = h;

  const n = $('metNote');
  n.innerHTML = '<div class="kick">Leitura</div><div style="font-size:12px;color:var(--ink-soft);line-height:1.55">' +
    '<b style="color:var(--ink)">' + esc(V.t) + '</b><br>' + esc(V.p) + '</div>';
}

function cel2(k, v, u, s) {
  return '<div class="mcell"><div class="k">' + k + '</div><div class="v">' + v +
    (u ? '<small>' + u + '</small>' : '') + '</div><div class="s">' + (s || '') + '</div></div>';
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* --------------------------------------------------------------- entrega */
function identidadeDaEntrega(resultado) {
  return {
    nomePseudo: 'ANONIMO^DEFACE^RT',
    idPseudo: 'DFRT-' + (E.semente || '').replace(/-/g, '').slice(0, 9),
    metodoTxt: 'DeFace RT ' + APP.versao + ' / ' + (resultado ? resultado.met.nome : '')
  };
}

async function entregar() {
  if (E.ocupado || !E.atual || !$('revisaoConfirmada').checked) return;
  const r = E.resultados.get(E.atual);
  E.ocupado = true; atualizarControles(); marcarEtapa('etapaExportar');
  try {
    const uids = new MapaUID();
    const cfg = {
      uids, modalidade: E.modalidade,
      atribuicaoPublica: E.fontePublica ? ATRIBUICAO_DICOM_PUBLICO : '',
      ...identidadeDaEntrega(r)
    };
    const pix = E.pixAtual || materializar(E.vol, r.delta);
    const itens = [];
    const carimbo = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const base = 'DeFaceRT_' + r.met.id + '_' + carimbo;

    if (E.formato === 'nifti') {
      LOG.info('Escrevendo NIfTI…');
      msgR('Escrevendo NIfTI…');
      const nii = await escreverNIfTI(E.vol, pix);
      itens.push({ nome: base + '/volume.nii.gz', dados: nii });
      LOG.ok('NIfTI: ' + bytesLegivel(nii.length));
    } else {
      const n = E.vol.nx * E.vol.ny;
      LOG.info('Escrevendo ' + E.vol.nz + ' arquivos DICOM…');
      for (let k = 0; k < E.vol.nz; k++) {
        const ld = E.vol.cortes[k].leitor;
        const fatia = pix.subarray(k * n, (k + 1) * n);
        itens.push({
          nome: base + '/IM' + String(k + 1).padStart(5, '0') + '.dcm',
          dados: escreverCorte(ld, fatia, E.vol.nx, E.vol.ny, cfg)
        });
        if (k % 10 === 0) {
          prog(k / E.vol.nz); msgR('Escrevendo DICOM ' + (k + 1) + '/' + E.vol.nz);
          await cede();
        }
      }
      LOG.ok(E.vol.nz + ' arquivos DICOM escritos.');
    }

    itens.push({
      nome: base + '/LEIAME.txt',
      dados: new TextEncoder().encode(leiame(cfg, r.met, r.M, E.aud))
    });
    if (E.fontePublica) itens.push({
      nome: base + '/FONTE_LICENCA_E_CONSENTIMENTO.txt',
      dados: new TextEncoder().encode('A preparação descrita abaixo refere-se ao caso de origem, antes do método.\n\n' + CREDITO_CASO_PUBLICO + '\nAdaptação desta entrega: ' + r.met.nome + ', com alteração dos pixels pela demonstração.\n')
    });
    const blob = montarZIP(itens);
    baixar(blob, base + '.zip');
    LOG.destaque('Entregue: ' + base + '.zip (' + bytesLegivel(blob.size) + ')');
    msgR('Arquivo entregue. Confira a aba Cabeçalhos antes de compartilhar.');
  } catch (e) {
    LOG.erro('Falha na entrega: ' + e.message);
    msgR(e.message);
  } finally { E.ocupado = false; atualizarControles(); prog(0); }
}

/* ------------------------------------------------------------- auxiliares */
function prog(t) { $('prog').style.width = Math.round(Math.max(0, Math.min(1, t)) * 100) + '%'; }
function msgR(s) {
  $('RmprTxt').textContent = s;
  $('statusInicio').textContent = s;
  $('statusEstudio').textContent = s;
}

function ajustarPreset(inicial) {
  const presets = E.modalidade === 'CT'
    ? [['TC partes moles', 400, 40], ['TC pele', 1400, -260], ['TC osso', 2200, 400], ['TC amplo', 3600, 200]]
    : [['RM automático', 0, 0], ['RM contraste', 0, 0]];
  if (E.modalidade === 'MR' && E.vol) {
    const p = E.vol.pix; let mx = 0;
    for (let i = 0; i < p.length; i += 97) if (p[i] > mx) mx = p[i];
    presets[0] = ['RM automático', Math.round(mx * 0.85), Math.round(mx * 0.42)];
    presets[1] = ['RM contraste', Math.round(mx * 0.5), Math.round(mx * 0.3)];
  }
  if (inicial) E._preset = 0; else E._preset = (E._preset + 1) % presets.length;
  const [nome, w, l] = presets[E._preset];
  E.jan = w; E.niv = l;
  $('btnPreset').textContent = nome;
  $('wW').value = w; $('wL').value = l;
  $('vW').textContent = w; $('vL').textContent = l;
}

function prepararSliders() {
  const m = E.vol.mapa;
  $('sAx').max = m.nS - 1; $('sAx').value = E.cortes.ax;
  $('sCo').max = m.nA - 1; $('sCo').value = E.cortes.co;
  $('sSa').max = m.nL - 1; $('sSa').value = E.cortes.sa;
  $('wL').min = E.modalidade === 'CT' ? -1200 : 0;
  $('wL').max = E.modalidade === 'CT' ? 3000 : 4000;
}

/* ------------------------------------------------------------------ ligar */
/* -------------------------------------------------------------------------
   Autoteste de isolamento de rede

   A alegação "nada sai deste computador" não deve ser aceita na palavra do
   autor. Aqui ela é verificada: tentamos uma conexão para um domínio da TLD
   reservada .invalid (RFC 2606 — nunca resolve, nenhum pacote chega a lugar
   algum) e observamos se a política de segurança de conteúdo a barra ANTES
   de qualquer atividade de rede.

   Este é o único fetch do aplicativo. Ele não transporta dado nenhum; existe
   para provar que nenhum outro poderia existir.
   ------------------------------------------------------------------------- */
async function verificarIsolamento() {
  const b = $('badgeRede');
  let barrado = false;
  const ouvinte = (ev) => {
    if (String(ev.violatedDirective || '').indexOf('connect-src') === 0) barrado = true;
  };
  document.addEventListener('securitypolicyviolation', ouvinte);
  try {
    await fetch('https://isolamento.invalid/deface-rt', { mode: 'no-cors', cache: 'no-store' });
  } catch (e) { /* esperado nos dois cenários */ }
  await new Promise((r) => setTimeout(r, 60));
  document.removeEventListener('securitypolicyviolation', ouvinte);

  if (barrado) {
    b.innerHTML = '<b>&#9679;</b>&nbsp; Processamento local · isolamento confirmado';
    b.style.borderColor = 'rgba(79,209,165,.4)';
    b.title = 'A política de segurança de conteúdo deste arquivo bloqueia fetch, XMLHttpRequest, ' +
      'WebSocket, EventSource e sendBeacon. Nenhum dado pode sair, independentemente de onde o arquivo esteja hospedado.';
    LOG.ok('Isolamento de rede confirmado: a CSP barrou a tentativa de conexão.');
  } else {
    b.innerHTML = '<b style="color:var(--alto)">&#9679;</b>&nbsp; CSP inativa — isolamento não verificado';
    b.style.borderColor = 'rgba(255,162,58,.45)';
    b.title = 'A política de segurança não foi aplicada. O código continua sem qualquer chamada de rede, ' +
      'mas a garantia passa a depender de auditoria do código, e não do navegador. ' +
      'Verifique se o servidor ou um proxy removeu a tag meta http-equiv de política ' +
      'de segurança de conteúdo do cabeçalho do arquivo.';
    LOG.aviso('A CSP não foi aplicada. O isolamento depende do código, não do navegador — veja o distintivo no cabeçalho.');
  }
}

function iniciar() {
  LOG.init();
  LOG.destaque('DeFace RT ' + APP.versao + ' — pronto. O processamento é inteiro deste navegador.');
  verificarIsolamento();

  montarCardsMetodos();

  $('segMod').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    for (const x of $('segMod').children) x.setAttribute('aria-pressed', String(x === b));
    E.modalidade = b.dataset.mod;
    if (E.vol) { ajustarPreset(true); prepararSliders(); desenharTudo(); }
  };
  $('segFmt').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    for (const x of $('segFmt').children) x.setAttribute('aria-pressed', String(x === b));
    E.formato = b.dataset.fmt;
  };

  ligarAprendizado();

  $('btnPasta').onclick = () => $('fPasta').click();
  $('btnArqs').onclick = () => $('fArqs').click();
  $('drop').onclick = () => { if (!E.ocupado) $('fArqs').click(); };
  $('drop').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!E.ocupado) $('fArqs').click(); } };
  $('fPasta').onchange = (e) => { if (e.target.files.length) { $('dropTxt').innerHTML = '<b>' + e.target.files.length + '</b> arquivo(s)'; receber([...e.target.files]); } };
  $('fArqs').onchange = (e) => { if (e.target.files.length) { $('dropTxt').innerHTML = '<b>' + e.target.files.length + '</b> arquivo(s)'; receber([...e.target.files]); } };

  const dz = $('drop');
  for (const ev of ['dragenter', 'dragover']) document.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); });
  for (const ev of ['dragleave', 'drop']) document.addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'dragleave' && e.relatedTarget) return; dz.classList.remove('over'); });
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    const dt = e.dataTransfer; if (!dt) return;
    let arqs = [];
    if (dt.items && dt.items.length && dt.items[0].webkitGetAsEntry) {
      const ents = [...dt.items].map((i) => i.webkitGetAsEntry());
      arqs = await coletarDeEntradas(ents);
    } else arqs = [...dt.files];
    if (arqs.length) { $('dropTxt').innerHTML = '<b>' + arqs.length + '</b> arquivo(s)'; receber(arqs); }
  });

  $('btnDl').onclick = entregar;
  const mudarSemente = () => {
    if (E.ocupado) return;
    const tinhaResultado = !!E.atual;
    invalidarResultado('A semente mudou. Escolha um card para gerar uma nova comparação.');
    if (E.vol && tinhaResultado) { desenharMPR('R'); desenhar3D('R'); }
    atualizarControles();
  };
  $('btnSeed').onclick = () => { if (E.ocupado) return; $('seed').value = sementeAleatoria(); mudarSemente(); };
  $('seed').oninput = mudarSemente;
  $('seed').value = sementeAleatoria();

  for (const [lado, tabs] of [['L', 'tabsL'], ['R', 'tabsR']]) {
    $(tabs).onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      for (const x of $(tabs).children) x.setAttribute('aria-selected', String(x === b));
      for (const v of ['mpr', 'd3', 'hdr', 'met']) {
        const el = $(lado + v); if (el) el.classList.remove('on');
      }
      const alvo = $(lado + b.dataset.v);
      if (alvo) alvo.classList.add('on');
      if (b.dataset.v === 'd3' && E.vol) await desenhar3D(lado);
    };
  }

  const liga = (id, cb) => { const el = $(id); el.oninput = () => cb(el.value); };
  liga('sAx', (v) => { E.cortes.ax = +v; desenharMPR('L'); if (E.pixAtual) desenharMPR('R'); });
  liga('sCo', (v) => { E.cortes.co = +v; desenharMPR('L'); if (E.pixAtual) desenharMPR('R'); });
  liga('sSa', (v) => { E.cortes.sa = +v; desenharMPR('L'); if (E.pixAtual) desenharMPR('R'); });
  liga('wW', (v) => { E.jan = +v; $('vW').textContent = v; desenharMPR('L'); if (E.pixAtual) desenharMPR('R'); });
  liga('wL', (v) => { E.niv = +v; $('vL').textContent = v; desenharMPR('L'); if (E.pixAtual) desenharMPR('R'); });
  $('btnPreset').onclick = () => { if (!E.vol) return; ajustarPreset(false); desenharMPR('L'); if (E.pixAtual) desenharMPR('R'); };

  $('thr').oninput = (e) => {
    if (E.ocupado) return;
    const novoLimiar = +e.target.value;
    if (novoLimiar === E.limiar) return;
    E.limiar = novoLimiar; $('vThr').textContent = e.target.value;
    invalidarResultado('O limiar mudou. Escolha um card para recalcular o método sobre o original.');
    desenharMPR('R'); desenhar3D('R');
    msgR('O limiar mudou. Escolha um card para recalcular a superfície e o resultado.');
    marcarEtapa('etapaRevisar'); montarNotaGeometria(); atualizarControles();
  };
  $('thr').onchange = () => desenharTudo();
  $('yaw').oninput = (e) => { E.yaw = +e.target.value; $('vYaw').textContent = e.target.value + '°'; desenharTudo(true); };
  $('yaw').onchange = () => desenharTudo();
  $('pit').oninput = (e) => { E.pitch = +e.target.value; $('vPit').textContent = e.target.value + '°'; desenharTudo(true); };
  $('pit').onchange = () => desenharTudo();

  for (const cv of [$('c3L'), $('c3R')]) {
    let arr = false, x0 = 0, y0 = 0, ya0 = 0, pi0 = 0;
    cv.style.cursor = 'grab';
    cv.addEventListener('pointerdown', (e) => {
      if (!E.vol) return;
      arr = true; x0 = e.clientX; y0 = e.clientY; ya0 = E.yaw; pi0 = E.pitch;
      cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing';
    });
    cv.addEventListener('pointermove', (e) => {
      if (!arr) return;
      E.yaw = Math.max(-90, Math.min(90, ya0 + (e.clientX - x0) * 0.42));
      E.pitch = Math.max(-45, Math.min(45, pi0 - (e.clientY - y0) * 0.3));
      $('yaw').value = Math.round(E.yaw); $('vYaw').textContent = Math.round(E.yaw) + '°';
      $('pit').value = Math.round(E.pitch); $('vPit').textContent = Math.round(E.pitch) + '°';
      desenharTudo(true);
    });
    cv.addEventListener('pointerup', () => { if (!arr) return; arr = false; cv.style.cursor = 'grab'; desenharTudo(); });
  }

  $('logHead').onclick = () => {
    const b = $('logBody');
    b.classList.toggle('open');
    $('logCaret').innerHTML = b.classList.contains('open') ? '&#9652;' : '&#9662;';
  };
  $('btnSobre').onclick = abrirAjuda;
  $('btnLimites').onclick = abrirAjuda;
  $('btnFechar').onclick = fecharAjuda;
  $('modal').onclick = (e) => { if (e.target === $('modal')) fecharAjuda(); };
  document.addEventListener('keydown', (e) => {
    if (!$('modal').classList.contains('on')) return;
    if (e.key === 'Escape') fecharAjuda();
    if (e.key === 'Tab') {
      const focaveis = [...$('modal').querySelectorAll('button,summary,a[href],input,select,[tabindex]')].filter((el) => !el.disabled && el.offsetParent !== null);
      const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    }
  });
}

/* ------------------------------------------------ aprendizagem e navegação */
const LICOES = [
  { titulo: 'Olhar é o primeiro passo.', texto: 'Gire a reconstrução e compare os métodos. Uma face menos reconhecível não prova que o exame se tornou anônimo.', vista: 'd3', botao: 'Investigar cabeçalhos →' },
  { titulo: 'O nome não é o único identificador.', texto: 'Compare o cabeçalho original com o derivado. Veja o que foi removido e os quase-identificadores que permanecem. Texto gravado nos pixels exige revisão própria.', vista: 'hdr', botao: 'Medir a geometria →' },
  { titulo: 'Mudança de forma não prova anonimização.', texto: 'Leia o deslocamento e a fração de superfície preservada. Este caso real permite explorar diferenças; um exemplo isolado não valida eficácia de anonimização.', vista: 'met', botao: 'Voltar à imagem →' }
];
const METODO_AULA = {
  plano: { resumo: 'Remove a face por um plano de corte.', licao: 'observe a borda reta e a anatomia retirada em bloco.' },
  recorte: { resumo: 'Retira uma camada da região facial.', licao: 'compare a região removida com o contorno que ainda permanece.' },
  ruido: { resumo: 'Substitui a camada facial por ar com ruído.', licao: 'compare a borda irregular com o recorte sem ruído.' },
  suave: { resumo: 'Desfoca a face; o contorno pode permanecer.', licao: 'perceba por que perder nitidez não garante perder a identidade.' },
  generica: { resumo: 'Troca o contorno por uma face paramétrica.', licao: 'observe a forma substituída e os traços que continuam no volume.' }
};
function montarCardsMetodos() {
  const grupo = $('methodCards');
  for (const [i, metodo] of METODOS.entries()) {
    const botao = document.createElement('button');
    botao.type = 'button'; botao.className = 'method-card'; botao.dataset.metodo = metodo.id;
    botao.setAttribute('role', 'radio'); botao.setAttribute('aria-checked', 'false'); botao.tabIndex = i ? -1 : 0;
    botao.innerHTML = '<strong>' + esc(metodo.nome) + '</strong><span>' + esc(METODO_AULA[metodo.id].resumo) + '</span>';
    botao.onclick = () => processar(metodo.id);
    grupo.appendChild(botao);
  }
  grupo.onkeydown = e => {
    if (E.ocupado || !E.vol || !e.target.matches('button[data-metodo]')) return;
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const cards = [...grupo.querySelectorAll('button[data-metodo]')];
    const i = cards.indexOf(e.target);
    const passo = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const destino = e.key === 'Home' ? 0 : e.key === 'End' ? cards.length - 1 : (i + passo + cards.length) % cards.length;
    cards[destino].focus(); processar(cards[destino].dataset.metodo);
  };
  atualizarControles();
}
function invalidarResultado(mensagem) {
  E.resultados.clear(); E.atual = null; E.metodoEscolhido = null;
  E.pixAtual = E.vol ? E.vol.pix : null; E.tokens.R++;
  $('revisaoConfirmada').checked = false;
  $('rmprTag').textContent = 'Original — escolha um método';
  $('rd3tag').textContent = 'Original — escolha um método';
  $('tblHdrR').querySelector('tbody').innerHTML = '';
  $('metrics').innerHTML = '<p class="method-empty">Escolha um card para ver as medidas de um método.</p>';
  $('metNote').innerHTML = '';
  $('RmprEmpty').style.display = E.vol ? 'none' : 'flex';
  $('methodStatus').textContent = mensagem;
}
function marcarEtapa(id) {
  for (const nome of ['etapaImportar', 'etapaRevisar', 'etapaExportar']) {
    if (nome === id) $(nome).setAttribute('aria-current', 'step');
    else $(nome).removeAttribute('aria-current');
  }
}
function atualizarControles() {
  for (const id of ['btnExemplo', 'btnPasta', 'btnArqs', 'btnNovo', 'btnBaixarExemplo']) $(id).disabled = E.ocupado;
  $('btnDl').disabled = E.ocupado || !E.atual || !$('revisaoConfirmada').checked;
  const selecionado = E.atual || E.metodoEscolhido;
  for (const [i, card] of [...$('methodCards').querySelectorAll('button')].entries()) {
    const ativo = card.dataset.metodo === selecionado;
    card.setAttribute('aria-checked', String(ativo));
    card.setAttribute('aria-busy', String(ativo && E.ocupado));
    card.tabIndex = selecionado ? (ativo ? 0 : -1) : (i ? -1 : 0);
    card.disabled = E.ocupado || !E.vol;
  }
  $('revisaoConfirmada').disabled = E.ocupado || !E.atual;
  for (const el of document.querySelectorAll('#segMod button, #segFmt button, #seed, #btnSeed, #thr')) el.disabled = E.ocupado;
  $('drop').setAttribute('aria-disabled', String(E.ocupado));
  $('estudio').setAttribute('aria-busy', String(E.ocupado));
}
async function mostrarVista(vista) {
  for (const b of $('abasEstudio').querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.view === vista));
  for (const lado of ['L', 'R']) {
    const alvo = vista === 'met' && lado === 'L' ? 'd3' : vista;
    for (const v of ['mpr', 'd3', 'hdr', 'met']) {
      const el = $(lado + v); if (el) el.classList.toggle('on', v === alvo);
    }
    for (const b of $(lado === 'L' ? 'tabsL' : 'tabsR').children) b.setAttribute('aria-selected', String(b.dataset.v === alvo));
  }
  if (vista === 'mpr') { desenharMPR('L'); if (E.pixAtual) desenharMPR('R'); }
  if ((vista === 'd3' || vista === 'met') && E.vol) await desenhar3D('L');
  if (vista === 'd3' && E.pixAtual) await desenhar3D('R');
}
function definirLicao(n) {
  E.licao = n; const l = LICOES[n];
  $('licaoNumero').textContent = (n + 1) + ' / ' + LICOES.length;
  $('licaoTitulo').textContent = l.titulo;
  $('licaoTexto').textContent = l.texto;
  $('btnProximaLicao').textContent = l.botao;
}
let focoAntesAjuda = null;
function abrirAjuda() {
  focoAntesAjuda = document.activeElement;
  $('sheetBody').innerHTML = TEXTO_SOBRE;
  $('modal').classList.add('on'); $('btnFechar').focus();
}
function fecharAjuda() { $('modal').classList.remove('on'); if (focoAntesAjuda) focoAntesAjuda.focus(); }
async function explorarExemplo() {
  if (E.ocupado) return;
  E.ocupado = true; atualizarControles();
  $('statusInicio').classList.remove('error');
  msgR('Abrindo a TC pública neste navegador…');
  try {
    E.modalidade = 'CT';
    E.yaw = 30; E.pitch = 0;
    $('yaw').value = 30; $('vYaw').textContent = '30°';
    $('pit').value = 0; $('vPit').textContent = '0°';
    for (const b of $('segMod').children) b.setAttribute('aria-pressed', String(b.dataset.mod === E.modalidade));
    const arquivos = await carregarCasoPublico();
    E.ocupado = false;
    if (!await receber(arquivos, { exemplo: true })) return;
    $('seed').value = 'AULA-DEFACE-2026';
    definirLicao(0);
  } catch (e) {
    LOG.erro('Não foi possível preparar o exemplo: ' + e.message);
    msgR('Não foi possível preparar o exemplo. Tente novamente ou abra uma série local.');
    $('statusInicio').classList.add('error');
  } finally { E.ocupado = false; atualizarControles(); }
}
function ligarAprendizado() {
  $('btnExemplo').onclick = explorarExemplo;
  $('btnNovo').onclick = () => {
    if (E.ocupado) return;
    $('estudio').hidden = true; $('boasVindas').hidden = false;
    $('statusInicio').textContent = ''; $('statusInicio').classList.remove('error');
    $('fArqs').value = ''; $('fPasta').value = '';
    $('dropTxt').textContent = 'Arraste uma pasta ou um ZIP aqui';
    marcarEtapa('etapaImportar'); $('btnExemplo').focus();
  };
  $('abasEstudio').onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    await mostrarVista(b.dataset.view);
    definirLicao(b.dataset.view === 'hdr' ? 1 : b.dataset.view === 'met' ? 2 : 0);
  };
  $('btnCabecalhos').onclick = async () => { definirLicao(1); await mostrarVista('hdr'); };
  $('btnGeometria').onclick = async () => { definirLicao(2); await mostrarVista('met'); };
  $('btnLicao').onclick = async () => { definirLicao(0); await mostrarVista('d3'); $('btnProximaLicao').focus(); };
  $('btnProximaLicao').onclick = async () => { definirLicao((E.licao + 1) % LICOES.length); await mostrarVista(LICOES[E.licao].vista); };
  $('revisaoConfirmada').onchange = atualizarControles;
  $('btnBaixarExemplo').onclick = async () => {
    if (E.ocupado || !E.exemplo) return;
    E.ocupado = true; atualizarControles(); msgR('Preparando a TC pública com os créditos da fonte…');
    try {
      const blob = await montarZIPCasoPublico();
      baixar(blob, 'DeFace_RT_MAR_PAT8_CT_PUBLICA.zip');
      msgR('TC pública entregue com fonte e licença. Reabra o ZIP para testar a importação.');
    } catch (e) { LOG.erro(e.message); msgR('Falha ao preparar o caso original. Tente novamente.'); }
    finally { E.ocupado = false; atualizarControles(); }
  };
}

const TEXTO_SOBRE = `
<div><h5>O caso real desta aula</h5>
TC do caso Pat8 da Medical Augmented Reality Facial Data Collection, v2,
de Egger, Gsaxner e Wallner (2019), sob CC BY 4.0.
O artigo da coleção declara consentimento dos participantes para publicar os dados identificáveis e modelos faciais 3D.
Este app usa um recorte de face e pescoço, sem reamostrar ou criar pixels. O recorte não inclui a calota superior.
Os cabeçalhos DICOM são recriados para a conversão; PUBLICO^PAT8 é um rótulo didático, não o nome da pessoa. Nenhuma associação ou endosso é sugerido.
<p class="source-url">Dados: https://doi.org/10.6084/m9.figshare.8857007.v2<br>Artigo e consentimento: https://pmc.ncbi.nlm.nih.gov/articles/PMC6901520/<br>Licença: https://creativecommons.org/licenses/by/4.0/</p>
Referências: Gsaxner et al., Scientific Data 6:310, doi:10.1038/s41597-019-0327-8; MICCAI 2019, doi:10.1007/978-3-030-32254-0_27.</div>
<div><h5>O que este aplicativo faz</h5>
Carrega uma série DICOM de TC ou RM de crânio, aplica regras de limpeza de cabeçalho orientadas pelo
Perfil Básico de Confidencialidade (DICOM PS3.15, Anexo E), aplica métodos de desfiguração ao pixel
e mede quanto da geometria facial sobrou. Entrega a série derivada em DICOM ou NIfTI.</div>

<div><h5>Por que medir e não só olhar</h5>
Comparação visual é prova fraca: quem vê um borrão conclui que está anonimizado. Reconhecimento
facial trabalha com a geometria da superfície, não com a nitidez. O deslocamento medido da
superfície facial permite comparar os métodos neste exame. Nenhuma dessas medidas é um certificado
de anonimização.</div>

<div><h5>Como o recorte é definido</h5>
A fronteira do corte é uma superfície <b>suavizada</b>, não a superfície original deslocada. Uma
fronteira que acompanha o contorno real reproduz a geometria da face na própria borda do corte —
e a geometria é o dado biométrico.</div>

<div><h5>Face genérica paramétrica</h5>
Catorze parâmetros descrevem cristas e volumes de uma face sintética, e o método usa o valor médio
de cada faixa: todo paciente recebe o mesmo rosto. O método permite estudar a troca do contorno externo. Isso não demonstra preservação de desempenho
clínico, nem torna os exames indistinguíveis. A face nunca é copiada de um rosto real.
<br><br><b>Sobre a semente:</b> ela alimenta o ruído do preenchimento e a textura do enxerto. Por
padrão é sorteada e mostrada na tela, sem qualquer vínculo com o prontuário original; guardá-la
permite reproduzir a mesma saída depois. Derivá-la do prontuário criaria um vínculo criptográfico
testável por quem tivesse a lista de prontuários — por isso ela é sorteada.</div>

<div><h5>O que ele não resolve</h5>
<ul>
<li>Quase-identificadores — idade, sexo, protocolo, modelo do aparelho, espessura de corte —
sobrevivem à limpeza e identificam em coorte pequena.</li>
<li>Texto queimado nos pixels não sai por limpeza de cabeçalho.</li>
<li>Desfigurar não é irreversível: há trabalho publicado reconstruindo faces plausíveis a partir
de volumes desfigurados, e o crânio remanescente prevê boa parte dos tecidos moles.</li>
<li>O vínculo com o exame de origem continua existindo fora do arquivo.</li>
</ul></div>

<div><h5>Limites técnicos</h5>
Sintaxes JPEG 2000, JPEG-LS e JPEG sem perdas com reinício (DRI) não são decodificadas — reexporte
a série sem compressão. Pixels sem sinal acima de 32767 são recusados. DICOM deflacionado com
preenchimento adicional pode ser recusado pelo navegador. Séries coloridas e multiquadro não são tratadas.
Sequências e atributos privados são removidos por
inteiro, o que descarta parâmetros técnicos legítimos junto com os de risco.</div>

<div><h5>De onde vêm os métodos</h5>
O código deste aplicativo é próprio — leitor DICOM, decodificadores, escritor, NIfTI e ZIP foram
escritos aqui, sem biblioteca de terceiros. Os métodos são <b>demonstrações inspiradas</b> em
famílias de técnicas publicadas, sem equivalência validada com as ferramentas originais.
<ul>
<li><b>Plano de corte</b> — na linha do <i>quickshear</i>, de Schimke e Hale.</li>
<li><b>Recorte de face</b> — remoção da camada facial, na linha de Bischoff-Grethe e colaboradores.</li>
<li><b>Face genérica</b> — substituição por face em vez de remoção, na linha de Schwarz e
colaboradores.</li>
<li><b>Preenchimento com ruído</b> e <b>suavização</b> — variações difundidas, sem referência única.</li>
</ul>
A tese de que desfigurar não basta apoia-se em Schwarz e colaboradores, que identificaram
participantes de pesquisa por reconhecimento facial a partir de reconstruções de RM. A limpeza de
cabeçalho é orientada pelo Perfil Básico de Confidencialidade do DICOM PS3.15, Anexo E, sem alegação
de conformidade integral certificada; o decodificador sem
perdas segue a ITU-T T.81, Anexo H.
<br><br>Referências completas em <span class="mono">docs/08_BIBLIOGRAFIA.md</span>.</div>

<div><h5>Uso</h5>
Educacional e demonstrativo. Todo o processamento acontece neste navegador: nenhum byte é enviado
a servidor algum. Ainda assim, confira o resultado antes de qualquer divulgação.
<br><br>Radioterapia.AI — Dr. Henrique Braga</div>
`;

document.addEventListener('DOMContentLoaded', iniciar);
