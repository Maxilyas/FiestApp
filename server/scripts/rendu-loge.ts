// La loge (« M'habiller », `/profil#avatar` et ses pièces `#titre`, `#vitrine`,
// `#fond`, `#theme`, `#gerbe`), tenue sur un écran — ou presque.
//
// « J'aimerais bien que tu regardes les écrans, m'habiller, mon compagnon,
// classement des collections. Dans la mesure du possible j'aimerais que l'on
// puisse avoir tout sur le même écran ou presque » (le propriétaire, le
// 10 novembre 2026). On vient ici changer de tenue : sa carte, la rangée des
// six pièces et tout ce que la pièce ouverte laisse choisir avant sa grille —
// pour « Avatar », le rail de ses calques (le 26 novembre 2026 : la finition,
// la bordure et le sceau y ont chacun le leur), les gemmes des raretés —
// se voient sans défiler, puis le plus possible de la grille, qui défile par
// nature quand elle est longue : c'est le « presque ». Sans rien déplacer, ni
// ajouter, ni renommer : la place se gagne dans la feuille, à deux pas de
// hauteur d'écran (le bloc « La loge » de `styles.css`, ses variables
// `--loge-…`).
//
// Ce qui ne se voit qu'au navigateur se mesure ici, sur un serveur jetable, à
// six tailles — du petit téléphone de référence (360 × 640) au grand
// (412 × 915), dont un iPhone dans Safari, ses barres dépliées (390 × 664), et
// un grand Android dans Chrome (412 × 800) : Léa, une habituée — son Phénix
// éclaté et scellé, sa bordure d'or, trois trophées, deux thèmes achetés, un
// fond —, sans compagnon puis son loup dans sa niche, sur la page de l'avatar
// qu'elle porte puis sur celle de ses neuf avatars communs ; Tom, qui vient de
// créer son profil ; tout au plus long — les douze finitions du niveau 50, les
// six bordures, un Éclat en réserve, sept pages d'avatars — ; chacune des cinq
// autres pièces, et l'onglet « Mon podium » de la pièce « Thème » — chaque
// plaque essayée tour à tour au petit téléphone (`plaques`), sous l'Ivoire
// aussi — ; un essai en route, la barre « Annuler · Porter » à la place
// du menu ; une tablette, aux mesures d'avant ; le texte agrandi à 130 % ; sous
// le bandeau du service ; l'Ivoire. À chaque photo : où finissent la carte, la
// rangée des pièces et chaque bloc d'avant la grille, combien
// de rangées de la grille se voient entières et combien y auraient la place,
// ce que la carte collée laisse à la grille une fois la page défilée, les
// cibles de doigt sous 44 px, les textes sous 11 px, ce qui passe sous la niche.
//
//   npm run build -w client
//   cd server && npx tsx scripts/rendu-loge.ts ../export/loge
//
// `SEULEMENT=avatar,pieces` ne joue que ces cas, `--pieces=theme` que ces pièces ; `ENCOCHE=47` pose l'encoche
// d'un iPhone et sa barre d'accueil, en 390 × 844 ; `--client=<dossier>`, après
// le dossier des photos, photographie un autre client construit — celui d'avant
// une retouche, comme `mesure-pages.ts`. Le script sort en erreur si, dans un
// cas qui doit tenir, un bloc d'avant la grille passe sous le menu, à
// n'importe quelle taille, si la grille montre moins de rangées entières
// qu'attendu (`DOIT_TENIR`), si une cible de doigt descend sous 44 px ou un
// texte sous 11 px, si quelque chose
// passe sous la niche ou élargit la page, ou si la barre de l'essai monte plus
// haut que le menu qu'elle couvre ou fait bouger la page.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { ADMIN, connexionAnimateur, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { ProfileStore, VERSION_BAREME } from '../src/auth/profiles'
import { FINITIONS, xpDuNiveau } from '../../shared/profil'
import { LIGUES } from '../../shared/duels'
import { FONDS } from '../../shared/fonds'
import { GERBES } from '../../shared/gerbes'
import { HAUTS_FAITS_DE_CARRIERE, HAUTS_FAITS_REGAGNABLES, clePalier, hautFait, palierDe, titreDePalier } from '../../shared/hautsfaits'
import { PIECES_DE_LA_LOGE, type PieceDeLaLoge } from '../../shared/piecesDeLaLoge'
import { THEMES } from '../../shared/themes'
import { ecrireDesDuels } from './duelsDEssai'
import { SOUS_LA_NICHE } from './a-l-ecran'

const ici = path.dirname(fileURLToPath(import.meta.url))
const demandes = process.argv.slice(2)
const sortie = path.resolve(demandes.find(a => !a.startsWith('--')) ?? path.join(ici, '../../export/loge'))
/** Un autre client construit que `client/dist` : celui d'avant une retouche, pour comparer. */
const autreClient = demandes.find(a => a.startsWith('--client='))?.slice('--client='.length)
mkdirSync(sortie, { recursive: true })
ProfileStore.tirageEclat = () => false
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

type Ecran = [number, number]
/**
 * Le petit téléphone de référence, un iPhone dans Safari (ses barres dépliées), un moyen, un grand Android dans Chrome,
 * un iPhone d'aujourd'hui en application installée, un grand Android.
 */
const TOUS_LES_ECRANS: Ecran[] = [[360, 640], [390, 664], [360, 740], [412, 800], [390, 844], [412, 915]]
const DEUX_ECRANS: Ecran[] = [[360, 640], [390, 844]]
const PETIT: Ecran[] = [[360, 640]]
const TABLETTE: Ecran[] = [[768, 1024]]

/**
 * Ce que chaque pièce laisse lire ou choisir avant sa grille, et sa grille : ses cases, celles qu'on touche pour
 * essayer, et le nom de leur cible.
 */
