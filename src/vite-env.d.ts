/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_PLATFORM_API_ORIGIN?: string;
  /** Public Cloudflare Turnstile site key of the landing assistant; unset turns the assistant into an email notice. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /** Public PostHog project key of the public website; unset ships no analytics at all. */
  readonly VITE_POSTHOG_KEY?: string;
  /** PostHog ingestion host; defaults to the `/ingest` rewrite on our own domain. */
  readonly VITE_POSTHOG_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
