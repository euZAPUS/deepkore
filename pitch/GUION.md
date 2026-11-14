# Guion del pitch (2 minutos, 8 diapositivas, 3 personas)

Abrir https://euzapus.github.io/deepkore/pitch/ (o `pitch/index.html` del repo). **F** = pantalla completa, **← →** = avanzar.
Una sola persona lleva el mando todo el pitch para no ir buscando el teclado.

---

## Persona 1 · El problema y los datos (≈50 s) · diapositivas 1–4

**1 · La pregunta**
> "¿Cuánto tarda en formarse un centímetro de suelo fértil?"

*(dos segundos de silencio)*

**2 · Hasta 1.000 años**
> "Hasta mil años, según la FAO. Y una sola tormenta sobre suelo desnudo puede llevárselo en una tarde.
> En el secano andaluz, el suelo se queda desnudo tras la cosecha, justo cuando llegan las tormentas de otoño.
> Y el agricultor sigue decidiendo a ojo, aunque los datos existen."

**3 · DeepKore**
> "Por eso hemos creado DeepKore: elige la rotación que protege tu suelo y prepárate antes del riesgo."

**4 · Los datos**
> "Usamos tres fuentes de la NASA: POWER para heladas y calor, GPM para las tormentas
> y SMAP para la humedad del suelo ahora mismo. Nuestra parcela piloto está en Antequera.
> ZAP os enseña la app."

---

## ZAP · La app (≈30 s) · diapositivas 5–6

**5 · Made for the field** *(el móvil cambia solo entre claro y oscuro; puedes pulsar Light / Dark)*
> "La hemos diseñado para el campo: sin palabras técnicas, en modo claro para el sol
> o en oscuro para la noche, y se instala en el móvil como una app, sin registrarse."

**6 · Todo lo que hace**
> "El agricultor mueve cuatro barras y DeepKore ordena las rotaciones al momento.
> Tiene calendario de riesgos, simulador de clima, la humedad del suelo de hoy,
> y cada dato dice de dónde viene. [Nombre 3], ¿y el resultado?"

---

## Persona 3 · El impacto y el cierre (≈40 s) · diapositivas 7–8

**7 · El resultado** *(datos reales de NASA POWER 2001-2025)*
> "Este es el resultado con datos reales: para este agricultor, la mejor rotación sube de 51 a 68 sobre 100.
> Aprovecha mejor el agua de lluvia, protege mucho más el suelo de la erosión y aguanta mejor el clima.
> El dinero aún no lo puntuamos porque no tenemos precios locales verificados, y lo decimos.
> DeepKore ayuda, nunca sustituye: cada dato dice de dónde viene."

**8 · Cierre y QR**
> "Escanead el código y probadla ahora."
> *(despacio)* "El suelo tarda mil años en formarse. Protejámoslo a tiempo. Gracias."

---

**Ensayad con cronómetro:** 50 + 30 + 40 = 2:00. Si os pasáis, quitad primero la última frase de la diapositiva 2.

**Datos:** la diapositiva 7 y las capturas de `pitch/img/` ya usan los datos reales (NASA POWER 2001-2025).
Si cambia `data/rotations.json`, actualizar `DECK` al principio del `<script>` de `pitch/index.html` y repetir las capturas.
