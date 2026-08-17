// Diagnostico: que teclas son IMPOSIBLES (ventana nula o casi) y donde muere
// la mano humana. Reproduce las manos de prueba.js sin sus asserts.
import {
  crearSim, paso, tocar, soltar, vueloMinimo, elegirCancion,
  NOTAS, TOTAL_NOTAS, LARGO, HUECOS, TECHOS, SUELTA, G, SPB, ORBES, PISTONES, AFINADO, ANTES
} from './juego.js';

const DT = 1 / 240;
const id = process.argv[2] || 'viaje';
elegirCancion(id);

// 1. VENTANAS: ancho de cada tecla y si el pulso (xm) cae adentro
console.log(`\n=== ${id}: ventanas sospechosas ===`);
let malas = 0;
for (const n of NOTAS) {
  if (n.silencio) continue;
  const ancho = n.x1 - n.x0;
  const pulsoDentro = n.xm >= n.x0 - 1e-9 && n.xm <= n.x1 + 1e-9;
  if (ancho > 0.14 && pulsoDentro) continue;
  malas++;
  console.log(`  #${n.i} ${n.nombre}${n.bajo ? '!' : ''} b=${n.b} x0=${n.x0.toFixed(3)} xm=${n.xm.toFixed(3)} x1=${n.x1.toFixed(3)} ancho=${ancho.toFixed(3)}` +
    `${pulsoDentro ? '' : '  ← EL PULSO QUEDA FUERA'}${n.riel ? ' riel' : ''}${n.escalera ? ' escalera' : ''}${n.ligada ? ' ligada' : ''}`);
}
console.log(`  (${malas} sospechosas de ${TOTAL_NOTAS})`);

// 2. la mano perfecta, y que notas se le escapan
const rescata = (s, b) => {
  if (s.estado !== 'apoyada' || s.tecla >= 0) return false;
  if (s.x - s.ultimoToque < 0.35) return true;
  if (TECHOS.some(t => s.x > t.x0 - 0.8 && s.x < t.x1)) return true;
  tocar(s, b); return true;
};
const perfecta = (s, b) => {
  if (rescata(s, b)) return;
  const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
  if (!k) return;
  s.sostiene = !!k.riel;
  if (k.riel && s.tocadas.has(k.i) && ORBES.some(o => Math.abs(o.x - s.x) < 0.5 && o.y > k.y + 0.05)) {
    if (s.sostiene) { s.sostiene = false; return; }
  }
  if (!s.tocadas.has(k.i) && s.x >= k.xm - 0.01) tocar(s, b);
};
const jugar = mano => {
  const s = crearSim();
  for (let b = 0; b < LARGO + 2 && s.viva && !s.meta; b += DT) { mano(s, b); paso(s, DT); }
  return s;
};
const rp = jugar(perfecta);
console.log(`\n=== mano simple: x=${rp.x.toFixed(2)} viva=${rp.viva} meta=${rp.meta} causa=${rp.causa} · ${rp.limpias.size}/${TOTAL_NOTAS} limpias ===`);
const perdidas = NOTAS.filter(n => !n.silencio && !rp.tocadas.has(n.i));
for (const n of perdidas.slice(0, 20)) {
  const ant = NOTAS[n.i - 1], sig = NOTAS[n.i + 1];
  console.log(`  PERDIDA #${n.i} ${n.nombre}${n.bajo ? '!' : ''} b=${n.b} y=${n.y.toFixed(3)} ventana=[${n.x0.toFixed(3)},${n.x1.toFixed(3)}] ancho=${(n.x1 - n.x0).toFixed(3)}` +
    (ant && !ant.silencio ? `  <- viene de ${ant.nombre}${ant.bajo ? '!' : ''} y=${ant.y.toFixed(3)} x1=${ant.x1.toFixed(3)} dy=${(n.y - ant.y).toFixed(3)} vuelo=${vueloMinimo(n.y - ant.y).toFixed(3)} tiempo=${(n.x0 - ant.xm).toFixed(3)}` : ''));
}
