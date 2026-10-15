// Le style, dans « Ma collection » : ce qui habille sans rien rapporter —
// les fonds de carte, les gerbes, les finitions, les bordures de ligue (les
// thèmes ont leur album, `ThemesDeLaCollection`). Comme les deux albums de
// la collection : ce qu'on a en couleur, ce qui reste éteint, et pour chacun
// ce qu'il faut, où, et où l'on en est. Trois listes cochées disaient ce qui
// manquait sans dire où l'on en était, et les bordures n'y étaient pas : on
// les portait dans la loge sans les trouver dans la collection (le souhait du
// propriétaire du 13 octobre 2026 : un ensemble « homogène, cohérent et
// design »).
//
// Une dérivation pure de ce que la page du profil reçoit déjà, et des règles
// qui ouvrent chaque chose : les gerbes disent la leur (`par`), les fonds
// leur étape sur une piste (`etapeDuFond`), les finitions leur niveau, les
// bordures leur ligue.

import { FONDS, MAITRES_DU_CABINET, PRIX_D_UN_FOND } from './fonds'
import type { Rarete } from './badges'
import { GERBES, type Gerbe } from './gerbes'
import { FINITIONS, NIVEAU_FINITION, NOM_FINITION, type PublicProfileDetail } from './profil'
import { CRANS_D_UNE_BORDURE, LIGUES, NOM_DE_LA_BORDURE, bordurePortee } from './duels'
import { hautFait, regleDuPalier, titreDePalier, type HautFaitDeCarriere } from './hautsfaits'
import { recompensesDe } from './proches'
import { etapeDuFond } from './pistes'
import { seuilDeLEtape } from './trophees'
import { maitresDe } from './sentiers'
import { formatNumber } from './typographie'

/** Les lignes du style qui se montrent en album ; les thèmes ont le leur. */
export type PartieDuStyle = 'fonds' | 'gerbes' | 'finitions' | 'bordures'

/** Où il se gagne — ou s'achète : l'icône de son étape, et l'écran où aller. */
export type LieuDuStyle = 'soiree' | 'jour' | 'campagne' | 'sentiers' | 'duels' | 'niveau' | 'profil' | 'coffre' | 'boutique'

/** Ce qu'il faut pour l'avoir : une étape, comme celles des avatars de l'album. */
export interface EtapeDuStyle {
  lieu: LieuDuStyle
  /** Avec son lieu : « Au quiz du jour : L'Assidu · Argent », « Au niveau 20 ». */
  titre: string
  /** Sa règle, telle qu'on l'annonce : « 30 jours de quiz du jour ». */
  regle: string
  /** Où il en est, quand il y a de quoi compter. */
  progres: { acquis: number; requis: number; dit: string } | null
}

export interface ObjetDuStyle {
  cle: string
  nom: string
  aLui: boolean
  porte: boolean
  /** Sous sa case, ce qu'il faut en deux mots : « niv. 20 », « 30 jours », « cote 1 300 ». */
  court: string
  etape: EtapeDuStyle
  /** Une bordure : ses crans sertis, sur `CRANS_D_UNE_BORDURE`. */
  crans?: number
  /** Un objet du trésor : sa rareté au coffre de la semaine — un légendaire ne sort presque que d'un coffre d'or ou royal. */
  rarete?: Rarete
}

/** Ce que le style lit d'un profil. */
export type ProfilDuStyle = Pick<
  PublicProfileDetail,
  'niveau' | 'hautsFaits' | 'sentiers' | 'fonds' | 'fond' | 'gerbes' | 'gerbe' | 'ouvertes' | 'finition' | 'bordures' | 'bordureChoisie' | 'boutique'
>

const OU: Record<LieuDuStyle, string> = {
  soiree: 'En soirée',
  jour: 'Au quiz du jour',
  campagne: 'En campagne',
  sentiers: 'Sur les sentiers',
  duels: 'Aux duels',
  niveau: 'En montant de niveau',
  profil: 'Avec un profil',
  coffre: 'Au coffre de la semaine',
  boutique: 'En boutique',
}

/**
 * L'étape d'un objet du trésor : seul un coffre de la semaine le donne
 * (`shared/coffre.ts`), à sa rareté — rien à compter, la chance d'abord, et
 * plus de tampons, plus beau coffre.
 */
