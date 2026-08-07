#!/usr/bin/env node
/**
 * Recorrido sintético para verificar el motor de cálculo sin subirse al carro.
 *
 * Alimenta al `TripEngine` con lecturas de GPS generadas a partir de física
 * conocida (velocidad, aceleración y desnivel exactos) y comprueba que lo que
 * devuelve coincide con el valor teórico. Cubre lo que es difícil de probar
 * conduciendo: deriva del GPS con el carro parado, lecturas basura y tiempos
 * de aceleración con margen de décimas.
 *
 *   npm run test:engine
 */
const path = require('path');
const Module = require('module');
const BUILD = path.join(__dirname, '..', '.sim-build');

// Resuelve los alias "@/..." de los módulos compilados.
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request.startsWith('@/')) request = path.join(BUILD, request.slice(2));
  return origResolve.call(this, request, ...args);
};

const { TripEngine } = require(path.join(BUILD, 'services/tripEngine.js'));
const { POLO_TRACK_2026, estimateGearAndRpm, kmhPer1000Rpm } = require(path.join(BUILD, 'vehicles/polo.js'));
const { simplify } = require(path.join(BUILD, 'utils/geo.js'));

const M_PER_DEG_LAT = 111132;
const T0 = 1700000000000;
let failures = 0;

function check(name, actual, expected, tol) {
  const ok = Math.abs(actual - expected) <= tol;
  if (!ok) failures++;
  const a = typeof actual === 'number' ? actual.toFixed(2) : actual;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name.padEnd(40)} = ${String(a).padStart(9)}  (esperado ${expected} ±${tol})`);
}

/** Genera lecturas moviéndose hacia el norte desde una latitud base. */
function makeFix(tSec, northM, speedMs, altitude, accuracy = 5) {
  return {
    latitude: -0.18 + northM / M_PER_DEG_LAT,
    longitude: -78.47,
    altitude,
    accuracy,
    altitudeAccuracy: 3,
    speed: speedMs,
    heading: 0,
    timestamp: T0 + tSec * 1000,
  };
}

// ---------------------------------------------------------------- 1. crucero
{
  console.log('\n— Crucero constante a 100 km/h durante 60 s —');
  const e = new TripEngine(POLO_TRACK_2026, T0);
  const v = 100 / 3.6;
  for (let t = 0; t <= 60; t++) e.ingest(makeFix(t, v * t, v, 2800));
  const s = e.stats(T0 + 60000);
  check('distancia (m)', s.distanceM, v * 60, 5);
  check('velocidad actual (km/h)', s.speedKmh, 100, 0.1);
  check('velocidad máxima (km/h)', s.maxSpeedKmh, 100, 0.1);
  check('media total (km/h)', s.avgSpeedKmh, 100, 1);
  check('tiempo detenido (ms)', s.stoppedMs, 0, 1);
  check('desnivel acumulado (m)', s.elevGain + s.elevLoss, 0, 0.5);
}

// ---------------------------------------------------------------- 2. arrancada
{
  console.log('\n— Arrancada: parado 5 s, luego 2.60 m/s² constante —');
  const e = new TripEngine(POLO_TRACK_2026, T0);
  const a = 2.6;
  let dist = 0;
  for (let t = 0; t < 5; t++) e.ingest(makeFix(t, 0, 0, 2800));
  for (let i = 0; i <= 130; i++) {
    const t = 5 + i * 0.5;
    const dt = i === 0 ? 0 : 0.5;
    const v = a * (t - 5);
    dist += (a * (t - 5) - a * 0.5) * dt > 0 ? (v - (a * dt) / 2) * dt : 0;
    e.ingest(makeFix(t, dist, v, 2800));
  }
  const s = e.stats(T0 + 70000);
  const teorico0_100 = 100 / 3.6 / a;
  const teorico0_60 = 60 / 3.6 / a;
  check('0-100 km/h (s)', s.perf.t0_100, teorico0_100, 0.15);
  check('0-60 km/h (s)', s.perf.t0_60, teorico0_60, 0.15);
  check('60-100 km/h (s)', s.perf.t60_100, teorico0_100 - teorico0_60, 0.2);
}

// ---------------------------------------------------------------- 3. desnivel
{
  console.log('\n— Subida de 100 m y bajada de 100 m (con ruido de ±1,5 m) —');
  const e = new TripEngine(POLO_TRACK_2026, T0);
  const v = 60 / 3.6;
  let t = 0;
  const noise = (i) => Math.sin(i * 2.3) * 1.5;
  for (let i = 0; i <= 100; i++, t++) e.ingest(makeFix(t, v * t, v, 2800 + i + noise(i)));
  for (let i = 0; i <= 100; i++, t++) e.ingest(makeFix(t, v * t, v, 2900 - i + noise(i)));
  const s = e.stats(T0 + t * 1000);
  check('ascenso acumulado (m)', s.elevGain, 100, 12);
  check('descenso acumulado (m)', s.elevLoss, 100, 12);
  check('altitud mínima (m)', s.minAlt, 2800, 3);
  check('altitud máxima (m)', s.maxAlt, 2900, 3);
}

// ---------------------------------------------------------------- 4. deriva
{
  console.log('\n— Carro detenido 5 min con deriva de GPS —');
  const e = new TripEngine(POLO_TRACK_2026, T0);
  for (let t = 0; t <= 300; t++) {
    const drift = Math.sin(t * 0.7) * 4 + Math.cos(t * 1.9) * 3; // ±7 m
    e.ingest(makeFix(t, drift, 0, 2800 + Math.sin(t) * 2, 8));
  }
  const s = e.stats(T0 + 300000);
  check('distancia acumulada (m)', s.distanceM, 0, 1);
  check('desnivel falso (m)', s.elevGain + s.elevLoss, 0, 1);
  check('tiempo detenido (s)', s.stoppedMs / 1000, 300, 1);
}

// ---------------------------------------------------------------- 5. saltos
{
  console.log('\n— Rechazo de lecturas basura —');
  const e = new TripEngine(POLO_TRACK_2026, T0);
  const v = 80 / 3.6;
  e.ingest(makeFix(0, 0, v, 2800));
  const impreciso = e.ingest(makeFix(1, v, v, 2800, 120));       // precisión 120 m
  const salto = e.ingest(makeFix(2, 100000, v, 2800, 5));        // teletransporte
  const bueno = e.ingest(makeFix(2, v * 2, v, 2800, 5));
  check('lectura imprecisa rechazada', impreciso ? 1 : 0, 0, 0);
  check('salto imposible rechazado', salto ? 1 : 0, 0, 0);
  check('lectura válida aceptada', bueno ? 1 : 0, 1, 0);
}

// ---------------------------------------------------------------- 6. frenada
{
  console.log('\n— Frenada de 120 km/h hasta 0 a 8 m/s² —');
  const e = new TripEngine(POLO_TRACK_2026, T0);
  const v0 = 120 / 3.6;
  const dec = 8;
  let dist = 0;
  for (let i = 0; i <= 20; i++) e.ingest(makeFix(i * 0.5, (dist += v0 * 0.5), v0, 2800));
  const tFrenada = v0 / dec;
  for (let i = 1; i * 0.2 <= tFrenada + 1; i++) {
    const dt = i * 0.2;
    const v = Math.max(0, v0 - dec * dt);
    dist += v * 0.2;
    e.ingest(makeFix(10 + dt, dist, v, 2800));
  }
  const s = e.stats(T0 + 25000);
  check('100-0 km/h (s)', s.perf.t100_0, 100 / 3.6 / dec, 0.25);
}

// ---------------------------------------------------------------- 7. varios
{
  console.log('\n— Utilidades —');
  const pts = [];
  for (let i = 0; i < 500; i++) {
    pts.push({ latitude: -0.18 + i * 0.00001, longitude: -78.47 + Math.sin(i / 40) * 0.0002 });
  }
  const reduced = simplify(pts, 4);
  check('simplify reduce puntos', reduced.length < pts.length ? 1 : 0, 1, 0);
  check('simplify conserva extremos', reduced[0] === pts[0] && reduced[reduced.length - 1] === pts[pts.length - 1] ? 1 : 0, 1, 0);

  const g5 = kmhPer1000Rpm(POLO_TRACK_2026, 4);
  check('5a marcha km/h por 1000 rpm', g5, 47, 12);
  const est = estimateGearAndRpm(POLO_TRACK_2026, 100);
  console.log(`      a 100 km/h -> ${est.gear}a marcha, ${Math.round(est.rpm)} rpm`);
  check('rpm plausibles a 100 km/h', est.rpm, 2600, 900);
}

console.log(failures === 0 ? '\nTodas las comprobaciones pasaron.' : `\n${failures} comprobaciones fallaron.`);
process.exit(failures === 0 ? 0 : 1);
