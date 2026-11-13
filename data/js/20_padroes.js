/* =========================================================================
   Catálogo de padrões

   Duas famílias, com confiança muito diferente:

   ESTRUTURADOS  têm forma fixa e dígito verificador. CPF, CNS e telefone ou
                 são o que dizem ser, ou não são. Falso positivo é raro.

   POR CONTEXTO  nome de pessoa, instituição, lugar. Aqui não existe forma
                 fixa: a detecção é heurística e ERRA NOS DOIS SENTIDOS. É por
                 isso que a interface obriga a revisar, em vez de dizer pronto.
   ========================================================================= */
'use strict';

/* ---- validadores -------------------------------------------------------- */
function digitosDe(s) { return String(s).replace(/\D/g, ''); }

function cpfValido(s) {
  const d = digitosDe(s);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const [ini, pesoIni] of [[9, 10], [10, 11]]) {
    let soma = 0;
    for (let i = 0; i < ini; i++) soma += +d[i] * (pesoIni - i);
    let dig = (soma * 10) % 11;
    if (dig === 10) dig = 0;
    if (dig !== +d[ini]) return false;
  }
  return true;
}

function cnsValido(s) {
  /* Cartão Nacional de Saúde, PCD 11 (PORTARIA 1.560/GM) */
  const d = digitosDe(s);
  if (d.length !== 15) return false;
  let soma = 0;
  for (let i = 0; i < 15; i++) soma += +d[i] * (15 - i);
  return soma % 11 === 0;
}

