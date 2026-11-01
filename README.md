# Speak Station

Speak Station is an English speaking practice workspace for IELTS preparation. Learners choose a question, record an answer, review feedback and practise again.

## Practice and learning

The library includes 3,852 original and template-based practice questions across 62 topics, covering personal interviews, cue cards and discussion. Education, technology, culture, environment, hometown, work, travel, family, villages and regional life are part of the collection.

Daily learning tracks bring together eight questions, weekly speaking tests and revision checkpoints. Audio-based feedback explains sentence corrections, answer gaps, contextual vocabulary, pronunciation evidence and targeted practice drills. Complete tests use a 6.5/9 practice pass threshold. AI estimates support learning and are distinct from official IELTS results.

Automatic transcription shows recognised English speech during recording and completes the transcript after recording stops. New recordings, transcripts and detailed feedback stay in the current tab only. The server retains account identity, completed learning days and passed test milestones; short-lived signed assessment proofs enforce progression without an answer archive. Users can download their own reports.

## Owner workspace

The administrator can publish branding, page copy, colours and typography; show, hide and reorder sections; manage navigation, statistic cards, feature cards, milestones, topics, questions, exams and lessons; and add custom sections. A visual layout editor can hide individual cards or subsections.

Learner management includes suspension, restoration, account removal and documented test-pass overrides. Private support messages and administrator replies stay inside the learner’s account. Administrative changes are recorded in an audit log.

## Architecture

A React interface on Vinext connects to a server API, Cloudflare D1 for structured account and content data, with short-lived signed assessment proofs. Legacy private recordings remain readable without creating new stored recordings. Sites supplies the deployment and sign-in boundary. Gemini provides transcription and audio feedback through an encrypted, owner-managed API connection. Authentication, administrative permissions, account status and learning gates are enforced on the server.

See the [administrator guide](docs/ADMIN_GUIDE.md) for the editing workflow and the [implementation notes](docs/IMPLEMENTATION.md) for validation and deployment details.

For your own account, the [Cloudflare Free hosting guide](docs/CLOUDFLARE_FREE.md) uses Workers Free and D1 with Google sign-in, without an R2 subscription or permanent audio storage.
