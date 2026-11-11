// Les mots qu'on lit au mur : l'élision, le rang, les espaces insécables.
//
// La soirée jouée par la tablée (retours du 23 septembre 2026) a lu « La
// soirée de Antoine » au-dessus de l'inscription, « 1ᵉʳ sur 7 » pour Camille,
// et un « ? » seul en début de ligne sous la question du gâteau de Sam. Ce ne
// sont que des textes — mais toute la famille les lit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { de, deNom, espacesFines, formatNumber, place, rang } from '../../shared/typographie'
import { defaultSettings, normalizeSettings, reglagesAuNom, titreChoisi, titreDeCloture } from '../../shared/space'

const FINE = ' '
const INSECABLE = ' '
const GLUON = '\u2060'

test('« de » s’élide devant une voyelle et un h, pas devant une consonne ni un y', () => {
  assert.equal(deNom('Antoine'), 'd’Antoine')
  assert.equal(deNom('Élodie'), 'd’Élodie', 'l’accent ne cache pas la voyelle')
  assert.equal(deNom('Hugo'), 'd’Hugo')
  assert.equal(deNom('Bob'), 'de Bob')
  assert.equal(deNom('Yann'), 'de Yann')
  assert.equal(de('🎉 Team'), 'de ', 'ce qui n’est pas une lettre garde « de »')
  assert.equal(de(''), 'de ')
})

test('un espace neuf s’appelle « La soirée d’Antoine », et l’ancien défaut suit', () => {
  const neuf = defaultSettings('Antoine')
  assert.equal(neuf.title, 'La soirée d’Antoine')
  // La préposition descend avec le prénom : « LA SOIRÉE D’ » restait seul
  // sur sa ligne, en surtitre.
  assert.equal(neuf.eyebrow, 'La soirée')
  assert.equal(neuf.headline, 'd’Antoine')
  assert.equal(defaultSettings('Bob').headline, 'de Bob')

  // Un compte créé avant l'élision garde en base l'ancien titre par défaut :
  // relu, il suit le nouveau.
  const ancien = normalizeSettings({ title: 'La soirée de Antoine', eyebrow: 'La soirée de', headline: 'Antoine' }, 'Antoine')
  assert.equal(ancien.title, 'La soirée d’Antoine')
  assert.equal(ancien.eyebrow, 'La soirée')
  assert.equal(ancien.headline, 'd’Antoine')
  const avantHier = normalizeSettings({ title: 'La soirée d’Antoine', eyebrow: 'La soirée d’', headline: 'Antoine' }, 'Antoine')
  assert.deepEqual([avantHier.eyebrow, avantHier.headline], ['La soirée', 'd’Antoine'], 'le défaut d’hier suit aussi')

  // Ce que l'animateur a tapé lui-même, en revanche, ne bouge pas.
  const tape = normalizeSettings({ title: 'Les 40 ans de Sam', eyebrow: 'La soirée de', headline: 'Sam' }, 'Antoine')
  assert.equal(tape.title, 'Les 40 ans de Sam')
  assert.equal(tape.eyebrow, 'La soirée de')
})

// La tablée du 9 novembre 2026 : une soirée ouverte depuis un salon ne se
// nommait nulle part. « Nouveau salon » demande un nom, un seul champ, que
// la télé, l'entrée des invités, le souvenir et le bilan reprennent.
test('le nom donné à la soirée en créant le salon : le titre de l’espace, et l’entrée des invités', () => {
  const espace = { name: 'Nadia', dateLine: 'samedi 14 mars', maxPlayers: 40 }
  const nommee = reglagesAuNom('  Les 40 ans de Sam ', espace)
  assert.deepEqual(nommee, { title: 'Les 40 ans de Sam', eyebrow: 'La soirée', headline: 'Les 40 ans de Sam', dateLine: 'samedi 14 mars', maxPlayers: 40 })
  assert.equal(titreChoisi({ title: nommee.title, name: 'Nadia' }), 'Les 40 ans de Sam', 'la clôture le reprendra')
  // Vidé, le nom rend le titre d'office — ce que le serveur écrirait de lui-même.
  assert.deepEqual(reglagesAuNom('', espace), { ...defaultSettings('Nadia'), dateLine: 'samedi 14 mars', maxPlayers: 40 })
  assert.deepEqual(reglagesAuNom('   ', espace), reglagesAuNom('', espace))
  // Le grand titre de l'entrée tient en quarante caractères ; le titre, en quatre-vingts.
  const long = reglagesAuNom('Le grand quiz de la crémaillère de la coloc des Lilas', espace)
  assert.equal(long.title, 'Le grand quiz de la crémaillère de la coloc des Lilas')
  assert.equal([...long.headline].length, 40)
  // Ce que le serveur lit de ces réglages, il le garde tel quel.
  assert.deepEqual(normalizeSettings(nommee, 'Nadia'), nommee)
})

