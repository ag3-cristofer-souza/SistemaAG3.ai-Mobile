import { describe, expect, it } from "vitest";
import { detectPlatform, installSkipped, skipInstall } from "./pwa";

describe("detectPlatform", () => {
  it("reconhece iPhone e Android", () => {
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", 5)).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 7)", 5)).toBe("android");
  });

  it("reconhece iPad que se identifica como Mac, sem confundir com um Mac", () => {
    const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
    expect(detectPlatform(mac, 5)).toBe("ios");
    expect(detectPlatform(mac, 0)).toBe("desktop");
  });
});

describe("skipInstall", () => {
  it("lembra a escolha no aparelho", () => {
    expect(installSkipped()).toBe(false);
    skipInstall();
    expect(installSkipped()).toBe(true);
  });
});
