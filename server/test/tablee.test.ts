// La tablée — le banc où des agents jouent FiestApp au téléphone (skill
// `tablee`). Celle du Cabinet, le 25 octobre 2026, a faussé deux jeux sur
// trois retours (`retours/2026-10-25/synthese.md`, « Les limites ») : le
// pilote touchait le centre d'un élément — l'épingle tombait au milieu de la
// carte de France, le curseur du Filet ne bougeait que d'un cran à la fois —,
// `ecrire` dans un curseur répondait « Malformed value », et les personnages,
// qui savent tout, finissaient 24 parties sur 47 à 9 sur 9. Celle du 26
// (`retours/2026-10-26/synthese.md`, axe 12 et « Les limites ») : la photo
// d'une page entière prise avant ses images, le « R » du Mot qui touchait
// « Quitter », le domaine ignoré d'une manche sans catégorie, et un dé qui
// ignorait la marche de la question. La régie démarre un serveur et un
// Chromium dès son import : ce qu'elle lit sans navigateur — les arguments
// d'un geste, la vue que la page reçoit, la marche au plan figé — vit à part
// (`scripts/tablee/gestes.ts`), et le reste se relit dans les fichiers — un
// geste se dit à trois endroits (règle `tablee.md`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATEGORIES } from '../../shared/categories'
import { NIVEAUX, type Niveau } from '../../shared/campagne'
import { TAUX_DU_CALIBRAGE } from '../../shared/sentiers'
import { AFFIRMATIONS_DE_L_ECLAIR, MANCHES_PAR_PARTIE } from '../../shared/cabinet/bareme'
import {
  DES_PAR_GESTE_MAX,
  lancerLeDe,
  ligneDeLaMarche,
  lireLeDe,
  lireLeToucher,
  marchesASavoir,
  nomDUnSigneSeul,
  partieDeLaReponse,
  pointVise,
  retenirLaPartie,
  UN_CURSEUR_NE_SE_TAPE_PAS,
} from '../scripts/tablee/gestes'
import { inscrireProfil } from './banc'
import { bancDuCabinet, commencer, departEnBase, eclairDe, jouer, laPage, ok, pariDe } from './cabinet-banc'
import { tirageDe } from './cabinet-plans'
import { SOURCE as CALIBRAGE, sansCommentaires } from './calibrage-du-cabinet'

const lire = (chemin: string) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8')
const REGIE = lire('server/scripts/tablee/regie.ts')
/** Le corps d'un `case` de la régie, jusqu'à son accolade fermante (quatre espaces). */
const casDe = (geste: string) => new RegExp(`case '${geste}': \\{([\\s\\S]*?)\\n    \\}`).exec(REGIE)?.[1] ?? ''
/** Le corps d'une fonction de la régie, jusqu'à son accolade fermante en début de ligne. */
const fonctionDe = (nom: string) => new RegExp(`async function ${nom}\\(([\\s\\S]*?)\\n\\}\\n`).exec(REGIE)?.[1] ?? ''
const PILOTE = lire('server/scripts/tablee/pilote.mjs')
const AIDE = /const AIDE = `([\s\S]*?)`/.exec(PILOTE)?.[1] ?? ''
const SKILL = '.claude/skills/tablee'
const CONSIGNES = lire(`${SKILL}/consignes-cabinet.md`)
/** Les consignes en une ligne : une phrase cherchée ne dépend pas de l'endroit où le paragraphe revient à la ligne. */
const CONSIGNES_EN_LIGNE = CONSIGNES.replace(/\s+/g, ' ')
const FICHES = readdirSync(new URL(`../../${SKILL}/personas/`, import.meta.url))
  .filter(f => f.startsWith('cabinet-'))
  .map(f => ({ nom: f, texte: lire(`${SKILL}/personas/${f}`) }))
const OPHELIE = lire(`${SKILL}/personas/cabinet-ophelie.md`)

test('toucher --a : où toucher, en pour cent de la boîte de l’élément', () => {
  assert.deepEqual(lireLeToucher(['Ton estimation', '--a', '25%']), { cible: 'Ton estimation', visee: { x: 25, y: 50 } }, 'sans hauteur, au milieu')
  // Sans guillemets, la cible arrive en mots séparés ; « --a » vient après elle.
  assert.deepEqual(lireLeToucher(['La', 'carte', 'de', 'France', '--a', '60%,55%']), { cible: 'La carte de France', visee: { x: 60, y: 55 } })
  assert.deepEqual(lireLeToucher(['e12', '--a', '12.5']), { cible: 'e12', visee: { x: 12.5, y: 50 } }, 'un seul nombre : le % se sous-entend')
  assert.deepEqual(lireLeToucher(['e12', '--a', '12.5%,0%']), { cible: 'e12', visee: { x: 12.5, y: 0 } }, 'une décimale, après un point')
  // « 60%, 55% » tapé avec une espace : deux arguments, la même visée.
  assert.deepEqual(lireLeToucher(['e7', '--a', '60%,', '55%']), { cible: 'e7', visee: { x: 60, y: 55 } })
  assert.deepEqual(lireLeToucher(['Jouer', 'sans', 'compte']), { cible: 'Jouer sans compte', visee: null }, 'sans --a, le centre, comme avant')
  for (const malformes of [['e12', '--a'], ['e12', '--a', '130%'], ['e12', '--a', 'droite'], ['e12', '--a', '30%,55%,2%'], ['--a', '30%']]) {
    const refus = lireLeToucher(malformes)
    assert.equal(typeof refus, 'string', `refusé en mots : ${malformes.join(' ')}`)
  }
  assert.match(String(lireLeToucher(['e12', '--a', '130%'])), /--a 30%/, 'le refus dit comment viser')
})

