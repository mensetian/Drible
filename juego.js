// ---------------------------------------------------------------------------
// DRIBLE — el mapa ES la partitura.
//
// Idea, en una linea: la esfera no rebota sola nunca. Cada nota de la melodia
// es una TECLA fisica flotando a la altura de su tono; pisarla y tocar hace
// sonar la nota Y te lanza exactamente hasta la siguiente. Vos elegis CUANDO,
// nunca CUANTO: el impulso lo calcula la geometria.
//
//   altura de la tecla   = tono de la nota
//   distancia entre teclas = figura ritmica (corchea = salto corto y frenetico,
//                            semicorchea = escalon pegado, blanca = riel)
//   ancho de la tecla    = ventana de tiempo (la geometria juzga, no un reloj)
//
// Verbos: TOCAR sobre una tecla = sonar la nota + saltar a la proxima.
//         MANTENER sobre un riel = nota larga (si soltas, te caes).
//         NO TOCAR bajo un techo = el silencio del compas.
//
// Si fallas una nota te caes a la RED. No morir, pero la melodia queda con un
// hueco (se oye). Desde la red, TOCAR te relanza hacia la proxima tecla: el
// error cuesta la nota perdida, nunca el tramo entero. Los resortes verdes
// hacen lo mismo solos, como respaldo. Sobre los abismos no hay red: ahi el
// riel se paga con la vida.
//
// Corre en node (solo simulacion) y en el navegador (render + audio).
// ---------------------------------------------------------------------------

export let BPM = 112;
export let SPB = 60 / BPM;
export const G = 1.24;              // gravedad, en unidades de beat
export const R = 0.055;             // radio de la esfera
export const PASO_TONO = 0.024;     // cuanto sube el mapa por semitono
export const Y_GRAVE = 0.26;        // altura de la nota mas grave (E4)
export const GRACIA_RIEL = 0.18;    // margen para agarrarse al riel
export const CAIDA_MUERTE = -0.35;

// --- las canciones ----------------------------------------------------------
// Un compas por linea, "nota:figura" separados por espacio. "-" es silencio.
// Las dos van sobre Am F C G. El compas 0 es la entrada: bateria sola.
//
// Hay DOS niveles a proposito, para separar dos hipotesis de dificultad que
// venian mezcladas: el margen de error (AFINADO, igual en los dos) y la
// cancion en si (el galope de Aurora contra las negras y blancas de esfera).
// Si esfera sale facil y Aurora no, la dificultad es la cancion; si cuestan
// parecido, es el margen.

const CANCIONES = {
  // ESFERA — la cancion del nivel de esfera, transcripta a una sola voz. La
  // melodia es la linea que alli dibujaba el terreno: el pulso en negras, la
  // escalera que sube por el acorde, las cascadas de bordes bajando una nota
  // por beat, las dos ligaduras hechas riel, y el unico puntillo del tramo
  // 'aire'. Casi todo cae en el beat entero: es el nivel 1.
  esfera: {
    nombre: 'ESFERA', bpm: 100,
    // En esfera la blanca era UN toque y dos beats de vuelo, no una nota
    // sostenida: el umbral de riel sube para que las blancas sigan siendo
    // toques y solo las ligaduras de verdad (4 tiempos) se mantengan.
    rielMin: 2.5,
    compases: [
      '-:4',                       //  0     entrada
      'A4:1 A4:1 A4:1 A4:1',       //  1 Am  pulso: agarrar el beat
      'F4:2 F4:2',                 //  2 F   los dos primeros saltos
      'C4:2 C5:2',                 //  3 C   LA ESCALERA: sube
      'G5:1 D5:1 B4:1 G4:1',       //  4 G   y la cascada de bordes baja
      'A4:2 A5:2',                 //  5 Am  hi-hat: sube a la meseta
      'F5:2 F5:2',                 //  6 F   se corre arriba y se baja
      'C4:2 C4:2',                 //  7 C   el bajo: el pico
      'G5:2 G5:2',                 //  8 G   la loma
      'A4:2 A5:2',                 //  9 Am  el pad: sube
      'F5:4',                      // 10 F   la ligadura sobre la meseta
      'C4:2 C4:1 C4:1',            // 11 C   doble: blanca, negra-negra
      'G4:2 G4:1 G4:1',            // 12 G
      'A4:1 A4:1 A4:1 A4:1',       // 13 Am  el break: ocho negras
      'F4:1 F4:1 F4:1 F4:1',       // 14 F
      'C4:4',                      // 15 C   aire: la ligadura larga
      'G4:1.5 G4:.5 G4:2',         // 16 G   el puntillo: la unica sincopa
      'A4:2 A5:1 A5:1',            // 17 Am  el clima: la meseta
      'F5:1 F5:1 F5:2',            // 18 F
      'C4:2 C5:2',                 // 19 C   la salida: la escalera otra vez
      'G5:1 D5:1 B4:1 G4:1'        // 20 G   y la cascada final
    ],
    secciones: [
      { x0: 0, n: 'salida' }, { x0: 4, n: 'pulso' }, { x0: 12, n: 'escalera' },
      { x0: 20, n: 'hi-hat' }, { x0: 28, n: 'bajo' }, { x0: 36, n: 'pad' },
      { x0: 44, n: 'doble' }, { x0: 52, n: 'break' }, { x0: 60, n: 'aire' },
      { x0: 68, n: 'todo' }, { x0: 76, n: 'salida' }
    ],
    // El arreglo entra por capas, calcado de esfera: pulso, escalera (entra el
    // bajo y el pad), hi-hat, bajo, pad, doble, el break de bombo solo, el
    // aire, todo junto, y la salida.
    plan (c) {
      if (c < 0 || c >= this.compases.length) return null;
      const base = { kick: [0, 2], snare: [1, 3], clap: [], hats: [], abierto: [], bajo: 'nada', pad: false, fill: false };
      if (c === 0) return { ...base, kick: [0, 1, 2, 3], snare: [], fill: true };
      if (c <= 2) return base;                                                  // pulso
      if (c <= 4) return { ...base, bajo: 'empuje', pad: true };                // escalera
      if (c <= 6) return { ...base, hats: OCHOS };                              // hi-hat
      if (c <= 8) return { ...base, hats: OCHOS, bajo: 'empuje' };              // bajo
      if (c <= 12) return { ...base, hats: OCHOS, bajo: 'empuje', pad: true };  // pad y doble
      if (c <= 14) return { ...base, kick: [0, 1, 2, 3], snare: [], fill: c === 14 };  // break
      if (c <= 16) return { ...base, snare: [], pad: true };                    // aire
      if (c <= 18) return { ...base, hats: OCHOS, bajo: 'empuje', pad: true };  // todo
      return { ...base, pad: true };                                            // salida
    }
  },

  // AURORA 2.0 — la composicion aprobada del estudio (estudio/, 6-jul), portada
  // a una sola voz. Primero el TEMA en notas largas (se aprende escuchando y
  // sosteniendo), despues el CORO dos veces (el gancho de verdad, con el galope
  // corchea-con-puntillo del synthwave), y el final que resuelve en La.
  aurora: {
    nombre: 'AURORA 2.0', bpm: 112,
    rielMin: 1.5,
    acordes: [
      'Am',
      'Am', 'F', 'C', 'G',
      'Am', 'F', 'C', 'G',
      'Am', 'F', 'C', 'G',
      'Am', 'F', 'C', 'G',
      'Am'
    ],
    compases: [
      '-:4',                                              //  0  entrada
      'E5:2 C5:1 A4:1',                                   //  1  Am  el tema, a lo grande
      'C5:4',                                             //  2  F   y se sostiene
      'E5:2 G5:1 E5:1',                                   //  3  C
      'D5:4',                                             //  4  G   pregunta sin resolver
      'E5:.75 E5:.75 C5:.5 A4:1 C5:.5 D5:.5',             //  5  Am  EL CORO: el galope
      'E5:.75 D5:.75 C5:.5 D5:1.5 C5:.25 D5:.25',         //  6  F
      'E5:.75 E5:.75 G5:.5 E5:1 D5:.5 C5:.5',             //  7  C
      'D5:1.5 B4:.5 D5:2',                                //  8  G   respiro colgado del re
      'E5:.75 E5:.75 C5:.5 A4:1 C5:.5 D5:.5',             //  9  Am  el coro otra vez
      'E5:.75 D5:.75 C5:.5 D5:1 E5:.5 F5:.5',             // 10  F   ahora sube
      'G5:.75 E5:.75 G5:.5 A5:1 G5:.5 E5:.5',             // 11  C   la cima del coro
      'D5:1.5 B4:.5 C5:.5 D5:1.5',                        // 12  G
      '-:4',                                              // 13  Am  SILENCIO: rodar
      'C5:1 D5:1 E5:1 G5:1',                              // 14  F   el final trepa
      'D5:.5 B4:.5 D5:3',                                 // 15  C
      'A5:4',                                             // 16  G   la nota mas alta del mapa
      'E5:1 C5:1 A4:2'                                    // 17  Am  y resuelve en la
    ],
    secciones: [
      { x0: 0, n: 'salida' }, { x0: 4, n: 'el tema' }, { x0: 20, n: 'el coro' },
      { x0: 36, n: 'el coro, mas arriba' }, { x0: 52, n: 'silencio · no toques' },
      { x0: 56, n: 'el final' }
    ],
    // El arreglo: el motor del estudio, como el viaje -- misma bateria,
    // mismo bajo sierra, mismo arpegio y pad. El tema respira, el coro entra
    // con crash y drive, el silencio deja el pad solo, y el final brilla.
    estudio (c) {
      if (c === 0) return { drums: 'cuenta' };
      if (c <= 2) return { drums: 'hats', arp: 'soft8', arpGan: 0.7, pad: true };            // el tema
      if (c <= 4) return { drums: 'preFill', bajo: 'pulso', arp: 'soft8', pad: true, riser: c === 4 ? 1 : 0 };
      if (c <= 12) return { drums: c % 4 === 0 ? 'fillTom' : 'coro', bajo: 'drive', arp: 'up16', pad: true, crash: c === 5 };  // el coro
      if (c === 13) return { drums: 'silencio', arp: 'soft8', arpGan: 0.6, pad: true };      // el silencio
      if (c <= 16) return { drums: 'coro', bajo: 'drive', arp: 'glitter', pad: true, crash: c === 14 };
      return { drums: 'outro', bajo: 'pulso', arp: 'glitter', pad: true, crash: true };      // el final
    }
  },

  // AURORA · EL VIAJE — la cancion ENTERA del estudio (64 compases), portada
  // por actos. Este es el ACTO 1: AMANECER (el tema, dos vueltas), MOTOR (el
  // build: sin melodia, pura expectativa -- techo y a rodar) y DESPEGUE, el
  // primer drop con el coro completo. Los actos que faltan (VUELO, GRAVEDAD,
  // DESPEGUE II, NEBULOSA, EMPUJE, SUPERNOVA, aterrizaje) van entrando de a
  // uno, cada uno con su mecanica. La ley del estudio: la partitura manda.
  viaje: {
    nombre: 'AURORA · EL VIAJE', bpm: 112,
    rielMin: 1.5,
    compases: [
      '-:4',                                              //  0  entrada
      'E5:2 C5:1 A4:1',                                   //  1  Am  AMANECER: el tema
      'C5:4',                                             //  2  F
      'E5:2 G5:1 E5:1',                                   //  3  C
      'D5:4',                                             //  4  G
      'E5:2 C5:1 A4:1',                                   //  5  Am  AMANECER II: otra vez,
      'C5:4',                                             //  6  F   la base crece
      'E5:2 G5:1 E5:1',                                   //  7  C
      'D5:4',                                             //  8  G
      'A4!:1 A4!:1 A4!:1 A4!:1',                          //  9  Am  MOTOR: la esfera
      'F4!:1 F4!:1 A4!:1 F4!:1',                          // 10  F   toca el BAJO --
      'F4!:1 A4!:1 D5!:1 A4!:1',                          // 11  Dm  teclas graves que
      'E4!:1 G4!:1 B4!:1 E5!:1',                          // 12  E   trepan al drop
      'E5:.75 E5:.75 C5:.5 A4:1 C5:.5 D5:.5',             // 13  Am  DESPEGUE · DROP 1
      'E5:.75 D5:.75 C5:.5 D5:1.5 C5:.25 D5:.25',         // 14  F
      'E5:.75 E5:.75 G5:.5 E5:1 D5:.5 C5:.5',             // 15  C
      'D5:1.5 B4:.5 D5:2',                                // 16  G
      'E5:.75 E5:.75 C5:.5 A4:1 C5:.5 D5:.5',             // 17  Am
      'E5:.75 D5:.75 C5:.5 D5:1 E5:.5 F5:.5',             // 18  F
      'G5:.75 E5:.75 G5:.5 A5:1 G5:.5 E5:.5',             // 19  C
      'D5:1.5 B4:.5 C5:.5 D5:1.5',                        // 20  G
      'A4:4'                                              // 21  Am  cierre del acto: La
    ],
    acordes: [
      'Am',
      'Am', 'F', 'C', 'G',
      'Am', 'F', 'C', 'G',
      'Am', 'F', 'Dm', 'E',
      'Am', 'F', 'C', 'G',
      'Am', 'F', 'C', 'G',
      'Am'
    ],
    secciones: [
      { x0: 0, n: 'salida' }, { x0: 4, n: 'amanecer' }, { x0: 20, n: 'amanecer II' },
      { x0: 36, n: 'motor · DRIBLEA al beat' }, { x0: 52, n: 'despegue · drop 1' },
      { x0: 84, n: 'aterrizaje del acto' }
    ],
    // MOTOR es zona de ARPEGIO: abajo de las teclas de bajo la red se corta
    // (fallar una tecla del motor se paga), y cada arco entre teclas lleva
    // tres orbes con las semicorcheas del up16. El bajo lo toca la esfera,
    // asi que el bajo de fondo calla aca.
    arpegios: [{ x0: 35.9, x1: 51.5 }],
    // y entre plataformas, de vez en cuando, un orbe suelto con OTRO
    // instrumento (hat, clap, chispa de arpegio): la esfera completa el
    // arreglo con el cuerpo tambien fuera del motor
    orbesExtra: true,
    // El arreglo NO se aproxima: usa el motor del estudio tal cual (banco de
    // patrones por semicorchea + voces calcadas). Cada compas dice que patron
    // toca cada capa, seccion a seccion como en estudio/index.html. En el
    // motor no hay `arp`: el arpegio lo driblea el jugador.
    estudio (c) {
      if (c === 0) return { drums: 'cuenta' };
      if (c <= 2) return { drums: 'silencio', arp: 'soft8', arpGan: 0.7, pad: true };          // amanecer
      if (c <= 4) return { drums: 'hats', arp: 'soft8', arpGan: 0.7, pad: true };
      if (c <= 7) return { drums: 'hats', bajo: 'pulso', arp: 'soft8', pad: true };            // amanecer II
      if (c === 8) return { drums: 'preFill', bajo: 'pulso', arp: 'soft8', pad: true };
      if (c <= 11) return { drums: 'coro', bajo: 'corchea', pad: true, riser: c === 11 ? 2 : 0 };  // motor
      if (c === 12) return { drums: 'roll', bajo: 'corchea', pad: true };
      if (c <= 20) return { drums: (c - 13) % 4 === 3 ? 'fillTom' : 'coro', bajo: 'drive', arp: 'up16', pad: true, crash: c === 13 };  // drop 1
      if (c === 21) return { drums: 'outro', bajo: 'pulso', arp: 'glitter', pad: true, crash: true };
      return null;
    }
  }
};

