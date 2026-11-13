#!/usr/bin/env python3
"""Monta dist/DeFace_RT.html a partir de src/.

    python3 build/montar.py             gera o arquivo
    python3 build/montar.py --validar   so confere, nao escreve

As validacoes nao sao decorativas. Cada uma corresponde a uma falha que ja
aconteceu neste projeto ou a uma regra que nao pode ser quebrada em silencio.
"""
import json, os, re, sys, hashlib, subprocess
from html import escape
from html.parser import HTMLParser

# o terminal do Windows e cp1252; sem isto, acento na mensagem quebra a saida
sys.stdout.reconfigure(encoding='utf-8')

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(RAIZ, 'dist')

# Dois aplicativos, um montador. Cada um e um arquivo unico, Classe 0, com o
# proprio SHA-256. Compartilham as validacoes -- que sao a parte que nao pode
# divergir entre eles.
APPS = {
    'dicom': {
        'raiz': 'src',
        'modulos': ['10_core.js', '20_dict.js', '30_dicom.js', '40_volume.js',
                    '50_deface.js', '60_render.js', '70_write.js', '75_exemplos.js', '80_ui.js'],
        'saida': 'DeFace_RT.html',
        'abas': {l + v for l in 'LR' for v in ('mpr', 'd3', 'hdr', 'met')},
    },
    'data': {
        'raiz': 'data',
        'modulos': ['10_core.js', '20_padroes.js', '25_listas.js', '30_motor.js', '40_ui.js'],
        'saida': 'DeFace_RT_Data.html',
        'abas': {'Vps', 'Vrev'},
    },
}


def falhar(m):
    print('\nERRO DE MONTAGEM\n' + m + '\n')
    sys.exit(1)


