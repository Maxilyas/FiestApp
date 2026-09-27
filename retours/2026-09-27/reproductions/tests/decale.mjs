// Décale l'horloge murale du processus (Date.now, new Date()) de DECALAGE_MS,
// sans toucher aux minuteurs : de quoi jouer un fichier de tests « à une autre
// date » — Halloween, Noël, le changement d'heure — sans changer l'heure de la
// machine. S'importe avant tsx : node --import ./decale.mjs --import tsx …
const cible = process.env.DATE_CIBLE ? Date.parse(process.env.DATE_CIBLE) : NaN
const RealDate = Date
const realNow = RealDate.now.bind(RealDate)
const decalage = Number.isFinite(cible) ? cible - realNow() : Number(process.env.DECALAGE_MS ?? 0)
if (!process.env.DECALAGE_MS && Number.isFinite(cible)) process.env.DECALAGE_MS = String(decalage)
class DateDecalee extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(realNow() + decalage)
    else super(...args)
  }
  static now() {
    return realNow() + decalage
  }
}
globalThis.Date = DateDecalee
