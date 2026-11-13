/* Teste de ponta a ponta do DeFace RT Data com texto inteiramente fictício.
   Rode depois de python build/montar.py data.
   PLAYWRIGHT_MODULE e PLAYWRIGHT_CHROMIUM_EXECUTABLE são opcionais. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const raiz = path.resolve(__dirname, '..');
const saida = path.join(raiz, 'dist', 'qa');
async function processar(pagina) {
  await pagina.click('#btnRun');
  await pagina.waitForFunction(() => !E.ocupado && E.mapa !== null);
}
async function testar() {
  fs.mkdirSync(saida, { recursive: true });
  const navegador = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  try {
    const contexto = await navegador.newContext({ viewport: { width: 1536, height: 960 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const pagina = await contexto.newPage();
    const erros = [], requisicoes = [];
    pagina.on('pageerror', (e) => erros.push(e.message));
    pagina.on('request', (r) => { if (/^https?:/i.test(r.url())) requisicoes.push(r.url()); });
    await pagina.goto(pathToFileURL(path.join(raiz, 'dist', 'DeFace_RT_Data.html')).href);
    await pagina.waitForLoadState('networkidle');
    await pagina.waitForFunction(() => document.getElementById('badgeRede').textContent.includes('confirmado'));
    assert.equal(await pagina.locator('#boasVindas').isVisible(), true);
    assert.equal(await pagina.locator('#estudio').isVisible(), false);
    if (process.env.CAPTURAR_QA !== '0') await pagina.screenshot({ path: path.join(saida, 'data-inicio-desktop.png'), fullPage: true });
    await pagina.setViewportSize({ width: 390, height: 844 });
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (process.env.CAPTURAR_QA !== '0') await pagina.screenshot({ path: path.join(saida, 'data-inicio-mobile.png'), fullPage: true });
    await pagina.setViewportSize({ width: 1536, height: 960 });

    await pagina.locator('#btnSobre').focus();
    await pagina.keyboard.press('Enter');
    assert.equal(await pagina.locator('#sobreFundo').isVisible(), true);
    await pagina.keyboard.press('Tab');
    assert.equal(await pagina.locator('#btnFecharSobre').evaluate((e) => document.activeElement === e), true);
    await pagina.keyboard.press('Escape');
    assert.equal(await pagina.locator('#btnSobre').evaluate((e) => document.activeElement === e), true);

    await pagina.click('#btnExemplo');
    const original = await pagina.locator('#txtEntrada').inputValue();
    assert.ok(original.includes('CASO SINTÉTICO'));
    assert.equal(await pagina.locator('#caixaResultado').isVisible(), false);
    await processar(pagina);
    const pseudonimo = await pagina.locator('#txtSaida').inputValue();
    assert.notEqual(pseudonimo, original);
    assert.ok(pseudonimo.includes('[PESSOA-'));
    assert.ok(!pseudonimo.includes('529.982.247-25'));
    assert.ok(Number(await pagina.locator('#mTrocas').innerText()) > 10);
    assert.ok(Number(await pagina.locator('#mEntidades').innerText()) > 5);
    assert.ok(await pagina.locator('#tblTrocas tbody tr').count() >= 5);
    if (process.env.CAPTURAR_QA !== '0') await pagina.screenshot({ path: path.join(saida, 'data-revisao-desktop.png'), fullPage: true });
    await pagina.setViewportSize({ width: 390, height: 844 });
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (process.env.CAPTURAR_QA !== '0') await pagina.screenshot({ path: path.join(saida, 'data-revisao-mobile.png'), fullPage: true });
    await pagina.setViewportSize({ width: 1536, height: 960 });
    await pagina.click('#btnCopiar');
    assert.equal((await pagina.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n'), pseudonimo);

    await pagina.click('#btnTestarRestauracao');
    assert.ok((await pagina.locator('#rotuloResposta').innerText()).includes('simulada'));
    assert.equal(await pagina.locator('#txtResposta').inputValue(), pseudonimo);
    await pagina.keyboard.press('Control+Enter');
    assert.equal(await pagina.locator('#txtRevertido').inputValue(), original, 'Restauração exata, caractere por caractere.');
    await pagina.click('#btnCopiarRev');
    assert.equal((await pagina.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n'), original);
    await pagina.locator('#txtResposta').fill(pseudonimo + '\n[ROTULO-DESCONHECIDO]');
    assert.equal(await pagina.locator('#txtRevertido').inputValue(), '');
    assert.equal(await pagina.locator('#btnCopiarRev').isDisabled(), true);

    // Original, opções e semente descartam o mapa anterior, sem saída obsoleta copiável.
    await pagina.click('#abaPs');
    await pagina.locator('#txtEntrada').fill(original + '\nLinha fictícia acrescentada.');
    assert.equal(await pagina.locator('#txtSaida').inputValue(), '');
    assert.equal(await pagina.evaluate(() => E.mapa), null);
    assert.equal(await pagina.locator('#abaRev').isDisabled(), true);
    await processar(pagina);
    await pagina.locator('.settings summary').click();
    await pagina.uncheck('#optDatas');
    assert.equal(await pagina.evaluate(() => E.mapa), null);
    assert.equal(await pagina.locator('#btnCopiar').isDisabled(), true);
    await processar(pagina);
    await pagina.locator('#seed').fill('SEMENTE-DE-TESTE');
    await pagina.locator('#seed').blur();
    assert.equal(await pagina.evaluate(() => E.mapa), null);
    assert.equal(await pagina.locator('#txtSaida').inputValue(), '');
    await processar(pagina);
    await pagina.click('#btnSeed');
    assert.equal(await pagina.evaluate(() => E.mapa), null);
    await processar(pagina);
    await pagina.check('#optAgressivo');
    assert.equal(await pagina.evaluate(() => E.mapa), null);
    await pagina.click('#btnLimpar');
    assert.equal(await pagina.locator('#txtEntrada').inputValue(), '');
    assert.equal(await pagina.locator('#btnRun').isDisabled(), true);
    assert.equal(await pagina.locator('#btnTestarRestauracao').isDisabled(), true);

    await pagina.click('#btnNovo');
    await pagina.click('#btnMeuTexto');
    await pagina.locator('#txtEntrada').fill('Paciente: João Exemplo Silva\nE-mail: teste@example.invalid\nTexto fictício para teste.');
    await pagina.keyboard.press('Control+Enter');
    await pagina.waitForFunction(() => !E.ocupado && E.mapa !== null);
    assert.ok((await pagina.locator('#txtSaida').inputValue()).includes('[EMAIL-'));
    await pagina.click('#btnLimpar');
    assert.equal(await pagina.evaluate(() => E.mapa), null);
    assert.deepEqual(erros, []);
    assert.ok(requisicoes.every((url) => url === 'https://isolamento.invalid/deface-rt-data'));
    console.log('Data navegador: exemplo, pseudonimização, revisão, restauração exata, clipboard, invalidação por edição/opções/semente, limpeza, teclado, CSP e 390px passaram.');
  } finally { await navegador.close(); }
}
testar().catch((e) => { console.error(e); process.exitCode = 1; });
