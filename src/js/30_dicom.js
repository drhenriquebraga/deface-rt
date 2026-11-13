/* =========================================================================
   Leitor DICOM — sem dependências externas
   Suporta: VR implícito/explícito, little e big endian, deflacionado,
            pixel bruto, RLE e JPEG sem perdas (SOF3, processos 14 e SV1).
   Não suporta: JPEG 2000 e JPEG-LS — informa e orienta a reexportação.
   ========================================================================= */
'use strict';

const TAG_ITEM = 0xFFFEE000, TAG_ITEM_FIM = 0xFFFEE00D, TAG_SEQ_FIM = 0xFFFEE0DD;
const LEN_INDEF = 0xFFFFFFFF;
/* teto de aninhamento de blocos de comprimento indefinido. DICOM real nao
   passa de tres niveis; o teto existe porque o arquivo vem de terceiro e a
   busca do delimitador e recursiva. */
const PROF_MAX = 64;

function chaveTag(g, e) {
  return (g.toString(16).padStart(4, '0') + e.toString(16).padStart(4, '0')).toUpperCase();
}
function tagBonita(k) { return '(' + k.slice(0, 4) + ',' + k.slice(4) + ')'; }

/* ---- decodificação de texto conforme (0008,0005) ---- */
function fazDecodificador(cs) {
  const c = (cs || '').toUpperCase();
  if (c.indexOf('192') >= 0 || c.indexOf('UTF') >= 0) {
    const d = new TextDecoder('utf-8');
    return (u8) => d.decode(u8);
  }
  const d = new TextDecoder('windows-1252');  /* cobre ISO_IR 100 e o uso corrente no Brasil */
  return (u8) => d.decode(u8);
}

class LeitorDICOM {
  constructor(buf, nomeArquivo) {
    this.buf = buf;
    this.dv = new DataView(buf);
    this.u8 = new Uint8Array(buf);
    this.nome = nomeArquivo || '';
    this.elems = new Map();     // chave -> elemento
    this.ordem = [];            // chaves na ordem de leitura
    this.pixel = null;          // { off, len, frags } ou null
    this.ts = null;
    this.privadas = [];
    this.erro = null;
  }

  static ehDICOM(u8) {
    if (u8.length > 132 &&
      u8[128] === 0x44 && u8[129] === 0x49 && u8[130] === 0x43 && u8[131] === 0x4D) return true;
    /* sem preâmbulo: aceita se começa com um grupo plausível */
    if (u8.length > 8) {
      const g = u8[0] | (u8[1] << 8);
      if (g === 0x0002 || g === 0x0008) return true;
    }
    return false;
  }

  async ler() {
    let off = 0;
    const temPreambulo = this.u8.length > 132 && this.u8[128] === 0x44 &&
      this.u8[129] === 0x49 && this.u8[130] === 0x43 && this.u8[131] === 0x4D;
    if (temPreambulo) {
      off = 132;
      off = this.lerConjunto(off, this.acharFimMeta(off), true, false, this.elems, this.ordem);
    }
    const tsuid = this.txt('00020010');
    let info = TS[tsuid];
    if (!tsuid) {
      /* sem meta: adivinha pelo primeiro elemento */
      info = this.adivinhaSintaxe(off) ? TS['1.2.840.10008.1.2.1'] : TS['1.2.840.10008.1.2'];
      this.tsAdivinhada = true;
    }
    if (!info) { this.erro = 'Sintaxe de transferência desconhecida: ' + tsuid; return this; }
    this.ts = Object.assign({ uid: tsuid || '1.2.840.10008.1.2' }, info);

    if (info.defl) {
      /* corpo deflacionado a partir do fim do meta */
      const bruto = this.u8.subarray(off);
      const ds = new DecompressionStream('deflate-raw');
      const resp = new Response(new Blob([bruto]).stream().pipeThrough(ds));
      const infl = new Uint8Array(await resp.arrayBuffer());
      this.buf = infl.buffer; this.dv = new DataView(infl.buffer); this.u8 = infl;
      off = 0;
    }
    this.lerConjunto(off, this.u8.length, info.expl, info.be, this.elems, this.ordem);
    return this;
  }

