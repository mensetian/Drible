// Prueba del prototipo: el tramo de juguete tiene que ser superable driblando
// al beat, y cada obstaculo tiene que matar exactamente a quien dice matar.
//
//   node drible/prueba.js

import { crearSim, paso, tocar, LARGO, HUECOS, PINCHOS, TUNELES, CAMPANAS } from './juego.js';

const DT = 1 / 240;

// juega con una estrategia: f(sim, beat) puede tocar o sostener
function jugar (estrategia) {
  const s = crearSim();
  for (let b = 0; b < LARGO + 1 && s.viva && !s.meta; b += DT) {
    estrategia(s, b);
    paso(s, DT);
  }
  return s;
}

// la mano perfecta: dribla en cada beat, palmea dentro del tunel
const dentroTunel = x => TUNELES.some(t => x > t.x0 - 1.2 && x < t.x1 - 0.3);
const perfecta = (s, b) => {
  s.sostiene = dentroTunel(s.x);
  if (!s.sostiene && Math.abs(b - Math.round(b)) < DT / 2) tocar(s, b);
};

// la mano muerta: no toca nada nunca
const muerta = () => {};

// la mano terca: dribla SIEMPRE, incluso dentro del tunel
const terca = (s, b) => { if (Math.abs(b - Math.round(b)) < DT / 2) tocar(s, b); };

const r1 = jugar(perfecta);
const r2 = jugar(muerta);
const r3 = jugar(terca);

const pruebas = [
  ['driblar al beat llega a la meta', r1.meta, `x ${r1.x.toFixed(2)} causa ${r1.causa || '-'}`],
  ['no hacer nada muere en el primer hueco', !r2.viva && r2.causa === 'hueco' && r2.x < HUECOS[0].x1 + 0.5,
    `x ${r2.x.toFixed(2)} causa ${r2.causa || 'sigue viva'}`],
  ['driblar dentro del tunel mata', !r3.viva && r3.causa === 'tunel',
    `x ${r3.x.toFixed(2)} causa ${r3.causa || 'sigue viva'}`],
  ['los pinchos estan a medio beat (apex del drible)', PINCHOS.every(p => Math.abs(p.x % 1 - 0.5) < 1e-9), ''],
  ['driblar al beat toca TODAS las campanas', r1.tocadas.size === CAMPANAS.length,
    `${r1.tocadas.size}/${CAMPANAS.length}`],
  ['la meta queda despues del ultimo obstaculo',
    LARGO > Math.max(...HUECOS.map(h => h.x1), ...PINCHOS.map(p => p.x), ...TUNELES.map(t => t.x1)), '']
];

let fallas = 0;
for (const [n, ok, det] of pruebas) {
  if (!ok) fallas++;
  console.log(`${ok ? '  ok  ' : ' FALLA'}  ${n}${det ? `   (${det})` : ''}`);
}
process.exit(fallas ? 1 : 0);
