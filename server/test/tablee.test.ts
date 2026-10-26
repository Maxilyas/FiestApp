// La tablée — le banc où des agents jouent FiestApp au téléphone (skill
// `tablee`). Celle du Cabinet, le 25 octobre 2026, a faussé deux jeux sur
// trois retours (`retours/2026-10-25/synthese.md`, « Les limites ») : le
// pilote touchait le centre d'un élément — l'épingle tombait au milieu de la
// carte de France, le curseur du Filet ne bougeait que d'un cran à la fois —,
// `ecrire` dans un curseur répondait « Malformed value », et les personnages,
// qui savent tout, finissaient 24 parties sur 47 à 9 sur 9. La régie démarre
// un serveur et un Chromium dès son import : ce qui se lit des arguments d'un
// geste vit à part (`scripts/tablee/gestes.ts`), et le reste se relit dans
// les fichiers — un geste se dit à trois endroits (règle `tablee.md`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATEGORIES } from '../../shared/categories'
import { AFFIRMATIONS_DE_L_ECLAIR, MANCHES_PAR_PARTIE } from '../../shared/cabinet/bareme'
import { DES_PAR_GESTE_MAX, lancerLeDe, lireLeDe, lireLeToucher, pointVise, UN_CURSEUR_NE_SE_TAPE_PAS } from '../scripts/tablee/gestes'

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
})
