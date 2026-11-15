// Builds the DeepKore pitch deck (Spanish, 8 slides with the opening question) and the
// NASA Project Demo (English, 7 slides) as native PowerPoint files.
// Usage: node build.cjs <repoDir> <skillDir>
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const md = require("react-icons/md");
const wi = require("react-icons/wi");

const REPO = process.argv[2];
const SKILL = process.argv[3];
const { applyTheme } = require(path.join(SKILL, "scripts/apply_theme.js"));
const IMG = (f) => path.join(REPO, "pitch/img", f);
const APP_URL = "https://euzapus.github.io/deepkore/";

const THEME = {
  name: "DeepKore Field",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "14301F", lt1: "FFFFFF", dk2: "1F7A3C", lt2: "F3F7F1",
    accent1: "2E9E4F", accent2: "D9A520", accent3: "3F8FD6", accent4: "C8643F", accent5: "7A5235", accent6: "6B63D6",
    hlink: "1F7A3C", folHlink: "56645B",
  },
};
const HEX = { ink: "14301F", green: "2E9E4F", greenD: "1F7A3C", wheat: "D9A520", sky: "3F8FD6", clay: "C8643F", violet: "6B63D6", mut: "56645B", grid: "DDE5DF", light: "F3F7F1" };

// real numbers (data/ on 15 Nov 2026)
const DROUGHT = [["2022-10",7,43,30],["2022-11",25,128,74],["2022-12",140,189,128],["2023-01",157,229,151],["2023-02",184,263,196],["2023-03",193,308,243],["2023-04",193,354,302],["2023-05",245,407,319],["2023-06",283,411,319],["2023-07",283,411,319],["2023-08",283,417,320]];

