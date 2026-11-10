// La marge du bout se resserre : une page dont le contenu tient sur l'écran ne
// défile plus pour sa marge du bas.
//
// La marge du bas d'une coquille de page vit dans sa boîte (`padding-bottom` :
// 28 px au téléphone d'un invité, 24 au-dessus de la barre du menu ou de celle
// du chef, 36 sous un formulaire). Un contenu qui tenait sur l'écran, mais à
// moins d'une marge de son bord, faisait donc défiler la page d'autant, pour ne
// montrer que du vide : la révélation d'une soirée de 25 px, « Pas cette fois »
// de 20, une étape de parcours de 28, « Ton équipe » de 25 — la page bougeait
// sous le doigt à chaque réponse (« Ce qui reste », la revue des écrans du
// 10 novembre 2026, en 360 × 640 ; en 390 × 844, « Palier validé » de 22).
//
// Deux pièces en font un ressort, sans toucher à une marge (`styles.css`, le
// bloc « La marge du bout se resserre ») : le ressort, dernier de la colonne,
// qui reprend la marge et la rend quand la colonne a de la place ; la rallonge,
// sous la coquille, qui la rend au bout d'une page plus longue que l'écran.
//
// Ce qui défile ne se voit qu'au navigateur (la sonde de
// `retours/2026-11-10/ecrans/reproductions/`). Ici, la feuille : les deux
// pièces, ce que chaque marge rend, l'écart que le ressort reprend — le même
// que celui de sa colonne, sans quoi la page finit trop haut ou trop bas —, et
// les coquilles qui gardent leur marge telle quelle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const racine = new URL('../../client/src/', import.meta.url)
const CSS = readFileSync(new URL('styles.css', racine), 'utf8')
const SANS_COMMENTAIRES = CSS.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))

interface Regle {
  /** Un seul sélecteur : une règle à plusieurs en fait plusieurs. */
  selecteur: string
  corps: string
  ou: number
  /** Les conditions qui l'enveloppent (`@supports`, `@media`), de dehors en dedans. */
  sous: string[]
}

/** Chaque règle de la feuille, dans l'ordre, un sélecteur à la fois. */
function regles(): Regle[] {
  const lues: Regle[] = []
  const pile: string[] = []
  const motif = /([^{}]+)\{|\}/g
  for (let m = motif.exec(SANS_COMMENTAIRES); m; m = motif.exec(SANS_COMMENTAIRES)) {
    if (m[0] === '}') {
      pile.pop()
      continue
    }
    const tete = m[1].trim()
    if (tete.startsWith('@')) {
      pile.push(tete)
      continue
    }
    const fin = SANS_COMMENTAIRES.indexOf('}', motif.lastIndex)
    const corps = SANS_COMMENTAIRES.slice(motif.lastIndex, fin)
    // Une virgule dans une parenthèse (`:not(.a, .b)`, `:where(.a, .b)`) ne sépare pas deux sélecteurs.
    for (const selecteur of tete.split(/,(?![^()]*\))/)) lues.push({ selecteur: selecteur.trim().replace(/\s+/g, ' '), corps, ou: m.index, sous: [...pile] })
    motif.lastIndex = fin + 1
  }
  assert.ok(lues.length > 5000 && pile.length === 0, `la feuille est bien lue (${lues.length} règles, ${pile.length} condition(s) restée(s) ouverte(s))`)
  return lues
}
const REGLES = regles()

/** La valeur d'une propriété dans un corps de règle — la dernière, comme la cascade. */
const valeur = (corps: string, propriete: string) => [...corps.matchAll(new RegExp(`(?:^|[;\\s])${propriete}\\s*:\\s*([^;]+);`, 'g'))].at(-1)?.[1].trim()

