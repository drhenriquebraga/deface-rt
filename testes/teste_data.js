/* Banco de teste do DeFace RT Data.

   Mede o que o app promete e, principalmente, o que ele NÃO promete: a taxa de
   escape é parte do produto e precisa estar num número, não numa frase. */

global.document = { getElementById: () => null, createElement: () => ({}), addEventListener: () => {} };

const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../dist/_all_data.js', 'utf8')
  .replace(/document\.addEventListener\('DOMContentLoaded', iniciar\);/, '');
const EXPORTA = ['pseudonimizar', 'reverter', 'rotulo', 'minitoken', 'sementeAleatoria',
  'cpfValido', 'cnsValido', 'cnpjValido', 'PADROES', 'chaveDe', 'acharRestos'];
eval(src + '\nObject.assign(global, {' + EXPORTA.join(',') + '});');

let falhas = 0;
const ok = (c, t) => { console.log('   ' + (c ? '✓' : '✗') + ' ' + t); if (!c) falhas++; };

/* prontuário sintético: nenhum dado real, todos os identificadores inventados */
const PRONTUARIO = [
  'HOSPITAL EXEMPLO DE ENSINO — Serviço de Radioterapia',
  'Paciente: Maria Aparecida da Silva Santos',
  'Prontuário: 99887766   CNS: 700508354788954   CPF: 529.982.247-25',
  'Nascimento: 22/11/1970   Idade: 54 anos   Sexo: feminino',
  'Telefone: (11) 98765-4321   E-mail: maria.silva@example.invalid',
  'Endereço: Rua das Acácias, 128 — CEP 04567-890',
  '',
  'Médico assistente: Dr. Carlos Eduardo Pereira (CRM-SP 123456)',
  'Encaminhada pela Clínica Sao Rafael em 03/02/2026.',
  '',
  'HISTÓRIA: Paciente com carcinoma ductal invasivo de mama esquerda,',
  'estadio IIA. Tomografia Computadorizada de tórax sem evidência de',
  'metástase. Ressonância Magnética de crânio normal.',
  'Maria Aparecida refere dor lombar há 3 meses.',
  '',
  'CONDUTA: radioterapia adjuvante, 50 Gy em 25 frações.',
  'Retorno com Dr. Carlos Eduardo Pereira em 15/03/2026.'
].join('\n');

