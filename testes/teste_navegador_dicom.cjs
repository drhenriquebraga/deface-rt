/* Fluxo real do DICOM no Chromium: exemplos, comparação, cabeçalhos e entrega.
   Rode depois de python build/montar.py.
   PLAYWRIGHT_MODULE pode apontar para uma instalação existente de Playwright.
   PLAYWRIGHT_CHROMIUM_EXECUTABLE é opcional para navegador já instalado.
   Não baixa dependências; usa a TC pública autorizada e RM sintética auxiliar. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const raiz = path.resolve(__dirname, '..');
const saida = path.join(raiz, 'dist', 'qa');

async function aguardarCaso(pagina) {
  await pagina.waitForFunction(() => !E.ocupado && E.vol && E.pixAtual, null, { timeout: 120000 });
}
async function aguardarPronto(pagina, metodo) {
  await pagina.waitForFunction(id => !E.ocupado && E.resultados.size === 1 && E.atual === id, metodo, { timeout: 120000 });
}
async function aplicarCard(pagina, metodo) {
  await pagina.click('#methodCards [data-metodo="' + metodo + '"]');
  await aguardarPronto(pagina, metodo);
}
async function baixar(pagina, id, nome) {
  const evento = pagina.waitForEvent('download');
  await pagina.click(id);
  const download = await evento;
  const destino = path.join(saida, nome);
  await download.saveAs(destino);
  assert.ok(fs.statSync(destino).size > 100, 'Download não pode estar vazio.');
  await pagina.waitForFunction(() => !E.ocupado);
  return destino;
}
async function testar() {
  fs.mkdirSync(saida, { recursive: true });
  const navegador = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {})
  });
  try {
    const pagina = await navegador.newPage({ viewport: { width: 1536, height: 960 } });
    const erros = [], requisicoes = [];
    pagina.on('pageerror', (e) => erros.push(e.message));
    pagina.on('request', (r) => { if (/^https?:/i.test(r.url())) requisicoes.push(r.url()); });
    await pagina.goto(pathToFileURL(path.join(raiz, 'dist', 'DeFace_RT.html')).href);
    await pagina.waitForLoadState('networkidle');
    assert.equal(await pagina.locator('#boasVindas').isVisible(), true);
    assert.equal(await pagina.locator('#estudio').isVisible(), false);
    await pagina.waitForFunction(() => document.getElementById('badgeRede').textContent.includes('confirmado'));
    if (process.env.CAPTURAR_QA !== '0') await pagina.screenshot({ path: path.join(saida, 'dicom-inicio-desktop.png'), fullPage: true });
    await pagina.setViewportSize({ width: 390, height: 844 });
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (process.env.CAPTURAR_QA !== '0') await pagina.screenshot({ path: path.join(saida, 'dicom-inicio-mobile.png'), fullPage: true });
    await pagina.setViewportSize({ width: 1536, height: 960 });

    // Ajuda abre pelo teclado, prende foco e devolve ao botão ao fechar.
    await pagina.locator('#btnSobre').focus();
    await pagina.keyboard.press('Enter');
    assert.equal(await pagina.locator('#modal').isVisible(), true);
    await pagina.keyboard.press('Tab');
    assert.equal(await pagina.evaluate(() => document.getElementById('modal').contains(document.activeElement)), true);
    await pagina.keyboard.press('Escape');
    assert.equal(await pagina.locator('#btnSobre').evaluate((e) => e === document.activeElement), true);

    await pagina.click('#btnExemplo');
    await aguardarCaso(pagina);
    assert.deepEqual(await pagina.evaluate(() => [E.vol.nx, E.vol.ny, E.vol.nz]), [208, 260, 53]);
    assert.ok((await pagina.locator('#tipoEstudo').innerText()).includes('TC real'));
    assert.ok((await pagina.locator('#tipoEstudo').innerText()).includes('Pat8'));
    assert.equal(await pagina.locator('#methodCards [role="radio"]').count(), 5);
    assert.equal(await pagina.locator('#selMet, #checks, #btnRun, #detMetodos').count(), 0, 'Não deve restar dropdown ou seleção em lote.');
    assert.equal(await pagina.locator('#methodCards [aria-checked="true"]').count(), 0);
    assert.equal(await pagina.evaluate(() => E.resultados.size), 0, 'Abrir exemplo não executa métodos.');
    assert.equal(await pagina.evaluate(() => E.pixAtual === E.vol.pix), true, 'O resultado inicial mostra o original.');
    assert.equal(await pagina.locator('#btnDl').isDisabled(), true);
    // Instrumenta o motor para comprovar execução exclusiva e origem invariável.
    await pagina.evaluate(() => {
      window.__chamadas = [];
      window.__hashPix = p => { let h = 2166136261; for (let i = 0; i < p.length; i++) h = Math.imul(h ^ p[i], 16777619); return h >>> 0; };
      window.__original = __hashPix(E.vol.pix);
      const motor = aplicarMetodo;
      aplicarMetodo = async (...args) => {
        __chamadas.push({ id: args[3], original: args[0] === E.vol && __hashPix(args[0].pix) === __original });
        return motor(...args);
      };
    });
    const metodos = ['plano', 'recorte', 'ruido', 'suave', 'generica'];
    for (let i = 0; i < metodos.length; i++) {
      const metodo = metodos[i];
      await aplicarCard(pagina, metodo);
      assert.equal(await pagina.locator('#methodCards [aria-checked="true"]').count(), 1);
      assert.equal(await pagina.locator('#methodCards [aria-checked="true"]').getAttribute('data-metodo'), metodo);
      assert.deepEqual(await pagina.evaluate(() => [...E.resultados.keys()]), [metodo]);
      const chamadas = await pagina.evaluate(() => __chamadas);
      assert.deepEqual(chamadas.map(c => c.id), metodos.slice(0, i + 1), 'Cada clique deve executar somente um algoritmo.');
      assert.ok(chamadas.every(c => c.original), 'Todos os métodos devem partir dos mesmos pixels originais.');
    }
    assert.equal(await pagina.evaluate(() => __hashPix(E.vol.pix) === __original), true);
    await aplicarCard(pagina, 'plano');
    await pagina.locator('#methodCards [data-metodo="plano"]').focus();
    await pagina.keyboard.press('ArrowRight');
    await aguardarPronto(pagina, 'recorte');
    assert.equal(await pagina.locator('#methodCards [data-metodo="recorte"]').getAttribute('tabindex'), '0');
    assert.equal(await pagina.locator('#methodCards [data-metodo="recorte"]').evaluate(el => document.activeElement === el), true);
    await aplicarCard(pagina, 'plano');
    const pixels3D = await pagina.evaluate(() => ['c3L', 'c3R'].map((id) => {
      const c = document.getElementById(id), p = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      return { largura: c.width, claros: p.filter((v, i) => i % 4 === 0 && v > 70).length };
    }));
    assert.ok(pixels3D.every((p) => p.largura === 424 && p.claros > 1000), 'Ambos os visores devem conter o fantoma.');
    const escalas = await pagina.evaluate(() => ['c3L', 'c3R'].map(id => {
      const r = document.getElementById(id).getBoundingClientRect(); return [r.width, r.height];
    }));
    assert.deepEqual(escalas[0], escalas[1], 'Original e resultado precisam usar a mesma escala na comparação.');
    if (process.env.CAPTURAR_QA !== '0') await pagina.screenshot({ path: path.join(saida, 'dicom-revisao-desktop.png'), fullPage: true });
    await pagina.setViewportSize({ width: 390, height: 844 });
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (process.env.CAPTURAR_QA !== '0') await pagina.screenshot({ path: path.join(saida, 'dicom-revisao-mobile.png'), fullPage: true });
    await pagina.setViewportSize({ width: 1536, height: 960 });

    // O arrasto muda os ângulos dos dois painéis; os controles de corte acompanham.
    const quadro = await pagina.locator('#c3L').boundingBox();
    await pagina.mouse.move(quadro.x + quadro.width / 2, quadro.y + quadro.height / 2);
    await pagina.mouse.down();
    await pagina.mouse.move(quadro.x + quadro.width / 2 + 40, quadro.y + quadro.height / 2 + 20, { steps: 4 });
    await pagina.mouse.up();
    assert.notEqual(await pagina.evaluate(() => E.yaw), 30);
    await pagina.click('#abasEstudio [data-view="mpr"]');
    await pagina.locator('#sAx').focus();
    const corteAntes = await pagina.locator('#sAx').inputValue();
    await pagina.keyboard.press('ArrowRight');
    assert.notEqual(await pagina.locator('#sAx').inputValue(), corteAntes);
    assert.equal(await pagina.locator('#iAx').innerText(), await pagina.locator('#riAx').innerText());
    const janela = await pagina.locator('#btnPreset').innerText();
    await pagina.click('#btnPreset');
    assert.notEqual(await pagina.locator('#btnPreset').innerText(), janela);

    // Trocar o limiar invalida a revisão anterior e recalcula o detector.
    await pagina.click('#abasEstudio [data-view="d3"]');
    await pagina.check('#revisaoConfirmada');
    await pagina.locator('#thr').evaluate((el) => { el.value = '100'; el.dispatchEvent(new Event('input', {bubbles:true})); });
    assert.equal(await pagina.locator('#btnDl').isDisabled(), true);
    assert.equal(await pagina.evaluate(() => E.resultados.size), 0);
    assert.equal(await pagina.evaluate(() => E.pixAtual === E.vol.pix), true);
    assert.equal(await pagina.locator('#methodCards [aria-checked="true"]').count(), 0);
    await aplicarCard(pagina, 'plano');
    assert.equal(await pagina.evaluate(() => E.an.limiar), 100);
    await pagina.locator('#thr').evaluate((el) => { el.value = '-400'; el.dispatchEvent(new Event('input', {bubbles:true})); });
    await aplicarCard(pagina, 'plano');
    assert.equal(await pagina.evaluate(() => E.an.limiar), -400);

    await pagina.click('#btnCabecalhos');
    assert.ok(await pagina.locator('#tblHdr tbody tr').count() > 30);
    assert.ok((await pagina.locator('#tblHdr').innerText()).includes('PUBLICO'));
    assert.ok((await pagina.locator('#tblHdrR').innerText()).includes('ANONIMO'));
    await pagina.click('#btnGeometria');
    assert.ok((await pagina.locator('#metrics').innerText()).includes('Deslocamento médio'));
    assert.equal(await pagina.locator('#btnDl').isDisabled(), true);
    await pagina.check('#revisaoConfirmada');
    assert.equal(await pagina.locator('#btnDl').isDisabled(), false);
    await aplicarCard(pagina, 'suave');
    assert.equal(await pagina.locator('#btnDl').isDisabled(), true, 'Trocar método exige rever a saída.');
    await pagina.check('#revisaoConfirmada');
    await pagina.locator('#seed').evaluate(el => { el.value = 'SEMENTE-EDITADA'; el.dispatchEvent(new Event('input', {bubbles:true})); });
    assert.equal(await pagina.evaluate(() => E.resultados.size), 0, 'Editar semente invalida resultados.');
    assert.equal(await pagina.locator('#btnDl').isDisabled(), true);
    assert.equal(await pagina.locator('#methodCards [aria-checked="true"]').count(), 0);
    await pagina.locator('#seed').evaluate(el => { el.value = 'AULA-DEFACE-2026'; el.dispatchEvent(new Event('input', {bubbles:true})); });
    await aplicarCard(pagina, 'suave');
    await pagina.check('#revisaoConfirmada');
    const idPrevisto = await pagina.locator('#tblHdrR tbody tr').filter({hasText:'Prontuário do paciente'}).locator('td').nth(2).innerText();
    assert.equal(idPrevisto, 'DFRT-AULADEFAC');
    const derivado = await baixar(pagina, '#btnDl', 'dicom-derivado.zip');
    await pagina.click('#segFmt [data-fmt="nifti"]');
    const nifti = await baixar(pagina, '#btnDl', 'nifti-derivado.zip');
    const original = await baixar(pagina, '#btnBaixarExemplo', 'dicom-original.zip');
    for (const arquivo of [derivado, nifti, original]) {
      const bytes = fs.readFileSync(arquivo);
      let pos = 0, credito = '';
      while (pos + 30 <= bytes.length && bytes.readUInt32LE(pos) === 0x04034b50) {
        assert.equal(bytes.readUInt16LE(pos + 8), 0);
        const n = bytes.readUInt32LE(pos + 18), nomeLen = bytes.readUInt16LE(pos + 26), extraLen = bytes.readUInt16LE(pos + 28);
        const nome = bytes.subarray(pos + 30, pos + 30 + nomeLen).toString();
        const inicio = pos + 30 + nomeLen + extraLen;
        if (nome.endsWith('FONTE_LICENCA_E_CONSENTIMENTO.txt')) credito = bytes.subarray(inicio, inicio + n).toString();
        pos = inicio + n;
      }
      assert.ok(credito.includes('CC BY 4.0') && credito.includes('10.6084/m9.figshare.8857007.v2') && credito.includes('Egger'));
      if (arquivo !== original) assert.ok(credito.includes('Adaptação desta entrega:'));
    }

    // Reabre os dois ZIPs entregues pelo aplicativo, pelo input real de arquivos.
    for (const arquivo of [derivado, original]) {
      await pagina.click('#btnNovo');
      await pagina.setInputFiles('#fArqs', arquivo);
      await pagina.waitForFunction(() => !E.ocupado && E.vol && E.vol.nz === 53, null, { timeout: 120000 });
      assert.equal(await pagina.locator('#methodCards button:enabled').count(), 5);
      assert.equal(await pagina.evaluate(() => E.resultados.size), 0);
      assert.equal(await pagina.evaluate(() => E.fontePublica), true, 'Atribuição pública acompanha a reimportação.');
      if (arquivo === derivado) assert.equal(await pagina.evaluate(() => E.vol.refLeitor.txt('00100020')), idPrevisto,
        'O ID mostrado na revisão precisa ser o mesmo gravado no DICOM.');
    }
    await pagina.click('#btnNovo');
    // RM continua aceita por importação, usando o arquivo sintético auxiliar.
    await pagina.click('#segMod [data-mod="MR"]');
    await pagina.setInputFiles('#fArqs', path.join(raiz, 'exemplos/sinteticos/FANTOMA_RM_SINTETICO.zip'));
    await aguardarCaso(pagina);
    await aplicarCard(pagina, 'plano');
    assert.equal(await pagina.evaluate(() => E.modalidade), 'MR');
    assert.equal(await pagina.evaluate(() => E.vol.modalidade), 'MR');
    assert.equal(await pagina.evaluate(() => E.fontePublica), false, 'Não atribuir dados próprios à coleção pública.');
    assert.ok(await pagina.evaluate(() => E.limiar > 0));
    await pagina.click('#abasEstudio [data-view="mpr"]');
    assert.ok((await pagina.locator('#btnPreset').innerText()).startsWith('RM'));

    await pagina.click('#btnNovo');
    await pagina.setInputFiles('#fArqs', { name: 'arquivo-invalido.dcm', mimeType: 'application/dicom', buffer: Buffer.from('NAO E DICOM') });
    await pagina.waitForFunction(() => !E.ocupado && document.getElementById('statusInicio').classList.contains('error'));
    assert.equal(await pagina.locator('#boasVindas').isVisible(), true);
    assert.equal(await pagina.locator('#btnExemplo').isDisabled(), false);
    assert.equal(await pagina.locator('#btnDl').isDisabled(), true);
    assert.deepEqual(erros, [], 'Nenhuma exceção não tratada no navegador.');
    assert.ok(requisicoes.every((url) => url === 'https://isolamento.invalid/deface-rt'), 'Nenhuma requisição externa além da tentativa bloqueada do autoteste.');
    console.log('DICOM navegador: TC real pública, importação RM, 5 cards exclusivos, um algoritmo por clique desde o original, teclado, invalidação de semente/limiar, 3D/MPR, cabeçalhos, geometria, ZIP/NIfTI, reimportação, erro e 390px passaram.');
  } finally { await navegador.close(); }
}
testar().catch((e) => { console.error(e); process.exitCode = 1; });
