/* =========================================================================
   DeFace RT — anonimização de face e cabeçalho em séries DICOM
   Núcleo utilitário: hash, PRNG semeado, CRC32, UID, agendador cooperativo
   ========================================================================= */
'use strict';

const APP = { nome: 'DeFace RT', versao: '1.4.1', org: 'Radioterapia.AI' };

/* Raiz de UID no arco 2.25 (UUID convertido em inteiro) — não exige registro
   junto à ISO, é a via prevista pelo DICOM PS3.5 para gerar UID sem OID próprio. */
function novoUID() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;               // versão 4
  b[8] = (b[8] & 0x3f) | 0x80;               // variante RFC 4122
  let n = 0n;
  for (let i = 0; i < 16; i++) n = (n << 8n) | BigInt(b[i]);
  const uid = '2.25.' + n.toString();
  return uid.length <= 64 ? uid : uid.slice(0, 64);
}

/* Mapa de UID: mesma origem sempre recebe o mesmo destino dentro da execução,
   preservando a coerência interna da série entregue. */
class MapaUID {
  constructor() { this.m = new Map(); }
  de(orig) {
    if (!orig) return novoUID();
    if (!this.m.has(orig)) this.m.set(orig, novoUID());
    return this.m.get(orig);
  }
}

/* ---- PRNG determinístico: xmur3 (semente → 32 bits) + mulberry32 ---- */
function semear(str) {
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
function prng(sementeTexto) {
  let a = semear(String(sementeTexto))();
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* Semente legível: 4 grupos de 4 caracteres, alfabeto sem ambiguidade visual */
function sementeAleatoria() {
  const alf = 'ACDEFGHJKLMNPQRTUVWXY34679';
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  let s = '';
  for (let i = 0; i < 16; i++) { s += alf[b[i] % alf.length]; if (i % 4 === 3 && i < 15) s += '-'; }
  return s;
}

/* ---- CRC32 (necessário para escrever ZIP) ---- */
const CRC_TAB = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(u8) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = CRC_TAB[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ---- Formatação pt-BR ---- */
function nf(v, casas = 1) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return v.toFixed(casas).replace('.', ',');
}
function bytesLegivel(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return nf(n / 1024, 0) + ' KB';
  if (n < 1073741824) return nf(n / 1048576, 1) + ' MB';
  return nf(n / 1073741824, 2) + ' GB';
}
function agora() {
  const d = new Date(), p = (x) => String(x).padStart(2, '0');
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}
function dataDICOM(d) {
  const p = (x) => String(x).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
}
function horaDICOM(d) {
  const p = (x) => String(x).padStart(2, '0');
  return p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

/* ---- Agendador cooperativo ----------------------------------------------
   Sem Web Worker de propósito: worker criado a partir de blob: é bloqueado
   quando a página roda em file://, que é exatamente o cenário de instalação
   local. Em vez disso, os laços pesados cedem o fio principal a cada fatia,
   mantendo a barra de progresso viva. Custa desempenho e não custa robustez. */
const cede = () => new Promise((r) => setTimeout(r, 0));

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

/* ---- Registro de execução ---- */
const LOG = {
  el: null, ultimo: null,
  init() { this.el = document.getElementById('logBody'); this.ultimo = document.getElementById('logLast'); },
  put(msg, cls) {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.innerHTML = '<span class="t">' + agora() + '</span>  ' + msg;
    this.el.appendChild(d);
    this.el.scrollTop = this.el.scrollHeight;
    this.ultimo.textContent = String(msg).replace(/<[^>]+>/g, '').slice(0, 74);
    if (this.el.childElementCount > 600) this.el.removeChild(this.el.firstChild);
  },
  info(m) { this.put(m); },
  ok(m) { this.put(m, 'ok'); },
  aviso(m) { this.put(m, 'warn'); },
  erro(m) { this.put(m, 'err'); },
  destaque(m) { this.put(m, 'hl'); }
};
