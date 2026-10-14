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

import { COLLECTION } from './avatars'
import { brancheDe, portrait, portraitsOuverts } from './branches'
import { compagnonDe, formeDeCompagnon, formesOuvertes } from './compagnons'
import { vitrineDeLaCarte } from './carte'
import { divin } from './divins'
import { fond } from './fonds'
import { AUCUNE_GERBE, gerbe } from './gerbes'
import { cleRangee, hautsFaitsGagnes } from './hautsfaits'
import { cibleEclat, legendaire } from './legendaires'
import { NOM_FINITION, brilleChez, meilleureFinition, type FinitionChoisie, type PublicProfileDetail } from './profil'
import { recompensesDe } from './proches'
import { cleDeMaitre, maitresDe, nomDuTitre } from './sentiers'
import { NOM_DE_RARETE, theme } from './themes'
import { AUCUNE_BORDURE, CRANS_D_UNE_BORDURE, NOM_DE_LA_BORDURE, type ChoixDeBordure } from './duels'
import { PIECES_DE_LA_LOGE, type PieceDeLaLoge } from './piecesDeLaLoge'

// Les six pièces vivent à part, sans catalogue : la page du profil montre
// sa carte et sa rangée avant que ces règles n'arrivent.
export { PIECES_DE_LA_LOGE, estUnePieceDeLaLoge, type PieceDeLaLoge } from './piecesDeLaLoge'

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
  /** La version de l'avatar que la carte montre, s'il a éclaté pour lui : rare (`brille`) ou d'origine. */
  eclat?: { cle: string; brille: boolean }
  /** La bordure de ligue : `auto`, `aucune`, ou celle d'une ligue atteinte. */
  bordure?: ChoixDeBordure
}

/**
 * Ce qu'il porte, tel que sa page le reçoit — ses Éclats compris, et ceux
 * qu'il a éteints : la version qu'il montre de chacun.
 */
export type Tenue = Pick<PublicProfileDetail, 'avatar' | 'legendaire' | 'finitionChoisie' | 'titre' | 'vitrineChoisie' | 'fond' | 'theme' | 'gerbe' | 'bordureChoisie'> &
  Partial<Pick<PublicProfileDetail, 'eclats' | 'eclatsEteints'>>

/** L'avatar que la carte montre : l'emoji essayé ôte le légendaire, comme au serveur. */
export function avatarMontre(porte: Pick<Tenue, 'avatar' | 'legendaire'>, essai: Essai): { avatar: string; legendaire: string | null } {
  if (essai.avatar !== undefined) return { avatar: essai.avatar, legendaire: null }
  return { avatar: porte.avatar, legendaire: essai.legendaire !== undefined ? essai.legendaire : (porte.legendaire ?? null) }
}

/**
 * Ce qui peut avoir éclaté dans l'avatar montré : le légendaire ou le
 * portrait, sinon l'emoji (`cibleEclat`) — rien sous un Divin, qui n'éclate
 * pas et cache l'emoji, ni sous un compagnon : son Éclat n'a pas encore de
 * version rare à choisir, ses paillettes l'annoncent.
 */
export function cibleDeLEclat(montre: { avatar: string; legendaire: string | null }): string | null {
  return divin(montre.legendaire) || formeDeCompagnon(montre.legendaire) ? null : cibleEclat(montre.legendaire, montre.avatar)
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
  if (suivant.titre !== undefined && suivant.titre === (porte.titre ?? null)) delete suivant.titre
  if (suivant.vitrine !== undefined && memeVitrine(suivant.vitrine, porte.vitrineChoisie ?? null)) delete suivant.vitrine
  if (suivant.fond !== undefined && suivant.fond === (porte.fond ?? null)) delete suivant.fond
  if (suivant.theme !== undefined && suivant.theme === (porte.theme === 'velours' ? null : (porte.theme ?? null))) delete suivant.theme
  // La gerbe portée se lit déjà résolue : null, il n'en veut aucune.
  if (suivant.gerbe !== undefined && (suivant.gerbe === AUCUNE_GERBE ? null : suivant.gerbe) === (porte.gerbe ?? null)) delete suivant.gerbe
  // La version d'un avatar éclaté suit l'avatar montré : en essayer un autre
  // la laisse — « Porter » aurait réglé un avatar qu'on ne voit plus. Celle
  // qu'il montre déjà sort de l'essai.
  if (suivant.eclat) {
    const { cle, brille } = suivant.eclat
    if (cle !== cibleDeLEclat(avatarMontre(porte, suivant))) delete suivant.eclat
    else if (porte.eclats && brille === brilleChez({ eclats: porte.eclats, eclatsEteints: porte.eclatsEteints }, cle)) delete suivant.eclat
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
    vu.finition = essai.finition === 'auto' ? meilleureFinition(profil.niveau) : essai.finition
  }
  if (essai.bordure !== undefined) vu.bordureChoisie = essai.bordure
  if (essai.titre !== undefined) vu.titre = essai.titre
  if (essai.vitrine !== undefined) vu.vitrineChoisie = essai.vitrine
  if (essai.fond !== undefined) vu.fond = essai.fond
  if (essai.theme !== undefined) vu.theme = essai.theme
  if (essai.gerbe !== undefined) vu.gerbe = essai.gerbe === AUCUNE_GERBE ? null : essai.gerbe
  if (essai.eclat) {
    const eteints = new Set(profil.eclatsEteints ?? [])
    if (essai.eclat.brille) eteints.delete(essai.eclat.cle)
    else eteints.add(essai.eclat.cle)
    vu.eclatsEteints = [...eteints]
  }
  return vu
}

