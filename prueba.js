// El nivel se compila desde la cancion, asi que las pruebas validan DOS cosas:
// que la partitura este bien escrita (compases de 4, saltos alcanzables) y que
// el nivel resultante se pueda tocar entero con los verbos que promete.
//
// Corre la suite entera UNA VEZ POR CANCION: las dos tienen que ser jugables
// con las mismas manos. Lo que cambia por cancion son los rasgos del mapa
// (Aurora tiene carreras de semicorcheas y un silencio con techo; esfera no),
// y eso va en `RASGOS`, no en tests copiados.
//
//   node prueba.js

import {
  crearSim, paso, tocar, soltar, vueloMinimo, elegirCancion, NIVELES,
  CANCION, NOTAS, TOTAL_NOTAS, LARGO, HUECOS, TECHOS, SUELTA, PISO, G, SPB, BPM, enArpegio, ORBES, PISTONES, ZONAS_PISTON, Y_GRAVE, HOLGURA,
  TRAMOS_RODAR, mandaRodar, RANGOS, rango, UMBRAL, AFINADO, PERFECTO, ROCE,
  auditar, codigoDe, primeraNotaDe, SECCIONES, CARGA
} from './juego.js';

// de milisegundos a tiempos: las manos hablan en ms, la simulacion en beats
const enBeats = ms => ms / 1000 / SPB;

const DT = 1 / 240;

// Que figuras tiene cada mapa. No son umbrales de calidad: son la partitura.
// `exigente`: si el mapa tiene que hacerle perder alguna nota a una mano de
// +-90 ms. Aurora si; esfera NO -- a 100 BPM en negras el margen nunca muerde,
// y que eso pase es justamente el dato que este nivel existe para medir.
const RASGOS = {
  esfera: { escaleras: false, ligaduras: 0, huecos: 1, techos: 0, saltos: 30, exigente: false },
  // El viaje es la cancion ENTERA del estudio: 64 compases y 139 s. Sin techos:
  // NEBULOSA dejo de tener silencios de cuatro tiempos (eran los unicos), asi
  // que ya no hay ningun tramo donde haga falta rodar por la red -- que es
  // exactamente lo que hace que "caer mata" valga en todo el recorrido. El
  // motor es zona de dribleo (ahi se JUEGA).
  viaje: { escaleras: true, ligaduras: 2, huecos: 20, techos: 0, saltos: 30, exigente: true, orbes: 120, pistones: 8 }
};

let fallas = 0;

