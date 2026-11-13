# DeFace RT — Estúdio educacional

**Aprenda por que desfigurar uma imagem ou trocar nomes não é anonimizar.**

Dois aplicativos locais e autocontidos do ecossistema radioterapia.ai:

- **DICOM:** explore uma TC real de banco público e escolha um dos cinco cards
  de métodos. Cada card aplica somente aquele método ao volume original.
- **Data:** pseudonimize um texto fictício, revise os identificadores que
  podem ter escapado e restaure os rótulos numa resposta simulada, sem IA.

Versão **1.5.0**, 13/11/2026. A revisão mantém o Estúdio e prioriza a comparação
didática de um método por vez.

## Começar

Abra `index.html` (DICOM) ou `data/index.html` (Data) na publicação web.
No pacote offline, abra `programas/DeFace_RT.html` ou
`programas/DeFace_RT_Data.html`. No DICOM, use **Explorar TC real**; no Data,
**Explorar texto sintético**. Arquivos próprios continuam disponíveis.

O caso DICOM abre sem executar nenhum método. Observe o original, escolha
um card e compare o resultado. Ao escolher outro card, o aplicativo descarta
a seleção anterior e calcula o novo método a partir do mesmo original:
os efeitos não são acumulados. Não há dropdown nem processamento em lote.

Os programas funcionam sem conexão depois de baixados. Não instale dependências
para usá-los. O distintivo do cabeçalho informa o resultado do teste de isolamento.

## A TC real do exemplo

O caso **Pat8** pertence à [Medical Augmented Reality Facial Data Collection,
versão 2](https://doi.org/10.6084/m9.figshare.8857007.v2), de Jan Egger,
Christina Gsaxner e Jürgen Wallner (2019), sob **CC BY 4.0**. É um exame real,
não uma cabeça modelada. Os autores declaram consentimento de todos os
participantes para publicar os dados identificáveis e modelos faciais no
[artigo da coleção](https://pmc.ncbi.nlm.nih.gov/articles/PMC6901520/).

O aplicativo usa um recorte de **208 × 260 × 53** voxels, com espaçamento de
**0,976562 × 0,976562 × 3,0 mm**, sem reamostragem ou alteração dos valores
de pixel. O recorte não inclui a calota superior, que não foi completada artificialmente.
O visor reconstrói os pixels da TC, inclusive depois de cada método.

Fonte, licença, consentimento declarado, hashes e transformações estão em
`exemplos/publicos/mar-facial-pat8/`. Os DICOM de exemplo são produzidos com
cabeçalhos de conversão; não transportam nomes ou cabeçalhos clínicos originais.
Isso não torna a face anônima. O uso do caso é sustentado pela licença e pela
publicação com consentimento declarada pelos pesquisadores.

Os fantomas TC/RM das versões anteriores permanecem como **arquivos auxiliares
e testes**, fora da escolha inicial da interface. O exemplo textual do Data
continua inteiramente fictício.

## Privacidade e limites

Cada aplicativo é um único HTML com fontes, código e dados do exemplo embutidos.
A CSP inclui `connect-src 'none'`; não há API, analytics ou upload no programa.
O único teste de conexão tenta `isolamento.invalid`, domínio reservado, para
verificar o bloqueio do navegador. O servidor que entrega a página pode registrar
o acesso HTTP inicial; os exames e textos abertos pelo usuário são processados
localmente. URLs da fonte e licença são apresentadas como texto selecionável.

**Finalidade educacional. Não validado para uso clínico.** Os cinco métodos são
demonstrações próprias, não implementações validadas dos algoritmos citados na
bibliografia. Pseudonimização não comprova anonimato, conformidade legal ou
segurança para divulgar um exame. Geometria residual, contexto, atributos e
texto nos pixels podem continuar identificadores. A revisão humana permanece
necessária.

O Data usa regras e dicionários, não IA; pode omitir nomes ou substituir termos
indevidamente. O mapa vive apenas na memória da aba. Editar a entrada ou os
ajustes invalida o resultado; fechar ou limpar apaga o mapa.

## Limites técnicos DICOM

- Uma série de TC/RM em escala de cinza, uma imagem por arquivo.
- JPEG 2000, JPEG-LS, multiquadro e JPEG sem perdas com reinício (DRI)
  são recusados. Reexporte em Explicit VR Little Endian sem compressão.
- Valores de pixel sem sinal acima de 32767 são recusados, em vez de
  convertidos silenciosamente para negativos ou truncados.
- DICOM deflacionado com bytes adicionais no fim pode ser recusado pelo
  navegador; reexporte sem compressão. Essa limitação não está resolvida.
- A saída usa pixels int16; não use este app para preservar fidelidade
  diagnóstica, validar dosimetria ou alimentar um pipeline clínico.
- NIfTI é formato de **exportação**, não de importação neste aplicativo.
- Sequências e tags privadas são removidas integralmente, inclusive dados
  técnicos legítimos. Arquivos com múltiplas séries requerem escolha cuidadosa.

O recorte real e os fantomas auxiliares permitem estudar comportamentos de
software. Nenhum desses casos valida eficácia de anonimização ou desempenho
clínico. A ausência de aviso do detector geométrico não confirma adequação
de uma série ou de seus marcos faciais.

## Desenvolver e testar

Requer Node.js 22+ e Python 3.10+ para ferramentas de desenvolvimento.

```text
python testes/rodar.py
python build/montar.py
```

Os testes de navegador usam uma instalação de Playwright e Chromium:

```text
node testes/teste_navegador_dicom.cjs
node testes/teste_navegador_data.cjs
```

`PLAYWRIGHT_MODULE` e `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permitem apontar para
instalações existentes. Os bancos incluem dados sintéticos e o caso real
público autorizado. O escopo de verificação está em `docs/VALIDACAO.md`;
resultados e capturas ficam em `dist/qa`.

`src/` e `data/` são as fontes de verdade. Não edite os HTMLs gerados.
O montador verifica CSP, rede, IDs, sintaxe, fontes e hashes em disco.

## Exemplos, licenças e publicação

Veja `exemplos/LEIAME.md` para o roteiro e as fontes. O **código é MIT**;
o **caso real é CC BY 4.0** e mantém suas condições próprias. Licenças e
créditos dos demais componentes estão em `LICENSES/LEIAME.md`.

A raiz atual dos repositórios é https://github.com/drhenriquebraga.
Os destinos desta entrega ficam registrados em `PUBLICACAO.json` na versão
publicada; não substitua nomes de repositórios por suposição.

O histórico público parte de uma árvore revisada e recebe somente as mudanças
da publicação. O histórico local antigo foi preservado separadamente.