test('la clôture propose le titre choisi par l’animateur, jamais le titre par défaut', () => {
  assert.equal(titreChoisi({ title: 'Les 40 ans de Sam', name: 'Nadia' }), 'Les 40 ans de Sam')
  assert.equal(titreChoisi({ title: 'La soirée de Nadia', name: 'Nadia' }), null)
  assert.equal(titreChoisi({ title: 'La soirée d’Antoine', name: 'Antoine' }), null)
  assert.equal(titreChoisi({ title: 'La soirée de Antoine', name: 'Antoine' }), null, 'l’ancien défaut non plus')

  // La soirée s'est rangée seule après le premier quiz, sous sa date : le titre
  // choisi passe devant ce nom automatique, pas devant celui qu'on a tapé.
  const sam = { title: 'Les 40 ans de Sam', name: 'Nadia' }
  assert.equal(titreDeCloture('Soirée du 23 septembre 2026', sam, '23 septembre 2026'), 'Les 40 ans de Sam')
  assert.equal(titreDeCloture(undefined, sam, '23 septembre 2026'), 'Les 40 ans de Sam')
  assert.equal(titreDeCloture('Le grand quiz', sam, '23 septembre 2026'), 'Le grand quiz')
  const nadia = { title: 'La soirée de Nadia', name: 'Nadia' }
  assert.equal(titreDeCloture('Soirée du 23 septembre 2026', nadia, '24 septembre 2026'), 'Soirée du 23 septembre 2026')
  assert.equal(titreDeCloture(undefined, nadia, '24 septembre 2026'), 'Soirée du 24 septembre 2026')
})

test('un rang s’écrit au féminin, devant « place »', () => {
  assert.equal(rang(1), '1ʳᵉ')
  assert.equal(rang(2), '2ᵉ')
  assert.equal(place(1), '1ʳᵉ place')
  assert.equal(place(7), '7ᵉ place')
})

test('les espaces avant ? ! ; : deviennent insécables, et les guillemets en reçoivent', () => {
  assert.equal(
    espacesFines('Vous avez bien regardé le gâteau de Sam ? Combien y avait-il de bougies dessus ?'),
    `Vous avez bien regardé le gâteau de Sam${FINE}? Combien y avait-${GLUON}il de bougies dessus${FINE}?`,
  )
  assert.equal(espacesFines('40, évidemment !'), `40, évidemment${FINE}!`)
  assert.equal(espacesFines('Réponse : Paris ; ou Lyon'), `Réponse${INSECABLE}: Paris${FINE}; ou Lyon`)
  assert.equal(espacesFines('le quiz « Spécial Sam »'), `le quiz «${FINE}Spécial Sam${FINE}»`)
  assert.equal(espacesFines('«Collé»'), `«${FINE}Collé${FINE}»`, 'un guillemet collé reçoit son espace')
})

test('les espaces fines ne touchent ni l’anglais, ni une heure, ni une adresse', () => {
  assert.equal(espacesFines('Why? Because!'), 'Why? Because!', 'pas d’espace ajoutée là où il n’y en avait pas')
  assert.equal(espacesFines('Rendez-vous à 20:30'), 'Rendez-vous à 20:30')
  assert.equal(espacesFines('https://exemple.fr'), 'https://exemple.fr')
  assert.equal(espacesFines(''), '')
})