const DU_COFFRE: EtapeDuStyle = {
  lieu: 'coffre',
  titre: 'Au coffre de la semaine',
  regle: 'Tes trois missions d’un jour font un tampon ; le lundi, ton coffre s’ouvre — plus de tampons, plus beau coffre',
  progres: null,
}

/** Le niveau se nourrit de tout : sa règle, la même pour une finition et pour l'Aurore boréale. */
const DU_NIVEAU = 'Toute l’expérience compte, où que tu joues'

const compte = (acquis: number, requis: number, avant = '') => {
  const n = Math.min(acquis, requis)
  return { acquis: n, requis, dit: `${avant}${formatNumber(n)} sur ${formatNumber(requis)}` }
}

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Le lieu d'un trophée : celui de son mode — le niveau à part, qui vient de tous. */
function lieuDe(cle: string): LieuDuStyle {
  const h = hautFait(cle)
  if (!h) return 'soiree'
  if (h.famille === 'carriere') return h.key === 'hf:legende' ? 'niveau' : h.duJour ? 'jour' : h.deCampagne ? 'campagne' : 'soiree'
  return h.origine ?? 'soiree'
}

/** L'étape d'une piste qui ouvre quelque chose : son métal s'il en a un, son seuil, où il en est. */
function etapeDeLaPiste(p: ProfilDuStyle, h: HautFaitDeCarriere, seuil: number, regle: string): EtapeDuStyle {
  const lieu = lieuDe(h.key)
  if (lieu === 'niveau') return { lieu, titre: `Au niveau ${seuil}`, regle: DU_NIVEAU, progres: compte(p.niveau, seuil, 'niveau ') }
  const metal = h.paliers.indexOf(seuil) + 1
  const valeur = p.hautsFaits.find(x => x.key === h.key)?.valeur ?? 0
  return {
    lieu,
    titre: `${OU[lieu]} : ${metal > 0 ? titreDePalier(h, metal) : `${h.title}, ${seuilDeLEtape(h.key, seuil)}`}`,
    regle,
    progres: seuil > 1 ? compte(valeur, seuil) : null,
  }
}

function fonds(p: ProfilDuStyle): ObjetDuStyle[] {
  const siens = new Set(p.fonds ?? [])
  return FONDS.map(f => {
    const e = etapeDuFond(f.key)
    const h = e && hautFait(e.piste)
    let etape: EtapeDuStyle
    let court: string
    if (f.tresor) {
      etape = DU_COFFRE
      court = 'coffre'
    } else if (f.savoir) {
      // Un fond des savoirs s'achète : ce qu'il a déjà de confettis compte vers son prix.
      etape = {
        lieu: 'boutique',
        titre: `En boutique : ${formatNumber(PRIX_D_UN_FOND)} confettis`,
        regle: `Un fond par savoir — celui-ci habille ${f.savoir}`,
        progres: compte(Math.max(0, p.boutique?.confettis.solde ?? 0), PRIX_D_UN_FOND, '🎊 '),
      }
      court = `🎊 ${formatNumber(PRIX_D_UN_FOND)}`
    } else if (e?.piste === 'maitres') {
      etape = {
        lieu: 'sentiers',
        titre: `Sur les sentiers : ${MAITRES_DU_CABINET} maîtres`,
        regle: `Le palier de maître de ${MAITRES_DU_CABINET} sentiers du savoir`,
        progres: compte(maitresDe(p.sentiers ?? {}).length, MAITRES_DU_CABINET),
      }
      court = `${MAITRES_DU_CABINET} maîtres`
    } else if (e && h?.famille === 'carriere') {
      etape = etapeDeLaPiste(p, h, e.seuil, majuscule(f.regle))
      court = h.key === 'hf:legende' ? `niv. ${e.seuil}` : seuilDeLEtape(h.key, e.seuil)
    } else {
      // Le Triomphe : un titre de champion du mois, qui ne se compte pas.
      etape = { lieu: 'jour', titre: 'Au quiz du jour : champion du mois', regle: 'Le premier du classement d’un mois entier', progres: null }
      court = 'champion'
    }
    return { cle: f.key, nom: f.nom, aLui: siens.has(f.key), porte: p.fond === f.key, court, etape, ...(f.tresor && { rarete: f.tresor }) }
  })
}

