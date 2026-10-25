// Le contenu neuf du Cabinet de curiosités (le lot B4 de la conception) : les
// lieux datés de l'Épingle, les fiches des Indices, les répliques, les frises
// à thème — ce que la base de la campagne n'a pas. Des agents l'ont écrit et
// relu ; ici, ce que chaque entrée doit être pour arriver sur un téléphone,
// ce qui fait deux fois la même, et ce que le contenu livré doit tenir.
//
// Un juge, une seule fois écrit (`server/src/core/cabinet/contenu.ts`) : le
// serveur l'applique au chargement, le script de rangement à chaque lot, ce
// test au contenu livré. Deux copies de ces règles finiraient par dire deux
// choses.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  DOSSIER_DU_CONTENU,
  SORTES,
  SORTES_DU_CONTENU,
  contenuDuCabinet,
  ecritDans,
  ligneDe,
  lireLeContenu,
  refusDeLaFiche,
  refusDeLaFriseATheme,
  refusDeLaReplique,
  refusDuLieu,
  trier,
  type SorteDuContenu,
} from '../src/core/cabinet/contenu'
import { traiterLesLots } from '../scripts/cabinet-contenu'
import {
  CASES_DE_LA_VISITE,
  CHASSES_PAR_JOUR,
  CLES_MAX,
  EVENEMENTS_D_UNE_FRISE_A_THEME,
  INDICES_D_UNE_FICHE,
  INDICE_MAX,
  JOURS_SANS_REDITE,
  LIBRES_QUI_PAIENT,
  LIEUX_VOISINS_KM,
  MANCHES_PAR_PARTIE,
  MOTS_D_UNE_REPLIQUE_MAX,
  QUESTION_MAX,
  RECIT_MAX,
  SAVAIS_MAX,
} from '../../shared/cabinet/bareme'
import { CLES_DES_JEUX, type CleDeJeu } from '../../shared/cabinet/jeux/regle'
import { bonneIdentite } from '../../shared/cabinet/jeux/indices'
import { distanceKm } from '../../shared/cabinet/france'
import type { Fiche, FriseATheme, Lieu, Replique } from '../../shared/cabinet/contenu'

/**
 * Ce que le contenu livré tient, au moins : un plancher qui ne recule pas. Il
 * monte quand un lot entre — un lot rangé puis perdu par une fusion
 * maladroite ferait rougir ce test, pas un joueur qui retombe sur les mêmes
 * lieux.
 */
const AU_MOINS: Readonly<Record<SorteDuContenu, number>> = { lieux: 90, fiches: 66, repliques: 66, frises: 18 }

const brut = (s: SorteDuContenu): unknown[] => JSON.parse(readFileSync(path.join(DOSSIER_DU_CONTENU, SORTES[s].fichier), 'utf8'))

/** Les parties d'Épingle à thème que ces lieux font : ses trois lieux se tirent d'un même thème, chacun en fait autant qu'il a de fois trois lieux. */
const partiesDEpingleATheme = (lieux: readonly Lieu[]) => {
  const parTheme = new Map<string, number>()
  for (const l of lieux) parTheme.set(l.theme, (parTheme.get(l.theme) ?? 0) + 1)
  return [...parTheme.values()].reduce((s, n) => s + Math.floor(n / MANCHES_PAR_PARTIE), 0)
}

// ── Le contenu livré ────────────────────────────────────────────────────────

test('chaque lieu, fiche, réplique et frise livrée passe son juge, aucune ne se répète, et le plancher tient', () => {
  for (const s of SORTES_DU_CONTENU) {
    const entrees = brut(s)
    const { gardees, ecartees } = trier(s, entrees)
    assert.deepEqual(
      ecartees.map(e => `${(e.entree as { id?: string })?.id ?? '?'} : ${e.motif}`),
      [],
      `${SORTES[s].fichier} : ce qui ne se pose pas se corrige dans le contenu, jamais en desserrant le juge`,
    )
    assert.equal(gardees.length, entrees.length)
    assert.ok(gardees.length >= AU_MOINS[s], `${SORTES[s].fichier} : ${gardees.length} entrées, le plancher en veut ${AU_MOINS[s]}`)
  }
})

test('une entrée par ligne, ses champs dans l’ordre du juge : une relecture de PR se fait entrée par entrée', () => {
  for (const s of SORTES_DU_CONTENU) {
    const fichier = SORTES[s].fichier
    const lignes = readFileSync(path.join(DOSSIER_DU_CONTENU, fichier), 'utf8').trimEnd().split('\n')
    assert.equal(lignes[0], '[', fichier)
    assert.equal(lignes.at(-1), ']', fichier)
    const entrees = lignes.slice(1, -1)
    entrees.forEach((l, i) => {
      const e = JSON.parse(l.replace(/,$/, '')) as never
      assert.equal(l, ligneDe(s, e) + (i < entrees.length - 1 ? ',' : ''), `${fichier} : ${l.slice(0, 60)}`)
    })
  }
})

