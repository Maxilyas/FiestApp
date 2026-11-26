// La loge : « M'habiller », au profil — tout ce qu'on porte, sur un seul
// écran (la maquette validée par le propriétaire le 12 octobre 2026). On
// essaie d'abord : la carte en tête montre l'essai, le thème habille la page,
// la gerbe éclate ; « Porter » enregistre tout l'essai d'un coup, « Annuler »
// rend la tenue d'avant. Six pages, une par pièce, se quittaient et se
// rouvraient pour changer d'avatar puis de titre, et chaque toucher
// enregistrait — on portait ce qu'on voulait seulement voir.
//
// Ce module en garde les règles, pures : ce que l'essai retient, ce que la
// carte en montre, ce que la barre en dit, et ce qui est nouveau depuis le
// dernier passage. La page les lit (`Loge.tsx`), les tests aussi.

import { AVATARS, COLLECTION } from './avatars'
import { brancheDe, portrait, portraitsOuverts } from './branches'
import { compagnonDe, formeDeCompagnon, formesOuvertes } from './compagnons'
import { vitrineDeLaCarte, type CarteDeJoueur } from './carte'
import { divin } from './divins'
import { fond } from './fonds'
import { AUCUNE_GERBE, gerbe } from './gerbes'
import { cleRangee, hautsFaitsGagnes } from './hautsfaits'
import { cibleEclat, legendaire } from './legendaires'
import { NOM_FINITION, clesQuiBrillent, eclatChez, finitionSur, meilleureFinition, sceauVisible, type FinitionChoisie, type PublicProfileDetail } from './profil'
import { NOM_DE_LA_MATIERE, estUneMatiere, matiereOuverte, type Matiere } from './matieres'
import { recompensesDe } from './proches'
import { cleDeMaitre, maitresDe, nomDuTitre } from './sentiers'
import { NOM_DE_RARETE, THEMES, campDuTheme, theme } from './themes'
import { AUCUNE_PLAQUE } from './plaques'
import { AUCUNE_BORDURE, CRANS_D_UNE_BORDURE, NOM_DE_LA_BORDURE, bordurePortee, type ChoixDeBordure } from './duels'
import { motif } from './motifs'
import { PIECES_DE_LA_LOGE, type PieceDeLaLoge, type VusDeLaLoge } from './piecesDeLaLoge'
import type { LookDUneTenue } from './tenues'

// Les six pièces vivent à part, sans catalogue : la page du profil montre
// sa carte et sa rangée avant que ces règles n'arrivent.
export { PIECES_DE_LA_LOGE, estUnePieceDeLaLoge, type PieceDeLaLoge, type VusDeLaLoge } from './piecesDeLaLoge'

/**
 * Ce qu'on essaie : les champs d'un enregistrement du profil
 * (`PUT /api/joueur/moi`, qui les prend tous ensemble ou n'en écrit aucun),
 * tant qu'ils diffèrent de ce qu'on porte. Vide, il n'y a rien à porter.
 */
export interface Essai {
  /** Un emoji : il ôte le légendaire, comme au serveur. */
  avatar?: string
  /** Un légendaire, un Divin, un portrait ; null : revenir à son emoji. */
  legendaire?: string | null
  finition?: FinitionChoisie
  titre?: string | null
  /** null : les plus durs, d'office. */
  vitrine?: string[] | null
  fond?: string | null
  /** null : Velours. */
  theme?: string | null
  /** `AUCUNE_GERBE` : aucune. */
  gerbe?: string | null
  /**
   * La version de l'avatar que la carte montre, s'il a éclaté pour lui : rare
   * (`brille`) ou d'origine — et, rare, la matière qu'il y a taillée
   * (`matiere`, `shared/matieres.ts` ; absente ou null, sa version rare).
   */
  eclat?: { cle: string; brille: boolean; matiere?: Matiere | null }
  /** La bordure de ligue : `auto`, `aucune`, ou celle d'une ligue atteinte. */
  bordure?: ChoixDeBordure
  /** Le motif de sa bordure (`shared/motifs.ts`) : la clé d'un motif qu'il tient, ou null — accordé à son avatar. */
  motif?: string | null
  /** Le sceau de ses légendaires : montré (`true`, d'office) ou masqué. */
  sceau?: boolean
  /** La plaque de son nom aux classements (`shared/plaques.ts`) : `auto` — celle de son thème —, `aucune`, ou la clé d'un thème à lui. */
  plaque?: string
  /** Son camp sous un thème qui en a deux (`Theme.camps`) : il teinte la page, et sa plaque des Deux Bannières. */
  camp?: string | null
}