test('les espaces fines sont idempotentes : un texte déjà traité ne change plus', () => {
  const une = espacesFines('Qui ? « Moi » : oui !')
  assert.equal(espacesFines(une), une)
  assert.ok(!/ [?!:;»]|« /.test(une), 'plus aucune espace sécable autour de la ponctuation')
})

test('le trait d’union de « a-t-il » ne se coupe plus en fin de ligne', () => {
  // Chez Nadia, le mur a lu « Sam a- » en fin de ligne, et « t-il marché ? »
  // sous lui. Un gluon (U+2060) après chaque trait d'union de l'inversion : il
  // ne se dessine pas, et aucune coupure ne passe de part et d'autre.
  assert.equal(espacesFines('Sam a-t-il marché ?'), `Sam a-${GLUON}t-${GLUON}il marché${FINE}?`)
  assert.equal(espacesFines('Va-t-on gagner'), `Va-${GLUON}t-${GLUON}on gagner`)
  assert.equal(espacesFines('Est-elle là'), `Est-${GLUON}elle là`)
  assert.equal(espacesFines('Sont-ils venus'), `Sont-${GLUON}ils venus`)
  assert.equal(espacesFines('Y A-T-IL'), `Y A-${GLUON}T-${GLUON}IL`, 'en capitales aussi')
  // Ce qui ressemble sans être une inversion ne bouge pas.
  assert.equal(espacesFines('Jean-Onésime, peut-être, sous-titre'), 'Jean-Onésime, peut-être, sous-titre')
  assert.equal(espacesFines('Rendez-vous'), 'Rendez-vous')
  const une = espacesFines('Qui a-t-il vu ?')
  assert.equal(espacesFines(une), une, 'idempotente')
  // Le gluon ne change pas ce qu'on lit : sans lui, le texte est celui tapé.
  assert.equal(une.replaceAll(GLUON, '').replaceAll(FINE, ' '), 'Qui a-t-il vu ?')
})

// Le rendu de l'Épingle du Cabinet en 360 × 640 (le 11 novembre 2026) : « à
// plus de 2 100 mètres » finissait sa ligne sur « 2 », et « 100 mètres »
// ouvrait la suivante. Le contenu écrit ses milliers d'une espace ordinaire —
// mille trois cents fois dans la base de la campagne — et rien ne la collait.
const MILLIERS = '\u202f'

