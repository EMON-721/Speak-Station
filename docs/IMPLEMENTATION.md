# Speak Station — current implementation

The React/Vinext workspace uses D1 for account identity, completed days, passed test milestones, administrative content and essential operational records. Native Sites hosting retains its trusted identity boundary. A separate Workers Free/D1 deployment configuration uses verified Google sign-in; see CLOUDFLARE_FREE.md. Gemini credentials remain encrypted with AES-GCM and are never returned to the browser or committed.

## Speaking and feedback

Start speaking directly requests browser microphone permission. The extra agreement modal has been removed; an inline notice explains transcription/provider processing. Browser permissions and iframe restrictions still apply. The interface and feedback are English-only.

Browser speech recognition displays interim English words where supported. A complete WAV capture sends cumulative snapshots to the authenticated transcription endpoint. Finishing a recording starts final transcription in the background; it does not disable assessment. Submitting audio cancels the browser's pending transcript request and sends audio directly for a single assessment response, which includes the transcript. An already-running provider request may still finish; provider latency remains external.

Assessment controls and a preview of all six report sections are visible before the first answer. Loading feedback shows elapsed time without inventing progress or promising an immediate provider response. Feedback is displayed before any workspace refresh. Failed assessment messages remain visible with a Retry action, instead of disappearing with a toast. Review verifies a small signed proof rather than reloading the whole workspace.

The report presents a complete original answer, one connected corrected answer, and a separately developed natural version. Grammar explanations remain in connected paragraphs. Contextual grammar patterns include a reason and full example. Named tabs expose grammar/structure, missing ideas, vocabulary, pronunciation/fluency and next steps. Audio observations need audible evidence; text-only feedback cannot receive acoustic fluency or pronunciation estimates. AI practice estimates are not official IELTS results.

All report text uses readable theme-aware surfaces, 16px body text, 20px subheadings, large labels and consistent borders. Vocabulary definitions, examples and follow-up prompts have the same clear contrast as the rest of the report.

## Progress-only learning storage

New audio, transcripts, detailed feedback, personal notes, bookmarks and revision items remain in current-tab React memory. They are not written to D1, R2, localStorage or sessionStorage. Explicit report/audio downloads remain available. Reloading discards an unfinished session. Previously saved records and recordings are not automatically removed.

Successful assessment returns a 12-hour signed receipt containing only user/question/attempt IDs, stage/day, audio/review flags, four criterion scores and expiry. No answer text or audio is included. Review returns a signed reviewed receipt. Stage completion requires owned, unexpired, distinct reviewed audio receipts for every currently assigned question; test passes also require all four estimates and a mean practice band of at least 6.5/9. Receipts are validated server-side and kept only in browser memory. A completed stage writes a day or a minimal passed-test result, without learner answer IDs or response content. Invalid, cross-account, replayed-for-another-stage, duplicated, expired, typed or unreviewed receipts cannot advance progress.

The receipt HMAC key uses PRACTICE_RECEIPT_SECRET when configured, otherwise a purpose-separated derivation of the existing CREDENTIAL_ENCRYPTION_KEY. Never rotate the credential encryption key casually: it protects the existing Gemini connection. Profiles and learning-track settings, owner CMS, access controls, rate-limit counters, administrative audit and explicitly sent support messages remain operational data, separate from temporary practice answers. Deprecated record/evaluate/save endpoints reject new persistent practice writes.

## Library and owner controls

The static collection has 3,852 practice questions across 62 topics. Owner-added and scheduled prompts extend it. The owner question manager searches the full collection before pagination and supports topic/part/status filters, page jumps, topic-context Add/Edit/Delete and restoration of archived questions. Existing exam references protect questions from unsafe removal.

The owner CMS controls branding, copy, theme, navigation, sections, cards, topics, questions, exams and lessons. Owner-only API checks, same-origin mutations, account suspension/deletion controls and audited pass overrides remain enforced. AI connection controls stay hidden from learners.

