#!/usr/bin/env python3
"""Prepara um recorte sem reamostragem da TC pública Pat8 (CC BY 4.0).

python build/preparar_caso_publico.py --origem caminho/Pat8.zip
python build/preparar_caso_publico.py --baixar

O download ocorre somente na preparação. O aplicativo usa pixels embutidos.
Requer Python e NumPy; não executa código externo nem importa metadados DICOM.
"""
from __future__ import annotations
import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import zipfile
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]
DOI = '10.6084/m9.figshare.8857007.v2'
DOWNLOAD = 'https://ndownloader.figshare.com/files/18502082'
ZIP_SHA = '66e19fbc46465586c594903f087c9d161be9cc12f1f8fa7f20aa7538006531b7'
NRRD_SHA = 'e10002c5fe085baebd20a0000b024392c70db65cea0128458fd29aa37f091266'
NRRD_NAME = 'Pat8/Pat8_CT.nrrd'
CROP = ((166, 374), (82, 342), (30, 83))
SOURCE_SIZE = (512, 512, 83)
SPACING = (0.9765625, 0.9765625, 3.0)
SOURCE_ORIGIN = (-249.51171875, -398.51171875, -693.0)
HEADER_KEYS = {'type','dimension','space','sizes','space directions','kinds','endian','encoding','space origin'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_ct(source):
    package = source.read_bytes()
    if sha(package) != ZIP_SHA:
        raise ValueError('O ZIP não corresponde ao hash da versão pública autorizada.')
    with zipfile.ZipFile(source) as archive:
        # Extrai apenas uma entrada literal; nunca executa código nem extrai caminhos externos.
        raw = archive.read(NRRD_NAME)
    if sha(raw) != NRRD_SHA:
        raise ValueError('O NRRD não corresponde ao hash fixado.')
    header, compressed = raw.split(b'\n\n', 1)
    lines = header.decode('ascii').splitlines()
    if lines[0] != 'NRRD0005':
        raise ValueError('Versão NRRD inesperada.')
    fields = {}
    comments = []
    for line in lines[1:]:
        if line.startswith('#'):
            comments.append(line)
            continue
        name, value = line.split(':', 1)
        if name in fields or name not in HEADER_KEYS:
            raise ValueError('Campo NRRD inesperado: ' + name)
        fields[name] = value.strip()
    expected = {'type':'int16','dimension':'3','space':'left-posterior-superior',
                'sizes':'512 512 83','kinds':'domain domain domain',
                'endian':'little','encoding':'gzip'}
    for key, value in expected.items():
        if fields.get(key) != value:
            raise ValueError('Geometria/formato inesperado em ' + key)
    directions = [tuple(map(float, s.split(','))) for s in re.findall(r'\(([^)]+)\)', fields['space directions'])]
    if not np.allclose(directions, np.diag(SPACING), atol=1e-12, rtol=0):
        raise ValueError('Orientação diferente de LPS ortogonal; não corrigir silenciosamente.')
    origin = tuple(map(float, fields['space origin'].strip('()').split(',')))
    if not np.allclose(origin, SOURCE_ORIGIN, atol=1e-12, rtol=0):
        raise ValueError('Origem espacial inesperada.')
    data = gzip.decompress(compressed)
    if len(data) != np.prod(SOURCE_SIZE) * 2:
        raise ValueError('Tamanho do volume NRRD incorreto.')
    volume = np.frombuffer(data, dtype='<i2').reshape(SOURCE_SIZE[::-1])
    if volume.min() < -32768 or volume.max() > 32767:
        raise ValueError('Conversão int16 não preservaria todos os valores.')
    return volume, fields, comments


def prepare(source):
    volume, fields, comments = read_ct(source)
    x, y, z = CROP
    crop = volume[z[0]:z[1], y[0]:y[1], x[0]:x[1]].astype('<i2')
    # Os pixels já são int16; o recorte não altera intensidades.
    assert np.array_equal(crop.astype('<i2'), volume[z[0]:z[1], y[0]:y[1], x[0]:x[1]])
    dimensions = [b-a for a,b in CROP]
    origin = [round(SOURCE_ORIGIN[i]+CROP[i][0]*SPACING[i], 6) for i in range(3)]
    spacing = [round(value, 6) for value in SPACING]
    payload = crop.tobytes(order='C')
    compressed = gzip.compress(payload, compresslevel=9, mtime=0)
    data = {
        'caso':'Pat8', 'modalidade':'CT', 'dimensoes':dimensions,
        'espaco':spacing, 'origemLPS':origin,
        'orientacaoLPS':[1,0,0,0,1,0],
        'formato':'int16-le-gzip-base64; x rápido, y posterior, z superior; UH preservadas',
        'pixelsBase64':base64.b64encode(compressed).decode('ascii'),
        'doi':DOI, 'licenca':'CC-BY-4.0', 'sha256Pixels':sha(payload),
    }
    js = '/* TC real pública Pat8, Medical Augmented Reality Facial Data Collection.\n'
    js += '   CC BY 4.0; consentimento e proveniência em exemplos/publicos/mar-facial-pat8/.\n'
    js += '   Recorte sem reamostragem; não é exame sintético. Gerado, não editar o payload. */\n'
    js += "'use strict';\nconst CASO_PUBLICO_DADOS = " + json.dumps(data, ensure_ascii=False, separators=(',',':')) + ';\n'
    (ROOT/'src/js/76_caso_publico_dados.js').write_text(js, encoding='utf-8', newline='')
    provenance = {
        'caso':'Pat8','tipo':'TC real de paciente, fonte pública com consentimento publicado para dados faciais identificáveis',
        'colecao':'Medical Augmented Reality Facial Data Collection',
        'autores':['Jan Egger','Christina Gsaxner','Jürgen Wallner'],'ano':2019,
        'doi':DOI,'versao':2,
        'url':'https://figshare.com/articles/dataset/Medical_Augmented_Reality_Facial_Data_Collection/8857007/2',
        'urlDownload':DOWNLOAD,'figshareFileId':18502082,'licenca':'CC-BY-4.0',
        'licencaUrl':'https://creativecommons.org/licenses/by/4.0/',
        'licencaTextoUrl':'https://creativecommons.org/licenses/by/4.0/legalcode.txt',
        'licencaTextoSha256':'9ba9550ad48438d0836ddab3da480b3b69ffa0aac7b7878b5a0039e7ab429411',
        'consulta':'2026-11-13',
        'artigoDoi':'10.1038/s41597-019-0327-8',
        'consentimentoFonte':'https://pmc.ncbi.nlm.nih.gov/articles/PMC6901520/',
        'consentimentoEscopo':'Os autores relatam consentimento de todos os casos selecionados para publicação dos dados identificáveis e modelos faciais 3D. Não são disponibilizados formulários individuais.',
        'origemArquivo':'Pat8.zip','origemBytes':source.stat().st_size,
        'sha256ZipOrigem':ZIP_SHA,'md5Figshare':'e8b98de4112c91b0a05de51fb8baea44',
        'entradaNRRD':NRRD_NAME,'sha256NRRD':NRRD_SHA,
        'dimensoesOrigem':list(SOURCE_SIZE),'espaco':spacing,'espacoNRRDOriginal':list(SPACING),'origemLPSOriginal':list(SOURCE_ORIGIN),
        'recorteIndicesXYZ_fimExclusivo':[list(c) for c in CROP],
        'dimensoes':dimensions,'origemLPS':origin,'orientacaoLPS':[1,0,0,0,1,0],
        'alteracoes':['Recorte espacial retangular, sem reamostragem, suavização, preenchimento ou alteração de intensidades',
                      'Pixels int16 preservados exatamente, sem conversão de intensidade',
                      'Coordenadas/espaçamentos escritos com até seis casas decimais, removendo apenas resíduos de ponto flutuante do cabeçalho NRRD',
                      'Cabeçalho NRRD técnico substituído por metadados de proveniência; nenhuma tag DICOM original importada'],
        'intervaloUH':[int(crop.min()),int(crop.max())],
        'sha256PixelsInt16LE':sha(payload),'bytesPixels':len(payload),'bytesGzip':len(compressed),
        'sha256Gzip':sha(compressed),
        'camposCabecalhoNRRDAuditados':sorted(fields),
        'comentariosNRRD':'Apenas gerador pynrrd, data de geração e URL da especificação; não transportados ao aplicativo.',
        'limites':['O recorte didático termina na testa; a calota superior não foi completada artificialmente',
                   'O recorte remove tórax e grande parte do suporte; segmentos finos do apoio posterior permanecem para preservar os voxels reais',
                   'O volume contém artefatos metálicos dentários visíveis em cortes e faixas devidas à espessura de corte',
                   'Há estruturas faciais reconhecíveis por finalidade declarada da coleção; isso não permite afirmar anonimato',
                   'O caso não valida eficácia clínica dos algoritmos didáticos'],
    }
    out = ROOT/'exemplos/publicos/mar-facial-pat8'
    out.mkdir(parents=True, exist_ok=True)
    (out/'PROVENIENCIA.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k:provenance[k] for k in ['dimensoes','espaco','origemLPS','intervaloUH','sha256PixelsInt16LE','bytesPixels','bytesGzip']}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--origem',type=Path)
    parser.add_argument('--baixar',action='store_true')
    args=parser.parse_args()
    source=args.origem
    if args.baixar:
        source=ROOT/'.publicacao/caso-real/Pat8.zip'
        source.parent.mkdir(parents=True,exist_ok=True)
        # Um cache pode reter redirecionamento S3 expirado; a query pede novo redirecionamento público.
        from time import time
        url=DOWNLOAD+'?download=1&request='+str(int(time()))
        subprocess.run(['curl.exe' if sys.platform=='win32' else 'curl','--fail','--location','--retry','2','--max-time','300',url,'-o',str(source)],check=True)
    if source is None:
        parser.error('Informe --origem Pat8.zip ou --baixar.')
    prepare(source)
