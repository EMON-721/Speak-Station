# Speak Station

**Your voice. Your next chapter.**

Speak Station is a browser-based **English speaking and IELTS-style practice platform**. It combines complete speaking-test books, guided daily practice, scheduled weekly and revision exams, recorded answers, question-specific AI feedback and a personal score history in one place.

**🌐 [Open Speak Station](https://speak-station.emon721.workers.dev)**  
**📂 [GitHub Repository](https://github.com/EMON-721/Speak-Station)**

[![Verify Speak Station](https://github.com/EMON-721/Speak-Station/actions/workflows/verify-speaking.yml/badge.svg?branch=main)](https://github.com/EMON-721/Speak-Station/actions/workflows/verify-speaking.yml)

> **Assessment notice:** All speaking scores and corrections are AI-generated practice estimates. They may be inaccurate and are **not official IELTS scores**. Use an official IELTS assessment to confirm your level.

## What Speak Station offers

| Area | Experience |
| --- | --- |
| Complete speaking books | **240 IELTS-style books**, each combining all three speaking parts |
| Question collection | Thousands of speaking prompts across familiar, social and abstract topics |
| Daily speaking | Structured practice sessions and selectable learning-track lengths |
| Weekly exams | **30 sequential weekly tests** with a minimum pass band of **6.0/9** |
| Revision checkpoints | **15 revision exams**; a revision is required after every two passed weekly tests |
| Sample mock | A **preview-only** example of speaking parts and expected timings, without starting an exam |
| AI assessment | One complete assessment **per speaking part**, with question-by-question feedback |
| Personal progress | Part 1, Part 2, Part 3 and combined overall estimated band for completed sessions |
| Question cooldown | Answered **book-practice questions** rest for **15 days** before becoming available again |

## Three-part speaking format

Each complete book contains **11 questions/prompts**, organised as a single speaking experience.

| Part | Contents | Practice experience |
| --- | --- | --- |
| **Part 1 — Interview** | 4 questions | Everyday subjects, personal experiences, preferences and reasons |
| **Part 2 — Cue card** | 1 cue card | One minute to prepare, followed by an extended spoken answer |
| **Part 3 — Discussion** | 6 questions | Deeper explanations, comparisons, opinions and supporting examples |

Questions appear in order, with a clear **record → save → next question** flow. The current speaking topic is prominent. A side panel displays the questions, their pending/answered states and helpful assessment guidance.

**Important:** The application does not give a separate band score for every short answer. It evaluates the **complete set of answers in Part 1**, then the complete Part 2, then Part 3, and finally combines the three Part scores into an overall practice band.

## How a speaking session works

1. **Sign in** to access your personal speaking workspace, settings and score history.
2. **Choose a learning path:** a complete book, daily practice or an unlocked weekly/revision exam.
3. **Read or listen to the question.** Where supported, choose the available browser voice/accent playback.
4. **Record your response.** Listen to it again, review the live/automatic transcript and save the answer to continue.
5. **Complete the current Part.** Once all answers in that Part are recorded, submit them together for AI assessment.
6. **Review question-specific feedback.** Every question is paired with its own original transcript, corrected version and comments. Nothing is incorrectly merged into one long, unattributed answer.
7. **Continue through Parts 2 and 3.** Review previous Part feedback during the current session.
8. **View the final result.** The platform displays the estimated band for each Part and the combined overall band, and saves the compact score record to your profile.

## AI speaking feedback

The speaking report is designed to show **what you said, what could improve and why**. It includes, where the recorded evidence permits:

- **Original spoken answer:** a transcript associated with the correct question.
- **Corrected answer:** grammar and sentence improvements that preserve the meaning of that answer.
- **Grammar and structure:** specific corrections and explanations, grouped by question.
- **Missing ideas:** places where more explanation, detail or an example would improve the response.
- **Vocabulary:** clearer, more natural expressions and suggested alternatives.
- **Pronunciation and fluency:** cautious comments based on available audio evidence.
- **Next steps:** focused areas to practise rather than a generic score alone.
- **Listening and copying:** convenient playback of corrected answers and copy/download options during the session.

AI transcription may mishear words; an unclear recording does not justify inventing the speaker's words or pronunciation errors.

## Weekly exams and revision progression

Weekly tests follow a **locked progression** rather than a freely selectable exam list:

- **Weekly 1 → Weekly 2:** Weekly 2 unlocks only after Weekly 1 is passed.
- **Pass mark:** each weekly or revision exam requires an estimated **6.0/9 or higher**.
- **Mandatory revision:** after passing Weekly 1 and Weekly 2, **Revision 1** must be passed before Weekly 3 unlocks.
- The same pattern repeats: Weekly 3 and 4 → Revision 2 → Weekly 5, and so on.
- A result below the pass mark can be recorded for progress, but it does **not** unlock the next exam.

Weekly and revision exams include Parts 1, 2 and 3. They are distinct from the regular practice-book collection. Daily practice follows its own learning-track milestones.

## Sample mock: format preview

The **Sample Mock** section introduces the type of questions and approximate structure of a more demanding full mock:

- Part 1: personal interview, approximately **4–5 minutes**.
- Part 2: preparation and extended response, approximately **3–4 minutes**, including one-minute preparation.
- Part 3: deeper discussion, approximately **4–5 minutes**.

This is **preview-only**. It does not record audio, run assessment, award a score or count as an exam attempt.

## Profile, scores and privacy

Speak Station keeps the learner's useful long-term record small:

| Retained for progress | Temporary during practice |
| --- | --- |
| Account and profile information | Microphone recordings |
| Learning milestones and exam completion | Original answer transcripts |
| Part 1, Part 2 and Part 3 scores | Detailed corrections and AI comments |
| Combined overall estimated band and date | Working notes and in-session audio playback |
| Minimal question IDs and cooldown expiry dates | Full answer-by-answer assessment content |

**Recordings are not permanently archived as part of the current speaking flow.** Temporary browser-session recordings have a maximum 24-hour lifetime and can disappear earlier if the tab is closed, refreshed or the session ends. Older recordings from legacy versions are subject to retention cleanup; removal is not a promise of instantaneous deletion from every backup or third-party system.

Audio is processed by the configured transcription/assessment service when requested. Only essential score and progression data are retained by the app after completion. A **15-day cooldown** prevents immediate reuse of answered practice-book questions; after expiry they are available again.

Users can view previous overall and Part scores without maintaining a permanent recording library.

## Additional experience

- Responsive speaking workspace for desktop and smaller screens.
- Light and dark interface preferences.
- Speaking-topic and complete-book exploration.
- On-screen recording state and accessible question playback.
- Separate original-versus-corrected answer cards.
- Clear progress indicators, score history and helpful preparation guidance.
- Personal profile and target-band settings.
- AI-estimate disclaimer displayed alongside learning content.

## High-level system design

```text
Learner's browser
  ├─ Speaking books, practice and exam interface
  ├─ Microphone recording and temporary transcript
  └─ Session feedback display
             │
             ▼
       Secure application API
         ├─ Account sign-in and progression checks
         ├─ One AI assessment per completed Part
         └─ Short-lived proof of completed assessment
             │
             ▼
       Structured progress records
         ├─ Profile and learning milestones
         ├─ Part and overall band estimates
         └─ Question cooldown dates
```

The application is built with **React, TypeScript and Vinext**, runs on **Cloudflare Workers**, and uses **Cloudflare D1** for structured account, content and progress records. Sensitive assessment processing happens through server-side requests, rather than embedding service credentials in the public interface.

## Project links

**Website:** https://speak-station.emon721.workers.dev  
**Repository:** https://github.com/EMON-721/Speak-Station  
**Build verification:** https://github.com/EMON-721/Speak-Station/actions/workflows/verify-speaking.yml

The verification workflow checks TypeScript, speaking-book and progression tests, and the Cloudflare production build. A passing build confirms those checks, **not** that every live microphone, sign-in or external assessment interaction has been end-to-end tested.

---

© 2026 Speak Station. All rights reserved.
