import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { applyTenantTheme } from "./config/tenant.js";
import { initSentry } from "./config/sentry.js";
import { initChunkReload } from "./config/chunkReload.js";

initSentry();
initChunkReload();
applyTenantTheme();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
