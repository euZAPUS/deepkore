# Preguntas del jurado sobre el pitch (3 minutos)

Solo sobre lo que contamos en el pitch (el jurado no ve la app). Respuestas de 1–2 frases.
**Álvaro = agricultura · Germán = datos NASA · Daniel = app y técnica.** ⭐ = las más probables.

## 🌾 Agricultura — ÁLVARO

- ⭐ **¿Por qué es tan grave perder el suelo?** Un centímetro tarda hasta mil años en formarse; si una tormenta se lo lleva, no vuelve en
  nuestra vida. No se puede fabricar, solo proteger, y por eso hay que actuar antes.
- ⭐ **¿Qué es una rotación y por qué importa?** Alternar cultivos en la misma tierra en vez de repetir el mismo. Corta plagas,
  reparte el riesgo y, si entra una leguminosa, abona el suelo de forma natural.
- ⭐ **¿Por qué la lenteja es mejor que el girasol?** Las leguminosas (lenteja, garbanzo) fijan nitrógeno del aire y el trigo
  siguiente necesita menos abono; además se cosechan antes del calor del verano. Según el Ministerio, dejan unos 361 €/ha frente a 46.
- ⭐ **¿Por qué el agricultor gana tan poco (46 €/ha)?** Es el margen neto oficial antes de las ayudas de la PAC: el secano de cereal
  apenas deja margen, y el girasol en 2020 llegó a perder dinero. Por eso elegir bien la rotación importa tanto.
- ⭐ **¿Por qué solo secano y no regadío?** En secano no hay riego que salve una sequía: la rotación es casi su única defensa. El regadío
  es el siguiente paso: ya calculamos el agua que necesita cada cultivo y solo faltan las dotaciones y costes de riego.
- **¿Qué es el suelo desnudo y por qué es un problema?** Es la tierra sin nada encima entre la cosecha y la siguiente siembra. Si cae
  una tormenta fuerte, el agua arrastra la capa fértil: eso es la erosión.
- **¿Un agricultor de verdad haría caso a esto?** No sustituye su experiencia ni al agrónomo: le da datos de su parcela para decidir
  mejor. El siguiente paso es probarlo con cooperativas de Málaga.
- **¿Por qué Andalucía?** Es donde vivimos y donde hay mucho secano de cereal. Los calendarios de cultivo son locales, y en 2 días
  solo pudimos escribir y revisar los de nuestra región.
- **¿Y la PAC (ayudas europeas)?** Hoy no la evaluamos: sus reglas cambian cada año. Es un siguiente paso, junto con agrónomos.

## 🛰️ Datos NASA — GERMÁN

- ⭐ **¿Dónde interviene exactamente la NASA?** Todo el cálculo sale de NASA POWER: 25 años de datos diarios del punto exacto de la
  parcela. De ahí salen las probabilidades de helada, calor y tormenta, el agua de cada cultivo y la erosión. Sin POWER no hay ranking.
- ⭐ **¿Por qué solo un recurso NASA?** Preferimos integrar uno a fondo que varios por encima. POWER ya incluye lluvia y humedad del
  suelo; SMAP y GPM darían más resolución y son el siguiente paso (piden cuenta de Earthdata y ficheros pesados).
- ⭐ **¿Cómo sabéis que los datos son fiables?** Comprobamos que detectan la sequía de 2022–23: 193 mm desde octubre frente a 354
  habituales, y la primavera de 2023 fue la más seca de 25 años.
- **¿Qué resolución tienen?** Una celda de NASA POWER mide decenas de kilómetros: describe el clima de la zona, no cada rincón de la parcela.
- **¿Cómo calculáis el agua que necesita un cultivo?** Con el método estándar de la FAO (FAO-56): evapotranspiración calculada con
  datos de NASA POWER por el coeficiente de cada cultivo.
- **¿Es una predicción del tiempo?** No: son probabilidades a partir de 25 años de historia. El "qué pasaría si" es una simulación,
  no un pronóstico, y así lo etiquetamos.
- **¿Funciona fuera de España?** Los datos de la NASA son globales; para otro país solo hay que añadir sus calendarios de cultivo.

## 💻 App y técnica — DANIEL

- ⭐ **¿Qué es exactamente el 42 → 68?** Una puntuación de 0 a 100 de cuánto encaja cada rotación con las prioridades del agricultor:
  combina agua, salud del suelo, erosión y dinero, con los pesos que él elige.
- ⭐ **¿Quién valida que la recomendación es buena?** Todavía nadie en campo. Por eso el siguiente paso es un piloto con cooperativas
  y agrónomos, y la app recuerda siempre que decide el agrónomo.
- ⭐ **¿Qué funciona hoy y qué falta?** Funciona: elegir cualquier parcela de Andalucía, calendario de riesgos, ranking de 7 rotaciones,
  márgenes oficiales y simulador. Falta: SMAP/GPM, datos de suelo de la parcela, regadío y reglas PAC.
- **¿Cómo lo habéis construido en 2 días?** Web estática gratuita: descarga los datos de NASA POWER y lo calcula todo en el navegador.
  Tiene 28 tests automáticos.
- **¿Habéis usado IA?** Sí, Claude Code para programar y redactar. Todo lo revisamos y probamos nosotros, y está declarado en el
  repositorio. Ningún dato lo genera la IA: vienen de la NASA y del Ministerio.
- **¿Cómo llega al agricultor?** Es gratis, en el móvil y sin registro; el canal natural son las cooperativas y oficinas agrarias.
- **¿Qué os diferencia?** El agricultor pone sus prioridades y ve el porqué de cada recomendación y de dónde sale cada número; no le
  damos una respuesta cerrada.
- **¿Cuál es la mayor limitación?** La resolución: una celda de NASA POWER mide decenas de km. Y los calendarios de cultivo están
  pendientes de revisar con agrónomos.
