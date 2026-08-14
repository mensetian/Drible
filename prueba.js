// El nivel se compila desde la cancion, asi que las pruebas validan DOS cosas:
// que la partitura este bien escrita (compases de 4, saltos alcanzables) y que
// el nivel resultante se pueda tocar entero con los verbos que promete.
//
// Corre la suite entera UNA VEZ POR CANCION: las dos tienen que ser jugables
// con las mismas manos. Lo que cambia por cancion son los rasgos del mapa
// (Aurora tiene carreras de semicorcheas y un silencio con techo; esfera no),
// y eso va en `RASGOS`, no en tests copiados.
//
//   node drible/prueba.js

import {
  crearSim, paso, tocar, soltar, vueloMinimo, elegirCancion, NIVELES,
  CANCION, NOTAS, TOTAL_NOTAS, LARGO, HUECOS, TECHOS, RESORTES, SUELTA, PISO, G, SPB, BPM, enArpegio, ORBES
} from './juego.js';

// de milisegundos a tiempos: las manos hablan en ms, la simulacion en beats
const enBeats = ms => ms / 1000 / SPB;

const DT = 1 / 240;

// Que figuras tiene cada mapa. No son umbrales de calidad: son la partitura.
// `exigente`: si el mapa tiene que hacerle perder alguna nota a una mano de
// +-90 ms. Aurora si; esfera NO -- a 100 BPM en negras el margen nunca muerde,
// y que eso pase es justamente el dato que este nivel existe para medir.
const RASGOS = {
  esfera: { escaleras: false, ligaduras: 0, huecos: 1, techos: 0, resortes: 8, saltos: 30, exigente: false },
  aurora: { escaleras: true, ligaduras: 4, huecos: 3, techos: 1, resortes: 8, saltos: 30, exigente: true },
  // el viaje va por el ACTO 1 (amanecer ×2, motor, drop 1): crece por sesiones.
  // El motor es zona de dribleo (sin techo: el silencio ahi se JUEGA).
  viaje: { escaleras: true, ligaduras: 2, huecos: 14, techos: 0, resortes: 8, saltos: 30, exigente: true, orbes: 40 }
};

let fallas = 0;

