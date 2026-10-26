// Le modèle du calibrage du Cabinet (`scripts/calibrage-cabinet.ts`), corrigé
// après la tablée du 25 octobre 2026 : elle l'a trouvé faux là où les barèmes du
// même jour s'étaient décidés — le rang où l'on reconnaît ne suivait pas la
// force (aux Indices, le complétionniste plafonnait à 6,45 étoiles sur neuf quand
// la tablée en faisait 8,75), le Filet ignorait sa marche, le tableau des jeux ne
// comptait pas les quatre œuvres de départ, Changer aux Indices savait d'avance
// s'il reconnaîtrait la personne, et le joueur sans savoir ignorait la zone
// d'Éclairer (axes 9 et 10 de `retours/2026-10-25/synthese.md`). La relecture
// du lendemain y a ajouté ce que le modèle corrigé laissait faux : Changer qui ne
// payait sa lecture qu'aux Indices, la mise jugée sur des manches tirées l'une
// après l'autre, le Détail qui reculait vers les étoiles en moyenne, et une carte
// choisie au bruit de cent parties. Ce que le calibrage joue du code :
// `cabinet-calibrage.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as BAREME from '../../shared/cabinet/bareme'
import { JEUX, CLES_DES_JEUX } from '../../shared/cabinet/jeux/regle'
import { POUVOIRS } from '../../shared/cabinet/pouvoirs'
import { lireNombre } from '../../shared/nombres'
import { SOURCE, calibrer, cases, enFraction, jeuxQuiVisent, ligneDuJeu, partAvecLaCarte, sansCommentaires, sectionDe } from './calibrage-du-cabinet'

test('aux Indices, le rang où l’on reconnaît suit la force : le complétionniste passe le plafond du modèle d’avant', async () => {
  // Tiré sans la force, le rang plafonnait tout joueur à 6,45 étoiles sur neuf — ★★★ au troisième indice au plus,
  // 45 % des manches, même à reconnaître toujours —, quand la tablée en faisait 8,75 ; le logit ordinal en attend 6,6
  // du complétionniste. Le joueur moyen garde les parts du modèle.
  const { code, sortie, erreurs } = await calibrer(['--sections', 'jeux', '--jeux', 'indices', '--joueurs', 'moyen,complétionniste', '--parties', '1500'])
  assert.equal(code, 0, erreurs)
  const etoiles = (joueur: string) => lireNombre(ligneDuJeu(sortie, JEUX.indices.nom, joueur)[3])!
  assert.ok(etoiles('complétionniste') > 6.45, `le complétionniste aux Indices : ${etoiles('complétionniste')} étoiles sur neuf`)
  assert.ok(etoiles('complétionniste') > etoiles('moyen') + 1, `${etoiles('complétionniste')} contre ${etoiles('moyen')} au moyen`)
  // La colonne « = 9 » : les parties parfaites, jouées pour dorer — ce que vise un joueur fort, et ce que compte une tablée.
  assert.match(sortie, /≥ 5 · ≥ 6 · ≥ 7 · = 9/)
  const parts = (joueur: string) => ligneDuJeu(sortie, JEUX.indices.nom, joueur)[2].split(' · ').map(enFraction)
  for (const joueur of ['moyen', 'complétionniste']) {
    const [, , sept, neuf] = parts(joueur)
    assert.ok(neuf !== undefined && neuf <= sept + 0.03, `${joueur} : ${parts(joueur).join(' · ')}`)
  }
  assert.ok(parts('complétionniste')[3] > parts('moyen')[3], parts('complétionniste').join(' · '))
})

