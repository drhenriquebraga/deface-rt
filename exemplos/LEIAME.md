# Laboratório de pseudonimização

Os exemplos desta pasta foram fabricados por algoritmos. Não são exames de
pacientes. A cabeça modelada permite praticar as operações, mas não mede a
eficácia dos métodos em anatomia humana, em scanner real ou em uso clínico.

O aplicativo contém dois desses casos: TC e RM. Eles são gerados dentro do
navegador, sem conexão, e passam pelo mesmo leitor DICOM de um arquivo aberto.
O código do gerador está em `src/js/75_exemplos.js`.

## Casos e objetivo de cada um

| Arquivo | Conteúdo | Objetivo |
|---|---|---|
| `sinteticos/FANTOMA_TC_SINTETICO.zip` | Cabeça modelada, TC simulada, 256 cortes de 192 × 224 | Comparar os cinco métodos, cortes, 3D, cabeçalhos, geometria e exportações |
| `sinteticos/FANTOMA_RM_SINTETICO.zip` | RM esquemática na mesma geometria | Observar o limiar calculado a partir das intensidades, que não são UH |
| `sinteticos/FANTOMA_TC_TEXTO_NOS_PIXELS.zip` | A mesma TC com a palavra fictícia `DEMO` desenhada nos pixels | Mostrar que limpar cabeçalhos não remove texto da imagem |
| `publicos/cbctsynth-rt/TC_PUBLICA_FANTOMA.zip` | Fantoma público sintético, 44 cortes de 140 × 140 | Exercitar abertura de ZIP compactado, reescala e limites de detecção em geometria sem nariz |
| `publicos/cbctsynth-rt/CBCT_PUBLICA_FANTOMA.zip` | Versão com ruído e artefatos simulados, 44 cortes | Comparar aspecto dos cortes e aprender que uma superfície encontrada não prova anatomia correta |

Abra uma série por vez; não combine os ZIPs. Os dois arquivos públicos declaram
modalidade DICOM **CT**, portanto selecione **TC**, inclusive para o CBCT.

## Roteiro de aula

1. Abra o exemplo de TC pelo botão do aplicativo. Identifique o rótulo de
   exemplo sintético e o indicador de isolamento de rede.
2. Em **Cortes**, percorra os três planos e ajuste janela/nível. Em **3D**,
   gire a superfície e localize nariz, pálpebras, lábios, orelhas e mandíbula.
3. Em **Cabeçalhos**, procure `FANTOMA^SINTETICO`, o identificador fictício,
   a instituição inventada, a data e as duas tags privadas. Esses campos
   foram incluídos deliberadamente para a aula, não são achados de pacientes.
4. Selecione os cinco métodos e processe. Troque o resultado no seletor sem
   perder o original à esquerda. O preenchimento com ruído usa a semente;
   a face genérica utiliza a geometria média do aplicativo.
5. Compare os números em **Geometria facial** com a impressão visual. Uma
   superfície aparentemente diferente pode ter pequeno deslocamento medido.
   Não interprete nenhuma medida como porcentagem de anonimização.
6. Compare os cabeçalhos antes/depois: nomes e identificadores mudam, tags
   privadas são removidas, UIDs são renovados. Alguns quase-identificadores
   permanecem. Leia a explicação da ação aplicada a cada campo.
7. Exporte em **DICOM**, abra o ZIP resultante novamente e confira a geometria,
   os valores e os metadados. Exporte em **NIfTI** e confira o arquivo em um
   visualizador compatível. O DeFace RT não é um importador NIfTI.
8. Repita com o exemplo de RM. A distribuição de intensidades é apenas
   esquemática; observe o limiar automático, sem atribuir UH aos valores.
9. Abra `FANTOMA_TC_TEXTO_NOS_PIXELS.zip` e veja o alerta de anotação queimada.
   Nos cortes, procure `DEMO` no canto. Ela permanece após a limpeza do
   cabeçalho: o app não é uma ferramenta de remoção de texto nos pixels.
