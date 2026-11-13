/* =========================================================================
   Controlador da interface
   ========================================================================= */
'use strict';

const E = { semente: '', mapa: null, ocupado: false, revisao: 0, exemplo: false, retornoFoco: null };
const $ = (id) => document.getElementById(id);

/* Exemplo escrito para ensino: nenhuma pessoa, atendimento ou documento real.
   Os numeros servem para exercitar os validadores, nao identificam pacientes.
   example.invalid e reservado; o aplicativo nunca tenta contata-lo. */
const TEXTO_SINTETICO = [
  'CASO SINTÉTICO — todas as pessoas, instituições e informações abaixo são fictícias.',
  'HOSPITAL EXEMPLO DE ENSINO — exercício de pseudonimização',
  '',
  'Paciente: Maria Aparecida da Silva Santos',
  'Prontuário: 99887766',
  'CPF de teste: 529.982.247-25   CNS de teste: 700508354788954',
  'Nascimento: 22/11/1970   Telefone fictício: (11) 98765-4321',
  'E-mail: paciente@example.invalid',
  'Endereço: Rua do Exemplo, 100 — CEP 00000-000',
  '',
  'Médico assistente: Dr. Carlos Eduardo Pereira (CRM-SP 123456)',
  'Consulta didática em 03/02/2026.',
  'HISTÓRIA FICTÍCIA: avaliação para discutir radioterapia adjuvante de mama.',
  'Maria Aparecida relata estar bem. Não há conduta clínica real neste exercício.',
  'Retorno com Dr. Carlos Eduardo Pereira em 15/03/2026.',
  '',
  'DESAFIO DE REVISÃO: apelido Girassol, vila Aurora e um evento muito raro',
  'podem continuar identificando alguém, mesmo sem nome ou documento.',
  'Os números deste exemplo foram escolhidos para teste de formato e dígito verificador.'
].join('\n');

function atualizarEntrada() {
  const n = $('txtEntrada').value.length;
  $('infoEntrada').textContent = nf(n) + ' caractere' + (n === 1 ? '' : 's');
  $('btnRun').disabled = !$('txtEntrada').value.trim() || E.ocupado;
}

function etapaAtual(etapa) {
  for (const id of ['etapaPseudonimizar', 'etapaRevisar', 'etapaRestaurar']) {
    if (id === etapa) $(id).setAttribute('aria-current', 'step');
    else $(id).removeAttribute('aria-current');
  }
}

function trocarAba(aba) {
  if (aba === 'rev' && !E.mapa) return;
  for (const b of $('tabs').querySelectorAll('button[data-v]')) {
    b.setAttribute('aria-selected', String(b.dataset.v === aba));
  }
  for (const v of ['ps', 'rev']) $('V' + v).classList.toggle('on', v === aba);
  $('btnRun').hidden = aba === 'rev';
  etapaAtual(aba === 'rev' ? 'etapaRestaurar' : E.mapa ? 'etapaRevisar' : 'etapaPseudonimizar');
  $('tituloEstudio').textContent = aba === 'rev' ? 'Os nomes podem voltar.' : E.mapa ? 'Revise o resultado.' : 'Explore o texto.';
  $('dicaEstudio').textContent = aba === 'rev' ?
    'A reversão demonstra por que o resultado é pseudonimizado, não anônimo.' : E.mapa ?
    'Compare os textos e procure informações que continuam identificando alguém.' :
    'Leia o original e veja como os identificadores serão substituídos.';
}

function invalidarResultado(motivo) {
  E.revisao++;
  E.mapa = null;
  for (const id of ['txtSaida', 'txtResposta', 'txtRevertido']) $(id).value = '';
  for (const id of ['btnCopiar', 'btnCopiarRev', 'btnReverter', 'btnTestarRestauracao', 'abaRev']) $(id).disabled = true;
  for (const id of ['mTrocas', 'mEntidades', 'mSuspeitas', 'mTempo']) $(id).textContent = '—';
  $('tblTrocas').querySelector('tbody').innerHTML = '';
  $('listaSuspeitas').innerHTML = '';
  $('vazioTrocas').textContent = 'Nada processado ainda.';
  $('vazioSuspeitas').textContent = 'Nada processado ainda.';
  for (const id of ['caixaResultado', 'painelRevisao', 'acoesRevisao']) $(id).hidden = true;
  $('textosPs').classList.add('somente-entrada');
  $('rotuloResposta').textContent = 'Texto com os rótulos';
  $('infoMapa').textContent = 'O mapa vive apenas na memória desta aba. Fechar a página, editar o original ou limpar tudo apaga a correspondência.';
  $('tituloLicao').textContent = motivo ? 'Processe novamente' : 'Antes de começar';
  $('textoLicao').textContent = motivo || 'Procure nomes, documentos e datas no original. Depois, observe o que muda e o que o programa deixa passar.';
  trocarAba('ps');
}

