# Shared UI package

This is the private, source-exported `@vefacaglar/ui` workspace package. Keep it small and reusable across the website, library pages, and future React consumers.

Follow the root coordination rules: the primary conversation only orchestrates; Luna explores read-only, Astra advises on architecture read-only, Sol implements complex changes, and Terra handles routine changes and independent verification. Use at most two agents concurrently. Never silently substitute a requested role or model. Execution agents do not spawn more agents.

Do not import Next.js, app code, authentication, routing, dictionaries, network clients, or business/domain logic here. Keep adapters in the consuming app. Components receive labels and content through props and use natural capitalization.

`src/theme.css` is the only palette source. `src/controls.css` owns the existing `btnAccent`, `btnGhost`, and form-field class contract. These explicit global stylesheet exports are the shared-design exception to the root CSS Modules rule. All other component styles use CSS Modules imported as `styles`, theme variables, and square corners. Do not add global resets or font downloads to this package.

Keep interactive hooks in explicit `"use client"` modules. Keep the default entry usable by server components. Preserve source exports and CSS side effects; consumers transpile the package. Do not publish it without a separate user request.

Verify with `pnpm --filter @vefacaglar/ui typecheck` and `pnpm --filter web typecheck`; run relevant existing web helper tests. Do not run a production build during an active coding session.
