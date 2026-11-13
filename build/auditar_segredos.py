#!/usr/bin/env python3
"""Inspeciona conteudo e historico Git sem imprimir valores sensiveis.

Uso: python build/auditar_segredos.py --raiz repositorio --arquivo entrega.zip --relatorio caminho.json
As ocorrencias sao candidatos para revisao humana, nao prova de um vazamento.
O relatorio registra apenas caminho, objeto, categoria e linha, nunca valores.
"""
import argparse
import collections
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import zipfile
import io

sys.stdout.reconfigure(encoding="utf-8")

REGRAS = {
    "chave_privada": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----"),
    "token_github": re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b"),
    "token_openai": re.compile(r"\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b"),
    "chave_google": re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b"),
    "chave_aws": re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    "token_slack": re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b"),
    "token_oauth_google": re.compile(r"\bya29\.[A-Za-z0-9_-]{30,}\b"),
    "jwt": re.compile(r"\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b"),
    "url_com_credencial": re.compile(r"https?://[^\s/@:]{2,}:[^\s/@]{3,}@", re.I),
    "atribuicao_sensivel": re.compile(r"\b(?:password|passwd|senha|api[_-]?key|api[_-]?token|access[_-]?token|client[_-]?secret|secret[_-]?key)[\"']?\s*[:=]\s*[\"'][^\"'\r\n]{8,}[\"']", re.I),
    "credencial_ambiente": re.compile(r"\b(?:GITHUB_TOKEN|GH_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY|CLOUDFLARE_API_TOKEN|AWS_SECRET_ACCESS_KEY|SUPABASE_SERVICE_ROLE_KEY)[\"']?\s*[:=]\s*[\"']?[A-Za-z0-9_+./=-]{20,}", re.I),
    "autorizacao_literal": re.compile(r"\b(?:Bearer|Basic)\s+[A-Za-z0-9_+/=-]{20,}\b", re.I),
    "credencial_query_url": re.compile(r"https?://[^\s\"']+[?&](?:access_token|api_key|token|password|key)=[A-Za-z0-9_%+/-]{16,}", re.I),
    "email_para_revisao": re.compile(r"(?<![\w.-])[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}(?![\w.-])", re.I),
    "caminho_pessoal": re.compile(r"(?:[A-Z]:[\\/]+Users[\\/]+[^\s\\/\"']+|/(?:Users|home)/[^/\s\"']+)", re.I),
    "identificador_br_para_revisao": re.compile(r"\b(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})\b"),
}
EXT_SENSIVEIS = {".pem", ".p12", ".pfx", ".key", ".kdbx", ".sqlite", ".db"}
EXT_MEDICAS = {".dcm", ".dicom", ".nii", ".mha", ".mhd", ".nrrd"}


def git(raiz, *args):
    return subprocess.check_output(["git", "-C", str(raiz), *args], stderr=subprocess.PIPE)


def examinar(conteudo, caminho, origem, objeto, achados, profundidade=0):
    def registrar(categoria, linha=None):
        achados.append({"origem": origem, "objeto": objeto, "caminho": caminho,
                        "categoria": categoria, "linha": linha})
    parte = pathlib.PurePosixPath(caminho)
    if parte.suffix.lower() in EXT_SENSIVEIS or parte.name.lower() in {".env", "credentials", "id_rsa", "id_ed25519"}:
        registrar("arquivo_sensivel")
    if parte.suffix.lower() in EXT_MEDICAS or conteudo[128:132] == b"DICM":
        registrar("imagem_medica_exige_proveniencia")
    if conteudo.startswith(b"PK\x03\x04"):
        if profundidade >= 2:
            registrar("arquivo_zip_acima_da_profundidade")
            return
        try:
            with zipfile.ZipFile(io.BytesIO(conteudo)) as z:
                for entrada in z.infolist():
                    if entrada.is_dir():
                        continue
                    if entrada.file_size > 100 * 1024 * 1024:
                        registrar("arquivo_zip_acima_do_limite")
                        continue
                    examinar(z.read(entrada), caminho + "!" + entrada.filename, origem,
                             objeto, achados, profundidade + 1)
        except (zipfile.BadZipFile, RuntimeError):
            registrar("arquivo_zip_nao_inspecionado")
        return
    if b"\x00" in conteudo[:8192]:
        return
    texto = conteudo.decode("utf-8", errors="replace")
    for categoria, regra in REGRAS.items():
        for m in regra.finditer(texto):
            # Enderecos reservados de exemplos e noreply sao fatos publicos,
            # mas permanecem no relatorio para a revisao distinguir sua origem.
            registrar(categoria, texto.count("\n", 0, m.start()) + 1)