/** Les hauts faits que sa carte montrerait : ceux qu'il a choisis, sinon les plus durs (`vitrineDeLaCarte`). */
export function vitrineVue(profil: Pick<PublicProfileDetail, 'vitrine' | 'vitrineChoisie' | 'hautsFaits'>) {
  return vitrineDeLaCarte(profil.vitrine, profil.vitrineChoisie ?? null, recompensesDe(profil.hautsFaits))
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
export function lignesDeLEssai(essai: Essai, profil: Pick<PublicProfileDetail, 'niveau'>): LigneDEssai[] {
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
  if (essai.eclat) lignes.push({ piece: 'avatar', nom: essai.eclat.brille ? 'Version rare' : 'Version d’origine', detail: 'Éclat' })
  if (essai.finition !== undefined) {
    const f = essai.finition
    lignes.push({ piece: 'avatar', nom: f === 'auto' ? `La plus belle · ${NOM_FINITION[meilleureFinition(profil.niveau)]}` : NOM_FINITION[f], detail: 'Finition' })
  }
  if (essai.bordure !== undefined) {
    const b = essai.bordure
    lignes.push({
      piece: 'avatar',
      nom: b === 'auto' ? 'La plus haute, d’office' : b === AUCUNE_BORDURE ? 'Sans bordure' : NOM_DE_LA_BORDURE[b],
      detail: 'Bordure',
    })
  }
  if (essai.titre !== undefined) {
    const t = nomDuTitre(essai.titre)
    lignes.push({ piece: 'titre', nom: t ? `« ${t} »` : 'Sans titre', detail: 'Titre' })
  }
  if (essai.vitrine !== undefined) {
    const v = essai.vitrine
    lignes.push({ piece: 'vitrine', nom: v ? `${v.length} haut${v.length > 1 ? 's' : ''} fait${v.length > 1 ? 's' : ''} choisi${v.length > 1 ? 's' : ''}` : 'Les plus durs, d’office', detail: 'Vitrine' })
  }
  if (essai.fond !== undefined) lignes.push({ piece: 'fond', nom: fond(essai.fond)?.nom ?? 'Velours', detail: 'Fond de carte' })
  if (essai.theme !== undefined) {
    const t = theme(essai.theme ?? 'velours')
    lignes.push({ piece: 'theme', nom: t?.nom ?? 'Velours', detail: t ? `Thème · ${NOM_DE_RARETE[t.rarete]}` : 'Thème' })
  }
  if (essai.gerbe !== undefined) {
    lignes.push({ piece: 'gerbe', nom: essai.gerbe === AUCUNE_GERBE ? 'Aucune gerbe' : (gerbe(essai.gerbe)?.nom ?? 'Les confettis'), detail: 'Gerbe' })
  }
  return lignes
}

/**
 * Ce qu'il a, pièce par pièce, de quoi dire ce qui est nouveau : les avatars
 * (portraits, légendaires, Divins, emojis de collection), leurs finitions et
 * leurs Éclats ; ses titres ; les hauts faits de sa vitrine ; ses fonds, ses
 * thèmes, ses gerbes. Des clés, rien d'autre.
 */
export function ceQuIlAPorter(profil: PublicProfileDetail): Record<PieceDeLaLoge, string[]> {
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
    titre: [...maitresDe(paliers).map(cleDeMaitre), ...(profil.titresDates ?? []), ...gagnes],
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

/** Ce que ce téléphone a déjà vu de chaque pièce (`quizz.loge.vus.<profil>`). */
export type VusDeLaLoge = Partial<Record<PieceDeLaLoge, readonly string[]>>

/**
 * Ce qui est nouveau depuis son dernier passage, pièce par pièce. Une pièce
 * jamais vue sur ce téléphone n'a rien de nouveau : la première visite ne
 * crie pas « nouveau » sur tout ce qu'il a.
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
 * Ce que ce téléphone retient après un passage : chaque pièce jamais vue,
 * telle qu'elle est — la prochaine nouveauté s'y verra —, et la pièce
 * regardée, à jour.
 */
export function retenirLesVus(a: Record<PieceDeLaLoge, string[]>, vus: VusDeLaLoge, regardee: PieceDeLaLoge | null): VusDeLaLoge {
  const suivant: VusDeLaLoge = { ...vus }
  for (const { id } of PIECES_DE_LA_LOGE) if (!suivant[id] || id === regardee) suivant[id] = a[id]
  return suivant
}