## Verification

Isolated API tests exercise the actual route handler with SQLite/object-store adapters and mocked provider transport. They verify zero new answer/audio/feedback storage, actual daily assessment/review/completion flow, signed receipt integrity and ownership, duplicates, expiry, typed/unreviewed rejection, stage replay rejection and the 6.0 fail/6.5 pass boundary. Existing checks cover encrypted credentials, quota errors, transcription, full-bank question CRUD, CMS conflicts, owner protections and private support messages. Assessment tests check provider JSON parsing, complete-answer output and text-only score restrictions. Browser QA covers the actual report, visible assessment controls and responsive layout. Real-device microphone permission and actual provider speed are separate runtime conditions.


## Complete Speaking Test Books (2026-11-01)

- New dedicated complete-book library: 240 deterministic book sets. Each is **4 Part 1 interview prompts + 1 Part 2 cue card + 6 Part 3 discussion prompts**. They are grouped by shared topic from the maintained existing bank (rather than replacing existing standalone questions or cloning sample prompts). A book contains 11 distinct question IDs, and can be used in practice or mock exam mode.
- Per-question browser question speech (UK/US/AU), recording, live transcript, Gemini AI feedback, grammar correction and comments reuse the existing validated assessment engine. A test is complete only after all 11 audio answers are assessed and reviewed.
- The existing server receipt-based overall estimate is kept (no hard-coded 5.5). Session review adds part-wise estimates using completed **audio-supported** criteria. Parts with incomplete audio or incomplete criteria show "Insufficient audio".
- Signed-out users cannot access the protected question endpoints; the new prominent AI warning says that speech recognition, comments and scores may be wrong, and are not official IELTS results.
- Template theme updated to charcoal and copper (no blue/green brand colors), with a matching warm waveform favicon. Admin-stored theme settings may still override some dynamic content; the site uses the new book UI outside CMS-managed sections.
- Existing daily lessons, weekly/revision progression, original question bank and account data remain available. Detailed audio/transcripts still follow current tab-only data retention policy. This is not a 7-day cloud recording archive.

## New real-world speaking topics

Added 20 distinct cross-part themes with 8 Part 1 prompts, 3 cue-card prompts, and 8 Part 3 discussions each (380 new prompts). Themes range from digital payments and public speaking to craft skills, consumer reviews, repair and community spaces. Together with the pre-existing library, the new pack gives the 240-book generator more varied subjects. As always, these are author-created IELTS-style prompts, not official IELTS exam questions.

- Completed book and mock-exam summaries are saved in the existing per-user `tests` D1 table after verified **reviewed audio receipts** for all questions. Only book identifier, part criterion-based band estimates, overall server-verified practice band, mode, completion date and criterion summary are persisted; not raw audio, transcript or feedback. All other data-retention rules are unchanged.

## Professional UI and existing Gemini credentials
- Primary presentation is neutral graphite + silver (no brown, navy, blue or green branding). Legacy theme values stored in D1 are migrated at read time while leaving typography settings unchanged.
- Removed the visible standalone-question catalog; all navigation now leads to complete three-part books. Original questions and existing learning state are retained. Former question links now open a matching book.
- Added a Sample Mock placeholder using Book 001 (all three parts, no invented answer or score). Awaiting owner-provided example content.
- AI configuration is one shared server-side source for Daily Practice, full books, Sample Mock, weekly and revision assessments. Stored D1 AES-GCM credentials are used when they decrypt; existing Cloudflare GEMINI_API_KEY Secrets are respected as a fallback. An older environment's key cannot be fabricated or retrieved from GitHub. Owner panel shows diagnostics and hides reconnect form when a connection already exists.

- The complete Part 1/Part 2/Part 3 question overview is now shared by daily, weekly, revision, book and mock practice. The recording studio is not shown until a full session starts. Legacy single-question deep links and saved bookmarks are redirected to a containing book.