// --- el banco del estudio (calcado de estudio/index.html, sonido aprobado) ---
// Bateria por caracteres (16 pasos): k bombo · K bombo duro · s caja · c clap
// x k+s+c · h hat · H hat abierto · u/T/t toms · . nada.
const E_BATERIA = {
  cuenta: 'k...k...k...k...',
  silencio: '................',
  pulso: 'k.......k.......',
  hats: 'h...h...h...h.h.',
  preFill: 'h...h...h...s.s.',
  coro: 'k.h.x.h.k.h.x.h.',
  fillTom: 'k.h.x.h.k.u.T.t.',
  roll: 'k.s.s.s.ssssssss',
  outro: 'k.......x.......'
};
// Bajo y arpegio en numeros (16 pasos): semitonos sobre la raiz / grados de la
// triada. '.' = paso mudo.
const parsearPasos = s => s.trim().split(/\s+/).map(t => t === '.' ? null : +t);
const E_BAJO = {
  pulso: parsearPasos('0 . . . . . . . 0 . . . . . . .'),
  corchea: parsearPasos('0 . 0 . 0 . 0 . 0 . 0 . 0 . 0 .'),
  drive: parsearPasos('0 . 0 . 12 . 0 . 0 . 12 . 0 . 12 .'),
  verso: parsearPasos('0 . . 0 . . 12 . 0 . . 0 . 7 . .'),
  climb: parsearPasos('0 . 0 . 3 . 3 . 5 . 5 . 7 . 10 .')
};
const E_ARP = {
  up16: parsearPasos('0 1 2 3 0 1 2 3 0 1 2 3 0 1 2 3'),
  soft8: parsearPasos('0 . 2 . 3 . 2 . 0 . 2 . 3 . 2 .'),
  glitter: parsearPasos('3 . 4 . 5 . 4 . 3 . 4 . 5 . 6 .')
};
// El acorde como lo arma el estudio: raiz en octava 3 + intervalos de triada.
const E_RAIZ = { A: 220.00, B: 246.94, C: 130.81, D: 146.83, E: 164.81, F: 174.61, G: 196.00 };
const acordeEstudio = sym => ({
  root: E_RAIZ[sym[0]],
  ints: sym.endsWith('m') ? [0, 3, 7] : [0, 4, 7]
});
const acordeEnCompas = c => {
  const a = CANCIONES[CANCION_ID].acordes || ['Am'];
  return acordeEstudio(a[Math.max(0, Math.min(c, a.length - 1))]);
};

export const NIVELES = ['esfera', 'aurora', 'viaje'];   // el orden en el menu

// Los acordes disponibles: raiz del bajo + triada del pad. Esfera y aurora
// ciclan Am F C G; el viaje trae progresiones propias por seccion (el estudio
// usa Dm y E en los builds), asi que cada cancion puede declarar `acordes`,
// uno por compas, y armonia() los lee de ahi.
const ACORDE = {
  Am: { r: 110.00, acorde: [220.00, 261.63, 329.63] },
  F: { r: 87.31, acorde: [174.61, 220.00, 261.63] },
  C: { r: 130.81, acorde: [261.63, 329.63, 392.00] },
  G: { r: 98.00, acorde: [196.00, 246.94, 293.66] },
  Dm: { r: 73.42, acorde: [146.83, 174.61, 220.00] },
  E: { r: 82.41, acorde: [164.81, 207.65, 246.94] }
};
const armonia = c => {
  const propios = CANCIONES[CANCION_ID].acordes;
  if (propios) return ACORDE[propios[Math.max(0, Math.min(c, propios.length - 1))]];
  return ACORDE[['Am', 'F', 'C', 'G'][((c - 1) % 4 + 4) % 4]];
};

const CONTRA = [0.5, 1.5, 2.5, 3.5];                                  // el contratiempo
const OCHOS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
const DIECISEIS = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75];

export let CANCION_ID = null;
export let CANCION = null;
export let LARGO = 0;
let RIEL_MIN = 1.5;

// --- compilador: de la cancion al mapa --------------------------------------

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const semitono = n => SEMI[n[0]] + (+n.slice(1) + 1) * 12;
const frecuencia = n => 440 * Math.pow(2, (semitono(n) - 69) / 12);
const alturaDe = n => Y_GRAVE + (semitono(n) - semitono('E4')) * PASO_TONO;

// Tiempo minimo de vuelo para llegar a +dy CAYENDO (no subiendo): si llegas
// todavia subiendo atravesas la tecla por abajo y la perdes.
export function vueloMinimo (dy) {
  return dy > 0 ? Math.sqrt(2 * dy / G) * 1.08 + 0.02 : 0.05;
}

// Las tres gracias. Sin ellas hay que ser un robot: el toque humano llega
// antes o despues del contacto, casi nunca justo encima.
export const ANTICIPO = 0.8;    // cuanto vive un toque guardado esperando contacto
export const COYOTE = 0.18;     // tocaste apenas te fuiste del borde: vale igual
// Para atacar la nota que sigue a un riel hay que soltar y volver a apretar:
// con el boton hundido no hay toque nuevo. Asi que soltar sobre el final del
// riel no te tira -- la nota ya esta tocada, te deja salir como corresponde.
export const SUELTA = 0.4;
export const EN_COLA = 2;       // toques guardados a la vez: dos notas adelantadas

// Las gracias dejan que la nota SUENE aunque llegues torcido; la afinacion
// decide COMO suena. El toque se juzga donde lo diste, no donde se cobro: si
// no, adelantarse y que la esfera aterrice sola sonaria perfecto -- que es
// justo la trampa de martillar el boton.
// Calibrada contra Guitar Hero (+-100 ms de ventana total): el chueco marca lo
// claramente corrido, no lo humanamente impreciso. Con +-66 ms una mano decente
// escuchaba chueco un tercio de las veces -- eso se siente injusto, no dificil.
export const AFINADO = 0.18;    // +-96 ms: la nota sale limpia. Mas lejos, chueca.
// La firma de la trampa no es adelantarse, es la RAFAGA: dos toques pegados que
// no suenan. Nadie toca dos veces en 60 ms queriendo; el que martilla, si.
export const MARTILLO = 0.1;    // toques mas juntos que esto, y en falso, castigan
export const CASTIGO = 0.35;    // un toque en falso te deja sordo un rato

// Se apunta un poco adentro de la tecla, no al borde: cayendo justo sobre el
// canto la esfera pasa de largo por medio paso de integracion.
const MIRA = 0.05;
const TOL_BORDE = 0.03;
// Cuanto empieza la plataforma ANTES del pulso: el tramo que se rueda entre
// aterrizar y golpear. Sin el, aterrizar y tocar son el mismo instante.
export const ANTES = 0.22;

function compilar () {
  const notas = [];
  let b = 0;
  for (const compas of CANCION) {
    for (const tok of compas.trim().split(/\s+/)) {
      const [crudo, fig] = tok.split(':');
      const dur = parseFloat(fig);
      const silencio = crudo === '-';
      // 'A4!' es una tecla de BAJO: se para donde dice la altura, pero suena
      // dos octavas abajo con la voz del bajo -- la esfera cambia de instrumento
      const bajo = crudo.endsWith('!');
      const nombre = bajo ? crudo.slice(0, -1) : crudo;
      notas.push({
        i: notas.length, b, dur, nombre, silencio, bajo,
        f: silencio ? 0 : frecuencia(nombre),
        y: silencio ? 0 : alturaDe(nombre),
        xm: b,                 // el punto exacto: el pulso. Aca la nota sale afinada.
        x0: b, x1: b + dur
      });
      b += dur;
    }
  }
  // LA PLATAFORMA EMPIEZA ANTES DEL PULSO. Si arranca justo en el pulso, se
  // aterriza sobre el canto y hay que golpear en el mismo instante en que se
  // toca la tecla: eso no es tocar, es adivinar. Corriendola para atras se
  // aterriza, se rueda un poco, y se golpea al cruzar la marca -- que es lo que
  // hace la mano con un instrumento de verdad.
  for (const n of notas) {
    const ant = notas[n.i - 1];
    if (n.silencio || !ant) continue;
    // despues de un silencio sobra lugar: la rodada entera
    const hueco = ant.silencio ? Infinity : n.b - ant.b;
    n.x0 = n.xm - Math.min(ANTES, hueco * 0.35);
  }
  // ancho de cada tecla = ventana de tiempo, recortada para que el vuelo alcance
  for (const n of notas) {
    const sig = notas[n.i + 1];
    if (n.silencio) continue;
    n.riel = n.dur >= RIEL_MIN;
    n.escalera = !n.riel && n.dur <= 0.25 && sig && !sig.silencio &&
                 Math.abs(sig.y - n.y) <= 3 * PASO_TONO;
    const fin = sig ? sig.x0 : n.b + n.dur;
    if (n.escalera) n.x1 = sig.x0;                       // pegadas: se rueda
    else if (n.riel) n.x1 = fin;                         // se suelta al final
    else n.x1 = Math.min(n.b + Math.min(0.42, n.dur * 0.7), fin);
  }
  // Recorte por vuelo, al reves para que la tecla siguiente ya este medida.
  // Del toque MAS TARDE hay que poder aterrizar DENTRO de la que sigue, no
  // sobre su borde: llegar tarde es peor, no imposible. Con la regla vieja
  // --caer justo en el canto-- una corchea antes de un salto de cuarta se
  // quedaba sin ventana, y eso obligaba a escribir la melodia para que la
  // geometria la dejara pasar. Es al reves: el mapa sigue a la musica.
  for (let i = notas.length - 1; i >= 0; i--) {
    const n = notas[i], sig = notas[i + 1];
    if (n.silencio || n.escalera || !sig || sig.silencio) continue;
    const tv = vueloMinimo(sig.y - n.y);
    // El riel lanza solo al terminarse: su borde tiene que dar el vuelo JUSTO,
    // porque el jugador no elige cuando salir. Una tecla normal la lanza el,
    // asi que ahi alcanza con poder aterrizar adentro de la que sigue.
    n.x1 = Math.min(n.x1, n.riel ? sig.x0 + MIRA - tv : Math.max(sig.x0, sig.x1 - 0.06) - tv);
  }
  // LIGADURAS: de una nota larga a una corta mas grave no se vuelve a atacar,
  // se cae. El borde de la tecla se corre para que la caida libre aterrice
  // justo sobre la nota siguiente: dejarse caer ES tocarla.
  for (const n of notas) {
    const sig = notas[n.i + 1];
    if (n.silencio || !sig || sig.silencio) continue;
    // a una carrera no se cae ligado: se entra rodando, o se rompe la carrera
    if (n.escalera || sig.escalera) continue;
    if (n.dur < 1 || sig.dur > 0.5 || sig.y >= n.y) continue;
    const caida = Math.sqrt(2 * (n.y - sig.y) / G);
    const borde = sig.xm - caida;                        // la caida cae en el pulso
    if (borde < n.x0 + 0.14) continue;                   // sin ventana no hay ligadura
    // nunca mas alla del borde de la que sigue: si la caida es mas corta que el
    // tramo de rodada, se sale igual al final de la tecla y se cae adentro
    n.ligada = true; n.x1 = Math.min(borde, sig.x0);
    sig.porCaida = true; sig.desde = n.f;
  }
  // Correr las plataformas para atras puede hacer que una tecla pise a la que
  // sigue: ninguna puede pasar del borde de la proxima.
  for (const n of notas) {
    const sig = notas[n.i + 1];
    if (sig) n.x1 = Math.min(n.x1, sig.x0);
  }
  // La entrada no empieza abajo en la red: empieza ARRIBA, en una plataforma a
  // la altura de la primera nota, que al terminarse te lanza directo a ella. El
  // primer gesto del juego pasa a ser tocar una nota, no trepar desde el piso.
  const primera = notas.find(n => !n.silencio);
  if (primera && notas[0].silencio && notas[0].i === 0) {
    const p = notas[0];
    p.piso = true; p.y = primera.y; p.x1 = primera.x0 - 0.6;
  }
  return notas;
}

