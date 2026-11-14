# AI usage log

Running record of how AI tools were used to build DeepKore, kept for the final AI declaration
required by NASA Space Apps. One row per working step. Humans review every change before it is kept.

| # | Date | Tool | Who | What the AI did | Human review |
|---|---|---|---|---|---|
| 0 | 2026-11-14 | Claude Code (Anthropic) | ZAP | Proposed and created the repository structure; wrote the MOCK data generator and the 5 placeholder JSON files; wrote the data-contract validator, the weighted-score function and its tests; built the base layout (navigation, MOCK strip, disclaimer); drafted this README. | ZAP reviews and tests locally |
| 1 | 2026-11-14 | Claude Code (Anthropic) | ZAP | Redesigned the UI in an Apple-inspired style (neutral light/dark palette, large type, glass navigation, reveal animations), made it installable on phones (web manifest, icons), renamed screens 2-3. | ZAP reviews on laptop and phone |
| 2 | 2026-11-14 | Claude Code (Anthropic) | ZAP | Added a light/dark theme switch (remembered per device), changed the accent to field green with a soft green/wheat glow behind headlines. | ZAP reviews on laptop and phone |
| 3 | 2026-11-14 | Claude Code (Anthropic) | ZAP | Built a full preview of the 6 screens on MOCK data (map, priority sliders, live best match, risk calendar with scrubbing, climate charts, ranked rotation cards with evidence, what-if simulator, data sources and limits, about page with draft AI declaration). Texts such as the limits list and the about page are drafts for the team to review. | ZAP reviews the look on laptop and phone |
| 4 | 2026-11-14 | Claude Code (Anthropic) | ZAP | Re-laid out the app as panels (sidebar on desktop, tab bar on phones) so each screen fits one view; rotations became list + detail with tabs and 'vs current' differences; added a first-visit welcome sheet; map gets satellite/map views with automatic fallback to OpenStreetMap. | ZAP reviews on laptop and phone |
| 5 | 2026-11-14 | Claude Code (Anthropic) | ZAP | Added a soft animated background and glass (translucent) panels; moved placeholder data to data/mock so the public app waits for the real files ('Waiting for NASA data' screens, preview with ?mock). | ZAP reviews |
| 6 | 2026-11-14 | Claude Code (Anthropic) | ZAP | Built the pitch deck (pitch/index.html), later cut to 7 slides for a 2-minute pitch: 3D soil core and satellite (three.js), animations, QR to the app, speaker notes. Inspired by the team's previous hackathon deck. Comparison numbers are MOCK until real data arrives. | ZAP reviews and rehearses |

## Notes for the declaration

- All values in `/data/mock` are **MOCK** placeholders written by AI to look plausible. They are
  not measurements and are clearly labelled in the app. They will be replaced by the real files
  produced by the team's data pipeline.
- Product definition (what the app should show) comes from the team; the AI implements it.
- AI-written texts shown to users (e.g. "why" explanations) must carry the **AI-inferred** label.
