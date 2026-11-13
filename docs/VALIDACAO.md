# Validacao da versao 1.4.0

Esta versao usa somente casos sinteticos nos testes. As evidencias verificam
comportamentos de software; nao validam eficacia de desidentificacao nem uso
clinico. Nao constituem garantia de ausencia absoluta de segredos.

## Escopo de verificacao

- Banco DICOM original: orientacao, cinco metodos, sementes, parser de
  sequencias aninhadas e ida/volta de escrita.
- Banco Data: identificadores, preservacao de vocabulario, reversibilidade,
  nomes e formatos de texto.
- Exemplos novos: TC/RM em DICOM, cinco metodos, metadados ficticios, tags
  privadas, determinismo, NIfTI e anotacao ficticia que permanece nos pixels.
- Casos publicos: origem fixada, hashes de 88 arquivos, campos de texto
  esperados, ausencia de tags privadas e sequencias, volume e pixels.
- Limites: recusa de pixels unsigned fora de int16, multiquadro e JPEG DRI.
- Navegador Chromium: inicio, TC/RM, 3D e cortes, cabecalhos, metricas,
  downloads DICOM/NIfTI, reimportacao, revisao, erros, teclado, mobile e CSP.
- Navegador Data: texto de exemplo, revisao, resposta simulada e restauracao,
  copia, invalidacao de saidas, limpeza do mapa, teclado e mobile.

Os logs da execucao final e a auditoria da publicacao acompanham o pacote.
Nao foram testados todos os codecs, fabricantes, scanners ou navegadores.

## Problemas anteriores tratados nesta versao

O leitor antigo convertia unsigned alto para int16 incorretamente e o JPEG
com DRI nao reinicializava corretamente a predicao. Estes caminhos agora
interrompem a importacao com explicacao, sem exportar pixels corrompidos.
O DICOM deflacionado com preenchimento adicional continua uma limitacao
declarada; o programa orienta reexportar sem compressao.
