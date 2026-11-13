# DeFace RT — Estudio educacional

**Aprenda por que desfigurar uma imagem ou trocar nomes nao e anonimizar.**

Dois aplicativos locais e autocontidos do ecossistema radioterapia.ai:

- **DICOM:** abra um fantoma sintetico de TC ou RM, compare cinco metodos,
  percorra cortes e 3D, inspecione os cabecalhos e a geometria residual.
- **Data:** pseudonimize um texto ficticio, revise os identificadores que
  podem ter escapado e restaure os rotulos numa resposta simulada, sem IA.

Versao **1.4.1**, 13/11/2026. Interface Estudio aprovada por Henrique Braga.

## Comecar

Abra `index.html` (DICOM) ou `data/index.html` (Data) na publicacao web.
No pacote offline, abra `programas/DeFace_RT.html` ou
`programas/DeFace_RT_Data.html`. Use **Explorar caso sintetico** ou
**Explorar texto sintetico** antes de trabalhar com arquivos proprios.

Os programas funcionam sem conexao depois de baixados. Nao instale dependencias
para usa-los. O distintivo do cabecalho informa o resultado do teste de isolamento.

## O que mudou

- Cabeca humana modelada, com palpebras, labios, orelhas, mandibula e pescoco;
  volume de 192 x 224 x 256 voxels de 1 mm e superficie 3D sem degraus de voxel.
- Superficie MakeHuman CC0, com origem verificavel; tecidos e contrastes
  TC/RM continuam inteiramente simulados, sem exame ou fotografia de pessoa.
- Inicio educativo no lugar de visores vazios; exemplos e roteiro de exploracao.
- Comparacao Original/Resultado com inspector lateral e detalhes sob demanda.
- TC, RM e texto gerados localmente, sem dados de pacientes.
- Caso com texto ficticio nos pixels para demonstrar limites da limpeza de tags.
- Dois fantomas publicos sinteticos baixados com licenca, hashes e proveniencia.
- Revisao antes da exportacao; restauracao de texto simulada, sem servico de IA.
- Recusa explicita de alguns formatos que antes podiam gerar pixels incorretos.

## Privacidade e limites

Cada aplicativo e um unico HTML com fontes e codigo embutidos. A CSP inclui
`connect-src 'none'`; nao ha API, analytics ou upload de arquivos no programa.
O unico teste de conexao tenta `isolamento.invalid`, dominio reservado,
para verificar o bloqueio do navegador. O servidor que entrega a pagina pode
registrar o acesso HTTP inicial; os exames e textos sao processados localmente.

**Finalidade educacional. Nao validado para uso clinico.** Pseudonimizacao nao
comprova anonimato, conformidade legal ou seguranca para divulgar um exame.
Quase-identificadores, geometria residual, contexto e texto nos pixels podem
continuar identificadores. A revisao humana permanece necessaria.

O Data usa regras e dicionarios, nao IA; pode omitir nomes ou substituir termos
indevidamente. O mapa vive apenas na memoria da aba. Editar a entrada ou os
ajustes invalida o resultado; fechar ou limpar apaga o mapa.

## Limites tecnicos DICOM

- Uma serie de TC/RM em escala de cinza, uma imagem por arquivo.
- JPEG 2000, JPEG-LS, multiquadro e JPEG sem perdas com reinicio (DRI)
  sao recusados. Reexporte em Explicit VR Little Endian sem compressao.
- Valores de pixel sem sinal acima de 32767 sao recusados, em vez de
  convertidos silenciosamente para negativos ou truncados.
- DICOM deflacionado com bytes adicionais no fim pode ser recusado pelo
  navegador; reexporte sem compressao. Essa limitacao nao esta resolvida.
- A saida usa pixels int16; nao use este app para preservar fidelidade
  diagnostica, validar dosimetria ou alimentar um pipeline clinico.
- NIfTI e formato de **exportacao**, nao de importacao neste aplicativo.
- Sequencias e tags privadas sao removidas integralmente, inclusive dados
  tecnicos legitimos. Arquivos com multiplas series requerem escolha cuidadosa.

Os exemplos embutidos usam uma cabeca modelada; sua aparencia nao torna os
tecidos internos diagnosticamente corretos. Os dois fantomas publicos de
CBCTsynth-RT continuam geometrias simplificadas e nao tem nariz anatomico:
um detector pode produzir resultado aparentemente plausivel mesmo assim.
Nenhum caso da colecao valida eficacia facial ou desempenho em pacientes.

## Desenvolver e testar

Requer Node.js 22+ e Python 3.10+ para ferramentas de desenvolvimento.

```text
python testes/rodar.py
python build/montar.py
node build/gerar_exemplos.js
node testes/teste_publicos.js
```

Os testes de navegador usam uma instalacao de Playwright e Chromium:

```text
node testes/teste_navegador_dicom.cjs
node testes/teste_navegador_data.cjs
```

`PLAYWRIGHT_MODULE` e `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permitem apontar para
instalacoes existentes. Os testes usam somente dados sinteticos.
Resultados e capturas ficam em `dist/qa`, nao entram automaticamente na entrega.

`src/` e `data/` sao as fontes de verdade. Nao edite os HTMLs gerados.
O montador verifica CSP, rede, IDs, sintaxe, fontes e hashes em disco.

## Exemplos, licencas e publicacao

Veja `exemplos/LEIAME.md` para o roteiro e as fontes.
As licencas das fontes estao em `LICENSES/`; a do fantoma publico fica ao lado
dos dados. A licenca deste codigo e independente e consta em `LICENSE`.

A raiz atual dos repositorios e https://github.com/drhenriquebraga.
Os destinos desta entrega ficam registrados em `PUBLICACAO.json` na versao
publicada; nao substitua nomes de repositorios por suposicao.

O historico publico desta versao comeca em uma arvore revisada. O historico
local antigo foi preservado e nao e necessario para executar o aplicativo.
