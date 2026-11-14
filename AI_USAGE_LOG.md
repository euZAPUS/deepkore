# AI usage log

Running record of how AI tools were used to build DeepKore, kept for the final AI declaration
required by NASA Space Apps. One row per working step. Humans review every change before it is kept.

| # | Date | Tool | Who | What the AI did | Human review |
|---|---|---|---|---|---|
| 0 | 2026-11-14 | Claude Code (Anthropic) | ZAP | Proposed and created the repository structure; wrote the MOCK data generator and the 5 placeholder JSON files; wrote the data-contract validator, the weighted-score function and its tests; built the base layout (navigation, MOCK strip, disclaimer); drafted this README. | ZAP reviews and tests locally |

## Notes for the declaration

- All values in `/data` are currently **MOCK** placeholders written by AI to look plausible. They are
  not measurements and are clearly labelled in the app. They will be replaced by the real files
  produced by the team's data pipeline.
- Product definition (what the app should show) comes from the team; the AI implements it.
- AI-written texts shown to users (e.g. "why" explanations) must carry the **AI-inferred** label.
