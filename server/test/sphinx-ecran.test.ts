// Le Sphinx de l'accueil, côté écran (l'étape 2 du plan du 24 novembre 2026,
// `retours/2026-11-24/le-sphinx/plan.md`) : ce qui ne se voit qu'en lisant le
// code. Ce qui se voit — l'arrivée, la boîte, l'énigme, le mot qui vole,
// l'épingle, l'album — se photographie (`server/scripts/rendu-sphinx.ts`).
//
// Il ne part qu'avec l'accueil d'un profil qu'il visite, jamais avec la
// soirée, l'entrée ou l'accueil anonyme ; il ne sonne pas sans qu'on le lui
// demande ; il ne pose pas le clavier sur l'énigme ; il dit sa réplique
// entière au lecteur d'écran, et d'un coup à qui demande moins de mouvement ;
// sa police pixel n'arrive qu'avec lui ; et la phrase inventée des photos ne
// se pose jamais en ligne.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { importsStatiques } from './chemin-des-imports'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil } from './banc'
import { motsDeLaLegende } from '../src/core/sphinx'
import { FENETRE_DE_L_HABITUE, JOURS_DE_L_HABITUE, type PhraseDuSphinx } from '../../shared/sphinx'

const ici = path.dirname(fileURLToPath(import.meta.url))
const client = path.resolve(ici, '../../client/src')
const lire = (fichier: string) => readFileSync(path.resolve(ici, '../..', fichier), 'utf8')
const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href

