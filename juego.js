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
// error cuesta la nota perdida, nunca el tramo entero. Es la UNICA vuelta:
// hubo trampolines automaticos y se fueron, porque se disparaban solos
// mientras rodabas hacia una tecla que ibas a tocar vos. Sobre los abismos
// no hay red: ahi el riel se paga con la vida.
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
      'D5:2 B4:.5 C5:.5 D5:1',                            // 12  G
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

  // AURORA · EL VIAJE — la cancion ENTERA del estudio (64 compases + entrada),
  // con una mecanica por seccion: AMANECER (el tema), MOTOR (teclas de bajo),
  // DESPEGUE (el coro), VUELO (zigzag entre las dos bandas), GRAVEDAD
  // (pistones), DESPEGUE II, NEBULOSA (rieles fantasma sobre el vacio),
  // EMPUJE FINAL (el bajo trepando), SUPERNOVA (el climax doblado en octava) y
  // AURORA (el aterrizaje, sin obstaculos). La ley del estudio: la partitura
  // manda -- el mapa se acomoda a la musica, nunca al reves.
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
      'D5:2 B4:.5 C5:.5 D5:1',                            // 20  G
      // VUELO -- el verso: el BAJO es el protagonista (cadencia andaluza), y
      // el mapa lo dice con el cuerpo: la melodia canta arriba, el bajo espera
      // abajo, y cada compas es un zigzag entre las dos bandas.
      'A4!:1 A4:.5 A4:.5 G4:.5 E4:1 E5!:.5',              // 21  Am
      'G4!:1 G4:.5 G4:.5 B4:.5 G4:1 D5!:.5',              // 22  G
      'F4!:1 A4:.5 A4:.5 C5:.5 A4:1 C5!:.5',              // 23  F
      'E4!:1 G#4:.5 B4:.5 G#4:.5 E4:1 B4!:.5',            // 24  E   la andaluza
      'A4!:1 A4:.5 A4:.5 G4:.5 E4:1 E5!:.5',              // 25  Am  y otra vuelta
      'G4!:1 G4:.5 G4:.5 B4:.5 G4:1 D5!:.5',              // 26  G
      'F4!:1 A4:.5 A4:.5 C5:.5 A4:1 C5!:.5',              // 27  F
      'E4!:1 G#4:.5 B4:.5 G#4:.5 E4:1 B4!:.5',            // 28  E
      // GRAVEDAD -- el segundo build: puro bajo trepando, y los PISTONES
      // armandose a la vista. Aca la urgencia empuja a adelantarse, que es
      // justo lo que el martillo cobra.
      'D4!:1 D4!:1 F4!:1 D4!:1',                          // 29  Dm
      'D4!:1 F4!:1 A4!:1 D5!:1',                          // 30  Dm
      'F4!:1 A4!:1 C5!:1 A4!:1',                          // 31  F
      'E4!:1 G#4!:1 B4!:1 E5!:1',                         // 32  E   la escalera al drop
      // DESPEGUE II -- el coro vuelve, y ya te lo sabes: por eso los martillos
      // caen sobre las notas que anticipas.
      'E5:.75 E5:.75 C5:.5 A4:1 C5:.5 D5:.5',             // 33  Am
      'E5:.75 D5:.75 C5:.5 D5:1.5 C5:.25 D5:.25',         // 34  F
      'E5:.75 E5:.75 G5:.5 E5:1 D5:.5 C5:.5',             // 35  C
      'D5:1.5 B4:.5 D5:2',                                // 36  G
      'E5:.75 E5:.75 C5:.5 A4:1 C5:.5 D5:.5',             // 37  Am
      'E5:.75 D5:.75 C5:.5 D5:1 E5:.5 F5:.5',             // 38  F
      'G5:.75 E5:.75 G5:.5 A5:1 G5:.5 E5:.5',             // 39  C
      'D5:2 B4:.5 C5:.5 D5:1',                            // 40  G
      // NEBULOSA -- el respiro. La melodia es el FANTASMA del coro: hilos
      // largos con huecos enormes. Y aca vive el riesgo/premio: son rieles de
      // la segunda mitad, o sea que abajo no hay red. Sostener vale la vida, y
      // picar el riel para cosechar es apostar. El que no quiere, no pica.
      'E5:4',                                             // 41  F   NEBULOSA
      'C5:4',                                             // 42  G
      '-:2 D5:2',                                         // 43  Am  el hueco se oye
      'E5:4',                                             // 44  Am
      '-:4',                                              // 45  F   el vacio: se rueda
      'A4:1 C5:1 E5:2',                                   // 46  G
      '-:4',                                              // 47  Am
      'D5:2 B4:2',                                        // 48  Am
      // EMPUJE FINAL -- el build mas grande: el bajo TREPA (el patron climb del
      // estudio, ocho corcheas por compas) y arriba se arma el redoble.
      'D4!:.5 D4!:.5 F4!:.5 F4!:.5 G4!:.5 G4!:.5 A4!:.5 C5!:.5',        // 49  Dm
      'E4!:.5 E4!:.5 G4!:.5 G4!:.5 A4!:.5 A4!:.5 B4!:.5 D5!:.5',        // 50  E
      'F4!:.5 F4!:.5 G#4!:.5 G#4!:.5 A#4!:.5 A#4!:.5 C5!:.5 D#5!:.5',   // 51  F
      'E4!:.5 E4!:.5 G4!:.5 G4!:.5 A4!:.5 A4!:.5 B4!:.5 D5!:.5',        // 52  E
      // SUPERNOVA -- el climax: el mismo coro que ya te sabes, doblado una
      // octava arriba y con la bateria en doble tiempo. Los pistones estan mas
      // juntos que en ningun lado: aca anticiparse se paga.
      'E5:.75 E5:.75 C5:.5 A4:1 C5:.5 D5:.5',             // 53  Am  SUPERNOVA
      'E5:.75 D5:.75 C5:.5 D5:1.5 C5:.25 D5:.25',         // 54  F
      'E5:.75 E5:.75 G5:.5 E5:1 D5:.5 C5:.5',             // 55  C
      'D5:1.5 B4:.5 D5:2',                                // 56  G
      'E5:.75 E5:.75 C5:.5 A4:1 C5:.5 D5:.5',             // 57  Am
      'E5:.75 D5:.75 C5:.5 D5:1 E5:.5 F5:.5',             // 58  F
      'G5:.75 E5:.75 G5:.5 A5:1 G5:.5 E5:.5',             // 59  C
      'D5:2 B4:.5 C5:.5 D5:1',                            // 60  G
      // AURORA · aterrizaje -- la vuelta de la victoria. Sin obstaculos: los
      // rieles del final NO llevan abismo (ver sinAbismo), porque el premio no
      // se cobra con un susto.
      'C5:1 D5:1 E5:1 G5:1',                              // 61  F   aterrizaje
      'D5:.5 B4:.5 D5:3',                                 // 62  G
      'A5:4',                                             // 63  Am  el grito agudo
      'E5:1 C5:1 A4:2'                                    // 64  Am  resuelve en La
    ],
    acordes: [
      'Am',
      'Am', 'F', 'C', 'G',                     // amanecer
      'Am', 'F', 'C', 'G',                     // amanecer II
      'Am', 'F', 'Dm', 'E',                    // motor
      'Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G',   // drop 1
      'Am', 'G', 'F', 'E', 'Am', 'G', 'F', 'E',   // vuelo: la andaluza
      'Dm', 'Dm', 'F', 'E',                    // gravedad
      'Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G',   // despegue II
      'F', 'G', 'Am', 'Am', 'F', 'G', 'Am', 'Am', // nebulosa
      'Dm', 'E', 'F', 'E',                        // empuje final
      'Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G',   // supernova
      'F', 'G', 'Am', 'Am'                        // aterrizaje
    ],
    secciones: [
      { x0: 0, n: 'salida' }, { x0: 4, n: 'amanecer' }, { x0: 20, n: 'amanecer II' },
      { x0: 36, n: 'motor · el bajo' }, { x0: 52, n: 'despegue · drop 1' },
      { x0: 84, n: 'vuelo · zigzag con el bajo' }, { x0: 116, n: 'gravedad · PISTONES' },
      { x0: 132, n: 'despegue II' }, { x0: 164, n: 'nebulosa · el fantasma' },
      { x0: 196, n: 'empuje final' }, { x0: 212, n: 'supernova · climax' },
      { x0: 244, n: 'aurora · aterrizaje' }
    ],
    // Los martillos: densos en el build y naturalmente salteados en el coro,
    // donde solo cazan al que se va adelante -- alli el galope es tan denso
    // que solo las negras tienen lugar para un caño, asi que el espaciado lo
    // pone la propia geometria y `cada` queda en 1.
    pistones: [{ x0: 116, x1: 132, cada: 2 }, { x0: 132, x1: 164, cada: 1 },
      { x0: 212, x1: 244, cada: 1 }],
    // El aterrizaje es la vuelta de la victoria: sin abismos, el premio no se
    // cobra con un susto. NEBULOSA si los lleva --sus hilos de 4 tiempos son
    // los rieles mas largos de la cancion y ahi sostener vale la vida-- salvo
    // los que entran despues de un silencio, que los saca la ley de arriba.
    sinAbismo: [{ x0: 244, x1: 260 }],
    // SUPERNOVA dobla la melodia una octava arriba, como el estudio.
    octavas: [{ x0: 212, x1: 244 }],
    // MOTOR arranca con cuatro La seguidos: mismo tono, misma altura, una
    // meseta plana de cuatro compases. Pero un BUILD no es plano -- levanta.
    // Como la altura de una tecla de bajo la decide el mapa (el sonido lo da su
    // nombre), la seccion TREPA: cada tecla se apoya un poco mas arriba que la
    // anterior, y el tono sigue dibujando su relieve encima de esa cuesta.
    trepadas: [{ x0: 36, x1: 52, alto: 0.115 }],
    // MOTOR es ademas zona de ARPEGIO: abajo de las teclas de bajo la red se
    // corta (fallar una tecla del motor se paga), y cada arco entre teclas lleva
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
      if (c <= 28) return { drums: c === 28 ? 'fillTom' : 'verso', bajo: 'verso', pad: true };   // vuelo
      if (c <= 30) return { drums: 'coro', bajo: 'corchea', arp: 'up16', pad: true };            // gravedad
      if (c === 31) return { drums: 'roll', bajo: 'corchea', arp: 'up16', pad: true, riser: 2 };
      if (c === 32) return { drums: 'rollBig', bajo: 'corchea', arp: 'up16', pad: true };
      if (c <= 40) return { drums: (c - 33) % 4 === 3 ? 'fillTom' : 'coroB', bajo: 'drive', arp: 'up16', pad: true, crash: c === 33 };  // despegue II
      // NEBULOSA: el respiro. Cuatro compases casi mudos y cuatro con pulso.
      if (c <= 44) return { drums: 'silencio', arp: 'soft8', arpGan: 0.6, pad: true };
      if (c <= 48) return { drums: 'pulso', bajo: 'pulso', arp: 'soft8', arpGan: 0.6, pad: true };
      // EMPUJE FINAL: el build mas grande -- dos compases de redoble y riser
      if (c <= 50) return { drums: 'coro', bajo: 'climb', arp: 'up16', pad: true, riser: c === 50 ? 3 : 0 };
      if (c <= 52) return { drums: 'rollBig', bajo: 'climb', arp: 'up16', pad: true };
      // SUPERNOVA: doble tiempo y melodia doblada
      if (c <= 60) return { drums: 'doble', bajo: 'drive', arp: 'glitter', pad: true, crash: c === 53 };
      // AURORA · aterrizaje: se apaga de a poco y resuelve en La
      if (c <= 62) return { drums: 'outro', bajo: 'pulso', arp: 'glitter', pad: true, crash: c === 61 };
      if (c === 63) return { drums: 'pulso', bajo: 'pulso', arp: 'glitter', pad: true };
      if (c === 64) return { drums: 'silencio', bajo: 'pulso', arp: 'glitter', pad: true };
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
  coroB: 'k.h.x.h.k.h.x.hH',
  doble: 'k.hhx.hhk.hhx.hH',
  verso: 'k.h.x.h..Hk.x.h.',
  rollBig: 'K.ss.ss.ssssssss',
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
export const nombreAcorde = c => {
  const a = CANCIONES[CANCION_ID].acordes;
  if (a) return a[Math.max(0, Math.min(c, a.length - 1))];
  return ['Am', 'F', 'C', 'G'][((c - 1) % 4 + 4) % 4];
};
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
const semitono = n => {
  const sos = n[1] === '#' ? 1 : 0;          // 'G#4': el acorde de E lo pide
  return SEMI[n[0]] + sos + (+n.slice(1 + sos) + 1) * 12;
};
const frecuencia = n => 440 * Math.pow(2, (semitono(n) - 69) / 12);
const alturaDe = n => Y_GRAVE + (semitono(n) - semitono('E4')) * PASO_TONO;
// El bajo tiene su propia banda, debajo de la melodia: se ve de un vistazo que
// es OTRO instrumento, y saltar de una a otra es el zigzag del verso.
export const Y_BAJO = 0.09;
const alturaBajo = n => Y_BAJO + (semitono(n) - semitono('E4')) * PASO_TONO * 0.45;

// Tiempo minimo de vuelo para llegar a +dy CAYENDO (no subiendo): si llegas
// todavia subiendo atravesas la tecla por abajo y la perdes.
export function vueloMinimo (dy) {
  return dy > 0 ? Math.sqrt(2 * dy / G) * 1.08 + 0.02 : 0.05;
}
// Bajar tambien toma tiempo: la caida libre hasta -dy. Ese es el minimo
// NATURAL de una bajada -- aterrizar antes solo se puede empujado hacia abajo,
// y ese empujon se ve como una mano invisible que aplasta la esfera. No entra
// en vueloMinimo porque el rescate de los pistones lo usa para elegir tecla y
// con este minimo se salteaba la de al lado; lo usan solo el borde del riel y
// lanzar(), que es donde el empujon se veia.
export const caidaLibre = dy => dy < 0 ? Math.sqrt(-2 * dy / G) : 0;
// Al reves: cuanto se puede SUBIR en el tiempo que hay. Es lo que necesita la
// rampa de salida para saber hasta donde tiene que trepar una tecla de bajo.
export const alcanceEn = t => t <= 0.02 ? 0 : (G / 2) * Math.pow((t - 0.02) / 1.08, 2);
// Un salto se considera comodo si sobra esto por encima del vuelo minimo. Con
// menos, llegar tarde apenas un poco ya saltea la nota siguiente (ver lanzar),
// y desde afuera eso se ve como "esa tecla no suena".
export const HOLGURA = 0.14;
// Hasta que impulso se sobrevuela un silencio en vez de caer a la red. Mas que
// esto el arco se va de la pantalla: ahi el silencio es respiro, no vuelo.
export const VUELO_SILENCIO = 1.6;

// Las tres gracias. Sin ellas hay que ser un robot: el toque humano llega
// antes o despues del contacto, casi nunca justo encima.
export const ANTICIPO = 0.8;    // cuanto vive un toque guardado esperando contacto
export const COYOTE = 0.18;     // tocaste apenas te fuiste del borde: vale igual
// Para atacar la nota que sigue a un riel hay que soltar y volver a apretar:
// con el boton hundido no hay toque nuevo. Asi que soltar sobre el final del
// riel no te tira -- la nota ya esta tocada, te deja salir como corresponde.
export const SUELTA = 0.4;
// El final del riel es una RAMPA: en el ultimo tramo la nota larga levanta a la
// esfera y la despide. No es adorno -- sube de verdad, y es exactamente el
// tramo donde soltar ya no te tira. Asi el mapa explica solo por que al final
// de una nota sostenida salis volando, y donde podes soltar para atacar la que
// sigue: la rampa ES la zona de suelta, dibujada.
export const RAMPA = 0.055;
export const subidaRiel = (k, x) => {
  if (!k.riel) return 0;
  const t = (x - (k.x1 - SUELTA)) / SUELTA;
  return t <= 0 ? 0 : RAMPA * Math.min(1, t) * Math.min(1, t);   // curva, no cuña
};
export const REPIQUE = 0.22;   // gracia al soltar un riel: tiempo para repicar (~120 ms)
export const EN_COLA = 2;       // toques guardados a la vez: dos notas adelantadas

