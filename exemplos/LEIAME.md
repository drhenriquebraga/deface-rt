# Laboratório de pseudonimização

O exemplo inicial do aplicativo é uma **TC real pública**, o caso Pat8 da
Medical Augmented Reality Facial Data Collection v2. A coleção tem licença
CC BY 4.0 e declaração dos autores sobre consentimento para publicação dos
dados faciais identificáveis. Fonte, evidência de autorização, transformações
e hashes estão em `publicos/mar-facial-pat8/`.

O volume preparado mede **208 × 260 × 53** voxels, com espaçamento de
**0,976562 × 0,976562 × 3,0 mm**. É um recorte dos pixels originais, sem
reamostragem ou preenchimento. A parte superior do crânio já está ausente na
fonte pública. O caso não é sintético e não deve ser anunciado como face anônima.

O aplicativo abre o exame sem transformação e mostra **cinco cards excludentes**.
Cada clique executa somente o método escolhido, sempre sobre o volume original.
Escolher outro card substitui o resultado; não acumula transformações nem
executa os cinco algoritmos em lote. A finalidade é entender as diferenças.

## Casos e objetivo de cada um

| Material | Conteúdo | Objetivo |
|---|---|---|
| Caso embutido Pat8; proveniência em `publicos/mar-facial-pat8/` | TC real pública, recorte de 53 cortes de 208 × 260 | Explorar face real e comparar um método por vez, cortes, 3D, cabeçalhos de conversão e exportações |
| `sinteticos/FANTOMA_TC_SINTETICO.zip` | Cabeça modelada, TC simulada, 256 cortes de 192 × 224 | Material auxiliar para testes e demonstração de identificadores fictícios e tags privadas |
| `sinteticos/FANTOMA_RM_SINTETICO.zip` | RM esquemática na mesma geometria | Observar limiar por intensidade, sem atribuir UH aos valores |
| `sinteticos/FANTOMA_TC_TEXTO_NOS_PIXELS.zip` | TC simulada com a palavra fictícia `DEMO` gravada nos pixels | Mostrar que limpar cabeçalhos não remove texto da imagem |
| `publicos/cbctsynth-rt/TC_PUBLICA_FANTOMA.zip` | Fantoma público sintético, 44 cortes de 140 × 140 | Exercitar ZIP compactado, reescala e limites do detector em geometria sem nariz |
| `publicos/cbctsynth-rt/CBCT_PUBLICA_FANTOMA.zip` | Versão sintética com ruído e artefatos, 44 cortes | Comparar cortes e discutir limites de uma superfície encontrada pelo algoritmo |

Os fantomas das versões anteriores permanecem em arquivos auxiliares e testes;
não são opções do exemplo inicial. Abra uma série por vez. Os dois fantomas
CBCTsynth-RT declaram modalidade DICOM **CT**; selecione **TC**, inclusive para
o CBCT. O exemplo textual do aplicativo Data é fictício e independente da TC.

## Roteiro de aula com a TC real

1. Use **Explorar TC real**. Leia a fonte e a licença, identifique o rótulo de
   caso real público e confira o indicador de isolamento de rede.
2. Antes de escolher qualquer card, percorra **Cortes** e gire o **3D**.
   Localize a face e observe o limite superior do volume, sem calota completa.
3. Escolha **Plano de corte**. Compare o original à esquerda e o resultado
   à direita, que usam a mesma escala. Leia a explicação do card.
4. Escolha, em sequência, **Recorte de face**, **Preenchimento com ruído**,
   **Suavização de superfície** e **Face genérica**. Só um card permanece ativo.
   Cada método parte da TC original; o anterior não é aplicado novamente.
5. Compare as medidas em **Geometria facial** com a impressão visual. Uma
   mudança de aparência pode conservar geometria. Nenhuma medida representa
   porcentagem de anonimização ou probabilidade de reconhecimento.
