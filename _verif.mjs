import { elegirCancion, NOTAS, vueloMinimo } from './_sinrampa.js';
elegirCancion('viaje');
const malas = NOTAS.filter((k,i) => {
  const sig = NOTAS[i+1];
  if (k.silencio || !sig || sig.silencio || k.escalera || k.riel || k.ligada) return false;
  return sig.xm - k.xm - vueloMinimo(sig.y - k.y) < 0.05;
});
console.log('SIN la rampa, saltos que no llegan a tiempo:', malas.length);
for (const k of malas) console.log(`  ${k.nombre}${k.bajo?'!':''}@${k.b}  sobra ${(NOTAS[k.i+1].xm-k.xm-vueloMinimo(NOTAS[k.i+1].y-k.y)).toFixed(3)}`);
