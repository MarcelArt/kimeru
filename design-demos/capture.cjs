const { chromium } = require('/home/marcel/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const path = require('node:path');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.emulateMedia({reducedMotion:'reduce'});
  const mode = process.argv[2] || 'drafts';
  if (mode === 'check') {
    const report=[];
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    for (const n of [1,2,3]) {
      await page.goto('file://' + path.resolve(`design-demos/dir-${n}.html`));
      await page.locator('#provider').selectOption('clef');
      const warning = await page.locator(n===1?'#warning':'#capability-warning').isVisible();
      const logo = await page.locator('#provider-logo').evaluate(i=>i.complete&&i.naturalWidth>0);
      await page.locator('#provider').selectOption('jev');
      if(n===1){
        await page.locator('#questions summary').first().click();
        await page.locator('#instruction-category').fill('Edited sample question');
        await page.locator('#add-question').click();
        await page.locator('[data-result="json"]').click();
        if(!await page.locator('#json-output').isVisible())errors.push('A JSON tab failed');
        await page.locator('[data-result="visual"]').click();
        await page.locator('#overlay-toggle').uncheck();
        if(await page.locator('#box').isVisible())errors.push('A overlay toggle failed');
        await page.locator('#run').click();
        await page.waitForFunction(()=>!document.querySelector('#run').disabled);
      }else if(n===2){
        await page.locator('#state-json').fill('{"title":"Edited sample"}');
        await page.locator('[data-tab="image"]').click();
        await page.locator('#toggle-overlay').click();
        if(await page.locator('#bounding-box').isVisible())errors.push('B overlay toggle failed');
        await page.locator('[data-tab="all"]').click();
        await page.locator('#run-preview').click();
        await page.locator('#history-nav').click();
        if(!await page.locator('dialog[open]').count())errors.push('B history dialog failed');
        await page.keyboard.press('Escape');
      }else{
        await page.locator('#instructions').fill('Edited sample question');
        await page.locator('#overlay-toggle').click();
        await page.locator('#result-json').click();
        if(!await page.locator('#json-output').isVisible())errors.push('C JSON tab failed');
        await page.locator('#run-preview').click();
        await page.waitForFunction(()=>!document.querySelector('#run-preview').disabled);
      }
      report.push({direction:n,clefBoxWarning:warning,cloudflareLogoLoaded:logo});
      if(!warning||!logo)errors.push(`Direction ${n} provider check failed`);
    }
    fs.writeFileSync('design-demos/verification.json',JSON.stringify({report,errors},null,2));
    console.log(JSON.stringify({report,errors}));
    await browser.close();
    process.exitCode=errors.length?1:0;
    return;
  }
  const targets = mode === 'references'
    ? [['https://openwebui.com/blog/v0-11-0-the-interface-reorganized', 'references/openwebui'], ['https://hoppscotch.io', 'references/hoppscotch']]
    : (mode === 'gallery' ? [['http://127.0.0.1:4174/', 'gallery']] : mode === 'thumbs' ? [['file://' + path.resolve('design-demos/thumbs.html'), 'thumbs']] : [1,2,3].map(n => ['file://' + path.resolve(`design-demos/dir-${n}.html`), `dir-${n}`]));
  for (const [url, name] of targets) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 }).catch(async () => page.waitForLoadState('domcontentloaded'));
      await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({ path: `design-demos/${name}.png`, fullPage: false });
      await page.screenshot({ path: `design-demos/${name}-full.png`, fullPage: true });
      if (mode === 'references' && name.includes('openwebui')) {
        const images = await page.locator('img').evaluateAll(nodes => nodes.map(n => ({alt:n.alt, src:n.src})));
        fs.writeFileSync('design-demos/references/openwebui-images.json', JSON.stringify(images, null, 2));
        const ui = page.locator('img').filter({visible:true});
        for (let i = 0; i < await ui.count(); i++) {
          const alt = await ui.nth(i).getAttribute('alt');
          if (/conversation|sidebar|interface|chat/i.test(alt || '')) await ui.nth(i).screenshot({path:`design-demos/references/openwebui-ui-${i}.png`}).catch(()=>{});
        }
      }
      if (mode === 'drafts') {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.reload({waitUntil:'load'});
        await page.evaluate(()=>document.fonts.ready);
        await page.screenshot({ path: `design-demos/${name}-mobile.png`, fullPage: true });
        console.log(name, JSON.stringify(await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, brokenImages: [...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.alt) }))));
        await page.setViewportSize({ width: 1440, height: 900 });
      }
      console.log(`Captured ${name}`);
    } catch (error) { console.error(name, error.message); }
  }
  await browser.close();
})();