  acharFimMeta(off) {
    /* (0002,0000) traz o comprimento do grupo; se ausente, varre até sair do grupo 2 */
    const g = this.dv.getUint16(off, true), e = this.dv.getUint16(off + 2, true);
    if (g === 2 && e === 0) {
      const len = this.dv.getUint32(off + 8, true);
      return off + 12 + len;
    }
    let p = off;
    while (p + 8 <= this.u8.length && this.dv.getUint16(p, true) === 2) {
      const vr = String.fromCharCode(this.u8[p + 4], this.u8[p + 5]);
      const longo = VR_LONGO.has(vr);
      const l = longo ? this.dv.getUint32(p + 8, true) : this.dv.getUint16(p + 6, true);
      p += (longo ? 12 : 8) + l;
    }
    return p;
  }

  adivinhaSintaxe(off) {
    if (off + 6 > this.u8.length) return false;
    const a = this.u8[off + 4], b = this.u8[off + 5];
    return a >= 65 && a <= 90 && b >= 65 && b <= 90;   /* duas maiúsculas = VR explícito */
  }

  lerConjunto(off, fim, expl, be, destino, ordem, prof) {
    prof = prof || 0;
    while (off + 8 <= fim) {
      const g = this.dv.getUint16(off, be ? false : true);
      const e = this.dv.getUint16(off + 2, be ? false : true);
      const tag = ((g << 16) >>> 0) + e;
      if (tag === TAG_ITEM_FIM || tag === TAG_SEQ_FIM) { off += 8; break; }

      let vr, len, cab;
      if (expl && !(g === 0xFFFE)) {
        vr = String.fromCharCode(this.u8[off + 4], this.u8[off + 5]);
        if (VR_LONGO.has(vr)) { len = this.dv.getUint32(off + 8, !be); cab = 12; }
        else { len = this.dv.getUint16(off + 6, !be); cab = 8; }
      } else {
        const k0 = chaveTag(g, e);
        vr = (DIC[k0] && DIC[k0][0]) || ((g & 1) ? 'UN' : 'UN');
        len = this.dv.getUint32(off + 4, !be); cab = 8;
        if (len === LEN_INDEF) vr = (g === 0x7FE0 && e === 0x0010) ? 'OB' : 'SQ';
      }
      const ini = off + cab;
      const chave = chaveTag(g, e);

      /* dados de pixel */
      if (g === 0x7FE0 && e === 0x0010) {
        if (len === LEN_INDEF) {
          const frags = this.lerFragmentos(ini, fim);
          this.pixel = { encapsulado: true, frags: frags.lista };
          off = frags.fim;
        } else {
          this.pixel = { encapsulado: false, off: ini, len: len };
          off = ini + len;
        }
        destino.set(chave, { g, e, vr, len, off: ini, pixel: true });
        ordem.push(chave);
        continue;
      }

      if (vr === 'SQ' || (len === LEN_INDEF && vr !== 'OB')) {
        const r = this.lerSequencia(ini, len, fim, expl, be, prof);
        destino.set(chave, { g, e, vr: 'SQ', len: r.fim - ini, off: ini, itens: r.itens });
        ordem.push(chave);
        off = r.fim;
        continue;
      }

      if (len === LEN_INDEF) { off = fim; break; }   /* defensivo */
      if (ini + len > fim) { len = Math.max(0, fim - ini); }

      const el = { g, e, vr, len, off: ini };
      if (g & 1) { el.privada = true; if (g !== 0xFFFE) this.privadas.push(chave); }
      destino.set(chave, el);
      ordem.push(chave);
      off = ini + len + (len % 2);
      if (len % 2 === 1) off = ini + len;            /* comprimentos ímpares são ilegais; segue mesmo assim */
    }
    return off;
  }

  lerSequencia(ini, len, limite, expl, be, prof) {
    const fimSeq = (len === LEN_INDEF) ? limite : Math.min(ini + len, limite);
    const itens = [];
    let p = ini;
    while (p + 8 <= fimSeq) {
      const g = this.dv.getUint16(p, !be), e = this.dv.getUint16(p + 2, !be);
      const tag = ((g << 16) >>> 0) + e;
      const ilen = this.dv.getUint32(p + 4, !be);
      if (tag === TAG_SEQ_FIM) { p += 8; break; }
      if (tag !== TAG_ITEM) break;
      const iini = p + 8;
      let ifim, seguinte;
      if (ilen === LEN_INDEF) {
        ifim = this.fimIndefinido(iini, fimSeq, expl, be, TAG_ITEM_FIM);
        /* só consome o delimitador se ele for MESMO o fim deste item: quando
           quem fecha é o (FFFE,E0DD) da sequência, ele fica para o laço abaixo */
        seguinte = (this.tagEm(ifim, fimSeq, be) === TAG_ITEM_FIM) ? ifim + 8 : ifim;
      } else {
        ifim = Math.min(iini + ilen, fimSeq);
        seguinte = ifim;
      }
      if (prof < 3) {
        const m = new Map(), o = [];
        this.lerConjunto(iini, ifim, expl, be, m, o, prof + 1);
        itens.push({ elems: m, ordem: o });
        for (const k of o) if (parseInt(k.slice(0, 4), 16) & 1) this.privadas.push(k + '↳');
      } else itens.push({ elems: new Map(), ordem: [] });
      p = seguinte;
    }
    return { itens, fim: (len === LEN_INDEF) ? p : Math.min(ini + len, limite) };
  }

