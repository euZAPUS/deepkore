# DeepKore · Respuestas a las preguntas del evento

Preguntas de la guía oficial de NASA Space Apps Málaga 2026 (Day 2: diapositivas 8, 9, 10, 28 y 29). Respuestas cortas para el
pitch y las preguntas del jurado. Números de `data/` a 15 nov 2026.

---

## Antes de construir: "las seis preguntas"

**1. ¿Qué problema concreto abordamos?**
El agricultor de secano elige su rotación de cultivos por costumbre, sin saber qué riesgos climáticos tiene su parcela. La más
habitual (trigo–girasol) deja el suelo desnudo de julio a noviembre, justo cuando llegan las tormentas de otoño: el suelo se erosiona,
el girasol sufre el calor y el margen es muy bajo (≈46 €/ha antes de ayudas PAC).

**2. ¿A quién afecta?**
Al agricultor de secano (y a su cooperativa o técnico). Lo piloteamos en Andalucía, en la Vega de Antequera (Málaga), pero el
problema existe en todo el secano del mundo.

**3. ¿Qué pide el reto?**
"Field Shift": una herramienta que use datos de la NASA y las prioridades del agricultor para comparar al menos 3 rotaciones,
incluida la actual, y explicar por qué se sugiere cada una, la evidencia, los beneficios, las lagunas y los riesgos que debe revisar
alguien local. Apoyar al agricultor, no sustituirlo. DeepKore cumple cada punto.

**4. ¿Qué recurso NASA aporta valor?**
NASA POWER (en la lista de recursos del reto): 25 años de datos diarios (2001–2025) para el punto exacto de la parcela. Con él
calculamos la probabilidad semanal de helada, calor extremo y lluvia fuerte, el agua que necesita cada cultivo (FAO-56), la
ventana de erosión y la humedad del suelo hoy. Sin POWER no hay ranking.

**5. ¿Qué podemos demostrar?**
Una app pública que funciona en el móvil: eliges tu parcela en Andalucía, lo que siembras y tus prioridades, y ves el calendario de
riesgos y tu rotación comparada con las mejores alternativas. Y que los datos son fiables: detecta la sequía de 2022–23.

**6. ¿Qué evidencia nos haría cambiar de enfoque?**
- Si NASA POWER no detectara sequías conocidas (lo comprobamos: sí detecta la de 2022–23).
- Si agricultores o agrónomos dijeran que los calendarios de cultivo o las rotaciones no son realistas para su zona.
- Si con datos de más resolución (GPM, SMAP) las semanas de riesgo cambiaran mucho respecto a POWER.

---

## Acotar la misión de 2 días

| | DeepKore |
|---|---|
| Persona destinataria | Agricultor de secano (piloto: Vega de Antequera, Málaga) |
| Necesidad concreta | Elegir la rotación del año que viene sabiendo sus riesgos y lo que gana o pierde |
| Salida demostrable | App web pública: calendario de riesgos + ranking de rotaciones con el porqué |
| Prueba mínima | Detecta la sequía 2022–23 (193 mm frente a 354 habituales); 28 tests automáticos |
| Trabajo futuro | Cualquier región del mundo, regadío, SMAP / GPM / SRTM, piloto con cooperativas, reglas PAC |

---

## Los 5 criterios del jurado (1 a 5 cada uno)

- **Impacto:** protege un recurso que no se puede reponer (el suelo), ayuda a decidir antes del riesgo y muestra opciones con más
  margen (trigo–lenteja: 361 €/ha frente a 46 €/ha, según el Ministerio). Gratis y en el móvil.
- **Creatividad:** convierte datos científicos en un calendario y un ranking que entiende cualquiera; el agricultor pone sus propias
  prioridades en vez de recibir una única respuesta; cada número dice de dónde sale.
- **Validez:** método documentado (FAO-56, frecuencias de 25 años), validación con la sequía 2022–23, márgenes oficiales (ECREA),
  28 tests, el mismo código en el pipeline y en el navegador, y límites explicados.
- **Relevancia:** responde punto por punto al reto y NASA POWER mueve todo el cálculo (no es decorativo).
- **Presentación:** 7 diapositivas con la estructura recomendada y una demo que se puede abrir con el QR.

---

## Preguntas probables del jurado (respuesta en 1 frase)

- **¿Dónde interviene el recurso NASA?** Todo el cálculo sale de NASA POWER diario 2001–2025 para la parcela elegida; sin POWER no
  hay calendario ni ranking.
- **¿Qué funciona hoy y qué falta?** Funciona: elegir parcela en Andalucía, riesgos, ranking, márgenes y simulador. Falta: SMAP y GPM
  para más resolución, datos de suelo de la parcela y calendarios revisados por agrónomos.
- **¿Qué comprobación respalda la conclusión?** Los datos detectan la sequía 2022–23 como la más seca de 25 años, y el margen sale de
  los estudios oficiales del Ministerio de Agricultura.
- **¿Cuál es la principal limitación?** Una celda de NASA POWER mide decenas de km: describe la zona, no cada rincón de la parcela.
- **¿Qué decisión del equipo aporta más valor?** Dejar que el agricultor ponga sus prioridades y enseñar de dónde sale cada número,
  en vez de darle una respuesta cerrada.
- **¿Por qué solo Andalucía?** Los datos de la NASA son globales; lo local son los calendarios de cultivo, y en 2 días solo pudimos
  escribir y revisar los de nuestra región.
- **¿Por qué solo secano?** Es donde el agricultor no tiene margen frente al clima y la rotación es su principal herramienta; el
  regadío es el siguiente paso.
- **¿Por qué solo un recurso NASA?** Preferimos integrar uno a fondo que tres por encima; GPM y SMAP piden cuenta de Earthdata y
  ficheros pesados, y son el siguiente paso.
- **¿Por qué gana tan poco el agricultor (46 €/ha)?** Es el margen oficial antes de ayudas PAC: el secano de cereal apenas deja
  margen, y por eso cambiar a una leguminosa importa.
- **¿Es fiable el "mejor" resultado?** Es una comparación con datos públicos y pesos que elige el agricultor; la confianza se muestra
  como baja porque algunos calendarios están por confirmar. Por eso la app dice siempre: consulta a tu agrónomo.
- **¿Cómo ganaríais dinero / cómo escala?** Datos abiertos y web estática: coste casi cero. Llega a través de cooperativas y oficinas
  agrarias; para otro país basta con añadir sus calendarios de cultivo.
