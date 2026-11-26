// La pièce « Avatar » de la loge, repensée : trois pistes et un bonus, sur de
// vrais écrans de téléphone (360 × 640), sous la vraie feuille de style, avec
// les vrais composants — la carte de la loge (`CarteDeLaLoge`), la rangée des
// pièces, les avatars, leurs finitions, leurs bordures et leurs motifs
// (`Avatar`) — et, pour « Aujourd'hui », les vrais panneaux (`MesFinitions`,
// `MesBordures`, `MesMotifs`, `MonSceau`, `MesAvatars`).
//
//   cd server && npx tsx ../retours/2026-11-26/la-piece-avatar/planche.ts
//
// Chaque écran est une page à lui (`ecran-<nom>.html`), montrée dans un cadre
// de 360 × 640 : les pas de hauteur de la feuille (`min-height: 760px`…) y
// jouent comme sur un téléphone. La planche les range par piste
// (`planche.html`) et photographie chaque section (`planche-<section>.jpg`).
// Les pages et la feuille recopiée (`feuille.css`) restent hors de git : les
// peintures s'y lisent dans `client/public`, par un chemin relatif.
// `SEULEMENT=calques,fiche` ne refait que ces sections. Une maquette, pas du
// code livré : rien de `client/` ne bouge.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'

Object.assign(globalThis, { React })
const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../../..')
const { renderToStaticMarkup } = await import('react-dom/server')
const duClient = (f: string) => import(path.join(RACINE, 'client/src', f))
await duClient('components/Legendaire.tsx')
await duClient('components/Portrait.tsx')
for (const b of ['monde', 'mythes', 'oceans', 'espace', 'foret', 'ecran', 'scene', 'contes', 'stade', 'brigade', 'arcade', 'carnaval']) await duClient(`components/portraits/${b}.ts`)
await duClient('components/compagnons-peints.ts')
await duClient('components/Lumiere.tsx')
await duClient('components/Bordure.tsx')
const { Avatar } = await duClient('components/Avatar.tsx')
const { Icon } = await duClient('components/Icon.tsx')
const { Niveau } = await duClient('components/Niveau.tsx')
const { CarteDeLaLoge, PiecesDeLaLoge } = await duClient('components/LogeTete.tsx')
const { MesFinitions, MesBordures, MesMotifs, MonSceau, MesAvatars } = await duClient('components/Apparence.tsx')
const { MenuBarre } = await duClient('components/Pieces.tsx')
const { FINITIONS, NOM_FINITION, NIVEAU_FINITION, meilleureFinition } = await import(path.join(RACINE, 'shared/profil.ts'))
const { MOTIFS } = await import(path.join(RACINE, 'shared/motifs.ts'))
const { motifAccorde } = await import(path.join(RACINE, 'shared/motifAccorde.ts'))
const { ligueParCle } = await import(path.join(RACINE, 'shared/duels.ts'))

const h = React.createElement
type Ligue = 'bronze' | 'argent' | 'or' | 'platine' | 'diamant' | 'maitre'

// ── Léa, une collectionneuse ─────────────────────────────────────────────
// Ce que la pièce doit tenir le jour où l'on a beaucoup : le niveau 38 — neuf
// finitions —, quatre bordures dont trois serties, vingt-deux motifs, le
// Phénix éclaté et scellé, quatre légendaires, des portraits sur trois
// branches. C'est elle que la pièce d'aujourd'hui allonge rangée après rangée.
// Sa bordure d'or est sertie : ses douze crans montrent tout le motif, et l'or
// se lit mieux que le platine autour d'un Phénix de glace.

const NIVEAU = 38
const SES_FINITIONS = (FINITIONS as readonly string[]).filter(f => NIVEAU_FINITION[f] <= NIVEAU)
const LA_PLUS_BELLE: string = meilleureFinition(NIVEAU)
const SES_BORDURES: { ligue: Ligue; crans: number }[] = [
  { ligue: 'bronze', crans: 12 },
  { ligue: 'argent', crans: 12 },
  { ligue: 'or', crans: 12 },
]
const SES_MOTIFS = [
  'feuilles', 'jonc', 'nu', 'feuilles-bronze', 'feuilles-argent', 'feuilles-or', 'perles', 'flammes',
  'etoiles', 'ecailles', 'vagues', 'rayons', 'fleurs', 'plumes', 'notes', 'grecque', 'nuages',
  'houx', 'flocons', 'papillons', 'lanternes', 'joyaux',
]
const VITRINE = [
  { key: 'a', emoji: '💯', title: 'Sans faute' },
  { key: 'b', emoji: '🔥', title: 'Le Phénix' },
  { key: 'c', emoji: '🔮', title: 'L’Oracle' },
]
const LEA: any = {
  id: 'lea', name: 'Léa', niveau: NIVEAU, requis: 9200, acquis: 6100, laurier: null,
  titre: 'hf:phenix', avatar: '🦊', legendaire: 'lg:phenix',
  legendaires: ['lg:phenix', 'lg:dragon', 'lg:kraken', 'lg:chouette'], divins: [],
  sentiers: { foret: 9, mythes: 6, oceans: 4, espace: 3 }, compagnons: [],
  finition: LA_PLUS_BELLE, finitionChoisie: 'auto', ouvertes: SES_FINITIONS,
  bordures: SES_BORDURES, bordureChoisie: 'auto', motifs: SES_MOTIFS, motifChoisi: null,
  scelles: ['lg:phenix'], sceauMasque: false,
  eclats: ['lg:phenix'], eclatsEteints: [], matieres: {}, eclatsEnReserve: 0,
  fond: 'vitrail', boutique: { confettis: { solde: 2840 } },
  vitrine: VITRINE, vitrineChoisie: null, hautsFaits: [],
}
const PORTEE = SES_BORDURES[SES_BORDURES.length - 1]
const ACCORDE: string = motifAccorde(LEA.legendaire)

// ── Les morceaux ─────────────────────────────────────────────────────────