6. Em **Cabeçalhos**, examine os metadados de conversão e de proveniência.
   Eles não são os cabeçalhos clínicos originais do paciente. Ao exportar,
   confira os identificadores e UIDs de saída e a descrição do método.
7. Depois de revisar o resultado, exporte em **DICOM** e reabra o ZIP para
   conferir pixels, geometria e cabeçalhos. Exporte em **NIfTI** e abra em um
   visualizador compatível; o DeFace RT não importa NIfTI.
8. Troque de card ou de limiar e observe a invalidação da revisão anterior.
   Revise a nova saída antes de exportar. O exemplo ensina diferenças entre
   métodos; não valida anonimato ou uso clínico.

## Exercícios auxiliares

Nos fantomas TC/RM, procure `FANTOMA^SINTETICO`, identificadores fictícios,
instituição inventada e tags privadas. Foram inseridos deliberadamente para
ensinar a limpeza de cabeçalhos e não vieram de prontuários. No fantoma de RM,
as intensidades são simuladas e não são unidades Hounsfield.

No arquivo `FANTOMA_TC_TEXTO_NOS_PIXELS.zip`, procure `DEMO` nos cortes e o
alerta de anotação queimada. A palavra permanece após a limpeza do cabeçalho:
o aplicativo não é uma ferramenta de remoção de texto dos pixels.

Os fantomas públicos CBCTsynth-RT não têm nariz anatômico. O detector pode
encontrar um ponto sem emitir aviso; isso não confirma adequação do volume.

## Origem e redistribuição

O caso real Pat8 provém de [Egger, Gsaxner e Wallner, Figshare v2](https://doi.org/10.6084/m9.figshare.8857007.v2).
Preserve o crédito, a [licença CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
e a indicação das alterações. O LEIAME e a proveniência em
`publicos/mar-facial-pat8/` registram os termos e as três citações solicitadas
pelo banco. A licença MIT do código não substitui a licença desse dado.

Os três ZIPs em `sinteticos/` são gerados pelo código do projeto. A superfície
vem do asset MakeHuman hm08, sob CC0, com cabeça e pescoço modelados. Os tecidos,
intensidades, ruído, datas e identificadores são simulações didáticas.
`anatomia/PROVENIENCIA.json` registra origem, revisão, licença e transformações.

Os dois ZIPs de `publicos/cbctsynth-rt/` foram baixados de
[CBCTsynth-RT](https://github.com/saifeldein0/cbctsynth-rt), revisão
`ce01a802b2320a703d0bb48e16870315e35640ee`, sob MIT. Seus 88 DICOM mantêm os
bytes da origem. Proveniência, licença, gerador e auditoria específicos
acompanham esses arquivos. São elipsoides e ruído, não exames de pacientes.

Não há associação ou endosso dos autores dessas fontes ao DeFace RT.

## Reproduzir e verificar

Preparação do caso real a partir da revisão e dos hashes fixados:

```text
python build/preparar_caso_publico.py --baixar
```

O conversor requer NumPy. Também aceita `--origem caminho/Pat8.zip` para
preparação sem download. O aplicativo usa o volume compactado embutido e
não baixa o caso durante o uso.

Preparação e verificação dos materiais sintéticos auxiliares:

```text
node build/gerar_exemplos.js
node testes/teste_exemplos.js --relatorio
python build/baixar_exemplos_publicos.py
node testes/teste_publicos.js
```

Para reconstruir o modelo sintético a partir da malha original fixada, use
`python build/preparar_anatomia.py --baixar`, com NumPy/SciPy. Os comandos de
preparação que baixam fontes usam rede e não executam código externo.
O aplicativo final continua offline.

O escopo dos testes da entrega está em `docs/VALIDACAO.md`. As verificações
de código, conteúdo, geometria e navegação não cobrem todas as sintaxes DICOM,
fabricantes ou navegadores, nem provam anonimato ou validade clínica.
