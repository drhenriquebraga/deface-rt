/* =========================================================================
   Dicionário de atributos DICOM
   Cada entrada: [VR, nome em pt-BR, risco, ação]

   risco : C crítico | A alto | M médio (quase-identificador) | B baixo
   ação  : conforme DICOM PS3.15 Anexo E, Perfil Básico de Confidencialidade
           X  remover
           Z  substituir por valor vazio
           D  substituir por valor fictício não vazio
           U  substituir por novo identificador único, coerente na série
           K  manter (necessário à geometria ou à leitura da imagem)
   ========================================================================= */
'use strict';

const DIC = {
  /* --- meta de arquivo (grupo 0002) --- */
  '00020000': ['UL', 'Comprimento do grupo de meta', 'B', 'K'],
  '00020001': ['OB', 'Versão do meta de arquivo', 'B', 'K'],
  '00020002': ['UI', 'Classe SOP do meio de armazenamento', 'B', 'K'],
  '00020003': ['UI', 'Instância SOP do meio de armazenamento', 'B', 'U'],
  '00020010': ['UI', 'Sintaxe de transferência', 'B', 'K'],
  '00020012': ['UI', 'Classe de implementação', 'B', 'K'],
  '00020013': ['SH', 'Versão da implementação', 'B', 'K'],
  '00020016': ['AE', 'Título AE de origem', 'A', 'X'],

  /* --- identificação do estudo e do equipamento --- */
  '00080005': ['CS', 'Conjunto de caracteres', 'B', 'K'],
  '00080008': ['CS', 'Tipo de imagem', 'B', 'K'],
  '00080012': ['DA', 'Data de criação da instância', 'A', 'X'],
  '00080013': ['TM', 'Hora de criação da instância', 'A', 'X'],
  '00080014': ['UI', 'Identificador do criador da instância', 'A', 'U'],
  '00080016': ['UI', 'Classe SOP', 'B', 'K'],
  '00080018': ['UI', 'Instância SOP', 'C', 'U'],
  '00080020': ['DA', 'Data do estudo', 'A', 'Z'],
  '00080021': ['DA', 'Data da série', 'A', 'X'],
  '00080022': ['DA', 'Data da aquisição', 'A', 'X'],
  '00080023': ['DA', 'Data do conteúdo', 'A', 'Z'],
  '0008002A': ['DT', 'Data e hora da aquisição', 'A', 'X'],
  '00080030': ['TM', 'Hora do estudo', 'A', 'Z'],
  '00080031': ['TM', 'Hora da série', 'A', 'X'],
  '00080032': ['TM', 'Hora da aquisição', 'A', 'X'],
  '00080033': ['TM', 'Hora do conteúdo', 'A', 'Z'],
  '00080050': ['SH', 'Número do exame (accession)', 'C', 'Z'],
  '00080060': ['CS', 'Modalidade', 'B', 'K'],
  '00080070': ['LO', 'Fabricante', 'M', 'K'],
  '00080080': ['LO', 'Instituição', 'C', 'X'],
  '00080081': ['ST', 'Endereço da instituição', 'C', 'X'],
  '00080082': ['SQ', 'Código da instituição', 'C', 'X'],
  '00080090': ['PN', 'Médico solicitante', 'C', 'Z'],
  '00080092': ['ST', 'Endereço do solicitante', 'C', 'X'],
  '00080094': ['SH', 'Telefone do solicitante', 'C', 'X'],
  '00080096': ['SQ', 'Identificação do solicitante', 'C', 'X'],
  '0008009C': ['PN', 'Médico laudador', 'C', 'Z'],
  '00081010': ['SH', 'Nome da estação', 'A', 'X'],
  '00081030': ['LO', 'Descrição do estudo', 'M', 'K'],
  '00081032': ['SQ', 'Código do procedimento', 'M', 'X'],
  '0008103E': ['LO', 'Descrição da série', 'M', 'K'],
  '00081040': ['LO', 'Departamento na instituição', 'A', 'X'],
  '00081048': ['PN', 'Médico responsável', 'C', 'X'],
  '00081049': ['SQ', 'Identificação do responsável', 'C', 'X'],
  '00081050': ['PN', 'Médico executante', 'C', 'X'],
  '00081052': ['SQ', 'Identificação do executante', 'C', 'X'],
  '00081060': ['PN', 'Médico que leu o estudo', 'C', 'X'],
  '00081070': ['PN', 'Operador do equipamento', 'A', 'X'],
  '00081072': ['SQ', 'Identificação do operador', 'A', 'X'],
  '00081080': ['LO', 'Diagnóstico de admissão', 'C', 'X'],
  '00081084': ['SQ', 'Código do diagnóstico de admissão', 'C', 'X'],
  '00081090': ['LO', 'Modelo do equipamento', 'M', 'K'],
  '00081110': ['SQ', 'Sequência de estudo referenciado', 'A', 'X'],
  '00081111': ['SQ', 'Sequência de etapa referenciada', 'A', 'X'],
  '00081115': ['SQ', 'Sequência de série referenciada', 'A', 'X'],
  '00081120': ['SQ', 'Sequência de paciente referenciado', 'C', 'X'],
  '00081140': ['SQ', 'Sequência de imagem referenciada', 'A', 'X'],
  '00081155': ['UI', 'Instância SOP referenciada', 'A', 'U'],
  '00082111': ['ST', 'Descrição da derivação', 'M', 'X'],
  '00082112': ['SQ', 'Sequência de origem da imagem', 'A', 'X'],

  /* --- paciente --- */
  '00100010': ['PN', 'Nome do paciente', 'C', 'D'],
  '00100020': ['LO', 'Prontuário do paciente', 'C', 'D'],
  '00100021': ['LO', 'Emissor do prontuário', 'C', 'X'],
  '00100024': ['SQ', 'Identificador universal do paciente', 'C', 'X'],
  '00100030': ['DA', 'Data de nascimento', 'C', 'Z'],
  '00100032': ['TM', 'Hora de nascimento', 'C', 'X'],
  '00100040': ['CS', 'Sexo', 'M', 'K'],
  '00101000': ['LO', 'Outros prontuários', 'C', 'X'],
  '00101001': ['PN', 'Outros nomes do paciente', 'C', 'X'],
  '00101002': ['SQ', 'Outros identificadores do paciente', 'C', 'X'],
  '00101005': ['PN', 'Nome de nascimento', 'C', 'X'],
  '00101010': ['AS', 'Idade', 'M', 'K'],
  '00101020': ['DS', 'Altura', 'M', 'X'],
  '00101030': ['DS', 'Peso', 'M', 'X'],
  '00101040': ['LO', 'Endereço do paciente', 'C', 'X'],
  '00101060': ['PN', 'Nome da mãe', 'C', 'X'],
  '00101080': ['LO', 'Situação militar', 'A', 'X'],
  '00101090': ['LO', 'Registro em plano de saúde', 'C', 'X'],
  '00102000': ['LO', 'Alergias', 'C', 'X'],
  '00102110': ['LO', 'Alergia a contraste', 'C', 'X'],
  '00102150': ['LO', 'País de residência', 'A', 'X'],
  '00102152': ['LO', 'Região de residência', 'A', 'X'],
  '00102154': ['SH', 'Telefone do paciente', 'C', 'X'],
  '00102160': ['SH', 'Grupo étnico', 'C', 'X'],
  '00102180': ['SH', 'Ocupação', 'C', 'X'],
  '001021A0': ['CS', 'Tabagismo', 'M', 'X'],
  '001021B0': ['LT', 'Histórico médico adicional', 'C', 'X'],
  '001021C0': ['US', 'Situação gestacional', 'C', 'X'],
  '001021D0': ['DA', 'Data da última menstruação', 'C', 'X'],
  '001021F0': ['LO', 'Religião', 'C', 'X'],
  '00104000': ['LT', 'Comentários sobre o paciente', 'C', 'X'],
  '00120010': ['LO', 'Patrocinador do estudo clínico', 'A', 'X'],
  '00120020': ['LO', 'Protocolo do estudo clínico', 'A', 'X'],
  '00120030': ['LO', 'Identificação do centro', 'A', 'X'],
  '00120040': ['LO', 'Identificação do sujeito de pesquisa', 'C', 'X'],
  '00120042': ['LO', 'Leitura do sujeito de pesquisa', 'C', 'X'],

  /* --- aquisição --- */
  '00180010': ['LO', 'Agente de contraste', 'M', 'K'],
  '00180015': ['CS', 'Parte do corpo examinada', 'M', 'K'],
  '00180020': ['CS', 'Sequência de pulso (RM)', 'B', 'K'],
  '00180021': ['CS', 'Variante da sequência', 'B', 'K'],
  '00180022': ['CS', 'Opções de varredura', 'B', 'K'],
  '00180023': ['CS', 'Aquisição MR', 'B', 'K'],
  '00180050': ['DS', 'Espessura de corte', 'B', 'K'],
  '00180060': ['DS', 'kVp', 'B', 'K'],
  '00180080': ['DS', 'Tempo de repetição', 'B', 'K'],
  '00180081': ['DS', 'Tempo de eco', 'B', 'K'],
  '00180087': ['DS', 'Intensidade do campo', 'B', 'K'],
  '00180088': ['DS', 'Espaçamento entre cortes', 'B', 'K'],
  '00181000': ['LO', 'Número de série do equipamento', 'A', 'X'],
  '00181020': ['LO', 'Versão do software', 'M', 'K'],
  '00181030': ['LO', 'Nome do protocolo', 'M', 'K'],
  '00181100': ['DS', 'Diâmetro de reconstrução', 'B', 'K'],
  '00181110': ['DS', 'Distância fonte-detector', 'B', 'K'],
  '00181120': ['DS', 'Ângulo do gantry', 'B', 'K'],
  '00181150': ['IS', 'Tempo de exposição', 'B', 'K'],
  '00181151': ['IS', 'Corrente do tubo', 'B', 'K'],
  '00181152': ['IS', 'Exposição', 'B', 'K'],
  '00181160': ['SH', 'Tipo de filtro', 'B', 'K'],
  '00181210': ['SH', 'Kernel de reconstrução', 'M', 'K'],
  '00181250': ['SH', 'Bobina receptora', 'B', 'K'],
  '00181251': ['SH', 'Bobina transmissora', 'B', 'K'],
  '00185100': ['CS', 'Posição do paciente', 'B', 'K'],
  '0018700A': ['SH', 'Identificação do detector', 'A', 'X'],
  '0018700C': ['DA', 'Data de calibração do detector', 'A', 'X'],
  '00189424': ['LT', 'Descrição do protocolo de aquisição', 'M', 'X'],

  /* --- geometria (essencial: nunca removida) --- */
  '0020000D': ['UI', 'Instância do estudo', 'C', 'U'],
  '0020000E': ['UI', 'Instância da série', 'C', 'U'],
  '00200010': ['SH', 'Identificação do estudo', 'A', 'Z'],
  '00200011': ['IS', 'Número da série', 'B', 'K'],
  '00200012': ['IS', 'Número da aquisição', 'B', 'K'],
  '00200013': ['IS', 'Número da instância', 'B', 'K'],
  '00200020': ['CS', 'Orientação do paciente', 'B', 'K'],
  '00200032': ['DS', 'Posição da imagem no paciente', 'B', 'K'],
  '00200037': ['DS', 'Orientação da imagem no paciente', 'B', 'K'],
  '00200052': ['UI', 'Referencial de coordenadas', 'A', 'U'],
  '00200060': ['CS', 'Lateralidade', 'B', 'K'],
  '00201040': ['LO', 'Referência de posição', 'B', 'K'],
  '00201041': ['DS', 'Posição do corte', 'B', 'K'],
  '00204000': ['LT', 'Comentários da imagem', 'C', 'X'],

  /* --- pixel --- */
  '00280002': ['US', 'Amostras por pixel', 'B', 'K'],
  '00280004': ['CS', 'Interpretação fotométrica', 'B', 'K'],
  '00280006': ['US', 'Configuração do plano', 'B', 'K'],
  '00280008': ['IS', 'Número de quadros', 'B', 'K'],
  '00280010': ['US', 'Linhas', 'B', 'K'],
  '00280011': ['US', 'Colunas', 'B', 'K'],
  '00280030': ['DS', 'Espaçamento entre pixels', 'B', 'K'],
  '00280100': ['US', 'Bits alocados', 'B', 'K'],
  '00280101': ['US', 'Bits armazenados', 'B', 'K'],
  '00280102': ['US', 'Bit mais significativo', 'B', 'K'],
  '00280103': ['US', 'Representação do pixel', 'B', 'K'],
  '00280106': ['US', 'Menor valor presente', 'B', 'K'],
  '00280107': ['US', 'Maior valor presente', 'B', 'K'],
  '00280301': ['CS', 'Anotação queimada na imagem', 'C', 'K'],
  '00280303': ['CS', 'Remoção de identificação já feita', 'B', 'K'],
  '00281050': ['DS', 'Centro da janela', 'B', 'K'],
  '00281051': ['DS', 'Largura da janela', 'B', 'K'],
  '00281052': ['DS', 'Intercepto de reescala', 'B', 'K'],
  '00281053': ['DS', 'Inclinação de reescala', 'B', 'K'],
  '00281054': ['LO', 'Tipo de reescala', 'B', 'K'],
  '00282110': ['CS', 'Compressão com perda', 'B', 'K'],
  '00282112': ['DS', 'Razão de compressão', 'B', 'K'],
  '00284000': ['LT', 'Comentários do grupo de pixels', 'A', 'X'],

  /* --- procedimento e agendamento --- */
  '00321032': ['PN', 'Médico requisitante', 'C', 'X'],
  '00321033': ['LO', 'Instituição requisitante', 'C', 'X'],
  '00321060': ['LO', 'Descrição do procedimento requisitado', 'M', 'X'],
  '00380010': ['LO', 'Identificação de admissão', 'C', 'X'],
  '00380011': ['LO', 'Emissor da identificação de admissão', 'C', 'X'],
  '00380020': ['DA', 'Data de admissão', 'C', 'X'],
  '00380021': ['TM', 'Hora de admissão', 'C', 'X'],
  '00380040': ['LO', 'Situação de internação', 'C', 'X'],
  '00380050': ['LO', 'Estado especial do paciente', 'C', 'X'],
  '00380060': ['LO', 'Identificação do serviço', 'C', 'X'],
  '00380300': ['LO', 'Localização atual do paciente', 'C', 'X'],
  '00380400': ['LO', 'Instituição de origem', 'C', 'X'],
  '00380500': ['LO', 'Estado do paciente', 'C', 'X'],
  '00384000': ['LT', 'Comentários da visita', 'C', 'X'],
  '00400241': ['AE', 'Título AE da estação executante', 'A', 'X'],
  '00400242': ['SH', 'Nome da estação executante', 'A', 'X'],
  '00400243': ['SH', 'Local da estação executante', 'A', 'X'],
  '00400244': ['DA', 'Data de início do procedimento', 'A', 'X'],
  '00400245': ['TM', 'Hora de início do procedimento', 'A', 'X'],
  '00400253': ['SH', 'Identificação da etapa do procedimento', 'A', 'X'],
  '00400254': ['LO', 'Descrição da etapa do procedimento', 'M', 'X'],
  '00400275': ['SQ', 'Sequência de atributos requisitados', 'C', 'X'],
  '00400280': ['ST', 'Comentários da etapa', 'C', 'X'],
  '00401001': ['SH', 'Identificação do procedimento requisitado', 'C', 'X'],
  '00401400': ['LT', 'Comentários do serviço requisitado', 'C', 'X'],
  '0040A075': ['PN', 'Observador que verificou', 'C', 'X'],
  '0040A123': ['PN', 'Nome do observador', 'C', 'X'],
  '0040A730': ['SQ', 'Sequência de conteúdo estruturado', 'C', 'X'],

  /* --- remoção de identificação --- */
  '00120062': ['CS', 'Paciente desidentificado', 'B', 'K'],
  '00120063': ['LO', 'Método de desidentificação', 'B', 'K'],
  '00120064': ['SQ', 'Código do método de desidentificação', 'B', 'K'],
  '04000561': ['SQ', 'Sequência de atributos originais', 'C', 'X'],

  /* --- dados de pixel --- */
  '7FE00010': ['OW', 'Dados de pixel', 'C', 'K']
};

