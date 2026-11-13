# Auditoria da publicação — DeFace RT 1.4.1

Data: 13/11/2026.

**Resultado:** não foram encontrados segredos, credenciais ou dados de pacientes
no conteúdo preparado para publicação, no histórico público ou nos exemplos do
pacote. Os candidatos do scanner foram classificados e revisados. A inspeção
independente dos pixels, metadados, licenças e integridade passou.

## Dados DICOM e superfície sintética

Foram inspecionados **856 arquivos DICOM**, em cinco séries, totalizando
**36.688 campos textuais**. Um parser Python independente do leitor do produto
verificou todos os arquivos e confirmou:

- preâmbulos nulos e comprimentos estruturais consistentes;
- sintaxe explícita little endian, sem sequências ou conteúdo após os pixels;
- textos livres pertencentes à lista explícita de valores dos geradores;
- valores numéricos e UIDs em formato previsto;
- tags privadas apenas nos exemplos autorais, limitadas aos dois campos
  fictícios inseridos para ensinar auditoria de cabeçalhos.

Os **33.030.144 pixels** das 768 imagens autorais foram recalculados em Python,
por uma implementação NumPy independente do JavaScript do aplicativo. O recálculo
partiu do campo de distância da superfície, das equações dos tecidos e do PRNG
com semente fixa. Todos os valores coincidiram exatamente, incluindo a anotação
fictícia `DEMO`. Essa igualdade confirma a geração dos pixels a partir dos
insumos auditados, sem introdução de imagens de pacientes.

A superfície externa da cabeça e pescoço deriva da malha paramétrica **hm08**
do MakeHuman, asset gráfico **CC0-1.0** da revisão
`a8bc2d54ff0ac92e78ff71431b1023eda42bf482`. O OBJ de origem declara a licença
no próprio cabeçalho. Somente o grupo corporal na região da cabeça e pescoço foi
usado, sem grupos auxiliares, fotos ou textura. Duas subdivisões Catmull-Clark,
voxelização por paridade e medição de distância aos triângulos foram
implementadas no conversor deste projeto. Nenhum código do MakeHuman foi
importado ou executado.

O campo contém 192 × 224 × 256 voxels de 1 mm, distância quantizada em 0,25 mm
e truncada em ±8 mm. Foi verificado como um único componente, com margem de ar
nas seis bordas e sem raios de paridade ímpar. SHA-256 do campo descompactado:
`8f56d091fd8255b6fa0d67baa3d9e2d92f09f259224c1582a56a368988e15131`.
A procedência e transformação completas estão em `exemplos/anatomia/`.

Os tecidos e intensidades internos são simulados, não segmentações clínicas.
O maior realismo da superfície não valida anatomia interna, eficácia de
desidentificação ou anonimato em pessoas.

Os 88 DICOM públicos mantêm os bytes auditados na entrega anterior. Seus
hashes foram confrontados com a proveniência fixada de **CBCTsynth-RT**,
revisão `ce01a802b2320a703d0bb48e16870315e35640ee`, cujo gerador usa elipsoides
e ruído. Sua licença MIT e seu gerador original acompanham os exemplos.

| Exemplo | DICOM | SHA-256 do ZIP de exemplo |
|---|---:|---|
| TC anatômica sintética | 256 | `21f4f813f8b5fcac8bff8155be2f2f17053dd419ff46bbd76705dbf420c70244` |
| RM anatômica sintética | 256 | `249eacb295a75d5f10c72772ef61f516b3191328cbe699e2a24782f35b9e5bae` |
| TC com anotação fictícia | 256 | `7c06b3daaf50d6c6ca2f85ee4f325e25db0dd0322c40a4b80a71067d7ba2118c` |
| TC pública sintética | 44 | `20bc109afdcc7e981cbb2d641317b355ce81b627c2aaf280cd069d69ad83e49d` |
| CBCT pública sintética | 44 | `196e6283b8019d72b55b456b98d39ae23aa33c0483b57891fa5247d5bb7fb81c` |

## Conteúdo e histórico de publicação

