/** Segue o tema do aparelho. Roda antes do primeiro render, para não piscar. */
export function applySystemTheme(): void {
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (!media) return;
  const apply = () => document.documentElement.classList.toggle("dark", media.matches);
  apply();
  media.addEventListener("change", apply);
}
