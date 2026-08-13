// El nivel se compila desde la cancion, asi que las pruebas validan DOS cosas:
// que la partitura este bien escrita (compases de 4, saltos alcanzables) y que
// el nivel resultante se pueda tocar entero con los verbos que promete.
//
//   node drible/prueba.js

import {
  crearSim, paso, tocar, soltar, vueloMinimo,
  CANCION, NOTAS, TOTAL_NOTAS, LARGO, HUECOS, TECHOS, RESORTES, SUELTA, G
} from './juego.js';

const DT = 1 / 240;

function jugar (mano) {
  const s = crearSim();
  for (let b = 0; b < LARGO + 2 && s.viva && !s.meta; b += DT) {
    mano(s, b);
    paso(s, DT);
  }
  return s;
}

// la mano perfecta: toca cada tecla apenas la pisa, sostiene los rieles
const perfecta = (s, b) => {
  const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
  s.sostiene = !!(k && k.riel);
  if (k && !k.riel && !s.tocadas.has(k.i)) tocar(s, b);
};

// la mano muerta: nunca toca nada
const muerta = () => {};

// la mano terca: juega bien pero no aguanta el silencio y toca bajo el techo
const T0 = TECHOS[0];
const terca = (s, b) => { perfecta(s, b); if (s.x > T0.x0 + 0.3 && s.x < T0.x1 - 0.3) tocar(s, b); };

// la mano floja: juega bien pero suelta el riel justo sobre el abismo
const floja = (s, b) => {
  const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
  s.sostiene = !!(k && k.riel) && !HUECOS.some(h => s.x > h.x0 && s.x < h.x1);
  if (k && !k.riel && !s.tocadas.has(k.i)) tocar(s, b);
};

// la mano humana: apunta a cada nota con un error de +-90 ms, muchas veces
// tocando en el aire antes de posarse. Es la que decide si el juego es jugable.
function humana (amplitud) {
  const objetivos = NOTAS.filter(k => !k.silencio && !k.riel)
    .map((k, n) => k.x0 + (((n * 7919) % 31) / 30 - 0.5) * 2 * amplitud);
  let j = 0;
  return (s, b) => {
    const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
    s.sostiene = !!(k && k.riel);
    while (j < objetivos.length && s.x >= objetivos[j]) { tocar(s, b); j++; }
  };
}

// el principiante todavia no siente el mapa: toca sistematicamente corrido
const corrida = ms => {
  const objetivos = NOTAS.filter(k => !k.silencio && !k.riel).map(k => k.x0 + ms / 600);
  let j = 0;
  return (s, b) => {
    const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
    s.sostiene = !!(k && k.riel);
    while (j < objetivos.length && s.x >= objetivos[j]) { tocar(s, b); j++; }
  };
};

// la mano que suelta el riel antes de tiempo para poder apretar de nuevo:
// es el gesto natural para atacar la nota que sigue, y no puede matarte.
const prepara = (s, b) => {
  const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
  const suelta = k && k.riel && s.x > k.x1 - SUELTA + 0.05;
  if (suelta && s.sostiene) soltar(s);
  else s.sostiene = !!(k && k.riel) && !suelta;
  if (k && !k.riel && !s.tocadas.has(k.i)) tocar(s, b);
};

const rp = jugar(perfecta);
const rPrep = jugar(prepara);
const rh = jugar(humana(0.15));   // +-90 ms
const rAd = jugar(corrida(-150));  // siempre adelantado
const rAt = jugar(corrida(150));   // siempre atrasado
const rm = jugar(muerta);
const rt = jugar(terca);
const rf = jugar(floja);

// --- la partitura ------------------------------------------------------------

const compasesMal = CANCION.map((c, i) => [i, c.trim().split(/\s+/)
  .reduce((a, t) => a + parseFloat(t.split(':')[1]), 0)]).filter(([, n]) => Math.abs(n - 4) > 1e-9);

const saltos = NOTAS.filter(k => !k.silencio && !k.escalera && !k.riel);
const estrechas = saltos.filter(k => k.x1 - k.x0 < 0.09);
const solapadas = NOTAS.filter((k, i) => NOTAS[i + 1] && k.x1 > NOTAS[i + 1].x0 + 1e-9);

// cada salto tiene que llegar CAYENDO a la tecla siguiente, si no la atraviesa
const inalcanzables = saltos.filter(k => {
  const sig = NOTAS[k.i + 1];
  if (!sig || sig.silencio) return false;
  return sig.x0 - k.x1 < vueloMinimo(sig.y - k.y) - 1e-9;
});