/**
 * Ce qu'il porte, tel que sa page le reçoit — ses Éclats compris, et ceux
 * qu'il a éteints : la version qu'il montre de chacun.
 */
export type Tenue = Pick<PublicProfileDetail, 'avatar' | 'legendaire' | 'finitionChoisie' | 'titre' | 'vitrineChoisie' | 'fond' | 'theme' | 'gerbe' | 'bordureChoisie'> &
  Partial<Pick<PublicProfileDetail, 'eclats' | 'eclatsEteints' | 'matieres' | 'matieresPortees' | 'scelles' | 'sceauMasque' | 'plaqueChoisie' | 'camp' | 'motifChoisi'>>

/** L'avatar que la carte montre : l'emoji essayé ôte le légendaire, comme au serveur. */
export function avatarMontre(porte: Pick<Tenue, 'avatar' | 'legendaire'>, essai: Essai): { avatar: string; legendaire: string | null } {
  if (essai.avatar !== undefined) return { avatar: essai.avatar, legendaire: null }
  return { avatar: porte.avatar, legendaire: essai.legendaire !== undefined ? essai.legendaire : (porte.legendaire ?? null) }
}

/**
 * Ce qui peut avoir éclaté dans l'avatar montré : le légendaire ou le
 * portrait, sinon l'emoji (`cibleEclat`) — rien sous un Divin, qui n'éclate
 * pas et cache l'emoji. Une forme de compagnon, depuis son ciel rare (le
 * 3 novembre 2026) : sa version rare ou d'origine se choisit pour toutes ses
 * formes, sur l'Éclat qui les fait briller — celui de la forme où il est
 * tombé, parmi ses `eclats` (`clesQuiBrillent`) : c'est sa ligne que le
 * serveur règle. Sa métamorphose non : elle n'a qu'une version, déjà rare,
 * et se choisit comme une forme de plus, dans la grille.
 */
export function cibleDeLEclat(montre: { avatar: string; legendaire: string | null }, eclats: readonly string[] = []): string | null {
  if (divin(montre.legendaire)) return null
  const forme = formeDeCompagnon(montre.legendaire)
  if (forme) return forme.metamorphose ? null : (clesQuiBrillent(eclats, forme.key)[0] ?? forme.key)
  return cibleEclat(montre.legendaire, montre.avatar)
}

const memeVitrine = (a: readonly string[] | null, b: readonly string[] | null) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((k, i) => k === b[i]))

/**
 * L'essai, une pièce de plus essayée. Un avatar à la fois : l'emoji essayé
 * ôte le légendaire essayé, et l'inverse. Ce qui revient à ce qu'il porte
 * sort de l'essai — toucher le Phénix qu'on porte après la Chouette, c'est
 * renoncer à la Chouette, pas « porter » le Phénix une seconde fois.
 */
export function essayer(essai: Essai, piece: Essai, porte: Tenue): Essai {
  const suivant: Essai = { ...essai, ...piece }
  if ('avatar' in piece) delete suivant.legendaire
  if ('legendaire' in piece) delete suivant.avatar
  // Velours s'écrit null, comme le serveur le range.
  if (suivant.theme === 'velours') suivant.theme = null
  if (suivant.avatar !== undefined && suivant.avatar === porte.avatar && !porte.legendaire) delete suivant.avatar
  if (suivant.legendaire !== undefined && suivant.legendaire === (porte.legendaire ?? null)) delete suivant.legendaire
  if (suivant.finition !== undefined && suivant.finition === porte.finitionChoisie) delete suivant.finition
  if (suivant.bordure !== undefined && suivant.bordure === (porte.bordureChoisie ?? 'auto')) delete suivant.bordure
  if (suivant.motif !== undefined && suivant.motif === (porte.motifChoisi ?? null)) delete suivant.motif
  if (suivant.sceau !== undefined && suivant.sceau === !porte.sceauMasque) delete suivant.sceau
  if (suivant.titre !== undefined && suivant.titre === (porte.titre ?? null)) delete suivant.titre
  if (suivant.vitrine !== undefined && memeVitrine(suivant.vitrine, porte.vitrineChoisie ?? null)) delete suivant.vitrine
  if (suivant.fond !== undefined && suivant.fond === (porte.fond ?? null)) delete suivant.fond
  if (suivant.theme !== undefined && suivant.theme === (porte.theme === 'velours' ? null : (porte.theme ?? null))) delete suivant.theme
  // La gerbe portée se lit déjà résolue : null, il n'en veut aucune.
  if (suivant.gerbe !== undefined && (suivant.gerbe === AUCUNE_GERBE ? null : suivant.gerbe) === (porte.gerbe ?? null)) delete suivant.gerbe
  // La plaque se compare à son choix, pas à celle qu'on voit : « comme mon thème » et le thème lui-même sont deux choix.
  if (suivant.plaque !== undefined && suivant.plaque === (porte.plaqueChoisie ?? 'auto')) delete suivant.plaque
  // Le camp se compare à celui qu'il porte, le premier d'office : choisir les Clans sans en avoir choisi aucun, c'est le même.
  if (suivant.camp !== undefined) {
    const t = THEMES.find(x => x.camps?.some(c => c.key === suivant.camp))
    if (campDuTheme(t, suivant.camp)?.key === campDuTheme(t, porte.camp)?.key) delete suivant.camp
  }
  // La version d'un avatar éclaté suit l'avatar montré : en essayer un autre
  // la laisse — « Porter » aurait réglé un avatar qu'on ne voit plus. Celle
  // qu'il montre déjà sort de l'essai.
  if (suivant.eclat) {
    const { cle, brille } = suivant.eclat
    // Rare, la matière qu'il essaie ; d'origine, aucune.
    const matiere = brille ? (suivant.eclat.matiere ?? null) : null
    const montree = porte.eclats ? eclatChez({ eclats: porte.eclats, eclatsEteints: porte.eclatsEteints, matieres: porte.matieres, matieresPortees: porte.matieresPortees }, cle) : null
    if (cle !== cibleDeLEclat(avatarMontre(porte, suivant), porte.eclats)) delete suivant.eclat
    else if (montree !== null && brille === !!montree && matiere === (typeof montree === 'string' ? montree : null)) delete suivant.eclat
  }
  return suivant
}

