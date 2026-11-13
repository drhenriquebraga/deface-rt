# Auditoria da publicacao — DeFace RT 1.4.0

Data: 13/11/2026.

**Resultado:** nao foram encontrados segredos, credenciais ou dados de pacientes
no conteudo preparado para publicacao, no historico publico novo ou nos exemplos
do pacote. Os candidatos encontrados foram classificados e revisados. A entrega
esta apta a publicacao dentro do escopo descrito abaixo.

## Conteudo e historico examinados

A verificacao examinou a arvore publica de fonte, programas, documentacao,
licencas, testes e exemplos; todos os objetos alcancaveis pelas refs do Git dessa
arvore; e o conteudo do ZIP para o webmaster, incluindo os ZIPs de exemplos.

O historico publico foi criado separadamente do repositorio de trabalho: um
commit raiz, com identidade de autor e committer `noreply` do GitHub. O historico
local antigo, que continha contato pessoal nos metadados de commits, foi
preservado localmente e nao faz parte da publicacao. Nao foram transportados
refs internos do Codex, `.git`, `debug.log`, caches, ambiente local ou arquivos
de paciente para o pacote.

O scanner `build/auditar_segredos.py` examinou padroes de chaves privadas,
tokens de provedores, JWT, cabecalhos de autorizacao, credenciais em URLs,
atribuicoes de senha/chave e variaveis de ambiente sensiveis. Tambem registrou
candidatos a e-mail, documentos brasileiros, caminhos pessoais e imagens
medicas. Nenhum segredo ou credencial foi identificado. O scanner foi
exercitado com credenciais ficticias, inclusive em ZIP, para verificar deteccao
e ausencia de valores sensiveis na saida.

Os e-mails do produto e dos testes pertencem a exemplos declarados ficticios;
os metadados do historico publico usam `noreply`. CPF e CNS presentes no Data
foram escolhidos para testar formatos e digitos verificadores, com aviso
explicito de ficcao. Eles nao foram extraidos de prontuarios. O exemplo interativo
usa um dominio reservado `.invalid`.

## Verificacao independente dos dados DICOM

Foram inspecionados **424 arquivos DICOM**, em cinco series, totalizando
**17.536 campos textuais**. Um parser Python independente do leitor do aplicativo
percorreu os arquivos dentro do ZIP final e confirmou:

- preambulos vazios, sem conteudo oculto;
- comprimentos estruturais consistentes e nenhum conteudo depois dos pixels;
- textos livres pertencentes a lista explicita de valores dos geradores;
- valores de VR numerico com formato numerico;
- nenhuma sequencia inesperada;
- tags privadas apenas nos exemplos autorais, limitadas aos dois campos
  ficticios incluidos deliberadamente para ensinar a auditoria de cabecalho.

As 336 imagens autorais sao produzidas por equacoes, sem atlas ou exame de
terceiro. Os 88 DICOM publicos vieram de um gerador de elipsoides e ruido,
na revisao registrada de CBCTsynth-RT. Sua proveniencia, licenca MIT, hashes e
gerador original acompanham os arquivos. O caso com anotacao nos pixels contem
apenas a palavra ficticia `DEMO`. Os exemplos nao sao exames de pacientes e nao
demonstram eficacia clinica de desidentificacao.

| Exemplo | DICOM | SHA-256 do ZIP de exemplo |
|---|---:|---|
| TC autoral | 112 | `57b5ddf67eae3c1fdc8483da2d942ff15c00c0bfe6dc12df8942404aff33983d` |
| RM autoral | 112 | `0b645e00fa4a61a0505ddd9df0fed5977bed3550d180269274d184bfae715d23` |
| TC com anotacao ficticia | 112 | `b230c67746d7398a2dcfe5536e71e146b6d1ec84bd93e62afead8f6844b7f26b` |
| TC publica sintetica | 44 | `20bc109afdcc7e981cbb2d641317b355ce81b627c2aaf280cd069d69ad83e49d` |
| CBCT publica sintetica | 44 | `196e6283b8019d72b55b456b98d39ae23aa33c0483b57891fa5247d5bb7fb81c` |

## Isolamento e integridade

A revisao estatica do codigo de execucao confirmou somente os dois autotestes
de isolamento, um por aplicativo, para o dominio reservado `isolamento.invalid`,
sem texto ou imagem do usuario. Nao foram encontrados caminhos de persistencia
por cookies, localStorage, sessionStorage ou IndexedDB. Nao ha upload, formulario
de envio, iframe ou navegacao externa no aplicativo. A copia para a area de
transferencia e os downloads sao acoes locais explicitas do usuario.

Os programas preservam `connect-src 'none'` e `form-action 'none'` na propria
CSP. As validacoes do navegador sao descritas em `VALIDACAO.md`; esta auditoria
nao substitui a verificacao do arquivo servido depois do deploy.

As copias de cada aplicativo em `programas/`, `downloads/` e `site/` foram
comparadas byte a byte. Todas as entradas de `SHA256SUMS.txt` foram verificadas.
Os arquivos do snapshot publico coincidem com seus correspondentes no pacote.

| Programa | SHA-256 |
|---|---|
| DeFace RT DICOM | `0f0520c1b62e440cc952b93d548065a7f5ce6ddedf8603ef3944e991e4202992` |
| DeFace RT Data | `8174a07033b0edf30373f3cb828b07be6d2f56b4fda0e9e2205124a860998850` |

O codigo do projeto e distribuido sob MIT por autorizacao do titular. Os textos
OFL de Outfit e JetBrains Mono e a licenca dos fantomas publicos acompanham a
entrega. As licencas do projeto e das fontes tambem estao embutidas nos HTMLs.

## Limites da conclusao

Esta e uma verificacao de conteudo, proveniencia e integridade da entrega,
nao uma garantia matematica de ausencia de qualquer segredo possivel. O scanner
usa padroes conhecidos; os binarios exigiram a verificacao adicional descrita.
Ele reporta arquivos ZIP que nao consegue inspecionar ou que ultrapassam seus
limites de tamanho/profundidade; nenhum desses impedimentos ocorreu nesta
entrega. Mudancas posteriores em fonte, arquivos, historico ou pacote exigem
nova verificacao. A disponibilidade publica e os links devem ser conferidos
apos o deploy, antes de anunciar a publicacao ao webmaster.
