/* =========================================================================
   Motor de pseudonimização de texto

   Ordem de trabalho:
     1. varre os padrões estruturados, que são confiáveis;
     2. varre os heurísticos, que não são;
     3. resolve sobreposição — quem começa antes vence, empate para o mais longo;
     4. substitui, mantendo um rótulo por entidade;
     5. varre o que SOBROU e devolve como suspeita, para revisão humana.

   O passo 5 é o que diferencia isto de um "limpador": o app não afirma que
   terminou. Ele mostra o que não teve certeza.
   ========================================================================= */
'use strict';

const LETRA_MAI = 'A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ';
const LETRA_MIN = 'a-zàáâãéêíóôõúüç';

function ehCapitalizada(p) {
  return new RegExp('^[' + LETRA_MAI + '][' + LETRA_MIN + ']{1,}$').test(p);
}
function ehSiglaOuMaiuscula(p) {
  return new RegExp('^[' + LETRA_MAI + ']{2,}$').test(p);
}

/* ---- 1. estruturados ----------------------------------------------------- */
function acharEstruturados(texto, opc) {
  const achados = [];
  for (const p of PADROES) {
    if (p.opcional === 'datas' && !opc.datas) continue;
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(texto)) !== null) {
      const alvo = p.grupo ? m[p.grupo] : m[0];
      if (!alvo) continue;
      const desloc = p.grupo ? m[0].indexOf(alvo) : 0;
      if (p.valida && !p.valida(alvo)) continue;
      achados.push({
        ini: m.index + desloc, fim: m.index + desloc + alvo.length,
        cat: p.cat, nome: p.nome, risco: p.risco, texto: alvo, como: 'padrão'
      });
      if (m.index === p.re.lastIndex) p.re.lastIndex++;
    }
  }
  return achados;
}

/* ---- 2. nomes de pessoa, instituição e lugar ---------------------------- */

/* "Dr. Carlos Pereira" e "Carlos Pereira" são a mesma pessoa. Sem tirar o
   tratamento, cada forma vira uma entidade e o texto sai com dois rótulos
   para o mesmo médico — o que confunde a IA e infla a contagem. */
const RE_TRATAMENTO_INICIAL = new RegExp(
  '^(?:' + TRATAMENTOS.join('|') + ')\\.?\\s+', 'i');

function semTratamento(txt) {
  const m = txt.match(RE_TRATAMENTO_INICIAL);
  return { texto: txt.slice(m ? m[0].length : 0), desloc: m ? m[0].length : 0 };
}

/* O gatilho ("Paciente:", "Dr.", "Hospital") é procurado sem distinguir caixa,
   porque prontuário vem em CAIXA ALTA tanto quanto em minúscula. O NOME depois
   dele, não: é a inicial maiúscula que separa "Pereira" de "em". Misturar as
   duas coisas num único padrão com a flag /i foi o que fez "Carlos Eduardo
   Pereira em" virar nome de gente. */
/* Um espaço, no máximo dois, e NUNCA quebra de linha: em prontuário os campos
   vêm em colunas separadas por espaços e por linha. Com \s solto, "Maria da
   Silva   Prontuário" vira um nome só, e a palavra seguinte desaparece do
   texto junto com o identificador — inclusive termo clínico. */
const RE_NOME = new RegExp(
  '[' + LETRA_MAI + '][' + LETRA_MIN + ']+' +
  '(?:[ \\t](?:de|da|do|dos|das|e)[ \\t][' + LETRA_MAI + '][' + LETRA_MIN + ']+' +
  '|[ \\t][' + LETRA_MAI + '][' + LETRA_MIN + ']+){0,5}', 'y');

/* O prontuário real escreve o nome do paciente em CAIXA ALTA e o do médico em
   minúscula depois do "Dr". Nenhum dos dois casa o padrão acima. Este aceita as
   três grafias — e por isso só pode ser usado ONDE HÁ GATILHO explícito: solto
   no texto, ele engoliria "MARGENS DE RESSECÇÃO" e "PET PSMA". */
const P_QUALQUER = '[' + LETRA_MAI + LETRA_MIN + '][' + LETRA_MAI + LETRA_MIN + '\'-]+';
const RE_NOME_LIVRE = new RegExp(
  P_QUALQUER +
  '(?:[ \\t](?:de|da|do|dos|das|e|DE|DA|DO|DOS|DAS|E)[ \\t]' + P_QUALQUER +
  '|[ \\t]' + P_QUALQUER + '){0,6}', 'y');

