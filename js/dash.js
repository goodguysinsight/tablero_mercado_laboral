/*
 * dash.js — capa mínima de datos para el tablero (versión autónoma para GitHub Pages).
 * Expone window.dash con la misma interfaz que usa js/app.js:
 *   dash.data(id), dash.onData(fn), dash.calc(id, {inputs, fn}), dash.params(),
 *   dash.setParams(obj), dash.resetParams(), dash.setLink(name), dash.colors
 * Los datasets se leen de la carpeta data/ con fetch().
 */
(function () {
  'use strict';
  var DATASETS = {
    epen_anexo: 'data/epen_anexo.json',
    epen_cuadros: 'data/epen_cuadros.json',
    epen_pruebas: 'data/epen_pruebas.json',
    epen_destacados: 'data/epen_informe_destacados.json',
    series_lima: 'data/series_lima_2001_2026.json'
  };
  var DEFAULT_PARAMS = { mes: '2026-09', sexo: 'Total' };

  var store = {};
  var calcs = {};
  var callbacks = [];
  var params = Object.assign({}, DEFAULT_PARAMS);
  var pending = false;

  function fire() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      callbacks.forEach(function (fn) {
        try { fn(); } catch (e) { console.error('[dash] onData:', e); }
      });
    });
  }

  function load(id) {
    if (store[id]) return;
    store[id] = { status: 'loading', data: [], columns: [] };
    fetch(DATASETS[id], { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        var rows = Array.isArray(d) ? d : (d.rows || d.data || d.results || []);
        store[id] = { status: 'ok', data: rows, columns: rows.length ? Object.keys(rows[0]) : [] };
        fire();
      })
      .catch(function (e) {
        store[id] = { status: 'error', data: [], columns: [], message: String(e) };
        console.error('[dash] No se pudo cargar ' + id + ':', e);
        fire();
      });
  }

  function data(id) {
    if (calcs[id]) return calcData(id);
    if (!DATASETS[id]) return { status: 'missing', data: [], columns: [] };
    load(id);
    return store[id];
  }

  function calcData(id) {
    var c = calcs[id];
    var inputs = c.inputs.map(function (i) { return data(i); });
    var bad = inputs.find(function (x) { return x.status === 'error' || x.status === 'missing'; });
    if (bad) return { status: 'error', data: [], columns: [], message: 'Entrada no disponible' };
    if (inputs.some(function (x) { return x.status !== 'ok'; })) return { status: 'loading', data: [], columns: [] };
    var refs = inputs.map(function (x) { return x.data; });
    var same = c.refs && c.refs.length === refs.length && c.refs.every(function (r, i) { return r === refs[i]; });
    if (!same) {
      try {
        var out = c.fn.apply(null, refs);
        c.result = { status: 'ok', data: out, columns: Array.isArray(out) && out.length ? Object.keys(out[0]) : [] };
      } catch (e) {
        console.error('[dash] Cálculo ' + id + ':', e);
        c.result = { status: 'error', data: [], columns: [], message: String(e) };
      }
      c.refs = refs;
    }
    return c.result;
  }

  var colorVars = ['--serie-1', '--serie-2', '--serie-3', '--serie-4', '--serie-5', '--serie-6', '--serie-7', '--serie-8'];

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fire, 150);
  });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', fire);
  }

  window.dash = {
    data: data,
    onData: function (fn) { callbacks.push(fn); try { fn(); } catch (e) { console.error(e); } },
    calc: function (id, def) { calcs[id] = { inputs: def.inputs || [], fn: def.fn, title: def.title, description: def.description }; },
    loader: function () {},
    refresh: function () {},
    params: function () { return Object.assign({}, params); },
    setParams: function (obj) { Object.assign(params, obj); fire(); },
    resetParams: function () { params = Object.assign({}, DEFAULT_PARAMS); fire(); },
    setLink: function (name) { try { history.replaceState(null, '', '#' + name); } catch (e) { /* sin historial */ } },
    colors: colorVars.map(function (v) { return 'var(' + v + ')'; })
  };
})();