/** Rien à porter : l'essai revient à ce qu'il porte. */
export const essaiVide = (essai: Essai) => Object.keys(essai).length === 0

/**
 * L'essai qu'une adresse demande en ouvrant la loge — « Essayer », sous
 * « À porter » à la fin d'une partie (`/profil?essayer=nuit#fond`), ou dans
 * une fiche de « Ma collection » (`?essayer=finition:or#avatar`) : le fond,
 * la gerbe, le thème, l'avatar, la finition ou la bordure, déjà sur la
 * carte. Seulement ce qui est à lui, et sur la pièce de l'adresse : une
 * adresse tapée n'essaie rien qu'il n'ait.
 */
export function essaiDemande(piece: PieceDeLaLoge, cle: string | null, profil: PublicProfileDetail): Essai {
  if (!cle) return {}
  const a = ceQuIlAPorter(profil)
  if (piece === 'fond' && a.fond.includes(cle)) return essayer({}, { fond: cle }, profil)
  if (piece === 'gerbe' && a.gerbe.includes(cle)) return essayer({}, { gerbe: cle }, profil)
  if (piece === 'theme' && a.theme.includes(cle)) return essayer({}, { theme: cle }, profil)
  // Un motif de bordure qu'il tient (`motif:vagues`) : le coffre, la boutique, la collection y mènent.
  if (piece === 'avatar' && cle.startsWith('motif:') && (profil.motifs ?? []).includes(cle.slice('motif:'.length))) return essayer({}, { motif: cle.slice('motif:'.length) }, profil)
  // L'avatar : ses clés sont celles de ses nouveautés — `finition:or`, `bordure:or`, un emoji, un médaillon.
  if (piece !== 'avatar' || !a.avatar.includes(cle)) return {}
  if (cle.startsWith('finition:')) return essayer({}, { finition: cle.slice('finition:'.length) as FinitionChoisie }, profil)
  // `bordure:or:sertie` dit une nouveauté, pas une bordure à porter.
  if (/^bordure:[a-z]+$/.test(cle)) return essayer({}, { bordure: cle.slice('bordure:'.length) as ChoixDeBordure }, profil)
  if (COLLECTION.some(c => c.emoji === cle)) return essayer({}, { avatar: cle }, profil)
  if (legendaire(cle) || divin(cle) || portrait(cle) || formeDeCompagnon(cle)) return essayer({}, { legendaire: cle }, profil)
  return {}
}

/**
 * Le profil tel que la carte de la loge le montre, l'essai porté : son
 * avatar, sa finition, son titre, sa vitrine, son fond. Rien n'est
 * enregistré — la salle voit toujours ce qu'il porte.
 */