export let NOTAS = [];
export let TOTAL_NOTAS = 0;
export let PISO = null;            // la plataforma de salida

// --- el terreno, deducido de la cancion -------------------------------------

// Los abismos van debajo de los rieles de la segunda mitad: ahi mantener vale
// la vida. Se deducen de la partitura -- estaban escritos a mano y cada vez que
// se tocaba la melodia quedaban debajo de cualquier cosa.
export let HUECOS = [];
export const enHueco = x => HUECOS.some(h => x > h.x0 && x < h.x1);

// Zonas de DRIBLEO: tramos sin melodia donde la seccion trae arpegio. Ahi la
// red es el instrumento: picar la esfera al beat dispara la rafaga del acorde.
export let ARPEGIOS = [];
export const enArpegio = x => ARPEGIOS.some(z => x > z.x0 && x < z.x1);

// Los ORBES del arpegio: cuerpos flotantes sobre el arco ideal de cada pique.
// El pique pone la raiz y elige el arco; las otras tres semicorcheas se tocan
// CON EL CUERPO: la esfera las atraviesa o no suenan. Pique fino = el arco
// enhebra los tres; corrido = pasa por otro lado y esas notas quedan mudas.
export let ORBES = [];
// Pasos de semicorchea cuyos golpes fueron RECLAMADOS por un orbe: el fondo
// los calla y solo suenan si la esfera atraviesa su orbe. Asi el orbe no
// agrega sonidos: completa los que la cancion ya tiene.
export let PASOS_BATERIA = new Set();
export let PASOS_BAJO = new Set();
function orbes () {
  const r = [];
  PASOS_BATERIA = new Set(); PASOS_BAJO = new Set();
  const extra = !!CANCIONES[CANCION_ID].orbesExtra;
  const spec = CANCIONES[CANCION_ID].estudio;
  if (!ARPEGIOS.length && !extra) return r;
  let salto = 0;
  for (const n of NOTAS) {
    const sig = NOTAS[n.i + 1];
    if (n.silencio || !sig || sig.silencio) continue;
    if (n.escalera || sig.escalera || n.ligada) continue;
    // el arco ideal: el mismo que calcula lanzar() desde el toque en el pulso
    const x0 = n.riel ? n.x1 : n.xm, y0 = n.y;
    const tv = vueloMinimo(sig.y - y0);
    let obj = sig.x0 + MIRA;
    if (obj - x0 < tv) obj = Math.min(sig.x1 - 0.02, x0 + tv);
    const T = obj - x0;
    if (T < 0.3) continue;
    const vy = Math.min(1.9, (sig.y - y0) / T + G * T / 2);
    const arco = dt => y0 + vy * dt - G * dt * dt / 2;
    if (enArpegio(n.xm)) {
      // en la zona de arpegio: las tres semicorcheas del up16, cada arco
      for (let k = 1; k <= 3; k++) {
        const dt = T * k / 4;
        r.push({ i: r.length, x: +(x0 + dt).toFixed(3), y: +arco(dt).toFixed(3), n: k, c: Math.floor(n.b / 4), instr: 'arp' });
      }
    } else if (extra && spec && T >= 0.5) {
      // Ocasional entre plataformas: se busca un golpe REAL de la cancion que
      // caiga dentro del vuelo (hat, clap, caja o nota del bajo), el mas
      // cercano a la cima del arco. Ese golpe queda reclamado: el fondo lo
      // calla y lo suena la esfera al atravesarlo -- o nadie.
      const p0 = Math.ceil((x0 + 0.12) * 4), p1 = Math.floor((obj - 0.12) * 4);
      let mejor = null;
      for (let p = p0; p <= p1; p++) {
        const cc = Math.floor(p / 16), i16 = p % 16;
        const pl = spec(cc); if (!pl) continue;
        const bat = E_BATERIA[pl.drums];
        const golpe = bat && 'hHsc'.includes(bat[i16]) ? bat[i16] : null;
        const nb = pl.bajo && E_BAJO[pl.bajo] ? E_BAJO[pl.bajo][i16] : null;
        if (golpe == null && nb == null) continue;
        const dt = p / 4 - x0, d = Math.abs(dt - T / 2);
        if (!mejor || d < mejor.d) mejor = { p, golpe, nb, dt, d, cc };
      }
      if (mejor && ++salto % 2 === 0) {
        const o = { i: r.length, x: +(mejor.p / 4).toFixed(3), y: +arco(mejor.dt).toFixed(3), c: mejor.cc };
        // se alterna: bajo cuando lo hay cada dos, si no el golpe de bateria
        if (mejor.nb != null && (salto % 4 === 0 || mejor.golpe == null)) {
          o.instr = 'bajo'; o.semi = mejor.nb; PASOS_BAJO.add(mejor.p);
        } else {
          o.instr = mejor.golpe; PASOS_BATERIA.add(mejor.p);
        }
        r.push(o);
      }
    }
  }
  return r.sort((a, b) => a.x - b.x);
}

// Techo sobre el silencio largo: ahi tocar mata. Se corta antes del final para
// que el resorte de reenganche quede libre y se pueda volver a subir.
// Donde vuelve a subir despues de un silencio: lo mas tarde posible que todavia
// alcanza a llegar a la nota que sigue. Sale de la partitura, asi que mover una
// nota mueve el resorte con ella.
function reenganche (n) {
  const sig = NOTAS[n.i + 1];
  if (!sig || sig.silencio) return null;
  return +(sig.x0 - vueloMinimo(sig.y) - 0.2).toFixed(3);
}

// Empieza recien cuando la esfera ya toco la red --antes la mataria mientras
// todavia cae de la ultima nota, sin haber hecho nada-- y termina antes del
// reenganche, para que quede lugar para volver a subir.
const calcularTechos = () => NOTAS
  .filter(n => n.silencio && !n.piso && n.dur >= 2 && reenganche(n) &&
    // en una zona de dribleo el silencio se JUEGA (se pica al beat): sin techo
    !ARPEGIOS.some(z => n.x0 < z.x1 && n.x0 + n.dur > z.x0))
  .map(n => {
    const ant = NOTAS[n.i - 1];
    const caida = ant && !ant.silencio ? Math.sqrt(2 * ant.y / G) : 0.4;
    return {
      x0: +(n.x0 + caida + 0.25).toFixed(3),
      x1: +(reenganche(n) - 0.35).toFixed(3),
      y: 0.19
    };
  });
export let TECHOS = [];

// Resortes: reenganche despues de un silencio y rescate si te caiste a la red.
// Son una ZONA, no un punto: pisarla en cualquier parte te devuelve arriba. Un
// punto exacto se esquiva sin querer -- o peor, se salta a proposito creyendo
// que es un obstaculo, que fue justo lo que paso la primera vez que lo jugo
// alguien que no lo habia visto antes.
export const RESORTE_ANTES = 0.3, RESORTE_DESPUES = 0.55;

function resortes () {
  const r = [];
  const enSilencio = x => NOTAS.some(n => n.silencio && x >= n.x0 && x < n.x0 + n.dur);
  const candidatos = [];
  for (const n of NOTAS) if (n.silencio && reenganche(n)) candidatos.push(reenganche(n));
  for (let x = 4; x < LARGO - 4; x += 4) if (!enSilencio(x)) candidatos.push(x); // rescate
  for (const x of candidatos) {
    // dentro de una zona de dribleo no hay resorte: ahi la red se juega
    // picando, y un resorte automatico secuestraria el rebote
    if (enArpegio(x)) continue;
    if (enHueco(x - RESORTE_ANTES) || enHueco(x + RESORTE_DESPUES)) continue;
    if (enHueco(x) || TECHOS.some(t => x > t.x0 - 0.2 && x < t.x1 + 0.2)) continue;
    const destino = NOTAS.find(n => !n.silencio && n.x0 - x >= vueloMinimo(n.y) && n.x0 - x <= 3.2);
    if (destino) r.push({
      x: +x.toFixed(3), destino: destino.i,
      x0: +(x - RESORTE_ANTES).toFixed(3), x1: +(x + RESORTE_DESPUES).toFixed(3)
    });
  }
  return r.sort((a, b) => a.x - b.x);
}
export let RESORTES = [];
export let SECCIONES = [];

// Elegir cancion recompila TODO: la partitura, el mapa y el terreno deducido.
// Es la unica puerta -- nadie escribe NOTAS ni HUECOS de afuera.
export function elegirCancion (id) {
  const c = CANCIONES[id];
  if (!c) throw new Error(`cancion desconocida: ${id}`);
  CANCION_ID = id;
  BPM = c.bpm; SPB = 60 / BPM;
  RIEL_MIN = c.rielMin;
  CANCION = c.compases;
  LARGO = CANCION.length * 4;
  NOTAS = compilar();
  TOTAL_NOTAS = NOTAS.filter(n => !n.silencio).length;
  PISO = NOTAS[0] && NOTAS[0].piso ? NOTAS[0] : null;
  ARPEGIOS = c.arpegios || [];
  HUECOS = NOTAS
    .filter(n => n.riel && n.b >= LARGO / 2 && n.x1 - n.x0 > 1.2)
    .map(n => ({ x0: +(n.x0 + 0.7).toFixed(3), x1: +(n.x1 - 0.1).toFixed(3) }));
  // La zona de dribleo se sostiene PICANDO: entre pad y pad la red se corta.
  // Pasarla sin driblear no existe -- rodar te lleva al abismo. Picar corrido
  // no te tira (el bote se corrige al proximo pad): el espacio perdona, el
  // sonido no.
  for (const z of ARPEGIOS)
    for (let bx = Math.ceil(z.x0); bx < z.x1 - 0.6; bx++)
      HUECOS.push({ x0: +(bx + 0.3).toFixed(3), x1: +(bx + 0.7).toFixed(3) });
  TECHOS = calcularTechos();
  RESORTES = resortes();
  ORBES = orbes();
  SECCIONES = c.secciones;
}
export const nombreCancion = id => CANCIONES[id || CANCION_ID].nombre;
const planCompas = c => CANCIONES[CANCION_ID].plan(c);

elegirCancion('aurora');   // el default de siempre: los tests corren contra esta

// --- simulacion --------------------------------------------------------------

export function crearSim () {
  return {
    x: 0, y: PISO ? PISO.y : 0, vy: 0,
    estado: 'apoyada',      // 'apoyada' | 'aire'
    tecla: PISO ? PISO.i : -1,   // indice en NOTAS, o -1 = la red
    viva: true, meta: false, causa: null,
    sostiene: false,
    saliendoDe: -1,         // tecla recien lanzada: no se puede volver a posar en ella
    ligadaDe: -1,           // te dejaste caer desde esta: la caida cobra la nota
    anticipos: [],          // toques que todavia no encontraron tecla
    apretadoEn: -Infinity,  // donde empezo el apriete: distingue toque de sostenido
    falsoEn: -Infinity,     // el ultimo toque en falso: los seguidos agravan el castigo
    castigoNivel: 0,
    coyote: null,           // tecla recien abandonada, todavia tocable
    bloqueo: -Infinity,     // hasta donde no responde el boton: castigo por martillar
    ultimoToque: -Infinity, // para distinguir un toque adelantado de una rafaga
    tocadas: new Set(),
    limpias: new Set(),     // las que ademas sonaron afinadas: ese es el puntaje
    racha: 0, mejorRacha: 0, falsos: 0,
    resortesUsados: new Set(),
    orbes: 0, orbesTocados: new Set(),   // los orbes cosechados en el aire
    eventos: []
  };
}

function despegar (s, dejando = null) {
  s.estado = 'aire'; s.tecla = -1;
  // sin esto, soltar un riel por el medio vuelve a posarse en el mismo riel
  if (dejando) s.saliendoDe = dejando.i;
  s.coyote = dejando && !dejando.riel && !dejando.silencio && !s.tocadas.has(dejando.i)
    ? { i: dejando.i, hasta: s.x + COYOTE } : null;
}

