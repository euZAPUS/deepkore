// Central configuration: sections, data files, labels.

// Set to true to hide the MOCK DATA strip even if a file is still tagged "MOCK".
// (Normally not needed: the strip disappears by itself once no file says "MOCK".)
export const HIDE_MOCK_STRIP = false;

export const DATA_FILES = ["parcel", "climate", "risk_windows", "rotations", "scenarios", "validation"];
// Optional files: if missing, nothing waits for them (the panel that uses them is simply hidden).
export const OPTIONAL_FILES = ["validation"];

const ICONS = {
  field: '<path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  risks: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2M8 17h2"/>',
  rotations: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/>',
  whatif: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  data: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
};

// One entry per screen. `files` = data files the screen reads.
export const SECTIONS = [
  {
    id: "field",
    title: "My field",
    short: "Field",
    files: ["parcel", "rotations"],
    intro: "Where your field is, what matters most to you, and your limits.",
    planned: [
      "Map of the pilot field (Vega de Antequera, Málaga)",
      "Priority sliders: Water, Soil health, Income, Erosion",
      "Limits: rainfed or irrigated",
    ],
  },
  {
    id: "risks",
    title: "Risk calendar",
    short: "Calendar",
    files: ["risk_windows", "climate"],
    intro: "When in the year frost, extreme heat and heavy rain are most likely, and how wet your soil is now.",
    planned: [
      "52-week calendar: chance of frost, extreme heat and heavy rain (NASA POWER history)",
      "\"Soil moisture now\" card with its anomaly (NASA POWER root-zone wetness)",
    ],
  },
  {
    id: "rotations",
    title: "Compare rotations",
    short: "Rotations",
    files: ["rotations"],
    intro: "Your current rotation next to the three best alternatives, ranked by your own priorities.",
    planned: [
      "Your current rotation and the 3 best alternatives, ordered by your weighted score",
      "Each card: why, evidence, benefits, gaps, risks, confidence, PAC eligible",
    ],
  },
  {
    id: "whatif",
    title: "What-if simulator",
    short: "What-if",
    files: ["scenarios", "rotations"],
    intro: "Move the rain and temperature sliders to see how the ranking could change.",
    planned: [
      "Rain slider (-40 % to +20 %) and temperature slider (0 to +3 °C)",
      "Ranking re-orders live, labelled \"Simulated scenario\"",
    ],
  },
  {
    id: "data",
    title: "Data & Limits",
    short: "Data",
    files: ["parcel"],
    intro: "Which NASA data we use, what each one does, and what it cannot tell you.",
    planned: [
      "NASA sources with link, role, resolution, licence and provenance",
      "Known limits of the data and of this tool",
    ],
  },
  {
    id: "about",
    title: "About / AI declaration",
    nav: "About / AI",
    short: "About",
    files: [],
    intro: "What DeepKore is, who made it, and how AI was used.",
    planned: ["Project summary", "AI usage declaration"],
  },
].map((s) => ({ ...s, icon: ICONS[s.id] }));

export const DEFAULT_SECTION = "field";

// The four priorities the user weighs (plus risk resilience, shown for information).
export const CRITERIA_META = [
  { key: "water", label: "Water", hint: "Use less water", color: "var(--c-water)" },
  { key: "soil", label: "Soil health", hint: "Build organic matter and nutrients", color: "var(--c-soil)" },
  { key: "income", label: "Income", hint: "Net margin per hectare (MAPA ECREA, Andalucía rainfed)", color: "var(--c-income)" },
  { key: "erosion", label: "Erosion", hint: "Keep the soil from washing away", color: "var(--c-erosion)" },
];
export const RESILIENCE_META = { key: "risk_resilience", label: "Risk resilience", color: "var(--c-resilience)" };