// Las gracias dejan que la nota SUENE aunque llegues torcido; la afinacion
// decide COMO suena. El toque se juzga donde lo diste, no donde se cobro: si
// no, adelantarse y que la esfera aterrice sola sonaria perfecto -- que es
// justo la trampa de martillar el boton.
// Calibrada contra Guitar Hero (+-100 ms de ventana total): el chueco marca lo
// claramente corrido, no lo humanamente impreciso. Con +-66 ms una mano decente
// escuchaba chueco un tercio de las veces -- eso se siente injusto, no dificil.
export const AFINADO = 0.18;    // +-96 ms: la nota sale limpia. Mas lejos, chueca.
export const PERFECTO = 0.4;    // el tercio de adentro: clavada, y se celebra
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
        y: silencio ? 0 : bajo ? alturaBajo(nombre) : alturaDe(nombre),
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
  // LA CUESTA DEL BUILD. Un build levanta, y una seccion de bajo puede repetir
  // la misma nota cuatro compases seguidos: mismo tono, misma altura, meseta
  // plana. El tono no se toca --el sonido sale de ahi-- pero la ALTURA de una
  // tecla de bajo es del mapa, asi que la seccion trepa: se le suma una cuesta
  // que crece pareja de punta a punta, y el relieve del tono queda dibujado
  // encima. La rampa de salida, mas abajo, se encarga de que siga siendo
  // saltable.
  for (const z of (CANCIONES[CANCION_ID].trepadas || [])) {
    for (const n of notas) {
      if (n.silencio || !n.bajo || n.b < z.x0 || n.b >= z.x1) continue;
      n.y = +(n.y + z.alto * (n.b - z.x0) / (z.x1 - z.x0)).toFixed(4);
    }
  }

  // LA RAMPA DE SALIDA. Un build termina en el drop: la ultima tecla de BAJO
  // esta en la banda de abajo y la primera del coro arriba, y entre las dos hay
  // media negra. Subir 0.35 con esta gravedad pide 0.80 tiempos -- no habia
  // forma humana, y el motor terminaba salteando la nota del drop: desde afuera
  // eso se ve como "esa tecla verde no suena, o es imposible".
  // La altura de una tecla de bajo es una decision del MAPA (el sonido lo da su
  // nombre, no su altura), asi que cede el mapa: las ultimas graves TREPAN
  // hasta quedar a tiro. Que es, exactamente, lo que hace un build.
  for (let i = notas.length - 2; i >= 0; i--) {
    const n = notas[i], sig = notas[i + 1];
    if (n.silencio || sig.silencio || !n.bajo || n.escalera || n.riel) continue;
    const hay = sig.x0 + MIRA - n.xm;
    if (vueloMinimo(sig.y - n.y) + HOLGURA <= hay) continue;
    n.y = +Math.max(n.y, sig.y - alcanceEn(hay - HOLGURA)).toFixed(4);
  }
  // QUE SILENCIOS SE VUELAN. Una frase que respira no tiene por que tirarte a
  // la red: si del otro lado hay nota y el arco sale sano, la nota anterior te
  // DESPIDE por encima del silencio. Los silencios largos siguen siendo el
  // respiro de siempre --se cae, se rueda, se vuelve a tocar-- porque su arco
  // se iria de la pantalla. Se marca aca para que el vuelo y el TECHO digan lo
  // mismo: un techo sobre un silencio que se vuela mata al que lo vuela.
  for (const n of notas) {
    if (!n.silencio || n.piso) continue;
    const ant = notas[n.i - 1], tras = notas[n.i + 1];
    if (!ant || ant.silencio || !tras || tras.silencio) continue;
    const T = tras.x0 + MIRA - (ant.riel ? ant.x1 : ant.xm);
    if (T <= 0.1) continue;
    n.volado = (tras.y - ant.y) / T + G * T / 2 <= VUELO_SILENCIO;
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
    // Y si la que sigue esta MAS ABAJO, el borde del riel retrocede el tiempo
    // de caida libre: la nota larga te DESPIDE rodando (vy 0) y la esfera cae
    // sola hasta la tecla. Con el borde pegado a la siguiente, lanzar() tenia
    // que cumplir "llegar en 0.05" disparandola hacia abajo -- al salir de
    // NEBULOSA hacia el bajo salia con vy -7, una plomada, no una pelota.
    n.x1 = Math.min(n.x1, n.riel ? sig.x0 + MIRA - Math.max(tv, caidaLibre(sig.y - n.y))
      : Math.max(sig.x0, sig.x1 - 0.06) - tv);
  }
  // LIGADURAS: de una nota larga a una corta mas grave no se vuelve a atacar,
  // se cae. El borde de la tecla se corre para que la caida libre aterrice
  // justo sobre la nota siguiente: dejarse caer ES tocarla.
  for (const n of notas) {
    const sig = notas[n.i + 1];
    if (n.silencio || !sig || sig.silencio) continue;
    // a una carrera no se cae ligado: se entra rodando, o se rompe la carrera
    if (n.escalera || sig.escalera) continue;
    // NI ENTRE INSTRUMENTOS DISTINTOS. Ligar es no volver a atacar: es un
    // idioma de la melodia. Pasar de la melodia al BAJO es cambiar de
    // instrumento, y eso siempre es un ataque -- en el estudio el bajo toca
    // esas notas con su propio golpe. Ligarlas hacia la tecla de bajo dejaba
    // la ultima verde de cada compas del VUELO como "no se toca": el jugador
    // la tocaba (es lo natural), y el juego se lo cobraba como toque en falso
    // con sordera incluida. La seccion entera se sentia rota sin serlo.
    if (!n.bajo !== !sig.bajo) continue;
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

// DONDE LA PARTITURA MANDA RODAR. En los silencios largos el mapa no te deja
// otra: la nota anterior te suelta con impulso cero, caes, rodas y volves a
// subir tocando. Eso NO es fallar -- es el respiro escrito. Se deduce de la
// partitura para que el modo SIN RED pueda castigar la caida sin castigar la
// cancion: ahi abajo la red sigue estando, en todo el resto no.
export let TRAMOS_RODAR = [];
export const mandaRodar = x => TRAMOS_RODAR.some(t => x >= t.x0 && x <= t.x1);
function tramosRodar () {
  const r = [];
  for (const n of NOTAS) {
    if (!n.silencio || n.piso || n.volado) continue;
    const sig = NOTAS[n.i + 1];
    r.push({
      x0: +(n.x0 - 0.3).toFixed(3),
      x1: +((sig ? sig.x0 : n.x0 + n.dur) + 0.2).toFixed(3)
    });
  }
  // ...y la rodada final: pasada la ultima nota se rueda hasta la meta, y eso
  // es la vuelta de la victoria, no un error
  const ult = [...NOTAS].reverse().find(n => !n.silencio);
  if (ult) r.push({ x0: +(ult.x1 - 0.1).toFixed(3), x1: LARGO + 4 });
  return r;
}

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
export let PASOS_ARP = new Set();
function orbes () {
  const r = [];
  const extra = !!CANCIONES[CANCION_ID].orbesExtra;
  const spec = CANCIONES[CANCION_ID].estudio;
  if (!ARPEGIOS.length && !extra) return r;
  let salto = 0;
  for (const n of NOTAS) {
    const sig = NOTAS[n.i + 1];
    if (n.silencio || !sig || sig.silencio) continue;
    if (n.escalera || sig.escalera || n.ligada) continue;
    // Sobre los RIELES largos: orbes que piden el saltito (tocar de nuevo
    // mientras sostenes). Flotan mas arriba de lo que alcanza rodar: solo el
    // saltito los toca. Tambien reclaman golpes reales -- y donde la bateria
    // calla (NEBULOSA: drums en silencio, solo arpegio y pad), reclaman la
    // nota del ARPEGIO. Esa es la apuesta que el mapa promete: los rieles de
    // NEBULOSA llevan abismo, asi que picar para cosechar es jugarse la vida
    // -- y el que no quiere, no pica.
    if (extra && spec && n.riel && n.x1 - n.xm > 1.6) {
      for (let tx = n.xm + 0.7; tx < n.x1 - 1.1; tx += 1) {
        let mr = null;
        for (let p = Math.ceil((tx - 0.3) * 4); p <= Math.floor((tx + 0.3) * 4); p++) {
          if (PASOS_BATERIA.has(p) || PASOS_BAJO.has(p) || PASOS_ARP.has(p)) continue;   // los caños eligen primero
          const cc = Math.floor(p / 16), i16 = p % 16;
          const pl = spec(cc); if (!pl) continue;
          const bat = E_BATERIA[pl.drums];
          const golpe = bat && 'hHsc'.includes(bat[i16]) ? bat[i16] : null;
          const nb = pl.bajo && E_BAJO[pl.bajo] ? E_BAJO[pl.bajo][i16] : null;
          const na = pl.arp && E_ARP[pl.arp] ? E_ARP[pl.arp][i16] : null;
          if (golpe == null && nb == null && na == null) continue;
          const d = Math.abs(p / 4 - tx);
          if (!mr || d < mr.d) mr = { p, golpe, nb, na, d, cc };
        }
        if (!mr) continue;
        const o = { i: r.length, x: +(mr.p / 4).toFixed(3), y: +(n.y + 0.13).toFixed(3), c: mr.cc };
        if (mr.nb != null && mr.golpe == null) { o.instr = 'bajo'; o.semi = mr.nb; PASOS_BAJO.add(mr.p); }
        else if (mr.golpe) { o.instr = mr.golpe; PASOS_BATERIA.add(mr.p); }
        else if (mr.na != null) { o.instr = 'arpz'; o.semi = mr.na; PASOS_ARP.add(mr.p); }
        else continue;
        r.push(o);
      }
    }
    // el arco ideal: el mismo que calcula lanzar() desde el toque en el pulso
    const x0 = n.riel ? n.x1 : n.xm, y0 = n.y + (n.riel ? RAMPA : 0);
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
    } else if (extra && spec && T >= 0.35) {
      // Ocasional entre plataformas: se busca un golpe REAL de la cancion que
      // caiga dentro del vuelo (hat, clap, caja o nota del bajo), el mas
      // cercano a la cima del arco. Ese golpe queda reclamado: el fondo lo
      // calla y lo suena la esfera al atravesarlo -- o nadie.
      const p0 = Math.ceil((x0 + 0.08) * 4), p1 = Math.floor((obj - 0.08) * 4);
      const candidatos = [];
      for (let p = p0; p <= p1; p++) {
        if (PASOS_BATERIA.has(p) || PASOS_BAJO.has(p)) continue;   // los caños eligen primero
        const cc = Math.floor(p / 16), i16 = p % 16;
        const pl = spec(cc); if (!pl) continue;
        const bat = E_BATERIA[pl.drums];
        const golpe = bat && 'hHsc'.includes(bat[i16]) ? bat[i16] : null;
        const nb = pl.bajo && E_BAJO[pl.bajo] ? E_BAJO[pl.bajo][i16] : null;
        if (golpe == null && nb == null) continue;
        const dt = p / 4 - x0;
        candidatos.push({ p, golpe, nb, dt, d: Math.abs(dt - T / 2), cc });
      }
      // el BAJO manda: es lo que se quiere completar mientras suena la
      // melodia. En vuelos largos entran hasta dos golpes, separados.
      candidatos.sort((a, b) => (b.nb != null) - (a.nb != null) || a.d - b.d);
      const cupo = T >= 0.9 ? 2 : 1;
      const puestos = [];
      for (const cand of candidatos) {
        if (puestos.length >= cupo) break;
        if (puestos.some(q => Math.abs(q.p - cand.p) < 2)) continue;
        puestos.push(cand);
        const o = { i: r.length, x: +(cand.p / 4).toFixed(3), y: +arco(cand.dt).toFixed(3), c: cand.cc };
        if (cand.nb != null) { o.instr = 'bajo'; o.semi = cand.nb; PASOS_BAJO.add(cand.p); }
        else { o.instr = cand.golpe; PASOS_BATERIA.add(cand.p); }
        r.push(o);
      }
    }
  }
  return r.sort((a, b) => a.x - b.x);
}

// Techo sobre el silencio largo: ahi tocar mata. Se corta antes del final para
// que quede tramo libre donde tocar y volver a subir. El punto de reenganche
// es lo mas tarde posible que todavia alcanza a llegar a la nota que sigue:
// sale de la partitura, asi que mover una nota lo mueve con ella.
function reenganche (n) {
  const sig = NOTAS[n.i + 1];
  if (!sig || sig.silencio) return null;
  return +(sig.x0 - vueloMinimo(sig.y) - 0.2).toFixed(3);
}

// Empieza recien cuando la esfera ya toco la red --antes la mataria mientras
// todavia cae de la ultima nota, sin haber hecho nada-- y termina antes del
// reenganche, para que quede lugar para volver a subir.
const calcularTechos = () => NOTAS
  .filter(n => n.silencio && !n.piso && n.dur >= 2 && !n.volado && reenganche(n) &&
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


// PISTONES: caños que suben de la red en los builds. La version anterior se
// escondia debajo de todos los arcos para no molestar -- y asi no molestaba
// nada: nadie los tocaba nunca, eran decorado. Ahora el caño sube HASTA EL
// ARCO: la cabeza queda justo donde cae el salto tocado a tiempo, y hay que
// CAERLE ENCIMA. Al pisarla suena un golpe REAL de la bateria del arreglo (el
// mismo trato que los orbes: el fondo lo calla, lo toca la esfera o no suena)
// y el caño te devuelve a la linea, asi que pegarle nunca te descoloca.
//
// Fallarlo no castiga: si llegaste temprano volas por encima, si llegaste
// tarde pasas por abajo, y en los dos casos seguis tu camino sin el golpe. Es
// premio por precision, no trampa. Al que va por el PISO --fallo la tecla y
// rueda-- el vastago lo agarra de abajo y lo DISPARA hacia la proxima tecla:
// ahi si hay castigo (racha cortada, un rato sordo), pero te devuelve a la
// cancion en vez de sacarte.
export let PISTONES = [];
export let ZONAS_PISTON = [];      // las zonas declaradas por la cancion
export const ROCE = 0.13;          // debajo de esto vas rasante: te agarra el vastago
// El caño elige su golpe con JERARQUIA, no por cercania: el golpe entero
// ('x' = bombo+caja+clap) manda sobre la caja, la caja sobre el clap, y el hat
// es el ultimo recurso.
//
// Con una limitacion que conviene saber, porque es geometria y no se negocia:
// las teclas viven EN el pulso, asi que la esfera esta parada en los tiempos y
// vuela ENTRE ellos. El arco de un salto nunca pasa por el backbeat -- ahi hay
// una tecla, no aire. Medido sobre el viaje: de los 57 golpes fuertes de las
// tres zonas, CERO son alcanzables por un arco. Lo que hay a mano en el aire
// es el contratiempo: hats casi siempre, y cajas donde el patron redobla
// (rollBig). Asi que la jerarquia decide poco -- y cuando decide, importa.
//
// Lo que hace que un hat pisado no sea un tic: se ABRE al pisarlo (mismo
// instrumento, gesto de acento), cae dentro del crater que el arreglo abrio
// para el, y lleva el eco del solista. El caño no suena mas fuerte: suena
// SOLO, que es distinto.
const PESO = { x: 4, s: 3, c: 2, H: 1, h: 0 };
export let PASOS_PISTON = new Set();   // pasos reclamados por caños: llevan crater
function pistones () {
  const r = [];
  const spec = CANCIONES[CANCION_ID].estudio;
  for (const z of (CANCIONES[CANCION_ID].pistones || [])) {
    let n = 0;
    for (const k of NOTAS) {
      if (k.silencio || k.xm < z.x0 || k.xm >= z.x1) continue;
      if (k.escalera || k.riel || k.ligada) continue;
      const sig = NOTAS[k.i + 1];
      if (!sig || sig.silencio || sig.riel) continue;
      const tv = vueloMinimo(sig.y - k.y);
      let obj = sig.x0 + MIRA;
      if (obj - k.xm < tv) obj = Math.min(sig.x1 - 0.02, k.xm + tv);
      const T = obj - k.xm;
      // 0.45, no 0.6: con 0.6 el galope del coro no compilaba NI UN caño y la
      // promesa del mapa ("en el coro solo cazan al que se va adelante") era
      // letra muerta -- DESPEGUE II salia con cero.
      if (T < 0.45) continue;
      // EL CAÑO QUIERE VIVIR EN LA GRILLA. Primero intenta pararse EN el paso
      // de semicorchea de un golpe libre: como en este juego x ES el tiempo,
      // pisarlo a tiempo y sonar el golpe en su semicorchea son EL MISMO
      // INSTANTE -- latencia cero y el acento clavado en el pocket, sin
      // relojes de por medio. Si ningun paso sobrevive la geometria (en
      // GRAVEDAD el unico alcanzable pisa el borde de la tecla anterior), el
      // caño cae al punto fisico de siempre --apenas pasada la cima-- y el
      // golpe suena al contacto, a lo sumo ~80 ms del paso: un baterista
      // apenas laid-back, no un flam.
      const vy = Math.min(1.9, (sig.y - k.y) / T + G * T / 2);
      if (!spec) continue;
      const cabe = (x, tope) => {
        if (tope < 2 * R + 0.06) return false;    // tan bajo que ya es la red
        const x0 = x - 0.15, x1 = x + 0.15;
        if (HUECOS.some(h => x > h.x0 - 0.9 && x < h.x1 + 0.9)) return false;
        if (TECHOS.some(t => x > t.x0 - 0.5 && x < t.x1 + 0.5)) return false;
        // ninguna tecla puede quedar dentro del caño: parado ahi te dispararia
        return !NOTAS.some(k2 => !k2.silencio && k2.y < tope + 2 * R + 0.02 &&
          k2.x1 > x0 - 0.02 && k2.x0 < x1 + 0.02);
      };
      const golpeEn = p => {
        if (PASOS_BATERIA.has(p)) return null;
        const pl = spec(Math.floor(p / 16)); if (!pl) return null;
        const bat = E_BATERIA[pl.drums];
        return bat && 'xscHh'.includes(bat[p % 16]) ? bat[p % 16] : null;
      };
      let mr = null;
      // candidatos en grilla: pasos del lado que BAJA del arco (en la subida
      // la esfera pasa rozando por debajo y el caño es impisable). El margen
      // tras la cima es finisimo a proposito -- en el galope el unico paso
      // alcanzable cae apenas pasada la cima -- y lo compensa la cabeza: va 5
      // milesimas DEBAJO del arco, asi el cruce en bajada existe aunque la
      // integracion discreta nunca pise la cima exacta.
      const p0 = Math.ceil((k.xm + Math.max(0.15, vy / G + 0.015)) * 4);
      const p1 = Math.ceil((k.xm + T - 0.08) * 4) - 1;
      for (let p = p0; p <= p1; p++) {
        const golpe = golpeEn(p);
        if (!golpe) continue;
        const dt = p / 4 - k.xm;
        const tope = +(k.y + vy * dt - G * dt * dt / 2 - 0.005).toFixed(3);
        const x = +(p / 4).toFixed(3);
        if (!cabe(x, tope)) continue;
        // apenas pasada la cima es donde pisar se SIENTE pisar
        const d = Math.abs(dt - (vy / G + 0.2));
        if (!mr || PESO[golpe] > PESO[mr.golpe] ||
            (PESO[golpe] === PESO[mr.golpe] && d < mr.d)) mr = { p, golpe, x, tope, d };
      }
      if (!mr) {
        // fuera de grilla: el punto fisico del arco, y el golpe libre mas
        // pesado a menos de 0.2 tiempos -- el pisoton suena al contacto, a lo
        // sumo ~107 ms del paso del golpe: acento humano, no flam
        const dt = Math.max(vy / G + 0.1, Math.min(T * 0.72, vy / G + 0.2));
        if (dt <= 0.15 || dt >= T - 0.08) continue;
        const tope = +(k.y + vy * dt - G * dt * dt / 2).toFixed(3);
        const x = +(k.xm + dt).toFixed(3);
        if (!cabe(x, tope)) continue;
        for (let p = Math.ceil((x - 0.2) * 4); p <= Math.floor((x + 0.2) * 4); p++) {
          const golpe = golpeEn(p);
          if (!golpe) continue;
          const d = Math.abs(p / 4 - x);
          if (!mr || PESO[golpe] > PESO[mr.golpe] ||
              (PESO[golpe] === PESO[mr.golpe] && d < mr.d)) mr = { p, golpe, x, tope, d };
        }
      }
      if (!mr) continue;      // sin golpe no hay piston: un caño mudo es decorado
      // `cada` cuenta caños VIABLES, no teclas. Contando teclas, el azar del
      // muestreo elegia justo las corcheas del galope --donde ningun caño
      // cabe-- y DESPEGUE II se quedaba sin martillos aunque sus negras los
      // tenian servidos.
      if (++n % (z.cada || 1)) continue;
      PASOS_BATERIA.add(mr.p);
      PASOS_PISTON.add(mr.p);
      r.push({ x: mr.x, x0: +(mr.x - 0.15).toFixed(3), x1: +(mr.x + 0.15).toFixed(3), y: mr.tope, instr: mr.golpe, paso: mr.p });
    }
  }
  return r;
}

// Tramos donde la esfera toca el BAJO: ahi el bajo de fondo calla.
export let ZONAS_BAJO = [];
export const enZonaBajo = x => ZONAS_BAJO.some(z => x >= z.x0 && x < z.x1);
// Donde la melodia se dobla una octava arriba (el climax del estudio).
export let OCTAVAS = [];
export const enOctava = x => OCTAVAS.some(z => x >= z.x0 && x < z.x1);
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
  // ...con dos excepciones. Una la declara la cancion (`sinAbismo`: el
  // aterrizaje es la vuelta de la victoria y el premio no se cobra con un
  // susto). La otra es una ley del juego: EL ABISMO NO ESPERA AL QUE VUELVE.
  // Un riel que entra JUSTO DESPUES de un silencio largo recibe a alguien que
  // viene rodando por la red y tiene que reengancharse; si ahi abajo no hay
  // red, fallar el reenganche --que es exactamente lo que pasa cuando venis
  // recuperandote-- mata sin que hubiera nada que sostener. Se cae, se rueda,
  // se vuelve a subir: eso es un respiro. Morir, no.
  const libre = c.sinAbismo || [];
  const trasSilencio = n => {
    const ant = NOTAS[n.i - 1];
    return !!ant && ant.silencio && !ant.piso;
  };
  HUECOS = NOTAS
    .filter(n => n.riel && n.b >= LARGO / 2 && n.x1 - n.x0 > 1.2 && !trasSilencio(n) &&
      !libre.some(z => n.x0 < z.x1 && n.x1 > z.x0))
    .map(n => {
      // ...y no puede empezar antes de que la esfera alcance a TOCAR LA RED. Si
      // fallaste la nota anterior salis de su borde con vy=0 y caes; desde la
      // banda de la melodia esa caida tarda mas de 0.85 tiempos, y con el hueco
      // clavado a 0.7 cruzabas el cero ya adentro. Se moria sin un solo toque
      // posible: en el aire el boton no responde (salvo el coyote, que vence
      // mucho antes) y el riel queda MAS ARRIBA, asi que la esfera le pasa por
      // debajo. Un fallo costaba la corrida entera en vez de la nota.
      const ant = NOTAS[n.i - 1];
      const caida = ant && !ant.silencio ? Math.sqrt(2 * ant.y / G) + 0.25 : 0.7;
      return { x0: +(n.x0 + Math.max(0.7, caida)).toFixed(3), x1: +(n.x1 - 0.1).toFixed(3) };
    })
    // si de tan corrido el abismo ya no es un abismo, no hay abismo
    .filter(h => h.x1 - h.x0 > 0.3);
  // La zona de dribleo se sostiene PICANDO: entre pad y pad la red se corta.
  // Pasarla sin driblear no existe -- rodar te lleva al abismo. Picar corrido
  // no te tira (el bote se corrige al proximo pad): el espacio perdona, el
  // sonido no.
  for (const z of ARPEGIOS)
    for (let bx = Math.ceil(z.x0); bx < z.x1 - 0.6; bx++)
      HUECOS.push({ x0: +(bx + 0.3).toFixed(3), x1: +(bx + 0.7).toFixed(3) });
  TECHOS = calcularTechos();
  // Los caños compilan ANTES que los orbes: reclaman el backbeat del compas, y
  // recien despues los orbes se reparten los golpes que quedan. Al reves, los
  // 178 orbes se llevaban los golpes buenos y al caño le tocaba un hat.
  PASOS_BATERIA = new Set(); PASOS_BAJO = new Set(); PASOS_ARP = new Set(); PASOS_PISTON = new Set();
  ZONAS_PISTON = c.pistones || [];
  PISTONES = pistones();
  ORBES = orbes();
  ZONAS_BAJO = NOTAS.filter(n => n.bajo)
    .map(n => ({ x0: n.x0 - 0.3, x1: n.x1 + 0.3 }));
  OCTAVAS = c.octavas || [];
  SECCIONES = c.secciones;
  TRAMOS_RODAR = tramosRodar();
}
export const nombreCancion = id => CANCIONES[id || CANCION_ID].nombre;
const planCompas = c => CANCIONES[CANCION_ID].plan(c);