10. Abra os dois fantomas públicos, separadamente. Eles não têm um nariz
    anatômico, embora o algoritmo possa localizar um ponto e não emitir
    aviso. **A ausência de aviso não confirma adequação do exame.** Use-os
    para discutir os limites de um detector geométrico e inspecionar o ZIP.

## Origem e redistribuição

Os três ZIPs em `sinteticos/` são gerados pelo código deste projeto. A superfície
vem da malha humana modelada do MakeHuman, sob CC0, recortada para cabeça e
pescoço. Ela não foi obtida de uma fotografia ou exame de pessoa. A origem,
revisão, licença, transformações e hashes estão em `anatomia/PROVENIENCIA.json`.
Os tecidos internos, intensidades de TC/RM, ruído, datas, nomes e identificadores
são simulações didáticas autorais. O realismo da superfície não torna os cortes
diagnosticamente corretos. A resolução é 192 × 224 × 256, com voxels de 1 mm.

O modelo compacto está embutido no HTML e é descompactado localmente. O gerador
cria arquivos DICOM reais, lidos pelo mesmo importador usado em séries externas.
O visor renderiza esses pixels, inclusive depois dos métodos; não usa uma foto
sobreposta para ilustrar um resultado que não existe no volume.

Os dois ZIPs em `publicos/cbctsynth-rt/` foram **baixados** do projeto
[CBCTsynth-RT de Saifeldein](https://github.com/saifeldein0/cbctsynth-rt),
revisão `ce01a802b2320a703d0bb48e16870315e35640ee`, consultada em 13/11/2026.
O [gerador público](https://github.com/saifeldein0/cbctsynth-rt/blob/ce01a802b2320a703d0bb48e16870315e35640ee/sample_data/make_dummy_data.py)
constrói elipsoides e ruído; não parte de exames reais. A
[licença MIT](https://github.com/saifeldein0/cbctsynth-rt/blob/ce01a802b2320a703d0bb48e16870315e35640ee/LICENSE)
foi preservada ao lado dos arquivos e dentro de cada ZIP. O empacotamento foi
refeito, mas os 88 arquivos DICOM mantêm os bytes da origem. Não há qualquer
associação, certificação ou endosso entre os projetos.

`PROVENIENCIA.json` registra URLs, revisão, tamanhos e SHA-256 de cada DICOM
e ZIP público. `AUDITORIA.json` registra a inspeção de todos os campos de
texto e a montagem das duas séries. Foram rejeitados campos livres que não
correspondam ao gerador, preâmbulos não vazios, tags privadas e sequências
inesperadas. Os cortes centrais foram também inspecionados visualmente.
Essa auditoria documenta estas amostras; não é um teste universal de PHI.

## Reproduzir e verificar

```text
node build/gerar_exemplos.js
node testes/teste_exemplos.js --relatorio
python build/baixar_exemplos_publicos.py
node testes/teste_publicos.js
```

Para reconstruir o modelo embutido a partir da malha original fixada, execute
`python build/preparar_anatomia.py --baixar`. Esta preparação requer NumPy/SciPy e rede;
não é necessária para abrir o aplicativo nem para gerar os DICOM offline.

Os comandos `baixar_exemplos_publicos.py` e `preparar_anatomia.py --baixar`
acessam a rede durante a preparação do pacote. Usam revisões fixas e obtêm
somente os dados e documentos de origem; não executam código externo.
O programa final continua offline e não baixa exemplos durante o uso.

Os testes autorais cobrem TC/RM × cinco métodos, mudança mensurável de
superfície, determinismo do caso, identificação fictícia, tags privadas,
escrita/releitura DICOM e cabeçalho/tamanho do NIfTI. O caso anotado verifica
que o alerta aparece e que a limpeza de cabeçalho não apaga `DEMO`.
Renderização, teclado, downloads e isolamento são verificados separadamente
nos testes de navegador da entrega. A coleção não cobre todas as sintaxes
DICOM nem prova anonimato ou validade clínica.