async function iconPng(Icon, color = "#FFFFFF") {
  const svg = renderToStaticMarkup(React.createElement(Icon, { size: 256, color }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
async function qrPng(url) {
  // the repo is "type": "module", so load the UMD file as a plain script
  const src = fs.readFileSync(path.join(REPO, "vendor/qrcode/qrcode.js"), "utf8");
  const qrcode = new Function(src + "\n;return qrcode;")();
  const q = qrcode(0, "M"); q.addData(url); q.make();
  const n = q.getModuleCount(), m = 2;
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" width="800" height="800" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#14301F"/></svg>`;
  return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}

async function build(lang) {
  const ES = lang === "es";
  const t = (es, en) => (ES ? es : en);
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  pres.title = ES ? "DeepKore · Pitch" : "DeepKore · Project Demo";
  pres.author = "DeepKore team";
  pres.company = "NASA Space Apps Challenge 2026 Malaga";
  const C = pres.SchemeColor;

  const ICONS = {
    soil: await iconPng(md.MdLandscape), storm: await iconPng(wi.WiStormShowers), heat: await iconPng(wi.WiHot),
    habit: await iconPng(md.MdHistory), sat: await iconPng(md.MdSatelliteAlt), calc: await iconPng(md.MdCalculate),
    eye: await iconPng(md.MdVisibility), check: await iconPng(md.MdCheckCircle), sim: await iconPng(md.MdScience),
    next: await iconPng(md.MdRocketLaunch), place: await iconPng(md.MdLocationOn), cal: await iconPng(md.MdCalendarMonth),
    compare: await iconPng(md.MdCompareArrows),
  };
  const QR = await qrPng(APP_URL);

  // ---------- layouts ----------
  const footer = { text: t("DeepKore · NASA Space Apps 2026 · Málaga", "DeepKore · NASA Space Apps 2026 · Málaga"), options: { x: 0.5, y: 5.2, w: 6, h: 0.25, fontSize: 10, color: C.text2 } };
  pres.defineSlideMaster({
    title: "DK_DARK",
    background: { color: C.text1 },
    objects: [],
  });
  pres.defineSlideMaster({
    title: "DK_CONTENT",
    background: { color: C.background2 },
    margin: [0.4, 0.5, 0.45, 0.5],
    objects: [
      { placeholder: { options: { name: "kicker", type: "body", x: 0.5, y: 0.28, w: 9, h: 0.3, fontSize: 11, bold: true, charSpacing: 2, color: C.accent1 }, text: "" } },
      { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.55, w: 9, h: 0.7, fontSize: 30, bold: true, color: C.text1, valign: "middle" }, text: "" } },
      { text: footer },
    ],
    slideNumber: { x: 9.1, y: 5.2, w: 0.4, h: 0.25, fontSize: 10, color: C.text2, align: "right" },
  });

  const card = (s, x, y, w, h, name) =>
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: C.background1 }, line: { color: HEX.grid, width: 0.75 },
      shadow: { type: "outer", color: "14301F", opacity: 0.12, blur: 8, offset: 2, angle: 90 }, objectName: name });
  const chip = (s, x, y, size, color, img, name) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: size, h: size, rectRadius: size * 0.22, fill: { color }, line: { color, width: 0 }, objectName: name + " bg" });
    s.addImage({ data: img, x: x + size * 0.18, y: y + size * 0.18, w: size * 0.64, h: size * 0.64, objectName: name + " icon", altText: "" });
  };
  const text = (s, value, o) => s.addText(value, { isTextBox: true, margin: 0, fontFace: undefined, ...o });
  const content = (sectionTitle, kicker, title) => {
    const s = pres.addSlide({ masterName: "DK_CONTENT", sectionTitle });
    s.addText(kicker.toUpperCase(), { placeholder: "kicker" });
    s.addText(title, { placeholder: "title" });
    return s;
  };

  // ======================= 0 · Question (pitch only) =======================
  if (ES) {
    pres.addSection({ title: "Apertura" });
    const s = pres.addSlide({ masterName: "DK_DARK", sectionTitle: "Apertura" });
    text(s, [
      { text: "¿Cuánto tarda en formarse ", options: { color: C.background1 } },
      { text: "1\u00A0cm", options: { color: C.accent2 } },
      { text: " de suelo fértil?", options: { color: C.background1 } },
    ], { x: 1, y: 1.6, w: 8, h: 2.2, fontSize: 44, bold: true, align: "center", valign: "middle", objectName: "Question" });
    s.addNotes("ÁLVARO (≈8 s). «¿Cuánto tarda en formarse un centímetro de suelo fértil?» Dos segundos de silencio.");
  }

  // ======================= 1 · Cover =======================
  pres.addSection({ title: t("Proyecto", "Project") });
  {
    const s = pres.addSlide({ masterName: "DK_DARK", sectionTitle: t("Proyecto", "Project") });
    text(s, [{ text: "Deep", options: { color: C.background1 } }, { text: "Kore", options: { color: C.accent1 } }],
      { x: 0.5, y: 0.75, w: 4.4, h: 0.9, fontSize: 54, bold: true, objectName: "Logo" });
    text(s, t("Elige la rotación que protege tu suelo y prepárate antes de que llegue el riesgo.", "Choose the rotation that protects your soil, and prepare before the risk arrives."),
      { x: 0.5, y: 1.75, w: 4.3, h: 0.95, fontSize: 18, bold: true, color: C.background1, objectName: "Tagline" });
    text(s, t("Una app gratuita que compara rotaciones de cultivo para el agricultor de secano, con 25 años de datos de la NASA y sus propias prioridades.",
        "A free web app that compares crop rotations for rainfed farmers, using 25 years of NASA data and the farmer's own priorities."),
      { x: 0.5, y: 2.8, w: 4.3, h: 0.95, fontSize: 14, color: "C9D8CE", objectName: "One-liner" });
    text(s, t("Reto: Field Shift · Adapting Farms with NASA Data\nPiloto: Andalucía (Antequera, Málaga) · NASA Space Apps 2026", "Challenge: Field Shift · Adapting Farms with NASA Data\nPilot: Andalucía (Antequera, Málaga) · NASA Space Apps 2026"),
      { x: 0.5, y: 4.15, w: 4.4, h: 0.6, fontSize: 11, color: "9FB5A6", objectName: "Event" });
    s.addImage({ path: IMG("laptop-rotations.jpg"), x: 5.1, y: 1.05, w: 4.4, h: 2.75, rounding: false, objectName: "App screenshot", altText: t("DeepKore: comparar rotaciones", "DeepKore: compare rotations"),
      shadow: { type: "outer", color: "000000", opacity: 0.35, blur: 12, offset: 4, angle: 90 } });
    text(s, t("La app funcionando con datos reales", "The app running on real data"), { x: 5.1, y: 3.9, w: 4.4, h: 0.3, fontSize: 11, color: "9FB5A6", align: "center", objectName: "Caption" });
    s.addNotes(t("ÁLVARO (≈15 s). «Hasta mil años. Y una tormenta puede llevárselo en una tarde. Somos DeepKore: una app gratuita que ayuda al agricultor de secano a elegir su rotación de cultivos con datos de la NASA.»",
      "Cover: what DeepKore is, the challenge and the pilot region."));
  }

  // ======================= 2 · Problem =======================
  {
    const s = content(t("Proyecto", "Project"), t("El problema", "The problem"), t("1\u00A0cm de suelo tarda hasta 1.000 años en formarse", "1\u00A0cm of soil takes up to 1,000 years to form"));
    text(s, t("Una tormenta sobre suelo desnudo puede llevárselo en una tarde.", "One storm on bare soil can wash it away in an afternoon."),
      { x: 0.5, y: 1.25, w: 9, h: 0.4, fontSize: 18, bold: true, color: C.accent4, objectName: "Subtitle" });
    const items = [
      [ICONS.soil, HEX.wheat, t("Suelo desnudo", "Bare soil"), t("Trigo–girasol deja la tierra sin cubrir de julio a noviembre.", "Wheat–sunflower leaves the ground bare from July to November.")],
      [ICONS.storm, HEX.sky, t("Tormentas de otoño", "Autumn storms"), t("La lluvia fuerte llega en octubre–diciembre, justo sobre ese suelo.", "Heavy rain peaks in October–December, right on that bare soil.")],
      [ICONS.heat, HEX.clay, t("Calor y sequía", "Heat and drought"), t("La primavera de 2023 fue la más seca en 25 años: 61 mm frente a 133.", "Spring 2023 was the driest in 25 years: 61 mm vs a usual 133 mm.")],
      [ICONS.habit, HEX.green, t("Se decide por costumbre", "Decided by habit"), t("Los datos existen, pero no llegan al agricultor en palabras sencillas.", "The data exists, but it does not reach the farmer in plain words.")],
    ];
    items.forEach(([ic, col, h, p], i) => {
      const x = 0.5 + i * 2.3;
      card(s, x, 1.85, 2.1, 2.85, `Card ${i + 1}`);
      chip(s, x + 0.2, 2.05, 0.55, col, ic, `Icon ${i + 1}`);
      text(s, h, { x: x + 0.2, y: 2.75, w: 1.75, h: 0.55, fontSize: 15, bold: true, color: C.text1, valign: "top", objectName: `Card title ${i + 1}` });
      text(s, p, { x: x + 0.2, y: 3.3, w: 1.75, h: 1.25, fontSize: 13, color: HEX.mut, valign: "top", objectName: `Card text ${i + 1}` });
    });
    text(s, t("Fuentes: FAO, Año Internacional de los Suelos 2015 · NASA POWER 2001–2025, parcela piloto (análisis propio).", "Sources: FAO, International Year of Soils 2015 · NASA POWER 2001–2025 at the pilot field (our analysis)."),
      { x: 0.5, y: 4.85, w: 9, h: 0.25, fontSize: 10, color: HEX.mut, objectName: "Sources" });
    s.addNotes(t("ÁLVARO (≈20 s). «Aquí la rotación más habitual, trigo y girasol, deja la tierra desnuda de julio a noviembre, justo cuando llegan las tormentas de otoño. Y la primavera de 2023 fue la más seca en 25 años. Los datos para decidir mejor existen, pero no llegan al agricultor. Germán.»",
      "Problem and who it is for: rainfed farmers; bare soil meets autumn storms."));
  }

  // ======================= 3 · Solution =======================
  const slideSolution = () => {
    const s = content(CUR, t("La solución", "The solution"), t("Tres pasos, en cualquier móvil", "Three steps, on any phone"));
    s.addImage({ path: IMG("phone-rotations.jpg"), x: 0.7, y: 1.35, w: 2.15, h: 3.66, objectName: "Phone screenshot", altText: t("DeepKore en el móvil", "DeepKore on a phone"),
      shadow: { type: "outer", color: "000000", opacity: 0.25, blur: 10, offset: 3, angle: 90 } });
    const steps = [
      [HEX.green, ICONS.place, t("Tu parcela, tus cultivos, tus prioridades", "Your field, your crops, your priorities"), t("Marcas la parcela en el mapa, eliges lo que siembras y mueves cuatro barras: agua, suelo, erosión y dinero.", "Tap your field on the map, choose what you grow and move four sliders: water, soil, erosion, income.")],
      [HEX.sky, ICONS.cal, t("Las semanas de riesgo, antes de que lleguen", "The risky weeks, before they come"), t("Helada 22 ene–4 feb · Calor 25 jun–26 ago · Tormentas 29 oct–9 dic.", "Frost Jan 22–Feb 4 · Heat Jun 25–Aug 26 · Storms Oct 29–Dec 9.")],
      [HEX.wheat, ICONS.compare, t("Compara rotaciones, con el porqué", "Compare rotations, with the reasons"), t("Tu rotación frente a las mejores: por qué, con qué datos y qué riesgos revisar.", "Your rotation against the best ones: why, which data and which risks to check.")],
    ];
    steps.forEach(([col, ic, h, p], i) => {
      const y = 1.35 + i * 1.12;
      chip(s, 3.3, y + 0.05, 0.6, col, ic, `Step icon ${i + 1}`);
      text(s, `${i + 1}. ${h}`, { x: 4.1, y, w: 5.4, h: 0.4, fontSize: 17, bold: true, color: C.text1, objectName: `Step title ${i + 1}` });
      text(s, p, { x: 4.1, y: y + 0.42, w: 5.4, h: 0.55, fontSize: 13, color: HEX.mut, valign: "top", objectName: `Step text ${i + 1}` });
    });
    text(s, t("Gratis · sin registro · en el móvil · se lee a pleno sol", "Free · no login · on any phone · readable in full sun"),
      { x: 3.3, y: 4.75, w: 6.2, h: 0.3, fontSize: 13, bold: true, color: C.accent1, objectName: "Benefits" });
    s.addNotes(t("DANIEL (≈20 s). «Todo esto el agricultor lo tiene en el móvil en tres pasos: marca su parcela y lo que siembra, ve las semanas de riesgo de helada, calor y tormenta, y compara su rotación con las mejores alternativas, con el porqué de cada una.»",
      "Solution and main flow of the app."));
  };

  // ======================= 4 · NASA =======================
  const slideNasa = () => {
    const s = content(CUR, t("El recurso NASA y su función", "NASA resource and its function"), t("NASA POWER es el motor", "NASA POWER is the engine"));
    const cols = [
      [HEX.sky, ICONS.sat, t("Entra", "In"), t("Datos diarios NASA POWER", "NASA POWER daily data"), [t("2001–2025, para el punto exacto de la parcela", "2001–2025, for the exact point of the field"), t("Temperatura, lluvia, radiación, viento, humedad del aire y del suelo", "Temperature, rain, radiation, wind, air and soil humidity")]],
      [HEX.green, ICONS.calc, t("Calculamos", "We compute"), t("Riesgos y agua", "Risks and water"), [t("Probabilidad semanal de helada, calor y lluvia fuerte", "Weekly chance of frost, heat and heavy rain"), t("Agua que necesita cada cultivo (FAO-56)", "Water each crop needs (FAO-56)"), t("Ventana de erosión: tormenta sobre suelo desnudo", "Erosion window: storm on bare soil")]],
      [HEX.wheat, ICONS.eye, t("El agricultor ve", "The farmer sees"), t("Una decisión con datos", "A decision with data"), [t("Calendario de riesgos de su parcela", "Risk calendar for their field"), t("Rotaciones ordenadas por sus prioridades", "Rotations ranked by their priorities"), t("De dónde sale cada número", "Where every number comes from")]],
    ];
    cols.forEach(([col, ic, lab, h, items], i) => {
      const x = 0.5 + i * 3.1;
      card(s, x, 1.4, 2.8, 3.1, `Column ${i + 1}`);
      chip(s, x + 0.2, 1.6, 0.5, col, ic, `Column icon ${i + 1}`);
      text(s, lab.toUpperCase(), { x: x + 0.85, y: 1.7, w: 1.8, h: 0.3, fontSize: 11, bold: true, charSpacing: 2, color: col, objectName: `Column label ${i + 1}` });
      text(s, h, { x: x + 0.2, y: 2.25, w: 2.45, h: 0.4, fontSize: 15, bold: true, color: C.text1, objectName: `Column title ${i + 1}` });
      text(s, items.map((it, k) => ({ text: it, options: { bullet: true, breakLine: k < items.length - 1 } })),
        { x: x + 0.2, y: 2.7, w: 2.45, h: 1.7, fontSize: 13, color: C.text1, paraSpaceAfter: 5, valign: "top", objectName: `Column list ${i + 1}` });
      if (i < 2) text(s, "→", { x: x + 2.8, y: 2.65, w: 0.3, h: 0.4, fontSize: 22, bold: true, color: HEX.mut, align: "center", objectName: `Arrow ${i + 1}` });
    });
    text(s, t("Los datos de la NASA son globales: el mismo cálculo sirve para cualquier parcela del mundo. Siguiente: SMAP, GPM IMERG y SRTM.",
        "NASA data is global: the same computation works for any field on Earth. Next: SMAP, GPM IMERG and SRTM."),
      { x: 0.5, y: 4.65, w: 9, h: 0.35, fontSize: 13, italic: true, color: C.text2, objectName: "Global note" });
    s.addNotes(t("GERMÁN (≈25 s). «El motor es NASA POWER: 25 años de datos diarios de cualquier parcela. Con ellos calculamos el riesgo de cada semana, el agua que necesita cada cultivo y cuándo cae la tormenta sobre suelo desnudo.»",
      "NASA POWER: what goes in, what we compute, what the farmer sees."));
  };

  // ======================= 5 · Evidence =======================
  const slideEvidence = () => {
    const s = content(CUR, t("Evidencia", "Evidence"), t("Funciona con datos reales", "It works on real data"));
    card(s, 0.5, 1.35, 5.4, 3.65, "Drought card");
    text(s, [{ text: "193 mm ", options: { fontSize: 28, bold: true, color: C.accent4 } }, { text: t("frente a 354 habituales", "vs a usual 354 mm"), options: { fontSize: 15, bold: true, color: HEX.mut } }],
      { x: 0.7, y: 1.45, w: 5, h: 0.5, objectName: "Drought stat" });
    text(s, t("Lluvia de octubre de 2022 a abril de 2023 en la parcela piloto: la más baja de 21 años de referencia.", "Rain from October 2022 to April 2023 at the pilot field: drier than all 21 reference years."),
      { x: 0.7, y: 1.95, w: 5, h: 0.45, fontSize: 12, color: C.text1, objectName: "Drought text" });
    const months = t(["oct", "nov", "dic", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago"], ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"]);
    s.addChart(pres.charts.LINE, [
      { name: "2022–23", labels: months, values: DROUGHT.map((r) => r[1]) },
      { name: t("Año normal", "Usual year"), labels: months, values: DROUGHT.map((r) => r[2]) },
      { name: t("Año seco", "Dry year"), labels: months, values: DROUGHT.map((r) => r[3]) },
    ], {
      x: 0.6, y: 2.4, w: 5.2, h: 2.55, objectName: "Drought chart", altText: t("Lluvia acumulada desde octubre", "Cumulative rain since October"),
      chartColors: [HEX.clay, HEX.sky, "9AA39D"], lineSize: 2.5, lineDataSymbol: "none",
      showLegend: true, legendPos: "t", legendFontSize: 10, legendColor: HEX.mut, legendFontFace: "+mn-lt",
      catAxisLabelColor: HEX.mut, valAxisLabelColor: HEX.mut, catAxisLabelFontSize: 10, valAxisLabelFontSize: 10, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
      valGridLine: { color: HEX.grid, size: 0.5 }, catGridLine: { style: "none" },
      showValAxisTitle: true, valAxisTitle: t("mm desde el 1 de octubre", "mm since 1 October"), valAxisTitleFontSize: 10, valAxisTitleColor: HEX.mut, valAxisTitleFontFace: "+mn-lt",
      catAxisLineShow: false, valAxisLineShow: false,
    });
    card(s, 6.1, 1.35, 3.4, 3.65, "Result card");
    text(s, t("RESULTADO EN LA PARCELA PILOTO", "RESULT AT THE PILOT FIELD"), { x: 6.3, y: 1.5, w: 3.1, h: 0.3, fontSize: 11, bold: true, charSpacing: 2, color: C.accent1, objectName: "Result label" });
    text(s, "42", { x: 6.3, y: 1.85, w: 1.2, h: 0.8, fontSize: 48, bold: true, color: C.accent4, align: "center", objectName: "Score today" });
    text(s, "→", { x: 7.45, y: 1.95, w: 0.5, h: 0.6, fontSize: 28, bold: true, color: HEX.mut, align: "center", objectName: "Score arrow" });
    text(s, "68", { x: 7.95, y: 1.85, w: 1.3, h: 0.8, fontSize: 48, bold: true, color: C.accent1, align: "center", objectName: "Score best" });
    text(s, t("Hoy\nTrigo – girasol", "Today\nWheat – sunflower"), { x: 6.2, y: 2.65, w: 1.4, h: 0.5, fontSize: 11, color: C.text1, align: "center", objectName: "Today label" });
    text(s, t("Mejor para ti\nTrigo – lenteja", "Best for you\nWheat – lentil"), { x: 7.85, y: 2.65, w: 1.5, h: 0.5, fontSize: 11, bold: true, color: C.text1, align: "center", objectName: "Best label" });
    text(s, t("Suelo +25 · Erosión +13 · Agua +19 · Margen 46 → 361 €/ha", "Soil +25 · Erosion +13 · Water +19 · Margin 46 → 361 €/ha"),
      { x: 6.3, y: 3.3, w: 3.0, h: 0.55, fontSize: 12, bold: true, color: C.accent1, objectName: "Deltas" });
    text(s, t("Puntuación (0–100): cuánto encaja la rotación con las prioridades del agricultor (agua, suelo, erosión, dinero). Márgenes: Ministerio de Agricultura (ECREA), antes de ayudas PAC.",
        "Match score (0–100): how well a rotation fits the farmer's priorities (water, soil, erosion, income). Margins: Spanish Ministry of Agriculture (ECREA), before CAP subsidies."),
      { x: 6.3, y: 3.9, w: 3.0, h: 1.0, fontSize: 10, color: HEX.mut, valign: "top", objectName: "Score note" });
    s.addNotes(t("GERMÁN (≈25 s). «Y es fiable: detecta la sequía de 2022–23, 193 milímetros frente a 354 normales. En nuestra parcela piloto, cambiar el girasol por lenteja sube la puntuación de 42 a 68: protege el suelo y deja más margen. Daniel.»",
      "Evidence: drought check and the result at the pilot field."));
  };

  // ======================= 6 · Status =======================
  const slideStatus = () => {
    const s = content(CUR, t("Qué funciona hoy y sus límites", "What works today, and its limits"), t("Hecho en 2 días, honesto con el resto", "Built in 2 days, honest about the rest"));
    const cols = [
      [HEX.green, ICONS.check, t("Hecho", "Built"), [t("Cualquier parcela de Andalucía", "Any field in Andalucía"), t("Calendario de riesgos y erosión", "Risk calendar and erosion window"), t("7 rotaciones + crea la tuya", "7 rotations + build your own"), t("Márgenes oficiales (ECREA)", "Official margins (ECREA)"), t("28 tests automáticos", "28 automated tests")]],
      [HEX.wheat, ICONS.sim, t("Simulado", "Simulated"), [t("¿Y si llueve un 40 % menos o hace 3 °C más?", "What if: −40 % rain or +3 °C"), t("Sobre los 25 años reales", "Applied to the real 25 years"), t("Muestra cómo cambia el ranking: no es una predicción", "Shows how the ranking reacts: not a forecast")]],
      [HEX.sky, ICONS.next, t("Siguiente", "Next"), [t("Cualquier región del mundo", "Any region in the world"), t("Piloto con cooperativas de Málaga", "Pilot with Málaga cooperatives"), t("SMAP, GPM y SRTM", "SMAP, GPM and SRTM"), t("Regadío y reglas PAC", "Irrigation and CAP rules")]],
    ];
    cols.forEach(([col, ic, h, items], i) => {
      const x = 0.5 + i * 3.07;
      card(s, x, 1.35, 2.86, 2.95, `Status ${i + 1}`);
      chip(s, x + 0.2, 1.55, 0.5, col, ic, `Status icon ${i + 1}`);
      text(s, h, { x: x + 0.85, y: 1.6, w: 1.9, h: 0.4, fontSize: 18, bold: true, color: C.text1, objectName: `Status title ${i + 1}` });
      text(s, items.map((it, k) => ({ text: it, options: { bullet: true, breakLine: k < items.length - 1 } })),
        { x: x + 0.2, y: 2.2, w: 2.5, h: 2.0, fontSize: 13, color: C.text1, paraSpaceAfter: 4, valign: "top", objectName: `Status list ${i + 1}` });
    });
    text(s, t("Límites: una celda de NASA POWER mide decenas de km · el pasado no garantiza el futuro · sin cosechas ni precios de la finca · calendarios por confirmar con agrónomos.",
        "Limits: one NASA POWER cell is tens of km wide · past years are not the future · no field yields or prices · crop calendars to be confirmed by agronomists."),
      { x: 0.5, y: 4.45, w: 9, h: 0.4, fontSize: 12, color: C.accent4, objectName: "Limits" });
    text(s, t("Apoya al agricultor; decide su agrónomo.", "Decision support only: the local agronomist decides."),
      { x: 0.5, y: 4.85, w: 9, h: 0.3, fontSize: 13, bold: true, color: C.accent1, objectName: "Trust" });
    s.addNotes(t("DANIEL (≈15 s). «Hoy funciona en toda Andalucía, y como los datos de la NASA son globales, el siguiente paso es llevarlo a otras regiones. Siempre como apoyo: decide el agrónomo.»",
      "Status: built, simulated and next, with the limits."));
  };

  // ======================= 7 · Close =======================
  const slideClose = () => {
    const s = pres.addSlide({ masterName: "DK_DARK", sectionTitle: CUR });
    text(s, [
      { text: t("El suelo tarda mil años en formarse. ", "Soil takes a thousand years to form. "), options: { color: C.background1 } },
      { text: t("Protejámoslo a tiempo.", "Let's protect it in time."), options: { color: C.accent1 } },
    ], { x: 0.5, y: 0.6, w: 4.6, h: 1.6, fontSize: 28, bold: true, valign: "top", objectName: "Closing line" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 2.55, w: 1.75, h: 1.75, rectRadius: 0.12, fill: { color: C.background1 }, line: { color: C.background1, width: 0 }, objectName: "QR frame" });
    s.addImage({ data: QR, x: 0.6, y: 2.65, w: 1.55, h: 1.55, objectName: "QR code", altText: t("Código QR de la app", "QR code to the app") });
    text(s, t("Gracias", "Thank you"), { x: 2.5, y: 2.55, w: 2.6, h: 0.8, fontSize: 40, bold: true, color: C.background1, objectName: "Thanks" });
    text(s, t("PRUÉBALA AHORA", "TRY IT NOW"), { x: 2.5, y: 3.4, w: 2.6, h: 0.3, fontSize: 11, bold: true, charSpacing: 2, color: C.accent1, objectName: "Try label" });
    text(s, "euzapus.github.io/deepkore", { x: 2.5, y: 3.7, w: 2.7, h: 0.35, fontSize: 13, bold: true, color: C.background1, hyperlink: { url: APP_URL }, objectName: "App URL" });
    text(s, t("NASA POWER · FAO-56 · MAPA ECREA · Natural Earth · OpenStreetMap · github.com/euZAPUS/deepkore", "NASA POWER · FAO-56 · MAPA ECREA · Natural Earth · OpenStreetMap · github.com/euZAPUS/deepkore"),
      { x: 0.5, y: 4.65, w: 4.7, h: 0.5, fontSize: 10, color: "9FB5A6", objectName: "References" });
    s.addImage({ path: IMG("team.jpg"), x: 5.4, y: 0.9, w: 4.1, h: 2.276, objectName: "Team photo", altText: t("El equipo DeepKore en NASA Space Apps Málaga 2026", "The DeepKore team at NASA Space Apps Málaga 2026"),
      shadow: { type: "outer", color: "000000", opacity: 0.35, blur: 12, offset: 4, angle: 90 } });
    text(s, t("Equipo DeepKore", "Team DeepKore"), { x: 5.4, y: 3.25, w: 4.1, h: 0.35, fontSize: 15, bold: true, color: C.background1, objectName: "Team name" });
    text(s, "Germán Casas · Álvaro Sánchez · Daniel Arenas", { x: 5.4, y: 3.6, w: 4.1, h: 0.3, fontSize: 12, color: "C9D8CE", objectName: "Team members" });
    s.addNotes(t("DANIEL (≈12 s). «Escanead y probadla. El suelo tarda mil años en formarse: protejámoslo a tiempo. Gracias.»",
      "Close: QR to the app, team and references."));
  };

  // Order: the Spanish pitch goes person by person (Álvaro: problem · Germán: NASA + evidence · Daniel: app + close);
  // the English demo follows the event's recommended order.
  let CUR = "";
  const sec = (title) => { pres.addSection({ title }); CUR = title; };
  if (ES) {
    sec("Datos NASA"); slideNasa(); slideEvidence();
    sec("La app"); slideSolution(); slideStatus(); slideClose();
  } else {
    sec("Solution"); slideSolution(); slideNasa();
    sec("Results"); slideEvidence(); slideStatus(); slideClose();
  }

  const out = path.join(REPO, "pitch", ES ? "DeepKore_pitch_ES.pptx" : "DeepKore_demo_EN.pptx");
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log("wrote", out);
}

(async () => { await build("es"); await build("en"); })().catch((e) => { console.error(e); process.exit(1); });
