# DeepKore data pipeline

Builds the real files in `/data` from NASA POWER. No login, no dependencies: Node 18+ only.

## Regenerate

```bash
node pipeline/build_power_data.mjs     # downloads NASA POWER, writes parcel, climate, risk_windows, validation
node pipeline/build_rotations.mjs      # writes rotations, scenarios, and bare_months in risk_windows
node tools/validate_data.mjs           # checks every file against the data contract
node tools/check_live_core.mjs         # checks the browser code path gives the same files (pilot field)
```

(`npm run data` runs the first two.) `build_power_data.mjs --offline` reuses `pipeline/raw/power_daily.json`
instead of downloading again. Both scripts merge into existing files: keys written by the other script are kept.

`build_power_data.mjs` prints **check values**. On the run of 14 Nov 2026 they were: Tmax p95 35.2 °C,
wet-day p95 21.9 mm, 2023 rain 233 mm, March-May 2023 rain 61 mm (driest of 25 years). "Soil now" changes every day.

## Inputs

| File | What it is |
|---|---|
| `config.json` | Pilot field (Vega de Antequera, 37.02 N, 4.56 W), base period 2001-2025 |
| `thresholds.json` | Frost (Tmin < 0 °C), heat (Tmax ≥ 35 °C), heavy rain (≥ 20 mm/day), dry-soil alert (percentile 20, 14 days). Sources: TBD |
| `agro_rules.json` | Per crop: sowing and harvest months, sensitive phase and its hazard, legume, family, FAO-56 Kc. Each value has a `source` |
| `income_ecrea.json` | Net margin per hectare (MAPA ECREA 2.0, Andalucía rainfed), with year and document for each value |
| `raw/power_daily.json` | Raw NASA POWER daily download (kept in the repo so results can be reproduced) |
| `lib/power_core.mjs` | Pure functions: ET0 (FAO-56 Penman-Monteith), monthly climate, weekly chances, soil wetness, 2022-23 check |
| `lib/rotations_core.mjs` | Pure functions: rotation scores, income, text edits, scenarios (used by `build_rotations.mjs` and the browser) |
| `lib/power_files.mjs` | Pure functions: NASA POWER download and the parcel / climate / risk_windows / validation objects (browser copy of `build_power_data.mjs`) |
| `../data/mock/rotations.json` | Texts of the four rotations (id, name, sequence, why, benefits, gaps, risks) |

## Outputs

| File | Made by | Content | Provenance |
|---|---|---|---|
| `data/parcel.json` | build_power_data | Field, period, NASA POWER source card (provider, version, access date, variables, limits) | derived |
| `data/climate.json` | build_power_data | Monthly rain, Tmax, Tmin, ET0 (2001-2025 means); yearly frost days, heat days, rain | derived |
| `data/risk_windows.json` | both | 52 weekly chances of frost, heat, heavy rain; thresholds; soil wetness now (GWETROOT); `bare_months` of the current rotation | derived |
| `data/validation.json` | build_power_data | Dry 2022-23 season: rain since 1 October vs reference years, spring ranking, soil signal, limits | derived |
| `data/rotations.json` | build_rotations | Four rotations with scores, evidence numbers, confidence | derived |
| `data/scenarios.json` | build_rotations | 28 what-if scenarios (rain −40 % to +20 %, +0 to +3 °C) | simulated |

## Formulas

Weekly chance (`risk_windows.weeks`): share of years 2001-2025 in which at least one day of that week met the rule.

**Crop calendar.** Each crop grows from its first sowing month to its last harvest month. Crops are placed one
after another: each is sown at the first occurrence of its sowing month after the previous harvest. The cycle
must close in as many years as the sequence has crops (checked in the script). Months not covered are bare.

**Scores**, 0-100, higher is better, absolute (not normalised between rotations), mean over the crops / years
of the sequence:

- **water** = for each crop, rain of its growing months / Σ (Kc × ET0) of those months, capped at 1. Kc per month:
  growing months split into 4 equal stages (ini, development ini→mid, mid, late mid→end). Crops without a FAO-56
  Kc (vetch, cover crop) are left out of the mean and named in the evidence.
- **risk_resilience** = for each crop, 1 − mean weekly chance of its hazard (frost or heat) in the weeks of its
  sensitive months. Weeks are assigned to months as in the app's calendar.
- **erosion** = 1 − Σ (share of cycle years the month is bare × heavy-rain frequency of the month) / Σ heavy-rain
  frequency of the 12 months. Monthly frequency = mean weekly heavy-rain chance of that month.
- **soil** = mean of (years with a legume / years) and (distinct botanical families / years). Unknown legume or
  family (cover crop, species not chosen) counts as no.
- **income** = 100 × (net margin €/ha/year − 0) / (623.2 − 0), clamped to 0-100 (`income_ecrea.json` →
  `score_scale`, TBD). Net margin as below. Income does not change with climate here (no yield model), so the
  what-if ranking leaves it out.

`confidence` = "low" if any value used is TBD, else "medium"; never "high". Today every rotation is "low"
because the crop calendars are TBD. `pac_eligible` = "TBD".

