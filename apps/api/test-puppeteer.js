const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent('<h1>Teste</h1>');
  const pdf = await page.pdf();
  console.log('✅ PDF gerado, tamanho:', pdf.length);
  await browser.close();
})();