test('un nombre à milliers écrit dans un texte ne se coupe plus entre ses groupes', () => {
  // Les phrases mêmes du contenu du Cabinet (`server/content/cabinet/`).
  assert.equal(espacesFines('peints il y a environ 36 000 ans, ils y dormaient jusqu’en 1994.'), `peints il y a environ 36${MILLIERS}000 ans, ils y dormaient jusqu’en 1994.`)
  assert.equal(espacesFines('Le 29 septembre 1973, environ 100 000 personnes défilèrent à Besançon'), `Le 29 septembre 1973, environ 100${MILLIERS}000 personnes défilèrent à Besançon`)
  assert.equal(espacesFines('Je suis né il y a plus de 2 500 ans, dans le petit État de Lu.'), `Je suis né il y a plus de 2${MILLIERS}500 ans, dans le petit État de Lu.`)
  assert.equal(espacesFines('à son foyer, la chaleur dépasse 3 000 °C.'), `à son foyer, la chaleur dépasse 3${MILLIERS}000 °C.`)
  // Tous les groupes d'un grand nombre, et chaque nombre d'une phrase.
  assert.equal(espacesFines('1 234 567 habitants'), `1${MILLIERS}234${MILLIERS}567 habitants`)
  assert.equal(espacesFines('De 2 100 à 12 000 mètres, soit 9 900 de plus'), `De 2${MILLIERS}100 à 12${MILLIERS}000 mètres, soit 9${MILLIERS}900 de plus`)
  assert.equal(espacesFines('3 000'), `3${MILLIERS}000`, 'une réponse qui n’est qu’un nombre')
  assert.equal(espacesFines('(près de 35 000)'), `(près de 35${MILLIERS}000)`)
  assert.equal(espacesFines('1 500,5 km'), `1${MILLIERS}500,5 km`, 'la virgule des décimales ne gêne pas')
  assert.equal(espacesFines('1/299 792 458 de seconde'), `1/299${MILLIERS}792${MILLIERS}458 de seconde`)
  // Avec le reste de la typographie, dans la même phrase.
  assert.equal(espacesFines('Combien : 3 000 ou 30 000 ?'), `Combien${INSECABLE}: 3${MILLIERS}000 ou 30${MILLIERS}000${FINE}?`)
  // L'espace insécable pleine que quelqu'un aurait tapée devient la fine, celle
  // de `formatNumber` : le même nombre ne s'écrit pas de deux largeurs.
  assert.equal(espacesFines(`35${INSECABLE}000 spectateurs`), `35${MILLIERS}000 spectateurs`)
  assert.equal(espacesFines(`Tu as ${formatNumber(1234567)} points`), `Tu as ${formatNumber(1234567)} points`, 'ce que formatNumber écrit ne bouge pas')
  const une = espacesFines('Entre 2 100 et 36 000 ans : 1 000 000 de visiteurs !')
  assert.equal(espacesFines(une), une, 'idempotente')
  assert.equal(une.replaceAll(MILLIERS, ' ').replace(`${INSECABLE}:`, ' :'), 'Entre 2 100 et 36 000 ans : 1 000 000 de visiteurs !', 'on lit ce qui était écrit')
})

test('ce qui n’est pas un nombre à milliers ne se colle pas', () => {
  for (const texte of [
    // Une année puis un nombre : « 1994 300 » n'est pas un nombre.
    'En 1994 300 personnes y entrèrent',
    'de 1889 à 1890, puis 1900 2000',
    // Une suite, un compte à rebours.
    'la suite 1 2 3',
    '3 2 1 partez',
    '10 20 30 40',
    // Un numéro de téléphone, en France et ailleurs.
    'Appelle le 06 12 34 56 78',
    'le 0 800 123 456, gratuit',
    'le 06 12 345 678',
    '+33 6 12 34 56 78',
    '+1 800 555 0199',
    '555 123 4567',
    // Un groupe qui n'a pas trois chiffres, un zéro en tête.
    'le lot 12 3456',
    'les numéros 1 23 456',
    'l’agent 007 300 fois',
    '0 500',
    // Ce que le contenu écrit déjà : une saison de Formule 1, une locomotive.
    'Championnat du monde de Formule 1 1950',
    'LNER Class A4 4468 Mallard',
    // Deux espaces de suite ne sont pas un séparateur de milliers.
    '2  100',
    // Rien à coller.
    'En 1889',
    'Rendez-vous à 20:30, salle 12',
  ]) {
    assert.equal(espacesFines(texte), texte, texte)
  }
})

test('une année devant un nombre reste à part, et le nombre se colle', () => {
  assert.equal(espacesFines('En 1994 3 000 personnes y entrèrent'), `En 1994 3${MILLIERS}000 personnes y entrèrent`)
  assert.equal(espacesFines('En 1973 100 000 personnes défilèrent'), `En 1973 100${MILLIERS}000 personnes défilèrent`)
  const une = espacesFines('En 1994 3 000 personnes')
  assert.equal(espacesFines(une), une, 'idempotente')
})

