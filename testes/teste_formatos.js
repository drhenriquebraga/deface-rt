/* Formatos reais de evolução — banco sintético.

   Os casos abaixo reproduzem os FORMATOS encontrados em prontuário de verdade,
   com nomes inventados. Cada bloco existe porque um formato real escapou:
   nome em CAIXA ALTA, "63 ANOS", idade digitada errada, nome sem idade
   nenhuma, médico em minúscula depois de "Dr", convênio solto no cabeçalho.

   A segunda metade é o contrário: laudo denso que NÃO pode perder uma palavra.
   Trocar demais apaga o achado clínico, e isso é pior que deixar passar. */

global.document = { getElementById: () => null, createElement: () => ({}), addEventListener: () => {} };
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../dist/_all_data.js', 'utf8')
  .replace(/document\.addEventListener\('DOMContentLoaded', iniciar\);/, '');
eval(src + '\nObject.assign(global, {pseudonimizar, reverter, PRENOMES, SOBRENOMES, LUGARES, SAUDE, CONVENIOS});');

let falhas = 0;
const ok = (c, t) => { console.log('   ' + (c ? '✓' : '✗') + ' ' + t); if (!c) falhas++; };

const CASOS = [
  { rot: 'nome em CAIXA ALTA com idade na linha seguinte',
    texto: 'ARLINDO NUNES DA COSTA\n71 anos\nmora na Tijuca\n',
    sai: ['ARLINDO NUNES DA COSTA'] },

  { rot: 'idade em CAIXA ALTA na linha seguinte',
    texto: 'TEREZINHA MENDES BARROS\n63 ANOS\nAcompanhada da filha Marlene\n',
    sai: ['TEREZINHA MENDES BARROS', 'Marlene'] },

  { rot: 'idade digitada errada',
    texto: 'ODETE FIGUEIREDO RAMOS\n64 naos\nMora em Copacabana\n',
    sai: ['ODETE FIGUEIREDO RAMOS', 'Copacabana'] },

  { rot: 'nome sem idade, seguido de outro campo',
    texto: 'GERALDO PINHEIRO MACIEL\nAcompanhado da esposa Neusa\nmora no Grajau\n',
    sai: ['GERALDO PINHEIRO MACIEL', 'Neusa'] },

  { rot: 'nome com vírgula e idade na mesma linha',
    texto: 'Aparecida Toledo Braga, 78 anos\nMora na Ilha do Governador\n',
    sai: ['Aparecida Toledo Braga', 'Ilha do Governador'] },

  { rot: 'médico em minúscula depois de "dr"',
    texto: 'encaminhada pelo dr valdemar siqueira leal\n',
    sai: ['valdemar siqueira leal'] },

  { rot: 'especialidade sem dois-pontos',
    texto: 'urologista GILMAR TENORIO\nMastologista = Dra Solange Peixoto\n',
    sai: ['GILMAR TENORIO', 'Solange Peixoto'] },

  { rot: 'acompanhante antes do parentesco',
    texto: 'Acompanhada Doralice (irmã) e Sirlei (amiga)\n',
    sai: ['Doralice', 'Sirlei'] },

  { rot: 'operadora solta, com e sem acento',
    texto: 'Convênio: MEDSÊNIOR\nDiscussão com a junta da Medsenior: sem doença.\n',
    sai: ['MEDSÊNIOR', 'Medsenior'] },

  { rot: 'nome solto, reconhecido por sobrenome da lista',
    texto: 'Caso discutido em reunião. Rosemary Albuquerque assumiu o seguimento.\n',
    sai: ['Rosemary Albuquerque'] },

  { rot: 'laboratório e cidade conhecidos, sem gatilho',
    texto: '- C.O. Pardini 23/02/24: SED.\nProcedente de Duque de Caxias.\n',
    sai: ['Pardini', 'Duque de Caxias'] },
];