const DEBUT = CSS.indexOf('/* ── La marge du bout se resserre')
/** Sous quoi vit tout le bloc : sans `:has()` ni `dvh`, un navigateur garde la page d'avant, entière. */
const CONDITION = '@supports selector(:has(a)) and (min-height: 100dvh)'
const DU_BLOC = REGLES.filter(r => DEBUT > 0 && r.ou > DEBUT)
const HORS_DU_BLOC = REGLES.filter(r => DEBUT < 0 || r.ou < DEBUT)
/** Les règles du bloc pour ce sélecteur, hors d'une requête d'écran. */
const duBloc = (selecteur: string) => DU_BLOC.filter(r => r.selecteur === selecteur && r.sous.length === 1)
const uneRegleDuBloc = (selecteur: string) => {
  const lues = duBloc(selecteur)
  assert.equal(lues.length, 1, `${selecteur} : une règle dans le bloc`)
  return lues[0].corps
}
/** La seule règle d'ailleurs pour ce sélecteur qui pose cette propriété. */
const dAilleurs = (selecteur: string, propriete: string) => {
  const lues = HORS_DU_BLOC.filter(r => r.selecteur === selecteur && valeur(r.corps, propriete) !== undefined)
  assert.ok(lues.length >= 1, `${selecteur} { ${propriete} } se trouve`)
  return valeur(lues.at(-1)!.corps, propriete)!
}

/** Les coquilles à ressort : la page d'un téléphone, un formulaire. */
const COQUILLES = ['player-shell', 'join']
/** La page du départ d'une série, telle que sa règle la désigne : la campagne dont le panneau n'est ni celui du carnet ni celui du défi. */
const DEPART_D_UNE_SERIE = '.campagne:has(> .campagne-heros:not(.carnet-heros, .defi-heros))'
/**
 * Celles qui gardent leur marge telle quelle, et pourquoi. La clé : la classe (ou la forme) qui les désigne dans la règle
 * du bloc qui leur retire les deux pièces.
 */
const INTACTES = [
  // Une question tient l'écran au pixel près, et sa marge porte « Réponse enregistrée » — pas celle du Cabinet, qui défile.
  '.player-shell:has(.ans-grid):not(.cab-partie)',
  // Le pied d'une partie du Cabinet reprend déjà la marge à son compte.
  '.player-shell:has(> .cab-pied-partie)',
  // L'accueil et le carrefour du profil partagent leur hauteur entre leurs lignes.
  '.player-shell.accueil',
  '.player-shell.profil-carrefour',
  // Le QG et l'Expédition ont leurs marges à eux.
  '.player-shell.qg',
  '.player-shell.expedition',
  // Le verdict d'un duel tient déjà son halo dans `::before`.
  '.player-shell.duels-verdict',
  // Un formulaire posé dans une autre page ne prend pas l'écran.
  '.join.cab-nom',
  '.porte-ecran .join',
]
/** Les classes qui font d'une coquille une intacte, d'où qu'elle soit rendue. */
const MARQUES_DES_INTACTES = ['accueil', 'profil-carrefour', 'qg', 'expedition', 'duels-verdict', 'cab-nom']

/**
 * Chaque coquille que le client rend : ses classes, lues dans ses `className` — un texte, ou chaque texte d'une
 * expression. Lue à son premier texte seulement, une coquille qui choisit ses classes
 * (`className={ecran === 'compagnon' ? 'player-shell chez-page' : 'player-shell'}`) échappait à tout : la page du
 * compagnon, resserrée le même jour, n'a plus de marge du bas sur un téléphone, et le ressort lui en reprenait
 * 24 px — autant de son contenu passait derrière le menu, sans que la page défile (le 10 novembre 2026).
 */