function correr (id) {
  elegirCancion(id);
  const R = RASGOS[id];

  function jugar (mano) {
    const s = crearSim();
    for (let b = 0; b < LARGO + 2 && s.viva && !s.meta; b += DT) {
      mano(s, b);
      paso(s, DT);
    }
    return s;
  }

  // la mano perfecta: toca cada tecla apenas la pisa, sostiene los rieles,
  // y driblea las zonas de arpegio al beat
  const perfecta = (s, b) => {
    const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
    s.sostiene = !!(k && k.riel);
    if (k && !k.riel && !k.silencio && s.x >= k.xm && !s.tocadas.has(k.i)) tocar(s, b);
  };

  // la mano muerta: nunca toca nada
  const muerta = () => {};

  // la mano terca: juega bien pero no aguanta el silencio y toca bajo el techo
  const T0 = TECHOS[0];
  const terca = (s, b) => { perfecta(s, b); if (T0 && s.x > T0.x0 + 0.3 && s.x < T0.x1 - 0.3) tocar(s, b); };

  // la mano floja: juega bien pero suelta el riel justo sobre el abismo
  const floja = (s, b) => {
    const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
    s.sostiene = !!(k && k.riel) && !HUECOS.some(h => s.x > h.x0 && s.x < h.x1);
    if (k && !k.riel && !k.silencio && s.x >= k.xm && !s.tocadas.has(k.i)) tocar(s, b);
  };

  // la mano humana: apunta a cada nota con un error de +-90 ms, muchas veces
  // tocando en el aire antes de posarse. Es la que decide si el juego es jugable.
  function humana (amplitud) {
    const objetivos = NOTAS.filter(k => !k.silencio && !k.riel)
      .map((k, n) => k.xm + (((n * 7919) % 31) / 30 - 0.5) * 2 * amplitud);
    let j = 0;
    return (s, b) => {
        const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
      s.sostiene = !!(k && k.riel);
      while (j < objetivos.length && s.x >= objetivos[j]) { tocar(s, b); j++; }
    };
  }

  // el principiante todavia no siente el mapa: toca sistematicamente corrido
  const corrida = ms => {
    const objetivos = NOTAS.filter(k => !k.silencio && !k.riel).map(k => k.xm + enBeats(ms));
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
    if (k && !k.riel && !k.silencio && s.x >= k.xm && !s.tocadas.has(k.i)) tocar(s, b);
  };

  // el tramposo: martilla el boton sin mirar el ritmo (sostiene los rieles, que es
  // lo unico que no se puede martillar). Si esto saca buen puntaje, el juego no es
  // un juego de ritmo: es un boton que se aprieta rapido.
  function martillo (cada) {
    let ultimo = -Infinity;
    return (s, b) => {
      const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
      s.sostiene = !!(k && k.riel);
      if (s.x - ultimo >= cada) { ultimo = s.x; tocar(s, b); }
    };
  }

  // la mano que tropieza: juega perfecto salvo UNA nota que deja pasar, cae a
  // la red, y toca para reengancharse. Mide que un error cueste esa nota y no
  // el tramo entero hasta el proximo resorte.
  const SALTEADA = NOTAS.filter(k => !k.silencio && !k.riel && !k.escalera && !k.porCaida)[2].i;
  const tropieza = (s, b) => {
    const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
    s.sostiene = !!(k && k.riel);
    // en la red toca para reengancharse -- salvo cerca de un techo: ahi hasta el
    // saltito flota hacia adentro y mata, y el jugador que ve el techo no toca
    if (s.estado === 'apoyada' && s.tecla < 0 && s.x - s.ultimoToque > 0.3 &&
        !TECHOS.some(t => s.x > t.x0 - 0.8 && s.x < t.x1)) { tocar(s, b); return; }
    if (k && !k.riel && !k.silencio && s.x >= k.xm && !s.tocadas.has(k.i) && k.i !== SALTEADA)
      tocar(s, b);
  };

  const rp = jugar(perfecta);
  const rz = jugar(tropieza);
  const rSpam = jugar(martillo(0.04));
  const rSpam2 = jugar(martillo(0.12));
  const rPrep = jugar(prepara);
  const rh = jugar(humana(enBeats(90)));   // +-90 ms
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

  // Desde el toque MAS TARDE de cada tecla hay que poder aterrizar dentro de la
  // que sigue, cayendo. Si no, la esfera la atraviesa por abajo y la nota no
  // existe: no alcanza con que la ventana sea ancha.
  const inalcanzables = saltos.filter(k => {
    const sig = NOTAS[k.i + 1];
    if (!sig || sig.silencio) return false;
    return k.x1 + vueloMinimo(sig.y - k.y) > sig.x1 - 0.05 + 1e-9;
  });

  const malCentradas = NOTAS.filter(k => !k.silencio &&
    (k.xm <= k.x0 + 0.03 || k.xm >= k.x1 - 0.03));
  // las que se entran rodando (carreras, y la que sigue a una) no aterrizan: no
  // necesitan tramo de rodada porque nunca dejaron de rodar
  const sinRodada = NOTAS.filter(k => !k.silencio && !k.escalera &&
    !(NOTAS[k.i - 1] && NOTAS[k.i - 1].dur <= 0.25));

  const ligadas = NOTAS.filter(k => k.porCaida);

  const pruebas = [
    ['cada compas suma exactamente 4 tiempos', !compasesMal.length,
      compasesMal.map(([i, n]) => `c${i}=${n}`).join(' ')],
    ['ninguna tecla se solapa con la siguiente', !solapadas.length,
      solapadas.map(k => k.nombre + '@' + k.b).join(' ')],
    ['toda ventana de salto es jugable (>= 0.09 tiempos)', !estrechas.length,
      estrechas.map(k => `${k.nombre}@${k.b}:${(k.x1 - k.x0).toFixed(3)}`).join(' ')],
    ['todo salto llega cayendo a la tecla siguiente', !inalcanzables.length,
      inalcanzables.map(k => k.nombre + '@' + k.b).join(' ')],
    // El punto afinado no puede caer en el canto de la plataforma: ahi aterrizar
    // y golpear son el mismo instante, y eso no es tocar, es adivinar.
    ['el punto exacto cae adentro de la plataforma, no en el canto',
      !malCentradas.length, malCentradas.map(k => `${k.nombre}@${k.b}`).join(' ')],
    ['hay tramo para rodar antes de golpear', sinRodada.every(k => k.xm - k.x0 >= 0.12),
      `${Math.min(...sinRodada.map(k => k.xm - k.x0)).toFixed(3)} el mas corto`],
    ['las ligaduras que pide la partitura estan', ligadas.length >= R.ligaduras,
      ligadas.map(k => k.nombre + '@' + k.b).join(' ') || 'ninguna'],
    ['toda ligadura tiene ventana para atacar la primera nota',
      NOTAS.filter(k => k.ligada).every(k => k.x1 - k.x0 >= 0.14), ''],
    ['una ligadura NO suena si no sonaste la nota de la que cuelga',
      ligadas.every(k => !rm.tocadas.has(k.i)), ''],
    ['hay rieles y saltos; carreras si la partitura las pide',
      NOTAS.some(k => k.riel) && saltos.length > R.saltos &&
      (!R.escaleras || NOTAS.some(k => k.escalera)),
      `rieles ${NOTAS.filter(k => k.riel).length} · escalones ${NOTAS.filter(k => k.escalera).length} · saltos ${saltos.length}`],
    ['el mapa sube y baja de verdad (rango > medio octava)',
      Math.max(...NOTAS.filter(k => !k.silencio).map(k => k.y)) -
      Math.min(...NOTAS.filter(k => !k.silencio).map(k => k.y)) > 0.15, ''],

    // --- el nivel se puede tocar ---------------------------------------------
    // se arranca arriba y el primer gesto es tocar una nota, no trepar desde la red
    ['se empieza en la plataforma de salida, no en la red',
      !!PISO && crearSim().y === PISO.y && crearSim().tecla === PISO.i,
      PISO ? `y ${PISO.y.toFixed(3)} hasta x ${PISO.x1.toFixed(2)}` : 'no hay salida'],
    ['la salida esta a la altura de la primera nota y la lanza a ella',
      !!PISO && PISO.y === NOTAS[PISO.i + 1].y && PISO.x1 < NOTAS[PISO.i + 1].x0, ''],
    ['la mano perfecta llega a la meta', rp.meta,
      `x ${rp.x.toFixed(2)} causa ${rp.causa || '-'}`],
    ['...y suena la melodia COMPLETA', rp.tocadas.size === TOTAL_NOTAS,
      `${rp.tocadas.size}/${TOTAL_NOTAS}`],
    ['...y le sale TODA limpia: tocar bien tiene que sonar bien',
      rp.limpias.size === TOTAL_NOTAS, `${rp.limpias.size}/${TOTAL_NOTAS} limpias`],

    // --- no se puede hacer trampa martillando ---------------------------------
    ['martillar el boton no saca puntaje (rapido)',
      rSpam.limpias.size <= TOTAL_NOTAS * 0.45,
      `${rSpam.limpias.size}/${TOTAL_NOTAS} limpias · ${rSpam.tocadas.size} sonadas · ${rSpam.falsos} en falso`],
    ['martillar el boton no saca puntaje (a media velocidad)',
      rSpam2.limpias.size <= TOTAL_NOTAS * 0.45,
      `${rSpam2.limpias.size}/${TOTAL_NOTAS} limpias · ${rSpam2.tocadas.size} sonadas · ${rSpam2.falsos} en falso`],
    ['...y la mano perfecta nunca toca en falso', rp.falsos === 0, `${rp.falsos}`],
    ['una mano humana (+-90 ms) llega a la meta', rh.meta,
      `x ${rh.x.toFixed(2)} causa ${rh.causa || '-'}`],
    ['...y suena al menos 9 de cada 10 notas', rh.tocadas.size >= TOTAL_NOTAS * 0.9,
      `${rh.tocadas.size}/${TOTAL_NOTAS}`],
    ['adelantarse 150 ms en TODO sigue sonando la melodia', rAd.meta && rAd.tocadas.size === TOTAL_NOTAS,
      `${rAd.tocadas.size}/${TOTAL_NOTAS} ${rAd.meta ? 'meta' : 'murio en ' + rAd.x.toFixed(1)}`],
    // ...pero suena chueca: la nota no se calla nunca, se ensucia. Asi el oido
    // avisa que vas corrido sin que haya que mirar el HUD.
    ['...pero corrido 150 ms suena chueco casi siempre',
      rAd.limpias.size <= TOTAL_NOTAS * 0.35, `${rAd.limpias.size}/${TOTAL_NOTAS} limpias`],
    ['una mano humana afina la mayoria' + (R.exigente ? ', no todas' : ''),
      rh.limpias.size >= TOTAL_NOTAS * 0.4 && (!R.exigente || rh.limpias.size < TOTAL_NOTAS),
      `${rh.limpias.size}/${TOTAL_NOTAS} limpias`],
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
      !R.techos || (!rt.viva && rt.causa === 'techo'),
      T0 ? `x ${rt.x.toFixed(2)} causa ${rt.causa || 'sigue viva'}` : 'sin techos: no aplica'],
    ['soltar el riel sobre el abismo mata',
      !rf.viva && rf.causa === 'hueco' && HUECOS.some(h => rf.x > h.x0 && rf.x < h.x1 + 1),
      `x ${rf.x.toFixed(2)} causa ${rf.causa || 'sigue viva'}`],
    // el terreno se deduce de la partitura: cambiar la melodia no puede dejar un
    // abismo debajo de una nota que se toca saltando
    // los abismos viven bajo un riel (soltar mata) o entre los pads de una
    // zona de dribleo (no picar mata): nunca sueltos en el medio de la nada
    ['todo abismo cae bajo un riel o entre pads de dribleo', HUECOS.length >= R.huecos &&
      HUECOS.every(h => enArpegio((h.x0 + h.x1) / 2) ||
        NOTAS.some(n => n.riel && h.x0 >= n.x0 && h.x1 <= n.x1)),
      `${HUECOS.length} abismos`],
    ['el silencio largo lleva techo, y empieza tras tocar la red',
      TECHOS.length >= R.techos && TECHOS.every(t => {
        const n = NOTAS.find(k => k.silencio && !k.piso && t.x0 > k.x0 && t.x0 < k.x0 + k.dur);
        const ant = n && NOTAS[n.i - 1];
        return !ant || t.x0 >= n.x0 + Math.sqrt(2 * ant.y / G);
      }), `${TECHOS.length}`],
    ['la red rescata: hay resortes repartidos', RESORTES.length >= R.resortes, `${RESORTES.length}`],
    // Un tropiezo no puede costar el tramo: desde la red, tocar te relanza a la
    // proxima tecla. Se pierden a lo sumo la salteada y sus dos vecinas.
    // La zona de dribleo del motor: picar al beat suena el arpegio y no rompe
    // nada -- la melodia de despues sale entera igual.
    // Los orbes son cuerpos: la mano fina los cosecha casi todos con el arco;
    // la corrida 150 ms pica por otro lado y deja la mayoria mudos.
    ['los orbes del arpegio se tocan con el cuerpo, y el arco fino los lleva',
      !R.orbes || (rp.orbes >= R.orbes && rAt.orbes < rp.orbes * 0.7),
      R.orbes ? `perfecta ${rp.orbes}/${ORBES.length} · atrasada ${rAt.orbes}` : 'sin orbes: no aplica'],
    ['tropezar cuesta esa nota, no el tramo: tocar en la red reengancha',
      rz.meta && rz.tocadas.size >= TOTAL_NOTAS - 3,
      `${rz.tocadas.size}/${TOTAL_NOTAS} sonadas tras caerse una vez`],
    // un punto exacto se esquiva sin querer, o se salta creyendo que es obstaculo
    ['los trampolines son una zona pisable, no un punto',
      RESORTES.every(r => r.x1 - r.x0 >= 0.6),
      `${Math.min(...RESORTES.map(r => r.x1 - r.x0)).toFixed(2)} de ancho el mas angosto`],
    ['ningun resorte queda bajo un techo o sobre un abismo',
      RESORTES.every(r => !HUECOS.some(h => r.x > h.x0 && r.x < h.x1) &&
        !TECHOS.some(t => r.x > t.x0 && r.x < t.x1)), '']
  ];

  console.log(`\n=== ${id.toUpperCase()} · ${BPM} BPM ===`);
  for (const [n, ok, det] of pruebas) {
    if (!ok) fallas++;
    console.log(`${ok ? '  ok  ' : ' FALLA'}  ${n}${det ? `   (${det})` : ''}`);
  }
  console.log(`${TOTAL_NOTAS} notas en ${LARGO} tiempos · ${(LARGO * SPB).toFixed(0)}s`);
}

for (const id of NIVELES) correr(id);
process.exit(fallas ? 1 : 0);