function correr (id) {
  elegirCancion(id);
  const R = RASGOS[id];

  function jugar (mano, opts) {
    const s = crearSim(opts);
    for (let b = 0; b < LARGO + 2 && s.viva && !s.meta; b += DT) {
      mano(s, b);
      paso(s, DT);
    }
    return s;
  }

  // Caerse a la red se resuelve TOCANDO (no hay trampolines automaticos):
  // toda mano razonable lo hace, salvo cerca de un techo, donde se espera.
  const rescata = (s, b) => {
    if (s.estado !== 'apoyada' || s.tecla >= 0) return false;
    if (s.x - s.ultimoToque < 0.35) return true;
    if (TECHOS.some(t => s.x > t.x0 - 0.8 && s.x < t.x1)) return true;
    tocar(s, b);
    return true;
  };

  // la mano perfecta: toca cada tecla apenas la pisa, sostiene los rieles,
  // y sobre un riel sonado da el saltito para cosechar los orbes de arriba
  const perfecta = (s, b) => {
    if (rescata(s, b)) return;
    const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
    s.sostiene = !!(k && k.riel);
    // el saltito del riel con el gesto REAL de un boton: soltar un frame y
    // volver a tocar (la gracia de repique tiene que aguantar ese hueco)
    // solo por los orbes que estan SOBRE este riel: los del arco de salida no
    // se cosechan saltando, se cosechan volando
    if (k && k.riel && s.tocadas.has(k.i) && s.x < k.x1 - 1.05 &&
        ORBES.some(o => !s.orbesTocados.has(o.i) && o.y > k.y + 0.05 &&
          o.x < k.x1 - 0.5 && o.x - s.x > 0.46 && o.x - s.x < 0.54)) {
      if (!s.repicando) { s.sostiene = false; soltar(s); s.repicando = true; return; }
      s.repicando = false; s.sostiene = true; tocar(s, b); return;
    }
    if (k && !k.riel && !k.silencio && s.x >= k.xm && !s.tocadas.has(k.i)) tocar(s, b);
  };

  // la mano muerta: nunca toca nada
  const muerta = () => {};

  // la mano terca: juega bien pero no aguanta el silencio y toca bajo el techo
  const T0 = TECHOS[0];
  const terca = (s, b) => { perfecta(s, b); if (T0 && s.x > T0.x0 + 0.3 && s.x < T0.x1 - 0.3) tocar(s, b); };

  // la mano floja: juega bien pero suelta el riel justo sobre el abismo
  const floja = (s, b) => {
    if (rescata(s, b)) return;
    const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
    s.sostiene = !!(k && k.riel) && !HUECOS.some(h => s.x > h.x0 && s.x < h.x1);
    if (k && !k.riel && !k.silencio && s.x >= k.xm && !s.tocadas.has(k.i)) tocar(s, b);
  };

  // la mano humana: apunta a cada nota con un error de +-90 ms, muchas veces
  // tocando en el aire antes de posarse. Es la que decide si el juego es jugable.
  function humana (amplitud) {
    const objetivos = NOTAS.filter(k => !k.silencio && !k.riel)
      .map((k, n) => k.xm + (((n * 7919) % 31) / 30 - 0.5) * 2 * amplitud);
    let j = 0;
    return (s, b) => {
      if (rescata(s, b)) return;
      const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
      s.sostiene = !!(k && k.riel);
      while (j < objetivos.length && s.x >= objetivos[j]) { tocar(s, b); j++; }
    };
  }

  // el principiante todavia no siente el mapa: toca sistematicamente corrido
  const corrida = ms => {
    const objetivos = NOTAS.filter(k => !k.silencio && !k.riel).map(k => k.xm + enBeats(ms));
    let j = 0;
    return (s, b) => {
      if (rescata(s, b)) return;
      const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
      s.sostiene = !!(k && k.riel);
      while (j < objetivos.length && s.x >= objetivos[j]) { tocar(s, b); j++; }
    };
  };

  // la mano que suelta el riel antes de tiempo para poder apretar de nuevo:
  // es el gesto natural para atacar la nota que sigue, y no puede matarte.
  const prepara = (s, b) => {
    if (rescata(s, b)) return;
    const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
    const suelta = k && k.riel && s.x > k.x1 - SUELTA + 0.05;
    if (suelta && s.sostiene) soltar(s);
    else s.sostiene = !!(k && k.riel) && !suelta;
    if (k && !k.riel && !k.silencio && s.x >= k.xm && !s.tocadas.has(k.i)) tocar(s, b);
  };

  // el tramposo: martilla el boton sin mirar el ritmo (sostiene los rieles, que es
  // lo unico que no se puede martillar). Si esto saca buen puntaje, el juego no es
  // un juego de ritmo: es un boton que se aprieta rapido.
  function martillo (cada) {
    let ultimo = -Infinity;
    return (s, b) => {
      const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
      s.sostiene = !!(k && k.riel);
      if (s.x - ultimo >= cada) { ultimo = s.x; tocar(s, b); }
    };
  }

  // la mano que tropieza: juega perfecto salvo UNA nota que deja pasar, cae a
  // la red, y toca para reengancharse. Mide que un error cueste esa nota y no
  // el tramo entero hasta el rescate.
  const SALTEADA = NOTAS.filter(k => !k.silencio && !k.riel && !k.escalera && !k.porCaida)[2].i;
  const tropieza = (s, b) => {
    const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
    s.sostiene = !!(k && k.riel);
    if (rescata(s, b)) return;
    if (k && !k.riel && !k.silencio && s.x >= k.xm && !s.tocadas.has(k.i) && k.i !== SALTEADA)
      tocar(s, b);
  };

  // la mano que va por el piso: falla la tecla anterior al primer piston y se
  // queda rodando hasta que el caño la agarre
  const porElPiso = (s, b) => {
    if (PISTONES.length) {
      const clave = NOTAS.filter(n => !n.silencio && n.xm < PISTONES[0].x).pop();
      if (s.estado === 'apoyada' && s.tecla === clave.i) { s.sostiene = false; return; }
      if (s.estado === 'apoyada' && s.tecla < 0 && s.x < PISTONES[0].x1) return;
    }
    perfecta(s, b);
  };

  // la mano que falla JUSTO antes del abismo: deja pasar cada tecla que entra a
  // un riel con vacio debajo. Desde ahi sale del borde con vy=0 y cae -- y
  // tiene que alcanzar a tocar la red ANTES de que empiece el hueco. Si no, es
  // muerte sin salida: en el aire el boton no responde (el coyote vence mucho
  // antes) y el riel queda MAS ARRIBA, asi que la esfera le pasa por debajo.
  // Un fallo costaba la corrida entera en vez de la nota, que es exactamente
  // lo que este juego promete que no pasa.
  // (solo teclas de MELODIA: si la anterior es a su vez un riel con abismo,
  // soltarla es el otro pecado --el que SI mata-- y lo mide la mano floja)
  //
  // Se prueban las teclas que dan a un peligro: la que entra a un riel con
  // vacio debajo, y la que entra a un silencio con techo (ahi el saltito de
  // rescate dura un tiempo entero y te deposita justo abajo del techo). Barrer
  // las 277 notas una por una encuentra lo mismo y tarda 17 s: se corre a mano
  // cuando se toca el motor, no en cada cambio de la partitura.
  const ANTES_DEL_HUECO = new Set([
    ...HUECOS.map(h => NOTAS.find(n => n.riel && h.x0 >= n.x0 - 0.01 && h.x1 <= n.x1 + 0.01)),
    ...NOTAS.filter(n => n.silencio && !n.piso && TECHOS.some(t => t.x0 > n.x0 && t.x0 < n.x0 + n.dur))
  ].filter(n => n && n.i > 0 && !NOTAS[n.i - 1].silencio && !NOTAS[n.i - 1].riel)
    .map(n => n.i - 1));
  const alBorde = (s, b) => {
    const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
    if (k && ANTES_DEL_HUECO.has(k.i)) { s.sostiene = false; return; }
    perfecta(s, b);
  };

  // la mano que ATACA EL BAJO: toca toda tecla que no sea riel ni ligadura de
  // la melodia -- incluidas las de bajo, que es lo natural (son otro
  // instrumento, y un instrumento que entra siempre entra atacando). Si el
  // mapa liga hacia una tecla de bajo, este toque no corresponde: se va a la
  // cola, se paga contra la nota siguiente y desalinea el resto del tramo.
  const atacaElBajo = (s, b) => {
    if (rescata(s, b)) return;
    const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
    s.sostiene = !!(k && k.riel);
    if (k && !k.riel && !k.silencio && !(k.porCaida && !k.bajo) &&
        s.x >= k.xm && !s.tocadas.has(k.i)) tocar(s, b);
  };

  // LA MANO QUE CARGA: juega perfecto y ademas gasta un toque en cada caño,
  // desplazado `dev` respecto del paso del caño en la grilla. Con dev 0 es el
  // gesto ideal; con +-CARGA, el borde exacto de la ventana.
  const cargadora = dev => {
    const pend = PISTONES.map(p => p.x + dev);
    let j = 0;
    return (s, b) => {
      if (rescata(s, b)) return;
      const k = s.estado === 'apoyada' && s.tecla >= 0 ? NOTAS[s.tecla] : null;
      s.sostiene = !!(k && k.riel);
      if (k && !k.riel && !k.silencio && s.x >= k.xm && !s.tocadas.has(k.i)) tocar(s, b);
      while (j < pend.length && s.x >= pend[j]) { tocar(s, b); j++; }
    };
  };

  // LA VENTANA DEL CAÑO. Se toca la tecla anfitriona corrida justo lo que el
  // juego todavia llama CLAVADA, para los dos lados, y se exige que la esfera
  // igual le caiga encima al caño. Si el caño pidiera mas precision que una
  // clavada, el juego estaria celebrando PERFECTO y negando el premio en el
  // mismo instante -- que es exactamente lo que pasaba.
  const ventanaCaños = () => PISTONES.map(p => {
    const k = NOTAS.filter(n => !n.silencio && n.xm < p.x).pop();
    if (!k) return { p, ok: false };
    const modos = [-1, 1].map(signo => {
      const s = crearSim();
      s.x = k.x0; s.estado = 'apoyada'; s.tecla = k.i; s.y = k.y; s.saliendoDe = -1;
      let toco = false, modo = null;
      for (let i = 0; i < 4000 && s.viva && s.x < p.x1 + 0.5; i++) {
        if (!toco && s.x >= k.xm + signo * AFINADO * PERFECTO) { tocar(s, s.x); toco = true; }
        paso(s, DT);
        for (const e of s.eventos) if (e.tipo === 'piston' && Math.abs(e.x - p.x) < 0.3) modo = e.modo;
        s.eventos.length = 0;
      }
      return modo;
    });
    return { p, ok: modos.every(m => m === 'encima'), modos };
  });
  const ventanas = R.pistones ? ventanaCaños() : [];

  // Pone la esfera dentro de la ventana del primer caño, a media altura de
  // roce, y pregunta si el vastago la agarra. `aire` es el vuelo legitimo
  // entre dos teclas bajas; `rodando`, el que se cayo y viene por la red.
  const vastago = como => {
    const p = PISTONES[0];
    if (!p) return false;
    const s = crearSim();
    s.x = p.x0 + 0.01; s.tecla = -1; s.saliendoDe = -1;
    if (como === 'aire') { s.estado = 'aire'; s.y = ROCE * 0.5; s.vy = 0.35; }
    else { s.estado = 'apoyada'; s.y = 0; s.vy = 0; }
    for (let i = 0; i < 12 && s.viva; i++) paso(s, DT);
    return s.eventos.some(e => e.tipo === 'piston' && e.modo === 'abajo');
  };

  const rp = jugar(perfecta);
  const rSinRed = jugar(perfecta, { sinRed: true });     // el concierto sin red
  const rMuertaSR = jugar(muerta, { sinRed: true });     // ...y el que no toca
  const rBorde = jugar(alBorde);
  const rBajo = jugar(atacaElBajo);
  const rz = jugar(tropieza);
  const rPiso = R.pistones ? jugar(porElPiso) : null;
  // el gesto ideal, los dos bordes de la ventana, y justo afuera
  const rCarga = R.pistones ? jugar(cargadora(0)) : null;
  const rCargaAnt = R.pistones ? jugar(cargadora(-CARGA * 0.95)) : null;
  const rCargaAtr = R.pistones ? jugar(cargadora(CARGA * 0.95)) : null;
  const rCargaLejos = R.pistones ? jugar(cargadora(CARGA * 1.8)) : null;
  const rSpam = jugar(martillo(0.04));
  const rSpam2 = jugar(martillo(0.12));
  const rPrep = jugar(prepara);
  const rh = jugar(humana(enBeats(90)));   // +-90 ms
  const rAd = jugar(corrida(-150));  // siempre adelantado
  const rAt = jugar(corrida(150));   // siempre atrasado
  const rm = jugar(muerta);
  const rt = jugar(terca);
  const rf = jugar(floja);

  // --- la partitura ------------------------------------------------------------

  const compasesMal = CANCION.map((c, i) => [i, c.trim().split(/\s+/)
    .reduce((a, t) => a + parseFloat(t.split(':')[1]), 0)]).filter(([, n]) => Math.abs(n - 4) > 1e-9);

  const saltos = NOTAS.filter(k => !k.silencio && !k.escalera && !k.riel);
  const estrechas = saltos.filter(k => k.x1 - k.x0 < 0.09);
  const solapadas = NOTAS.filter((k, i) => NOTAS[i + 1] && k.x1 > NOTAS[i + 1].x0 + 1e-9);

  // Desde el toque MAS TARDE de cada tecla hay que poder aterrizar dentro de la
  // que sigue, cayendo. Si no, la esfera la atraviesa por abajo y la nota no
  // existe: no alcanza con que la ventana sea ancha.
  const inalcanzables = saltos.filter(k => {
    const sig = NOTAS[k.i + 1];
    if (!sig || sig.silencio) return false;
    return k.x1 + vueloMinimo(sig.y - k.y) > sig.x1 - 0.05 + 1e-9;
  });

  // Y tocando EN EL PULSO hay que aterrizar ANTES del pulso siguiente. Si el
  // vuelo te deja llegando despues, la nota que sigue no se puede tocar a
  // tiempo por mucho que se afine la mano: nace chueca, y si te pasas de la
  // ventana el motor la da por perdida (lanzar() la saltea para no arrastrarte
  // corrido el resto del tramo). Desde afuera eso se ve como "esa tecla no
  // suena, o es imposible" -- que es exactamente lo que pasaba al salir de un
  // build: subir de la banda del bajo a la melodia pide 0.83 tiempos y la
  // partitura da media negra. Los rieles no cuentan: su borde ES su salida.
  const apretadas = saltos.filter(k => {
    const sig = NOTAS[k.i + 1];
    if (!sig || sig.silencio) return false;
    return sig.xm - k.xm - vueloMinimo(sig.y - k.y) < 0.05 - 1e-9;
  });

  const malCentradas = NOTAS.filter(k => !k.silencio &&
    (k.xm <= k.x0 + 0.03 || k.xm >= k.x1 - 0.03));
  // las que se entran rodando (carreras, y la que sigue a una) no aterrizan: no
  // necesitan tramo de rodada porque nunca dejaron de rodar
  const sinRodada = NOTAS.filter(k => !k.silencio && !k.escalera &&
    !(NOTAS[k.i - 1] && NOTAS[k.i - 1].dur <= 0.25));

  const ligadas = NOTAS.filter(k => k.porCaida);
  let cruzados = [];

  const pruebas = [
    ['cada compas suma exactamente 4 tiempos', !compasesMal.length,
      compasesMal.map(([i, n]) => `c${i}=${n}`).join(' ')],
    ['ninguna tecla se solapa con la siguiente', !solapadas.length,
      solapadas.map(k => k.nombre + '@' + k.b).join(' ')],
    ['toda ventana de salto es jugable (>= 0.09 tiempos)', !estrechas.length,
      estrechas.map(k => `${k.nombre}@${k.b}:${(k.x1 - k.x0).toFixed(3)}`).join(' ')],
    ['todo salto llega cayendo a la tecla siguiente', !inalcanzables.length,
      inalcanzables.map(k => k.nombre + '@' + k.b).join(' ')],
    ['...y tocando en el pulso se aterriza antes del pulso siguiente',
      !apretadas.length,
      apretadas.map(k => `${k.nombre}${k.bajo ? '!' : ''}@${k.b} (${(NOTAS[k.i + 1].xm - k.xm - vueloMinimo(NOTAS[k.i + 1].y - k.y)).toFixed(3)})`).join(' ')],
    // El punto afinado no puede caer en el canto de la plataforma: ahi aterrizar
    // y golpear son el mismo instante, y eso no es tocar, es adivinar.
    ['el punto exacto cae adentro de la plataforma, no en el canto',
      !malCentradas.length, malCentradas.map(k => `${k.nombre}@${k.b}`).join(' ')],
    ['hay tramo para rodar antes de golpear', sinRodada.every(k => k.xm - k.x0 >= 0.12),
      `${Math.min(...sinRodada.map(k => k.xm - k.x0)).toFixed(3)} el mas corto`],
    ['las ligaduras que pide la partitura estan', ligadas.length >= R.ligaduras,
      ligadas.map(k => k.nombre + '@' + k.b).join(' ') || 'ninguna'],
    ['toda ligadura tiene ventana para atacar la primera nota',
      NOTAS.filter(k => k.ligada).every(k => k.x1 - k.x0 >= 0.14), ''],
    // Ligar es NO volver a atacar, y eso es un idioma de la melodia. Cambiar de
    // instrumento siempre es un ataque: en el estudio el bajo toca esas notas
    // con su propio golpe. Ligar hacia una tecla de bajo dejaba la ultima verde
    // de cada compas del VUELO como "no se toca", el jugador la tocaba igual
    // --es lo natural-- y ese toque de mas se pagaba contra la nota siguiente:
    // 234 de 277 limpias jugando a tiempo, contra 277 sin la ligadura cruzada.
    ['ninguna ligadura cruza de instrumento: el bajo siempre se ataca',
      NOTAS.every(k => !k.porCaida || !NOTAS[k.i - 1] || !NOTAS[k.i - 1].bajo === !k.bajo),
      NOTAS.filter(k => k.porCaida && NOTAS[k.i - 1] && !NOTAS[k.i - 1].bajo !== !k.bajo)
        .map(k => k.nombre + '@' + k.b).join(' ')],
    ['...y atacar el bajo sale limpio, que es lo que el jugador va a hacer',
      rBajo.limpias.size === TOTAL_NOTAS && rBajo.falsos === 0,
      `${rBajo.limpias.size}/${TOTAL_NOTAS} limpias · ${rBajo.falsos} en falso`],
    ['una ligadura NO suena si no sonaste la nota de la que cuelga',
      ligadas.every(k => !rm.tocadas.has(k.i)), ''],
    ['hay rieles y saltos; carreras si la partitura las pide',
      NOTAS.some(k => k.riel) && saltos.length > R.saltos &&
      (!R.escaleras || NOTAS.some(k => k.escalera)),
      `rieles ${NOTAS.filter(k => k.riel).length} · escalones ${NOTAS.filter(k => k.escalera).length} · saltos ${saltos.length}`],
    // Las dos bandas existen para que se vea de un vistazo que son DOS
    // instrumentos. Pero la altura de una tecla de bajo es del mapa, y el mapa
    // la usa: la cuesta del build y la rampa de salida las levantan a proposito
    // --sin la rampa el salto al drop es fisicamente imposible-- y en un build
    // no hay melodia con la cual confundirlas. Asi que lo que se exige no es
    // "siempre abajo de tal altura", que seria falso, sino lo unico que importa:
    // DONDE CONVIVEN, el bajo va por debajo. Ese es el zigzag del verso.
    ['donde melodia y bajo comparten compas, el bajo va por debajo',
      (() => {
        const porCompas = new Map();
        for (const k of NOTAS) {
          if (k.silencio) continue;
          const c = Math.floor(k.b / 4);
          if (!porCompas.has(c)) porCompas.set(c, { bajo: [], mel: [] });
          porCompas.get(c)[k.bajo ? 'bajo' : 'mel'].push(k.y);
        }
        cruzados = [...porCompas].filter(([, g]) => g.bajo.length && g.mel.length &&
          Math.max(...g.bajo) >= Math.min(...g.mel)).map(([c]) => 'c' + c);
        return !cruzados.length;
      })(),
      cruzados.length ? cruzados.join(' ') : `${NOTAS.filter(k => k.bajo).length} teclas de bajo`],
    ['el mapa sube y baja de verdad (rango > medio octava)',
      Math.max(...NOTAS.filter(k => !k.silencio).map(k => k.y)) -
      Math.min(...NOTAS.filter(k => !k.silencio).map(k => k.y)) > 0.15, ''],

    // EL AUDITOR, QUE ES EL MISMO QUE VE EL JUGADOR. `auditar()` es lo que el
    // modo debug pinta sobre el mapa; exigirlo aca ata las dos puntas: lo que
    // corta el build y lo que se ve en pantalla no pueden decir cosas distintas.
    // Y da el codigo de la nota, asi que la falla se abre en `compases` sin
    // buscar: no dice "hay un salto imposible", dice cual.
    ['el auditor no encuentra nada GRAVE (lo mismo que marca el modo debug)',
      !auditar().filter(a => a.grave).length,
      auditar().filter(a => a.grave).map(a => `${codigoDe(NOTAS[a.i])} ${a.tipo}: ${a.txt}`)
        .join(' · ') ||
        `${auditar().filter(a => !a.grave).length} avisos (saltos justos, nada roto)`],

    // ENSAYAR UNA SECCION EMPIEZA EN SU PRIMERA NOTA. Suena obvio y no lo era:
    // saltarA buscaba la primera nota con `x0 >= el beat de la seccion`, y `x0`
    // es donde arranca la TABLA, que empieza 0.22 antes del pulso. La nota que
    // cae justo EN el beat quedaba descartada por esos 0.22 y el salto entraba
    // con la nota de entrada ya perdida. Pasaba en 21 de 23 secciones, y en
    // AIRE (una redonda) se comia el compas entero. No lo veia nadie: el tramo
    // se juega igual, solo que empezado tarde.
    ['ensayar una seccion arranca en SU primera nota, no en la siguiente',
      SECCIONES.every(z => {
        const k = primeraNotaDe(z.x0);
        const antes = NOTAS.filter(n => !n.silencio && n.xm >= z.x0 && n.xm < k.xm);
        return !antes.length;
      }),
      SECCIONES.map(z => `${z.n}→${codigoDe(primeraNotaDe(z.x0))}`).join(' · ')],

    // --- el nivel se puede tocar ---------------------------------------------
    // se arranca arriba y el primer gesto es tocar una nota, no trepar desde la red
    ['se empieza en la plataforma de salida, no en la red',
      !!PISO && crearSim().y === PISO.y && crearSim().tecla === PISO.i,
      PISO ? `y ${PISO.y.toFixed(3)} hasta x ${PISO.x1.toFixed(2)}` : 'no hay salida'],
    ['la salida esta a la altura de la primera nota y la lanza a ella',
      !!PISO && PISO.y === NOTAS[PISO.i + 1].y && PISO.x1 < NOTAS[PISO.i + 1].x0, ''],
    ['la mano perfecta llega a la meta', rp.meta,
      `x ${rp.x.toFixed(2)} causa ${rp.causa || '-'}`],
    ['...y suena la melodia COMPLETA', rp.tocadas.size === TOTAL_NOTAS,
      `${rp.tocadas.size}/${TOTAL_NOTAS}`],
    ['...y le sale TODA limpia: tocar bien tiene que sonar bien',
      rp.limpias.size === TOTAL_NOTAS, `${rp.limpias.size}/${TOTAL_NOTAS} limpias`],

    // --- no se puede hacer trampa martillando ---------------------------------
    ['martillar el boton no saca puntaje (rapido)',
      rSpam.limpias.size <= TOTAL_NOTAS * 0.45,
      `${rSpam.limpias.size}/${TOTAL_NOTAS} limpias · ${rSpam.tocadas.size} sonadas · ${rSpam.falsos} en falso`],
    ['martillar el boton no saca puntaje (a media velocidad)',
      rSpam2.limpias.size <= TOTAL_NOTAS * 0.45,
      `${rSpam2.limpias.size}/${TOTAL_NOTAS} limpias · ${rSpam2.tocadas.size} sonadas · ${rSpam2.falsos} en falso`],
    ['...y la mano perfecta nunca toca en falso', rp.falsos === 0, `${rp.falsos}`],
    ['una mano humana (+-90 ms) llega a la meta', rh.meta,
      `x ${rh.x.toFixed(2)} causa ${rh.causa || '-'}`],
    ['...y suena al menos 9 de cada 10 notas', rh.tocadas.size >= TOTAL_NOTAS * 0.9,
      `${rh.tocadas.size}/${TOTAL_NOTAS}`],
    // Donde hay PISTONES anticiparse cuesta notas -- esa es su razon de ser --
    // pero ni ahi puede costar la corrida entera.
    ['adelantarse 150 ms en TODO sigue sonando la melodia',
      rAd.meta && rAd.tocadas.size >= (R.pistones ? TOTAL_NOTAS * 0.92 : TOTAL_NOTAS),
      `${rAd.tocadas.size}/${TOTAL_NOTAS} ${rAd.meta ? 'meta' : 'murio en ' + rAd.x.toFixed(1)}`],
    // ...pero suena chueca: la nota no se calla nunca, se ensucia. Asi el oido
    // avisa que vas corrido sin que haya que mirar el HUD.
    ['...pero corrido 150 ms suena chueco casi siempre',
      rAd.limpias.size <= TOTAL_NOTAS * 0.35, `${rAd.limpias.size}/${TOTAL_NOTAS} limpias`],
    ['una mano humana afina la mayoria' + (R.exigente ? ', no todas' : ''),
      rh.limpias.size >= TOTAL_NOTAS * 0.4 && (!R.exigente || rh.limpias.size < TOTAL_NOTAS),
      `${rh.limpias.size}/${TOTAL_NOTAS} limpias`],
    // atrasado una semicorchea entera, la carrera se corta antes de terminarla:
    // eso es correcto, es lo que pasa en un instrumento. No mas de una por carrera.
    ['atrasarse 150 ms cuesta a lo sumo el final de cada carrera',
      rAt.meta && rAt.tocadas.size >= TOTAL_NOTAS - 2 - NOTAS.filter(k => k.escalera).length,
      `${rAt.tocadas.size}/${TOTAL_NOTAS} ${rAt.meta ? 'meta' : 'murio en ' + rAt.x.toFixed(1)}`],
    ['soltar el riel sobre el final para poder saltar NO te tira',
      rPrep.meta && rPrep.tocadas.size === TOTAL_NOTAS,
      `${rPrep.tocadas.size}/${TOTAL_NOTAS} ${rPrep.meta ? 'meta' : 'murio en ' + rPrep.x.toFixed(1) + ' ' + rPrep.causa}`],
    ['todo riel tiene tramo de suelta usable', NOTAS.filter(k => k.riel)
      .every(k => k.x1 - k.x0 > SUELTA + 0.2), ''],
    ['no tocar nada no suena ninguna nota', rm.tocadas.size === 0,
      `${rm.tocadas.size} notas, x ${rm.x.toFixed(2)}`],
    ['tocar de mas mata bajo el techo del silencio',
      !R.techos || (!rt.viva && rt.causa === 'techo'),
      T0 ? `x ${rt.x.toFixed(2)} causa ${rt.causa || 'sigue viva'}` : 'sin techos: no aplica'],
    ['fallar la nota anterior a un peligro NO mata: se toca la red o se rueda',
      rBorde.viva && rBorde.meta,
      `${ANTES_DEL_HUECO.size} bordes probados · ${rBorde.meta ? 'meta' : 'murio en ' + rBorde.x.toFixed(1) + ' ' + rBorde.causa}`],
    // y la version estructural, que no depende de que una mano dé con el caso
    ['ningun abismo empieza antes de que la caida alcance la red',
      HUECOS.every(h => {
        const riel = NOTAS.find(n => n.riel && h.x0 >= n.x0 - 0.01 && h.x1 <= n.x1 + 0.01);
        const ant = riel && NOTAS[riel.i - 1];
        return !ant || ant.silencio || ant.x1 + Math.sqrt(2 * ant.y / G) <= h.x0 + 1e-9;
      }), ''],
    ['soltar el riel sobre el abismo mata',
      !rf.viva && rf.causa === 'hueco' && HUECOS.some(h => rf.x > h.x0 && rf.x < h.x1 + 1),
      `x ${rf.x.toFixed(2)} causa ${rf.causa || 'sigue viva'}`],
    // el terreno se deduce de la partitura: cambiar la melodia no puede dejar un
    // abismo debajo de una nota que se toca saltando
    // los abismos viven bajo un riel (soltar mata) o entre los pads de una
    // zona de dribleo (no picar mata): nunca sueltos en el medio de la nada
    ['todo abismo cae bajo un riel o entre pads de dribleo', HUECOS.length >= R.huecos &&
      HUECOS.every(h => enArpegio((h.x0 + h.x1) / 2) ||
        NOTAS.some(n => n.riel && h.x0 >= n.x0 && h.x1 <= n.x1)),
      `${HUECOS.length} abismos`],
    ['el silencio largo lleva techo, y empieza tras tocar la red',
      TECHOS.length >= R.techos && TECHOS.every(t => {
        const n = NOTAS.find(k => k.silencio && !k.piso && t.x0 > k.x0 && t.x0 < k.x0 + k.dur);
        const ant = n && NOTAS[n.i - 1];
        return !ant || t.x0 >= n.x0 + Math.sqrt(2 * ant.y / G);
      }), `${TECHOS.length}`],
    // Un tropiezo no puede costar el tramo: desde la red, tocar te relanza a la
    // proxima tecla. Se pierden a lo sumo la salteada y sus dos vecinas.
    // La zona de dribleo del motor: picar al beat suena el arpegio y no rompe
    // nada -- la melodia de despues sale entera igual.
    // Los orbes son cuerpos: la mano fina los cosecha TODOS con el arco, y la
    // atrasada 150 ms vuela mas chato y pierde una parte real. El numero exacto
    // no es un objetivo de diseño --da 0.71 hoy y daba 0.69 ayer, y las dos
    // cosas significan lo mismo--; lo que se afirma es que llegar tarde cuesta
    // orbes, no que cueste una fraccion precisa.
    ['los orbes del arpegio se tocan con el cuerpo, y el arco fino los lleva',
      !R.orbes || (rp.orbes >= R.orbes && rAt.orbes < rp.orbes * 0.8),
      R.orbes ? `perfecta ${rp.orbes}/${ORBES.length} · atrasada ${rAt.orbes}` : 'sin orbes: no aplica'],
    // el evento de cosecha tiene que decir QUE instrumento suena: sin esto el
    // navegador recibia undefined y el orbe cosechado salia mudo
    ['todo orbe cosechado dice su instrumento',
      rp.eventos.filter(e => e.tipo === 'orbe').every(e => e.instr),
      `${rp.eventos.filter(e => e.tipo === 'orbe').length} cosechados`],
    // SOBRE UN RIEL NO HAY ORBES. El riel es la unica nota que se SOSTIENE, y
    // un orbe flotando encima pedia picar: dos ordenes opuestas al mismo dedo
    // en el mismo instante. La cosecha vive donde el dedo esta libre.
    ['ningun orbe flota sobre un riel: sostener y picar no se piden juntos',
      !ORBES.some(o => NOTAS.some(n => n.riel && !n.silencio && o.x > n.xm && o.x < n.x1)),
      `${ORBES.length} orbes, ${NOTAS.filter(n => n.riel && !n.silencio).length} rieles`],
    // LOS PISTONES SE PISAN. La cabeza esta puesta sobre el arco del salto
    // tocado a tiempo, asi que acertar el ritmo ES caerle encima: el que toca
    // bien los cobra casi todos, el que va corrido se los pierde. Fallarlos no
    // castiga (pasas por arriba o por abajo y seguis), y pegarles tampoco puede
    // descolocarte: por eso nadie muere por un caño.
    // TODOS, no la mayoria: un caño que ni la mano perfecta puede pisar es un
    // caño impisable, y encima se lleva mudo un golpe del arreglo (lo reclama y
    // nadie lo toca nunca). Habia uno asi, con la cabeza en el lado que SUBE
    // del arco: la esfera le pasaba 0.0002 por debajo.
    ['los pistones se pisan: tocar a tiempo es caerles encima a TODOS',
      !R.pistones || (PISTONES.length >= R.pistones && rp.pistonazos === PISTONES.length),
      R.pistones ? `${PISTONES.length} caños · perfecta ${rp.pistonazos} · humana ${rh.pistonazos} · atrasada ${rAt.pistonazos}` : 'sin pistones: no aplica'],
    ['...y ninguna mano se muere por un piston',
      [rp, rh, rAt, rAd].every(r => r.meta),
      [rp, rh, rAt, rAd].map(r => r.meta ? 'meta' : 'murio ' + r.x.toFixed(0)).join(' · ')],
    ['...y al que va por el piso lo disparan de vuelta a la cancion',
      !R.pistones || (rPiso.pistonazos >= 1 && rPiso.viva && rPiso.meta),
      R.pistones ? `${rPiso.pistonazos} disparos · ${rPiso.meta ? 'meta' : 'murio en ' + rPiso.x.toFixed(1)}` : 'no aplica'],
    // el caño suena un golpe REAL del arreglo, como los orbes: sin eso es
    // decorado, que es de donde veniamos
    ['todo piston reclama un golpe de la bateria', PISTONES.every(p => p.instr), ''],
    // PISARLO TIENE QUE PAGAR. Era el unico acierto del juego que no movia
    // ningun numero: rozarlo costaba la racha y clavarlo no daba nada, asi que
    // la contabilidad del caño solo castigaba. Ahora suma racha como una nota
    // limpia -- y por eso la perfecta, que los pisa todos, termina con una
    // mejor racha MAYOR que la cantidad de notas.
    ['pisar un caño suma racha: acertarle mueve un numero',
      !R.pistones || rp.mejorRacha > TOTAL_NOTAS,
      R.pistones ? `mejor racha ${rp.mejorRacha} con ${TOTAL_NOTAS} notas + ${PISTONES.length} caños` : 'no aplica'],
    // LA CADENA. Pisotones seguidos sin dejar escapar ninguno: escala el
    // excedente musical de cada golpe. La perfecta no se saltea ninguno, asi
    // que su cadena tiene que llegar al total de caños.
    ['la cadena de caños cuenta los pisotones seguidos',
      !R.pistones || Math.max(0, ...rp.eventos.filter(e => e.tipo === 'piston' && e.modo === 'encima')
        .map(e => e.cadena || 0)) === PISTONES.length,
      R.pistones ? `cadena maxima ${Math.max(0, ...rp.eventos.filter(e => e.tipo === 'piston' && e.modo === 'encima').map(e => e.cadena || 0))} de ${PISTONES.length}` : 'no aplica'],
    // EL PLENO DE ZONA paga el cierre (fill + crash). Pisando todos, cada zona
    // declarada tiene que cerrar exactamente una vez: si ninguna cierra, el
    // premio grande es inalcanzable y la promesa del build es letra muerta.
    ['pisar todos los caños de una zona cierra el build, una vez por zona',
      !R.pistones || rp.eventos.filter(e => e.tipo === 'piston' && e.completa).length ===
        new Set(PISTONES.map(p => p.zona)).size,
      R.pistones ? `${rp.eventos.filter(e => e.tipo === 'piston' && e.completa).length} cierres · ${new Set(PISTONES.map(p => p.zona)).size} zonas con caños` : 'no aplica'],
    // ...y NO se regala: al que se saltea uno de la zona, esa zona no le cierra
    ['el que deja escapar un caño no cobra el cierre de esa zona',
      !R.pistones || rAt.eventos.filter(e => e.tipo === 'piston' && e.completa).length <
        new Set(PISTONES.map(p => p.zona)).size,
      R.pistones ? `atrasada: ${rAt.pistonazos}/${PISTONES.length} caños · ${rAt.eventos.filter(e => e.tipo === 'piston' && e.completa).length} cierres` : 'no aplica'],
    // CARGAR EL CAÑO: el toque de siempre dado sobre la cabeza. Tiene que
    // entrar en TODOS -- si el gesto solo funciona en algunos caños, el
    // jugador aprende que "a veces anda" y deja de intentarlo.
    ['cargar el caño entra en todos: es el toque de siempre sobre la cabeza',
      !R.pistones || rCarga.cargas === PISTONES.length,
      R.pistones ? `${rCarga.cargas}/${PISTONES.length} cargados` : 'no aplica'],
    // LA VENTANA ES SIMETRICA. Se mide contra p.x --donde el caño vive en la
    // grilla-- y no contra el contacto, que cae unas centesimas despues:
    // midiendo desde el contacto la ventana salia de -54 a +91 ms, o sea que
    // adelantarse castigaba mas que atrasarse sin que nada lo dijera.
    ['la ventana de carga vale igual adelantado que atrasado',
      !R.pistones || (rCargaAnt.cargas === PISTONES.length && rCargaAtr.cargas === PISTONES.length),
      R.pistones ? `adelantado ${rCargaAnt.cargas} · atrasado ${rCargaAtr.cargas} · ventana ±${(CARGA * SPB * 1000).toFixed(0)} ms` : 'no aplica'],
    // ...y fuera de la ventana NO se regala: si cargara igual, no seria un
    // premio por precision, seria un premio por apretar cerca
    ['fuera de la ventana el caño no se carga',
      !R.pistones || rCargaLejos.cargas === 0,
      R.pistones ? `${rCargaLejos.cargas} cargas a ±${(CARGA * 1.8 * SPB * 1000).toFixed(0)} ms` : 'no aplica'],
    // EL PREMIO NO PUEDE COSTAR UNA NOTA. Cargar gasta un toque de verdad, y
    // un toque gastado de mas es una nota que se cobra contra la tecla
    // equivocada. Si intentar el premio ensuciara la melodia, el juego estaria
    // castigando al que se anima -- que es lo contrario de lo que promete el
    // caño ("premio por precision, no trampa").
    ['cargar no cuesta ninguna nota: el premio no se paga con la melodia',
      !R.pistones || (rCarga.limpias.size === rp.limpias.size && rCarga.meta &&
        rCargaAnt.limpias.size === rp.limpias.size && rCargaAtr.limpias.size === rp.limpias.size),
      R.pistones ? `sin cargar ${rp.limpias.size} · cargando ${rCarga.limpias.size} · ant ${rCargaAnt.limpias.size} · atr ${rCargaAtr.limpias.size}` : 'no aplica'],
    // ...NI puede moverte de lugar. Cargar no toca la trayectoria a proposito:
    // la altura no se puede comprar (tres decimas de vuelo hasta la tecla
    // siguiente, y mas abajo), asi que falsearla seria correr el aterrizaje --
    // descolocar al jugador por haber acertado, que es justo lo que el caño
    // promete que nunca hace.
    ['cargar no cambia por donde vas: mismo aterrizaje que el pisoton simple',
      !R.pistones || (Math.abs(rCarga.x - rp.x) < 1e-6 && rCarga.pistonazos === rp.pistonazos),
      R.pistones ? `x ${rCarga.x.toFixed(3)} vs ${rp.x.toFixed(3)} · ${rCarga.pistonazos} vs ${rp.pistonazos} caños` : 'no aplica'],
    // EL PLENO CARGADO es el cierre grande, y hay que ir a buscarlo caño por
    // caño: pisarlos todos ya paga `completa`, cargarlos todos paga `plena`.
    // Si la zona cerrara plena sin cargar, el gesto no valdria nada.
    ['la zona cargada entera paga el cierre grande, y no se regala al que solo pisa',
      !R.pistones || (rCarga.eventos.filter(e => e.tipo === 'piston' && e.plena).length ===
        new Set(PISTONES.map(p => p.zona)).size &&
        rp.eventos.filter(e => e.tipo === 'piston' && e.plena).length === 0),
      R.pistones ? `cargando ${rCarga.eventos.filter(e => e.tipo === 'piston' && e.plena).length} plenas · solo pisando ${rp.eventos.filter(e => e.tipo === 'piston' && e.plena).length}` : 'no aplica'],
    // CARGAR NO ES PUNTAJE. El premio del caño cargado es que la cancion se
    // abra, y nada mas: el rango sigue subiendo por limpias, clavadas y orbes.
    // Tiene que ser asi porque la ventana de carga cae en la grilla de
    // semicorcheas, o sea que un tapping parejo y ciego pesca varias sin mirar
    // el ritmo (medido: tocando cada medio tiempo, 8 de 10 caños, con la
    // melodia hecha pedazos en 100/276). Mientras la carga no toque el
    // puntaje, ese jugador se cambio 176 notas por un platillo -- mal negocio,
    // y el juego no necesita defenderse de el.
    ['cargar no mueve el puntaje: el premio es que la cancion se abra',
      !R.pistones || (rCarga.perfectas.size === rp.perfectas.size &&
        rango(rCarga.limpias.size, TOTAL_NOTAS, rCarga.orbes, ORBES.length, rCarga.perfectas.size) ===
        rango(rp.limpias.size, TOTAL_NOTAS, rp.orbes, ORBES.length, rp.perfectas.size)),
      R.pistones ? `${rango(rp.limpias.size, TOTAL_NOTAS, rp.orbes, ORBES.length, rp.perfectas.size)} con y sin cargar · ${rCarga.perfectas.size} clavadas` : 'no aplica'],
    // El caño no puede pedir MAS precision que la que el juego premia: si
    // clavaste la nota, lo pisas. Con la cabeza puesta sobre el arco del toque
    // exacto, cualquier desvio levantaba el arco y la esfera pasaba por
    // encima -- PERFECTO en pantalla y el caño mudo.
    ['toda clavada pisa el caño: no pide mas precision que la que se premia',
      ventanas.every(v => v.ok),
      ventanas.filter(v => !v.ok).map(v => `${v.p.x}:[${v.modos}]`).join(' ') ||
        `${ventanas.length} caños, clavada ±${(AFINADO * PERFECTO * SPB * 1000).toFixed(0)} ms`],
    // El vastago es el rescate del que RUEDA por la red, y la altura sola no
    // alcanza para saberlo: en GRAVEDAD el arco normal entre teclas de bajo
    // pasa entero por debajo de ROCE, asi que el caño le cobraba el castigo
    // del rescate --racha a cero, un rato sordo-- a alguien que venia volando
    // y no habia fallado nada. Se prueba el contrato de las dos puntas: al que
    // vuela no lo agarra, al que rueda si.
    ['el vastago agarra al que rueda por la red, y NO al que vuela bajo',
      !R.pistones || (!vastago('aire') && vastago('rodando')),
      !R.pistones ? 'sin pistones: no aplica'
        : `volando: ${vastago('aire') ? 'LO AGARRO' : 'lo dejo pasar'} · rodando: ${vastago('rodando') ? 'lo rescato' : 'NO LO RESCATO'}`],
    // ...y sabe en que paso de semicorchea vive ese golpe (el crater del
    // arreglo se abre ahi), a menos de 0.2 tiempos del contacto: acento
    // humano, no flam
    ['todo piston conoce su paso, y esta pegado al contacto',
      PISTONES.every(p => Number.isInteger(p.paso) && Math.abs(p.paso / 4 - p.x) <= 0.2 + 1e-9), ''],
    // fallar un caño no castiga, pero se OYE y se VE: el que expira sin nadie
    // emite su evento. La perfecta, que los pisa todos, no pierde ninguno.
    ['la mano perfecta no deja expirar ningun caño',
      !rp.eventos.some(e => e.tipo === 'piston' && e.modo === 'perdido'),
      `${rp.eventos.filter(e => e.tipo === 'piston' && e.modo === 'perdido').length} perdidos`],
    // cada zona declarada compila caños de verdad: una zona muda es una
    // promesa del mapa que el compilador rompio en silencio
    ['ninguna zona de pistones queda muda', !R.pistones ||
      ZONAS_PISTON.every(z => PISTONES.filter(p => p.x >= z.x0 && p.x < z.x1).length >= 2),
      ZONAS_PISTON.map(z => `${z.x0}-${z.x1}: ${PISTONES.filter(p => p.x >= z.x0 && p.x < z.x1).length}`).join(' · ')],
    ['ningun piston dentro de una tecla, sobre un abismo o bajo un techo',
      PISTONES.every(p => !HUECOS.some(h => p.x > h.x0 - 0.9 && p.x < h.x1 + 0.9) &&
        !TECHOS.some(t => p.x > t.x0 - 0.5 && p.x < t.x1 + 0.5) &&
        !NOTAS.some(k => !k.silencio && k.y < p.y + 0.13 && k.x1 > p.x0 && k.x0 < p.x1)), ''],
    ['tropezar cuesta esa nota, no el tramo: tocar en la red reengancha',
      rz.meta && rz.tocadas.size >= TOTAL_NOTAS - 3,
      `${rz.tocadas.size}/${TOTAL_NOTAS} sonadas tras caerse una vez`],

    // --- SIN RED: el concierto del que ya se sabe la cancion -------------------
    // La prueba que decide si el modo es HONESTO: si la mano perfecta no puede
    // ganarlo, el modo no existe -- seria castigar al jugador por geometria
    // que el propio mapa fabrica, no por sus errores.
    ['SIN RED: la mano perfecta llega a la meta, y entera',
      rSinRed.meta && rSinRed.limpias.size === TOTAL_NOTAS,
      `${rSinRed.meta ? 'meta' : 'murio en ' + rSinRed.x.toFixed(1) + ' ' + rSinRed.causa} · ${rSinRed.limpias.size}/${TOTAL_NOTAS}`],
    // ...y la que decide si el modo RETA: tocar la red es el final, y llega
    // enseguida. (Fallar una nota no siempre TIRA a la red: si la que sigue
    // esta mas abajo te caes adentro de ella, que es la ligadura de siempre --
    // el modo castiga la caida, no el error.)
    ['SIN RED: tocar la red es el final, y la red llega enseguida',
      !rMuertaSR.viva && rMuertaSR.causa === 'red' && rMuertaSR.x < LARGO / 2,
      rMuertaSR.viva ? 'nunca murio' : `murio en ${rMuertaSR.x.toFixed(1)} (${rMuertaSR.causa})`],
    // y con red puesta el mismo que no toca nada rueda largo y nunca muere POR
    // la red: el modo no se filtra al camino normal (si muere es por un
    // abismo, mucho mas tarde)
    ['...y con red, el que no toca nada rueda largo y no muere por la red',
      rm.causa !== 'red' && rm.x > rMuertaSR.x * 3,
      `con red llego a ${rm.x.toFixed(1)} (${rm.causa || 'vivo'}) contra ${rMuertaSR.x.toFixed(1)} sin red`],
    // El techo EXIGE rodar: no puede matar por hacer lo que el mismo ordena.
    ['SIN RED: todo techo cae dentro de un tramo donde se manda rodar',
      TECHOS.every(t => mandaRodar(t.x0) && mandaRodar(t.x1)),
      `${TECHOS.length} techos · ${TRAMOS_RODAR.length} tramos de rodar`],
    // y el modo no puede filtrarse al camino normal
    ['...y el modo normal sigue perdonando la caida', rz.meta && rp.meta, ''],

    // El RANGO es funcion pura y con escalera completa: sin esto el record no
    // puede recordar maestria (guarda el maximo por indice en RANGOS).
    ['el rango sube por limpias y corona con las clavadas',
      rango(0, 100, 0, 0) === 'LLEGASTE' && rango(70, 100, 0, 0) === 'AFINADO' &&
      rango(85, 100, 0, 0) === 'MUSICO' && rango(95, 100, 0, 0) === 'VIRTUOSO' &&
      rango(100, 100, 5, 5, 0) === 'AURORA' && rango(100, 100, 5, 5, 85) === 'SUPERNOVA' &&
      RANGOS.length === 6, RANGOS.join(' < ')],
    // sin trampolines automaticos, caerse se resuelve tocando: la mano que
    // tropieza (arriba) es la prueba de que ese camino funciona
  ];

  console.log(`\n=== ${id.toUpperCase()} · ${BPM} BPM ===`);
  for (const [n, ok, det] of pruebas) {
    if (!ok) fallas++;
    console.log(`${ok ? '  ok  ' : ' FALLA'}  ${n}${det ? `   (${det})` : ''}`);
  }
  console.log(`${TOTAL_NOTAS} notas en ${LARGO} tiempos · ${(LARGO * SPB).toFixed(0)}s`);
}

for (const id of NIVELES) correr(id);
process.exit(fallas ? 1 : 0);