function cnpjValido(s) {
  const d = digitosDe(s);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (n) => {
    let p = n - 7, soma = 0;
    for (let i = 0; i < n; i++) { soma += +d[i] * p--; if (p < 2) p = 9; }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === +d[12] && calc(13) === +d[13];
}

/* ---- padrões estruturados ------------------------------------------------
   ordem importa: o que é mais específico vem antes.                          */
const PADROES = [
  { cat: 'EMAIL', nome: 'e-mail', risco: 'C',
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },

  { cat: 'URL', nome: 'endereço na internet', risco: 'M',
    re: /\bhttps?:\/\/[^\s<>"']+/gi },

  { cat: 'CPF', nome: 'CPF', risco: 'C',
    re: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, valida: cpfValido },

  { cat: 'CNPJ', nome: 'CNPJ', risco: 'A',
    re: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, valida: cnpjValido },

  { cat: 'CNS', nome: 'cartão do SUS', risco: 'C',
    re: /\b\d{3}[\s.]?\d{4}[\s.]?\d{4}[\s.]?\d{4}\b/g, valida: cnsValido },

  { cat: 'TELEFONE', nome: 'telefone', risco: 'C',
    re: /(?:\+55[\s-]?)?\(?\b\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g,
    valida: (s) => { const d = digitosDe(s); return d.length === 10 || d.length === 11 || d.length === 13; } },

  { cat: 'CRM', nome: 'registro profissional', risco: 'A',
    re: /\b(?:CRM|COREN|CRO|CRF|CREFITO)[\s:/-]*[A-Z]{0,2}[\s:/-]*\d{3,7}\b/gi },

  { cat: 'PRONTUARIO', nome: 'prontuário ou registro', risco: 'C',
    re: /\b(?:prontu[áa]rio|registro|matr[íi]cula|atendimento|RGHC|HC|reg\.?)\s*(?:n[.º°o]*\s*)?[:\-]?\s*([A-Z]{0,3}[\s-]?\d[\d.\-/]{3,})/gi,
    grupo: 1 },

  { cat: 'RG', nome: 'RG', risco: 'C',
    re: /\b(?:RG|identidade|C[ée]dula)\s*(?:n[.º°o]*\s*)?[:\-]?\s*([\d.]{7,12}-?[\dXx]?)/gi,
    grupo: 1 },

  { cat: 'ACESSO', nome: 'número de acesso do exame', risco: 'A',
    re: /\b(?:accession|acesso|acc)\s*[:\-]?\s*([A-Z0-9][\w.-]{5,})/gi, grupo: 1 },

  /* CEP vem DEPOIS dos padrões com rótulo: oito dígitos de prontuário têm a
     mesma forma, e quem traz rótulo explícito é mais específico. */
  { cat: 'CEP', nome: 'CEP', risco: 'A',
    re: /\b\d{5}-?\d{3}\b/g },

  { cat: 'DATA', nome: 'data', risco: 'M', opcional: 'datas',
    re: /\b(?:[0-3]?\d[\/.-][01]?\d[\/.-](?:19|20)?\d{2}|(?:19|20)\d{2}-[01]\d-[0-3]\d)\b/g },

  { cat: 'DATA', nome: 'data por extenso', risco: 'M', opcional: 'datas',
    re: /\b[0-3]?\d\s+de\s+(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(?:19|20)\d{2}\b/gi },

  { cat: 'ENDERECO', nome: 'endereço', risco: 'C',
    re: /\b(?:rua|av\.?|avenida|travessa|alameda|pra[çc]a|rodovia|estrada)\s+[A-ZÁÉÍÓÚÂÊÔÃÕÀÇ][^,;\n]{2,60}?(?:,\s*n?[.º°o]?\s*\d+[A-Za-z]?)?/gi },
];

/* ---- gatilhos de instituição -------------------------------------------- */
const GATILHOS_INSTITUICAO = [
  'hospital', 'hosp\\.', 'clínica', 'clinica', 'santa casa', 'instituto',
  'ambulatório', 'ambulatorio', 'ubs', 'upa', 'policlínica', 'policlinica',
  'maternidade', 'laboratório', 'laboratorio', 'centro de', 'unidade de',
  'faculdade', 'universidade', 'fundação', 'fundacao'
];

/* ---- rótulos que introduzem nome de pessoa ------------------------------ */
const ROTULOS_PESSOA = [
  'paciente', 'nome', 'nome completo', 'nome social', 'responsável', 'responsavel',
  'acompanhante', 'mãe', 'mae', 'pai', 'filiação', 'filiacao', 'cônjuge', 'conjuge',
  'médico', 'medico', 'solicitante', 'executante', 'radiologista', 'assistente',
  'cirurgião', 'cirurgiao', 'físico', 'fisico', 'técnico', 'tecnico',
  'enfermeiro', 'enfermeira', 'requisitante', 'responsável técnico',
  'urologista', 'mastologista', 'oncologista', 'oncologia clínica', 'oncologia clinica',
  'masto', 'onco', 'neurocirurgia', 'encaminhador'
];

const TRATAMENTOS = ['dr', 'dra', 'sr', 'sra', 'srta', 'prof', 'profa'];

/* ---- gatilhos de texto corrido, o formato real da evolução --------------
   Prontuário não vem com "Nome:" — vem com "Encaminhado pelo Dr Fulano",
   "Acompanhada da filha Beltrana", "Mora na Tijuca". Cada entrada é
   [expressão que antecede, categoria do que vem depois].                    */
const GATILHOS_TEXTO = [
  /* quem encaminhou e com quem trata */
  ['encaminhad[oa]s?\\s+(?:pel[oa]s?|para|ao|à|a)\\s*(?:dr|dra|drs)?\\.?', 'PESSOA'],
  ['encaminh[oa]\\s+(?:para|ao|à|a)\\s*(?:dr|dra)?\\.?', 'PESSOA'],
  ['discut[oi]\\s+(?:o\\s+)?caso\\s+com\\s*(?:o|a)?\\s*(?:dr|dra)?\\.?', 'PESSOA'],
  ['(?:passou|consulta|avalia[çc][ãa]o)\\s+com\\s*(?:o|a)?\\s*(?:dr|dra)?\\.?', 'PESSOA'],
  ['segue\\s+(?:em\\s+)?acompanhamento\\s+(?:no|na|com)', 'INSTITUICAO'],

  /* acompanhante e parentesco */
  ['acompanhad[oa]s?\\s+(?:d[oa]s?\\s+)?(?:filh[oa]|esposa|marido|c[ôo]njuge|irm[ãa][oa]?|' +
   'genro|nora|neto|neta|m[ãa]e|pai|sobrinh[oa]|cunhad[oa]|companheir[oa])', 'PESSOA'],
  ['(?:filh[oa]|esposa|marido|irm[ãa][oa]?|genro|nora|m[ãa]e|pai|companheir[oa])\\s+', 'PESSOA'],

  /* especialidade escrita sem dois-pontos: "urologista GILBERTO BUOGO" */
  ['(?:urologista|mastologista|oncologista|radiologista|patologista|nutricionista|' +
   'neurocirurgi[ãa]o|cirurgi[ãa]o|anestesista|odontologista|f[íi]sico|dentista)\\s+', 'PESSOA'],
  ['(?:urologia|mastologia|oncologia|oncologia\\s+cl[íi]nica|radioterapia|nutri[çc][ãa]o|' +
   'neurocirurgia|masto|onco)\\s*(?:=|:|-|com)\\s*(?:dr|dra)?\\.?', 'PESSOA'],

  /* "Acompanhada Fulana (irmã)": o nome vem direto e o parentesco só depois,
     entre parênteses. O gatilho acima exige o parentesco antes. */
  ['acompanhad[oa]s?(?!\\s+(?:d[oa]s?\\s+)?(?:filh|espos|marid|irm|genro|nora|net|m[ãa]e|' +
   'pai|sobrinh|cunhad|companheir|entead|amig))', 'PESSOA'],

  /* unidade que realizou o exame */
  ['unidade\\s*:', 'INSTITUICAO'],
  ['realizad[oa]\\s+(?:n[oa])\\s+', 'INSTITUICAO'],

  /* onde mora */
  ['mora\\s+(?:em|no|na|nos|nas)', 'LOCAL'],
  ['reside\\s+(?:em|no|na)', 'LOCAL'],
  ['residente\\s+(?:em|no|na)', 'LOCAL'],
  ['procedente\\s+d[eoa]s?', 'LOCAL'],
  ['natural\\s+d[eoa]s?', 'LOCAL'],
];

/* ---- operadoras de saúde ------------------------------------------------
   Não identificam sozinhas, mas estreitam muito a coorte — e aparecem soltas
   no cabeçalho da evolução, sem rótulo nenhum.                              */
const CONVENIOS = ('medsenior,amil,bradesco,bradesco saude,sulamerica,sul america,unimed,'
  + 'golden cross,real grandeza,assim,cassi,geap,petrobras,postal saude,notredame,'
  + 'notredame intermedica,intermedica,hapvida,porto seguro,omint,care plus,allianz,'
  + 'sompo,plena,saude caixa,fusex,caberj,assefaz,ameplan,prevent senior,sompo saude,'
  + 'mediservice,gama saude,life empresarial,unafisco,economus,capesesp').split(',');

/* ---- primeiros nomes brasileiros frequentes -----------------------------
   Não é lista de identificação: é reforço de precisão. Uma palavra
   capitalizada que esteja aqui é quase sempre nome de gente.                */
const PRENOMES = new Set(('maria,jose,ana,joao,antonio,francisco,carlos,paulo,pedro,lucas,luiz,'
  + 'marcos,luis,gabriel,rafael,daniel,marcelo,bruno,eduardo,felipe,raimundo,rodrigo,manoel,'
  + 'mateus,fernando,fabio,gustavo,leonardo,andre,julio,ricardo,sergio,alexandre,tiago,thiago,'
  + 'diego,vitor,victor,matheus,guilherme,henrique,igor,samuel,caio,vinicius,arthur,artur,'
  + 'davi,david,enzo,miguel,bernardo,heitor,lorenzo,theo,noah,ravi,murilo,otavio,benicio,'
  + 'anna,adriana,juliana,marcia,marcia,fernanda,patricia,aline,sandra,camila,amanda,bruna,'
  + 'jessica,leticia,julia,luciana,vanessa,mariana,gabriela,vera,rosa,claudia,simone,carla,'
  + 'debora,eliane,cristina,silvia,monica,angela,rita,teresa,tereza,helena,beatriz,laura,'
  + 'manuela,alice,sophia,sofia,isabella,isabela,valentina,cecilia,eloa,heloisa,livia,'
  + 'giovanna,yasmin,lara,mirella,esther,ester,elisa,antonella,rebeca,agatha,clara,'
  + 'joana,paula,renata,tatiane,tatiana,michele,michelle,priscila,viviane,rosana,'
  + 'edson,everton,jonas,elias,moises,isaac,abel,noel,natalia,natali,marta,marlene,'
  + 'irene,ivone,neusa,dirce,zilda,creuza,geralda,aparecida,conceicao,fatima,lourdes,'
  + 'sebastiao,benedito,geraldo,valdir,valter,walter,wagner,washington,wellington,'
  + 'wesley,william,willian,alan,allan,anderson,adriano,alessandro,alexsandro,'
  + 'claudio,cleber,cleiton,denis,dennis,douglas,elton,emerson,fabiano,flavio,'
  + 'genival,gilberto,gilmar,helio,hugo,ivan,jair,jefferson,joel,jorge,juliano,'
  + 'leandro,marcio,mario,mauricio,mauro,nelson,nilton,osmar,osvaldo,oswaldo,'
  + 'reinaldo,renan,roberto,robson,rogerio,ronaldo,rubens,saulo,silvio,tarcisio,'
  + 'valdemar,vagner,waldir,wilson,zeca').split(','));

/* ---- palavras capitalizadas que NÃO são nome próprio --------------------
   Sem esta lista, "Tomografia Computadorizada" vira duas pessoas.           */
const NAO_E_NOME = new Set(('tomografia,computadorizada,ressonancia,magnetica,radiografia,'
  + 'ultrassonografia,ultrassom,mamografia,densitometria,cintilografia,angiografia,'
  + 'endoscopia,colonoscopia,eletrocardiograma,ecocardiograma,eletroencefalograma,'
  + 'hemograma,exame,exames,laudo,relatorio,relatorio,parecer,evolucao,anamnese,'
  + 'diagnostico,hipotese,conduta,prescricao,receita,atestado,encaminhamento,'
  + 'paciente,pacientes,leito,enfermaria,quarto,setor,servico,ambulatorio,'
  + 'consulta,retorno,internacao,alta,admissao,obito,cirurgia,procedimento,'
  + 'contraste,sedacao,anestesia,protocolo,sessao,fracao,dose,campo,alvo,'
  + 'radioterapia,quimioterapia,braquiterapia,imunoterapia,hormonioterapia,'
  + 'carcinoma,adenocarcinoma,sarcoma,linfoma,leucemia,melanoma,metastase,'
  + 'neoplasia,tumor,nodulo,lesao,massa,cisto,fibrose,edema,derrame,'
  + 'pulmao,figado,rim,rins,coracao,cerebro,encefalo,cranio,torax,abdome,'
  + 'pelve,coluna,mama,prostata,intestino,estomago,pancreas,baco,tireoide,'
  + 'esquerda,direita,bilateral,anterior,posterior,superior,inferior,medial,'
  + 'lateral,proximal,distal,cranial,caudal,ventral,dorsal,'
  + 'janeiro,fevereiro,marco,abril,maio,junho,julho,agosto,setembro,outubro,'
  + 'novembro,dezembro,segunda,terca,quarta,quinta,sexta,sabado,domingo,'
  + 'observacao,obs,nota,importante,atencao,resultado,resultados,conclusao,'
  + 'indicacao,tecnica,achados,impressao,comparacao,historia,historico,'
  + 'medicacao,medicamento,posologia,via,oral,endovenosa,intramuscular,'
  + 'normal,normais,alterado,preservado,preservada,ausente,presente,'
  + 'sim,nao,masculino,feminino,idade,anos,meses,dias,peso,altura,'
  + 'hospital,clinica,instituto,centro,unidade,servico,departamento,'
  + 'estadio,estagio,grau,tipo,classe,fase,ciclo,'
  /* especialidades: seguem o nome do medico e nao fazem parte dele */
  + 'oncologia,urologia,mastologia,nutricao,neurocirurgia,cardiologia,'
  /* substantivos de processo: vêm logo depois do gatilho e não são nome.
     Sem eles, "encaminhada para avaliação de hepatocarcinoma" some do texto. */
  + 'avaliacao,avaliacoes,consulta,consultas,seguimento,acompanhamento,tratamento,'
  + 'parecer,interconsulta,discussao,junta,equipe,programacao,'
  + 'indicacao,realizacao,investigacao,estadiamento,reestadiamento,'
  /* mais parentescos */
  + 'enteado,enteada,padrasto,madrasta,amigo,amiga,vizinho,vizinha,'
  + 'endocrinologia,pneumologia,gastroenterologia,ginecologia,'
  /* rótulos de campo: aparecem capitalizados ao lado do nome e seriam engolidos por ele */
  + 'prontuario,registro,matricula,atendimento,cpf,cns,rg,crm,coren,telefone,'
  + 'celular,email,endereco,cep,nascimento,natural,naturalidade,convenio,'
  + 'acompanhante,responsavel,filiacao,leito,quarto,setor,'
  /* parentesco: vem colado ao nome e não faz parte dele */
  + 'filho,filha,filhos,filhas,esposa,esposo,marido,conjuge,irmao,irma,genro,nora,'
  + 'neto,neta,sobrinho,sobrinha,cunhado,cunhada,companheiro,companheira,'
  + 'ap,pa,tc,rm,pet,ct,mr,us,rx,ecg,eeg,eco,sus,cid,tnm,who,oms,inca,'
  + 'gy,cgy,mg,ml,mcg,kg,cm,mm,dr,dra,sr,sra').split(','));

/* estados: úteis como localidade, mas não como nome de pessoa */
const UF = new Set(('AC,AL,AP,AM,BA,CE,DF,ES,GO,MA,MT,MS,MG,PA,PB,PR,PE,PI,RJ,RN,'
  + 'RS,RO,RR,SC,SP,SE,TO').split(','));

/* conectivos que continuam um nome composto */
const CONECTIVOS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
