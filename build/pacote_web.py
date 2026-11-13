#!/usr/bin/env python3
"""Prepara snapshot publico e ZIP para o webmaster, sem publicar ou enviar mensagens.

O destino remoto e recebido explicitamente depois da conferencia da conta/nome.
Somente arquivos da lista permitida entram; .git e historico local nunca entram.
"""
import argparse
import hashlib
import json
import pathlib
import re
import sys
import zipfile

sys.stdout.reconfigure(encoding='utf-8')
RAIZ = pathlib.Path(__file__).resolve().parents[1]


def sha(b):
    return hashlib.sha256(b).hexdigest()


def preparar(repo, programa, data):
    if not re.fullmatch(r'https://github\.com/drhenriquebraga/[A-Za-z0-9_.-]+', repo):
        raise SystemExit('Informe o repositorio conferido na conta drhenriquebraga.')
    if not programa.startswith('https://') or not data.startswith('https://'):
        raise SystemExit('Informe os dois destinos HTTPS para conferencia posterior.')
    versao = dict(l.split('=', 1) for l in (RAIZ/'entrega.txt').read_text().splitlines() if '=' in l)['VERSAO']
    nome_repo = repo.rsplit('/', 1)[-1]
    snapshot = RAIZ/'.publicacao'/nome_repo
    destino = RAIZ/'release'/('v'+versao)
    conteudo = {}

    def inserir(nome, valor):
        conteudo[nome] = valor.encode('utf-8') if isinstance(valor, str) else valor

    for pasta in ('src', 'data', 'testes', 'exemplos', 'LICENSES'):
        for p in sorted((RAIZ/pasta).rglob('*')):
            if p.is_file() and '__pycache__' not in p.parts:
                inserir(p.relative_to(RAIZ).as_posix(), p.read_bytes())
    for nome in ('README.md','LICENSE','PRODUCT.md','DESIGN.md','entrega.txt',
                 'build/montar.py','build/fonts_b64.json','build/gerar_exemplos.js',
                 'build/baixar_exemplos_publicos.py','build/auditar_segredos.py',
                 'build/pacote_web.py','deploy/_headers','docs/VALIDACAO.md','docs/08_BIBLIOGRAFIA.md'):
        inserir(nome, (RAIZ/nome).read_bytes())
    if (RAIZ/'docs/AUDITORIA_PUBLICACAO.md').exists():
        inserir('docs/AUDITORIA_PUBLICACAO.md', (RAIZ/'docs/AUDITORIA_PUBLICACAO.md').read_bytes())
    inserir('.gitignore', 'dist/\nrelease/\ntmp/\n.publicacao/\nnode_modules/\n.venv/\n__pycache__/\n*.pyc\n')
    inserir('.gitattributes', '* -text\n')
    inserir('.nojekyll', '')

    apps = {}
    for nome in ('DeFace_RT.html', 'DeFace_RT_Data.html'):
        b = (RAIZ/'dist'/nome).read_bytes()
        esperado = (RAIZ/'dist'/(nome+'.sha256')).read_text().split()[0]
        if sha(b) != esperado:
            raise SystemExit('Hash divergente: '+nome)
        apps[nome] = {'sha256':sha(b), 'bytes':len(b)}
        inserir('downloads/'+nome, b)
        inserir('downloads/'+nome+'.sha256', sha(b)+'  '+nome+'\n')
    inserir('index.html', (RAIZ/'dist/DeFace_RT.html').read_bytes())
    inserir('data/index.html', (RAIZ/'dist/DeFace_RT_Data.html').read_bytes())

    destinos = {'versao':versao, 'data':'2026-11-13', 'raiz_repositorios':'https://github.com/drhenriquebraga',
        'repositorio':repo, 'programa_dicom':programa, 'programa_data':data,
        'rotas_site':{'dicom':'/deface/dicom/', 'data':'/deface/data/'},
        'artefatos':apps,
        'nota':'Os destinos devem ser conferidos por HTTP antes de anunciar a publicacao.'}
    inserir('PUBLICACAO.json', json.dumps(destinos, ensure_ascii=False, indent=2)+'\n')

    fragmento = f'''<!-- DeFace RT {versao}: substituir somente o conteudo da minipagina correspondente. -->
<section class="deface-estudio" aria-labelledby="deface-estudio-titulo">
  <h1 id="deface-estudio-titulo">Aprenda o que seus dados podem revelar.</h1>
  <p>Explore casos sintéticos e entenda os limites da pseudonimização.</p>
  <div class="deface-estudio-opcoes">
    <a href="{programa}" target="_blank" rel="noopener noreferrer"><strong>Imagem DICOM</strong><span>Compare métodos, imagens e cabeçalhos com um fantoma de TC ou RM.</span><b>Explorar imagens ↗</b></a>
    <a href="{data}" target="_blank" rel="noopener noreferrer"><strong>Texto</strong><span>Troque identificadores, revise o resultado e teste a restauração.</span><b>Explorar texto ↗</b></a>
  </div>
  <p class="deface-estudio-nota">Processamento local no navegador · Exemplos sem dados de pacientes</p>
  <details><summary>Privacidade, limites e código-fonte</summary>
    <p>Uso educacional. Não validado para uso clínico. Pseudonimização não é anonimização; revise imagens, cabeçalhos e textos antes de divulgar.</p>
    <p>Os programas não utilizam IA e funcionam offline depois de baixados. <a href="{repo}" target="_blank" rel="noopener noreferrer">Código-fonte, exemplos e documentação</a>.</p>
  </details>
</section>
<style>
.deface-estudio{{max-width:800px;margin:auto;padding:32px 20px;color:#e4ecf5;font-family:inherit;line-height:1.55}}
.deface-estudio h1{{font-size:clamp(28px,4vw,40px);line-height:1.15;margin:0 0 16px;letter-spacing:-.025em}}
.deface-estudio p{{color:#b0c0d6}}.deface-estudio-opcoes{{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:32px 0}}
.deface-estudio-opcoes a{{display:flex;flex-direction:column;gap:14px;padding:24px;border:1px solid #30425b;border-radius:12px;background:#111e32;color:inherit;text-decoration:none}}
.deface-estudio-opcoes strong{{font-size:24px}}.deface-estudio-opcoes span{{color:#b0c0d6}}.deface-estudio-opcoes b{{color:#9bb6ff;margin-top:auto}}
.deface-estudio a:focus-visible,.deface-estudio summary:focus-visible{{outline:2px solid #9bb6ff;outline-offset:4px}}
.deface-estudio details{{border-top:1px solid #30425b;padding-top:18px}}.deface-estudio summary{{cursor:pointer}}
.deface-estudio details a{{color:#9bb6ff}}.deface-estudio-nota{{font-size:14px}}@media(max-width:580px){{.deface-estudio-opcoes{{grid-template-columns:1fr}}}}
</style>
'''
    mensagem = f'''Lucas e equipe de agentes,

O DeFace RT foi atualizado para a versão {versao}, com o design Estúdio e foco educacional. A entrada agora oferece casos sintéticos de TC, RM e texto, com roteiro para comparar resultados, investigar cabeçalhos e compreender os limites da pseudonimização.

Por favor, atualizem o card DeFace RT em Motores → Produtividade no radioterapia.ai. Na minipágina correspondente, usem estes destinos, abrindo em nova aba:

- Imagem DICOM: {programa}
- Texto / DeFace RT Data: {data}
- Repositório do DeFace RT (os dois aplicativos): {repo}

A raiz atual dos repositórios é https://github.com/drhenriquebraga. Confiram o destino real de cada repositório antes de atualizar outros cards; não deduzam nomes nem substituam URLs em massa. Esta entrega corresponde somente ao DeFace RT.

O ZIP DEFACE_RT_v{versao}_WEBMASTER.zip contém os programas offline, a estrutura site/deface/dicom/ e site/deface/data/, fragmento da minipágina, fontes, licenças, exemplos, roteiro de testes, auditoria e SHA-256. O fragmento está em integracao/pagina_deface.html.

Se preferirem hospedar no próprio domínio, copiem site/ para a raiz publicada, preservando /deface/dicom/ e /deface/data/. Mesclem as regras do arquivo _headers com as existentes e ajustem apenas os dois href do fragmento. Não sobrescrevam a configuração geral do site. Abram os aplicativos em nova aba, sem iframe. Não injetem analytics, Rocket Loader, ofuscação de e-mail ou minificação nos HTMLs. Preservem connect-src 'none' e os bytes dos artefatos.

Depois do update, testem o distintivo de isolamento, o exemplo TC/RM, os cinco métodos, cabeçalhos, geometria e exportações; no Data, testem pseudonimização, revisão e restauração simulada. Confiram o hash dos arquivos servidos com SHA256SUMS.txt. O pacote traz casos públicos efetivamente sintéticos, com origem e licença, e exemplos autorais; não há exames de pacientes.

Mantenham a descrição: “Ferramenta educacional. Pseudonimização não é anonimização. Não validada para uso clínico.”

Henrique
'''
    instrucoes = f'''# Integração DeFace RT {versao}

## Destinos desta entrega

- DICOM: {programa}
- Data: {data}
- Código dos dois aplicativos: {repo}
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
'''
    inserir('integracao/pagina_deface.html', fragmento)
    inserir('integracao/INSTRUCOES_SITE.md', instrucoes)

    # Snapshot sem dados internos, historico local, cache, log de maquina ou token.
    for nome, b in conteudo.items():
        p = snapshot/nome
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b)

    pacote = dict(conteudo)
    # O rascunho pessoal fica na entrega para Henrique, fora do repositorio.
    pacote['MENSAGEM_LUCAS.md'] = mensagem.encode('utf-8')
    for nome in apps:
        pacote['programas/'+nome] = conteudo['downloads/'+nome]
        pacote['programas/'+nome+'.sha256'] = conteudo['downloads/'+nome+'.sha256']
    pacote['site/deface/dicom/index.html'] = conteudo['index.html']
    pacote['site/deface/data/index.html'] = conteudo['data/index.html']
    pacote['site/_headers'] = (RAIZ/'deploy/_headers').read_bytes()
    local = fragmento.replace(programa, '/deface/dicom/').replace(data, '/deface/data/')
    pagina = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DeFace RT — aprender e explorar</title></head><body style="background:#081222;margin:0;font-family:system-ui,sans-serif">'+local+'</body></html>'
    pacote['site/deface/index.html'] = pagina.encode('utf-8')
    for nome in ('bancos.log','navegador_dicom.log','navegador_data.log','auditoria.log'):
        p = RAIZ/'dist/qa'/nome
        if p.exists():
            pacote['validacao/'+nome] = p.read_bytes()
    manifesto = ''.join(sha(b)+'  '+nome+'\n' for nome,b in sorted(pacote.items()))
    pacote['SHA256SUMS.txt'] = manifesto.encode('utf-8')
    destino.mkdir(parents=True, exist_ok=True)
    arqzip = destino/f'DEFACE_RT_v{versao}_WEBMASTER.zip'
    with zipfile.ZipFile(arqzip, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for nome,b in sorted(pacote.items()):
            info = zipfile.ZipInfo(nome, date_time=(2026,11,13,12,0,0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            z.writestr(info,b,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
    (destino/(arqzip.name+'.sha256')).write_text(sha(arqzip.read_bytes())+'  '+arqzip.name+'\n',encoding='utf-8')
    (destino/'MENSAGEM_LUCAS.md').write_text(mensagem,encoding='utf-8')
    (destino/'INSTRUCOES_SITE.md').write_text(instrucoes,encoding='utf-8')
    (destino/'SHA256SUMS.txt').write_text(manifesto,encoding='utf-8')
    (destino/'PUBLICACAO.json').write_text(json.dumps(destinos,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'snapshot':str(snapshot),'zip':str(arqzip),'bytes':arqzip.stat().st_size,
        'sha256':sha(arqzip.read_bytes()),'arquivos':len(pacote)},ensure_ascii=False,indent=2))


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repositorio', required=True)
    p.add_argument('--programa', required=True)
    p.add_argument('--data', required=True)
    a = p.parse_args()
    preparar(a.repositorio.rstrip('/'), a.programa, a.data)