/* Palavra funcional: nunca faz parte de nome próprio, e é o que sobra colado
   quando o padrão aceita minúscula — "Carlos Pereira em 15/03" virava nome. */
const FUNCIONAIS = new Set(('em,no,na,nos,nas,ao,aos,à,as,com,sem,por,para,pra,pelo,pela,'
  + 'pelos,pelas,que,quando,onde,hoje,ontem,amanha,apos,antes,desde,ate,entre,sobre,sob,'
  + 'segundo,conforme,foi,vai,esta,estao,tem,teve,sera,seria,mais,menos,muito,pouco,'
  + 'ja,ainda,tambem,apenas,so,nao,sim,seu,sua,seus,suas,meu,minha,este,esta,esse,essa,'
  + 'aquele,aquela,isto,isso,aquilo,um,uma,uns,umas,o,a,os,as,ele,ela,eles,elas').split(','));

/* Verbos e formas que abrem oração em prontuário. Sem eles, "sr algredo se
   iniciou com quadro de elevação" vira um nome de sete palavras — e a frase
   clínica desaparece do texto junto com o identificador. */
const VERBOS = new Set(('identificou,iniciou,refere,relata,apresenta,apresentou,retorna,retorno,'
  + 'retrona,segue,seguiu,mantem,mantém,nega,realizou,realiza,compareceu,evoluiu,evolui,'
  + 'procurou,queixa,queixou,encaminhou,encaminha,solicita,solicito,solicitou,indica,indico,'
  + 'proponho,propõe,oriento,orienta,discuto,discute,converso,conversa,peço,pede,'
  + 'submetido,submetida,tratado,tratada,operado,operada,internado,internada,'
  + 'veio,vem,esteve,estava,ficou,teve,fez,foi,sendo,tendo,vindo,'
  + 'atualmente,previamente,posteriormente,inicialmente,provavelmente').split(','));

/* Truncar do INÍCIO para o fim: o nome termina no primeiro componente que não
   pareça nome próprio. Podar só pelo fim deixava passar a frase inteira quando
   a última palavra não estivesse em nenhuma lista. */
function podarNome(txt, ehLocal) {
  const p = txt.split(/[ \t]+/);
  /* nome de lugar pode coincidir com vocabulário clínico: "Campo Grande" tem
     "campo", que em radioterapia é campo de tratamento. Para LOCAL valem só as
     palavras funcionais e os verbos. */
  const fora = (w) => {
    const k = chaveDe(w);
    if (FUNCIONAIS.has(k) || VERBOS.has(k) || /^\d/.test(k)) return true;
    if (ehLocal) return false;
    return NAO_E_NOME.has(k) || ROTULOS_PESSOA.includes(k);
  };
  const saida = [];
  for (const w of p) {
    if (fora(w)) break;
    saida.push(w);
    if (saida.filter((x) => !CONECTIVOS.has(chaveDe(x))).length >= 5) break;
  }
  while (saida.length && CONECTIVOS.has(chaveDe(saida[saida.length - 1]))) saida.pop();
  return saida.join(' ');
}

function nomeApos(texto, pos, livre, ehLocal) {
  /* o parêntese entra aqui porque o prontuário escreve "com oncologista
     (bruno Wance)" e "2 filhas (Gisele e Daniele)" */
  while (pos < texto.length && /[ \t.:,()=-]/.test(texto[pos])) pos++;
  const salto = semTratamento(texto.slice(pos, pos + 12));
  pos += salto.desloc;
  while (pos < texto.length && /[ \t.]/.test(texto[pos])) pos++;
  const re = livre ? RE_NOME_LIVRE : RE_NOME;
  re.lastIndex = pos;
  const m = re.exec(texto);
  if (!m || !m[0]) return null;
  const podado = podarNome(m[0], ehLocal);
  if (!podado) return null;
  return { texto: podado, ini: pos, fim: pos + podado.length };
}

/* Linha de identificação: a evolução abre com o nome do paciente sozinho na
   linha, com a idade colada ou na linha seguinte. É o gatilho mais confiável
   que existe em prontuário, e o único que pega nome em CAIXA ALTA sem rótulo. */
