import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtimeEnv", () => ({
  apiUrl: () => "https://api.teste",
  realtimeUrl: () => "",
}));

const marca = {
  is_default: false,
  slug: "lojafacil",
  product_name: "Loja Fácil",
  color_primary: "#2563eb",
  app_icon: "https://cdn.teste/app.png",
};
const padrao = { is_default: true, product_name: "AG3" };
const resposta = (data: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ data }) } as Response);

beforeEach(async () => {
  document.head.innerHTML = [
    '<meta name="apple-mobile-web-app-title" content="AG3">',
    '<link rel="manifest" href="/manifest.webmanifest">',
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">',
  ].join("");
  document.title = "AG3";
  (await import("./brand")).resetBrandForTests();
});

afterEach(() => vi.unstubAllGlobals());

const manifest = () => document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!;

describe("marca do white label no app", () => {
  it("no endereço do parceiro: nome, ícone, cor e o manifesto do app instalável dele", async () => {
    const fetchMock = vi.fn(() => resposta(marca));
    vi.stubGlobal("fetch", fetchMock);
    const { loadHostBrand, getBrand, syncCompanyBrand } = await import("./brand");
    await loadHostBrand("lojafacil-m.ag3system.com");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.teste/branding?host=lojafacil-m.ag3system.com",
      {
        credentials: "omit",
      }
    );
    expect(document.title).toBe("Loja Fácil");
    expect(
      document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')!.content
    ).toBe("Loja Fácil");
    expect(document.querySelector('link[rel="apple-touch-icon"]')!.getAttribute("href")).toBe(
      "https://cdn.teste/app.png"
    );
    expect(manifest().getAttribute("href")).toBe(
      "https://api.teste/branding/manifest?host=lojafacil-m.ag3system.com"
    );
    expect(manifest().crossOrigin).toBe("anonymous");
    expect(document.getElementById("brand-colors")!.textContent).toContain("--primary:221 83% 53%");
    await syncCompanyBrand(null); // o endereço manda
    expect(getBrand().product_name).toBe("Loja Fácil");
  });

  it("em mobile.ag3system.com: marca da empresa aberta na tela, mas o app instalado continua o da AG3", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => resposta(url.includes("slug=") ? marca : padrao))
    );
    const { loadHostBrand, getBrand, syncCompanyBrand } = await import("./brand");
    await loadHostBrand("mobile.ag3system.com");
    await syncCompanyBrand("lojafacil");
    expect(getBrand().product_name).toBe("Loja Fácil");
    expect(document.title).toBe("Loja Fácil");
    expect(manifest().getAttribute("href")).toBe("/manifest.webmanifest");
    await syncCompanyBrand(undefined);
    expect(getBrand().is_default).toBe(true);
    expect(document.title).toBe("AG3");
    expect(document.querySelector('link[rel="icon"]')!.getAttribute("href")).toBe("/favicon.svg");
    expect(document.getElementById("brand-colors")).toBeNull();
  });

  it("falha na rota da marca = app de sempre", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("rede")))
    );
    const { loadHostBrand } = await import("./brand");
    expect((await loadHostBrand("lojafacil-m.ag3system.com")).is_default).toBe(true);
    expect(manifest().getAttribute("href")).toBe("/manifest.webmanifest");
  });
});
