# Cloudflare Free hosting

This separate deployment path uses Cloudflare Workers Free, a free `workers.dev` address and D1. It does not subscribe to R2, enable Workers Paid, buy a domain or add a payment card. The existing Sites deployment is unchanged.

Cloudflare advertises Workers Free without a credit card: https://www.cloudflare.com/products/workers/. Free quotas are finite: https://developers.cloudflare.com/workers/platform/pricing/. D1 quotas: https://developers.cloudflare.com/d1/platform/pricing/. Do not activate R2 for this setup; its subscription checkout is separate: https://developers.cloudflare.com/r2/get-started/.

## Account setup

1. Use your Cloudflare Free account and select a Workers subdomain. Keep the account on the Free plan.
2. Install this repository's locked dependencies with `pnpm install --frozen-lockfile`, then run `pnpm exec wrangler login`.
3. Create the free database with `pnpm exec wrangler d1 create speak-station-free`. Copy the returned database ID into `wrangler.cloudflare.jsonc`.
4. Set `APP_ORIGIN` to your final `https://speak-station.<your-subdomain>.workers.dev` address. Set `ADMIN_EMAIL` to your own verified Google email. Only that verified email receives administrative access. Keep `CONTENT_UPDATES_ALLOWED` set to `disabled`; the private Sites scheduled writer is not exposed on this host.

## Google sign-in

The self-hosted app has Google sign-in because Sites identity headers are unavailable on your own Worker. Create an OAuth web application client in Google Cloud's Google Auth Platform. This basic sign-in flow requests only `openid email profile`; it does not need a Google Cloud billing account or a Gemini API key to sign in.

Set the authorized redirect URI to exactly `<APP_ORIGIN>/callback`. Configure the consent screen. While the OAuth app is in Testing, add your Google account and any intended testers as test users; use Google's publishing workflow before wider access. Follow https://developers.google.com/identity/protocols/oauth2/web-server.

Store the following through Cloudflare Worker **Secrets**, never in Git or browser storage. Wrangler prompts for values without putting them into shell command arguments:

```sh
pnpm exec wrangler secret put AUTH_SECRET --config wrangler.cloudflare.jsonc
pnpm exec wrangler secret put GOOGLE_CLIENT_ID --config wrangler.cloudflare.jsonc
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.cloudflare.jsonc
pnpm exec wrangler secret put CREDENTIAL_ENCRYPTION_KEY --config wrangler.cloudflare.jsonc
```

Use a securely generated random value of at least 32 characters for `AUTH_SECRET`. For `CREDENTIAL_ENCRYPTION_KEY`, generate exactly 32 random bytes encoded as base64, for example with a password manager or `openssl rand -base64 32`. Keep this encryption key stable after saving your Gemini connection; rotating it without migration makes that connection unreadable. A first secret upload may create the named Worker before the full deployment.

The server validates OAuth state, PKCE, verified Google identity and signed expiring HttpOnly cookies. Incoming identity headers are removed before applying verified identity. Sign-in is separate from Gemini assessment.

## Build and deploy

```sh
pnpm run check:cloudflare
pnpm run db:migrate:cloudflare
pnpm run build:cloudflare
pnpm run deploy:cloudflare
```

The build omits R2. The separate deployment file is `wrangler.cloudflare.jsonc`; do not deploy the native Sites-generated configuration to your own account. The deploy command refuses the included placeholder database ID, address and owner email. For Cloudflare Git integration, use `pnpm run build:cloudflare` as the build command and `pnpm run deploy:cloudflare` as the deploy command, and add the same D1 settings and secrets first.

After deploying, sign in with the configured owner's Google account. Open **Admin → AI connection**, securely connect your Gemini key and run its connection test. Google's Gemini quota and billing settings remain independent; this project does not enable a paid Google plan.

## Data and storage

The new D1 database starts separately from the current Sites database. Existing learners, transcripts, feedback, custom questions and the encrypted API connection are not automatically copied. Static questions are included in the build. Reconnect Gemini on the new host rather than copying plaintext credentials. A migration of existing learner data would need a separate authenticated export/import.

Recordings stay in browser memory for playback and are sent transiently to the assessment provider when submitted. New transcripts and feedback stay in the current tab’s memory; D1 retains identity, completed days and passed test milestones. Assessment proofs are signed and short-lived, with no response text. Permanent audio storage is disabled. Download any recording you want to retain before leaving the practice session.

Workers Free currently allows 100,000 requests per day and 10 ms CPU per request. D1 Free currently includes 5 million rows read per day, 100,000 rows written per day and 5 GB storage. Limits can change; check the official links above. Exceeding a free limit can interrupt service; this setup does not automatically upgrade a plan. The Vinext application must fit Workers Free CPU and bundle limits in your real account. Local build and dry-run checks do not replace that production check.

No deployment to your own Cloudflare account or real Google OAuth sign-in has been performed from this workspace. These require the account-specific configuration and secrets above. Authentication boundary tests use isolated fake credentials.


## Cloudflare dashboard: GitHub-based deployment

Open Cloudflare **Workers & Pages → Create application → Import a repository** and choose `EMON-721/Speak-Station`. Under project settings:

- Root path: `/`
- Build command: `pnpm run build:cloudflare`
- Deploy command: `pnpm run db:migrate:cloudflare && pnpm run deploy:cloudflare` (the token must be allowed to edit D1 as well as deploy Workers)
- Turn Preview builds off during initial setup. Leave Cloudflare Access off if the site is meant to be public; Google login still protects the learner/admin workspace.
- Use a dedicated Speak Station build token with Workers deploy/create permission and D1 edit permission; a token used for another website may not include D1.

In Advanced settings add these **build environment variables**, one at a time:

| Variable name | Value |
| --- | --- |
| `SPEAK_D1_DATABASE_ID` | Your new `speak-station-free` D1 database UUID |
| `SPEAK_APP_ORIGIN` | `https://speak-station.YOUR_ACCOUNT_SUBDOMAIN.workers.dev` with the real account subdomain |
| `SPEAK_ADMIN_EMAIL` | The owner's verified Google email |

These are build-time inputs. The deployment script validates them and creates an **untracked** `wrangler.cloudflare.generated.jsonc` for Wrangler. You do not need to commit your email address or database ID to GitHub. Alternatively, supply real values in the committed template, but avoid that for public repositories.

The `SPEAK_*` build variables are **not** Worker runtime secrets. Once the Worker exists, set `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `CREDENTIAL_ENCRYPTION_KEY` in **Worker → Settings → Variables & Secrets**, as encrypted secrets. Set Google's authorized OAuth redirect URI to exactly `SPEAK_APP_ORIGIN/callback`. Do not paste API tokens, OAuth client secrets, or encryption keys in the Git repository or chat.

Create the D1 database first from Cloudflare D1 before launching this build. The deploy command above runs all unapplied migrations against the new database before publishing. The configured build token must allow D1 access for this operation, otherwise migration fails safely and prevents a broken deployment. If you use a token that can only deploy Workers, perform the database migration separately with an authorized Wrangler session, then set the deploy command to `pnpm run deploy:cloudflare`.

Cloudflare Workers Builds variables are build-only; configured `vars` and Worker Secrets are provided to the running Worker. Deployment is **not** complete until Google OAuth, Worker Secrets, and the owner-managed Gemini connection have been configured and tested.