function acharLinhaDeIdentificacao(texto) {
  const achados = [];
  const linhas = texto.split('\n');
  let pos = 0;
  const soNome = new RegExp('^[ \\t]*(' + P_QUALQUER +
    '(?:[ \\t](?:de|da|do|dos|das|e|DE|DA|DO|DOS|DAS|E)[ \\t]' + P_QUALQUER +
    '|[ \\t]' + P_QUALQUER + '){1,6})' +
    '[ \\t]*,?[ \\t]*(?:(\\d{1,3})[ \\t]*anos?)?[ \\t]*$');

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const m = linha.match(soNome);
    if (m) {
      const nome = podarNome(m[1]);
      const partes = nome.split(/[ \t]+/).filter((p) => !CONECTIVOS.has(chaveDe(p)));
      /* "63 ANOS", "64 naos", "82 anos" — caixa e erro de digitação incluídos.
         E quando a idade não vem, a linha seguinte costuma trazer outro campo
         de identificação: acompanhante, moradia, quem encaminhou, convênio. */
      const idadeAqui = !!m[2];
      const abaixo = linhas[i + 1] || '';
      const idadeAbaixo = /^[ \t]*\d{1,3}[ \t]*(anos?|naos|ans)\b/i.test(abaixo);
      const campoAbaixo = /^[ \t]*(acomp|mora|reside|encaminhad|convênio|convenio|natural|procedente)/i
        .test(abaixo);
      const clinico = partes.some((p) => NAO_E_NOME.has(chaveDe(p)));
      if (nome && partes.length >= 2 && !clinico && (idadeAqui || idadeAbaixo || campoAbaixo)) {
        const ini = pos + linha.indexOf(m[1]);
        achados.push({
          ini, fim: ini + nome.length, cat: 'PESSOA', nome: 'nome de pessoa', risco: 'C',
          texto: nome, como: 'linha de identificação'
        });
      }
    }
    pos += linha.length + 1;
  }
  return achados;
}