  /* lê a tag em `p`, ou 0 se não couber */
  tagEm(p, limite, be) {
    if (p + 8 > limite) return 0;
    return ((this.dv.getUint16(p, !be) << 16) >>> 0) + this.dv.getUint16(p + 2, !be);
  }

  /* Posição do delimitador que fecha um bloco de comprimento indefinido aberto
     em `ini` — SEM consumi-lo. Quem chama decide se pula. `alvo` é TAG_ITEM_FIM
     para item, TAG_SEQ_FIM para sequência.

     Percorre os elementos e desce nos blocos aninhados. A versão anterior
     varria o buffer de dois em dois bytes atrás do padrão do delimitador, e
     isso não distingue o delimitador DE DENTRO do nosso: numa sequência que
     contém outra sequência — (0008,1250) com (0008,1140) dentro, comuníssimo em
     série de PACS em VR implícito —, o primeiro (FFFE,E00D) encontrado fecha o
     item interno. A sequência externa terminava cedo, o conjunto de cima
     retomava a leitura no meio dela, topava com um delimitador solto e
     encerrava o arquivo inteiro sem erro nenhum. Ver armadilha 10.

     Encontrar o delimitador de SEQUÊNCIA antes do nosso também fecha o bloco:
     há equipamento que abre item indefinido e fecha só a sequência. Sem essa
     saída a busca passava por cima dele e engolia o resto do arquivo — o mesmo
     estrago do defeito original, por outra porta.

     PROF_MAX existe porque a recursão corre sobre arquivo de terceiro: 5000
     níveis aninhados estouravam a pilha com RangeError, e uma exceção aqui
     derruba o carregamento inteiro. DICOM real não passa de três níveis. */
  fimIndefinido(ini, limite, expl, be, alvo, prof) {
    prof = prof || 0;
    let p = ini;
    while (p + 8 <= limite) {
      const g = this.dv.getUint16(p, !be), e = this.dv.getUint16(p + 2, !be);
      const tag = ((g << 16) >>> 0) + e;
      if (tag === alvo || tag === TAG_SEQ_FIM) return p;
      if (tag === TAG_ITEM_FIM) { p += 8; continue; }
      let len, cab;
      if (expl && g !== 0xFFFE) {
        const vr = String.fromCharCode(this.u8[p + 4], this.u8[p + 5]);
        if (VR_LONGO.has(vr)) { len = this.dv.getUint32(p + 8, !be); cab = 12; }
        else { len = this.dv.getUint16(p + 6, !be); cab = 8; }
      } else { len = this.dv.getUint32(p + 4, !be); cab = 8; }
      if (len === LEN_INDEF) {
        if (prof >= PROF_MAX) return limite;
        const dentro = (tag === TAG_ITEM) ? TAG_ITEM_FIM : TAG_SEQ_FIM;
        const d = this.fimIndefinido(p + cab, limite, expl, be, dentro, prof + 1);
        /* se o que fechou lá dentro foi o delimitador do bloco interno, segue;
           se foi o nosso, devolve sem consumir */
        if (this.tagEm(d, limite, be) !== dentro) return d;
        p = d + 8;
        continue;
      }
      p += cab + len;
    }
    return limite;
  }

  lerFragmentos(ini, limite) {
    const lista = [];
    let p = ini;
    while (p + 8 <= limite) {
      const tag = ((this.dv.getUint16(p, true) << 16) >>> 0) + this.dv.getUint16(p + 2, true);
      const len = this.dv.getUint32(p + 4, true);
      if (tag === TAG_SEQ_FIM) { p += 8; break; }
      if (tag !== TAG_ITEM) break;
      lista.push({ off: p + 8, len });
      p = p + 8 + len;
    }
    if (lista.length) lista.shift();     /* o primeiro item é a tabela de deslocamentos */
    return { lista, fim: p };
  }

