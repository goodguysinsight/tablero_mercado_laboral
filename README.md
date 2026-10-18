# Mercado Laboral Lima Metropolitana

Tablero interactivo sobre la situación del mercado laboral en Lima Metropolitana y Callao, con datos de la **Encuesta Permanente de Empleo Nacional (EPEN)** del INEI. Sigue la estructura y las definiciones del Informe Técnico N° 10 (octubre 2026), trimestre móvil **julio-agosto-setiembre 2026**.

## Contenido

| Pestaña | Qué muestra |
|---|---|
| Panorama | Indicadores principales con variación interanual y significancia (+, ++, +++), filtro por sexo, composición PET/PEA/No PEA (Cuadro 01), "De cada 100 personas de la PEA" (Cuadro 11) y Gráficos 01 y 13 con intervalo de confianza |
| Población y PEA | Tasa de actividad 2001–2026 por sexo y edad; cuadros 1–5, 17 y 18 del anexo |
| Ocupados | Variación de la población ocupada por trimestre (Gráfico 03); cuadros por sexo, edad, educación, rama, tamaño de empresa, categoría, seguro de salud y horas |
| Niveles de empleo | Empleo adecuado y subempleo visible e invisible (cuadros 6, 7 y 24–37) |
| Desempleo | Tasa por sexo y edad 2001–2026; cuadros 38–43 |
| Ingresos | Ingreso por sexo y brecha de género, masa salarial, comparativo por conos (cuadros 47, 52 y 55) y cuadros 45–55 |
| Series 2001–2026 | Series históricas del Excel del INEI con los cambios de marco muestral marcados |
| Definiciones | Conceptos, clasificaciones, conos y lectura de los cuadros |

El selector **Trimestre móvil** permite ver cualquier trimestre desde Nov-Dic 2020-Ene 2021. Cada cuadro compara con el mismo trimestre de los tres años anteriores, como en el informe.

## Estructura del repositorio

```
├── index.html                 Página del tablero
├── css/
│   ├── base.css               Tokens de diseño (modo claro y oscuro)
│   └── tablero.css            Estilos de los componentes
├── js/
│   ├── dash.js                Carga de datos y cálculos (interfaz dash.*)
│   └── app.js                 Lógica del tablero: indicadores, cuadros y gráficos (d3 v7)
├── data/
│   ├── epen_anexo.json        Cuadros del anexo estadístico, por trimestre móvil (2021–2026)
│   ├── epen_cuadros.json      Catálogo de cuadros: título, unidad, tipo y desagregación
│   ├── epen_pruebas.json      Pruebas de diferencia del trimestre del informe
│   ├── epen_informe_destacados.json  Intervalos de confianza, masa salarial y muestra
│   └── series_lima_2001_2026.json    Series largas del Excel del INEI
└── scripts/
    └── procesar_datos.py      Genera la carpeta data/ a partir del Excel y del PDF
```

## Publicar en GitHub Pages

1. Crea el repositorio (por ejemplo `tablero_mercado_laboral_lima`) y sube todo el contenido de esta carpeta a la rama `main`:
   ```bash
   git init
   git add .
   git commit -m "Tablero mercado laboral Lima Metropolitana"
   git branch -M main
   git remote add origin https://github.com/<usuario>/tablero_mercado_laboral_lima.git
   git push -u origin main
   ```
2. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. El tablero quedará en `https://<usuario>.github.io/tablero_mercado_laboral_lima/`.

## Ver el tablero en local

Los datos se cargan con `fetch`, por lo que el archivo no funciona abierto con doble clic. Levanta un servidor local:

```bash
python -m http.server 8000
# abrir http://localhost:8000
```

## Actualizar con un nuevo informe

1. Descarga del INEI el nuevo PDF del informe técnico y el Excel de series de empleo de Lima Metropolitana.
2. En `scripts/procesar_datos.py` actualiza `ULTIMO_MES` y el bloque `DESTACADOS` (intervalos de confianza de los Gráficos 01 y 13, variación de la masa salarial y tamaño de muestra, que vienen del texto del informe).
3. Ejecuta:
   ```bash
   pip install openpyxl          # además se requiere pdftotext (poppler-utils)
   python scripts/procesar_datos.py --excel series-de-empleo-lima-metropolitana.xlsx --pdf informe-tecnico.pdf --out data
   ```
   El script verifica que el Excel y el anexo coincidan en los trimestres comunes y avisa si un cuadro no se lee completo.
4. En `js/dash.js` y `js/app.js` actualiza el trimestre por defecto (`mes: '2026-09'` y `LATEST`).
5. Sube los cambios (`git add . && git commit -m "Actualización <trimestre>" && git push`).

## Notas metodológicas

- **Comparación:** siempre respecto a similar trimestre móvil del año anterior. Niveles en miles y %, tasas en puntos porcentuales, promedios de horas en horas.
- **Significancia:** `+`, `++` y `+++` indican diferencias significativas al 10%, 5% y 1%; el INEI solo las publica para el trimestre del informe.
- **a/** (en cursiva): resultado referencial, coeficiente de variación mayor a 15%.
- **Filtro por sexo:** las tasas de empleo adecuado, subempleo y actividad por sexo se calculan como nivel / PEA de cada sexo (cuadros 2, 4, 24 y 34); la tasa de desempleo por sexo es la del cuadro 40.
- **Tasa neta de participación** (cuadros 17 y 18 del anexo): según sus cifras equivale a ocupados / PET.
- **Series largas:** hasta 2016 el marco muestral fue el Censo 2007; se renovó en 2017 (SISFOH 2013), por completo desde enero de 2018, y desde Ago-Set-Oct 2022 los datos son de la EPEN (Lima Metropolitana y Callao).
- No se incluyen los cuadros 16, 20 y 44 del anexo.

## Fuente

Instituto Nacional de Estadística e Informática (INEI) – Encuesta Permanente de Empleo Nacional (EPEN). *Situación del Mercado Laboral en Lima Metropolitana*, Informe Técnico N° 10, octubre 2026; y series de empleo de Lima Metropolitana 2001–2026. Elaboración: Good Guys Insight.
