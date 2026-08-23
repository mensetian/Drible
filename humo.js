// Prueba de HUMO: corre la capa de navegador (render + audio) con un DOM y un
// AudioContext simulados. La suite de prueba.js solo ejercita la simulacion;
// todo el dibujo y la sintesis quedaban sin red. Esto no juzga como se ve:
// juzga que no explote.
//
//   node humo.js

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
  // el reloj del AUDIO es otro hardware: puede correr a otro ritmo que el del
  // sistema, y `derivaAudio` es lo que deja simular esa diferencia
  get currentTime () { return reloj * derivaAudio / 1000; }
  resume () {}
  suspend () {}
  createGain () { return nodoAudio(); }
  createOscillator () { return nodoAudio(); }
  createBiquadFilter () { return nodoAudio(); }
  createDynamicsCompressor () { return nodoAudio(); }
  createBufferSource () { return nodoAudio(); }
  createDelay () { return nodoAudio(); }
  createBuffer () { return nodoAudio(); }
  createConvolver () { return nodoAudio(); }
  createStereoPanner () { return nodoAudio(); }
}

// Se anota TODO lo que el juego escribe en pantalla: es la unica forma de
// afirmar que una pantalla se dibujo de verdad y no que el cuadro paso de
// largo sin explotar.
const textos = [];
const transformes = [];
const ctx2d = new Proxy({}, {
  get (t, k) {
    if (k === 'createLinearGradient' || k === 'createRadialGradient')
      return () => ({ addColorStop: () => {} });
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'fillText' || k === 'strokeText') return s => { textos.push(String(s)); };
    if (k === 'setTransform') return (...a) => { transformes.push(a); };
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
// Un localStorage de mentira: sin esto el record no se ejercitaba NUNCA fuera
// del navegador --leerRecord/guardarRecord viven en try/catch-- y son el
// camino que corre en cada muerte.
const guardado = new Map();
globalThis.localStorage = {
  getItem: k => (guardado.has(k) ? guardado.get(k) : null),
  setItem: (k, v) => { guardado.set(k, String(v)); },
  removeItem: k => { guardado.delete(k); }
};
globalThis.window = globalThis;
globalThis.performance = globalThis.performance || { now: () => reloj };
globalThis.addEventListener = (tipo, f) => { (oyentes[tipo] ||= []).push(f); };
globalThis.devicePixelRatio = 1;

let reloj = 0;
let derivaAudio = 1;
const cuadros = [];
globalThis.requestAnimationFrame = f => { cuadros.push(f); return cuadros.length; };

globalThis.__dribleDiag = true;
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
// la red esta puesta si configuracion lo dice; sirve para no alternarla al azar
const dijoModoFacil = () => {
  const antes = textos.length;
  disparar('keydown', { key: 'Escape', code: 'Escape', preventDefault () {}, repeat: false });
  correrCuadros(2);
  const si = textos.slice(antes).some(t => t.includes('MODO FACIL — con red'));
  return si;
};
const tocar1 = () => {
  disparar('keydown', { key: ' ', code: 'Space', preventDefault () {}, repeat: false });
  disparar('keyup', { key: ' ', code: 'Space', preventDefault () {} });
};

console.log('\n=== HUMO: la capa de navegador ===');

// LAS TRES PANTALLAS DE ENTRADA. Entrada -> mapa -> configuracion, y de
// vuelta. Cada paso tiene que dejar una marca de texto propia: si una pantalla
// deja de dibujarse, el juego se ve igual de vivo y el jugador queda encerrado.
probar('la entrada se dibuja, y lleva al mapa y a configuracion', () => {
  correrCuadros(3);
  exigir(dijo('DRIBLE'), 'la entrada no escribio su titulo');
  exigir(dijo('JUGAR'), 'la entrada no ofrece empezar');
  exigir(dijo('ESTELA'), 'la entrada no deja elegir la estela');
  tocar1();                       // el boton, desde la entrada, es EMPEZAR
  textos.length = 0; correrCuadros(3);
  exigir(dijo('ELEGÍ TU CANCIÓN'), 'JUGAR no llevo al mapa de niveles');
  disparar('keydown', { key: 'Escape', code: 'Escape', preventDefault () {}, repeat: false });
  textos.length = 0; correrCuadros(3);
  exigir(dijo('DRIBLE'), 'ESC en el mapa no vuelve a la entrada');
  // configuracion: la red es una opcion que hay que ir a buscar, y esta ahi
  disparar('keydown', { key: 'f', code: 'KeyF', preventDefault () {}, repeat: false });
  textos.length = 0; correrCuadros(3);
  exigir(dijo('AJUSTES'), 'la tecla F no abrio los ajustes');
  exigir(dijo('RED DE SEGURIDAD — PUESTA'), 'la tecla F no puso la red');
  exigir(dijo('CALIBRAR EL SONIDO'), 'los ajustes no ofrecen calibrar');
});

// La calibracion es la pantalla que decide si el juego se siente roto en un
// telefono, y no la tocaba ninguna prueba.
probar('calibrar: suena, se tocan los golpes, y guarda un numero', () => {
  disparar('keydown', { key: 'c', code: 'KeyC', preventDefault () {}, repeat: false });
  correrCuadros(6, 120);
  for (let i = 0; i < 14; i++) { tocar1(); correrCuadros(5, 120); }
  exigir(dijo('CALIBRAR EL SONIDO'), 'no se abrio la pantalla de calibrar');
  correrCuadros(40, 200);            // hasta pasado el final de la cuenta
  exigir(textos.some(t => / ms$/.test(t)), 'la calibracion no dio un resultado en ms');
  correrCuadros(30, 200);            // y vuelve sola a configuracion, de donde salio
  exigir(dijo('AJUSTES'), 'no volvio a los ajustes despues de calibrar');
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
  exigir(dijo('Tocá para jugar otra vez'), 'no se dibujo la pantalla de meta');
  exigir(dijo('LLEGASTE') || dijo('AFINADO') || dijo('MUSICO') || dijo('VIRTUOSO') || dijo('AURORA') || dijo('SUPERNOVA'),
    'la meta no mostro ningun rango');
  // el toque en la meta es OTRA VEZ: reinicia la misma cancion de cero. Se
  // vuelve a la meta saltando, y de ahi ESC si sale al menu -- que ademas
  // deja el humo en el estado que los tests siguientes esperan.
  tocar1();
  correrCuadros(5);
  exigir(!dijo('ELEGÍ TU CANCIÓN'), 'el toque en la meta tiro al menu: debe reintentar');
  textos.length = 0;
  for (let i = 0; i < 16; i++) {
    disparar('keydown', { key: 'ArrowRight', preventDefault () {}, repeat: false });
    correrCuadros(3);
  }
  correrCuadros(700);
  exigir(dijo('Tocá para jugar otra vez'), 'el reintento no llego a una meta nueva');
  disparar('keydown', { key: 'Escape', code: 'Escape', preventDefault () {}, repeat: false });
  correrCuadros(5);
  exigir(dijo('ELEGÍ TU CANCIÓN'), 'ESC en la meta no vuelve al menu');
});

for (const [tecla, nivel] of [['1', 'esfera'], ['2', 'viaje']]) {
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
  probar(`${nivel}: se pausa y se sigue`, () => {
    disparar('keydown', { key: 'Escape', code: 'Escape', preventDefault () {}, repeat: false });
    correrCuadros(4);
    exigir(dijo('PAUSA'), 'no se pauso con ESC');
    textos.length = 0;
    correrCuadros(20);
    exigir(dijo('PAUSA'), 'la pausa no se sostuvo');
    tocar1();                                   // en pausa, tocar es seguir
    textos.length = 0;
    correrCuadros(6);
    exigir(!dijo('PAUSA'), 'tocar no reanudo el juego');
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
    exigir(dijo('Saltar de sección'), 'se perdio el atajo de revision');
    exigir(dijo('Intento'), 'se perdio el cartel de la cancion');
    // saltar de seccion no puede puntuar: si no se avisa, un record sacado
    // saltando al 90% pasa por bueno
    exigir(dijo('ENSAYO'), 'saltar de seccion no marco la corrida como ensayo');
  });
}

// EL RECORD Y SU MODO. guardarRecord corre en cada muerte y en cada meta, vive
// en un try/catch, y sin localStorage de mentira no lo ejercitaba nadie: si su
// firma se rompe, el juego sigue andando y el jugador pierde sus marcas en
// silencio. Aca se lo obliga a escribir, a leer lo viejo y a habilitar el modo.
probar('el record se guarda, se lee, y sin red es lo normal', () => {
  // salir de la corrida en curso: pausa y M. (Antes no habia salida al menu a
  // mitad de cancion -- para cambiar de nivel habia que dejarse matar.)
  disparar('keydown', { key: 'Escape', code: 'Escape', preventDefault () {}, repeat: false });
  correrCuadros(4);
  exigir(dijo('Volver al menú'), 'la pausa no ofrece salida al menu');
  disparar('keydown', { key: 'm', code: 'KeyM', preventDefault () {}, repeat: false });
  correrCuadros(4);
  textos.length = 0;
  correrCuadros(4);
  exigir(dijo('ELEGÍ TU CANCIÓN'), 'M en pausa no volvio al menu');
  // un record viejo, del formato anterior {pct, limpias}: tiene que sobrevivir
  localStorage.setItem('drible:record:esfera', JSON.stringify({ pct: 100, limpias: 40 }));
  textos.length = 0;
  correrCuadros(4);
  exigir(dijo('☆') || dijo('♪'), 'el record viejo no aparece en el mapa');
  // sacar la red: F la alterna, y el mapa tiene que decir la regla que rige
  disparar('keydown', { key: 'f', code: 'KeyF', preventDefault () {}, repeat: false });
  correrCuadros(4);
  textos.length = 0;
  correrCuadros(4);
  exigir(dijo('RED DE SEGURIDAD — SIN RED'), 'la tecla F no saco la red');
  disparar('keydown', { key: '1', code: 'Digit1', preventDefault () {}, repeat: false });
  correrCuadros(20);
  textos.length = 0;
  correrCuadros(6);
  // ...y adentro NO se dice: el modo no es un cartel, se descubre cayendo
  exigir(!dijo('SIN RED'), 'el modo sin red se anuncia en el HUD: tiene que ser invisible');
  // y que la escritura del record no explote: se juega y se muere sin tocar
  correrCuadros(600);
  exigir(JSON.parse(localStorage.getItem('drible:record:esfera')).limpias >= 40,
    'el record viejo se perdio al guardar el nuevo');
});

// MORIR ESPERA. El informe por seccion se dibujaba encima del compas 1 de la
// corrida nueva, que ya habia arrancado: habia que elegir entre leerlo y
// jugar, y para salir al menu tocaba dejarse matar de nuevo. Ahora el mundo se
// congela hasta que el jugador decide, y eso es exactamente lo que se prueba:
// que el velo NO se va solo, y que las dos salidas existen.
probar('morir espera: el informe se queda hasta que decidas', () => {
  // viene de la prueba anterior con la red sacada, asi que no tocar nada mata
  correrCuadros(900);
  // LA MUERTE RESPIRA 1700 ms de reloj de pared antes del informe: es el cine
  // de la caida, y el menu encima lo taparia. El respiro corre en tiempo real
  // --no con el reloj de cuadros-- asi que la prueba lo deja pasar de veras.
  textos.length = 0;
  correrCuadros(20);
  exigir(!dijo('OTRA VEZ'), 'el informe piso el cine de la muerte');
  const t1 = performance.now();
  while (performance.now() - t1 < 1800);
  correrCuadros(30);
  // ...y la SACUDIDA se apago sola. El mundo esta congelado (el lazo dibuja
  // con dtSeg 0), asi que restarle el tiempo del mundo la dejaba temblando
  // para siempre y el temblor se arrastraba hasta el menu.
  const tr = transformes[transformes.length - 1];
  exigir(tr && Math.abs(tr[4]) < 0.01 && Math.abs(tr[5]) < 0.01,
    'la camara sigue temblando con el mundo congelado: ' + JSON.stringify(tr));
  exigir(dijo('OTRA VEZ'), 'la muerte no ofrecio volver a intentar');
  exigir(dijo('◀  Menú'), 'la muerte no ofrecio la salida al menu');
  const veces = textos.filter(t => t.includes('OTRA VEZ')).length;
  textos.length = 0;
  correrCuadros(400);                 // y no se va solo: sigue ahi
  exigir(dijo('OTRA VEZ'), 'el informe de muerte se fue solo');
  exigir(veces > 0, 'el informe de muerte no llego a dibujarse');
  // ...y ESC sale al menu sin tener que morirse otra vez
  disparar('keydown', { key: 'Escape', code: 'Escape', preventDefault () {}, repeat: false });
  textos.length = 0;
  correrCuadros(5);
  exigir(dijo('ELEGÍ TU CANCIÓN'), 'ESC tras morir no vuelve al menu');
});

// EL MUNDO CONTRA EL RELOJ DEL AUDIO. La musica se agenda contra ac.currentTime
// y el mundo avanzaba integrando cuadros (performance.now): dos relojes de
// hardware distintos, que no estan sincronizados. Una deriva de 0.3% --normal
// entre la placa de sonido y el sistema-- son mas de 0.2 tiempos de desfase en
// 45 segundos, creciendo, y no lo ve NINGUNA otra prueba porque no se dibuja.
probar('el mundo no se despega del reloj del audio', () => {
  derivaAudio = 1.003;                 // el audio corre 0.3% mas rapido
  // con red y sin tocar nada: la esfera rueda, no muere y no reinicia, asi que
  // lo unico que puede separar al mundo del audio es la deriva
  if (!dijoModoFacil()) disparar('keydown', { key: 'f', code: 'KeyF', preventDefault () {}, repeat: false });
  disparar('keydown', { key: '1', code: 'Digit1', preventDefault () {}, repeat: false });
  correrCuadros(40);
  let peor = 0, tomas = 0;
  for (let i = 0; i < 40; i++) {
    correrCuadros(50);
    const d = globalThis.__dribleDiag();
    if (d.b < 1 || d.x <= 0) continue;          // todavia no arranco
    tomas++;
    peor = Math.max(peor, Math.abs(d.b - d.x));
  }
  derivaAudio = 1;
  exigir(tomas > 20, `no se pudo medir: solo ${tomas} tomas`);
  exigir(peor < 0.05, `el mundo se corrio ${peor.toFixed(3)} tiempos del audio`);
});

// EL MODO DEBUG. Es un calco encima del juego, y su unico deber es no romper
// nada: se dibuja sobre CADA nota de la cancion --silencios, rieles, la primera
// y la ultima-- y cualquier vecina que no exista o cualquier zona vacia lo
// tiraria abajo. Como se prende con una tecla y no lo toca ninguna otra prueba,
// se rompe en silencio y aparece justo cuando hace falta: reportando un bug.
const ctrl = (key, code) => disparar('keydown',
  { key, code, ctrlKey: true, preventDefault () {}, repeat: false });
// F2 va SIN modificador: si alguien la vuelve a atar a Ctrl+algo, el atajo se lo
// come el navegador y el modo debug deja de existir sin que falle nada
const efeDos = () => disparar('keydown',
  { key: 'F2', code: 'F2', preventDefault () {}, repeat: false });

probar('el modo debug rotula la cancion entera sin romper nada', () => {
  // hasta el menu de verdad y de ahi a EL VIAJE: es la cancion con tunel,
  // pistones, viento y agua, o sea donde el calco tiene algo que decir
  disparar('keydown', { key: 'Escape', code: 'Escape', preventDefault () {}, repeat: false });
  correrCuadros(3);
  disparar('keydown', { key: 'm', code: 'KeyM', preventDefault () {}, repeat: false });
  correrCuadros(5);
  exigir(dijo('ELEGÍ TU CANCIÓN'), 'no se llego al menu para elegir el viaje');
  disparar('keydown', { key: '2', code: 'Digit2', preventDefault () {}, repeat: false });
  correrCuadros(20);
  // el volcado a consola es parte del copiado; aca solo estorba
  const log = console.log; console.log = () => {};
  try { probarDebug(); } finally { console.log = log; }
});

function probarDebug () {
  efeDos();
  correrCuadros(6);
  exigir(dijo('Ctrl+C copia'), 'el modo debug no dibujo su panel');
  // toda la cancion: se salta de seccion en seccion para pasar por los tramos
  // raros (tunel, pistones, el silencio largo, la vuelta final)
  for (let i = 0; i < 14; i++) {
    disparar('keydown', { key: 'ArrowRight', preventDefault () {}, repeat: false });
    correrCuadros(25);
    disparar('pointermove', { offsetX: 400 + i * 20, offsetY: 300 + i * 9 });
    correrCuadros(4);
    ctrl('c', 'KeyC');            // copiar en cualquier punto, con y sin raton encima
    correrCuadros(2);
  }
  exigir(dijo('·c'), 'ningun codigo de nota llego a la pantalla');
  exigir(dijo('AMANECER') || dijo('VUELO') || dijo('MOTOR'),
    'ninguna seccion del viaje se rotulo');
}

probar('el modo debug se apaga y no deja rastro', () => {
  efeDos();
  correrCuadros(3);
  textos.length = 0;
  correrCuadros(8);
  exigir(!dijo('Ctrl+C copia'), 'el panel del debug siguio dibujandose apagado');
  exigir(dijo('Intento'), 'apagar el debug se llevo puesto el HUD');
  exigir(localStorage.getItem('drible:debug') === '0', 'el modo debug no recordo que quedo apagado');
});

console.log(fallas ? `\n${fallas} FALLAS` : '\nsin fallas');
process.exit(fallas ? 1 : 0);
