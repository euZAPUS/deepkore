# DeepKore · Texts for the NASA Space Apps project page

Copy each block into the matching field of the Project page. Everything here must be in **English**.
Before pasting, check the numbers against the live app (they come from `data/` on 15 Nov 2026).
Fields marked ✏️ need the team.

---

## Project name

**DeepKore**

## Summary (50–200 words) · ~175 words

DeepKore is a free web app that helps rainfed farmers in Andalucía (Spain) compare crop rotations before they decide what to sow.
The farmer picks their field on the map, tells DeepKore what they grow today and what matters most to them: water, soil health,
erosion or income. DeepKore downloads 25 years of NASA POWER daily data (2001–2025) for that point and computes, in the browser,
a week-by-week calendar of frost, extreme heat and heavy rain, how much of each crop's water need the rain covers (FAO-56),
and the weeks when heavy rain falls on bare soil. It then ranks the farmer's current rotation against the best alternatives and
explains each one: why it is suggested, the evidence, the benefits, the data gaps and the risks to check locally. Every number shows
where it comes from (derived from NASA data, or simulated), and a what-if simulator shows how the ranking changes with less rain
or more heat. We checked that the data clearly shows the 2022–23 drought at our pilot field in Antequera (Málaga).
DeepKore supports the farmer's decision; it never replaces the local agronomist.

## Project Demo (one public link)

https://euzapus.github.io/deepkore/pitch/ — 7 slides, cover included (the local pitch uses `?pitch`, which adds an opening question).

## Final Project (one public link)

https://github.com/euZAPUS/deepkore — the README starts with **"Start here"** for the jury, with the live app link:
https://euzapus.github.io/deepkore/

---

## Detailed description

### What it does
DeepKore answers the question of the "Field Shift" challenge for one concrete user: a rainfed farmer in Andalucía who wants to know
whether to keep their current crop rotation or change it. It compares at least three rotations including the current one, and for
each it shows why it is suggested, the evidence, the benefits, the gaps and the risks that need local review.

### How it works (the main flow)
1. **My field.** Pick a point in Andalucía on the map (or use the pilot field in the Vega de Antequera, Málaga), set the field size,
   choose what you grow now and move four priority sliders.
2. **Risk calendar.** 52 weeks with the chance of frost (daily minimum < 0 °C), extreme heat (maximum ≥ 35 °C) and heavy rain
   (≥ 20 mm/day), computed as the share of the 25 years in which that week had at least one such day; root-zone soil wetness now
   compared with the usual value for the time of year; and the erosion window (heavy rain while the soil is bare).
3. **Compare rotations.** Your current rotation and the three best alternatives, ranked by
   *total = Σ(score × weight) / Σ(weights)*. Each card: crop sequence, why, evidence (with the number), benefits, gaps, risks,
   confidence, net margin, and the difference with your current rotation.
4. **What-if simulator.** Rain −40 % to +20 % and temperature +0 to +3 °C re-run the same scoring and re-order the ranking
   (labelled "Simulated scenario").
5. **Data & Limits.** Every source with link, version, access date, variables, resolution, licence and limits, plus a check against
   the 2022–23 drought.

### Scores (0–100, higher is better)
- **Water:** rain in each crop's growing months ÷ crop water need (Kc × ET0, FAO-56), capped at 1.
- **Erosion:** 1 − share of the year's heavy-rain frequency that falls while the soil is bare.
- **Risk resilience:** 1 − mean weekly chance of each crop's main hazard during its sensitive weeks.
- **Soil health:** legume years and botanical diversity of the sequence.
- **Income:** net margin per hectare from the Spanish Ministry of Agriculture (MAPA ECREA 2.0, Andalucía rainfed). It is shown
  for each rotation but kept out of the ranking while one rotation (wheat–fallow) has no verified value.

### Benefits
- Turns open NASA data into plain-language answers a farmer can use on a phone, without login.
- Makes the trade-offs visible (e.g. more soil protection for less income) instead of giving a single "right" answer.
- Every number is traceable: source, method and label (Derived / Simulated).

### Tools
Static web app (HTML, CSS, JavaScript), Leaflet (maps), Chart.js (charts), Web Worker for in-browser computation, Node.js data
pipeline, GitHub Pages hosting. Code and data are in a public GitHub repository.

### Method and validation
- Weekly risk = share of years 2001–2025 with at least one day over the threshold in that week.
- Crop water need = FAO-56 Penman-Monteith ET0 × FAO-56 Table 12 Kc.
- The same code runs in the Node pipeline and in the browser; `tools/check_live_core.mjs` checks both give identical files.
- **Validation:** at the pilot field, rain from 1 October 2022 to the end of April 2023 was 193 mm against a usual 354 mm, drier than
  all 21 reference years; March–May 2023 had 61 mm, the driest of 25 years. The data shows the known 2022–23 drought clearly.
- 28 automated tests (scoring, ranking, data contract).

