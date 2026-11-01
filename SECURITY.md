# Security and private data

Public source does not grant access to the running database. Only schema
migrations and synthetic test fixtures belong in this repository. Never commit
credentials, learner exports, database files, audio, backups, private logs,
production screenshots, session cookies, or authentication/browser trace files.

## Credentials

Store real values in Cloudflare Worker Secrets (native Sites: secret runtime
entries), never plaintext Wrangler `vars` or public `VITE_*`/`NEXT_PUBLIC_*`
variables. `.env.example` documents names only. Local `.env*` and `.dev.vars*`
files, local storage directories, generated configuration, backups and logs are
ignored. The tracked-file check also rejects private artifacts even when someone
uses `git add -f`. GitHub Actions scans all available history with Gitleaks, fully
redacts matches, and does not publish secret reports.

The shared AI key remains encrypted in server-side D1 with AES-GCM and a fresh
random IV for every write. The encryption key stays in the provider's secret
store. Do not rotate that encryption key casually: the original value is needed
to decrypt the existing saved provider connection. API keys never appear in
state/export responses, URLs, frontend storage or logs. Provider requests reject
redirects so authorization headers cannot follow a redirect to another host.

## Access boundaries

Standalone builds require Google authentication even if `AUTH_MODE` is removed
or misspelled. Visitor-supplied identity headers are stripped; only a verified,
signed session establishes identity. Owner-only APIs verify the configured owner
on the server. Learner records, exports, support messages and legacy audio are
scoped to the authenticated user. Unauthorized audio requests fail before R2 is
read. UI visibility is additional convenience, not the permission check.

Mutations require the exact application Origin, reject cross-site requests and
limit actual streamed bytes, including absent or false Content-Length headers.
State/export responses are private and non-cacheable. Errors and application
logs use fixed messages rather than database rows, keys, request bodies or raw
upstream error strings. AI connection metadata is returned only to the owner.

Native owner-private Sites retains its existing dispatch-authenticated,
append-only question updater. This service identity cannot export learner data
or use admin APIs. It is disabled on standalone Google hosting. Recheck native
owner-only audience before every content update; disable the private updater
before sharing that Site. Source visibility and Site audience are independent.

## If a credential ever leaks

Revoke/rotate the exposed credential at its provider first. Deleting a file or
making the repository private does not revoke a key or erase prior clones.
Review provider usage and follow GitHub's sensitive-data removal workflow if
history cleanup is needed. Do not post the value in an issue, PR, chat or log.
Credential replacement and history rewriting are separate operations; this
hardening did not rewrite history or replace working production credentials.

## Account controls outside this repository

Use MFA for GitHub/Google/Cloudflare accounts, least-privilege collaborator and
API-token scopes, private database/backup access and private object storage.
Enable GitHub secret scanning/push protection and a branch rule requiring both
verification workflows. These account settings cannot be enforced by source
code; an Actions check runs after push, so it does not itself prevent a leaked
value from reaching GitHub. Never treat a green scan as a security guarantee.

Keep dependency patches current. CI rejects high/critical dependency advisories.
No permanent one-time change can protect against future vulnerabilities or a
compromised owner account. See docs/SECURITY_REVIEW.md for the checked scope and
remaining verification limits.
