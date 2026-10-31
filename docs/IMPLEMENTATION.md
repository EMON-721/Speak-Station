# Speak Station — current implementation

## This update

- One homepage for speaking practice, topic discovery, exams, revision, lessons and progress. The sidebar is removed. The identity uses cobalt blue, coral and a pale lavender canvas.
- 3,060 original practice prompts: 3,000 template-based seeds plus 60 specifically written prompts on Education, Technology, Culture and Environment. Topic and part filters, difficulty, search, saved questions and repeatable practice remain available. Dynamic content additions can increase this total.
- Thirty numbered weekly exam sets and fifteen revision sets. A 210-day track supports thirty required weekly and fifteen biweekly milestones, including the final day-210 gates. Older 90/120/180-day tracks remain selectable. Open exam practice does not bypass required progression checks.
- Start speaking now has an actual consent → microphone request flow. Persistent error panels distinguish insecure/unsupported contexts, iframe policy blocks, denied permissions, missing microphones and busy devices. A standalone-tab link and browser/Windows permission instructions are available in the studio. Browser permission cannot be overridden by application code.
- English/Bengali live-transcription selection. Browser speech-service support and device permissions still determine whether live transcription works. Original script is preserved; translation is not substituted for a transcript.
- Transcript-only practice works when a microphone is unavailable. It is explicitly excluded from recorded daily/exam completion and acoustic pronunciation assessment.
- Audio remains device-local until the user requests assessment. The default `/api/submit` path sends audio transiently to the provider and does not store it in R2. It saves transcript, structured feedback and attempt metadata after a successful evaluation. Optional permanent audio saving is opt-in. The separate Audio & history navigation has been removed; previous answers are expandable inside progress.
- Owner-only Google AI Studio connection panel with password field, live key/model verification and encrypted server-side storage. AES-256-GCM uses a server secret; the key is never returned, logged or stored in localStorage. Official Google for Developers setup video and Google documentation are linked. Owner setup requires a real Gemini key; no new key has been created on the user's behalf.
- Existing secure ChatGPT sign-in and owner admin remain. Admin can add questions using normal form fields; advanced JSON import is optional. Separate Google OAuth remains unconnected.
- Append-only private content writer with duplicate/ID checks, audit entries and readback helper; see CONTENT_UPDATES.md for unattended additions. Scheduling is only claimed after its native creation succeeds and the service writer has been verified.

## Assessment

Gemini can receive audio plus the original browser transcript and return sentence corrections, missing ideas, contextual vocabulary, an improved answer and priorities. OpenAI's alternative environment-based adapter remains available. Provider output is schema-validated and transcript-only requests cannot receive acoustic pronunciation observations.

All numeric bands remain null until human-rated scoring calibration and full-test validation are available. A successful API-key test verifies authentication/model availability; it does not prove a particular spoken answer was assessed. The owner's real key and user-device recording still require a live end-to-end assessment test.

## Validation

- TypeScript no-emit check and production Vinext build.
- Core checks cover 3,060 distinct prompts, correct part distribution, all 210 assignments, topic rotation, thirty weekly/fifteen revision gates and Bangladesh-time streaks.
- The real route handler is exercised with isolated SQLite/object-store and mocked provider boundaries. Checks cover authorization, same-origin writes, private recordings, encrypted Gemini configuration, transient audio with no R2 retention, transcript-only completion restrictions, missing APIs and idempotent content additions. Mocked provider results are never reported as real AI assessment verification.
- Desktop and 390px iframe browser checks cover the homepage, API instructions, Bengali selection, transcript fallback and responsive overflow. The temporary mobile harness is removed before publishing. The HTTP preview cannot capture a real microphone because it is not a secure origin; its recovery panel is verified instead.

## Runtime configuration

Server environment: `ADMIN_EMAIL`, `CREDENTIAL_ENCRYPTION_KEY`, `DAILY_AI_LIMIT` (default20), and optional `CONTENT_UPDATES_ALLOWED=owner_private`. Never expose the encryption key or provider keys. Do not regenerate the encryption key while saved provider credentials exist.

A user-supplied Gemini key is encrypted in the settings table. Alternatively, a deployment may supply `GEMINI_API_KEY` / `OPENAI_API_KEY`, `AI_PROVIDER`, `AI_MODEL`, and optionally `TRANSCRIPTION_MODEL` as server values. OpenAI key provisioning must follow the secure key skill.

D1 holds small account/learning records. R2 holds recordings only when explicitly requested, or legacy recordings created by the previous version. Existing files are not deleted silently. Schema migrations remain immutable after application.

## Remaining master-plan work