### Real status: BUILT · SIMULATED · NEXT
**BUILT (works today)**
- Field picked anywhere in Andalucía, data downloaded live from NASA POWER and computed in the browser.
- Risk calendar, soil wetness now, erosion window, climate charts.
- 7 rotations of rainfed Andalucía, "What do you grow now?", build-your-own rotation, ranking by the farmer's priorities.
- Net margins from MAPA ECREA; Data & Limits page; drought validation.

**SIMULATED**
- What-if scenarios: rain and temperature changes applied to the historical NASA POWER series. They show how the ranking reacts;
  they are not forecasts.

**NEXT**
- Pilot with farmers and cooperatives in Málaga; draw the real field boundary.
- Add GPM IMERG (heavy rain at 0.1°) and SMAP (soil moisture) to improve resolution; slope (NASADEM) for erosion.
- Verified crop calendars and PAC eco-scheme rules with local agronomists; irrigated fields.

### Limitations
- One NASA POWER grid cell is tens of kilometres wide: it describes the area around the field, not each part of it.
- Risk weeks come from past years; the climate is changing.
- No soil analysis, field yields or local prices; net margins are regional averages (2018–2020).
- Several crop-calendar values are general knowledge marked "TBD" in the data; rotation confidence is shown as "low".
- PAC eligibility is not assessed yet.
- Decision support only: always check with your local agronomist.

---

## NASA data (resource and its function)

| NASA resource | Link | What it does in DeepKore |
|---|---|---|
| **NASA POWER Daily API**, Agroclimatology community (API v2.10.3; inputs MERRA-2, SYN1deg) | https://power.larc.nasa.gov/ | Daily T2M_MAX, T2M_MIN, T2M, PRECTOTCORR, ALLSKY_SFC_SW_DWN, WS2M, RH2M, GWETROOT, GWETTOP for 2001–2025 at the chosen field. From them DeepKore computes the weekly frost / heat / heavy-rain chances, monthly rain and ET0, the crop water scores, the erosion window, soil wetness now, the what-if scenarios and the 2022–23 drought check. Without POWER there is no ranking. |

Acknowledgement requested by NASA POWER: "These data were obtained from the NASA Langley Research Center POWER Project funded
through the NASA Earth Science Directorate Applied Science Program."

✏️ Check that NASA POWER appears in the "Resources" of the Field Shift challenge page (needed for Global Awards).

## Other sources and references

| Source | What it supports |
|---|---|
| FAO Irrigation and Drainage Paper 56 (Allen et al., 1998), Tables 11–12 | ET0 method and crop coefficients (Kc) for the water score |
| MAPA ECREA 2.0 (Spanish Ministry of Agriculture), Andalucía rainfed, 2018 and 2020 | Net margin per hectare of each crop (income) |
| Natural Earth 1:10m Admin-1 (public domain) | Outline of Andalucía for the field picker |
| OpenStreetMap contributors (ODbL), CARTO, Esri World Imagery | Base maps |
| Leaflet (BSD-2), Chart.js (MIT), Inter font (SIL OFL 1.1), qrcode-generator (MIT) | Map, charts, typography, QR in the slides |
| FAO, International Year of Soils 2015 | "Up to 1,000 years to form 1 cm of soil" (pitch) |

## Use of AI (declaration)

- **Claude Code (Anthropic)** was used by the team to write most of the web app code (layout, screens, charts, map), the data
  pipeline code, tests, documentation and the slide deck. Every change was reviewed, run and tested by the team; the log is in
  `AI_USAGE_LOG.md`.
- While building, AI generated **placeholder (MOCK) data** to design the screens. It is kept only in `data/mock/`, is labelled MOCK
  and is never shown unless the URL has `?mock`. All data in the public app comes from NASA POWER and the sources above.
- Rotation texts (why, benefits, gaps, risks) were drafted with AI from the computed numbers and reviewed by the team.
- No AI-generated images or videos are used. Screenshots in the slides are of our own app. No NASA logos are used.

## Team ✏️

| Name | Role |
|---|---|
| ZAP (✏️ full name) | Product and web app, pitch |
| gercg-926 (✏️ full name) | Data pipeline, agronomy rules, data validation |
| ✏️ | ✏️ |

**About the team (bio) ✏️ draft:**
We are a team from Málaga who met at NASA Space Apps Málaga 2026. We combine web development, data processing and a shared interest
in the land around us: the rainfed fields of the Vega de Antequera. We built DeepKore in 48 hours to bring open NASA data to the
people who decide what to sow.

---

## Final checklist (from the event's "Checklist final de entrega")

- [ ] Project page complete and in English (blocks above).
- [ ] Project Demo: one public link, **≤ 7 slides including the cover** (or a ≤ 30 s video).
- [ ] Final Project link opens without login (test in a private window).
- [ ] Detailed description, NASA data, references and AI declaration filled in.
- [ ] Every team member registered, accepted in the Málaga event and added to the team.
- [ ] **Submit for Judging** pressed and confirmation seen (Save Progress does **not** submit). Deadline: Sunday 15 Nov, 23:59 local time.
