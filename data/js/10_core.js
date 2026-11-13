/* =========================================================================
   DeFace RT Data — núcleo

   Pseudonimização de texto livre, inteiramente no navegador. Mesma regra do
   irmão DICOM: Classe 0, nenhum byte sai daqui.

   O token de cada entidade é derivado do próprio texto mais uma semente de
   sessão. Consequência desejada: a mesma pessoa recebe o mesmo rótulo ao longo
   de todo o documento — o texto continua legível para a LLM — e dois documentos
   processados em sessões diferentes não compartilham rótulo, o que impede
   cruzar coortes pelo token.
   ========================================================================= */
'use strict';

const APP = { nome: 'DeFace RT Data', versao: '1.4.1', org: 'Radioterapia.AI' };

/* ---- hash de string (xmur3), suficiente para derivar rótulo curto -------- */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/* ---- semente de sessão --------------------------------------------------- */
function sementeAleatoria() {
  const b = new Uint32Array(2);
  crypto.getRandomValues(b);
  return (b[0].toString(36) + b[1].toString(36)).toUpperCase().slice(0, 9);
}

/* ---- rótulo: TAG + minitoken -------------------------------------------- */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   /* sem I, O, 0, 1 */

function minitoken(texto, semente, tamanho) {
  const r = xmur3(semente + '|' + texto.toLowerCase());
  let s = '';
  for (let i = 0; i < (tamanho || 3); i++) s += ALFABETO[r() % ALFABETO.length];
  return s;
}

function rotulo(categoria, texto, semente) {
  return '[' + categoria + '-' + minitoken(texto, semente) + ']';
}

/* ---- normalização para comparação --------------------------------------- */
function semAcento(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function chaveDe(s) {
  return semAcento(String(s)).toLowerCase().replace(/\s+/g, ' ').trim();
}

/* ---- números em português ------------------------------------------------ */
function nf(v, casas) {
  return Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: casas || 0, maximumFractionDigits: casas || 0
  });
}

/* ---- registro de execução ------------------------------------------------ */
const LOG = {
  linhas: [],
  _põe(tipo, msg) {
    const t = new Date().toLocaleTimeString('pt-BR');
    this.linhas.push({ t, tipo, msg });
    const corpo = document.getElementById('logBody');
    if (corpo) {
      const d = document.createElement('div');
      d.className = 'linha ' + tipo;
      d.innerHTML = '<span class="hora">' + t + '</span>' + escapar(msg);
      corpo.appendChild(d);
      corpo.scrollTop = corpo.scrollHeight;
    }
    const ult = document.getElementById('logLast');
    if (ult) ult.textContent = msg;
  },
  info(m) { this._põe('info', m); },
  ok(m) { this._põe('ok', m); },
  aviso(m) { this._põe('aviso', m); },
  destaque(m) { this._põe('destaque', m); }
};

function escapar(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---- agendador cooperativo ----------------------------------------------
   MessageChannel e não setTimeout: o navegador estrangula temporizadores em
   aba de fundo, e um prontuário longo processado enquanto o usuário conversa
   em outra aba pareceria travado.                                           */
const _canal = new MessageChannel();
let _fila = [];
_canal.port1.onmessage = () => { const f = _fila.shift(); if (f) f(); };
const cede = () => new Promise((r) => { _fila.push(r); _canal.port2.postMessage(0); });

async function laco(total, passo, corpo, aoProgresso) {
  let i = 0, t0 = performance.now();
  while (i < total) {
    const fim = Math.min(i + passo, total);
    for (; i < fim; i++) corpo(i);
    if (performance.now() - t0 > 40) {
      if (aoProgresso) aoProgresso(i / total);
      await cede();
      t0 = performance.now();
    }
  }
  if (aoProgresso) aoProgresso(1);
}