(async () => {
  console.log('\n═══ PSEUDONIMIZAÇÃO DE TEXTO ═══');
  const r = await pseudonimizar(PRONTUARIO, { semente: 'TESTE-0001', datas: true, agressivo: false }, null);

  console.log('  entrada: ' + PRONTUARIO.length + ' caracteres');
  console.log('  ' + r.metricas.trocas + ' substituições em ' + r.metricas.entidades +
    ' entidades; ' + r.metricas.suspeitas + ' suspeita(s) para revisão');
  console.log('  categorias: ' + r.metricas.categorias.map((c) => c.cat + '=' + c.trocas).join(' '));

  /* ---- identificadores estruturados ---- */
  console.log('\n  estruturados');
  ok(!r.saida.includes('529.982.247-25'), 'CPF válido saiu do texto');
  ok(!r.saida.includes('700508354788954'), 'CNS válido saiu do texto');
  ok(!r.saida.includes('98765-4321'), 'telefone saiu do texto');
  ok(!r.saida.includes('maria.silva@example.invalid'), 'e-mail saiu do texto');
  ok(!r.saida.includes('04567-890'), 'CEP saiu do texto');
  ok(!r.saida.includes('22/11/1970'), 'data de nascimento saiu do texto');
  ok(!r.saida.includes('99887766'), 'número de prontuário saiu do texto');

  /* ---- validadores recusam o que não é ---- */
  console.log('\n  validadores');
  ok(cpfValido('529.982.247-25'), 'CPF de teste é válido pelo dígito verificador');
  ok(!cpfValido('529.982.247-26'), 'CPF com dígito trocado é recusado');
  ok(!cpfValido('111.111.111-11'), 'CPF de dígitos repetidos é recusado');
  ok(cnsValido('700508354788954'), 'CNS de teste é válido pelo módulo 11');
  ok(!cnsValido('700508354788955'), 'CNS com dígito trocado é recusado');

  /* ---- nomes ---- */
  console.log('\n  nomes de pessoa');
  ok(!r.saida.includes('Maria Aparecida'), 'nome do paciente saiu do texto');
  ok(!r.saida.includes('Carlos Eduardo Pereira'), 'nome do médico saiu do texto');

  /* consistência: a mesma pessoa recebe o mesmo rótulo em todo o documento */
  const rotulosPessoa = [...r.mapa.entries()].filter(([, v]) => v.cat === 'PESSOA');
  const medico = rotulosPessoa.find(([, v]) => /Carlos/.test(v.original));
  ok(!!medico && medico[1].vezes >= 2,
    'o médico citado duas vezes usa um único rótulo (' + (medico ? medico[1].vezes : 0) + ' ocorrências)');

  /* ---- o que NÃO pode ser trocado ---- */
  console.log('\n  vocabulário clínico preservado');
  for (const termo of ['Tomografia Computadorizada', 'Ressonância Magnética',
                       'carcinoma ductal invasivo', '50 Gy em 25 frações', 'estadio IIA']) {
    ok(r.saida.includes(termo), 'preservado: "' + termo + '"');
  }

  /* ---- instituição ---- */
  console.log('\n  instituição');
  ok(!r.saida.includes('Clínica Sao Rafael') || r.saida.includes('[INSTITUICAO'),
    'nome de clínica reconhecido pelo gatilho');

  /* ---- reversão: o teste mais forte ---- */
  console.log('\n  ida e volta');
  const volta = reverter(r.saida, r.mapa);
  ok(volta.saida === PRONTUARIO,
    'reverter devolve o texto original, caractere a caractere' +
    (volta.saida === PRONTUARIO ? '' : ' — divergiu em ' +
      [...PRONTUARIO].findIndex((c, i) => volta.saida[i] !== c)));
  ok(volta.naoReconhecidos.length === 0, 'nenhum rótulo órfão após reverter');

  /* ---- semente separa sessões ---- */
  console.log('\n  semente');
  const r2 = await pseudonimizar(PRONTUARIO, { semente: 'TESTE-0002', datas: true, agressivo: false }, null);
  const rot1 = [...r.mapa.keys()].sort();
  const rot2 = [...r2.mapa.keys()].sort();
  ok(rot1.length === rot2.length && rot1.join() !== rot2.join(),
    'sementes diferentes produzem rótulos diferentes para as mesmas entidades');
  const r3 = await pseudonimizar(PRONTUARIO, { semente: 'TESTE-0001', datas: true, agressivo: false }, null);
  ok(r3.saida === r.saida, 'mesma semente e mesmo texto produzem saída idêntica');

  /* ---- o app confessa o que não pegou ---- */
  console.log('\n  revisão humana');
  ok(r.restos.length > 0,
    'a varredura devolve suspeitas em vez de declarar o texto limpo (' + r.restos.length + ')');
  const temSaoRafael = r.restos.some((s) => /Rafael|Sao/i.test(s.texto)) ||
                       r.saida.includes('[INSTITUICAO');
  ok(temSaoRafael, 'o que não foi substituído aparece na lista de revisão');

  /* Rótulos gerados não são suspeitas; texto do usuário entre colchetes continua
     sendo revisado, inclusive quando coincide com o rótulo da mesma sessão. */
  const opcRevisao = { semente: 'TESTE-REVISAO', datas: true, agressivo: false };
  const soRotulo = await pseudonimizar('Paciente: Maria Silva', opcRevisao, null);
  ok(soRotulo.restos.length === 0,
    'a revisão não confunde fragmentos do rótulo gerado com identificadores restantes');
  const literal = [...soRotulo.mapa.keys()][0];
  const revisarLiteral = await pseudonimizar('Paciente: Maria Silva\napelido Girassol; literal ' + literal +
    '; código [VULCAO-XYZ]; sinal [Girassol]', opcRevisao, null);
  ok(revisarLiteral.restos.some((s) => s.texto === 'Girassol'),
    'apelido real do texto de teste continua na revisão, inclusive entre colchetes');
  ok(revisarLiteral.restos.some((s) => s.texto === 'PESSOA'),
    'rótulo idêntico digitado no original não recebe a exclusão reservada ao intervalo gerado');
  ok(revisarLiteral.restos.some((s) => s.texto === 'VULCAO') &&
    revisarLiteral.restos.some((s) => s.texto === 'XYZ'),
    'colchetes arbitrários do original não ocultam conteúdo da revisão');

  /* ---- taxa de escape declarada ---- */
  console.log('\n  o que escapou, medido');
  const nomesEsperados = ['Maria', 'Aparecida', 'Silva', 'Santos', 'Carlos', 'Eduardo', 'Pereira'];
  const escaparam = nomesEsperados.filter((n) => new RegExp('\\b' + n + '\\b').test(r.saida));
  console.log('   nomes que escaparam: ' + (escaparam.length ? escaparam.join(', ') : 'nenhum') +
    '  (' + escaparam.length + '/' + nomesEsperados.length + ')');
  ok(escaparam.length === 0, 'nenhum componente de nome sobreviveu no texto de saída');

  console.log('\n' + (falhas ? '>>> ' + falhas + ' FALHA(S)' : '>>> tudo passou'));

  /* saída explícita: o agendador cooperativo usa MessageChannel, e em Node uma
     porta com ouvinte mantém o event loop vivo — o processo nunca terminaria.
     No navegador isso não acontece, e trocar o agendador só por causa do teste
     seria deixar o app pior para agradar o banco. */
  process.exit(falhas ? 1 : 0);
})();
