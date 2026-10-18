#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
procesar_datos.py
Genera los archivos JSON del tablero "Mercado Laboral Lima Metropolitana" a partir de:
  1) El Excel del INEI "Series de empleo Lima Metropolitana" (hojas Indicad., Tasas,
     Adec Emp, Subempl y Masa Salarial), por trimestre movil desde 2001.
  2) El PDF del Informe Tecnico "Situacion del Mercado Laboral en Lima Metropolitana"
     (anexo estadistico, cuadros 1 a 55), del que se toma el ultimo trimestre movil.

Uso:
  python scripts/procesar_datos.py --excel ruta/series-de-empleo.xlsx --pdf ruta/informe.pdf --out data

Requisitos: Python 3.9+, openpyxl y pdftotext (poppler-utils).
  pip install openpyxl
  Ubuntu/Debian: sudo apt install poppler-utils | Windows: instalar Poppler y agregar al PATH

Al publicar un nuevo informe: actualizar ULTIMO_MES, PRIMER_MES_ANEXO y el diccionario
DESTACADOS (intervalos de confianza, variacion de la masa salarial y muestra), que se leen
del texto y graficos del informe.
"""
import argparse, json, os, re, subprocess, sys, warnings
import openpyxl

warnings.filterwarnings("ignore")

# ---------------- Parametros del informe ----------------
ULTIMO_MES = "2026-09"          # trimestre movil del informe (mes final): Jul-Ago-Set 2026
PRIMER_MES_ANEXO = (2021, 1)    # primer trimestre del anexo: Nov-Dic 2020-Ene 2021
DESTACADOS = [
    {"indicador": "ocupados_ls", "valor": 6202.7, "unidad": "Miles de personas", "detalle": "Límite superior del intervalo de confianza de la población ocupada, Jul-Ago-Set 2026 (Gráfico N° 01)"},
    {"indicador": "ocupados_li", "valor": 5824.0, "unidad": "Miles de personas", "detalle": "Límite inferior del intervalo de confianza de la población ocupada, Jul-Ago-Set 2026 (Gráfico N° 01)"},
    {"indicador": "desempleo_ls", "valor": 4.9, "unidad": "Porcentaje", "detalle": "Límite superior del intervalo de confianza de la tasa de desempleo, Jul-Ago-Set 2026 (Gráfico N° 13)"},
    {"indicador": "desempleo_li", "valor": 3.8, "unidad": "Porcentaje", "detalle": "Límite inferior del intervalo de confianza de la tasa de desempleo, Jul-Ago-Set 2026 (Gráfico N° 13)"},
    {"indicador": "masa_salarial_var", "valor": 6.8, "unidad": "Porcentaje", "detalle": "Variación de la masa salarial, Jul-Ago-Set 2026 respecto a similar trimestre de 2025 (Gráfico N° 15)"},
    {"indicador": "muestra_viviendas", "valor": 4800, "unidad": "Viviendas", "detalle": "Viviendas particulares en la muestra del trimestre (Lima y Callao)"},
    {"indicador": "muestra_mensual", "valor": 1600, "unidad": "Viviendas", "detalle": "Viviendas por mes"},
    {"indicador": "conglomerados", "valor": 400, "unidad": "Conglomerados", "detalle": "Conglomerados de la muestra"},
]

# ---------------- Metadatos de los cuadros del anexo ----------------
SX=['Total','Hombre','Mujer','De 14 a 24 años','De 25 a 44 años','De 45 y más años']
ED=['Total','Primaria o menor nivel','Secundaria','Superior no universitaria','Superior universitaria']
RA=['Total','Manufactura','Construcción','Comercio','Servicios']
CT=['Total','Independiente','Dependiente','De 1 a 10 trabajadores','De 11 a 50 trabajadores','De 51 y más trabajadores']
CO=['Total','Cono Norte','Cono Este','Cono Centro','Cono Sur','Prov. Const. del Callao']
M={ # cuadro: (titulo, unidad, series, tipo, tema, desagregacion)
1:('Población en edad de trabajar, según condición de actividad','Miles de personas',['Población en edad de trabajar (PET)','Población económicamente activa (PEA)','Población económicamente no activa (No PEA)'],'nivel','pet','Condición de actividad'),
2:('Población económicamente activa, por sexo y grupo de edad','Miles de personas',SX,'nivel','pea','Sexo y edad'),
3:('Población económicamente activa, por nivel de educación alcanzado','Miles de personas',ED,'nivel','pea','Nivel de educación'),
4:('Población económicamente no activa, por sexo y grupo de edad','Miles de personas',SX,'nivel','nopea','Sexo y edad'),
5:('Población económicamente no activa, por nivel de educación alcanzado','Miles de personas',ED,'nivel','nopea','Nivel de educación'),
6:('Tasas de ocupación, empleo adecuado, subempleo y desempleo','Porcentaje de la PEA',['Tasa de ocupación','Tasa de empleo adecuado','Tasa de subempleo por insuficiencia de horas','Tasa de subempleo por ingresos','Tasa de desempleo'],'tasa','niveles','Niveles de empleo'),
7:('Población económicamente activa, por niveles de empleo','Miles de personas',['Población económicamente activa','Ocupados','Adecuadamente empleados','Subempleo por insuficiencia de horas (visible)','Subempleo por ingresos (invisible)','Desocupados'],'nivel','niveles','Niveles de empleo'),
8:('Población ocupada, por sexo y grupo de edad','Miles de personas',SX,'nivel','ocu','Sexo y edad'),
9:('Población ocupada, por nivel de educación alcanzado','Miles de personas',ED,'nivel','ocu','Nivel de educación'),
10:('Población ocupada, por rama de actividad','Miles de personas',RA,'nivel','ocu','Rama de actividad'),
11:('Población ocupada, por categoría de ocupación','Miles de personas',['Total','Asalariado','Trabajador independiente','Trabajador del hogar y otro','Trabajador familiar no remunerado'],'nivel','ocu','Categoría de ocupación'),
12:('Población ocupada, con y sin seguro de salud','Miles de personas',['Total','Con seguro de salud','Solo EsSalud','Solo Seguro Privado de Salud','EsSalud y Seguro Privado','Solo Seguro Integral de Salud (SIS)','Otro (SIS y otros seguros)','Sin seguro de salud'],'nivel','ocu','Seguro de salud'),
13:('Población ocupada, por categoría de ocupación y tamaño de empresa','Miles de personas',CT,'nivel','ocu','Categoría y tamaño de empresa'),
14:('Población ocupada, por rango de horas trabajadas a la semana','Miles de personas',['Total','1 a 10 horas','11 a 20 horas','21 a 30 horas','31 a 40 horas','41 a 50 horas','51 a 60 horas','61 a 70 horas','71 a 80 horas','81 y más horas'],'nivel','ocu','Horas trabajadas'),
15:('Población ocupada, por sector económico y tamaño de empresa','Miles de personas',['Total','Total: de 1 a 50 trabajadores','Total: 51 y más trabajadores','Bienes','Bienes: de 1 a 50 trabajadores','Bienes: 51 y más trabajadores','Servicios','Servicios: de 1 a 50 trabajadores','Servicios: 51 y más trabajadores'],'nivel','ocu','Sector y tamaño de empresa'),
17:('Tasa neta de participación (ocupados / PET), por sexo y grupo de edad','Porcentaje',SX,'tasa','pea','Sexo y edad'),
18:('Tasa neta de participación (ocupados / PET), por nivel de educación','Porcentaje',ED,'tasa','pea','Nivel de educación'),
19:('Horas trabajadas por semana, por sexo y grupo de edad','Millones de horas',SX,'nivel','horas','Sexo y edad'),
21:('Horas trabajadas por semana, por rama de actividad y categoría de ocupación','Millones de horas',RA+['Independiente','Dependiente'],'nivel','horas','Rama y categoría'),
22:('Promedio de horas trabajadas por semana, por sexo y grupo de edad','Horas',SX,'promedio','horas','Sexo y edad'),
23:('Promedio de horas trabajadas por semana, por rama de actividad y categoría','Horas',RA+['Independiente','Dependiente'],'promedio','horas','Rama y categoría'),
24:('Población adecuadamente empleada, por sexo y grupo de edad','Miles de personas',SX,'nivel','adec','Sexo y edad'),
25:('Población adecuadamente empleada, por nivel de educación alcanzado','Miles de personas',ED,'nivel','adec','Nivel de educación'),
26:('Población adecuadamente empleada, por rama de actividad','Miles de personas',RA,'nivel','adec','Rama de actividad'),
27:('Población adecuadamente empleada, por categoría de ocupación y tamaño de empresa','Miles de personas',CT,'nivel','adec','Categoría y tamaño de empresa'),
29:('Población subempleada por insuficiencia de horas (visible), por sexo y grupo de edad','Miles de personas',SX,'nivel','subv','Sexo y edad'),
30:('Población subempleada por insuficiencia de horas (visible), por nivel de educación','Miles de personas',ED,'nivel','subv','Nivel de educación'),
31:('Población subempleada por insuficiencia de horas (visible), por rama de actividad','Miles de personas',RA,'nivel','subv','Rama de actividad'),
32:('Población subempleada por insuficiencia de horas (visible), por categoría y tamaño de empresa','Miles de personas',CT,'nivel','subv','Categoría y tamaño de empresa'),
34:('Población subempleada por ingresos (invisible), por sexo y grupo de edad','Miles de personas',SX,'nivel','subi','Sexo y edad'),
35:('Población subempleada por ingresos (invisible), por nivel de educación','Miles de personas',ED,'nivel','subi','Nivel de educación'),
36:('Población subempleada por ingresos (invisible), por rama de actividad','Miles de personas',RA,'nivel','subi','Rama de actividad'),
37:('Población subempleada por ingresos (invisible), por categoría y tamaño de empresa','Miles de personas',CT,'nivel','subi','Categoría y tamaño de empresa'),
38:('Población desempleada, por sexo y grupo de edad','Miles de personas',SX,'nivel','des','Sexo y edad'),
39:('Promedio de semanas que dura el desempleo, por grupo de edad','Semanas',['Total','De 14 a 24 años','De 25 a 44 años','De 45 y más años'],'promedio','des','Duración del desempleo'),
40:('Tasa de desempleo, por sexo y grupo de edad','Porcentaje',SX,'tasa','td','Sexo y edad'),
41:('Población desempleada, por experiencia laboral','Miles de personas',['Total','Aspirantes (sin experiencia laboral)','Cesantes (con experiencia laboral)'],'nivel','des','Experiencia laboral'),
42:('Población desempleada, por nivel de educación alcanzado','Miles de personas',ED[1:],'nivel','des','Nivel de educación'),
43:('Tasa de desempleo, por nivel de educación alcanzado','Porcentaje',ED[1:],'tasa','td','Nivel de educación'),
45:('Total de ingresos de la ocupación principal, por sexo y tamaño de empresa (año móvil)','Millones de soles',['Total','Hombre','Mujer','De 1 a 10 trabajadores','De 11 a 50 trabajadores','De 51 y más trabajadores'],'nivel','ingtot','Sexo y tamaño de empresa'),
46:('Total de ingresos de la ocupación principal, por nivel de educación (año móvil)','Millones de soles',ED,'nivel','ingtot','Nivel de educación'),
47:('Total de ingresos de la ocupación principal, por conos (año móvil)','Millones de soles',CO,'nivel','ingtot','Conos'),
48:('Ingreso promedio mensual de la población ocupada, por sexo y grupo de edad','Soles',SX,'promedio','ing','Sexo y edad'),
49:('Ingreso promedio mensual de la población ocupada, por nivel de educación','Soles',ED,'promedio','ing','Nivel de educación'),
50:('Ingreso promedio mensual de la población ocupada, por rama de actividad','Soles',RA,'promedio','ing','Rama de actividad'),
51:('Ingreso promedio mensual, por categoría de ocupación y tamaño de empresa','Soles',CT,'promedio','ing','Categoría y tamaño de empresa'),
52:('Ingreso promedio mensual de la población ocupada residente en los conos','Soles',CO,'promedio','ing','Conos'),
53:('Ingreso promedio por hora, por sexo y tamaño de empresa','Soles por hora',['Total','Hombre','Mujer','De 1 a 10 trabajadores','De 11 a 50 trabajadores','De 51 y más trabajadores'],'promedio','inghora','Sexo y tamaño de empresa'),
54:('Ingreso promedio por hora, por nivel de educación','Soles por hora',ED,'promedio','inghora','Nivel de educación'),
55:('Ingreso promedio por hora, por conos','Soles por hora',CO,'promedio','inghora','Conos'),
}
# 28 and 33 (level + rate) -> fold into series
M[28]=('Población subempleada por insuficiencia de horas (visible) y tasa','Miles de personas y porcentaje',['Población subempleada visible','Tasa de subempleo visible'],'mixto','subv','Total')
M[33]=('Población subempleada por ingresos (invisible) y tasa','Miles de personas y porcentaje',['Población subempleada por ingresos','Tasa de subempleo por ingresos'],'mixto','subi','Total')


def mes_str(y, m, i=0):
    k = y * 12 + m - 1 + i
    return f"{k // 12}-{k % 12 + 1:02d}"


def mes_key(y, m, i=0):
    k = y * 12 + m - 1 + i
    return (k // 12) * 100 + k % 12 + 1


# ---------------- 1. Anexo del PDF ----------------
def leer_anexo(pdf):
    txt = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True, check=True).stdout
    L = txt.split("\n")
    starts = [i for i, l in enumerate(L) if re.match(r"\s*Cuadro Nº \d+", l)] + [len(L)]
    NUM = re.compile(r"(?<![\d,])(-?\d{1,3}(?: \d{3})*,\d+)(\s?a/)?")
    tablas, var = {}, {}
    for a, b in zip(starts[:-1], starts[1:]):
        n = int(re.search(r"Nº (\d+)", L[a]).group(1))
        filas = []
        for l in L[a:b]:
            s = l.strip()
            m = re.match(r"^((?:[A-Z][a-z]{2}[\d ]*-?){2,3}\d*)\s{2,}(.*)$", s)
            if not m or not re.match(r"^(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Set|Oct|Nov|Dic)", m.group(1)):
                continue
            vals, flags = [], []
            for mm in NUM.finditer(m.group(2)):
                vals.append(float(mm.group(1).replace(" ", "").replace(",", ".")))
                flags.append(bool(mm.group(2)))
            filas.append((vals, flags))
        tablas[n] = filas
        vl = [l for l in L[a:b] if l.strip().startswith("Respecto")]
        if vl:
            rest = re.split(r"anterior", vl[0], maxsplit=1)[1]
            vals, sig = [], []
            for t in re.split(r"\s{2,}|\s(?=\+)", rest.strip()):
                t = t.strip()
                if re.fullmatch(r"\++", t):
                    if sig: sig[-1] = t
                elif re.fullmatch(r"-?[\d ]+,\d+", t):
                    vals.append(float(t.replace(" ", "").replace(",", "."))); sig.append("")
            var[n] = (vals, sig)
    return tablas, var


def construir_anexo(tablas, var):
    y0, m0 = PRIMER_MES_ANEXO
    filas, cuadros, pruebas = [], [], []
    for c, (tit, uni, ser, tipo, tema, des) in sorted(M.items()):
        T = tablas[c]
        for i, (vals, flags) in enumerate(T):
            if len(vals) != len(ser):
                sys.exit(f"Cuadro {c}, fila {i}: se esperaban {len(ser)} valores y se leyeron {len(vals)}")
            for j, s in enumerate(ser):
                es_tasa = tipo == "tasa" or (tipo == "mixto" and j == 1)
                filas.append({"cuadro": c, "orden": j, "serie": s, "mes": mes_str(y0, m0, i), "valor": vals[j],
                              "referencial": flags[j], "es_tasa": es_tasa, "es_promedio": tipo == "promedio"})
        cuadros.append({"cuadro": c, "titulo": tit, "unidad": uni, "tipo": tipo, "tema": tema, "desagregacion": des,
                        "periodo": "Año móvil" if c in (45, 46, 47) else "Trimestre móvil", "series": len(ser),
                        "var_tipo": "pp" if tipo == "tasa" else ("abs" if c in (22, 23) else "pct")})
        if c in var and len(var[c][0]) == len(ser):
            for j, s in enumerate(ser):
                pruebas.append({"cuadro": c, "orden": j, "serie": s, "mes": ULTIMO_MES,
                                "var_informe": var[c][0][j], "significancia": var[c][1][j]})
        else:
            print(f"Aviso: no se pudo leer la fila de variacion del cuadro {c}")
    ultimo = filas[-1]["mes"]
    if ultimo != ULTIMO_MES:
        print(f"Aviso: el ultimo trimestre leido es {ultimo} y ULTIMO_MES es {ULTIMO_MES}")
    return filas, cuadros, pruebas


# ---------------- 2. Series largas del Excel ----------------
INICIO = {"Indicad.": (2001, 5), "Tasas": (2001, 5), "Adec Emp": (2001, 11), "Subempl": (2001, 11), "Masa Salarial": (2012, 1)}


def leer_excel(xlsx):
    wb = openpyxl.load_workbook(xlsx, data_only=True)
    R = {n: list(wb[n].iter_rows(values_only=True)) for n in INICIO}

    def get(hoja, cab, etiqueta, nth=1):
        rows = R[hoja]
        h = next(i for i, r in enumerate(rows) if r[0] and str(r[0]).strip().upper().startswith(cab.upper()))
        c = 0
        for r in rows[h + 1:]:
            if r[0] and str(r[0]).strip() == etiqueta:
                c += 1
                if c == nth:
                    y, m = INICIO[hoja]
                    return {mes_key(y, m, i): round(v, 3) for i, v in enumerate(r[1:]) if isinstance(v, (int, float))}
        raise KeyError((hoja, cab, etiqueta))

    S = {}
    grupos = [("Total", "t"), ("Hombre", "h"), ("Mujer", "m"), ("14 a 24 años", "e1"), ("25 a 44 años", "e2"), ("45 y más años", "e3")]
    for nm, cab in [("pet", "POBLACIÓN EN EDAD"), ("pea", "PEA"), ("ocu", "OCUPADOS"), ("des", "DESOCUPADOS"), ("ina", "INACTIVOS")]:
        for lab, k in grupos:
            S[f"{nm}_{k}"] = get("Indicad.", cab, lab)
    S["horas_prom"] = get("Indicad.", "PROMEDIO DE HORAS", "Total")
    for nm, cab in [("ta", "TASA DE ACTIVIDAD"), ("to", "TASA DE OCUPACI"), ("td", "TASA DE DESEMPLEO")]:
        for lab, k in grupos:
            S[f"{nm}_{k}"] = get("Tasas", cab, lab)
    S["adec_t"] = get("Adec Emp", "ADECUADAMENTE", "Total")
    S["sub_t"] = get("Subempl", "SUBEMPLEADOS", "Total")
    S["subv_t"] = get("Subempl", "SUBEMPLEO POR HORAS", "Total")
    S["subi_t"] = get("Subempl", "SUBEMPLEO POR INGRESOS", "Total")
    rows = R["Masa Salarial"]

    def mrow(pref):
        r = next(r for r in rows if r[0] and str(r[0]).strip().startswith(pref))
        return {mes_key(2012, 1, i): round(v, 3) for i, v in enumerate(r[1:]) if isinstance(v, (int, float))}
    S["masa"], S["masa_ind"], S["masa_dep"] = mrow("Masa salarial"), mrow("Independientes"), mrow("Dependientes")
    S["ing_hog"], S["ing_pc"] = mrow("Promedio del Ingreso"), mrow("Ingreso percapita")
    return S


def completar_con_anexo(S, filas):
    """Verifica la coincidencia Excel-anexo y agrega el ultimo trimestre del informe."""
    A = {(r["cuadro"], r["orden"], r["mes"]): r["valor"] for r in filas}
    k = int(ULTIMO_MES.replace("-", ""))
    g = lambda c, o: A[(c, o, ULTIMO_MES)]
    for s, (c, o) in {"pet_t": (1, 0), "ocu_t": (7, 1), "td_t": (6, 4)}.items():
        dif = [m for (cc, oo, m), v in A.items() if cc == c and oo == o and int(m.replace("-", "")) in S[s]
               and abs(S[s][int(m.replace("-", ""))] - v) > 0.06]
        if dif:
            print(f"Aviso: {s} difiere entre Excel y anexo en {len(dif)} trimestres, p. ej. {dif[:3]}")
    if k in S["ocu_t"]:
        return
    ext = {"pet_t": (1, 0), "pea_t": (1, 1), "ina_t": (1, 2), "ocu_t": (7, 1), "adec_t": (7, 2), "subv_t": (7, 3),
           "subi_t": (7, 4), "des_t": (7, 5), "horas_prom": (22, 0)}
    for i, gsx in enumerate(["h", "m", "e1", "e2", "e3"], start=1):
        ext[f"pea_{gsx}"] = (2, i); ext[f"ocu_{gsx}"] = (8, i); ext[f"des_{gsx}"] = (38, i)
        ext[f"ina_{gsx}"] = (4, i); ext[f"td_{gsx}"] = (40, i)
    ext["td_t"] = (40, 0)
    for s, (c, o) in ext.items():
        S[s][k] = g(c, o)
    S["sub_t"][k] = round(g(7, 1) - g(7, 2), 1)
    S["ta_t"][k] = round(S["pea_t"][k] / S["pet_t"][k] * 100, 3)
    S["to_t"][k] = round(S["ocu_t"][k] / S["pea_t"][k] * 100, 3)
    for gsx in ["h", "m", "e1", "e2", "e3"]:
        S[f"pet_{gsx}"][k] = round(S[f"pea_{gsx}"][k] + S[f"ina_{gsx}"][k], 1)
        S[f"ta_{gsx}"][k] = round(S[f"pea_{gsx}"][k] / S[f"pet_{gsx}"][k] * 100, 3)


NOMBRES = {"pet_t": "pet", "pea_t": "pea", "ocu_t": "ocupados", "des_t": "desocupados", "ina_t": "no_pea",
           "ta_t": "tasa_actividad", "ta_h": "tasa_actividad_hombre", "ta_m": "tasa_actividad_mujer",
           "ta_e1": "tasa_actividad_14_24", "ta_e2": "tasa_actividad_25_44", "ta_e3": "tasa_actividad_45_mas",
           "to_t": "tasa_ocupacion", "td_t": "tasa_desempleo", "td_h": "tasa_desempleo_hombre", "td_m": "tasa_desempleo_mujer",
           "td_e1": "tasa_desempleo_14_24", "td_e2": "tasa_desempleo_25_44", "td_e3": "tasa_desempleo_45_mas",
           "adec_t": "adecuadamente_empleados", "sub_t": "subempleados", "subv_t": "subempleo_visible",
           "subi_t": "subempleo_invisible", "horas_prom": "horas_promedio", "masa": "masa_salarial",
           "masa_ind": "masa_salarial_independientes", "masa_dep": "masa_salarial_dependientes",
           "ing_hog": "ingreso_promedio_hogar", "ing_pc": "ingreso_percapita", "ocu_h": "ocupados_hombre",
           "ocu_m": "ocupados_mujer", "pea_h": "pea_hombre", "pea_m": "pea_mujer"}


def serie_ancha(S):
    meses = sorted({k for s in NOMBRES for k in S[s]})
    filas = []
    for k in meses:
        r = {"mes": f"{k // 100}-{k % 100:02d}"}
        for s, n in NOMBRES.items():
            v = S[s].get(k)
            r[n] = None if v is None else round(v, 3)
        filas.append(r)
    return filas


def guardar(obj, ruta):
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  {ruta} ({os.path.getsize(ruta):,} bytes)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--excel", required=True, help="Excel de series de empleo de Lima Metropolitana (INEI)")
    ap.add_argument("--pdf", required=True, help="PDF del informe tecnico del mercado laboral")
    ap.add_argument("--out", default="data", help="Carpeta de salida (por defecto: data)")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    print("Leyendo anexo del PDF...")
    tablas, var = leer_anexo(a.pdf)
    filas, cuadros, pruebas = construir_anexo(tablas, var)
    print("Leyendo series del Excel...")
    S = leer_excel(a.excel)
    completar_con_anexo(S, filas)
    print("Escribiendo archivos:")
    guardar(filas, os.path.join(a.out, "epen_anexo.json"))
    guardar(cuadros, os.path.join(a.out, "epen_cuadros.json"))
    guardar(pruebas, os.path.join(a.out, "epen_pruebas.json"))
    guardar(DESTACADOS, os.path.join(a.out, "epen_informe_destacados.json"))
    guardar(serie_ancha(S), os.path.join(a.out, "series_lima_2001_2026.json"))
    print("Listo.")


if __name__ == "__main__":
    main()