function abrirTrabalho(exemplo) {
  if (E.ocupado) return;
  invalidarResultado();
  E.exemplo = exemplo;
  $('txtEntrada').value = exemplo ? TEXTO_SINTETICO : '';
  $('tipoEstudo').textContent = exemplo ? 'Caso sintético autoral · dados inteiramente fictícios · sem IA' : 'Texto do usuário · processamento local';
  $('boasVindas').hidden = true;
  $('estudio').hidden = false;
  atualizarEntrada();
  $('txtEntrada').focus();
  $('txtEntrada').setSelectionRange(0, 0);
  $('txtEntrada').scrollTop = 0;
  LOG.info(exemplo ? 'Exemplo sintético carregado. Nenhum dado de paciente foi utilizado.' : 'Área de texto pronta. Nada é enviado.');
}

function bloquearDuranteProcessamento(bloquear) {
  $('txtEntrada').readOnly = bloquear;
  for (const id of ['btnSeed', 'seed', 'optDatas', 'optAgressivo', 'btnLimpar', 'btnNovo']) $(id).disabled = bloquear;
  $('btnRun').textContent = bloquear ? 'Processando…' : 'Pseudonimizar texto';
  $('estudio').setAttribute('aria-busy', String(bloquear));
  atualizarEntrada();
}

const RISCO_CLS = { C: 'c', A: 'a', M: 'm' };
const RISCO_NOME = { C: 'crítico', A: 'alto', M: 'médio' };

function prog(t) { $('prog').style.width = Math.round(Math.max(0, Math.min(1, t)) * 100) + '%'; }

/* ---------------------------------------------------------- processamento */
async function processar() {
  if (E.ocupado) return;
  const texto = $('txtEntrada').value;
  if (!texto.trim()) return;
  invalidarResultado();
  const revisao = E.revisao;
  E.ocupado = true;
  bloquearDuranteProcessamento(true);
  try {
    E.semente = ($('seed').value || '').trim() || sementeAleatoria();
    $('seed').value = E.semente;
    LOG.info('Processando ' + nf(texto.length) + ' caracteres…');

    const r = await pseudonimizar(texto, {
      semente: E.semente,
      datas: $('optDatas').checked,
      agressivo: $('optAgressivo').checked
    }, prog);

    if (revisao !== E.revisao || texto !== $('txtEntrada').value) return;
    E.mapa = r.mapa;
    $('txtSaida').value = r.saida;
    $('btnCopiar').disabled = false;
    $('btnTestarRestauracao').disabled = false;
    $('abaRev').disabled = false;
    for (const id of ['caixaResultado', 'painelRevisao', 'acoesRevisao']) $(id).hidden = false;
    $('textosPs').classList.remove('somente-entrada');
    mostrarMetricas(r.metricas);
    mostrarTrocas(r.metricas.categorias);
    mostrarSuspeitas(r.restos);
    trocarAba('ps');
    $('tituloLicao').textContent = 'Um texto sem nome ainda pode identificar.';
    $('textoLicao').textContent = 'Leia o resultado inteiro: contexto, apelidos, lugares e eventos raros podem escapar. As contagens não medem anonimização. Depois, teste a restauração para ver o papel do mapa local.';

    LOG.ok(nf(r.metricas.trocas) + ' substituição(ões) em ' + nf(r.metricas.entidades) +
      ' entidade(s) distinta(s), em ' + nf(r.metricas.ms) + ' ms.');
    if (r.restos.length) {
      LOG.aviso(nf(r.restos.length) + ' trecho(s) ficaram de fora e precisam da sua revisão.');
    } else {
      LOG.info('Nada sobrou na varredura de revisão — o que não significa que nada escapou.');
    }
  } catch (e) {
    LOG.aviso('Falhou: ' + traduzirErro(e));
    $('tituloLicao').textContent = 'Não foi possível processar';
    $('textoLicao').textContent = traduzirErro(e) + ' Revise o texto e tente novamente.';
  } finally {
    E.ocupado = false;
    bloquearDuranteProcessamento(false);
    prog(0);
  }
}