export function avecLEssai<P extends Tenue & Pick<PublicProfileDetail, 'finition' | 'niveau'>>(profil: P, essai: Essai): P {
  const vu = { ...profil }
  if (essai.avatar !== undefined) {
    vu.avatar = essai.avatar
    vu.legendaire = null
  }
  if (essai.legendaire !== undefined) vu.legendaire = essai.legendaire
  if (essai.finition !== undefined) {
    vu.finitionChoisie = essai.finition
  }
  // Sa finition telle que la salle la verrait : la règle du serveur (`finitionSur`). Un Divin
  // essayé garde sa lumière en `auto` ; l'emoji qu'on reprend retrouve la plus belle.
  if (essai.avatar !== undefined || essai.legendaire !== undefined || essai.finition !== undefined) vu.finition = finitionSur(vu.legendaire, vu.finitionChoisie, profil.niveau)
  if (essai.bordure !== undefined) vu.bordureChoisie = essai.bordure
  if (essai.motif !== undefined) vu.motifChoisi = essai.motif
  if (essai.sceau !== undefined) vu.sceauMasque = !essai.sceau
  if (essai.titre !== undefined) vu.titre = essai.titre
  if (essai.vitrine !== undefined) vu.vitrineChoisie = essai.vitrine
  if (essai.fond !== undefined) vu.fond = essai.fond
  if (essai.theme !== undefined) vu.theme = essai.theme
  if (essai.gerbe !== undefined) vu.gerbe = essai.gerbe === AUCUNE_GERBE ? null : essai.gerbe
  if (essai.plaque !== undefined) vu.plaqueChoisie = essai.plaque
  if (essai.camp !== undefined) vu.camp = essai.camp
  if (essai.eclat) {
    const eteints = new Set(profil.eclatsEteints ?? [])
    if (essai.eclat.brille) eteints.delete(essai.eclat.cle)
    else eteints.add(essai.eclat.cle)
    vu.eclatsEteints = [...eteints]
    // La matière qu'il essaie devient celle qu'il porte de cet avatar ; sa version rare ou d'origine n'en porte aucune.
    const portees = { ...profil.matieresPortees }
    const matiere = essai.eclat.brille ? (essai.eclat.matiere ?? null) : null
    if (matiere) portees[essai.eclat.cle] = matiere
    else delete portees[essai.eclat.cle]
    vu.matieresPortees = portees
  }
  return vu
}

/** Les hauts faits que sa carte montrerait : ceux qu'il a choisis, sinon les plus durs (`vitrineDeLaCarte`). */
export function vitrineVue(profil: Pick<PublicProfileDetail, 'vitrine' | 'vitrineChoisie' | 'hautsFaits'>) {
  return vitrineDeLaCarte(profil.vitrine, profil.vitrineChoisie ?? null, recompensesDe(profil.hautsFaits))
}

/**
 * Sa carte entière, telle que la salle la verrait s'il portait l'essai : la
 * carte que le serveur compose (`/api/joueur/carte`), retouchée de ce qu'il
 * essaie et de rien d'autre — l'avatar, sa finition, son Éclat et sa
 * bordure, comme le serveur les lit (`apparenceDe`, `carteDuProfil`) ; son
 * titre, sa vitrine, son fond. Ses chiffres, ses écussons, ses légendaires ne
 * s'essaient pas. La carte de la loge, touchée, s'ouvre en grand sur elle (le
 * retour d'un joueur du 14 octobre 2026 : « cliquer sur la carte pour
 * l'afficher en grand »).
 */
export function carteAvecLEssai(
  carte: CarteDeJoueur,
  profil: Tenue & Pick<PublicProfileDetail, 'finition' | 'niveau' | 'eclats' | 'vitrine' | 'hautsFaits' | 'bordures'>,
  essai: Essai,
): CarteDeJoueur {
  const vu = avecLEssai(profil, essai)
  const retouchee: CarteDeJoueur = { ...carte }
  if (essai.avatar !== undefined || essai.legendaire !== undefined || essai.finition !== undefined || essai.bordure !== undefined || essai.motif !== undefined || essai.eclat || essai.sceau !== undefined) {
    const legendaire = vu.legendaire ?? undefined
    const bordure = bordurePortee(vu.bordureChoisie ?? 'auto', vu.bordures, vu.motifChoisi)
    retouchee.avatar = vu.avatar
    retouchee.finition = vu.finition
    // Absents plutôt que faux, comme le serveur les envoie (`distinctions`).
    delete retouchee.eclat
    delete retouchee.legendaire
    delete retouchee.bordure
    delete retouchee.sceau
    // Telle quelle : sa version rare, ou la matière qu'il essaie.
    const eclat = eclatChez(vu, cibleEclat(legendaire, vu.avatar))
    if (eclat) retouchee.eclat = eclat
    if (legendaire) retouchee.legendaire = legendaire
    if (bordure) retouchee.bordure = bordure
    if (sceauVisible(vu)) retouchee.sceau = true
  }
  if (carte.profil && (essai.titre !== undefined || essai.vitrine !== undefined || essai.fond !== undefined)) {
    const p = { ...carte.profil }
    if (essai.titre !== undefined) {
      delete p.titre
      if (vu.titre) p.titre = vu.titre
    }
    if (essai.vitrine !== undefined) p.vitrine = vitrineVue(vu)
    if (essai.fond !== undefined) {
      delete p.fond
      if (vu.fond) p.fond = vu.fond
    }
    retouchee.profil = p
  }
  return retouchee
}

