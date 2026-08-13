// ---------------------------------------------------------------------------
// DRIBLE — prototipo. La pregunta ahora es: ¿se siente como un JUEGO?
//
// La bola rebota SOLA al beat (el pulso, gratis: es tu metronomo). El jugador
// toca los ACENTOS:
//
//   nada                  -> rebote de 1 beat, eterno (el pulso)
//   TOQUE en el contacto  -> rebote GRANDE de 2 beats (huecos anchos, subidas)
//   MANTENER              -> palmea la pelota: mata el rebote, pasa a rodar
//
// Nadie juzga el ritmo con un reloj: lo juzga la geometria. Tocar de menos
// mata (hueco) y tocar de mas tambien (techo medio). El pulso eterno esta en
// duda (Seba, 12-ago): si en la practica se siente pasivo, la perilla es
// agregarle restitucion — pero primero probar con la cancion densa.
//
// La cancion es UNA (Am-F-C-G, 16 compases) y el nivel es su coreografia:
// cada seccion musical pide un verbo distinto. Los instrumentos viven en el
// mapa: pads = bombo, resortes = bajo, campanas = melodia. La base nunca se
// calla como castigo: jugar mal suena incompleto, nunca roto.
// ---------------------------------------------------------------------------

export const BPM = 100;
export const SPB = 60 / BPM;

export const G = 1.24;            // la misma gravedad del juego grande
export const V_LLENO = G / 2;     // rebote de 1 beat exacto: apex 0.155
export const V_BOOST = G;         // el toque: rebote de 2 beats, apex 0.62
export const R = 0.055;           // radio de la esfera
export const VENTANA = 0.22;      // beats: cuan antes puede llegar el toque
export const CAIDA_MUERTE = -0.45;

// --- el tramo: 16 compases de 4 beats ---------------------------------------
// compas 1-2 intro · 3-6 groove · 7-8 calma (rodar) · 9-10 pulso (no tocar)
// 11 subida · 12-13 cima (plataforma) · 14 groove · 15 drop · 16 salida

export const LARGO = 64;

export const HUECOS = [           // mas anchos que el pulso: piden boost
  { x0: 8.08, x1: 9.92 },
  { x0: 56.08, x1: 57.92 }
];

export const PINCHOS = [          // se pasan por arriba, con el pulso alcanza
  { x: 12.5, w: 0.16, h: 0.09 },
  { x: 18.5, w: 0.16, h: 0.09 },
  { x: 59.5, w: 0.16, h: 0.09 }
];

// Dos alturas de techo = dos verbos prohibidos:
//   0.19 -> ni el pulso entra: hay que PALMAR y pasar rodando (la calma)
//   0.30 -> el pulso pasa justo, el boost NO: prohibido tocar (medio tiempo)
export const TUNELES = [
  { x0: 24.5, x1: 29.5, techo: 0.19 },
  { x0: 32.5, x1: 39.5, techo: 0.30 }
];

export const PLATAFORMAS = [      // piso elevado de una via: la cima del tema
  { x0: 44, x1: 48, y: 0.465 }
];

export const PADS = [             // parches en el piso: pisarlos suena a bombo
  { x: 2 }, { x: 4 }, { x: 6 }, { x: 10 }, { x: 12 }, { x: 20 }, { x: 22 }
];

export const RESORTES = [         // te lanzan 2 beats Y tocan el bajo
  { x: 14 }, { x: 16 },
  { x: 43 }                       // este te SUBE a la plataforma
];
export const V_RESORTE = G;

// Campanas = la melodia, colgada en el mapa. Notas del acorde del compas en
// que suenan: no hay forma de tocarlas mal.
export const CAMPANAS = [
  // bajo el techo medio, a la altura del pulso: se tocan NO tocando
  { x: 33.5, y: 0.21, f: 329.63 },
  { x: 34.5, y: 0.21, f: 440 },
  { x: 35.5, y: 0.21, f: 523.25 },
  { x: 36.5, y: 0.21, f: 440 },
  // sobre la plataforma: el arpegio de la cima (do mayor, compas de C)
  { x: 45, y: 0.675, f: 523.25 },
  { x: 46, y: 0.675, f: 659.25 },
  { x: 47, y: 0.675, f: 783.99 }
];

