// Les pistes des trophées : ce que chaque étape d'un trophée ouvre en chemin.
//
// Un même exploit se comptait en plusieurs récompenses, chacune sous son nom :
// gagner le quiz du jour faisait tomber Le Laurier, le palier du Champion du
// jour, le laurier du lendemain et la gerbe des ballons — le palier et le
// laurier montaient aux mêmes seuils (1, 5, 20) sous deux noms —, puis le fond
// Kintsugi à dix victoires, l'Aigle à trente, le thème de l'Horloge à
// cinquante, chacun dit ailleurs. Et rien ne disait, sous un trophée, ce qu'il
// ouvrait. Une piste range tout sur un seul chemin : un trophée qui se cumule,
// ses trois métaux, et ce que chaque étape ouvre (le retour reçu par le
// propriétaire le 13 octobre 2026, « c'est très confus, les trophées que les
// gens gagnent » ; la maquette 1 de l'album des trophées, choisie le même
// jour).
//
// Une dérivation pure des règles qui ouvrent chaque chose : les gerbes, les
// thèmes et les légendaires disent les leurs, on les lit ; les fonds n'ont
// qu'une fonction, ils ont donc ici leur étape — `trophees.test.ts` la
// vérifie contre `fondsOuverts`. Rien ne change au barème : on montre
// autrement ce qui existe.

import { HAUTS_FAITS_DE_CARRIERE, PART_DES_JOUEURS, clePalier, hautFait, hautFaitDeSoiree, palierDe, titreDePalier } from './hautsfaits'
import type { Rarete } from './badges'
import { GERBES } from './gerbes'
import { THEMES } from './themes'
import { FONDS, MAITRES_DU_CABINET, type CleDeFond } from './fonds'
import { LEGENDAIRES, estUneVoieRangee, partiesDe, voiesDe, type SimpleCondition } from './legendaires'
import { SEUILS_DU_LAURIER } from './jour'
import { formatNumber } from './typographie'

/** Ce qu'une étape ouvre : un laurier, une gerbe, un fond de carte, un thème, un avatar légendaire — et, aux duels, une bordure. */
export type SorteDeRecompense = 'laurier' | 'gerbe' | 'fond' | 'theme' | 'legendaire' | 'bordure'

export interface Recompense {
  sorte: SorteDeRecompense
  cle: string
  nom: string
  /** Une voie qui demande d'autres trophées en même temps (la Chimère, Janus) : leurs noms. */
  avec?: string[]
}

/** Une étape d'une piste : son seuil, son métal s'il en a un, et ce qu'elle ouvre. */
export interface EtapeDePiste {
  seuil: number
  /** Bronze, argent, or : 1, 2, 3. Sans métal, une étape n'est là que pour ce qu'elle ouvre (le Kintsugi à dix victoires). */
  metal?: 1 | 2 | 3
  recompenses: Recompense[]
}

/**
 * Le trophée regagnable qu'une piste compte déjà : Le Laurier tombe à chaque
 * victoire au quiz du jour, que la piste du Champion du jour compte aussi —
 * la même victoire, une seule ligne. L'album ne le montre plus à part, et une
 * fin de partie le dit sur la ligne de sa piste.
 */
export const ABSORBES: Readonly<Record<string, string>> = { 'hf:laurier': 'hf:champion-du-jour' }

/** Les pistes qui ne sont pas un haut fait de carrière : les maîtres des sentiers, les pages du calendrier. */
export type PisteAPart = 'maitres' | 'pages'

/** Le laurier qu'on porte le lendemain d'une victoire, à chaque seuil de `SEUILS_DU_LAURIER`. */
const LAURIERS = ['le laurier, le lendemain d’une victoire', 'le laurier d’or', 'le laurier d’or serti', 'la couronne étoilée'] as const

/**
 * L'étape de chaque fond : sa règle (`shared/fonds.ts`) n'est qu'une
 * fonction. La Nuit étoilée compte les jours joués comme L'Assidu, l'Aurore
 * boréale le niveau comme La Légende, le Kintsugi les victoires comme le
 * Champion du jour ; le Grand théâtre et le Cadran solaire suivent un palier,
 * le Cabinet de curiosités les maîtres. Le Triomphe va au titre de champion
 * du mois (`DU_CHAMPION_DU_MOIS`), les fonds du trésor au coffre de la
 * semaine (`shared/coffre.ts`) : ni l'un ni les autres n'ont de piste.
 */
const ETAPES_DES_FONDS: Readonly<Partial<Record<CleDeFond, { piste: string; seuil: number }>>> = {
  nuit: { piste: 'hf:assidu', seuil: 30 },
  aurore: { piste: 'hf:legende', seuil: 20 },
  kintsugi: { piste: 'hf:champion-du-jour', seuil: 10 },
  theatre: { piste: 'hf:habitue', seuil: 25 },
  cabinet: { piste: 'maitres', seuil: MAITRES_DU_CABINET },
  cadran: { piste: 'hf:elite', seuil: 50 },
}

