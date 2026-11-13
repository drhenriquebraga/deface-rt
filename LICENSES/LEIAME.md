# Licenças e créditos

O código do DeFace RT é **MIT**, conforme `LICENSE` na raiz. Essa licença não
substitui as licenças próprias dos dados e fontes distribuídos com o projeto.

## TC real pública

O caso Pat8 vem de **Jan Egger, Christina Gsaxner e Jürgen Wallner (2019)**,
*Medical Augmented Reality Facial Data Collection*, versão 2, Figshare.
DOI: [10.6084/m9.figshare.8857007.v2](https://doi.org/10.6084/m9.figshare.8857007.v2).

O dado é **CC BY 4.0**. O texto integral está em `CC-BY-4.0.txt` e a licença
aplicável acompanha o HTML DICOM. Preserve atribuição, link da licença e
descrição das alterações ao redistribuir o dado ou os derivados. Não sugira
endosso dos autores ao DeFace RT.

O [artigo da coleção](https://pmc.ncbi.nlm.nih.gov/articles/PMC6901520/)
declara consentimento de todos os participantes para publicação de dados
identificáveis e modelos faciais. A evidência usada é essa declaração pública
dos pesquisadores, não a obtenção de novos termos individuais pelo DeFace RT.

A adaptação usa recorte espacial sem reamostragem, conversão exata de pixels
para int16 e novos cabeçalhos de conversão. A descrição completa e os hashes
ficam em `exemplos/publicos/mar-facial-pat8/PROVENIENCIA.json`.
As três referências solicitadas pelo banco estão no LEIAME dessa pasta e em
`docs/08_BIBLIOGRAFIA.md`.

## Fontes tipográficas

Outfit Regular/Bold e JetBrains Mono Regular são subconjuntos WOFF embutidos.
Os avisos de copyright permanecem nos binários. Os textos integrais oficiais
acompanham o pacote e cada HTML montado.

- `OFL-Outfit.txt`: Copyright 2021 The Outfit Project Authors.
  [Origem oficial](https://github.com/Outfitio/Outfit-Fonts/blob/main/OFL.txt).
- `OFL-JetBrainsMono.txt`: Copyright 2020 The JetBrains Mono Project Authors.
  [Origem oficial](https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt).

Baixados das origens oficiais em 13/11/2026, sob SIL OFL 1.1. O montador falha
se uma licença exigida pelo aplicativo estiver ausente.

## Materiais sintéticos auxiliares

Os fantomas públicos CBCTsynth-RT preservam sua licença MIT e proveniência em
`exemplos/publicos/cbctsynth-rt/`.

A superfície da cabeça sintética auxiliar deriva do asset gráfico MakeHuman
hm08, sob **CC0-1.0**. A licença integral está em `CC0-MakeHuman.txt`; revisão,
hashes e transformações estão em `exemplos/anatomia/PROVENIENCIA.json`.
Nenhum código do programa MakeHuman foi incorporado. Esse material permanece
nos arquivos auxiliares e testes; o exemplo inicial do aplicativo é a TC real.