Human-calibrated bands, fully adaptive examiner follow-ups, full-interview delayed reporting, robust forced alignment, durable provider job queues, comprehensive multi-role administration, email delivery, separate Google OAuth, operational backups/retention policy and human editorial review of the template seeds still need further implementation or validation.

## Connection diagnostics

The owner can run “Test saved connection” to request actual structured Gemini feedback on a synthetic text sample without saving a learner attempt or changing daily progress. Provider HTTP/quota/permission errors and malformed feedback are shown as safe actionable messages; raw provider error bodies and credentials are never returned. The saved-key indicator alone does not prove generation quota is available.

Model availability is verified by a small generation request, not just the model catalogue. Retired models that still appear in Google's list are skipped when their endpoints return 404. The saved-key test can refresh a retired Gemini model once while keeping the existing encrypted key. Quota or permission errors are reported directly; the app does not rotate keys or route around those limits.

For this learning workload, connection refresh prefers a current stable Flash-Lite model to reduce cost and latency. General Flash remains an advertised-model fallback. A 503 model outage can try another advertised candidate; quota and permission failures still stop immediately.

Gemini uses JSON mode plus strict server-side validation of all substantive feedback fields. Confidence metadata may be a string, numeric or absent; non-string values are displayed as an uncalibrated AI suggestion rather than a numeric reliability claim. Provider schema options are avoided for compatibility with the active Flash-Lite endpoint.


## Automatic transcription repair — 31 October 2026

The first interim words now appear before a final browser recognition result. Browser recognition restarts after recoverable interruptions and stops retrying permission failures. A separate complete-WAV capture sends cumulative 16 kHz mono snapshots to the authenticated transcription API about every 12 seconds. A final automatic request uses the completed recording after Stop, independently of assessment. Responses from a previous question or recording are discarded; request failures preserve the audio and provide Retry automatic transcript. Auto language mode preserves Bengali script and English without translating.

The transcription endpoint validates audio, requires signed-in identity and same origin, rate-limits independently of assessments, and does not save recordings, learner attempts or learning completion. Audio-derived assessment transcripts are saved and shown in the main transcript panel. Optional manual text practice is collapsed and clearly separated. Recording consent now describes automatic audio transmission. The owner connection panel includes a real synthetic-audio transcription test.

Checks: scripts/checks/transcription.mjs covers interim words, mixed scripts, complete WAV snapshots, resampling, pause/cleanup and provider transport. API checks cover authenticated audio transcription, same-origin enforcement, malformed files, safe provider errors and unchanged learning records. Device microphone permission and speech-service support remain browser dependent.

## Content administration, English-only UI and practice scoring — 31 October 2026

The current source includes 3,852 static questions across 62 complete speaking topics, including 72 additional authored examples. The live append-only question collection can add further prompts. The homepage initially shows 24 topic cards, with a control to reveal all topics. A charcoal/copper visual system provides larger copy, adjustable body/heading typography and question size.

A validated D1-backed configuration controls identity, page copy, theme, navigation, section order/visibility, individual hidden layout elements, topic cards, question-part labels, statistic cards, feature cards, milestones, exam catalogues, lessons and custom sections. The owner editor supports draft publication with a revision conflict guard; topic/question operations publish immediately. Plain text configuration is escaped by React and cannot execute scripts. The visual editor protects the owner controls and the page shell from hiding themselves. Learner evidence is separate from editable website copy.

The server enforces owner identity, same-origin mutations, account suspension/deletion tombstones, private message isolation, owner self-protection and documented, audited test-pass overrides. The administrator can review learner progress and feedback, and optional retained audio. Account deletion removes learner records and retained audio while keeping the minimal access tombstone and administrative audit. No live learner account was banned, removed or passed as part of validation.

Feedback now uses English definitions, examples, phonetic guidance and practice drills. Transcription is English-only and marks non-English speech without fabricating a translation. Historical originals remain in account records. Audio-based criterion estimates require sufficient speech and supporting evidence; text-only answers do not receive pronunciation or a full speaking band. The server computes an equally weighted four-criterion AI practice estimate. Complete weekly/revision milestones must meet 6.5/9. Free test summaries verify all submitted, reviewed answers without advancing the mandatory learning track. These are learning estimates, not official IELTS results or calibrated score predictions. Rubric reference: https://ielts.org/cdn/ielts-guides/ielts-speaking-band-descriptors.pdf

Validation covers 3,852 distinct question IDs/texts and all three parts, complete daily rotation, final learning gates, CMS schema/escaping/conflict guards, topic CRUD, admin denial, owner protection, account suspension/restoration/deletion, private support replies, audited overrides, owned-answer test summaries, and the 6.0 fail / 6.5 pass boundary. Browser QA checks the redesigned homepage, English-only controls and expanded library. A real-device microphone remains outside this environment’s verification scope.
