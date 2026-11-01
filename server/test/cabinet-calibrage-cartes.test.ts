// Le modèle du calibrage du Cabinet (`scripts/calibrage-cabinet.ts`), ses
// cartes-bonus : ce qu'il en fait, corrigé après la tablée du 25 octobre 2026
// (la mise au Détail, Changer aux Indices qui savait d'avance s'il reconnaîtrait
// la personne, la zone d'Éclairer) et la relecture du lendemain (Changer qui ne
// payait sa lecture qu'aux Indices, la mise jugée sur des manches tirées l'une
// après l'autre). Coupé de `cabinet-calibrage-modele.test.ts` le 1er novembre
// 2026 : un seul fichier en durait 117 s à huit fichiers à la fois sur quatre
// cœurs, sous les deux minutes d'un fichier (règle `tests.md`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as BAREME from '../../shared/cabinet/bareme'
import { JEUX, CLES_DES_JEUX } from '../../shared/cabinet/jeux/regle'
import { POUVOIRS } from '../../shared/cabinet/pouvoirs'
import { SOURCE, calibrer, partAvecLaCarte, sansCommentaires } from './calibrage-du-cabinet'

test('les cartes-bonus, jeu par jeu : la mise au Détail sans rien savoir, et Changer aux Indices sans lire l’avenir', async () => {
  const { code, sortie, erreurs } = await calibrer(['--sections', 'cartes', '--jeux', 'detail,indices,epingle', '--pouvoirs', 'miser,changer,eclairer', '--joueurs', 'moyen,hasard', '--mesures', '400'])
  assert.equal(code, 0, erreurs)
  // Qui ne sait rien mise une manche du Détail et y devine un titre au premier coup d'œil : parfaite une fois sur
  // quatre, elle vaut trois étoiles et le bonus de la mise ; les deux autres, trois une fois sur quatre. Ce que la
  // règle en attend, des chiffres du barème — 25 % d'épiques au barème du 25 octobre 2026 (+4 à la force 3), 11 % depuis
  // le 26 (+3) : la manche misée parfaite ne fait plus seule les sept étoiles, il y faut une autre manche parfaite.
  const p = 1 / BAREME.TITRES_DU_DETAIL
  const parfaite = BAREME.ETOILES_AU_CADRAGE[0]
  const misee = parfaite + BAREME.BONUS_DE_MISE[3]
  let attendu = 0
  for (const [a, pa] of [[misee, p], [0, 1 - p]] as const)
    for (const [b, pb] of [[parfaite, p], [0, 1 - p]] as const)
      for (const [c, pc] of [[parfaite, p], [0, 1 - p]] as const) if (Math.min(BAREME.ETOILES_D_UNE_PARTIE, a + b + c) >= BAREME.SEUILS_DES_RARETES.epique) attendu += pa * pb * pc
  const epique = partAvecLaCarte(sortie, BAREME.SEUILS_DES_RARETES.epique, JEUX.detail.nom, 'hasard', POUVOIRS.miser.nom, 3)
  assert.ok(Math.abs(epique - attendu) < 0.06, `au Détail, au hasard, Miser 3 : ${epique} d'épiques, ${attendu} attendus`)
  // Changer décide sur ce qu'il voit — le premier indice, le plus obscur —, plus sur ce qu'il saurait au cinquième :
  // avec cet oracle, Changer 3 menait le moyen à une commune 87 fois sur 100, contre 53 sans carte.
  const commune = BAREME.SEUILS_DES_RARETES.commun
  const sans = partAvecLaCarte(sortie, commune, JEUX.indices.nom, 'moyen', null)
  const changer = partAvecLaCarte(sortie, commune, JEUX.indices.nom, 'moyen', POUVOIRS.changer.nom, 3)
  assert.ok(changer < sans + 0.15, `aux Indices, le moyen : ${changer} avec Changer 3, ${sans} sans carte`)
  // Qui ne sait rien lit la zone d'Éclairer : il ne plante plus n'importe où (0,5 % de communes, autant que sans carte).
  const zone = partAvecLaCarte(sortie, commune, JEUX.epingle.nom, 'hasard', POUVOIRS.eclairer.nom, 3)
  const sansZone = partAvecLaCarte(sortie, commune, JEUX.epingle.nom, 'hasard', null)
  assert.ok(zone > sansZone + 0.1, `à l'Épingle, au hasard : ${zone} avec Éclairer 3, ${sansZone} sans carte`)
})

// ── La relecture du 26 octobre 2026 ───────────────────────────────────────

/** Les arguments de chaque appel à `nom(` dans un code, coupés à leurs virgules de premier niveau. */
function appelsDe(code: string, nom: string): string[][] {
  const appels: string[][] = []
  for (let i = code.indexOf(nom); i >= 0; i = code.indexOf(nom, i + 1)) {
    const args: string[] = []
    let profondeur = 0
    let debut = i + nom.length
    for (let k = debut; k < code.length; k++) {
      const c = code[k]
      if ('([{'.includes(c)) profondeur++
      else if (')]}'.includes(c) && profondeur > 0) profondeur--
      else if ((c === ',' || c === ')') && profondeur === 0) {
        args.push(code.slice(debut, k).trim())
        debut = k + 1
        if (c === ')') break
      }
    }
    appels.push(args)
  }
  return appels
}

