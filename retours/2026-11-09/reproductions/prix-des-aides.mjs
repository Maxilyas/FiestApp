// Ce que vaut une aide du nouveau Filet à qui ne sait rien (`../le-nouveau-filet.md`, § 3.6) : sous le plafond de la
// première maquette (« au plus ★★ »), puis retirée de ce que la manche rapporte (la seconde). Un modèle, pas une
// mesure : sur une année qu'il ignore tout à fait, le joueur choisit une époque au hasard parmi celles qui restent et
// pose au milieu ; la réponse tombe n'importe où dans son époque de 25 ans. ★★★ à 2 ans, ★★ à 6, ★ la bonne époque.
//
//   node retours/2026-11-09/reproductions/prix-des-aides.mjs
const T = 25, A3 = 2, A2 = 6
// Les étoiles naturelles quand l'époque est la bonne : la réponse uniforme sur les T années, le curseur au milieu.
const milieu = (T - 1) / 2
const parAnnee = Array.from({ length: T }, (_, a) => { const e = Math.abs(a - milieu); return e <= A3 ? 3 : e <= A2 ? 2 : 1 })
const dansLaBonne = n => parAnnee.reduce((s, x) => s + n(x), 0) / T

function manche(pBonne, prix) {
  return {
    etoiles: pBonne * dansLaBonne(x => prix(x)),
    coeur: 1 - pBonne,
  }
}
const sans = x => x
const plafond = p => x => Math.min(x, p)
const retire = k => x => Math.max(0, x - k)
const lignes = [
  ['Sans aide (une époque sur quatre)', manche(1 / 4, sans)],
  ['« Deux époques de moins », sous plafond (★★ au plus)', manche(1 / 2, plafond(2))],
  ['« Deux époques de moins », une étoile retirée', manche(1 / 2, retire(1))],
  ['Un indice qui mène à l’époque 9 fois sur 10, une étoile retirée', manche(0.9, retire(1))],
  ['Les deux aides, sous plafond (★ au plus), l’époque 19 fois sur 20', manche(0.95, plafond(1))],
  ['Les deux aides, deux étoiles retirées, l’époque 19 fois sur 20', manche(0.95, retire(2))],
]
const part = n => Math.round((100 * parAnnee.filter(x => x >= n).length) / T)
// Ce que Claire a vu au second tour : « dès que j'ai la bonne époque, le milieu me donne ★★ à peu près une fois sur deux ».
console.log(`Dans la bonne époque, au milieu : ${dansLaBonne(x => x).toFixed(2)} étoile en moyenne — ★★ ou mieux ${part(2)} %, ★★★ ${part(3)} %\n`)
for (const [nom, r] of lignes) console.log(`${nom.padEnd(68)} ${r.etoiles.toFixed(2)} étoile · cœur perdu ${Math.round(100 * r.coeur)} %`)