function acharPorContexto(texto, opc) {
  const achados = [];
  let m;

  /* 2a. depois de um rótulo explícito: "Paciente: Fulano de Tal" */
  const rot = new RegExp(
    '\\b(' + ROTULOS_PESSOA.join('|').replace(/\./g, '\\.') + ')\\s*:', 'gi');
  while ((m = rot.exec(texto)) !== null) {
    const n = nomeApos(texto, m.index + m[0].length);
    if (!n) continue;
    achados.push({
      ini: n.ini, fim: n.fim, cat: 'PESSOA', nome: 'nome de pessoa', risco: 'C',
      texto: n.texto, como: 'rótulo "' + m[1] + '"'
    });
  }

  /* 2b. depois de tratamento: "Dr. Carlos Pereira", "dr filipe", "Dra GISELE".
     Aqui o nome vem em qualquer grafia — depois de "Dr" o que segue é nome. */
  const tr = new RegExp('\\b(' + TRATAMENTOS.join('|') + ')\\.?(?=[\\s.])', 'gi');
  while ((m = tr.exec(texto)) !== null) {
    const n = nomeApos(texto, m.index + m[0].length, true);
    if (!n) continue;
    achados.push({
      ini: n.ini, fim: n.fim, cat: 'PESSOA', nome: 'nome de pessoa', risco: 'C',
      texto: n.texto, como: 'tratamento "' + m[1] + '"'
    });
  }

  /* 2c. instituição: gatilho seguido de nome, em qualquer grafia */
  const inst = new RegExp('\\b(' + GATILHOS_INSTITUICAO.join('|') + ')', 'gi');
  while ((m = inst.exec(texto)) !== null) {
    const n = nomeApos(texto, m.index + m[0].length, true);
    if (!n) continue;
    achados.push({
      ini: m.index, fim: n.fim, cat: 'INSTITUICAO', nome: 'instituição', risco: 'A',
      texto: texto.slice(m.index, n.fim), como: 'gatilho "' + m[1] + '"'
    });
  }

  /* 2e. gatilhos de texto corrido — o formato real da evolução */
  for (const [expr, cat] of GATILHOS_TEXTO) {
    const g = new RegExp('\\b(' + expr + ')', 'gi');
    while ((m = g.exec(texto)) !== null) {
      const n = nomeApos(texto, m.index + m[0].length, true);
      if (!n) continue;
      const partes = n.texto.split(/[ \t]+/).filter((p) => !CONECTIVOS.has(chaveDe(p)));
      if (partes.every((p) => NAO_E_NOME.has(chaveDe(p)))) continue;
      achados.push({
        ini: n.ini, fim: n.fim, cat,
        nome: cat === 'LOCAL' ? 'local de moradia'
            : cat === 'INSTITUICAO' ? 'instituição' : 'nome de pessoa',
        risco: cat === 'PESSOA' ? 'C' : 'A',
        texto: n.texto, como: 'contexto "' + m[1].trim().toLowerCase() + '"'
      });
    }
  }

  /* 2g. sem gatilho nenhum: sequência de nome cujo primeiro componente é
     prenome conhecido ou cujo qualquer componente é sobrenome conhecido.
     Exige dois componentes — "CAMPOS" sozinho é campo de tratamento, "Campos
     Marinho" é gente. É o caminho que pega o nome escrito solto no meio da
     linha, sem "Dr." nem "Paciente:" na frente. */
  const seq = new RegExp(
    '(?:^|[^' + LETRA_MAI + LETRA_MIN + '])(' + P_QUALQUER +
    '(?:[ \\t](?:de|da|do|dos|das|e|DE|DA|DO|DOS|DAS|E)[ \\t]' + P_QUALQUER +
    '|[ \\t]' + P_QUALQUER + '){1,5})', 'g');
  while ((m = seq.exec(texto)) !== null) {
    const bruto = m[1];
    /* só sequências que começam com maiúscula: em prontuário o nome sempre tem */
    if (!new RegExp('^[' + LETRA_MAI + ']').test(bruto)) continue;
    const nome = podarNome(bruto);
    if (!nome) continue;
    const partes = nome.split(/[ \t]+/).filter((p) => !CONECTIVOS.has(chaveDe(p)));
    if (partes.length < 2) continue;
    const temSobrenome = partes.some((p) => SOBRENOMES.has(chaveDe(p)));
    const comecaPrenome = PRENOMES.has(chaveDe(partes[0]));
    if (!temSobrenome && !comecaPrenome) continue;
    const ini = m.index + m[0].length - m[1].length;
    achados.push({
      ini, fim: ini + nome.length, cat: 'PESSOA', nome: 'nome de pessoa', risco: 'C',
      texto: nome, como: temSobrenome ? 'sobrenome conhecido' : 'prenome conhecido'
    });
    seq.lastIndex = ini + nome.length;
  }

  /* 2h. lugar conhecido, sem gatilho: "Mora na Tijuca" já é pego pelo contexto,
     mas "procedente de Iraja" no meio de uma frase, não. */
  for (const [lista, cat, nome, risco] of
       [[LUGARES, 'LOCAL', 'local', 'A'], [SAUDE, 'INSTITUICAO', 'instituição de saúde', 'A']]) {
    const alternativas = [...lista].sort((a, b) => b.length - a.length)
      .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'));
    const re = new RegExp('(?:^|[^' + LETRA_MAI + LETRA_MIN + '])(' +
      alternativas.join('|') + ')(?![' + LETRA_MAI + LETRA_MIN + '])', 'gi');
    let k;
    while ((k = re.exec(texto)) !== null) {
      const ini = k.index + k[0].length - k[1].length;
      /* exige inicial maiúscula: "santa cruz" no meio de frase minúscula é
         quase sempre outra coisa, e o gatilho de moradia já cobre esse caso */
      if (!new RegExp('^[' + LETRA_MAI + ']').test(k[1])) continue;
      achados.push({
        ini, fim: ini + k[1].length, cat, nome, risco,
        texto: k[1], como: 'nome conhecido'
      });
    }
  }

  /* 2f. operadora de saúde: aparece solta no cabeçalho, sem rótulo nenhum */
  /* a mesma operadora aparece como MEDSENIOR e MEDSÊNIOR: cada vogal do padrão
     aceita as suas acentuadas, senão a grafia com acento passa direto */
  const comAcento = (s) => s
    .replace(/a/g, '[aáàâã]').replace(/e/g, '[eéêè]').replace(/i/g, '[ií]')
    .replace(/o/g, '[oóôõ]').replace(/u/g, '[uúü]').replace(/c/g, '[cç]')
    .replace(/ /g, '\\s+');
  const conv = new RegExp('(?:^|[\\s:(])(' + CONVENIOS.map(comAcento).join('|') + ')(?=[\\s.,;:)]|$)', 'gi');
  while ((m = conv.exec(texto)) !== null) {
    const ini = m.index + m[0].length - m[1].length;
    achados.push({
      ini, fim: ini + m[1].length, cat: 'CONVENIO', nome: 'operadora de saúde',
      risco: 'A', texto: m[1], como: 'operadora conhecida'
    });
  }

  /* 2d. sequências capitalizadas soltas, o caso difícil */
  const palavra = new RegExp('[' + LETRA_MAI + LETRA_MIN + '][' + LETRA_MAI + LETRA_MIN + ']*', 'g');
  const toks = [];
  while ((m = palavra.exec(texto)) !== null) toks.push({ t: m[0], ini: m.index, fim: m.index + m[0].length });

  for (let i = 0; i < toks.length; i++) {
    if (!ehCapitalizada(toks[i].t)) continue;
    if (NAO_E_NOME.has(chaveDe(toks[i].t))) continue;

    /* junta o que vier: capitalizada, ou conectivo seguido de capitalizada */
    const grupo = [toks[i]];
    let j = i + 1;
    while (j < toks.length) {
      const t = toks[j];
      const colado = t.ini - grupo[grupo.length - 1].fim <= 1;
      if (!colado) break;
      if (CONECTIVOS.has(chaveDe(t.t))) {
        const prox = toks[j + 1];
        if (prox && ehCapitalizada(prox.t) && !NAO_E_NOME.has(chaveDe(prox.t))) {
          grupo.push(t, prox); j += 2; continue;
        }
        break;
      }
      if (ehCapitalizada(t.t) && !NAO_E_NOME.has(chaveDe(t.t))) { grupo.push(t); j++; continue; }
      break;
    }

    const partes = grupo.filter((g) => !CONECTIVOS.has(chaveDe(g.t)));
    const temPrenome = partes.some((g) => PRENOMES.has(chaveDe(g.t)));
    const bastante = partes.length >= 2;

    /* uma palavra capitalizada sozinha só conta se for prenome conhecido;
       do contrário viraria falso positivo em toda frase que começa com nome
       comum. O que não entra aqui reaparece como suspeita, na revisão. */
    const aceita = temPrenome || (bastante && opc.agressivo);
    if (aceita && partes.length >= (temPrenome ? 1 : 2)) {
      achados.push({
        ini: grupo[0].ini, fim: grupo[grupo.length - 1].fim, cat: 'PESSOA',
        nome: 'nome de pessoa', risco: 'C',
        texto: texto.slice(grupo[0].ini, grupo[grupo.length - 1].fim),
        como: temPrenome ? 'prenome reconhecido' : 'sequência capitalizada'
      });
      i = j - 1;
    }
  }
  return achados;
}