test('toucher --a : une décimale à la française ne se lit pas en silence comme deux axes', () => {
  // « 62,5% » se lisait 62 % de large et 5 % de haut : l'épingle plantée au
  // bord nord de la carte de France, sans un mot. Deux nombres portent chacun
  // leur « % », et le refus dit le point.
  for (const francaise of ['62,5%', '12,5', '60,55%', '60%,55']) {
    const refus = lireLeToucher(['La carte de France', '--a', francaise])
    assert.equal(typeof refus, 'string', `refusé : --a ${francaise}`)
    assert.match(String(refus), /62\.5%/, `--a ${francaise} : le refus dit la décimale après un point`)
    assert.match(String(refus), /--a 60%,55%/, `--a ${francaise} : le refus dit les deux axes`)
  }
})

test('toucher --a : entre les guillemets de la cible, le refus dit de l’en sortir', () => {
  // `toucher "Ton estimation --a 30%"` cherchait un élément de ce nom, et
  // finissait en « Rien de visible ne s'appelle… » sans dire comment viser.
  for (const args of [['Ton estimation --a 30%'], ['Ton estimation --a30%'], ['--a30%']]) {
    const refus = lireLeToucher(args)
    assert.equal(typeof refus, 'string', `refusé : ${args.join(' ')}`)
    assert.match(String(refus), /hors des guillemets/, `${args.join(' ')} : le refus le dit`)
    assert.match(String(refus), /toucher "Ton estimation" --a 30%/)
  }
})

test('la régie branche ce qu’elle lit : toucher vise là où on le lui dit', () => {
  // gestes.ts lit les arguments ; sans ces branchements, il resterait juste et
  // le pilote toucherait encore le centre — le défaut même de la tablée.
  assert.match(casDe('toucher'), /lireLeToucher\(args\)/)
  assert.match(casDe('toucher'), /await toucher\(p, [^\n]*lu\.cible\)?, lu\.visee\)/, '« toucher » passe la visée au doigt')
  const doigt = fonctionDe('toucher')
  assert.match(doigt, /visee: Visee \| null/)
  assert.match(doigt, /position = pointVise\(boite, visee\)/, 'le point visé, dans la boîte de l’élément')
  assert.match(doigt, /\.tap\(\{[^}]*\bposition\b[^}]*\}\)/, 'le doigt touche au point visé')
  assert.match(doigt, /\.click\(\{[^}]*\bposition\b[^}]*\}\)/, 'la souris aussi')
})

test('le point visé reste dans l’élément : une visée à 100 % touche son dernier pixel, pas le voisin', () => {
  assert.deepEqual(pointVise({ width: 200, height: 40 }, { x: 25, y: 50 }), { x: 50, y: 20 })
  assert.deepEqual(pointVise({ width: 200, height: 40 }, { x: 100, y: 100 }), { x: 199, y: 39 })
  assert.deepEqual(pointVise({ width: 200, height: 40 }, { x: 0, y: 0 }), { x: 0, y: 0 })
})