/* laudos que não podem perder nada */
const PRESERVAR = [
  { rot: 'patologia',
    texto: 'CARCINOMA DUCTAL "IN SITU" DOS TIPOS SÓLIDO, CRIBRIFORME, COMEDO, PAPILAR E ' +
      'MICROPAPILAR DE GRAU INTERMEDIÁRIO E ALTO GRAU, COM NECROSE E COM MICROCALCIFICAÇÕES. ' +
      'MARGENS DE RESSECÇÃO: LIVRES DE MALIGNIDADE. INVASÃO PERINEURAL: PRESENTE. ' +
      'CLASSIFICAÇÃO PATOLÓGICA: pT1b. pN0. Escore de Gleason 7 (3+4), Grupo Prognóstico 2.',
    manter: ['CARCINOMA DUCTAL', 'CRIBRIFORME', 'MARGENS DE RESSECÇÃO', 'INVASÃO PERINEURAL',
             'CLASSIFICAÇÃO PATOLÓGICA', 'Gleason 7 (3+4)', 'Grupo Prognóstico 2'] },

  { rot: 'radioterapia',
    texto: 'Proponho radioterapia de resgate em loja prostática, hipofracionamento moderado, ' +
      'dose total de 5250 cGy em 20 frações diárias de 262,5 cGy, nos moldes do estudo ' +
      'RADICALS-RT. Volume-alvo: Plastrão ESQUERDA. Campos de tratamento conformados. ' +
      'IGRT diário com Cone-Beam CT KV. Acelerador Linear Varian EDGE.',
    manter: ['loja prostática', '5250 cGy', '262,5 cGy', 'RADICALS-RT', 'Plastrão ESQUERDA',
             'Campos de tratamento', 'Cone-Beam CT KV', 'Varian EDGE'] },

  { rot: 'imagem',
    texto: 'PET-PSMA: mínimo foco com hiperexpressão do PSMA no aspecto póstero-lateral à ' +
      'direita da anastomose vesicouretral. RM: lesão PI-RADS 5 na zona de transição. ' +
      'Linfonodomegalias no nível II bilaterais. FIGO IIB. LI-RADS 5 no segmento VII.',
    manter: ['PET-PSMA', 'hiperexpressão do PSMA', 'anastomose vesicouretral', 'PI-RADS 5',
             'zona de transição', 'nível II', 'FIGO IIB', 'LI-RADS 5', 'segmento VII'] },
];

(async () => {
  console.log('\n═══ FORMATOS REAIS DE EVOLUÇÃO ═══');
  console.log('  listas carregadas: %d prenomes · %d sobrenomes · %d lugares · %d de saúde · %d operadoras',
    PRENOMES.size, SOBRENOMES.size, LUGARES.size, SAUDE.size, CONVENIOS.length);
  console.log();

  let capturados = 0, esperados = 0;
  for (const c of CASOS) {
    const r = await pseudonimizar(c.texto, { semente: 'FORMATOS', datas: true, agressivo: false }, null);
    const escaparam = c.sai.filter((s) => r.saida.includes(s));
    esperados += c.sai.length;
    capturados += c.sai.length - escaparam.length;
    ok(escaparam.length === 0, c.rot +
      (escaparam.length ? '  — escapou: ' + escaparam.join(', ') : ''));
  }
  console.log('\n   %d/%d identificadores capturados (%d%%)',
    capturados, esperados, Math.round(100 * capturados / esperados));

  console.log('\n═══ LAUDO DENSO: NADA PODE SUMIR ═══');
  for (const c of PRESERVAR) {
    const r = await pseudonimizar(c.texto, { semente: 'FORMATOS', datas: true, agressivo: false }, null);
    const perdidos = c.manter.filter((t) => !r.saida.includes(t));
    ok(perdidos.length === 0, c.rot + ': ' + c.manter.length + ' termos' +
      (perdidos.length ? '  — PERDEU: ' + perdidos.join(' | ') : ' preservados'));
  }

  console.log('\n═══ IDA E VOLTA ═══');
  const tudo = CASOS.map((c) => c.texto).join('\n') + PRESERVAR.map((c) => c.texto).join('\n');
  const r = await pseudonimizar(tudo, { semente: 'FORMATOS', datas: true, agressivo: false }, null);
  const v = reverter(r.saida, r.mapa);

  /* A mesma entidade escrita de duas formas — MEDSÊNIOR e Medsenior, "Dr joão
     Fidelis" e "dr joao fidelis" — recebe UM rótulo, de propósito: é o que faz
     a IA entender que se trata do mesmo sujeito. O preço é que a volta traz a
     grafia canônica, e não a original de cada ocorrência. Trocar isso exigiria
     um rótulo por grafia, o que quebraria a coerência do texto entregue. */
  const norm = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const exato = v.saida === tudo;
  ok(exato || norm(v.saida) === norm(tudo),
    exato ? 'texto restaurado caractere a caractere'
          : 'texto restaurado; só a grafia foi normalizada (mesma entidade, duas escritas)');
  ok(v.naoReconhecidos.length === 0, 'nenhum rótulo órfão');

  /* e num texto de grafia consistente a volta tem de ser exata */
  const consistente = CASOS.filter((c) => !/MEDS/.test(c.texto)).map((c) => c.texto).join('\n');
  const r2 = await pseudonimizar(consistente, { semente: 'FORMATOS', datas: true, agressivo: false }, null);
  ok(reverter(r2.saida, r2.mapa).saida === consistente,
    'grafia consistente: volta exata, caractere a caractere');

  console.log('\n' + (falhas ? '>>> ' + falhas + ' FALHA(S)' : '>>> tudo passou'));
  process.exit(falhas ? 1 : 0);
})();
