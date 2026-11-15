// Builds the DeepKore decks as native PowerPoint files, with very little text per slide
// (what is said lives in the speaker notes) plus fade transitions and staggered entrance animations.
//   pitch/DeepKore_pitch_ES.pptx  – Spanish, 8 slides, ordered by speaker (Álvaro, Germán, Daniel)
//   pitch/DeepKore_demo_EN.pptx   – English, 7 slides, event's recommended order (NASA Project Demo)
// Usage: NODE_PATH=<dir with pptxgenjs, sharp, react, react-dom, react-icons, jszip> node build_pptx.cjs <repoDir> <pptxSkillDir>
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const JSZip = require("jszip");
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
const NB = " ";

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
const HEX = { ink: "14301F", green: "2E9E4F", wheat: "D9A520", sky: "3F8FD6", clay: "C8643F", mut: "56645B", grid: "DDE5DF", soft: "C9D8CE" };

// real numbers (data/ on 15 Nov 2026): cumulative rain since 1 Oct, 2022-23 vs usual (median) vs dry years (p20)
const DROUGHT = [[7,43,30],[25,128,74],[140,189,128],[157,229,151],[184,263,196],[193,308,243],[193,354,302],[245,407,319],[283,411,319],[283,411,319],[283,417,320]];

async function iconPng(Icon, color = "#FFFFFF") {
  const svg = renderToStaticMarkup(React.createElement(Icon, { size: 256, color }));
  return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="3 6 26 24" width="1040" height="960"><rect x="4" y="21" width="24" height="3.5" rx="1.75" fill="#a2845e"/><rect x="4" y="25.5" width="24" height="3.5" rx="1.75" fill="#7a6247"/><path d="M16 19.5c0-6.2 3.1-10.4 9.4-11.5-1 6.3-4.2 10.4-9.4 11.5z" fill="#34c759"/><path d="M16 19.5c0-5.2-2.6-8.4-7.9-9.4.9 5.2 3.5 8.4 7.9 9.4z" fill="#28a745"/></svg>`;
async function logoPng() {
  return "image/png;base64," + (await sharp(Buffer.from(LOGO_SVG)).png().toBuffer()).toString("base64");
}
async function qrPng(url) {
  const src = fs.readFileSync(path.join(REPO, "vendor/qrcode/qrcode.js"), "utf8");
  const qrcode = new Function(src + "\n;return qrcode;")();
  const q = qrcode(0, "M"); q.addData(url); q.make();
  const n = q.getModuleCount(), m = 2;
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" width="800" height="800" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#14301F"/></svg>`;
  return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}

