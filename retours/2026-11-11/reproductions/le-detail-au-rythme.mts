// Combien de temps le Détail tient sans redite, joué par son vrai tireur et sous la garde de la carte
// (`leDetailSePromet`), à une, deux et trois traversées par jour — les plus grosses journées du joueur le plus assidu en
// production. Vingt joueurs par rythme, quatre semaines chacun ; une traversée y joue cinq manches du Détail, une épreuve
// de trois et un assaut de deux (la mesure du 8 novembre 2026, `../../2026-11-08/le-cabinet-en-production.md`).
//
//   cd server && node --import tsx ../retours/2026-11-11/reproductions/le-detail-au-rythme.mts
//
// Le 11 novembre 2026, sur les 309 tableaux : aucune manche redite à aucun rythme ; à deux traversées par jour, la
// première sans Détail au septième jour, une sur huit sur les quatre semaines ; à trois, au cinquième jour, quatre
// sur dix.
import { tirerLePlan } from '../../../server/src/core/cabinet/tirages/index'
import { leDetailSePromet } from '../../../server/src/core/cabinet/tirages/detail'
import { FENETRE_DU_CABINET_MS } from '../../../server/src/core/cabinet/tirages/communs'
import { tableauxDuDetail } from '../../../server/src/core/details'
import { ENJEU_ORDINAIRE } from '../../../shared/cabinet/partie'
import { idDuTableau } from '../../../shared/cabinet/pieces'
import type { DetailTire } from '../../../shared/cabinet/jeux/detail'

const JOUR = 24 * 3_600_000
const JOURS = 28
const JOUEURS = 20
const debut = Date.UTC(2026, 10, 11, 8, 0)
const mediane = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

console.log(`${tableauxDuDetail().length} tableaux, ${JOUEURS} joueurs, ${JOURS} jours`)
for (const parJour of [1, 2, 3]) {
  const premiers: number[] = []
  let avec = 0
  let sans = 0
  let manches = 0
  let redites = 0
  for (let joueur = 0; joueur < JOUEURS; joueur++) {
    const vues = new Map<string, number>()
    let premier = 0
    for (let jour = 0; jour < JOURS; jour++) {
      for (let traversee = 0; traversee < parJour; traversee++) {
        const depart = debut + jour * JOUR + traversee * 3_600_000
        // La carte se trace au départ : sans de quoi jouer deux épreuves de neuf, elle ne pose pas le Détail.
        if (!leDetailSePromet(vues, depart)) {
          sans++
          if (premier === 0) premier = jour + 1
          continue
        }
        avec++
        for (const [combien, plusTard] of [[3, 0], [2, 600_000]] as const) {
          const t = depart + plusTard
          const plan = tirerLePlan('detail', { porte: { deLaCategorie: () => [] }, jouables: [], mesures: new Map(), vues, maintenant: t, hasard: Math.random, enjeu: ENJEU_ORDINAIRE, leurres: new Map() }, 0) as DetailTire[]
          for (const tiree of plan.slice(0, combien)) {
            manches++
            // Une redite : un des quatre titres montrés l'a déjà été dans la semaine, en bon ou en leurre.
            if (tiree.titres.some(x => (vues.get(idDuTableau(x.qid!)) ?? Number.NEGATIVE_INFINITY) > t - FENETRE_DU_CABINET_MS)) redites++
            for (const x of tiree.titres) vues.set(idDuTableau(x.qid!), t)
          }
        }
      }
    }
    premiers.push(premier)
  }
  const jamais = premiers.every(p => p === 0)
  console.log(
    `${parJour} par jour : ${redites} manches redites sur ${manches} ; ` +
      (jamais ? 'le Détail à chaque traversée' : `la première traversée sans Détail au jour ${mediane(premiers.filter(p => p > 0))} (médiane), ${sans} sans pour ${avec} avec`),
  )
}