/** Une ligne de ce qu'on essaie : son nom, et ce qu'il est. */
export interface LigneDEssai {
  piece: PieceDeLaLoge
  nom: string
  detail: string
}

/**
 * Ce que la barre dit de l'essai, pièce par pièce, dans l'ordre de la
 * rangée : « La Chouette · Légendaire », « « L'Oracle » · Titre ». On sait ce
 * qu'on porte avant de toucher « Porter ».
 */
export function lignesDeLEssai(essai: Essai, profil: Pick<PublicProfileDetail, 'niveau'> & Partial<Pick<PublicProfileDetail, 'legendaire'>>): LigneDEssai[] {
  const lignes: LigneDEssai[] = []
  if (essai.avatar !== undefined) {
    const n = COLLECTION.find(c => c.emoji === essai.avatar)?.niveau
    lignes.push({ piece: 'avatar', nom: essai.avatar, detail: n ? `De collection · niveau ${n}` : 'Emoji' })
  } else if (essai.legendaire !== undefined) {
    const k = essai.legendaire
    const l = legendaire(k)
    const d = divin(k)
    const p = portrait(k)
    const c = formeDeCompagnon(k)
    lignes.push(
      l
        ? { piece: 'avatar', nom: l.nom, detail: 'Légendaire' }
        : d
          ? { piece: 'avatar', nom: d.nom, detail: 'Divin' }
          : p
            ? { piece: 'avatar', nom: p.nom, detail: `Portrait · ${brancheDe(p).nom}` }
            : c
              ? { piece: 'avatar', nom: c.nom, detail: `Compagnon · ${compagnonDe(c).nom}` }
              : { piece: 'avatar', nom: 'Ton emoji', detail: 'Avatar' },
    )
  }
  if (essai.eclat) {
    const matiere = essai.eclat.brille ? essai.eclat.matiere : null
    lignes.push(
      matiere
        ? { piece: 'avatar', nom: NOM_DE_LA_MATIERE[matiere], detail: 'Matière' }
        : { piece: 'avatar', nom: essai.eclat.brille ? 'Version rare' : 'Version d’origine', detail: 'Éclat' },
    )
  }
  if (essai.finition !== undefined) {
    const f = essai.finition
    // Sous un Divin — celui qu'il essaie, sinon celui qu'il porte —, `auto` lui rend sa lumière (`finitionSur`).
    const sousUnDivin = essai.avatar === undefined && divin(essai.legendaire !== undefined ? essai.legendaire : profil.legendaire)
    const auto = sousUnDivin ? 'Sa lumière' : `La plus belle · ${NOM_FINITION[meilleureFinition(profil.niveau)]}`
    lignes.push({ piece: 'avatar', nom: f === 'auto' ? auto : NOM_FINITION[f], detail: 'Finition' })
  }
  if (essai.sceau !== undefined) lignes.push({ piece: 'avatar', nom: essai.sceau ? 'Montré' : 'Masqué', detail: 'Sceau' })
  if (essai.bordure !== undefined) {
    const b = essai.bordure
    lignes.push({
      piece: 'avatar',
      nom: b === 'auto' ? 'La plus haute, d’office' : b === AUCUNE_BORDURE ? 'Sans bordure' : NOM_DE_LA_BORDURE[b],
      detail: 'Bordure',
    })
  }
  if (essai.motif !== undefined) lignes.push({ piece: 'avatar', nom: essai.motif ? (motif(essai.motif)?.nom ?? essai.motif) : 'Accordée à l’avatar', detail: 'Motif' })
  if (essai.titre !== undefined) {
    const t = nomDuTitre(essai.titre)
    lignes.push({ piece: 'titre', nom: t ? `« ${t} »` : 'Sans titre', detail: 'Titre' })
  }
  if (essai.vitrine !== undefined) {
    const v = essai.vitrine
    // « Trophée », le mot de l'écran (règle `recompenses.md`) : la barre disait « 2 hauts faits choisis » sous une pièce
    // qui range « Mes trophées » (relevé au rendu, le 17 novembre 2026).
    lignes.push({ piece: 'vitrine', nom: v ? `${v.length} trophée${v.length > 1 ? 's' : ''} choisi${v.length > 1 ? 's' : ''}` : 'Les plus durs, d’office', detail: 'Vitrine' })
  }
  if (essai.fond !== undefined) lignes.push({ piece: 'fond', nom: fond(essai.fond)?.nom ?? 'Velours', detail: 'Fond de carte' })
  if (essai.theme !== undefined) {
    const t = theme(essai.theme ?? 'velours')
    lignes.push({ piece: 'theme', nom: t?.nom ?? 'Velours', detail: t ? `Thème · ${NOM_DE_RARETE[t.rarete]}` : 'Thème' })
  }
  // La plaque se choisit dans la pièce « Thème », sous son nom d'écran, « Mon podium » (le 24 novembre 2026) : sa ligne y mène.
  if (essai.plaque !== undefined) {
    const p = essai.plaque
    lignes.push({ piece: 'theme', nom: p === 'auto' ? 'Comme ton thème' : p === AUCUNE_PLAQUE ? 'Classique' : (theme(p)?.nom ?? 'Velours'), detail: 'Podium' })
  }
  if (essai.camp) {
    const c = THEMES.flatMap(t => t.camps ?? []).find(x => x.key === essai.camp)
    if (c) lignes.push({ piece: 'theme', nom: c.long, detail: 'Camp' })
  }
  if (essai.gerbe !== undefined) {
    lignes.push({ piece: 'gerbe', nom: essai.gerbe === AUCUNE_GERBE ? 'Aucune gerbe' : (gerbe(essai.gerbe)?.nom ?? 'Les confettis'), detail: 'Gerbe' })
  }
  return lignes
}

