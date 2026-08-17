import { elegirCancion, NOTAS, HUECOS } from './juego.js';
elegirCancion('viaje');
console.log('rieles y sus abismos entre b=160 y 200:');
for (const n of NOTAS) {
  if (n.silencio || n.x1 < 160 || n.x0 > 200) continue;
  const h = HUECOS.find(g => g.x0 >= n.x0 - 0.01 && g.x1 <= n.x1 + 0.01);
  if (!n.riel && !h) continue;
  console.log(`  #${n.i} ${n.nombre} b=${n.b} dur=${n.dur} [${n.x0.toFixed(2)},${n.x1.toFixed(2)}] ancho=${(n.x1-n.x0).toFixed(2)} riel=${!!n.riel}` + (h ? `  ABISMO [${h.x0},${h.x1}]` : ''));
}
console.log('\nrieles mas anchos de toda la cancion (con abismo):');
const conAbismo = NOTAS.filter(n => n.riel && HUECOS.some(g => g.x0 >= n.x0 - 0.01 && g.x1 <= n.x1 + 0.01));
conAbismo.sort((a,b) => (b.x1-b.x0)-(a.x1-a.x0));
for (const n of conAbismo.slice(0,6)) console.log(`  ${n.nombre} b=${n.b} ancho=${(n.x1-n.x0).toFixed(2)}`);