// Rien ne vaut les textes livrés : chaque suite de chiffres à espaces du
// contenu, relue. Ce qui s'écrit comme un nombre doit sortir collé, et ce qui
// reste tel quel doit ne pas en être un — une liste courte, qu'on lit ici.
test('dans le contenu livré, tout nombre à milliers sort collé', () => {
  const dossiers = ['cabinet', 'campagne', 'quiz', 'curiosites', 'details', 'frises']
  const textes: string[] = []
  const cueillir = (v: unknown): void => {
    if (typeof v === 'string') textes.push(v)
    else if (Array.isArray(v)) v.forEach(cueillir)
    else if (v && typeof v === 'object') Object.values(v).forEach(cueillir)
  }
  for (const dossier of dossiers) {
    const racine = new URL(`../content/${dossier}/`, import.meta.url)
    for (const fichier of readdirSync(racine, { recursive: true, encoding: 'utf8' })) {
      if (fichier.endsWith('.json')) cueillir(JSON.parse(readFileSync(new URL(fichier, racine), 'utf8')))
    }
  }
  const SECABLE = /\d[ \u00a0]\d{3}(?!\d)/
  const avec = textes.filter(t => SECABLE.test(t))
  assert.ok(avec.length > 500, `le contenu écrit des nombres à milliers (${avec.length} textes)`)
  const restes = [...new Set(avec.map(espacesFines).filter(t => SECABLE.test(t)))]
  assert.deepEqual(restes, [], 'une suite de chiffres du contenu se coupe encore devant trois chiffres : si c’est un nombre, écris-le sans équivoque (une virgule après l’année)')
})

test('une année s’écrit « 1889 » : les milliers ne se groupent qu’à partir de cinq chiffres', () => {
  // « 1 889 » en grand au mur, « 1890 » dans la liste des estimations : le
  // même nombre, deux graphies.
  const FINE_GROUPE = '\u202f'
  assert.equal(formatNumber(1889), '1889')
  assert.equal(formatNumber(9999), '9999')
  assert.equal(formatNumber(-1500), '-1500')
  assert.equal(formatNumber(35000), `35${FINE_GROUPE}000`)
  assert.equal(formatNumber(1234567), `1${FINE_GROUPE}234${FINE_GROUPE}567`)
  assert.equal(formatNumber(0.8), '0,8')
  assert.equal(formatNumber(12345.5), `12${FINE_GROUPE}345,5`)
})

// `toLocaleString('fr-FR', …)` chargeait les données du français à son
// premier nombre — 94 ms au processeur d'un téléphone moyen, sur l'accueil
// d'un profil (mesuré le 11 octobre 2026) —, puis bâtissait un formateur à
// chacun. `formatNumber` l'écrit à la main : le même texte, nombre pour nombre.
test('un nombre s’écrit sans Intl, exactement comme toLocaleString l’écrivait', () => {
  const avant = (n: number) => n.toLocaleString('fr-FR', { useGrouping: Math.abs(n) >= 10000 })
  const nombres = [
    0, -0, 5, -5, 0.8, 1 / 3, 2.5, 1234.5678, 9999.9999, 9999.9995, 9999.9994, 10000, 35000, -35000, 1889, 1e6, 0.0625, -0.0625, -0.0001, 0.0005,
    0.00049, 1.0005, 2.0004999, 123456789.123, 0.1 + 0.2, 1e-7, -1e-7, 1.5e-7, 0.000001, 1.5e-6, 999999.9996, 0.9995, -0.9995, 1e20, 1e21, 1.2345678901234567e25,
    -4.56e30, Number.MAX_SAFE_INTEGER, NaN, Infinity, -Infinity,
  ]
  // Et des milliers d'autres, tirés d'une graine fixe : entiers, décimaux, négatifs, de toutes tailles.
  let graine = 42
  const hasard = () => (graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648
  for (let i = 0; i < 5000; i++) {
    const n = (hasard() - 0.3) * 10 ** Math.floor(hasard() * 14 - 5)
    nombres.push(n, Math.round(n), Math.round(n * 1000) / 1000, Math.round(n * 10000 + 0.5) / 10000, Math.round(n * 10) / 10)
  }
  for (const n of nombres) assert.equal(formatNumber(n), avant(n), String(n))
  // Et plus rien d'`Intl` dans le module — ses commentaires en parlent, son code non.
  const code = readFileSync(new URL('../../shared/typographie.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
  assert.doesNotMatch(code, /toLocaleString\(|Intl\./)
})