test('un curseur ne se tape pas : le refus dit le geste qui le règle', () => {
  assert.match(UN_CURSEUR_NE_SE_TAPE_PAS, /^Un curseur ne se tape pas : touche-le où tu veux, --a 30%/)
  // `ecrire` et `coller` le lisent avant de toucher le champ, et avant `fill('')`, que Playwright refuse sur un curseur.
  for (const geste of ['ecrire', 'coller']) {
    const corps = new RegExp(`case '${geste}': \\{([\\s\\S]*?)\\n    \\}`).exec(REGIE)?.[1] ?? ''
    assert.match(corps, /refuserUnCurseur\(/, `« ${geste} » refuse un curseur`)
    assert.ok(corps.indexOf('refuserUnCurseur(') < corps.search(/toucher\(p, el\)/), `« ${geste} » refuse avant de toucher`)
  }
})

test('le dé : six faces d’office, un seul ; plusieurs d’un coup, à l’annonce, avant que le chrono coure', () => {
  assert.deepEqual(lireLeDe([]), { faces: 6, fois: 1 })
  assert.deepEqual(lireLeDe(['12']), { faces: 12, fois: 1 })
  assert.deepEqual(lireLeDe(['12', '9']), { faces: 12, fois: 9 })
  assert.deepEqual(lireLeDe(['2', String(DES_PAR_GESTE_MAX)]), { faces: 2, fois: DES_PAR_GESTE_MAX })
  // Une partie de l'Éclair, d'un geste — au barème du jour, et les consignes le disent.
  const eclair = AFFIRMATIONS_DE_L_ECLAIR * MANCHES_PAR_PARTIE
  assert.ok(DES_PAR_GESTE_MAX >= eclair, `toute une partie de l’Éclair d’un geste : ${eclair} dés`)
  assert.match(CONSIGNES_EN_LIGNE, new RegExp(`\`de 12 ${eclair}\` pour l['’]Éclair`), 'les consignes disent combien de dés pour l’Éclair')
  for (const faux of [['1'], ['0'], ['101'], ['douze'], ['4.5'], ['12', '0'], ['12', String(DES_PAR_GESTE_MAX + 1)], ['12', '3', '4']]) {
    assert.equal(typeof lireLeDe(faux), 'string', `refusé : de ${faux.join(' ')}`)
  }
})

test('le dé lancé : ses tirages à l’agent, et au journal des gestes', () => {
  const pipe = [3, 12, 7]
  const lance = lancerLeDe('camille', { faces: 12, fois: 3 }, () => pipe.shift()!)
  assert.deepEqual(lance.auJournal, { faces: 12, tirages: [3, 12, 7] }, 'le journal garde chaque tirage, et ses faces')
  assert.match(lance.sortie, /camille lance 3 dés : 3, 12, 7 \(de 1 à 12\)/)
  assert.match(lancerLeDe('hugo', { faces: 4, fois: 1 }, () => 2).sortie, /hugo lance le dé : 2 \(de 1 à 4\)/)
  // Le vrai hasard : chaque face, et rien hors d'elles.
  const vus = new Set(lancerLeDe('theo', { faces: 4, fois: DES_PAR_GESTE_MAX }).auJournal.tirages)
  for (let i = 0; i < 20; i++) for (const t of lancerLeDe('theo', { faces: 4, fois: DES_PAR_GESTE_MAX }).auJournal.tirages) vus.add(t)
  assert.deepEqual([...vus].sort(), [1, 2, 3, 4])
})

test('la régie branche le dé : sans allumer d’appareil, ses tirages au journal', () => {
  const de = /if \(geste === 'de'\) \{([\s\S]*?)\n {2}\}/.exec(REGIE)
  assert.ok(de, 'la régie lance le dé')
  assert.match(de[1], /lireLeDe\(args\)/)
  assert.match(de[1], /return lancerLeDe\(qui, /, 'la sortie et le journal du dé : lancerLeDe')
  // Avant le premier geste, le dé n'allume pas l'appareil : « appareil » refuserait ensuite celui de la fiche.
  assert.ok(de.index < REGIE.indexOf('participants.get(qui) ?? (await allumer('), 'le dé vient avant l’appareil allumé d’office')
  // La porte écrit au journal ce que le geste lui donne de plus que ses arguments.
  assert.match(REGIE, /consigner\(\{[^\n]*ok: true[^\n]*\.\.\.\(typeof fait === 'string' \? \{\} : fait\.auJournal\)/)
})

test('la chronologie range les dés de chacun : la synthèse y relit si le dé a décidé', () => {
  const dossier = mkdtempSync(path.join(tmpdir(), 'tablee-'))
  try {
    const lignes = [
      { t: '2026-10-26T10:00:00.000Z', qui: 'camille', geste: 'de', args: ['12', '3'], ok: true, ms: 2, faces: 12, tirages: [3, 12, 7] },
      { t: '2026-10-26T10:00:05.000Z', qui: 'camille', geste: 'toucher', args: ['Commencer'], ok: true, ms: 300 },
      { t: '2026-10-26T10:00:20.000Z', qui: 'camille', geste: 'de', args: ['4'], ok: true, ms: 1, faces: 4, tirages: [2] },
      { t: '2026-10-26T10:01:00.000Z', qui: 'hugo', geste: 'de', args: ['douze'], ok: false, erreur: 'Un dé de 2 à 100 faces…', ms: 1 },
    ]
    writeFileSync(path.join(dossier, 'journal.jsonl'), lignes.map(l => JSON.stringify(l)).join('\n') + '\n')
    const script = fileURLToPath(new URL('../scripts/tablee/chronologie.mjs', import.meta.url))
    const page = execFileSync(process.execPath, [script, dossier], { encoding: 'utf8' })
    const des = page.split('## Les dés')[1]?.split('\n## ')[0] ?? ''
    assert.ok(des, 'une section « Les dés »')
    assert.match(des, /camille[^\n]*de 12 → 3, 12, 7[^\n]*de 4 → 2/, 'chaque lancer, dans l’ordre, ses faces et ses tirages')
    assert.doesNotMatch(des, /hugo/, 'un dé refusé n’a rien tiré')
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('un geste se dit à trois endroits : la régie, l’aide du pilote, les consignes', () => {
  // Chaque geste que la régie connaît, l'aide le nomme : un agent ne connaît que l'aide.
  const gestes = [...REGIE.matchAll(/case '([a-z-]+)':|geste === '([a-z-]+)'/g)].map(m => m[1] ?? m[2])
  assert.ok(gestes.length > 30, 'les gestes de la régie se lisent')
  assert.ok(gestes.includes('de'), 'la régie lance le dé')
  // Au début d'une ligne de l'aide, après un « · » ou derrière « regie » : là
  // où l'aide nomme un geste. N'importe où, « voir » et « texte » passaient
  // leur ligne effacée — « le texte visible », « voir donne les références ».
  const absents = [...new Set(gestes)].filter(g => !new RegExp(`(^ {2}|· |regie )${g}(?![\\w-])`, 'm').test(AIDE))
  assert.deepEqual(absents, [], 'des gestes de la régie que l’aide du pilote ne dit pas')
  assert.match(AIDE, /^ {2}de \[faces\]/m, 'l’aide dit le dé')
  assert.match(AIDE, /toucher <ref\|texte> \[--a <x>%\[,<y>%\]\]/, 'l’aide dit --a')
  assert.match(AIDE, /toucher "Ton estimation" --a 30%/)
  assert.match(AIDE, /12\.5%/, 'l’aide dit la décimale après un point')
  // Les consignes du Cabinet : le Filet et l'Épingle au doigt, le curseur au clavier, le dé.
  assert.match(CONSIGNES, /tu joues par [^\n]*`de`/, 'les gestes du Cabinet comptent le dé')
  assert.match(CONSIGNES, /toucher "Ton estimation" --a 30%/)
  assert.match(CONSIGNES, /--a 60%,55%/)
  assert.match(CONSIGNES, /12\.5%/, 'une décimale après un point')
  assert.match(CONSIGNES, /touche Tab/, 'un curseur s’atteint par Tab avant les flèches')
  // Au Filet, le bouton d'avant le curseur est « Un cran de moins » : y partir recule d'un cran.
  assert.match(CONSIGNES_EN_LIGNE, /« Un cran de moins »[^.]*recule d['’]un cran/, 'partir de « Un cran de moins » recule d’un cran : les consignes le disent')
  assert.match(CONSIGNES, /`de 12`/)
})

test('le dé suit le calibrage : un tirage par chose à savoir, qui ne se refait pas', () => {
  // Le modèle du calibrage décide une fois par manche si le joueur reconnaît le
  // tableau du Détail (et à quel cadrage), la personne des Indices (et à quel
  // indice) : un second tirage au tableau plus grand le faisait reconnaître
  // presque toujours, au-dessus de sa ligne.
  assert.match(CONSIGNES_EN_LIGNE, /Un tirage ne se refait pas/)
  assert.doesNotMatch(CONSIGNES, /relance/, 'aucun second tirage')
  const detail = /\*\*Le Détail\*\* : ([^\n]+(?:\n[^\n-][^\n]*)*)/.exec(CONSIGNES)?.[1] ?? ''
  assert.match(detail, /premier cadrage/, 'au Détail, le tirage dit aussi le cadrage')
  const indices = /\*\*Les Indices\*\* : ([^\n]+(?:\n[^\n-][^\n]*)*)/.exec(CONSIGNES)?.[1] ?? ''
  assert.match(indices, /premier indice/, 'aux Indices, le tirage dit aussi l’indice')
  // Un personnage ignore des domaines, le joueur « tablée » du calibrage non :
  // sa ligne ne se compare qu'aux manches d'ailleurs, que le retour désigne.
  assert.match(CONSIGNES_EN_LIGNE, /[Hh]ors de tes domaines d['’]ignorance, le dé décide/)
  assert.match(CONSIGNES_EN_LIGNE, /ton domaine d['’]ignorance a joué/, 'le retour dit les manches d’un domaine ignoré')
  assert.match(lire(`${SKILL}/SKILL.md`), /calibrage-cabinet\.ts --joueurs tablée/, 'la skill fait comparer la tablée au calibrage')
})

test('les personnages du Cabinet ignorent des choses, et le dé décide ailleurs', () => {
  assert.equal(FICHES.length, 6, 'les six personnages du Cabinet')
  // La part du calibrage : celle de son joueur « tablée », que la synthèse compare jeu par jeu.
  assert.match(CONSIGNES, /joueur « tablée »/)
  assert.match(CONSIGNES, /calibrage-cabinet\.ts/)
  for (const { nom, texte } of FICHES) {
    const ignore = (/\*\*Ce qu['’](?:il|elle) ignore\*\* : ([^\n]+(?:\n[^\n*]+)*)/.exec(texte)?.[1] ?? '').replace(/\s+/g, ' ')
    assert.ok(ignore, `${nom} : ses domaines d’ignorance`)
    assert.ok(
      CATEGORIES.some(c => ignore.includes(`« ${c} »`)),
      `${nom} : ses domaines se disent dans les mots des catégories (« Sport », « Cinéma & séries »…), ceux que l’écran affiche`,
    )
    assert.match(texte, /le dé/, `${nom} : hors de ses domaines, le dé`)
    assert.doesNotMatch(texte, /(excellente|bonne) culture générale/, `${nom} : une fiche qui promet de tout savoir fait tout savoir`)
  }
})

test('quitter une partie du Cabinet : « Quitter », puis « Quitter la partie »', () => {
  // Deux boutons « Quitter » se confondaient au pilote (la tête de la manche et
  // la confirmation) : celle-ci dit « Quitter la partie » (lot de la page).
  assert.match(CONSIGNES, /« Quitter la partie »/)
  for (const { nom, texte } of FICHES) {
    if (/quitte|« Quitter »/.test(texte)) assert.match(texte, /« Quitter la partie »|« Continuer »/, `${nom} : le bouton qu’on touche à la question`)
  }
  // Les mots que la page pose vraiment sur la confirmation : renommée là, la tablée toucherait un bouton qui n'existe plus.
  assert.match(lire('client/src/views/cabinet/Partie.tsx'), /confirmLabel: 'Quitter la partie', cancelLabel: 'Continuer'/)
})

// ── Ce que la tablée du 26 octobre 2026 a pris pour l'application ──────────

test('la photo attend ses polices et ses images, trois secondes au plus', () => {
  // La Citrouille en disque irisé vide au bilan, chez trois personnages : la page entière photographiée sans défiler, pendant
  // que six onglets tournaient, l'image hors de l'écran pas encore décodée — le décodage d'une image qu'on ne voit pas est
  // asynchrone (`Legendaire.tsx`). `rendu-cabinet.ts` l'attendait déjà ; la régie photographiait sans l'attendre.
  const capture = casDe('capture')
  const attente = capture.indexOf('await attendreSesImages(page)')
  assert.ok(attente >= 0, '« capture » attend les images de la page')
  assert.ok(attente < capture.indexOf('page.screenshot('), 'avant la photo')
  const corps = fonctionDe('attendreSesImages')
  assert.match(corps, /document\.fonts\.ready/, 'les polices d’abord')
  assert.match(corps, /\.decode\(\)\.catch\(/, 'chaque image décodée — une image qui ne se décode pas ne bloque rien')
  assert.match(corps, /Promise\.race\(/)
  assert.match(corps, /ATTENTE_DES_IMAGES_MS/)
  assert.match(REGIE, /const ATTENTE_DES_IMAGES_MS = 3000\b/, 'trois secondes au plus, comme les rendus')
  // Une image paresseuse hors de l'écran ne se charge pas : son decode() aurait fait attendre les trois secondes à chaque photo.
  assert.match(corps, /loading !== 'lazy'/)
})

test('une lettre seule vise la touche de ce nom, jamais un nom qui la contient', () => {
  // Une fois colorée, la touche du Mot s'appelle « R , bien placée » : le pilote ne trouvait plus « R » exact, et prenait le
  // premier bouton dont le nom contient un « r » — « Quitter », chez Lucas, puis quatre gestes refusés derrière la fenêtre.
  const r = nomDUnSigneSeul('R')
  assert.ok(r instanceof RegExp, 'une lettre seule a sa règle')
  for (const nom of ['R', 'R , bien placée', 'R, ailleurs dans le mot', 'R , absente']) assert.ok(r.test(nom), `« ${nom} » est la touche R`)
  for (const nom of ['Quitter', 'Rejouer', 'Revenir au musée', 'Ranger, plus tard', 'RA']) assert.ok(!r.test(nom), `« ${nom} » n’est pas la touche R`)
  assert.ok(nomDUnSigneSeul('r')!.test('R , bien placée'), 'tapée en minuscule, la touche que l’écran écrit en capitale')
  assert.ok(nomDUnSigneSeul('7')!.test('7'), 'un chiffre aussi')
  // Plus d'un signe, ou un emoji — l'avatar « Avatar 🦊 » se trouve par le sien — : la recherche d'avant.
  for (const cible of ['Quitter', 'R2', '🦊', '']) assert.equal(nomDUnSigneSeul(cible), null, `« ${cible} »`)
  // Branchée : après les noms exacts, une lettre seule ne cherche plus de nom qui la contienne.
  const localiser = fonctionDe('localiser')
  assert.match(localiser, /const signe = nomDUnSigneSeul\(cible\)/)
  assert.match(localiser, /signe\s*\?\s*\[\s*page\.getByRole\('button', \{ name: signe \}\)/)
})

test('à défaut de catégorie, le domaine ignoré se lit au sujet', () => {
  // Cinq jeux n'affichent pas de catégorie : Jeanne (« Le Dîner de cons »), Ophélie (Perrault) et Théo (Brillat-Savarin) ont
  // tranché chacun à sa façon, et la synthèse a dû deviner lesquelles de leurs manches comparer au calibrage.
  const regle = /[Àà] défaut de catégorie[^.]*\./.exec(CONSIGNES_EN_LIGNE)?.[0] ?? ''
  assert.ok(regle, 'la règle est dans les consignes')
  for (const jeu of ['Détail', 'Indices', 'Réplique', 'Frise', 'Épingle']) assert.match(regle, new RegExp(jeu), `elle nomme ${jeu}`)
  assert.match(regle, /le domaine se lit au sujet/)
  // Les exemples parlent dans les mots des catégories de l'écran, ceux des fiches.
  for (const [sujet, categorie] of [
    ['un tableau', 'Arts & lettres'],
    ['un livre', 'Arts & lettres'],
    ['une pièce de théâtre', 'Arts & lettres'],
    ['un film', 'Cinéma & séries'],
    ['une chanson', 'Musique'],
    ['un plat', 'Cuisine'],
  ] as const) {
    assert.ok((CATEGORIES as readonly string[]).includes(categorie), categorie)
    assert.match(regle, new RegExp(`${sujet}[^«]*« ${categorie} »`), `${sujet} : « ${categorie} »`)
  }
  assert.match(regle, /thème de l['’]Épingle ou de la Frise se lit de même/)
})

// ── Le dé, marche par marche, aux parts du calibrage ──────────────────────

/** Le code du calibrage, ses commentaires ôtés et ses blancs ramenés à un : ce que le dé recopie s'y cherche tel quel. */
const MODELE_DU_CALIBRAGE = sansCommentaires(CALIBRAGE).replace(/\s+/g, ' ')
/** La force d'un joueur du calibrage, lue dans sa déclaration. */
function forceDe(nom: string): number {
  const m = new RegExp(`nom: '${nom}', theta: (-?[\\d.]+)`).exec(MODELE_DU_CALIBRAGE)
  assert.ok(m, `le calibrage déclare le joueur « ${nom} »`)
  return Number(m[1])
}
/** Les parts du modèle du calibrage (`MODELE`) : des nombres et des listes, sans accolade dedans. */
const BLOC_DU_MODELE = /const MODELE = \{(.*?)\}/.exec(MODELE_DU_CALIBRAGE)?.[1] ?? ''
function partDuModele(cle: string): number {
  const m = new RegExp(`\\b${cle}: (-?[\\d.]+)`).exec(BLOC_DU_MODELE)
  assert.ok(m, `MODELE.${cle}`)
  return Number(m[1])
}
function partsDuModele(cle: string): number[] {
  const m = new RegExp(`\\b${cle}: \\[([^\\]]*)\\]`).exec(BLOC_DU_MODELE)
  assert.ok(m, `MODELE.${cle}`)
  return m[1].split(',').map(Number)
}

const sigmoide = (x: number) => 1 / (1 + Math.exp(-x))
const logit = (p: number) => Math.log(p / (1 - p))
const chance = (base: number, theta: number) => sigmoide(logit(base) + theta)
/** Ce qu'un joueur de cette force sait vraiment d'une question de la base, sans deviner parmi ses quatre réponses. */
const sait = (theta: number, n: Niveau) => Math.max(0, (chance(TAUX_DU_CALIBRAGE[n], theta) - 1 / 4) / (1 - 1 / 4))
const filetSait = (theta: number, n: Niveau) =>
  chance(partDuModele('filetSait'), theta + logit(TAUX_DU_CALIBRAGE[n]) - logit(TAUX_DU_CALIBRAGE.moyen))
/** La part de chaque rang — l'indice, le cadrage — selon sa force : le logit ordinal du calibrage. */
function partsSelonLaForce(parts: readonly number[], theta: number): number[] {
  let cumul = 0
  let avant = 0
  return parts.map((p, k) => {
    cumul += p
    const jusquIci = k === parts.length - 1 ? 1 : sigmoide(logit(Math.min(1 - 1e-12, cumul)) + theta)
    const x = jusquIci - avant
    avant = jusquIci
    return x
  })
}
/** Un seuil du dé à douze faces : le douzième le plus proche. */
const surDouze = (p: number) => Math.round(12 * p)
/** Les seuils cumulés d'un tirage qui dit aussi le rang : reconnu au plus tard au rang k si le dé fait au plus… */
function seuilsDesRangs(theta: number, reconnu: string, auRang: string): number[] {
  const p = chance(partDuModele(reconnu), theta)
  let cumul = 0
  return partsSelonLaForce(partsDuModele(auRang), theta).map(x => surDouze(p * (cumul += x)))
}

/** Le dé d'un joueur du calibrage, tel que ses consignes doivent le dire. */
function deAttendu(theta: number) {
  return {
    base: NIVEAUX.map(n => surDouze(sait(theta, n))),
    filet: NIVEAUX.map(n => surDouze(filetSait(theta, n))),
    frise: surDouze(chance(partDuModele('friseSait'), theta)),
    mot: surDouze(chance(partDuModele('repliqueMot'), theta)),
    // Qui l'a dite : le calibrage la décide d'après le mot — su, à sa part fixe ; sinon, à la part du joueur.
    qui: [surDouze(partDuModele('repliqueQuiSiMot')), surDouze(chance(partDuModele('repliqueQui'), theta))],
    lieu: surDouze(chance(partDuModele('epingleSait'), theta)),
    detail: seuilsDesRangs(theta, 'detailReconnu', 'detailAuCadrage'),
    indices: seuilsDesRangs(theta, 'indicesReconnu', 'indicesAuRang'),
  }
}

/** Les lignes d'un tableau en Markdown, de l'en-tête qui répond à `entete` jusqu'à la première ligne qui n'en est pas. */
function tableau(texte: string, entete: RegExp): string[][] {
  const lignes = texte.split('\n')
  const i = lignes.findIndex(l => /^\s*\|/.test(l) && entete.test(l))
  assert.ok(i >= 0, `un tableau ${entete}`)
  const corps: string[][] = []
  for (const l of lignes.slice(i + 1)) {
    if (!/^\s*\|/.test(l)) break
    if (/^\s*\|\s*-/.test(l)) continue
    corps.push(l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()))
  }
  return corps
}
/** Un seuil écrit : un nombre, ou « jamais ». */
const seuilEcrit = (c: string) => (c === 'jamais' ? 0 : Number(c))
const ligneDe = (corps: string[][], quoi: RegExp) => {
  const l = corps.find(c => quoi.test(c[0]))
  assert.ok(l, `une ligne ${quoi}`)
  return l
}
const RANGS = ['premier', 'deuxième', 'troisième', 'quatrième', 'cinquième']
/** Le tableau des rangs sous « **Le Détail** » ou « **Les Indices** », relu en seuils cumulés : reconnu au plus tard au rang k. */
function rangsEcrits(texte: string, titre: string): number[] {
  assert.ok(texte.includes(titre), titre)
  const corps = tableau(texte.slice(texte.indexOf(titre)), /\| Le dé \|/)
  const seuils = RANGS.map(() => 0)
  // Chaque face une fois, de 1 à 12, dans l'ordre.
  let prochaine = 1
  for (const [de, rang] of corps) {
    const m = /^(?:de (\d+) à (\d+)|(\d+) ou (\d+)|(\d+))$/.exec(de)
    assert.ok(m, `« ${de} » se lit`)
    assert.equal(Number(m[1] ?? m[3] ?? m[5]), prochaine, `${titre} : « ${de} » suit la face d’avant`)
    const jusqua = Number(m[2] ?? m[4] ?? m[5])
    prochaine = jusqua + 1
    if (rang === 'jamais') continue
    const k = RANGS.findIndex(r => rang.startsWith(`au ${r} `))
    assert.ok(k >= 0, `« ${rang} » se lit`)
    seuils[k] = jusqua
  }
  assert.equal(prochaine, 13, `${titre} : les douze faces`)
  // Un rang que le dé ne donne jamais reprend le seuil d'avant : les seuils sont cumulés.
  for (let k = 1; k < seuils.length; k++) seuils[k] = Math.max(seuils[k], seuils[k - 1])
  return seuils
}
/** Le dé que dit un texte — les consignes, ou la fiche d'un personnage qui a le sien. */
function deEcrit(texte: string, rangs: { detail: number; indices: number }) {
  const marches = tableau(texte, /facile \| moyenne \| difficile \| experte/)
  const sansMarche = tableau(texte, /sans marche \| Au plus/)
  const qui = (ligneDe(sansMarche, /^Qui a dit/)[1].match(/\d+/g) ?? []).map(Number)
  return {
    base: ligneDe(marches, /Pari/).slice(1).map(seuilEcrit),
    filet: ligneDe(marches, /Filet/).slice(1).map(seuilEcrit),
    frise: seuilEcrit(ligneDe(sansMarche, /Frise/)[1]),
    mot: seuilEcrit(ligneDe(sansMarche, /mot de la Réplique/)[1]),
    // Un seul nombre : le même, qu'il sache le mot ou non.
    qui: qui.length === 1 ? [qui[0], qui[0]] : qui,
    lieu: seuilEcrit(ligneDe(sansMarche, /Épingle/)[1]),
    detail: rangsEcrits(texte, '**Le Détail**').slice(0, rangs.detail),
    indices: rangsEcrits(texte, '**Les Indices**').slice(0, rangs.indices),
  }
}

test('le dé lit ce que lit le calibrage : les mêmes parts, la même marche', () => {
  // Le dé tient lieu du savoir du joueur que le calibrage simule : chaque chose à savoir, à la part dont le calibrage la tire.
  // Une part qui change de forme — la marche oubliée, un rang de plus — se recopie dans les consignes (règle `tablee.md`).
  for (const fragment of [
    'const chance = (base: number, theta: number) => sigmoide(logit(base) + theta)',
    'chance(TAUX_DU_CALIBRAGE[n], j.theta)',
    'const sait = (j: Joueur, n: Niveau, propositions = 4) => (j.theta === null ? 0 : Math.max(0, (trouve(j, n, propositions) - 1 / propositions) / (1 - 1 / propositions)))',
    'const filetSait = (j: Joueur, n: Niveau) => (j.theta === null ? 0 : chance(MODELE.filetSait, j.theta + logit(TAUX_DU_CALIBRAGE[n]) - logit(TAUX_DU_CALIBRAGE.moyen)))',
    'const part = (j: Joueur, base: number) => (j.theta === null ? 0 : chance(base, j.theta))',
    'sigmoide(logit(Math.min(1 - 1e-12, cumul)) + theta)',
    // Le Pari, l'Éclair et le Mot savent une question de la base à sa marche ; le Filet, sa valeur à la sienne.
    'sait(p.j, t.q1.niveau)',
    'sait(p.j, t.q2.niveau)',
    'sait(p.j, a.question.niveau)',
    'sait(p.j, t.question.niveau)',
    'filetSait(p.j, t.question.niveau)',
    // Le reste n'a pas de marche.
    'part(p.j, MODELE.detailReconnu)',
    'rangSelonLaForce(MODELE.detailAuCadrage, p.j, p.r)',
    'part(p.j, MODELE.friseSait)',
    'part(p.j, MODELE.epingleSait)',
    'part(p.j, MODELE.indicesReconnu)',
    'rangSelonLaForce(MODELE.indicesAuRang, p.j, p.r)',
    'part(p.j, MODELE.repliqueMot)',
    'mot ? MODELE.repliqueQuiSiMot : part(p.j, MODELE.repliqueQui)',
  ]) {
    assert.ok(MODELE_DU_CALIBRAGE.includes(fragment), `le calibrage lit encore : ${fragment}`)
  }
})

test('le dé des consignes est celui du joueur « tablée » du calibrage, marche par marche', () => {
  // La tablée du 26 octobre 2026 : un seul seuil pour toute question de la base — Ophélie a fait 9 sur 9 à un Mot visé épique,
  // ses deux questions difficiles sues comme des faciles. La marche, que l'écran tait, le banc la dit pendant la manche.
  const attendu = deAttendu(forceDe('tablée'))
  assert.deepEqual(attendu.base, [12, 11, 9, 5], 'les seuils que la synthèse a lus au calibrage')
  assert.deepEqual(deEcrit(CONSIGNES, { detail: attendu.detail.length, indices: attendu.indices.length }), attendu)
  assert.match(CONSIGNES_EN_LIGNE, /🎲 Pour ton dé, la marche/, 'les consignes disent où lire la marche')
})

test('Ophélie joue au dé de l’occasionnel, et se compare à sa ligne', () => {
  // Le dé à 11 sur 12 est celui du dernier centile : la tablée ne mesurait que des joueurs forts. Ophélie, la joueuse du métro,
  // sait ce que sait l'occasionnel du calibrage ; ses étoiles se comparent aux siennes.
  const attendu = deAttendu(forceDe('occasionnel'))
  assert.deepEqual(attendu.base.slice(0, 2), [8, 3], 'les seuils que la synthèse a lus au calibrage')
  assert.match(OPHELIE, /\*\*Son dé\*\*[^\n]*occasionnel/, 'sa fiche le dit')
  assert.deepEqual(deEcrit(OPHELIE, { detail: attendu.detail.length, indices: attendu.indices.length }), attendu)
  const skill = lire(`${SKILL}/SKILL.md`).replace(/\s+/g, ' ')
  assert.match(skill, /calibrage-cabinet\.ts --joueurs tablée,occasionnel/, 'la skill compare chacun à sa ligne')
  assert.match(skill, /Ophélie[^.]*occasionnel/)
  const regle = lire('.claude/rules/tablee.md').replace(/\s+/g, ' ')
  assert.match(regle, /occasionnel/)
  assert.match(regle, /marche/)
})

test('une fiche vise une épique à la Frise', () => {
  // Aucune n'avait été jouée : la frise plus serrée d'une épique n'a jamais été mesurée contre sa ligne.
  assert.ok(
    FICHES.some(f => /une œuvre épique qui se joue à la Frise/.test(f.texte.replace(/\s+/g, ' '))),
    'un personnage chasse une épique de la Frise',
  )
})

// ── La marche, que l'écran tait et que le banc dit ─────────────────────────

test('la marche de ce qu’il faut savoir : le plan figé à l’indice que dit la vue', () => {
  const pari = tirageDe('pari', 0)
  assert.deepEqual(marchesASavoir(pari, 1), { quoi: 'de la question', marches: ['facile'] })
  // Après « Parier » seulement : avant, la marche du pari aurait dit s'il vaut la peine.
  assert.deepEqual(marchesASavoir(pari, 2), { quoi: 'de la question du pari', marches: ['difficile'] })
  assert.deepEqual(marchesASavoir(tirageDe('eclair', 0), null)?.marches, ['facile', 'facile', 'facile', 'facile', 'facile'])
  assert.deepEqual(marchesASavoir(tirageDe('mot', 0), null), { quoi: 'du mot', marches: ['facile'] })
  assert.deepEqual(marchesASavoir(tirageDe('filet', 0), null), { quoi: 'de la valeur', marches: ['facile'] })
  // Sans marche au calibrage : rien à dire.
  for (const jeu of ['detail', 'frise', 'epingle', 'indices', 'replique'] as const) assert.equal(marchesASavoir(tirageDe(jeu, 0), null), null, jeu)
  const ligne = ligneDeLaMarche({ quoi: 'des affirmations, dans l’ordre', marches: ['facile', 'moyen', 'difficile', 'expert'] })
  assert.match(ligne, /^🎲 Pour ton dé, la marche des affirmations, dans l’ordre : facile, moyenne, difficile, experte/)
  // Rien d'autre que la marche : ni la question, ni la réponse.
  const mot = ligneDeLaMarche(marchesASavoir(tirageDe('mot', 0), null)!)
  for (const secret of ['Vilnius', 'VILNIUS', 'Lituanie']) assert.ok(!mot.includes(secret), secret)
})

test('la vue que la page reçoit : la partie, sa manche au plan, la plus récente gagne', () => {
  const vue = { id: 'p1', maintenant: 100, phase: 'jouer', manches: [], tirage: 3, enCours: { jeu: 'pari', etape: 2 } }
  assert.deepEqual(partieDeLaReponse(vue), { partie: 'p1', maintenant: 100, tirage: 3, etape: 2, enJeu: true })
  // Le refus d'un geste passé porte la vue d'à présent ; la page du musée, sa partie ouverte.
  assert.equal(partieDeLaReponse({ error: 'Ce geste est passé', partie: vue })?.partie, 'p1')
  assert.equal(partieDeLaReponse({ maintenant: 90, poussiere: 3, enCours: vue })?.partie, 'p1')
  assert.deepEqual(partieDeLaReponse({ maintenant: 120, poussiere: 3, enCours: null }), { partie: null, maintenant: 120, tirage: null, etape: null, enJeu: false })
  // Révélée, en pause, avant la première manche.
  assert.equal(partieDeLaReponse({ ...vue, phase: 'revele' })?.enJeu, false)
  assert.equal(partieDeLaReponse({ ...vue, phase: 'pause' })?.enJeu, true)
  assert.equal(partieDeLaReponse({ ...vue, phase: 'avant', tirage: undefined })?.tirage, null)
  // Ce qui n'est pas une partie : un cartel, des murs, une erreur seule.
  for (const autre of [null, 'texte', { error: 'Introuvable' }, { oeuvre: 'plume', doree: false }, { lieux: [] }]) assert.equal(partieDeLaReponse(autre), null)
  // Les réponses arrivent dans le désordre : la vue la plus récente, à l'heure du serveur, l'emporte.
  const neuve = partieDeLaReponse(vue)!
  const vieille = partieDeLaReponse({ ...vue, maintenant: 50, tirage: 0 })!
  assert.equal(retenirLaPartie(null, vieille), vieille)
  assert.equal(retenirLaPartie(neuve, vieille), neuve)
  assert.equal(retenirLaPartie(vieille, neuve), neuve)
})

test('le banc dit la marche par le vrai serveur : la vue reçue, puis le plan figé en base', async () => {
  const b = await bancDuCabinet()
  try {
    const ophelie = await inscrireProfil(b.banc.url, 'ophelie', 'Ophélie')
    let v = ok(await commencer(b, ophelie, { origine: 'libre', jeu: 'pari', carte: null }), 'le Pari')
    const plan = departEnBase(b.fichier, v.id).tirages
    const t = pariDe(b, v.id, 0)
    let lue = partieDeLaReponse(v)!
    assert.deepEqual(lue, { partie: v.id, maintenant: v.maintenant, tirage: 0, etape: 1, enJeu: true })
    assert.deepEqual(marchesASavoir(plan[lue.tirage!], lue.etape)?.marches, [t.q1.niveau])
    v = ok(await jouer(b, ophelie, v, { quoi: 'repondre', manche: 0, reponse: { pari: { choix: t.q1.bonne } } }), 'la première question')
    v = ok(await jouer(b, ophelie, v, { quoi: 'parier', manche: 0 }), 'parier')
    lue = partieDeLaReponse(v)!
    assert.equal(lue.etape, 2, 'la question du pari')
    assert.deepEqual(marchesASavoir(plan[lue.tirage!], lue.etape)?.marches, [t.q2.niveau])
    // Le refus d'un geste passé et la page du musée portent la même partie.
    const passe = await jouer(b, ophelie, { id: v.id, rang: v.rang - 1 }, { quoi: 'parier', manche: 0 })
    assert.equal(passe.status, 409)
    assert.equal(partieDeLaReponse(passe.corps)?.partie, v.id)
    assert.equal(partieDeLaReponse(ok(await laPage(b, ophelie), 'la page'))?.partie, v.id)
    v = ok(await jouer(b, ophelie, v, { quoi: 'repondre', manche: 0, reponse: { pari: { choix: t.q2.bonne } } }), 'le pari')
    assert.equal(partieDeLaReponse(v)?.enJeu, false, 'tranchée : plus rien à savoir')
    // L'Éclair : cinq affirmations, chacune la marche de sa question.
    const theo = await inscrireProfil(b.banc.url, 'theo', 'Théo')
    const e = ok(await commencer(b, theo, { origine: 'libre', jeu: 'eclair', carte: null }), 'l’Éclair')
    const le = partieDeLaReponse(e)!
    assert.deepEqual(
      marchesASavoir(departEnBase(b.fichier, e.id).tirages[le.tirage!], le.etape)?.marches,
      eclairDe(b, e.id, 0).affirmations.map(a => a.question.niveau),
    )
  } finally {
    await b.banc.close()
  }
})

test('la régie branche la marche : la vue retenue à chaque réponse, la ligne en tête de l’écran d’une manche', () => {
  assert.match(REGIE, /page\.on\('response'[\s\S]*?partieDeLaReponse\(/, 'chaque réponse du Cabinet est lue')
  assert.match(REGIE, /retenirLaPartie\(/, 'la plus récente l’emporte')
  assert.match(fonctionDe('entete'), /await marcheDuDe\(o\)/, 'la ligne en tête de chaque sortie')
  const marche = fonctionDe('marcheDuDe')
  assert.match(marche, /startsWith\('\/cabinet'\)/, 'sur la page du Cabinet seulement')
  assert.match(marche, /marchesASavoir\(/)
  assert.match(marche, /ligneDeLaMarche\(/)
  // Le plan figé, relu comme le serveur le relit : par `lireLeDepart`, à la ligne de la partie.
  const plan = fonctionDe('planDe')
  assert.match(plan, /SELECT cabinet FROM campagne_series WHERE id = \?/)
  assert.match(plan, /lireLeDepart\(/)
})