/**
 * Ce que la loge lit d'un profil pour dire ce qui est nouveau
 * (`ceQuIlAPorter`) : le détail de sa page le contient, et le compteur de
 * « Profil » (`GET /api/joueur/nouveautes`) ne lit que cela
 * (`ProfileStore.ceQueLaLogeLit`) — il refaisait toute la page pour une
 * pastille. Un champ de plus lu ici se donne aussi là-bas : le serveur
 * remplit chacun, même vide.
 */
export type CeQueLaLogeLit = Pick<
  PublicProfileDetail,
  'hautsFaits' | 'legendaires' | 'divins' | 'compagnons' | 'niveau' | 'ouvertes' | 'eclats' | 'bordures' | 'titresDates' | 'titresDuCabinet' | 'sentiers' | 'fonds' | 'gerbes'
> & {
  vitrine: readonly Pick<PublicProfileDetail['vitrine'][number], 'key'>[]
  boutique?: Pick<NonNullable<PublicProfileDetail['boutique']>, 'possedes'>
}

/**
 * Ce qu'il a, pièce par pièce, de quoi dire ce qui est nouveau : les avatars
 * (portraits, légendaires, Divins, emojis de collection), leurs finitions et
 * leurs Éclats ; ses titres ; les hauts faits de sa vitrine ; ses fonds, ses
 * thèmes, ses gerbes. Des clés, rien d'autre.
 */
export function ceQuIlAPorter(profil: CeQueLaLogeLit): Record<PieceDeLaLoge, string[]> {
  const recompenses = recompensesDe(profil.hautsFaits)
  const gagnes = hautsFaitsGagnes(recompenses)
  const etagere = new Set(profil.vitrine.map(b => b.key))
  const paliers = profil.sentiers ?? {}
  return {
    avatar: [
      ...portraitsOuverts(paliers),
      ...profil.legendaires,
      ...(profil.divins ?? []).map(d => d.key),
      // Chaque forme atteinte : un compagnon qui grandit, c'est du nouveau.
      ...formesOuvertes(profil.compagnons ?? []),
      ...COLLECTION.filter(c => profil.niveau >= c.niveau).map(c => c.emoji),
      ...profil.ouvertes.map(f => `finition:${f}`),
      ...profil.eclats.map(e => `eclat:${e}`),
      // Une ligue atteinte ouvre sa bordure ; au douzième cran, elle est sertie : deux nouveautés.
      ...(profil.bordures ?? []).flatMap(b => [`bordure:${b.ligue}`, ...(b.crans >= CRANS_D_UNE_BORDURE ? [`bordure:${b.ligue}:sertie`] : [])]),
    ],
    titre: [...maitresDe(paliers).map(cleDeMaitre), ...(profil.titresDates ?? []), ...(profil.titresDuCabinet ?? []), ...gagnes],
    // Ceux que « Ma vitrine » propose : gagnés, et rangés sur son étagère.
    vitrine: gagnes.filter(cle => {
      const rangee = cleRangee(cle, recompenses)
      return !!rangee && etagere.has(rangee)
    }),
    fond: profil.fonds ?? [],
    theme: profil.boutique?.possedes ?? [],
    gerbe: profil.gerbes ?? [],
  }
}

