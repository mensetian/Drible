// Prueba de HUMO: corre la capa de navegador (render + audio) con un DOM y un
// AudioContext simulados. La suite de prueba.js solo ejercita la simulacion;
// todo el dibujo y la sintesis quedaban sin red. Esto no juzga como se ve:
// juzga que no explote.
//
//   node drible/humo.js

const nodoAudio = () => new Proxy({}, {
  get (t, k) {
    if (k === 'connect') return d => d;
    if (k === 'start' || k === 'stop' || k === 'cancelScheduledValues') return () => {};
    if (k === 'getChannelData') return () => new Float32Array(64);
    if (k in t) return t[k];
    t[k] = new Proxy({ value: 0 }, {
      get (t2, k2) {
        if (typeof k2 === 'string' && (k2.startsWith('set') || k2.includes('ramp') ||
            k2.startsWith('linear') || k2.startsWith('exponential') || k2 === 'cancelScheduledValues'))
          return () => {};
        return t2[k2];
      },
      set (t2, k2, v) { t2[k2] = v; return true; }
    });
    return t[k];
  },
  set (t, k, v) { t[k] = v; return true; }
});

class AudioContextFalso {
  constructor () { this.sampleRate = 44100; this.destination = nodoAudio(); this.state = 'running'; }
  // el reloj avanza con los cuadros: asi se recorre de verdad el camino donde
  // la imagen consume los golpes agendados (el latido del fondo)
  get currentTime () { return reloj / 1000; }
  resume () {}
  createGain () { return nodoAudio(); }
  createOscillator () { return nodoAudio(); }
  createBiquadFilter () { return nodoAudio(); }
  createDynamicsCompressor () { return nodoAudio(); }
  createBufferSource () { return nodoAudio(); }
  createBuffer () { return nodoAudio(); }
}

// Se anota TODO lo que el juego escribe en pantalla: es la unica forma de
// afirmar que una pantalla se dibujo de verdad y no que el cuadro paso de
// largo sin explotar.
const textos = [];
const ctx2d = new Proxy({}, {
  get (t, k) {
    if (k === 'createLinearGradient' || k === 'createRadialGradient')
      return () => ({ addColorStop: () => {} });
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'fillText' || k === 'strokeText') return s => { textos.push(String(s)); };
    if (k in t) return t[k];
    return () => {};
  },
  set (t, k, v) { t[k] = v; return true; }
});
const dijo = frag => textos.some(t => t.includes(frag));

const lienzo = {
  width: 900, height: 500, clientWidth: 900, clientHeight: 500, style: {}, tabIndex: 0,
  getContext: () => ctx2d, addEventListener (tipo, f) { (oyentes[tipo] ||= []).push(f); },
  focus () {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 500 })
};
const oyentes = {};
globalThis.document = {
  getElementById: id => id === 'lienzo' ? lienzo : { textContent: '', style: {} },
  addEventListener: () => {}
};
globalThis.AudioContext = AudioContextFalso;
globalThis.window = globalThis;
globalThis.performance = globalThis.performance || { now: () => reloj };
globalThis.addEventListener = (tipo, f) => { (oyentes[tipo] ||= []).push(f); };
globalThis.devicePixelRatio = 1;

let reloj = 0;
const cuadros = [];
globalThis.requestAnimationFrame = f => { cuadros.push(f); return cuadros.length; };

await import('./juego.js');

const disparar = (tipo, ev) => (oyentes[tipo] || []).forEach(f => f(ev));
const correrCuadros = (n, ms = 16) => {
  for (let i = 0; i < n; i++) {
    const f = cuadros.shift();
    if (!f) throw new Error('el lazo de dibujo se corto en el cuadro ' + i);
    reloj += ms;
    f(reloj);
  }
};

let fallas = 0;
const probar = (que, fn) => {
  textos.length = 0;
  try { fn(); console.log('  ok    ' + que); }
  catch (e) { fallas++; console.log(' FALLA  ' + que + '\n         ' + e.message); }
};
const exigir = (cond, msg) => { if (!cond) throw new Error(msg); };
const tocar1 = () => {
  disparar('keydown', { key: ' ', code: 'Space', preventDefault () {}, repeat: false });
  disparar('keyup', { key: ' ', code: 'Space', preventDefault () {} });
};

