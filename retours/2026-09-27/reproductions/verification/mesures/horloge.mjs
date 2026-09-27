// Contre-expertise : une horloge murale décalée, écrite à part de celle de
// l'expert (`tests/decale.mjs`) pour ne pas vérifier son outil avec lui-même.
// Seuls Date.now() et new Date() sans argument avancent ; les minuteurs, non.
// Le décalage passe aux processus enfants par INSTANT_VISE_MS, relu tel quel.
const vise = Number(process.env.INSTANT_VISE_MS)
if (Number.isFinite(vise)) {
  const Vraie = Date
  const maintenant = Vraie.now.bind(Vraie)
  if (!process.env.ECART_MS) process.env.ECART_MS = String(vise - maintenant())
  const ecart = Number(process.env.ECART_MS)
  class Decalee extends Vraie {
    constructor(...a) {
      if (a.length === 0) super(maintenant() + ecart)
      else super(...a)
    }
    static now() {
      return maintenant() + ecart
    }
  }
  globalThis.Date = Decalee
}
