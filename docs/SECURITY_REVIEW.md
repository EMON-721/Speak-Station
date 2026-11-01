# Speak Station security review — 2026-11-01

Scope: public GitHub source plus the existing owner-private native Site.
No learner database, backup, production session cookie or owner's AI key was
read or used. Regression tests use an empty in-memory database and invented
identities, messages, audio, receipts and credentials only.

## Source and history

- Reviewed public main through `736aef6851b3dbac3ba46b6d8fa3bbb127c6077e`:
  120 reachable commits, about 1.87 MB of historical diff content. No extra
  public branches or tags were returned at the time of review.
- Independently scanned the private native source history: 25 reachable commits,
  about 1.50 MB of diff content, with no credential finding.
- No historical tracked credential-file, database-file, backup or log paths were
  found in public main. Schema-only SQL migrations remain public source.
- Default Gitleaks rules identified one historical synthetic OAuth test value.
  It was replaced by random test-only bytes. The scanner exception matches only
  that exact old fake value AND that exact test path; real key rules remain on.
- With that reviewed false-positive exception, historical scans pass. Staged
  source is scanned again before publication. Unreachable commits, other
  people's forks/clones, hosting accounts and prior external exports are
  outside this repository scan's coverage. Pattern scans cannot prove absence
  of every possible secret or personal-data format.

## Changes

1. Standalone builds fail closed if auth mode is removed or misspelled, rather
   than trusting caller-supplied identity headers. Native Sites preserves its
   own trusted platform authentication and private service boundary.
2. State/export responses omit AI connection details for non-owners and never
   serialize provider credentials. API responses use private/no-store caching.
3. All browser mutations enforce exact same-origin requests and cap actual
   streamed bytes. Missing/false Content-Length no longer bypasses body limits.
   The native append-only content updater keeps a narrowly scoped service
   exception; service access cannot read learner records or use admin APIs.
4. Provider/OAuth requests reject redirects carrying credentials. Integration
   errors and application logs never echo arbitrary upstream errors or bodies.
5. Browser responses add nosniff, no-referrer, HTTPS transport and restricted
   camera/geolocation permissions while preserving microphone access.
6. Git ignores private runtime artifacts. A separate tracked-path check rejects
   credential files, databases, backups, logs, generated configs and trace files.
7. Read-only CI scans all available history with fully redacted Gitleaks output,
   without uploading a secret report. Checkout credentials do not persist.
   Existing verification also tests the actual API permission boundaries and
   blocks known high/critical dependency advisories.
8. Patched Next.js, React/RSC, Zod, Vite, Sharp and affected transitive packages;
   retained the existing framework integration and release-age policy.

## Verification

- Real route handlers + isolated SQLite/R2 adapters: guest and non-owner admin
  denial; owner-only integration; cross-user state/export/audio/deletion denial;
  CSRF rejection; actual body limits; private cache headers; encrypted credential
  round trip, fresh IVs and tamper rejection; sanitized errors; private-file guard.
- Native private updater regression: authenticated service boundary retains
  append-only question updates, without learner export/admin access.
- Google OAuth simulations: PKCE, state, verified email, signed cookies,
  malicious redirect rejection, forged identity/header and session rejection,
  missing/incorrect standalone auth-mode rejection. No live provider calls.
- Existing speaking/assessment/owner/session/content/D1 migration tests and
  TypeScript checks run against the public source. Production Cloudflare build
  and native Site build are required before publishing their respective changes.
- `pnpm audit --prod`: 0 advisories at review time. Whole dependency tree:
  0 high, 0 critical; 3 moderate and 1 low remain in development-tool dependency
  paths (`esbuild`, `satori`, `minimatch`). These require upstream/compatibility
  updates; they have not been misrepresented as fixed by hiding audit output.
- Unauthenticated public Cloudflare endpoint checks returned HTTP 403 from the
  hosting boundary; they do not establish authenticated live app behavior.

## Limits and follow-up

Source hardening does not inspect or change Cloudflare account IAM, D1/R2
account permissions, backup-provider sharing, MFA, GitHub branch rules or
GitHub push-protection settings. Source-control permission and production
account administration remain separate. No history rewrite or provider-key
rotation was performed: no real exposed credential was identified by the scan.
Keep the native Site owner-private and leave the standalone private updater
flag disabled. Recheck runtime/dependency security when deploying changes;
there is no permanent one-time security guarantee.
