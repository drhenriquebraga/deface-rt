#!/usr/bin/env python3
"""Obtém dois fantomas públicos sintéticos com revisão fixada e licença MIT.

Somente esta ferramenta de preparação usa rede. O aplicativo nunca a usa.
O código baixado é guardado como referência, nunca executado.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile, ZIP_DEFLATED, ZipInfo
from io import BytesIO
import hashlib
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

REVISAO = 'ce01a802b2320a703d0bb48e16870315e35640ee'
REPOSITORIO = 'https://github.com/saifeldein0/cbctsynth-rt'
URL = 'https://codeload.github.com/saifeldein0/cbctsynth-rt/zip/' + REVISAO
RAIZ = Path(__file__).resolve().parents[1]
DESTINO = RAIZ / 'exemplos' / 'publicos' / 'cbctsynth-rt'


def gravar_entrada(saida, nome, conteudo):
    item = ZipInfo(nome, date_time=(2026, 1, 1, 0, 0, 0))
    item.compress_type = ZIP_DEFLATED
    item.external_attr = 0o100644 << 16
    saida.writestr(item, conteudo)


def main():
    pedido = Request(URL, headers={'User-Agent': 'DeFace-RT-exemplos-educacionais'})
    with urlopen(pedido, timeout=90) as resposta:
        bruto = resposta.read(32 * 1024 * 1024 + 1)
    if len(bruto) > 32 * 1024 * 1024:
        raise RuntimeError('Arquivo de origem maior que o limite de preparação.')
    prefixo = 'cbctsynth-rt-' + REVISAO + '/'
    manifest = {'fonte': REPOSITORIO, 'revisao': REVISAO, 'url_download': URL,
                'licenca': 'MIT', 'autor': 'Saifeldein (github.com/saifeldein0)',
                'natureza': 'Fantoma geométrico sintético de elipsoides e ruído, sem paciente.',
                'limitacao': 'Crânio simplificado sem nariz; controle didático dos limites da detecção facial, não valida desfiguração em pessoas.',
                'arquivos': []}
    DESTINO.mkdir(parents=True, exist_ok=True)
    with ZipFile(BytesIO(bruto)) as origem:
        licenca = origem.read(prefixo + 'LICENSE')
        if b'MIT License' not in licenca or b'Permission is hereby granted' not in licenca:
            raise RuntimeError('A licença de redistribuição esperada não foi encontrada.')
        (DESTINO / 'LICENSE.txt').write_bytes(licenca)
        (DESTINO / 'gerador_original.py').write_bytes(origem.read(prefixo + 'sample_data/make_dummy_data.py'))
        for serie, nome in [('ct', 'TC_PUBLICA_FANTOMA.zip'), ('cbct', 'CBCT_PUBLICA_FANTOMA.zip')]:
            membros = [prefixo + f'sample_data/demo/{serie}/slice_{i:04d}.dcm' for i in range(1, 45)]
            itens = []
            with ZipFile(DESTINO / nome, 'w') as saida:
                for membro in membros:
                    dados = origem.read(membro)
                    if dados[128:132] != b'DICM':
                        raise RuntimeError('Marcador DICOM ausente: ' + membro)
                    simples = membro.rsplit('/', 1)[-1]
                    gravar_entrada(saida, simples, dados)
                    itens.append({'nome': simples, 'sha256': hashlib.sha256(dados).hexdigest(), 'bytes': len(dados)})
                gravar_entrada(saida, 'LICENSE.txt', licenca)
                gravar_entrada(saida, 'PROVENIENCIA.txt', (
                    'Fantoma publico inteiramente sintetico. Fonte: ' + REPOSITORIO + '\nRevisao: ' + REVISAO +
                    '\nLicenca MIT - Saifeldein, 2026. Nenhum pixel foi alterado.\n'
                    'Nao e exame de paciente. Sem nariz anatomico: use como controle dos limites da deteccao facial.\n'
                    'Selecione TC e abra o ZIP completo. Uso educacional; nao e validacao clinica.\n').encode())
            conteudo = (DESTINO / nome).read_bytes()
            manifest['arquivos'].append({'nome': nome, 'sha256': hashlib.sha256(conteudo).hexdigest(),
                                        'bytes': len(conteudo), 'dicom': itens})
            print(nome + ': ' + str(len(itens)) + ' cortes, ' + str(len(conteudo)) + ' bytes')
    (DESTINO / 'PROVENIENCIA.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