const PUBLIC = path.relative(ICI, path.join(RACINE, 'client/public')).replaceAll('\\', '/') + '/'
const localiser = (html: string) =>
  html
    .replaceAll(/(?<![\w.])\/(medaillons|portraits|compagnons|decors)\//g, `${PUBLIC}$1/`)
    .replaceAll("url('/fonts/", `url('${PUBLIC}fonts/`)
const rendre = (el: React.ReactElement) => localiser(renderToStaticMarkup(el))

/** Une tenue de Léa, ou ce qu'on essaie par-dessus. */
interface Tenue {
  legendaire?: string
  avatar?: string
  finition?: string
  eclat?: boolean
  sceau?: boolean
  bordure?: { ligue: Ligue; crans: number; motif?: string } | null
}
const SA_TENUE: Required<Omit<Tenue, 'bordure'>> & { bordure: Tenue['bordure'] } = {
  legendaire: 'lg:phenix', avatar: '🦊', finition: LA_PLUS_BELLE, eclat: true, sceau: true, bordure: { ...PORTEE },
}
/** Un avatar de Léa, sa tenue retouchée. */
function av(t: Tenue = {}, classe = ''): string {
  const v = { ...SA_TENUE, ...t }
  return rendre(h(Avatar, { avatar: v.avatar, legendaire: v.legendaire, finition: v.finition, eclat: v.eclat, sceau: v.sceau, bordure: v.bordure ?? null, className: classe }))
}
const icone = (nom: string) => rendre(h(Icon, { name: nom }))

/** Sa carte, en tête de la loge : l'essai par-dessus ce qu'elle porte. */
function carte(essai: Partial<typeof LEA> = {}, opts: { version?: boolean } = {}): string {
  const vu = { ...LEA, ...essai }
  const apercu = Object.keys(essai).length > 0
  return rendre(
    h(CarteDeLaLoge, {
      vu,
      vitrine: VITRINE,
      apercu,
      essaye: { avatar: apercu },
      version: opts.version === false ? null : { rare: true, essayee: false, basculer() {} },
      onOuvrir() {},
    }),
  )
}
const pieces = () => rendre(h(PiecesDeLaLoge, { actif: 'avatar', onChoisir() {}, neuves: new Set() }))
const menu = () => rendre(h(MenuBarre, { ici: 'profil' }))
const PROPS = { profil: LEA, essai: {}, essayer() {}, busy: false, neufs: new Set<string>() }

/** La barre de l'essai, à la place du menu (`BarreDEssai`). */
const barre = (nom: string, detail: string) =>
  `<div class="loge-barre"><span class="loge-barre-texte"><b>${nom}</b><span class="muted small">${detail}</span></span><button type="button" class="btn btn-ghost">Annuler</button><button type="button" class="btn btn-primary">Porter</button></div>`

/** Un écran de la loge : sa tête, sa carte, la rangée des pièces, puis ce que la piste y met. */
function ecran(opts: { carte?: string; avantPieces?: string; panneau: string; bas?: string; dessus?: string }): string {
  return `<div class="player-shell loge-page"><header class="loge-tete"><a class="lien-discret jour-sortie" href="#">${icone('arrow-left')}Mon profil</a><h1>M’habiller</h1></header><div class="loge">${opts.carte ?? carte()}${opts.avantPieces ?? ''}${pieces()}<div class="loge-panneau">${opts.panneau}</div></div></div>${opts.bas ?? menu()}${opts.dessus ?? ''}`
}

const nomCourt = (nom: string) => nom.replace(/^(Les|Le|La|L’) ?/, '')
const NOM_DU_MOTIF = (k: string) => nomCourt(MOTIFS.find((m: any) => m.key === k)?.nom ?? k)

// ── Aujourd'hui ──────────────────────────────────────────────────────────

const aujourdhui = () =>
  ecran({
    panneau: [MesFinitions, MesBordures, MesMotifs, MonSceau, MesAvatars].map(C => rendre(h(C, PROPS))).join(''),
  })

// ── Piste 1 · Les calques ────────────────────────────────────────────────
// Sous la rangée des pièces, un rail de cinq calques — l'avatar, sa version,
// sa finition, sa bordure (sa ligue et son motif), son sceau —, chacun son
// aperçu : ce qu'elle porte, d'un coup d'œil. Un calque touché, une seule
// grille dessous, la sienne ; « Avatar » d'office, ses gemmes et ses cases.

type Calque = 'avatar' | 'version' | 'finition' | 'bordure' | 'sceau'
/** La pastille d'un réglage laissé à l'application : « Auto », « Accordé ». */
const AUTO = () => `<span class="mq-auto">${icone('sparkles')}</span>`
const CALQUES: { id: Calque; nom: string; apercu: () => string; auto?: boolean }[] = [
  { id: 'avatar', nom: 'Avatar', apercu: () => av({ bordure: null, finition: 'mat', sceau: false, eclat: false }) },
  { id: 'version', nom: 'Version', apercu: () => av({ bordure: null, sceau: false }) },
  { id: 'finition', nom: 'Finition', apercu: () => `<i class="finition-teinte teinte-${LA_PLUS_BELLE}"></i>`, auto: true },
  { id: 'bordure', nom: 'Bordure', apercu: () => av({ sceau: false }), auto: true },
  { id: 'sceau', nom: 'Sceau', apercu: () => av({ bordure: null }) },
]
function rail(actif: Calque, apercus: Partial<Record<Calque, string>> = {}): string {
  return `<div class="mq-calques" role="tablist">${CALQUES.map(
    c =>
      `<button type="button" role="tab" class="mq-calque${c.id === actif ? ' actif' : ''}${apercus[c.id] ? ' essaye' : ''}"><span class="mq-calque-apercu mq-sujet">${apercus[c.id] ?? c.apercu()}${c.auto && !apercus[c.id] ? AUTO() : ''}</span><span class="mq-calque-nom">${c.nom}</span></button>`,
  ).join('')}</div>`
}

/** Une case d'une grille de calque : un avatar en grand, son nom dessous. */
const caseDe = (dessin: string, nom: string, etat: '' | 'porte' | 'essaye' = '', badge = '') =>
  `<button type="button" class="mq-case${etat === 'porte' ? ' porte selected' : etat === 'essaye' ? ' selected essaye' : ''}">${badge}<span class="mq-case-dessin">${dessin}</span><span class="mq-case-nom">${nom}</span></button>`
const aGagner = (n: number, quoi: string) =>
  `<a class="mq-case mq-a-gagner" href="#"><span class="mq-case-dessin"><b>+${n}</b></span><span class="mq-case-nom">${quoi}</span></a>`
const etincelle = AUTO()

const grilleDesMotifs = (essaye?: string) =>
  `<div class="mq-grille mq-sujet">${[
    caseDe(av({ sceau: false }), 'Accordé', essaye ? 'porte' : 'porte', etincelle),
    ...SES_MOTIFS.map(k => caseDe(av({ sceau: false, bordure: { ...PORTEE, motif: k } }), NOM_DU_MOTIF(k), k === essaye ? 'essaye' : '')),
    aGagner(MOTIFS.length - SES_MOTIFS.length, 'à gagner'),
  ].join('')}</div>`

const rangeeDesLigues = () =>
  `<div class="loge-finitions-rangee rangee-courte loge-bordures-rangee">${[
    ['Auto', { ...PORTEE }, true],
    ['Sans', null, false],
    ...SES_BORDURES.map(b => [ligueParCle(b.ligue).court, b, false] as const),
  ]
    .map(
      ([nom, b, porte]: any) =>
        `<button type="button" class="finition-choix bordure-choix${porte ? ' selected porte' : ''}"><span class="bordure-apercu">${b ? av({ sceau: false, bordure: b }) : '<i class="bordure-sans"></i>'}</span><span>${nom}</span></button>`,
    )
    .join('')}</div>`

const calqueAvatar = () => ecran({ panneau: rail('avatar') + rendre(h(MesAvatars, PROPS)) })

const calqueBordure = () =>
  ecran({
    carte: carte({ motifChoisi: 'etoiles' }),
    panneau: rail('bordure', { bordure: av({ sceau: false, bordure: { ...PORTEE, motif: 'etoiles' } }) }) + `<span class="loge-sous-titre">Ligue</span>` + rangeeDesLigues() + `<span class="loge-sous-titre">Motif</span>` + grilleDesMotifs('etoiles'),
    bas: barre('Motif', 'Les Étoiles'),
  })

const grilleDesFinitions = (essayee?: string) =>
  `<div class="mq-grille mq-sujet">${[
    caseDe(av({ bordure: null, sceau: false }), 'Auto', essayee ? 'porte' : 'porte', etincelle),
    ...SES_FINITIONS.map(f => caseDe(av({ bordure: null, sceau: false, finition: f }), NOM_FINITION[f], f === essayee ? 'essaye' : '')),
    aGagner(FINITIONS.length - SES_FINITIONS.length, 'à gagner'),
  ].join('')}</div>`

const calqueFinition = () =>
  ecran({
    carte: carte({ finition: 'abysses', finitionChoisie: 'abysses' }),
    panneau: rail('finition', { finition: `<i class="finition-teinte teinte-abysses"></i>` }) + grilleDesFinitions('abysses'),
    bas: barre('Finition', 'Abysses'),
  })

// ── Piste 2 · La fiche de tenue ──────────────────────────────────────────
// Ce que le propriétaire demandait pour les motifs, pour tous les réglages :
// une tuile chacun — ce qu'elle porte, rien d'autre —, et un toucher ouvre la
// feuille de ce qu'elle a, rangé par provenance. La carte reste au-dessus de
// la feuille, sans voile : on voit l'essai pendant qu'on choisit. Les avatars
// restent dans la pièce, sous les tuiles.

const tuile = (titre: string, apercu: string, valeur: string, opts: { auto?: boolean; actif?: boolean; essaye?: boolean } = {}) =>
  `<button type="button" class="mq-tuile${opts.actif ? ' actif' : ''}"><span class="mq-tuile-titre">${titre}</span><span class="mq-tuile-apercu mq-sujet${opts.essaye ? ' essaye' : ''}">${apercu}${opts.auto ? AUTO() : ''}</span><span class="mq-tuile-valeur">${valeur}<span class="mq-chevron" aria-hidden="true">›</span></span></button>`
const tuiles = (actif = '', motif?: string) =>
  `<div class="mq-tuiles">${[
    tuile('Finition', `<i class="finition-teinte teinte-${LA_PLUS_BELLE}"></i>`, NOM_FINITION[LA_PLUS_BELLE], { auto: true, actif: actif === 'finition' }),
    tuile('Bordure', av({ sceau: false, bordure: { ...PORTEE, motif: 'nu' } }), ligueParCle(PORTEE.ligue).court, { auto: true, actif: actif === 'bordure' }),
    tuile('Motif', av({ sceau: false, bordure: { ...PORTEE, motif: motif ?? ACCORDE } }), NOM_DU_MOTIF(motif ?? ACCORDE), { auto: !motif, actif: actif === 'motif', essaye: !!motif }),
    tuile('Sceau', av({ bordure: null }), 'Montré', { actif: actif === 'sceau' }),
  ].join('')}</div>`

const ficheTuiles = () => ecran({ panneau: tuiles() + rendre(h(MesAvatars, PROPS)) })

/** Les motifs qu'elle a, rangés par provenance : la feuille a la place de les nommer. */
const PROVENANCES: [string, (m: any) => boolean][] = [
  ['Offerts', m => m.voie.sorte === 'offert'],
  ['Le brin d’une ligue sertie', m => m.voie.sorte === 'feuille'],
  ['Gagnés en duel', m => m.voie.sorte === 'duel'],
  ['De la boutique', m => m.voie.sorte === 'boutique'],
  ['Du trésor', m => m.voie.sorte === 'coffre'],
  ['De saison', m => m.voie.sorte === 'saison'],
]
function feuilleDesMotifs(essaye: string): string {
  const siens = MOTIFS.filter((m: any) => SES_MOTIFS.includes(m.key))
  const groupes = PROVENANCES.map(([nom, est]) => {
    const ici = siens.filter(est)
    if (!ici.length) return ''
    const cases = ici.map((m: any) => caseDe(av({ sceau: false, bordure: { ...PORTEE, motif: m.key } }), nomCourt(m.nom), m.key === essaye ? 'essaye' : ''))
    if (nom === 'Offerts') cases.unshift(caseDe(av({ sceau: false }), 'Accordé', 'porte', etincelle))
    return `<span class="loge-sous-titre mq-groupe">${nom}</span>${cases.join('')}`
  }).join('')
  return `<div class="mq-voile"><div class="carte-feuille mq-feuille"><header class="carte-barre"><b class="feuille-titre">Motif</b><button type="button" class="carte-fermer">${icone('x')}Fermer</button></header><div class="carte-corps"><div class="mq-grille mq-sujet">${groupes}${aGagner(MOTIFS.length - SES_MOTIFS.length, 'à gagner')}</div></div><footer class="carte-pied mq-pied"><button type="button" class="btn btn-ghost">Annuler</button><button type="button" class="btn btn-primary">Porter</button></footer></div></div>`
}
const ficheFeuille = () =>
  ecran({ carte: carte({ motifChoisi: 'etoiles' }), panneau: tuiles('motif', 'etoiles') + rendre(h(MesAvatars, PROPS)), dessus: feuilleDesMotifs('etoiles') })

/** La variante : l'avatar aussi en fiche — la pièce entière tient en six cases, chacune sa feuille. */
const fiche = (titre: string, apercu: string, valeur: string, auto = false) =>
  `<button type="button" class="mq-fiche"><span class="mq-fiche-apercu mq-sujet">${apercu}${auto ? AUTO() : ''}</span><span class="mq-fiche-texte"><span class="mq-tuile-titre">${titre}</span><b>${valeur}</b></span><span class="mq-chevron" aria-hidden="true">›</span></button>`
const ficheEntiere = () =>
  ecran({
    carte: carte({}, { version: false }),
    panneau: `<div class="mq-fiches">${[
      fiche('Avatar', av({ bordure: null, sceau: false, eclat: false, finition: 'mat' }), 'Le Phénix'),
      fiche('Version', av({ bordure: null, sceau: false }), 'Rare'),
      fiche('Finition', `<i class="finition-teinte teinte-${LA_PLUS_BELLE}"></i>`, NOM_FINITION[LA_PLUS_BELLE], true),
      fiche('Bordure', av({ sceau: false, bordure: { ...PORTEE, motif: 'nu' } }), ligueParCle(PORTEE.ligue).court, true),
      fiche('Motif', av({ sceau: false }), NOM_DU_MOTIF(ACCORDE), true),
      fiche('Sceau', av({ bordure: null }), 'Montré'),
    ].join('')}</div>`,
  })

// ── Piste 3 · Le miroir ──────────────────────────────────────────────────
// Dans la pièce « Avatar », la carte se fait miroir : son avatar en grand, sur
// son fond, et autour de lui ce qu'on peut changer, épinglé à l'endroit où ça
// se voit. On touche une épingle — ou la partie de l'avatar —, et une bande
// défile dessous : ce qu'elle a, un à la fois au centre, essayé à mesure
// qu'on glisse. Le cœur du médaillon ouvre ses avatars.

type Epingle = 'avatar' | 'version' | 'finition' | 'bordure' | 'motif' | 'sceau'
const EPINGLES: { id: Epingle; nom: string; ou: string }[] = [
  { id: 'version', nom: 'Version', ou: 'g1' },
  { id: 'finition', nom: 'Finition', ou: 'g2' },
  { id: 'avatar', nom: 'Avatar', ou: 'g3' },
  { id: 'sceau', nom: 'Sceau', ou: 'd1' },
  { id: 'bordure', nom: 'Bordure', ou: 'd2' },
  { id: 'motif', nom: 'Motif', ou: 'd3' },
]
function miroir(actif: Epingle, essai: Tenue = {}, apercu = false): string {
  const epingles = EPINGLES.map(e => `<button type="button" class="mq-epingle mq-${e.ou}${e.id === actif ? ' actif' : ''}"><i></i>${e.nom}</button>`).join('')
  return `<div class="loge-collante"><div class="loge-carte carte-fond fond-vitrail mq-miroir${apercu ? ' loge-en-apercu' : ''}"><span class="mq-miroir-nom identite-nom">Léa${rendre(h(Niveau, { niveau: NIVEAU }))}</span><span class="mq-miroir-titre">« Le Phénix »</span>${apercu ? '<span class="loge-apercu">Aperçu</span>' : ''}<span class="mq-miroir-avatar mq-cible-${actif}">${av(essai)}</span>${epingles}</div></div>`
}

/** La bande : ce qu'elle a, l'essai au centre, ses voisins de plus en plus petits. */
function bande(items: { dessin: string; nom: string; porte?: boolean }[], centre: number, total: number): string {
  const vus = [-2, -1, 0, 1, 2].map(d => ({ d, it: items[centre + d] })).filter(x => x.it)
  return `<div class="mq-bande"><button type="button" class="mq-fleche mq-fleche-avant" aria-label="Précédent">${icone('chevron-right')}</button><div class="mq-bande-cases mq-sujet">${vus
    .map(({ d, it }) => `<span class="mq-bande-case mq-pas-${Math.abs(d)}${it.porte ? ' porte' : ''}">${it.dessin}</span>`)
    .join('')}</div><button type="button" class="mq-fleche" aria-label="Suivant">${icone('chevron-right')}</button></div><div class="mq-bande-nom"><b>${items[centre].nom}</b><span>${centre + 1} sur ${total}</span></div>`
}

const LES_MOTIFS_EN_BANDE = ['accorde', ...SES_MOTIFS]
const miroirMotif = () => {
  const items = LES_MOTIFS_EN_BANDE.map(k => ({
    dessin: av({ sceau: false, bordure: k === 'accorde' ? { ...PORTEE } : { ...PORTEE, motif: k } }),
    nom: k === 'accorde' ? 'Accordé' : NOM_DU_MOTIF(k),
    porte: k === 'accorde',
  }))
  const centre = LES_MOTIFS_EN_BANDE.indexOf('etoiles')
  return ecran({
    carte: miroir('motif', { bordure: { ...PORTEE, motif: 'etoiles' } }, true),
    panneau: bande(items, centre, items.length),
    bas: barre('Motif', 'Les Étoiles'),
  })
}
const miroirFinition = () => {
  const cles = ['auto', ...SES_FINITIONS]
  const items = cles.map(f => ({ dessin: av({ bordure: null, sceau: false, finition: f === 'auto' ? LA_PLUS_BELLE : f }), nom: f === 'auto' ? 'Auto' : NOM_FINITION[f], porte: f === 'auto' }))
  const centre = cles.indexOf('abysses')
  return ecran({
    carte: miroir('finition', { finition: 'abysses' }, true),
    panneau: bande(items, centre, items.length),
    bas: barre('Finition', 'Abysses'),
  })
}
const miroirAvatar = () => ecran({ carte: miroir('avatar'), panneau: rendre(h(MesAvatars, PROPS)) })

// ── Le bonus · Les tenues ────────────────────────────────────────────────
// Ce qui se règle calque par calque se garde : une tenue, c'est l'avatar, sa
// version, sa finition, sa bordure, son motif et son sceau, d'un toucher. Au
// sapin pour Noël, au Kraken pour la soirée de la mer. Avec n'importe quelle
// piste ; ici, sur les calques.

const TENUES: { nom: string; t: Tenue; porte?: boolean; essaye?: boolean }[] = [
  { nom: 'Ma tenue', t: {}, porte: true },
  { nom: 'Duels', t: { legendaire: 'lg:dragon', finition: 'or', bordure: { ...PORTEE, motif: 'ecailles' }, sceau: false, eclat: false } },
  { nom: 'La mer', t: { legendaire: 'lg:kraken', finition: 'abysses', bordure: { ligue: 'argent', crans: 12, motif: 'vagues' }, sceau: false, eclat: false } },
  { nom: 'Hiver', t: { legendaire: 'lg:chouette', finition: 'argent', bordure: { ligue: 'or', crans: 12, motif: 'flocons' }, sceau: false, eclat: false }, essai: { legendaire: 'lg:chouette', finition: 'argent', finitionChoisie: 'argent', motifChoisi: 'flocons', sceauMasque: true } },
]
const rangeeDesTenues = (essayee?: string) =>
  `<div class="mq-tenues mq-sujet">${TENUES.map(
    x => `<button type="button" class="mq-tenue${x.porte && !essayee ? ' selected porte' : x.porte ? ' porte' : ''}${x.nom === essayee ? ' selected essaye' : ''}"><span class="mq-tenue-dessin">${av(x.t)}</span><span class="mq-tenue-nom">${x.nom}</span></button>`,
  ).join('')}<button type="button" class="mq-tenue mq-tenue-plus"><span class="mq-tenue-dessin">${icone('plus')}</span><span class="mq-tenue-nom">Garder</span></button></div>`

const tenues = () => ecran({ panneau: rangeeDesTenues() + rail('avatar') + rendre(h(MesAvatars, PROPS)) })
const tenueEssayee = () => {
  const mer = TENUES[2].t
  return ecran({
    carte: carte({ legendaire: mer.legendaire, finition: mer.finition, finitionChoisie: mer.finition, bordureChoisie: 'argent', motifChoisi: 'vagues', sceauMasque: true }, { version: false }),
    panneau:
      rangeeDesTenues('La mer') +
      rail('avatar', {
        avatar: av({ ...mer, bordure: null, finition: 'mat', sceau: false }),
        finition: `<i class="finition-teinte teinte-abysses"></i>`,
        bordure: av({ ...mer, sceau: false }),
      }) +
      rendre(h(MesAvatars, { ...PROPS, essai: { legendaire: mer.legendaire } })),
    bas: barre('La mer', 'Avatar · Finition · Bordure · Motif'),
  })
}

// ── Le rendu final ───────────────────────────────────────────────────────
// Le choix du propriétaire, le même jour : « calques + tenues c'est le top.
// Par contre je mettrais pas les tenues ici, mais plus dans un panneau
// latéral rétractable. » Et les quatre réponses du README : la ligue et le
// motif dans un même calque « Bordure » ; « Version rare » quitte la carte
// pour son calque ; la loge s'ouvre sur « Avatar », sur le calque qui a du
// neuf, ou sur celui qu'un lien « Essayer » demande ; les tenues dans un
// tiroir à droite — la carte garde son avatar à gauche, l'essai se voit
// tiroir ouvert.
//
// Léa a ici huit légendaires (deux rangées), deux matières taillées dans son
// Phénix, et les Comètes tout juste sorties de son coffre : neuves, elles
// mettent le point rouge sur « Bordure » et sur leur case.

const LEA_FINALE: any = {
  ...LEA,
  legendaires: ['lg:phenix', 'lg:dragon', 'lg:kraken', 'lg:chouette', 'lg:licorne', 'lg:lion', 'lg:comete', 'lg:serpent'],
  matieres: { 'lg:phenix': ['jade', 'obsidienne'] },
  motifs: [...SES_MOTIFS, 'cometes'],
}
const PROPS_FINALES = { ...PROPS, profil: LEA_FINALE }
const MOTIFS_FINAUX: string[] = LEA_FINALE.motifs

/** Le point rouge d'une nouveauté (`.loge-neuf`), sur un calque ou une case. */
const NEUF = '<span class="loge-neuf" aria-hidden="true"></span>'

type CalqueFinal = 'avatar' | 'version' | 'finition' | 'bordure' | 'sceau'
/** Le rail : ses calques, l'actif, ce qui est à l'essai, ce qui a du neuf. Version et Sceau seulement pour qui les a. */
function railFinal(actif: CalqueFinal, opts: { essai?: Partial<Record<CalqueFinal, string>>; neufs?: CalqueFinal[]; sans?: CalqueFinal[]; apercus?: Partial<Record<CalqueFinal, string>> } = {}): string {
  const apercu: Record<CalqueFinal, () => string> = {
    avatar: () => av({ bordure: null, finition: 'mat', sceau: false, eclat: false }),
    version: () => av({ bordure: null, sceau: false }),
    finition: () => `<i class="finition-teinte teinte-${LA_PLUS_BELLE}"></i>`,
    bordure: () => av({ sceau: false }),
    sceau: () => av({ bordure: null }),
  }
  const NOMS: Record<CalqueFinal, string> = { avatar: 'Avatar', version: 'Version', finition: 'Finition', bordure: 'Bordure', sceau: 'Sceau' }
  const auto: CalqueFinal[] = ['finition', 'bordure']
  const ids = (['avatar', 'version', 'finition', 'bordure', 'sceau'] as CalqueFinal[]).filter(c => !opts.sans?.includes(c))
  return `<div class="mq-calques" role="tablist" aria-label="Ce que je change" style="grid-template-columns: repeat(${ids.length}, minmax(0, 1fr))">${ids
    .map(id => {
      const essaye = opts.essai?.[id]
      const dessin = essaye ?? opts.apercus?.[id] ?? apercu[id]()
      return `<button type="button" role="tab" aria-selected="${id === actif}" class="mq-calque${id === actif ? ' actif' : ''}${essaye ? ' essaye' : ''}"><span class="mq-calque-apercu mq-sujet">${dessin}${auto.includes(id) && !essaye ? AUTO() : ''}${opts.neufs?.includes(id) ? NEUF : ''}</span><span class="mq-calque-nom">${NOMS[id]}</span></button>`
    })
    .join('')}</div>`
}

/** La languette du tiroir des tenues (la première version), collée au bord droit, à hauteur de la carte. */
const LANGUETTE = `<button type="button" class="mq-languette" aria-label="Mes tenues" aria-expanded="false">${icone('hanger')}</button>`

// Le paquet : les tenues sont des cartes. Derrière la carte de la loge, la
// tranche des autres ; à son coin, là où était « Version rare », un cintre
// et un point par tenue. Le doigt glisse la carte : la tenue suivante vient
// devant, à l'essai. Le cintre ouvre la liste, où l'on garde, renomme, retire.

/**
 * Les tenues de Léa : la première est celle qu'elle porte. Une tenue, c'est le look, pas le palmarès : l'avatar et ses
 * calques, et le fond de la carte — ce qui habille. Le titre et la vitrine disent ce qu'elle a fait : ils la suivent
 * d'une tenue à l'autre (la question du propriétaire, le même jour : « Mais du coup, c'est la carte entière pas
 * uniquement l'avatar ? », puis « tu penses qu'il faut tout ou juste l'avatar qui change ? »). Le fond compte : sans
 * lui, glisser une carte entière ne changerait qu'un petit rond.
 */
type Vitrine = { key: string; emoji: string; title: string }[]
const TENUES_FINALES: { nom: string; t: Tenue & { eclat?: any }; essai?: Partial<typeof LEA>; porte?: boolean }[] = [
  { nom: 'Soirée', t: {}, porte: true },
  {
    nom: 'Duels',
    t: { legendaire: 'lg:dragon', finition: 'or', bordure: { ...PORTEE, motif: 'ecailles' }, sceau: false, eclat: false },
    essai: { legendaire: 'lg:dragon', finition: 'or', finitionChoisie: 'or', motifChoisi: 'ecailles', sceauMasque: true, fond: 'dragon' },
  },
  {
    nom: 'La mer',
    t: { legendaire: 'lg:kraken', finition: 'abysses', bordure: { ligue: 'argent', crans: 12, motif: 'vagues' }, sceau: false, eclat: false },
    essai: { legendaire: 'lg:kraken', finition: 'abysses', finitionChoisie: 'abysses', bordureChoisie: 'argent', motifChoisi: 'vagues', sceauMasque: true, fond: 'abysses' },
  },
  {
    nom: 'Hiver',
    t: { legendaire: 'lg:chouette', finition: 'argent', bordure: { ligue: 'or', crans: 12, motif: 'flocons' }, sceau: false, eclat: false },
    essai: { legendaire: 'lg:chouette', finition: 'argent', finitionChoisie: 'argent', motifChoisi: 'flocons', sceauMasque: true, fond: 'nuit' },
  },
  {
    nom: 'Le Lion',
    t: { legendaire: 'lg:lion', finition: 'or', bordure: { ligue: 'or', crans: 12, motif: 'rayons' }, sceau: false, eclat: false },
    essai: { legendaire: 'lg:lion', finition: 'or', finitionChoisie: 'or', motifChoisi: 'rayons', sceauMasque: true, fond: 'triomphe' },
  },
]
/** Le cintre et un point par tenue, au coin de la carte : la montrée s'allonge en or, la portée garde son anneau. */
function lesPoints(montree: number | null, n = TENUES_FINALES.length): string {
  const points = Array.from({ length: n }, (_, i) => `<button type="button" class="mq-point${i === montree ? ' montree' : ''}${i === 0 ? ' portee' : ''}" aria-label="${TENUES_FINALES[i]?.nom ?? ''}"><i></i></button>`).join('')
  return `<div class="mq-points"><button type="button" class="mq-cintre" aria-label="Mes tenues">${icone('hanger')}</button>${points}</div>`
}
type ModeDeLaCarte = 'paquet' | 'tiroir' | 'nue'
/** La carte de la loge, sans « Version rare » (son calque l'a reprise) : en paquet, avec la languette du tiroir, ou nue. */
function carteFinale(essai: Partial<typeof LEA> = {}, mode: ModeDeLaCarte = 'paquet', laTenue?: number | null, saVitrine: Vitrine = VITRINE): string {
  const apercu = Object.keys(essai).length > 0
  // Un calque à l'essai : la carte ne montre plus aucune tenue gardée, aucun point ne s'allume.
  const tenue = laTenue === undefined ? (apercu ? null : 0) : laTenue
  // Ce qui change sur la carte a le pointillé de l'essai : l'avatar, le titre, la vitrine.
  const essaye = { avatar: apercu, titre: essai.titre !== undefined, vitrine: saVitrine !== VITRINE }
  let html = rendre(h(CarteDeLaLoge, { vu: { ...LEA_FINALE, ...essai }, vitrine: saVitrine, apercu, essaye, version: null, onOuvrir() {} }))
  if (mode === 'tiroir') return html.replace(/<\/div>$/, `${LANGUETTE}</div>`)
  if (mode === 'nue') return html
  // Une tenue gardée montrée : son nom à la place d'« Aperçu ».
  if (tenue !== null && tenue > 0) html = html.replace('<span class="loge-apercu">Aperçu</span>', `<span class="loge-apercu mq-nom-de-tenue">${icone('hanger')}${TENUES_FINALES[tenue].nom}</span>`)
  // Les points se rangent dans la rangée de l'avatar, pas au pied de la carte : sur un grand écran, la carte dit
  // dessous son niveau suivant et ses confettis (`XpMince`), que les points couvraient.
  return html.replace('<div class="loge-collante">', '<div class="loge-collante mq-paquet">').replace('</div><span class="xp-mince"', `${lesPoints(tenue)}</div><span class="xp-mince"`)
}
function ecranFinal(opts: { carte?: string; panneau: string; bas?: string; dessus?: string }): string {
  return ecran({ carte: opts.carte ?? carteFinale(), panneau: opts.panneau, bas: opts.bas, dessus: opts.dessus })
}

const finalAvatar = () => ecranFinal({ panneau: railFinal('avatar', { neufs: ['bordure'] }) + rendre(h(MesAvatars, PROPS_FINALES)) })

const VERSIONS: [string | boolean, string][] = [
  [false, 'D’origine'],
  [true, 'Rare'],
  ['jade', 'Jade'],
  ['obsidienne', 'Obsidienne'],
]
const finalVersion = () =>
  ecranFinal({
    carte: carteFinale({ matieres: { 'lg:phenix': ['jade', 'obsidienne'] } }),
    panneau:
      railFinal('version', { neufs: ['bordure'] }) +
      `<div class="mq-grille mq-grille-3">${VERSIONS.map(([v, nom]) => caseDe(av({ bordure: null, sceau: false, eclat: v as any }), nom, v === true ? 'porte' : '')).join('')}</div>`,
  })

const finalFinition = () =>
  ecranFinal({
    carte: carteFinale({ finition: 'abysses', finitionChoisie: 'abysses' }),
    panneau: railFinal('finition', { essai: { finition: `<i class="finition-teinte teinte-abysses"></i>` }, neufs: ['bordure'] }) + grilleDesFinitions('abysses'),
    bas: barre('Finition', 'Abysses'),
  })

const finalSceau = () =>
  ecranFinal({
    panneau:
      railFinal('sceau', { neufs: ['bordure'] }) +
      `<div class="mq-grille mq-grille-3">${caseDe(av({ bordure: null }), 'Montré', 'porte')}${caseDe(av({ bordure: null, sceau: false }), 'Masqué')}</div>`,
  })

/** Le calque « Bordure » : la ligue sur une ligne, puis ses motifs — les Comètes neuves, leur point rouge. */
const grilleFinaleDesMotifs = (essaye?: string) =>
  `<div class="mq-grille mq-sujet">${[
    caseDe(av({ sceau: false }), 'Accordé', 'porte', etincelle),
    ...MOTIFS_FINAUX.map(k => caseDe(av({ sceau: false, bordure: { ...PORTEE, motif: k } }), NOM_DU_MOTIF(k), k === essaye ? 'essaye' : '', k === 'cometes' ? NEUF : '')),
    aGagner(MOTIFS.length - MOTIFS_FINAUX.length, 'à gagner'),
  ].join('')}</div>`
const calqueBordureFinal = (essaye?: string) =>
  railFinal('bordure', essaye ? { essai: { bordure: av({ sceau: false, bordure: { ...PORTEE, motif: essaye } }) } } : {}) +
  `<span class="loge-sous-titre">Ligue</span>` +
  rangeeDesLigues() +
  `<span class="loge-sous-titre">Motif</span>` +
  grilleFinaleDesMotifs(essaye)
const finalBordure = () => ecranFinal({ carte: carteFinale({ motifChoisi: 'etoiles' }), panneau: calqueBordureFinal('etoiles'), bas: barre('Motif', 'Les Étoiles') })
const finalBordureDefilee = () => ecranFinal({ panneau: calqueBordureFinal() })

// Tom, qui vient de créer son profil : ni Éclat ni sceau, pas encore de duel — trois calques, et sa bordure dit comment l'ouvrir.
const TOM: any = {
  ...LEA, id: 'tom', name: 'Tom', niveau: 4, requis: 600, acquis: 140, titre: null, avatar: '🐻', legendaire: null, legendaires: [], sentiers: {},
  finition: 'argent', ouvertes: ['mat', 'argent'], bordures: [], motifs: [], scelles: [], eclats: [], matieres: {}, fond: null, vitrine: [],
  boutique: { confettis: { solde: 85 } },
}
const finalDebutant = () => {
  // Pas encore de tenue gardée : ni tranche derrière la carte, ni point — le cintre seul, qui ouvre la liste vide.
  const carteTom = rendre(h(CarteDeLaLoge, { vu: TOM, vitrine: [], apercu: false, essaye: {}, version: null, onOuvrir() {} })).replace(/<\/div>$/, `<div class="mq-points"><button type="button" class="mq-cintre" aria-label="Mes tenues">${icone('hanger')}</button></div></div>`)
  return ecran({
    carte: carteTom,
    panneau:
      railFinal('bordure', {
        sans: ['version', 'sceau'],
        apercus: { avatar: rendre(h(Avatar, { avatar: '🐻' })), finition: `<i class="finition-teinte teinte-argent"></i>`, bordure: `<i class="bordure-sans"></i>` },
      }) +
      // Le calque dit déjà « Bordure » : la phrase de la pièce d'aujourd'hui, sans son petit titre.
      rendre(h(MesBordures, { ...PROPS, profil: TOM })).replace('<span class="loge-sous-titre">Bordure</span>', ''),
  })
}

// ── La première version : le tiroir ──────────────────────────────────────

function tiroir(essayee?: string): string {
  const tenues = TENUES_FINALES.map(
    x =>
      `<button type="button" class="mq-tenue${x.porte ? ' porte' : ''}${(x.porte && !essayee) || x.nom === essayee ? ' selected' : ''}${x.nom === essayee ? ' essaye' : ''}"><span class="mq-tenue-dessin">${av(x.t)}</span><span class="mq-tenue-nom">${x.nom}</span></button>`,
  ).join('')
  return `<aside class="mq-tiroir" aria-label="Mes tenues"><header class="mq-tiroir-tete"><button type="button" class="mq-tiroir-fermer" aria-label="Ranger les tenues">${icone('chevron-right')}</button><span class="loge-sous-titre">Tenues</span></header><div class="mq-tiroir-corps mq-sujet"><button type="button" class="mq-tenue mq-tenue-plus mq-garder">${icone('plus')}<span class="mq-tenue-nom">Garder</span></button>${tenues}</div></aside>`
}
const finalTiroir = () => ecranFinal({ carte: carteFinale({}, 'nue'), panneau: railFinal('avatar', { neufs: ['bordure'] }) + rendre(h(MesAvatars, PROPS_FINALES)), dessus: tiroir() })
const finalTenueEssayee = () => {
  const mer = TENUES_FINALES[2].t
  return ecranFinal({
    carte: carteFinale({ legendaire: mer.legendaire, finition: mer.finition, finitionChoisie: mer.finition, bordureChoisie: 'argent', motifChoisi: 'vagues', sceauMasque: true }, 'nue'),
    panneau:
      railFinal('avatar', {
        essai: {
          avatar: av({ ...mer, bordure: null, finition: 'mat', sceau: false }),
          finition: `<i class="finition-teinte teinte-abysses"></i>`,
          bordure: av({ ...mer, sceau: false }),
        },
        neufs: ['bordure'],
      }) + rendre(h(MesAvatars, { ...PROPS_FINALES, essai: { legendaire: mer.legendaire } })),
    bas: barre('La mer', 'Avatar · Finition · Bordure · Sceau'),
    dessus: tiroir('La mer'),
  })
}

// ── Le paquet ────────────────────────────────────────────────────────────

/** Le dedans de `.loge-collante` : la carte seule, pour la poser où l'on veut. */
// React 19 pose devant elle les liens de préchargement de ses peintures : la balise ne commence pas la chaîne.
const sansCollante = (html: string) => html.replace(/<div class="loge-collante[^"]*">/, '').replace(/<\/div>$/, '')
const LA_MER = TENUES_FINALES[2]

/**
 * Le doigt glisse la carte vers la droite — la tenue d'avant, comme la carte d'un joueur (à gauche la suivante, à
 * droite la précédente) : « Hiver » s'en va, « La mer » est dessous. Vers la droite, la carte qui part découvre
 * l'avatar de celle qui vient, à gauche.
 */
const finalGlisse = () => {
  const HIVER = TENUES_FINALES[3]
  const devant = sansCollante(carteFinale(HIVER.essai, 'nue')).replace('<span class="loge-apercu">Aperçu</span>', `<span class="loge-apercu mq-nom-de-tenue">${icone('hanger')}${HIVER.nom}</span>`)
  // Dessous, « La mer » déjà nommée : c'est elle qui sera devant quand le doigt lâchera.
  const dessous = sansCollante(carteFinale(LA_MER.essai, 'nue')).replace('<span class="loge-apercu">Aperçu</span>', `<span class="loge-apercu mq-nom-de-tenue">${icone('hanger')}${LA_MER.nom}</span>`)
  return ecranFinal({
    carte: `<div class="loge-collante mq-paquet mq-glisse"><div class="mq-glisse-dessous">${dessous}</div><div class="mq-glisse-devant">${devant}</div><span class="mq-doigt" aria-hidden="true"></span>${lesPoints(2)}</div>`,
    panneau: railFinal('avatar', { neufs: ['bordure'] }) + rendre(h(MesAvatars, PROPS_FINALES)),
  })
}

/** « La mer » devant : son nom sur la carte, son point en or, ses calques en pointillé, « Porter ». */
const finalMer = () => {
  const mer = LA_MER.t
  return ecranFinal({
    carte: carteFinale(LA_MER.essai, 'paquet', 2),
    panneau:
      railFinal('avatar', {
        essai: {
          avatar: av({ ...mer, bordure: null, finition: 'mat', sceau: false }),
          finition: `<i class="finition-teinte teinte-abysses"></i>`,
          bordure: av({ ...mer, sceau: false }),
        },
        neufs: ['bordure'],
      }) + rendre(h(MesAvatars, { ...PROPS_FINALES, essai: { legendaire: mer.legendaire } })),
    bas: barre('La mer', 'Avatar · Finition · Bordure · Fond'),
  })
}

/** Le cintre touché : toutes ses tenues d'un coup d'œil, et ce qui s'y règle. La carte reste au-dessus, sans voile. */
const finalListe = () => {
  const rangees = TENUES_FINALES.map(
    (x, i) =>
      `<li class="mq-rangee-tenue carte-fond fond-${x.essai?.fond ?? LEA_FINALE.fond}${i === 0 ? ' portee' : ''}"><button type="button" class="mq-rangee-porter"><span class="mq-rangee-dessin mq-sujet">${av(x.t)}</span><span class="mq-rangee-nom"><b>${x.nom}</b></span>${i === 0 ? '<small class="mq-rangee-portee">Portée</small>' : ''}</button><button type="button" class="mq-rangee-geste" aria-label="Renommer ${x.nom}">${icone('edit')}</button><button type="button" class="mq-rangee-geste" aria-label="Retirer ${x.nom}">${icone('trash')}</button></li>`,
  ).join('')
  const feuille = `<div class="mq-voile"><div class="carte-feuille mq-feuille"><header class="carte-barre"><b class="feuille-titre">Mes tenues</b><button type="button" class="carte-fermer">${icone('x')}Fermer</button></header><div class="carte-corps"><ul class="mq-liste-tenues">${rangees}</ul></div><footer class="carte-pied mq-pied mq-pied-tenues"><span class="muted small">5 sur 6</span><button type="button" class="btn btn-primary">${icone('plus')}Garder ce que je porte</button></footer></div></div>`
  return ecranFinal({ panneau: railFinal('avatar', { neufs: ['bordure'] }) + rendre(h(MesAvatars, PROPS_FINALES)), dessus: feuille })
}

// ── Les pages ────────────────────────────────────────────────────────────

const STYLE = readFileSync(path.join(ICI, 'maquette.css'), 'utf8')
const FEUILLE = localiser(readFileSync(path.join(RACINE, 'client/src/styles.css'), 'utf8')) + '\n' + STYLE
writeFileSync(path.join(ICI, 'feuille.css'), FEUILLE)

const page = (corps: string, theme = '') =>
  `<!doctype html><html lang="fr"${theme ? ` data-theme="${theme}"` : ''}><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="feuille.css"><body class="avec-menu zone-profil">${corps}</body></html>`

/** Un écran de la planche : son nom de fichier, sa légende, son corps — et, au besoin, la page défilée. */
interface Ecran {
  nom: string
  titre: string
  dit: string
  corps: () => string
  defile?: number
  theme?: string
  /** Un grand téléphone (412 × 915) au lieu du petit de référence. */
  grand?: boolean
}
interface Section {
  id: string
  titre: string
  dit: string
  ecrans: Ecran[]
}

const SECTIONS: Section[] = [
  {
    id: 'aujourdhui',
    titre: 'Aujourd’hui, pour une collectionneuse',
    dit: 'Léa, niveau 38 : neuf finitions, quatre bordures, vingt-deux motifs. Chaque réglage est une rangée de tout ce qu’elle a ; plus elle gagne, plus ses avatars descendent.',
    ecrans: [
      { nom: 'aujourdhui', titre: 'La pièce telle qu’elle est', dit: 'Ses gemmes sous le menu', corps: aujourdhui },
      { nom: 'aujourdhui-defile', titre: 'Défilée jusqu’à ses avatars', dit: 'Trois rangées de motifs avant eux', corps: aujourdhui, defile: 420 },
    ],
  },
  {
    id: 'calques',
    titre: 'Piste 1 · Les calques',
    dit: 'Un rail de cinq calques sous les pièces : chacun montre ce qu’elle porte. On en touche un, sa grille seule s’ouvre dessous — la même grille pour tous, la même que les avatars.',
    ecrans: [
      { nom: 'calques-avatar', titre: 'Avatar, d’office', dit: 'Ses gemmes et ses avatars remontent sous le rail', corps: calqueAvatar },
      { nom: 'calques-bordure', titre: 'Bordure : la ligue, puis le motif', dit: 'Toucher un motif l’essaie sur la carte', corps: calqueBordure },
      { nom: 'calques-finition', titre: 'Finition', dit: 'Chacune portée par son avatar', corps: calqueFinition },
    ],
  },
  {
    id: 'fiche',
    titre: 'Piste 2 · La fiche de tenue',
    dit: 'Ce que tu proposais pour les motifs, à chaque réglage : une tuile qui montre ce qu’elle porte, et sa feuille au toucher, rangée par provenance. La carte reste au-dessus de la feuille, sans voile : l’essai se voit pendant qu’on choisit.',
    ecrans: [
      { nom: 'fiche-tuiles', titre: 'Quatre tuiles, puis les avatars', dit: 'Ce qu’elle porte, rien d’autre', corps: ficheTuiles },
      { nom: 'fiche-feuille', titre: 'La feuille du motif', dit: 'Par provenance ; « Porter » au pied', corps: ficheFeuille },
      { nom: 'fiche-entiere', titre: 'Variante : l’avatar aussi en fiche', dit: 'Six cases, chacune sa feuille — la pièce ne grandit plus jamais', corps: ficheEntiere },
    ],
  },
  {
    id: 'miroir',
    titre: 'Piste 3 · Le miroir',
    dit: 'Dans la pièce « Avatar », la carte se fait miroir : l’avatar en grand, et ce qu’on change épinglé autour de lui. Une épingle touchée, une bande défile dessous, un choix au centre, essayé à mesure qu’on glisse.',
    ecrans: [
      { nom: 'miroir-motif', titre: 'Motif : on glisse', dit: 'Les Étoiles au centre, essayées sur le miroir', corps: miroirMotif },
      { nom: 'miroir-finition', titre: 'Finition', dit: 'La lumière se voit en grand', corps: miroirFinition },
      { nom: 'miroir-avatar', titre: 'Le cœur du médaillon : ses avatars', dit: 'La grille sous le miroir', corps: miroirAvatar },
    ],
  },
  {
    id: 'tenues',
    titre: 'En plus · Les tenues',
    dit: 'Avec n’importe quelle piste : ce qui se règle calque par calque se garde. Une tenue, c’est tout l’avatar — sa version, sa finition, sa bordure, son motif, son sceau —, remis d’un toucher.',
    ecrans: [
      { nom: 'tenues', titre: 'Ses tenues, au-dessus des calques', dit: '« Garder » retient ce qu’elle porte', corps: tenues },
      { nom: 'tenue-essayee', titre: 'Une tenue touchée', dit: 'Tout change d’un coup ; « Porter » la garde', corps: tenueEssayee },
    ],
  },
  {
    id: 'final-calques',
    titre: 'Le rendu final · les calques',
    dit: 'La pièce s’ouvre sur « Avatar ». « Version rare » a quitté la carte pour son calque ; à sa place, la languette des tenues. Le point rouge suit le neuf jusqu’au calque, puis jusqu’à sa case.',
    ecrans: [
      { nom: 'final-avatar', titre: 'Avatar, d’office', dit: 'Deux rangées d’avatars au-dessus du menu', corps: finalAvatar },
      { nom: 'final-version', titre: 'Version', dit: 'D’origine, rare, chaque matière taillée', corps: finalVersion },
      { nom: 'final-finition', titre: 'Finition', dit: 'Chacune portée par son avatar, essayée sur la carte', corps: finalFinition },
      { nom: 'final-sceau', titre: 'Sceau', dit: 'Pour qui a un légendaire scellé', corps: finalSceau },
    ],
  },
  {
    id: 'final-bordure',
    titre: 'Le rendu final · la bordure',
    dit: 'La ligue sur une ligne, puis ses motifs. Le motif neuf a son point rouge. Un nouveau venu n’a que trois calques, et sa bordure lui dit comment l’ouvrir.',
    ecrans: [
      { nom: 'final-bordure', titre: 'Bordure : un motif à l’essai', dit: 'La carte le montre, la barre propose de le porter', corps: finalBordure },
      { nom: 'final-bordure-defilee', titre: 'Défilée jusqu’aux Comètes', dit: 'La carte reste collée en haut, la languette avec elle', corps: finalBordureDefilee, defile: 470 },
      { nom: 'final-debutant', titre: 'Tom, un nouveau venu', dit: 'Avatar, Finition, Bordure : rien d’autre', corps: finalDebutant },
    ],
  },
  {
    id: 'final-tenues',
    titre: 'Le rendu final · les tenues en paquet de cartes',
    dit: 'Les tenues sont des cartes : le look change — l’avatar et ses calques, le fond —, le palmarès reste — le titre, la vitrine. La tranche des autres dépasse derrière celle de la loge, un point par tenue à son coin. Le doigt glisse la carte, la tenue suivante vient devant, à l’essai. Le cintre ouvre la liste.',
    ecrans: [
      { nom: 'final-paquet', titre: 'Au repos', dit: 'Le cintre et cinq points, la tenue portée en or', corps: finalAvatar },
      { nom: 'final-glisse', titre: 'Le doigt glisse la carte', dit: '« Hiver » s’en va, « La mer » est dessous', corps: finalGlisse },
      { nom: 'final-mer', titre: '« La mer » devant', dit: 'Son avatar et son fond ; son titre et sa vitrine restent les siens', corps: finalMer },
      { nom: 'final-liste', titre: 'Le cintre : la liste', dit: 'Chaque tenue sur son fond ; garder, renommer, retirer', corps: finalListe },
    ],
  },
  {
    id: 'final-tailles',
    titre: 'Le rendu final · un grand téléphone, l’Ivoire',
    dit: 'En 412 × 915, la place de cinq rangées d’avatars ; sous le thème clair, le paquet et ses points se lisent sans retouche.',
    ecrans: [
      { nom: 'final-grand', titre: 'Sur un grand téléphone (412 × 915)', dit: 'La place de cinq rangées d’avatars', corps: finalAvatar, grand: true },
      { nom: 'final-ivoire', titre: 'Sous l’Ivoire', dit: '', corps: finalAvatar, theme: 'ivoire' },
      { nom: 'final-ivoire-mer', titre: 'Sous l’Ivoire, « La mer » devant', dit: '', corps: finalMer, theme: 'ivoire' },
    ],
  },
  {
    id: 'final-tiroir',
    titre: 'La première version · le tiroir',
    dit: 'Le panneau latéral demandé, gardé pour comparer : une languette au bord de la carte, un tiroir à droite.',
    ecrans: [
      { nom: 'final-tiroir', titre: 'Le tiroir sorti', dit: 'Il couvre la moitié droite de la carte et de la grille', corps: finalTiroir },
      { nom: 'final-tenue-essayee', titre: 'Une tenue touchée', dit: 'L’avatar de la carte reste à découvert', corps: finalTenueEssayee },
    ],
  },
  {
    id: 'ivoire',
    titre: 'Les calques, sous l’Ivoire',
    dit: 'La piste recommandée sous le thème clair.',
    ecrans: [
      { nom: 'ivoire-avatar', titre: 'Avatar', dit: '', corps: calqueAvatar, theme: 'ivoire' },
      { nom: 'ivoire-bordure', titre: 'Bordure', dit: '', corps: calqueBordure, theme: 'ivoire' },
      { nom: 'ivoire-finition', titre: 'Finition', dit: '', corps: calqueFinition, theme: 'ivoire' },
    ],
  },
]

const seulement = process.env.SEULEMENT?.split(',')
for (const s of SECTIONS) for (const e of s.ecrans) writeFileSync(path.join(ICI, `ecran-${e.nom}.html`), page(e.corps(), e.theme))

const planche = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>La pièce Avatar</title><link rel="stylesheet" href="feuille.css"><body class="mq-planche">${SECTIONS.map(
  s =>
    `<section id="${s.id}"><h2>${s.titre}</h2><p>${s.dit}</p><div class="mq-tels">${s.ecrans
      .map(e => `<figure class="mq-tel${e.grand ? ' grand' : ''}"><iframe src="ecran-${e.nom}.html" data-defile="${e.defile ?? 0}" width="${e.grand ? 412 : 360}" height="${e.grand ? 915 : 640}" scrolling="no"></iframe><figcaption><b>${e.titre}</b>${e.dit}</figcaption></figure>`)
      .join('')}</div></section>`,
).join('')}</body></html>`
const fichier = path.join(ICI, 'planche.html')
writeFileSync(fichier, planche)

// ── Les photos ───────────────────────────────────────────────────────────

const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
const { chromium } = createRequire(path.join(globale, 'planche.js'))('playwright')
const navigateur = await chromium.launch({ headless: true, args: ['--allow-file-access-from-files'] })
try {
  const onglet = await navigateur.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: Number(process.env.DENSITE ?? 2) })
  const erreurs: string[] = []
  onglet.on('pageerror', (e: Error) => erreurs.push(e.message))
  onglet.on('requestfailed', (r: any) => erreurs.push(r.url().slice(-80)))
  // Seize cadres et leurs peintures : « load » attend chacun ; `networkidle` ne venait jamais.
  await onglet.goto('file://' + fichier, { waitUntil: 'load', timeout: 120_000 })
  // Chaque cadre décode ses images, puis défile s'il le doit.
  for (const cadre of onglet.frames().slice(1)) {
    await cadre.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
  }
  await onglet.evaluate(`[...document.querySelectorAll('iframe')].forEach(f => f.contentWindow.scrollTo(0, Number(f.dataset.defile)))`)
  await onglet.waitForTimeout(1200)
  for (const s of SECTIONS) {
    if (seulement && !seulement.includes(s.id)) continue
    await onglet.locator(`#${s.id}`).screenshot({ path: path.join(ICI, `planche-${s.id}.jpg`), type: 'jpeg', quality: 86 })
  }
  // Ce que chaque écran montre au-dessus du menu : où finissent ses gemmes, sa première rangée d'avatars.
  const mesures = await onglet.evaluate(`[...document.querySelectorAll('iframe')].map(f => {
    const d = f.contentDocument
    const bas = s => { const e = d.querySelector(s); return e ? Math.round(e.getBoundingClientRect().bottom) : null }
    const menu = d.querySelector('.menu-barre, .loge-barre')
    return { ecran: f.getAttribute('src'), gemmes: bas('.gemmes'), premiereCase: bas('.loge-grille > *, .mq-grille > *'), menu: menu ? Math.round(menu.getBoundingClientRect().top) : null, hauteur: d.documentElement.scrollHeight }
  })`)
  console.table(mesures)
  if (erreurs.length) console.error(erreurs.slice(0, 8))
  console.log(fichier)
} finally {
  await navigateur.close()
}
