/* Tablero: Situación del mercado laboral en Lima Metropolitana (INEI – EPEN) */
  // ---------- Cálculos (visibles en Fuentes) ----------
  dash.calc('cuadro_var', {
    title: 'Cuadros con variación interanual',
    description: 'Para cada cuadro, serie y trimestre móvil: valor y valores del mismo trimestre en los tres años previos, variación absoluta, variación porcentual (pp en tasas, horas en promedios de horas) y participación en el total.',
    inputs: ['epen_anexo', 'epen_cuadros', 'epen_pruebas'],
    fn: (epen_anexo, epen_cuadros, epen_pruebas) => {
      const tipo = new Map(epen_cuadros.map((c) => [Number(c.cuadro), c]));
      const key = (c, o, m) => c + '|' + o + '|' + m;
      const idx = new Map(epen_anexo.map((r) => [key(r.cuadro, r.orden, r.mes), r]));
      const sig = new Map(epen_pruebas.map((p) => [key(p.cuadro, p.orden, p.mes), p.significancia]));
      const back = (m, k) => (Number(m.slice(0, 4)) - k) + m.slice(4);
      const r1 = (x) => (x == null ? null : Math.round(x * 100) / 100);
      const d1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
      return epen_anexo.map((r) => {
        const g = (k) => idx.get(key(r.cuadro, r.orden, back(r.mes, k)));
        const p1 = g(1), p2 = g(2), p3 = g(3);
        const c = tipo.get(Number(r.cuadro));
        const vt = r.es_tasa ? 'pp' : (c && c.var_tipo === 'abs' ? 'abs' : 'pct');
        const tot = idx.get(key(r.cuadro, 0, r.mes));
        const share = c && c.tipo === 'nivel' && tot && (tot.serie.startsWith('Total') || Number(r.cuadro) === 1 || Number(r.cuadro) === 7) && r.orden > 0 ? d1((r.valor / tot.valor) * 100) : null;
        return {
          id: 'c' + r.cuadro + '-' + r.orden + '-' + r.mes, cuadro: Number(r.cuadro), orden: Number(r.orden), serie: r.serie, mes: r.mes,
          v3: p3 ? p3.valor : null, v2: p2 ? p2.valor : null, v1: p1 ? p1.valor : null, v0: r.valor,
          ref3: p3 ? p3.referencial : false, ref2: p2 ? p2.referencial : false, ref1: p1 ? p1.referencial : false, ref0: r.referencial,
          var_abs: p1 ? r1(r.valor - p1.valor) : null,
          var_pct: p1 && vt === 'pct' ? d1((r.valor / p1.valor - 1) * 100) : null,
          var_tipo: vt, participacion: share, significancia: sig.get(key(r.cuadro, r.orden, r.mes)) || ''
        };
      });
    }
  });

  dash.calc('series_var', {
    title: 'Ocupados y tasa de actividad, variación interanual',
    description: 'Variación porcentual de la población ocupada y variación en pp de la tasa de actividad respecto a similar trimestre móvil del año anterior.',
    inputs: ['series_lima'],
    fn: (series_lima) => {
      const by = new Map(series_lima.map((r) => [r.mes, r]));
      return series_lima.map((r) => {
        const p = by.get((Number(r.mes.slice(0, 4)) - 1) + r.mes.slice(4));
        return {
          mes: r.mes, ocupados: r.ocupados, tasa_actividad: r.tasa_actividad == null ? null : Math.round(r.tasa_actividad * 10) / 10,
          ocupados_var_pct: p && p.ocupados ? Math.round((r.ocupados / p.ocupados - 1) * 1000) / 10 : null,
          tasa_actividad_var_pp: p && p.tasa_actividad != null ? Math.round((Math.round(r.tasa_actividad * 10) - Math.round(p.tasa_actividad * 10))) / 10 : null
        };
      });
    }
  });

  dash.calc('brecha_ingreso', {
    title: 'Brecha de ingreso por sexo',
    description: 'Ingreso promedio mensual de las mujeres como porcentaje del de los hombres (anexo, cuadro 48).',
    inputs: ['epen_anexo'],
    fn: (epen_anexo) => {
      const h = new Map(), m = new Map();
      epen_anexo.forEach((r) => { if (r.cuadro === 48 && r.orden === 1) h.set(r.mes, r.valor); if (r.cuadro === 48 && r.orden === 2) m.set(r.mes, r.valor); });
      return [...h.keys()].map((mes) => ({ mes, ingreso_hombre: h.get(mes), ingreso_mujer: m.get(mes), brecha_pct: Math.round((m.get(mes) / h.get(mes)) * 1000) / 10 }));
    }
  });

  dash.calc('panorama_sexo', {
    title: 'Indicadores del panorama por sexo',
    description: 'Por sexo y trimestre móvil: PEA, No PEA, ocupados, desocupados, niveles de empleo y sus tasas, tasa de actividad e ingreso promedio, con variación interanual. Total: tasas del cuadro 6. Por sexo: desempleo del cuadro 40; las demás tasas como nivel / PEA (cuadros 2, 24, 29 y 34).',
    inputs: ['epen_anexo', 'epen_pruebas'],
    fn: (epen_anexo, epen_pruebas) => {
      const v = new Map(epen_anexo.map((r) => [r.cuadro + '|' + r.orden + '|' + r.mes, r.valor]));
      const sg = new Map(epen_pruebas.map((p) => [p.cuadro + '|' + p.orden + '|' + p.mes, p.significancia]));
      const meses = [...new Set(epen_anexo.map((r) => r.mes))].sort();
      const d1 = (x) => (x == null || !isFinite(x) ? null : Math.round(x * 10) / 10);
      const base = (o, m) => {
        const g = (c, oo) => { const x = v.get(c + '|' + (oo == null ? o : oo) + '|' + m); return x == null ? null : x; };
        const pea = g(2), nopea = g(4), ocu = g(8), des = g(38), adec = g(24), subv = g(29), subi = g(34);
        if (pea == null || nopea == null) return null;
        const t = o === 0;
        return {
          pea, no_pea: nopea, pet: t && g(1, 0) != null ? g(1, 0) : d1(pea + nopea), ocupados: ocu, desocupados: des, adecuado: adec, subempleo_visible: subv, subempleo_ingresos: subi,
          tasa_ocupacion: t ? g(6, 0) : d1((ocu / pea) * 100), tasa_desempleo: t ? g(6, 4) : g(40),
          tasa_adecuado: t ? g(6, 1) : d1((adec / pea) * 100), tasa_subempleo_visible: t ? g(6, 2) : d1((subv / pea) * 100),
          tasa_subempleo_ingresos: t ? g(6, 3) : d1((subi / pea) * 100), tasa_actividad: d1((pea / (pea + nopea)) * 100),
          no_pea_pct_pet: d1((nopea / (pea + nopea)) * 100), ingreso: g(48)
        };
      };
      const prev = (m) => (Number(m.slice(0, 4)) - 1) + m.slice(4);
      const out = [];
      meses.forEach((m) => [['Total', 0], ['Hombre', 1], ['Mujer', 2]].forEach(([s, o]) => {
        const a = base(o, m); if (!a) return; const p = base(o, prev(m));
        const pct = (k) => (p && p[k] ? d1((a[k] / p[k] - 1) * 100) : null);
        const pp = (k) => (p && p[k] != null && a[k] != null ? d1(a[k] - p[k]) : null);
        const q = (c, oo) => sg.get(c + '|' + oo + '|' + m) || '';
        out.push(Object.assign({ id: s + '-' + m, sexo: s, mes: m }, a, {
          ocupados_var_pct: pct('ocupados'), pea_var_pct: pct('pea'), no_pea_var_pct: pct('no_pea'), desocupados_var_pct: pct('desocupados'), ingreso_var_pct: pct('ingreso'),
          tasa_desempleo_var_pp: pp('tasa_desempleo'), tasa_adecuado_var_pp: pp('tasa_adecuado'), tasa_subempleo_ingresos_var_pp: pp('tasa_subempleo_ingresos'), tasa_actividad_var_pp: pp('tasa_actividad'),
          sig_ocupados: q(8, o), sig_desempleo: o === 0 ? q(6, 4) : q(40, o), sig_adecuado: o === 0 ? q(6, 1) : '', sig_subempleo_ingresos: o === 0 ? q(6, 3) : '', sig_ingreso: q(48, o)
        }));
      }));
      return out;
    }
  });

  dash.calc('conos', {
    title: 'Comparativo por conos',
    description: 'Por cono y período: ingreso promedio mensual (cuadro 52), ingreso promedio por hora (cuadro 55) e ingresos totales de la ocupación principal en año móvil (cuadro 47) con su participación en el total, y sus variaciones interanuales.',
    inputs: ['cuadro_var'],
    fn: (cuadro_var) => {
      const by = new Map();
      cuadro_var.forEach((r) => {
        if (r.cuadro !== 52 && r.cuadro !== 55 && r.cuadro !== 47) return;
        const k = r.orden + '|' + r.mes;
        if (!by.has(k)) by.set(k, { id: r.orden + '-' + r.mes, orden: r.orden, mes: r.mes, cono: r.serie });
        const o = by.get(k);
        if (r.cuadro === 52) Object.assign(o, { ingreso_mensual: r.v0, ingreso_mensual_var_pct: r.var_pct, ingreso_mensual_ref: r.ref0, sig_mensual: r.significancia });
        if (r.cuadro === 55) Object.assign(o, { ingreso_hora: r.v0, ingreso_hora_var_pct: r.var_pct, sig_hora: r.significancia });
        if (r.cuadro === 47) Object.assign(o, { ingresos_totales: r.v0, participacion: r.participacion, ingresos_totales_var_pct: r.var_pct, sig_totales: r.significancia });
      });
      return [...by.values()];
    }
  });