function coquillesRendues(): string[][] {
  const vues: string[][] = []
  const lire = (dossier: URL) => {
    for (const f of readdirSync(dossier, { withFileTypes: true })) {
      const ici = new URL(f.name + (f.isDirectory() ? '/' : ''), dossier)
      if (f.isDirectory()) lire(ici)
      else if (/\.tsx$/.test(f.name)) {
        // Une expression peut tenir un gabarit, et ses `${…}` : un niveau d'accolades dedans.
        for (const m of readFileSync(ici, 'utf8').matchAll(/className=(?:"([^"]*)"|\{((?:[^{}]|\{[^{}]*\})*)\})/g)) {
          const textes = m[1] !== undefined ? [m[1]] : [...m[2].matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map(t => t[1] ?? t[2] ?? t[3])
          for (const texte of textes) {
            const classes = texte.split(/\s+/).filter(c => /^[\w-]+$/.test(c))
            if (COQUILLES.some(c => classes.includes(c))) vues.push(classes)
          }
        }
      }
    }
  }
  lire(racine)
  assert.ok(vues.length > 80, `les coquilles du client se lisent (${vues.length})`)
  assert.ok(vues.some(classes => classes.includes('chez-page')), 'une coquille qui choisit ses classes se lit aussi')
  return vues
}
const RENDUES = coquillesRendues()
/** Les coquilles à ressort : toutes, sauf celles qu'une classe range parmi les intactes. */
const A_RESSORT = RENDUES.filter(classes => !classes.some(c => MARQUES_DES_INTACTES.includes(c)))

/** Le sujet d'un sélecteur — ce qui suit son dernier combinateur —, et ses classes hors de `:has()`, `:not()`… */
function sujetDe(selecteur: string): { sujet: string; classes: string[] } {
  let profondeur = 0
  let debut = 0
  for (let i = 0; i < selecteur.length; i++) {
    if (selecteur[i] === '(') profondeur++
    else if (selecteur[i] === ')') profondeur--
    else if (!profondeur && /[\s>+~]/.test(selecteur[i])) debut = i + 1
  }
  const sujet = selecteur.slice(debut)
  const nu = sujet.replace(/:(?:has|not|is|where)\((?:[^()]|\([^()]*\))*\)/g, '')
  return { sujet, classes: (nu.match(/\.[\w-]+/g) ?? []).map(c => c.slice(1)) }
}
/** Cette règle peut-elle viser une coquille à ressort ? Son sujet ne porte que des classes d'une même coquille rendue. */
const viseUneCoquilleARessort = (r: Regle) => {
  const { sujet, classes } = sujetDe(r.selecteur)
  if (sujet.includes('::') || classes.length === 0) return false
  return A_RESSORT.some(rendue => classes.every(c => rendue.includes(c)))
}

/**
 * La force d'un sélecteur dans la cascade : [classes, éléments] — il n'y a pas d'identifiant ici. `:has()`, `:not()` et
 * `:is()` comptent pour le plus fort de leurs arguments, `:where()` pour rien.
 */
function forceDe(selecteur: string): [number, number] {
  let classes = 0
  let elements = 0
  let reste = selecteur.replace(/::[\w-]+/g, '')
  const fonction = /:(has|not|is|where)\(((?:[^()]|\([^()]*\))*)\)/
  for (let m = fonction.exec(reste); m; m = fonction.exec(reste)) {
    if (m[1] !== 'where') {
      const fort = m[2]
        .split(/,(?![^()]*\))/)
        .map(a => forceDe(a.trim()))
        .reduce((a, b) => (b[0] > a[0] || (b[0] === a[0] && b[1] > a[1]) ? b : a))
      classes += fort[0]
      elements += fort[1]
    }
    reste = reste.slice(0, m.index) + reste.slice(m.index + m[0].length)
  }
  classes += (reste.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/g) ?? []).length
  elements += (reste.match(/(?:^|[\s>+~])[a-zA-Z][\w-]*/g) ?? []).length
  return [classes, elements]
}

