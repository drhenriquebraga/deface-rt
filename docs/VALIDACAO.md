# Validação da versão 1.5.0

Esta versão inclui uma TC real de banco público com licença CC BY 4.0 e
consentimento para publicação facial declarado pelos pesquisadores, além
de casos sintéticos auxiliares. As evidências verificam comportamento de
software e integridade da adaptação; não validam eficácia de desidentificação
nem uso clínico.

## Escopo de verificação

A lista abaixo delimita o que deve ser conferido. Ela não é, por si só,
uma declaração de execução ou aprovação: os resultados dependem dos logs
e relatórios datados da entrega correspondente.

- **Caso real Pat8:** fonte e licença fixadas, evidência pública de
  consentimento, hashes do arquivo e dos pixels, cabeçalho NRRD permitido e
  recorte de 208 × 260 × 53 voxels. Conferir igualdade com os pixels de origem,
  sem reamostragem; preservar espaçamento de 0,976562 × 0,976562 × 3,0 mm e
  registrar que o recorte não inclui a calota superior.
- **Metadados do exemplo real:** conferir cabeçalhos de conversão e
  proveniência, ausência de importação de nomes e cabeçalhos clínicos originais,
  leitura DICOM e coerência de coordenadas, modalidade e intensidades.
- **Cards excludentes:** caso abre sem método executado; cinco cards visíveis;
  um clique executa somente o escolhido. Selecionar outro substitui o resultado
  e parte do original, sem acumular efeitos. Ausência de dropdown, seleção
  múltipla e execução em lote; acesso por teclado e estados de processamento.
- **Revisão e exportação:** mudança de card, limiar ou ajustes invalida a saída
  ou a revisão conforme o estado; download só após revisão. Conferir DICOM,
  reimportação, NIfTI e identidade entre o resultado mostrado e o exportado.
- **Banco DICOM:** orientação, cinco métodos individuais, sementes, sequências
  aninhadas e ida/volta de escrita. Recusa de unsigned fora de int16,
  multiquadro e JPEG com DRI nos caminhos não suportados.
- **Renderização:** superfície subvoxel, estruturas finas, anisotropia,
  orientação invertida, plano, degrau, volume cortado e ar puro; a renderização
  não deve alterar pixels. Original/Resultado devem ter a mesma escala visual.
- **Sintéticos auxiliares:** TC/RM de cabeça modelada, metadados fictícios,
  tags privadas, determinismo, cinco métodos individuais e anotação fictícia
  que permanece nos pixels depois de limpar cabeçalhos.
- **Fantomas públicos CBCTsynth-RT:** revisão e hashes dos 88 arquivos,
  campos esperados, ausência de tags privadas e sequências inesperadas.
- **Navegador DICOM:** TC real inicial, cortes/3D, cinco cards, cabeçalhos,
  medidas, erros de entrada, revisão, exportação, reimportação, desktop/mobile,
  foco e teclado. URLs das fontes ficam como texto selecionável; o aplicativo
  não as abre nem consulta automaticamente.
- **Data:** texto fictício, identificadores, preservação de vocabulário,
  formatos, revisão, restauração simulada, cópia, invalidação e limpeza do
  mapa; teclado e telas estreitas.
- **Isolamento e publicação:** CSP, ausência de envio de dados do usuário,
  autoteste bloqueado de isolamento, licenças, manifesto, conteúdo e histórico
  a publicar. Depois do deploy, conferir URLs e hashes servidos.

Logs de navegador e bancos ficam em `dist/qa`. O pacote de entrega e a
auditoria da publicação registram as evidências efetivamente incluídas.
Não foram cobertos todos os codecs, fabricantes, scanners ou navegadores.

Execução em 13/11/2026 para a versão 1.5.0: os bancos automatizados e o
fluxo Chromium DICOM passaram, incluindo cinco escolhas exclusivas, entrada
TC real/RM sintética, DICOM/NIfTI, créditos nos ZIPs exportados, atribuição
na reimportação e viewport de 390 px. A auditoria estática passou nas 41
verificações, sem falhas ou avisos. O caso real também passou pela conferência
independente de todos os pixels e dos 53 cabeçalhos preparados.

## Limites conhecidos

O exemplo real é um recorte e não inclui toda a cabeça. Não se completaram
partes ausentes nem se substituíram tecidos por formas sintéticas. Pequenos
segmentos do apoio posterior permanecem no volume. Esses fatores podem
afetar os marcos automáticos e a interpretação das medidas.

O leitor recusa formatos não suportados em vez de exportar silenciosamente
valores incompatíveis com int16. O DICOM deflacionado com preenchimento
adicional continua uma limitação declarada; o programa orienta reexportar
sem compressão. Uma reconstrução visual ou teste funcional aprovado não
constitui validação clínica ou garantia de anonimato.