const pruebas = [
  ['cada compas suma exactamente 4 tiempos', !compasesMal.length,
    compasesMal.map(([i, n]) => `c${i}=${n}`).join(' ')],
  ['ninguna tecla se solapa con la siguiente', !solapadas.length,
    solapadas.map(k => k.nombre + '@' + k.b).join(' ')],
  ['toda ventana de salto es jugable (>= 0.09 tiempos)', !estrechas.length,
    estrechas.map(k => `${k.nombre}@${k.b}:${(k.x1 - k.x0).toFixed(3)}`).join(' ')],
  ['todo salto llega cayendo a la tecla siguiente', !inalcanzables.length,
    inalcanzables.map(k => k.nombre + '@' + k.b).join(' ')],
  ['hay ligaduras: notas que se tocan dejandose caer',
    NOTAS.filter(k => k.porCaida).length >= 4,
    NOTAS.filter(k => k.porCaida).map(k => k.nombre + '@' + k.b).join(' ')],
  ['toda ligadura tiene ventana para atacar la primera nota',
    NOTAS.filter(k => k.ligada).every(k => k.x1 - k.x0 >= 0.14), ''],
  ['una ligadura NO suena si no sonaste la nota de la que cuelga',
    NOTAS.filter(k => k.porCaida).every(k => !rm.tocadas.has(k.i)), ''],
  ['hay rieles, escaleras y saltos (tres figuras, no una)',
    NOTAS.some(k => k.riel) && NOTAS.some(k => k.escalera) && saltos.length > 30,
    `rieles ${NOTAS.filter(k => k.riel).length} · escalones ${NOTAS.filter(k => k.escalera).length} · saltos ${saltos.length}`],
  ['el mapa sube y baja de verdad (rango > medio octava)',
    Math.max(...NOTAS.filter(k => !k.silencio).map(k => k.y)) -
    Math.min(...NOTAS.filter(k => !k.silencio).map(k => k.y)) > 0.15, ''],

  // --- el nivel se puede tocar ---------------------------------------------
  ['la mano perfecta llega a la meta', rp.meta,
    `x ${rp.x.toFixed(2)} causa ${rp.causa || '-'}`],
  ['...y suena la melodia COMPLETA', rp.tocadas.size === TOTAL_NOTAS,
    `${rp.tocadas.size}/${TOTAL_NOTAS}`],
  ['una mano humana (+-90 ms) llega a la meta', rh.meta,
    `x ${rh.x.toFixed(2)} causa ${rh.causa || '-'}`],
  ['...y suena al menos 9 de cada 10 notas', rh.tocadas.size >= TOTAL_NOTAS * 0.9,
    `${rh.tocadas.size}/${TOTAL_NOTAS}`],
  ['adelantarse 150 ms en TODO sigue sonando la melodia', rAd.meta && rAd.tocadas.size === TOTAL_NOTAS,
    `${rAd.tocadas.size}/${TOTAL_NOTAS} ${rAd.meta ? 'meta' : 'murio en ' + rAd.x.toFixed(1)}`],
  // atrasado una semicorchea entera, la carrera se corta antes de terminarla:
  // eso es correcto, es lo que pasa en un instrumento. No mas de una por carrera.
  ['atrasarse 150 ms cuesta a lo sumo el final de cada carrera',
    rAt.meta && rAt.tocadas.size >= TOTAL_NOTAS - 2,
    `${rAt.tocadas.size}/${TOTAL_NOTAS} ${rAt.meta ? 'meta' : 'murio en ' + rAt.x.toFixed(1)}`],
  ['soltar el riel sobre el final para poder saltar NO te tira',
    rPrep.meta && rPrep.tocadas.size === TOTAL_NOTAS,
    `${rPrep.tocadas.size}/${TOTAL_NOTAS} ${rPrep.meta ? 'meta' : 'murio en ' + rPrep.x.toFixed(1) + ' ' + rPrep.causa}`],
  ['todo riel tiene tramo de suelta usable', NOTAS.filter(k => k.riel)
    .every(k => k.x1 - k.x0 > SUELTA + 0.2), ''],
  ['no tocar nada no suena ninguna nota', rm.tocadas.size === 0,
    `${rm.tocadas.size} notas, x ${rm.x.toFixed(2)}`],
  ['tocar de mas mata bajo el techo del silencio',
    !rt.viva && rt.causa === 'techo', `x ${rt.x.toFixed(2)} causa ${rt.causa || 'sigue viva'}`],
  ['soltar el riel sobre el abismo mata',
    !rf.viva && rf.causa === 'hueco' && HUECOS.some(h => rf.x > h.x0 && rf.x < h.x1 + 1),
    `x ${rf.x.toFixed(2)} causa ${rf.causa || 'sigue viva'}`],
  ['la red rescata: hay resortes repartidos', RESORTES.length >= 8, `${RESORTES.length}`],
  ['ningun resorte queda bajo un techo o sobre un abismo',
    RESORTES.every(r => !HUECOS.some(h => r.x > h.x0 && r.x < h.x1) &&
      !TECHOS.some(t => r.x > t.x0 && r.x < t.x1)), '']
];

let fallas = 0;
for (const [n, ok, det] of pruebas) {
  if (!ok) fallas++;
  console.log(`${ok ? '  ok  ' : ' FALLA'}  ${n}${det ? `   (${det})` : ''}`);
}
console.log(`\n${TOTAL_NOTAS} notas en ${LARGO} tiempos · ${(LARGO * 60 / 100).toFixed(0)}s`);
process.exit(fallas ? 1 : 0);
