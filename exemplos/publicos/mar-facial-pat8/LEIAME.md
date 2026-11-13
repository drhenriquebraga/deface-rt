# TC real pública — Pat8

Este exemplo contém uma **tomografia real**, proveniente do banco
[Medical Augmented Reality Facial Data Collection](https://doi.org/10.6084/m9.figshare.8857007.v2),
versão 2, publicado por **Jan Egger, Christina Gsaxner e Jürgen Wallner (2019)**.
O código `Pat8` é o identificador público do banco, não o nome da pessoa.

## Licença e consentimento para dados faciais

O dataset é distribuído sob [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
A licença permite redistribuição e adaptação com crédito, link para a licença e
indicação das alterações. O texto integral está em `LICENSES/CC-BY-4.0.txt`.
As condições desse dado são independentes da licença MIT do código do DeFace RT.

O [artigo descritivo dos autores](https://pmc.ncbi.nlm.nih.gov/articles/PMC6901520/)
informa aprovação ética, consentimento de todos os participantes e consentimento
para publicar os dados identificáveis e modelos faciais. A própria coleção foi
criada para reconstrução 3D e aplicações de realidade aumentada da face.
Essa evidência é uma declaração pública dos pesquisadores; os formulários
individuais de consentimento não estão anexados ao DeFace RT.

Consultamos o artigo, a API oficial do Figshare e a licença em **13/11/2026**.
Não houve contato com participantes nem tentativa de descobrir sua identidade.
Mesmo sem nomes ou prontuários, a forma facial pode ser reconhecível. Por isso,
este caso não deve ser anunciado como dado sintético ou anonimamente garantido.

## O que foi preparado

- Entrada: `Pat8/Pat8_CT.nrrd`, no arquivo oficial `Pat8.zip`.
- Volume original: 512 × 512 × 83; eixos LPS ortogonais.
- Recorte: índices X `[166,374)`, Y `[82,342)`, Z `[30,83)`.
- Saída: **208 × 260 × 53** voxels, **0,976562 × 0,976562 × 3,0 mm**.
- Nenhuma reamostragem, suavização, troca de intensidade ou preenchimento.
  Os valores int16 são preservados; todos os pixels do recorte foram
  comparados aos pixels de origem.
- Somente geometria e pixels do NRRD são utilizados. O aplicativo não importa
  nomes, datas, UIDs ou outros cabeçalhos dos DICOM do arquivo original.
- Coordenadas são escritas com até seis casas decimais para evitar resíduos de
  ponto flutuante e respeitar a representação decimal DICOM.

O recorte mantém face, orelhas e parte do pescoço. O recorte didático termina
na testa: a calota superior não está incluída nem foi completada
artificialmente. O tórax e a maior parte do apoio foram excluídos pelo recorte;
pequenos segmentos posteriores do suporte permanecem para preservar os voxels
reais. Esses limites devem ser considerados ao observar a reconstrução e os
marcos geométricos dos métodos didáticos.
A aquisição tem cortes de 3 mm, com faixas na reconstrução e artefatos metálicos dentários perceptíveis nos cortes axiais.

O modelo STL tratado pelos autores não é usado para fingir resultados: o visor
reconstrói os pixels da TC, inclusive depois da aplicação de cada método.

## Reproduzir e auditar

```text
python build/preparar_caso_publico.py --baixar
```

Também é possível usar `--origem caminho/Pat8.zip`. O conversor exige NumPy,
confere os hashes fixados, valida o cabeçalho NRRD e escreve somente os dados
necessários ao exemplo. Não executa código externo. O programa final recebe o
volume compactado embutido e não faz downloads durante o uso.

`PROVENIENCIA.json` registra hashes, URLs, versão, geometria, recorte e mudanças.
O ZIP original, as séries PET e os modelos OBJ/STL não são redistribuídos pelo
DeFace RT. A finalidade desta adaptação é demonstrar métodos e seus limites;
não validar eficácia clínica nem garantir anonimato.

## Citações solicitadas pelo banco

1. Egger J, Gsaxner C, Wallner J. *Medical Augmented Reality Facial Data Collection*.
   Figshare, 2019. DOI: [10.6084/m9.figshare.8857007.v2](https://doi.org/10.6084/m9.figshare.8857007.v2).
2. Gsaxner C, Pepe A, Wallner J, Schmalstieg D, Egger J. *Markerless Image-to-Face
   Registration for Untethered Augmented Reality in Head and Neck Surgery*.
   MICCAI, 236–244, 2019. DOI:
   [10.1007/978-3-030-32254-0_27](https://doi.org/10.1007/978-3-030-32254-0_27).
3. Gsaxner C, Wallner J, Chen X, Zemann W, Egger J. *Facial model collection for
   medical augmented reality in oncologic cranio-maxillofacial surgery*.
   Scientific Data 6, 310 (2019). DOI: [10.1038/s41597-019-0327-8](https://doi.org/10.1038/s41597-019-0327-8).

A atribuição não implica endosso dos autores ou das instituições ao DeFace RT.
