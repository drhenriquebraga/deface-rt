#!/usr/bin/env python3
"""Executa os bancos sem depender do Bash; Windows, Linux ou macOS."""
import pathlib
import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
RAIZ = pathlib.Path(__file__).resolve().parents[1]
GRUPOS = {
    'dicom': ('src', '_all.js', ['10_core.js','20_dict.js','30_dicom.js',
        '40_volume.js','50_deface.js','60_render.js','70_write.js',
        '74_anatomia.js','75_exemplos.js','76_caso_publico_dados.js','77_caso_publico.js','80_ui.js'], ['teste.js','teste_exemplos.js',
        'teste_limites.js','teste_publicos.js','teste_render.js','teste_caso_publico.js']),
    'data': ('data', '_all_data.js', ['10_core.js','20_padroes.js','25_listas.js',
        '30_motor.js','40_ui.js'], ['teste_data.js','teste_formatos.js']),
}

def executar():
    alvo = sys.argv[1] if len(sys.argv) > 1 else 'tudo'
    if alvo not in ('tudo', *GRUPOS):
        raise SystemExit('Use: python testes/rodar.py [dicom|data|tudo]')
    (RAIZ / 'dist').mkdir(exist_ok=True)
    for nome, (pasta, saida, modulos, testes) in GRUPOS.items():
        if alvo not in ('tudo', nome):
            continue
        conteudo = '\n'.join((RAIZ / pasta / 'js' / m).read_text(encoding='utf-8')
                              for m in modulos)
        arquivo = RAIZ / 'dist' / saida
        arquivo.write_text(conteudo, encoding='utf-8', newline='')
        subprocess.run(['node','--check',str(arquivo)], check=True, cwd=RAIZ)
        for teste in testes:
            subprocess.run(['node',str(RAIZ / 'testes' / teste)], check=True, cwd=RAIZ)

if __name__ == '__main__':
    executar()