/* ---------- animations: fade transition per slide + staggered fade-in of shapes whose name starts with "A·" ---------- */
function timingXml(ids) {
  let n = 3;
  const effect = (spid, delay) => {
    const a = n++, b = n++, c = n++, d = n++;
    return `<p:par><p:cTn id="${a}" fill="hold"><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst><p:childTnLst>` +
      `<p:par><p:cTn id="${b}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" nodeType="${delay === 0 ? "withEffect" : "afterEffect"}">` +
      `<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>` +
      `<p:set><p:cBhvr><p:cTn id="${c}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>` +
      `<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>` +
      `<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${d}" dur="500"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr></p:animEffect>` +
      `</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`;
  };
  // group consecutive ids into steps of [ids...] that appear together
  let body = "", delay = 0;
  ids.forEach((group) => { group.forEach((spid) => (body += effect(spid, delay))); delay += 350; });
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>` +
    `<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>` +
    `<p:par><p:cTn id="${n++}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>` +
    body +
    `</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn>` +
    `<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>` +
    `<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>` +
    `</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;
}
async function animate(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file), { createFolders: false });
  const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
  for (const f of slides) {
    let xml = await zip.file(f).async("string");
    // shapes named "A·<step>·…" fade in, grouped by step number
    const steps = new Map();
    for (const m of xml.matchAll(/<p:cNvPr id="(\d+)" name="A·(\d+)·[^"]*"/g)) {
      const k = Number(m[2]);
      if (!steps.has(k)) steps.set(k, []);
      steps.get(k).push(m[1]);
    }
    const groups = [...steps.keys()].sort((a, b) => a - b).map((k) => steps.get(k));
    const transition = `<p:transition spd="med"><p:fade/></p:transition>`;
    const timing = groups.length ? timingXml(groups) : "";
    xml = xml.replace(/<p:transition[\s\S]*?<\/p:transition>|<p:transition[^>]*\/>/g, "").replace(/<p:timing>[\s\S]*?<\/p:timing>/g, "");
    xml = xml.replace(/(<\/p:clrMapOvr>)/, `$1${transition}${timing}`);
    if (!xml.includes(transition)) xml = xml.replace(/(<\/p:cSld>)/, `$1<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${transition}${timing}`);
    zip.file(f, xml);
  }
  Object.keys(zip.files).filter((k) => zip.files[k].dir).forEach((k) => delete zip.files[k]); // no folder entries
  fs.writeFileSync(file, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
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

  const I = {
    soil: await iconPng(md.MdLandscape), storm: await iconPng(wi.WiStormShowers), heat: await iconPng(wi.WiHot),
    sat: await iconPng(md.MdSatelliteAlt), frost: await iconPng(md.MdAcUnit), water: await iconPng(md.MdWaterDrop),
    place: await iconPng(md.MdLocationOn), cal: await iconPng(md.MdCalendarMonth), compare: await iconPng(md.MdCompareArrows),
    check: await iconPng(md.MdCheckCircle), sim: await iconPng(md.MdScience), next: await iconPng(md.MdPublic),
  };
  const QR = await qrPng(APP_URL);
  const LOGO = await logoPng(); // 26:24 aspect

  const LOGO_DATA = LOGO;
  pres.defineSlideMaster({ title: "DK_DARK", background: { color: C.text1 }, objects: [] });
  pres.defineSlideMaster({
    title: "DK_CONTENT",
    background: { color: C.background2 },
    margin: [0.4, 0.5, 0.45, 0.5],
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.35, w: 9, h: 0.85, fontSize: 34, bold: true, color: C.text1, align: "left", valign: "middle" }, text: "" } },
      { image: { x: 0.5, y: 5.17, w: 0.33, h: 0.3, data: LOGO_DATA } },
      { text: { text: "DeepKore", options: { x: 0.88, y: 5.2, w: 3, h: 0.25, fontSize: 11, bold: true, color: C.text2 } } },
    ],
    slideNumber: { x: 9.1, y: 5.2, w: 0.4, h: 0.25, fontSize: 10, color: C.text2, align: "right" },
  });

  const A = (step, name) => `A·${step}·${name}`; // shapes named like this fade in, step by step
  const text = (s, value, o) => s.addText(value, { isTextBox: true, margin: 0, ...o });
  const card = (s, x, y, w, h, name, fill) =>
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.14, fill: { color: fill ?? C.background1 }, line: { color: HEX.grid, width: 0.75 },
      shadow: { type: "outer", color: "14301F", opacity: 0.12, blur: 8, offset: 2, angle: 90 }, objectName: name });
  const disc = (s, x, y, size, color, img, step, name) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: size, h: size, fill: { color }, line: { color, width: 0 }, objectName: A(step, name + " circle") });
    s.addImage({ data: img, x: x + size * 0.2, y: y + size * 0.2, w: size * 0.6, h: size * 0.6, objectName: A(step, name + " icon"), altText: "" });
  };
  const content = (sectionTitle, title) => {
    const s = pres.addSlide({ masterName: "DK_CONTENT", sectionTitle });
    s.addText(title, { placeholder: "title" });
    return s;
  };

  /* ===================== slides ===================== */
  const slideQuestion = () => {
    const s = pres.addSlide({ masterName: "DK_DARK", sectionTitle: CUR });
    text(s, [
      { text: "¿Cuánto tarda en formarse ", options: { color: C.background1 } },
      { text: `1${NB}cm`, options: { color: C.accent2 } },
      { text: " de suelo?", options: { color: C.background1 } },
    ], { x: 1, y: 1.5, w: 8, h: 2.4, fontSize: 52, bold: true, align: "center", valign: "middle", objectName: "Question" });
    s.addNotes("ÁLVARO (≈8 s). «¿Cuánto tarda en formarse un centímetro de suelo fértil?» Dos segundos de silencio.");
  };

  const slideCover = () => {
    const s = pres.addSlide({ masterName: "DK_DARK", sectionTitle: CUR });
    s.addImage({ data: LOGO, x: 0.75, y: 1.0, w: 1.3, h: 1.2, objectName: A(1, "Logo mark"), altText: "DeepKore logo" });
    text(s, [{ text: "Deep", options: { color: C.background1 } }, { text: "Kore", options: { color: C.accent1 } }],
      { x: 0.6, y: 2.3, w: 4.5, h: 1.0, fontSize: 64, bold: true, objectName: A(1, "Name") });
    text(s, "Protege tu suelo antes del riesgo", { x: 0.65, y: 3.35, w: 4.4, h: 0.5, fontSize: 22, color: HEX.soft, objectName: A(2, "Tagline") });
    s.addImage({ path: IMG("laptop-rotations.jpg"), x: 5.2, y: 1.45, w: 4.3, h: 2.69, objectName: A(2, "App screenshot"),
      altText: "DeepKore: comparar rotaciones", shadow: { type: "outer", color: "000000", opacity: 0.35, blur: 12, offset: 4, angle: 90 } });
    s.addNotes("ÁLVARO (≈15 s). «Hasta mil años. Y una tormenta puede llevárselo en una tarde. Somos DeepKore: una app gratuita que ayuda al agricultor de secano a elegir su rotación de cultivos con datos de la NASA.»");
  };

  const slideProblem = () => {
    const s = content(CUR, t(`1${NB}cm de suelo: hasta 1.000 años`, `1${NB}cm of soil: up to 1,000 years`));
    text(s, t("Una tormenta se lo lleva en una tarde", "One storm washes it away in an afternoon"),
      { x: 0.5, y: 1.2, w: 9, h: 0.45, fontSize: 20, bold: true, color: C.accent4, objectName: A(1, "Subtitle") });
    const items = [
      [I.soil, HEX.wheat, t("Suelo desnudo", "Bare soil"), t("julio – noviembre", "July – November")],
      [I.storm, HEX.sky, t("Tormentas", "Storms"), t("octubre – diciembre", "October – December")],
      [I.heat, HEX.clay, t("Sequía", "Drought"), t("primavera 2023: la peor en 25 años", "spring 2023: driest in 25 years")],
    ];
    items.forEach(([ic, col, h, p], i) => {
      const x = 0.5 + i * 3.05;
      card(s, x, 1.95, 2.8, 2.6, A(2 + i, `Card ${i + 1}`));
      disc(s, x + 1.0, 2.2, 0.8, col, ic, 2 + i, `Card ${i + 1}`);
      text(s, h, { x: x + 0.2, y: 3.15, w: 2.4, h: 0.5, fontSize: 22, bold: true, color: C.text1, align: "center", objectName: A(2 + i, `Card ${i + 1} title`) });
      text(s, p, { x: x + 0.2, y: 3.7, w: 2.4, h: 0.8, fontSize: 15, color: HEX.mut, align: "center", valign: "top", objectName: A(2 + i, `Card ${i + 1} text`) });
    });
    if (!ES) text(s, "For rainfed farmers: wheat–sunflower leaves the soil bare right when autumn storms arrive, and the climate data does not reach them in plain words.",
      { x: 0.5, y: 4.72, w: 9, h: 0.4, fontSize: 11, color: HEX.mut, objectName: "Context" });
    s.addNotes(t("ÁLVARO (≈20 s). «Aquí la rotación más habitual, trigo y girasol, deja la tierra desnuda de julio a noviembre, justo cuando llegan las tormentas de otoño. Y la primavera de 2023 fue la más seca en 25 años. Los datos para decidir mejor existen, pero no llegan al agricultor. Germán.»",
      "Problem and user: rainfed farmers. Sources: FAO (International Year of Soils 2015); NASA POWER 2001–2025 at the pilot field."));
  };

  const slideNasa = () => {
    const s = content(CUR, t("NASA POWER es el motor", "NASA POWER is the engine"));
    card(s, 0.5, 1.4, 3.6, 3.4, A(1, "Source card"), C.text1);
    s.addImage({ data: I.sat, x: 1.85, y: 1.65, w: 0.9, h: 0.9, objectName: A(1, "Satellite"), altText: "" });
    text(s, t("25 años", "25 years"), { x: 0.7, y: 2.7, w: 3.2, h: 0.8, fontSize: 44, bold: true, color: C.background1, align: "center", objectName: A(1, "Years") });
    text(s, t("de datos diarios de tu parcela", "of daily data for your field"), { x: 0.7, y: 3.5, w: 3.2, h: 0.7, fontSize: 16, color: HEX.soft, align: "center", objectName: A(1, "Years text") });
    text(s, "→", { x: 4.15, y: 2.75, w: 0.5, h: 0.6, fontSize: 30, bold: true, color: HEX.mut, align: "center", objectName: A(2, "Arrow") });
    const rows = [
      [I.frost, HEX.sky, t("Riesgo de cada semana", "Weekly risk"), t("helada · calor · tormenta", "frost · heat · storm")],
      [I.water, HEX.green, t("Agua de cada cultivo", "Water each crop needs"), t("método FAO-56", "FAO-56 method")],
      [I.storm, HEX.clay, t("Ventana de erosión", "Erosion window"), t("tormenta sobre suelo desnudo", "storm on bare soil")],
    ];
    rows.forEach(([ic, col, h, p], i) => {
      const y = 1.45 + i * 1.15;
      disc(s, 4.85, y, 0.75, col, ic, 3 + i, `Row ${i + 1}`);
      text(s, h, { x: 5.8, y: y + 0.02, w: 3.7, h: 0.42, fontSize: 20, bold: true, color: C.text1, objectName: A(3 + i, `Row ${i + 1} title`) });
      text(s, p, { x: 5.8, y: y + 0.42, w: 3.7, h: 0.35, fontSize: 15, color: HEX.mut, objectName: A(3 + i, `Row ${i + 1} text`) });
    });
    if (!ES) text(s, "NASA POWER Daily API (2001–2025): temperature, rain, radiation, wind, humidity, soil wetness. Global data. Next: SMAP, GPM IMERG, SRTM.",
      { x: 0.5, y: 4.88, w: 9, h: 0.3, fontSize: 11, color: HEX.mut, objectName: "Detail" });
    s.addNotes(t("GERMÁN (≈25 s). «El motor es NASA POWER: 25 años de datos diarios de cualquier parcela. Con ellos calculamos el riesgo de cada semana, el agua que necesita cada cultivo y cuándo cae la tormenta sobre suelo desnudo.»",
      "NASA resource and its function: NASA POWER drives every computation; without it there is no risk calendar and no ranking."));
  };

  const slideEvidence = () => {
    const s = content(CUR, t("Funciona con datos reales", "It works on real data"));
    card(s, 0.5, 1.3, 5.3, 3.75, A(1, "Drought card"));
    text(s, [{ text: "193 mm ", options: { fontSize: 32, bold: true, color: C.accent4 } }, { text: t("vs 354 normales", "vs a usual 354"), options: { fontSize: 18, bold: true, color: HEX.mut } }],
      { x: 0.7, y: 1.42, w: 5, h: 0.55, objectName: A(1, "Drought stat") });
    text(s, t("Sequía 2022–23: detectada", "2022–23 drought: detected"), { x: 0.7, y: 1.95, w: 5, h: 0.35, fontSize: 15, bold: true, color: C.text1, objectName: A(1, "Drought text") });
    const months = t(["oct", "nov", "dic", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago"], ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"]);
    s.addChart(pres.charts.LINE, [
      { name: "2022–23", labels: months, values: DROUGHT.map((r) => r[0]) },
      { name: t("Año normal", "Usual year"), labels: months, values: DROUGHT.map((r) => r[1]) },
      { name: t("Año seco", "Dry year"), labels: months, values: DROUGHT.map((r) => r[2]) },
    ], {
      x: 0.6, y: 2.35, w: 5.1, h: 2.6, objectName: A(2, "Drought chart"), altText: t("Lluvia acumulada desde octubre", "Cumulative rain since October"),
      chartColors: [HEX.clay, HEX.sky, "9AA39D"], lineSize: 3, lineDataSymbol: "none",
      showLegend: true, legendPos: "t", legendFontSize: 11, legendColor: HEX.mut, legendFontFace: "+mn-lt",
      catAxisLabelColor: HEX.mut, valAxisLabelColor: HEX.mut, catAxisLabelFontSize: 10, valAxisLabelFontSize: 10, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
      valGridLine: { color: HEX.grid, size: 0.5 }, catGridLine: { style: "none" }, catAxisLineShow: false, valAxisLineShow: false,
    });
    card(s, 6.05, 1.3, 3.45, 3.75, A(3, "Result card"));
    text(s, "42", { x: 6.2, y: 1.6, w: 1.3, h: 0.95, fontSize: 56, bold: true, color: C.accent4, align: "center", objectName: A(3, "Score today") });
    text(s, "→", { x: 7.5, y: 1.75, w: 0.5, h: 0.6, fontSize: 30, bold: true, color: HEX.mut, align: "center", objectName: A(4, "Score arrow") });
    text(s, "68", { x: 8.0, y: 1.6, w: 1.35, h: 0.95, fontSize: 56, bold: true, color: C.accent1, align: "center", objectName: A(4, "Score best") });
    text(s, t("Trigo–girasol", "Wheat–sunflower"), { x: 6.1, y: 2.6, w: 1.5, h: 0.35, fontSize: 13, color: C.text1, align: "center", objectName: A(3, "Today label") });
    text(s, t("Trigo–lenteja", "Wheat–lentil"), { x: 7.9, y: 2.6, w: 1.55, h: 0.35, fontSize: 13, bold: true, color: C.text1, align: "center", objectName: A(4, "Best label") });
    text(s, [
      { text: t("+ suelo", "+ soil"), options: { breakLine: true } },
      { text: t("– erosión", "– erosion"), options: { breakLine: true } },
      { text: t("+ margen: 46 → 361 €/ha", "+ margin: 46 → 361 €/ha") },
    ], { x: 6.3, y: 3.15, w: 3.0, h: 1.0, fontSize: 16, bold: true, color: C.accent1, align: "center", objectName: A(5, "Gains") });
    text(s, t("Puntuación 0–100 según tus prioridades", "Match score 0–100 for the farmer's priorities"),
      { x: 6.2, y: 4.35, w: 3.15, h: 0.5, fontSize: 11, color: HEX.mut, align: "center", objectName: A(5, "Score note") });
    s.addNotes(t("GERMÁN (≈25 s). «Y es fiable: detecta la sequía de 2022–23, 193 milímetros frente a 354 normales. En nuestra parcela piloto, cambiar el girasol por lenteja sube la puntuación de 42 a 68: protege el suelo y deja más margen. Daniel.»",
      "Evidence: rain Oct 2022–Apr 2023 was 193 mm vs a usual 354 mm, drier than all 21 reference years. Match score = fit to the farmer's priorities (water, soil, erosion, income). Margins: Spanish Ministry of Agriculture (ECREA), before CAP subsidies."));
  };

  const slideSolution = () => {
    const s = content(CUR, t("Tres pasos en el móvil", "Three steps, on any phone"));
    s.addImage({ path: IMG("phone-rotations.jpg"), x: 0.8, y: 1.25, w: 2.2, h: 3.75, objectName: A(1, "Phone screenshot"),
      altText: t("DeepKore en el móvil", "DeepKore on a phone"), shadow: { type: "outer", color: "000000", opacity: 0.25, blur: 10, offset: 3, angle: 90 } });
    const steps = [
      [HEX.green, I.place, t("Tu parcela", "Your field"), t("y lo que siembras", "and what you grow")],
      [HEX.sky, I.cal, t("Tus semanas de riesgo", "Your risky weeks"), t("helada · calor · tormenta", "frost · heat · storm")],
      [HEX.wheat, I.compare, t("Tu mejor rotación", "Your best rotation"), t("con el porqué", "with the reasons")],
    ];
    steps.forEach(([col, ic, h, p], i) => {
      const y = 1.35 + i * 1.2;
      disc(s, 3.6, y, 0.85, col, ic, 2 + i, `Step ${i + 1}`);
      text(s, `${i + 1}  ${h}`, { x: 4.7, y: y + 0.02, w: 4.8, h: 0.5, fontSize: 24, bold: true, color: C.text1, objectName: A(2 + i, `Step ${i + 1} title`) });
      text(s, p, { x: 4.7, y: y + 0.5, w: 4.8, h: 0.35, fontSize: 16, color: HEX.mut, objectName: A(2 + i, `Step ${i + 1} text`) });
    });
    s.addNotes(t("DANIEL (≈20 s). «Todo esto el agricultor lo tiene en el móvil en tres pasos: marca su parcela y lo que siembra, ve las semanas de riesgo de helada, calor y tormenta, y compara su rotación con las mejores alternativas, con el porqué de cada una.»",
      "Solution and main flow: pick the field and current crops, set four priorities (water, soil, erosion, income), see the risk calendar, compare rotations with why, evidence, benefits, gaps and risks. Free, no login."));
  };

  const slideStatus = () => {
    const s = content(CUR, t("Hoy Andalucía, mañana el mundo", "Today Andalucía, tomorrow the world"));
    const cols = [
      [HEX.green, I.check, t("Funciona", "Works today"), t("Cualquier parcela de Andalucía", "Any field in Andalucía")],
      [HEX.wheat, I.sim, t("Simulado", "Simulated"), t("¿Y si llueve menos o hace más calor?", "What if it rains less or gets hotter?")],
      [HEX.sky, I.next, t("Siguiente", "Next"), t("Otras regiones · cooperativas · SMAP y GPM", "Other regions · cooperatives · SMAP and GPM")],
    ];
    cols.forEach(([col, ic, h, p], i) => {
      const x = 0.5 + i * 3.05;
      card(s, x, 1.35, 2.8, 2.85, A(1 + i, `Status ${i + 1}`));
      disc(s, x + 1.0, 1.6, 0.8, col, ic, 1 + i, `Status ${i + 1}`);
      text(s, h, { x: x + 0.2, y: 2.55, w: 2.4, h: 0.5, fontSize: 22, bold: true, color: C.text1, align: "center", objectName: A(1 + i, `Status ${i + 1} title`) });
      text(s, p, { x: x + 0.2, y: 3.1, w: 2.4, h: 0.9, fontSize: 15, color: HEX.mut, align: "center", valign: "top", objectName: A(1 + i, `Status ${i + 1} text`) });
    });
    text(s, t("Apoya al agricultor. Decide el agrónomo.", "Supports the farmer. The agronomist decides."),
      { x: 0.5, y: ES ? 4.4 : 4.3, w: 9, h: 0.45, fontSize: 20, bold: true, color: C.accent1, align: "center", objectName: A(4, "Trust") });
    if (!ES) text(s, "Limits: one NASA POWER cell is tens of km wide · past ≠ future · no field yields or prices · crop calendars to confirm with agronomists. 28 automated tests.",
      { x: 0.5, y: 4.75, w: 9, h: 0.38, fontSize: 10, color: C.accent4, objectName: "Limits" });
    s.addNotes(t("DANIEL (≈15 s). «Hoy funciona en toda Andalucía, y como los datos de la NASA son globales, el siguiente paso es llevarlo a otras regiones. Siempre como apoyo: decide el agrónomo.»",
      "Built / simulated / next, with the limits."));
  };

  const slideClose = () => {
    const s = pres.addSlide({ masterName: "DK_DARK", sectionTitle: CUR });
    text(s, [
      { text: t("El suelo tarda mil años. ", "Soil takes a thousand years. "), options: { color: C.background1 } },
      { text: t("Protejámoslo a tiempo.", "Let's protect it in time."), options: { color: C.accent1 } },
    ], { x: 0.6, y: 0.7, w: 4.5, h: 1.5, fontSize: 30, bold: true, valign: "top", objectName: A(1, "Closing line") });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 2.6, w: 1.8, h: 1.8, rectRadius: 0.12, fill: { color: C.background1 }, line: { color: C.background1, width: 0 }, objectName: A(2, "QR frame") });
    s.addImage({ data: QR, x: 0.7, y: 2.7, w: 1.6, h: 1.6, objectName: A(2, "QR code"), altText: t("Código QR de la app", "QR code to the app") });
    s.addImage({ data: LOGO, x: 8.95, y: 4.65, w: 0.55, h: 0.51, objectName: "Logo", altText: "DeepKore logo" });
    text(s, t("Gracias", "Thank you"), { x: 2.65, y: 2.65, w: 2.75, h: 0.85, fontSize: ES ? 44 : 34, bold: true, color: C.background1, objectName: A(2, "Thanks") });
    text(s, "euzapus.github.io/deepkore", { x: 2.65, y: 3.6, w: 2.8, h: 0.4, fontSize: 14, bold: true, color: C.accent1, hyperlink: { url: APP_URL }, objectName: A(2, "App URL") });
    if (!ES) text(s, "NASA POWER · FAO-56 · MAPA ECREA · Natural Earth · OpenStreetMap · github.com/euZAPUS/deepkore",
      { x: 0.6, y: 4.75, w: 4.6, h: 0.45, fontSize: 10, color: "9FB5A6", objectName: "References" });
    s.addImage({ path: IMG("team.jpg"), x: 5.4, y: 1.0, w: 4.1, h: 2.276, objectName: A(3, "Team photo"),
      altText: t("El equipo DeepKore en NASA Space Apps Málaga 2026", "The DeepKore team at NASA Space Apps Málaga 2026"), shadow: { type: "outer", color: "000000", opacity: 0.35, blur: 12, offset: 4, angle: 90 } });
    text(s, "Germán Casas · Álvaro Sánchez · Daniel Arenas", { x: 5.4, y: 3.4, w: 4.1, h: 0.35, fontSize: 13, color: HEX.soft, align: "center", objectName: A(3, "Team members") });
    s.addNotes(t("DANIEL (≈12 s). «Escanead y probadla. El suelo tarda mil años en formarse: protejámoslo a tiempo. Gracias.»",
      "Close: QR to the app, team and references."));
  };

  // Spanish pitch: by speaker. English demo: event's recommended order.
  let CUR = "";
  const sec = (title) => { pres.addSection({ title }); CUR = title; };
  if (ES) {
    sec("Álvaro"); slideQuestion(); slideCover(); slideProblem();
    sec("Germán"); slideNasa(); slideEvidence();
    sec("Daniel"); slideSolution(); slideStatus(); slideClose();
  } else {
    sec("Project"); slideCover(); slideProblem();
    sec("Solution"); slideSolution(); slideNasa();
    sec("Results"); slideEvidence(); slideStatus(); slideClose();
  }

  const out = path.join(REPO, "pitch", ES ? "DeepKore_pitch_ES.pptx" : "DeepKore_demo_EN.pptx");
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  await animate(out);
  console.log("wrote", out);
}

(async () => { await build("es"); })().catch((e) => { console.error(e); process.exit(1); });