test('au Filet, ce que le joueur sait suit la marche de la question', async () => {
  // `--essai MARCHES_DU_FILET=moyen/difficile` rendait la même sortie au chiffre près : le modèle ne lisait pas la marche.
  const filet = ['--sections', 'jeux', '--jeux', 'filet', '--joueurs', 'moyen', '--parties', '800']
  const [duCode, essai] = await Promise.all([calibrer(filet), calibrer([...filet, '--essai', 'MARCHES_DU_FILET=moyen/difficile'])])
  assert.equal(duCode.code, 0, duCode.erreurs)
  assert.equal(essai.code, 0, essai.erreurs)
  const parts = (s: string) => ligneDuJeu(s, JEUX.filet.nom, 'moyen')[2].split(' · ').map(enFraction)
  const [avant, apres] = [parts(duCode.sortie), parts(essai.sortie)]
  // Plus difficiles, ses questions se savent moins : la commune et l'épique s'éloignent.
  assert.ok(apres[0] < avant[0] - 0.05 && apres[2] < avant[2] - 0.05, `le Filet du moyen : ${avant.join(' · ')} au code, ${apres.join(' · ')} à l'essai`)
})

test('les cartes-bonus, jeu par jeu : la mise au Détail sans rien savoir, et Changer aux Indices sans lire l’avenir', async () => {
  const { code, sortie, erreurs } = await calibrer(['--sections', 'cartes', '--jeux', 'detail,indices,epingle', '--pouvoirs', 'miser,changer,eclairer', '--joueurs', 'moyen,hasard', '--mesures', '400'])
  assert.equal(code, 0, erreurs)
  // Qui ne sait rien mise une manche du Détail et y devine un titre au premier coup d'œil : parfaite une fois sur
  // quatre, elle vaut trois étoiles et le bonus de la mise ; les deux autres, trois une fois sur quatre. Ce que la
  // règle en attend, des chiffres du barème — 25 % d'épiques au barème du 25 octobre 2026 (+4 à la force 3).
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

test('une question du Pari se répond au temps d’une question de série', async () => {
  // À 9 s contre 14 en série — l'anecdote à part, que le Cabinet lit à la révélation —, le Pari payait ses confettis
  // plus vite que la série au seul temps posé, et décidait de la condition du troisième choix délégué.
  const { code, sortie, erreurs } = await calibrer(['--parties', '20', '--sections', 'confettis', '--joueurs', 'hasard'])
  assert.equal(code, 0, erreurs)
  // Les nombres de la sortie s'écrivent par `formatNumber` : une espace fine passé mille, une virgule décimale.
  const nombre = '([\\d\\u202f\\u00a0 ]+(?:,\\d+)?)'
  const temps = new RegExp(`une série à ${nombre} s la question au joueur moyen, dont ${nombre} s d'anecdote ; une question du Pari à ${nombre} s`).exec(sortie)
  assert.ok(temps, `le temps d'une question :\n${sortie}`)
  const [serie, anecdote, pari] = temps.slice(1).map(x => lireNombre(x))
  assert.ok(serie !== null && anecdote !== null && pari !== null, temps[0])
  assert.equal(pari, serie - anecdote)
})

/** La ligne d'une règle de la zone, à la section de l'Épingle : sa part de communes, au centre · au milieu de la terre · au meilleur point. */
function communesALEpingle(sortie: string, regle: string): number[] {
  const ligne = sectionDe(sortie, "Éclairer à l'Épingle")
    .map(cases)
    .find(c => c[0] === regle)
  assert.ok(ligne, `pas de ligne « ${regle} » :\n${sectionDe(sortie, "Éclairer à l'Épingle").join('\n')}`)
  return ligne[1].split(' · ').map(enFraction)
}

test('à l’Épingle, qui ne sait rien lit la zone d’Éclairer : la règle du code et ses pistes', async () => {
  const epingle = ['--sections', 'epingle', '--parties', '600']
  const [duCode, essai] = await Promise.all([calibrer(epingle), calibrer([...epingle, '--essai', 'DECALAGE_DE_LA_ZONE_KM=120/165'])])
  assert.equal(duCode.code, 0, duCode.erreurs)
  assert.equal(essai.code, 0, essai.erreurs)
  const auMieux = (s: string, regle: string) => Math.max(...communesALEpingle(s, regle))
  // La règle du 25 octobre 2026 : trois zones font une commune à qui ne sait rien plus de neuf fois sur dix — 93 % au
  // milieu de la terre que la zone couvre, dit la contre-expertise.
  assert.ok(auMieux(duCode.sortie, 'de 40 à 140 km, rayon 170 km') > 0.85)
  // La piste de l'expert ne tient pas : la couronne se lit, et la mer fait le reste (45 à 56 %).
  const couronne = auMieux(duCode.sortie, 'de 120 à 165 km, rayon 170 km')
  assert.ok(couronne > 0.35 && couronne < 0.75, `de 120 à 165 km : ${couronne}`)
  // Le lieu partout dans un disque de 300 km : il n'y a plus de couronne à lire (15 à 32 %).
  assert.ok(auMieux(duCode.sortie, 'partout dans le disque, rayon 300 km') < 0.4)
  // La ligne du code suit le barème, essai compris : elle dit son décalage et son rayon, et vaut la piste qui a les mêmes.
  const duBareme = (s: string) => sectionDe(s, "Éclairer à l'Épingle").map(cases).find(c => c[0].startsWith('le code'))!
  for (const s of [duCode.sortie, essai.sortie]) {
    const ligne = duBareme(s)
    assert.ok(ligne, s)
    const regle = ligne[0].replace(/^le code : /, '')
    const piste = sectionDe(s, "Éclairer à l'Épingle").map(cases).find(c => c[0] === regle)
    if (piste) assert.ok(Math.abs(Math.max(...ligne[1].split(' · ').map(enFraction)) - Math.max(...piste[1].split(' · ').map(enFraction))) < 0.07, `${ligne.join(' | ')}\n${piste.join(' | ')}`)
  }
  assert.match(duBareme(essai.sortie)[0], /^le code : de 120 à 165 km/)
})

test('le joueur « tablée » a sa ligne à chaque jeu, au-dessus du complétionniste', async () => {
  // Les agents d'une tablée en savent plus que tout joueur (θ ≈ +2,5) : sa synthèse compare chaque jeu à cette ligne.
  const { code, sortie, erreurs } = await calibrer(['--sections', 'jeux', '--joueurs', 'complétionniste,tablée', '--parties', '300'])
  assert.equal(code, 0, erreurs)
  for (const jeu of CLES_DES_JEUX) {
    const etoiles = (joueur: string) => lireNombre(ligneDuJeu(sortie, JEUX[jeu].nom, joueur)[3])!
    assert.ok(etoiles('tablée') >= etoiles('complétionniste') - 0.2, `${JEUX[jeu].nom} : ${etoiles('tablée')} à la tablée, ${etoiles('complétionniste')} au complétionniste`)
  }
})

test('le chasseur chasse dans la salle du prochain gardien, et l’éveille plus tôt que l’occasionnel', async () => {
  // L'occasionnel attendait son premier gardien au 36ᵉ jour : la visite remplit les neuf salles à la fois. Le même
  // joueur, aux mêmes jours, qui chasse là où la page lui dit le prochain gardien, l'éveille plus tôt.
  const { code, sortie, erreurs } = await calibrer(['--sections', 'musee', '--joueurs', 'occasionnel,chasseur', '--parcours', '2', '--jours', '80', '--mesures', '30'])
  assert.equal(code, 0, erreurs)
  const premier = (joueur: string) => {
    const bloc = sortie.slice(sortie.indexOf(`\n  ${joueur}\n`))
    const m = /le premier gardien réveillé en jouant : (\S+) j/.exec(bloc)
    assert.ok(m, `${joueur} :\n${sortie}`)
    return lireNombre(m[1])!
  }
  assert.ok(premier('chasseur') < premier('occasionnel'), `le premier gardien : au ${premier('chasseur')}ᵉ jour au chasseur, au ${premier('occasionnel')}ᵉ à l'occasionnel`)
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
  // chemin — gardée ou lancée large, la manche misée ne vaudrait rien, et la mise ne servirait pas.
  const epique = BAREME.SEUILS_DES_RARETES.epique
  for (const jeu of [JEUX.pari.nom, JEUX.filet.nom]) {
    const sans = partAvecLaCarte(sortie, epique, jeu, 'moyen', null)
    const avec = partAvecLaCarte(sortie, epique, jeu, 'moyen', POUVOIRS.miser.nom, 3)
    assert.ok(avec > sans + 0.1, `${jeu}, le moyen vers l'épique : Miser 3 ${avec}, sans carte ${sans}`)
  }
})

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