/** L'étape d'une gerbe : un profil, un trophée gagné tant de fois, ou un palier atteint. */
function etapeDeLaGerbe(p: ProfilDuStyle, g: Gerbe): Pick<ObjetDuStyle, 'etape' | 'court'> {
  const par = g.par
  if ('profil' in par) return { etape: { lieu: 'profil', titre: 'Avec un profil', regle: 'Offerte à chaque profil', progres: null }, court: 'offerte' }
  if ('tresor' in par) return { etape: DU_COFFRE, court: 'coffre' }
  if ('palier' in par) {
    const h = hautFait(par.palier)
    if (h?.famille === 'carriere') return { etape: etapeDeLaPiste(p, h, h.paliers[par.au - 1], regleDuPalier(h, par.au)), court: titreDePalier(h, par.au) }
  }
  const cle = 'palier' in par ? par.palier : par.hautFait
  const fois = 'fois' in par ? par.fois : 1
  const h = hautFait(cle)
  const lieu = lieuDe(cle)
  const titre = h?.title ?? cle
  return {
    etape: {
      lieu,
      titre: `${OU[lieu]} : ${fois > 1 ? `${fois} fois ` : ''}« ${titre} »`,
      regle: h?.famille === 'soiree' ? h.rule : '',
      progres: fois > 1 ? compte(recompensesDe(p.hautsFaits).get(cle) ?? 0, fois) : null,
    },
    court: titre,
  }
}

function gerbes(p: ProfilDuStyle): ObjetDuStyle[] {
  const siennes = new Set(p.gerbes ?? [])
  return GERBES.map(g => ({
    cle: g.key,
    nom: g.nom,
    aLui: siennes.has(g.key),
    porte: p.gerbe === g.key,
    ...etapeDeLaGerbe(p, g),
    ...('tresor' in g.par && { rarete: g.par.tresor }),
  }))
}

function finitions(p: ProfilDuStyle): ObjetDuStyle[] {
  return FINITIONS.map(f => {
    const niveau = NIVEAU_FINITION[f]
    return {
      cle: f,
      nom: NOM_FINITION[f],
      aLui: p.ouvertes.includes(f),
      // Celle qu'on voit : « Auto » porte la plus belle, sans la nommer.
      porte: p.finition === f,
      court: `niv. ${niveau}`,
      etape: { lieu: 'niveau', titre: niveau > 1 ? `Au niveau ${niveau}` : 'Dès le niveau 1', regle: DU_NIVEAU, progres: niveau > 1 ? compte(p.niveau, niveau, 'niveau ') : null },
    }
  })
}

function bordures(p: ProfilDuStyle): ObjetDuStyle[] {
  const siennes = p.bordures ?? []
  const portee = bordurePortee(p.bordureChoisie ?? 'auto', siennes)
  return LIGUES.map(l => {
    const b = siennes.find(x => x.ligue === l.cle)
    const crans = Math.min(CRANS_D_UNE_BORDURE, b?.crans ?? 0)
    const premiere = !Number.isFinite(l.depuis)
    return {
      cle: l.cle,
      nom: NOM_DE_LA_BORDURE[l.cle],
      aLui: !!b,
      porte: portee?.ligue === l.cle,
      court: b ? (crans >= CRANS_D_UNE_BORDURE ? 'sertie' : `${crans}/${CRANS_D_UNE_BORDURE}`) : premiere ? '1ᵉʳ duel' : `cote ${formatNumber(l.depuis)}`,
      crans,
      // Une ligue atteinte le reste : redescendre ne reprend ni la bordure ni ses crans.
      etape: premiere
        ? { lieu: 'duels', titre: 'Aux duels : ton premier duel classé', regle: 'La ligue de bronze s’ouvre dès le premier', progres: null }
        : { lieu: 'duels', titre: `Aux duels : la ${l.nom.charAt(0).toLowerCase()}${l.nom.slice(1)}`, regle: `Une cote de ${formatNumber(l.depuis)}, une fois : elle reste, même si ta cote redescend`, progres: null },
    }
  })
}

const PARTIES: Record<PartieDuStyle, (p: ProfilDuStyle) => ObjetDuStyle[]> = { fonds, gerbes, finitions, bordures }

/** Les objets d'une ligne du style, dans l'ordre du catalogue : à lui ou non, porté ou non, et comment l'avoir. */
export function objetsDuStyle(partie: PartieDuStyle, p: ProfilDuStyle): ObjetDuStyle[] {
  return PARTIES[partie](p)
}