test('le bloc : deux pièces, sous `@supports`, et aucune marge réécrite', () => {
  assert.ok(DEBUT > 0, 'le bloc « La marge du bout se resserre » se trouve')
  assert.ok(DU_BLOC.length > 0 && DU_BLOC.every(r => r.sous[0] === CONDITION), `tout le bloc sous ${CONDITION}`)

  // Le ressort : le dernier de la colonne (`::after`). Sa marge du bas, négative, reprend ce que la marge de la coquille
  // peut rendre ; il le lui rend en grandissant, avant quiconque et jamais au-delà — large, la page est celle d'avant ;
  // juste, la marge se resserre et la coquille garde sa hauteur d'écran. Sa marge du haut reprend l'écart de la colonne,
  // qui le sépare du dernier enfant comme d'un autre.
  for (const coquille of COQUILLES) {
    const ressort = uneRegleDuBloc(`.${coquille}::after`)
    assert.equal(valeur(ressort, 'content'), 'var(--pieces-du-bout)')
    assert.equal(valeur(ressort, 'flex'), '9999 1 0px')
    assert.equal(valeur(ressort, 'min-height'), '0')
    assert.equal(valeur(ressort, 'max-height'), 'var(--marge-du-bout)')
    assert.equal(valeur(ressort, 'margin'), 'calc(-1 * var(--ecart-de-la-colonne)) 0 calc(-1 * var(--marge-du-bout))')
  }

  // La rallonge : hors du flux, sous la coquille — et sous ce que le corps garde à la barre du menu. Elle rend au bout
  // d'une page plus longue que l'écran ce dont la coquille dépasse sa hauteur d'écran, jusqu'à la marge entière. La
  // hauteur d'écran est celle même que la coquille se donne (le bloc « Une page prend l'écran, pas plus ») : changer l'une
  // sans l'autre, et une page qui tient défilerait de leur écart.
  const hauteurDEcran = HORS_DU_BLOC.filter(r => r.selecteur === '.player-shell' && r.sous.join() === '@supports (min-height: 100dvh)').map(r => valeur(r.corps, 'min-height'))
  assert.deepEqual(hauteurDEcran, ['calc(100dvh - var(--haut-du-menu, 0px) - var(--haut-du-bandeau, 0px))'])
  const ecran = hauteurDEcran[0]!.replace(/^calc\((.*)\)$/, '$1')
  for (const selecteur of ['.player-shell:not(.duels-verdict)::before', '.join::before']) {
    const rallonge = uneRegleDuBloc(selecteur)
    assert.equal(valeur(rallonge, 'content'), 'var(--pieces-du-bout)')
    assert.equal(valeur(rallonge, 'position'), 'absolute')
    assert.equal(valeur(rallonge, 'top'), 'calc(100% + var(--haut-du-menu, 0px))')
    assert.equal(valeur(rallonge, 'height'), `clamp(0px, calc(100% - (${ecran})), var(--marge-du-bout))`)
    // Elle ne prend aucun doigt, et reprend le fond de sa coquille : le sol plein d'une page du Cabinet va jusqu'au bout.
    assert.equal(valeur(rallonge, 'pointer-events'), 'none')
    assert.equal(valeur(rallonge, 'background'), 'inherit')
  }
  // Sa hauteur lit celle de la coquille (`100%`) : la coquille en est le repère. Sans force, pour qu'une coquille déjà
  // positionnée le reste — une question, le verdict d'un duel.
  assert.equal(valeur(uneRegleDuBloc(':where(.player-shell, .join)'), 'position'), 'var(--repere-du-bout, static)')

  // Rien d'autre : le bloc ne réécrit ni une marge, ni une hauteur, ni un écart. Chaque règle garde ce qu'elle pose, et
  // un navigateur qui ne lit pas le bloc garde la page d'avant.
  for (const r of DU_BLOC) {
    if (r.selecteur.includes('::')) continue
    const proprietes = [...r.corps.matchAll(/(?:^|[;\s])([\w-]+)\s*:/g)].map(m => m[1])
    assert.deepEqual(proprietes.filter(p => !p.startsWith('--') && p !== 'position'), [], `${r.selecteur} ne pose que des variables`)
  }
  // Et aucune coquille à ressort n'a déjà l'une des deux pièces à son compte.
  const prises = HORS_DU_BLOC.filter(r => /::(?:before|after)$/.test(r.selecteur) && viseUneCoquilleARessort({ ...r, selecteur: r.selecteur.replace(/::\w+$/, '') }))
  assert.deepEqual(prises.map(r => r.selecteur), [])
})

