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

**Live demo:** <https://euzapus.github.io/deepkore/> · Code: <https://github.com/euZAPUS/deepkore>

**How to use it (2 minutes).**
1. **My field**: see the field on the map, set your priorities with the sliders and choose rainfed or irrigated.
2. **Risk calendar**: check in which weeks of the year frost, extreme heat or heavy rain are most likely, and how wet the soil is now.
3. **Compare rotations**: the four rotations re-order according to your priorities. Open a card to see why, evidence, benefits, gaps and risks.
4. **What-if simulator**: move the rain and temperature sliders and watch the ranking change (simulated scenario).
5. **Data & Limits**: every NASA dataset used, with link, resolution, licence and what it cannot tell you.
6. **About / AI declaration**: who built it and how AI was used.

**NASA data used.**

| Dataset | What it gives DeepKore |
|---|---|
| [NASA POWER](https://power.larc.nasa.gov/) | Daily temperature, rain and ET0: climate summary, frost and heat windows |
| [GPM IMERG](https://gpm.nasa.gov/data/imerg) | Heavy-rain probability per week |
| [SMAP](https://smap.jpl.nasa.gov/) | Current soil moisture and its anomaly |

Every number in the app carries a provenance label: **Observed**, **Derived**, **AI-inferred**,
**Simulated** or **MOCK**, plus the NASA dataset behind it.

> 🚧 **Current status:** the app is running on **MOCK placeholder data** while the real data pipeline is
> finished. A red "MOCK DATA" strip is shown in the app for as long as any data file is tagged `MOCK`.

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
js/motion.js          Reveal animations, glass header, sliding nav indicator
js/theme.js           Light / dark switch (fires a 'deepkore:theme' event for charts and map)
js/views/             One module per screen
data/                 parcel, climate, risk_windows, rotations, scenarios (.json)
tools/                make_mock_data.py (placeholder data), validate_data.mjs
tests/                Unit tests for the scoring
vendor/               Leaflet 1.9.4, Chart.js 4.4.7, Inter font (no CDN needed)
manifest.webmanifest  Lets phones install the app (Add to Home Screen)
AI_USAGE_LOG.md       Log of AI use, for the AI declaration
```

## Data contract

| File | Shape |
|---|---|
| `parcel.json` | `{name, lat, lon, period, sources:[{dataset, url, version, resolution, license, role}]}` |
| `climate.json` | `{monthly:{precip_mm[12], tmax[12], tmin[12], et0[12]}, trends:{years[], frost_days[], heat_days[], annual_precip[]}, provenance}` |
| `risk_windows.json` | `{weeks:[{week, p_frost, p_heat, p_extreme_rain}], soil_moisture_now:{value, anomaly_pct, date, source}, bare_months:[]}` |
| `rotations.json` | `[{id, name, sequence[], scores:{water, soil, income, erosion, risk_resilience}, confidence, why, evidence:[{dataset, fact}], benefits[], gaps[], risks[], pac_eligible, provenance}]` |
| `scenarios.json` | `[{rain_pct, temp_delta, frost_days, heat_days, ranking[], scores:{id:total}, provenance:"synthetic"}]` |

To replace the mock data: drop the real files into `/data`, run `npm run validate`, reload.
The MOCK strip disappears by itself once no file says `MOCK`.

## Credits and licences

- Map tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
- [Leaflet](https://leafletjs.com/) (BSD-2-Clause), [Chart.js](https://www.chartjs.org/) (MIT); see `vendor/`.
- NASA data: see the *Data & Limits* screen for each dataset's source and licence.
- AI use: see `AI_USAGE_LOG.md` and the *About / AI declaration* screen.