  /* ---- acesso a valores ---- */
  cru(k) {
    const el = this.elems.get(k);
    if (!el || el.len === 0) return null;
    return this.u8.subarray(el.off, el.off + el.len);
  }
  txt(k) {
    const u = this.cru(k);
    if (!u) return '';
    if (!this._dec) this._dec = fazDecodificador(this._cs || '');
    return this._dec(u).replace(/\0+$/, '').trim();
  }
  num(k) { const t = this.txt(k); const v = parseFloat(t); return isNaN(v) ? null : v; }
  nums(k) {
    const t = this.txt(k); if (!t) return [];
    return t.split('\\').map((x) => parseFloat(x)).filter((x) => !isNaN(x));
  }
  us(k) {
    const el = this.elems.get(k);
    if (!el || el.len < 2) return null;
    return this.dv.getUint16(el.off, !this.ts.be);
  }
  prepararTexto() { this._cs = this.txt('00080005'); this._dec = fazDecodificador(this._cs); }

  /* ---- pixels do quadro (uma imagem por arquivo) ---- */
  async lerPixels() {
    const cols = this.us('00280011'), rows = this.us('00280010');
    const bits = this.us('00280100') || 16;
    const armaz = this.us('00280101') || bits;
    const sinal = this.us('00280103') || 0;
    const amostras = this.us('00280002') || 1;
    if (!cols || !rows) throw new Error('Dimensões da imagem ausentes.');
    if (Number(this.txt('00280008') || 1) > 1)
      throw new Error('DICOM multiquadro não é tratado. Reexporte uma imagem por arquivo.');
    if (amostras !== 1) throw new Error('Imagem colorida (' + amostras + ' amostras/pixel) — o DeFace RT trata séries em escala de cinza.');
    if (!this.pixel) throw new Error('Arquivo sem dados de pixel.');

    const n = cols * rows;
    let saida;

    if (!this.pixel.encapsulado) {
      const off = this.pixel.off;
      if (bits === 8) {
        const src = this.u8.subarray(off, off + n);
        saida = sinal ? Int16Array.from(new Int8Array(src.buffer, src.byteOffset, n))
          : Int16Array.from(src);
      } else {
        saida = new Int16Array(n);
        const be = this.ts.be;
        for (let i = 0; i < n; i++) {
          let v = this.dv.getUint16(off + i * 2, !be);
          if (!sinal && armaz < 16) v &= (1 << armaz) - 1;
          if (!sinal && v > 32767)
            throw new Error('Pixel sem sinal acima de 32767: fora do intervalo suportado. Reexporte em 16 bits com sinal e reescala adequada.');
          saida[i] = sinal ? (v << 16 >> 16) : v;
        }
        if (!sinal && armaz < 16) {
          /* valores sem sinal acima de 32767 não cabem em Int16: aplica máscara */
          const mask = (1 << armaz) - 1;
          for (let i = 0; i < n; i++) saida[i] = (saida[i] & mask);
        }
      }
    } else {
      const cod = this.ts.cod;
      const frag = this.pixel.frags;
      if (!frag || !frag.length) throw new Error('Pixels encapsulados sem fragmento.');
      let dados = frag.length === 1
        ? this.u8.subarray(frag[0].off, frag[0].off + frag[0].len)
        : (() => {
          let tot = 0; for (const f of frag) tot += f.len;
          const c = new Uint8Array(tot); let p = 0;
          for (const f of frag) { c.set(this.u8.subarray(f.off, f.off + f.len), p); p += f.len; }
          return c;
        })();

      if (cod === 'rle') saida = decodRLE(dados, cols, rows, bits, sinal);
      else if (cod === 'jpegls14') saida = decodJPEGSemPerdas(dados, cols, rows, sinal);
      else if (cod === 'jpeg8') saida = await decodJPEGNavegador(dados, cols, rows);
      else throw new Error('Sintaxe ' + this.ts.nome + ' não é decodificada por este aplicativo. ' +
        'Reexporte a série sem compressão (Explícito VR Little Endian) no PACS.');
    }
    return { pix: saida, cols, rows, bits, sinal };
  }
}