test('chaque thème de l’Épingle a de quoi faire une partie : trois lieux d’un même thème', () => {
  const parTheme = new Map<string, number>()
  for (const l of contenuDuCabinet().lieux) parTheme.set(l.theme, (parTheme.get(l.theme) ?? 0) + 1)
  for (const [theme, n] of parTheme) assert.ok(n >= MANCHES_PAR_PARTIE, `« ${theme} » : ${n} lieux`)
})

test('chaque jeu du contenu neuf tient sept jours sans redite, au rythme d’une visite, deux chasses et cinq libres', () => {
  // Le rythme d'un joueur assidu : les trois parties de sa visite, ses deux
  // chasses, ses cinq parties libres qui paient — dix parties par jour sur les
  // neuf jeux, que la visite fait tourner (ceux des deux jours d'avant passent
  // après). Chaque jeu en reçoit deux par jour en moyenne, arrondie au-dessus ;
  // sur sept jours sans redite, il lui faut autant de contenus que de manches
  // — une frise à thème, elle, fait une partie entière (ses trois vagues sont
  // ses trois manches).
  //
  // Une moyenne, pas un plafond : chaque œuvre se chasse à son jeu, et une case
  // de la visite et deux chasses au même jeu en font trois dans la journée,
  // les libres à part — c'est le pire qu'on tient, plus bas.
  const partiesParJour = Math.ceil((CASES_DE_LA_VISITE + CHASSES_PAR_JOUR + LIBRES_QUI_PAIENT) / CLES_DES_JEUX.length)
  assert.equal(partiesParJour, 2)
  const contenu = contenuDuCabinet()
  const tient: [CleDeJeu, number, number][] = [
    ['epingle', contenu.lieux.length, MANCHES_PAR_PARTIE],
    ['indices', contenu.fiches.length, MANCHES_PAR_PARTIE],
    ['replique', contenu.repliques.length, MANCHES_PAR_PARTIE],
    ['frise', contenu.frises.length, 1],
  ]
  for (const [jeu, n, parPartie] of tient) {
    const faut = JOURS_SANS_REDITE * partiesParJour * parPartie
    assert.ok(n >= faut, `${jeu} : ${n} contenus pour ${faut}`)
  }
  // L'Épingle tire ses trois lieux d'un même thème : chaque thème fait autant de parties qu'il a de fois trois lieux.
  const parties = partiesDEpingleATheme(contenu.lieux)
  assert.ok(parties >= JOURS_SANS_REDITE * partiesParJour, `${parties} parties d'Épingle à thème`)
})

test('l’Épingle, les Indices et la Réplique tiennent sept jours de calendrier au pire réaliste : sa case de la visite et ses deux chasses au même jeu', () => {
  // La visite pose trois jeux différents — l'échange en prend un qui n'y est
  // pas —, mais deux chasses peuvent viser deux œuvres du même jeu : trois
  // parties par jour au même jeu, les libres à part (elles se jouent pour le
  // plaisir, à volonté : aucun contenu ne les tiendrait). Ces trois jeux ne
  // tirent que du contenu neuf, et soixante fiches ou répliques n'en tenaient
  // que six jours et deux tiers : le joueur assidu y revoyait, au septième, ce
  // qu'il avait vu la semaine même. La Frise n'en est pas : ses frises à thème
  // alternent avec les frises des sujets de la base.
  //
  // Sept jours de calendrier, pas sept fois vingt-quatre heures : la fenêtre
  // des sept jours glisse, et à cheval sur huit jours de calendrier, elle peut
  // tenir les trois parties d'un premier soir et celles d'un huitième matin.
  // Un joueur dont l'heure recule ainsi d'un jour à l'autre peut revoir, ce
  // huitième matin, ce qu'il avait vu le premier soir — six jours et
  // quelques heures plus tôt, le moins récemment vu revenant d'abord. Le
  // tenir aussi demanderait un jour de plus de contenu, 72 manches : ce test
  // ne le promet pas.
  const partiesAuPire = 1 + CHASSES_PAR_JOUR
  assert.equal(partiesAuPire, 3)
  const contenu = contenuDuCabinet()
  const faut = JOURS_SANS_REDITE * partiesAuPire * MANCHES_PAR_PARTIE
  for (const [jeu, n] of [
    ['epingle', contenu.lieux.length],
    ['indices', contenu.fiches.length],
    ['replique', contenu.repliques.length],
  ] as [CleDeJeu, number][]) {
    assert.ok(n >= faut, `${jeu} : ${n} contenus pour ${faut}`)
  }
  // L'Épingle au pire aussi : ses parties à thème, trois lieux chacune.
  const parties = partiesDEpingleATheme(contenu.lieux)
  assert.ok(parties >= JOURS_SANS_REDITE * partiesAuPire, `${parties} parties d'Épingle à thème`)
})