const LES_PIECES: Record<PieceDeLaLoge, { avant: [nom: string, selecteur: string][]; cases: string; cible: string }> = {
  avatar: {
    // Depuis les calques du 26 novembre 2026 : le rail, puis — sur « Avatar » — l'Éclat en réserve et les gemmes. Les
    // grilles des autres calques ne se comptent pas ici : `calques` les photographie.
    avant: [
      ['les calques', '.loge-panneau > .loge-calques'],
      ['l’Éclat en réserve', '.loge-avatars > .loge-reserve'],
      ['les gemmes', '.loge-avatars > .gemmes-loge'],
    ],
    cases: '.loge-page-avatars .loge-grille > .loge-case',
    cible: 'un avatar',
  },
  // Les cinq autres parlent la même langue depuis le 17 novembre 2026 : un en-tête d'une ligne (`EnteteDeLaPiece`), puis
  // leurs vignettes, enfants directs de `.loge-vignettes` — un bouton, ou l'élément d'une liste qui le tient.
  titre: { avant: [['l’en-tête', '.loge-panneau .loge-entete']], cases: '.loge-panneau .loge-vignettes > *', cible: 'un titre' },
  // La vitrine : ses médailles seulement — la fiche ouverte sous une rangée n'est pas un choix de plus (`ficheDeLaVitrine`).
  vitrine: { avant: [['l’en-tête', '.loge-panneau .loge-entete']], cases: '.loge-panneau .loge-vignettes > :not(.loge-fiche)', cible: 'un trophée' },
  fond: { avant: [['l’en-tête', '.loge-panneau .loge-entete']], cases: '.loge-panneau .loge-vignettes > *', cible: 'un fond' },
  theme: { avant: [['l’en-tête', '.loge-panneau .loge-entete']], cases: '.loge-panneau .loge-vignettes > *', cible: 'un thème' },
  gerbe: { avant: [['l’en-tête', '.loge-panneau .loge-entete']], cases: '.loge-panneau .loge-vignettes > *', cible: 'une gerbe' },
}

/**
 * Ce que la loge mesure, la page en haut : où commence ce qui couvre le bas de l'écran (le menu, ou la barre de
 * l'essai), où finissent sa tête, sa carte, la rangée des pièces, chaque bloc d'avant la grille, les
 * rangées de la grille, les cibles de doigt, les textes trop petits. En texte : `tsx` y
 * glisserait des `__name` — et sans accent grave dedans, qui fermerait le gabarit.
 */
const LA_LOGE = (piece: PieceDeLaLoge) => `(() => {
  const PIECE = ${JSON.stringify(LES_PIECES[piece])}
  const boite = el => {
    if (typeof el === 'string') el = document.querySelector(el)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return r.width > 1 && r.height > 1 ? { haut: Math.round(r.top + scrollY), bas: Math.round(r.bottom + scrollY) } : null
  }
  const menu = document.querySelector('.menu-barre')
  const essai = document.querySelector('.loge-barre')
  const couvre = essai || menu
  const pli = Math.round(couvre ? couvre.getBoundingClientRect().top : innerHeight)
  const lesCases = [...document.querySelectorAll(PIECE.cases)]
  const rangees = []
  for (const r of lesCases.map(el => el.getBoundingClientRect()).filter(r => r.width > 1 && r.height > 1)) {
    const haut = Math.round(r.top + scrollY), bas = Math.round(r.bottom + scrollY)
    const rangee = rangees.find(x => Math.abs(x.haut - haut) < 4)
    if (rangee) { rangee.bas = Math.max(rangee.bas, bas); rangee.cases++ } else rangees.push({ haut, bas, cases: 1 })
  }
  // Ce que la grille aurait la place de montrer au-dessus du pli, si elle avait assez de cases : des rangées de la
  // hauteur de la première, à l'écart de sa grille.
  const ecart = lesCases.length ? parseFloat(getComputedStyle(lesCases[0].parentElement).rowGap) || 0 : 0
  const place = rangees.length ? Math.max(0, Math.floor((pli - rangees[0].haut + ecart) / (rangees[0].bas - rangees[0].haut + ecart))) : 0
  // Une cible de doigt : ce qu'on touche, sa plus petite hauteur et sa plus petite largeur parmi celles qu'on voit.
  const cible = sel => {
    const vues = [...document.querySelectorAll(sel)].map(el => el.getBoundingClientRect()).filter(r => r.width > 1 && r.height > 1)
    return vues.length ? { n: vues.length, haut: Math.round(Math.min(...vues.map(r => r.height))), large: Math.round(Math.min(...vues.map(r => r.width))) } : null
  }
  const CIBLES = {
    'le retour': '.loge-tete .jour-sortie',
    'la carte': '.loge-carte-ouvrir',
    'les tenues': '.loge-tenues',
    'une pièce': '.loge-piece',
    'un calque': '.loge-calque',
    'une pastille': '.finition-choix',
    'une gemme': '.gemmes-loge .gemme',
    [PIECE.cible]: PIECE.cases + ' button, ' + PIECE.cases + '[type=button]',
    'à gagner': '.loge-a-gagner',
    // La pièce « Thème » : ses deux onglets, « Mes thèmes · Mon podium ».
    'un onglet': '.loge-theme-onglets [role=tab]',
    'l’Éclat': '.loge-reserve .btn',
    'la barre': '.loge-barre .btn',
  }
  const cibles = {}
  for (const nom in CIBLES) { const c = cible(CIBLES[nom]); if (c) cibles[nom] = c }
  // Aucun texte sous l'étiquette (11 px à 100 %) : ce qui se lit dans la loge, hors de ce qui n'est dit qu'à l'oreille.
  const racine = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const petits = []
  const marcheur = document.createTreeWalker(document.querySelector('.loge-page') || document.body, NodeFilter.SHOW_TEXT)
  for (let t = marcheur.nextNode(); t; t = marcheur.nextNode()) {
    const el = t.parentElement
    if (!el || !t.textContent.trim() || el.closest('.sr-only, .menu-barre, .niche')) continue
    const r = el.getBoundingClientRect()
    if (r.width <= 1 || r.height <= 1) continue
    const taille = parseFloat(getComputedStyle(el).fontSize)
    if (taille < racine * 0.6875 - 0.01) petits.push('« ' + [...t.textContent.trim()].slice(0, 24).join('') + ' » ' + taille + ' px')
  }
  const carte = boite('.loge-carte')
  // Ce que la carte tait à l'œil sur un écran court — son niveau suivant, ses confettis — reste lu : réduit à un point.
  const jauge = document.querySelector('.loge-carte > .xp-mince')
  return {
    ecran: innerWidth + '×' + innerHeight,
    pli,
    couvre: essai ? 'essai' : menu ? 'menu' : 'rien',
    hautDeLaBarre: couvre ? Math.round(couvre.getBoundingClientRect().height) : 0,
    defile: Math.max(0, document.documentElement.scrollHeight - innerHeight),
    large: document.documentElement.scrollWidth > innerWidth + 1,
    bandeau: (() => { const b = document.querySelector('#root .bandeau-du-service'); return b ? Math.round(b.parentElement.getBoundingClientRect().height) : 0 })(),
    tete: boite('.loge-tete'),
    carte,
    jaugeMontree: !!jauge && jauge.getBoundingClientRect().height > 2,
    // Ce qui fait la hauteur de la carte, pièce par pièce (au rapport seulement) : son avatar, son texte, sa jauge.
    dansLaCarte: Object.fromEntries(
      ['.loge-carte-haut', '.loge-carte-avatar', '.loge-carte-texte', '.loge-carte .identite-nom', '.loge-carte-titre', '.loge-carte-vitrine', '.loge-carte > .xp-mince'].map(sel => {
        const el = document.querySelector(sel)
        return [sel, el ? Math.round(el.getBoundingClientRect().height * 10) / 10 : null]
      }),
    ),
    pieces: boite('.loge-pieces'),
    avant: PIECE.avant.map(([nom, sel]) => ({ nom, ...boite(sel) })).filter(b => b.bas !== undefined),
    rangees,
    place,
    gagner: boite('.loge-a-gagner'),
    // Le pied d'une pièce en vignettes : ses chemins vers la boutique et la collection.
    pied: boite('.loge-panneau .loge-pied'),
    // La carte reste collée en haut : la page défilée, ce qu'elle laisse à la grille, entre elle et ce qui couvre le bas.
    sousLaCarte: carte ? pli - (carte.bas - carte.haut) : null,
    cibles,
    petits: [...new Set(petits)],
  }
})()`

