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
  return notas;
}

export const NOTAS = compilar();
export const TOTAL_NOTAS = NOTAS.filter(n => !n.silencio).length;

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
function resortes () {
  const r = [];
  const enSilencio = x => NOTAS.some(n => n.silencio && x >= n.x0 && x < n.x0 + n.dur);
  const candidatos = [];
  for (const n of NOTAS) if (n.silencio) candidatos.push(n.x0 + n.dur - 1.1);   // reenganche
  for (let x = 4; x < LARGO - 4; x += 4) if (!enSilencio(x)) candidatos.push(x); // rescate
  for (const x of candidatos) {
    if (enHueco(x) || TECHOS.some(t => x > t.x0 - 0.2 && x < t.x1 + 0.2)) continue;
    const destino = NOTAS.find(n => !n.silencio && n.x0 - x >= vueloMinimo(n.y) && n.x0 - x <= 3.2);
    if (destino) r.push({ x: +x.toFixed(3), destino: destino.i });
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
    x: 0, y: 0, vy: 0,
    estado: 'apoyada',      // 'apoyada' | 'aire'
    tecla: -1,              // indice en NOTAS, o -1 = la red
    viva: true, meta: false, causa: null,
    sostiene: false,
    saliendoDe: -1,         // tecla recien lanzada: no se puede volver a posar en ella
    ligadaDe: -1,           // te dejaste caer desde esta: la caida cobra la nota
    anticipos: [],          // toques que todavia no encontraron tecla
    apretadoEn: -Infinity,  // donde empezo el apriete: distingue toque de sostenido
    coyote: null,           // tecla recien abandonada, todavia tocable
    tocadas: new Set(),
    resortesUsados: new Set(),
    eventos: []
  };
}

function despegar (s, dejando = null) {
  s.estado = 'aire'; s.tecla = -1;
  // sin esto, soltar un riel por el medio vuelve a posarse en el mismo riel
  if (dejando) s.saliendoDe = dejando.i;
  s.coyote = dejando && !dejando.riel && !s.tocadas.has(dejando.i)
    ? { i: dejando.i, hasta: s.x + COYOTE } : null;
}