test('Changer paie la lecture de ce qu’il a vu, à chaque jeu où il sert', () => {
  // Changer se décide sur ce que la manche montre — la question, le récit, le premier cadrage, le premier indice, les
  // affirmations jusqu'à la troisième qu'il ignore — : ce qu'il a lu se paie, le chrono qui court. Seuls les Indices le
  // payaient : au Détail, reconnaître le tableau au premier cadrage ne coûtait rien, et « le Détail, Changer 3 », le
  // meilleur gardien du complétionniste, le faisait passer au-dessus de la série au temps d'un geste gratuit.
  const code = sansCommentaires(SOURCE)
  const signature = /\n\s*changer\(([^)]*)\)\s*:\s*boolean/.exec(code)
  assert.ok(signature, 'la méthode qui joue Changer')
  assert.doesNotMatch(signature[1], /=/, `pas de lecture d'office : changer(${signature[1]})`)
  const appels = appelsDe(code, 'p.changer(')
  assert.equal(appels.length, CLES_DES_JEUX.filter(j => JEUX[j].changeable).length, 'un Changer à chaque jeu où il sert')
  for (const args of appels) {
    assert.equal(args.length, 3, `p.changer(${args.join(', ')}) : la lecture manque`)
    assert.match(args[2], /SECONDES\.\w+/, `p.changer(${args.join(', ')}) : la lecture se lit au temps du jeu`)
  }
})

test('Miser se décide vers le seuil, la mise gardée pour la manche où elle mène le plus près : jamais moins que sans carte', async () => {
  // La mise se jugeait à la moyenne, puis sur des manches tirées l'une après l'autre d'une loi moyenne, la manche misée
  // lue sur des parties pour dorer : au Filet, qui adapte son filet à la partie, la règle faisait moins que ne jamais
  // miser, et à l'Éclair, Miser 3 menait le moyen à une commune 58 fois sur 100, contre 85 sans carte. Elle se décide
  // désormais sur la programmation qui choisit le reste (`Avenir`), et chaque carte se mesure sur les parties mêmes de
  // « sans carte » : la mise ne fait jamais moins, à quelques divergences près — une partie misée ne se joue plus pareil.
  const joueurs = ['moyen', 'complétionniste']
  const { code, sortie, erreurs } = await calibrer(['--sections', 'cartes', '--pouvoirs', 'miser', '--joueurs', joueurs.join(','), '--mesures', '400'])
  assert.equal(code, 0, erreurs)
  const pertes: string[] = []
  for (const seuil of new Set(Object.values(BAREME.SEUILS_DES_RARETES))) {
    for (const jeu of CLES_DES_JEUX) {
      for (const joueur of joueurs) {
        const sans = partAvecLaCarte(sortie, seuil, JEUX[jeu].nom, joueur, null)
        for (const force of [1, 2, 3] as const) {
          const avec = partAvecLaCarte(sortie, seuil, JEUX[jeu].nom, joueur, POUVOIRS.miser.nom, force)
          if (avec < sans - 0.02) pertes.push(`${JEUX[jeu].nom}, ${joueur}, au moins ${seuil} : Miser ${force} ${avec}, sans carte ${sans}`)
        }
      }
    }
  }
  assert.deepEqual(pertes, [])
  // La manche misée se joue pour ses trois étoiles : parier au Pari, le petit filet. Vers l'épique, la mise est le
  // chemin — gardée ou lancée large, la manche misée ne vaudrait rien, et la mise ne servirait pas. Dix points d'épiques
  // de plus au moins à +4 ; à +3, depuis le 26 octobre 2026, la manche misée parfaite ne fait plus seule une épique, et
  // l'épique tire le difficile : cinq au moins — de 3 à 13 % au Pari, de 21 à 45 au Filet, sur les quatre cents parties
  // de cette mesure. Le calibrage complet, à cent parties par mesure, en lit 3 à 8 et 25 à 48 (`baremes.md`) : à cent,
  // le bruit couvre la moitié de l'écart du Pari, et la borne ne se lit qu'à quatre cents.
  const epique = BAREME.SEUILS_DES_RARETES.epique
  for (const jeu of [JEUX.pari.nom, JEUX.filet.nom]) {
    const sans = partAvecLaCarte(sortie, epique, jeu, 'moyen', null)
    const avec = partAvecLaCarte(sortie, epique, jeu, 'moyen', POUVOIRS.miser.nom, 3)
    assert.ok(avec > sans + 0.05, `${jeu}, le moyen vers l'épique : Miser 3 ${avec}, sans carte ${sans}`)
  }
})
