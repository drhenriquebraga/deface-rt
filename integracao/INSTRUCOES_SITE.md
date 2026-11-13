# Integração DeFace RT 1.4.0

## Destinos desta entrega

- DICOM: https://drhenriquebraga.github.io/deface-rt/
- Data: https://drhenriquebraga.github.io/deface-rt/data/
- Código dos dois aplicativos: https://github.com/drhenriquebraga/deface-rt
- Raiz dos repositórios: https://github.com/drhenriquebraga

O site inspecionado usa os cards deface-card-dicom e deface-card-data na
minipágina motor-deface-embed, dentro do Expert. A mensagem e o fragmento
alteram somente esse motor. Não há envio de mensagem nem alteração do site
ao executar o empacotador.

## Opção A: apontar os cards para a publicação pronta

Use as URLs acima nos dois href, com target="_blank" e rel="noopener noreferrer".
Não é necessária API, conta de serviço, token, segredo ou banco de dados.

## Opção B: servir no próprio radioterapia.ai

1. Copie site/deface/ para /deface/ na raiz estática do site.
2. DICOM: /deface/dicom/index.html; Data: /deface/data/index.html.
3. Mescle site/_headers no arquivo de regras existente, sem substituir regras
   de outras rotas. A CSP meta já acompanha ambos os aplicativos.
4. Adapte somente os href de integracao/pagina_deface.html às rotas acima.
5. Não use iframe. Não injete bibliotecas, analytics, Rocket Loader, ofuscação
   de e-mail, service worker ou processamento de HTML nessas rotas.
6. Refaça o roteiro de exemplos/LEIAME.md e compare SHA-256 dos bytes servidos.

## Conteúdo do pacote

- programas/: dois HTMLs offline e seus hashes.
- site/: estrutura para hospedar no domínio e regras de cabeçalho.
- integracao/: fragmento e instruções; MENSAGEM_LUCAS.md é somente rascunho.
- exemplos/: cinco ZIPs sintéticos, origem, licenças e roteiro.
- src/, data/, build/, testes/: código e verificações reproduzíveis.
- LICENSES/ e LICENSE: licenças específicas de cada componente.
- docs/: validação, bibliografia e auditoria.
- SHA256SUMS.txt: hashes de cada arquivo do pacote; ZIP tem hash externo.

## Conferência

O indicador do cabeçalho deve confirmar isolamento. O autoteste bloqueado a
isolamento.invalid é esperado; não remova a política para eliminar essa mensagem.
Abrir e processar os exemplos não deve criar conexão de rede. O servidor pode
registrar o acesso inicial à página, mas não recebe exames nem textos do app.

Exemplos públicos são elipsoides, sem anatomia facial completa. Nenhum caso
valida uso clínico. Não prometa anonimato, conformidade LGPD ou eficácia facial.

Mantenha o ZIP anterior como rollback. Substitua arquivos e hashes em conjunto.
GitHub Pages usa a CSP meta; no domínio próprio, _headers também aplica as
proteções HTTP, incluindo frame-ancestors. Não enfraqueça connect-src 'none'.
