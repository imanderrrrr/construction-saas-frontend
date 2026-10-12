// IMPORTANT: Sentry must be initialised BEFORE React renders so any
// error thrown during initial mount (i18n bootstrap, router setup, etc.)
// is captured. initSentry() is a no-op when VITE_SENTRY_DSN is unset, so
// the line is safe to keep at the top regardless of environment.
import { initSentry } from './app/lib/sentry';
initSentry();

import { i18nReady } from './i18n';
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { preloadRoute } from './app/routes';
import "./styles/index.css";

// The page on screen starts loading now, alongside the shell's translations
// (AUD-019). The first render waits only for those few kilobytes: rendering
// before them would paint raw keys.
preloadRoute(window.location.pathname);
i18nReady.finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