/** Ce qu'ouvre un titre de champion du mois : le fond du Triomphe. */
export const DU_CHAMPION_DU_MOIS: readonly Recompense[] = [{ sorte: 'fond', cle: 'triomphe', nom: FONDS.find(f => f.key === 'triomphe')!.nom }]

/**
 * Le nom d'un trophée qu'une condition demande, tel qu'on l'écrit à côté d'un
 * autre : « L'Alpiniste · Or », « Le Roi de la soirée ×3 » — et, pour ce
 * qu'une piste absorbe, son compte sur elle : « 3 victoires au quiz du jour ».
 */
function nomDeLaCondition(c: SimpleCondition): string {
  const h = hautFait(c.hautFait)
  if (!h) return c.hautFait
  if ('palier' in c) return h.famille === 'carriere' ? titreDePalier(h, c.palier) : h.title
  const piste = hautFait(ABSORBES[c.hautFait] ?? '')
  if (piste?.famille === 'carriere') return `${formatNumber(c.fois)} ${c.fois < 2 ? piste.mesureUne : piste.mesure}`
  return c.fois > 1 ? `${h.title} ×${c.fois}` : h.title
}

/** Où se range une récompense : l'étape d'une piste, ou le compte d'un trophée qui se regagne. */
type Destination = { piste: string; seuil: number; metal?: 1 | 2 | 3 } | { trophee: string; fois: number }

/**
 * Où une condition range ce qu'elle ouvre : le palier d'une piste, ou le
 * nombre de fois d'un trophée qui se regagne — celui qu'une piste absorbe se
 * range sur elle, à son nombre de victoires. Une récompense de saison n'a pas
 * de piste.
 */
function destinationDe(c: SimpleCondition): Destination | null {
  // Un légendaire gardé au bout de l'expédition, ou réveillé au Cabinet, ne se range sur aucune piste non plus : on l'a, ou non.
  if (estUneVoieRangee(c.hautFait)) return null
  if ('palier' in c) {
    const h = hautFait(c.hautFait)
    if (h?.famille !== 'carriere') return null
    return { piste: h.key, seuil: h.paliers[c.palier - 1], metal: c.palier as 1 | 2 | 3 }
  }
  const piste = ABSORBES[c.hautFait]
  if (piste) return { piste, seuil: c.fois }
  return { trophee: c.hautFait, fois: c.fois }
}

const PISTES = new Map<string, EtapeDePiste[]>()
const DES_TROPHEES = new Map<string, { fois: number; recompense: Recompense }[]>()

function etapeDe(piste: string, seuil: number, metal?: 1 | 2 | 3): EtapeDePiste {
  let etapes = PISTES.get(piste)
  if (!etapes) PISTES.set(piste, (etapes = []))
  let e = etapes.find(x => x.seuil === seuil)
  if (!e) etapes.push((e = { seuil, recompenses: [] }))
  if (metal) e.metal = metal
  return e
}

function ranger(d: Destination | null, r: Recompense): void {
  if (!d) return
  if ('piste' in d) {
    etapeDe(d.piste, d.seuil, d.metal).recompenses.push(r)
    return
  }
  let liste = DES_TROPHEES.get(d.trophee)
  if (!liste) DES_TROPHEES.set(d.trophee, (liste = []))
  liste.push({ fois: d.fois, recompense: r })
}

// Les métaux de chaque haut fait de carrière, d'abord : une piste a toujours ses trois paliers.
for (const h of HAUTS_FAITS_DE_CARRIERE) h.paliers.forEach((seuil, i) => etapeDe(h.key, seuil, (i + 1) as 1 | 2 | 3))

// Le laurier du lendemain grandit aux mêmes seuils que le Champion du jour.
SEUILS_DU_LAURIER.forEach((seuil, i) => etapeDe('hf:champion-du-jour', seuil).recompenses.push({ sorte: 'laurier', cle: `laurier:${i + 1}`, nom: LAURIERS[i] }))

for (const g of GERBES) {
  const par = g.par
  // Celle de tous, celles du trésor, que seul un coffre donne, et celles des fêtes, qu'ouvre leur saison : aucune piste ne les ouvre.
  // Celle des défis du Cabinet non plus : ses défis tenus l'ouvrent, au Cabinet.
  if ('profil' in par || 'tresor' in par || 'fete' in par || 'defis' in par) continue
  const r: Recompense = { sorte: 'gerbe', cle: g.key, nom: g.nom }
  if ('palier' in par) ranger(destinationDe({ hautFait: par.palier, palier: par.au }), r)
  else ranger(destinationDe(par), r)
}

for (const t of THEMES) {
  const par = t.gagne?.par
  if (!par) continue
  const r: Recompense = { sorte: 'theme', cle: t.key, nom: t.nom }
  if ('maitres' in par) etapeDe('maitres', par.maitres).recompenses.push(r)
  else if ('pages' in par) etapeDe('pages', par.pages).recompenses.push(r)
  else if ('cle' in par) {
    const p = palierDe(par.cle)
    if (p) ranger(destinationDe({ hautFait: p.hautFait.key, palier: p.palier }), r)
  } else ranger(destinationDe(par), r)
}

