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
// hueco (se oye) y perdes hasta el proximo resorte de rescate. Sobre los
// abismos no hay red: ahi el riel se paga con la vida.
//
// Corre en node (solo simulacion) y en el navegador (render + audio).
// ---------------------------------------------------------------------------

export const BPM = 100;
export const SPB = 60 / BPM;
export const G = 1.24;              // gravedad, en unidades de beat
export const R = 0.055;             // radio de la esfera
export const PASO_TONO = 0.024;     // cuanto sube el mapa por semitono
export const Y_GRAVE = 0.26;        // altura de la nota mas grave (E4)
export const GRACIA_RIEL = 0.18;    // margen para agarrarse al riel
export const CAIDA_MUERTE = -0.35;

// --- la cancion ------------------------------------------------------------
// Un compas por linea, "nota:figura" separados por espacio. "-" es silencio.
// Am F C G. El compas 0 es la entrada: cuatro tiempos de bateria sola.

// El gancho es un solo gesto repetido subiendo: SALTO a una nota larga, y de
// ahi se cae ligado. Tres veces, cada una mas alta. Eso es lo que se pega.

export const CANCION = [
  '-:4',                                                             //  0  entrada
  'A4:1 E5:1.5 D5:.5 C5:1',                                          //  1  Am  el gancho
  'A4:1 F5:1.5 E5:.5 D5:1',                                          //  2  F   el mismo, mas alto
  'C5:1 G5:1.5 E5:.5 D5:1',                                          //  3  C   y otra vez
  'B4:1 D5:1 G4:2',                                                  //  4  G   respuesta
  'A4:1 E5:1 D5:.5 C5:.5 B4:1',                                      //  5  Am  variacion
  'A4:.5 C5:1 F5:.5 E5:.5 D5:.5 C5:1',                               //  6  F   se apura
  '-:4',                                                             //  7  C   SILENCIO: rodar
  'D5:.5 D5:.5 D5:1 D5:.5 C5:.5 B4:1',                               //  8  G   puro ritmo
  'A4:.5 C5:1 E5:1.5 D5:1',                                          //  9  Am  el gancho fuerte
  'A4:.5 C5:1 F5:1.5 E5:1',                                          // 10  F
  'C5:.25 D5:.25 E5:.25 F5:.25 G5:.25 A5:.25 B5:.25 C6:.25 G5:1 E5:1', // 11 C escalera que trepa
  'B5:.25 A5:.25 G5:.25 F5:.25 E5:.25 D5:.25 C5:.25 B4:.25 G4:1 D5:1', // 12 G  cascada que baja
  'A5:2 G5:1 E5:1',                                                  // 13  Am  la cima
  'F5:1.5 E5:.5 C5:2',                                               // 14  F
  'E5:1 G5:1.5 E5:.5 C5:1',                                          // 15  C   el gancho por ultima vez
  'D5:1 B4:1 A4:2'                                                   // 16  G   resuelve en la
];

export const LARGO = CANCION.length * 4;

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
export const AFINADO = 0.11;    // +-66 ms: la nota sale limpia. Mas lejos, chueca.
// La firma de la trampa no es adelantarse, es la RAFAGA: dos toques pegados que
// no suenan. Nadie toca dos veces en 60 ms queriendo; el que martilla, si.
export const MARTILLO = 0.1;    // toques mas juntos que esto, y en falso, castigan
export const CASTIGO = 0.35;    // un toque en falso te deja sordo un rato

// Se apunta un poco adentro de la tecla, no al borde: cayendo justo sobre el
// canto la esfera pasa de largo por medio paso de integracion.
const MIRA = 0.05;
const TOL_BORDE = 0.03;

