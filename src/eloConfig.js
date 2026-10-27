// Todos los números del cálculo de Elo en un solo lugar. Para afinar el
// balance NO hace falta tocar elo.js: cambia los valores de acá.

module.exports = {
  // Qué tan "grande" es una diferencia de Elo (escala clásica de ajedrez).
  // Con 400, un equipo 400 puntos por encima gana ~91% de las veces.
  ELO_SCALE: 400,

  // K = cuántos puntos se mueven como máximo por partida. Más alto al
  // principio para que los nuevos encuentren su nivel rápido, y más bajo
  // con experiencia para que no sea un sube y baja. `upTo` = partidas
  // jugadas MENOS que ese número usan ese K.
  K_TIERS: [
    { upTo: 10, k: 40 },
    { upTo: 30, k: 32 },
    { upTo: Infinity, k: 28 }
  ],

  // Rachas. Ganando: cada victoria seguida suma un % extra a lo que ganas.
  STREAK_WIN_STEP: 0.08, // +8% por victoria previa seguida
  STREAK_WIN_MAX: 0.40,  // tope: +40% (racha de 5)
  // Perdiendo CON racha ganadora (de 3+): cortarla cuesta un poco más. Quien
  // viene perdiendo NO recibe castigo extra por racha.
  STREAK_BREAK_MIN: 3,
  STREAK_BREAK_STEP: 0.05, // +5% por cada victoria seguida desde la 3ª
  STREAK_BREAK_MAX: 0.25,  // tope: +25%

  // Impulso en rangos bajos. Con Elo 0 (o menos) ganas BOOST_WIN veces lo
  // normal y pierdes BOOST_LOSS veces lo normal; el efecto baja de forma
  // lineal y desaparece al llegar a BOOST_UNTIL de Elo (600 = Oro I). Para
  // subir más rápido: BOOST_WIN más alto / BOOST_LOSS más bajo. Para que
  // dure más rangos: BOOST_UNTIL más alto. Neutro: 1, 1.
  BOOST_UNTIL: 600,
  BOOST_WIN: 1.5,
  BOOST_LOSS: 0.6,

  // Topes de seguridad por partida.
  MAX_GAIN: 40,
  MAX_LOSS: 28,
  MIN_CHANGE: 1 // nunca un cambio de 0 en una victoria/derrota
};