const banc = await demarrer(autreClient ? { clientDist: path.resolve(autreClient) } : {})
const navigateur = await chromium.launch({ headless: true })
const seulement = (process.env.SEULEMENT ?? '').split(',').filter(Boolean)
const retenu = (nom: string) => !seulement.length || seulement.includes(nom)
/** `--pieces=theme,gerbe` : dans les cas `pieces` et `pleines`, ces pièces seulement — une pièce qu'on retouche, regardée seule. */
const piecesDemandees = (demandes.find(a => a.startsWith('--pieces='))?.slice('--pieces='.length) ?? '').split(',').filter(Boolean)
const pieceRetenue = (id: PieceDeLaLoge) => !piecesDemandees.length || piecesDemandees.includes(id)
const encoche = Number(process.env.ENCOCHE ?? 0)
/** Une encoche ne se pose que sur un écran qui en a une : un iPhone d'aujourd'hui, pas le petit téléphone de référence. */
const reels = (ecrans: Ecran[]): Ecran[] => (encoche ? [[390, 844]] : ecrans)
const rapport: Record<string, any> = {}
let rate = 0
const base = () => new Database(banc.quizDbUrl.replace(/^file:/, ''))

/**
 * Les cas où ce qu'on vient faire doit se voir sans défiler : sinon, le script sort en erreur. Les autres — tout au
 * plus long, une tablette, le texte agrandi, le bandeau du service — se disent sans faire échouer.
 */
const DOIVENT_TENIR = ['sans-niche', 'debutant', 'avatar', 'commune', 'pieces', 'essai', 'ivoire']
/**
 * Ce qui doit tenir, dans chacun de ces cas et à chaque taille (mesuré le 10 novembre 2026) : tout ce que la pièce
 * laisse choisir avant sa grille, au-dessus du menu ; et de sa grille, autant de rangées entières que le compte rendu
 * ici, au moins — jamais plus qu'elle n'en a.
 *
 * Une habituée qui a ses trois réglages — finition, bordure, sceau — et son compagnon : tout tient avant la grille à
 * chaque taille — à deux pixels du menu sur le petit téléphone de référence, où sa niche tient la carte à 86 px du
 * haut —, une rangée d'avatars dès 740 px de haut, deux dès 844, trois en 915. Un nouveau venu — une seule gemme, des
 * cases d'emoji plus basses — : deux rangées sur le petit téléphone, trois dès 740, quatre dès 844, cinq en 915. Les
 * cinq autres pièces : ce qu'elles disent avant leur grille, et une rangée au moins.
 *
 * La quatrième rangée d'un nouveau venu se voyait dès 800 px le matin du 10 novembre 2026 : ce que sa bordure lui dit
 * tenait sur deux lignes en 412 de large. Le même jour, la règle des crans y a ajouté « , ou plus haut, » — « chaque
 * duel gagné dans la ligue, ou plus haut, y sertit un cran » : trois lignes à toutes les largeurs de téléphone, 19 px
 * de plus, et la quatrième rangée finit 7 px sous le menu en 412 × 800. La phrase reste entière — un nouveau venu
 * n'a qu'elle pour comprendre ses bordures — : c'est le compte qui suit, pas elle qui se coupe.
 */
const DOIT_TENIR = (hauteur: number, nom: string, piece: PieceDeLaLoge): number => {
  if (piece !== 'avatar') return 1
  if (nom === 'debutant') return hauteur >= 900 ? 5 : hauteur >= 844 ? 4 : hauteur >= 740 ? 3 : 2
  return hauteur >= 900 ? 3 : hauteur >= 844 ? 2 : hauteur >= 740 ? 1 : 0
}
/**
 * La hauteur qui compte pour ce qui doit tenir : sous l'encoche d'un iPhone, la page commence plus bas (son retrait du
 * haut passe de 24 px à l'encoche) et le menu monte de la barre d'accueil (34 px au lieu de ses 6).
 */
const hauteurUtile = (hauteur: number) => hauteur - (encoche ? Math.max(0, encoche - 24) + 28 : 0)
/** La hauteur d'une cible de doigt, au moins — sa largeur se lit au rapport : une pastille a celle de son nom, depuis toujours. */
const CIBLE = 44
/**
 * Une cible d'avant, plus basse, que ce resserrement n'a pas touchée — aucune depuis le 26 novembre 2026 : « Version
 * rare », sur la carte (30 px), est devenue le calque « Version », et le cintre des tenues, à sa place, a sa cible de 44.
 * Un titre de la pièce « Titre » en faisait 34 jusqu'au 17 novembre 2026, ses cellules de texte 44 depuis.
 */
const D_AVANT: Record<string, number> = {}

