#!/bin/sh
# Banco de teste do DeFace RT. Roda sem navegador, sobre dados sinteticos.
#   sh testes/rodar.sh          os dois aplicativos
#   sh testes/rodar.sh dicom    so o DICOM
#   sh testes/rodar.sh data     so o texto
set -e
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$RAIZ/dist"
ALVO="${1:-tudo}"

if [ "$ALVO" = "tudo" ] || [ "$ALVO" = "dicom" ]; then
  cat "$RAIZ/src/js/10_core.js" "$RAIZ/src/js/20_dict.js" "$RAIZ/src/js/30_dicom.js" \
      "$RAIZ/src/js/40_volume.js" "$RAIZ/src/js/50_deface.js" "$RAIZ/src/js/60_render.js" \
      "$RAIZ/src/js/70_write.js" "$RAIZ/src/js/74_anatomia.js" "$RAIZ/src/js/75_exemplos.js" \
      "$RAIZ/src/js/76_caso_publico_dados.js" "$RAIZ/src/js/77_caso_publico.js" "$RAIZ/src/js/80_ui.js" > "$RAIZ/dist/_all.js"
  node --check "$RAIZ/dist/_all.js"
  node "$RAIZ/testes/teste.js"
  node "$RAIZ/testes/teste_exemplos.js"
  node "$RAIZ/testes/teste_limites.js"
  node "$RAIZ/testes/teste_publicos.js"
  node "$RAIZ/testes/teste_render.js"
  node "$RAIZ/testes/teste_caso_publico.js"
fi

if [ "$ALVO" = "tudo" ] || [ "$ALVO" = "data" ]; then
  cat "$RAIZ/data/js/10_core.js" "$RAIZ/data/js/20_padroes.js" \
      "$RAIZ/data/js/25_listas.js" "$RAIZ/data/js/30_motor.js" \
      "$RAIZ/data/js/40_ui.js" > "$RAIZ/dist/_all_data.js"
  node --check "$RAIZ/dist/_all_data.js"
  node "$RAIZ/testes/teste_data.js"
  node "$RAIZ/testes/teste_formatos.js"
fi