function traduzirErro(e) {
  const m = String((e && e.message) || e);
  if (/Invalid regular expression/i.test(m)) return 'padrão de busca inválido neste navegador.';
  if (/out of memory|Array buffer allocation/i.test(m)) return 'texto grande demais para a memória disponível.';
  return m;
}

function mostrarMetricas(m) {
  $('mTrocas').textContent = nf(m.trocas);
  $('mEntidades').textContent = nf(m.entidades);
  $('mSuspeitas').textContent = nf(m.suspeitas);
  $('mTempo').textContent = nf(m.ms) + ' ms';
}

function mostrarTrocas(cats) {
  const tb = $('tblTrocas').querySelector('tbody');
  tb.innerHTML = '';
  for (const c of cats) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td class="tag">' + escapar(c.cat) + '</td>' +
      '<td><span class="pill ' + (RISCO_CLS[c.risco] || 'm') + '">' +
      (RISCO_NOME[c.risco] || 'médio') + '</span></td>' +
      '<td class="num">' + nf(c.entidades) + '</td>' +
      '<td class="num">' + nf(c.trocas) + '</td>';
    tb.appendChild(tr);
  }
  $('vazioTrocas').style.display = cats.length ? 'none' : 'block';
  $('tblTrocas').style.display = cats.length ? 'table' : 'none';
  if (!cats.length) $('vazioTrocas').textContent = 'Nenhuma entidade reconhecida neste texto.';
}

function mostrarSuspeitas(restos) {
  const cx = $('listaSuspeitas');
  cx.innerHTML = '';
  for (const s of restos) {
    const el = document.createElement('span');
    el.className = 'suspeita';
    el.textContent = s.texto;
    el.title = s.motivo;
    cx.appendChild(el);
  }
  $('vazioSuspeitas').style.display = restos.length ? 'none' : 'block';
  if (!restos.length) {
    $('vazioSuspeitas').textContent =
      'A varredura não achou resto suspeito. Isso não prova que não há: leia o texto.';
  }
}

/* -------------------------------------------------------------- reversão */
function fazerReversao() {
  const texto = $('txtResposta').value;
  if (!texto.trim() || !E.mapa) return;
  const r = reverter(texto, E.mapa);
  $('txtRevertido').value = r.saida;
  $('btnCopiarRev').disabled = false;
  let msg = nf(r.revertidos) + ' rótulo(s) restaurado(s).';
  if (r.naoReconhecidos.length) {
    msg += ' ' + r.naoReconhecidos.length + ' rótulo(s) não constam do mapa desta sessão: ' +
      r.naoReconhecidos.slice(0, 6).join(', ') + '.';
    LOG.aviso(msg);
  } else {
    LOG.ok(msg);
  }
  $('infoMapa').textContent = msg + ' O mapa vive apenas na memória desta aba.';
}

function testarRestauracao() {
  if (!E.mapa || !$('txtSaida').value) return;
  $('txtResposta').value = $('txtSaida').value;
  $('txtRevertido').value = '';
  $('btnCopiarRev').disabled = true;
  $('btnReverter').disabled = false;
  $('rotuloResposta').textContent = 'Resposta simulada — sem IA';
  $('infoMapa').textContent = 'Este é o próprio texto pseudonimizado, usado como resposta simulada. Clique em Restaurar nomes para aplicar o mapa. Nenhuma IA foi consultada.';
  trocarAba('rev');
  $('btnReverter').focus();
  LOG.info('Teste local de restauração preparado, sem consulta a IA.');
}

async function copiar(idOrigem, botao) {
  const t = $(idOrigem);
  try {
    await navigator.clipboard.writeText(t.value);
  } catch (e) {
    t.removeAttribute('readonly'); t.select(); document.execCommand('copy');
    t.setAttribute('readonly', '');
  }
  const antes = botao.textContent;
  botao.textContent = 'Copiado';
  setTimeout(() => { botao.textContent = antes; }, 1400);
}