/**
 * Ce qui est nouveau depuis son dernier passage, pièce par pièce. Une pièce
 * jamais vue n'a rien de nouveau : la première visite ne crie pas « nouveau »
 * sur tout ce qu'il a.
 */
export function nouveautes(a: Record<PieceDeLaLoge, string[]>, vus: VusDeLaLoge): Record<PieceDeLaLoge, string[]> {
  const n = {} as Record<PieceDeLaLoge, string[]>
  for (const { id } of PIECES_DE_LA_LOGE) {
    const deja = vus[id]
    n[id] = deja ? a[id].filter(k => !deja.includes(k)) : []
  }
  return n
}

/**
 * Ce que le serveur retient après un passage : chaque pièce jamais vue,
 * telle qu'elle est — la prochaine nouveauté s'y verra —, et la pièce
 * regardée, à jour.
 */
export function retenirLesVus(a: Record<PieceDeLaLoge, string[]>, vus: VusDeLaLoge, regardee: PieceDeLaLoge | null): VusDeLaLoge {
  const suivant: VusDeLaLoge = { ...vus }
  for (const { id } of PIECES_DE_LA_LOGE) if (!suivant[id] || id === regardee) suivant[id] = a[id]
  return suivant
}

/**
 * Les avatars que la loge marque neufs, parmi les nouveautés de la pièce
 * « Avatar » : celui qui vient d'arriver, et celui qui vient d'éclater
 * (`eclat:🐸`) — l'Éclat se comptait en rouge sur « Profil » et sur
 * « M'habiller », et rien dans la loge ne disait où il était tombé. Celui
 * d'un compagnon brille sur toutes ses formes (`clesQuiBrillent`) : chacune
 * est neuve.
 */
export function avatarsNeufs(neufs: Iterable<string> = []): (cle: string) => boolean {
  const cles = new Set(neufs)
  const eclats = [...cles].filter(k => k.startsWith('eclat:')).map(k => k.slice('eclat:'.length))
  return cle => cles.has(cle) || clesQuiBrillent(eclats, cle).length > 0
}

/** Une bordure de ligue neuve : sa ligue vient d'être atteinte, ou elle vient d'être sertie, à son douzième cran. */
export function bordureNeuve(ligue: string, neufs: ReadonlySet<string> = new Set()): boolean {
  return neufs.has(`bordure:${ligue}`) || neufs.has(`bordure:${ligue}:sertie`)
}

// ── Les calques de la pièce « Avatar » ───────────────────────────────────
// La maquette du 26 novembre 2026 (`retours/2026-11-26/la-piece-avatar/`,
// « calques + tenues c'est le top », le propriétaire) : la pièce empilait un
// réglage par rangée, chacune montrant tout ce qu'il avait — vingt-deux
// motifs sur quatre lignes de pastilles chez une collectionneuse, et ses
// avatars à 192 px sous le menu. Un rail de calques les remplace, chacun son
// aperçu ; un seul calque ouvert, sa grille dessous.

/** Les calques de l'avatar, dans l'ordre du rail. */
export type CalqueDeLAvatar = 'avatar' | 'version' | 'finition' | 'bordure' | 'sceau'

/**
 * Ses calques : l'avatar, la finition et la bordure pour tous ; la version
 * dès son premier Éclat, le sceau dès son premier légendaire scellé. Ils ne
 * dépendent que de ce qu'il a, jamais de l'avatar essayé : le rail ne saute
 * pas sous le doigt — sur un avatar sans Éclat, la version s'éteint.
 */
export function calquesDe(profil: Pick<PublicProfileDetail, 'eclats'> & Partial<Pick<PublicProfileDetail, 'scelles'>>): CalqueDeLAvatar[] {
  return [
    'avatar',
    ...(profil.eclats.length > 0 ? (['version'] as const) : []),
    'finition',
    'bordure',
    ...((profil.scelles ?? []).length > 0 ? (['sceau'] as const) : []),
  ]
}

/** Le calque d'une pièce de l'essai : où l'on règle ce qu'il change. */
export function calqueDeLEssai(essai: Essai): CalqueDeLAvatar | null {
  if (essai.eclat) return 'version'
  if (essai.finition !== undefined) return 'finition'
  if (essai.bordure !== undefined || essai.motif !== undefined) return 'bordure'
  if (essai.sceau !== undefined) return 'sceau'
  if (essai.avatar !== undefined || essai.legendaire !== undefined) return 'avatar'
  return null
}