function compilar () {
  const notas = [];
  let b = 0;
  for (const compas of CANCION) {
    for (const tok of compas.trim().split(/\s+/)) {
      const [nombre, fig] = tok.split(':');
      const dur = parseFloat(fig);
      const silencio = nombre === '-';
      notas.push({
        i: notas.length, b, dur, nombre, silencio,
        f: silencio ? 0 : frecuencia(nombre),
        y: silencio ? 0 : alturaDe(nombre),
        x0: b, x1: b + dur
      });
      b += dur;
    }
  }
  // ancho de cada tecla = ventana de tiempo, recortada para que el vuelo alcance
  for (const n of notas) {
    const sig = notas[n.i + 1];
    if (n.silencio) continue;
    n.riel = n.dur >= 1.5;
    n.escalera = !n.riel && n.dur <= 0.25 && sig && !sig.silencio &&
                 Math.abs(sig.y - n.y) <= 3 * PASO_TONO;
    const tv = sig && !sig.silencio ? vueloMinimo(sig.y - n.y) : 0.03;
    const tope = sig ? sig.x0 - tv : n.b + n.dur;
    if (n.escalera) n.x1 = sig.x0;                       // pegadas: se rueda
    else if (n.riel) n.x1 = Math.max(n.b + 0.4, tope);   // se suelta al final
    else n.x1 = Math.min(n.b + Math.min(0.42, n.dur * 0.7), tope);
  }
  // LIGADURAS: de una nota larga a una corta mas grave no se vuelve a atacar,
  // se cae. El borde de la tecla se corre para que la caida libre aterrice
  // justo sobre la nota siguiente: dejarse caer ES tocarla.
  for (const n of notas) {
    const sig = notas[n.i + 1];
    if (n.silencio || !sig || sig.silencio) continue;
    if (n.escalera || n.dur < 1 || sig.dur > 0.5 || sig.y >= n.y) continue;
    const caida = Math.sqrt(2 * (n.y - sig.y) / G);
    const borde = sig.x0 + MIRA - caida;
    if (borde < n.x0 + 0.14) continue;                   // sin ventana no hay ligadura
    n.ligada = true; n.x1 = borde;
    sig.porCaida = true; sig.desde = n.f;
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

export const NOTAS = compilar();
export const TOTAL_NOTAS = NOTAS.filter(n => !n.silencio).length;
export const PISO = NOTAS[0] && NOTAS[0].piso ? NOTAS[0] : null;   // la plataforma de salida

// --- el terreno, deducido de la cancion -------------------------------------

// Los abismos van debajo de los rieles dramaticos: ahi mantener vale la vida.
export const HUECOS = [
  { x0: 37.1, x1: 39.3 },    // riel del compas 9
  { x0: 41.1, x1: 43.3 },    // riel del compas 10
  { x0: 51.6, x1: 54.3 },    // el riel de la cima
  { x0: 57.6, x1: 60.3 }     // riel del compas 14
];
export const enHueco = x => HUECOS.some(h => x > h.x0 && x < h.x1);

// Techo sobre el silencio del compas 7: ahi tocar mata.
// Termina antes del resorte de reenganche (31.0): ahi ya se puede volver a subir.
export const TECHOS = [{ x0: 28.5, x1: 30.5, y: 0.19 }];

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
  for (const n of NOTAS) if (n.silencio) candidatos.push(n.x0 + n.dur - 1.1);   // reenganche
  for (let x = 4; x < LARGO - 4; x += 4) if (!enSilencio(x)) candidatos.push(x); // rescate
  for (const x of candidatos) {
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
export const RESORTES = resortes();

export const SECCIONES = [
  { x0: 0, n: 'entrada' }, { x0: 4, n: 'tema' }, { x0: 28, n: 'silencio · no toques' },
  { x0: 32, n: 'ritmo' }, { x0: 36, n: 'el tema fuerte' }, { x0: 44, n: 'frenesi' },
  { x0: 52, n: 'la cima' }, { x0: 60, n: 'salida' }
];

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
    coyote: null,           // tecla recien abandonada, todavia tocable
    bloqueo: -Infinity,     // hasta donde no responde el boton: castigo por martillar
    ultimoToque: -Infinity, // para distinguir un toque adelantado de una rafaga
    tocadas: new Set(),
    limpias: new Set(),     // las que ademas sonaron afinadas: ese es el puntaje
    racha: 0, mejorRacha: 0, falsos: 0,
    resortesUsados: new Set(),
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
  const tv = vueloMinimo(sig.y - s.y);
  let objetivo = sig.x0 + MIRA;
  if (objetivo - s.x < tv) objetivo = Math.min(sig.x1 - 0.02, s.x + tv);
  const T = Math.max(0.06, objetivo - s.x);
  s.vy = Math.min(1.9, (sig.y - s.y) / T + G * T / 2);
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
  return n && enCarrera(n) ? n : null;
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
  if (obj) anotar(s, obj, xt - obj.x0, 'nota');
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
      if (!s.tocadas.has(mejor.i)) anotar(s, mejor, s.x - mejor.x0, 'ligada', { desde: mejor.desde });
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
    if (k.riel && s.sostiene && !s.tocadas.has(k.i)) anotar(s, k, s.x - k.x0, 'riel', { hasta: k.x1 });
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
      else if (k.escalera) { s.tecla = k.i + 1; s.y = NOTAS[s.tecla].y; }
      else despegar(s, k);
    }
  } else if (s.estado === 'apoyada') {
    s.y = 0;
    if (enHueco(s.x)) despegar(s);
    else for (const r of RESORTES) {
      if (s.x > r.x0 && s.x < r.x1 && !s.resortesUsados.has(r.x)) {
        s.resortesUsados.add(r.x);
        const k = NOTAS[r.destino];
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
  if (s.tecla < 0) {                      // en la red: un saltito que no suena
    s.estado = 'aire'; s.vy = 0.62;
    s.eventos.push({ tipo: 'saltoRed' });
    return false;
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
  if (rafaga) {
    s.bloqueo = s.x + CASTIGO;
    s.racha = 0; s.falsos++;
    s.eventos.push({ tipo: 'falso', x: s.x, y: s.y });
    return;
  }
  // Adelantarse es el error humano normal y no puede costar la cadena entera.
  if (s.anticipos.length < EN_COLA) s.anticipos.push(s.x);
  s.eventos.push({ tipo: 'aire' });
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
  function ruido (t, dur, gan) {
    const n = Math.max(1, ac.sampleRate * dur | 0), buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource(); src.buffer = buf;
    const g = ac.createGain(); g.gain.value = gan;
    src.connect(g).connect(master); src.start(t);
  }
  function kick (t) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.3);
  }
  const snare = (t, gan = 0.38) => { ruido(t, 0.12, gan); golpe(t, 190, 0.08, 0.15, 'triangle'); };
  const clap = t => { ruido(t, 0.05, 0.2); ruido(t + 0.014, 0.05, 0.16); ruido(t + 0.03, 0.09, 0.2); };
  const hat = (t, abierto) => ruido(t, abierto ? 0.14 : 0.04, abierto ? 0.12 : 0.09);
  const bajo = (t, f, dur = 0.24, gan = 0.3) => golpe(t, f, dur, gan, 'triangle');

  // La base se corre para atras: es el fondo, la melodia sos vos.
  function acordePad (t, notas, dur, gan = 0.032) {
    for (const f of notas) for (const det of [-5, 5]) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gan, t + 0.4);
      g.gain.setValueAtTime(gan, t + dur - 0.5);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + dur);
    }
  }

  // La voz del jugador: solo suena si el jugador la toca. Con `desde` no se
  // vuelve a atacar, se desliza desde la nota anterior: eso es un ligado.
  // `chueca` = llegaste fuera de la ventana afinada. La nota suena igual --nunca
  // se castiga con silencio-- pero sale desafinada y apagada, como una cuerda
  // mal pisada. Es la unica forma de que el oido, y no el HUD, te diga que vas
  // corrido.
  function lead (t, f, dur = 0.4, gan = 0.26, desde = 0, chueca = false) {
    const lp = ac.createBiquadFilter(), g = ac.createGain();
    const ataque = desde ? 0.03 : 0.006;      // seco y al frente: pluck, no pad
    lp.type = 'lowpass'; lp.Q.value = chueca ? 2 : 6;
    lp.frequency.setValueAtTime(Math.min(9000, f * (chueca ? 3 : 8)), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(240, f * (chueca ? 0.9 : 1.4)), t + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gan * (chueca ? 0.7 : 1), t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(lp).connect(voz);
    if (chueca) ruido(t, 0.05, 0.1);          // el golpe seco de la cuerda mal pisada
    // una sola voz afinada + un sub por debajo que da cuerpo sin doblar la nota.
    // Chueca, las dos se van para lados distintos: eso es lo que bate y molesta.
    for (const [tipo, mul, v, des] of [['square', 1, 1, -45], ['sine', 0.5, 0.35, 28]]) {
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
    const g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = Math.min(9000, f * (chueca ? 2.2 : 5));
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(chueca ? 0.15 : 0.2, ac.currentTime + 0.03);
    g.connect(lp).connect(voz);
    if (chueca) ruido(ac.currentTime, 0.05, 0.1);
    const osc = [];
    for (const [tipo, mul, v, des] of [['square', 1, 1, -45], ['sine', 0.5, 0.35, 28]]) {
      const o = ac.createOscillator(), gv = ac.createGain();
      o.type = tipo; o.frequency.value = f * mul; gv.gain.value = v;
      if (chueca) o.detune.value = des;
      o.connect(gv).connect(g); o.start(); osc.push(o);
    }
    rielVoz = { g, osc };
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

  const PROG = [
    { r: 110.00, acorde: [220.00, 261.63, 329.63] },   // Am
    { r: 87.31, acorde: [174.61, 220.00, 261.63] },    // F
    { r: 130.81, acorde: [261.63, 329.63, 392.00] },   // C
    { r: 98.00, acorde: [196.00, 246.94, 293.66] }     // G
  ];
  const armonia = c => PROG[((c - 1) % 4 + 4) % 4];

  function planCompas (c) {
    if (c < 0 || c >= CANCION.length) return null;
    const base = { kick: [], snare: [], clap: [], hats: [0.5, 1.5, 2.5, 3.5], abierto: [], bajo: 'ochos', pad: true, fill: false };
    if (c === 0) return { ...base, kick: [0, 2], bajo: 'nada', pad: false, fill: true };
    if (c <= 2) return { ...base, kick: [0, 2], snare: [3], bajo: 'sus' };
    if (c <= 4) return { ...base, kick: [0, 2], snare: [1, 3], fill: c === 4 };
    if (c <= 6) return { ...base, kick: [0, 2.5], snare: [1, 3], hats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], fill: c === 6 };
    if (c === 7) return { ...base, kick: [0], hats: [], abierto: [2], bajo: 'sus' };          // el silencio
    if (c === 8) return { ...base, kick: [0, 0.5, 2], clap: [1, 3], bajo: 'ochos' };
    if (c <= 10) return { ...base, kick: [0, 2, 2.5], snare: [1, 3], fill: c === 10 };
    if (c <= 12) return { ...base, kick: [0, 1, 2, 3], snare: [1, 3], hats: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75], fill: c === 12 };
    if (c <= 14) return { ...base, kick: [0, 1, 2, 3], snare: [1, 3], clap: [1, 3], hats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], abierto: [3.5], bajo: 'octava', fill: c === 14 };
    return { ...base, kick: [0, 2, 2.5], snare: [1, 3], hats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], bajo: 'octava' };
  }

  function agendarMusica () {
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
    acordePad(t, PROG[0].acorde.map(f => f * 2), 3, 0.07);
    bajo(t, PROG[0].r, 1.2, 0.35);
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
    const ms = Math.round(e.tarde * 600);
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
        desvios.push(Math.abs(e.tarde) * 600); aviso(e);
        lead(ac.currentTime, e.f, Math.max(0.22, 0.44 - Math.abs(e.tarde) * 0.4), 0.26, 0, e.chueca);
        destellos.push({ x: e.x, y: e.y, t: performance.now(), chueca: e.chueca });
        chispas(e.x, e.y, e.chueca ? 3 : 7, true, e.chueca ? C.suciaRGB : C.teclaRGB);
        squash = 1;
      } else if (e.tipo === 'ligada') {
        lead(ac.currentTime, e.f, 0.5, 0.15, e.desde, e.chueca);
        destellos.push({ x: e.x, y: e.y, t: performance.now(), chueca: e.chueca });
        chispas(e.x, e.y, 5, false, e.chueca ? C.suciaRGB : C.teclaRGB);
        squash = 0.8;
      } else if (e.tipo === 'riel') {
        rielAbrir(e.f, e.chueca); aviso(e);
        destellos.push({ x: e.x, y: e.y, t: performance.now(), chueca: e.chueca });
        chispas(e.x, e.y, e.chueca ? 4 : 10, true, e.chueca ? C.suciaRGB : C.teclaRGB);
      } else if (e.tipo === 'falso') {
        // martillaste: cuerda muerta. El boton queda sordo hasta que se acomode.
        ruido(ac.currentTime, 0.05, 0.16);
        golpe(ac.currentTime, 70, 0.09, 0.16, 'square');
        chispas(e.x, e.y, 4, false, C.suciaRGB);
      } else if (e.tipo === 'sordo') {
        ruido(ac.currentTime, 0.015, 0.02);
      } else if (e.tipo === 'rielCorta') {
        rielCerrar();
      } else if (e.tipo === 'resorte') {
        kick(ac.currentTime);
        chispas(e.x, 0, 12, true);
        squash = 1;
      } else if (e.tipo === 'posar') {
        ruido(ac.currentTime, 0.03, 0.05); squash = 0.7;
      } else if (e.tipo === 'red') {
        ruido(ac.currentTime, 0.09, 0.09); squash = 0.9;
        chispas(e.x, 0, 5);
      } else if (e.tipo === 'aire' || e.tipo === 'saltoRed') {
        ruido(ac.currentTime, 0.05, 0.035);
      }
    }
    s.eventos.length = 0;
  }

  function morirOReiniciar () {
    rielCerrar();
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

  function bajar () {
    if (!corriendo) { corriendo = true; arrancarAudio(); return; }
    if (s.meta) { intento = 1; s = crearSim(); t0 = ac.currentTime + 0.7; proxBeat = 0; finSonado = false; return; }
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
    if (!e.repeat) bajar();
  }, { capture: true });
  addEventListener('keyup', e => { if (esBoton(e)) subir(); }, { capture: true });

  // El lienzo toma el foco: sin esto, en un iframe las teclas no llegan nunca.
  cv.tabIndex = 0;
  cv.style.outline = 'none';
  const enfocar = () => { try { cv.focus({ preventScroll: true }); } catch (_) {} };
  enfocar();
  addEventListener('load', enfocar);
  addEventListener('pointerdown', enfocar, { capture: true });

  cv.addEventListener('pointerdown', e => { e.preventDefault(); bajar(); });
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
    if (s.meta && !finSonado) { finSonado = true; rielCerrar(); sonarFinal(); }
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
      cx.fillStyle = limpia ? C.esfera : sono ? C.sucia : C.tecla;
      if (limpia || aqui) { cx.shadowColor = limpia ? C.esfera : C.tecla; cx.shadowBlur = 12; }
      cx.fillRect(px(k.x0), py(k.y), Math.max(4, (k.x1 - k.x0) * esc), alto);
      cx.shadowBlur = 0;
      // EL PUNTO EXACTO. La tecla entera es la ventana en la que la nota suena;
      // esta marca es donde sale afinada. Son cosas distintas y hasta ahora solo
      // se dibujaba la primera: se jugaba creyendo ir a tiempo y sonaba chueco.
      if (!sono) {
        cx.fillStyle = 'rgba(255,255,255,0.30)';
        cx.fillRect(px(k.x0 - AFINADO), py(k.y) - 4, 2 * AFINADO * esc, 2);
        cx.fillStyle = 'rgba(255,255,255,0.95)';
        cx.fillRect(px(k.x0) - 1, py(k.y) - 13, 2, 13);
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
      cx.fillText('DRIBLE — ESPACIO o toca para empezar', w / 2, h * 0.24);
      cx.fillStyle = C.tenue; cx.font = '13px system-ui';
      [
        'cada tecla azul es una nota: tocala al pisarla',
        'la marca blanca es el punto exacto: toca cuando cruza la linea',
        'a tiempo suena afinada; corrida suena chueca',
        'martillar el boton no sirve: se queda sordo',
        'las largas se MANTIENEN: el riel te lanza solo al final',
        'las que cuelgan de un arco no se tocan: dejate caer',
        'los trampolines VERDES te devuelven arriba: pisalos',
        'bajo el techo NO se toca'
      ].forEach((t, i) => cx.fillText(t, w / 2, h * 0.24 + 26 + i * 20));
    } else {
      cx.textAlign = 'left';
      cx.fillStyle = C.red; cx.font = '14px system-ui';
      cx.fillText(`intento ${intento}${mejor ? `   mejor ${mejor}` : ''}`, 12, 22);
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
        cx.fillText('toca para volver', w / 2, h * 0.18 + 22);
      }
    }
    hud.textContent = '';
  }
}