console.log('\n=== HUMO: la capa de navegador ===');

probar('el menu se dibuja', () => {
  correrCuadros(3);
  exigir(dijo('elegi el nivel'), 'el menu no escribio su titulo');
  exigir(dijo('calibrar'), 'el menu no ofrece calibrar');
});

// La calibracion es la pantalla que decide si el juego se siente roto en un
// telefono, y no la tocaba ninguna prueba.
probar('calibrar: suena, se tocan los golpes, y guarda un numero', () => {
  disparar('keydown', { key: 'c', code: 'KeyC', preventDefault () {}, repeat: false });
  correrCuadros(6, 120);
  for (let i = 0; i < 14; i++) { tocar1(); correrCuadros(5, 120); }
  exigir(dijo('toca con lo que ESCUCHAS'), 'no se abrio la pantalla de calibrar');
  correrCuadros(40, 200);            // hasta pasado el final de la cuenta
  exigir(textos.some(t => / ms$/.test(t)), 'la calibracion no dio un resultado en ms');
  correrCuadros(30, 200);            // y vuelve sola al menu
  exigir(dijo('elegi el nivel'), 'no volvio al menu despues de calibrar');
});

// Llegar a la meta: se salta a la ultima seccion y se deja rodar por la red
// (sin tocar nada) hasta cruzar el final. Asi se dibuja el informe final, que
// tampoco lo ejercitaba nadie.
probar('esfera: llegar a la meta dibuja el rango y el informe por seccion', () => {
  disparar('keydown', { key: '1', code: 'Digit1', preventDefault () {}, repeat: false });
  correrCuadros(20);
  for (let i = 0; i < 16; i++) {
    disparar('keydown', { key: 'ArrowRight', preventDefault () {}, repeat: false });
    correrCuadros(3);
  }
  correrCuadros(700);
  exigir(dijo('toca para volver al menu'), 'no se dibujo la pantalla de meta');
  exigir(dijo('LLEGASTE') || dijo('AFINADO') || dijo('MUSICO') || dijo('VIRTUOSO') || dijo('AURORA'),
    'la meta no mostro ningun rango');
  tocar1();
  correrCuadros(5);
  exigir(dijo('elegi el nivel'), 'desde la meta no se vuelve al menu');
});

for (const [tecla, nivel] of [['1', 'esfera'], ['2', 'aurora'], ['3', 'viaje']]) {
  probar(`${nivel}: arranca, juega, y sobrevive 400 cuadros`, () => {
    disparar('keydown', { key: tecla, code: 'Digit' + tecla, preventDefault () {}, repeat: false });
    correrCuadros(30);
    // una mano que toca y suelta seguido: pasa por nota, riel, orbe y martillo
    for (let i = 0; i < 370; i++) {
      if (i % 7 === 0) disparar('keydown', { key: ' ', code: 'Space', preventDefault () {}, repeat: false });
      if (i % 7 === 3) disparar('keyup', { key: ' ', code: 'Space', preventDefault () {} });
      correrCuadros(1);
    }
  });
  probar(`${nivel}: saltar de seccion con las flechas`, () => {
    for (let i = 0; i < 6; i++) {
      disparar('keydown', { key: 'ArrowRight', preventDefault () {}, repeat: false });
      correrCuadros(20);
    }
    disparar('keydown', { key: 'ArrowLeft', preventDefault () {}, repeat: false });
    correrCuadros(20);
  });
  // el HUD tiene que seguir diciendo donde estas y como revisar: si el nombre
  // de la cancion desaparece del cartel, algo se rompio sin tirar excepcion
  probar(`${nivel}: el HUD sigue en pie, y la corrida queda marcada ENSAYO`, () => {
    correrCuadros(5);
    exigir(dijo('saltar de seccion'), 'se perdio el atajo de revision');
    exigir(dijo('intento'), 'se perdio el cartel de la cancion');
    // saltar de seccion no puede puntuar: si no se avisa, un record sacado
    // saltando al 90% pasa por bueno
    exigir(dijo('ENSAYO'), 'saltar de seccion no marco la corrida como ensayo');
  });
}

console.log(fallas ? `\n${fallas} FALLAS` : '\nsin fallas');
process.exit(fallas ? 1 : 0);
