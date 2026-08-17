import { NOTAS, elegirCancion, vueloMinimo, G } from './_sinrampa.js';
const MIRA = 0.05;
for (const id of ['esfera','aurora','viaje']) {
  elegirCancion(id);
  console.log(`\n=== ${id}: saltos IMPOSIBLES (vuelo minimo > tiempo disponible) ===`);
  let n0 = 0;
  for (let i = 0; i < NOTAS.length - 1; i++) {
    const n = NOTAS[i], sig = NOTAS[i+1];
    if (n.silencio || sig.silencio || n.escalera || n.ligada) continue;
    const t = sig.x0 + MIRA - (n.riel ? n.x1 : n.xm);
    const tv = vueloMinimo(sig.y - n.y);
    const margen = t - tv;
    if (margen > 0.12) continue;
    n0++;
    console.log(`  b=${n.b} ${n.nombre}${n.bajo?'!':''}(y ${n.y.toFixed(3)}) -> ${sig.nombre}${sig.bajo?'!':''}(y ${sig.y.toFixed(3)})  dy=${(sig.y-n.y).toFixed(3)} necesita=${tv.toFixed(3)} tiene=${t.toFixed(3)} MARGEN=${margen.toFixed(3)}${margen<0?'  ← IMPOSIBLE':''}`);
  }
  if (!n0) console.log('  (ninguno)');
}