/* ---- RLE (PS3.5 Anexo G) ------------------------------------------------ */
function decodRLE(d, cols, rows, bits, sinal) {
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
  const nSeg = dv.getUint32(0, true);
  const n = cols * rows, bytesPx = bits > 8 ? 2 : 1;
  const planos = [];
  for (let s = 0; s < Math.min(nSeg, bytesPx); s++) {
    const ini = dv.getUint32(4 + s * 4, true);
    const fim = (s + 1 < nSeg) ? dv.getUint32(4 + (s + 1) * 4, true) : d.length;
    const out = new Uint8Array(n);
    let p = ini, o = 0;
    while (p < fim && o < n) {
      const b = dv.getInt8(p); p++;
      if (b >= 0) { const c = b + 1; for (let i = 0; i < c && o < n; i++) out[o++] = d[p + i]; p += c; }
      else if (b !== -128) { const c = -b + 1; const v = d[p]; p++; for (let i = 0; i < c && o < n; i++) out[o++] = v; }
    }
    planos.push(out);
  }
  const out = new Int16Array(n);
  if (bytesPx === 1) { for (let i = 0; i < n; i++) out[i] = sinal ? (planos[0][i] << 24 >> 24) : planos[0][i]; }
  else {
    for (let i = 0; i < n; i++) {
      const v = (planos[0][i] << 8) | planos[1][i];   /* segmento 0 = byte mais significativo */
      if (!sinal && v > 32767)
        throw new Error('Pixel RLE sem sinal acima de 32767: fora do intervalo suportado. Reexporte em 16 bits com sinal.');
      out[i] = sinal ? (v << 16 >> 16) : v;
    }
  }
  return out;
}

/* ---- JPEG sem perdas, SOF3 (processo 14 / SV1) -------------------------- */
function decodJPEGSemPerdas(d, cols, rows, sinal) {
  let p = 0;
  const huff = {};
  let P = 0, W = 0, H = 0, Nf = 0, comps = [], Ss = 1, Pt = 0, Ri = 0;

  const u16 = (i) => (d[i] << 8) | d[i + 1];
  if (!(d[0] === 0xFF && d[1] === 0xD8)) throw new Error('Fluxo JPEG inválido.');
  p = 2;

  while (p < d.length) {
    if (d[p] !== 0xFF) { p++; continue; }
    let m = d[p + 1]; p += 2;
    if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) continue;
    if (m === 0xD9) break;
    const len = u16(p);
    const seg = p + 2, fimSeg = p + len;

    if (m === 0xC3 || m === 0xC7 || m === 0xCB || m === 0xCF) {  /* SOF3 e variantes sem perdas */
      P = d[seg]; H = u16(seg + 1); W = u16(seg + 3); Nf = d[seg + 5];
      comps = [];
      for (let i = 0; i < Nf; i++) {
        const b = seg + 6 + i * 3;
        comps.push({ id: d[b], h: d[b + 1] >> 4, v: d[b + 1] & 15 });
      }
    } else if (m === 0xC4) {                                     /* DHT */
      let q = seg;
      while (q < fimSeg) {
        const tc = d[q] >> 4, th = d[q] & 15; q++;
        const bits = new Array(17).fill(0);
        let total = 0;
        for (let i = 1; i <= 16; i++) { bits[i] = d[q + i - 1]; total += bits[i]; }
        q += 16;
        const vals = d.subarray(q, q + total); q += total;
        huff[tc * 4 + th] = montaHuffman(bits, vals);
      }
    } else if (m === 0xDD) {                                     /* DRI */
      Ri = u16(seg);
      if (Ri) throw new Error('JPEG sem perdas com reinício (DRI) não é suportado. Reexporte a série sem compressão.');
    } else if (m === 0xDA) {                                     /* SOS */
      const Ns = d[seg];
      const sel = [];
      for (let i = 0; i < Ns; i++) sel.push({ id: d[seg + 1 + i * 2], td: d[seg + 2 + i * 2] >> 4 });
      Ss = d[seg + 1 + Ns * 2];
      Pt = d[seg + 3 + Ns * 2] & 15;
      p = fimSeg;
      if (Ns !== 1) throw new Error('JPEG sem perdas com ' + Ns + ' componentes não é tratado.');
      return varreJPEGSemPerdas(d, p, W || cols, H || rows, P, Ss, Pt, Ri, huff[sel[0].td], sinal);
    }
    p = fimSeg;
  }
  throw new Error('JPEG sem perdas: marcador de varredura ausente.');
}

function montaHuffman(bits, vals) {
  /* tabela de decodificação por (comprimento, código) — busca linear por bit */
  const minCod = new Int32Array(17), maxCod = new Int32Array(17).fill(-1), valPtr = new Int32Array(17);
  let cod = 0, k = 0;
  for (let l = 1; l <= 16; l++) {
    if (bits[l]) {
      valPtr[l] = k; minCod[l] = cod;
      cod += bits[l]; k += bits[l];
      maxCod[l] = cod - 1;
    } else maxCod[l] = -1;
    cod <<= 1;
  }
  return { minCod, maxCod, valPtr, vals };
}