/* Nomes dos níveis de risco, para a interface */
const RISCO_NOME = { C: 'Crítico', A: 'Alto', M: 'Quase-id.', B: 'Baixo' };
const RISCO_CLS = { C: 'crit', A: 'alto', M: 'medio', B: 'baixo' };
const ACAO_NOME = {
  X: 'removido', Z: 'esvaziado', D: 'substituído',
  U: 'novo identificador', K: 'mantido', P: 'privado — removido'
};

/* Sintaxes de transferência reconhecidas */
const TS = {
  '1.2.840.10008.1.2': { nome: 'Implícito VR Little Endian', expl: false, be: false, enc: false, ok: true },
  '1.2.840.10008.1.2.1': { nome: 'Explícito VR Little Endian', expl: true, be: false, enc: false, ok: true },
  '1.2.840.10008.1.2.1.99': { nome: 'Explícito VR LE deflacionado', expl: true, be: false, enc: false, ok: true, defl: true },
  '1.2.840.10008.1.2.2': { nome: 'Explícito VR Big Endian', expl: true, be: true, enc: false, ok: true },
  '1.2.840.10008.1.2.5': { nome: 'RLE sem perdas', expl: true, be: false, enc: true, ok: true, cod: 'rle' },
  '1.2.840.10008.1.2.4.50': { nome: 'JPEG linha de base', expl: true, be: false, enc: true, ok: true, cod: 'jpeg8' },
  '1.2.840.10008.1.2.4.57': { nome: 'JPEG sem perdas', expl: true, be: false, enc: true, ok: true, cod: 'jpegls14' },
  '1.2.840.10008.1.2.4.70': { nome: 'JPEG sem perdas SV1', expl: true, be: false, enc: true, ok: true, cod: 'jpegls14' },
  '1.2.840.10008.1.2.4.51': { nome: 'JPEG estendido 12 bits', expl: true, be: false, enc: true, ok: false },
  '1.2.840.10008.1.2.4.80': { nome: 'JPEG-LS sem perdas', expl: true, be: false, enc: true, ok: false },
  '1.2.840.10008.1.2.4.81': { nome: 'JPEG-LS quase sem perdas', expl: true, be: false, enc: true, ok: false },
  '1.2.840.10008.1.2.4.90': { nome: 'JPEG 2000 sem perdas', expl: true, be: false, enc: true, ok: false },
  '1.2.840.10008.1.2.4.91': { nome: 'JPEG 2000', expl: true, be: false, enc: true, ok: false }
};

/* VRs de comprimento longo: cabeçalho de 12 bytes em VR explícito */
const VR_LONGO = new Set(['OB', 'OW', 'OF', 'OD', 'OL', 'OV', 'SQ', 'UT', 'UN', 'OB or OW']);
/* VRs cujo valor é texto */
const VR_TEXTO = new Set(['AE', 'AS', 'CS', 'DA', 'DS', 'DT', 'IS', 'LO', 'LT',
  'PN', 'SH', 'ST', 'TM', 'UC', 'UI', 'UR', 'UT']);
