# DeepKore

**Choose the rotation that protects your soil, and prepare before the risk arrives.**

NASA Space Apps Challenge 2026 · Málaga · Challenge: *Field Shift: Adapting Farms with NASA Data*

> ⚠️ **Decision support only, always check with your local agronomist.**

---

## Start here (for the jury)

**What it is.** DeepKore is a web tool that helps a farmer compare crop rotations for their own field.
It combines NASA climate and soil data with what the farmer cares about most (water, soil health,
income, erosion) and shows at least three rotations next to the current one: why each is suggested,
the evidence behind it, benefits, data gaps and risks that need a local check. It supports the
farmer's decision; it does not make it.

**Pilot field.** Rainfed land in the Vega de Antequera (Málaga, Spain), approx. 37.02 N, -4.56 W.

**Live demo:** <https://euzapus.github.io/deepkore/> · Pitch deck: <https://euzapus.github.io/deepkore/pitch/> · Code: <https://github.com/euZAPUS/deepkore>

**How to use it (2 minutes).** A short welcome card explains the app on first visit (reopen it with the **?** button).
1. **My field**: see the field on the map, tell DeepKore **What do you grow now?** (your current rotation; it is remembered on this device; with **Build your own…** you can put together up to 3 rotations of your own from the crops in our rule table, scored in your browser with the same formulas), set your priorities with the sliders and choose rainfed or irrigated.
2. **Risk calendar**: check in which weeks of the year frost, extreme heat or heavy rain are most likely, and how wet the soil is now.
3. **Compare rotations**: your current rotation next to the three best alternatives for your priorities (the list re-orders as you move the sliders). Pick one to see why, the evidence, benefits, gaps, risks and how it compares with your current rotation (green / red differences).
4. **What-if simulator**: move the rain and temperature sliders and watch the ranking of the same four rotations change (simulated scenario, weighted with your priorities).
5. **Data & Limits**: every NASA dataset used, with link, resolution, licence and what it cannot tell you.
6. **About / AI declaration**: who built it and how AI was used.

**NASA data used.**

