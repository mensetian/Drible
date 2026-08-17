import { crearSim, paso, tocar, elegirCancion, NOTAS, LARGO, TECHOS, HUECOS, SPB, SECCIONES } from './juego.js';
const DT = 1/240;
elegirCancion('viaje');
console.log('abismos en NEBULOSA (164-196):');
for (const h of HUECOS) if (h.x1 > 164 && h.x0 < 196) console.log(`  [${h.x0}, ${h.x1}]`);
// mano humana: +-90ms aleatorio determinista
let semilla = 7;
const azar = () => (semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648;
const off = () => (azar() * 2 - 1) * 90 / 1000 / SPB;
const objetivos = NOTAS.filter(n => !n.silencio && !n.porCaida).map(n => n.xm + off());
let j = 0;
const s = crearSim();
let ultimo = null;
for (let b = 0; b < LARGO + 2 && s.viva && !s.meta; b += DT) {
  if (s.estado === 'apoyada' && s.tecla >= 0) ultimo = NOTAS[s.tecla];
  if (s.estado === 'apoyada' && s.tecla < 0 && s.x - s.ultimoToque > 0.35 &&
      !TECHOS.some(t => s.x > t.x0 - 0.8 && s.x < t.x1)) { tocar(s, b); paso(s, DT); continue; }
  const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
  s.sostiene = !!(k && k.riel);
  while (j < objetivos.length && s.x >= objetivos[j]) { tocar(s, b); j++; }
  paso(s, DT);
}
console.log(`\nmuere en x=${s.x.toFixed(2)} causa=${s.causa} · ultima tecla pisada: #${ultimo?.i} ${ultimo?.nombre} b=${ultimo?.b} riel=${!!ultimo?.riel} [${ultimo?.x0.toFixed(2)},${ultimo?.x1.toFixed(2)}]`);
const sec = SECCIONES.filter(z => z.x0 <= s.x).pop();
console.log(`seccion: ${sec?.n}`);