def auditar(raiz, relatorio=None, arquivos_extras=()):
    achados = []
    refs = git(raiz, "for-each-ref", "--format=%(refname) %(objectname)").decode().splitlines()
    commits = git(raiz, "rev-list", "--all").decode().splitlines()
    objetos = {}
    for linha in git(raiz, "rev-list", "--objects", "--all").decode("utf-8").splitlines():
        campos = linha.split(" ", 1)
        objetos.setdefault(campos[0], campos[1] if len(campos) > 1 else "[metadados]")
    blobs = 0
    for sha, caminho in objetos.items():
        tipo = git(raiz, "cat-file", "-t", sha).strip()
        if tipo not in (b"blob", b"commit", b"tag"):
            continue
        if tipo == b"blob":
            blobs += 1
        examinar(git(raiz, "cat-file", "-p", sha), caminho,
                 "historico_" + tipo.decode(), sha, achados)
    nomes = set(git(raiz, "ls-files", "-z").decode().split("\0"))
    nomes.update(git(raiz, "ls-files", "--others", "--exclude-standard", "-z").decode().split("\0"))
    nomes.discard("")
    manifesto = []
    for nome in sorted(nomes):
        arq = raiz / nome
        if not arq.is_file() or (relatorio and arq.resolve() == relatorio.resolve()):
            continue
        b = arq.read_bytes()
        h = hashlib.sha256(b).hexdigest()
        manifesto.append({"caminho": nome, "bytes": len(b), "sha256": h})
        examinar(b, nome, "arvore_atual", h, achados)
    extras = []
    for arq in arquivos_extras:
        b = arq.read_bytes()
        h = hashlib.sha256(b).hexdigest()
        extras.append({"arquivo": arq.name, "bytes": len(b), "sha256": h})
        examinar(b, arq.name, "artefato_adicional", h, achados)
    dados = {"escopo": "arvore rastreada e nao ignorada; todos os objetos alcancaveis por refs Git",
             "refs": refs, "commits": len(commits), "objetos": len(objetos), "blobs": blobs,
             "arquivos_atuais": len(manifesto), "manifesto": manifesto,
             "artefatos_adicionais": extras,
             "categorias": dict(collections.Counter(a["categoria"] for a in achados)),
             "achados": achados,
             "limites": ["Regex nao prova ausencia absoluta de segredos ou identidade.",
                         "Binarios exigem proveniencia; ZIPs limitados a 100 MiB por entrada e dois niveis.",
                         "Arquivos ignorados e objetos Git inalcançaveis nao entram em um push normal e nao foram varridos."]}
    if relatorio:
        relatorio.parent.mkdir(parents=True, exist_ok=True)
        relatorio.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return dados


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raiz", type=pathlib.Path, default=pathlib.Path.cwd())
    ap.add_argument("--relatorio", type=pathlib.Path)
    ap.add_argument("--arquivo", type=pathlib.Path, action="append", default=[],
                    help="Artefato adicional (por exemplo ZIP final); pode ser repetido.")
    op = ap.parse_args()
    resultado = auditar(op.raiz.resolve(), op.relatorio, op.arquivo)
    print(json.dumps({k: resultado[k] for k in ("commits", "objetos", "blobs", "arquivos_atuais", "categorias")}, ensure_ascii=False, indent=2))
    print("Candidatos exigem revisao humana. Nenhum valor sensivel e exibido.")
