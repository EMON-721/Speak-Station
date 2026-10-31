# Speak Station

Speak Station is a focused IELTS speaking workspace built around a simple habit: practise, record, reflect and try again.

## The learning experience

- A growing 3,000+ prompt library spanning all three speaking parts and 50 topics.
- Daily eight-question learning sessions with 90, 120, 180 and 210-day tracks.
- Microphone recording with clear permission recovery, English/Bengali live transcription and transcript fallback.
- Thirty weekly exam sets and fifteen revision sets, brought together on one homepage.
- An owner-only Google AI Studio connection panel with encrypted credential storage.
- Storage-conscious assessment: permanent audio saving is optional.
- Detailed sentence corrections, answer-gap feedback, contextual vocabulary and improved answers.
- A personal revision centre for saved questions, corrections and expressions.
- Speaking lessons, practice interviews, an audio history and learning analytics.
- Private account-owned recordings and server-checked learning progression.

## How it fits together

The React interface runs on Vinext. A server API manages account data and learning rules in Cloudflare D1, while private audio lives in R2. Sites provides the sign-in boundary and deployment. Provider adapters support OpenAI and Google Gemini for diagnostic feedback; credentials remain server-side.

Original audio and browser transcripts stay separate from personal notes and AI-derived text. Practice indicators are kept distinct from official IELTS results.

See [implementation status](docs/IMPLEMENTATION.md) for deployment configuration, validation and the remaining production integrations.
