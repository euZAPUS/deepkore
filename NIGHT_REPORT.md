# Night report: "What do you grow now?" (2026-11-15)

Autonomous work in `main`. Every priority was pushed only after `npm test` (28/28), `npm run validate`
and `node tools/check_live_core.mjs` (6 × "identical") passed.
Deployed and checked at <https://euzapus.github.io/deepkore/>: the "What do you grow now?" selector
appears in My field, and the console is clean.

| Commit | Block |
|---|---|
| `b36ea94` | Data: 6 rotations, `can_be_current`, Fallow |
| `54e63ad` / `17552b3` | Selector + comparisons against the chosen rotation (**P1 pushed**) |
| `2632c97` | Durum wheat – Lentil rotation (**P2 pushed**) |
| `3986eed` | Rotations built by the user (**P3 pushed**) |
| `c3f4e9d` | Visual and functional review (**P4 pushed**) |

## 1. Priorities

| | Status | Notes |
|---|---|---|
| P1 Selector + 6 rotations + comparisons | ✅ Done | Durum wheat – Durum wheat (D) and Durum wheat – Fallow (E) added. `can_be_current` added. Compare rotations, What-if, My field and the risk calendar all depend on the chosen rotation. Works with a field picked on the map. |
| P2 Lentil or pea | ✅ Done (lentil) | FAO-56 Table 12 has a "Lentil" row (Kc mid 1.10, end 0.30; Kc ini 0.4 from the "Legumes" group row, same convention as chickpea). ECREA has "Lentejas, garbanzos y vezas secano" 2020 = 623.2 €/ha (doc `proteaginosos_2020`, already in the file). **Pea was not added**: the ECREA value for peas was not verified against the PDF. |
| P3 Your own rotation | ✅ Done | "Build your own…" with 2-4 crops from `agro_rules.json` (Fallow included), up to 3 rotations, delete buttons of 44 px, live scores (pilot field and map field) and live What-if. |
| P4 Review | ✅ Done | See table 3. |

## 2. Best rotation with default values (pitch: 51 → 68)

- **Current rotation (Durum wheat – Sunflower): 51** ✔ (unchanged).
- **Best: F Durum wheat – Lentil = 70**, no longer 68. B Barley – Vetch – Durum wheat still scores **68**, but is now 2nd.
- ⚠️ **The pitch (`pitch/index.html`, `pitch/GUION.md`: "sube de 51 a 68") no longer matches the app**: the app shows 51 → 70 (lentil).
  Either change the pitch to "51 → 70, Durum wheat – Lentil" or decide whether rotation F should stay. I did not touch `pitch/`.
- Important background: **before tonight the app showed neither 51 nor 68**. Since the "income score" commit (fb19a91), income
  (weight 50) counted in the total, and the default came out as 42 → 65 (A). Now Durum wheat – Fallow has no verified margin
  (null), so, following the existing rule "a criterion not scored for every rotation stays out of the ranking", income
  leaves the ranking. The Income slider is replaced by a note ("Income: not in the ranking yet (verified net margins for 6 of 7
  rotations)"), and the totals are 51 / 68 / 70 again. **If you want the Income slider back**, you need a sourced net margin
  for fallow in `pipeline/income_ecrea.json` (then `npm run data`).
- While doing this I found and fixed a bug: `rankRotations` mixed income for some rotations with no income for others. It now
  uses `effectiveWeights()`, which leaves out any criterion not scored for every rotation.

The figures are checked in `tests/choice.test.mjs` (current 51, B 68, best F 70), so any change will show up there.

## 3. Visual and functional review (6 screens, 1280×800 and 375×740, light and dark)

No console errors or warnings, no failed requests (404) and no horizontal scroll on any screen at either size.

| Finding | Screen | Outcome |
|---|---|---|
| On phones, the rotation detail scrolled under the tab bar (last evidence lines could not be read) | Compare rotations (phone) | **Fixed** (bottom padding = tab bar height) |
| Buttons and controls under 44×44 px (Reset, ?, theme, segmented controls, Andalucía / My location, presets, Back) | All | **Fixed** on touch screens: invisible 44 px hit area, no visual change. Leaflet ± (30 px) and the range sliders (28 px tall) are **noted** (touching them changes the layout or a library). Sidebar links are 40 px tall on PC only (mouse). |
| What-if used equal weights and showed different numbers from Compare for the same rotation (e.g. B 75 vs 68) | What-if | **Fixed**: What-if weights the per-criterion scores of each scenario with your priorities; at 0 % / +0 °C it shows the same numbers as Compare (test). The footer no longer says "does not use your priority sliders". |
| "Net margin behind the income score" while income is not in the ranking | Compare rotations | **Fixed**: "Net margin (MAPA ECREA)". |
| "623 €/ha = 100" written by hand in JS | Compare, Data & Limits | **Fixed**: read from `pipeline/income_ecrea.json` (`score_scale`). |
| Data & Limits said that crops without a value "count as 0 €/ha" (false for Fallow) | Data & Limits | **Fixed**: explains Fallow (no value, income out of the ranking) and lentil (ECREA group). |
| "MOCK – Placeholder…" row in the label legend, a label the real data never shows | Data & Limits | **Removed** unless MOCK data is loaded (`?mock`). |
| "Compare all 4 rotations", "4 cards (Current, A, B, C)", "three options" | My field, welcome, waiting screens | **Fixed**: "Compare rotations", "the three best alternatives". |
| Names with "-" in some places and "–" in others | All | **Fixed**: `displayName` always shows "–". |
| Bare soil in the risk calendar was always that of Durum wheat – Sunflower | Risk calendar | **Fixed**: follows the chosen rotation (new `bare_months` per rotation). |
| "Team members to be added", "Data processing: *to be completed by the team*", "Draft" pills (AI declaration, Team, Limits) | About, Data & Limits | **Noted**: content only the team can write. |
| About says "AI generated MOCK placeholder data… replaced by real NASA data" | About | **Noted**: it is true (history); the team decides whether to keep it. |
| The "Water supply: Irrigated" control does not change any result (it shows a note saying so) | My field | **Noted**: it has an honest note; removing it changes the design. |
| Text under 12 px: provenance badges (11.2 px), "Best match" pill (10.6 px), month labels (11.5 px), tab bar (10.2 px), calendar labels | All | **Noted**: changing it means changing the typography (not touched). |
| Full-page screenshots showed empty panels | All | Not a bug: panels appear as you scroll (reveal). Checked by scrolling: no element left invisible. |
| External links (GitHub, NASA POWER, the 4 ECREA PDFs, OSM) | Data & Limits, About | OK (HTTP 200). naturalearthdata.com returns 406 to scripts (anti-bot filter); it opens in a browser. "?" opens the welcome sheet. There is no QR in the app (only in `pitch/`). |