/* ------------------------------------------------------------- isolamento */
async function verificarIsolamento() {
  const b = $('badgeRede');
  let barrado = false;
  const ouvinte = (ev) => {
    if (String(ev.violatedDirective || '').indexOf('connect-src') === 0) barrado = true;
  };
  document.addEventListener('securitypolicyviolation', ouvinte);
  try {
    await fetch('https://isolamento.invalid/deface-rt-data', { mode: 'no-cors', cache: 'no-store' });
  } catch (e) { /* esperado nos dois cenários */ }
  await new Promise((r) => setTimeout(r, 60));
  document.removeEventListener('securitypolicyviolation', ouvinte);

  if (barrado) {
    b.innerHTML = '<b>&#9679;</b>&nbsp; Processamento local · isolamento confirmado';
    b.style.borderColor = 'rgba(79,209,165,.4)';
    b.title = 'A política de segurança de conteúdo deste arquivo bloqueia fetch, XMLHttpRequest, ' +
      'WebSocket, EventSource e sendBeacon. O texto colado aqui não pode sair, ' +
      'independentemente de onde o arquivo esteja hospedado.';
    LOG.ok('Isolamento de rede confirmado: a CSP barrou a tentativa de conexão.');
  } else {
    b.innerHTML = '<b style="color:var(--alto)">&#9679;</b>&nbsp; CSP inativa — isolamento não verificado';
    b.style.borderColor = 'rgba(255,162,58,.45)';
    b.title = 'A política de segurança não foi aplicada. O código continua sem qualquer chamada ' +
      'de rede, mas a garantia passa a depender de auditoria do código, e não do navegador. ' +
      'Verifique se o servidor ou um proxy removeu a tag meta http-equiv de política de ' +
      'segurança de conteúdo do cabeçalho do arquivo.';
    LOG.aviso('A CSP não foi aplicada. O isolamento depende do código, não do navegador.');
  }
}

/* ------------------------------------------------------------------ ligar */
function iniciar() {
  LOG.destaque('DeFace RT Data ' + APP.versao + ' — pronto. O processamento é inteiro deste navegador.');
  verificarIsolamento();

  $('seed').value = sementeAleatoria();
  $('btnSeed').onclick = () => {
    $('seed').value = sementeAleatoria();
    invalidarResultado('A semente mudou. O resultado e o mapa anteriores foram apagados.');
  };
  for (const id of ['seed', 'optDatas', 'optAgressivo']) $(id).addEventListener(id === 'seed' ? 'input' : 'change', () => {
    invalidarResultado('Os ajustes mudaram. Processe o texto novamente para gerar uma correspondência atualizada.');
  });

  const ent = $('txtEntrada');
  ent.addEventListener('input', () => {
    E.exemplo = false;
    $('tipoEstudo').textContent = 'Texto editado pelo usuário · processamento local';
    invalidarResultado('O original foi editado. O resultado e o mapa anteriores foram apagados; processe novamente.');
    atualizarEntrada();
  });
  atualizarEntrada();

  $('btnExemplo').onclick = () => abrirTrabalho(true);
  $('btnMeuTexto').onclick = () => abrirTrabalho(false);
  $('btnRun').onclick = processar;
  $('btnCopiar').onclick = (e) => copiar('txtSaida', e.target);
  $('btnCopiarRev').onclick = (e) => copiar('txtRevertido', e.target);
  $('btnReverter').onclick = fazerReversao;
  $('btnTestarRestauracao').onclick = testarRestauracao;
  $('txtResposta').addEventListener('input', () => {
    $('txtRevertido').value = '';
    $('btnCopiarRev').disabled = true;
    $('btnReverter').disabled = !E.mapa || !$('txtResposta').value.trim();
    $('rotuloResposta').textContent = 'Texto com os rótulos';
  });

  $('btnLimpar').onclick = () => {
    if (E.ocupado) return;
    ent.value = '';
    E.exemplo = false;
    invalidarResultado();
    $('tipoEstudo').textContent = 'Texto do usuário · processamento local';
    atualizarEntrada();
    ent.focus();
    LOG.info('Tudo limpo, inclusive o mapa de rótulos.');
  };
  $('btnNovo').onclick = () => {
    if (E.ocupado) return;
    $('btnLimpar').onclick();
    $('estudio').hidden = true;
    $('boasVindas').hidden = false;
    $('btnExemplo').focus();
  };

  $('tabs').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.disabled) return;
    trocarAba(b.dataset.v);
  };

  $('logHead').onclick = () => {
    const on = $('logBody').classList.toggle('on');
    $('logCaret').innerHTML = on ? '&#9652;' : '&#9662;';
    $('logHead').setAttribute('aria-expanded', String(on));
  };
  $('logHead').onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('logHead').onclick(); }
  };

  $('sobreBox').innerHTML = SOBRE;
  const abrirSobre = (e) => { E.retornoFoco = e.currentTarget; $('sobreFundo').classList.add('on'); $('btnFecharSobre').focus(); };
  const fecharSobre = () => { $('sobreFundo').classList.remove('on'); if (E.retornoFoco) E.retornoFoco.focus(); };
  $('btnSobre').onclick = abrirSobre;
  $('btnLimites').onclick = abrirSobre;
  $('btnFecharSobre').onclick = fecharSobre;
  $('sobreFundo').onclick = (e) => { if (e.target === $('sobreFundo')) fecharSobre(); };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('sobreFundo').classList.contains('on')) fecharSobre();
    if (e.key === 'Tab' && $('sobreFundo').classList.contains('on')) { e.preventDefault(); $('btnFecharSobre').focus(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !$('estudio').hidden && !$('sobreFundo').classList.contains('on')) {
      e.preventDefault();
      if ($('Vrev').classList.contains('on')) fazerReversao();
      else processar();
    }
  });
}