test('ce que chaque marge rend : la marge que sa règle pose, moins ce qui ne se rend jamais', () => {
  // L'encoche du bas d'un téléphone ne se rend pas : rien ne doit s'y poser. La marge d'une coquille est la plus grande
  // des deux (`max(28px, env(…))`) : il reste à rendre ce que la marge a de plus que l'encoche.
  const rendue = (px: number) => `max(0px, calc(${px}px - env(safe-area-inset-bottom, 0px)))`
  const duBas = (padding: string) => /max\((\d+)px, env\(safe-area-inset-bottom\)\)$/.exec(padding)?.[1]
  // La page d'un téléphone : 28 px.
  const invite = duBas(dAilleurs('.player-shell', 'padding'))
  assert.equal(invite, '28')
  assert.equal(valeur(uneRegleDuBloc('.player-shell'), '--marge-du-bout'), rendue(Number(invite)))
  // Un formulaire : 36 px.
  const formulaire = duBas(dAilleurs('.join', 'padding'))
  assert.equal(formulaire, '36')
  assert.equal(valeur(uneRegleDuBloc('.join'), '--marge-du-bout'), rendue(Number(formulaire)))
  // Au-dessus de la barre du menu, le corps garde déjà l'encoche : les 24 px de la coquille se rendent tous.
  assert.equal(dAilleurs('body.avec-menu .player-shell', 'padding-bottom'), '24px')
  assert.equal(valeur(uneRegleDuBloc('body.avec-menu .player-shell'), '--marge-du-bout'), '24px')
  // Au-dessus de la barre du chef, la coquille garde la hauteur de la barre, qui ne se rend pas : 88 - 64, et 112 - 88
  // quand elle nomme ceux qu'on attend.
  const px = (v: string) => Number(/^(\d+)px$/.exec(v)?.[1])
  assert.equal(px(dAilleurs('body.avec-chef .player-shell', 'padding-bottom')) - px(dAilleurs('.barre-chef', 'min-height')), 24)
  assert.equal(px(dAilleurs('body.avec-chef:has(.barre-chef-attente) .player-shell', 'padding-bottom')) - px(dAilleurs('.barre-chef:has(.barre-chef-attente)', 'min-height')), 24)
  assert.equal(valeur(uneRegleDuBloc('body.avec-chef .player-shell'), '--marge-du-bout'), '24px')
  // Chez le compagnon, la marge du bas suit la hauteur de l'écran, de rien sur un téléphone à 24 px sur un grand écran
  // (`--chez-bas`) : le ressort lit la même variable. À 24 px sur une page qui n'en a plus, ce dont son contenu
  // dépassait l'écran, jusqu'à 24 px, passait derrière le menu sans que la page défile.
  assert.equal(dAilleurs('body.avec-menu .player-shell.chez-page', 'padding-bottom'), 'var(--chez-bas)')
  assert.equal(valeur(uneRegleDuBloc('body.avec-menu .player-shell.chez-page'), '--marge-du-bout'), 'var(--chez-bas)')
  assert.equal(dAilleurs('.chez-page', '--chez-bas'), 'calc(0px + var(--chez-aise) * 24 / 280)')
  // Une question du Cabinet hérite des 46 px où une soirée écrit « Réponse enregistrée ». Elle n'y écrit rien — aucun de
  // ses jeux ne pose de consigne sous sa grille —, et sa page défile : toute cette marge se rend.
  assert.equal(dAilleurs('.player-shell:has(.ans-grid)', 'padding-bottom'), '46px')
  assert.equal(valeur(uneRegleDuBloc('.cab-partie:has(.ans-grid)'), '--marge-du-bout'), rendue(46))
  assert.equal(dAilleurs('.cab-partie:has(.ans-grid)', 'height'), 'auto')
  // Sa hauteur d'écran est celle que lit la rallonge : ni menu ni bandeau pendant une question.
  assert.equal(dAilleurs('.cab-partie:has(.ans-grid)', 'min-height'), '100dvh')
  assert.match(CSS, /\nbody:has\(\.player-shell \.ans-grid\) \.bandeau-du-service \{ display: none; \}/)
  for (const jeu of readdirSync(new URL('views/cabinet/jeux/', racine))) {
    assert.doesNotMatch(readFileSync(new URL(`views/cabinet/jeux/${jeu}`, racine), 'utf8'), /className="hint/, `${jeu} n'écrit rien sous sa grille`)
  }
  // Le départ d'une série se resserre sur un téléphone : sous 900 px de haut, sa marge du bas passe à 16 px. Sa règle
  // le redit elle-même au ressort — sans quoi il lui reprendrait les 28 px de la coquille, douze de plus qu'elle n'en a,
  // et sa page finirait douze pixels avant son contenu. Dans la règle même, pas dans le bloc : sous les mêmes requêtes
  // d'écran, des jumelles y feraient quatre pas de hauteur là où `heros.test.ts` en compte deux.
  const serie = HORS_DU_BLOC.filter(r => r.selecteur === DEPART_D_UNE_SERIE && valeur(r.corps, 'padding-bottom') !== undefined)
  assert.deepEqual(
    serie.map(r => [r.sous.join(), duBas(valeur(r.corps, 'padding-bottom')!), valeur(r.corps, '--marge-du-bout')]),
    [['@media (max-height: 899px)', '16', rendue(16)]],
  )

  // Aucune autre règle ne dit ce qu'une marge rend : une coquille de plus qui pose sa marge du bas entre dans le bloc.
  const dites = REGLES.filter(r => valeur(r.corps, '--marge-du-bout') !== undefined).map(r => r.selecteur)
  assert.deepEqual(dites, [
    DEPART_D_UNE_SERIE,
    '.player-shell',
    '.join',
    'body.avec-menu .player-shell',
    'body.avec-chef .player-shell',
    'body.avec-menu .player-shell.chez-page',
    '.cab-partie:has(.ans-grid)',
  ])
})

test('une règle qui pose la marge du bas ou la hauteur d’une coquille dit si sa marge se resserre', () => {
  // Chaque règle de la feuille qui pose une marge du bas (`padding`, `padding-bottom`) ou une hauteur sur une coquille à
  // ressort, connue ici. Une de plus : sa marge se rend-elle (le bloc dit combien), ou la coquille la garde-t-elle
  // telle quelle (elle rejoint les intactes) ? Sans réponse, le ressort lui reprendrait 28 px qu'elle n'a pas.
  const posent = HORS_DU_BLOC.filter(r => viseUneCoquilleARessort(r) && ['padding', 'padding-bottom', 'padding-block', 'min-height', 'height', 'max-height'].some(p => valeur(r.corps, p) !== undefined))
  const connues = new Set([
    // Les deux coquilles, leur marge et leur hauteur d'écran (le bloc « Une page prend l'écran, pas plus »).
    '.player-shell',
    '.join',
    // Les marges que le bloc rend.
    'body.avec-menu .player-shell',
    'body.avec-chef .player-shell',
    'body.avec-chef:has(.barre-chef-attente) .player-shell',
    // Chez le compagnon : sa marge suit la hauteur de l'écran, et le bloc rend ce qu'elle a (`--chez-bas`).
    'body.avec-menu .player-shell.chez-page',
    // Une question : intacte, sauf au Cabinet, dont la marge se rend.
    '.player-shell:has(.ans-grid)',
    '.player-shell:has(.ans-grid:is(.ans-md, .ans-sm))',
    'body.avec-chef .player-shell:has(.ans-grid)',
    'body.avec-chef:has(.barre-chef-attente) .player-shell:has(.ans-grid)',
    '.cab-partie:has(.ans-grid)',
    // Le départ d'une série, resserré sur un téléphone : sa marge de 16 px se rend.
    DEPART_D_UNE_SERIE,
    // L'Expédition, par une forme que seules ses pages ont : intacte.
    '.player-shell:has(.ans-grid.exp-six)',
    // Un formulaire dans la porte de la télé : intact.
    '.porte-ecran .join',
  ])
  assert.deepEqual([...new Set(posent.map(r => r.selecteur))].filter(s => !connues.has(s)), [])
})

test('le ressort reprend l’écart de sa colonne : le même, dans le même ordre', () => {
  // Une colonne (`gap`) sépare aussi ses enfants du ressort : il reprend cet écart par sa marge du haut. Plus petit que
  // celui de la colonne, la page finirait trop bas — et défilerait de leur différence — ; plus grand, la coquille serait
  // plus courte que son contenu. Chaque règle qui pose l'écart d'une coquille à ressort a donc sa jumelle dans le bloc :
  // le même sélecteur, sous la même requête d'écran, la même valeur — et dans le même ordre, pour que le même l'emporte
  // des deux côtés.
  const px = (v: string) => (v === '0' ? '0px' : v)
  /** Chaque écart, « sous quelle requête d'écran, quel sélecteur → combien », dans l'ordre de la feuille. Un sélecteur posé
   *  deux fois (`.fin-soiree`) compte à sa dernière règle : c'est elle qui l'emporte. */
  const dansLOrdre = (lues: { regle: Regle; sous: string[]; ecart: string }[]) => {
    const derniers = new Map<string, { ecart: string; ou: number }>()
    for (const l of lues) derniers.set([...l.sous, l.regle.selecteur].join(' '), { ecart: l.ecart, ou: l.regle.ou })
    return [...derniers.entries()].sort((a, b) => a[1].ou - b[1].ou).map(([cle, v]) => `${cle} → ${v.ecart}`)
  }
  const ecartDe = (r: Regle) => valeur(r.corps, 'gap') ?? valeur(r.corps, 'row-gap')
  const posent = HORS_DU_BLOC.filter(r => viseUneCoquilleARessort(r) && ecartDe(r) !== undefined)
  // Le départ d'une série, et lui seul, redit le sien dans sa règle même, à ses deux pas de hauteur : la même valeur, à
  // côté de l'écart qu'elle pose. Rien d'autre, hors du bloc, ne parle au ressort.
  const dElleMeme = posent.filter(r => valeur(r.corps, '--ecart-de-la-colonne') !== undefined)
  assert.deepEqual(
    dElleMeme.map(r => `${r.sous.join()} ${r.selecteur} → ${px(ecartDe(r)!)} / ${valeur(r.corps, '--ecart-de-la-colonne')}`),
    [`@media (max-height: 899px) ${DEPART_D_UNE_SERIE} → 12px / 12px`, `@media (max-height: 759px) ${DEPART_D_UNE_SERIE} → 10px / 10px`],
  )
  const auRessort = (r: Regle) => valeur(r.corps, '--ecart-de-la-colonne') !== undefined || valeur(r.corps, '--marge-du-bout') !== undefined
  assert.deepEqual([...new Set(HORS_DU_BLOC.filter(auRessort).map(r => r.selecteur))], [DEPART_D_UNE_SERIE])
  // Hors du bloc, sa place dans la feuille n'est plus celle de ses jumelles : elle doit l'emporter sur chacune par sa
  // force seule, comme son écart et sa marge l'emportent — sinon elle rejoint le bloc, dans l'ordre.
  const plusForte = (a: [number, number], b: [number, number]) => a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])
  assert.deepEqual([forceDe(DEPART_D_UNE_SERIE), forceDe('body.avec-menu .player-shell'), forceDe(':where(.player-shell, .join)')], [[3, 0], [2, 1], [0, 0]])
  assert.ok(DU_BLOC.filter(auRessort).length >= 12, 'les jumelles du bloc se lisent')
  // Une jumelle ne lui dispute rien si elle ne peut pas viser sa coquille. Celle du compagnon porte `chez-page`, que la
  // page de la campagne ne porte jamais ; elle seule est aussi forte que lui — il lui faut l'emporter sur la marge d'une
  // page à menu. Toute autre, qu'elle puisse le viser ou non, reste plus faible : une de plus s'ajoute ici en le sachant.
  const DE_LA_CAMPAGNE = RENDUES.filter(classes => classes.includes('campagne'))
  assert.ok(DE_LA_CAMPAGNE.length > 0, 'les coquilles de la campagne se lisent')
  const peutLeViser = (selecteur: string) => DE_LA_CAMPAGNE.some(rendue => sujetDe(selecteur).classes.every(c => rendue.includes(c)))
  const pasPlusFaibles: string[] = []
  for (const jumelle of DU_BLOC.filter(auRessort)) {
    if (plusForte(forceDe(DEPART_D_UNE_SERIE), forceDe(jumelle.selecteur))) continue
    assert.ok(!peutLeViser(jumelle.selecteur), `le départ d'une série l'emporte sur ${jumelle.selecteur}`)
    pasPlusFaibles.push(jumelle.selecteur)
  }
  assert.deepEqual(pasPlusFaibles, ['body.avec-menu .player-shell.chez-page'])
  const poses = dansLOrdre(posent.filter(r => !dElleMeme.includes(r)).map(r => ({ regle: r, sous: r.sous, ecart: px(ecartDe(r)!) })))
  // Dans le bloc, sous sa condition : seule la requête d'écran d'une règle compte.
  const repris = dansLOrdre(DU_BLOC.filter(r => valeur(r.corps, '--ecart-de-la-colonne') !== undefined).map(r => ({ regle: r, sous: r.sous.slice(1), ecart: valeur(r.corps, '--ecart-de-la-colonne')! })))
  // Les écarts posés se lisent bien : les deux coquilles, et ce que leurs pages changent — une fin de partie, la loge, le
  // départ d'une série sur un téléphone, les duels, une tablette.
  assert.ok(poses.includes('.player-shell → 18px') && poses.includes('.join → 26px') && poses.length >= 8, poses.join(' ; '))
  // Les deux coquilles d'abord, dans le bloc : leur règle de base, que toute autre précise.
  assert.deepEqual(repris.slice(0, 2), ['.player-shell → 18px', '.join → 26px'])
  assert.deepEqual([...repris].sort(), [...poses].sort(), 'chaque écart posé a sa jumelle dans le bloc, à la même valeur')
  // Le même ordre, les deux coquilles mises à part (`.join` précède `.player-shell` dans la feuille, sans jamais la croiser).
  const precisent = (liste: string[]) => liste.filter(l => !/^\.(?:player-shell|join) → /.test(l))
  assert.deepEqual(precisent(repris), precisent(poses))
})