try {
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
  {
    const db = base()
    const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('lea') as { id: string }).id
    const espace = (db.prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
    // Léa, une habituée : le niveau 14 — cinq finitions —, sa bordure d'or à sept crans, le Phénix qu'elle porte, gagné
    // par son haut fait — scellé, donc — et éclaté — « Version rare » sur sa carte —, trois trophées pour ses titres et
    // sa vitrine, la forêt au cinquième palier et les mythologies au deuxième — ses portraits, sur trois pages —, deux
    // thèmes achetés, la pluie d'étoiles.
    db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#jour', '', ?, ?, 1)`).run(id, xpDuNiveau(14), JSON.stringify({ v: VERSION_BAREME, jours: 1 }))
    db.prepare('UPDATE profiles SET xp = ? WHERE id = ?').run(xpDuNiveau(14), id)
    ecrireDesDuels(db, id, 'or', 7)
    const badge = db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, 'une-soiree-d-avant', ?, ?, ?, 1)`)
    for (const cle of ['hf:phenix', 'hf:sans-faute:1', 'hf:oracle']) {
      const palier = palierDe(cle)
      const h = palier ? palier.hautFait : hautFait(cle)!
      badge.run(id, cle, espace, h.emoji, palier ? titreDePalier(palier.hautFait, palier.palier) : h.title)
    }
    for (const [branche, paliers] of [['foret', 5], ['mythes', 2]] as const) db.prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, 1)').run(id, branche, paliers)
    const achat = db.prepare('INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 0, 1)')
    for (const theme of ['neige', 'ocean']) achat.run(id, theme)
    db.prepare(`INSERT INTO profile_eclats (profile_id, avatar, soiree_id, created_at) VALUES (?, 'lg:phenix', 'une-soiree-d-avant', 1)`).run(id)
    // De quoi acheter un fond des savoirs, puis son loup : 2 500 bonnes réponses au quiz du jour, autant de confettis.
    db.prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, '2026-09-20', 1, 10, NULL, 0, 2500, 1, 0)`).run(id)
    db.close()
  }
  // Ce qui s'est écrit derrière le dos du serveur ne se lit qu'après son redémarrage (les journaux en mémoire).
  await banc.redemarrer()
  const porte = async (corps: object, cookie = lea) => {
    const r = await ecrire(banc.url, '/api/joueur/moi', corps, cookie, 'PUT')
    if (!r.ok) throw new Error(`La tenue ne se porte pas (${r.status} ${await r.text()})`)
  }
  await porte({ legendaire: 'lg:phenix', gerbe: 'etoiles', titre: 'hf:phenix' })
  {
    const r = await ecrire(banc.url, '/api/joueur/fonds', { fond: 'vitrail' }, lea)
    if (!r.ok) throw new Error(`Le fond ne s'achète pas (${r.status} ${await r.text()})`)
  }

  type Cas = {
    cookie: string
    /** La page d'avatars ouverte, par sa gemme (`commune`…) ; sans elle, celle de l'avatar porté. */
    page?: string
    /**
     * Tout au plus long, la réponse du profil réécrite en route : les douze finitions du niveau 50 — deux lignes de
     * pastilles —, les six bordures, un Éclat en réserve, un Divin — la septième page d'avatars.
     */
    tout?: boolean
    /** Un essai en route : une finition touchée, la barre « Annuler · Porter » à la place du menu. */
    essai?: boolean
    /** Le texte agrandi, en pour cent. */
    texte?: number
    /** Un vétéran, pour les cinq autres pièces : la réponse du profil réécrite en route, chaque pièce pleine (`PLEIN`). */
    plein?: boolean
  }
  /**
   * Un vétéran des titres et de la vitrine : trente trophées de soirée, du quiz du jour et de la campagne, douze pistes
   * de carrière à l'argent, trois sentiers menés au maître, deux champions du mois et deux défis du Cabinet tenus à l'Or —
   * soixante et un titres, chacun sur l'étagère de sa carte. Les deux pièces le lisent : une seule fonction, qui ne
   * fait rien de plus la seconde fois.
   */
  const unVeteran = (p: any) => {
    const gagnes = new Set<string>([...HAUTS_FAITS_REGAGNABLES.slice(0, 30).map(h => h.key), ...HAUTS_FAITS_DE_CARRIERE.slice(0, 12).map(h => h.key)])
    p.hautsFaits = p.hautsFaits.map((h: any) => (gagnes.has(h.key) ? { ...h, fois: h.famille === 'soiree' ? 1 : 2 } : h))
    p.vitrine = p.hautsFaits
      .filter((h: any) => gagnes.has(h.key))
      .map((h: any) => ({ key: h.famille === 'soiree' ? h.key : clePalier(h.key, 2), emoji: h.emoji, title: h.title, fois: 1, dernier: 0, porteurs: 0, rarete: null }))
    p.sentiers = { ...p.sentiers, foret: 13, monde: 13, stade: 13 }
    p.titresDates = ['mois:2026-10', 'mois:2026-09']
    p.titresDuCabinet = ['cabinet:defi:cagnotte:3', 'cabinet:defi:parade:3']
  }
  /**
   * Ce qu'un vétéran a dans chaque pièce, écrit par-dessus la réponse du profil (le cas `pleines`) : des dizaines de
   * titres et de trophées, tous les fonds, tous les thèmes, toutes les gerbes — ce que Léa, une habituée, n'a pas encore,
   * et qui faisait défiler chaque pièce de plusieurs écrans. Mesuré sans faire échouer : une pièce pleine défile, par
   * nature ; ce qui compte, c'est combien de vignettes se voient, et ce que coûte d'arriver jusqu'au bout.
   */
  const PLEIN: Record<Exclude<PieceDeLaLoge, 'avatar'>, (p: any) => void> = {
    titre: unVeteran,
    vitrine: unVeteran,
    fond: p => {
      p.fonds = FONDS.map(f => f.key)
    },
    // Les trente-cinq thèmes : ceux qui se vendent, ceux de saison, ceux qui se gagnent.
    theme: p => {
      p.boutique.possedes = THEMES.map(t => t.key)
    },
    gerbe: p => {
      p.gerbes = GERBES.map(g => g.key)
    },
  }
  const ouvrir = async (cas: Cas, [largeur, hauteur]: Ecran) => {
    const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 2, isMobile: largeur < 600, hasTouch: true, reducedMotion: 'reduce' })
    const [cle, valeur] = cas.cookie.split('=')
    await ctx.addCookies([{ name: cle, value: valeur, url: banc.url }])
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    // L'encoche d'un iPhone et sa barre d'accueil, 34 px en bas : Chromium sans écran les tient à zéro (skill `regarder-le-rendu`).
    if (encoche) {
      const cdp = await ctx.newCDPSession(page)
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: encoche, topMax: encoche, bottom: 34, bottomMax: 34, left: 0, leftMax: 0, right: 0, rightMax: 0 } })
    }
    if (cas.tout) {
      await page.route(/\/api\/joueur\/moi$/, async (route: any) => {
        if (route.request().method() !== 'GET') return route.continue()
        const reponse = await route.fetch()
        const j = await reponse.json()
        Object.assign(j.profile, {
          niveau: 50,
          ouvertes: [...FINITIONS],
          finition: FINITIONS[FINITIONS.length - 1],
          bordures: LIGUES.map((l, i) => ({ ligue: l.cle, crans: Math.min(12, 2 * i + 1) })),
          eclatsEnReserve: 1,
          divins: [{ key: 'dv:helios', legende: 'Une légende que seul son porteur lit.', ton: 'eclat' }],
        })
        await route.fulfill({ response: reponse, json: j })
      })
    }
    if (cas.plein) {
      await page.route(/\/api\/joueur\/moi$/, async (route: any) => {
        if (route.request().method() !== 'GET') return route.continue()
        const reponse = await route.fetch()
        const j = await reponse.json()
        for (const remplir of Object.values(PLEIN)) remplir(j.profile)
        await route.fulfill({ response: reponse, json: j })
      })
    }
    return { ctx, page }
  }
  /** La loge arrivée : ses panneaux venus à la demande, son réseau au repos, ses images, ses polices. */
  const attendre = async (page: any, attendu: string) => {
    await page.waitForSelector(attendu, { timeout: 15000 })
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
    await page.evaluate('document.fonts.ready')
    await page.waitForTimeout(700)
  }
  const ATTENDUS: Record<PieceDeLaLoge, string> = {
    // Le rail des calques : la loge s'ouvre sur celui qui a du neuf — pas toujours « Avatar » (`surLAvatar`).
    avatar: '.loge-panneau .loge-calques',
    titre: '.loge-panneau .loge-vignettes',
    vitrine: '.loge-panneau .loge-vignettes',
    fond: '.loge-panneau .loge-vignettes',
    theme: '.loge-panneau .loge-vignettes',
    gerbe: '.loge-panneau .loge-vignettes',
  }
  /**
   * Le calque « Avatar » ouvert : la loge s'ouvre sur le premier calque qui a du neuf (`calqueDOuverture`), et une
   * visite d'avant a pu laisser une finition ou une bordure à voir. Dit, s'il a fallu le toucher.
   */
  const surLAvatar = async (page: any, n: string) => {
    const ouvert = (await page.evaluate(`document.querySelector('.loge-calque[aria-selected="true"]')?.id ?? ''`)) as string
    if (ouvert === 'calque-avatar') return
    console.log(`   ${n} — la loge s’est ouverte sur « ${ouvert.replace('calque-', '')} » (du neuf) : « Avatar » touché`)
    await page.tap('#calque-avatar')
    await attendre(page, '.loge-panneau .loge-page-avatars')
  }
  /** La photo de l'écran — et de la page entière si elle dépasse : le menu, fixe, se poserait au milieu, il s'efface. */
  const photographier = async (page: any, n: string, defile: number) => {
    await page.screenshot({ path: path.join(sortie, `${n}.png`) })
    if (defile > 0) {
      const style = await page.addStyleTag({ content: '.menu-barre, .loge-barre { display: none !important; }' })
      await page.screenshot({ path: path.join(sortie, `${n}-entiere.png`), fullPage: true })
      await style.evaluate((s: any) => s.remove())
    }
  }
  /** Mesure la pièce ouverte, la photographie, et dit ce qui tient. */
  const mesurer = async (page: any, nom: string, piece: PieceDeLaLoge, [, hauteur]: Ecran, n: string) => {
    // La page en haut : une gemme ou une pièce touchée sous le pli l'a fait défiler, et sa niche se replie alors.
    if ((await page.evaluate('scrollY')) !== 0) {
      await page.evaluate('scrollTo(0, 0)')
      await page.waitForTimeout(600)
    }
    const m = { ...((await page.evaluate(LA_LOGE(piece))) as object), sousLaNiche: (await page.evaluate(SOUS_LA_NICHE)) as string[] } as any
    rapport[n] = m
    await photographier(page, n, m.defile)
    const sousQuoi = m.couvre === 'essai' ? 'LA BARRE' : m.couvre === 'menu' ? 'LE MENU' : 'L’ÉCRAN'
    // Ce qui précède la grille : la carte, la rangée, puis chaque bloc de la pièce.
    const blocs: { nom: string; bas: number }[] = [{ nom: 'la carte', ...m.carte }, { nom: 'les pièces', ...m.pieces }, ...m.avant]
    const fin = blocs[blocs.length - 1].bas - m.pli
    const entieres = (m.rangees as { bas: number }[]).filter(r => r.bas <= m.pli).length
    const premiere = m.rangees[0] as { haut: number; bas: number } | undefined
    const attendu = DOIVENT_TENIR.includes(nom) ? DOIT_TENIR(hauteurUtile(hauteur), nom, piece) : null
    const dessous = blocs.filter(b => b.bas > m.pli)
    // Ce qui ne doit arriver nulle part : une page plus large que l'écran, une cible ou un texte trop petits, quelque
    // chose sous la niche.
    const jamais: string[] = []
    if (m.large) jamais.push('DÉBORDE EN LARGEUR')
    const basses = Object.entries(m.cibles as Record<string, { haut: number; large: number }>).filter(([q, c]) => c.haut < (D_AVANT[q] ?? CIBLE))
    if (basses.length) jamais.push(`CIBLE SOUS ${CIBLE} PX : ${basses.map(([q, c]) => `${q} (${c.haut} px)`).join(', ')}`)
    if (m.petits.length) jamais.push(`TEXTE SOUS 11 PX : ${m.petits.join(' ; ')}`)
    const sousLaNiche = (m.sousLaNiche as string[]).filter(x => x !== '(pas de niche)')
    if (sousLaNiche.length) jamais.push(`SOUS LA NICHE — ${sousLaNiche.join(' · ')}`)
    // Ce qui doit tenir, dans les cas qui doivent tenir : ce qui précède la grille, ses rangées.
    const rates: string[] = []
    if (attendu !== null && dessous.length) rates.push(`AVANT LA GRILLE, SOUS ${sousQuoi} : ${dessous.map(b => `${b.nom} (${b.bas - m.pli} px)`).join(', ')}`)
    if (attendu !== null && entieres < Math.min(attendu, m.rangees.length)) rates.push(`${entieres} RANGÉE ENTIÈRE SUR ${m.rangees.length}, ${attendu} ATTENDUE${attendu > 1 ? 'S' : ''}`)
    if (rates.length || jamais.length) rate++
    console.log(
      `${n} — pli ${m.pli} · la carte ${m.carte.haut}→${m.carte.bas} (${m.carte.bas - m.carte.haut} px${m.jaugeMontree ? '' : ', sa jauge tue'}) · les pièces →${m.pieces.bas} · ${m.avant.map((b: any) => `${b.nom} →${b.bas}`).join(' · ')} · avant la grille : ${fin > 0 ? `${fin} px SOUS ${sousQuoi}` : `${-fin} px de libre`} · la grille : ${entieres} rangée${entieres > 1 ? 's' : ''} entière${entieres > 1 ? 's' : ''} sur ${m.rangees.length}, la place de ${m.place}${premiere ? ` (la première ${premiere.haut}→${premiere.bas})` : ''} · sous la carte collée ${m.sousLaCarte} px · défile de ${m.defile} px${m.pied ? ` · le pied →${m.pied.bas}${m.pied.bas > m.pli ? ` (${m.pied.bas - m.pli} px sous ${sousQuoi})` : ''}` : ''}${m.bandeau ? ` · bandeau ${m.bandeau} px` : ''}`,
    )
    console.log(`   cibles : ${Object.entries(m.cibles as Record<string, { n: number; haut: number; large: number }>).map(([q, c]) => `${q} ${c.large}×${c.haut}${D_AVANT[q] && c.haut < CIBLE ? ' (d’avant)' : ''}`).join(' · ')}`)
    for (const r of [...jamais, ...rates]) console.log(`   ${r}`)
    return m
  }

  /** La pièce « Avatar » d'un profil, à chaque taille. */
  const avatar = async (nom: string, cas: Cas, ecrans: Ecran[]) => {
    if (!retenu(nom)) return
    for (const ecran of reels(ecrans)) {
      const { ctx, page } = await ouvrir(cas, ecran)
      await page.goto(`${banc.url}/profil#avatar`)
      await attendre(page, ATTENDUS.avatar)
      await surLAvatar(page, `${nom}-${ecran[0]}x${ecran[1]}`)
      if (cas.page) {
        await page.tap(`#loge-gemme-${cas.page}`)
        await page.waitForSelector(`#loge-gemme-${cas.page}[aria-selected="true"]`)
        await attendre(page, ATTENDUS.avatar)
      }
      if (cas.texte) {
        await page.addStyleTag({ content: `html { font-size: ${cas.texte}% !important; }` })
        await page.waitForTimeout(500)
      }
      const n = `${nom}-${ecran[0]}x${ecran[1]}`
      if (cas.essai) {
        // Le menu d'abord, puis la barre qui le couvre : elle ne monte pas plus haut que lui, et rien ne bouge au-dessus.
        // Le calque « Finition », puis une finition touchée : la barre arrive, rien ne bouge au-dessus d'elle.
        await page.tap('#calque-finition')
        await page.waitForSelector('.loge-calque-panneau .calque-grille')
        const avant = (await page.evaluate(`({ menu: Math.round(document.querySelector('.menu-barre').getBoundingClientRect().top), gemmes: Math.round(document.querySelector('.loge-calques').getBoundingClientRect().bottom) })`)) as { menu: number; gemmes: number }
        await page.tap('.calque-grille .calque-case:not(.selected):not(.calque-a-gagner)')
        await page.waitForSelector('.loge-barre')
        await page.waitForTimeout(400)
        const m = await mesurer(page, nom, 'avatar', ecran, n)
        const plusHaut = avant.menu - m.pli
        const bouge = (m.avant[m.avant.length - 1].bas as number) - avant.gemmes
        console.log(
          `   la barre de l’essai : ${m.hautDeLaBarre} px, son haut à ${m.pli} — le menu commençait à ${avant.menu}${plusHaut > 0 ? ` : ELLE CACHE ${plusHaut} PX DE PLUS` : ''}${bouge ? ` · LA PAGE A BOUGÉ DE ${bouge} PX SOUS L’ESSAI` : ''}`,
        )
        if (plusHaut > 0 || bouge) rate++
      } else {
        await mesurer(page, nom, 'avatar', ecran, n)
      }
      await ctx.close()
    }
  }

  /**
   * L'onglet « Mon podium » de la pièce « Thème » (« Ma plaque » jusqu'au 24 novembre 2026), touché comme on y va :
   * l'aperçu de son podium — sa marche, sa ligne de classement —, puis ses plaques en vignettes — mesurées comme les
   * thèmes (son en-tête avant elles, ses vignettes), et qui doivent tenir de même.
   */
  const plaque = async (page: any, nom: string, n: string, ecran: Ecran) => {
    await page.tap('#loge-theme-plaque')
    await page.waitForSelector('.loge-panneau .loge-plaques')
    await page.waitForTimeout(300)
    const m = await mesurer(page, nom, 'theme', ecran, n)
    const ou = (sel: string) => page.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { haut: Math.round(r.top + scrollY), bas: Math.round(r.bottom + scrollY) } })()`) as Promise<{ haut: number; bas: number }>
    const [apercu, ligne] = [await ou('.loge-panneau .podium-apercu'), await ou('.loge-panneau .plaque-apercu')]
    console.log(`   son aperçu ${apercu.haut}→${apercu.bas} (${apercu.bas - apercu.haut} px) · sa ligne ${ligne.haut}→${ligne.bas}`)
    // Revenue aux thèmes : la pièce suivante s'ouvre comme on la quitte.
    await page.tap('#loge-theme-themes')
    await page.waitForTimeout(200)
  }

  /**
   * La vitrine, au doigt (le 17 novembre 2026 : « Pour la vitrine il faut que je sache ce que font les trophées de
   * manière élégante. Sinon on choisit plus par l'exploit mais juste par l'icône et c'est nul », le propriétaire) : la
   * deuxième médaille touchée ouvre sa fiche sous sa rangée — la médaille et ce qui est au-dessus ne doivent pas bouger
   * —, son bouton d'or, « Sur ma carte », touché, puis la carte remplie médaille par médaille et une fiche rouverte —
   * chez le vétéran, celle d'un trophée qui n'y tient plus, son bouton éteint. L'essai se défait ensuite (« Annuler ») :
   * les pièces d'après se mesurent sous le menu.
   */
  const ficheDeLaVitrine = async (page: any, n: string) => {
    const MEDAILLES = '.loge-medailles .loge-medaille[aria-expanded]'
    const OU = `(sel, i) => { const e = document.querySelectorAll(sel)[i]; if (!e) return null; const r = e.getBoundingClientRect(); return { haut: Math.round(r.top + scrollY), bas: Math.round(r.bottom + scrollY), gauche: Math.round(r.left) } }`
    const ou = (sel: string, i = 0) => page.evaluate(`(${OU})(${JSON.stringify(sel)}, ${i})`) as Promise<{ haut: number; bas: number; gauche: number } | null>
    const compte = (await page.locator(MEDAILLES).count()) as number
    if (compte < 2) return
    const avant = { places: await ou('.loge-emplacements'), medaille: await ou(MEDAILLES, 1), voisine: await ou(MEDAILLES, 2) }
    await page.locator(MEDAILLES).nth(1).tap()
    await page.waitForSelector('.loge-fiche-corps')
    await page.waitForTimeout(500)
    const apres = { places: await ou('.loge-emplacements'), medaille: await ou(MEDAILLES, 1), voisine: await ou(MEDAILLES, 2), fiche: await ou('.loge-fiche-corps') }
    const pli = (await page.evaluate(`Math.round((document.querySelector('.loge-barre') || document.querySelector('.menu-barre')).getBoundingClientRect().top + scrollY)`)) as number
    const bouge = [['les places', avant.places, apres.places], ['la médaille touchée', avant.medaille, apres.medaille], ['sa voisine', avant.voisine, apres.voisine]]
      .filter(([, a, b]: any) => a && b && (a.haut !== b.haut || a.gauche !== b.gauche))
      .map(([nom, a, b]: any) => `${nom} (${b.haut - a.haut} px)`)
    const f = apres.fiche!
    console.log(
      `   ${n} — la fiche ${f.haut}→${f.bas} (${f.bas - f.haut} px), ${f.haut >= apres.medaille!.bas ? 'sous la rangée' : 'PAS SOUS SA RANGÉE'}, ${f.bas <= pli ? `${pli - f.bas} px au-dessus du menu` : `${f.bas - pli} px sous le menu`} · la page a défilé de ${await page.evaluate('Math.round(scrollY)')} px${bouge.length ? ` · A BOUGÉ : ${bouge.join(', ')}` : ' · rien n’a bougé au-dessus'}`,
    )
    if (bouge.length || f.haut < apres.medaille!.bas) rate++
    await page.screenshot({ path: path.join(sortie, `${n}-fiche.png`) })
    await page.tap('.loge-fiche-geste')
    await page.waitForSelector('.loge-barre')
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(sortie, `${n}-sur-ma-carte.png`) })
    // La carte remplie, médaille par médaille, par le bouton de chaque fiche.
    for (let i = 0; i < compte && (await page.locator('.loge-emplacement.vide').count()) > 0; i++) {
      if (i === 1) continue
      await page.locator(MEDAILLES).nth(i).tap()
      await page.waitForTimeout(250)
      await page.tap('.loge-fiche-geste')
      await page.waitForTimeout(250)
    }
    // Une fiche rouverte, carte pleine : un trophée qui n'y est pas — son bouton éteint —, sinon le dernier, « Retirer »
    // (chez l'habituée, Le Sans-Faute : une piste, son métal sur la ligne de sa rareté).
    const dehors = compte > 3 ? 4 : compte - 1
    // Déjà ouverte — la dernière posée —, la retoucher la refermerait.
    if ((await page.locator(MEDAILLES).nth(dehors).getAttribute('aria-expanded')) !== 'true') await page.locator(MEDAILLES).nth(dehors).tap()
    await page.waitForTimeout(500)
    const geste = (await page.evaluate(`(() => { const b = document.querySelector('.loge-fiche-geste'); return b.textContent + (b.getAttribute('aria-disabled') ? ' (éteint)' : '') })()`)) as string
    console.log(`   ${n} — carte pleine, la fiche de la ${dehors + 1}ᵉ médaille : « ${geste} »`)
    await page.screenshot({ path: path.join(sortie, `${n}-carte-pleine.png`) })
    await page.locator('.loge-barre').getByRole('button', { name: 'Annuler' }).tap()
    await page.waitForTimeout(300)
    await page.evaluate('scrollTo(0, 0)')
  }

  // Léa sans compagnon d'abord : le haut de la page n'a pas de niche à contourner.
  await avatar('sans-niche', { cookie: lea }, TOUS_LES_ECRANS)
  await avatar('debutant', { cookie: tom }, TOUS_LES_ECRANS)

  // Puis son loup dans sa niche, au coin haut droit : c'est le cas de tous les autres.
  {
    const r = await ecrire(banc.url, '/api/joueur/compagnons', { compagnon: 'loup' }, lea)
    if (!r.ok) throw new Error(`Le loup ne s'adopte pas (${r.status} ${await r.text()})`)
  }
  await avatar('avatar', { cookie: lea }, TOUS_LES_ECRANS)
  // Ses neuf avatars communs : trois rangées de quatre — ce que la grille montre quand elle a de quoi.
  await avatar('commune', { cookie: lea, page: 'commune' }, TOUS_LES_ECRANS)
  await avatar('tout', { cookie: lea, tout: true }, TOUS_LES_ECRANS)

  // Les calques de la pièce « Avatar » (le 26 novembre 2026), touchés sur leur rail : chacun sa grille — la version, la
  // finition, la bordure et ses motifs, le sceau —, mesurée comme la pièce : le rail, ce qui couvre le bas, les cibles.
  if (retenu('calques')) {
    for (const ecran of reels(DEUX_ECRANS)) {
      const { ctx, page } = await ouvrir({ cookie: lea }, ecran)
      await page.goto(`${banc.url}/profil#avatar`)
      await attendre(page, ATTENDUS.avatar)
      await surLAvatar(page, `calques-${ecran[0]}x${ecran[1]}`)
      for (const c of ['version', 'finition', 'bordure', 'sceau']) {
        if ((await page.locator(`#calque-${c}`).count()) === 0) continue
        await page.tap(`#calque-${c}`)
        await page.waitForSelector(`#calque-${c}[aria-selected="true"]`)
        await page.waitForTimeout(400)
        await mesurer(page, 'calques', 'avatar', ecran, `calque-${c}-${ecran[0]}x${ecran[1]}`)
      }
      await ctx.close()
    }
  }

  // Ses tenues (le paquet de cartes, le 26 novembre 2026) : trois gardées, la carte et ses points, la liste du cintre,
  // puis une tenue touchée — son nom sur la carte, la barre « Porter ». Gardées pour la suite : ses points se voient
  // dans les photos d'après, comme chez qui en a.
  if (retenu('tenues')) {
    const garder = async (nom: string) => {
      const r = await ecrire(banc.url, '/api/joueur/tenues', { nom }, lea)
      if (!r.ok) throw new Error(`La tenue ne se garde pas (${r.status} ${await r.text()})`)
    }
    await garder('Soirée')
    await porte({ avatar: '🦊', finition: 'or', fond: null })
    await garder('Renard')
    await porte({ legendaire: 'lg:phenix', finition: 'holo', bordure: 'aucune' })
    await garder('Sans bordure')
    await porte({ finition: 'auto', bordure: 'auto', fond: 'vitrail' })
    for (const ecran of reels(DEUX_ECRANS)) {
      const { ctx, page } = await ouvrir({ cookie: lea }, ecran)
      await page.goto(`${banc.url}/profil#avatar`)
      await attendre(page, ATTENDUS.avatar)
      const n = `${ecran[0]}x${ecran[1]}`
      await surLAvatar(page, `tenues-${n}`)
      await mesurer(page, 'tenues', 'avatar', ecran, `tenues-${n}`)
      await page.tap('.loge-tenues')
      await page.waitForSelector('.tenues-liste')
      await page.waitForTimeout(500)
      await page.screenshot({ path: path.join(sortie, `tenues-liste-${n}.png`) })
      await page.locator('.tenue-montrer').nth(1).tap()
      await page.waitForSelector('.loge-barre')
      await page.waitForTimeout(500)
      await mesurer(page, 'tenues', 'avatar', ecran, `tenue-essayee-${n}`)
      await ctx.close()
    }
  }

  // Les cinq autres pièces, touchées sur leur rangée, comme on y va.
  if (retenu('pieces')) {
    for (const ecran of reels(TOUS_LES_ECRANS)) {
      const { ctx, page } = await ouvrir({ cookie: lea }, ecran)
      await page.goto(`${banc.url}/profil#avatar`)
      await attendre(page, ATTENDUS.avatar)
      for (const { id } of PIECES_DE_LA_LOGE.filter(p => p.id !== 'avatar' && pieceRetenue(p.id))) {
        await page.tap(`#loge-${id}`)
        await attendre(page, ATTENDUS[id])
        await mesurer(page, 'pieces', id, ecran, `${id}-${ecran[0]}x${ecran[1]}`)
        if (id === 'theme') await plaque(page, 'pieces', `plaque-${ecran[0]}x${ecran[1]}`, ecran)
        if (id === 'vitrine') await ficheDeLaVitrine(page, `vitrine-${ecran[0]}x${ecran[1]}`)
      }
      await ctx.close()
    }
  }

  // Les mêmes, pleines : un vétéran (`PLEIN`), au petit téléphone et au grand.
  if (retenu('pleines')) {
    for (const ecran of reels([[360, 640], [412, 915]])) {
      const { ctx, page } = await ouvrir({ cookie: lea, plein: true }, ecran)
      await page.goto(`${banc.url}/profil#avatar`)
      await attendre(page, ATTENDUS.avatar)
      for (const { id } of PIECES_DE_LA_LOGE.filter(p => p.id !== 'avatar' && pieceRetenue(p.id))) {
        await page.tap(`#loge-${id}`)
        await attendre(page, ATTENDUS[id])
        await mesurer(page, 'pleines', id, ecran, `plein-${id}-${ecran[0]}x${ecran[1]}`)
        if (id === 'theme') await plaque(page, 'pleines', `plein-plaque-${ecran[0]}x${ecran[1]}`, ecran)
        if (id === 'vitrine') await ficheDeLaVitrine(page, `plein-vitrine-${ecran[0]}x${ecran[1]}`)
      }
      await ctx.close()
    }
  }

  await avatar('essai', { cookie: lea, essai: true }, DEUX_ECRANS)
  // Une tablette debout : au-dessus de 940 px de haut, les mesures d'avant — sa jauge.
  if (!encoche) await avatar('tablette', { cookie: lea }, TABLETTE)
  await avatar('agrandi', { cookie: lea, texte: 130 }, PETIT)

  // Sous le bandeau du service : 58 px de moins.
  if (retenu('bandeau')) {
    const admin = await connexionAnimateur(banc.url)
    const poser = (texte: string | null) => ecrire(banc.url, '/api/admin/maintenance/bandeau', { texte }, admin, 'PUT').then(r => r.status)
    console.log('le bandeau :', await poser('Le quiz du jour est en panne depuis ce matin : on répare, merci de votre patience !'))
    await avatar('bandeau', { cookie: lea }, PETIT)
    await poser(null)
  }

  /**
   * La pièce « Thème » au petit téléphone, chaque plaque essayée tour à tour : un échantillon n'est pas une ligne de
   * classement, il lit lui-même les couleurs de sa plaque — à regarder sous chacune, claire ou sombre, et sous le thème
   * de celui qui regarde (`ivoire`, plus bas).
   */
  const plaquesEssayees = async (nom: string) => {
    const ecran: Ecran = [360, 640]
    const { ctx, page } = await ouvrir({ cookie: lea }, ecran)
    await page.goto(`${banc.url}/profil#theme`)
    await attendre(page, ATTENDUS.theme)
    await mesurer(page, nom, 'theme', ecran, `${nom}-theme-360x640`)
    await page.tap('#loge-theme-plaque')
    await page.waitForSelector('.loge-panneau .loge-plaques')
    // « Podium » et « Classique » : les noms d'écran de la plaque et d'`aucune` depuis le 24 novembre 2026.
    for (const plaque of ['Ivoire', 'Océan', 'Neige', 'Classique']) {
      await page.tap(`.loge-plaques .loge-vignette[aria-label^="Podium ${plaque}"]`)
      await page.waitForSelector('.loge-barre')
      await page.waitForTimeout(300)
      await mesurer(page, nom, 'theme', ecran, `${nom}-plaque-${plaque.normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase()}-360x640`)
    }
    await ctx.close()
  }
  if (retenu('plaques')) await plaquesEssayees('plaques')

  // L'Ivoire, en dernier : le thème se porte, et habillerait toutes les photos d'après.
  if (retenu('ivoire')) {
    await porte({ theme: 'ivoire' })
    await avatar('ivoire', { cookie: lea }, DEUX_ECRANS)
    await plaquesEssayees('ivoire')
  }

  writeFileSync(path.join(sortie, 'mesures.json'), JSON.stringify(rapport, null, 2))
  console.log(`Photos et mesures dans ${sortie}`)
  // Par le code de sortie de Node, pas `process.exit()` : ce qui vient de s'écrire part d'abord (règle `tests.md`).
  if (rate > 0) process.exitCode = 1
} finally {
  await navigateur.close()
  await banc.close()
}
