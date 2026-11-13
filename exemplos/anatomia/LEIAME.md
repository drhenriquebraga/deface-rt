# Cabeça sintética com superfície anatômica

O exemplo autoral utiliza a superfície de cabeça e pescoço da malha **hm08**,
um personagem base paramétrico do MakeHuman. Nariz, pálpebras, lábios, mandíbula
e orelhas vêm da geometria dessa malha. Não é foto, digitalização de rosto ou
exame de paciente fornecido ao DeFace RT. Os globos oculares são esferas
geradas neste projeto nas posições da malha; os tecidos de TC/RM são simulados
separadamente e não constituem anatomia interna validada.

## Origem e licença

- Projeto: [MakeHuman Community](https://www.makehumancommunity.org/).
- Asset: [base.obj, revisão fixa](https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/3dobjs/base.obj).
- Revisão: `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`.
- SHA-256 da origem: `8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c`.
- Licença do asset e deste campo derivado: **CC0-1.0**. Texto preservado em
  `LICENSES/CC0-MakeHuman.txt`.
- [Política oficial](https://www.makehumancommunity.org/about/license.html) e
  [licença na revisão fixada](https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/LICENSE.md).

O próprio cabeçalho do OBJ declara a liberação CC0 em setembro de 2020. A
licença de assets é distinta da licença do programa MakeHuman. Nenhum código
do MakeHuman foi incorporado ou executado; o conversor deste projeto lê dados
gráficos OBJ e faz sua própria subdivisão e voxelização.

Crédito de proveniência: MakeHuman Community, Data Collection AB, Joel Palmius
e Jonas Hauquier, conforme o cabeçalho da origem. Não há associação ou endosso.

## Conversão reproduzível

```text
python build/preparar_anatomia.py --baixar
```

O comando exige NumPy e SciPy durante a preparação. A opção `--baixar` baixa
somente o OBJ de revisão fixa e confere seu hash antes de usá-lo. Também se pode
fornecer `--origem caminho/base.obj` e trabalhar sem rede. O aplicativo final
não depende desses pacotes, não baixa a malha e não acessa a rede.

O conversor mantém somente o grupo `body` na cabeça e pescoço, aplica duas
subdivisões Catmull-Clark, converte os eixos para L/anterior/superior e fecha o
pescoço com um plano. Remove todos os grupos auxiliares do OBJ. Preenche o
interior por paridade de interseções e acrescenta globos oculares sintéticos.
A faixa próxima à pele usa a distância euclidiana ao triângulo subdividido,
para preservar detalhes abaixo do tamanho de um voxel.

O resultado é um campo de distância `Int8`, positivo no interior, de
192 × 224 × 256 voxels, espaçamento de 1 mm, passo de distância de 0,25 mm e
truncamento em ±8 mm. A compactação gzip tem cabeçalho determinístico. O campo
é incorporado ao HTML por `src/js/74_anatomia.js`; não se publica o corpo inteiro
do OBJ. `PROVENIENCIA.json` registra transformação, contagens e hash do campo.

## Limites didáticos

A maior semelhança visual com uma cabeça facilita estudar o efeito dos métodos
na superfície. Ela não torna o caso uma aquisição clínica, não valida o
comportamento em pacientes e não demonstra anonimato. As intensidades, tecidos,
identificadores e datas continuam sendo fabricados para ensino.