const SOBRE = `
<h4>DeFace RT Data</h4>
<div>Pseudonimização de texto clínico, para reduzir a exposição de dados antes de levar um caso
a uma inteligência artificial de terceiro. Versão ${APP.versao} — ${APP.org}.</div>

<h5>Aprender com o exemplo</h5>
<div>O texto sintético é autoral e foi escrito somente para este exercício. Pessoas,
instituições, documentos e informações clínicas são fictícios. Os números servem para testar
formatos e dígitos verificadores. O domínio example.invalid é reservado para exemplos.
A função Testar restauração reutiliza o próprio resultado como resposta simulada: não chama
IA nem envia texto. Uso educacional; não validado para uso clínico.</div>

<h5>O que ele faz</h5>
<div>Reconhece identificadores no texto e troca cada um por um rótulo com token curto —
<span class="mono">[PESSOA-K7Q]</span>, <span class="mono">[CPF-B2M]</span>. A mesma pessoa recebe
o mesmo rótulo no documento inteiro, então o texto continua legível e a IA consegue raciocinar
sobre o caso. O token deriva da semente da sessão: dois documentos processados em sessões
diferentes não compartilham rótulo, o que impede cruzar coortes pelo próprio token.</div>

<h5>O que ele não faz, e isto importa</h5>
<div><b>Não anonimiza.</b> Pseudonimizar é trocar o identificador por um rótulo reversível — e a
reversão está aqui, na segunda aba. Enquanto o prontuário de origem existir, a ligação existe.
<ul>
<li>Nenhuma regra automática reconhece todo nome próprio em português. Apelido, nome de bairro,
sobrenome raro e sigla interna escapam.</li>
<li>O contexto clínico permanece: doença rara mais idade mais cidade pequena identificam sem
precisar de nome nenhum.</li>
<li>A lista da direita mostra o que o programa <b>não teve certeza</b>. Ela não é garantia de
cobertura — é o oposto: é a confissão do que ficou aberto.</li>
</ul>
<b>Leia o texto antes de enviar.</b> A responsabilidade de publicar é de quem publica.</div>

<h5>Como os identificadores são reconhecidos</h5>
<div>Duas famílias, com confiança bem diferente:
<ul>
<li><b>Estruturados</b> — CPF, CNS e CNPJ são conferidos pelo dígito verificador; telefone, e-mail,
CEP, registro profissional e datas têm forma fixa. Erro aqui é raro.</li>
<li><b>Por contexto</b> — nome de pessoa, instituição e endereço. Sem forma fixa, a detecção é
heurística e erra nos dois sentidos: deixa passar e também troca o que não devia.</li>
</ul></div>

<h5>Nada sai deste navegador</h5>
<div>Mesma regra do DeFace RT DICOM: Classe 0. A política de segurança de conteúdo viaja dentro do
arquivo e é o navegador quem a aplica, bloqueando fetch, XMLHttpRequest, WebSocket, EventSource e
sendBeacon. O distintivo verde do cabeçalho é o resultado de um teste que o próprio app faz ao
abrir. O mapa de rótulos fica só na memória desta aba e some quando você fecha a página.
<br><br>Radioterapia.AI — Dr. Henrique Braga</div>
`;

document.addEventListener('DOMContentLoaded', iniciar);