function lanzar (s, desde) {
  const sig = NOTAS[desde.i + 1];
  s.estado = 'aire'; s.tecla = -1; s.saliendoDe = desde.i;
  // si saltaste sin haber sonado esta tecla, todavia la podes cobrar un ratito
  s.coyote = !desde.riel && !desde.silencio && !s.tocadas.has(desde.i)
    ? { i: desde.i, hasta: s.x + COYOTE } : null;
  if (!sig || sig.silencio) { s.vy = 0; return; }        // al silencio se cae solo
  // Se apunta al principio de la tecla siguiente; si se toco tarde y ya no da
  // el tiempo de vuelo, se apunta mas adentro: llegar tarde, no fallar.
  let destino = sig;
  let tv = vueloMinimo(sig.y - s.y);
  // Ir tarde no puede perseguirte nota a nota. Si el vuelo minimo ya te deja
  // pasado de la ventana afinada de la siguiente, esa nota esta perdida de
  // antemano -- y aterrizar tarde en ella te dejaba tarde para la otra, y asi
  // hasta el final. Entonces se la saltea: se aterriza CON RODADA en la que
  // sigue, como un musico que deja pasar una nota para volver al tiempo.
  const sig2 = NOTAS[sig.i + 1];
  if (s.x + tv > sig.xm + AFINADO && sig2 && !sig2.silencio && !sig2.escalera && !sig.riel) {
    const tv2 = vueloMinimo(sig2.y - s.y);
    if (sig2.x0 + MIRA - s.x >= tv2) { destino = sig2; tv = tv2; }
  }
  let objetivo = destino.x0 + MIRA;
  if (objetivo - s.x < tv) objetivo = Math.min(destino.x1 - 0.02, s.x + tv);
  const T = Math.max(0.06, objetivo - s.x);
  s.vy = Math.min(1.9, (destino.y - s.y) / T + G * T / 2);
}

// Una carrera es un grupo de escalones pegados (las semicorcheas).
const enCarrera = k => k.escalera || !!(NOTAS[k.i - 1] && NOTAS[k.i - 1].escalera);

// Que nota suena al tocar parado sobre k. En una carrera los escalones son mas
// angostos que la mano: se tocan EN ORDEN, como en un instrumento de verdad,
// no segun el peldaño exacto donde caiste.
function queSuena (s, k) {
  if (!enCarrera(k)) return s.tocadas.has(k.i) ? null : k;
  let n = k;
  while (NOTAS[n.i - 1] && NOTAS[n.i - 1].escalera) n = NOTAS[n.i - 1];   // al inicio
  while (n && enCarrera(n) && s.tocadas.has(n.i)) n = NOTAS[n.i + 1];
  if (!n || !enCarrera(n)) return null;
  // La nota de SALIDA de la carrera (la primera que no es escalon) solo suena
  // pisandola: su toque es tambien su salto. Sonarla desde un escalon anterior
  // la consumia sin lanzar, y el toque siguiente llegaba despues del borde.
  if (!n.escalera && n.i !== k.i) return null;
  return n;
}

// Cobra una nota y decide si salio afinada. La nota SIEMPRE suena --  callarla
// seria castigar con silencio, y eso ya lo descartamos-- pero sonar chueco es
// audible al instante, que es como se entera un guitarrista de que llego tarde.
function anotar (s, obj, dev, tipo, extra = {}) {
  const chueca = Math.abs(dev) > AFINADO;
  s.tocadas.add(obj.i);
  if (chueca) s.racha = 0;
  else { s.limpias.add(obj.i); s.racha++; s.mejorRacha = Math.max(s.mejorRacha, s.racha); }
  s.eventos.push({ tipo, f: obj.f, x: s.x, y: s.y, i: obj.i, tarde: dev, chueca, ...extra });
}

// El toque efectivo sobre una tecla. `xt` es DONDE se apreto el boton, que no
// siempre es donde se cobra: un toque adelantado espera en la cola y se paga al
// posarse, pero se juzga por el momento en que lo diste.
function pulsar (s, k, xt = s.x) {
  if (k.riel || k.silencio) return false; // el riel se sostiene; la salida no suena
  const obj = queSuena(s, k);
  if (obj) anotar(s, obj, xt - obj.xm, 'nota');
  if (!k.escalera && !k.ligada) lanzar(s, k);   // de una ligada se sale cayendo
  return !!obj;
}

function posarse (s, yAntes) {
  let mejor = null, mejorY = -Infinity;
  for (const k of NOTAS) {
    if ((k.silencio && !k.piso) || k.i === s.saliendoDe) continue;
    if (s.x < k.x0 - TOL_BORDE || s.x > k.x1) continue;
    if (yAntes >= k.y - 1e-9 && s.y <= k.y && k.y > mejorY) { mejor = k; mejorY = k.y; }
  }
  if (mejor) {
    s.estado = 'apoyada'; s.tecla = mejor.i; s.y = mejor.y; s.vy = 0;
    s.coyote = null; s.saliendoDe = -1;
    s.eventos.push({ tipo: 'posar', x: s.x, y: mejor.y, riel: !!mejor.riel });
    // caiste ligado desde la nota anterior: la caida misma la toca, y sigue
    if (mejor.porCaida && s.ligadaDe === mejor.i - 1) {
      s.ligadaDe = -1;
      // la ligadura la toca la caida, no la mano: sale afinada por geometria
      if (!s.tocadas.has(mejor.i)) anotar(s, mejor, s.x - mejor.xm, 'ligada', { desde: mejor.desde });
      lanzar(s, mejor);
      return;
    }
    s.ligadaDe = -1;
    drenar(s);                                   // los toques adelantados entran aca
    return;
  }
  if (!enHueco(s.x) && yAntes >= -1e-9 && s.y <= 0) {
    s.estado = 'apoyada'; s.tecla = -1; s.y = 0; s.vy = 0;
    s.eventos.push({ tipo: 'red', x: s.x, y: 0 });
  }
}

export function paso (s, dt) {
  if (!s.viva || s.meta) return;
  s.x += dt;

  if (s.estado === 'apoyada' && s.tecla >= 0) {
    const k = NOTAS[s.tecla];
    s.y = k.y;
    // agarrar el riel tarde tambien desafina: la nota larga entra corrida
    if (k.riel && s.sostiene && s.x >= k.xm && !s.tocadas.has(k.i))
      anotar(s, k, s.x - k.xm, 'riel', { hasta: k.x1 });
    if (k.riel && !s.sostiene && s.x > k.x0 + GRACIA_RIEL && s.x < k.x1 - SUELTA) {
      if (s.tocadas.has(k.i)) s.eventos.push({ tipo: 'rielCorta' });
      despegar(s, k);
    } else if (s.x > k.x1) {
      if (k.ligada) {                     // no se vuelve a atacar: se cae ligado
        if (k.riel) s.eventos.push({ tipo: 'rielCorta' });
        if (s.tocadas.has(k.i)) s.ligadaDe = k.i;   // solo se liga lo que sonaste
        s.vy = 0; despegar(s, k);
      } else if (k.riel || k.piso) {          // el riel y la salida lanzan solos
        if (k.riel) s.eventos.push({ tipo: 'rielCorta' });
        lanzar(s, k);
      }
      else if (k.escalera) { s.tecla = k.i + 1; s.y = NOTAS[s.tecla].y; drenar(s); }
      else despegar(s, k);
    }
  } else if (s.estado === 'apoyada') {
    s.y = 0;
    if (enHueco(s.x)) despegar(s);
    else for (const r of RESORTES) {
      if (s.x > r.x0 && s.x < r.x1 && !s.resortesUsados.has(r.x)) {
        s.resortesUsados.add(r.x);
        // el destino se recalcula DESDE DONDE se piso: el de la partitura se
        // eligio desde el centro del trampolin, y lanzado desde el borde
        // lejano el vuelo no daba y la esfera caia de vuelta a la red
        const k = NOTAS.find(n => !n.silencio && !s.tocadas.has(n.i) &&
          n.x0 + MIRA - s.x >= vueloMinimo(n.y)) || NOTAS[r.destino];
        const T = Math.max(0.2, k.x0 + MIRA - s.x);
        s.estado = 'aire'; s.tecla = -1;
        s.vy = Math.min(1.9, k.y / T + G * T / 2);
        s.eventos.push({ tipo: 'resorte', x: r.x, y: 0 });
        break;
      }
    }
  }

  if (s.estado === 'aire') {
    s.vy -= G * dt;
    const yAntes = s.y;
    s.y += s.vy * dt;
    // los orbes del arpegio se tocan con el cuerpo: pasar por donde estan ES
    // sonarlos. El que el arco no atraviesa, no suena.
    for (const o of ORBES) {
      if (o.x < s.x - 0.12 || o.x > s.x + 0.12) continue;
      if (s.orbesTocados.has(o.i)) continue;
      if (Math.abs(s.x - o.x) < 0.09 && Math.abs(s.y - o.y) < R) {
        s.orbesTocados.add(o.i); s.orbes++;
        s.eventos.push({ tipo: 'orbe', x: o.x, y: o.y, n: o.n, c: o.c });
      }
    }
    if (s.vy < 0) posarse(s, yAntes);
  }

  if (s.y < CAIDA_MUERTE) { s.viva = false; s.causa = 'hueco'; return; }
  for (const t of TECHOS) {
    if (s.x > t.x0 && s.x < t.x1 && s.y + 2 * R > t.y) { s.viva = false; s.causa = 'techo'; return; }
  }
  if (s.x >= LARGO) s.meta = true;
}

// Gasta un toque en el estado actual. Devuelve si sono una nota; si no sono,
// el toque no se pierde: se guarda para el proximo contacto.
function aplicar (s, xt = s.x) {
  if (s.estado !== 'apoyada') {
    if (s.coyote && s.x <= s.coyote.hasta) {      // te fuiste del borde hace nada
      const k = NOTAS[s.coyote.i];
      s.coyote = null;
      return pulsar(s, k, xt);
    }
    return false;
  }
  // En la red: TOCAR es el reenganche. La esfera se relanza sola hacia la
  // proxima tecla, como un resorte pero a pedido -- caerse cuesta la nota
  // perdida, no el tramo hasta el rescate. El salto no suena: la nota nueva
  // hay que tocarla al pisarla, asi que esto no regala puntaje. Devuelve true
  // para consumir el toque -- si quedara en la cola de anticipos, se cobraria
  // al aterrizar como una nota juzgada desde la red, chueca seguro.
  if (s.tecla < 0) {
    // ...pero nunca a traves de un techo: ese arco se estrella. Si la proxima
    // tecla queda del otro lado de un silencio con techo, el toque es el
    // saltito de siempre, y del silencio te saca el resorte.
    const k = NOTAS.find(n =>
      !n.silencio && n.x0 + MIRA > s.x + 0.2 &&
      !TECHOS.some(t => (n.x0 > t.x0 - 0.3 && n.x0 < t.x1) || (t.x0 > s.x && t.x0 < n.x0)));
    s.estado = 'aire';
    if (k) {
      const T = Math.max(0.2, k.x0 + MIRA - s.x);
      s.vy = Math.min(1.9, (k.y - s.y) / T + G * T / 2);
    } else s.vy = 0.62;
    s.eventos.push({ tipo: 'saltoRed' });
    return true;
  }
  return pulsar(s, NOTAS[s.tecla], xt);   // los rieles devuelven false: se sostienen
}

// Al posarse se cobran los toques guardados, en orden. Si el primero ademas
// lanza, el que sobra espera el proximo contacto: un toque, una nota.
function drenar (s) {
  while (s.anticipos.length && s.estado === 'apoyada' && s.tecla >= 0) {
    if (s.x - s.anticipos[0] > ANTICIPO) { s.anticipos.shift(); continue; }
    if (!aplicar(s, s.anticipos[0])) break;   // no sono: el toque sigue esperando
    s.anticipos.shift();
  }
}

// Soltar un sostenido tambien articula. Sin esto, salir de un riel es
// imposible: el boton ya esta hundido y no hay toque nuevo que dar.
export function soltar (s) {
  s.sostiene = false;
  if (!s.viva || s.meta) return;
  if (s.x - s.apretadoEn < GRACIA_RIEL) return;      // fue un toque, no un sostenido
  if (s.estado !== 'apoyada' || s.tecla < 0) return;
  const k = NOTAS[s.tecla];
  if (k.riel || s.tocadas.has(k.i)) return;
  pulsar(s, k);
}

// Un falso aislado cuesta CASTIGO y nada mas: es un dedo que se resbalo. Los
// falsos SEGUIDOS son el martilleo, y cada uno agrava el que sigue -- si el
// castigo fuera siempre igual, en una cancion de negras la sordera expiraba
// antes de la proxima nota y el spam se recuperaba gratis.
function castigar (s) {
  s.castigoNivel = s.x - s.falsoEn < 1.2 ? Math.min(4, s.castigoNivel + 1) : 0;
  s.falsoEn = s.x;
  s.bloqueo = s.x + CASTIGO * (1 + s.castigoNivel);
  s.racha = 0; s.falsos++;
  s.eventos.push({ tipo: 'falso', x: s.x, y: s.y });
}

