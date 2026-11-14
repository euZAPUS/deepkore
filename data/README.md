# Data files

Drop the **real** data files here, with exactly these names:

- `parcel.json`
- `climate.json`
- `risk_windows.json`
- `rotations.json`
- `scenarios.json`

Each screen fills in automatically as soon as its files are present. Until then it shows
"Waiting for NASA data". The shapes are described in the main README (Data contract).

Check them before pushing:

```bash
npm run validate
```

`data/mock/` holds the placeholder (MOCK) files used to preview the design.
Open the app with `?mock` to use them, e.g. `http://localhost:8000/?mock#/field`.
