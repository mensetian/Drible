import { crearSim, paso, tocar, elegirCancion, NOTAS, LARGO, TECHOS, HUECOS } from './juego.js';
const DT = 1/240;
elegirCancion('viaje');
console.log(`abismos: ${HUECOS.length}`);
const rescata = (s, b) => {
  if (s.estado !== 'apoyada' || s.tecla >= 0) return false;
  if (s.x - s.ultimoToque < 0.35) return true;
  if (TECHOS.some(t => s.x > t.x0 - 0.8 && s.x < t.x1)) return true;
  tocar(s, b); return true;
};
const s = crearSim();
let sueltas = 0, primera = null;
for (let b = 0; b < LARGO + 2 && s.viva && !s.meta; b += DT) {
  if (!rescata(s, b)) {
    const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
    const sobreAbismo = HUECOS.some(h => s.x > h.x0 && s.x < h.x1);
    const antes = s.sostiene;
    s.sostiene = !!(k && k.riel) && !sobreAbismo;
    if (antes && !s.sostiene && k && k.riel && sobreAbismo) {
      sueltas++; if (!primera) primera = { x: s.x, i: k.i, b: k.b, nombre: k.nombre };
    }
    if (k && !k.riel && !k.silencio && s.x >= k.xm && !s.tocadas.has(k.i)) tocar(s, b);
  }
  paso(s, DT);
}
console.log(`sueltas sobre abismo: ${sueltas} · primera:`, primera);
console.log(`fin x=${s.x.toFixed(2)} viva=${s.viva} causa=${s.causa} meta=${s.meta}`);