for (const [cle, etape] of Object.entries(ETAPES_DES_FONDS)) {
  if (!etape) continue
  const f = FONDS.find(x => x.key === cle)!
  etapeDe(etape.piste, etape.seuil).recompenses.push({ sorte: 'fond', cle, nom: f.nom })
}

// Chaque voie d'un légendaire, sur chacune des conditions qu'elle demande ;
// une voie qui en demande plusieurs à la fois dit les autres (« avec »).
for (const l of LEGENDAIRES) {
  for (const voie of voiesDe(l)) {
    const parties = partiesDe(voie)
    for (const c of parties) {
      const avec = parties.filter(x => x !== c).map(nomDeLaCondition)
      ranger(destinationDe(c), { sorte: 'legendaire', cle: l.key, nom: l.nom, ...(avec.length > 0 && { avec }) })
    }
  }
}

for (const etapes of PISTES.values()) etapes.sort((a, b) => a.seuil - b.seuil)
for (const liste of DES_TROPHEES.values()) liste.sort((a, b) => a.fois - b.fois)

/**
 * Les étapes d'une piste — un haut fait de carrière (`hf:assidu`), les
 * maîtres des sentiers ou les pages du calendrier —, de la première à la
 * dernière ; vide pour ce qui n'en est pas une.
 */
export function etapesDeLaPiste(cle: string): readonly EtapeDePiste[] {
  return PISTES.get(cle) ?? []
}

/**
 * L'étape qui ouvre un fond : sa piste et son seuil — le style de « Ma
 * collection » dit où l'on en est. Null pour le Triomphe, qui va au champion
 * du mois, sans compte, et pour les fonds du trésor, que seul un coffre donne.
 */
export function etapeDuFond(cle: CleDeFond): { piste: string; seuil: number } | null {
  return ETAPES_DES_FONDS[cle] ?? null
}

/** Ce qu'ouvre un trophée qui se regagne, à tant de fois : « ×3 : le Kraken ». */
export function ceQuOuvreLeTrophee(cle: string): readonly { fois: number; recompense: Recompense }[] {
  return DES_TROPHEES.get(cle) ?? []
}

/**
 * Ce qu'ouvre un trophée qui vient de tomber, pour la fin d'une partie : un
 * palier rangé (`hf:assidu:2`) ouvre ce que dit l'étape de son métal — il ne
 * tombe qu'une fois, ce qu'il ouvre est neuf. Un haut fait qui se regagne
 * n'ouvre quelque chose qu'à un nombre de fois précis, que la fin d'une
 * partie ne connaît pas : sans `fois`, rien — annoncer la gerbe de l'Éclair
 * du jour à sa troisième fois la promettait une deuxième. Les étapes sans
 * métal (le Kintsugi à dix victoires) tombent avec un compte, pas avec un
 * palier : l'album les montre, la fin d'une partie ne les devine pas.
 */
export function ceQuIlOuvre(cle: string, fois?: number): Recompense[] {
  const p = palierDe(cle)
  if (p) return [...(etapesDeLaPiste(p.hautFait.key).find(e => e.metal === p.palier)?.recompenses ?? [])]
  if (fois === undefined) return []
  const piste = ABSORBES[cle]
  if (piste) return [...(etapesDeLaPiste(piste).find(e => e.seuil === fois)?.recompenses ?? [])]
  if (!hautFaitDeSoiree(cle)) return []
  return ceQuOuvreLeTrophee(cle)
    .filter(x => x.fois === fois)
    .map(x => x.recompense)
}

/** Une récompense dite dans une phrase : « le laurier d’or », « la gerbe « Les ballons » », « L’Aigle aux lauriers, avatar légendaire ». */
export function ditLaRecompense(r: Recompense): string {
  switch (r.sorte) {
    case 'laurier':
      return r.nom
    case 'gerbe':
      return `la gerbe « ${r.nom} »`
    case 'fond':
      return `le fond « ${r.nom} »`
    case 'theme':
      return `le thème « ${r.nom} »`
    case 'legendaire':
      return `${r.nom}, avatar légendaire${r.avec ? `, avec ${r.avec.join(' et ')}` : ''}`
    case 'bordure':
      return `la bordure « ${r.nom} »`
  }
}

/**
 * La rareté mesurée d'un trophée — un haut fait, un palier rangé —, lue dans
 * `PART_DES_JOUEURS` aux seuils de `rareteDe` (la moitié des joueurs ou plus :
 * commune ; un quart : peu commune ; un dixième : rare ; trois sur cent :
 * épique ; moins : légendaire). Null pour ce qui n'est pas mesuré (un prix).
 */
export function rareteMesuree(cle: string): Rarete | null {
  const part = PART_DES_JOUEURS[cle]
  if (part === undefined) return null
  if (part >= 0.5) return 'commune'
  if (part >= 0.25) return 'peucommune'
  if (part >= 0.1) return 'rare'
  if (part >= 0.03) return 'epique'
  return 'legendaire'
}

/** Le palier rangé d'une étape à métal : `hf:assidu:2`. */
export const cleDeLEtape = (piste: string, metal: 1 | 2 | 3) => clePalier(piste, metal)