test('une frise ne souffle pas l’Épingle : un événement de l’année d’un lieu ne dit ni sa commune ni son département', () => {
  // « Napoléon III est fait prisonnier à Sedan », 1870 : la frise jouée la
  // veille répondait à « Où Napoléon III fut-il fait prisonnier en 1870 ? ».
  // Les sept jours sans redite comptent par identifiant, d'un jeu à l'autre :
  // ils ne voient pas le même fait sous deux entrées. Le même événement peut
  // se dire aux deux — la frise demande quand, l'Épingle où —, jamais l'endroit.
  const { lieux, frises } = contenuDuCabinet()
  const souffles: string[] = []
  for (const f of frises) {
    for (const e of f.evenements) {
      for (const l of lieux) {
        if (e.annee !== l.annee) continue
        for (const nom of [l.commune, l.departement]) if (ecritDans(e.libelle, nom)) souffles.push(`${f.id}, « ${e.libelle} » : ${l.id} (${nom})`)
      }
    }
  }
  assert.deepEqual(souffles, [])
})

test('une fiche ni une réplique ne soufflent l’Épingle : la personne qu’un lieu nomme n’y dit ni sa commune ni son département', () => {
  // « Où Georges Méliès fait-il bâtir son studio ? » : la fiche de Méliès,
  // jouée aux Indices quelques jours plus tôt, disait à sa révélation « l'un
  // des tout premiers studios de cinéma, à Montreuil ». La sœur de l'épreuve
  // des frises : les sept jours comptent par identifiant et ne voient pas le
  // même fait sous deux entrées. Un lieu nomme une personne dans ce qui dit de
  // quoi il parle — son nom, son récit, sa question ; la personne d'une fiche,
  // c'est sa réponse et ses clés, celle d'une réplique, qui l'a dite. Elles
  // peuvent dire une ville, jamais celle d'un lieu qui les nomme.
  const { lieux, fiches, repliques } = contenuDuCabinet()
  const souffles: string[] = []
  const lire = (id: string, personne: readonly string[], textes: readonly string[]) => {
    for (const l of lieux) {
      if (!personne.some(p => [l.nom, l.recit, l.question].some(t => ecritDans(t, p)))) continue
      for (const nom of [l.commune, l.departement]) if (textes.some(t => ecritDans(t, nom))) souffles.push(`${id} : ${l.id} (${nom})`)
    }
  }
  for (const f of fiches) lire(f.id, [f.reponse, ...f.cles], [...f.indices, f.savais])
  for (const r of repliques) lire(r.id, [r.qui], [`${r.avant} ${r.mot}${r.apres}`, r.source, r.savais])
  assert.deepEqual(souffles, [])
})

test('une fiche livrée trouve sa personne sous le nom qu’on tape : son surnom, sa forme française', () => {
  // « Coco », tapé seul, coûtait une étoile et un indice à qui reconnaissait
  // Chanel : le surnom sous lequel toute la France la connaît n'était pas une
  // clé. « Johann Gutenberg », la forme qu'on lit le plus en français, est à
  // deux lettres de « Johannes » : au cinquième indice, le refus mettait la
  // manche à zéro. Une clé ouvre aussi le prénom seul — « Johann » trouve
  // Gutenberg, comme « Mohandas » trouve Gandhi —, mais n'y ajoute pas un nom
  // qui n'est pas le sien.
  const fiche = (id: string) => {
    const f = contenuDuCabinet().fiches.find(x => x.id === id)
    assert.ok(f, id)
    return f
  }
  for (const [id, saisie, trouve] of [
    ['femmes-coco-chanel', 'Coco', true],
    ['femmes-coco-chanel', 'Gabrielle Chanel', true],
    ['femmes-coco-chanel', 'Coco Chanel', true],
    ['sciences-gutenberg', 'Johann Gutenberg', true],
    ['sciences-gutenberg', 'Gutemberg', true],
    ['sciences-gutenberg', 'Johann Fust', false],
    ['sciences-gutenberg', 'Johann Sebastian Bach', false],
  ] as [string, string, boolean][]) assert.equal(bonneIdentite(saisie, fiche(id)), trouve, `${id} : « ${saisie} »`)
})

test('le serveur lit le contenu livré une fois, hors de client/public', () => {
  const contenu = contenuDuCabinet()
  assert.equal(contenuDuCabinet(), contenu, 'lu une fois par processus')
  for (const s of SORTES_DU_CONTENU) assert.equal(contenu[s].length, brut(s).length, s)
  // Chaque entrée porte sa réponse (invariant 1) : servie d'avance, elle serait sur le téléphone avant la question.
  assert.ok(DOSSIER_DU_CONTENU.endsWith(path.join('server', 'content', 'cabinet')))
  const racine = path.resolve(DOSSIER_DU_CONTENU, '../../..')
  for (const s of SORTES_DU_CONTENU) assert.ok(!existsSync(path.join(racine, 'client/public', SORTES[s].fichier)) && !existsSync(path.join(racine, 'client/public/cabinet')), s)
})