export const SECCIONES = [
  { x0: 0, n: 'intro' },
  { x0: 8, n: 'groove' },
  { x0: 24.5, n: 'calma · manten y roda' },
  { x0: 32.5, n: 'medio tiempo · no toques' },
  { x0: 40, n: 'subida' },
  { x0: 44, n: 'la cima' },
  { x0: 52, n: 'salida' }
];

export const enHueco = x => HUECOS.some(h => x > h.x0 && x < h.x1);
export const tunelEn = x => TUNELES.find(t => x > t.x0 && x < t.x1) || null;

// --- simulacion --------------------------------------------------------------
// Separada del render y del DOM para poder correrla en node (prueba.js).
// x avanza con el tiempo (1 unidad = 1 beat), y es la BASE de la esfera.

export function crearSim () {
  return {
    x: 0, y: 0, vy: V_LLENO,
    viva: true, meta: false, causa: '',
    rodando: false,
    nivel: 0,                     // altura de la superficie donde apoya/rueda
    tocadas: new Set(),           // campanas ya sonadas en este intento
    toqueEn: -Infinity,           // beat del ultimo toque (flanco de bajada)
    sostiene: false,
    contactos: []                 // eventos para audio y efectos
  };
}

export function tocar (s, b) {
  s.toqueEn = b;
  // Toque apenas DESPUES del contacto: si la pelota acaba de salir del piso
  // con el rebote de pulso, el toque lo agranda igual. Una mano real dribla
  // asi -- el contacto y el toque no son simultaneos, conversan.
  if (!s.sostiene && s.y - s.nivel < 0.05 && s.vy > 0 && s.vy <= V_LLENO + 1e-9) {
    s.vy = V_BOOST; s.rodando = false; s.toqueEn = -Infinity;
    s.contactos.push({ b, tipo: 'lleno' });
  }
}

