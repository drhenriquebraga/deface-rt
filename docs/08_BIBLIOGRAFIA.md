# Bibliografia e relação com a implementação

**Conferência das fontes: 13/11/2026.** Títulos, autores, ano, veículo e
identificadores abaixo foram conferidos nas páginas dos editores, da USENIX e
dos organismos responsáveis pelas normas. Os links permitem consultar as
fontes; os artigos e as normas não são redistribuídos neste pacote.

O motor do DeFace RT é uma implementação educacional própria. Os cinco métodos
são **demonstrações de estratégias de alteração da face**, algumas inspiradas
na literatura abaixo. Não são reproduções dos algoritmos publicados nem
equivalentes validados de `quickshear`, `mri_deface` ou `mri_reface`. Resultados,
taxas de reconhecimento e medidas de preservação cerebral dos artigos não
podem ser atribuídos a este aplicativo.

## Artigos

1. **Schimke N, Hale J.** *Quickshear Defacing for Neuroimages.* In: **2nd
   USENIX Workshop on Health Security and Privacy (HealthSec 11)**. San
   Francisco, CA: USENIX Association; agosto de 2011.
   [Registro e materiais na USENIX](https://www.usenix.org/conference/healthsec11/quickshear-defacing-neuroimages).
   A página oficial não informa DOI; não foi atribuído um identificador por
   suposição.

2. **Bischoff-Grethe A, Ozyurt IB, Busa E, et al.** *A technique for the
   deidentification of structural brain MR images.* **Human Brain Mapping**.
   2007;28(9):892–903. DOI: **10.1002/hbm.20312**.
   [Artigo no editor](https://onlinelibrary.wiley.com/doi/abs/10.1002/hbm.20312),
   [manuscrito dos autores no repositório da Universidade da Califórnia](https://escholarship.org/uc/item/49j6696j).
   O método publicado usa modelos de estruturas não cerebrais e registro ao
   volume; essa implementação não está incorporada ao DeFace RT.

3. **Schwarz CG, Kremers WK, Therneau TM, et al.** *Identification of
   Anonymous MRI Research Participants with Face-Recognition Software.*
   **New England Journal of Medicine**. 2019;381(17):1684–1686.
   DOI: **10.1056/NEJMc1908881**.
   [Artigo no editor](https://www.nejm.org/doi/abs/10.1056/NEJMc1908881).
   O experimento mostra identificação por comparação de fotografias com faces
   reconstruídas de RM cujos dados identificadores haviam sido removidos. Não
   é uma avaliação dos métodos deste aplicativo.

4. **Schwarz CG, Kremers WK, Wiste HJ, et al.; Alzheimer's Disease
   Neuroimaging Initiative.** *Changing the face of neuroimaging research:
   Comparing a new MRI de-facing technique with popular alternatives.*
   **NeuroImage**. 2021;231:117845. DOI: **10.1016/j.neuroimage.2021.117845**.
   [Artigo no editor](https://www.sciencedirect.com/science/article/pii/S1053811921001221).
   Compara reconhecimento facial e efeitos em medidas cerebrais após métodos
   de desfiguração, incluindo `mri_reface`, que substitui a face por uma média
   populacional. Os resultados dependem dos métodos, imagens e procedimentos
   avaliados naquele estudo.

## O que cada método demonstra

| Método no aplicativo | Relação com a literatura e limite da comparação |
|---|---|
| **Plano de corte** | Demonstra remoção por um plano, conceito relacionado ao *quickshear* [1]. A seleção do plano no aplicativo usa heurísticas próprias de superfície e marcos; não reproduz o algoritmo publicado. |
| **Recorte de face** | Demonstra remoção de tecido facial. O trabalho [2] é uma referência para essa finalidade, mas seu registro e seus modelos anatômicos não são usados aqui. |
| **Preenchimento com ruído** | Variação didática própria de preenchimento da região alterada. Não se atribui a um algoritmo publicado específico nem se alega superioridade. |
| **Suavização de superfície** | Variação didática própria para observar como a suavização pode alterar a aparência e ainda conservar geometria. A métrica local não mede probabilidade de reidentificação. |
| **Face genérica** | Demonstra substituição de superfície, tema relacionado ao estudo [4]. Aqui a face é construída com parâmetros geométricos próprios; não é a média populacional nem a implementação `mri_reface` do artigo. |

As referências [3] e [4] fundamentam a discussão de que retirar identificadores
do cabeçalho ou alterar a face não estabelece, por si só, anonimato. A revisão
visual e as métricas geométricas do DeFace RT são recursos de aprendizagem;
não reproduzem os testes de reconhecimento facial desses artigos.

## Normas técnicas

- **DICOM PS3.15 — Security and System Management Profiles**, Anexo E,
  *Attribute Confidentiality Profiles*, especialmente E.1 e a Tabela E.1-1.
  [Texto oficial da NEMA](https://dicom.nema.org/medical/dicom/current/output/chtml/part15/chapter_E.html).
  A edição exibida na consulta foi **2026d**. É a referência normativa para
  remoção e substituição de atributos usada na discussão de cabeçalhos.
  O próprio Anexo E distingue limpeza de atributos de desidentificação do
  objeto completo. Citar a norma não demonstra conformidade integral do
  aplicativo com o perfil e todas as suas opções.

- **DICOM PS3.5 — Data Structures and Encoding**, Anexo G, *Encapsulated RLE
  Compressed Images*.
  [Texto oficial da NEMA](https://dicom.nema.org/medical/dicom/current/output/chtml/part05/chapter_G.html).
  A edição exibida na consulta foi **2026d**. Referência para a estrutura dos
  segmentos e do cabeçalho RLE. O suporte efetivo do leitor é delimitado pelo
  código e pelos testes do projeto.

- **ITU-T Recommendation T.81 (09/1992)**. *Information technology — Digital
  compression and coding of continuous-tone still images — Requirements and
  guidelines.* Aprovada em **18/09/1992**; Anexo H: *Lossless mode of
  operation*.
  [Registro oficial da ITU](https://www.itu.int/rec/T-REC-T.81-199209-I/en),
  [sumário oficial com o Anexo H](https://www.itu.int/dms_pubrec/itu-t/rec/t/T-REC-T.81-199209-I!!TOC-HTM-E.htm).
  A conferência nesta data cobriu o registro e o sumário públicos; o portal
  informa acesso restrito ao texto integral. Esta referência identifica a
  norma do processo JPEG sem perdas e não certifica suporte a todos os seus
  recursos. O leitor rejeita variantes não suportadas.

Os endereços DICOM com `current` acompanham a edição vigente; a edição acima
registra o que foi consultado nesta conferência.

## Fonte da TC real e autorização de publicação facial

O caso didático inicial é **Pat11**, da coleção abaixo. A versão 1.5.0 usa
um recorte dos pixels reais, sem reamostragem, e cabeçalhos de conversão.
O dado permanece sob CC BY 4.0; a licença MIT do código não o relicencia.

- **Egger J, Gsaxner C, Wallner J.** *Medical Augmented Reality Facial Data
  Collection.* Figshare; 2019, versão 2.
  DOI: [10.6084/m9.figshare.8857007.v2](https://doi.org/10.6084/m9.figshare.8857007.v2).
  É o dataset de TC/PET e modelos faciais, sob
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

- **Gsaxner C, Wallner J, Chen X, Zemann W, Egger J.** *Facial model collection
  for medical augmented reality in oncologic cranio-maxillofacial surgery.*
  **Scientific Data**. 2019;6:310. DOI:
  [10.1038/s41597-019-0327-8](https://doi.org/10.1038/s41597-019-0327-8).
  [Texto integral](https://pmc.ncbi.nlm.nih.gov/articles/PMC6901520/).
  A seção *Data Records*, após a Tabela 2, declara consentimento de todos os
  pacientes selecionados antes da publicação e reconhece dados identificáveis,
  incluindo as faces 3D. A declaração não se restringe ao exemplo da Figura 2.
  A coleção tem 12 casos; não foram obtidos novos termos individuais pelo
  DeFace RT. Esta é a evidência pública de autorização usada para o exemplo.

- **Gsaxner C, Pepe A, Wallner J, Schmalstieg D, Egger J.** *Markerless
  Image-to-Face Registration for Untethered Augmented Reality in Head and Neck
  Surgery.* In: **MICCAI 2019**. p. 236–244. DOI:
  [10.1007/978-3-030-32254-0_27](https://doi.org/10.1007/978-3-030-32254-0_27).
  [Registro institucional](https://tugraz.elsevierpure.com/en/publications/markerless-image-to-face-registration-for-untethered-augmented-re/).
  Referência adicional solicitada pelos autores do dataset; o método de
  registro desse trabalho não está implementado no DeFace RT.

Preservar esses créditos, a licença e a indicação das alterações nas cópias
e nos derivados. Atribuição não implica associação ou endosso dos autores.
Não confundir o dataset **8857007** com o registro **11284757**, que contém
metadados do artigo. A autorização facial é documentada pelo estudo; não
foi inferida apenas da existência de uma licença aberta.

## Licenças e exemplos

O código do motor é próprio, mas o pacote também contém fontes tipográficas e
amostras públicas com atribuições específicas. As licenças estão em
[LICENSES/LEIAME.md](../LICENSES/LEIAME.md). A origem, licença, revisão e
limitações do caso real e dos fantomas sintéticos auxiliares estão em
[exemplos/LEIAME.md](../exemplos/LEIAME.md). Esses materiais de ensino e teste
não constituem validação clínica dos métodos.
