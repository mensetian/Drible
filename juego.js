// ---------------------------------------------------------------------------
// DRIBLE — prototipo de juguete. NO es el juego: es la pregunta.
//
// ¿Se siente bien driblar una pelota al ritmo de la musica?
//
// La esfera rueda y rebota libre, como una pelota real: cada rebote pierde
// energia (restitucion < 1). Nadie juzga el ritmo con un reloj: lo juzga la
// geometria. Los verbos:
//
//   TOQUE en el contacto  -> devuelve toda la energia (rebote de 1 beat)
//   MANTENER              -> palmea la pelota: mata el rebote, pasa a rodar
//   nada                  -> el rebote se apaga solo, en 3-4 pisos ya rueda
//
// Como el rebote lleno dura exactamente 1 beat, driblar bien ES ir al ritmo,
// sin que ninguna ventana lo exija. Los obstaculos (esos si en la grilla):
//
//   hueco  -> solo se pasa con rebote vivo (el apagado cae adentro)
//   pincho -> solo se pasa por ARRIBA, cerca del apex
//   tunel  -> techo bajo: hay que DEJAR morir el rebote y pasar rodando
//
// Fisica en unidades del juego grande: x en beats, y en altos de pasillo,
// misma gravedad (g = 8*0.62/4 = 1.24). Morir reinicia el tramo, como siempre.
// ---------------------------------------------------------------------------

export const BPM = 100;
export const SPB = 60 / BPM;

export const G = 1.24;            // la misma gravedad del juego grande
export const V_LLENO = G / 2;     // rebote de 1 beat exacto: apex 0.155
export const REST = 0.68;         // restitucion: cuanto queda si no tocas
export const R = 0.055;           // radio de la esfera
export const VENTANA = 0.22;      // beats: cuan antes puede llegar el toque
export const V_MIN = 0.10;        // debajo de esto el rebote ya es rodar
export const CAIDA_MUERTE = -0.45;

// --- el tramo de juguete ----------------------------------------------------
// 40 beats. Primero aire para agarrar el ritmo, despues una pregunta por vez,
// y al final las tres juntas.

export const LARGO = 40;

export const HUECOS = [           // {x0, x1} — sin piso
  { x0: 8.08, x1: 8.92 },
  { x0: 26.08, x1: 26.92 },
  { x0: 36.08, x1: 36.92 }
];

export const PINCHOS = [          // {x, w, h} — muerte si el cuerpo pasa bajo
  { x: 12.5, w: 0.16, h: 0.09 },
  { x: 14.5, w: 0.16, h: 0.09 },
  { x: 34.5, w: 0.16, h: 0.09 }
];

export const TUNELES = [          // {x0, x1, techo} — muerte si toca el techo
  { x0: 19.5, x1: 23.5, techo: 0.19 }
];

// La musica del prototipo: bombo en los beats PARES, hat en la contra. La caja
// no esta -- a proposito. La caja sos VOS: el drible lleno suena a caja, y
// recien cuando dribleas al beat la bateria esta completa. La cancion no te
// acompaña: te necesita.
export function golpesEn (b) {
  return { bombo: b % 2 === 0, hat: b % 1 === 0.5 };
}

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
    toqueEn: -Infinity,           // beat del ultimo toque (flanco de bajada)
    sostiene: false,
    contactos: []                 // {b, tipo: 'lleno'|'flojo'|'palma'} p/ audio y fx
  };
}

export function tocar (s, b) {
  s.toqueEn = b;
  // Toque apenas DESPUES del contacto: si la pelota acaba de salir del piso
  // con rebote flojo, el toque la llena igual. Una mano real dribla asi --
  // el contacto y el toque no son simultaneos, conversan.
  if (!s.sostiene && s.y < 0.05 && s.vy > 0 && s.vy < V_LLENO) {
    s.vy = V_LLENO; s.rodando = false; s.toqueEn = -Infinity;
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

  // contacto con el piso
  if (piso && s.y <= 0 && s.vy < 0) {
    s.y = 0;
    const rapidez = -s.vy;
    if (s.sostiene) {
      s.vy = 0; s.rodando = true;
      s.contactos.push({ b: s.x, tipo: 'palma' });
    } else if (s.x - s.toqueEn <= VENTANA) {
      s.vy = V_LLENO; s.rodando = false;
      s.toqueEn = -Infinity;      // un toque energiza UN contacto
      s.contactos.push({ b: s.x, tipo: 'lleno' });
    } else {
      s.vy = rapidez * REST;
      if (s.vy < V_MIN) { s.vy = 0; s.rodando = true; }
      else s.contactos.push({ b: s.x, tipo: 'flojo' });
    }
  }
  // rodando: pegada al piso mientras haya piso; si se acaba, cae libre
  if (s.rodando) {
    if (piso && s.vy <= 0) { s.y = 0; s.vy = 0; }
    else s.rodando = false;
  }
  // soltar un toque estando rodando: la levanta del piso (re-arranca el drible)
  if (piso && s.y === 0 && s.vy === 0 && !s.sostiene && s.x - s.toqueEn <= VENTANA) {
    s.vy = V_LLENO; s.rodando = false; s.toqueEn = -Infinity;
    s.contactos.push({ b: s.x, tipo: 'lleno' });
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
      if (golpesEn(proxBeat).bombo) { golpe(cuando, 150, 0.18, 0.5); golpe(cuando, 60, 0.22, 0.4); }
      if (golpesEn(proxBeat + 0.5).hat) ruido(cuando + 0.5 * SPB, 0.05, 0.12);
      proxBeat += 0.5;
    }
  }

  // El drible lleno es LA CAJA de la cancion (el instrumento que falta en el
  // arreglo). El flojo suena moribundo a proposito: grave, corto y cada vez
  // mas apagado -- se OYE que te estas muriendo antes de que el hueco lo cobre.
  function sonarContactos () {
    for (const c of s.contactos) {
      const cuando = ac.currentTime;
      if (c.tipo === 'lleno') {
        ruido(cuando, 0.09, 0.45);                       // el cuerpo de la caja
        golpe(cuando, 190, 0.10, 0.30, 'triangle');      // el golpe seco
      } else if (c.tipo === 'flojo') {
        const energia = s.vy / V_LLENO;                  // 0..1, ya con restitucion
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(70 + 200 * energia, cuando);
        o.frequency.exponentialRampToValueAtTime(55, cuando + 0.12);
        g.gain.setValueAtTime(0.08 + 0.20 * energia, cuando);
        g.gain.exponentialRampToValueAtTime(0.001, cuando + 0.12);
        o.connect(g).connect(ac.destination);
        o.start(cuando); o.stop(cuando + 0.12);
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