**Scenarios.** On the raw daily data: rain × (1 + rain_pct/100), Tmax and Tmin + temp_delta (relative humidity
kept, so ET0 rises with temperature). ET0, monthly climate, weekly chances, mean yearly frost and heat days and all
scores are recomputed. Ranking = equal weights of water, soil, erosion, risk_resilience (income left out). The
script stops if scenario (0, 0) does not reproduce `rotations.json` exactly.

**Income.** `rotation.income.eur_ha_year` = mean over the crops of the sequence of each crop's mean ECREA net margin
(margen neto, euro/ha) for Andalucía rainfed. A crop without a verified value counts as 0 €/ha (`missing_value`,
TBD) and is listed in `missing`. Values in `income_ecrea.json`, all read as text from the ECREA PDFs:

| Crop | 2018 | 2020 | Note |
|---|---|---|---|
| Durum wheat ("Trigo duro secano") | 105.4 | 92.7 | |
| Barley ("Cebada secano") | 126.8 | 77.5 | |
| Sunflower ("Girasol secano") | – | −7.8 | 2018-2019 Andalucía tables are images |
| Chickpea | – | 623.2 | ECREA group "Lentejas, garbanzos y vezas secano" |
| Vetch (forage / green manure), winter cover crop | – | – | TBD |

Result today (€/ha/year → score): current 45.7 → 7, A 361.2 → 58, B 67.1 → 11 (vetch counted as 0), C 178.6 → 29
(cover crop counted as 0). Limits: sample farms (RECAN), 2018-2020 prices,
regional averages, decoupled payments and opportunity costs left out. Other sources looked at: REDES TECO COP
2017-2022 (figures are charts only), MAPA Anuario and price reports (not used: no per-hectare margin).

**Field chosen on the map.** The app lets the user pick any point in Andalucía (outline: Natural Earth admin-1,
public domain, `js/andalucia.js`). A Web Worker (`js/live/worker.js`) downloads NASA POWER for that point and runs
`power_files.mjs` + `rotations_core.mjs`, so every screen shows that place. Results are cached on the device.
`tools/check_live_core.mjs` checks this path reproduces `/data` exactly for the pilot field. The field size only
draws the field and turns per-hectare values into totals (1 mm on 1 ha = 10 m³); the NASA POWER cell is tens of km wide.

**bare_months** in `risk_windows.json`: months bare in at least one year of the current rotation's cycle
(`bare_months_share` gives the share of years). `bare_months_source`: crop calendar (TBD), not satellite-observed.

## Text edits

Texts come from `data/mock/rotations.json` without "[MOCK]". Evidence is rebuilt from the numbers. Mock texts the
data do not support are edited in `TEXT_EDITS` in `build_rotations.mjs`:

- current: dropped benefit "Good income in average years" (income not scored).
- B: dropped risk "Lower income in the vetch year" (income not scored).
- C: "why" no longer says "so the soil is never bare in autumn", and dropped benefit "Strong protection against
  erosion". With the cover crop after chickpea, as the sequence says, the soil is bare in autumn in some years and
  C's erosion score (57) is below the current rotation's (59).

## TBD values (to cite or confirm)

- `thresholds.json`: all four sources (frost 0 °C, heat 35 °C, heavy rain 20 mm/day, soil alert p20 / 14 days).
- `agro_rules.json`, all crops: sowing months, harvest months, sensitive phase (months and hazard), legume, family.
- `agro_rules.json`: Kc of vetch and winter cover crop (no row in FAO-56 Table 12); cover-crop legume and family
  (species not chosen); the 4-equal-stages Kc curve (FAO-56 Table 11 stage lengths not applied).
- `income_ecrea.json`: net margin of vetch as forage / green manure and of the winter cover crop (counted as 0 €/ha);
  the 0-100 scale (0 and 623.2 €/ha); chickpea uses a three-legume group value.
- Kc with a source (FAO-56 Table 12): durum wheat uses the "Winter Wheat, non-frozen soils" row (0.7 / 1.15 / 0.25);
  barley 0.3 / 1.15 / 0.25; sunflower 0.35 / 1.0 / 0.35 (mid range 1.0-1.15, rainfed lower value); chickpea
  0.4 / 1.0 / 0.35. Kc ini of single crops is the group value printed in the table.

## Limits

- One NASA POWER grid cell (about 0.5° × 0.625°) covers far more than one field; it is reanalysis, not a station.
- GWETROOT is a model wetness index (0 dry, 1 saturated), not volumetric soil moisture.
- Weekly chances describe 2001-2025; they are not statements about next season.
- Water ratios use mean monthly climate, rainfed, no soil water storage, no irrigation.
- Drought is not a crop hazard in `risk_resilience` (there is no weekly drought chance); it enters through water.
- No field yields or prices, no soil analysis or PAC rules. Net margins are regional ECREA averages, not the field's.
  Scores are for comparing rotations, not promises.
- Crop calendars are written for rainfed Andalucía, so the map only accepts points there.

**15 Nov update:** Fallow now counts as 0 €/ha (no crop sold), like the other crops without a verified net margin, so every
rotation has an income score and income is in the ranking (default: current 42 → best Durum wheat – Lentil 68).