def montar(nome, validar):
    cfg = APPS[nome]
    SRC = os.path.join(RAIZ, cfg['raiz'])
    MODULOS = cfg['modulos']
    print('')
    print('=== %s -> %s ===' % (nome, cfg['saida']))

    js = ''
    for m in MODULOS:
        p = os.path.join(SRC, 'js', m)
        if not os.path.exists(p):
            falhar('modulo ausente: ' + m)
        js += open(p, encoding='utf-8').read() + '\n'

    # 1. o JS vai dentro de <script>: nao pode conter o fechamento
    if '</script>' in js:
        falhar('o JS contem "</script>" e quebraria o HTML.')

    # 2. sintaxe do bundle inteiro, nao modulo a modulo
    tmp = os.path.join(RAIZ, '.combinado.tmp.js')
    open(tmp, 'w', encoding='utf-8', newline='').write(js)
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    os.remove(tmp)
    if r.returncode:
        falhar('sintaxe JS:\n' + r.stderr)

    # 3. CLASSE 0 — sem egresso. Um unico fetch, o do autoteste de isolamento.
    saidas = re.findall(
        r'\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|navigator\.sendBeacon)\s*\(', js)
    if len(saidas) != 1 or saidas[0] != 'fetch':
        falhar('caminho de rede nao autorizado: ' + str(sorted(set(saidas))) +
               '\nDeFace RT e Classe 0: nenhum dado sai do navegador.\n'
               'Se um recurso novo precisa de rede, ele nao pertence a este app.\n'
               'Ver docs/03_PRIVACIDADE.md.')
    if 'isolamento.invalid' not in js:
        falhar('o autoteste de isolamento sumiu do codigo. Ele e o que prova a alegacao.')

    html = open(os.path.join(SRC, '01_shell.html'), encoding='utf-8').read()

    # 4. a CSP e a garantia imposta pelo navegador: nao pode sumir, nem duplicar.
    #    Politicas SOMAM: duas tags valem a intersecao das duas, e uma tag sem
    #    content tem comportamento indefinido entre navegadores. Por isso aqui se
    #    conta a tag PARSEADA, e nao por expressao regular -- procurar
    #    "Content-Security-Policy" no texto casa tambem com a mencao dentro de
    #    string de JavaScript, e esse falso positivo ja custou duas auditorias.
    for d in ("connect-src 'none'", "form-action 'none'"):
        if d not in html:
            falhar('a CSP com %s sumiu do shell.' % d)

    class _ColetaCSP(HTMLParser):
        def __init__(self):
            super().__init__()
            self.tags = []
            self._script = False

        def handle_starttag(self, tag, attrs):
            if tag == 'script':
                self._script = True
            if tag == 'meta' and not self._script:
                a = dict(attrs)
                if (a.get('http-equiv') or '').lower() == 'content-security-policy':
                    self.tags.append(a.get('content'))

        def handle_endtag(self, tag):
            if tag == 'script':
                self._script = False

    coleta = _ColetaCSP()
    coleta.feed(html)
    if len(coleta.tags) != 1:
        falhar('o shell tem %d tag(s) <meta> de CSP; tem de haver exatamente uma.\n'
               'Politicas somam: a segunda restringe a primeira, e uma tag sem '
               'content e indefinida entre navegadores.' % len(coleta.tags))
    if not coleta.tags[0]:
        falhar('a tag <meta> de CSP esta sem atributo content.')

    # 5. substituicao das fontes e do script
    fontes = json.load(open(os.path.join(RAIZ, 'build', 'fonts_b64.json')))
    for marca, chave in [('__OUTFIT_R__', 'Outfit-Regular'),
                         ('__OUTFIT_B__', 'Outfit-Bold'),
                         ('__JB_R__', 'JetBrainsMono-Regular')]:
        if html.count(marca) != 1:
            falhar('marcador %s aparece %d vez(es)' % (marca, html.count(marca)))
        html = html.replace(marca, fontes[chave])
    if html.count('__JS__') != 1:
        falhar('marcador __JS__ ausente ou duplicado')
    html = html.replace('__JS__', js)

    # A licenca acompanha tambem quem baixa apenas um dos HTMLs offline.
    licenca_codigo = os.path.join(RAIZ, 'LICENSE')
    if not os.path.exists(licenca_codigo):
        falhar('licenca do codigo ausente: LICENSE')
    licencas = ['<h2>DeFace RT</h2><pre>' +
                escape(open(licenca_codigo, encoding='utf-8-sig').read()) + '</pre>']
    for fonte in ('Outfit', 'JetBrainsMono'):
        caminho = os.path.join(RAIZ, 'LICENSES', 'OFL-' + fonte + '.txt')
        if not os.path.exists(caminho):
            falhar('licenca da fonte ausente: OFL-' + fonte + '.txt')
        licencas.append('<h2>' + fonte + '</h2><pre>' +
                        escape(open(caminho, encoding='utf-8-sig').read()) + '</pre>')
    html = html.replace('</body>', '<template id="licencasFontes">' +
                        ''.join(licencas) + '</template>\n</body>')

    sobrou = re.findall(r'__[A-Z_]+__', html)
    if sobrou:
        falhar('marcadores nao substituidos: ' + str(sobrou))

    # 6. todo id usado no JS existe no HTML  (esta validacao ja pegou um bug real:
    #    o seletor de abas montava "LMpr" e o HTML tinha "Lmpr")
    ids = set(re.findall(r'\bid="([^"]+)"', html))
    usados = (set(re.findall(r"\$\('([A-Za-z0-9_]+)'\)", js))
              | set(re.findall(r"getElementById\('([A-Za-z0-9_]+)'\)", js)))
    dinamicos = set(cfg['abas'])
    faltando = sorted((usados - ids) - dinamicos)
    if faltando:
        falhar('ids usados no JS e ausentes no HTML: ' + str(faltando))
    faltam_abas = sorted(d for d in dinamicos if d not in ids and d != 'Lmet')
    if faltam_abas:
        falhar('paineis de aba ausentes no HTML: ' + str(faltam_abas))

    # 6b. o cabecalho e a assinatura da familia: tem de ser identico nos dois
    #     shells. Ja divergiu uma vez -- o DICOM encolhia a marca abaixo de
    #     1080px e o Data nao, entao os dois apps mostravam tamanhos diferentes
    #     em qualquer tela menor.
    if len(APPS) > 1:
        blocos = {}
        for outro, cfg2 in APPS.items():
            t = open(os.path.join(RAIZ, cfg2['raiz'], '01_shell.html'), encoding='utf-8').read()
            a = t.find('/* ==== CABECALHO PADRAO')
            b = t.find('/* ==== FIM DO CABECALHO PADRAO ==== */')
            if a < 0 or b < 0:
                falhar('o shell de "%s" nao tem o bloco CABECALHO PADRAO delimitado.' % outro)
            blocos[outro] = t[a:b]
        distintos = set(blocos.values())
        if len(distintos) > 1:
            falhar('o bloco CABECALHO PADRAO diverge entre os aplicativos: ' +
                   ', '.join(sorted(blocos)) + '.\n'
                   'Ele e a assinatura da familia; edite os dois ou nenhum.')

    # 7. nenhuma dependencia externa: o arquivo tem de abrir offline
    ext = re.findall(r'(?:src|href)="https?://', html)
    if ext:
        falhar('recurso externo referenciado no HTML: ' + str(ext))

    h = hashlib.sha256(html.encode('utf-8')).hexdigest()
    print('validacao ...... ok')
    print('modulos ........ %d  (%d linhas de JS)' % (len(MODULOS), js.count('\n')))
    print('ids no HTML .... %d' % len(ids))
    print('tamanho ........ %d KB' % (len(html.encode()) // 1024))
    print('sha256 ......... ' + h)
    if validar:
        return

    os.makedirs(DIST, exist_ok=True)
    saida = os.path.join(DIST, cfg['saida'])

    # newline='' e obrigatorio: sem isso o Python traduz \n para \r\n no Windows,
    # o arquivo gravado deixa de bater com o hash calculado acima, e o SHA-256
    # publicado ao lado do download passa a acusar adulteracao onde nao ha.
    open(saida, 'w', encoding='utf-8', newline='').write(html)
    # o nome do .sha256 sai do app que esta sendo montado. Ficou fixo em
    # "DeFace_RT.html" quando o montador virou generico, e os dois apps passaram
    # a escrever NO MESMO arquivo: o do DICOM saia com o hash do Data.
    open(saida + '.sha256', 'w', newline='').write(h + '  ' + cfg['saida'] + '\n')

    # medir em vez de confiar: o hash e do arquivo em disco, nao do texto em memoria
    lido = open(saida, 'rb').read()
    h2 = hashlib.sha256(lido).hexdigest()
    if h2 != h:
        falhar('o arquivo gravado nao corresponde ao hash publicado\n'
               '  calculado: %s\n  em disco : %s (%d bytes)' % (h, h2, len(lido)))
    print('conferido ...... hash do arquivo em disco confere (%d bytes)' % len(lido))
    print('escrito ........ ' + saida)


def main():
    validar = '--validar' in sys.argv
    alvos = [a for a in sys.argv[1:] if a in APPS] or list(APPS)
    for nome in alvos:
        montar(nome, validar)


main()
