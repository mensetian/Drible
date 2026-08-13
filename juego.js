// ---------------------------------------------------------------------------
// DRIBLE — prototipo de juguete. NO es el juego: es la pregunta.
//
// ¿Se siente bien driblar una pelota al ritmo de la musica?
//
// La esfera rebota SOLA al beat: es tu metronomo, gratis. La primera version
// cobraba un toque por cada rebote y eso apilaba dos habilidades (mantenerla
// viva + apuntar a los elementos): era muy dificil. Ahora el jugador toca los
// ACENTOS, no el mantenimiento:
//
//   nada                  -> rebote de 1 beat, eterno (el pulso)
//   TOQUE en el contacto  -> rebote GRANDE de 2 beats (huecos anchos, campanas)
//   MANTENER              -> palmea la pelota: mata el rebote, pasa a rodar
//
// Nadie juzga el ritmo con un reloj: lo juzga la geometria.
//
//   hueco  -> mas ancho que el pulso: solo se cruza con el rebote grande
//   pincho -> solo se pasa por ARRIBA
//   tunel  -> techo bajo: hay que palmar y pasar rodando
//
// Fisica en unidades del juego grande: x en beats, y en altos de pasillo,
// misma gravedad (g = 8*0.62/4 = 1.24). Morir reinicia el tramo, como siempre.
// ---------------------------------------------------------------------------

export const BPM = 100;
export const SPB = 60 / BPM;

export const G = 1.24;            // la misma gravedad del juego grande
export const V_LLENO = G / 2;     // rebote de 1 beat exacto: apex 0.155
export const V_BOOST = G;         // el toque: rebote de 2 beats, apex 0.62
export const R = 0.055;           // radio de la esfera
export const VENTANA = 0.22;      // beats: cuan antes puede llegar el toque
export const CAIDA_MUERTE = -0.45;

// --- el tramo de juguete ----------------------------------------------------
// 40 beats. Primero aire para agarrar el ritmo, despues una pregunta por vez,
// y al final las tres juntas.

export const LARGO = 40;

export const HUECOS = [           // {x0, x1} — mas anchos que el pulso: piden boost
  { x0: 8.08, x1: 9.92 },
  { x0: 26.08, x1: 27.92 },
  { x0: 36.08, x1: 37.92 }
];

export const PINCHOS = [          // {x, w, h} — muerte si el cuerpo pasa bajo
  { x: 12.5, w: 0.16, h: 0.09 },
  { x: 14.5, w: 0.16, h: 0.09 },
  { x: 34.5, w: 0.16, h: 0.09 }
];

export const TUNELES = [          // {x0, x1, techo} — muerte si toca el techo
  { x0: 19.5, x1: 23.5, techo: 0.19 }
];

// --- los instrumentos estan en el MAPA, no en la bola -----------------------
// La bola es la mano; los elementos son las cuerdas. Tocar un elemento en el
// momento justo hace sonar SU nota. El rebote propio de la bola es casi mudo.

export const PADS = [             // parches en el piso: pisarlos suena a bombo
  { x: 2 }, { x: 4 }, { x: 6 }, { x: 10 }, { x: 12 }
];

export const RESORTES = [         // resortes: te lanzan 2 beats Y tocan el bajo
  { x: 14 }, { x: 16 }
];
export const V_RESORTE = G;       // vuelo de 2 beats exactos: apex 0.62

export const CAMPANAS = [         // campanas ALTAS: solo el apex del boost llega
  { x: 29, y: 0.62, f: 330 },
  { x: 31, y: 0.62, f: 392 },
  { x: 33, y: 0.62, f: 440 }
];

// La esfera ES un instrumento -- pero no siempre el mismo. El nivel se divide
// en zonas y en cada una el arreglo deja de tocar UN instrumento: ese sos vos.
// La cancion te necesita distinto en cada tramo:
//
//   bombo   -> lo mas pelota que hay: tu drible es el pulso
//   bajo    -> tu drible camina la linea de bajo; palmar en el tunel la corta
//              y ese silencio es el break de la cancion
//   melodia -> cada drible lleno toca la nota que sigue: rematas la cancion
export const ZONAS = [
  { x0: 0, x1: 14, instr: 'bombo' },
  { x0: 14, x1: 27, instr: 'bajo' },
  { x0: 27, x1: 41, instr: 'melodia' }
];
export const instrumentoEn = x => (ZONAS.find(z => x >= z.x0 && x < z.x1) || ZONAS[0]).instr;