## 4. New TBD values to verify

In `pipeline/agro_rules.json`, `pipeline/income_ecrea.json` and `pipeline/rotation_catalog.json`:

- **Fallow**: `bare` = bare soil for one crop year (barbecho blanco); tillage and spontaneous vegetation not modelled (TBD).
- **Fallow, net margin**: none (`null`, `use_missing_value: false`, TBD). This takes income out of the ranking (see 2).
- **Lentil**: sowing Dec-Jan, harvest Jun, sensitive Apr-May to heat, legume, Fabaceae: all TBD (general knowledge).
  Kc from FAO-56 (verified). Margin = ECREA lentils-chickpeas-vetches **group** value, 2020, one year only.
- **`can_be_current`**: `current`, A (wheat–chickpea), D (monoculture), E (año y vez) and F (wheat–lentil) = true with source
  "TBD: team knowledge". B and C = false (they are proposals: forage vetch / cover crop). Please confirm.
- Rotation texts D, E, F (why, benefits, gaps, risks): written from the model itself (calendars, legumes, missing
  data), to review.

## 5. Decisions I made because something was ambiguous

1. **`data/mock/` not touched** → the texts of the new rotations and `can_be_current` live in `pipeline/rotation_catalog.json`
   (read by the pipeline, the worker and `check_live_core`). The contract accepts files without `can_be_current` (mock),
   and then only the default rotation is offered.
2. **Fallow** = a crop year without a crop: no Kc, no hazard, no family. In the calendar it pushes the next sowing back 12 months
   (Durum wheat – Fallow = 2-year cycle). Water and risk average only the crops that are actually grown, and fallow counts in erosion (bare soil).
3. **Monoculture** = sequence `["Durum wheat", "Durum wheat"]` (2 years) as requested; soil diversity = 1 family / 2 years.
4. **Compare and What-if show 4 rotations** (current + the 3 best of the rest). The list numbers 1-4 within those 4. In What-if
   the 4 are fixed from today's climate and your priorities (so ▲▼ make sense), and they re-order within each scenario.
5. When the default rotation is not the chosen one, its tag is "Alternative" (it has no letter).
6. Rotations built by the user: generic name "Your rotation: X – Y"; extra gap "Built from the crop rules only: no texts
   reviewed by the team". The same-family warning also checks last → first (the rotation repeats). Calendar
   combinations that do not give one crop per year (e.g. Sunflower – Winter cover crop) are refused with a message.
   With `?mock` the "Build your own…" option does not appear.
7. `scenarios.json` now keeps each scenario's climate inputs (12 monthly rain/ET0 values + 52 weeks), so What-if can score
   your rotations with exactly the pipeline code. Size: 34 KB → 123 KB.
8. `LIVE_VERSION` 3 → 5: fields picked on the map and cached on the device are recomputed once.
9. No Node.js on the machine: I used a portable Node 22 and Playwright 1.48 in the job's temporary folder (nothing installed system-wide).

## 6. What I could not test, and a manual checklist

Tested automatically with Playwright (Chromium): 6 screens × 2 sizes; the full flow (switch to D, E and A → Compare,
What-if and My field change → back to the default = 51 / best as before → reload keeps the choice); priority sliders and
What-if sliders with the default rotation and with another one; a field picked on the map (live mode); create, use as current
and delete your own rotation; dark mode.

Not tested:
- [ ] **A real phone** (iOS Safari / Android Chrome): open the "What do you grow now?" `<select>` and the 4 crop
      selects in "Build your own…"; check the touch areas.
- [ ] **Live mode in a different NASA grid cell**: the point I clicked was in the same cell as the pilot field (same numbers).
      Pick a point far away (e.g. Huelva or Almería), wait for the analysis, switch the current rotation and create your own.
- [ ] Firefox / Safari desktop.
- [ ] Screen reader (labels of the selects and the delete buttons).
- [ ] **Pitch**: update 51 → 68 to 51 → 70 (Durum wheat – Lentil), or decide otherwise (see 2).
