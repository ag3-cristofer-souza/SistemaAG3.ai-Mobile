// Gera public/icons/* com o globo do site (src/assets/globo.svg) em fundo branco, como o `apple-touch-icon` de LP-AG3.
// O `apple-touch-icon` e o `favicon.svg` são os próprios arquivos do site. Usa o Chrome instalado.
// Rodar de novo só quando a arte mudar: node scripts/gerar-icones.mjs
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BACKGROUND = "#ffffff";
const svg = readFileSync("src/assets/globo.svg").toString("base64");

/** `globe` = fração do lado ocupada pelo globo. Ícone maskable pode ser recortado: o globo fica na zona segura (80%). */
const ICONS = [
  { name: "icon-192", size: 192, globe: 0.8 },
  { name: "icon-512", size: 512, globe: 0.8 },
  { name: "icon-maskable-512", size: 512, globe: 0.6 },
  { name: "favicon-48", size: 48, globe: 0.9 },
];

const browser = await chromium.launch({ channel: "chrome" });

// Traços dos ícones do lucide (mesma família das telas).
const GLYPHS = {
  "aviso-mensagem": '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  "aviso-fila":
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
  "aviso-transferencia":
    '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
  "aviso-agenda":
    '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  "aviso-ativo":
    '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
};
const GLOBE =
  '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>';

/** Ícone transparente: `fundo` vazio deixa só o traço branco. */
async function glyph(name, paths, size, fundo) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const inner = Math.round(size * (fundo ? 0.5 : 0.84));
  await page.setContent(
    `<!doctype html><body style="margin:0;background:transparent;display:grid;place-items:center;height:${size}px">` +
      `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${fundo || "transparent"};display:grid;place-items:center">` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${inner}" height="${inner}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg></div></body>`
  );
  await page.screenshot({ path: `public/icons/${name}.png`, omitBackground: true });
  await page.close();
}

// Ícone grande de cada tipo de aviso, no azul da marca.
for (const [name, paths] of Object.entries(GLYPHS)) await glyph(name, paths, 192, "#12224e");
// Ícone da barra de status: o Android usa só o formato, então precisa ser branco e transparente.
await glyph("aviso-barra", GLOBE, 96, "");
for (const { name, size, globe } of ICONS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const inner = Math.round(size * globe);
  await page.setContent(
    `<!doctype html><body style="margin:0;background:${BACKGROUND};display:grid;place-items:center;height:${size}px">` +
      `<img width="${inner}" height="${inner}" src="data:image/svg+xml;base64,${svg}"></body>`
  );
  await page.screenshot({ path: `public/icons/${name}.png` });
  await page.close();
}
await browser.close();