test('un fichier qui manque, une entrée qui ne se pose pas : le serveur s’en passe et le dit au journal', t => {
  const dossier = mkdtempSync(path.join(os.tmpdir(), 'cabinet-contenu-'))
  try {
    const avertis = t.mock.method(console, 'warn', () => {})
    writeFileSync(path.join(dossier, SORTES.lieux.fichier), JSON.stringify([LIEU, { ...LIEU, id: 'hors-de-france', lat: 52.5 }, { ...LIEU, id: 'beaune-encore', lon: 4.84 }]))
    writeFileSync(path.join(dossier, SORTES.frises.fichier), '[{"id":')
    writeFileSync(path.join(dossier, SORTES.repliques.fichier), JSON.stringify({ repliques: [REPLIQUE] }))
    const lu = lireLeContenu(dossier)
    assert.deepEqual(lu.lieux.map(l => l.id), [LIEU.id], 'le lieu hors de France et le doublon s’écartent')
    assert.deepEqual([lu.fiches.length, lu.repliques.length, lu.frises.length], [0, 0, 0], 'un fichier absent, illisible ou qui n’est pas un tableau ne donne rien')
    const dits = avertis.mock.calls.map(c => c.arguments.join(' '))
    assert.ok(dits.some(d => d.includes('hors-de-france')), dits.join('\n'))
    assert.ok(dits.some(d => d.includes('beaune-encore') && d.includes(LIEU.id)), 'le doublon dit qui il redit')
    assert.ok(dits.some(d => d.includes(SORTES.fiches.fichier)), 'le fichier qui manque se dit')
    assert.ok(dits.some(d => d.includes(SORTES.frises.fichier)), 'le fichier illisible se dit')
    assert.ok(dits.some(d => d.includes(SORTES.repliques.fichier) && d.includes('pas un tableau')), 'le fichier qui n’est pas un tableau se dit')
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

// ── Les juges ───────────────────────────────────────────────────────────────

const LIEU: Lieu = {
  id: 'arts-hospices-de-beaune',
  theme: "Les lieux de l'art",
  nom: "L'Hôtel-Dieu de Beaune",
  commune: 'Beaune',
  departement: "Côte-d'Or",
  lat: 47.022,
  lon: 4.837,
  annee: 1443,
  date: '1443',
  recit: "Le chancelier d'un puissant duc et sa femme fondent un hôpital pour les pauvres.",
  question: 'Où se trouve cet hôpital aux toits multicolores ?',
  savais: 'Ses vins sont vendus aux enchères depuis 1859.',
  categorie: 'Arts & lettres',
}

test('un lieu : dans la France, sa commune et son département jamais dits avant la révélation, une question « Où … ? »', () => {
  assert.equal(refusDuLieu(LIEU), null)
  // Le nom du lieu peut se dire : il ne donne pas la commune.
  assert.equal(refusDuLieu({ ...LIEU, question: 'Où se trouve la place Stanislas ?', commune: 'Nancy', departement: 'Meurthe-et-Moselle' }), null)
  assert.equal(refusDuLieu({ ...LIEU, commune: 'Le Havre', departement: 'Seine-Maritime', recit: 'Le centre d’un grand port est rebâti.' }), null, 'un mot de la commune ne la dit pas')
  // Chaque refus dit son motif, et chaque épreuve le relit : un cas refusé par
  // une autre règle que la sienne passerait sans rien prouver.
  for (const [lieu, motif, pourquoi] of [
    [{ ...LIEU, lat: 52.5 }, /^ses coordonnées/, 'hors du cadre de la France'],
    [{ ...LIEU, lon: 9.9 }, /^ses coordonnées/, 'à l’est de la Corse'],
    [{ ...LIEU, lat: Number.NaN }, /^ses coordonnées/, 'une latitude qui n’est pas un nombre'],
    [{ ...LIEU, lat: '47.022' }, /^ses coordonnées/, 'une latitude en texte'],
    [{ ...LIEU, recit: 'Le chancelier fonde un hôpital à Beaune.' }, /^son récit dit « Beaune »/, 'la commune dans le récit'],
    [{ ...LIEU, question: 'Où se trouve cet hôpital, près de beaune ?' }, /^sa question dit « Beaune »/, 'la commune sans sa capitale'],
    [{ ...LIEU, recit: 'Un hôpital fondé en Côte d’Or, pour les pauvres.' }, /^son récit dit « Côte-d'Or »/, 'le département, apostrophe courbe et sans trait d’union'],
    [{ ...LIEU, recit: 'Un hôpital au cœur de la Cote-d’Or.' }, /^son récit dit « Côte-d'Or »/, 'le département sans son accent'],
    [{ ...LIEU, commune: 'Le Havre', departement: 'Seine-Maritime', recit: 'Le centre du Havre est rebâti en béton.' }, /^son récit dit « Le Havre »/, 'la commune sans son article'],
    [{ ...LIEU, commune: 'Gœulzin', departement: 'Nord', recit: 'Un hôpital fondé à Goeulzin.' }, /^son récit dit « Gœulzin »/, 'la commune écrite oe pour œ'],
    [{ ...LIEU, date: 'à Beaune, en 1443' }, /^sa date dit « Beaune »/, 'la commune dans la date, montrée avec la question'],
    [{ ...LIEU, theme: 'Beaune et ses vignes' }, /^son thème dit « Beaune »/, 'la commune dans le thème, montré avec la question'],
    [{ ...LIEU, question: 'Quel est cet hôpital ?' }, /^sa question demande où/, 'une question qui ne demande pas où'],
    [{ ...LIEU, question: `Où se trouve ${'x'.repeat(QUESTION_MAX)} ?` }, /^sa question : \d+ signes, pour \d+ au plus/, 'une question trop longue'],
    [{ ...LIEU, recit: 'Un hôpital.'.padEnd(RECIT_MAX + 1, '.') }, /^son récit : \d+ signes/, 'un récit trop long'],
    [{ ...LIEU, savais: 'Un vin.'.padEnd(SAVAIS_MAX + 1, '.') }, /^son « Le savais-tu \? » : \d+ signes/, 'un savais trop long'],
    [{ ...LIEU, annee: 1443.5 }, /^son année/, 'une année qui n’est pas entière'],
    [{ ...LIEU, categorie: 'Peinture' }, /^sa catégorie/, 'une catégorie inconnue'],
    [{ ...LIEU, id: 'cab:lieu:beaune' }, /^son identifiant/, 'le code pose le préfixe'],
    [{ ...LIEU, id: 'Beaune' }, /^son identifiant/, 'un identifiant en capitales'],
    [{ ...LIEU, nom: '' }, /^son nom : un texte/, 'un nom vide'],
    [{ ...LIEU, commune: '' }, /^sa commune : un texte/, 'une commune vide'],
    [{ ...LIEU, recit: ' Un hôpital.' }, /^son récit : sur une ligne/, 'un blanc au bord'],
    [{ ...LIEU, recit: 'Un hôpital  pour les pauvres.' }, /^son récit : sur une ligne/, 'une double espace'],
    [{ ...LIEU, recit: 'Un hôpital 🏥 pour les pauvres.' }, /^son récit : pas d'emoji/, 'un emoji'],
    // Ni l'un ni l'autre n'est un pictogramme pour Unicode, et `emojis.test.ts` laisse passer les drapeaux.
    [{ ...LIEU, recit: 'Un hôpital 🇫🇷 pour les pauvres.' }, /^son récit : pas d'emoji/, 'un drapeau'],
    [{ ...LIEU, recit: 'Un hôpital pour 1️⃣ duc.' }, /^son récit : pas d'emoji/, 'une touche chiffrée'],
    [{ ...LIEU, ville: 'Beaune' }, /^ville : un champ que le format n'a pas/, 'un champ que le format n’a pas'],
    [(({ savais: _, ...l }) => l)(LIEU), /^il manque savais/, 'un champ qui manque'],
    [null, /^pas une entrée/, 'pas un objet'],
  ] as [unknown, RegExp, string][]) assert.match(refusDuLieu(lieu) ?? 'il se pose', motif, pourquoi)
})

const FICHE: Fiche = {
  id: 'histoire-jeanne-d-arc',
  reponse: "Jeanne d'Arc",
  cles: ['arc', 'darc'],
  indices: [
    'À mon procès, on m’a demandé si j’étais en état de grâce.',
    'Je suis née vers 1412 dans une famille de paysans, au bord de la Meuse.',
    'Un évêque nommé Pierre Cauchon a présidé mon procès.',
    'À dix-sept ans, j’ai conduit le dauphin jusqu’à Reims.',
    'On m’appelle la Pucelle d’Orléans.',
  ],
  savais: 'Sa condamnation est annulée en 1456.',
  categorie: 'Histoire',
}

test('une fiche : cinq indices courts, ni la réponse ni une clé, et des clés que la réponse tapée retrouve', () => {
  assert.equal(refusDeLaFiche(FICHE), null)
  const indices = (k: number, indice: string) => FICHE.indices.map((x, i) => (i === k ? indice : x))
  // Les clés des cas qui ne visent pas les indices — `johanna` — ne sont dans aucun d'eux : refusées par la règle des
  // indices, elles ne prouveraient rien de celle des clés.
  assert.ok(FICHE.indices.every(i => !ecritDans(i, 'johanna') && !ecritDans(i, 'jeanne')))
  for (const [fiche, motif, pourquoi] of [
    [{ ...FICHE, indices: indices(4, 'Je suis Jeanne d’Arc.') }, /^son indice 5 dit « Jeanne d'Arc »/, 'la réponse dans un indice'],
    [{ ...FICHE, indices: indices(0, 'On dit de moi : la Pucelle d’ARC.') }, /^son indice 1 dit « arc »/, 'une clé dans un indice, en capitales'],
    [{ ...FICHE, reponse: 'Louis de Funès', cles: ['funes'], indices: indices(1, 'Les Funès venaient d’Espagne.') }, /^son indice 2 dit « funes »/, 'une clé sans accent, écrite avec'],
    [{ ...FICHE, indices: FICHE.indices.slice(0, INDICES_D_UNE_FICHE - 1) }, /^ses indices : 5/, 'quatre indices'],
    [{ ...FICHE, indices: indices(2, 'Un évêque.'.padEnd(INDICE_MAX + 1, '.')) }, /^son indice 3 : \d+ signes/, 'un indice trop long'],
    [{ ...FICHE, cles: [] }, /^ses clés : de une à/, 'aucune clé'],
    [{ ...FICHE, cles: ['arc', 'darc', 'jeanne', 'johanna'].slice(0, CLES_MAX + 1) }, /^ses clés : de une à/, 'trop de clés'],
    [{ ...FICHE, cles: ['ar'] }, /^ses clés : des minuscules sans accents/, 'une clé de deux lettres'],
    [{ ...FICHE, cles: ['arc', 'Jeanne'] }, /^ses clés : des minuscules sans accents/, 'une clé en capitales'],
    [{ ...FICHE, cles: ['arc', 'arc'] }, /^ses clés : chacune une fois/, 'deux fois la même clé'],
    [{ ...FICHE, cles: ['johanna'] }, /^ses clés : une au moins se lit dans la réponse/, 'aucune clé dans la réponse : tapée en entier, elle ne trouverait personne'],
    [{ ...FICHE, reponse: '' }, /^sa réponse : un texte/, 'une réponse vide'],
    [{ ...FICHE, savais: 'Une annulation.'.padEnd(SAVAIS_MAX + 1, '.') }, /^son « Le savais-tu \? » : \d+ signes/, 'un savais trop long'],
    [{ ...FICHE, categorie: 'Moyen Âge' }, /^sa catégorie/, 'une catégorie inconnue'],
  ] as [unknown, RegExp, string][]) assert.match(refusDeLaFiche(fiche) ?? 'elle se pose', motif, pourquoi)
})

test('une fiche se juge à la règle même des Indices : sa réponse tapée la trouve, chaque clé seule aussi, et aucun indice ne souffle une clé à une faute près', () => {
  // Le juge ne recopie pas ce qu'une saisie doit être pour trouver : il passe par `bonneIdentite`, la règle du jeu.
  // Avant, il se contentait d'une clé lue dans la réponse : « Jeanne Romée Pucelle Domrémy Arc » se posait, et
  // tapée en entier — cinq mots, pour quatre au plus —, la réponse ne trouvait personne.
  const indices = (k: number, indice: string) => FICHE.indices.map((x, i) => (i === k ? indice : x))
  const CESAR = { ...FICHE, reponse: 'Jules César', cles: ['cesar'] }
  assert.equal(refusDeLaFiche(CESAR), null)
  for (const [fiche, motif, pourquoi] of [
    [{ ...FICHE, reponse: 'Jeanne Romée Pucelle Domrémy Arc' }, /^sa réponse : 5 mots, pour 4 au plus/, 'une réponse que la saisie ne tient pas'],
    [{ ...FICHE, cles: ['arc', 'des'] }, /^ses clés : « des » ne désigne personne/, 'un petit mot, que la saisie écarte : tapé seul, il ne trouve rien'],
    [{ ...FICHE, reponse: "Les Mille et Une Nuits d'Arc", cles: ['les', 'arc'] }, /^ses clés : « les » ne désigne personne/, 'un article en clé'],
    // `cesar` a cinq lettres : une faute y est tolérée, et « Césars » tapé trouverait César — l'indice le soufflerait.
    [{ ...CESAR, indices: indices(1, 'Après moi, les empereurs se sont dits Césars.') }, /^son indice 2 dit « cesars », à une faute de la clé « cesar »/, 'une clé à une lettre près'],
    [{ ...CESAR, indices: indices(3, 'On écrivait parfois mon nom Cézar.') }, /^son indice 4 dit « cezar », à une faute de la clé « cesar »/, 'une clé à une lettre changée'],
  ] as [unknown, RegExp, string][]) assert.match(refusDeLaFiche(fiche) ?? 'elle se pose', motif, pourquoi)
  // Sous cinq lettres, chaque lettre est la clé : « arcs » tapé ne trouve pas Jeanne, l'indice peut le dire.
  assert.equal(refusDeLaFiche({ ...FICHE, indices: indices(1, 'Je suis née loin des tirs et des arcs, au bord de la Meuse.') }), null)
})

const REPLIQUE: Replique = {
  id: 'chanson-deux-amours',
  avant: "J'ai deux amours, mon",
  mot: 'pays',
  apres: ' et Paris.',
  leurres: ['homme', 'village', 'public'],
  qui: 'Joséphine Baker',
  autres: ['Mistinguett', 'Fréhel'],
  source: "J'ai deux amours, 1930",
  savais: 'Créée au Casino de Paris.',
  categorie: 'Musique',
}

test('une réplique : un seul mot qui manque, trois leurres et deux autres personnes distincts, quinze mots au plus', () => {
  assert.equal(refusDeLaReplique(REPLIQUE), null)
  assert.equal(refusDeLaReplique({ ...REPLIQUE, avant: 'Vers l’', mot: 'infini', apres: ' et au-delà !' }), null, 'un trou après une apostrophe')
  assert.equal(refusDeLaReplique({ ...REPLIQUE, avant: 'Tikki,', mot: 'transforme', apres: '-moi !' }), null, 'un trou suivi d’un trait d’union')
  for (const [replique, motif, pourquoi] of [
    [{ ...REPLIQUE, mot: 'mon pays' }, /^le mot qui manque : un seul mot/, 'deux mots dans le trou'],
    [{ ...REPLIQUE, leurres: ['homme', 'village', 'Pays'] }, /^ses leurres : distincts/, 'un leurre qui est le mot'],
    [{ ...REPLIQUE, leurres: ['homme', 'village', 'Village'] }, /^ses leurres : distincts/, 'deux leurres pareils'],
    [{ ...REPLIQUE, mot: 'cœur', leurres: ['homme', 'village', 'coeur'] }, /^ses leurres : distincts/, 'un leurre écrit oe pour le œ du mot'],
    [{ ...REPLIQUE, leurres: ['homme', 'village'] }, /^ses leurres : 3/, 'deux leurres'],
    [{ ...REPLIQUE, leurres: ['homme', 'beau village', 'public'] }, /^un leurre, « beau village » : un seul mot/, 'un leurre de deux mots'],
    [{ ...REPLIQUE, autres: ['Mistinguett', 'Josephine Baker'] }, /^les autres personnes : distinctes/, 'qui parmi les autres, sans accent'],
    [{ ...REPLIQUE, autres: ['Mistinguett'] }, /^les autres personnes : 2/, 'une seule autre personne'],
    [{ ...REPLIQUE, apres: ` ${Array.from({ length: MOTS_D_UNE_REPLIQUE_MAX }, () => 'et').join(' ')}.` }, /^la réplique : \d+ mots/, 'plus de quinze mots'],
    [{ ...REPLIQUE, apres: 'et Paris.' }, /^ce qui suit le mot : un blanc d’abord/, 'le mot collé à la suite'],
    [{ ...REPLIQUE, apres: ' et Paris. ' }, /^ce qui suit le mot : sur une ligne/, 'un blanc au bout'],
    [{ ...REPLIQUE, apres: ' et Paris 🗼.' }, /^ce qui suit le mot : pas d'emoji/, 'un emoji après le trou'],
    [{ ...REPLIQUE, avant: "J'ai deux amours, mon " }, /^ce qui précède le mot : sur une ligne/, 'un blanc avant le trou'],
    [{ ...REPLIQUE, source: '' }, /^sa source : un texte/, 'sans source'],
    [{ ...REPLIQUE, savais: 'Une revue.'.padEnd(SAVAIS_MAX + 1, '.') }, /^son « Le savais-tu \? » : \d+ signes/, 'un savais trop long'],
  ] as [unknown, RegExp, string][]) assert.match(refusDeLaReplique(replique) ?? 'elle se pose', motif, pourquoi)
})

const FRISE: FriseATheme = {
  id: 'frise-aviation',
  theme: "L'aviation",
  evenements: [
    { libelle: 'Les frères Wright font voler leur Flyer près de Kitty Hawk', annee: 1903 },
    { libelle: 'Alberto Santos-Dumont fait voler son 14-bis au bois de Boulogne', annee: 1906 },
    { libelle: 'Roland Garros relie Fréjus à Bizerte par-dessus la Méditerranée', annee: 1913 },
    { libelle: 'Charles Lindbergh relie New York à Paris sans escale', annee: 1927 },
    { libelle: "Amelia Earhart traverse seule l'Atlantique en avion", annee: 1932 },
    { libelle: 'Chuck Yeager franchit le mur du son', annee: 1947 },
    { libelle: 'Le Concorde entre en service commercial', annee: 1976 },
  ],
  savais: 'Le vol de Lindbergh a duré plus de 33 heures.',
  categorie: 'Histoire',
}

test('une frise à thème : sept événements qui ne disent pas quand, à trois ans d’écart au moins', () => {
  assert.equal(refusDeLaFriseATheme(FRISE), null)
  const avec = (k: number, e: object) => FRISE.evenements.map((x, i) => (i === k ? e : x))
  assert.equal(EVENEMENTS_D_UNE_FRISE_A_THEME, 7)
  for (const [frise, motif, pourquoi] of [
    [{ ...FRISE, evenements: FRISE.evenements.slice(1) }, /^ses événements : 7/, 'six événements'],
    [{ ...FRISE, evenements: avec(0, { libelle: 'Les frères Wright volent en 1903', annee: 1903 }) }, /^son événement 1, « .+ » : rien qui date/, 'un libellé qui date'],
    [{ ...FRISE, evenements: avec(0, { libelle: 'Les frères Wright font voler leur Flyer ✈', annee: 1903 }) }, /^son événement 1 : pas d'emoji/, 'un emoji dans un libellé'],
    [{ ...FRISE, evenements: avec(1, { libelle: FRISE.evenements[1].libelle, annee: 1905 }) }, /^ses années : 3 ans d'écart/, 'deux années à deux ans'],
    [{ ...FRISE, evenements: avec(1, { libelle: FRISE.evenements[1].libelle, annee: 1903 }) }, /^ses années : 3 ans d'écart/, 'la même année'],
    [{ ...FRISE, evenements: avec(1, { libelle: FRISE.evenements[0].libelle, annee: 1906 }) }, /^ses événements : chacun une fois/, 'deux fois le même libellé'],
    [{ ...FRISE, evenements: avec(1, { libelle: FRISE.evenements[1].libelle, annee: 1906.5 }) }, /^son événement 2 : une année entière/, 'une année qui n’est pas entière'],
    [{ ...FRISE, evenements: avec(1, { libelle: FRISE.evenements[1].libelle, annee: 1906, date: '1906' }) }, /^son événement 2 : date : un champ/, 'un champ de trop dans un événement'],
    [{ ...FRISE, theme: '' }, /^son thème : un texte/, 'sans thème'],
    [{ ...FRISE, savais: 'Un vol.'.padEnd(SAVAIS_MAX + 1, '.') }, /^son « Le savais-tu \? » : \d+ signes/, 'un savais trop long'],
  ] as [unknown, RegExp, string][]) assert.match(refusDeLaFriseATheme(frise) ?? 'elle se pose', motif, pourquoi)
})

// ── Les doublons ────────────────────────────────────────────────────────────

test('les doublons : le même identifiant, le même lieu à deux kilomètres, la même personne, la même citation, le même thème', () => {
  const pres = { ...LIEU, id: 'beaune-hotel-dieu', lat: 47.03 }
  assert.ok(distanceKm(LIEU, pres) < LIEUX_VOISINS_KM)
  const loin = { ...LIEU, id: 'dijon', lat: 47.32, lon: 5.04 }
  const lieux = trier('lieux', [LIEU, pres, loin, { ...loin, lat: 47.5 }])
  assert.deepEqual(lieux.gardees.map(l => l.id), [LIEU.id, 'dijon'])
  assert.match(lieux.ecartees[0].motif, new RegExp(LIEU.id), 'il dit qui il redit')
  assert.match(lieux.ecartees[1].motif, /dijon/, 'le même identifiant')
  assert.equal(trier('lieux', [pres], [LIEU]).ecartees.length, 1, 'ce qui est déjà rangé compte')

  const fiches = trier('fiches', [FICHE, { ...FICHE, id: 'jeanne', reponse: "JEANNE D'ARC" }])
  assert.deepEqual([fiches.gardees.length, fiches.ecartees.length], [1, 1], 'la même personne, en capitales')

  const repliques = trier('repliques', [REPLIQUE, { ...REPLIQUE, id: 'baker', avant: "J’ai deux amours : mon" }])
  assert.deepEqual([repliques.gardees.length, repliques.ecartees.length], [1, 1], 'la même citation, sa ponctuation près')

  const frises = trier('frises', [FRISE, { ...FRISE, id: 'aviation-encore', theme: "L'Aviation" }])
  assert.deepEqual([frises.gardees.length, frises.ecartees.length], [1, 1], 'le même thème')

  const refusee = trier('fiches', [{ ...FICHE, cles: [] }])
  assert.deepEqual([refusee.gardees.length, refusee.ecartees.length], [0, 1], 'le juge passe avant les doublons')
})

// ── Le script de rangement ──────────────────────────────────────────────────

test('le rangement : un fichier rangé qui ne se lit pas arrête tout sans rien écrire ; absent, il se crée', t => {
  const dossier = mkdtempSync(path.join(os.tmpdir(), 'cabinet-rangement-'))
  try {
    t.mock.method(console, 'log', () => {})
    const lot = (nom: string, entrees: unknown[]) => {
      const f = path.join(dossier, nom)
      writeFileSync(f, JSON.stringify(entrees))
      return f
    }
    const range = path.join(dossier, 'content')
    const lieux = path.join(range, SORTES.lieux.fichier)

    // Rien de rangé encore : le fichier se crée, une entrée par ligne.
    assert.equal(traiterLesLots('ranger', [lot('un.json', [LIEU])], range), 0)
    assert.equal(readFileSync(lieux, 'utf8'), `[\n${ligneDe('lieux', LIEU)}\n]\n`)
    assert.equal(traiterLesLots('verifier', [lot('redit.json', [{ ...LIEU, id: 'beaune-encore' }])], range), 1, 'le contenu rangé compte')

    // Une fusion maladroite : compté pour vide, le fichier se serait réécrit avec le seul lot, et `verifier` n'aurait plus vu le doublon.
    const dijon = { ...LIEU, id: 'dijon', lat: 47.32, lon: 5.04 }
    for (const abime of [`<<<<<<< HEAD\n${readFileSync(lieux, 'utf8')}=======\n[]\n>>>>>>> autre\n`, `[\n${ligneDe('lieux', LIEU)},\n]\n`, '{}']) {
      writeFileSync(lieux, abime)
      for (const commande of ['ranger', 'verifier'] as const) {
        assert.throws(() => traiterLesLots(commande, [lot('deux.json', [dijon]), lot('redit.json', [{ ...LIEU, id: 'beaune-encore' }])], range), /ne se lit pas/, `${commande} : ${abime.slice(0, 12)}`)
        assert.equal(readFileSync(lieux, 'utf8'), abime, 'rien n’est écrit')
      }
    }
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})