elegirCancion('aurora');   // el default de siempre: los tests corren contra esta

// --- simulacion --------------------------------------------------------------

export function crearSim (opts = {}) {
  return {
    // SIN RED: el concierto del que ya se sabe la cancion. Caer a la red mata,
    // salvo donde la partitura MANDA rodar (los silencios largos y la vuelta
    // final). El juego base promete "el error cuesta la nota, nunca el tramo";
    // aca el jugador cambia esa promesa, a sabiendas, por la de los abismos:
    // 277 notas y ninguna red debajo.
    sinRed: !!opts.sinRed,
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
    bloqueoDesde: -Infinity, // desde donde: el arco de sordera se dibuja vaciandose
    ultimoToque: -Infinity, // para distinguir un toque adelantado de una rafaga
    tocadas: new Set(),
    limpias: new Set(),     // las que ademas sonaron afinadas: ese es el puntaje
    perfectas: new Set(),   // y las clavadas en el centro: la maestria
    racha: 0, mejorRacha: 0, falsos: 0,
    orbes: 0, orbesTocados: new Set(),   // los orbes cosechados en el aire
    soltoEn: null,          // cuando solto el riel: corre la gracia de repique
    pistones: new Set(), pistonazos: 0,   // caños ya disparados
    eventos: []
  };
}

// EL RANGO: la maestria como premio, y nada mas que eso. La escalera sube por
// limpias, y arriba del todo hay dos peldaños de leyenda: AURORA (todo limpio
// y todos los orbes) y SUPERNOVA (ademas, el 85% clavado en el centro). Es
// funcion pura y exportada: el record la persiste y las pruebas la miran.
export const RANGOS = ['LLEGASTE', 'AFINADO', 'MUSICO', 'VIRTUOSO', 'AURORA', 'SUPERNOVA'];
export function rango (limpias, total, orbes, totalOrbes, perfectas = 0) {
  const t = total || 1;
  const pl = limpias / t;
  const todoOrbe = !totalOrbes || orbes >= totalOrbes;
  if (pl >= 1 && todoOrbe && perfectas / t >= 0.85) return 'SUPERNOVA';
  if (pl >= 1 && todoOrbe) return 'AURORA';
  return pl >= 0.95 ? 'VIRTUOSO' : pl >= 0.85 ? 'MUSICO' : pl >= 0.7 ? 'AFINADO' : 'LLEGASTE';
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
  if (!sig) { s.vy = 0; return; }
  // Al silencio LARGO se cae solo (el respiro). Al corto se lo sobrevuela: la
  // nota que termina te despide hasta la del otro lado. Si llegaste tan tarde
  // que el arco ya no sale sano, se cae -- y abajo esta la red, no un techo.
  if (sig.silencio) {
    const tras = NOTAS[sig.i + 1];
    if (!sig.volado || !tras || tras.silencio) { s.vy = 0; return; }
    const T = tras.x0 + MIRA - s.x;
    const vy = T > 0.1 ? (tras.y - s.y) / T + G * T / 2 : Infinity;
    s.vy = vy <= VUELO_SILENCIO ? vy : 0;
    return;
  }
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
  // Hacia abajo no se empuja. Si el impulso salio negativo (la tecla que sigue
  // esta mas abajo y cerca), se apunta mas adentro --hasta el pulso, nunca mas
  // alla-- para acercar el arco a la caida libre. Aterrizar mas adentro es
  // llegar un poco despues, no fallar; y una esfera que CAE se ve caer, no
  // salir clavada hacia abajo.
  if (s.vy < 0 && destino.y < s.y) {
    const T2 = Math.min(destino.xm - s.x, caidaLibre(destino.y - s.y));
    if (T2 > T) s.vy = (destino.y - s.y) / T2 + G * T2 / 2;
  }
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
  // ...y el otro extremo. El juego sabia castigar con matices y premiaba
  // plano: clavarla en el centro sonaba igual que llegar "suficiente". PERFECTO
  // es el tercio interior de la ventana, y tiene ceremonia propia.
  const perfecto = !chueca && Math.abs(dev) <= AFINADO * PERFECTO;
  if (perfecto) s.perfectas.add(obj.i);
  // El PUNTAJE es binario (afinaste o no), pero el SONIDO no puede serlo: un
  // instrumento no tiene dos estados, se ensucia de a poco. `suc` es cuanto te
  // corriste, de 0 (justo en el pulso) a 1 (el doble de la ventana): con eso la
  // voz se desafina, se apaga y raspa en proporcion. El escalon --a los 95 ms
  // perfecto, a los 97 roto-- era lo que sonaba a maquina.
  const suc = Math.min(1, Math.abs(dev) / (AFINADO * 2));
  s.tocadas.add(obj.i);
  // La racha tiene DIENTES: perder una larga es un momento (el numero cae, el
  // mundo se apaga de golpe), y cada 8 seguidas es un hito que se anuncia.
  // Antes perder x22 se veia igual que perder x4: un lerp suave y nada mas.
  if (chueca) {
    if (s.racha >= 6) s.eventos.push({ tipo: 'rachaRota', n: s.racha, x: s.x, y: s.y });
    s.racha = 0;
  } else {
    s.limpias.add(obj.i); s.racha++; s.mejorRacha = Math.max(s.mejorRacha, s.racha);
    if (s.racha % 8 === 0) s.eventos.push({ tipo: 'hito', n: s.racha, x: s.x, y: s.y });
  }
  s.eventos.push({ tipo, f: obj.f, x: s.x, y: s.y, i: obj.i, tarde: dev, chueca, suc, perfecto, ...extra });
}

// El toque efectivo sobre una tecla. `xt` es DONDE se apreto el boton, que no
// siempre es donde se cobra: un toque adelantado espera en la cola y se paga al
// posarse, pero se juzga por el momento en que lo diste.
function pulsar (s, k, xt = s.x) {
  if (k.silencio) return false;           // la salida no suena
  if (k.riel) {
    // El riel se sostiene -- pero el riel YA SONADO se puede picar: un
    // saltito que sube a cosechar los orbes que flotan encima y cae de
    // vuelta al riel (si seguis sosteniendo). Lejos del final, para no
    // perderse el lanzamiento. El ataque de la nota sigue siendo sostener.
    if (s.tocadas.has(k.i) && s.x < k.x1 - 1.05) {
      s.estado = 'aire'; s.vy = G * 0.5; s.tecla = -1; s.saliendoDe = -1;
      s.soltoEn = null;
      s.eventos.push({ tipo: 'saltoRiel', x: s.x, y: s.y });
      return true;
    }
    return false;
  }
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
    const impacto = Math.abs(s.vy);          // con cuanta fuerza pego: el peso
    s.estado = 'apoyada'; s.tecla = mejor.i; s.y = mejor.y; s.vy = 0;
    s.coyote = null; s.saliendoDe = -1;
    s.eventos.push({ tipo: 'posar', x: s.x, y: mejor.y, riel: !!mejor.riel, impacto });
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
    // SIN RED: la red esta, pero solo donde la partitura manda rodar. Fuera de
    // ahi, tocarla es el final -- que es exactamente lo que el jugador pidio.
    if (s.sinRed && !mandaRodar(s.x)) { s.viva = false; s.causa = 'red'; return; }
    s.estado = 'apoyada'; s.tecla = -1; s.y = 0; s.vy = 0;
    s.eventos.push({ tipo: 'red', x: s.x, y: 0 });
  }
}

export function paso (s, dt) {
  if (!s.viva || s.meta) return;
  s.x += dt;

  if (s.estado === 'apoyada' && s.tecla >= 0) {
    const k = NOTAS[s.tecla];
    s.y = k.y + subidaRiel(k, s.x);      // el final del riel levanta
    // agarrar el riel tarde tambien desafina: la nota larga entra corrida
    if (k.riel && s.sostiene && s.x >= k.xm && !s.tocadas.has(k.i))
      anotar(s, k, s.x - k.xm, 'riel', { hasta: k.x1 });
    if (s.sostiene) s.soltoEn = null;         // reagarro a tiempo: gracia usada
    if (k.riel && !s.sostiene && s.x > k.x0 + GRACIA_RIEL && s.x < k.x1 - SUELTA) {
      // Soltar te tira -- pero no al instante: hay una GRACIA DE REPIQUE. Es
      // un boton solo: para tocar de nuevo (el saltito de los orbes) primero
      // hay que soltar, y sin esta gracia el segundo toque no existia nunca.
      if (s.soltoEn == null) s.soltoEn = s.x;
      if (s.x - s.soltoEn > REPIQUE) {
        if (s.tocadas.has(k.i)) s.eventos.push({ tipo: 'rielCorta' });
        despegar(s, k);
      }
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
    // rodar por la red no dispara nada solo: volver arriba es TU toque
    // ...y SIN RED, rodar mas alla del respiro escrito tampoco se perdona: el
    // reenganche tiene su ventana, y dejarla pasar es haberse caido
    if (s.sinRed && !mandaRodar(s.x)) { s.viva = false; s.causa = 'red'; return; }
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
        s.eventos.push({ tipo: 'orbe', x: o.x, y: o.y, n: o.n, c: o.c, instr: o.instr, semi: o.semi });
      }
    }
    // CAERLE ENCIMA AL CAÑO. Se cobra antes de posarse: la cabeza esta en el
    // aire, sobre el hueco entre teclas, asi que no compite con ninguna.
    if (s.vy <= 0) pisarPiston(s, yAntes);
    if (s.vy < 0) posarse(s, yAntes);
    // posarse puede matar (SIN RED toca la red y se acabo): el resto del paso
    // --el vastago, los caños, la meta-- no corre sobre una esfera muerta
    if (!s.viva) return;
  }
  // ...y el vastago, para el que viene rasante por la red
  if (s.y < ROCE) rozarPiston(s);
  // EL CAÑO EXPIRADO. Fallar un piston sigue sin castigar -- pero ya no es
  // invisible: se marca para que el whiff suene y la vista lo desplome. El
  // golpe que reclamo queda mudo, y eso ahora es el backbeat: se oye faltar.
  // Solo el que ACABA de expirar emite: tras un salto de seccion, los que
  // quedaron muy atras se marcan en silencio.
  for (const p of PISTONES) {
    if (s.pistones.has(p.x) || s.x <= p.x1 + 0.02) continue;
    s.pistones.add(p.x);
    if (s.x - p.x1 < 0.5)
      s.eventos.push({ tipo: 'piston', modo: 'perdido', x: p.x, y: p.y, instr: p.instr, paso: p.paso });
  }

  if (s.y < CAIDA_MUERTE) { s.viva = false; s.causa = 'hueco'; return; }
  for (const t of TECHOS) {
    if (s.x > t.x0 && s.x < t.x1 && s.y + 2 * R > t.y) { s.viva = false; s.causa = 'techo'; return; }
  }
  if (s.x >= LARGO) s.meta = true;
}

// El impulso que hace falta, desde donde estas, para llegar a la proxima tecla
// que todavia se pueda tocar. Es lo que usa el caño para devolverte a la linea.
function haciaLaProxima (s, minimo = 1.1) {
  const sig = NOTAS.find(n => !n.silencio && !s.tocadas.has(n.i) &&
    n.x0 + MIRA - s.x >= vueloMinimo(n.y - s.y));
  if (!sig) return minimo;
  const T = Math.max(0.25, sig.x0 + MIRA - s.x);
  return Math.min(1.9, (sig.y - s.y) / T + G * T / 2);
}

// PISARLO: el premio. Le caiste encima, o sea que el salto salio a tiempo. El
// caño suena su golpe, se hunde, y te deja de nuevo en la linea de vuelo -- no
// puede descolocarte, porque entonces acertarle seria un castigo.
function pisarPiston (s, yAntes) {
  for (const p of PISTONES) {
    if (s.pistones.has(p.x)) continue;
    if (s.x <= p.x0 || s.x >= p.x1) continue;
    if (yAntes < p.y || s.y > p.y) continue;
    s.pistones.add(p.x); s.pistonazos++;
    s.y = p.y;
    // te deja EXACTAMENTE en la linea de vuelo hacia la proxima tecla: si
    // acertarle te descolocara, acertarle seria un castigo
    s.vy = haciaLaProxima(s, s.vy);
    s.eventos.push({ tipo: 'piston', modo: 'encima', x: s.x, y: p.y, instr: p.instr, paso: p.paso });
    return;
  }
}