(function () {
  // ---------- Utilidades ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const f1 = d3.format(',.1f'), f2 = d3.format(',.2f'), s1 = d3.format('+,.1f'), s2 = d3.format('+,.2f'), f0 = d3.format(',.0f');
  const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
  const MESL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const LATEST = '2026-09';
  const ym = (mes) => [Number(mes.slice(0, 4)), Number(mes.slice(5, 7))];
  const toDate = (mes) => { const [y, m] = ym(mes); return new Date(Date.UTC(y, m - 1, 15)); };
  const shift = (mes, k) => { const [y, m] = ym(mes); const t = y * 12 + m - 1 + k; return Math.floor(t / 12) + '-' + String((t % 12) + 1).padStart(2, '0'); };
  function trim(mes, long) {
    const [y, m] = ym(mes); const ps = [];
    for (let k = 2; k >= 0; k--) { let mm = m - k, yy = y; if (mm < 1) { mm += 12; yy--; } ps.push([mm, yy]); }
    const N = long ? MESL : MES;
    if (ps[0][1] === ps[2][1]) return ps.map((p) => N[p[0] - 1]).join('-') + ' ' + y;
    return ps.map((p) => N[p[0] - 1] + ' ' + p[1]).join('-');
  }
  const anioMovil = (mes) => { const s = shift(mes, -11); const [y0, m0] = ym(s), [y1, m1] = ym(mes); return MES[m0 - 1] + ' ' + y0 + '–' + MES[m1 - 1] + ' ' + y1; };
  const trimShort = (mes) => { const [y, m] = ym(mes); return MES[m - 1] + ' ' + String(y).slice(2); };
  const status = (...ids) => { const s = ids.map((i) => dash.data(i).status); if (s.every((x) => x === 'ok')) return 'ok'; if (s.some((x) => x === 'error' || x === 'missing' || x === 'declined')) return 'error'; return 'loading'; };
  const setErr = (el) => { el.replaceChildren(); el.classList.remove('dash-skeleton'); const d = document.createElement('div'); d.className = 'lm-err'; d.textContent = 'Failed to load'; el.append(d); };
  const colors = () => dash.colors;
  const curMes = () => dash.params().mes || LATEST;

  // índice de cuadro_var
  let cvRef = null, CV = new Map(), CVC = new Map();
  function cv() {
    const d = dash.data('cuadro_var');
    if (d.status !== 'ok') return null;
    if (d.data !== cvRef) {
      cvRef = d.data; CV = new Map(); CVC = new Map();
      d.data.forEach((r) => { CV.set(r.id, r); const k = r.cuadro + '|' + r.mes; if (!CVC.has(k)) CVC.set(k, []); CVC.get(k).push(r); });
      CVC.forEach((a) => a.sort((x, y) => x.orden - y.orden));
    }
    return CV;
  }
  let anRef = null, AN = new Map();
  function anexo() {
    const d = dash.data('epen_anexo');
    if (d.status !== 'ok') return null;
    if (d.data !== anRef) { anRef = d.data; AN = new Map(); d.data.forEach((r) => { const k = r.cuadro + '|' + r.orden; if (!AN.has(k)) AN.set(k, []); AN.get(k).push(r); }); }
    return AN;
  }
  const cuadroMeta = (n) => { const d = dash.data('epen_cuadros'); return d.status === 'ok' ? d.data.find((c) => Number(c.cuadro) === n) : null; };

  // ---------- Gráfico de líneas genérico ----------
  function lineChart(el, series, o = {}) {
    el.replaceChildren(); el.classList.remove('dash-skeleton');
    const W = Math.max(280, el.clientWidth || 600), H = o.height || (el.classList.contains('lm-tall') ? 300 : 240);
    const vis = series.filter((s) => !s.hidden && s.values.length);
    if (!vis.length) return;
    const all = vis.flatMap((s) => s.values.filter((p) => p.v != null));
    const xs = d3.extent(all, (p) => p.d);
    let ylo = d3.min(all, (p) => p.v), yhi = d3.max(all, (p) => p.v);
    if (o.band) { ylo = Math.min(ylo, o.band.lo); yhi = Math.max(yhi, o.band.hi); }
    if (o.zero) ylo = Math.min(0, ylo);
    const pad = (yhi - ylo) * 0.08 || 1;
    const y0 = o.zero ? ylo : (ylo >= 0 && ylo - pad < 0 ? 0 : ylo - pad);
    const y = d3.scaleLinear([y0, yhi + pad], [H - 26, 10]).nice(5);
    const yf = o.yf || f1;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', o.label || 'Gráfico');
    const ticks = y.ticks(5);
    const meas = svg.append('text').text(ticks.map(yf).reduce((a, b) => (a.length > b.length ? a : b), ''));
    const ml = Math.ceil(meas.node().getComputedTextLength()) + 10; meas.remove();
    const mr = o.bandLabel ? 70 : 14;
    const x = d3.scaleUtc(xs, [ml, W - mr]);
    const g = svg.append('g');
    g.selectAll('line.gr').data(ticks).join('line').attr('x1', ml).attr('x2', W - mr).attr('y1', y).attr('y2', y).attr('stroke', 'var(--cds-chart-grid)').attr('stroke-width', 1);
    g.selectAll('text.yt').data(ticks).join('text').attr('x', ml - 8).attr('y', (d) => y(d) + 4).attr('text-anchor', 'end').text(yf);
    if (o.zero) g.append('line').attr('x1', ml).attr('x2', W - mr).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'var(--cds-chart-axis)');
    const span = (xs[1] - xs[0]) / (365.25 * 864e5);
    const step = span > 16 ? 4 : span > 8 ? 2 : 1;
    const xt = d3.utcYear.range(d3.utcYear.ceil(xs[0]), xs[1]).filter((d) => d.getUTCFullYear() % step === 0);
    const xax = svg.append('g').attr('transform', `translate(0,${H - 26})`).call(d3.axisBottom(x).tickValues(xt).tickFormat(d3.utcFormat('%Y')).tickSizeOuter(0));
    xax.attr('font-size', null).attr('font-family', null); xax.select('.domain').attr('stroke', 'var(--cds-chart-axis)'); xax.selectAll('line').attr('stroke', 'var(--cds-chart-axis)');
    (o.breaks || []).filter((b) => b.d >= xs[0] && b.d <= xs[1]).forEach((b) => {
      svg.append('line').attr('x1', x(b.d)).attr('x2', x(b.d)).attr('y1', 10).attr('y2', H - 26).attr('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '3 3');
    });
    if (o.mark && o.mark >= xs[0] && o.mark <= xs[1]) svg.append('line').attr('x1', x(o.mark)).attr('x2', x(o.mark)).attr('y1', 10).attr('y2', H - 26).attr('stroke', 'var(--cds-chart-axis)').attr('stroke-width', 1);
    if (o.areaFirst) {
      const id = 'gr' + Math.random().toString(36).slice(2, 8);
      const lg = svg.append('defs').append('linearGradient').attr('id', id).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
      [[0, .26], [.25, .16], [.5, .08], [.75, .03], [1, 0]].forEach(([of, op]) => lg.append('stop').attr('offset', of).attr('style', `stop-color:${vis[0].color};stop-opacity:${op}`));
      svg.append('path').datum(vis[0].values.filter((p) => p.v != null)).attr('fill', `url(#${id})`).attr('d', d3.area().x((p) => x(p.d)).y0(H - 26).y1((p) => y(p.v)));
    }
    const line = d3.line().defined((p) => p.v != null).x((p) => x(p.d)).y((p) => y(p.v));
    vis.forEach((s) => svg.append('path').datum(s.values).attr('fill', 'none').style('stroke', s.color).attr('stroke-width', s.width || 2).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round').attr('d', line));
    vis.forEach((s) => { const pts = s.values.filter((p) => p.ref && p.v != null); svg.selectAll(null).data(pts).join('circle').attr('cx', (p) => x(p.d)).attr('cy', (p) => y(p.v)).attr('r', 2.5).style('fill', 'var(--color-panel)').style('stroke', s.color); });
    if (o.band && o.band.d >= xs[0] && o.band.d <= xs[1]) {
      const bx = x(o.band.d), b = svg.append('g').attr('stroke', 'var(--color-fg-muted)');
      b.append('line').attr('x1', bx).attr('x2', bx).attr('y1', y(o.band.hi)).attr('y2', y(o.band.lo));
      [o.band.hi, o.band.lo].forEach((v) => b.append('line').attr('x1', bx - 5).attr('x2', bx + 5).attr('y1', y(v)).attr('y2', y(v)));
      svg.append('text').attr('x', bx + 8).attr('y', y(o.band.hi) + 4).text('L.S. ' + yf(o.band.hi));
      svg.append('text').attr('x', bx + 8).attr('y', y(o.band.lo) + 4).text('L.I. ' + yf(o.band.lo));
    }
    if (o.endLabel) vis.forEach((s) => { const last = [...s.values].reverse().find((p) => p.v != null); if (last) svg.append('circle').attr('cx', x(last.d)).attr('cy', y(last.v)).attr('r', 3.5).style('fill', s.color); });
    // tooltip
    const tip = document.createElement('div'); tip.className = 'lm-tip'; tip.hidden = true; el.append(tip);
    const dates = [...new Set(all.map((p) => +p.d))].sort((a, b) => a - b).map((t) => new Date(t));
    const dot = svg.append('g').attr('pointer-events', 'none');
    const rule = svg.append('line').attr('y1', 10).attr('y2', H - 26).attr('stroke', 'var(--cds-chart-axis)').attr('opacity', 0);
    svg.append('rect').attr('x', ml).attr('y', 0).attr('width', Math.max(0, W - mr - ml)).attr('height', H - 26).attr('fill', 'transparent')
      .on('mousemove', (ev) => {
        const [mx] = d3.pointer(ev); const t = x.invert(mx); const i = d3.bisector((d) => d).center(dates, t); const d = dates[i];
        rule.attr('x1', x(d)).attr('x2', x(d)).attr('opacity', 1); dot.selectAll('*').remove();
        tip.replaceChildren(); const h = document.createElement('div'); h.className = 'lm-tip-h'; h.textContent = o.dateLabel ? o.dateLabel(d) : trim(d3.utcFormat('%Y-%m')(d)); tip.append(h);
        vis.forEach((s) => { const p = s.values.find((q) => +q.d === +d); if (!p || p.v == null) return; dot.append('circle').attr('cx', x(d)).attr('cy', y(p.v)).attr('r', 4).style('fill', s.color);
          const row = document.createElement('div'); if (vis.length > 1) { const sw = document.createElement('span'); sw.className = 'lm-sw'; sw.style.background = s.color; row.append(sw); }
          row.append((vis.length > 1 ? s.name + ': ' : '') + (o.tf || yf)(p.v) + (p.ref ? ' a/' : '')); tip.append(row); });
        tip.hidden = false; const tw = tip.offsetWidth; let lx = (x(d) / W) * el.clientWidth + 12; if (lx + tw > el.clientWidth) lx = (x(d) / W) * el.clientWidth - tw - 12; tip.style.left = Math.max(0, lx) + 'px'; tip.style.top = '6px';
      })
      .on('mouseleave', () => { tip.hidden = true; rule.attr('opacity', 0); dot.selectAll('*').remove(); });
  }

  function legend(el, series, onToggle) {
    if (!el) return;
    el.replaceChildren();
    series.forEach((s) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'lm-chip'; b.setAttribute('aria-pressed', String(!s.hidden));
      const i = document.createElement('i'); i.style.background = s.color; b.append(i, s.name);
      b.addEventListener('click', () => onToggle(s.key)); el.append(b);
    });
  }
  const hiddenState = {};
  function toggler(group, keys, defHidden = []) {
    if (!hiddenState[group]) hiddenState[group] = new Set(defHidden);
    const H = hiddenState[group];
    return { isHidden: (k) => H.has(k), toggle: (k) => { if (H.has(k)) H.delete(k); else if (keys.filter((x) => !H.has(x)).length > 1) H.add(k); render(); } };
  }
  const rangeState = {};
  function rangeButtons(el, group, opts, def) {
    if (!rangeState[group]) rangeState[group] = def;
    el.replaceChildren();
    opts.forEach(([lab, v]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'lm-chip'; b.textContent = lab; b.setAttribute('aria-pressed', String(rangeState[group] === v)); b.addEventListener('click', () => { rangeState[group] = v; render(); }); el.append(b); });
    return rangeState[group];
  }

  // Barras de variación (estilo Gráficos 02, 06, 07, 08)
  function varBars(el, rows, unit) {
    el.replaceChildren();
    const vals = rows.filter((r) => r.value != null);
    if (!vals.length) { const p = document.createElement('p'); p.className = 'lm-note'; p.textContent = 'Sin dato del mismo trimestre del año anterior para comparar.'; el.append(p); return; }
    const mx = Math.max(...vals.map((r) => Math.abs(r.value)), 0.1);
    const neg = vals.some((r) => r.value < 0), pos = vals.some((r) => r.value > 0);
    const z = neg && pos ? 0.5 : neg ? 1 : 0;
    const box = document.createElement('div'); box.className = 'lm-vbars';
    rows.forEach((r, i) => {
      const row = document.createElement('div'); row.className = 'lm-vrow';
      const l = document.createElement('span'); l.textContent = r.label; l.title = r.label;
      const t = document.createElement('div'); t.className = 'lm-vtrack';
      const zr = document.createElement('div'); zr.className = 'lm-vzero'; zr.style.left = (z * 100) + '%'; t.append(zr);
      if (r.value != null) {
        const f = document.createElement('div'); f.className = 'lm-vfill';
        const w = (Math.abs(r.value) / mx) * (neg && pos ? 50 : 100);
        f.style.width = w + '%'; f.style.left = (r.value >= 0 ? z * 100 : z * 100 - w) + '%';
        f.style.background = i === 0 && r.total ? 'var(--cds-chart-muted)' : colors()[r.value >= 0 ? 0 : 3];
        t.append(f);
      }
      const v = document.createElement('span'); v.className = 'lm-vval';
      v.textContent = r.value == null ? '' : (unit === 'pp' ? s1(r.value) + ' pp' : unit === 'h' ? s1(r.value) + ' h' : s1(r.value) + '%');
      if (r.sig) { const sg = document.createElement('span'); sg.className = 'lm-sig'; sg.textContent = r.sig; v.append(sg); }
      row.append(l, t, v); box.append(row);
    });
    el.append(box);
  }

  // ---------- Explorador de cuadros ----------
  const EXPL = {
    poblacion: [1, 2, 3, 4, 5, 17, 18],
    ocupados: [8, 9, 10, 13, 11, 12, 15, 14, 19, 21, 22, 23],
    niveles: [7, 6, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37],
    desempleo: [40, 38, 41, 43, 42, 39],
    ingresos: [48, 49, 50, 51, 52, 53, 54, 55, 45, 46, 47]
  };
  const TEMA = { pet: 'Condición de actividad', pea: 'PEA', nopea: 'No PEA', ocu: 'Población ocupada', horas: 'Horas trabajadas', niveles: 'Niveles de empleo', adec: 'Empleo adecuado', subv: 'Subempleo por horas (visible)', subi: 'Subempleo por ingresos (invisible)', des: 'Población desempleada', td: 'Tasa de desempleo', ing: 'Ingreso promedio mensual', inghora: 'Ingreso promedio por hora', ingtot: 'Ingresos totales (año móvil)' };
  const explSel = {};

  function buildExplorer(host, tab) {
    host.replaceChildren();
    const card = document.createElement('article'); card.className = 'lm-card'; card.id = 'cuadros-' + tab;
    const bar = document.createElement('div'); bar.className = 'lm-explorer-bar';
    const lab = document.createElement('label'); lab.textContent = 'Cuadro del anexo'; lab.htmlFor = 'sel-' + tab;
    const sel = document.createElement('select'); sel.className = 'lm-sel'; sel.id = 'sel-' + tab; sel.setAttribute('data-source', 'epen_cuadros');
    bar.append(lab, sel);
    const eb = document.createElement('p'); eb.className = 'lm-eyebrow';
    const h = document.createElement('h3');
    const note = document.createElement('p'); note.className = 'lm-note';
    const tw = document.createElement('div'); tw.className = 'lm-tablewrap';
    const two = document.createElement('div'); two.className = 'lm-two';
    const fa = document.createElement('div'); const fah = document.createElement('p'); fah.className = 'lm-sub-h'; const fab = document.createElement('div'); fab.setAttribute('data-source', 'cuadro_var'); fab.className = 'lm-varbars'; fa.append(fah, fab);
    const fb = document.createElement('div'); const fbh = document.createElement('p'); fbh.className = 'lm-sub-h'; fbh.textContent = 'Evolución por período, 2021–2026'; const lg = document.createElement('div'); lg.className = 'lm-legend'; const ch = document.createElement('div'); ch.className = 'lm-chart'; ch.setAttribute('data-source', 'epen_anexo'); fb.append(fbh, lg, ch);
    two.append(fa, fb);
    const foot = document.createElement('p'); foot.className = 'lm-foot';
    card.append(bar, eb, h, note, tw, two, foot);
    host.append(card);
    sel.addEventListener('change', () => { explSel[tab] = Number(sel.value); render(); });
    host._p = { sel, eb, h, note, tw, fah, fab, lg, ch, foot, built: false };
  }

  function drawExplorer(host, tab) {
    if (!host._p) buildExplorer(host, tab);
    const P = host._p;
    const st = status('cuadro_var', 'epen_cuadros', 'epen_anexo');
    if (st === 'error') { setErr(P.tw); return; }
    if (st !== 'ok') { P.tw.classList.add('dash-skeleton'); return; }
    P.tw.classList.remove('dash-skeleton');
    const list = EXPL[tab]; const metas = dash.data('epen_cuadros').data;
    if (!P.built) {
      P.sel.replaceChildren(); const groups = new Map();
      list.forEach((n) => { const m = metas.find((c) => Number(c.cuadro) === n); if (!m) return; if (!groups.has(m.tema)) { const og = document.createElement('optgroup'); og.label = TEMA[m.tema] || m.tema; groups.set(m.tema, og); P.sel.append(og); } groups.get(m.tema).append(new Option('N° ' + n + ' · ' + m.desagregacion, String(n))); });
      P.built = true;
    }
    const n = explSel[tab] || list[0]; P.sel.value = String(n);
    const meta = metas.find((c) => Number(c.cuadro) === n);
    const mes = curMes(); cv();
    const rows = CVC.get(n + '|' + mes) || [];
    const movil = meta.periodo === 'Año móvil';
    const per = movil ? anioMovil(mes) : trim(mes, true);
    P.eb.textContent = 'Anexo estadístico · Cuadro N° ' + n;
    P.h.textContent = 'Lima Metropolitana: ' + meta.titulo; P.h.setAttribute('data-source', 'epen_cuadros'); P.h.setAttribute('data-field', 'titulo'); P.h.setAttribute('data-where', 'cuadro=' + n);
    const isTasa = meta.tipo === 'tasa', isAbsH = meta.var_tipo === 'abs', mixto = meta.tipo === 'mixto';
    P.note.textContent = (movil ? 'Año móvil: ' : 'Trimestre móvil: ') + per + ' · (' + meta.unidad + (isTasa ? ', variación en puntos porcentuales)' : isAbsH ? ', variación en horas)' : ', variación absoluta y porcentual)');
    // tabla
    const [y0] = ym(mes);
    const fmt = (n >= 53 && n <= 55) ? f2 : f1, sfmt = (n >= 53 && n <= 55) ? s2 : s1;
    const tb = document.createElement('table'); tb.className = 'lm-table'; tb.setAttribute('data-source', 'cuadro_var'); tb.setAttribute('data-row-key', 'id');
    const th = tb.createTHead();
    const g1 = th.insertRow(); g1.className = 'lm-grp';
    const c0 = document.createElement('th'); c0.rowSpan = 2; c0.textContent = meta.desagregacion; c0.setAttribute('data-field', 'serie'); g1.append(c0);
    const cy = document.createElement('th'); cy.colSpan = 4; cy.textContent = (movil ? 'Año móvil terminado en ' : 'Trimestre móvil: ') + (movil ? MES[ym(mes)[1] - 1] : trim(mes, true).replace(/ \d{4}$/, '').replace(/ \d{4}/g, '')); g1.append(cy);
    const showShare = rows.some((r) => r.participacion != null);
    const cvh = document.createElement('th'); cvh.colSpan = isTasa || mixto || isAbsH ? 1 : 2; cvh.textContent = 'Variación ' + y0 + '/' + (y0 - 1); g1.append(cvh);
    if (showShare) { const cs = document.createElement('th'); cs.rowSpan = 2; cs.textContent = 'Estructura ' + y0 + ' (%)'; cs.setAttribute('data-field', 'participacion'); g1.append(cs); }
    const g2 = th.insertRow();
    ['v3', 'v2', 'v1', 'v0'].forEach((k, i) => { const c = document.createElement('th'); c.textContent = movil ? String(y0 - 3 + i) : String(y0 - 3 + i); c.setAttribute('data-field', k); g2.append(c); });
    if (isTasa || mixto || isAbsH) { const c = document.createElement('th'); c.textContent = isTasa ? 'Puntos porcentuales' : isAbsH ? 'En horas' : 'Absoluta'; c.setAttribute('data-field', 'var_abs'); g2.append(c); }
    else { const a = document.createElement('th'); a.textContent = meta.unidad.startsWith('Miles') ? 'En miles' : meta.unidad.startsWith('Soles') ? 'En soles' : meta.unidad.startsWith('Millones') ? 'En millones' : 'Absoluta'; a.setAttribute('data-field', 'var_abs'); const b = document.createElement('th'); b.textContent = '(%)'; b.setAttribute('data-field', 'var_pct'); g2.append(a, b); }
    const body = tb.createTBody();
    rows.forEach((r) => {
      const tr = body.insertRow(); tr.dataset.key = r.id;
      if (r.orden === 0 && r.serie.startsWith('Total')) tr.className = 'lm-total';
      else if (/: /.test(r.serie) || (n === 12 && r.orden >= 2 && r.orden <= 6)) tr.className = 'lm-sub';
      const tdS = tr.insertCell(); tdS.textContent = r.serie;
      [['v3', 'ref3'], ['v2', 'ref2'], ['v1', 'ref1'], ['v0', 'ref0']].forEach(([k, rf]) => { const td = tr.insertCell(); td.textContent = r[k] == null ? '' : fmt(r[k]); if (r[rf]) td.classList.add('lm-ref'); if (k === 'v0') td.classList.add('lm-cur'); });
      const sigTxt = mes === LATEST && r.significancia ? r.significancia : '';
      if (isTasa || mixto || isAbsH) {
        const td = tr.insertCell(); td.textContent = r.var_abs == null ? '' : (mixto && r.var_tipo === 'pct' ? sfmt(r.var_abs) + ' (' + s1(r.v1 ? (r.v0 / r.v1 - 1) * 100 : 0) + '%)' : sfmt(r.var_abs));
        if (sigTxt) { const s = document.createElement('span'); s.className = 'lm-sig'; s.textContent = sigTxt; td.append(s); }
      } else {
        const a = tr.insertCell(); a.textContent = r.var_abs == null ? '' : sfmt(r.var_abs);
        const b = tr.insertCell(); b.textContent = r.var_pct == null ? '' : s1(r.var_pct);
        if (sigTxt) { const s = document.createElement('span'); s.className = 'lm-sig'; s.textContent = sigTxt; b.append(s); }
      }
      if (showShare) { const c = tr.insertCell(); c.textContent = r.participacion == null ? '' : f1(r.participacion); }
    });
    P.tw.replaceChildren(tb);
    // barras de variación
    const unit = isTasa ? 'pp' : isAbsH ? 'h' : 'pct';
    P.fah.textContent = (isTasa ? 'Variación en puntos porcentuales, ' : isAbsH ? 'Variación en horas, ' : 'Variación porcentual, ') + (movil ? anioMovil(mes) + ' / año anterior' : trim(mes) + ' / ' + trim(shift(mes, -12)));
    const vr = rows.filter((r) => !(mixto && r.var_tipo !== 'pct') || true).map((r) => ({ label: r.serie, total: r.orden === 0 && r.serie.startsWith('Total'), value: unit === 'pct' ? (mixto && r.var_tipo === 'pp' ? null : (r.var_pct != null ? r.var_pct : (mixto && r.v1 ? Math.round((r.v0 / r.v1 - 1) * 1000) / 10 : null))) : r.var_abs, sig: mes === LATEST ? r.significancia : '' }));
    varBars(P.fab, mixto ? vr.filter((r) => r.value != null) : vr, unit);
    // evolución
    const A = anexo(); const C = colors();
    const keys = rows.map((r) => String(r.orden));
    const defHidden = (meta.tipo === 'nivel' && rows.length > 2 && rows[0] && rows[0].serie.startsWith('Total')) ? ['0'] : (mixto ? ['1'] : []);
    const tg = toggler('ex' + n, keys, defHidden);
    const ser = rows.map((r, i) => ({ key: String(r.orden), name: r.serie, color: C[i % C.length], hidden: tg.isHidden(String(r.orden)), values: (A.get(n + '|' + r.orden) || []).map((p) => ({ d: toDate(p.mes), v: p.valor, ref: p.referencial })) }));
    legend(P.lg, ser, tg.toggle);
    lineChart(P.ch, ser, { mark: toDate(mes), yf: (n >= 53 && n <= 55) ? f2 : (meta.unidad.startsWith('Soles') || meta.unidad.startsWith('Millones') ? f0 : f1), tf: fmt, dateLabel: movil ? (d) => anioMovil(d3.utcFormat('%Y-%m')(d)) : null, label: meta.titulo });
    const notes = [];
    if (rows.some((r) => r.ref0 || r.ref1 || r.ref2 || r.ref3)) notes.push('a/ Resultado referencial: el número de casos en la muestra no es suficiente y el coeficiente de variación es mayor al 15%.');
    if ([2, 3, 5, 9, 18, 25, 30, 35, 42, 43, 46, 49, 54].includes(n)) notes.push('Primaria incluye inicial y sin nivel.');
    if ([10, 21, 23, 26, 31, 36, 50].includes(n)) notes.push('Los totales incluyen otras actividades.');
    if (mes === LATEST) notes.push('+ diferencia significativa al 10%, ++ al 5%, +++ al 1% respecto a similar período del año anterior.');
    else notes.push('Las pruebas de diferencia (+) solo se publican para el trimestre del informe, Jul-Ago-Set 2026.');
    if (n === 17 || n === 18) notes.push('Según sus cifras, la tasa neta de participación del anexo equivale a ocupados / PET.');
    notes.push('Fuente: INEI – Encuesta Permanente de Empleo Nacional (EPEN). 2021: Encuesta Permanente de Empleo (EPE).');
    P.foot.textContent = notes.join(' ');
  }

  // ---------- Bloques del panorama (con filtro de sexo) ----------
  function mk(tag, text, attrs) { const e = document.createElement(tag); if (text != null) e.textContent = text; if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); return e; }
  const SEXOS = [['Total', 'Total'], ['Hombre', 'Hombres'], ['Mujer', 'Mujeres']];
  const curSexo = () => dash.params().sexo || 'Total';
  const sexoTxt = (s) => (s === 'Total' ? '' : s === 'Hombre' ? ' — hombres' : ' — mujeres');
  function sexoControl() {
    const el = $('#sexo-sel'); el.replaceChildren(); const s = curSexo();
    SEXOS.forEach(([v, l]) => { const b = mk('button', l, { type: 'button', class: 'lm-chip', 'aria-pressed': String(s === v) }); b.addEventListener('click', () => dash.setParams({ sexo: v })); el.append(b); });
  }
  function pan(sexo, mes) {
    const d = dash.data('panorama_sexo'); if (d.status !== 'ok') return null;
    return d.data.find((r) => r.id === sexo + '-' + mes) || null;
  }
  const pm = (r, field, text) => mk('span', text, { 'data-source': 'panorama_sexo', 'data-field': field, 'data-where': 'id=' + r.id });

  function fillTiles() {
    const mes = curMes(), sexo = curSexo(); const st = status('panorama_sexo');
    const r = pan(sexo, mes);
    $$('#lm-tiles .lm-tile').forEach((t) => {
      const vEl = $('.lm-tile-v', t), dEl = $('.lm-tile-d', t);
      if (st === 'error') { vEl.classList.remove('dash-skeleton'); vEl.textContent = '—'; dEl.textContent = ''; return; }
      if (st !== 'ok') return;
      vEl.classList.remove('dash-skeleton');
      const f = t.dataset.t, fv = t.dataset.v;
      if (!r || r[f] == null) { vEl.removeAttribute('data-source'); vEl.textContent = '—'; dEl.textContent = ''; return; }
      vEl.setAttribute('data-source', 'panorama_sexo'); vEl.setAttribute('data-field', f); vEl.setAttribute('data-where', 'id=' + r.id);
      vEl.textContent = f1(r[f]) + (t.dataset.suf || '');
      dEl.replaceChildren(); const v = r[fv];
      if (v == null) { dEl.className = 'lm-tile-d lm-neutral'; dEl.textContent = 'Sin comparación interanual'; return; }
      const good = t.dataset.good === 'up' ? v > 0 : v < 0;
      dEl.className = 'lm-tile-d ' + (v === 0 ? 'lm-neutral' : good ? 'lm-good' : 'lm-badv');
      dEl.append(v > 0 ? '▲ ' : v < 0 ? '▼ ' : '', pm(r, fv, s1(v)), t.dataset.unit + ' vs. ' + trim(shift(mes, -12)));
      const sg = t.dataset.sg && mes === LATEST ? r[t.dataset.sg] : '';
      if (sg) dEl.append(mk('span', sg, { class: 'lm-sig' }));
    });
    const extra = sexo === 'Total' ? '' : ' Por sexo, las tasas de empleo adecuado, subempleo y actividad se calculan sobre la PEA de cada sexo (cuadros 2, 4, 24 y 34); las pruebas de significancia solo se muestran donde el informe las publica.';
    $('#lm-tile-note').textContent = 'Trimestre móvil ' + trim(mes, true) + (sexo === 'Total' ? '' : ', ' + (sexo === 'Hombre' ? 'hombres' : 'mujeres')) + '. Variación respecto a similar trimestre móvil del año anterior; en tasas, en puntos porcentuales (pp).' + (mes === LATEST ? ' + significativa al 10%, ++ al 5%, +++ al 1%.' : '') + extra;
  }

  function takeaway() {
    const el = $('#lm-take'); const mes = curMes();
    if (status('panorama_sexo') === 'error') { el.textContent = ''; return; }
    const r = pan('Total', mes); if (!r) return;
    const ob = mk('b'); ob.append(pm(r, 'ocupados', f1(r.ocupados)));
    el.replaceChildren('En el trimestre móvil ' + trim(mes, true) + ', Lima Metropolitana tuvo ', ob, ' mil personas ocupadas');
    if (r.ocupados_var_pct != null) el.append(' (', pm(r, 'ocupados_var_pct', s1(r.ocupados_var_pct)), '% frente a igual trimestre del año anterior)');
    const tb = mk('b'); tb.append(pm(r, 'tasa_desempleo', f1(r.tasa_desempleo)), '%');
    el.append(' y una tasa de desempleo de ', tb);
    if (r.tasa_desempleo_var_pp != null) el.append(', ', pm(r, 'tasa_desempleo_var_pp', s1(r.tasa_desempleo_var_pp)), ' puntos porcentuales respecto a un año antes');
    if (r.ingreso != null && r.ingreso_var_pct != null) el.append('. El ingreso promedio mensual fue S/ ', pm(r, 'ingreso', f1(r.ingreso)), ' (', pm(r, 'ingreso_var_pct', s1(r.ingreso_var_pct)), '%)');
    el.append('.');
  }

  function petStack(el) {
    const mes = curMes(), sexo = curSexo(); const st = status('panorama_sexo');
    if (st === 'error') return setErr(el); if (st !== 'ok') { el.classList.add('dash-skeleton'); el.style.minHeight = '120px'; return; }
    el.classList.remove('dash-skeleton'); el.style.minHeight = '';
    $('#h-condicion').textContent = 'Población en edad de trabajar según condición de actividad' + sexoTxt(sexo);
    const r = pan(sexo, mes); if (!r) return;
    const K = colors();
    const parts = [['PEA ocupada', 'ocupados', 'ocupados_var_pct', 'tasa_ocupacion', 'de la PEA', K[0]], ['PEA desocupada', 'desocupados', 'desocupados_var_pct', 'tasa_desempleo', 'de la PEA', K[3]], ['No PEA', 'no_pea', 'no_pea_var_pct', 'no_pea_pct_pet', 'de la PET', 'var(--cds-chart-muted)']];
    el.replaceChildren();
    const top = mk('p', null, { class: 'lm-note' });
    const b1 = mk('b'); b1.append(pm(r, 'pet', f1(r.pet))); const b2 = mk('b'); b2.append(pm(r, 'pea', f1(r.pea)));
    top.append('PET: ', b1, ' miles · PEA: ', b2, ' miles (', pm(r, 'tasa_actividad', f1(r.tasa_actividad)), '% de la PET)');
    const bar = mk('div', null, { class: 'lm-stack', role: 'img', 'aria-label': 'Composición de la PET' });
    parts.forEach(([n, f, , , , c]) => { const d = document.createElement('div'); d.style.flex = String(r[f]); d.style.background = c; d.title = n; bar.append(d); });
    const lg = mk('div', null, { class: 'lm-stack-legend' });
    parts.forEach(([n, f, fv, fs, txt, c]) => {
      const d = document.createElement('div'); const t = document.createElement('span'); const sw = mk('i', null, { class: 'lm-sw2' }); sw.style.background = c; t.append(sw, n);
      const b = mk('b'); b.append(pm(r, f, f1(r[f])));
      const sh = document.createElement('span'); sh.append(pm(r, fs, f1(r[fs])), '% ' + txt);
      if (r[fv] != null) sh.append(' · ', pm(r, fv, s1(r[fv])), '% anual');
      d.append(t, b, sh); lg.append(d);
    });
    el.append(top, bar, lg);
  }

  function waffle(el, sexo) {
    const mes = curMes(); const st = status('panorama_sexo');
    if (st === 'error') return setErr(el); if (st !== 'ok') { el.classList.add('dash-skeleton'); el.style.minHeight = '200px'; return; }
    el.classList.remove('dash-skeleton'); el.style.minHeight = '';
    const r = pan(sexo, mes); if (!r) return; const K = colors();
    const cats = [['tasa_adecuado', 'tienen empleo adecuado', K[0]], ['tasa_subempleo_visible', 'están subempleados por horas (visible)', K[1]], ['tasa_subempleo_ingresos', 'están subempleados por ingresos (invisible)', K[2]], ['tasa_desempleo', 'buscan trabajo activamente (desocupados)', K[3]]].map(([f, l, c]) => ({ f, l, c, v: r[f] }));
    if (cats.some((x) => x.v == null)) return;
    const fl = cats.map((x) => Math.floor(x.v)); let rest = 100 - d3.sum(fl);
    cats.map((x, i) => [x.v - fl[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { fl[i]++; rest--; } });
    el.replaceChildren();
    const wrap = mk('div', null, { class: 'lm-waffle-wrap' });
    const w = mk('div', null, { class: 'lm-waffle', role: 'img', 'aria-label': 'Cien personas de la PEA según nivel de empleo' });
    cats.forEach((x, i) => { for (let j = 0; j < fl[i]; j++) { const s = document.createElement('span'); s.style.background = x.c; w.append(s); } });
    const ul = mk('ul', null, { class: 'lm-wlist' });
    cats.forEach((x, i) => { const li = document.createElement('li'); const b = mk('b', String(fl[i])); b.style.color = x.c; const t = document.createElement('span'); t.append(x.l + ' (tasa: ', pm(r, x.f, f1(x.v)), '%)'); li.append(b, t); ul.append(li); });
    wrap.append(w, ul); el.append(wrap);
  }

  const BREAKS = [{ d: toDate('2017-01') }, { d: toDate('2018-01') }, { d: toDate('2022-10') }];
  function seriesRows() { return dash.data('series_lima').status === 'ok' ? dash.data('series_lima').data : null; }
  function seriesOf(rows, field, from) { return rows.filter((r) => (!from || r.mes >= from)).map((r) => ({ d: toDate(r.mes), v: r[field] == null ? null : Number(r[field]) })); }
  function dest(ind) { const d = dash.data('epen_destacados'); if (d.status !== 'ok') return null; const r = d.data.find((x) => x.indicador === ind); return r ? Number(r.valor) : null; }

  function chartG01() {
    const el = $('#ch-g01'); const st = status('series_lima');
    if (st === 'error') return setErr(el); if (st !== 'ok') { el.classList.add('dash-skeleton'); return; }
    const mes = curMes(), sexo = curSexo(); const R = seriesRows(); const K = colors();
    $('#h-g01').textContent = 'Evolución de la población ocupada, 2022–2026' + sexoTxt(sexo);
    const f = sexo === 'Total' ? 'ocupados' : sexo === 'Hombre' ? 'ocupados_hombre' : 'ocupados_mujer';
    const band = sexo === 'Total' && mes === LATEST && dest('ocupados_ls') != null ? { d: toDate(LATEST), lo: dest('ocupados_li'), hi: dest('ocupados_ls') } : null;
    lineChart(el, [{ key: 'o', name: 'Población ocupada', color: K[0], values: seriesOf(R, f, '2022-03') }], { band, bandLabel: !!band, mark: toDate(mes), areaFirst: true, endLabel: true, label: 'Población ocupada' });
  }
  function chartG13() {
    const el = $('#ch-g13'); const st = status('series_lima');
    if (st === 'error') return setErr(el); if (st !== 'ok') { el.classList.add('dash-skeleton'); return; }
    const mes = curMes(), sexo = curSexo(); const R = seriesRows(); const K = colors();
    $('#h-g13').textContent = 'Evolución de la tasa de desempleo, 2022–2026' + sexoTxt(sexo);
    const f = sexo === 'Total' ? 'tasa_desempleo' : sexo === 'Hombre' ? 'tasa_desempleo_hombre' : 'tasa_desempleo_mujer';
    const band = sexo === 'Total' && mes === LATEST && dest('desempleo_ls') != null ? { d: toDate(LATEST), lo: dest('desempleo_li'), hi: dest('desempleo_ls') } : null;
    lineChart(el, [{ key: 't', name: 'Tasa de desempleo', color: K[3], values: seriesOf(R, f, '2022-03') }], { band, bandLabel: !!band, mark: toDate(mes), endLabel: true, yf: (v) => f1(v) + '%', label: 'Tasa de desempleo' });
  }

  // ---------- Comparativo por conos ----------
  function conosCard() {
    const mes = curMes(); const st = status('conos');
    const bars = $('#bars-conos'), tbw = $('#tb-conos');
    if (st === 'error') { setErr(bars); return; }
    if (st !== 'ok') { bars.classList.add('dash-skeleton'); bars.style.minHeight = '180px'; return; }
    bars.classList.remove('dash-skeleton'); bars.style.minHeight = '';
    const rows = dash.data('conos').data.filter((r) => r.mes === mes).sort((a, b) => a.orden - b.orden);
    const tot = rows.find((r) => r.orden === 0); const cs = rows.filter((r) => r.orden > 0);
    $('#n-conos').textContent = 'Trimestre móvil ' + trim(mes, true) + ' (ingreso mensual y por hora) y año móvil ' + anioMovil(mes) + ' (ingresos totales). Variación respecto a similar período del año anterior.';
    const K = colors(); const mx = d3.max(rows, (r) => r.ingreso_mensual) || 1;
    bars.replaceChildren();
    [...cs].sort((a, b) => b.ingreso_mensual - a.ingreso_mensual).concat(tot ? [tot] : []).forEach((r) => {
      const row = mk('div', null, { class: 'lm-cbar' });
      const tr = mk('div', null, { class: 'lm-cbar-track' });
      const fill = mk('div', null, { class: 'lm-cbar-fill' }); fill.style.width = (r.ingreso_mensual / mx) * 100 + '%'; fill.style.background = r.orden === 0 ? 'var(--cds-chart-muted)' : K[0];
      tr.append(fill);
      if (tot && r.orden !== 0) { const ref = mk('div', null, { class: 'lm-cbar-ref' }); ref.style.left = (tot.ingreso_mensual / mx) * 100 + '%'; tr.append(ref); }
      const val = mk('span'); val.append('S/ ', mk('span', f1(r.ingreso_mensual), { 'data-source': 'conos', 'data-field': 'ingreso_mensual', 'data-where': 'id=' + r.id }));
      row.append(mk('span', r.cono), tr, val); bars.append(row);
    });
    bars.append(mk('p', 'La línea discontinua marca el promedio de Lima Metropolitana.', { class: 'lm-note' }));
    // tabla
    const sigOn = mes === LATEST;
    const tb = mk('table', null, { class: 'lm-table', 'data-source': 'conos', 'data-row-key': 'id' });
    const th = tb.createTHead(); const h1 = th.insertRow(); h1.className = 'lm-grp';
    h1.append(mk('th', 'Cono', { rowspan: '2', 'data-field': 'cono' }), mk('th', 'Ingreso promedio mensual', { colspan: '2' }), mk('th', 'Ingreso por hora', { colspan: '2' }), mk('th', 'Ingresos totales, año móvil', { colspan: '3' }));
    const h2 = th.insertRow();
    h2.append(mk('th', 'Soles', { 'data-field': 'ingreso_mensual' }), mk('th', 'Var. %', { 'data-field': 'ingreso_mensual_var_pct' }), mk('th', 'Soles', { 'data-field': 'ingreso_hora' }), mk('th', 'Var. %', { 'data-field': 'ingreso_hora_var_pct' }), mk('th', 'Millones de soles', { 'data-field': 'ingresos_totales' }), mk('th', 'Estructura %', { 'data-field': 'participacion' }), mk('th', 'Var. %', { 'data-field': 'ingresos_totales_var_pct' }));
    const body = tb.createTBody();
    rows.forEach((r) => {
      const t = body.insertRow(); t.dataset.key = r.id; if (r.orden === 0) t.className = 'lm-total';
      const cell = (txt, sg, ref) => { const c = t.insertCell(); c.textContent = txt; if (ref) c.classList.add('lm-ref'); if (sg && sigOn) c.append(mk('span', sg, { class: 'lm-sig' })); };
      cell(r.cono);
      cell(r.ingreso_mensual == null ? '' : f1(r.ingreso_mensual), null, r.ingreso_mensual_ref);
      cell(r.ingreso_mensual_var_pct == null ? '' : s1(r.ingreso_mensual_var_pct), r.sig_mensual);
      cell(r.ingreso_hora == null ? '' : f2(r.ingreso_hora));
      cell(r.ingreso_hora_var_pct == null ? '' : s1(r.ingreso_hora_var_pct), r.sig_hora);
      cell(r.ingresos_totales == null ? '' : f1(r.ingresos_totales));
      cell(r.participacion == null ? '' : f1(r.participacion));
      cell(r.ingresos_totales_var_pct == null ? '' : s1(r.ingresos_totales_var_pct), r.sig_totales);
    });
    tbw.replaceChildren(tb);
    multiFromAnexo('conos', 52, [0, 1, 2, 3, 4, 5], $('#ch-conos'), $('#lg-conos'), { yf: f0, tf: f1, label: 'Ingreso promedio mensual por cono' });
  }

  function chartG03() {
    const el = $('#ch-g03'); const st = status('series_var');
    if (st === 'error') return setErr(el); if (st !== 'ok') { el.classList.add('dash-skeleton'); return; }
    el.replaceChildren(); el.classList.remove('dash-skeleton');
    const mes = curMes(); const rows = dash.data('series_var').data.filter((r) => r.mes >= '2022-03' && r.ocupados_var_pct != null);
    const W = Math.max(280, el.clientWidth || 600), H = 240, K = colors();
    const y = d3.scaleLinear([Math.min(0, d3.min(rows, (r) => r.ocupados_var_pct)), d3.max(rows, (r) => r.ocupados_var_pct)], [H - 26, 12]).nice(5);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Variación porcentual de la población ocupada');
    const ticks = y.ticks(5); const ml = 34;
    const x = d3.scaleBand(rows.map((r) => r.mes), [ml, W - 8]).padding(0.25);
    svg.selectAll('line.g').data(ticks).join('line').attr('x1', ml).attr('x2', W - 8).attr('y1', y).attr('y2', y).attr('stroke', 'var(--cds-chart-grid)');
    svg.selectAll('text.t').data(ticks).join('text').attr('x', ml - 6).attr('y', (d) => y(d) + 4).attr('text-anchor', 'end').text((d) => f1(d));
    svg.selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.mes)).attr('width', x.bandwidth()).attr('y', (r) => y(Math.max(0, r.ocupados_var_pct))).attr('height', (r) => Math.abs(y(r.ocupados_var_pct) - y(0))).attr('rx', Math.min(3, x.bandwidth() / 2)).style('fill', (r) => (r.mes === mes ? K[0] : 'var(--cds-chart-muted)'));
    svg.append('line').attr('x1', ml).attr('x2', W - 8).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'var(--cds-chart-axis)');
    svg.selectAll('text.x').data(rows.filter((r) => r.mes.endsWith('-01'))).join('text').attr('x', (r) => x(r.mes)).attr('y', H - 8).text((r) => r.mes.slice(0, 4));
    const tip = mk('div', null, { class: 'lm-tip' }); tip.hidden = true; el.append(tip);
    svg.selectAll('rect').on('mousemove', (ev, r) => { tip.replaceChildren(mk('div', trim(r.mes), { class: 'lm-tip-h' }), mk('div', s1(r.ocupados_var_pct) + '% · ' + f1(r.ocupados) + ' miles')); tip.hidden = false; const px = ((x(r.mes) / W) * el.clientWidth); tip.style.left = Math.min(px + 10, el.clientWidth - tip.offsetWidth) + 'px'; tip.style.top = '4px'; }).on('mouseleave', () => { tip.hidden = true; });
  }

  function multiFromSeries(group, defs, el, lgEl, from, opts = {}) {
    const st = status('series_lima'); if (st === 'error') return setErr(el); if (st !== 'ok') { el.classList.add('dash-skeleton'); return; }
    const R = seriesRows(); const K = colors();
    const tg = toggler(group, defs.map((d) => d[0]), opts.defHidden || []);
    const ser = defs.map(([f, n], i) => ({ key: f, name: n, color: K[i % K.length], hidden: tg.isHidden(f), values: seriesOf(R, f, from) }));
    legend(lgEl, ser, tg.toggle);
    lineChart(el, ser, Object.assign({ breaks: BREAKS, mark: toDate(curMes()) }, opts));
  }
  function multiFromAnexo(group, cuadro, ordenes, el, lgEl, opts = {}) {
    const st = status('epen_anexo'); if (st === 'error') return setErr(el); if (st !== 'ok') { el.classList.add('dash-skeleton'); return; }
    const A = anexo(); const K = colors();
    const tg = toggler(group, ordenes.map(String));
    const ser = ordenes.map((o, i) => { const v = A.get(cuadro + '|' + o) || []; return { key: String(o), name: opts.names ? opts.names[i] : (v[0] ? v[0].serie : ''), color: K[(opts.cOff || 0) + i], hidden: tg.isHidden(String(o)), values: v.map((p) => ({ d: toDate(p.mes), v: p.valor, ref: p.referencial })) }; });
    legend(lgEl, ser, tg.toggle);
    lineChart(el, ser, Object.assign({ mark: toDate(curMes()) }, opts));
  }

  function brecha() {
    const el = $('#brecha-txt'); const st = status('brecha_ingreso'); const mes = curMes();
    if (st !== 'ok') return;
    const r = dash.data('brecha_ingreso').data.find((x) => x.mes === mes); if (!r) return;
    el.replaceChildren('En ' + trim(mes) + ' el ingreso de las mujeres equivale al ', mk('b', f1(r.brecha_pct) + '%', { 'data-source': 'brecha_ingreso', 'data-field': 'brecha_pct', 'data-where': 'mes=' + mes }), ' del de los hombres (S/ ', mk('span', f1(r.ingreso_mujer), { 'data-source': 'brecha_ingreso', 'data-field': 'ingreso_mujer', 'data-where': 'mes=' + mes }), ' frente a S/ ', mk('span', f1(r.ingreso_hombre), { 'data-source': 'brecha_ingreso', 'data-field': 'ingreso_hombre', 'data-where': 'mes=' + mes }), ').');
  }
  function masaTxt() {
    const b = $('#masa-txt b'); const st = status('epen_destacados');
    if (st === 'error') { b.classList.remove('dash-skeleton'); b.textContent = '—'; return; }
    if (st !== 'ok') return; b.classList.remove('dash-skeleton'); const v = dest('masa_salarial_var'); b.textContent = v == null ? '—' : s1(v) + '%';
  }
  function muestra() {
    const el = $('#def-muestra'); if (status('epen_destacados') !== 'ok') return;
    const sp = (ind, txt) => mk('span', txt, { 'data-source': 'epen_destacados', 'data-field': 'valor', 'data-where': 'indicador=' + ind });
    el.replaceChildren('En el trimestre del informe la EPEN para la Provincia de Lima y la Provincia Constitucional del Callao tuvo una muestra de ', sp('muestra_viviendas', f0(dest('muestra_viviendas'))), ' viviendas particulares (', sp('muestra_mensual', f0(dest('muestra_mensual'))), ' por mes) distribuidas en ', sp('conglomerados', f0(dest('conglomerados'))), ' conglomerados. Desde enero de 2022 la EPEN retomó las entrevistas con visitas domiciliarias.');
  }

  // Series históricas
  const HIST = [
    ['Población', [['pet', 'Población en edad de trabajar (PET)', 'Miles de personas'], ['pea', 'Población económicamente activa (PEA)', 'Miles de personas'], ['no_pea', 'Población económicamente no activa', 'Miles de personas'], ['ocupados', 'Población ocupada', 'Miles de personas'], ['desocupados', 'Población desocupada', 'Miles de personas']]],
    ['Tasas', [['tasa_actividad', 'Tasa de actividad', 'Porcentaje de la PET'], ['tasa_ocupacion', 'Tasa de ocupación', 'Porcentaje de la PEA'], ['tasa_desempleo', 'Tasa de desempleo', 'Porcentaje de la PEA']]],
    ['Niveles de empleo', [['adecuadamente_empleados', 'Adecuadamente empleados', 'Miles de personas'], ['subempleados', 'Subempleados (total)', 'Miles de personas'], ['subempleo_visible', 'Subempleo por horas (visible)', 'Miles de personas'], ['subempleo_invisible', 'Subempleo por ingresos (invisible)', 'Miles de personas']]],
    ['Horas e ingresos', [['horas_promedio', 'Promedio de horas trabajadas por semana', 'Horas'], ['masa_salarial', 'Masa salarial', 'Millones de soles'], ['ingreso_promedio_hogar', 'Ingreso promedio por hogar', 'Soles'], ['ingreso_percapita', 'Ingreso per cápita', 'Soles']]]
  ];
  const HISTFLAT = HIST.flatMap(([g, a]) => a);
  let histSel = 'tasa_desempleo';
  const hsel = $('#lm-hist');
  HIST.forEach(([g, a]) => { const og = document.createElement('optgroup'); og.label = g; a.forEach(([k, l]) => og.append(new Option(l, k))); hsel.append(og); });
  hsel.addEventListener('change', () => { histSel = hsel.value; render(); });
  function historicas() {
    hsel.value = histSel;
    const def = HISTFLAT.find((h) => h[0] === histSel);
    $('#hist-title').textContent = 'Lima Metropolitana: ' + def[1];
    const rg = rangeButtons($('#rg-hist'), 'hist', [['2001–2026', '2001-01'], ['2012–2026', '2012-01'], ['2021–2026', '2021-01']], '2001-01');
    const el = $('#ch-hist'); const st = status('series_lima');
    if (st === 'error') return setErr(el); if (st !== 'ok') { el.classList.add('dash-skeleton'); return; }
    const R = seriesRows(); const K = colors();
    const withData = R.filter((r) => r[histSel] != null && r.mes >= rg);
    const last = withData[withData.length - 1], first = withData[0];
    const pct = def[2].startsWith('Porcentaje');
    $('#hist-note').textContent = def[2] + ' por trimestre móvil. Desde ' + trim(first.mes) + ' hasta ' + trim(last.mes) + '.';
    const fields = histSel === 'tasa_desempleo' ? [['tasa_desempleo', 'Total'], ['tasa_desempleo_hombre', 'Hombre'], ['tasa_desempleo_mujer', 'Mujer']]
      : histSel === 'tasa_actividad' ? [['tasa_actividad', 'Total'], ['tasa_actividad_hombre', 'Hombre'], ['tasa_actividad_mujer', 'Mujer']]
      : histSel === 'masa_salarial' ? [['masa_salarial', 'Total'], ['masa_salarial_dependientes', 'Dependientes'], ['masa_salarial_independientes', 'Independientes']]
      : histSel === 'ocupados' ? [['ocupados', 'Total'], ['ocupados_hombre', 'Hombre'], ['ocupados_mujer', 'Mujer']]
      : histSel === 'pea' ? [['pea', 'Total'], ['pea_hombre', 'Hombre'], ['pea_mujer', 'Mujer']]
      : [[histSel, def[1]]];
    const tg = toggler('h-' + histSel, fields.map((f) => f[0]));
    const ser = fields.map(([f, n], i) => ({ key: f, name: n, color: K[i], hidden: tg.isHidden(f), values: seriesOf(R, f, rg) }));
    legend($('#lg-hist'), fields.length > 1 ? ser : [], tg.toggle);
    lineChart(el, ser, { breaks: BREAKS, mark: toDate(curMes()), yf: pct ? (v) => f1(v) + '%' : def[2] === 'Horas' ? f1 : f0, tf: pct ? (v) => f1(v) + '%' : f1, areaFirst: fields.length === 1, label: def[1] });
  }

  // ---------- Selector de período ----------
  const msel = $('#lm-mes');
  msel.addEventListener('change', () => dash.setParams({ mes: msel.value }));
  function fillPeriods() {
    if (status('epen_anexo') !== 'ok') return;
    if (!msel.options.length) {
      const ms = [...new Set(dash.data('epen_anexo').data.map((r) => r.mes))].sort().reverse();
      const groups = new Map();
      ms.forEach((m) => { const y = m.slice(0, 4); if (!groups.has(y)) { const og = document.createElement('optgroup'); og.label = y; groups.set(y, og); msel.append(og); } groups.get(y).append(new Option(trim(m, true) + (m === LATEST ? ' (informe)' : ''), m)); });
    }
    msel.value = curMes();
  }

  // ---------- Pestañas ----------
  let tab = 'panorama';
  const tabs = $$('.lm-tab');
  function showTab(t, push) {
    tab = t; tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== t; });
    if (push) dash.setLink(t);
    render();
  }
  tabs.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab, true)));

  function render() {
    fillPeriods(); takeaway();
    if (tab === 'panorama') { sexoControl(); fillTiles(); petStack($('#pet-stack')); waffle($('#waffle-pan'), curSexo()); $('#h-cada100').textContent = 'De cada 100 personas de la PEA' + sexoTxt(curSexo()); chartG01(); chartG13(); }
    if (tab === 'poblacion') { multiFromSeries('act', [['tasa_actividad', 'Total'], ['tasa_actividad_hombre', 'Hombre'], ['tasa_actividad_mujer', 'Mujer'], ['tasa_actividad_14_24', '14 a 24 años'], ['tasa_actividad_25_44', '25 a 44 años'], ['tasa_actividad_45_mas', '45 y más años']], $('#ch-actividad'), $('#lg-actividad'), null, { yf: (v) => f1(v) + '%', defHidden: ['tasa_actividad_14_24', 'tasa_actividad_25_44', 'tasa_actividad_45_mas'], label: 'Tasa de actividad' }); }
    if (tab === 'ocupados') chartG03();
    if (tab === 'niveles') { waffle($('#waffle-niv'), 'Total'); multiFromAnexo('niv', 6, [1, 2, 3, 4], $('#ch-niv'), $('#lg-niv'), { yf: (v) => f1(v) + '%', label: 'Tasas de niveles de empleo' }); }
    if (tab === 'desempleo') { const rg = rangeButtons($('#rg-td'), 'td', [['2001–2026', '2001-01'], ['2012–2026', '2012-01'], ['2021–2026', '2021-01']], '2012-01'); multiFromSeries('td', [['tasa_desempleo', 'Total'], ['tasa_desempleo_hombre', 'Hombre'], ['tasa_desempleo_mujer', 'Mujer'], ['tasa_desempleo_14_24', '14 a 24 años'], ['tasa_desempleo_25_44', '25 a 44 años'], ['tasa_desempleo_45_mas', '45 y más años']], $('#ch-td'), $('#lg-td'), rg, { yf: (v) => f1(v) + '%', defHidden: ['tasa_desempleo_25_44', 'tasa_desempleo_45_mas'], label: 'Tasa de desempleo por grupos' }); }
    if (tab === 'ingresos') { brecha(); masaTxt(); conosCard(); multiFromAnexo('ing', 48, [0, 1, 2], $('#ch-ing'), $('#lg-ing'), { yf: f0, tf: f1, label: 'Ingreso promedio mensual por sexo' }); multiFromSeries('masa', [['masa_salarial', 'Total'], ['masa_salarial_dependientes', 'Dependientes'], ['masa_salarial_independientes', 'Independientes']], $('#ch-masa'), $('#lg-masa'), '2012-01', { yf: f0, tf: f1, breaks: [{ d: toDate('2022-10') }], label: 'Masa salarial' }); }
    if (tab === 'historicas') historicas();
    if (tab === 'definiciones') muestra();
    const host = $(`[data-explorer="${tab}"]`); if (host) drawExplorer(host, tab);
  }

  // estado inicial
  const startHash = location.hash.slice(1);
  const valid = tabs.map((b) => b.dataset.tab);
  showTab(valid.includes(startHash) ? startHash : 'panorama', false);
  dash.onData(render);
})();
