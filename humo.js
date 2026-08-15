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
  constructor () { this.currentTime = 0; this.sampleRate = 44100; this.destination = nodoAudio(); this.state = 'running'; }
  resume () {}
  createGain () { return nodoAudio(); }
  createOscillator () { return nodoAudio(); }
  createBiquadFilter () { return nodoAudio(); }
  createDynamicsCompressor () { return nodoAudio(); }
  createBufferSource () { return nodoAudio(); }
  createBuffer () { return nodoAudio(); }
}

const ctx2d = new Proxy({}, {
  get (t, k) {
    if (k === 'createLinearGradient' || k === 'createRadialGradient')
      return () => ({ addColorStop: () => {} });
    if (k === 'measureText') return () => ({ width: 10 });
    if (k in t) return t[k];
    return () => {};
  },
  set (t, k, v) { t[k] = v; return true; }
});

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
  try { fn(); console.log('  ok    ' + que); }
  catch (e) { fallas++; console.log(' FALLA  ' + que + '\n         ' + e.message); }
};

console.log('\n=== HUMO: la capa de navegador ===');

probar('el menu se dibuja', () => correrCuadros(3));

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
  probar(`${nivel}: vuelve al menu`, () => {
    disparar('keydown', { key: 'Escape', code: 'Escape', preventDefault () {}, repeat: false });
    correrCuadros(5);
  });
}

console.log(fallas ? `\n${fallas} FALLAS` : '\nsin fallas');
process.exit(fallas ? 1 : 0);
