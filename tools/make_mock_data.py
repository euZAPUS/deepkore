#!/usr/bin/env python3
"""Generate PLACEHOLDER (MOCK) data files for DeepKore following the data contract.

Every value produced here is invented to look plausible for a rainfed field in the
Vega de Antequera (Malaga). None of it is a measurement. Every file is tagged
"provenance": "MOCK" so the app shows the MOCK DATA strip until real files arrive.

Usage:  python3 tools/make_mock_data.py          (writes into ./data)
Delete or overwrite the outputs once the real JSON files are delivered.
"""
import json
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data"
rng = random.Random(42)  # deterministic: same mock every run
MOCK = "MOCK"


def write(name, obj):
    OUT.mkdir(exist_ok=True)
    (OUT / name).write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n")
    print("wrote", OUT / name)


def bump(week, centre, width, peak):
    """Circular gaussian bump over a 52-week year."""
    d = min(abs(week - centre), 52 - abs(week - centre))
    return peak * math.exp(-((d / width) ** 2))


# ---------------------------------------------------------------- parcel.json
parcel = {
    "name": "Vega de Antequera pilot field (rainfed)",
    "lat": 37.02,
    "lon": -4.56,
    "period": "2005-2024",
    "provenance": MOCK,
    "sources": [
        {
            "dataset": "NASA POWER (daily, Agroclimatology)",
            "url": "https://power.larc.nasa.gov/",
            "version": "TBC",
            "resolution": "0.5° x 0.625° (meteorology)",
            "license": "NASA open data, no restrictions (TBC)",
            "role": "Temperature, precipitation and ET0: climate summary, frost and heat windows",
        },
        {
            "dataset": "GPM IMERG (Final Run)",
            "url": "https://gpm.nasa.gov/data/imerg",
            "version": "TBC",
            "resolution": "0.1°, 30 min",
            "license": "NASA open data, no restrictions (TBC)",
            "role": "Heavy-rain probability per week",
        },
        {
            "dataset": "SMAP L3 soil moisture (enhanced)",
            "url": "https://smap.jpl.nasa.gov/",
            "version": "TBC",
            "resolution": "9 km",
            "license": "NASA open data, no restrictions (TBC)",
            "role": "Current surface soil moisture and anomaly",
        },
    ],
}

# --------------------------------------------------------------- climate.json
years = list(range(2005, 2025))
climate = {
    "monthly": {
        "precip_mm": [62, 55, 48, 52, 34, 12, 3, 6, 24, 58, 78, 82],
        "tmax": [14.2, 15.9, 19.0, 21.1, 25.8, 31.2, 35.0, 34.6, 29.8, 23.9, 18.0, 14.8],
        "tmin": [2.8, 3.6, 5.6, 7.8, 11.2, 15.3, 18.1, 18.2, 15.0, 10.9, 6.4, 3.7],
        "et0": [34, 46, 76, 99, 138, 172, 196, 178, 124, 76, 42, 30],
    },
    "trends": {
        "years": years,
        "frost_days": [max(5, round(28 - 0.35 * i + rng.uniform(-5, 5))) for i, _ in enumerate(years)],
        "heat_days": [max(0, round(14 + 0.55 * i + rng.uniform(-5, 5))) for i, _ in enumerate(years)],
        "annual_precip": [round(490 - 2.5 * i + rng.uniform(-140, 140)) for i, _ in enumerate(years)],
    },
    "provenance": MOCK,
}

# ---------------------------------------------------------- risk_windows.json
weeks = []
for w in range(1, 53):
    frost = bump(w, 3, 6, 0.45) + rng.uniform(-0.02, 0.02)
    heat = bump(w, 30, 4.5, 0.55) + rng.uniform(-0.02, 0.02)
    rain = bump(w, 45, 4, 0.12) + bump(w, 14, 3, 0.05) + rng.uniform(-0.01, 0.01)
    weeks.append({
        "week": w,
        "p_frost": round(min(1, max(0, frost)), 2),
        "p_heat": round(min(1, max(0, heat)), 2),
        "p_extreme_rain": round(min(1, max(0, rain)), 2),
    })

risk_windows = {
    "weeks": weeks,
    "soil_moisture_now": {
        "value": 0.17,  # m3/m3
        "anomaly_pct": -21,
        "date": "2026-11-12",
        "source": "SMAP L3 soil moisture (enhanced) - MOCK value",
    },
    "bare_months": [7, 8, 9, 10],  # month numbers (1-12) with bare soil in the current rotation
    "provenance": MOCK,
}

