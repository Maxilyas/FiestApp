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
// choisie au bruit de cent parties. La tablée suivante, le 26 octobre 2026, la
// Frise : une année inconnue s'estimait à une part de l'étendue de la frise, et
// la frise serrée d'une épique y devenait plus facile. Ce que le calibrage joue
// du code — le Mot mystère et Protéger compris : `cabinet-calibrage.test.ts`.
//
// Ici, ce que le joueur sait, jeu par jeu. Ses cartes-bonus :
// `cabinet-calibrage-cartes.test.ts` ; ses parties et le musée :
// `cabinet-calibrage-parties.test.ts`. Un seul fichier les tenait toutes, chaque
// épreuve un calibrage lancé à part : 64 s, trois fichiers à la fois, et 117 s
// — sous les deux minutes d'un fichier — à huit à la fois sur quatre cœurs, ses
// calculs partageant le processeur (le 1er novembre 2026, règle `tests.md`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as BAREME from '../../shared/cabinet/bareme'
import { JEUX, CLES_DES_JEUX } from '../../shared/cabinet/jeux/regle'
import { lireNombre } from '../../shared/nombres'
import { SOURCE, calibrer, cases, enFraction, ligneDuJeu, sansCommentaires, sectionDe } from './calibrage-du-cabinet'

test('aux Indices, le rang où l’on reconnaît suit la force : le complétionniste passe le plafond du modèle d’avant', async () => {
  // Tiré sans la force, le rang plafonnait tout joueur à 6,45 étoiles sur neuf — ★★★ au troisième indice au plus,
  // 45 % des manches, même à reconnaître toujours —, quand la tablée en faisait 8,75 ; le logit ordinal en attend 6,6
  // du complétionniste. Le joueur moyen garde les parts du modèle. Au barème où ce plafond se mesurait (3 et 4) : à 2
  // et 4, depuis le 26 octobre 2026, ★★★ demande un indice de moins, et le complétionniste en fait 6,1.
  const { code, sortie, erreurs } = await calibrer(['--sections', 'jeux', '--jeux', 'indices', '--joueurs', 'moyen,complétionniste', '--parties', '1500', '--essai', 'INDICES_DES_ETOILES=3/4'])
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
  // La règle du code depuis le 26 octobre 2026, posée au nom du propriétaire : de 120 à 294 km dans une zone de 300. Qui
  // ne sait rien et éclaire trois fois ne gagne pas une commune plus d'une fois sur trois, où qu'il plante (31,9 % au
  // mieux sur 3 000 manches ; ici, 1 800, à deux points près) ; et la zone le rapproche encore d'une étoile par manche.
  const ligneDuCode = sectionDe(duCode.sortie, "Éclairer à l'Épingle").map(cases).find(c => c[0] === 'le code : de 120 à 294 km, rayon 300 km')
  assert.ok(ligneDuCode, `la ligne du code :\n${sectionDe(duCode.sortie, "Éclairer à l'Épingle").join('\n')}`)
  assert.ok(Math.max(...ligneDuCode[1].split(' · ').map(enFraction)) <= 1 / 3 + 0.02, `une commune sans rien savoir : ${ligneDuCode[1]}`)
  const [sans, avec] = ligneDuCode[2].split(' → ').map(x => lireNombre(x)!)
  assert.ok(avec - sans >= 0.95, `la zone rapporte ${avec - sans} étoile par manche à qui ne sait rien`)
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

// ── La tablée du 26 octobre 2026 ──────────────────────────────────────────

test('à la Frise, une année qu’il ne sait pas s’estime à des années près : la frise serrée d’une épique est plus dure', async () => {
  // Le modèle estimait une année inconnue à un quart de l'étendue de la frise près : une frise serrée, plus courte, y
  // devenait plus facile — le joueur moyen faisait plus de parties parfaites sur les serrées (24,7 %) que sur toute frise
  // (24,4, le calibrage du 26 octobre 2026), et la frise serrée de l'épique (`ECART_D_UNE_FRISE_EPIQUE`) n'avait aucune prise sur lui. Quatre ans d'écart
  // entre la tour Eiffel et les funérailles de Hugo ne se rangent pas « à l'époque ».
  const { code, sortie, erreurs } = await calibrer(['--sections', 'jeux', '--jeux', 'frise', '--joueurs', 'moyen,complétionniste', '--parties', '1000'])
  assert.equal(code, 0, erreurs)
  const [entete, ...lignes] = sectionDe(sortie, 'La Frise serrée').map(cases)
  /** La part d'un joueur dans une colonne, serrée puis toute frise. */
  const parts = (joueur: string, colonne: string) => {
    const c = lignes.find(x => x[0] === joueur)
    assert.ok(c, `pas de ligne pour ${joueur} :\n${lignes.join('\n')}`)
    const k = entete.indexOf(colonne)
    assert.ok(k > 0, `pas de colonne ${colonne} : ${entete.join(' | ')}`)
    return c[k].split(' · ').map(enFraction)
  }
  const epique = `≥ ${BAREME.SEUILS_DES_RARETES.epique}`
  const parfaite = `= ${BAREME.ETOILES_D_UNE_PARTIE}`
  for (const joueur of ['moyen', 'complétionniste']) {
    // Serrée, puis toute frise : moins de parties parfaites, et pas plus à sept étoiles ou plus, sur les serrées.
    const [serree, toute] = parts(joueur, parfaite)
    assert.ok(serree < toute, `${joueur}, parfaites : ${serree} serrée, ${toute} toute frise`)
    const [serreeEpique, touteEpique] = parts(joueur, epique)
    assert.ok(serreeEpique <= touteEpique, `${joueur}, une épique : ${serreeEpique} serrée, ${touteEpique} toute frise`)
  }
  // L'écart est en années, plus serré au plus fort : `MODELE.friseFlouAns` × e^(−0,3θ), jamais une part de l'étendue.
  const modele = sansCommentaires(SOURCE)
  assert.match(modele, /friseFlouAns: 25\b/)
  assert.doesNotMatch(modele, /\betendue\b/, 'l’étendue de la frise ne fait plus l’erreur')
})
