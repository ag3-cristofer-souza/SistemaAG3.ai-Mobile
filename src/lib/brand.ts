import { useSyncExternalStore } from "react";
import { brandingApi, DEFAULT_BRAND, type Brand } from "@/api/branding";

/**
 * Marca do white label no app: pelo endereço (`<slug>-m.ag3system.com`) antes do login e, em mobile.ag3system.com,
 * pela empresa aberta. O endereço manda. Sem marca, nada muda.
 */
let current: Brand = DEFAULT_BRAND;
let hostBrand: Brand | null = null;
let hostName = window.location.hostname;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const snapshot = () => current;

export const getBrand = () => current;
export const useBrand = () => useSyncExternalStore(subscribe, snapshot, snapshot);

/** `#1a2b3c` → `"210 40% 17%"` (formato das variáveis de cor do tema). Inválido → null. */
export function hexToHslTriplet(hex: string | undefined): string | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m?.[1]) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const ICONS = 'link[rel="icon"], link[rel="apple-touch-icon"]';
let original: {
  title: string;
  appTitle: string | null;
  manifest: string | null;
  icons: { link: HTMLLinkElement; href: string; type: string | null }[];
} | null = null;

/** Título, nome na tela de início (iPhone), ícones e manifesto do app instalável (Android). */
export function applyBrandToDocument(brand: Brand, host = hostName): void {
  const appTitle = document.querySelector<HTMLMetaElement>(
    'meta[name="apple-mobile-web-app-title"]'
  );
  const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  original ??= {
    title: document.title,
    appTitle: appTitle?.content ?? null,
    manifest: manifest?.getAttribute("href") ?? null,
    icons: [...document.querySelectorAll<HTMLLinkElement>(ICONS)].map((link) => ({
      link,
      href: link.getAttribute("href") ?? "",
      type: link.getAttribute("type"),
    })),
  };
  const branded = !brand.is_default;
  document.title = branded ? brand.product_name : original.title;
  if (appTitle) appTitle.content = branded ? brand.product_name : (original.appTitle ?? "");
  const icon = branded ? (brand.app_icon ?? brand.favicon) : undefined;
  original.icons.forEach(({ link, href, type }) => {
    link.href = icon ?? href;
    if (icon || type === null) link.removeAttribute("type");
    else link.setAttribute("type", type);
  });
  document.getElementById("brand-colors")?.remove();
  const light = branded ? hexToHslTriplet(brand.color_primary) : null;
  if (light) {
    const dark = hexToHslTriplet(brand.color_primary_dark) ?? light;
    const style = document.createElement("style");
    style.id = "brand-colors";
    style.textContent = `:root{--primary:${light};--ring:${light}}.dark{--primary:${dark};--ring:${dark}}`;
    document.head.appendChild(style);
  }
  // O manifesto por endereço só existe no endereço do app do parceiro; na empresa aberta em mobile.ag3system.com o
  // app instalado continua o da AG3 (o endereço é que decide o que fica na tela de início).
  if (manifest && original.manifest !== null) {
    const onBrandHost = branded && hostBrand !== null && !hostBrand.is_default;
    manifest.href = onBrandHost ? brandingApi.manifestUrl(host) : original.manifest;
    if (onBrandHost) manifest.crossOrigin = "anonymous";
    else manifest.removeAttribute("crossorigin");
  }
}

function setBrand(brand: Brand): void {
  current = brand;
  applyBrandToDocument(brand);
  listeners.forEach((fn) => fn());
}

export async function loadHostBrand(host = window.location.hostname): Promise<Brand> {
  hostName = host;
  hostBrand = await brandingApi.fetch({ host });
  if (!hostBrand.is_default) setBrand(hostBrand);
  return hostBrand;
}

export async function syncCompanyBrand(slug: string | null | undefined): Promise<void> {
  if (hostBrand && !hostBrand.is_default) return;
  if (!slug) {
    if (!current.is_default) setBrand(DEFAULT_BRAND);
    return;
  }
  if (current.slug === slug) return;
  setBrand(await brandingApi.fetch({ slug }));
}

/** Só para os testes: volta ao estado do começo. */
export function resetBrandForTests(): void {
  current = DEFAULT_BRAND;
  hostBrand = null;
  hostName = window.location.hostname;
  original = null;
}