export function paso (s, dt) {
  if (!s.viva || s.meta) return;
  s.x += dt;
  s.vy -= G * dt;
  const yAntes = s.y;
  s.y += s.vy * dt;

  const piso = !enHueco(s.x);
  // ¿hay superficie a la altura h en este x? (el piso, o alguna plataforma)
  const hay = h => h === 0
    ? piso
    : PLATAFORMAS.some(p => p.y === h && s.x > p.x0 && s.x < p.x1);

  // venir cayendo dentro de un hueco y alcanzar la pared del otro lado NO es
  // aterrizar: es chocar. Sin esto la esfera trepaba la pared del hueco.
  if (piso && s.y < -R) { s.viva = false; s.causa = 'hueco'; return; }

  // rodando: pegada a SU superficie, estable, hasta que un toque la levante o
  // la superficie se acabe (el borde de la plataforma: cae por la parabola).
  if (s.rodando) {
    if (hay(s.nivel)) { s.y = s.nivel; s.vy = 0; }
    else s.rodando = false;
  } else if (s.vy < 0) {
    // aterrizar = cruzar una superficie desde arriba; gana la mas alta.
    // Las plataformas son de una via: subiendo se atraviesan.
    let superficie = piso && yAntes >= -1e-9 && s.y <= 0 ? 0 : null;
    for (const p of PLATAFORMAS) {
      if (s.x > p.x0 && s.x < p.x1 && yAntes >= p.y - 1e-9 && s.y <= p.y &&
          (superficie === null || p.y > superficie)) superficie = p.y;
    }
    if (superficie !== null) {
      s.y = superficie; s.nivel = superficie;
      if (s.sostiene) {
        s.vy = 0; s.rodando = true;
        s.contactos.push({ b: s.x, tipo: 'palma' });
      } else if (s.x - s.toqueEn <= VENTANA) {
        s.vy = V_BOOST; s.rodando = false;
        s.toqueEn = -Infinity;      // un toque agranda UN contacto
        s.contactos.push({ b: s.x, tipo: 'lleno' });
      } else {
        s.vy = V_LLENO;             // el pulso es gratis: rebota solo, al beat
        s.contactos.push({ b: s.x, tipo: 'auto' });
      }
      // los elementos del piso suenan al ser tocados: el instrumento es el MAPA
      if (superficie === 0) {
        if (PADS.some(p => Math.abs(s.x - p.x) < 0.18)) {
          s.contactos.push({ b: s.x, tipo: 'pad', x: s.x });
        }
        const rs = RESORTES.find(r => Math.abs(s.x - r.x) < 0.18);
        if (rs && !s.sostiene) {
          s.vy = V_RESORTE; s.rodando = false;  // el resorte manda sobre el rebote
          s.contactos.push({ b: s.x, tipo: 'resorte', x: rs.x });
        }
      }
    }
  }
  // tocar estando rodando: la levanta con boost (re-arranca a lo grande)
  if (hay(s.nivel) && s.y === s.nivel && s.vy === 0 && !s.sostiene && s.x - s.toqueEn <= VENTANA) {
    s.vy = V_BOOST; s.rodando = false; s.toqueEn = -Infinity;
    s.contactos.push({ b: s.x, tipo: 'lleno' });
  }

  // campanas: se tocan pasando por el aire, una vez por intento
  for (const c of CAMPANAS) {
    if (s.tocadas.has(c.x)) continue;
    const dx = s.x - c.x, dy = (s.y + R) - c.y;
    if (dx * dx + dy * dy < (R + 0.09) ** 2) {
      s.tocadas.add(c.x);
      s.contactos.push({ b: s.x, tipo: 'campana', f: c.f, x: c.x, y: c.y });
    }
  }

  // muertes: la geometria juzga, no el reloj
  if (s.y < CAIDA_MUERTE) { s.viva = false; s.causa = 'hueco'; return; }
  for (const p of PINCHOS) {
    if (Math.abs(s.x - p.x) < p.w / 2 + R && s.y < p.h) {
      s.viva = false; s.causa = 'pincho'; return;
    }
  }
  const t = tunelEn(s.x);
  if (t && s.y + 2 * R > t.techo) { s.viva = false; s.causa = 'tunel'; return; }

  if (s.x >= LARGO) s.meta = true;
}

// --- navegador ---------------------------------------------------------------

if (typeof document !== 'undefined') arrancarNavegador();