# ------------------------------------------------------------- rotations.json
rotations = [
    {
        "id": "current",
        "name": "Current: Durum wheat - Sunflower",
        "sequence": ["Durum wheat", "Sunflower"],
        "scores": {"water": 45, "soil": 35, "income": 72, "erosion": 30, "risk_resilience": 40},
        "confidence": "high",
        "why": "This is what the field grows today. It is the baseline the other options are compared against.",
        "evidence": [
            {"dataset": "NASA POWER", "fact": "[MOCK] Placeholder: summer maximum temperatures often above 35 °C during sunflower flowering."},
            {"dataset": "GPM IMERG", "fact": "[MOCK] Placeholder: heaviest rain weeks fall in autumn, when the soil is still bare."},
        ],
        "benefits": ["Known crops, machinery and buyers", "Good income in average years"],
        "gaps": ["No field-level yield records used", "Market prices not included"],
        "risks": ["Soil left bare from July to October", "Sunflower exposed to summer heat"],
        "pac_eligible": False,
        "provenance": MOCK,
    },
    {
        "id": "A",
        "name": "A: Durum wheat - Chickpea",
        "sequence": ["Durum wheat", "Chickpea"],
        "scores": {"water": 62, "soil": 64, "income": 60, "erosion": 50, "risk_resilience": 58},
        "confidence": "medium",
        "why": "A legume replaces sunflower: it adds nitrogen to the soil and uses less water in summer.",
        "evidence": [
            {"dataset": "NASA POWER", "fact": "[MOCK] Placeholder: spring rainfall usually covers chickpea needs in an average year."},
            {"dataset": "SMAP", "fact": "[MOCK] Placeholder: soil moisture is currently below normal for November."},
        ],
        "benefits": ["Less nitrogen fertiliser for the next wheat", "Lower summer water demand"],
        "gaps": ["Local chickpea yields not checked", "Soil type map not included"],
        "risks": ["Chickpea is sensitive to heat at flowering", "Fungal disease in wet springs"],
        "pac_eligible": True,
        "provenance": MOCK,
    },
    {
        "id": "B",
        "name": "B: Barley - Vetch - Durum wheat",
        "sequence": ["Barley", "Vetch (forage / green manure)", "Durum wheat"],
        "scores": {"water": 70, "soil": 78, "income": 45, "erosion": 72, "risk_resilience": 66},
        "confidence": "medium",
        "why": "A three-year cycle with a vetch year that covers the soil and rebuilds organic matter.",
        "evidence": [
            {"dataset": "GPM IMERG", "fact": "[MOCK] Placeholder: autumn heavy-rain weeks coincide with vetch ground cover."},
            {"dataset": "NASA POWER", "fact": "[MOCK] Placeholder: barley ripens before the hottest weeks of the year."},
        ],
        "benefits": ["Soil covered for longer", "Barley avoids the worst summer heat"],
        "gaps": ["Forage demand and price not checked", "Livestock link not modelled"],
        "risks": ["Lower income in the vetch year", "Needs a buyer or use for the forage"],
        "pac_eligible": True,
        "provenance": MOCK,
    },
    {
        "id": "C",
        "name": "C: Wheat - Sunflower - Chickpea + cover crop",
        "sequence": ["Durum wheat", "Sunflower", "Chickpea", "Winter cover crop"],
        "scores": {"water": 55, "soil": 72, "income": 58, "erosion": 82, "risk_resilience": 60},
        "confidence": "low",
        "why": "Keeps the familiar crops but adds a legume and a cover crop so the soil is never bare in autumn.",
        "evidence": [
            {"dataset": "GPM IMERG", "fact": "[MOCK] Placeholder: a cover crop would protect the soil during the autumn heavy-rain peak."},
            {"dataset": "SMAP", "fact": "[MOCK] Placeholder: dry autumn soils may delay cover crop establishment."},
        ],
        "benefits": ["Strong protection against erosion", "Familiar crops stay in the plan"],
        "gaps": ["Cover crop seed cost not included", "Few local trials in rainfed soils"],
        "risks": ["Cover crop may fail in a dry autumn", "More field operations and planning"],
        "pac_eligible": True,
        "provenance": MOCK,
    },
]

# ------------------------------------------------------------- scenarios.json
# Mock model: equal-weight total of the 4 user criteria, then a linear penalty per
# 10 % rain change and per +1 °C. Coefficients are invented for the demo only.
SENS = {  # id: (points per +10 % rain, points per +1 °C)
    "current": (1.4, -2.6),
    "A": (1.0, -2.0),
    "B": (0.5, -0.9),
    "C": (1.2, -1.6),
}
base = {
    r["id"]: sum(r["scores"][k] for k in ("water", "soil", "income", "erosion")) / 4
    for r in rotations
}
scenarios = []
for rain_pct in range(-40, 21, 10):
    for temp_delta in (0, 1, 2, 3):
        scores = {
            rid: round(base[rid] + SENS[rid][0] * rain_pct / 10 + SENS[rid][1] * temp_delta, 1)
            for rid in base
        }
        scenarios.append({
            "rain_pct": rain_pct,
            "temp_delta": temp_delta,
            "frost_days": max(0, round(24 - 3.5 * temp_delta)),
            "heat_days": round(21 + 8 * temp_delta - 0.05 * rain_pct),
            "ranking": sorted(scores, key=lambda k: -scores[k]),
            "scores": scores,
            "provenance": MOCK,
        })

write("parcel.json", parcel)
write("climate.json", climate)
write("risk_windows.json", risk_windows)
write("rotations.json", rotations)
write("scenarios.json", scenarios)
