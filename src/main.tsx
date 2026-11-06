import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "./index.css";
import { captureInstallEvents } from "./lib/pwa";
import { applySystemTheme } from "./lib/theme";

applySystemTheme();
captureInstallEvents();
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