function arrancarNavegador () {
  const cv = document.getElementById('lienzo');
  const cx = cv.getContext('2d');
  const hud = document.getElementById('hud');

  const C = {
    fondo: '#111214',
    piso: 'rgba(232,230,224,0.55)',
    peligro: 'rgb(232,230,224)',
    esfera: 'rgb(255,179,71)',
    esferaRGB: '255,179,71',
    tenue: 'rgba(232,230,224,0.22)'
  };

  let s = crearSim();
  let intento = 1;
  let ac = null, master = null, t0 = 0, proxBeat = 0;
  let corriendo = false, finSonado = false;
  let abajoDesde = null;

  // juice
  const estela = [];
  const particulas = [];
  const aros = [];                 // ondas de campana
  const padsVivos = new Map();     // x -> hora del ultimo pisoton
  let squash = 0, flash = 0;

  const ahora = () => ac ? (ac.currentTime - t0) / SPB : 0;

  // --- sintesis --------------------------------------------------------------

  function arrancarAudio () {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ac.createDynamicsCompressor();
      master = ac.createGain();
      master.gain.value = 0.85;
      master.connect(comp).connect(ac.destination);
    }
    ac.resume();
    t0 = ac.currentTime + 0.12;
    proxBeat = 0;
    finSonado = false;
  }

  function golpe (cuando, f, dur, gan, tipo = 'sine') {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f, cuando);
    g.gain.setValueAtTime(gan, cuando);
    g.gain.exponentialRampToValueAtTime(0.001, cuando + dur);
    o.connect(g).connect(master);
    o.start(cuando); o.stop(cuando + dur);
  }
  function ruido (cuando, dur, gan) {
    const n = Math.max(1, ac.sampleRate * dur | 0), buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource(); src.buffer = buf;
    const g = ac.createGain(); g.gain.value = gan;
    src.connect(g).connect(master); src.start(cuando);
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
  function snare (t, gan = 0.4) { ruido(t, 0.12, gan); golpe(t, 190, 0.08, 0.16, 'triangle'); }
  function clap (t) { ruido(t, 0.05, 0.22); ruido(t + 0.014, 0.05, 0.18); ruido(t + 0.03, 0.09, 0.22); }
  function hat (t, abierto = false) { ruido(t, abierto ? 0.14 : 0.045, abierto ? 0.14 : 0.11); }
  function bajo (t, f, dur = 0.24, gan = 0.3) { golpe(t, f, dur, gan, 'triangle'); }
  function campanaSon (t, f, gan = 0.4) {
    golpe(t, f, 0.6, gan, 'sine');
    golpe(t, f * 2.01, 0.3, gan * 0.3, 'sine');
    golpe(t, f * 3.02, 0.12, gan * 0.12, 'sine');
  }
  function acordePad (t, notas, dur, gan = 0.05) {
    for (const f of notas) {
      for (const det of [-4, 4]) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sawtooth';
        o.frequency.value = f; o.detune.value = det;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(gan, t + 0.35);
        g.gain.setValueAtTime(gan, t + dur - 0.5);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(master);
        o.start(t); o.stop(t + dur);
      }
    }
  }

  // --- la cancion: Am F C G, 16 compases --------------------------------------

  const PROG = [
    { r: 110.00, acorde: [220.00, 261.63, 329.63] },   // Am
    { r: 87.31, acorde: [174.61, 220.00, 261.63] },    // F
    { r: 130.81, acorde: [261.63, 329.63, 392.00] },   // C
    { r: 98.00, acorde: [196.00, 246.94, 293.66] }     // G
  ];

  // Que toca la base en el compas c. El nivel es la coreografia de ESTO.
  function planCompas (c) {
    if (c < 0 || c > 15) return null;
    const base = { kick: [], snare: [], clap: [], hats: [0.5, 1.5, 2.5, 3.5], abierto: [], bass: 'ochos', pad: true, fill: false };
    if (c < 2) return { ...base, bass: c === 0 ? 'nada' : 'sus', hats: [0.5, 1.5, 2.5, 3.5] };                    // intro
    if (c < 6) return { ...base, kick: [0, 2], snare: [1, 3], fill: c === 5 };                                     // groove
    if (c < 8) return { ...base, kick: [0], hats: [0.5, 2.5], bass: 'sus' };                                       // calma
    if (c < 10) return { ...base, kick: [0, 2], clap: [1, 3], fill: c === 9 };                                     // medio tiempo
    if (c === 10) return { ...base, kick: [0, 1, 2, 3], snare: [1, 3], fill: true };                               // subida
    if (c < 13) return { ...base, kick: [0, 1, 2, 3], snare: [1, 3], hats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], abierto: [3.5], bass: 'octava' }; // cima
    if (c === 13) return { ...base, kick: [0, 2], snare: [1, 3] };                                                 // groove
    if (c === 14) return { ...base, kick: [0], hats: [0.5, 1.5], bass: 'sus', fill: true };                        // drop
    return { ...base, kick: [0, 1, 2, 3], snare: [1, 3], hats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], bass: 'octava' }; // salida
  }

  function agendarMusica () {
    const b = ahora();
    while (proxBeat < b + 2) {
      const t = t0 + proxBeat * SPB;
      const c = Math.floor(proxBeat / 4);
      const u = proxBeat - c * 4;            // posicion dentro del compas
      const plan = planCompas(c);
      if (plan) {
        const arm = PROG[c % 4];
        if (u === 0 && plan.pad) acordePad(t, arm.acorde, 4 * SPB);
        if (plan.kick.includes(u)) kick(t);
        if (plan.snare.includes(u)) snare(t);
        if (plan.clap.includes(u)) clap(t);
        if (plan.hats.includes(u)) hat(t, plan.abierto.includes(u));
        if (plan.bass === 'ochos' && u % 0.5 === 0) bajo(t, arm.r);
        if (plan.bass === 'octava' && u % 0.5 === 0) bajo(t, u % 1 === 0.5 ? arm.r * 2 : arm.r, 0.2, 0.28);
        if (plan.bass === 'sus' && u === 0) bajo(t, arm.r, 3.6 * SPB, 0.22);
        if (plan.fill && u === 3.25) { snare(t, 0.18); snare(t + 0.25 * SPB, 0.24); snare(t + 0.5 * SPB, 0.32); }
      }
      proxBeat += 0.25;
    }
  }

  function sonarFinal () {
    const t = ac.currentTime + 0.05;
    acordePad(t, PROG[0].acorde.map(f => f * 2), 3, 0.08);
    bajo(t, PROG[0].r, 1.2, 0.35);
    [0, 0.12, 0.24].forEach((d, i) => campanaSon(t + d, [523.25, 659.25, 880][i], 0.3));
  }

  // --- sonidos y efectos del contacto -----------------------------------------

  function chispas (x, y, n, arriba = false) {
    for (let i = 0; i < n; i++) {
      particulas.push({
        x, y,
        vx: (Math.random() - 0.5) * 1.6,
        vy: arriba ? Math.random() * 1.6 + 0.4 : Math.random() * 0.9,
        vida: 1
      });
    }
  }

  function procesarContactos () {
    for (const c of s.contactos) {
      const t = ac.currentTime;
      if (c.tipo === 'pad') {
        kick(t);
        padsVivos.set(Math.round(c.x / 2) * 2, performance.now());
        chispas(c.b, s.nivel, 5);
      } else if (c.tipo === 'resorte') {
        bajo(t, PROG[Math.floor(c.b / 4) % 4].r, 0.34, 0.42);
        bajo(t, PROG[Math.floor(c.b / 4) % 4].r * 2, 0.14, 0.16);
        chispas(c.x, s.nivel, 10, true);
        squash = 1;
      } else if (c.tipo === 'campana') {
        campanaSon(t, c.f);
        aros.push({ x: c.x, y: c.y, t: performance.now() });
        chispas(c.x, c.y, 6, true);
      } else if (c.tipo === 'lleno') {
        ruido(t, 0.06, 0.15); squash = 1; chispas(s.x, s.nivel, 6);
      } else if (c.tipo === 'auto') {
        ruido(t, 0.03, 0.07); squash = 0.6;
      } else if (c.tipo === 'palma') {
        ruido(t, 0.04, 0.10); squash = 0.8;
      }
    }
    s.contactos.length = 0;
  }

  function morirOReiniciar () {
    intento++;
    s = crearSim();
    t0 = ac.currentTime + 0.6;
    proxBeat = 0;
    estela.length = 0;
    flash = 1;
  }

  // --- entrada -----------------------------------------------------------------

  function bajar () {
    if (!corriendo) { corriendo = true; arrancarAudio(); hud.textContent = ''; return; }
    if (s.meta) { intento = 1; s = crearSim(); t0 = ac.currentTime + 0.6; proxBeat = 0; finSonado = false; hud.textContent = ''; return; }
    const b = ahora();
    abajoDesde = b;
    tocar(s, b);
  }
  function subir () { abajoDesde = null; s.sostiene = false; }

  addEventListener('keydown', e => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    if (!e.repeat) bajar();
  });
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

    if (abajoDesde !== null && b - abajoDesde > 0.25) s.sostiene = true;

    const dtBeat = dtSeg / SPB;
    const n = Math.max(1, Math.ceil(dtBeat / (1 / 240)));
    for (let i = 0; i < n && s.viva && !s.meta; i++) paso(s, dtBeat / n);

    procesarContactos();
    if (!s.viva) { golpe(ac.currentTime, 90, 0.3, 0.4, 'sawtooth'); ruido(ac.currentTime, 0.2, 0.3); morirOReiniciar(); }
    if (s.meta && !finSonado) { finSonado = true; sonarFinal(); hud.textContent = 'COMPLETADO — toca para volver'; }
    dibujar(dtSeg);
  }
  requestAnimationFrame(cuadro);

  // --- dibujo ---------------------------------------------------------------------

  function dibujar (dtSeg) {
    const w = cv.clientWidth, h = cv.clientHeight, dpr = devicePixelRatio || 1;
    if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.fillStyle = C.fondo; cx.fillRect(0, 0, w, h);

    const esc = w / 8;
    const y0 = h * 0.74;
    const px = wx => (wx - s.x + 2.2) * esc;
    const py = wy => y0 - wy * esc;

    // piso con huecos
    cx.strokeStyle = C.piso; cx.lineWidth = 2;
    const cortes = [0, ...HUECOS.flatMap(hh => [hh.x0, hh.x1]), LARGO + 6];
    for (let i = 0; i < cortes.length; i += 2) {
      cx.beginPath(); cx.moveTo(px(cortes[i]), py(0)); cx.lineTo(px(cortes[i + 1]), py(0)); cx.stroke();
    }
    // marcas de beat
    cx.strokeStyle = C.tenue; cx.lineWidth = 1;
    for (let bb = Math.ceil(s.x - 3); bb < s.x + 6; bb++) {
      if (bb < 0 || enHueco(bb)) continue;
      cx.beginPath(); cx.moveTo(px(bb), py(0)); cx.lineTo(px(bb), py(0) + (bb % 4 === 0 ? 10 : 5)); cx.stroke();
    }
    // nombres de seccion en el piso
    cx.fillStyle = C.tenue; cx.font = '12px system-ui'; cx.textAlign = 'left';
    for (const z of SECCIONES) cx.fillText(z.n, px(z.x0) + 8, py(0) + 26);

    // plataformas
    cx.strokeStyle = C.piso; cx.lineWidth = 2;
    for (const p of PLATAFORMAS) {
      cx.beginPath(); cx.moveTo(px(p.x0), py(p.y)); cx.lineTo(px(p.x1), py(p.y)); cx.stroke();
    }
    // pads de bombo: se encienden al pisarlos
    for (const p of PADS) {
      const vivo = (performance.now() - (padsVivos.get(p.x) || -9e9)) < 250;
      cx.fillStyle = vivo ? C.esfera : `rgba(${C.esferaRGB},0.4)`;
      cx.fillRect(px(p.x - 0.16), py(0) - (vivo ? 5 : 3), 0.32 * esc, vivo ? 5 : 3);
    }
    // resortes
    cx.strokeStyle = C.esfera; cx.lineWidth = 2;
    for (const r of RESORTES) {
      for (const d of [0, 5]) {
        cx.beginPath();
        cx.moveTo(px(r.x - 0.12), py(0) - d);
        cx.lineTo(px(r.x), py(0) - 8 - d);
        cx.lineTo(px(r.x + 0.12), py(0) - d);
        cx.stroke();
      }
    }
    // pinchos
    cx.fillStyle = C.peligro;
    for (const p of PINCHOS) {
      cx.beginPath();
      cx.moveTo(px(p.x - p.w / 2), py(0)); cx.lineTo(px(p.x), py(p.h)); cx.lineTo(px(p.x + p.w / 2), py(0));
      cx.fill();
    }
    // tuneles
    cx.strokeStyle = C.peligro; cx.lineWidth = 3;
    for (const tt of TUNELES) {
      cx.beginPath(); cx.moveTo(px(tt.x0), py(tt.techo)); cx.lineTo(px(tt.x1), py(tt.techo)); cx.stroke();
      cx.strokeStyle = C.tenue; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(px(tt.x0), py(tt.techo)); cx.lineTo(px(tt.x0), py(0));
      cx.moveTo(px(tt.x1), py(tt.techo)); cx.lineTo(px(tt.x1), py(0)); cx.stroke();
      cx.strokeStyle = C.peligro; cx.lineWidth = 3;
    }
    // campanas
    for (const c of CAMPANAS) {
      const sono = s.tocadas.has(c.x);
      cx.beginPath(); cx.arc(px(c.x), py(c.y), 0.085 * esc, 0, Math.PI * 2);
      if (sono) {
        cx.fillStyle = C.esfera;
        cx.shadowColor = C.esfera; cx.shadowBlur = 14;
        cx.fill();
        cx.shadowBlur = 0;
      } else { cx.strokeStyle = C.esfera; cx.lineWidth = 1.5; cx.stroke(); }
    }
    // aros de campana
    for (let i = aros.length - 1; i >= 0; i--) {
      const a = aros[i], e = (performance.now() - a.t) / 450;
      if (e > 1) { aros.splice(i, 1); continue; }
      cx.strokeStyle = `rgba(${C.esferaRGB},${(1 - e) * 0.8})`;
      cx.lineWidth = 2 * (1 - e);
      cx.beginPath(); cx.arc(px(a.x), py(a.y), (0.085 + e * 0.3) * esc, 0, Math.PI * 2); cx.stroke();
    }
    // meta
    cx.strokeStyle = C.esfera; cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(px(LARGO), py(0)); cx.lineTo(px(LARGO), py(0.6)); cx.stroke();

    // estela
    estela.push({ x: s.x, y: s.y + R });
    if (estela.length > 46) estela.shift();
    for (let i = 1; i < estela.length; i++) {
      cx.strokeStyle = `rgba(${C.esferaRGB},${(i / estela.length) * 0.35})`;
      cx.lineWidth = (i / estela.length) * 3;
      cx.beginPath();
      cx.moveTo(px(estela[i - 1].x), py(estela[i - 1].y));
      cx.lineTo(px(estela[i].x), py(estela[i].y));
      cx.stroke();
    }
    // particulas
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dtSeg * 2.4;
      if (p.vida <= 0) { particulas.splice(i, 1); continue; }
      p.x += p.vx * dtSeg; p.y += p.vy * dtSeg; p.vy -= 3 * dtSeg;
      cx.fillStyle = `rgba(${C.esferaRGB},${p.vida * 0.8})`;
      cx.beginPath(); cx.arc(px(p.x), py(p.y), 2.2 * p.vida, 0, Math.PI * 2); cx.fill();
    }

    // la esfera, con squash en el contacto
    squash = Math.max(0, squash - dtSeg * 7);
    const k = squash * 0.28;
    cx.fillStyle = C.esfera;
    cx.shadowColor = C.esfera; cx.shadowBlur = 10;
    cx.beginPath();
    cx.ellipse(px(s.x), py(s.y + R * (1 - k)), R * esc * (1 + k), R * esc * (1 - k), 0, 0, Math.PI * 2);
    cx.fill();
    cx.shadowBlur = 0;

    // flash de muerte
    if (flash > 0) {
      flash = Math.max(0, flash - dtSeg * 3);
      cx.fillStyle = `rgba(232,230,224,${flash * 0.25})`;
      cx.fillRect(0, 0, w, h);
    }

    // HUD
    cx.fillStyle = C.piso; cx.font = '14px system-ui'; cx.textAlign = 'left';
    if (!corriendo) {
      cx.textAlign = 'center'; cx.font = '17px system-ui';
      cx.fillText('DRIBLE — toca para empezar', w / 2, h * 0.38);
      cx.font = '13px system-ui'; cx.fillStyle = C.tenue;
      cx.fillText('el pulso rebota solo · toque = salto grande · mantener = rodar', w / 2, h * 0.38 + 26);
    } else {
      cx.fillText(`intento ${intento}`, 12, 22);
      cx.fillText(`♪ ${s.tocadas.size}/${CAMPANAS.length}`, 12, 42);
      // barra de progreso
      cx.fillStyle = C.tenue; cx.fillRect(w - 132, 16, 120, 4);
      cx.fillStyle = C.esfera; cx.fillRect(w - 132, 16, 120 * Math.min(1, s.x / LARGO), 4);
    }
  }
}