/* ---- 3. sobreposição ----------------------------------------------------- */
function resolver(achados) {
  achados.sort((a, b) => a.ini - b.ini || (b.fim - b.ini) - (a.fim - a.ini));
  const saida = [];
  let ultimoFim = -1;
  for (const a of achados) {
    if (a.ini < ultimoFim) continue;      /* já coberto por um anterior */
    saida.push(a);
    ultimoFim = a.fim;
  }
  return saida;
}

/* ---- 5. o que sobrou: suspeitas para revisão humana --------------------- */
function acharRestos(saida, faixasRotulos = []) {
  const suspeitas = [];
  const visto = new Set();
  /* Só os intervalos inseridos pelo próprio processamento ficam fora da
     revisão. Colchetes digitados no original não são uma forma de esconder
     texto, mesmo se forem idênticos a um rótulo emitido nesta sessão. */
  const pertenceAoRotulo = (ini, fim) => {
    let esquerda = 0, direita = faixasRotulos.length - 1;
    while (esquerda <= direita) {
      const meio = (esquerda + direita) >>> 1, faixa = faixasRotulos[meio];
      if (faixa.ini > ini) direita = meio - 1;
      else if (faixa.fim <= ini) esquerda = meio + 1;
      else return fim <= faixa.fim;
    }
    return false;
  };
  const põe = (txt, motivo) => {
    const k = chaveDe(txt) + '|' + motivo;
    if (visto.has(k) || !txt) return;
    visto.add(k);
    suspeitas.push({ texto: txt, motivo });
  };

  /* números longos que nenhum padrão reclamou */
  let m;
  const num = /\b\d[\d.\-/]{4,}\b/g;
  while ((m = num.exec(saida)) !== null) {
    if (!pertenceAoRotulo(m.index, m.index + m[0].length)) põe(m[0], 'sequência numérica longa');
  }

  /* palavras capitalizadas que sobreviveram e não são vocabulário conhecido */
  const palavra = new RegExp('\\b[' + LETRA_MAI + '][' + LETRA_MIN + ']{2,}\\b', 'g');
  while ((m = palavra.exec(saida)) !== null) {
    if (pertenceAoRotulo(m.index, m.index + m[0].length)) continue;
    const antes = saida.slice(Math.max(0, m.index - 2), m.index);
    if (/[.!?:]\s$|^\s*$/.test(antes)) continue;     /* início de frase: comum */
    if (NAO_E_NOME.has(chaveDe(m[0]))) continue;
    põe(m[0], 'palavra capitalizada no meio da frase');
  }

  /* siglas em caixa alta que não são unidade nem UF conhecida */
  const sigla = new RegExp('\\b[' + LETRA_MAI + ']{3,}\\b', 'g');
  while ((m = sigla.exec(saida)) !== null) {
    if (pertenceAoRotulo(m.index, m.index + m[0].length)) continue;
    if (NAO_E_NOME.has(chaveDe(m[0])) || UF.has(m[0])) continue;
    põe(m[0], 'sigla em caixa alta');
  }
  return suspeitas.slice(0, 120);
}

