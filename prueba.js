// Prueba del prototipo: el tramo de juguete tiene que ser superable con los
// verbos escritos, y cada obstaculo tiene que matar exactamente a quien dice
// matar -- incluido el techo medio, que castiga TOCAR de mas.
//
//   node drible/prueba.js

import { crearSim, paso, tocar, LARGO, HUECOS, PINCHOS, TUNELES, CAMPANAS, PLATAFORMAS } from './juego.js';

const DT = 1 / 240;

// juega con una estrategia: f(sim, beat) puede tocar o sostener
function jugar (estrategia) {
  const s = crearSim();
  for (let b = 0; b < LARGO + 2 && s.viva && !s.meta; b += DT) {
    estrategia(s, b);
    paso(s, DT);
  }
  return s;
}

const TUNEL_BAJO = TUNELES[0];        // 0.19: pide rodar
const TECHO_MEDIO = TUNELES[1];       // 0.30: pide pulso (no tocar)
const dentroBajo = x => x > TUNEL_BAJO.x0 - 1.7 && x < TUNEL_BAJO.x1 - 0.3;

// la mano sabia: palma el tunel bajo, deja el pulso trabajar bajo el techo
// medio y sobre la plataforma, y toca SOLO los acentos que piden boost.
// El resorte de la subida toca solo: no necesita tap.
const ACENTOS = [8, 24, 26, 36];
const enBeat = (b, a) => Math.abs(b - a) < DT / 2;
const sabia = (s, b) => {
  s.sostiene = dentroBajo(s.x);
  if (!s.sostiene && ACENTOS.some(a => enBeat(b, a))) tocar(s, b);
};

// la mano muerta: no toca nada nunca
const muerta = () => {};

// la mano terca: toca en TODOS los beats, nunca palmea
const terca = (s, b) => { if (enBeat(b, Math.round(b))) tocar(s, b); };

// la mano apurada: juega bien pero boostea entrando al techo medio
const apurada = (s, b) => {
  sabia(s, b);
  if (enBeat(b, 28)) tocar(s, b);
};

const r1 = jugar(sabia);
const r2 = jugar(muerta);
const r3 = jugar(terca);
const r4 = jugar(apurada);

const pruebas = [
  ['la mano sabia llega a la meta', r1.meta, `x ${r1.x.toFixed(2)} causa ${r1.causa || '-'}`],
  ['y toca TODAS las campanas (pulso abajo, pulso en la plataforma)',
    r1.tocadas.size === CAMPANAS.length, `${r1.tocadas.size}/${CAMPANAS.length}`],
  ['no hacer nada muere en el primer hueco', !r2.viva && r2.causa === 'hueco' && r2.x < HUECOS[0].x1 + 0.5,
    `x ${r2.x.toFixed(2)} causa ${r2.causa || 'sigue viva'}`],
  ['tocar siempre muere en el tunel bajo', !r3.viva && r3.causa === 'tunel' && r3.x < TUNEL_BAJO.x1,
    `x ${r3.x.toFixed(2)} causa ${r3.causa || 'sigue viva'}`],
  ['boostear bajo el techo medio mata (a medio tiempo NO se toca)',
    !r4.viva && r4.causa === 'tunel' && r4.x > TECHO_MEDIO.x0,
    `x ${r4.x.toFixed(2)} causa ${r4.causa || 'sigue viva'}`],
  ['los pinchos estan a medio beat (apex del pulso)', PINCHOS.every(p => Math.abs(p.x % 1 - 0.5) < 1e-9), ''],
  ['la meta queda despues del ultimo obstaculo',
    LARGO > Math.max(...HUECOS.map(h => h.x1), ...PINCHOS.map(p => p.x),
      ...TUNELES.map(t => t.x1), ...PLATAFORMAS.map(p => p.x1)), '']
];

let fallas = 0;
for (const [n, ok, det] of pruebas) {
  if (!ok) fallas++;
  console.log(`${ok ? '  ok  ' : ' FALLA'}  ${n}${det ? `   (${det})` : ''}`);
}
process.exit(fallas ? 1 : 0);