/**
 * Les calques qui ont du neuf, parmi les nouveautés de la pièce : une
 * finition, une bordure ouverte ou sertie ; le reste — un avatar, un Éclat —
 * se trouve dans la grille des avatars. Le rouge se suit jusqu'à sa case.
 */
export function calquesNeufs(neufs: Iterable<string> = []): Set<CalqueDeLAvatar> {
  const n = new Set<CalqueDeLAvatar>()
  for (const k of neufs) n.add(k.startsWith('finition:') ? 'finition' : k.startsWith('bordure:') ? 'bordure' : 'avatar')
  return n
}

/**
 * Le calque où la pièce s'ouvre : celui qu'un lien « Essayer » demande (un
 * motif ouvre « Bordure »), sinon le premier qui a du neuf, sinon « Avatar » —
 * on vient surtout changer d'avatar.
 */
export function calqueDOuverture(essai: Essai, neufs: Iterable<string>, calques: readonly CalqueDeLAvatar[]): CalqueDeLAvatar {
  const demande = calqueDeLEssai(essai)
  if (demande && calques.includes(demande)) return demande
  const n = calquesNeufs(neufs)
  return calques.find(c => n.has(c)) ?? 'avatar'
}

// ── Les tenues ───────────────────────────────────────────────────────────
// Le look, pas le palmarès (`shared/tenues.ts`) : ce qu'une tenue garde, ce
// qu'elle remet à l'essai, et son nom d'office.

/** Ce qu'il porte, gardé en tenue : l'avatar et ses calques, et le fond de sa carte. */
export function lookPorte(p: Tenue & Pick<PublicProfileDetail, 'eclats'>): LookDUneTenue {
  const montre = { avatar: p.avatar, legendaire: p.legendaire ?? null }
  const cle = cibleDeLEclat(montre, p.eclats)
  const version = cle && p.eclats.includes(cle) ? eclatChez({ eclats: p.eclats, eclatsEteints: p.eclatsEteints, matieres: p.matieres, matieresPortees: p.matieresPortees }, cle) : null
  return {
    avatar: p.avatar,
    legendaire: p.legendaire ?? null,
    finition: p.finitionChoisie,
    bordure: p.bordureChoisie ?? 'auto',
    motif: p.motifChoisi ?? null,
    sceau: !p.sceauMasque,
    fond: p.fond ?? null,
    eclat: cle && version !== null ? { cle, brille: version !== false, matiere: typeof version === 'string' ? version : null } : null,
  }
}

/** Le nom d'office d'une tenue : celui de son avatar (« Le Kraken »), sinon « Ma tenue ». */
export function nomDUneTenue(look: LookDUneTenue): string {
  const k = look.legendaire
  if (!k) return 'Ma tenue'
  const c = formeDeCompagnon(k)
  return legendaire(k)?.nom ?? divin(k)?.nom ?? portrait(k)?.nom ?? (c ? compagnonDe(c).nom : 'Ma tenue')
}

/**
 * L'essai qui remet une tenue : chaque pièce qu'il a encore — un légendaire
 * repris avec une soirée retirée, un motif qu'il n'a plus se taisent, et la
 * tenue se porte sans eux. Le serveur revérifie tout à « Porter »
 * (`PUT /api/joueur/moi`).
 */
export function essaiDeLaTenue(look: LookDUneTenue, profil: PublicProfileDetail): Essai {
  const a = ceQuIlAPorter(profil).avatar
  const piece: Essai = { sceau: look.sceau }
  if (look.legendaire) {
    if (a.includes(look.legendaire)) piece.legendaire = look.legendaire
  } else if ((AVATARS as readonly string[]).includes(look.avatar) || a.includes(look.avatar)) piece.avatar = look.avatar
  if (look.finition === 'auto' || (profil.ouvertes as readonly string[]).includes(look.finition)) piece.finition = look.finition as FinitionChoisie
  if (look.bordure === 'auto' || look.bordure === AUCUNE_BORDURE || (profil.bordures ?? []).some(b => b.ligue === look.bordure)) piece.bordure = look.bordure as ChoixDeBordure
  if (look.motif === null || (profil.motifs ?? []).includes(look.motif)) piece.motif = look.motif
  if (look.fond === null || (profil.fonds ?? []).includes(look.fond)) piece.fond = look.fond
  let essai = essayer({}, piece, profil)
  const e = look.eclat
  if (e && profil.eclats.includes(e.cle)) {
    const matiere = e.brille && e.matiere && estUneMatiere(e.matiere) && matiereOuverte(profil.matieres?.[e.cle] ?? [], e.matiere) ? e.matiere : null
    essai = essayer(essai, { eclat: { cle: e.cle, brille: e.brille, matiere } }, profil)
  }
  return essai
}
