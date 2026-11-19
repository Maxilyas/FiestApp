// Le modèle du calibrage du Cabinet (`scripts/calibrage-cabinet.ts`) et ses
// parties : le tableau des jeux qui comptait sans les quatre œuvres de départ
// (la tablée du 25 octobre 2026), et le Détail qui reculait vers les étoiles
// en moyenne au point de perdre la partie parfaite (la relecture du
// lendemain). Coupé de `cabinet-calibrage-modele.test.ts` le 1er novembre
// 2026 : un seul fichier en durait 117 s à huit fichiers à la fois sur quatre
// cœurs, sous les deux minutes d'un fichier (règle `tests.md`). Le musée qui
// se remplit, venu de `cabinet-calibrage.test.ts` le 9 novembre 2026, et le
// chasseur l'ont quitté le 18 novembre 2026 pour `cabinet-calibrer-le-musee.test.ts` :
// 25 s seul, il a passé ses deux minutes sur une machine lente de la CI, la
// tranche entière y prenant 3 min 41 au lieu de 2 min 43.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JEUX, CLES_DES_JEUX } from '../../shared/cabinet/jeux/regle'
import { calibrer, cases, enFraction, jeuxQuiVisent, ligneDuJeu, sectionDe } from './calibrage-du-cabinet'

test('le tableau des jeux compte aussi les quatre œuvres de départ, que tout profil emporte', async () => {
  const { code, sortie, erreurs } = await calibrer(['--parties', '400', '--sections', 'jeux,oeuvres', '--joueurs', 'hasard'])
  assert.equal(code, 0, erreurs)
  const lignes = sectionDe(sortie, 'Les jeux, un à un — avec les quatre œuvres de départ').map(cases)
  for (const jeu of CLES_DES_JEUX) {
    const avec = lignes.find(c => c[0] === JEUX[jeu].nom && c[1] === 'hasard')
    assert.ok(avec, `pas de ligne pour ${JEUX[jeu].nom} :\n${lignes.join('\n')}`)
    // La meilleure des quatre, ou aucune, sur les mêmes parties que sans carte : jamais moins.
    const sans = ligneDuJeu(sortie, JEUX[jeu].nom, 'hasard')[2].split(' · ').map(enFraction)
    const [cinq, six, sept] = avec[2].split(' · ').map(enFraction)
    assert.ok(cinq >= sans[0], `${JEUX[jeu].nom} : ${cinq} avec les œuvres de départ, ${sans[0]} sans carte`)
    // Choisie sur cent parties et mesurée sur mille autres, la carte gardée au bruit près donnait plus de rares que de
    // communes ; choisie sur les parties mêmes qu'elle compte, elle ne le peut plus — sauf d'un rien, aux jeux qui
    // visent le seuil, où chaque seuil se joue à sa façon.
    const marge = jeuxQuiVisent(sortie).includes(JEUX[jeu].nom) ? 0.01 : 0
    assert.ok(cinq >= six - marge && six >= sept - marge, `${JEUX[jeu].nom} : ${avec.join(' | ')}`)
  }
})

// ── La relecture du 26 octobre 2026 ───────────────────────────────────────

test('à chaque jeu, la partie parfaite n’est jamais plus fréquente que sept étoiles ou plus', async () => {
  // Au Détail, le joueur reculait vers ce qui rapporte le plus d'étoiles en moyenne, même vers sept, et perdait la partie
  // parfaite : l'occasionnel y faisait plus de parties à neuf, jouées pour dorer (4,8 %), qu'à sept ou plus (3,5 %). Le
  // Détail vise désormais son seuil ; un jeu qui ne le vise pas se joue pareil pour dorer et vers sept, sur les mêmes
  // parties ; un jeu qui le vise joue chacun à sa façon, et ses parties s'écartent d'un rien.
  const joueurs = ['occasionnel', 'complétionniste']
  const { code, sortie, erreurs } = await calibrer(['--sections', 'jeux', '--joueurs', joueurs.join(','), '--parties', '1000'])
  assert.equal(code, 0, erreurs)
  const visent = jeuxQuiVisent(sortie)
  for (const jeu of CLES_DES_JEUX) {
    for (const joueur of joueurs) {
      const [, , sept, neuf] = ligneDuJeu(sortie, JEUX[jeu].nom, joueur)[2].split(' · ').map(enFraction)
      const marge = visent.includes(JEUX[jeu].nom) ? 0.005 : 0
      assert.ok(neuf <= sept + marge, `${JEUX[jeu].nom}, ${joueur} : ${sept} à sept étoiles ou plus, ${neuf} parfaites`)
    }
  }
})