O histórico público iniciou na versão 1.4.0 como um commit raiz separado do
repositório de trabalho, com autor e committer `noreply` do GitHub. A atualização
1.4.1 mantém esse histórico público; o histórico local anterior, que contém
contato pessoal nos metadados, continua fora da publicação.

O scanner `build/auditar_segredos.py` verifica padrões de chaves privadas,
tokens, JWT, autorização, credenciais em URLs, senhas e variáveis de ambiente
sensíveis. Registra também candidatos a e-mail, documentos brasileiros,
caminhos pessoais e imagens médicas. Sua saída não revela valores de possíveis
segredos. Arquivos binários precisam da revisão adicional de proveniência
documentada acima.

Os e-mails e documentos do exemplo Data são declaradamente fictícios; o caso
interativo usa o domínio reservado `.invalid`. CPF e CNS foram escolhidos para
testar formatos e dígitos verificadores e não vieram de prontuários. Créditos
dos autores de assets são atribuições públicas de licença, não dados clínicos.

A árvore pública de **75 arquivos**, os **dois commits** do histórico e todos
os seus objetos alcançáveis foram examinados, assim como as **90 entradas** do
ZIP para o webmaster, incluindo os ZIPs internos de exemplos. Não houve arquivo
compactado omitido por erro, limite de tamanho ou profundidade. Os candidatos
registrados correspondem a e-mails de exemplo, identidade `noreply`, documentos
fictícios dos testes e imagens sintéticas verificadas. Nenhum padrão de segredo,
credencial ou caminho pessoal foi identificado.

Todos os hashes do manifesto foram conferidos. Cada arquivo do snapshot coincide
byte a byte com seu correspondente no pacote. As cópias DICOM e Data em
`programas/`, `downloads/` e `site/` coincidem com os HTMLs montados. Os cinco ZIPs
de exemplos coincidem com os inspecionados pelo auditor Python independente.
A mensagem para Lucas fica apenas na entrega local para Henrique, fora do
repositório público. A cópia avulsa tem o mesmo texto da cópia no ZIP, com
normalização de quebras de linha. Nenhum arquivo de `.git`, cache, ambiente,
log local ou corpo inteiro do OBJ é incluído no ZIP.

Os 29 arquivos alterados ou novos da atualização passaram pela varredura de
conteúdo. Os únicos candidatos registrados foram as 768 imagens DICOM autorais,
verificadas individualmente pelo procedimento acima; nenhum padrão de segredo,
credencial ou caminho pessoal foi encontrado nesses arquivos.

Hashes de referência dos HTMLs finais montados:

| Programa | SHA-256 |
|---|---|
| DeFace RT DICOM | `f09aa9f9d7a213bc684b756290d0a649379665f05329814a7428677eb2e39114` |
| DeFace RT Data | `90b6cd3594d05d5417a69e7eef3c58aa8236c26508cc3619aa7778cc3ff6a566` |

## Isolamento e licenças

A malha é incorporada ao HTML. Somente o comando de preparação explícito
`python build/preparar_anatomia.py --baixar` usa rede para buscar o asset fixado;
o aplicativo não baixa modelos ou exemplos durante o uso. Os programas mantêm
`connect-src 'none'` e `form-action 'none'`, sem envio de exames, analytics ou
armazenamento persistente de dados de usuário.

O código do projeto é MIT. O campo de superfície derivado do MakeHuman é
CC0-1.0. Os textos OFL de Outfit e JetBrains Mono, a licença MIT dos fantomas
públicos e o texto CC0 acompanham a entrega. As licenças aplicáveis também são
incorporadas aos HTMLs. Isso preserva as condições de cada componente.

## Limites da conclusão

Esta é uma verificação de conteúdo, proveniência e integridade, não garantia
matemática de ausência de qualquer segredo possível. O scanner usa padrões
conhecidos e reporta ZIPs que ultrapassem seus limites de tamanho/profundidade
ou não possam ser abertos. Mudanças posteriores nos arquivos, histórico ou
pacote exigem nova verificação. O acesso público e os hashes servidos devem ser
confirmados depois do deploy, antes de anunciar a entrega.