export function tocar (s, b) {
  if (!s.viva || s.meta) return;
  s.apretadoEn = s.x;
  if (s.x < s.bloqueo) { s.eventos.push({ tipo: 'sordo' }); return; }
  const rafaga = s.x - s.ultimoToque < MARTILLO;
  s.ultimoToque = s.x;
  // la plataforma de salida no es una nota: tocar ahi no suena ni cuenta
  const bajo = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
  if (bajo && bajo.piso) { s.eventos.push({ tipo: 'aire' }); return; }
  if (aplicar(s)) return;
  // Martillar no es adelantarse. Un toque en falso pegado al anterior corta la
  // racha y deja el boton sordo. Sin esto se termina el nivel a puro spam: la
  // esfera aterriza sola sobre cada tecla, asi que el toque siempre cae bien y
  // el ritmo -- que es el juego entero -- deja de importar.
  if (rafaga) { castigar(s); return; }
  // Adelantarse es el error humano normal y no puede costar la cadena entera.
  // Pero DESBORDAR la cola no es adelantarse: ya hay dos toques esperando nota,
  // y un tercero solo lo da el que martilla. Se descartaba gratis, y en una
  // cancion de negras eso alcanzaba para puntuar sin mirar el ritmo -- la cola
  // convertia el spam en toques bien juzgados al posarse.
  if (s.anticipos.length < EN_COLA) { s.anticipos.push(s.x); s.eventos.push({ tipo: 'aire' }); return; }
  castigar(s);
}

if (typeof document !== 'undefined') arrancarNavegador();

// ---------------------------------------------------------------------------
// Navegador: render + audio
// ---------------------------------------------------------------------------

