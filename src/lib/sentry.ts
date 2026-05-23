import * as Sentry from '@sentry/react';

/**
 * Initialise Sentry uniquement si VITE_SENTRY_DSN est defini en build/runtime.
 * Sans DSN, ce module ne fait rien (no-op) — pas d'erreur, pas de network.
 *
 * Active automatiquement le replay session + browser tracing en prod.
 * Sample rates volontairement bas pour la phase actuelle (cout budget).
 *
 * Pour activer :
 *   1. Creer un projet sur sentry.io > Browser > React
 *   2. Recuperer le DSN (https://<key>@<org>.ingest.sentry.io/<id>)
 *   3. Ajouter en repo secret GitHub : VITE_SENTRY_DSN
 *   4. Localement : copier .env.example -> .env et remplir VITE_SENTRY_DSN
 *
 * Cf. https://docs.sentry.io/platforms/javascript/guides/react/
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || dsn.trim() === '') {
    // Pas configure -> no-op silencieux. Ne pas logger pour ne pas polluer la console.
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // 'development' | 'production'
    // Sample rate des traces (browser perf) — 10% en prod, 100% en dev.
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    // Sample rate des replays — 1% des sessions, 100% quand une erreur arrive.
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,
    // Intgrations par defaut : BrowserTracing + Replay.
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Masque texte + media par defaut (PII Whateka users)
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Filtre des erreurs non actionnables (extensions browser, etc.).
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],
  });
}