function lanzar (s, desde) {
  const sig = NOTAS[desde.i + 1];
  s.estado = 'aire'; s.tecla = -1; s.saliendoDe = desde.i;
  // si saltaste sin haber sonado esta tecla, todavia la podes cobrar un ratito
  s.coyote = !desde.riel && !s.tocadas.has(desde.i)
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

// El toque efectivo sobre una tecla: suena una nota y, si corresponde, lanza.
// Sonar y saltar son cosas separadas: el salto depende de DONDE estas parado.
function pulsar (s, k) {
  if (k.riel) return false;               // el riel se toca sosteniendo
  const obj = queSuena(s, k);
  if (obj) {
    s.tocadas.add(obj.i);
    s.eventos.push({ tipo: 'nota', f: obj.f, x: s.x, y: s.y, i: obj.i, tarde: s.x - obj.x0 });
  }
  if (!k.escalera && !k.ligada) lanzar(s, k);   // de una ligada se sale cayendo
  return !!obj;
}

function posarse (s, yAntes) {
  let mejor = null, mejorY = -Infinity;
  for (const k of NOTAS) {
    if (k.silencio || k.i === s.saliendoDe) continue;
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
      if (!s.tocadas.has(mejor.i)) {
        s.tocadas.add(mejor.i);
        s.eventos.push({ tipo: 'ligada', f: mejor.f, desde: mejor.desde, x: s.x, y: mejor.y, i: mejor.i, tarde: s.x - mejor.x0 });
      }
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
  const xAntes = s.x;
  s.x += dt;

  if (s.estado === 'apoyada' && s.tecla >= 0) {
    const k = NOTAS[s.tecla];
    s.y = k.y;
    if (k.riel && s.sostiene && !s.tocadas.has(k.i)) {
      s.tocadas.add(k.i);
      s.eventos.push({ tipo: 'riel', f: k.f, x: s.x, y: k.y, i: k.i, hasta: k.x1 });
    }
    if (k.riel && !s.sostiene && s.x > k.x0 + GRACIA_RIEL && s.x < k.x1 - SUELTA) {
      if (s.tocadas.has(k.i)) s.eventos.push({ tipo: 'rielCorta' });
      despegar(s, k);
    } else if (s.x > k.x1) {
      if (k.ligada) {                     // no se vuelve a atacar: se cae ligado
        if (k.riel) s.eventos.push({ tipo: 'rielCorta' });
        if (s.tocadas.has(k.i)) s.ligadaDe = k.i;   // solo se liga lo que sonaste
        s.vy = 0; despegar(s, k);
      } else if (k.riel) { s.eventos.push({ tipo: 'rielCorta' }); lanzar(s, k); }
      else if (k.escalera) { s.tecla = k.i + 1; s.y = NOTAS[s.tecla].y; }
      else despegar(s, k);
    }
  } else if (s.estado === 'apoyada') {
    s.y = 0;
    if (enHueco(s.x)) despegar(s);
    else for (const r of RESORTES) {
      if (xAntes < r.x && s.x >= r.x && !s.resortesUsados.has(r.x)) {
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
function aplicar (s) {
  if (s.estado !== 'apoyada') {
    if (s.coyote && s.x <= s.coyote.hasta) {      // te fuiste del borde hace nada
      const k = NOTAS[s.coyote.i];
      s.coyote = null;
      return pulsar(s, k);
    }
    return false;
  }
  if (s.tecla < 0) {                      // en la red: un saltito que no suena
    s.estado = 'aire'; s.vy = 0.62;
    s.eventos.push({ tipo: 'saltoRed' });
    return false;
  }
  return pulsar(s, NOTAS[s.tecla]);       // los rieles devuelven false: se sostienen
}

// Al posarse se cobran los toques guardados, en orden. Si el primero ademas
// lanza, el que sobra espera el proximo contacto: un toque, una nota.
function drenar (s) {
  while (s.anticipos.length && s.estado === 'apoyada' && s.tecla >= 0) {
    if (s.x - s.anticipos[0] > ANTICIPO) { s.anticipos.shift(); continue; }
    if (!aplicar(s)) break;               // no sono: el toque sigue esperando
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
  if (aplicar(s)) return;
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
    tenue: 'rgba(232,230,224,0.18)'
  };

  let s = crearSim();
  let intento = 1, mejor = 0;
  let ac = null, master = null, eco = null, t0 = 0, proxBeat = 0;
  let corriendo = false, finSonado = false;

  const estela = [], particulas = [], destellos = [], desvios = [];
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
      // eco al tempo solo para la melodia: la hace sonar mucho mas linda
      eco = ac.createDelay(1);
      const real = ac.createGain(), lp = ac.createBiquadFilter();
      eco.delayTime.value = 0.75 * SPB;
      real.gain.value = 0.32;
      lp.type = 'lowpass'; lp.frequency.value = 2600;
      eco.connect(lp).connect(real).connect(eco);
      lp.connect(master);
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

  function acordePad (t, notas, dur, gan = 0.045) {
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
  function lead (t, f, dur = 0.4, gan = 0.2, desde = 0) {
    const lp = ac.createBiquadFilter(), g = ac.createGain();
    const ataque = desde ? 0.05 : 0.012;
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(9000, f * (desde ? 4 : 7)), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.5), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gan, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(lp).connect(master);
    lp.connect(eco);
    for (const [tipo, det, v] of [['square', 0, 1], ['sawtooth', 8, 0.5]]) {
      const o = ac.createOscillator(), gv = ac.createGain();
      o.type = tipo; o.detune.value = det; gv.gain.value = v;
      if (desde) {
        o.frequency.setValueAtTime(desde, t);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
      } else o.frequency.value = f;
      o.connect(gv).connect(g); o.start(t); o.stop(t + dur + 0.02);
    }
  }

  function rielAbrir (f) {
    rielCerrar();
    const g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = Math.min(9000, f * 5);
    lp.connect(eco);
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.17, ac.currentTime + 0.03);
    g.connect(lp).connect(master);
    const osc = [];
    for (const [tipo, det] of [['square', 0], ['sawtooth', 9]]) {
      const o = ac.createOscillator();
      o.type = tipo; o.frequency.value = f; o.detune.value = det;
      o.connect(g); o.start(); osc.push(o);
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

  function procesar () {
    for (const e of s.eventos) {
      if (e.tipo === 'nota') {
        desvios.push(Math.abs(e.tarde) * 600);
        lead(ac.currentTime, e.f, Math.max(0.22, 0.44 - Math.abs(e.tarde) * 0.4));
        destellos.push({ x: e.x, y: e.y, t: performance.now() });
        chispas(e.x, e.y, 7, true, C.teclaRGB);
        squash = 1;
      } else if (e.tipo === 'ligada') {
        lead(ac.currentTime, e.f, 0.5, 0.15, e.desde);
        destellos.push({ x: e.x, y: e.y, t: performance.now() });
        chispas(e.x, e.y, 5, false, C.teclaRGB);
        squash = 0.8;
      } else if (e.tipo === 'riel') {
        rielAbrir(e.f);
        destellos.push({ x: e.x, y: e.y, t: performance.now() });
        chispas(e.x, e.y, 10, true, C.teclaRGB);
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
    mejor = Math.max(mejor, s.tocadas.size);
    intento++;
    s = crearSim();
    t0 = ac.currentTime + 0.7;
    proxBeat = 0;
    estela.length = 0;
    desvios.length = 0;
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

  addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) bajar(); } });
  addEventListener('keyup', e => { if (e.code === 'Space') subir(); });
  cv.addEventListener('pointerdown', e => { e.preventDefault(); bajar(); });
  addEventListener('pointerup', subir);

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

    // resortes
    cx.strokeStyle = C.esfera; cx.lineWidth = 2;
    for (const r of RESORTES) {
      if (r.x < s.x - 3 || r.x > s.x + 7) continue;
      for (const d of [0, 5]) {
        cx.beginPath();
        cx.moveTo(px(r.x - 0.13), py(0) - d);
        cx.lineTo(px(r.x), py(0) - 9 - d);
        cx.lineTo(px(r.x + 0.13), py(0) - d);
        cx.stroke();
      }
    }

    // las teclas: la partitura
    for (const k of NOTAS) {
      if (k.silencio || k.x1 < s.x - 3 || k.x0 > s.x + 7) continue;
      const sono = s.tocadas.has(k.i);
      const aqui = s.tecla === k.i;               // estas parado en esta: toca YA
      const alto = k.riel ? 7 : 5;
      cx.fillStyle = sono ? C.esfera : C.tecla;
      if (sono || aqui) { cx.shadowColor = sono ? C.esfera : C.tecla; cx.shadowBlur = 12; }
      cx.fillRect(px(k.x0), py(k.y), Math.max(4, (k.x1 - k.x0) * esc), alto);
      cx.shadowBlur = 0;
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
      }
    }
    // destellos de nota
    for (let i = destellos.length - 1; i >= 0; i--) {
      const d = destellos[i], e = (performance.now() - d.t) / 420;
      if (e > 1) { destellos.splice(i, 1); continue; }
      cx.strokeStyle = `rgba(${C.esferaRGB},${(1 - e) * 0.9})`;
      cx.lineWidth = 2.5 * (1 - e);
      cx.beginPath(); cx.arc(px(d.x), py(d.y), (0.05 + e * 0.42) * esc, 0, Math.PI * 2); cx.stroke();
    }

    // meta
    cx.strokeStyle = C.esfera; cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(px(LARGO), py(0)); cx.lineTo(px(LARGO), py(0.9)); cx.stroke();

    // estela
    estela.push({ x: s.x, y: s.y + R });
    if (estela.length > 44) estela.shift();
    for (let i = 1; i < estela.length; i++) {
      cx.strokeStyle = `rgba(${C.esferaRGB},${(i / estela.length) * 0.32})`;
      cx.lineWidth = (i / estela.length) * 3;
      cx.beginPath();
      cx.moveTo(px(estela[i - 1].x), py(estela[i - 1].y));
      cx.lineTo(px(estela[i].x), py(estela[i].y));
      cx.stroke();
    }
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
    cx.fillStyle = C.esfera;
    cx.shadowColor = C.esfera; cx.shadowBlur = 12;
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
      cx.fillText('DRIBLE — toca para empezar', w / 2, h * 0.30);
      cx.fillStyle = C.tenue; cx.font = '13px system-ui';
      cx.fillText('cada tecla azul es una nota: tocala al pisarla', w / 2, h * 0.30 + 26);
      cx.fillText('las largas se MANTIENEN · bajo el techo NO se toca', w / 2, h * 0.30 + 46);
      cx.fillText('las que cuelgan de un arco no se tocan: dejate caer', w / 2, h * 0.30 + 66);
    } else {
      cx.textAlign = 'left';
      cx.fillStyle = C.red; cx.font = '14px system-ui';
      cx.fillText(`intento ${intento}${mejor ? `   mejor ${mejor}` : ''}`, 12, 22);
      cx.fillStyle = C.esfera; cx.font = '15px system-ui';
      cx.fillText(`♪ ${s.tocadas.size}/${TOTAL_NOTAS}`, 12, 44);
      if (desvios.length) {                        // que tan al ritmo, no solo cuantas
        cx.fillStyle = C.red; cx.font = '13px system-ui';
        cx.fillText(`±${(desvios.reduce((a, d) => a + d, 0) / desvios.length).toFixed(0)} ms`, 12, 64);
      }
      cx.fillStyle = C.tenue; cx.fillRect(w - 132, 16, 120, 4);
      cx.fillStyle = C.esfera; cx.fillRect(w - 132, 16, 120 * Math.min(1, s.x / LARGO), 4);
      if (s.meta) {
        cx.textAlign = 'center'; cx.fillStyle = C.peligro; cx.font = '18px system-ui';
        cx.fillText(`${s.tocadas.size}/${TOTAL_NOTAS} notas — toca para volver`, w / 2, h * 0.3);
      }
    }
    hud.textContent = '';
  }
}