// ROZARLO: el rescate. Venis rodando por la red --fallaste la tecla-- y el
// vastago te agarra de abajo y te DISPARA de vuelta a la cancion. Cuesta la
// racha y un rato de sordera, pero es mejor que quedarse afuera del tema.
function rozarPiston (s) {
  for (const p of PISTONES) {
    if (s.pistones.has(p.x)) continue;
    if (s.x <= p.x0 || s.x >= p.x1) continue;
    s.pistones.add(p.x); s.pistonazos++;
    if (s.racha >= 6) s.eventos.push({ tipo: 'rachaRota', n: s.racha, x: s.x, y: s.y });
    s.racha = 0;
    s.bloqueo = Math.max(s.bloqueo, s.x + CASTIGO);
    s.bloqueoDesde = s.x;
    s.estado = 'aire'; s.tecla = -1; s.saliendoDe = -1; s.soltoEn = null;
    s.vy = haciaLaProxima(s);
    s.eventos.push({ tipo: 'piston', modo: 'abajo', x: s.x, y: s.y, instr: p.instr, paso: p.paso });
    return;
  }
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
    // saltito de siempre; pasado el techo, el proximo toque si relanza.
    // ...y solo a una tecla a la que se llegue CAYENDO. Sin esto el rescate
    // resolvia el impulso para estar a la altura de la tecla justo sobre su
    // borde, y a una tecla cercana y alta eso es un cohete: se llega todavia
    // subiendo, se la atraviesa por abajo, y la esfera sigue de largo hasta
    // dos tiempos despues -- de cabeza contra el techo del silencio siguiente.
    // Es la misma razon por la que existe vueloMinimo; lanzar() ya la usaba y
    // el rescate no. Si no hay ninguna alcanzable, queda el saltito de abajo.
    // ...y se apunta MAS ADENTRO si al borde no se llega, igual que lanzar():
    // a un riel largo se sube donde se pueda, aunque sea tarde (la nota entra
    // corrida, que es el precio justo). Apuntar siempre al borde hacia una
    // tecla alta y cercana pedia un cohete: se llegaba todavia subiendo, se la
    // atravesaba por abajo y la esfera seguia de largo hasta el techo del
    // silencio siguiente. Y rendirse cuando el borde no daba dejaba a la esfera
    // rodando debajo de un riel de cuatro tiempos, derecho a su abismo.
    const donde = n => Math.max(n.x0 + MIRA, s.x + vueloMinimo(n.y - s.y));
    // Lo que importa es DONDE SE ATERRIZA, no donde empieza la tecla: si no,
    // un riel de cuatro tiempos bajo el que ya estas parado queda invisible
    // para el rescate --su borde quedo atras-- y la esfera se queda rodando
    // debajo de la unica tecla a la que podia subir, derecho a su abismo.
    const k = NOTAS.find(n =>
      !n.silencio && donde(n) > s.x + 0.2 && donde(n) <= n.x1 - 0.02 &&
      !TECHOS.some(t => (n.x0 > t.x0 - 0.3 && n.x0 < t.x1) || (t.x0 > s.x && t.x0 < n.x0)));
    if (k) {
      s.estado = 'aire';
      const T = Math.max(0.2, donde(k) - s.x);
      s.vy = Math.min(1.9, (k.y - s.y) / T + G * T / 2);
    } else if (!TECHOS.some(t => t.x0 > s.x - 0.1 && t.x0 < s.x + 1.2)) {
      s.estado = 'aire';
      s.vy = 0.62;              // el saltito de siempre: ni sube ni cuesta nada
    }
    // ...pero si hay un techo por delante NO hay saltito: el saltito dura un
    // tiempo entero y te deposita justo debajo, que es lo unico que el techo
    // castiga. Tocar ahi no puede matarte por algo que todavia no se ve; el
    // toque se gasta y se sigue rodando, que es exactamente lo que el techo
    // pide. Antes esto mataba al que se caia una nota antes de un silencio.
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
  s.bloqueoDesde = s.x;               // para que la sordera se VEA terminar
  if (s.racha >= 6) s.eventos.push({ tipo: 'rachaRota', n: s.racha, x: s.x, y: s.y });
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

  // LO QUE QUEDA ENTRE PARTIDAS. Morir sin un numero es morir dos veces: no
  // sabes si estuviste cerca. Se guarda hasta donde llegaste y cuantas limpias
  // hiciste, por cancion, y se dice al morir. Es el unico enganche que se
  // permite el juego -- nada de monedas ni de energia.
  const MEM = 'drible:record:';
  const leerRecord = id => {
    try { return JSON.parse(localStorage.getItem(MEM + id)) || null; } catch (_) { return null; }
  };
  // El record tiene MEMORIA DE MAESTRIA: no solo hasta donde llegaste, sino la
  // mejor racha, las clavadas, los orbes y el rango. Cada campo se queda con
  // su maximo historico -- sin esto, completar una cancion mataba la
  // zanahoria: el menu decia "completa" para siempre y daba igual volver.
  // Records viejos {pct, limpias} entran con defaults en cero.
  function guardarRecord (id, d) {
    const r = leerRecord(id) || {};
    const n = {
      pct: Math.max(d.pct || 0, r.pct || 0),
      limpias: Math.max(d.limpias || 0, r.limpias || 0),
      perf: Math.max(d.perf || 0, r.perf || 0),
      racha: Math.max(d.racha || 0, r.racha || 0),
      orbes: Math.max(d.orbes || 0, r.orbes || 0),
      sinRedPct: Math.max(d.sinRedPct || 0, r.sinRedPct || 0),
      rango: [d.rango, r.rango].filter(Boolean)
        .sort((a, b) => RANGOS.indexOf(b) - RANGOS.indexOf(a))[0] || null
    };
    try { localStorage.setItem(MEM + id, JSON.stringify(n)); } catch (_) {}
    return n;
  }
  let ac = null, master = null, voz = null, t0 = 0, proxBeat = 0;
  let solo = null, fondo = null;      // el que toca la esfera, y el arreglo
  // El solista entra: el arreglo se agacha un instante para dejarlo pasar.
  // EL CRATER. En el paso de semicorchea que un caño reclamo, el arreglo
  // entero se ABRE --se hunde a la mitad por un tercio de segundo-- pase lo
  // que pase. Si la esfera pisa el caño, su golpe cae dentro del pozo y por
  // fin es un ACENTO (carvear antes del golpe es como se acentua en una mezcla
  // real, no subiendo el sample). Si nadie lo pisa, el pozo suena VACIO: la
  // banda se agacha para un golpe que no llega -- el fallo se oye solo.
  const crateres = [];
  function aplicarCrater (t) {
    if (!fondo) return;
    const g = fondo.gain;
    g.setValueAtTime(1, t - 0.02);
    g.linearRampToValueAtTime(0.5, t + 0.015);
    g.linearRampToValueAtTime(1, t + 0.3);
  }
  function agendarCrater (t) { crateres.push(t); aplicarCrater(t); }
  function agachar (t, cuanto = 0.62, dur = 0.17) {
    // Corto y poco: en EMPUJE el bajo va en corcheas y un agache largo dejaria
    // el arreglo hundido de punta a punta, que ya no es destacar al solista
    // sino bajarle el volumen a la cancion.
    if (!fondo) return;
    const g = fondo.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(cuanto, t + 0.015);
    g.linearRampToValueAtTime(1, t + dur);
    // el cancel de arriba se lleva los crateres agendados a futuro: se
    // re-aplican, o el fallo de un caño volveria a ser mudo
    for (let i = crateres.length - 1; i >= 0; i--) {
      if (crateres[i] < t - 0.5) { crateres.splice(i, 1); continue; }
      if (crateres[i] >= t + dur) aplicarCrater(crateres[i]);
    }
  }
  let corriendo = false, finSonado = false;

  const estela = [], particulas = [], destellos = [], desvios = [];
  const avisos = [], marcas = [];     // cuanto te corriste, dicho y dibujado
  let squash = 0, flash = 0, rielVoz = null;
  // LA CEREMONIA DEL ACIERTO. El juego sabia castigar con matices --la voz se
  // ensucia de a poco-- y premiaba plano: clavar una nota en el centro se veia
  // igual que llegar apenas adentro. El anillo y la retencion son el premio
  // que faltaba: se ve, se siente en el cuerpo de la esfera, y no dice nada.
  const aros = [];
  let retencion = 0;
  function celebrar (e) {
    if (!e.perfecto) return;
    aros.push({ x: e.x, y: e.y, t: performance.now() });
    retencion = 0.05;                 // 50 ms de peso: el golpe se APOYA
  }
  let giro = 0, asiento = 0, asientoV = 0;   // el peso: rodadura y aterrizaje
  // LA RESPIRACION. El fondo era un relleno plano: la musica pasaba y la imagen
  // no se enteraba. Ahora el bombo lo hunde (el mismo sidechain que ya hunde al
  // bajo), el pad lo enciende, el acorde lo tiñe y la racha lo satura.
  const golpesVista = [], padsVista = [];
  // el estado visible de cada caño (paso -> {t, modo}) y el hundimiento de
  // pantalla del pisoton: el golpe baja el mundo entero unos pixeles
  const cabezas = new Map();
  let pisada = 0;
  // la racha que se acaba de romper (el numero cae) y el record historico a
  // perseguir (se anuncia una vez por corrida al superarlo)
  let rachaRota = null, rachaRecord = 0, rachaAvisada = false;
  let ultSeccion = 0;   // el capitulo que ya se anuncio: cruzar al siguiente avisa
  let metaRecord = null; // si esta corrida mejoro la marca, la meta lo celebra
  // el drop en pantalla: crashes agendados que al sonar liberan un flash, y el
  // riser vivo que tensa la imagen mientras sube
  const crashVista = [];
  let riserVista = null;
  let leccionViva = null;   // la leccion sin lugar fijo: red y sordera, sobre la esfera
  let vecesRed = 0;         // cuantas veces se explico la red: no se insiste
  // el flash tiene SEMANTICA: blanco para los golpes de siempre, rojizo para
  // la muerte, dorado para la meta -- el mismo destello no puede significar
  // todo a la vez
  let flashRGB = '232,230,224';
  // la esfera se ve morir: esquirlas en coordenadas de PANTALLA (sobreviven al
  // teletransporte de la camara a x=0) -- y la meta se revela por tiempos
  let muerteVista = null, metaEn = 0;
  // Las teclas son un instrumento, no un piso: se hunden con el peso de la
  // esfera y vuelven solas. La que se esta pisando comparte el mismo resorte
  // que la esfera --por eso bajan juntas-- y al soltarla vuelve sola.
  const teclaHundida = new Map();
  let pump = 0, padLuz = 0, tinte = [70, 90, 150], brilloRacha = 0;
  // Las tres capas del horizonte: cuanto se mueven (f), cuanto se achatan (k),
  // a que altura arrancan y cada cuantas notas toman un pico. La de mas lejos
  // toma una nota de cada seis: de lejos se ve la FORMA de la cancion, no sus
  // notas.
  const CAPAS = [
    { f: 0.14, k: 0.62, base: 0.34, a: 0.20, salto: 6 },
    { f: 0.31, k: 0.46, base: 0.17, a: 0.15, salto: 3 },
    { f: 0.55, k: 0.28, base: 0.04, a: 0.11, salto: 2 }
  ];
  const TINTE = {
    Am: [70, 95, 165], F: [160, 110, 70], C: [80, 150, 130],
    G: [120, 95, 175], Dm: [130, 65, 120], E: [175, 80, 65]
  };
  // el color tambien deja de ser un si/no: va del limpio al sucio de a poco
  const mezcla = (a, b, t) => a.split(',').map((v, i) =>
    Math.round(+v + (+b.split(',')[i] - +v) * t)).join(',');

  // LA LATENCIA DEL APARATO. En un telefono el sonido sale entre 50 y 150 ms
  // despues de que lo pedimos: el jugador toca cuando OYE, o sea tarde, y un
  // juego afinado en la PC se siente roto en el celular. La calibracion mide
  // ese retraso y el reloj del JUEGO se atrasa lo mismo -- la musica se agenda
  // igual que siempre (ahoraAudio), pero la esfera y la vista corren detras,
  // asi que lo que ves coincide con lo que escuchas.
  let desfase = 0;                       // segundos
  try { desfase = Math.max(0, Math.min(0.35, +localStorage.getItem('drible:desfase') || 0)); } catch (_) {}
  const ahoraAudio = () => ac ? (ac.currentTime - t0) / SPB : 0;
  const ahora = () => ac ? (ac.currentTime - t0 - desfase) / SPB : 0;

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
      // EL SOLISTA Y EL FONDO. Lo que toca la esfera no puede sonar igual que
      // ese mismo instrumento en el arreglo: el bajo del jugador salia a 0.16
      // y el del fondo a 0.155, o sea compitiendo consigo mismo, y se perdia.
      // Ahora hay dos buses. Por SOLISTA va todo lo que toca la esfera, mas
      // fuerte y con un realce de agudos: el mismo golpe suena mas cerca, mas
      // al frente. Y cuando el solista entra, el FONDO se agacha un instante.
      // Asi es como un disco pone a alguien adelante -- no subiendole el
      // volumen a todo hasta que no se entiende nada.
      solo = ac.createGain();
      solo.gain.value = 1;
      const brillo = ac.createBiquadFilter();
      brillo.type = 'highshelf'; brillo.frequency.value = 1600; brillo.gain.value = 4;
      solo.connect(brillo).connect(master);
      fondo = ac.createGain();
      fondo.gain.value = 1;
      fondo.connect(master);
    }
    ac.resume();
    rodadaAbrir();
    t0 = ac.currentTime + 0.12;
    proxBeat = 0;
    finSonado = false;
  }

  // La rodadura: mientras la esfera apoya, roza. Es lo que separa "se desliza
  // sobre iconos" de "hay una pelota tocando una superficie". Va bajita y
  // sigue la altura de la tecla: agudo arriba, sordo abajo.
  let rodada = null;
  function rodadaAbrir () {
    if (rodada) return;
    const n = ac.sampleRate | 0, buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src2 = ac.createBufferSource(); src2.buffer = buf; src2.loop = true;
    const bq = ac.createBiquadFilter(); bq.type = 'bandpass'; bq.frequency.value = 1200; bq.Q.value = 0.8;
    const g = ac.createGain(); g.gain.value = 0.0001;
    src2.connect(bq).connect(g).connect(master);
    src2.start();
    rodada = { bq, g };
  }
  let vaiven = 0;
  function rodadaSeguir () {
    if (!rodada) return;
    vaiven += 0.017;
    const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
    const sonando = corriendo && s.viva && !s.meta && s.estado === 'apoyada';
    const obj = !sonando ? 0.0001 : k ? (k.riel ? 0.05 : 0.035) : 0.018;
    rodada.g.gain.setTargetAtTime(obj, ac.currentTime, 0.035);
    // el roce respira: una superficie real no da un tono fijo
    const vv = 1 + 0.13 * Math.sin(vaiven) + 0.05 * Math.sin(vaiven * 2.7);
    rodada.bq.frequency.setTargetAtTime(
      (k ? Math.min(3800, 650 + (k.y - Y_GRAVE) * 5600) : 700) * vv, ac.currentTime, 0.06);
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
  function ruido (t, dur, gan, filtro = null, f = 1000, Q = 1, dest = null) {
    const n = Math.max(1, ac.sampleRate * dur | 0), buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource(); src.buffer = buf;
    const g = ac.createGain(); g.gain.value = gan;
    if (filtro) {
      const bq = ac.createBiquadFilter();
      bq.type = filtro; bq.frequency.value = f; bq.Q.value = Q;
      src.connect(bq).connect(g).connect(dest || master);
    } else src.connect(g).connect(dest || master);
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
    if (!duckE) { duckE = ac.createGain(); duckE.connect(fondo || master); }
    return duckE;
  };
  const EG = 2.5;
  function eBeep (t, f, dur, tipo, gan, slide, alBus, dest) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = tipo || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(gan, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || (alBus ? busE() : fondo || master));
    o.start(t); o.stop(t + dur + 0.02);
  }
  function eKick (t, duro, d) {
    eBeep(t, duro ? 165 : 135, 0.13, 'sine', (duro ? 0.13 : 0.105) * EG, 42, false, d || fondo);
    ruido(t, 0.025, 0.02 * EG, 'lowpass', 2600, 1, d || fondo);
    const g = busE().gain;
    g.cancelScheduledValues(t); g.setValueAtTime(1, t);
    g.linearRampToValueAtTime(0.42, t + 0.012); g.linearRampToValueAtTime(1, t + 0.24);
  }
  const eSnare = (t, d) => {
    ruido(t, 0.09, 0.05 * EG, 'highpass', 1700, 1, d || fondo);
    ruido(t, 0.16, 0.024 * EG, 'bandpass', 900, 1, d || fondo);
    eBeep(t, 195, 0.05, 'triangle', 0.032 * EG, 0, false, d || fondo);
  };
  const eHat = (t, abierto, d) =>
    ruido(t, abierto ? 0.09 : 0.028, (abierto ? 0.02 : 0.017) * EG, 'highpass', 7200, 1, d || fondo);
  const eClap = (t, d) => {
    ruido(t, 0.03, 0.045 * EG, 'bandpass', 1500, 1, d || fondo);
    ruido(t + 0.012, 0.03, 0.04 * EG, 'bandpass', 1500, 1, d || fondo);
    ruido(t + 0.026, 0.13, 0.05 * EG, 'bandpass', 1200, 1, d || fondo);
  };
  const eCrash = t => ruido(t, 0.55, 0.045 * EG, 'highpass', 4200, 1, fondo);
  const eTom = (t, f, d) => { eBeep(t, f, 0.2, 'sine', 0.095 * EG, f * 0.45, false, d || fondo); ruido(t, 0.02, 0.012 * EG, 'lowpass', 1800, 1, d || fondo); };
  function eBajo (t, f, gan, d) {
    const filtro = ac.createBiquadFilter(); filtro.type = 'lowpass';
    // El bajo del arreglo es oscuro a proposito (retumba y no estorba). El del
    // JUGADOR se abre el doble: asi se oye QUE nota toco, no solo que hubo un
    // golpe grave. La diferencia de timbre es lo que hace reconocer "ese soy yo".
    filtro.frequency.setValueAtTime(d ? 1200 : 560, t);
    filtro.frequency.exponentialRampToValueAtTime(d ? 420 : 180, t + 0.16);
    const g = ac.createGain();
    g.gain.setValueAtTime(gan, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (d ? 0.32 : 0.2));
    filtro.connect(g).connect(d || busE());
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t);
    o.connect(filtro); o.start(t); o.stop(t + 0.35);
    const gs = ac.createGain(); gs.gain.value = 1;      // el sub: seno una octava abajo
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(f / 2, t);
    o2.connect(gs).connect(filtro); o2.start(t); o2.stop(t + 0.35);
  }
  const eArp = (t, f, gan, d) => eBeep(t, f, d ? 0.11 : 0.07, 'square', gan, 0, true, d);
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
  const eTambor = (c, t, d) => {
    if (c === 'k') eKick(t, false, d); else if (c === 'K') eKick(t, true, d);
    else if (c === 's') eSnare(t, d); else if (c === 'c') eClap(t, d);
    else if (c === 'h') eHat(t, false, d); else if (c === 'H') eHat(t, true, d);
    else if (c === 'u') eTom(t, 190, d); else if (c === 'T') eTom(t, 140, d); else if (c === 't') eTom(t, 95, d);
    else if (c === 'x') { eKick(t, false, d); eSnare(t, d); eClap(t, d); }
  };
  // El mismo golpe, pero tocado por la esfera: entra por el bus del solista y
  // agacha el arreglo. Es el gesto de un baterista que acentua, no un sample
  // mas fuerte.
  const golpeDeLaEsfera = (c, t) => { eTambor(c, t, solo); agachar(t); };

  // El sostenido, espejo del estudio: alla una nota prolongada es la misma
  // cuadrada sonando y decayendo a lo largo de toda la nota -- no otra voz.
  // Se guarda para poder soltarla si el jugador corta el riel antes.
  let rielVozE = null;
  function eRielAbrir (f, dur, gan = 0.13, suc = 0) {
    const t = ac.currentTime;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(18000 * Math.pow(0.07, suc), t);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gan, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(voz);
    const o = ac.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(f, t);
    o.detune.value = 60 * suc;
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
  // `suc` = cuanto te corriste, de 0 a 1. La nota suena SIEMPRE --nunca se
  // castiga con silencio-- pero se ensucia en proporcion: se desafina, se
  // apaga y raspa, como una cuerda cada vez peor pisada. Es continuo a
  // proposito: un instrumento no tiene dos estados, y el escalon --perfecto a
  // los 95 ms, roto a los 97-- era lo que delataba a la maquina.
  function lead (t, f, dur = 0.4, gan = 0.26, desde = 0, suc = 0) {
    // En las canciones portadas del estudio, la nota justa en el pulso es la
    // voz del estudio calcada: cuadrada limpia, brillante, ataque de 4 ms.
    if (CANCIONES[CANCION_ID].estudio) {
      // Espejo del estudio: alla casi toda nota melodica dura UNA semicorchea
      // (los puntos de su notacion son silencios), asi que la nota es un blip
      // corto de cuadrada -- por eso el eco se recorta nitido detras. Y el
      // ligado ataca fresco: en el estudio no hay glissando.
      // La suciedad la mueve entera: se acorta, pierde brillo, se desafina y
      // aparece una segunda voz batiendo contra la primera. Justo en el pulso
      // es exactamente la del estudio.
      const durE = Math.min(dur, 0.16) * (1 - 0.3 * suc);
      const ge = ac.createGain(), lpe = ac.createBiquadFilter();
      lpe.type = 'lowpass';
      lpe.frequency.setValueAtTime(18000 * Math.pow(0.07, suc), t);
      ge.gain.setValueAtTime(0.0001, t);
      ge.gain.linearRampToValueAtTime(gan * 0.45 * (1 - 0.3 * suc),
        t + Math.min(0.004 + 0.012 * suc, durE * 0.5));
      ge.gain.exponentialRampToValueAtTime(0.0001, t + durE);
      lpe.connect(voz);
      const o = ac.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(f, t); o.detune.value = 60 * suc;
      o.connect(ge).connect(lpe); o.start(t); o.stop(t + durE + 0.02);
      if (suc > 0.25) {                        // el batido y la uña que raspa
        const g2 = ac.createGain(); g2.gain.value = 0.5 * suc;
        const o2 = ac.createOscillator(); o2.type = 'square';
        o2.frequency.setValueAtTime(f, t); o2.detune.value = -75 * suc;
        o2.connect(g2).connect(ge); o2.start(t); o2.stop(t + durE + 0.02);
        ruido(t, 0.025, 0.06 * suc, 'bandpass', 900, 1.2);
      }
      return;
    }
    const lp = ac.createBiquadFilter(), g = ac.createGain();
    const ataque = desde ? 0.03 : 0.005;      // seco y al frente: pluck, no pad
    // EL BRILLO TIENE TECHO ABSOLUTO. Atado solo a la nota (f * 8), cada nota
    // mas aguda salia mas brillante que la anterior, y arriba la melodia se
    // volvia un silbido. Un instrumento de verdad no se pone mas brillante
    // porque toques mas agudo: el cuerpo del instrumento no cambia.
    lp.type = 'lowpass'; lp.Q.value = 2.2 - 1.2 * suc;
    lp.frequency.setValueAtTime(Math.min(4600 - 3100 * suc, f * 6), t);
    lp.frequency.exponentialRampToValueAtTime(
      Math.max(220, Math.min(1100 - 620 * suc, f * 1.6)), t + dur * 0.85);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gan * (1 - 0.3 * suc), t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(lp).connect(voz);
    // el pico del ataque: sin esto la nota entra sin uña y suena plana
    if (!desde) ruido(t, 0.02, 0.045 + 0.045 * suc, 'bandpass', 2600 - 1700 * suc, 1.2);
    // Triangulo de cuerpo + un poco de sierra para el filo + sub una octava
    // abajo. La cuadrada sola era la chicharra. Chueca, las voces se van para
    // lados distintos: eso es lo que bate y molesta.
    for (const [tipo, mul, v, des] of
      [['triangle', 1, 1, -45], ['sawtooth', 1, 0.32, -45], ['sine', 0.5, 0.5, 28]]) {
      const o = ac.createOscillator(), gv = ac.createGain();
      o.type = tipo; gv.gain.value = v;
      o.detune.value = des * suc;              // las voces se separan de a poco
      if (desde) {
        o.frequency.setValueAtTime(desde * mul, t);
        o.frequency.exponentialRampToValueAtTime(f * mul, t + 0.035);
      } else o.frequency.value = f * mul;
      o.connect(gv).connect(g); o.start(t); o.stop(t + dur + 0.02);
    }
  }

  function rielAbrir (f, suc = 0) {
    rielCerrar();
    const t = ac.currentTime;
    const g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 1.6;
    lp.frequency.value = Math.min(3400 - 2200 * suc, f * 5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2 - 0.05 * suc, t + 0.03);
    g.connect(lp).connect(voz);
    if (suc > 0.25) ruido(t, 0.05, 0.09 * suc, 'bandpass', 900, 1.2);
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
      o.detune.value = des * suc;
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
    const b = ahoraAudio();
    while (proxBeat < b + 2) {
      const t = t0 + proxBeat * SPB;
      const c = Math.floor(proxBeat / 4), i16 = Math.round((proxBeat - c * 4) * 4);
      const p = spec(c);
      if (p) {
        const ch = acordeEnCompas(c);
        const paso = Math.round(proxBeat * 4);   // el paso global de semicorchea
        const bat = E_BATERIA[p.drums];
        // el paso de un caño lleva CRATER: el arreglo se abre para el acento,
        // lo llene la esfera o quede vacio
        if (PASOS_PISTON.has(paso)) agendarCrater(t);
        if (bat && bat[i16] && bat[i16] !== '.' && !PASOS_BATERIA.has(paso)) {
          eTambor(bat[i16], t);
          if ('kKx'.includes(bat[i16])) golpesVista.push(t);
        }
        if (p.bajo && !enZonaBajo(proxBeat) && !PASOS_BAJO.has(paso)) {
          const n = E_BAJO[p.bajo][i16];
          if (n != null) eBajo(t, (ch.root / 4) * Math.pow(2, n / 12), 0.062 * EG);
        }
        // el arpegio de fondo calla en la zona de dribleo (ahi lo toca la
        // esfera) y en los pasos que un orbe de NEBULOSA reclamo: esa nota es
        // del que la cosecha, o de nadie
        if (p.arp && !enArpegio(proxBeat) && !PASOS_ARP.has(paso)) {
          const n = E_ARP[p.arp][i16];
          if (n != null) {
            const semis = ch.ints[n % 3] + 12 * Math.floor(n / 3);
            eArp(t, ch.root * Math.pow(2, semis / 12), 0.016 * EG * (p.arpGan || 1));
          }
        }
        if (i16 === 0) {
          if (p.pad) {
            ePad(t, ch.ints.map(sm => ch.root * Math.pow(2, sm / 12)), 0.014 * EG, 4 * SPB);
            padsVista.push(t);
          }
          // el drop tambien EXISTE EN PANTALLA: el riser tensa la imagen en
          // rampa y el crash la libera (ver el consumo en dibujar)
          if (p.crash) { eCrash(t); crashVista.push(t); }
          if (p.riser) { eRiser(t, p.riser * 4 * SPB); riserVista = { t0: t, t1: t + p.riser * 4 * SPB }; }
        }
      }
      proxBeat += 0.25;
    }
  }

  function agendarMusica () {
    const spec = CANCIONES[CANCION_ID].estudio;
    if (spec) { agendarEstudio(spec); return; }
    const b = ahoraAudio();
    while (proxBeat < b + 2) {
      const t = t0 + proxBeat * SPB;
      const c = Math.floor(proxBeat / 4), u = proxBeat - c * 4;
      const plan = planCompas(c);
      if (plan) {
        const arm = armonia(c);
        if (u === 0 && plan.pad) { acordePad(t, arm.acorde, 4 * SPB); padsVista.push(t); }
        if (plan.kick.includes(u)) { kick(t); golpesVista.push(t); }
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
    // Una sola verdad: PERFECTO es el MISMO flag que dispara el aro (antes el
    // texto usaba otro umbral y la ceremonia se contradecia: aro celebrando,
    // "+38" negandolo al lado). Y la limpia comun ya no imprime numerito: en
    // el galope eran tres textos por segundo compitiendo con el anillo de
    // anticipacion -- el medidor de abajo da ese dato mejor y sin gritar.
    const txt = e.chueca ? `${ms > 0 ? 'TARDE' : 'ANTES'} ${signo}${Math.abs(ms)}`
      : e.perfecto ? 'PERFECTO' : null;
    if (txt) {
      avisos.push({
        x: e.x, y: e.y, t: performance.now(), chueca: e.chueca, suc: e.suc,
        perf: !!e.perfecto, txt
      });
    }
  }

  function procesar () {
    for (const e of s.eventos) {
      if (e.tipo === 'nota') {
        // ventana rodante: un promedio sobre la corrida entera se congela a
        // los dos minutos y deja de ser feedback
        desvios.push(Math.abs(e.tarde) * SPB * 1000);
        if (desvios.length > 24) desvios.shift();
        aviso(e);
        if (NOTAS[e.i].bajo) {
          // tecla de bajo: la esfera esta tocando el bajo del estudio -- dos
          // octavas abajo de donde pisa, con la voz de alla. Sin eco: el bajo
          // no lo lleva. Chueca, sale apagada y con el golpe sordo.
          // Por el bus del SOLISTA y al triple de lo que sale el bajo del
          // arreglo: antes iban parejos y el jugador competia consigo mismo.
          eBajo(ac.currentTime, e.f / 8, 0.44 - 0.22 * e.suc, solo);
          agachar(ac.currentTime, 0.6, 0.16);
          // ...y la raiz del arpegio: con los tres orbes del arco, el up16
          // queda completo -- tocar bien el motor ES tocar el arpegio entero
          const ch = acordeEnCompas(Math.floor(e.x / 4));
          eArp(ac.currentTime, ch.root * 2, 0.17 * (1 - e.suc), solo);
          if (e.suc > 0.25) ruido(ac.currentTime, 0.05, 0.09 * e.suc, 'lowpass', 500);
          destellos.push({ x: e.x, y: e.y, t: performance.now(), suc: e.suc });
          chispas(e.x, e.y, Math.round(7 - 4 * e.suc), true, mezcla(C.impulsoRGB, C.suciaRGB, e.suc));
          squash = 1;
          celebrar(e);
          continue;
        }
        // acento: la nota que cae en el pulso pega mas fuerte. Todas iguales es
        // lo que sonaba plano -- un instrumento tiene dinamica, un beep no.
        const fuerte = NOTAS[e.i].b % 1 === 0;
        lead(ac.currentTime, e.f, Math.max(0.22, 0.46 - Math.abs(e.tarde) * 0.4),
          fuerte ? 0.29 : 0.21, 0, e.suc);
        // El eco, IDENTICO al estudio: alla lo lleva toda nota no prolongada
        // (en su notacion los puntos son silencios, asi que casi todas), 3
        // semicorcheas despues, al 30%. Aca: toda nota que no sea riel. La
        // chueca lo arrastra chueco: el eco repite lo que sono.
        // el CLIMAX dobla la melodia una octava arriba, como el estudio
        if (enOctava(e.x)) lead(ac.currentTime, e.f * 2, 0.24, (fuerte ? 0.29 : 0.21) * 0.5, 0, e.suc);
        if (!NOTAS[e.i].riel)
          lead(ac.currentTime + 0.75 * SPB, e.f, 0.1, (fuerte ? 0.29 : 0.21) * 0.3, 0, e.suc);
        // LA CLAVADA SE OYE: el eco realimenta una vez mas, perfectamente
        // limpio, solo cuando tocaste exacto. No entra ningun sonido nuevo al
        // arreglo -- se repite el eco que el estudio ya define. El premio
        // maximo de un juego musical tiene que ser musical.
        if (e.perfecto && !NOTAS[e.i].riel)
          lead(ac.currentTime + 1.5 * SPB, e.f, 0.1, (fuerte ? 0.29 : 0.21) * 0.15, 0, 0);
        destellos.push({ x: e.x, y: e.y, t: performance.now(), suc: e.suc });
        chispas(e.x, e.y, Math.round(7 - 4 * e.suc), true, mezcla(C.teclaRGB, C.suciaRGB, e.suc));
        squash = 1;
        celebrar(e);
      } else if (e.tipo === 'ligada') {
        lead(ac.currentTime, e.f, 0.5, 0.15, e.desde, e.suc);
        if (!NOTAS[e.i].riel)
          lead(ac.currentTime + 0.75 * SPB, e.f, 0.1, 0.15 * 0.3, 0, e.suc);
        destellos.push({ x: e.x, y: e.y, t: performance.now(), suc: e.suc });
        chispas(e.x, e.y, 5, false, mezcla(C.teclaRGB, C.suciaRGB, e.suc));
        squash = 0.8;
      } else if (e.tipo === 'riel') {
        if (CANCIONES[CANCION_ID].estudio)
          eRielAbrir(e.f, Math.max(0.3, (e.hasta - e.x) * SPB), 0.13, e.suc);
        else rielAbrir(e.f, e.suc);
        aviso(e);
        destellos.push({ x: e.x, y: e.y, t: performance.now(), suc: e.suc });
        chispas(e.x, e.y, Math.round(10 - 6 * e.suc), true, mezcla(C.teclaRGB, C.suciaRGB, e.suc));
        celebrar(e);
      } else if (e.tipo === 'saltoRiel') {
        // el saltito sobre el riel: mudo (la nota larga sigue sonando)
        squash = 0.8;
        chispas(e.x, e.y, 4, true);
      } else if (e.tipo === 'piston') {
        if (e.modo === 'perdido') {
          // el caño disparo al aire: whiff mecanico, seco, sin agache -- y el
          // crater ya agendado suena vacio, el backbeat que no llego
          ruido(ac.currentTime, 0.09, 0.1, 'bandpass', 380, 2);
          golpe(ac.currentTime, 95, 0.05, 0.06, 'square');
          cabezas.set(e.paso, { t: performance.now(), modo: 'perdido' });
        } else if (e.modo === 'encima') {
          // EL PISOTON. El golpe reclamado, tocado por la esfera DENTRO del
          // crater que el arreglo abrio -- sin agache propio: el crater ya es
          // el agache, doblarlo hundiria la cancion. El hat cerrado se ABRE al
          // pisarlo: mismo instrumento, gesto de acento, como un baterista que
          // abre el hi-hat en la sincopa. Y el eco del solista: el fondo jamas
          // ecoa la bateria, asi que un golpe con eco es TUYO aunque el timbre
          // sea identico.
          const instr = e.instr === 'h' ? 'H' : e.instr;
          if (instr) {
            eTambor(instr, ac.currentTime, solo);
            const g = ac.createGain(); g.gain.value = 0.3; g.connect(solo);
            eTambor(instr, ac.currentTime + 0.75 * SPB, g);
            if ('kKx'.includes(instr)) golpesVista.push(ac.currentTime);
          }
          // el peso del pisoton: aire metalico y un golpe sordo, foley del
          // caño, no musica
          ruido(ac.currentTime, 0.05, 0.14, 'highpass', 2400);
          golpe(ac.currentTime, 90, 0.1, 0.18, 'sine');
          // el cuerpo entero lo siente: hit-stop, anillo, el mundo pisado
          retencion = 0.09;
          aros.push({ x: e.x, y: e.y, t: performance.now() });
          destellos.push({ x: e.x, y: e.y, t: performance.now(), suc: 0 });
          chispas(e.x, e.y, 8, true, C.esferaRGB);
          chispas(e.x, e.y, 8, true, C.impulsoRGB);
          pump = 1; pisada = 1;
          cabezas.set(e.paso, { t: performance.now(), modo: 'encima' });
        } else {
          // el rescate desde abajo: el vastago te dispara de vuelta
          if (e.instr) golpeDeLaEsfera(e.instr === 'h' ? 'H' : e.instr, ac.currentTime);
          ruido(ac.currentTime, 0.16, 0.18, 'bandpass', 700, 1.1);
          eKick(ac.currentTime, true, solo);
          golpe(ac.currentTime, 120, 0.2, 0.18, 'square');
          golpe(ac.currentTime + 0.03, 240, 0.14, 0.1, 'triangle');
          chispas(e.x, e.y, 12, true, C.esferaRGB);
          cabezas.set(e.paso, { t: performance.now(), modo: 'abajo' });
        }
        squash = 1;
      } else if (e.tipo === 'orbe') {
        // la esfera atraveso un orbe: suena el golpe REAL que reclamo -- la
        // nota del arpegio, el hat/clap/caja de la bateria, o la del bajo
        if (e.instr === 'arp') {
          const ch = acordeEnCompas(e.c);
          const semis = ch.ints[e.n % 3] + 12 * Math.floor(e.n / 3);
          eArp(ac.currentTime, ch.root * Math.pow(2, semis / 12) * 2, 0.17, solo);
          agachar(ac.currentTime, 0.78, 0.11);
        } else if (e.instr === 'bajo') {
          const ch = acordeEnCompas(e.c);
          eBajo(ac.currentTime, (ch.root / 4) * Math.pow(2, e.semi / 12), 0.3, solo);
          agachar(ac.currentTime, 0.62, 0.18);
        } else if (e.instr === 'arpz') {
          // la nota del arpegio que el fondo callo: la MISMA nota, al frente.
          // La apuesta de NEBULOSA pagada en su propia moneda.
          const ch = acordeEnCompas(e.c);
          const semis = ch.ints[e.semi % 3] + 12 * Math.floor(e.semi / 3);
          eArp(ac.currentTime, ch.root * Math.pow(2, semis / 12), 0.12, solo);
          agachar(ac.currentTime, 0.78, 0.11);
        } else golpeDeLaEsfera(e.instr, ac.currentTime);
        destellos.push({ x: e.x, y: e.y, t: performance.now(), suc: 0 });
        chispas(e.x, e.y, 6, true, e.instr === 'arp' ? C.teclaRGB : C.esferaRGB);
      } else if (e.tipo === 'rachaRota') {
        // perder una racha larga ES un momento: el numero cae, el brillo del
        // mundo se apaga DE GOLPE (no en lerp: perder x22 no puede verse igual
        // que perder x4) y un golpe sordo lo dice. Foley, no musica.
        rachaRota = { n: e.n, t: performance.now() };
        brilloRacha = 0;
        ruido(ac.currentTime, 0.08, 0.1, 'lowpass', 400);
      } else if (e.tipo === 'hito') {
        // cada 8 limpias, un hito: el aro blanco estalla sobre la esfera y el
        // numero lo dice. Sin sonido nuevo: la musica sonando bien ES el premio.
        aros.push({ x: e.x, y: e.y, t: performance.now() });
        avisos.push({ x: e.x, y: e.y, t: performance.now(), chueca: false, suc: 0, txt: `x${e.n}` });
        if (rachaRecord && e.n > rachaRecord && !rachaAvisada) {
          rachaAvisada = true;
          avisos.push({ x: e.x, y: e.y + 0.12, t: performance.now(), chueca: false, suc: 0, txt: 'MEJOR RACHA' });
        }
      } else if (e.tipo === 'falso') {
        // martillaste: cuerda muerta. El boton queda sordo hasta que se acomode.
        ruido(ac.currentTime, 0.06, 0.14, 'bandpass', 700, 1.4);
        golpe(ac.currentTime, 70, 0.09, 0.16, 'square');
        chispas(e.x, e.y, 4, false, C.suciaRGB);
        // la primera sordera se explica una vez: sin esto parece que el juego
        // se comio tus toques porque si
        if (!aprendidas.has('sordo')) {
          aprendidas.add('sordo');
          leccionViva = { txt: 'martillaste — el boton quedo sordo un instante', t: performance.now() };
        }
      } else if (e.tipo === 'sordo') {
        // el toque comido se VE comerse: sin esto la sordera parece bug de input
        ruido(ac.currentTime, 0.015, 0.02);
        chispas(s.x, s.y, 2, false, '150,140,130');
      } else if (e.tipo === 'rielCorta') {
        if (rielVozE) eRielCerrar(); else rielCerrar();
      } else if (e.tipo === 'posar') {
        // el golpe suena y PESA: cuanto mas fuerte cae, mas se hunde
        // el golpe cambia con la altura de la tecla y nunca es identico dos
        // veces: lo exacto es lo que suena a maquina
        ruido(ac.currentTime, 0.03, 0.04 + 0.05 * Math.min(1, e.impacto), 'lowpass',
          700 + (e.y - Y_GRAVE) * 2600 + Math.random() * 260);
        squash = 0.5 + 0.5 * Math.min(1, e.impacto);
        asientoV = -Math.min(1.1, e.impacto) * 0.5;
      } else if (e.tipo === 'red') {
        ruido(ac.currentTime, 0.09, 0.09, 'lowpass', 700); squash = 0.9;
        chispas(e.x, 0, 5);
        // la primera caida merece su leccion: la red no es el final, es un
        // toque de distancia de la cancion. Dos veces y basta -- al que no
        // reacciona no lo convence la tercera, y el cartel pasa a ser ruido.
        if (!aprendidas.has('red') && ++vecesRed <= 2)
          leccionViva = { txt: 'TOCA: volves a la cancion', t: performance.now() };
      } else if (e.tipo === 'aire' || e.tipo === 'saltoRed') {
        ruido(ac.currentTime, 0.04, 0.03, 'highpass', 3000);
        if (e.tipo === 'saltoRed') { aprendidas.add('red'); leccionViva = null; }
      }
    }
    s.eventos.length = 0;
  }

  // Morir sin saber por que es lo mas frustrante que puede pasar: el juego lo
  // sabe (s.causa) y hasta ahora se lo guardaba.
  const PORQUE = {
    techo: 'te aplasto el techo — bajo el techo NO se toca',
    hueco: 'soltaste el riel sobre el vacio — ahi hay que mantener',
    dribleo: 'la red se corta entre piques — hay que PICAR al beat',
    // dice lo que paso, no lo que se supone que lo causo: fallar una nota no
    // siempre tira a la red -- lo que mata, aca, es tocarla
    red: 'SIN RED: tocaste la red — aca abajo no hay nada'
  };
  let avisoMuerte = null;
  function morirOReiniciar () {
    // Cuanto de la cancion tocaste, contra tu propio techo. El porcentaje es
    // el que hace que el reintento salga solo: "me faltaba poco" es una frase
    // que solo existe si el juego te dice cuanto faltaba.
    const pct = Math.min(100, Math.round(s.x / LARGO * 100));
    const antes = leerRecord(CANCION_ID);
    // en la zona de dribleo la causa dice la verdad: ahi no soltaste ningun
    // riel, te falto el pique
    const causa = s.causa === 'hueco' && ARPEGIOS.some(z => s.x >= z.x0 && s.x < z.x1 + 0.7)
      ? 'dribleo' : s.causa;
    if (!ensayo) {
      guardarRecord(CANCION_ID, {
        pct, limpias: s.limpias.size, perf: s.perfectas.size,
        racha: s.mejorRacha, orbes: s.orbes,
        // el sin red lleva su propia marca: es otra promesa, otro record
        sinRedPct: sinRed ? pct : 0
      });
      rachaRecord = Math.max(rachaRecord, s.mejorRacha); rachaAvisada = false;
    }
    // La muerte DIAGNOSTICA: ademas del numero, el informe por seccion (que
    // antes solo veia el que ganaba -- justo el que menos lo necesita) con la
    // seccion de la muerte señalada, y la comparacion contra tu record.
    avisoMuerte = {
      txt: PORQUE[causa] || null, ensayo,
      pct, record: antes ? antes.pct || 0 : 0, nuevo: !ensayo && (!antes || pct > (antes.pct || 0)),
      limpias: s.limpias, xm: s.x, limpiasRun: s.limpias.size,
      mejorLimpias: antes ? antes.limpias || 0 : 0,
      seccion: (SECCIONES.filter(z => z.x0 <= s.x).pop() || {}).n,
      t: performance.now()
    };
    rielCerrar(); eRielCerrar();
    mejor = Math.max(mejor, s.limpias.size);
    intento++;
    ensayo = false;      // morir reinicia en x=0, y eso ya es empezar de cero
    // la esfera ESTALLA donde estaba (coordenadas de pantalla: la camara ya se
    // teletransporto a la salida cuando esto se dibuja) y el flash se tiñe
    muerteVista = {
      y: s.y, t: performance.now(),
      esquirlas: Array.from({ length: 14 }, () => ({
        a: Math.random() * Math.PI * 2, v: 60 + Math.random() * 160
      }))
    };
    flashRGB = '255,120,90';
    s = crearSim({ sinRed });
    // 1.4 s, no 0.7: el respiro justo para LEER el diagnostico antes de que el
    // compas 1 reclame los dedos. Sigue siendo automatico: nadie toca nada.
    t0 = ac.currentTime + 1.4;
    proxBeat = 0;
    estela.length = 0;
    golpesVista.length = 0; padsVista.length = 0;
    cabezas.clear(); crateres.length = 0; pisada = 0;
    crashVista.length = 0; riserVista = null;
    desvios.length = 0;
    marcas.length = 0;
    avisos.length = 0;
    aros.length = 0;
    flash = 1;
  }

  // --- entrada -----------------------------------------------------------------

  function empezar (id) {
    elegirCancion(id);
    armarLecciones();
    ensayo = false;                 // arrancar de cero es el unico concierto
    sinRed = sinRedArmado;          // el modo se elige en el menu y dura la corrida
    golpesVista.length = 0; padsVista.length = 0;
    cabezas.clear(); crateres.length = 0; pisada = 0;
    crashVista.length = 0; riserVista = null;
    intento = 1; mejor = 0;
    // la marca a perseguir: superar tu mejor racha historica se anuncia
    rachaRecord = (leerRecord(id) || {}).racha || 0;
    rachaAvisada = false; rachaRota = null;
    metaRecord = null; avisoMuerte = null; ultSeccion = 0;
    metaEn = 0; muerteVista = null; leccionViva = null; vecesRed = 0;
    s = crearSim({ sinRed });
    estela.length = 0; desvios.length = 0; marcas.length = 0; avisos.length = 0; aros.length = 0;
    corriendo = true;
    arrancarAudio();
  }

  // CALIBRAR. Suenan 16 golpes y vos tocas encima. Lo que se mide no es tu
  // pulso sino el retraso del aparato: si TODOS tus toques llegan 90 ms tarde,
  // no es que toques mal, es que el sonido salio 90 ms tarde. Se guarda la
  // MEDIANA -- un toque perdido no puede mover el resultado, y el promedio si
  // se lo lleva puesto.
  let calib = null;
  function calibrar () {
    arrancarAudio();
    const t = ac.currentTime + 1.4, P = 0.6;          // 100 BPM, una cuenta comoda
    const clics = [];
    for (let i = 0; i < 16; i++) {
      const tc = t + i * P;
      clics.push(tc);
      kick(tc);
      if (i % 4 === 0) golpe(tc, 1500, 0.045, 0.16, 'square');
    }
    calib = { clics, devs: [], desde: t, fin: t + 15 * P + 0.45, listo: null };
  }
  function tocarCalib () {
    if (!calib || calib.listo) return;
    const t = ac.currentTime;
    let d = Infinity;
    for (const c of calib.clics) if (Math.abs(t - c) < Math.abs(d)) d = t - c;
    if (Math.abs(d) < 0.3) calib.devs.push(d);
  }
  function cerrarCalib () {
    const d = calib.devs.slice().sort((a, b) => a - b);
    // Sin toques suficientes NO se escribe nada. Abrir la calibracion y no
    // tocar (o tocar dos veces) borraba la medicion buena que ya estaba
    // guardada, y encima la pantalla decia "guardado": la forma mas facil de
    // romper el juego era mirar la pantalla que existe para arreglarlo.
    if (d.length < 5) {
      calib.listo = { ms: Math.round(desfase * 1000), n: d.length, guardado: false };
      return;
    }
    const m = d[d.length >> 1];
    // solo se compensa el ATRASO: adelantarse es cosa tuya, no del aparato
    desfase = Math.abs(m) < 0.012 ? 0 : Math.max(0, Math.min(0.35, m));
    try { localStorage.setItem('drible:desfase', String(desfase)); } catch (_) {}
    calib.listo = { ms: Math.round(desfase * 1000), n: d.length, guardado: true };
  }
  function dibujarCalib (w, h) {
    cx.textAlign = 'center';
    cx.fillStyle = C.peligro; cx.font = '17px system-ui';
    cx.fillText('CALIBRAR — toca con lo que ESCUCHAS', w / 2, h * 0.2);
    cx.fillStyle = C.tenue; cx.font = '13px system-ui';
    cx.fillText('no mires la pantalla: seguí el golpe con el oído', w / 2, h * 0.2 + 24);
    if (calib.listo) {
      cx.fillStyle = C.impulso; cx.font = 'bold 40px system-ui';
      cx.fillText(`${calib.listo.ms} ms`, w / 2, h * 0.47);
      cx.fillStyle = calib.listo.guardado ? C.esfera : C.sucia; cx.font = '14px system-ui';
      cx.fillText(calib.listo.guardado
        ? `guardado — ${calib.listo.n} toques medidos`
        : `muy pocos toques — sigue valiendo ${calib.listo.ms} ms`, w / 2, h * 0.47 + 26);
      return;
    }
    const falta = Math.max(0, calib.desde - ac.currentTime);
    cx.fillStyle = C.esfera; cx.font = 'bold 30px system-ui';
    cx.fillText(falta > 0 ? '…' : `${calib.devs.length}`, w / 2, h * 0.47);
    cx.fillStyle = C.tenue; cx.font = '12px system-ui';
    cx.fillText(falta > 0 ? 'preparate' : 'toques', w / 2, h * 0.47 + 22);
    // las marcas: donde cayo cada toque respecto del golpe
    const mw = 200, my = h * 0.62;
    cx.fillStyle = C.tenue; cx.fillRect(w / 2 - mw / 2, my, mw, 2);
    cx.fillStyle = 'rgba(255,255,255,0.9)'; cx.fillRect(w / 2 - 1, my - 8, 2, 18);
    for (const d of calib.devs) {
      const v = Math.max(-1, Math.min(1, d / 0.3));
      cx.fillStyle = `rgba(${C.esferaRGB},0.75)`;
      cx.fillRect(w / 2 + v * mw / 2 - 1, my - 6, 2, 14);
    }
    cx.fillStyle = C.tenue; cx.font = '10px system-ui';
    cx.fillText('antes', w / 2 - mw / 2 - 22, my + 5);
    cx.fillText('tarde', w / 2 + mw / 2 + 22, my + 5);
  }

  // Saltar a una seccion: para revisar un tramo sin tocar la cancion entera.
  // Deja la esfera parada en la primera tecla de la seccion y corre el reloj
  // del audio hasta ahi, asi lo que se escucha es lo que corresponde.
  // ENSEÑAR EN EL MOMENTO. El menu era un muro de once renglones que nadie
  // lee. Cada verbo se explica solo, encima de la primera cosa que lo pide, y
  // deja de aparecer apenas el jugador demuestra que lo sabe: la leccion se
  // gasta cuando se aprende, como corresponde.
  const aprendidas = new Set();
  let lecciones = [];
  function armarLecciones () {
    const primera = f => NOTAS.find(n => !n.silencio && f(n));
    const L = [];
    const nota = primera(n => !n.riel && !n.piso && !n.porCaida && !n.bajo);
    if (nota) L.push({ id: 'tocar', x: nota.xm, y: nota.y, txt: 'TOCA al pisarla',
      ok: st => st.limpias.has(nota.i) });
    const riel = primera(n => n.riel);
    if (riel) L.push({ id: 'riel', x: riel.xm, y: riel.y, txt: 'MANTENE apretado',
      ok: st => st.limpias.has(riel.i) });
    const lig = primera(n => n.porCaida);
    if (lig && NOTAS[lig.i - 1]) L.push({ id: 'ligada', x: NOTAS[lig.i - 1].xm,
      y: NOTAS[lig.i - 1].y, txt: 'esta no se toca: dejate caer',
      ok: st => st.tocadas.has(lig.i) });
    const grave = primera(n => n.bajo);
    if (grave) L.push({ id: 'bajo', x: grave.xm, y: grave.y, txt: 'abajo toca el BAJO',
      ok: st => st.limpias.has(grave.i) });
    if (ORBES.length) L.push({ id: 'orbe', x: ORBES[0].x, y: ORBES[0].y,
      txt: 'atravesalo: es una nota', ok: st => st.orbesTocados.has(ORBES[0].i) });
    if (TECHOS.length) L.push({ id: 'techo', x: TECHOS[0].x0, y: TECHOS[0].y,
      txt: 'bajo el techo NO se toca', ok: st => st.viva });
    if (PISTONES.length) L.push({ id: 'piston', x: PISTONES[0].x, y: PISTONES[0].y,
      txt: 'CAELE ENCIMA: suena y te empuja', ok: st => st.pistones.has(PISTONES[0].x) });
    if (HUECOS.length) L.push({ id: 'abismo', x: HUECOS[0].x0, y: 0,
      txt: 'sobre el vacio NO sueltes', ok: st => st.viva });
    lecciones = L.filter(l => !aprendidas.has(l.id)).sort((a, b) => a.x - b.x);
  }
  function dibujarLecciones (px, py) {
    for (const l of lecciones) {
      if (aprendidas.has(l.id)) continue;
      const d = l.x - s.x;
      if (d > 2.6 || d < -0.7) {
        if (d < -0.7 && l.ok(s)) aprendidas.add(l.id);   // lo hizo: no se repite
        continue;
      }
      const a = Math.min(1, Math.min((2.6 - d) / 0.8, (d + 0.7) / 0.5));
      cx.save();
      cx.globalAlpha = Math.max(0, a);
      cx.textAlign = 'center';
      cx.fillStyle = C.peligro; cx.font = 'bold 13px system-ui';
      cx.fillText(l.txt, px(l.x), py(l.y) - 30);
      cx.strokeStyle = `rgba(${C.esferaRGB},0.85)`; cx.lineWidth = 2;
      cx.beginPath();
      cx.moveTo(px(l.x), py(l.y) - 24); cx.lineTo(px(l.x), py(l.y) - 13);
      cx.moveTo(px(l.x) - 4, py(l.y) - 18); cx.lineTo(px(l.x), py(l.y) - 12);
      cx.lineTo(px(l.x) + 4, py(l.y) - 18);
      cx.stroke();
      cx.restore();
    }
  }

  // PAUSA. Se suspende el AudioContext, y con eso se congela SU reloj: como
  // todo --la musica agendada, t0, el mundo-- cuelga de ese reloj, al volver
  // nada quedo corrido y no hay nada que recalcular. Suspender es la pausa.
  let pausado = false;
  const BOTON_PAUSA = { x: 44, y: 34, r: 17 };     // desde el borde derecho
  const enBotonPausa = (px, py, w) =>
    Math.abs(px - (w - BOTON_PAUSA.x)) < BOTON_PAUSA.r + 6 &&
    Math.abs(py - BOTON_PAUSA.y) < BOTON_PAUSA.r + 6;
  function alternarPausa () {
    if (!corriendo || s.meta || !ac) return;
    pausado = !pausado;
    if (pausado) {
      soltar(s);                       // que no quede el boton hundido al volver
      rielCerrar(); eRielCerrar();
      try { ac.suspend(); } catch (_) {}
    } else {
      try { ac.resume(); } catch (_) {}
    }
  }
  function dibujarPausa (w, h) {
    // el boton, siempre a la vista mientras se juega
    const bx = w - BOTON_PAUSA.x, by = BOTON_PAUSA.y;
    cx.fillStyle = 'rgba(0,0,0,0.35)';
    cx.beginPath(); cx.arc(bx, by, BOTON_PAUSA.r, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = `rgba(${C.esferaRGB},0.5)`; cx.lineWidth = 1.5;
    cx.beginPath(); cx.arc(bx, by, BOTON_PAUSA.r, 0, Math.PI * 2); cx.stroke();
    cx.fillStyle = `rgba(${C.esferaRGB},0.9)`;
    if (pausado) {                     // en pausa muestra el triangulo de seguir
      cx.beginPath();
      cx.moveTo(bx - 4, by - 7); cx.lineTo(bx + 7, by); cx.lineTo(bx - 4, by + 7);
      cx.closePath(); cx.fill();
    } else {
      cx.fillRect(bx - 6, by - 7, 4, 14);
      cx.fillRect(bx + 2, by - 7, 4, 14);
    }
    if (!pausado) return;
    cx.fillStyle = 'rgba(10,10,14,0.55)'; cx.fillRect(0, 0, w, h);
    cx.textAlign = 'center';
    cx.fillStyle = C.peligro; cx.font = 'bold 30px system-ui';
    cx.fillText('PAUSA', w / 2, h * 0.44);
    cx.fillStyle = C.tenue; cx.font = '13px system-ui';
    cx.fillText('toca para seguir · ESC', w / 2, h * 0.44 + 26);
    // ...y la salida. No habia NINGUNA forma de volver al menu sin terminar la
    // cancion o morirse: para cambiar de nivel a mitad de camino habia que
    // dejarse matar, que es una forma rara de pedirle algo a un juego.
    cx.fillStyle = `rgba(${C.esferaRGB},0.7)`;
    cx.fillText('M — volver al menu', w / 2, h * 0.66);
    cx.textAlign = 'left';
  }

  // ENSAYO Y CONCIERTO. Saltar de seccion es para revisar un tramo sin tocar
  // la cancion entera -- pero entonces la corrida ya no empezo en el principio,
  // y su porcentaje no significa nada. Un record que se saca saltando al 90%
  // no es un record: es una trampa contra uno mismo. Desde el primer salto la
  // corrida queda marcada como ENSAYO y no puntua hasta que se arranque de cero.
  let ensayo = false;
  // SIN RED: se arma en el menu (solo despues de terminar alguna cancion) y
  // dura toda la corrida, reintentos incluidos.
  let sinRed = false, sinRedArmado = false;
  let avisoSeccion = null;
  function saltarA (bx) {
    rielCerrar(); eRielCerrar();
    const k = NOTAS.find(n => !n.silencio && n.x0 >= bx - 0.001) || NOTAS[0];
    s = crearSim({ sinRed });
    s.x = Math.max(0, k.x0);
    s.estado = 'apoyada'; s.tecla = k.i; s.y = k.y; s.saliendoDe = -1;
    t0 = ac.currentTime - desfase - s.x * SPB;   // el juego va s.x; el audio, adelante
    proxBeat = Math.floor(ahoraAudio() * 4) / 4;
    estela.length = 0; desvios.length = 0; marcas.length = 0; avisos.length = 0; aros.length = 0;
    golpesVista.length = 0; padsVista.length = 0;
    cabezas.clear(); crateres.length = 0; pisada = 0;
    crashVista.length = 0; riserVista = null;
    ultSeccion = SECCIONES.filter(z => z.x0 <= s.x).length - 1;   // el salto no se auto-anuncia
    finSonado = false;
  }
  function irASeccion (d) {
    if (!corriendo || !SECCIONES.length) return;
    const aqui = SECCIONES.filter(sec => sec.x0 <= s.x + 0.5).length - 1;
    const i = Math.max(0, Math.min(SECCIONES.length - 1, aqui + d));
    // volver a la salida ES un concierto nuevo: antes habia que morirse a
    // proposito o pasar por el menu para que un intento contara
    if (SECCIONES[i].x0 === 0) { ensayo = false; intento++; } else ensayo = true;
    saltarA(SECCIONES[i].x0);
    avisoSeccion = { n: SECCIONES[i].n, t: performance.now(), aviso: ensayo, deCero: !ensayo };
  }

  function alMenu () {
    rielCerrar(); eRielCerrar();
    golpesVista.length = 0; padsVista.length = 0;
    cabezas.clear(); crateres.length = 0; pisada = 0;
    crashVista.length = 0; riserVista = null;
    metaEn = 0; muerteVista = null; leccionViva = null; avisoMuerte = null;
    corriendo = false; finSonado = false; sinRed = false;
    s = crearSim();
  }

  // En el menu, un toque pelado (espacio, click) arranca el nivel 1; el nivel
  // se elige con 1/2 en el teclado o tocando su renglon.
  function bajar (nivel = 0) {
    if (pausado) { alternarPausa(); return; }   // en pausa, tocar es seguir
    if (calib) { tocarCalib(); return; }
    if (nivel === 'calibrar') { calibrar(); return; }
    if (nivel === 'sinred') {
      // solo se arma cuando ya terminaste algo: es el concierto del que ya se
      // sabe la cancion, no una trampa para el que recien llega. Y si todavia
      // no esta a la vista, esa franja de pantalla no puede ser un toque
      // muerto: vale la promesa de siempre, un toque arranca el nivel 1.
      if (NIVELES.some(id => ((leerRecord(id) || {}).pct || 0) >= 100)) { sinRedArmado = !sinRedArmado; return; }
      if (!corriendo) { empezar(NIVELES[0]); }
      return;
    }
    if (!corriendo) { empezar(NIVELES[nivel] || NIVELES[0]); return; }
    // En la meta, el toque es OTRA VEZ: el momento de maxima ganas de mejorar
    // la marca no puede desembocar en el menu. Al menu se sale con ESC (o
    // tocando la franja de abajo, para el telefono).
    if (s.meta) { empezar(CANCION_ID); return; }
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
    if (e.key === 'Escape') {
      e.preventDefault();
      if (e.repeat) return;
      if (corriendo && s.meta) { alMenu(); return; }    // desde la meta, ESC sale
      alternarPausa(); return;
    }
    // en pausa, M es la salida al menu (y no puede caer en el camino del boton
    // de jugar, que reanudaria en vez de salir)
    if (pausado && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault();
      if (!e.repeat) { alternarPausa(); alMenu(); }
      return;
    }
    // revisar: saltar de seccion en seccion sin jugar todo el nivel
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      if (e.repeat) return;
      // Con el diagnostico de muerte en pantalla, la flecha derecha va
      // DIRECTO a ensayar la seccion que te tiro: de ~2 minutos de rejugar el
      // viaje a una tecla. El puente muerte -> practica dirigida.
      if (e.key === 'ArrowRight' && avisoMuerte && avisoMuerte.xm != null && corriendo && SECCIONES.length) {
        const z = SECCIONES.filter(z2 => z2.x0 <= avisoMuerte.xm).pop() || SECCIONES[0];
        ensayo = z.x0 !== 0;
        saltarA(z.x0);
        avisoSeccion = { n: z.n, t: performance.now(), aviso: ensayo };
        avisoMuerte = null;
        return;
      }
      irASeccion(e.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    if (!esBoton(e)) return;
    e.preventDefault();
    if (e.repeat) return;
    if (!corriendo && !calib && (e.key === 'c' || e.key === 'C')) { bajar('calibrar'); return; }
    if (!corriendo && !calib && (e.key === 's' || e.key === 'S')) { bajar('sinred'); return; }
    if (!corriendo && !calib && e.key >= '1' && e.key <= String(NIVELES.length)) { bajar(+e.key - 1); return; }
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
    // el boton de pausa se come el toque: si no, pausar seria tambien tocar
    if (corriendo && !s.meta && enBotonPausa(e.offsetX, e.offsetY, cv.clientWidth)) {
      alternarPausa();
      return;
    }
    if (!corriendo) {
      if (calib) { bajar(); return; }
      // cada renglon del menu es una franja AJUSTADA a su renglon: tocar el
      // espacio vacio o las reglas arranca el nivel 1, no el 3 -- el texto lo
      // promete ("un toque arranca el nivel 1") y antes media pantalla
      // arrancaba VIAJE, los 64 compases mas dificiles, a un pulgar despistado
      const y = e.offsetY / cv.clientHeight;
      bajar(y > 0.80 ? 'calibrar' : y > 0.66 ? 'sinred'
        : y > 0.435 ? 0 : y > 0.37 ? 2 : y > 0.295 ? 1 : 0);
      return;
    }
    // en la meta, la franja de abajo es la salida al menu (tactil sin ESC)
    if (s.meta && e.offsetY / cv.clientHeight > 0.88) { alMenu(); return; }
    // ...y en pausa, la franja del cartel "volver al menu" (tactil sin M)
    if (pausado && e.offsetY / cv.clientHeight > 0.6) { alternarPausa(); alMenu(); return; }
    bajar();
  });
  addEventListener('pointerup', subir);
  // si el juego pierde el foco con el boton hundido, se suelta: no queda trabado
  addEventListener('blur', subir);

  // --- lazo ---------------------------------------------------------------------

  let antes = performance.now();
  function cuadro (t) {
    requestAnimationFrame(cuadro);
    // DOS RELOJES QUE NO PUEDEN SEPARARSE. El mundo avanza integrando cuadros
    // (rAF) y la musica se agenda con el reloj del audio. Si el navegador deja
    // de dar cuadros --pestaña escondida, telefono dormido, un tiron de 20 fps--
    // el audio sigue corriendo y el mundo no: quedaban segundos de desfase para
    // siempre, y al volver el agendador recorria de golpe todo lo salteado y lo
    // disparaba junto (cientos de golpes en un cuadro). El tiempo que el mundo
    // no vivio se le devuelve a t0: la musica ESPERA al mundo, y el desfase es
    // cero por construccion.
    const crudo = (t - antes) / 1000;
    const dtSeg = Math.min(0.05, crudo);
    antes = t;
    // en pausa el reloj del audio esta congelado, asi que no hay nada que
    // devolver ni que adelantar: solo se sigue dibujando
    if (pausado) { dibujar(0); return; }
    if (ac && crudo > dtSeg) {
      t0 += crudo - dtSeg;
      proxBeat = Math.max(proxBeat, Math.floor(ahoraAudio() * 4) / 4);
    }
    if (calib) {
      if (!calib.listo && ac.currentTime > calib.fin) cerrarCalib();
      else if (calib.listo && ac.currentTime > calib.fin + 3.2) calib = null;
      dibujar(dtSeg); return;
    }
    if (!corriendo) { dibujar(dtSeg); return; }

    agendarMusica();
    rodadaSeguir();
    const b = ahora();
    if (b < 0) { dibujar(dtSeg); return; }

    const dtBeat = dtSeg / SPB;
    const n = Math.max(1, Math.ceil(dtBeat / (1 / 240)));
    for (let i = 0; i < n && s.viva && !s.meta; i++) paso(s, dtBeat / n);

    procesar();
    if (!s.viva) { golpe(ac.currentTime, 90, 0.3, 0.4, 'sawtooth'); ruido(ac.currentTime, 0.2, 0.28); morirOReiniciar(); }
    if (s.meta && !finSonado) {
      finSonado = true; rielCerrar(); eRielCerrar(); sonarFinal();
      metaEn = performance.now(); flash = 1; flashRGB = '255,215,130';
      // al ganar se guarda TODO, rango incluido, y se recuerda si la marca
      // cayo: la meta tiene que celebrar el record, no solo mostrarlo
      if (!ensayo) {
        const antes = leerRecord(CANCION_ID);
        metaRecord = {
          antes: antes ? antes.limpias || 0 : 0,
          nuevo: !antes || s.limpias.size > (antes.limpias || 0)
        };
        guardarRecord(CANCION_ID, {
          pct: 100, limpias: s.limpias.size, perf: s.perfectas.size,
          racha: s.mejorRacha, orbes: s.orbes, sinRedPct: sinRed ? 100 : 0,
          rango: rango(s.limpias.size, TOTAL_NOTAS, s.orbes, ORBES.length, s.perfectas.size)
        });
      } else metaRecord = null;
    }
    // el capitulo nuevo se anuncia al cruzarlo jugando: MOTOR, VUELO,
    // SUPERNOVA son los actos de la aventura y pasaban en 12px junto a la red
    if (corriendo && SECCIONES.length) {
      const si = SECCIONES.filter(z => z.x0 <= s.x).length - 1;
      if (si > ultSeccion && s.x > 1 && !s.meta)
        avisoSeccion = { n: SECCIONES[si].n, t: performance.now() };
      ultSeccion = si;
    }
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

  // EL INFORME POR SECCION. Una corrida que termina y se evapora no deja nada.
  // Esto dice donde tocaste bien y donde te caiste, con los nombres del arreglo
  // --motor, vuelo, gravedad--, que es como el jugador ya piensa la cancion.
  // Lo ve el que gana Y el que muere: al morir, las secciones que no llegaste
  // van apagadas y la de la muerte lleva el marco rojo -- el numero dispara el
  // reintento, la barra floja lo DIRIGE.
  function dibujarInforme (w, h, limpias = s.limpias, xHasta = Infinity) {
    if (!SECCIONES.length) return;
    const tramos = SECCIONES.map((z, i) => {
      const x1 = i + 1 < SECCIONES.length ? SECCIONES[i + 1].x0 : LARGO;
      const dentro = NOTAS.filter(n => !n.silencio && n.xm >= z.x0 && n.xm < x1);
      return {
        n: z.n, total: dentro.length,
        lim: dentro.filter(n => limpias.has(n.i)).length,
        lejos: z.x0 > xHasta, aqui: z.x0 <= xHasta && x1 > xHasta
      };
    }).filter(t => t.total);
    if (!tramos.length) return;
    const bw = Math.min(110, (w - 40) / tramos.length);
    const base = h * 0.84, alto = 50;
    cx.textAlign = 'center';
    tramos.forEach((t, i) => {
      const x = w / 2 + (i - (tramos.length - 1) / 2) * bw;
      const p = t.lim / t.total;
      cx.save();
      if (t.lejos) cx.globalAlpha *= 0.25;
      cx.fillStyle = 'rgba(232,230,224,0.09)';
      cx.fillRect(x - bw * 0.3, base - alto, bw * 0.6, alto);
      cx.fillStyle = p >= 1 ? C.impulso : p >= 0.8 ? C.esfera : p >= 0.5 ? C.tecla : C.sucia;
      cx.fillRect(x - bw * 0.3, base - alto * p, bw * 0.6, alto * p);
      cx.fillStyle = C.tenue; cx.font = t.aqui ? 'bold 10px system-ui' : '10px system-ui';
      if (!t.lejos) cx.fillText(`${Math.round(p * 100)}%`, x, base - alto - 5);
      cx.fillText(t.n.length > 12 ? t.n.slice(0, 11) + '…' : t.n, x, base + 13);
      if (t.aqui && xHasta < Infinity) {           // aca te quedaste
        // en el color de la esfera: la esfera sos vos, y este es el tramo
        // donde te quedaste. C.peligro es casi blanco y no marcaba nada.
        cx.strokeStyle = C.esfera; cx.lineWidth = 2;
        cx.strokeRect(x - bw * 0.3 - 3, base - alto - 3, bw * 0.6 + 6, alto + 6);
        cx.fillStyle = C.esfera; cx.font = 'bold 10px system-ui';
        cx.fillText('aca', x, base + 26);
      }
      cx.restore();
    });
  }

  function dibujar (dtSeg) {
    const w = cv.clientWidth, h = cv.clientHeight, dpr = devicePixelRatio || 1;
    if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.fillStyle = C.fondo; cx.fillRect(0, 0, w, h);

    const esc = w / 9;
    // el pisoton hunde la pantalla entera unos pixeles -- solo vertical, para
    // no romper la lectura de la partitura -- y vuelve con resorte
    pisada = Math.max(0, pisada - dtSeg * 8);
    const y0 = h * 0.86 + pisada * pisada * 5;
    const px = wx => (wx - s.x + 2.4) * esc;
    const py = wy => y0 - wy * esc;

    // Respirar. Los golpes se agendaron con el audio, asi que la imagen late
    // EXACTAMENTE con lo que se escucha, no con un reloj propio que se corre.
    let riserQ = 0;
    if (ac && corriendo) {
      // se consumen con el desfase puesto: el mundo late cuando el golpe se
      // ESCUCHA, no cuando se agendo
      const ahoraAc = ac.currentTime - desfase;
      while (golpesVista.length && golpesVista[0] <= ahoraAc) { golpesVista.shift(); pump = 1; }
      while (padsVista.length && padsVista[0] <= ahoraAc) { padsVista.shift(); padLuz = 1; }
      // EL DROP EXISTE EN PANTALLA. El juego construia cuatro compases de
      // build hacia un instante que no tenia ni un pixel: mientras el riser
      // sube, la imagen se tensa (brillo en rampa, el anillo engorda), y el
      // crash la libera de golpe.
      while (crashVista.length && crashVista[0] <= ahoraAc) {
        crashVista.shift(); flash = Math.max(flash, 0.8); padLuz = 1.6; riserVista = null;
      }
      if (riserVista && ac.currentTime >= riserVista.t0)
        riserQ = Math.min(1, (ac.currentTime - riserVista.t0) / (riserVista.t1 - riserVista.t0));
    }
    pump = Math.max(0, pump - dtSeg * 4.2);
    padLuz = Math.max(0, padLuz - dtSeg * 0.5);
    // la racha ilumina: jugar limpio se VE, y romperla apaga el mundo
    const objRacha = corriendo ? Math.min(1, s.racha / 12) : 0;
    brilloRacha += (objRacha - brilloRacha) * Math.min(1, dtSeg * 2.5);
    const acordeAhora = TINTE[nombreAcorde(Math.floor(s.x / 4))] || TINTE.Am;
    for (let i = 0; i < 3; i++)                       // el acorde no salta: funde
      tinte[i] += (acordeAhora[i] - tinte[i]) * Math.min(1, dtSeg * 2.2);
    if (corriendo) {
      const luz = (0.5 + 0.5 * padLuz) * (1 - 0.45 * pump) * (0.55 + 0.45 * brilloRacha) * (1 + 0.35 * riserQ);
      const gr = cx.createLinearGradient(0, 0, 0, y0 + esc * 0.4);
      const rgb = tinte.map(v => Math.round(v)).join(',');
      gr.addColorStop(0, `rgba(${rgb},${0.34 * luz})`);
      gr.addColorStop(0.62, `rgba(${rgb},${0.11 * luz})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = gr; cx.fillRect(0, 0, w, y0 + esc * 0.4);
      // la esfera es la fuente de luz: el bombo la hace latir
      const rl = esc * (1.1 + 0.5 * pump);
      const halo = cx.createRadialGradient(px(s.x), py(s.y + R), 0, px(s.x), py(s.y + R), rl);
      halo.addColorStop(0, `rgba(${C.esferaRGB},${0.13 + 0.12 * pump})`);
      halo.addColorStop(1, `rgba(${C.esferaRGB},0)`);
      cx.fillStyle = halo;
      cx.fillRect(px(s.x) - rl, py(s.y + R) - rl, rl * 2, rl * 2);
    }

    // EL PAISAJE ES LA CANCION. Las montañas del fondo son la melodia misma
    // vista de lejos: lo que se viene, dibujado en el horizonte y comprimido
    // por la perspectiva. No es decorado inventado por seccion -- es el mapa,
    // y por eso cada tramo del viaje se ve distinto sin que nadie lo pinte:
    // el amanecer es una loma, el drop es una sierra, el motor es una meseta.
    if (corriendo) {
      const rgbP = tinte.map(v => Math.round(v * 0.5)).join(',');
      for (const c of CAPAS) {
        cx.fillStyle = `rgba(${rgbP},${c.a * (0.55 + 0.45 * padLuz)})`;
        cx.beginPath();
        cx.moveTo(-40, y0 + 40);
        let hubo = false;
        for (let i = 0; i < NOTAS.length; i += c.salto) {
          const n = NOTAS[i];
          if (n.silencio) continue;
          const X = ((n.xm - s.x) * c.f + 2.4) * esc;
          if (X < -60) continue;
          if (X > w + 60) break;
          cx.lineTo(X, y0 - (c.base + n.y * c.k) * esc);
          hubo = true;
        }
        if (!hubo) continue;
        cx.lineTo(w + 40, y0 + 40);
        cx.closePath();
        cx.fill();
      }
    }

    // la red, con sus abismos
    cx.strokeStyle = `rgba(232,230,224,${0.14 + 0.12 * padLuz})`; cx.lineWidth = 2;
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

    const latOrbe = 0.55 + 0.45 * Math.sin(performance.now() / 160);
    // PISTONES: el caño CARGA con el compas -- sube por escalones al acercarse
    // su golpe, latiendo con el bombo, y llega a altura plena un tiempo antes
    // del contacto (la fisica solo mira la ventana [x0,x1], y ahi ya esta
    // arriba: lo que se ve es la verdad donde importa). La cabeza es una
    // PLATAFORMA -- hay que caerle encima -- y sobre ella late el punto del
    // golpe que guarda, el mismo lenguaje que los orbes.
    for (const p of PISTONES) {
      if (p.x1 < s.x - 2 || p.x0 > s.x + 7) continue;
      const falta = p.x - s.x;
      const reg = cabezas.get(p.paso);
      const edad = reg ? (performance.now() - reg.t) / 1000 : 0;
      const gastado = s.pistones.has(p.x) && (!reg || edad > 0.08);
      // la carga por escalones: cada beat que falta es un escalon menos
      const carga = falta > 3 ? 0.12 : falta > 2 ? 0.38 : falta > 1 ? 0.68 : 1;
      let f = carga;                                 // fraccion de la altura
      if (reg && reg.modo === 'encima') {
        // pisado: se comprime de golpe y rebota a un rescoldo bajo
        f = edad < 0.08 ? 1 - (1 - 0.12) * (edad / 0.08)
          : edad < 0.28 ? 0.12 + 0.06 * Math.sin((edad - 0.08) / 0.2 * Math.PI)
            : 0.18;
      } else if (reg && reg.modo === 'perdido') {
        // perdido: se desploma lento, un mecanismo que se apaga
        f = edad < 0.45 ? 1 - (1 - 0.18) * (edad / 0.45) : 0.18;
      } else if (gastado) f = 0.18;
      const alto = Math.max(3, (py(0) - py(p.y)) * f + (f >= 1 ? 2.5 * pump : 0));
      const a0 = px(p.x0), an = (p.x1 - p.x0) * esc;
      const yTope = py(0) - alto;
      const pisado = reg && reg.modo === 'encima';
      // el cobrado conserva un rescoldo naranja; el perdido muere gris frio
      cx.fillStyle = pisado ? `rgba(${C.esferaRGB},0.4)`
        : gastado ? 'rgba(150,140,130,0.35)' : `rgba(${C.esferaRGB},${0.22 + 0.3 * carga})`;
      cx.fillRect(a0 + an * 0.34, yTope, an * 0.32, alto);      // el vastago
      cx.fillStyle = pisado && edad < 0.06 ? 'rgb(255,252,240)'
        : pisado ? C.esfera : gastado ? 'rgba(150,140,130,0.5)' : C.impulso;
      cx.fillRect(a0, yTope - 3, an, 6);                        // la plataforma
      if (!gastado && !reg) {
        // el punto del golpe que GUARDA, latiendo como un orbe: esta
        // plataforma tiene un golpe adentro, tocalo vos o no lo toca nadie
        cx.fillStyle = `rgba(${C.esferaRGB},${0.4 + 0.4 * latOrbe})`;
        cx.beginPath(); cx.arc(a0 + an / 2, yTope - 9, 3 + 1.2 * latOrbe, 0, Math.PI * 2); cx.fill();
        if (carga >= 1) {                            // la flecha: caele
          cx.fillStyle = `rgba(${C.impulsoRGB},0.8)`;
          cx.beginPath();
          cx.moveTo(a0 + an / 2 - 5, yTope - 20); cx.lineTo(a0 + an / 2 + 5, yTope - 20);
          cx.lineTo(a0 + an / 2, yTope - 14); cx.closePath(); cx.fill();
        }
      } else if (reg && reg.modo === 'perdido') {
        // el golpe que nadie toco queda gris y quieto, como un orbe mudo
        cx.fillStyle = 'rgba(150,140,130,0.6)';
        cx.beginPath(); cx.arc(a0 + an / 2, yTope - 9, 3, 0, Math.PI * 2); cx.fill();
      }
    }

    // Los ORBES: cuerpos de verdad. Viven flotando sobre el arco del pique
    // hasta que la esfera los atraviesa -- ahi suenan y estallan. Los que el
    // arco no toco quedan ahi, mudos: se VE lo que no sonaste.
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

    // EL CAMINO RECORRIDO. Las teclas que sonaste quedan encendidas y unidas
    // por un hilo: atras tuyo va quedando dibujada la cancion que tocaste. Es
    // lo unico del mapa que habla de vos y no de la partitura.
    cx.strokeStyle = `rgba(${C.esferaRGB},${0.13 + 0.17 * brilloRacha})`;
    cx.lineWidth = 1.5;
    cx.beginPath();
    let corte = true;
    for (const k of NOTAS) {
      if (k.silencio || k.x1 < s.x - 9 || k.x0 > s.x) { corte = true; continue; }
      if (!s.limpias.has(k.i)) { corte = true; continue; }
      const X = px(k.xm), Y = py(k.y);
      if (corte) { cx.moveTo(X, Y); corte = false; } else cx.lineTo(X, Y);
    }
    cx.stroke();

    // las teclas: la partitura
    for (const k of NOTAS) {
      if (k.silencio || k.x1 < s.x - 3 || k.x0 > s.x + 7) continue;
      const sono = s.tocadas.has(k.i);
      const limpia = s.limpias.has(k.i);          // sonar no es lo mismo que afinar
      const aqui = s.tecla === k.i;               // estas parado en esta: toca YA
      const alto = k.riel ? 7 : 5;
      const hh = teclaHundida.get(k.i) || 0;      // cuanto la hundio la esfera
      // las teclas de bajo son VERDES: otro instrumento, otro color
      const cBase = k.bajo ? C.impulso : C.tecla;
      cx.fillStyle = limpia ? C.esfera : sono ? C.sucia : cBase;
      if (limpia || aqui) { cx.shadowColor = limpia ? C.esfera : cBase; cx.shadowBlur = 12; }
      if (k.riel) {
        // la tabla del riel sigue la RAMPA: plana, y curvandose hacia arriba
        // en el ultimo tramo. Se ve de donde sale el envion.
        cx.lineWidth = alto; cx.lineCap = 'butt';
        cx.strokeStyle = cx.fillStyle;
        cx.beginPath();
        cx.moveTo(px(k.x0), py(k.y + hh) + alto / 2);
        for (let i = 1; i <= 12; i++) {
          const xx = k.x0 + (k.x1 - k.x0) * i / 12;
          cx.lineTo(px(xx), py(k.y + hh + subidaRiel(k, xx)) + alto / 2);
        }
        cx.stroke();
      } else cx.fillRect(px(k.x0), py(k.y + hh), Math.max(4, (k.x1 - k.x0) * esc), alto);
      cx.shadowBlur = 0;
      // El riel se ve como SOSTENER, no como otra tecla: rayado que corre a
      // lo largo mientras dura la nota. Y el primero de cada cancion lleva su
      // cartel -- que se aprenda viendolo, no muriendo.
      if (k.riel) {
        const a0 = px(k.x0), a1 = px(k.x0) + Math.max(4, (k.x1 - k.x0) * esc);
        const off = (performance.now() / 60) % 12;
        const aR = px(k.x1 - SUELTA);
        cx.strokeStyle = 'rgba(17,18,20,0.5)'; cx.lineWidth = 2;
        cx.beginPath();
        for (let xx = a0 + off; xx < aR - 3; xx += 12) {
          cx.moveTo(xx, py(k.y + hh) + alto - 1); cx.lineTo(xx + 4, py(k.y + hh) + 1);
        }
        cx.stroke();
        // la punta de la rampa: de aca salis despedido (y aca ya podes soltar)
        const punta = py(k.y + hh + RAMPA);
        cx.strokeStyle = `rgba(${C.impulsoRGB},${sono ? 0.5 : 0.85})`; cx.lineWidth = 2;
        cx.beginPath();
        cx.moveTo(px(k.x1) - 9, punta - 4);
        cx.lineTo(px(k.x1) - 1, punta - 11);
        cx.lineTo(px(k.x1) - 1, punta - 3);
        cx.stroke();
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
    // EL PULSO DE ANTICIPACION. Un anillo que se cierra sobre la proxima nota y
    // llega a su tamaño justo cuando hay que tocarla. Hasta ahora el momento
    // exacto se aprendia chocando: se llegaba tarde, sonaba chueco, y se
    // corregia de oido. Con esto se aprende MIRANDO, que es como se lee una
    // partitura. Solo la que sigue: dos anillos a la vez ya no dicen cuando.
    if (corriendo && !s.meta) {
      const prox = NOTAS.find(n => !n.silencio && !s.tocadas.has(n.i) && n.xm > s.x - 0.02);
      if (prox && prox.xm - s.x < 2.2) {
        const q = Math.max(0, (prox.xm - s.x) / 2.2);       // 1 lejos, 0 justo
        cx.strokeStyle = `rgba(${C.teclaRGB},${0.5 * (1 - q) * (1 - q)})`;
        cx.lineWidth = 1.5 + 1.5 * riserQ;                  // el build lo engorda
        cx.beginPath();
        cx.arc(px(prox.xm), py(prox.y), (0.07 + q * 0.75) * esc, 0, Math.PI * 2);
        cx.stroke();
      }
    }
    // destellos de nota
    for (let i = destellos.length - 1; i >= 0; i--) {
      const d = destellos[i], e = (performance.now() - d.t) / 420;
      if (e > 1) { destellos.splice(i, 1); continue; }
      const sd = d.suc || 0;
      cx.strokeStyle = `rgba(${mezcla(C.esferaRGB, C.suciaRGB, sd)},${(1 - e) * (0.9 - 0.4 * sd)})`;
      cx.lineWidth = 2.5 * (1 - e);
      cx.beginPath(); cx.arc(px(d.x), py(d.y), (0.05 + e * 0.42) * esc, 0, Math.PI * 2); cx.stroke();
    }
    // el anillo de la clavada: mas ancho, mas rapido y blanco -- se distingue
    // del destello comun de un vistazo, que es todo lo que tiene que hacer
    for (let i = aros.length - 1; i >= 0; i--) {
      const a = aros[i], e = (performance.now() - a.t) / 520;
      if (e > 1) { aros.splice(i, 1); continue; }
      const q = 1 - Math.pow(1 - e, 3);            // sale disparado y frena
      cx.strokeStyle = `rgba(255,252,240,${(1 - e) * 0.75})`;
      cx.lineWidth = 3.5 * (1 - e);
      cx.beginPath(); cx.arc(px(a.x), py(a.y), (0.06 + q * 0.85) * esc, 0, Math.PI * 2); cx.stroke();
    }
    // el aviso de cuanto te corriste, sobre la nota misma
    cx.textAlign = 'center';
    for (let i = avisos.length - 1; i >= 0; i--) {
      const a = avisos[i], e = (performance.now() - a.t) / 750;
      if (e > 1) { avisos.splice(i, 1); continue; }
      cx.font = a.chueca ? 'bold 12px system-ui' : '12px system-ui';
      // el PERFECTO habla con el blanco del aro: la misma voz que su anillo
      cx.fillStyle = a.perf ? `rgba(255,252,240,${1 - e})`
        : `rgba(${a.chueca ? C.suciaRGB : C.esferaRGB},${1 - e})`;
      cx.fillText(a.txt, px(a.x), py(a.y) - 22 - e * 26);
    }
    cx.textAlign = 'left';

    // meta
    cx.strokeStyle = C.esfera; cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(px(LARGO), py(0)); cx.lineTo(px(LARGO), py(0.9)); cx.stroke();

    // EL RASTRO. Era un cometa: una cola conica que se afinaba hasta un hilo
    // brillante, y encima crecia con la racha. Leia como bicho, no como
    // movimiento. Ahora son fantasmas de la propia esfera --el desenfoque de
    // toda la vida-- y SOLO en el aire: una pelota que rueda no deja cometa.
    if (s.estado === 'aire') estela.push({ x: s.x, y: s.y + R });
    else if (estela.length) estela.shift();
    if (estela.length > 13) estela.shift();
    // particulas
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dtSeg * 2.3;
      if (p.vida <= 0) { particulas.splice(i, 1); continue; }
      p.x += p.vx * dtSeg; p.y += p.vy * dtSeg; p.vy -= 3 * dtSeg;
      cx.fillStyle = `rgba(${p.rgb},${p.vida * 0.8})`;
      cx.beginPath(); cx.arc(px(p.x), py(p.y), 2.2 * p.vida, 0, Math.PI * 2); cx.fill();
    }

    dibujarLecciones(px, py);
    if (leccionViva) {
      const e = (performance.now() - leccionViva.t) / 2800;
      if (e >= 1) leccionViva = null;
      else {
        cx.save();
        cx.textAlign = 'center'; cx.globalAlpha = Math.min(1, 4 * (1 - e));
        cx.fillStyle = C.esfera; cx.font = 'bold 13px system-ui';
        cx.fillText(leccionViva.txt, px(s.x), py(s.y) - 40);
        cx.restore();
      }
    }

    // LA ESFERA. Rueda de verdad (una pelota que no gira no pesa), se hunde al
    // aterrizar con un resorte --el golpe no termina en el frame en que toca--
    // y se estira cayendo. Todo esto es solo dibujo: la fisica sigue exacta,
    // que es lo que sostiene la calibracion de martillos y orbes.
    // la retencion: en la clavada el aplastado se SOSTIENE un instante antes de
    // soltarse. Es lo que hace que el golpe pese en vez de pasar
    if (retencion > 0) retencion -= dtSeg;
    else squash = Math.max(0, squash - dtSeg * 7);
    // rodadura sin patinar: dtheta = dx / R. A la mitad de la velocidad real,
    // porque a cinco vueltas por segundo el ojo ya no ve giro, ve parpadeo.
    if (corriendo && s.viva && !s.meta) giro += (dtSeg / SPB) / R * 0.5;
    // el resorte del aterrizaje: se hunde y vuelve, no se congela
    asientoV += (-484 * asiento - 15.4 * asientoV) * dtSeg;
    asiento += asientoV * dtSeg;
    if (s.estado !== 'apoyada') { asiento *= 0.86; asientoV *= 0.86; }
    for (const [i, v] of teclaHundida) {
      const nv = v * Math.pow(0.015, dtSeg);
      if (Math.abs(nv) < 0.0004) teclaHundida.delete(i); else teclaHundida.set(i, nv);
    }
    if (s.estado === 'apoyada' && s.tecla >= 0) teclaHundida.set(s.tecla, asiento);
    // se estira EN LA DIRECCION en que va, no siempre para arriba: es lo que
    // hace que un cuerpo parezca cuerpo y no un icono que cambia de tamaño
    const estira = s.estado === 'aire' ? Math.min(0.26, Math.abs(s.vy) * 0.15) : 0;
    const k = squash * 0.3;
    const cxb = px(s.x), cyb = py(s.y + asiento + R * (1 - k));
    const ang = Math.atan2(-s.vy * (s.estado === 'aire' ? 1 : 0), 1);
    const rx = R * esc * (1 + k + estira), ry = R * esc * (1 - k - estira);

    // LA SOMBRA. Dice a que altura vas y donde vas a caer, que era informacion
    // que solo estaba en la fisica. Ademas ancla la esfera al mundo: sin ella
    // flota, con ella pesa.
    const alt = Math.max(0, s.y);
    const cerca = Math.max(0.12, 1 - alt / 0.62);
    cx.fillStyle = `rgba(0,0,0,${0.42 * cerca})`;
    cx.beginPath();
    cx.ellipse(cxb, py(0) + 1, R * esc * (0.55 + 0.85 * cerca), R * esc * 0.30 * cerca, 0, 0, Math.PI * 2);
    cx.fill();

    // los fantasmas del rastro, detras de la esfera
    for (let i = 0; i < estela.length; i++) {
      const f = (i + 1) / estela.length;
      cx.fillStyle = `rgba(${C.esferaRGB},${f * f * 0.13})`;
      cx.beginPath();
      cx.ellipse(px(estela[i].x), py(estela[i].y), R * esc * (0.35 + 0.55 * f), R * esc * (0.35 + 0.55 * f), 0, 0, Math.PI * 2);
      cx.fill();
    }
    const sordo = s.x < s.bloqueo;              // el boton no responde, y se ve
    cx.fillStyle = sordo ? C.sucia : C.esfera;
    cx.shadowColor = sordo ? C.sucia : C.esfera; cx.shadowBlur = sordo ? 4 : 12;
    cx.beginPath();
    cx.ellipse(cxb, cyb, rx, ry, ang, 0, Math.PI * 2);
    cx.fill();
    cx.shadowBlur = 0;
    // la costura: es lo unico que deja VER que gira
    cx.save();
    cx.beginPath(); cx.ellipse(cxb, cyb, rx, ry, ang, 0, Math.PI * 2); cx.clip();
    cx.translate(cxb, cyb); cx.rotate(giro);
    cx.strokeStyle = 'rgba(120,60,10,0.45)'; cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(-rx, 0); cx.lineTo(rx, 0); cx.stroke();
    cx.fillStyle = 'rgba(255,255,255,0.35)';
    cx.beginPath(); cx.arc(rx * 0.45, -ry * 0.42, Math.max(1.5, rx * 0.17), 0, Math.PI * 2); cx.fill();
    cx.restore();
    // la sordera SE VE TERMINAR: un arco gris que se vacia alrededor de la
    // esfera. El castigo escala hasta x5 y sin esto era ilegible -- parecia
    // que el boton fallaba porque si.
    if (sordo && s.bloqueo > s.bloqueoDesde) {
      const fr = Math.max(0, Math.min(1, (s.bloqueo - s.x) / (s.bloqueo - s.bloqueoDesde)));
      cx.strokeStyle = 'rgba(150,140,130,0.8)'; cx.lineWidth = 2.5;
      cx.beginPath();
      cx.arc(cxb, cyb, rx + 8, -Math.PI / 2, -Math.PI / 2 + fr * Math.PI * 2);
      cx.stroke();
    }

    // las esquirlas de la muerte: caen con gravedad de pantalla y se apagan
    if (muerteVista) {
      const e = (performance.now() - muerteVista.t) / 600;
      if (e >= 1) muerteVista = null;
      else {
        const ox = 2.4 * esc, oy = py(muerteVista.y + R);
        cx.fillStyle = `rgba(${C.esferaRGB},${0.9 * (1 - e)})`;
        for (const q of muerteVista.esquirlas) {
          const qx = ox + Math.cos(q.a) * q.v * e;
          const qy = oy + Math.sin(q.a) * q.v * e + 240 * e * e;
          cx.beginPath(); cx.arc(qx, qy, 3 * (1 - e * 0.6), 0, Math.PI * 2); cx.fill();
        }
      }
    }
    if (flash > 0) {
      flash = Math.max(0, flash - dtSeg * 3);
      cx.fillStyle = `rgba(${flashRGB},${flash * 0.22})`;
      cx.fillRect(0, 0, w, h);
      if (flash === 0) flashRGB = '232,230,224';
    }

    // HUD
    if (!corriendo) {
      if (calib) { dibujarCalib(w, h); hud.textContent = ''; return; }
      cx.textAlign = 'center';
      cx.fillStyle = C.peligro; cx.font = '17px system-ui';
      cx.fillText('DRIBLE — elegi el nivel', w / 2, h * 0.16);
      // Dos canciones, mismo margen de error: si el nivel 1 sale facil y el 2
      // no, la dificultad era la cancion, no el margen.
      // La marca dice el RANGO y sobre cuanto: "completa" para siempre mataba
      // la zanahoria -- ahora una cancion terminada sigue debiendo algo.
      const contarNotas = id => CANCIONES[id].compases
        .flatMap(c => c.trim().split(/\s+/)).filter(t => !t.startsWith('-')).length;
      const marca = id => {
        const r = leerRecord(id);
        if (!r) return '';
        // el ✦ es la marca de honor: esta cancion la terminaste SIN RED
        const sr = r.sinRedPct >= 100 ? ' ✦' : r.sinRedPct ? ` ✦${r.sinRedPct}%` : '';
        if (r.rango) return `   ☆ ${r.rango} · ♪ ${r.limpias}/${contarNotas(id)}${sr}`;
        return `   ${r.pct >= 100 ? '★ completa' : (r.pct || 0) + '%'} · ♪ ${r.limpias || 0}`;
      };
      cx.fillStyle = C.tecla; cx.font = '15px system-ui';
      cx.fillText(`1 — ${nombreCancion('esfera')} · negras y blancas · 100 BPM${marca('esfera')}`, w / 2, h * 0.26);
      cx.fillStyle = C.esfera;
      cx.fillText(`2 — ${nombreCancion('aurora')} · el galope del coro · 112 BPM${marca('aurora')}`, w / 2, h * 0.33);
      cx.fillStyle = C.impulso;
      cx.fillText(`3 — ${nombreCancion('viaje')} · la cancion entera del estudio${marca('viaje')}`, w / 2, h * 0.40);
      cx.fillStyle = C.tenue; cx.font = '12px system-ui';
      cx.fillText('teclas 1/2/3, o toca su renglon · ESPACIO arranca el nivel 1', w / 2, h * 0.46);
      // la zanahoria concreta: que le falta a tu mejor cancion para el
      // proximo rango. Un objetivo visible y contado es lo que trae de vuelta.
      const paso = NIVELES.map(id => ({ id, r: leerRecord(id) }))
        .filter(q => q.r && q.r.rango && q.r.rango !== 'SUPERNOVA')
        .sort((a, b) => RANGOS.indexOf(b.r.rango) - RANGOS.indexOf(a.r.rango))[0];
      if (paso) {
        const total = contarNotas(paso.id);
        const sig = RANGOS[RANGOS.indexOf(paso.r.rango) + 1];
        const faltan = sig === 'VIRTUOSO' ? Math.ceil(total * 0.95) - paso.r.limpias
          : sig === 'AURORA' ? total - paso.r.limpias
          : sig === 'SUPERNOVA' ? Math.ceil(total * 0.85) - (paso.r.perf || 0)
          : Math.ceil(total * 0.85) - paso.r.limpias;
        if (faltan > 0) {
          const que = sig === 'SUPERNOVA' ? (faltan === 1 ? 'clavada' : 'clavadas')
            : (faltan === 1 ? 'limpia' : 'limpias');
          cx.fillStyle = C.tenue; cx.font = '12px system-ui';
          cx.fillText(`${nombreCancion(paso.id)}: a ${faltan} ${que} de ${sig}`, w / 2, h * 0.50 + 6);
        }
      }
      cx.font = '13px system-ui';
      // Un solo boton y tres reglas. Todo lo demas lo enseña el mapa cuando
      // pasa: un muro de once renglones no lo lee nadie.
      [
        'un boton: TOCA cada tecla justo al pisarla',
        'a tiempo suena afinada; corrida se ensucia',
        'martillar no sirve: el boton se queda sordo',
        'si caes a la red, TOCA para volver arriba'
      ].forEach((t, i) => cx.fillText(t, w / 2, h * 0.50 + 26 + i * 20));
      // En un telefono el sonido sale tarde y el juego se siente roto sin que
      // sea culpa tuya. Esta linea es la diferencia entre "no me sale" y "no
      // estaba calibrado".
      // SIN RED: el endgame, y solo para el que ya termino algo. Antes de eso
      // ni se menciona -- una promesa rota de dificultad no le sirve a nadie
      // que todavia esta aprendiendo el gesto.
      if (NIVELES.some(id => ((leerRecord(id) || {}).pct || 0) >= 100)) {
        cx.font = sinRedArmado ? 'bold 13px system-ui' : '13px system-ui';
        const tSR = sinRedArmado ? 'SIN RED — armado: caer es el final' : 'SIN RED — caer mata, salvo donde la cancion manda rodar';
        const anchoSR = cx.measureText(tSR).width + 36;
        cx.fillStyle = C.fondo;                    // el menu no compite con el mundo
        cx.fillRect(w / 2 - anchoSR / 2, h * 0.72 - 17, anchoSR, 26);
        cx.strokeStyle = sinRedArmado ? C.esfera : `rgba(${C.esferaRGB},0.35)`;
        cx.lineWidth = sinRedArmado ? 2 : 1;
        cx.strokeRect(w / 2 - anchoSR / 2, h * 0.72 - 17, anchoSR, 26);
        cx.fillStyle = sinRedArmado ? C.esfera : `rgba(${C.esferaRGB},0.6)`;
        cx.fillText(tSR, w / 2, h * 0.72);
        cx.fillStyle = C.tenue; cx.font = '11px system-ui';
        cx.fillText('tocalo, o tecla S', w / 2, h * 0.72 + 20);
      }
      // ...y dibujada como BOTON: en el telefono no hay tecla C, y esta es la
      // funcion que separa "se siente justo" de "se siente roto"
      const tCal = desfase ? `calibrar el sonido · ${Math.round(desfase * 1000)} ms` : 'calibrar el sonido';
      cx.font = '13px system-ui';
      const anchoCal = cx.measureText(tCal).width + 36;
      cx.fillStyle = C.fondo;
      cx.fillRect(w / 2 - anchoCal / 2, h * 0.86 - 17, anchoCal, 26);
      cx.strokeStyle = `rgba(${C.impulsoRGB},0.6)`; cx.lineWidth = 1;
      cx.strokeRect(w / 2 - anchoCal / 2, h * 0.86 - 17, anchoCal, 26);
      cx.fillStyle = C.impulso;
      cx.fillText(tCal, w / 2, h * 0.86);
      cx.fillStyle = C.tenue; cx.font = '11px system-ui';
      cx.fillText('tocalo, o tecla C — recomendado en el telefono', w / 2, h * 0.86 + 22);
    } else {
      cx.textAlign = 'left';
      cx.fillStyle = C.red; cx.font = '14px system-ui';
      cx.fillText(`${nombreCancion()} · intento ${intento}${mejor ? `   mejor ${mejor}` : ''}`, 12, 22);
      // el atajo de revision, dicho donde se necesita
      cx.fillStyle = C.tenue; cx.font = '11px system-ui';
      cx.fillText('◀ ▶  saltar de seccion', 12, h - 10);
      if (!s.meta) dibujarPausa(w, h);
      if (ensayo) {                 // y que se sepa que esto no puntua
        cx.fillStyle = C.sucia; cx.font = 'bold 11px system-ui';
        cx.fillText('ENSAYO', w - 62, h - 10);
      }
      if (sinRed) {                 // ...y que se sepa que abajo no hay nada
        cx.fillStyle = C.esfera; cx.font = 'bold 11px system-ui';
        cx.fillText('SIN RED', w - 62, h - 26);
      }
      if (avisoMuerte) {
        const dt = (performance.now() - avisoMuerte.t) / 4200;
        if (dt >= 1) avisoMuerte = null;
        else {
          const a = avisoMuerte;
          cx.save();
          cx.textAlign = 'center'; cx.globalAlpha = Math.min(1, 4 * (1 - dt));
          // un velo sobre la corrida nueva: el diagnostico tiene que LEERSE, y
          // atras ya arranco el compas 1 con sus teclas y su paisaje
          cx.fillStyle = 'rgba(17,18,20,0.72)';
          cx.fillRect(0, 0, w, h);
          if (a.txt) {
            cx.fillStyle = C.esfera; cx.font = 'bold 15px system-ui';
            cx.fillText(a.txt, w / 2, h * 0.24);
          }
          // el numero, grande: es lo que te hace tocar otra vez
          cx.fillStyle = a.nuevo ? C.impulso : C.peligro;
          cx.font = 'bold 34px system-ui';
          cx.fillText(`${a.pct}%`, w / 2, h * 0.33);
          cx.fillStyle = C.tenue; cx.font = '13px system-ui';
          cx.fillText(a.ensayo ? 'ensayo: no cuenta para el record'
            : a.nuevo && a.record ? `nuevo record — antes ${a.record}%`
            : a.record ? `tu record: ${a.record}%` : 'tu primera vuelta', w / 2, h * 0.33 + 20);
          // ...y el detalle que dirige: cuantas limpias contra tu mejor marca,
          // y el atajo directo a practicar el tramo que te tiro
          if (!a.ensayo && a.mejorLimpias) {
            cx.fillText(`♪ ${a.limpiasRun} — tu mejor: ${a.mejorLimpias}`, w / 2, h * 0.33 + 40);
          }
          if (a.seccion) {
            cx.fillStyle = C.impulso; cx.font = '13px system-ui';
            cx.fillText(`▶  ensayar ${a.seccion}`, w / 2, h * 0.33 + 66);
          }
          // el diagnostico entero: el informe por seccion, con la de la
          // muerte señalada -- se ve QUE tramo esta flojo, no solo cuanto
          if (dt < 0.75) {
            cx.globalAlpha *= dt > 0.6 ? (0.75 - dt) / 0.15 : 1;
            dibujarInforme(w, h, a.limpias, a.xm);
          }
          cx.restore();
        }
      }
      if (avisoSeccion) {
        const dt = (performance.now() - avisoSeccion.t) / 1600;
        if (dt >= 1) avisoSeccion = null;
        else {
          cx.save();
          cx.textAlign = 'center';
          cx.globalAlpha = Math.min(1, 3 * (1 - dt));
          cx.fillStyle = C.impulso; cx.font = 'bold 16px system-ui';
          cx.fillText(avisoSeccion.n.toUpperCase(), w / 2, 30);
          // el contrato del salto, dicho en el momento: ensayo no puntua, y
          // volver a la salida es un concierto que si
          if (avisoSeccion.aviso) {
            cx.fillStyle = C.sucia; cx.font = '11px system-ui';
            cx.fillText('ENSAYO — esta corrida no puntua', w / 2, 48);
          } else if (avisoSeccion.deCero) {
            cx.fillStyle = C.tenue; cx.font = '11px system-ui';
            cx.fillText('DE CERO — esta si cuenta', w / 2, 48);
          }
          cx.restore();
        }
      }
      // El puntaje son las LIMPIAS, no las sonadas: si contaran las sonadas,
      // martillar el boton puntuaba igual que tocar bien.
      cx.fillStyle = C.esfera; cx.font = '15px system-ui';
      cx.fillText(`♪ ${s.limpias.size}/${TOTAL_NOTAS}`, 12, 44);
      // las clavadas al lado: la metrica de maestria se persigue EN VIVO
      if (s.perfectas.size) {
        cx.fillStyle = 'rgba(255,252,240,0.85)'; cx.font = '13px system-ui';
        cx.fillText(`◎ ${s.perfectas.size}`, 96, 44);
      }
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
        // superar tu mejor racha historica se ve: el numero se pinta verde.
        // "estuve a 2 de mi mejor" es el motor del una-mas, y necesita color.
        const record = rachaRecord && s.racha > rachaRecord;
        cx.fillStyle = record ? C.impulso : `rgba(${C.esferaRGB},${Math.min(1, 0.4 + s.racha / 30)})`;
        cx.font = `${Math.min(34, 17 + s.racha)}px system-ui`;
        cx.fillText(`x${s.racha}`, w / 2, 42);
        cx.textAlign = 'left';
      }
      if (rachaRota) {                             // el numero perdido CAE
        const e = (performance.now() - rachaRota.t) / 700;
        if (e >= 1) rachaRota = null;
        else {
          cx.textAlign = 'center';
          cx.fillStyle = `rgba(150,140,130,${0.9 * (1 - e)})`;
          cx.font = `${Math.min(34, 17 + rachaRota.n)}px system-ui`;
          cx.fillText(`x${rachaRota.n}`, w / 2, 42 + e * e * 90);
          cx.textAlign = 'left';
        }
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
        // LA META EN TIEMPOS. Antes volcaba rango+stats+mapa+informe en un
        // solo frame, como una planilla: ahora el rango hace su pop, y el
        // resto entra detras, en orden. Mismo contenido, entregado como
        // ceremonia.
        const tm = metaEn ? (performance.now() - metaEn) / 1000 : 9;
        const rev = desde => Math.max(0, Math.min(1, (tm - desde) / 0.45));
        cx.save();
        cx.globalAlpha = rev(0.6);
        dibujarMapa(w, h);                         // la cancion entera, de una mirada
        cx.restore();
        // El RANGO: la maestria como premio, y nada mas que eso. Sin monedas,
        // sin energia -- lo unico que se desbloquea es saber que lo hiciste.
        const tot = TOTAL_NOTAS || 1;
        const rg = rango(s.limpias.size, tot, s.orbes, ORBES.length, s.perfectas.size);
        cx.save();
        cx.textAlign = 'center';
        cx.globalAlpha = rev(0.05);
        cx.fillStyle = rg === 'AURORA' || rg === 'SUPERNOVA' ? C.impulso : C.peligro;
        cx.font = `bold ${Math.round(30 * (1.2 - 0.2 * rev(0.05)))}px system-ui`;
        cx.fillText(rg, w / 2, h * 0.11);
        cx.globalAlpha = rev(0.45);
        cx.fillStyle = C.peligro; cx.font = '14px system-ui';
        cx.fillText(`${s.limpias.size}/${tot} limpias · ${s.perfectas.size} clavadas · ` +
          `${chuecas} chuecas · racha ${s.mejorRacha}` +
          (ORBES.length ? ` · ${s.orbes}/${ORBES.length} orbes` : ''), w / 2, h * 0.11 + 24);
        // ganar mejorando tu marca no puede verse igual que no mejorarla
        if (metaRecord) {
          cx.globalAlpha = rev(0.8);
          cx.fillStyle = metaRecord.nuevo ? C.impulso : C.tenue; cx.font = '13px system-ui';
          cx.fillText(metaRecord.nuevo
            ? (metaRecord.antes ? `★ nuevo record: ${s.limpias.size} limpias (antes ${metaRecord.antes})` : '★ tu primera marca')
            : `tu record sigue en ${metaRecord.antes} limpias`, w / 2, h * 0.11 + 44);
        }
        cx.globalAlpha = rev(1.2);
        dibujarInforme(w, h);
        cx.globalAlpha = rev(1.6);
        cx.fillStyle = C.tenue; cx.font = '13px system-ui';
        cx.fillText('toca — otra vez · ESC o aca abajo — menu', w / 2, h * 0.95);
        cx.restore();
      }
    }
    hud.textContent = '';
  }
}
