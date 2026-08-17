import { crearSim, paso, tocar, elegirCancion, NOTAS, TOTAL_NOTAS, LARGO, TECHOS, SPB, AFINADO } from './juego.js';
const DT = 1/240;
const enBeats = ms => ms/1000/SPB;
for (const id of ['aurora','viaje']) {
  elegirCancion(id);
  const fallos = new Map();
  const offs = [];
  for (let ms = -120; ms <= 120; ms += 20) offs.push(ms);
  for (const ms of offs) {
    const off = enBeats(ms);
    const objetivos = NOTAS.filter(n => !n.silencio && !n.porCaida).map(n => n.xm + off);
    let j = 0;
    const s = crearSim();
    for (let b = 0; b < LARGO + 2 && s.viva && !s.meta; b += DT) {
      if (s.estado === 'apoyada' && s.tecla < 0 && s.x - s.ultimoToque > 0.35 &&
          !TECHOS.some(t => s.x > t.x0 - 0.8 && s.x < t.x1)) { tocar(s, b); paso(s, DT); continue; }
      const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
      s.sostiene = !!(k && k.riel);
      while (j < objetivos.length && s.x >= objetivos[j]) { tocar(s, b); j++; }
      paso(s, DT);
    }
    for (const n of NOTAS) {
      if (n.silencio || s.tocadas.has(n.i)) continue;
      if (!fallos.has(n.i)) fallos.set(n.i, []);
      fallos.get(n.i).push(ms);
    }
    if (!s.meta) console.log(`  ${id} ${ms>0?'+':''}${ms}ms: MURIO en x=${s.x.toFixed(1)} (${s.causa})`);
  }
  const duras = [...fallos.entries()].filter(([, v]) => v.length >= 4).sort((a,b) => b[1].length - a[1].length);
  console.log(`\n=== ${id}: notas que se pierden en 4+ de los ${offs.length} desfases ===`);
  for (const [i, v] of duras.slice(0, 14)) {
    const n = NOTAS[i], ant = NOTAS[i-1];
    console.log(`  b=${n.b} ${n.nombre}${n.bajo?'!':''}  falla en ${v.length}/${offs.length} [${v.join(' ')}]` +
      (ant && !ant.silencio ? `   <- de ${ant.nombre}${ant.bajo?'!':''} dy=${(n.y-ant.y).toFixed(3)}` : '  <- tras silencio'));
  }
  if (!duras.length) console.log('  (ninguna)');
}