/** Un composant du client, rendu en HTML — la recette de `medaillons.test.ts`. */
async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const React = (await import('react')).default
  Object.assign(globalThis, { React })
  const module = await import(url(fichier))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** Les espaces de la typographie (`espacesFines` : la fine, l'insécable) lues comme des espaces ordinaires. */
const blancs = (s: string) => s.replace(/[  ]/g, ' ')

/** La phrase inventée des photos : celle de la maquette, qui ne dit la règle d'aucun Divin. */
const INVENTEE = 'Il descend sur qui défie le temps sans jamais perdre l’heure de son rendez-vous'

// ── Chargé à la demande ───────────────────────────────────────────────────

test('le Sphinx ne part qu’à la demande : ni avec l’accueil, ni avec la soirée, ni avec l’entrée', () => {
  const sphinx = path.join(client, 'components/Sphinx.tsx')
  assert.ok(existsSync(sphinx), 'la visite a son composant')
  for (const page of ['views/ProfilApp.tsx', 'views/PlayerApp.tsx', 'views/LandingApp.tsx', 'views/JourApp.tsx', 'main.tsx', 'components/Entree.tsx']) {
    const chemin = importsStatiques(path.join(client, page))
    assert.ok(!chemin.has(sphinx), `${page} n’emporte pas la visite du Sphinx`)
  }
  // Le parcours voit bien le chemin de l'accueil : la règle légère qui décide s'il surgit en est.
  assert.ok(importsStatiques(path.join(client, 'views/ProfilApp.tsx')).has(path.join(client, 'sphinx.ts')), 'ce qui décide s’il surgit est sur le chemin')
  // Ni la collection, qui ne montre que la phrase : son album n'importe pas la visite.
  assert.ok(!importsStatiques(path.join(client, 'components/AlbumDesAvatars.tsx')).has(sphinx), 'l’album n’emporte pas la visite')
})

test('seul un accueil que le Sphinx visite le fait venir, avec sa feuille : jamais quand une soirée attend', async () => {
  const { ceQueMontreLeSphinx } = await import(url('sphinx.ts'))
  assert.deepEqual(ceQueMontreLeSphinx(undefined, 0), { epingle: false, surgit: false }, 'les missions n’en disent rien : rien ne vient')
  assert.deepEqual(ceQueMontreLeSphinx('attend', 0), { epingle: false, surgit: true }, 'une visite attend : il surgit')
  assert.deepEqual(ceQueMontreLeSphinx('attend', 1), { epingle: true, surgit: false }, '« Revenir chez Hugo » : il s’épingle seulement')
  assert.deepEqual(ceQueMontreLeSphinx('epingle', 0), { epingle: true, surgit: false }, 'remis à plus tard : épinglé')
  assert.deepEqual(ceQueMontreLeSphinx('parti', 0), { epingle: false, surgit: false }, 'parti pour aujourd’hui')
  // Son code et sa feuille viennent ensemble, à la demande : la feuille n'est importée nulle part ailleurs.
  const leger = readFileSync(path.join(client, 'sphinx.ts'), 'utf8')
  assert.match(leger, /import\(['"]\.\/components\/Sphinx['"]\)/)
  assert.match(leger, /import\(['"]\.\/components\/sphinx\.css['"]\)/)
  const tous = (readdirSync(client, { recursive: true }) as string[]).filter(f => /\.tsx?$/.test(f))
  const quiLaCite = tous.filter(f => /sphinx\.css/.test(readFileSync(path.join(client, f), 'utf8')))
  assert.deepEqual(quiLaCite, ['sphinx.ts'], 'la feuille du Sphinx ne part qu’avec lui')
})

// ── La police pixel ───────────────────────────────────────────────────────

test('la police pixel arrive avec le Sphinx seulement, hébergée chez nous avec sa licence', () => {
  const feuille = readFileSync(path.join(client, 'components/sphinx.css'), 'utf8')
  assert.match(feuille, /@font-face\s*\{[^}]*font-family:\s*'Pixelify Sans'[^}]*url\('\/fonts\/pixelify-sans-latin\.woff2'\)/)
  assert.match(feuille, /@font-face\s*\{[^}]*font-family:\s*'Pixelify Sans'[^}]*url\('\/fonts\/pixelify-sans-latin-ext\.woff2'\)/)
  assert.doesNotMatch(feuille, /fonts\.(googleapis|gstatic)\.com/, 'rien n’est demandé ailleurs')
  for (const f of ['client/public/fonts/pixelify-sans-latin.woff2', 'client/public/fonts/pixelify-sans-latin-ext.woff2']) {
    assert.ok(existsSync(path.resolve(ici, '../..', f)), `${f} est hébergée`)
  }
  assert.match(lire('client/public/fonts/OFL-pixelify-sans.txt'), /SIL Open Font License/)
  // Ni la feuille de toutes les pages, ni la page servie, ni un thème ne la nomment : elle ne part qu'avec lui.
  assert.doesNotMatch(lire('client/src/styles.css'), /Pixelify/i)
  assert.doesNotMatch(lire('client/index.html'), /Pixelify/i)
  for (const f of readdirSync(path.join(client, 'themes')).filter(f => f.endsWith('.css'))) {
    assert.doesNotMatch(readFileSync(path.join(client, 'themes', f), 'utf8'), /Pixelify/i, f)
  }
})

// ── Muet par défaut ───────────────────────────────────────────────────────

test('le Sphinx est muet tant qu’on ne lui a pas donné la parole, et le retient sous try/catch', async () => {
  const { sonVoulu, retenirLeSon } = await import(url('sphinx.ts'))
  const memoire = (valeurs: Record<string, string> = {}) => ({
    getItem: (k: string) => valeurs[k] ?? null,
    setItem: (k: string, v: string) => void (valeurs[k] = v),
    valeurs,
  })
  assert.equal(sonVoulu(memoire()), false, 'rien de retenu : muet')
  assert.equal(sonVoulu(undefined), false, 'pas de stockage : muet')
  const refuse = {
    getItem: () => {
      throw new Error('stockage refusé')
    },
    setItem: () => {
      throw new Error('stockage refusé')
    },
  }
  assert.equal(sonVoulu(refuse), false, 'un stockage refusé ne fait pas sonner')
  assert.doesNotThrow(() => retenirLeSon(true, refuse))
  const m = memoire()
  retenirLeSon(true, m)
  assert.equal(sonVoulu(m), true, 'allumé, il le retient')
  retenirLeSon(false, m)
  assert.equal(sonVoulu(m), false)
  // Il ne passe pas par le son de l'écran commun, qui sonne d'office là-bas.
  assert.doesNotMatch(lire('client/src/components/Sphinx.tsx'), /from ['"]\.\.\/sound['"]/)
})

// ── La boîte, au lecteur d'écran et sans mouvement ────────────────────────

test('la réplique se dit entière au lecteur d’écran, jamais lettre par lettre', async () => {
  const html = await rendu('components/Sphinx.tsx', 'BoiteDuSphinx', {
    replique: '… Psst. *Léa*.',
    calme: false,
    attend: false,
    son: false,
    onSon: () => {},
  })
  const region = html.match(/<p[^>]*aria-live="polite"[^>]*>([^<]*)<\/p>/)
  assert.ok(region, 'une région qui se dit')
  assert.equal(blancs(region[1]), '… Psst. Léa.', 'la réplique entière, sans ses marques')
  // Les lettres qui s'écrivent une à une sont tues à l'oreille.
  assert.match(html, /<p[^>]*class="sx-texte"[^>]*aria-hidden="true"/)
  // Le haut-parleur se nomme, et dit s'il est allumé.
  assert.match(html, /<button[^>]*aria-pressed="false"[^>]*aria-label="Le son du Sphinx"/)
})

test('moins de mouvement : la réplique s’écrit d’un coup, sans mosaïque ni sable', async () => {
  const lettres = (html: string) => [...html.matchAll(/<span class="sx-l( sx-v)?"/g)].map(m => !!m[1])
  const calme = await rendu('components/Sphinx.tsx', 'BoiteDuSphinx', { replique: 'Je suis le Sphinx.', calme: true, attend: false, son: false, onSon: () => {} })
  assert.ok(lettres(calme).length > 10)
  assert.ok(lettres(calme).every(Boolean), 'toutes ses lettres d’un coup')
  const anime = await rendu('components/Sphinx.tsx', 'BoiteDuSphinx', { replique: 'Je suis le Sphinx.', calme: false, attend: false, son: false, onSon: () => {} })
  assert.ok(!lettres(anime).some(Boolean), 'sinon, elles s’écrivent une à une')
  // La visite lit le réglage du système, et sa feuille arrête ce qui bouge encore.
  assert.match(lire('client/src/components/Sphinx.tsx'), /prefers-reduced-motion: reduce/)
  assert.match(lire('client/src/components/sphinx.css'), /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.sx-scene/)
})

// ── Ses ailes, en fondu ───────────────────────────────────────────────────

test('ses ailes partent en fondu sur la toile qui porte la mosaïque et le dessin, sous « moins de mouvement » aussi', () => {
  const feuille = lire('client/src/components/sphinx.css')
  // Les règles de la toile : celle qui la pose, celle qui la masque.
  const regles = [...feuille.matchAll(/\.sx-sphinx canvas\s*\{([^}]*)\}/g)].map(m => m[1]).join('\n')
  for (const [prefixe, composition] of [
    ['-webkit-', /-webkit-mask-composite:\s*source-over,\s*source-over,\s*source-in,\s*source-over;/],
    ['', /(?<!-webkit-)mask-composite:\s*add,\s*add,\s*intersect,\s*add;/],
  ] as const) {
    const masque = regles.match(new RegExp(`(?<![\\w-])${prefixe}mask-image:\\s*([^;]+);`))
    assert.ok(masque, `la toile porte son ${prefixe || 'propre '}masque`)
    const couches = masque[1].split(/,\s*(?=(?:linear|radial)-gradient)/)
    assert.equal(couches.length, 4, 'le bas, la tête, le haut, les côtés')
    assert.match(couches[0], /linear-gradient\(to bottom, transparent \d+%, #000 \d+%\)/, 'le bas — le corps, la queue, les pattes — entier')
    assert.match(couches[1], /radial-gradient\(ellipse [\d.]+% [\d.]+% at [\d.]+% [\d.]+%, #000 \d+%, transparent 100%\)/, 'la tête entière')
    assert.match(couches[2], /linear-gradient\(to bottom, transparent, #000 \d+%\)/, 'le haut se fond')
    assert.match(couches[3], /linear-gradient\(to right, transparent, #000 \d+%, #000 \d+%, transparent\)/, 'les côtés se fondent')
    assert.match(regles, composition, `${prefixe || 'sans préfixe'} : les côtés croisés au haut, puis la tête et le bas ajoutés`)
  }
  // Rien ne le retire : ni « moins de mouvement », ni une autre règle de la feuille.
  assert.doesNotMatch(feuille, /mask(-image)?:\s*none/)
  // La mosaïque et le dessin se peignent sur la même toile : le masque vaut pour les deux.
  const visite = lire('client/src/components/Sphinx.tsx')
  assert.match(visite, /function peindre\(toile: HTMLCanvasElement/)
  assert.match(visite, /className=\{'sx-sphinx'/)
})

// ── L'énigme, sans clavier imposé ─────────────────────────────────────────

test('le champ de la réponse est nommé, et rien ne lui donne le focus d’office', async () => {
  const source = lire('client/src/components/Sphinx.tsx')
  assert.doesNotMatch(source, /autoFocus/, 'le clavier pousserait la boîte hors de l’écran')
  const html = await rendu('components/Sphinx.tsx', 'ParcheminDeLEnigme', {
    enigme: {
      numero: '32',
      sorte: 'enigme',
      vers: ['Premier vers,', 'Second vers.'],
      source: { recueil: 'Un million d’énigmes, charades et logogriphes, publié par Hilaire Le Gai (Pierre-Alexandre Gratet-Duplessis), Paris, Passard, 1858', page: '24', facSimile: 'https://fr.wikisource.org/' },
    },
    essaisRestants: 2,
    versMontres: 2,
    valeur: '',
    faux: false,
    onValeur: () => {},
    onRepondre: () => {},
    onChat: () => {},
  })
  assert.doesNotMatch(html, /autofocus/i)
  assert.match(html, /<label[^>]*for="sx-reponse"[^>]*>Ta réponse<\/label>/)
  assert.match(html, /<input[^>]*id="sx-reponse"/)
  assert.match(html, /aria-label="2 essais restants"/)
  assert.match(html, /L’énigme n°/)
  const charade = await rendu('components/Sphinx.tsx', 'ParcheminDeLEnigme', {
    enigme: { numero: '697', sorte: 'charade', vers: ['Mon premier…'], source: { recueil: 'Un recueil', page: '1', facSimile: 'https://fr.wikisource.org/' } },
    essaisRestants: 3,
    versMontres: 1,
    valeur: '',
    faux: false,
    onValeur: () => {},
    onRepondre: () => {},
    onChat: () => {},
  })
  assert.match(charade, /La charade n°/, 'une charade se présente comme telle')
})

// Le premier essai du propriétaire, en production, le 24 novembre 2026 : « un
// bouton qui permet de revenir plus tard si on ne veut pas y réfléchir de
// suite ». L'énigme ouverte n'avait que la langue au chat — Échap seul la
// remettait à plus tard, et un téléphone n'en a pas —, et le menu disait « Pas
// aujourd'hui » pour un Sphinx qui reste épinglé jusqu'à minuit.
test('l’énigme se remet à plus tard d’un toucher, ses essais gardés, et le Sphinx ne promet pas de revenir demain', async () => {
  const html = await rendu('components/Sphinx.tsx', 'ParcheminDeLEnigme', {
    enigme: { numero: '32', sorte: 'enigme', vers: ['Premier vers,'], source: { recueil: 'Un recueil', page: '1', facSimile: 'https://fr.wikisource.org/' } },
    essaisRestants: 2,
    versMontres: 1,
    valeur: '',
    faux: false,
    onValeur: () => {},
    onRepondre: () => {},
    onChat: () => {},
    onPlusTard: () => {},
  })
  // Les deux sorties, côte à côte sous la réponse : remettre à plus tard d'abord, abandonner ensuite.
  assert.match(html, /<div class="sx-issues"><button type="button" class="sx-plus-tard">Plus tard<\/button><button type="button" class="sx-chat">Je donne ma langue au chat<\/button><\/div>/)
  const source = lire('client/src/components/Sphinx.tsx')
  // Le menu dit ce que fait le Sphinx : il reste, épinglé, jusqu'à minuit.
  assert.doesNotMatch(source, /Pas aujourd’hui/)
  assert.match(source, /demander\(moi, texte, \[\s*\['oui', 'J’écoute !'\],\s*\['non', 'Plus tard'\],?\s*\]\)/)
  // Le geste part au serveur, qui garde ses essais et ses réponses (`sphinx-pur.test.ts`) ; puis le Sphinx s'épingle.
  assert.match(source, /envoyer\(moi, 'plus-tard'\)[\s\S]*?issue\.current\?\.\(\{ quoi: 'plus-tard', verdict: v \}\)/)
  assert.match(source, /if \(fin\.quoi === 'plus-tard'\) return remettre\(moi\)/)
  assert.match(source, /const remettre = async[\s\S]*?onPartir\('epingle'\)/)
  // Une visite n'arrive qu'un jour sur trois : « Reviens demain » promettait ce que le tirage ne tient pas.
  assert.doesNotMatch(source, /[Rr]eviens demain/)
})

// Il ne surgit qu'une fois par visite (le retour du propriétaire du 24 novembre 2026) : la page dit son arrivée au
// serveur, qui l'épingle ensuite (`sphinx-accueil.test.ts`). Dite avant qu'il soit là, une page fermée pendant son
// attente l'aurait épinglé sans qu'il ait jamais parlé.
test('la visite dit son arrivée au serveur, une fois le Sphinx à l’écran', () => {
  const source = lire('client/src/components/Sphinx.tsx')
  assert.match(source, /await arriver\(moi\)\s*\n(?:\s*\/\/.*\n)*\s*if \(v\.etat === 'proposee'\) void api\.joueur\.gesteDuSphinx\('surgir'\)\.catch\(\(\) => \{\}\)/)
})

// ── L'épingle, dans l'accueil ─────────────────────────────────────────────

test('l’épingle se pose près d’« Entre amis », hors de son nom, et rouvre la visite', async () => {
  // L'accueil lit son adresse en se chargeant (`routes.ts`) : celle de l'accueil, comme `accueil-compact.test.ts`.
  if (!('window' in globalThis)) {
    Object.assign(globalThis, { window: { location: { pathname: '/', search: '', hash: '', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} } })
  }
  const html = await rendu('components/AccueilDesRoles.tsx', 'AccueilJouer', {
    enCours: [],
    onRejoindre: () => {},
    lendemain: null,
    cabinet: false,
    epingle: (await import('react')).default.createElement('button', { className: 'sx-epingle', type: 'button' }),
  })
  const section = html.match(/<section[^>]*aria-labelledby="jouer-amis"[^>]*>([\s\S]*?)<\/section>/)
  assert.ok(section, 'la section « Entre amis »')
  assert.match(section[1], /<span class="label" id="jouer-amis">Entre amis<\/span><button class="sx-epingle"/, 'à côté de son nom, pas dedans')
  const epingle = await rendu('components/Sphinx.tsx', 'EpingleDuSphinx', { onOuvrir: () => {} })
  assert.match(epingle, /<button[^>]*type="button"[^>]*aria-label="Le Sphinx t’attend : écouter son énigme"/)
  assert.match(epingle, /sphinx-art-512\.[0-9a-f]{10}\.webp/, 'son médaillon, le grand')
})

// ── L'album ───────────────────────────────────────────────────────────────

const phrase = (plus: Partial<PhraseDuSphinx> = {}): PhraseDuSphinx => ({
  divin: { key: 'dv:osiris', nom: 'Osiris' },
  mots: [{ forme: '__', texte: 'Il', offert: true }, { forme: '_______' }, { forme: '___', texte: 'sur', offert: true }, { forme: '_____', texte: 'temps', sien: true }],
  aTrouver: 2,
  siens: 1,
  parTous: 2,
  reconstituee: false,
  ...plus,
})

test('l’album montre la phrase du Divin du moment à tout profil, et dit à qui n’est pas habitué comment le devenir', async () => {
  const lettres = await rendu('components/PhraseDuDivin.tsx', 'PhraseDuDivin', { phrase: phrase() })
  assert.match(lettres, /Il/)
  assert.match(lettres, /temps/)
  assert.match(lettres, /mot caché de 7 lettres/, 'un mot caché se dit par sa longueur')
  const compte = await rendu('components/PhraseDuDivin.tsx', 'CompteDeLaPhrase', { phrase: phrase() })
  assert.match(blancs(compte), /Toi : 1 mot/)
  assert.match(blancs(compte), /Tous les habitués : 2 sur 2/)
  assert.match(compte, /sx-jauge|phrase-jauge/)
  const novice = await rendu('components/PhraseDuDivin.tsx', 'ConseilDuSphinx', { phrase: phrase({ siens: 0 }), habitue: false })
  assert.match(blancs(novice), new RegExp(`Le Sphinx ne parle qu’aux habitués : joue ${JOURS_DE_L_HABITUE} jours sur ${FENETRE_DE_L_HABITUE}`))
  const habitue = await rendu('components/PhraseDuDivin.tsx', 'ConseilDuSphinx', { phrase: phrase(), habitue: true })
  assert.doesNotMatch(habitue, /ne parle qu’aux habitués/)
  // Ses barèmes viennent de `shared/sphinx.ts`, jamais recopiés.
  assert.doesNotMatch(lire('client/src/components/PhraseDuDivin.tsx'), /\b4 jours sur 7\b/)
  // L'album la lit à la demande, quand la page des Divins s'ouvre.
  const album = lire('client/src/components/AlbumDesAvatars.tsx')
  assert.match(album, /api\.joueur\.sphinx\(\)/)
  assert.match(album, /rarete === 'divin'/)
})

// ── Les mots des autres, inscrits sur sa phrase ──────────────────────────
//
// Le premier retour de la production, le 24 novembre 2026 : « Je vois nulle
// part où rentrer le mot des autres. » Dans l'album, chaque trait se touche
// pour y inscrire un mot qu'on lui a dit ; dessous, à qui les demander.

test('dans l’album, un trait se touche pour y inscrire un mot, un mot appris se lit en argent, et la liste dit à qui demander', async () => {
  const p = phrase()
  const caches = p.mots.flatMap((m: any, i: number) => (m.texte === undefined ? [i] : []))
  // Sans `onInscrire` — la visite —, rien ne se touche ; dans l'album, chaque trait caché est un bouton nommé.
  const visite = await rendu('components/PhraseDuDivin.tsx', 'PhraseDuDivin', { phrase: p })
  assert.doesNotMatch(visite, /<button/)
  const album = await rendu('components/PhraseDuDivin.tsx', 'PhraseDuDivin', { phrase: p, onInscrire: () => {}, choisie: caches[0] })
  assert.equal((album.match(/<button[^>]*phrase-a-inscrire/g) ?? []).length, caches.length)
  assert.match(album, /aria-label="mot caché de \d+ lettres : y inscrire un mot qu’on t’a dit"/)
  assert.match(album, /phrase-choisi[^>]*aria-pressed="true"/)
  // Un mot appris : à lui, en argent, à part de l'or des siens.
  const appris = { ...p, mots: p.mots.map((m: any, i: number) => (i === caches[0] ? { forme: m.forme, texte: 'Appris', appris: true } : m)), appris: 1 }
  assert.match(await rendu('components/PhraseDuDivin.tsx', 'PhraseDuDivin', { phrase: appris }), /phrase-trouve phrase-appris[^>]*>Appris</)
  assert.match(await rendu('components/PhraseDuDivin.tsx', 'CompteDeLaPhrase', { phrase: { ...appris, siens: 1 } }), /Toi\s:\s1 mot, 1 appris/)
  // Le champ : sa longueur dite, nommé, jamais de focus d'office.
  const champ = await rendu('components/PhraseDuDivin.tsx', 'InscrireUnMot', { phrase: p, place: caches[0], onInscrire: async () => ({ juste: true, erreursRestantes: 5 }), onFermer: () => {} })
  assert.match(champ, /<label for="phrase-inscrire-mot">Un mot qu’on t’a dit, pour ce trait\s:\s\d+ lettres?<\/label>/)
  assert.match(champ, /<input id="phrase-inscrire-mot"/)
  assert.doesNotMatch(lire('client/src/components/PhraseDuDivin.tsx'), /autoFocus/)
  // À qui demander : leur nom, leur compte, ses amis marqués ; touchés, leur carte.
  const qui = await rendu('components/PhraseDuDivin.tsx', 'QuiADesMotsDeLaPhrase', {
    phrase: { ...p, quiADesMots: [{ id: 'a', nom: 'Léa', mots: 3, ami: true }, { id: 'b', nom: 'Tom', mots: 1 }], autresQuiEnOnt: 2 },
    onOuvrir: () => {},
  })
  assert.match(qui, /<li class="phrase-qui-ami"><button[^>]*aria-label="Léa, 3 mots, ton ami : ouvrir sa carte"/)
  assert.match(qui, /aria-label="Tom, 1 mot : ouvrir sa carte"/)
  assert.match(qui, /et 2 autres/)
  assert.equal(await rendu('components/PhraseDuDivin.tsx', 'QuiADesMotsDeLaPhrase', { phrase: p }), '', 'personne : rien')
  // L'album les pose sous la phrase du Divin du moment et d'une phrase retrouvée pas encore lue ; le Sphinx dit où.
  const album2 = lire('client/src/components/AlbumDesAvatars.tsx')
  assert.match(album2, /api\.joueur\.inscrireUnMotDuSphinx\(cle, place, mot\)/)
  assert.match(album2, /<QuiADesMotsDeLaPhrase phrase=\{phrase\} onOuvrir=\{ouvrirLaCarte\} \/>/)
  assert.match(lire('client/src/components/Sphinx.tsx'), /dans ton album, tu inscriras leurs mots sur ta phrase/)
})

// ── Une phrase retrouvée par tous : un choix, jamais imposée ──────────────

test('une phrase retrouvée se dévoile à la demande : l’album la propose, la visite la propose, l’accueil l’annonce sans un mot', async () => {
  // L'album : ses mots, la forme du reste, et le geste — confirmé, puis ce qui s'y dévoile se retourne.
  const album = lire('client/src/components/AlbumDesAvatars.tsx')
  assert.match(album, /La phrase est retrouvée : la lire/)
  assert.match(album, /confirmDialog\(\{[\s\S]*?title: 'Lire la phrase entière \?'/)
  assert.match(album, /api\.joueur\.lirePhraseDuSphinx\(cle\)/)
  assert.match(album, /placesDevoilees\(avant, phrase\)/)
  // L'album n'emporte toujours pas la visite pour autant.
  assert.ok(!importsStatiques(path.join(client, 'components/AlbumDesAvatars.tsx')).has(path.join(client, 'components/Sphinx.tsx')))
  // La visite : le mot qui manquait à tous, et le Sphinx propose de la lire, ou pas maintenant.
  const visite = lire('client/src/components/Sphinx.tsx')
  assert.match(visite, /if \(entiere && apres\.aDevoiler\)/)
  assert.match(visite, /demander\(moi, DIT\.laLire, \[\s*\['lire', 'La lire'\],\s*\['plus-tard', 'Pas maintenant'\],?\s*\]\)/)
  // Ce qui s'y dévoile : seulement ce que la phrase d'après dit de plus.
  const { placesDevoilees } = await import(url('components/PhraseDuDivin.tsx'))
  assert.deepEqual(placesDevoilees(phrase(), phrase({ mots: [...phrase().mots.slice(0, 1), { forme: '_______', texte: 'Tsdfghj' }, ...phrase().mots.slice(2)] })), [1])
  // L'accueil : son Divin et ceux qui l'ont retrouvée, à la place d'« À la une », et toute la ligne mène à l'album.
  const html = await rendu('components/CarteDeLAdministrateur.tsx', 'CarteDeLAdministrateur', {
    annonce: { id: 'phrase:dv:osiris', sorte: 'phrase', divin: { key: 'dv:osiris', nom: 'Osiris' }, grace: ['Léa', 'Tom', 'Camille (2)'], autres: 4, le: 1 },
    prenom: 'Nina',
    onRanger: () => {},
  })
  assert.match(blancs(html), /<li class="annonce-phrase"><button type="button" class="annonce-phrase-ligne" aria-label="La phrase d’Osiris est retrouvée, grâce à Léa, Tom, Camille \(2\) et 4 autres\. La voir dans ton album">/)
  const feuille = lire('client/src/styles.css')
  assert.match(feuille, /\.accueil:has\(\.annonce-phrase\) \.une-cadre \{ display: none; \}/)
  assert.match(feuille, /\.accueil:has\(\.annonce-phrase\) \.haut-en-chemin \{ height: var\(--accueil-missions\); \}/)
  // Ce qui est vu se retient au serveur, une fois montré.
  assert.match(lire('client/src/components/AccueilDesRoles.tsx'), /if \(a\.sorte === 'phrase'\) api\.joueur\.phraseAnnoncee\(a\.divin\.key\)/)
})

// ── La phrase inventée des photos ─────────────────────────────────────────

test('la phrase inventée remplace la légende que lit le Sphinx, au banc seulement — jamais en ligne', async () => {
  // En ligne, `index.ts` ne pose ni la phrase inventée, ni la réserve, ni le tirage des tests.
  const enLigne = lire('server/src/index.ts')
  for (const option of ['phraseInventeeDuSphinx', 'enigmesDuSphinx', 'tirageDuSphinx']) assert.doesNotMatch(enLigne, new RegExp(option), option)
  const horloge = { t: Date.UTC(2026, 8, 26, 10, 0) }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, tirageDuSphinx: () => 0, phraseInventeeDuSphinx: INVENTEE })
  try {
    const admin = await connexionAnimateur(banc.url)
    assert.equal((await ecrire(banc.url, '/api/admin/maintenance/pages/sphinx', { etat: 'ouverte' }, admin, 'PUT')).status, 200)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const r = (await (await fetch(`${banc.url}/api/joueur/sphinx`, { headers: { Cookie: lea } })).json()) as { phrase: PhraseDuSphinx }
    const attendus = motsDeLaLegende(INVENTEE)
    assert.deepEqual(
      r.phrase.mots.map(m => m.forme),
      attendus.map(m => m.forme),
      'la forme de la phrase inventée',
    )
    assert.equal(r.phrase.aTrouver, attendus.filter(m => m.cache).length)
    assert.deepEqual(
      r.phrase.mots.filter(m => m.offert).map(m => m.texte),
      attendus.filter(m => !m.cache).map(m => m.texte),
      'ses petits mots offerts sont les siens',
    )
  } finally {
    await banc.close()
  }
})