/* ---- orquestração -------------------------------------------------------- */
async function pseudonimizar(texto, opc, prog) {
  const t0 = performance.now();
  const semente = opc.semente;

  const brutos = acharEstruturados(texto, opc)
    .concat(acharLinhaDeIdentificacao(texto))
    .concat(acharPorContexto(texto, opc));
  if (prog) prog(0.45);
  await cede();

  const achados = resolver(brutos);
  if (prog) prog(0.6);

  /* um rótulo por entidade: mesma pessoa, mesmo token no documento inteiro */
  const mapa = new Map();          /* rótulo -> { original, cat, vezes } */
  const porChave = new Map();      /* chave normalizada -> rótulo */
  const faixasRotulos = [];       /* posições efetivamente inseridas na saída */

  let saida = '', cursor = 0, trocas = 0;
  for (const a of achados) {
    const chave = a.cat + '|' + chaveDe(a.texto);
    let rot = porChave.get(chave);
    if (!rot) {
      rot = rotulo(a.cat, chaveDe(a.texto), semente);
      porChave.set(chave, rot);
      mapa.set(rot, { original: a.texto, cat: a.cat, nome: a.nome, risco: a.risco, vezes: 0, como: a.como });
    }
    mapa.get(rot).vezes++;
    saida += texto.slice(cursor, a.ini);
    faixasRotulos.push({ ini: saida.length, fim: saida.length + rot.length });
    saida += rot;
    cursor = a.fim;
    trocas++;
  }
  saida += texto.slice(cursor);
  if (prog) prog(0.85);
  await cede();

  const restos = acharRestos(saida, faixasRotulos);
  if (prog) prog(1);

  const porCat = {};
  for (const [, v] of mapa) {
    porCat[v.cat] = porCat[v.cat] || { cat: v.cat, nome: v.nome, risco: v.risco, entidades: 0, trocas: 0 };
    porCat[v.cat].entidades++;
    porCat[v.cat].trocas += v.vezes;
  }

  return {
    saida, mapa, achados, restos,
    metricas: {
      caracteres: texto.length,
      trocas,
      entidades: mapa.size,
      categorias: Object.values(porCat).sort((a, b) => b.trocas - a.trocas),
      suspeitas: restos.length,
      ms: Math.round(performance.now() - t0)
    }
  };
}

/* ---- reversão ------------------------------------------------------------
   O mapa nunca sai desta aba. Ele existe para que a resposta da LLM volte a
   fazer sentido no prontuário — e some quando a página fecha.               */
function reverter(texto, mapa) {
  let saida = texto, n = 0;
  for (const [rot, v] of mapa) {
    const partes = saida.split(rot);
    if (partes.length > 1) { n += partes.length - 1; saida = partes.join(v.original); }
  }
  const soltos = (saida.match(/\[[A-Z]+-[A-Z0-9]{3}\]/g) || []);
  return { saida, revertidos: n, naoReconhecidos: [...new Set(soltos)] };
}
