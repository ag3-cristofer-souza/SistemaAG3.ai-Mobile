// Gera public/icons/* a partir do globo da marca (src/assets/globo.svg). Usa o Chrome instalado.
// Rodar de novo só quando a arte mudar: node scripts/gerar-icones.mjs
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const NAVY = "#0d1426";
const svg = readFileSync("src/assets/globo.svg").toString("base64");

/** `globe` = fração do lado ocupada pelo globo. Ícone maskable pode ser recortado: o globo fica na zona segura (80%). */
const ICONS = [
  { name: "icon-192", size: 192, globe: 0.8 },
  { name: "icon-512", size: 512, globe: 0.8 },
  { name: "icon-maskable-512", size: 512, globe: 0.6 },
  { name: "apple-touch-icon", size: 180, globe: 0.78 },
  { name: "favicon-48", size: 48, globe: 0.9 },
];

const browser = await chromium.launch({ channel: "chrome" });
for (const { name, size, globe } of ICONS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const inner = Math.round(size * globe);
  await page.setContent(
    `<!doctype html><body style="margin:0;background:${NAVY};display:grid;place-items:center;height:${size}px">` +
      `<img width="${inner}" height="${inner}" src="data:image/svg+xml;base64,${svg}"></body>`
  );
  await page.screenshot({ path: `public/icons/${name}.png` });
  await page.close();
}
await browser.close();