function arrancarNavegador () {
  const cv = document.getElementById('lienzo');
  const cx = cv.getContext('2d');
  const hud = document.getElementById('hud');

  const C = {
    fondo: '#111214',
    red: 'rgba(232,230,224,0.20)',
    peligro: 'rgb(232,230,224)',
    esfera: 'rgb(255,179,71)',
    esferaRGB: '255,179,71',
    tecla: 'rgba(120,190,255,0.55)',
    teclaRGB: '120,190,255',
    sucia: 'rgba(150,140,130,0.7)',       // sono, pero chueca: no brilla
    suciaRGB: '170,150,130',
    impulso: 'rgb(120,230,150)',          // verde: esto AYUDA, no es un obstaculo
    impulsoRGB: '120,230,150',
    tenue: 'rgba(232,230,224,0.18)'
  };

  let s = crearSim();
  let intento = 1, mejor = 0;
  let ac = null, master = null, voz = null, t0 = 0, proxBeat = 0;
  let corriendo = false, finSonado = false;

  const estela = [], particulas = [], destellos = [], desvios = [];
  const avisos = [], marcas = [];     // cuanto te corriste, dicho y dibujado
  let squash = 0, flash = 0, rielVoz = null;

  const ahora = () => ac ? (ac.currentTime - t0) / SPB : 0;

  // --- sintesis --------------------------------------------------------------

  function arrancarAudio () {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ac.createDynamicsCompressor();
      master = ac.createGain();
      master.gain.value = 0.8;
      master.connect(comp).connect(ac.destination);
      // La melodia va SECA y al frente. Nada de eco ni de voces desafinadas:
      // el apreton tiene que ser la nota, una a una, o deja de sentirse que
      // la estas tocando vos.
      voz = ac.createGain();
      voz.gain.value = 1;
      voz.connect(master);
    }
    ac.resume();
    t0 = ac.currentTime + 0.12;
    proxBeat = 0;
    finSonado = false;
  }

  function golpe (t, f, dur, gan, tipo = 'sine') {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(gan, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur);
  }
  // El ruido va FILTRADO. El blanco pelado es lo que hacia sonar a lata la
  // bateria entera: la caja, el hat y el clap eran el mismo siseo con distinta
  // envolvente. Con un filtro cada uno tiene su registro y aparece el groove.
  function ruido (t, dur, gan, filtro = null, f = 1000, Q = 1) {
    const n = Math.max(1, ac.sampleRate * dur | 0), buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource(); src.buffer = buf;
    const g = ac.createGain(); g.gain.value = gan;
    if (filtro) {
      const bq = ac.createBiquadFilter();
      bq.type = filtro; bq.frequency.value = f; bq.Q.value = Q;
      src.connect(bq).connect(g).connect(master);
    } else src.connect(g).connect(master);
    src.start(t);
  }
  function kick (t) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(135, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.10);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.8, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.30);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.34);
  }
  const snare = (t, gan = 0.3) => {
    ruido(t, 0.15, gan, 'bandpass', 1900, 0.8);
    golpe(t, 185, 0.07, 0.11, 'triangle');
  };
  const clap = t => {
    for (const [d, g] of [[0, 0.15], [0.014, 0.12], [0.032, 0.16]])
      ruido(t + d, 0.07, g, 'bandpass', 1500, 0.9);
  };
  const hat = (t, abierto) =>
    ruido(t, abierto ? 0.15 : 0.045, abierto ? 0.13 : 0.10, 'highpass', 8200);

  // El bajo es el peso de la cancion: sierra por un pasabajos con resonancia
  // que se cierra. Era un triangulo pelado y por eso no empujaba nada.
  function bajo (t, f, dur = 0.24, gan = 0.3) {
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(460, t);
    lp.frequency.exponentialRampToValueAtTime(150, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gan, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // La base se corre para atras: es el fondo, la melodia sos vos. Triangulos
  // por un pasabajos, no sierras: una sierra detras de la melodia es serrucho.
  function acordePad (t, notas, dur, gan = 0.03) {
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1300;
    lp.connect(master);
    for (const f of notas) for (const det of [-5, 5]) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gan, t + 0.4);
      g.gain.setValueAtTime(gan, t + dur - 0.5);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(lp);
      o.start(t); o.stop(t + dur);
    }
  }

  // --- las voces del ESTUDIO, calcadas: para las canciones portadas tal cual --
  // Mismo diseño de sonido que estudio/index.html (aprobado 6-jul), escalado x2
  // para convivir con la voz del jugador. `duckE` es el sidechain: el bombo
  // hunde bajo/arpegio/pad un instante y eso ES el pump del synthwave.
  let duckE = null;
  const busE = () => {
    if (!duckE) { duckE = ac.createGain(); duckE.connect(master); }
    return duckE;
  };
  const EG = 2.5;
  function eBeep (t, f, dur, tipo, gan, slide, alBus) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = tipo || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(gan, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(alBus ? busE() : master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function eKick (t, duro) {
    eBeep(t, duro ? 165 : 135, 0.13, 'sine', (duro ? 0.13 : 0.105) * EG, 42);
    ruido(t, 0.025, 0.02 * EG, 'lowpass', 2600);
    const g = busE().gain;
    g.cancelScheduledValues(t); g.setValueAtTime(1, t);
    g.linearRampToValueAtTime(0.42, t + 0.012); g.linearRampToValueAtTime(1, t + 0.24);
  }
  const eSnare = t => {
    ruido(t, 0.09, 0.05 * EG, 'highpass', 1700);
    ruido(t, 0.16, 0.024 * EG, 'bandpass', 900);
    eBeep(t, 195, 0.05, 'triangle', 0.032 * EG);
  };
  const eHat = (t, abierto) =>
    ruido(t, abierto ? 0.09 : 0.028, (abierto ? 0.02 : 0.017) * EG, 'highpass', 7200);
  const eClap = t => {
    ruido(t, 0.03, 0.045 * EG, 'bandpass', 1500);
    ruido(t + 0.012, 0.03, 0.04 * EG, 'bandpass', 1500);
    ruido(t + 0.026, 0.13, 0.05 * EG, 'bandpass', 1200);
  };
  const eCrash = t => ruido(t, 0.55, 0.045 * EG, 'highpass', 4200);
  const eTom = (t, f) => { eBeep(t, f, 0.2, 'sine', 0.095 * EG, f * 0.45); ruido(t, 0.02, 0.012 * EG, 'lowpass', 1800); };
  function eBajo (t, f, gan) {
    const filtro = ac.createBiquadFilter(); filtro.type = 'lowpass';
    filtro.frequency.setValueAtTime(560, t);
    filtro.frequency.exponentialRampToValueAtTime(180, t + 0.16);
    const g = ac.createGain();
    g.gain.setValueAtTime(gan, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    filtro.connect(g).connect(busE());
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t);
    o.connect(filtro); o.start(t); o.stop(t + 0.22);
    const gs = ac.createGain(); gs.gain.value = 1;      // el sub: seno una octava abajo
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(f / 2, t);
    o2.connect(gs).connect(filtro); o2.start(t); o2.stop(t + 0.22);
  }
  const eArp = (t, f, gan) => eBeep(t, f, 0.07, 'square', gan, 0, true);
  function ePad (t, freqs, gan, durCompas) {
    const filtro = ac.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.setValueAtTime(750, t);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gan, t + 0.35);
    g.gain.setValueAtTime(gan, t + durCompas * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durCompas * 0.95);
    filtro.connect(g).connect(busE());
    for (const fr of freqs) for (const dt of [1 - 0.0035, 1 + 0.0035]) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(fr * dt, t);
      o.connect(filtro); o.start(t); o.stop(t + durCompas);
    }
  }
  function eRiser (t, dur) {
    const n = Math.max(1, ac.sampleRate * (dur + 0.1) | 0), buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(350, t); f.frequency.exponentialRampToValueAtTime(3800, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.003, t); g.gain.linearRampToValueAtTime(0.05 * EG, t + dur);
    g.gain.setValueAtTime(0.05 * EG, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + dur + 0.1);
  }
  const eTambor = (c, t) => {
    if (c === 'k') eKick(t); else if (c === 'K') eKick(t, true);
    else if (c === 's') eSnare(t); else if (c === 'c') eClap(t);
    else if (c === 'h') eHat(t); else if (c === 'H') eHat(t, true);
    else if (c === 'u') eTom(t, 190); else if (c === 'T') eTom(t, 140); else if (c === 't') eTom(t, 95);
    else if (c === 'x') { eKick(t); eSnare(t); eClap(t); }
  };

  // El sostenido, espejo del estudio: alla una nota prolongada es la misma
  // cuadrada sonando y decayendo a lo largo de toda la nota -- no otra voz.
  // Se guarda para poder soltarla si el jugador corta el riel antes.
  let rielVozE = null;
  function eRielAbrir (f, dur, gan = 0.13) {
    const t = ac.currentTime;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(18000, t);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gan, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(voz);
    const o = ac.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(f, t);
    o.connect(g).connect(lp); o.start(t); o.stop(t + dur + 0.05);
    rielVozE = { o, g };
  }
  function eRielCerrar () {
    if (!rielVozE) return;
    const t = ac.currentTime;
    rielVozE.g.gain.cancelScheduledValues(t);
    rielVozE.g.gain.setValueAtTime(Math.max(0.0001, rielVozE.g.gain.value), t);
    rielVozE.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    rielVozE.o.stop(t + 0.1);
    rielVozE = null;
  }

  // La voz del jugador: solo suena si el jugador la toca. Con `desde` no se
  // vuelve a atacar, se desliza desde la nota anterior: eso es un ligado.
  // `chueca` = llegaste fuera de la ventana afinada. La nota suena igual --nunca
  // se castiga con silencio-- pero sale desafinada y apagada, como una cuerda
  // mal pisada. Es la unica forma de que el oido, y no el HUD, te diga que vas
  // corrido.
  function lead (t, f, dur = 0.4, gan = 0.26, desde = 0, chueca = false) {
    // En las canciones portadas del estudio, la nota AFINADA usa la voz del
    // estudio calcada: cuadrada limpia, brillante, ataque de 4 ms. La chueca
    // sigue con la voz apagada y batida de siempre -- ese es el feedback.
    if (CANCIONES[CANCION_ID].estudio && !chueca) {
      // Espejo del estudio: alla casi toda nota melodica dura UNA semicorchea
      // (los puntos de su notacion son silencios), asi que la nota es un blip
      // corto de cuadrada -- por eso el eco se recorta nitido detras. Y el
      // ligado ataca fresco: en el estudio no hay glissando.
      const durE = Math.min(dur, 0.16);
      const ge = ac.createGain(), lpe = ac.createBiquadFilter();
      lpe.type = 'lowpass'; lpe.frequency.setValueAtTime(18000, t);
      ge.gain.setValueAtTime(0.0001, t);
      ge.gain.linearRampToValueAtTime(gan * 0.45, t + Math.min(0.004, durE * 0.5));
      ge.gain.exponentialRampToValueAtTime(0.0001, t + durE);
      lpe.connect(voz);
      const o = ac.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(f, t);
      o.connect(ge).connect(lpe); o.start(t); o.stop(t + durE + 0.02);
      return;
    }
    const lp = ac.createBiquadFilter(), g = ac.createGain();
    const ataque = desde ? 0.03 : 0.005;      // seco y al frente: pluck, no pad
    // EL BRILLO TIENE TECHO ABSOLUTO. Atado solo a la nota (f * 8), cada nota
    // mas aguda salia mas brillante que la anterior, y arriba la melodia se
    // volvia un silbido. Un instrumento de verdad no se pone mas brillante
    // porque toques mas agudo: el cuerpo del instrumento no cambia.
    lp.type = 'lowpass'; lp.Q.value = chueca ? 1 : 2.2;
    lp.frequency.setValueAtTime(Math.min(chueca ? 1500 : 4600, f * 6), t);
    lp.frequency.exponentialRampToValueAtTime(
      Math.max(220, Math.min(chueca ? 480 : 1100, f * 1.6)), t + dur * 0.85);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gan * (chueca ? 0.7 : 1), t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(lp).connect(voz);
    // el pico del ataque: sin esto la nota entra sin uña y suena plana
    if (!desde) ruido(t, 0.02, chueca ? 0.09 : 0.045, 'bandpass', chueca ? 900 : 2600, 1.2);
    // Triangulo de cuerpo + un poco de sierra para el filo + sub una octava
    // abajo. La cuadrada sola era la chicharra. Chueca, las voces se van para
    // lados distintos: eso es lo que bate y molesta.
    for (const [tipo, mul, v, des] of
      [['triangle', 1, 1, -45], ['sawtooth', 1, 0.32, -45], ['sine', 0.5, 0.5, 28]]) {
      const o = ac.createOscillator(), gv = ac.createGain();
      o.type = tipo; gv.gain.value = v;
      if (chueca) o.detune.value = des;
      if (desde) {
        o.frequency.setValueAtTime(desde * mul, t);
        o.frequency.exponentialRampToValueAtTime(f * mul, t + 0.035);
      } else o.frequency.value = f * mul;
      o.connect(gv).connect(g); o.start(t); o.stop(t + dur + 0.02);
    }
  }

  function rielAbrir (f, chueca = false) {
    rielCerrar();
    const t = ac.currentTime;
    const g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 1.6;
    lp.frequency.value = Math.min(chueca ? 1200 : 3400, f * 5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(chueca ? 0.15 : 0.2, t + 0.03);
    g.connect(lp).connect(voz);
    if (chueca) ruido(t, 0.05, 0.09, 'bandpass', 900, 1.2);
    // Vibrato que entra despues del ataque. Una nota larga sin vibrato es un
    // tono de test: es lo que sonaba plano cuando se sostenia un riel.
    const lfo = ac.createOscillator(), lfoG = ac.createGain();
    lfo.type = 'sine'; lfo.frequency.value = 5.2;
    lfoG.gain.setValueAtTime(0, t);
    lfoG.gain.linearRampToValueAtTime(7, t + 0.35);
    lfo.connect(lfoG); lfo.start(t);
    const osc = [];
    for (const [tipo, mul, v, des] of
      [['triangle', 1, 1, -45], ['sawtooth', 1, 0.3, -45], ['sine', 0.5, 0.5, 28]]) {
      const o = ac.createOscillator(), gv = ac.createGain();
      o.type = tipo; o.frequency.value = f * mul; gv.gain.value = v;
      if (chueca) o.detune.value = des;
      lfoG.connect(o.detune);
      o.connect(gv).connect(g); o.start(); osc.push(o);
    }
    rielVoz = { g, osc: [...osc, lfo] };
  }
  function rielCerrar () {
    if (!rielVoz) return;
    const { g, osc } = rielVoz, t = ac.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    for (const o of osc) o.stop(t + 0.12);
    rielVoz = null;
  }

  // --- la base: siempre suena, nunca se calla como castigo --------------------
  // El QUE de cada compas (planCompas) vive arriba, con su cancion; aca solo
  // se traduce a sintesis.

  // El motor del estudio: un paso de semicorchea por vez, patron por capa.
  // Es el MISMO recorrido que hace estudio/index.html, para que suene igual.
  function agendarEstudio (spec) {
    const b = ahora();
    while (proxBeat < b + 2) {
      const t = t0 + proxBeat * SPB;
      const c = Math.floor(proxBeat / 4), i16 = Math.round((proxBeat - c * 4) * 4);
      const p = spec(c);
      if (p) {
        const ch = acordeEnCompas(c);
        const paso = Math.round(proxBeat * 4);   // el paso global de semicorchea
        const bat = E_BATERIA[p.drums];
        if (bat && bat[i16] && bat[i16] !== '.' && !PASOS_BATERIA.has(paso)) eTambor(bat[i16], t);
        if (p.bajo && !enArpegio(proxBeat) && !PASOS_BAJO.has(paso)) {
          const n = E_BAJO[p.bajo][i16];
          if (n != null) eBajo(t, (ch.root / 4) * Math.pow(2, n / 12), 0.062 * EG);
        }
        // el arpegio de fondo calla en la zona de dribleo: ahi lo toca la esfera
        if (p.arp && !enArpegio(proxBeat)) {
          const n = E_ARP[p.arp][i16];
          if (n != null) {
            const semis = ch.ints[n % 3] + 12 * Math.floor(n / 3);
            eArp(t, ch.root * Math.pow(2, semis / 12), 0.016 * EG * (p.arpGan || 1));
          }
        }
        if (i16 === 0) {
          if (p.pad) ePad(t, ch.ints.map(sm => ch.root * Math.pow(2, sm / 12)), 0.014 * EG, 4 * SPB);
          if (p.crash) eCrash(t);
          if (p.riser) eRiser(t, p.riser * 4 * SPB);
        }
      }
      proxBeat += 0.25;
    }
  }

  function agendarMusica () {
    const spec = CANCIONES[CANCION_ID].estudio;
    if (spec) { agendarEstudio(spec); return; }
    const b = ahora();
    while (proxBeat < b + 2) {
      const t = t0 + proxBeat * SPB;
      const c = Math.floor(proxBeat / 4), u = proxBeat - c * 4;
      const plan = planCompas(c);
      if (plan) {
        const arm = armonia(c);
        if (u === 0 && plan.pad) acordePad(t, arm.acorde, 4 * SPB);
        if (plan.kick.includes(u)) kick(t);
        if (plan.snare.includes(u)) snare(t);
        if (plan.clap.includes(u)) clap(t);
        if (plan.hats.includes(u)) hat(t, plan.abierto.includes(u));
        if (plan.abierto.includes(u) && !plan.hats.includes(u)) hat(t, true);
        // El empuje: fundamental larga en el 1 y un golpe corrido en el "y" del
        // 3. Esa media unidad fuera de lugar es la mitad de la vibra de esfera.
        if (plan.bajo === 'empuje' && u === 0) bajo(t, arm.r, 1.6 * SPB, 0.32);
        if (plan.bajo === 'empuje' && u === 2.5) bajo(t, arm.r, 0.9 * SPB, 0.3);
        if (plan.bajo === 'ochos' && u % 0.5 === 0) bajo(t, arm.r);
        if (plan.bajo === 'octava' && u % 0.5 === 0) bajo(t, u % 1 === 0.5 ? arm.r * 2 : arm.r, 0.2, 0.28);
        if (plan.bajo === 'sus' && u === 0) bajo(t, arm.r, 3.6 * SPB, 0.22);
        if (plan.fill && u === 3.25) [0, 1, 2].forEach(i => snare(t + i * 0.25 * SPB, 0.16 + i * 0.08));
      }
      proxBeat += 0.25;
    }
  }

  function sonarFinal () {
    const t = ac.currentTime + 0.05;
    acordePad(t, ACORDE.Am.acorde.map(f => f * 2), 3, 0.07);
    bajo(t, ACORDE.Am.r, 1.2, 0.35);
    [440, 523.25, 659.25, 880].forEach((f, i) => lead(t + i * 0.1, f, 0.9, 0.16));
  }

  // --- eventos de la simulacion ------------------------------------------------

  function chispas (x, y, n, arriba = false, rgb = C.esferaRGB) {
    for (let i = 0; i < n; i++) particulas.push({
      x, y, rgb,
      vx: (Math.random() - 0.5) * 1.5,
      vy: arriba ? Math.random() * 1.6 + 0.4 : Math.random() * 0.8,
      vida: 1
    });
  }

  // Cada nota dice en el acto cuanto te corriste. Sin esto se juega a ciegas:
  // suena mal, se ve bien, y no hay forma de saber para que lado corregir.
  function aviso (e) {
    const ms = Math.round(e.tarde * SPB * 1000);
    marcas.push({ d: e.tarde, t: performance.now() });
    if (marcas.length > 16) marcas.shift();
    const signo = ms > 0 ? '+' : '−';
    avisos.push({
      x: e.x, y: e.y, t: performance.now(), chueca: e.chueca,
      txt: e.chueca ? `${ms > 0 ? 'TARDE' : 'ANTES'} ${signo}${Math.abs(ms)}`
        : Math.abs(ms) <= 25 ? 'PERFECTO' : `${signo}${Math.abs(ms)}`
    });
  }

  function procesar () {
    for (const e of s.eventos) {
      if (e.tipo === 'nota') {
        desvios.push(Math.abs(e.tarde) * SPB * 1000); aviso(e);
        if (NOTAS[e.i].bajo) {
          // tecla de bajo: la esfera esta tocando el bajo del estudio -- dos
          // octavas abajo de donde pisa, con la voz de alla. Sin eco: el bajo
          // no lo lleva. Chueca, sale apagada y con el golpe sordo.
          eBajo(ac.currentTime, e.f / 8, e.chueca ? 0.07 : 0.16);
          if (e.chueca) ruido(ac.currentTime, 0.05, 0.09, 'lowpass', 500);
          destellos.push({ x: e.x, y: e.y, t: performance.now(), chueca: e.chueca });
          chispas(e.x, e.y, e.chueca ? 3 : 7, true, e.chueca ? C.suciaRGB : C.impulsoRGB);
          squash = 1;
          continue;
        }
        // acento: la nota que cae en el pulso pega mas fuerte. Todas iguales es
        // lo que sonaba plano -- un instrumento tiene dinamica, un beep no.
        const fuerte = NOTAS[e.i].b % 1 === 0;
        lead(ac.currentTime, e.f, Math.max(0.22, 0.46 - Math.abs(e.tarde) * 0.4),
          fuerte ? 0.29 : 0.21, 0, e.chueca);
        // El eco, IDENTICO al estudio: alla lo lleva toda nota no prolongada
        // (en su notacion los puntos son silencios, asi que casi todas), 3
        // semicorcheas despues, al 30%. Aca: toda nota que no sea riel. La
        // chueca lo arrastra chueco: el eco repite lo que sono.
        if (!NOTAS[e.i].riel)
          lead(ac.currentTime + 0.75 * SPB, e.f, 0.1, (fuerte ? 0.29 : 0.21) * 0.3, 0, e.chueca);
        destellos.push({ x: e.x, y: e.y, t: performance.now(), chueca: e.chueca });
        chispas(e.x, e.y, e.chueca ? 3 : 7, true, e.chueca ? C.suciaRGB : C.teclaRGB);
        squash = 1;
      } else if (e.tipo === 'ligada') {
        lead(ac.currentTime, e.f, 0.5, 0.15, e.desde, e.chueca);
        if (!NOTAS[e.i].riel)
          lead(ac.currentTime + 0.75 * SPB, e.f, 0.1, 0.15 * 0.3, 0, e.chueca);
        destellos.push({ x: e.x, y: e.y, t: performance.now(), chueca: e.chueca });
        chispas(e.x, e.y, 5, false, e.chueca ? C.suciaRGB : C.teclaRGB);
        squash = 0.8;
      } else if (e.tipo === 'riel') {
        if (CANCIONES[CANCION_ID].estudio && !e.chueca)
          eRielAbrir(e.f, Math.max(0.3, (e.hasta - e.x) * SPB));
        else rielAbrir(e.f, e.chueca);
        aviso(e);
        destellos.push({ x: e.x, y: e.y, t: performance.now(), chueca: e.chueca });
        chispas(e.x, e.y, e.chueca ? 4 : 10, true, e.chueca ? C.suciaRGB : C.teclaRGB);
      } else if (e.tipo === 'orbe') {
        // la esfera atraveso un orbe: suena el golpe REAL que reclamo -- la
        // nota del arpegio, el hat/clap/caja de la bateria, o la del bajo
        if (e.instr === 'arp') {
          const ch = acordeEnCompas(e.c);
          const semis = ch.ints[e.n % 3] + 12 * Math.floor(e.n / 3);
          eArp(ac.currentTime, ch.root * Math.pow(2, semis / 12) * 2, 0.11);
        } else if (e.instr === 'bajo') {
          const ch = acordeEnCompas(e.c);
          eBajo(ac.currentTime, (ch.root / 4) * Math.pow(2, e.semi / 12), 0.09 * EG);
        } else eTambor(e.instr, ac.currentTime);
        destellos.push({ x: e.x, y: e.y, t: performance.now(), chueca: false });
        chispas(e.x, e.y, 6, true, e.instr === 'arp' ? C.teclaRGB : C.esferaRGB);
      } else if (e.tipo === 'falso') {
        // martillaste: cuerda muerta. El boton queda sordo hasta que se acomode.
        ruido(ac.currentTime, 0.06, 0.14, 'bandpass', 700, 1.4);
        golpe(ac.currentTime, 70, 0.09, 0.16, 'square');
        chispas(e.x, e.y, 4, false, C.suciaRGB);
      } else if (e.tipo === 'sordo') {
        ruido(ac.currentTime, 0.015, 0.02);
      } else if (e.tipo === 'rielCorta') {
        if (rielVozE) eRielCerrar(); else rielCerrar();
      } else if (e.tipo === 'resorte') {
        kick(ac.currentTime);
        chispas(e.x, 0, 12, true);
        squash = 1;
      } else if (e.tipo === 'posar') {
        ruido(ac.currentTime, 0.03, 0.05, 'lowpass', 900); squash = 0.7;
      } else if (e.tipo === 'red') {
        ruido(ac.currentTime, 0.09, 0.09, 'lowpass', 700); squash = 0.9;
        chispas(e.x, 0, 5);
      } else if (e.tipo === 'aire' || e.tipo === 'saltoRed') {
        ruido(ac.currentTime, 0.04, 0.03, 'highpass', 3000);
      }
    }
    s.eventos.length = 0;
  }

  function morirOReiniciar () {
    rielCerrar(); eRielCerrar();
    mejor = Math.max(mejor, s.limpias.size);
    intento++;
    s = crearSim();
    t0 = ac.currentTime + 0.7;
    proxBeat = 0;
    estela.length = 0;
    desvios.length = 0;
    marcas.length = 0;
    avisos.length = 0;
    flash = 1;
  }

  // --- entrada -----------------------------------------------------------------

  function empezar (id) {
    elegirCancion(id);
    intento = 1; mejor = 0;
    s = crearSim();
    estela.length = 0; desvios.length = 0; marcas.length = 0; avisos.length = 0;
    corriendo = true;
    arrancarAudio();
  }

  function alMenu () {
    rielCerrar(); eRielCerrar();
    corriendo = false; finSonado = false;
    s = crearSim();
  }

  // En el menu, un toque pelado (espacio, click) arranca el nivel 1; el nivel
  // se elige con 1/2 en el teclado o tocando su renglon.
  function bajar (nivel = 0) {
    if (!corriendo) { empezar(NIVELES[nivel] || NIVELES[0]); return; }
    if (s.meta) { alMenu(); return; }
    s.sostiene = true;
    tocar(s, ahora());
  }
  function subir () { soltar(s); }

  // Es un juego de UN boton: cualquier tecla normal vale. Se dejan pasar los
  // atajos con Ctrl/Alt/Meta y las de funcion para no romper recargar ni F12.
  const esBoton = e => !e.ctrlKey && !e.altKey && !e.metaKey &&
    (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter' ||
     e.code === 'ArrowUp' || e.key.length === 1);

  // En captura y sobre window: asi ningun elemento con foco se come la tecla,
  // que es lo que pasa cuando la pagina se abre embebida o se hizo clic afuera.
  addEventListener('keydown', e => {
    if (!esBoton(e)) return;
    e.preventDefault();
    if (e.repeat) return;
    if (!corriendo && e.key >= '1' && e.key <= String(NIVELES.length)) { bajar(+e.key - 1); return; }
    bajar();
  }, { capture: true });
  addEventListener('keyup', e => { if (esBoton(e)) subir(); }, { capture: true });

  // El lienzo toma el foco: sin esto, en un iframe las teclas no llegan nunca.
  cv.tabIndex = 0;
  cv.style.outline = 'none';
  const enfocar = () => { try { cv.focus({ preventScroll: true }); } catch (_) {} };
  enfocar();
  addEventListener('load', enfocar);
  addEventListener('pointerdown', enfocar, { capture: true });

  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (!corriendo) {
      // cada renglon del menu es una franja: 1 arriba, 2 al medio, 3 abajo
      const y = e.offsetY / cv.clientHeight;
      bajar(y > 0.37 ? 2 : y > 0.295 ? 1 : 0);
      return;
    }
    bajar();
  });
  addEventListener('pointerup', subir);
  // si el juego pierde el foco con el boton hundido, se suelta: no queda trabado
  addEventListener('blur', subir);

  // --- lazo ---------------------------------------------------------------------

  let antes = performance.now();
  function cuadro (t) {
    requestAnimationFrame(cuadro);
    const dtSeg = Math.min(0.05, (t - antes) / 1000);
    antes = t;
    if (!corriendo) { dibujar(dtSeg); return; }

    agendarMusica();
    const b = ahora();
    if (b < 0) { dibujar(dtSeg); return; }

    const dtBeat = dtSeg / SPB;
    const n = Math.max(1, Math.ceil(dtBeat / (1 / 240)));
    for (let i = 0; i < n && s.viva && !s.meta; i++) paso(s, dtBeat / n);

    procesar();
    if (!s.viva) { golpe(ac.currentTime, 90, 0.3, 0.4, 'sawtooth'); ruido(ac.currentTime, 0.2, 0.28); morirOReiniciar(); }
    if (s.meta && !finSonado) { finSonado = true; rielCerrar(); eRielCerrar(); sonarFinal(); }
    dibujar(dtSeg);
  }
  requestAnimationFrame(cuadro);

  // --- dibujo ---------------------------------------------------------------------

  // Al llegar a la meta se ve la cancion entera dibujada, con lo que tocaste
  // encendido: limpias en ambar, chuecas en gris, las que se te pasaron apenas
  // marcadas. Es la figura del mapa, que es lo que queda de la corrida.
  function dibujarMapa (w, h) {
    const alturas = NOTAS.filter(n => !n.silencio).map(n => n.y);
    const lo = Math.min(...alturas), hi = Math.max(...alturas);
    const mx = w * 0.06, arriba = h * 0.34, alto = h * 0.3;
    const MX = wx => mx + (wx / LARGO) * (w - mx * 2);
    const MY = wy => arriba + alto - ((wy - lo) / Math.max(1e-6, hi - lo)) * alto;

    cx.strokeStyle = `rgba(${C.teclaRGB},0.22)`; cx.lineWidth = 1.5;
    cx.beginPath();
    let corte = true;
    for (const k of NOTAS) {
      if (k.silencio) { corte = true; continue; }
      const X = MX(k.x0), Y = MY(k.y);
      if (corte) { cx.moveTo(X, Y); corte = false; } else cx.lineTo(X, Y);
    }
    cx.stroke();
    for (const k of NOTAS) {
      if (k.silencio) continue;
      const limpia = s.limpias.has(k.i);
      cx.fillStyle = limpia ? C.esfera : s.tocadas.has(k.i) ? C.sucia : `rgba(${C.teclaRGB},0.25)`;
      const an = Math.max(2, (k.x1 - k.x0) / LARGO * (w - mx * 2));
      cx.fillRect(MX(k.x0), MY(k.y) - 1.5, an, 3);
    }
    cx.strokeStyle = C.tenue; cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(MX(0), arriba + alto + 14); cx.lineTo(MX(LARGO), arriba + alto + 14); cx.stroke();
  }

  function dibujar (dtSeg) {
    const w = cv.clientWidth, h = cv.clientHeight, dpr = devicePixelRatio || 1;
    if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.fillStyle = C.fondo; cx.fillRect(0, 0, w, h);

    const esc = w / 9;
    const y0 = h * 0.86;
    const px = wx => (wx - s.x + 2.4) * esc;
    const py = wy => y0 - wy * esc;

    // la red, con sus abismos
    cx.strokeStyle = C.red; cx.lineWidth = 2;
    const cortes = [0, ...HUECOS.flatMap(g => [g.x0, g.x1]), LARGO + 6];
    for (let i = 0; i < cortes.length; i += 2) {
      cx.beginPath(); cx.moveTo(px(cortes[i]), py(0)); cx.lineTo(px(cortes[i + 1]), py(0)); cx.stroke();
    }
    // compases
    cx.strokeStyle = C.tenue; cx.lineWidth = 1;
    for (let bb = Math.ceil(s.x - 3); bb < s.x + 7; bb++) {
      if (bb < 0 || bb % 4) continue;
      cx.beginPath(); cx.moveTo(px(bb), py(0) + 14); cx.lineTo(px(bb), py(0.95)); cx.stroke();
    }
    cx.fillStyle = C.tenue; cx.font = '12px system-ui'; cx.textAlign = 'left';
    for (const z of SECCIONES) cx.fillText(z.n, px(z.x0) + 8, py(0) + 30);

    // techos del silencio
    cx.fillStyle = 'rgba(232,230,224,0.10)';
    cx.strokeStyle = C.peligro; cx.lineWidth = 3;
    for (const t of TECHOS) {
      cx.fillRect(px(t.x0), py(t.y), (t.x1 - t.x0) * esc, py(0) - py(t.y));
      cx.beginPath(); cx.moveTo(px(t.x0), py(t.y)); cx.lineTo(px(t.x1), py(t.y)); cx.stroke();
    }

    // Trampolines. Verdes, anchos, con chevrones que suben y la parabola
    // dibujada: tienen que leerse como "pisa aca y volves arriba". Dibujados
    // como dos rayitas grises se leian como algo que hay que esquivar.
    // Los ORBES: cuerpos de verdad. Viven flotando sobre el arco del pique
    // hasta que la esfera los atraviesa -- ahi suenan y estallan. Los que el
    // arco no toco quedan ahi, mudos: se VE lo que no sonaste.
    const latOrbe = 0.55 + 0.45 * Math.sin(performance.now() / 160);
    for (const o of ORBES) {
      if (o.x < s.x - 3 || o.x > s.x + 7) continue;
      if (s.orbesTocados.has(o.i)) continue;
      const rgbO = o.instr === 'arp' ? C.teclaRGB : C.esferaRGB;
      cx.fillStyle = `rgba(${rgbO},${0.35 + 0.35 * latOrbe})`;
      cx.beginPath(); cx.arc(px(o.x), py(o.y), 4 + 1.5 * latOrbe, 0, Math.PI * 2); cx.fill();
      cx.strokeStyle = `rgba(${rgbO},0.25)`; cx.lineWidth = 1;
      cx.beginPath(); cx.arc(px(o.x), py(o.y), 8, 0, Math.PI * 2); cx.stroke();
    }
    // Los ABISMOS se ven como peligro, no como ausencia: dientes en los dos
    // bordes y un degradado que se hunde. Antes el hueco era solo un corte en
    // la linea de la red y de lejos ni se notaba.
    for (const h of HUECOS) {
      if (h.x1 < s.x - 3 || h.x0 > s.x + 7) continue;
      const a0 = px(h.x0), a1 = px(h.x1), yy = py(0);
      const gr = cx.createLinearGradient(0, yy, 0, yy + 46);
      gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = gr; cx.fillRect(a0, yy, a1 - a0, 46);
      cx.strokeStyle = `rgba(${C.esferaRGB},0.8)`; cx.lineWidth = 2;
      cx.beginPath();
      const dientes = Math.max(3, Math.round((a1 - a0) / 9));
      for (let i = 0; i <= dientes; i++) {
        const xx = a0 + (a1 - a0) * i / dientes;
        cx.lineTo(xx, yy + (i % 2 ? 7 : 1));
      }
      cx.stroke();
      cx.beginPath(); cx.moveTo(a0, yy - 5); cx.lineTo(a0, yy + 3);
      cx.moveTo(a1, yy - 5); cx.lineTo(a1, yy + 3); cx.stroke();
    }
    for (const r of RESORTES) {
      if (r.x1 < s.x - 3 || r.x0 > s.x + 7) continue;
      const a = s.resortesUsados.has(r.x) ? 0.18 : 0.55;
      const a0 = px(r.x0), a1 = px(r.x1), medio = (a0 + a1) / 2;
      cx.strokeStyle = `rgba(${C.impulsoRGB},${a})`; cx.lineWidth = 2.5;
      cx.beginPath(); cx.moveTo(a0, py(0)); cx.lineTo(a1, py(0)); cx.stroke();
      const fase = (performance.now() / 620) % 1;
      cx.lineWidth = 1.5;
      for (let i = 0; i < 2; i++) {
        const f = (fase + i / 2) % 1, yy = py(0) - 8 - f * 18, ancho = (a1 - a0) * 0.18;
        cx.strokeStyle = `rgba(${C.impulsoRGB},${(1 - f) * a})`;
        cx.beginPath();
        cx.moveTo(medio - ancho, yy + 7); cx.lineTo(medio, yy); cx.lineTo(medio + ancho, yy + 7);
        cx.stroke();
      }
    }

    // La linea del AHORA. La esfera esta siempre en el mismo punto de la
    // pantalla, asi que esta linea es el presente: la nota se toca cuando su
    // marca blanca la cruza. Sin esto no habia forma de saber donde apuntar.
    cx.strokeStyle = 'rgba(232,230,224,0.20)'; cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(px(s.x), 0); cx.lineTo(px(s.x), py(0) + 10); cx.stroke();

    // la plataforma de salida: se empieza arriba, a la altura de la primera nota
    if (PISO && PISO.x1 > s.x - 3 && PISO.x0 < s.x + 7) {
      cx.fillStyle = 'rgba(232,230,224,0.22)';
      cx.fillRect(px(PISO.x0), py(PISO.y), (PISO.x1 - PISO.x0) * esc, 5);
      cx.fillStyle = C.tenue; cx.font = '12px system-ui'; cx.textAlign = 'right';
      cx.fillText('salida', px(PISO.x1) - 6, py(PISO.y) - 8);
      cx.textAlign = 'left';
    }

    // las teclas: la partitura
    for (const k of NOTAS) {
      if (k.silencio || k.x1 < s.x - 3 || k.x0 > s.x + 7) continue;
      const sono = s.tocadas.has(k.i);
      const limpia = s.limpias.has(k.i);          // sonar no es lo mismo que afinar
      const aqui = s.tecla === k.i;               // estas parado en esta: toca YA
      const alto = k.riel ? 7 : 5;
      // las teclas de bajo son VERDES: otro instrumento, otro color
      const cBase = k.bajo ? C.impulso : C.tecla;
      cx.fillStyle = limpia ? C.esfera : sono ? C.sucia : cBase;
      if (limpia || aqui) { cx.shadowColor = limpia ? C.esfera : cBase; cx.shadowBlur = 12; }
      cx.fillRect(px(k.x0), py(k.y), Math.max(4, (k.x1 - k.x0) * esc), alto);
      cx.shadowBlur = 0;
      // EL PUNTO EXACTO. La tecla entera es la ventana en la que la nota suena;
      // esta marca es donde sale afinada. Son cosas distintas y hasta ahora solo
      // se dibujaba la primera: se jugaba creyendo ir a tiempo y sonaba chueco.
      if (!sono) {
        cx.fillStyle = 'rgba(255,255,255,0.30)';
        cx.fillRect(px(k.xm - AFINADO), py(k.y) - 4, 2 * AFINADO * esc, 2);
        cx.fillStyle = 'rgba(255,255,255,0.95)';
        cx.fillRect(px(k.xm) - 1, py(k.y) - 13, 2, 13);
      }
      if (k.ligada) {                             // el arco de ligadura: aca se cae
        const sig = NOTAS[k.i + 1];
        cx.strokeStyle = `rgba(${C.teclaRGB},${sono ? 0.75 : 0.4})`;
        cx.lineWidth = 2; cx.setLineDash([4, 4]);
        cx.beginPath();
        cx.moveTo(px(k.x1), py(k.y));
        cx.quadraticCurveTo(px(k.x1), py(sig.y), px(sig.x0), py(sig.y));
        cx.stroke();
        cx.setLineDash([]);
      }
      if (aqui && !sono) {                        // la ventana abierta, bien visible
        cx.strokeStyle = `rgba(${C.teclaRGB},0.9)`; cx.lineWidth = 2;
        cx.strokeRect(px(k.x0) - 2, py(k.y) - 9, Math.max(4, (k.x1 - k.x0) * esc) + 4, alto + 11);
      }
      if (k.riel) {                                  // el riel se agarra: se marca
        cx.strokeStyle = sono ? C.esfera : C.tecla;
        cx.lineWidth = 1;
        for (let x = k.x0; x < k.x1; x += 0.25) {
          cx.beginPath(); cx.moveTo(px(x), py(k.y)); cx.lineTo(px(x) - 5, py(k.y) + 9); cx.stroke();
        }
        // el tramo final: aca ya podes soltar sin caerte
        const suelta = Math.max(k.x0, k.x1 - SUELTA);
        cx.fillStyle = `rgba(${C.esferaRGB},${sono ? 0.85 : 0.35})`;
        cx.fillRect(px(suelta), py(k.y) - 4, (k.x1 - suelta) * esc, 3);
        // y al final te lanza solo: la flecha lo dice, no hay que saltar
        if (!k.ligada && NOTAS[k.i + 1] && !NOTAS[k.i + 1].silencio) {
          const sig = NOTAS[k.i + 1];
          const ang = Math.atan2(py(sig.y) - py(k.y) - 26, (sig.x0 - k.x1) * esc);
          cx.strokeStyle = `rgba(${C.esferaRGB},0.8)`; cx.lineWidth = 2;
          cx.beginPath();
          cx.moveTo(px(k.x1), py(k.y) - 4);
          cx.lineTo(px(k.x1) + Math.cos(ang) * 16, py(k.y) - 4 + Math.sin(ang) * 16);
          for (const g of [2.5, -2.5]) {
            cx.moveTo(px(k.x1) + Math.cos(ang) * 16, py(k.y) - 4 + Math.sin(ang) * 16);
            cx.lineTo(px(k.x1) + Math.cos(ang + g) * 7 + Math.cos(ang) * 16,
              py(k.y) - 4 + Math.sin(ang + g) * 7 + Math.sin(ang) * 16);
          }
          cx.stroke();
        }
      }
    }
    // destellos de nota
    for (let i = destellos.length - 1; i >= 0; i--) {
      const d = destellos[i], e = (performance.now() - d.t) / 420;
      if (e > 1) { destellos.splice(i, 1); continue; }
      cx.strokeStyle = `rgba(${d.chueca ? C.suciaRGB : C.esferaRGB},${(1 - e) * (d.chueca ? 0.5 : 0.9)})`;
      cx.lineWidth = 2.5 * (1 - e);
      cx.beginPath(); cx.arc(px(d.x), py(d.y), (0.05 + e * 0.42) * esc, 0, Math.PI * 2); cx.stroke();
    }
    // el aviso de cuanto te corriste, sobre la nota misma
    cx.textAlign = 'center';
    for (let i = avisos.length - 1; i >= 0; i--) {
      const a = avisos[i], e = (performance.now() - a.t) / 750;
      if (e > 1) { avisos.splice(i, 1); continue; }
      cx.font = a.chueca ? 'bold 12px system-ui' : '12px system-ui';
      cx.fillStyle = `rgba(${a.chueca ? C.suciaRGB : C.esferaRGB},${1 - e})`;
      cx.fillText(a.txt, px(a.x), py(a.y) - 22 - e * 26);
    }
    cx.textAlign = 'left';

    // meta
    cx.strokeStyle = C.esfera; cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(px(LARGO), py(0)); cx.lineTo(px(LARGO), py(0.9)); cx.stroke();

    // estela
    // El haz: es lo que dibuja la corrida y lo mejor que tenia esfera. Va en dos
    // pasadas -- un halo ancho y tenue, y el hilo brillante encima.
    estela.push({ x: s.x, y: s.y + R });
    if (estela.length > 72) estela.shift();
    cx.lineCap = 'round';
    for (const [ancho, alfa] of [[9, 0.1], [3, 0.42]]) {
      for (let i = 1; i < estela.length; i++) {
        const f = i / estela.length;
        cx.strokeStyle = `rgba(${C.esferaRGB},${f * f * alfa})`;
        cx.lineWidth = f * ancho;
        cx.beginPath();
        cx.moveTo(px(estela[i - 1].x), py(estela[i - 1].y));
        cx.lineTo(px(estela[i].x), py(estela[i].y));
        cx.stroke();
      }
    }
    cx.lineCap = 'butt';
    // particulas
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dtSeg * 2.3;
      if (p.vida <= 0) { particulas.splice(i, 1); continue; }
      p.x += p.vx * dtSeg; p.y += p.vy * dtSeg; p.vy -= 3 * dtSeg;
      cx.fillStyle = `rgba(${p.rgb},${p.vida * 0.8})`;
      cx.beginPath(); cx.arc(px(p.x), py(p.y), 2.2 * p.vida, 0, Math.PI * 2); cx.fill();
    }

    // la esfera
    squash = Math.max(0, squash - dtSeg * 7);
    const k = squash * 0.3;
    const sordo = s.x < s.bloqueo;              // el boton no responde, y se ve
    cx.fillStyle = sordo ? C.sucia : C.esfera;
    cx.shadowColor = sordo ? C.sucia : C.esfera; cx.shadowBlur = sordo ? 4 : 12;
    cx.beginPath();
    cx.ellipse(px(s.x), py(s.y + R * (1 - k)), R * esc * (1 + k), R * esc * (1 - k), 0, 0, Math.PI * 2);
    cx.fill();
    cx.shadowBlur = 0;

    if (flash > 0) {
      flash = Math.max(0, flash - dtSeg * 3);
      cx.fillStyle = `rgba(232,230,224,${flash * 0.22})`;
      cx.fillRect(0, 0, w, h);
    }

    // HUD
    if (!corriendo) {
      cx.textAlign = 'center';
      cx.fillStyle = C.peligro; cx.font = '17px system-ui';
      cx.fillText('DRIBLE — elegi el nivel', w / 2, h * 0.16);
      // Dos canciones, mismo margen de error: si el nivel 1 sale facil y el 2
      // no, la dificultad era la cancion, no el margen.
      cx.fillStyle = C.tecla; cx.font = '15px system-ui';
      cx.fillText(`1 — ${nombreCancion('esfera')} · negras y blancas · 100 BPM`, w / 2, h * 0.26);
      cx.fillStyle = C.esfera;
      cx.fillText(`2 — ${nombreCancion('aurora')} · el galope del coro · 112 BPM`, w / 2, h * 0.33);
      cx.fillStyle = C.impulso;
      cx.fillText(`3 — ${nombreCancion('viaje')} · la cancion entera del estudio (acto 1) · 112 BPM`, w / 2, h * 0.40);
      cx.fillStyle = C.tenue; cx.font = '12px system-ui';
      cx.fillText('teclas 1/2/3, o toca su renglon · ESPACIO arranca el nivel 1', w / 2, h * 0.46);
      cx.font = '13px system-ui';
      [
        'cada tecla azul es una nota: tocala al pisarla',
        'caes ANTES de la marca blanca: roda, y golpea al cruzar la linea',
        'a tiempo suena afinada; corrida suena chueca',
        'martillar el boton no sirve: se queda sordo',
        'las largas se MANTIENEN: el riel te lanza solo al final',
        'las que cuelgan de un arco no se tocan: dejate caer',
        'si caes a la red, TOCA: te relanza a la proxima tecla',
        'en el MOTOR la esfera toca el BAJO: teclas graves que trepan',
        'los ORBES se tocan con el cuerpo: salto fino = el arco los enhebra',
        'los trampolines VERDES te devuelven arriba: pisalos',
        'bajo el techo NO se toca'
      ].forEach((t, i) => cx.fillText(t, w / 2, h * 0.50 + 26 + i * 20));
    } else {
      cx.textAlign = 'left';
      cx.fillStyle = C.red; cx.font = '14px system-ui';
      cx.fillText(`${nombreCancion()} · intento ${intento}${mejor ? `   mejor ${mejor}` : ''}`, 12, 22);
      // El puntaje son las LIMPIAS, no las sonadas: si contaran las sonadas,
      // martillar el boton puntuaba igual que tocar bien.
      cx.fillStyle = C.esfera; cx.font = '15px system-ui';
      cx.fillText(`♪ ${s.limpias.size}/${TOTAL_NOTAS}`, 12, 44);
      const chuecas = s.tocadas.size - s.limpias.size;
      if (chuecas) {
        cx.fillStyle = C.sucia; cx.font = '13px system-ui';
        cx.fillText(`chuecas ${chuecas}`, 12, 64);
      }
      if (desvios.length) {                        // que tan al ritmo, no solo cuantas
        cx.fillStyle = C.red; cx.font = '13px system-ui';
        cx.fillText(`±${(desvios.reduce((a, d) => a + d, 0) / desvios.length).toFixed(0)} ms`, 12, 84);
      }
      if (s.racha >= 4 && !s.meta) {               // la cadena limpia, bien grande
        cx.textAlign = 'center';
        cx.fillStyle = `rgba(${C.esferaRGB},${Math.min(1, 0.4 + s.racha / 30)})`;
        cx.font = `${Math.min(34, 17 + s.racha)}px system-ui`;
        cx.fillText(`x${s.racha}`, w / 2, 42);
        cx.textAlign = 'left';
      }
      cx.fillStyle = C.tenue; cx.fillRect(w - 132, 16, 120, 4);
      cx.fillStyle = C.esfera; cx.fillRect(w - 132, 16, 120 * Math.min(1, s.x / LARGO), 4);

      // El medidor: donde cayeron tus ultimos toques respecto del punto exacto.
      // Una nota suelta corrida no se siente; diez marcas todas del mismo lado si.
      if (!s.meta) {
        const mw = 160, my = h - 24, RANGO = 0.33;      // el ancho son +-200 ms
        const banda = (AFINADO / RANGO) * mw;
        cx.fillStyle = C.tenue; cx.fillRect(w / 2 - mw / 2, my, mw, 2);
        cx.fillStyle = `rgba(${C.esferaRGB},0.20)`;
        cx.fillRect(w / 2 - banda / 2, my - 5, banda, 12);
        cx.fillStyle = 'rgba(255,255,255,0.9)'; cx.fillRect(w / 2 - 1, my - 9, 2, 20);
        for (const m of marcas) {
          const v = Math.max(-1, Math.min(1, m.d / RANGO));
          const vieja = Math.min(1, (performance.now() - m.t) / 4000);
          cx.fillStyle = `rgba(${Math.abs(m.d) > AFINADO ? C.suciaRGB : C.esferaRGB},${0.9 - vieja * 0.6})`;
          cx.fillRect(w / 2 + v * mw / 2 - 1, my - 6, 2, 14);
        }
        cx.fillStyle = C.tenue; cx.font = '10px system-ui'; cx.textAlign = 'center';
        cx.fillText('antes', w / 2 - mw / 2 - 20, my + 5);
        cx.fillText('tarde', w / 2 + mw / 2 + 20, my + 5);
        cx.textAlign = 'left';
      }
      if (s.meta) {
        dibujarMapa(w, h);                         // la cancion entera, de una mirada
        cx.textAlign = 'center'; cx.fillStyle = C.peligro; cx.font = '18px system-ui';
        cx.fillText(`${s.limpias.size} limpias · ${chuecas} chuecas · racha ${s.mejorRacha}`, w / 2, h * 0.18);
        cx.fillStyle = C.tenue; cx.font = '13px system-ui';
        cx.fillText('toca para volver al menu', w / 2, h * 0.18 + 22);
      }
    }
    hud.textContent = '';
  }
}