function varreJPEGSemPerdas(d, p, W, H, P, pred, Pt, Ri, tab, sinal) {
  if (!tab) throw new Error('JPEG sem perdas: tabela de Huffman ausente.');
  const out = new Int16Array(W * H);
  let bitBuf = 0, bitCnt = 0, pos = p;

  function proxBit() {
    if (bitCnt === 0) {
      if (pos >= d.length) return 0;
      let b = d[pos++];
      if (b === 0xFF) {
        const b2 = d[pos];
        if (b2 === 0x00) pos++;
        else if (b2 >= 0xD0 && b2 <= 0xD7) { pos++; b = d[pos++]; if (b === 0xFF && d[pos] === 0x00) pos++; }
        else return 0;
      }
      bitBuf = b; bitCnt = 8;
    }
    bitCnt--;
    return (bitBuf >> bitCnt) & 1;
  }
  function decodeHuff() {
    let cod = proxBit(), l = 1;
    while (l <= 16) {
      if (tab.maxCod[l] >= 0 && cod <= tab.maxCod[l] && cod >= tab.minCod[l])
        return tab.vals[tab.valPtr[l] + cod - tab.minCod[l]];
      cod = (cod << 1) | proxBit(); l++;
    }
    return 0;
  }
  function receberEstender(s) {
    if (s === 0) return 0;
    if (s === 16) return -32768;
    let v = 0;
    for (let i = 0; i < s; i++) v = (v << 1) | proxBit();
    return (v < (1 << (s - 1))) ? v - (1 << s) + 1 : v;
  }
  function reinicia() { bitCnt = 0; while (pos + 1 < d.length && !(d[pos] === 0xFF && d[pos + 1] >= 0xD0 && d[pos + 1] <= 0xD7)) pos++; pos += 2; }

  const inicial = 1 << (P - Pt - 1);
  let contaRst = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (Ri && contaRst === Ri) { reinicia(); contaRst = 0; }
      const s = decodeHuff();
      const diff = receberEstender(s);
      let px;
      const Ra = x > 0 ? out[y * W + x - 1] : 0;
      const Rb = y > 0 ? out[(y - 1) * W + x] : 0;
      const Rc = (x > 0 && y > 0) ? out[(y - 1) * W + x - 1] : 0;
      if (y === 0 && x === 0) px = inicial;
      else if (x === 0) px = Rb;
      else if (y === 0) px = Ra;
      else {
        switch (pred) {
          case 1: px = Ra; break;
          case 2: px = Rb; break;
          case 3: px = Rc; break;
          case 4: px = Ra + Rb - Rc; break;
          case 5: px = Ra + ((Rb - Rc) >> 1); break;
          case 6: px = Rb + ((Ra - Rc) >> 1); break;
          case 7: px = (Ra + Rb) >> 1; break;
          default: px = Ra;
        }
      }
      let v = (px + diff) & 0xFFFF;
      if (Pt) v = v << Pt;
      out[y * W + x] = sinal ? (v << 16 >> 16) : (v & 0xFFFF);
      if (Ri) contaRst++;
    }
  }
  if (!sinal) {
    /* valores acima de 32767 não cabem em Int16 com sinal: reinterpreta */
    const u = new Uint16Array(out.buffer);
    const r = new Int16Array(W * H);
    for (let i = 0; i < r.length; i++) {
      if (u[i] > 32767)
        throw new Error('Pixel JPEG sem sinal acima de 32767: fora do intervalo suportado. Reexporte em 16 bits com sinal.');
      r[i] = u[i];
    }
    return r;
  }
  return out;
}

/* ---- JPEG linha de base: delega ao decodificador do navegador ---------- */
async function decodJPEGNavegador(dados, cols, rows) {
  const bmp = await createImageBitmap(new Blob([dados], { type: 'image/jpeg' }));
  const cv = document.createElement('canvas');
  cv.width = bmp.width; cv.height = bmp.height;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(bmp, 0, 0);
  const id = cx.getImageData(0, 0, bmp.width, bmp.height).data;
  const out = new Int16Array(cols * rows);
  const n = Math.min(cols * rows, bmp.width * bmp.height);
  for (let i = 0; i < n; i++) out[i] = id[i * 4];
  bmp.close();
  return out;
}