test('celles qui gardent leur marge telle quelle n’ont ni ressort ni rallonge', () => {
  // Une seule règle les nomme : elle leur retire le contenu des deux pièces et le repère.
  const intactes = DU_BLOC.filter(r => valeur(r.corps, '--pieces-du-bout') === 'initial')
  assert.deepEqual(intactes.map(r => r.selecteur), INTACTES)
  assert.ok(intactes.every(r => valeur(r.corps, '--repere-du-bout') === 'initial'))
  // Les deux coquilles les posent ; sans elles (`initial`), `content: var(--pieces-du-bout)` ne vaut rien, et la pièce
  // n'existe pas.
  for (const coquille of COQUILLES) {
    assert.equal(valeur(uneRegleDuBloc(`.${coquille}`), '--pieces-du-bout'), "''")
    assert.equal(valeur(uneRegleDuBloc(`.${coquille}`), '--repere-du-bout'), 'relative')
  }
  // Chaque intacte a sa raison dans la feuille.
  // Une question tient l'écran au pixel près, et sa marge porte « Réponse enregistrée », hors du flux.
  assert.equal(dAilleurs('.player-shell:has(.ans-grid)', 'height'), '100dvh')
  assert.equal(dAilleurs('.player-shell:has(.ans-grid) .ans-grid + .hint', 'position'), 'absolute')
  // Le pied d'une partie du Cabinet reprend la marge de la page à son compte : les 28 px de la coquille.
  assert.match(dAilleurs('.cab-pied-partie', 'margin'), /^auto -20px -28px$/)
  // L'accueil et le carrefour du profil ont leur hauteur à eux, partagée entre leurs lignes.
  for (const page of ['accueil', 'profil-carrefour']) assert.match(dAilleurs(`body.avec-menu .${page}`, 'min-height'), /^min\(calc\(100/)
  // Le QG garde la place de sa barre, l'Expédition est fermée : leurs marges ne se touchent pas.
  assert.match(dAilleurs('.player-shell.qg', 'padding-bottom'), /^calc\(84px/)
  // Le verdict d'un duel tient son halo dans `::before` : la rallonge ne s'y pose pas.
  assert.equal(dAilleurs('.player-shell.duels-verdict::before', 'position'), 'fixed')
  // Un formulaire posé dans une autre page ne prend pas l'écran : sans hauteur d'écran, rien à rendre.
  assert.equal(dAilleurs('.join.cab-nom', 'min-height'), '0')
  assert.equal(dAilleurs('.porte-ecran .join', 'min-height'), '0')
  // Et les classes qui les désignent sont bien celles que le client pose : une coquille rendue sous l'une d'elles est
  // une intacte, où qu'elle soit.
  for (const marque of MARQUES_DES_INTACTES) {
    assert.ok(RENDUES.some(classes => classes.includes(marque)), `une coquille porte « ${marque} »`)
    assert.ok(INTACTES.some(s => s.includes(`.${marque}`)), `« ${marque} » est une intacte du bloc`)
  }
})
