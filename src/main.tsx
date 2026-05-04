// IMPORTANT: Sentry must be initialised BEFORE React renders so any
// error thrown during initial mount (i18n bootstrap, router setup, etc.)
// is captured. initSentry() is a no-op when VITE_SENTRY_DSN is unset, so
// the line is safe to keep at the top regardless of environment.
import { initSentry } from './app/lib/sentry';
initSentry();

import './i18n';
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(<App />);