// La base del arreglo: bombo en pares, caja en impares, hat en la contra y el
// bajo caminando en corcheas. MENOS el instrumento de la zona, que es tuyo.
// La base nunca se calla como castigo: jugar mal suena incompleto, nunca roto.
export function golpesEn (b) {
  const tuyo = instrumentoEn(b);
  return {
    bombo: b % 2 === 0 && tuyo !== 'bombo',
    caja: b % 2 === 1,
    hat: b % 1 === 0.5,
    bajo: b % 0.5 === 0 && tuyo !== 'bajo'
  };
}

// La linea de bajo y la melodia son secuencias fijas: la MISMA nota suena en el
// MISMO beat, la toque el arreglo o la toques vos. Por eso driblar la completa
// en vez de ensuciarla. (La pentatonica perdona: no hay nota que suene mal.)
export const BAJO = [110, 110, 82.4, 98];            // por beat, A-A-E-G
export const MELODIA = [220, 262, 294, 330, 392, 330, 294, 262];
export const bajoEn = b => BAJO[Math.floor(b / 2) % BAJO.length];
export const melodiaEn = b => MELODIA[Math.round(b) % MELODIA.length];

export const enHueco = x => HUECOS.some(h => x > h.x0 && x < h.x1);
export const tunelEn = x => TUNELES.find(t => x > t.x0 && x < t.x1) || null;

// --- simulacion -------------------------------------------------------------
// Separada del render y del DOM para poder correrla en node (prueba.js).
// Estado: x avanza con el tiempo (1 unidad = 1 beat), y es la BASE de la
// esfera sobre el piso.

export function crearSim () {
  return {
    x: 0, y: 0, vy: V_LLENO,
    viva: true, meta: false, causa: '',
    rodando: false,
    tocadas: new Set(),           // campanas ya sonadas en este intento
    toqueEn: -Infinity,           // beat del ultimo toque (flanco de bajada)
    sostiene: false,
    contactos: []                 // {b, tipo: 'lleno'|'flojo'|'palma'} p/ audio y fx
  };
}

export function tocar (s, b) {
  s.toqueEn = b;
  // Toque apenas DESPUES del contacto: si la pelota acaba de salir del piso
  // con el rebote de pulso, el toque lo agranda igual. Una mano real dribla
  // asi -- el contacto y el toque no son simultaneos, conversan.
  if (!s.sostiene && s.y < 0.05 && s.vy > 0 && s.vy <= V_LLENO + 1e-9) {
    s.vy = V_BOOST; s.rodando = false; s.toqueEn = -Infinity;
    s.contactos.push({ b, tipo: 'lleno' });
  }
}