| Dataset | What it gives DeepKore |
|---|---|
| [NASA POWER](https://power.larc.nasa.gov/) | Daily temperature, rain, ET0 (FAO-56) and root-zone soil wetness, 2001-2025: climate summary, weekly frost / heat / heavy-rain chances, soil wetness now, rotation and scenario scores, dry 2022-23 check |

GPM IMERG and SMAP are not used yet.

Every number in the app carries a provenance label: **Observed**, **Derived**, **AI-inferred**,
**Simulated** or **MOCK**, plus the NASA dataset behind it.

> **Current status:** `/data` holds real files built from NASA POWER by `pipeline/` (see
> [pipeline/README.md](pipeline/README.md)). To preview the placeholder (MOCK) design instead, add `?mock`
> to the URL: <https://euzapus.github.io/deepkore/?mock>

---

## Run it locally

No build step and no dependencies. Any static file server works (the browser cannot load the JSON
files from `file://`):

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

Optional checks (Node 18+):

```bash
npm test               # weighted-score unit tests
npm run validate       # check /data/*.json against the data contract
```

## Works everywhere

Responsive from phone to desktop. Light or dark theme: follows the device at first, and the round
sun/moon button in the top bar switches it (the choice is remembered). On a phone it can be
installed like an app: *Share → Add to Home Screen* (iPhone) or *Menu → Install app* (Android).

## Deploy (GitHub Pages)

Settings → Pages → *Deploy from a branch* → `main` / `(root)`. All paths are relative and routing
uses `#/section`, so it works under `https://<user>.github.io/<repo>/` with no extra config.

## Repository structure

```
index.html            App shell: header, nav, MOCK strip, disclaimer, footer
css/styles.css        All styles (dark theme, responsive)
js/main.js            Entry point: loads data, builds navigation, hash router
js/config.js          Sections, data file list, HIDE_MOCK_STRIP switch
js/data.js            Loads /data/*.json, detects MOCK provenance
js/contract.js        Data contract checks (shared by app and tools/validate_data.mjs)
js/scoring.js         total = sum(score × weight) / sum(weights); nearest scenario
js/ui.js              Provenance badge and small helpers
js/motion.js          Reveal and re-order animations
js/store.js           User priorities and limits (remembered on the device)
js/theme.js           Light / dark switch (fires a 'deepkore:theme' event for charts and map)
js/views/             One module per screen
data/                 Real data files go here (see data/README.md)
data/mock/            Placeholder (MOCK) files, used only with ?mock in the URL
tools/                make_mock_data.py (placeholder data), validate_data.mjs
tests/                Unit tests for the scoring
vendor/               Leaflet 1.9.4, Chart.js 4.4.7, Inter font, QR generator (no CDN needed)
manifest.webmanifest  Lets phones install the app (Add to Home Screen)
AI_USAGE_LOG.md       Log of AI use, for the AI declaration
pitch/                Pitch deck (index.html, English, 7 slides) and speaker notes (GUION.md)
```

## Data contract

| File | Shape |
|---|---|
| `parcel.json` | `{name, lat, lon, period, sources:[{dataset, url, version, resolution, license, role}]}` |
| `climate.json` | `{monthly:{precip_mm[12], tmax[12], tmin[12], et0[12]}, trends:{years[], frost_days[], heat_days[], annual_precip[]}, provenance}` |
| `risk_windows.json` | `{weeks:[{week, p_frost, p_heat, p_extreme_rain}], soil_moisture_now:{value, anomaly_pct, date, source}, bare_months:[]}` |
| `rotations.json` | `[{id, name, sequence[], can_be_current, scores:{water, soil, income, erosion, risk_resilience}, confidence, why, evidence:[{dataset, fact}], benefits[], gaps[], risks[], pac_eligible, income:{eur_ha_year, by_crop:[{crop, eur_ha}], missing[]}, bare_months[], bare_months_share[12], provenance}]` |
| `scenarios.json` | `[{rain_pct, temp_delta, frost_days, heat_days, ranking[], scores:{id:total}, criteria:{id:{water, soil, income, erosion, risk_resilience}}, provenance}]`: every scenario scores **every** rotation |

**Rotations.** Seven rotations, all from rainfed Andalucía: `current` Durum wheat – Sunflower (the default current
rotation), `A` Durum wheat – Chickpea, `B` Barley – Vetch – Durum wheat, `C` Wheat – Sunflower – Chickpea + cover crop,
`D` Durum wheat – Durum wheat (monoculture), `E` Durum wheat – Fallow, `F` Durum wheat – Lentil. Texts of
`current`, A-C come from `data/mock/rotations.json`; D-F and `can_be_current` from `pipeline/rotation_catalog.json`.

- `can_be_current` (boolean): `true` = a farmer in the area can grow it today; these rotations are offered in
  "What do you grow now?". `id: "current"` must exist and be `true` (it is the default). Files without the field
  (`data/mock`) offer only `current`.
- `scores.income`, `income.eur_ha_year` and `income.by_crop[].eur_ha` may be `null`: no verified net margin
  (e.g. Fallow, see `pipeline/income_ecrea.json`). A criterion that is `null` for any rotation stays out of the
  ranking for all of them (and its slider is replaced by a note).

Real files go in `/data` (see `data/README.md`); run `npm run validate`, push, reload: each screen fills in
as soon as its files exist. Placeholder files live in `data/mock/` and are only used with `?mock` in the URL.
The MOCK pill disappears by itself once no loaded file says `MOCK`.

## Credits and licences

- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (map view styled by CARTO); satellite imagery © Esri, Maxar, Earthstar Geographics.
- [Leaflet](https://leafletjs.com/) (BSD-2-Clause), [Chart.js](https://www.chartjs.org/) (MIT); see `vendor/`.
- NASA data: see the *Data & Limits* screen for each dataset's source and licence.
- AI use: see `AI_USAGE_LOG.md` and the *About / AI declaration* screen.
