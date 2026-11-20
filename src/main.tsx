import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "./index.css";
import { captureInstallEvents } from "./lib/pwa";
import { loadHostBrand } from "./lib/brand";

captureInstallEvents();
registerSW({ immediate: true });
void loadHostBrand(); // white label: a marca do endereço do app (`<slug>-m.ag3system.com`), antes do login

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