export function paso (s, dt) {
  if (!s.viva || s.meta) return;
  s.x += dt;
  s.vy -= G * dt;
  s.y += s.vy * dt;

  const piso = !enHueco(s.x);

  // venir cayendo dentro de un hueco y alcanzar la pared del otro lado NO es
  // aterrizar: es chocar. Sin esto la esfera trepaba la pared del hueco.
  if (piso && s.y < -R) { s.viva = false; s.causa = 'hueco'; return; }

  // rodando: pegada al piso, estable, hasta que un toque la levante o el piso
  // se acabe. Antes pasaba por la logica de contacto y el rebote automatico la
  // despegaba solo -- adentro del tunel eso era saltar contra el techo.
  if (s.rodando) {
    if (piso) { s.y = 0; s.vy = 0; }
    else s.rodando = false;
  } else if (piso && s.y <= 0 && s.vy < 0) {   // contacto con el piso
    s.y = 0;
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
    if (PADS.some(p => Math.abs(s.x - p.x) < 0.18)) {
      s.contactos.push({ b: s.x, tipo: 'pad' });
    }
    const rs = RESORTES.find(r => Math.abs(s.x - r.x) < 0.18);
    if (rs && !s.sostiene) {
      s.vy = V_RESORTE; s.rodando = false;   // el resorte manda sobre el rebote
      s.contactos.push({ b: s.x, tipo: 'resorte' });
    }
  }
  // tocar estando rodando: la levanta del piso con boost (re-arranca a lo grande)
  if (piso && s.y === 0 && s.vy === 0 && !s.sostiene && s.x - s.toqueEn <= VENTANA) {
    s.vy = V_BOOST; s.rodando = false; s.toqueEn = -Infinity;
    s.contactos.push({ b: s.x, tipo: 'lleno' });
  }

  // campanas: se tocan pasando por el aire, una vez por intento
  for (const c of CAMPANAS) {
    if (s.tocadas.has(c.x)) continue;
    const dx = s.x - c.x, dy = (s.y + R) - c.y;
    if (dx * dx + dy * dy < (R + 0.09) ** 2) {
      s.tocadas.add(c.x);
      s.contactos.push({ b: s.x, tipo: 'campana', f: c.f });
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
    tenue: 'rgba(232,230,224,0.22)'
  };

  let s = crearSim();
  let intento = 1;
  let ac = null, t0 = 0, proxBeat = 0;
  let corriendo = false;
  let abajoDesde = null;          // beat en que bajo la tecla (para palma)

  const ahora = () => ac ? (ac.currentTime - t0) / SPB : 0;

  function arrancarAudio () {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    ac.resume();
    t0 = ac.currentTime + 0.12;
    proxBeat = 0;
  }

  function golpe (cuando, f, dur, gan, tipo = 'sine') {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f, cuando);
    g.gain.setValueAtTime(gan, cuando);
    g.gain.exponentialRampToValueAtTime(0.001, cuando + dur);
    o.connect(g).connect(ac.destination);
    o.start(cuando); o.stop(cuando + dur);
  }
  function ruido (cuando, dur, gan) {
    const n = ac.sampleRate * dur, buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource(); src.buffer = buf;
    const g = ac.createGain(); g.gain.value = gan;
    src.connect(g).connect(ac.destination); src.start(cuando);
  }

  function agendarMusica () {
    const b = ahora();
    while (proxBeat < b + 2) {
      const cuando = t0 + proxBeat * SPB;
      const g = golpesEn(proxBeat);
      if (g.bombo) { golpe(cuando, 150, 0.18, 0.5); golpe(cuando, 60, 0.22, 0.4); }
      if (g.caja) { ruido(cuando, 0.09, 0.35); golpe(cuando, 190, 0.08, 0.18, 'triangle'); }
      if (g.hat) ruido(cuando, 0.05, 0.12);
      if (g.bajo) golpe(cuando, bajoEn(proxBeat), 0.24, 0.25, 'triangle');
      proxBeat += 0.5;
    }
  }

  // El drible lleno es LA CAJA de la cancion (el instrumento que falta en el
  // arreglo). El flojo suena moribundo a proposito: grave, corto y cada vez
  // mas apagado -- se OYE que te estas muriendo antes de que el hueco lo cobre.
  function sonarContactos () {
    for (const c of s.contactos) {
      const cuando = ac.currentTime;
      if (c.tipo === 'pad') {
        golpe(cuando, 150, 0.18, 0.6); golpe(cuando, 60, 0.22, 0.5);        // bombo
      } else if (c.tipo === 'resorte') {
        golpe(cuando, bajoEn(c.b), 0.30, 0.45, 'triangle');                 // bajo
        golpe(cuando, bajoEn(c.b) * 2, 0.12, 0.15, 'triangle');             // el "boing"
      } else if (c.tipo === 'campana') {
        golpe(cuando, c.f, 0.5, 0.40, 'square');                            // melodia
        golpe(cuando, c.f * 2.02, 0.25, 0.10, 'sine');                      // brillo
      } else if (c.tipo === 'lleno') {
        ruido(cuando, 0.06, 0.15);   // el boost: un soplido, mas aire que nota
      } else if (c.tipo === 'auto') {
        ruido(cuando, 0.03, 0.07);   // el pulso casi mudo: es la mano, no la cuerda
      } else ruido(cuando, 0.04, 0.10);
    }
    s.contactos.length = 0;
  }

  function morirOReiniciar () {
    intento++;
    s = crearSim();
    t0 = ac.currentTime + 0.6;
    proxBeat = 0;
  }

  // entrada: un boton. Flanco de bajada guarda el beat; mantener >150ms palmea.
  function bajar () {
    if (!corriendo) {
      corriendo = true; arrancarAudio();
      hud.textContent = '';
      return;
    }
    if (s.meta) { intento = 1; morirOReiniciar(); intento = 1; return; }
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

  // lazo
  let antes = performance.now();
  function cuadro (t) {
    requestAnimationFrame(cuadro);
    const dtSeg = Math.min(0.05, (t - antes) / 1000);
    antes = t;
    if (!corriendo) { dibujar(); return; }

    agendarMusica();
    const b = ahora();
    if (b < 0) { dibujar(); return; }               // cuenta de entrada tras morir

    // mantener pasa a palma pasados 150 ms
    if (abajoDesde !== null && b - abajoDesde > 0.25) s.sostiene = true;

    // sub-pasos chicos para no atravesar pinchos
    const dtBeat = dtSeg / SPB;
    const n = Math.max(1, Math.ceil(dtBeat / (1 / 240)));
    for (let i = 0; i < n && s.viva && !s.meta; i++) paso(s, dtBeat / n);

    sonarContactos();
    if (!s.viva) { golpe(ac.currentTime, 90, 0.3, 0.4, 'sawtooth'); morirOReiniciar(); }
    if (s.meta) hud.textContent = 'META — toca para volver';
    dibujar();
  }
  requestAnimationFrame(cuadro);

  function dibujar () {
    const w = cv.clientWidth, h = cv.clientHeight, dpr = devicePixelRatio || 1;
    if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.fillStyle = C.fondo; cx.fillRect(0, 0, w, h);

    const esc = w / 8;                       // 8 beats visibles
    const y0 = h * 0.72;
    const px = wx => (wx - s.x + 2.2) * esc;
    const py = wy => y0 - wy * esc;

    // piso (con huecos)
    cx.strokeStyle = C.piso; cx.lineWidth = 2;
    let cortes = [0, ...HUECOS.flatMap(hh => [hh.x0, hh.x1]), LARGO];
    for (let i = 0; i < cortes.length; i += 2) {
      cx.beginPath();
      cx.moveTo(px(cortes[i]), py(0));
      cx.lineTo(px(cortes[i + 1]), py(0));
      cx.stroke();
    }
    // marcas de beat, tenues
    cx.strokeStyle = C.tenue; cx.lineWidth = 1;
    for (let bb = Math.ceil(s.x - 3); bb < s.x + 6; bb++) {
      if (enHueco(bb)) continue;
      cx.beginPath(); cx.moveTo(px(bb), py(0)); cx.lineTo(px(bb), py(0) + 6); cx.stroke();
    }
    // el nombre de la zona, escrito en el piso: QUE instrumento sos aca
    cx.fillStyle = C.tenue; cx.font = '12px system-ui'; cx.textAlign = 'left';
    const rotulo = { bombo: 'pads: bombo', bajo: 'resortes: bajo', melodia: 'campanas: melodia' };
    for (const z of ZONAS) {
      cx.fillText(rotulo[z.instr], px(z.x0) + 8, py(0) + 24);
      if (z.x0 > 0) {
        cx.strokeStyle = C.tenue; cx.lineWidth = 1;
        cx.beginPath(); cx.moveTo(px(z.x0), py(0)); cx.lineTo(px(z.x0), py(0.35)); cx.stroke();
      }
    }
    // pinchos
    cx.fillStyle = C.peligro;
    for (const p of PINCHOS) {
      cx.beginPath();
      cx.moveTo(px(p.x - p.w / 2), py(0));
      cx.lineTo(px(p.x), py(p.h));
      cx.lineTo(px(p.x + p.w / 2), py(0));
      cx.fill();
    }
    // tuneles
    cx.strokeStyle = C.peligro; cx.lineWidth = 3;
    for (const tt of TUNELES) {
      cx.beginPath();
      cx.moveTo(px(tt.x0), py(tt.techo));
      cx.lineTo(px(tt.x1), py(tt.techo));
      cx.stroke();
    }
    // pads de bombo: parches en el piso
    cx.fillStyle = 'rgba(255,179,71,0.45)';
    for (const p of PADS) cx.fillRect(px(p.x - 0.16), py(0) - 3, 0.32 * esc, 3);
    // resortes: doble chevron
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
    // campanas: huecas hasta que suenan
    for (const c of CAMPANAS) {
      const sono = s.tocadas.has(c.x);
      cx.beginPath();
      cx.arc(px(c.x), py(c.y), 0.09 * esc, 0, Math.PI * 2);
      if (sono) { cx.fillStyle = C.esfera; cx.fill(); }
      else { cx.strokeStyle = C.esfera; cx.lineWidth = 1.5; cx.stroke(); }
    }
    // meta
    cx.strokeStyle = C.esfera; cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(px(LARGO), py(0)); cx.lineTo(px(LARGO), py(0.5)); cx.stroke();

    // esfera
    cx.fillStyle = C.esfera;
    cx.beginPath();
    cx.arc(px(s.x), py(s.y + R), R * esc, 0, Math.PI * 2);
    cx.fill();

    // texto de arranque / intento
    cx.fillStyle = C.piso; cx.font = '14px system-ui'; cx.textAlign = 'left';
    if (!corriendo) {
      cx.textAlign = 'center'; cx.font = '18px system-ui';
      cx.fillText('DRIBLE — toca para empezar. Toque = driblar · mantener = calmar la pelota', w / 2, h * 0.4);
    } else {
      cx.fillText(`intento ${intento}`, 12, 22);
    }
  }
}
