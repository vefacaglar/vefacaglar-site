# @vefacaglar/ui

Private shared design package, kept in this monorepo for now. It contains the main site's palette, the graphite variant used by games/movies/profiles, shared form and button classes, and reusable React components. It has no Next.js, routing, auth, or application dependencies.

## Consume in a workspace

Add `"@vefacaglar/ui": "workspace:*"` to the consuming app. Import shared CSS once, before app-specific global CSS:

```tsx
import "@vefacaglar/ui/styles.css";
import "./globals.css";
```

The package exports TypeScript/TSX source. Next.js consumers need `transpilePackages: ["@vefacaglar/ui"]`; other bundlers must support TSX and CSS Modules. React 19 is a peer dependency. There is no package build or publishing step.

Next.js already declares `*.module.css` through `next-env.d.ts`. A non-Next TypeScript consumer that follows imports into this package's source needs an ambient declaration for CSS Modules. Opt in with `/// <reference types="@vefacaglar/ui/css-modules" />` in one of your `.d.ts` files, or add `"types": ["@vefacaglar/ui/css-modules"]` to `compilerOptions` (note that setting `types` restricts other automatic `@types` inclusion). The package never references it itself, to avoid duplicate declarations beside Next's.

For non-React integration, the CSS exports (`styles.css`, or `theme.css` and `controls.css` separately) do not depend on React. Loading the files in another repository is a future integration step; other projects have not been migrated here.

## Components

```tsx
import { Button, ButtonLink, SectionHeading, buttonClassName } from "@vefacaglar/ui";
import { ConfirmDialog } from "@vefacaglar/ui/confirm-dialog";

<Button type="submit">Save changes</Button>
<Button variant="ghost" type="button">Cancel</Button>
<ButtonLink href="/settings" variant="ghost">Settings</ButtonLink>
<SectionHeading title="Activity" subtitle="Your recent updates" />
```

`Button` renders a native button; set `type` explicitly where needed. `ButtonLink` renders a plain anchor. Use `buttonClassName(variant, className)` on a host router's link to retain client navigation. The website's existing `Button` is a thin Next.js adapter; its old import paths remain compatible.

`ConfirmDialog` is a client entry using a native modal dialog. Supply `open`, `message`, `confirmLabel`, `cancelLabel`, `onConfirm`, and `onCancel`; `pending` disables its buttons. Labels, locale, and async state belong to the host. Like `Button`, it relies on the global `btnAccent`/`btnGhost` classes, so the host must load `@vefacaglar/ui/styles.css` (or `controls.css` plus the theme tokens).

## Themes and styling

The default palette defines `--bg`, `--text`, `--text-heading`, `--muted`, `--border`, `--accent`, semantic colors, and font tokens. Put `data-ui-theme="graphite"` on a shell to enable the graphite surface palette and control variants. A `:has()` selector also mirrors the graphite palette onto the root for backgrounds and top-layer dialogs; the shell remains the fallback in browsers without `:has()` support.

The host loads the desired font source; `--font-body` defaults to Fira Code with monospace fallbacks. Global reset, body typography/spacing, page widths, scrollbars, and font downloads stay in the app. No casing transformation is applied by the shared package.

The shared global class contract is `btnAccent`, `btnGhost`, `field`, `label`, `input`, and `textarea`. Component-specific styles remain CSS Modules; interactive controls have square corners. Palette values live only in `src/theme.css`.

## Verify

```sh
pnpm --filter @vefacaglar/ui typecheck
pnpm --filter web typecheck
pnpm --filter web test
```

Web CI watches this package and verifies its types; the web Docker context includes its manifest and source.
