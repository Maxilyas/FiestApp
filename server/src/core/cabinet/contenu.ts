// Le contenu neuf du Cabinet de curiosités, ce que la base de la campagne n'a
// pas : les lieux datés de l'Épingle, les fiches « Qui suis-je ? » des
// Indices, les répliques, les frises à thème (`server/content/cabinet/`, une
// entrée par ligne). Écrit et relu par des agents, chaque entrée porte sa
// réponse : le dossier vit hors de `client/public`, et rien n'en part avant le
// verdict de sa manche (invariant 1).
//
// Ici, ses juges et sa lecture. Un juge par sorte, une seule fois écrit — le
// serveur l'applique au chargement, `server/scripts/cabinet-contenu.ts` à
// chaque lot avant de le ranger, `cabinet-contenu.test.ts` au contenu livré :
// deux copies de ces règles finiraient par dire deux choses. Leurs bornes
// chiffrées sont des choix de produit, avec les autres chiffres du Cabinet
// (`shared/cabinet/bareme.ts`) ; la forme des entrées, `shared/cabinet/contenu.ts`.
//
// Chaque fichier se lit une fois par processus, paresseusement (le gabarit de
// `core/frises.ts`) : une entrée qui ne se pose pas, ou qui en redit une
// autre, s'écarte avec son motif au journal, plutôt que d'arriver sur un
// téléphone.

import fs from 'node:fs'
import path from 'node:path'
import { SERVEUR } from '../../racine'
import { CATEGORIES } from '../../../../shared/categories'
import { refusDuLibelle } from '../../../../shared/frise'
import { dansLaFrance, distanceKm } from '../../../../shared/cabinet/france'
import {
  AUTRES_D_UNE_REPLIQUE,
  CLES_MAX,
  ECART_DES_ANNEES_DE_LA_FRISE,
  EVENEMENTS_D_UNE_FRISE_A_THEME,
  INDICES_D_UNE_FICHE,
  INDICE_MAX,
  LEURRES_D_UNE_REPLIQUE,
  LIEUX_VOISINS_KM,
  MOTS_D_UNE_IDENTITE_MAX,
  MOTS_D_UNE_REPLIQUE_MAX,
  QUESTION_MAX,
  RECIT_MAX,
  SAVAIS_MAX,
} from '../../../../shared/cabinet/bareme'
import { FORME_D_UN_IDENTIFIANT, FORME_D_UNE_CLE, type Fiche, type FriseATheme, type Lieu, type Replique } from '../../../../shared/cabinet/contenu'
import { bonneIdentite, motsDe, motsUtiles, proches } from '../../../../shared/cabinet/jeux/indices'

export const DOSSIER_DU_CONTENU = path.join(SERVEUR, 'content/cabinet')

/** Le contenu neuf, sorte par sorte : chaque entrée jugée, aucune deux fois. */
export interface ContenuDuCabinet {
  lieux: readonly Lieu[]
  fiches: readonly Fiche[]
  repliques: readonly Replique[]
  frises: readonly FriseATheme[]
}

export type SorteDuContenu = keyof ContenuDuCabinet
export type EntreeDuContenu<S extends SorteDuContenu> = ContenuDuCabinet[S][number]

export const SORTES_DU_CONTENU: readonly SorteDuContenu[] = ['lieux', 'fiches', 'repliques', 'frises']

// ── Ce qu'un texte peut être ────────────────────────────────────────────────

/**
 * Un emoji, quel que soit son âge : un pictogramme, mais aussi un drapeau
 * (deux indicateurs régionaux) et une touche chiffrée (« 1️⃣ », un chiffre et
 * son cadre) — ni l'un ni l'autre n'est un pictogramme pour Unicode, et
 * `emojis.test.ts`, qui ne garde que l'âge, laisse passer les drapeaux.
 */
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u{20E3}/u
/** Un « Où … ? » : l'Épingle demande où, la carte de France répond. */
const DEMANDE_OU = /^Où .+ \?$/
/** Un seul mot : des lettres, une apostrophe ou un trait d'union entre elles (« sûr », « chef-d'œuvre »). */
const UN_MOT = /^\p{L}+(?:['’-]\p{L}+)*$/u
const ARTICLES = new Set(['le', 'la', 'les', 'l'])

/** Un texte d'une ligne, sans blanc au bord ni double espace, ni emoji ; null : il se pose. */
function refusDuTexte(quoi: string, brut: unknown, max?: number): string | null {
  if (typeof brut !== 'string' || brut.trim() === '') return `${quoi} : un texte, s'il te plaît`
  if (brut !== brut.trim() || /\s\s|\n/.test(brut)) return `${quoi} : sur une ligne, sans blanc au bord ni double espace`
  // L'écran commun tourne sous Windows 10, et le contenu n'en a pas besoin : pas un emoji, quel que soit son âge.
  if (EMOJI.test(brut)) return `${quoi} : pas d'emoji`
  if (max !== undefined && brut.length > max) return `${quoi} : ${brut.length} signes, pour ${max} au plus`
  return null
}

/**
 * Ce nom est-il écrit dans ces mots — ceux d'un texte, lus par la règle des
 * Indices (`motsDe`, `shared/cabinet/jeux/indices.ts` : sans accents, sans
 * capitales, ses lettres à part ouvertes, « l'île d'Aix » donne l, ile, d,
 * aix) —, en mots entiers, son article de tête mis à part ? « Le Havre » se lit
 * dans « le centre du Havre ». Les mots se lisent une fois pour tous les noms
 * qu'on y cherche : le crible des QCM du Cabinet y cherche quatre réponses par
 * question, sur toute la base (`estUnQcmDuCabinet`), et redécoupait l'intitulé
 * à chacune.
 */
export function ecritDansLesMots(mots: readonly string[], nom: string): boolean {
  let cherche = motsDe(nom)
  while (cherche.length > 1 && ARTICLES.has(cherche[0])) cherche = cherche.slice(1)
  if (cherche.length === 0) return false
  for (let i = 0; i + cherche.length <= mots.length; i++) if (cherche.every((m, k) => mots[i + k] === m)) return true
  return false
}

/**
 * Ce nom est-il écrit dans ce texte (`ecritDansLesMots`) ? Le juge de la base
 * (`nomEcritDans`, `core/baseCampagne.ts`) garde la capitale d'un nom propre ;
 * ici, un récit qui écrirait « beaune » sans elle dirait la réponse tout autant.
 * Les mots se lisent comme la saisie des Indices les lit : ce que la saisie
 * prendrait pour la réponse, le juge le voit écrit — « Walesa » dans un indice
 * de la fiche « Wałęsa ».
 */
export const ecritDans = (texte: string, nom: string): boolean => ecritDansLesMots(motsDe(texte), nom)

/** La même chose dite deux fois : ses mots, sans accents, capitales ni ponctuation — « Wałęsa » et « Walesa » sont la même personne. */
const empreinte = (texte: string) => motsDe(texte).join(' ')

/** Un objet qui a ces champs et aucun autre : un champ mal nommé se perdrait sans bruit, un champ de trop voyagerait. */
function refusDesChamps(brut: unknown, champs: readonly string[]): string | null {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return 'pas une entrée : un objet, s’il te plaît'
  const manquent = champs.filter(c => !(c in brut))
  if (manquent.length > 0) return `il manque ${manquent.join(', ')}`
  const enTrop = Object.keys(brut).filter(c => !champs.includes(c))
  if (enTrop.length > 0) return `${enTrop.join(', ')} : un champ que le format n'a pas`
  return null
}

function refusDeLIdentifiant(id: unknown): string | null {
  return typeof id === 'string' && FORME_D_UN_IDENTIFIANT.test(id) ? null : 'son identifiant : des minuscules, des chiffres et des tirets — le code pose « cab: » devant'
}

function refusDeLaCategorie(categorie: unknown): string | null {
  return (CATEGORIES as readonly unknown[]).includes(categorie) ? null : `sa catégorie : l'une de ${CATEGORIES.join(', ')}`
}

/** Le premier refus d'une suite de règles, dans l'ordre où elles s'écrivent. */
const premier = (...regles: (() => string | null)[]) => {
  for (const r of regles) {
    const refus = r()
    if (refus) return refus
  }
  return null
}

// ── Les juges ───────────────────────────────────────────────────────────────

const CHAMPS_DU_LIEU = ['id', 'theme', 'nom', 'commune', 'departement', 'lat', 'lon', 'annee', 'date', 'recit', 'question', 'savais', 'categorie'] as const

/**
 * Pourquoi ce lieu ne se pose pas — null : il se pose. Dans le cadre de la
 * France métropolitaine et de la Corse (la décision du propriétaire, le
 * 24 octobre 2026), à sa précision — jamais une coordonnée ronde : Noyon
 * s'écrivait « 3 » de longitude (2,999), un nombre que la vue d'une manche
 * porte d'elle-même — son rang, ses compteurs —, et l'épreuve du secret, qui
 * cherche les coordonnées du lieu parmi tous les nombres d'une réponse, l'y
 * voyait fuir une partie sur quatre-vingt-dix ; un lieu rond, elle ne le
 * verrait plus fuir pour de bon (`cabinet-secret.test.ts`). Sa commune et son
 * département nommés, et jamais dans ce que la manche montre avant son
 * verdict — le thème, la date, le récit, la question —, puisqu'ils sont la
 * réponse. Le nom du lieu, lui, peut s'y dire : « Où se trouve la place
 * Stanislas ? » demande de savoir où est Nancy.
 */
export function refusDuLieu(brut: unknown): string | null {
  const champs = refusDesChamps(brut, CHAMPS_DU_LIEU)
  if (champs) return champs
  const l = brut as Record<(typeof CHAMPS_DU_LIEU)[number], unknown>
  return premier(
    () => refusDeLIdentifiant(l.id),
    () => refusDuTexte('son thème', l.theme),
    () => refusDuTexte('son nom', l.nom),
    () => refusDuTexte('sa commune', l.commune),
    () => refusDuTexte('son département', l.departement),
    () => (typeof l.lat === 'number' && typeof l.lon === 'number' && dansLaFrance({ lat: l.lat, lon: l.lon }) ? null : 'ses coordonnées : des nombres, en France métropolitaine ou en Corse'),
    () =>
      Number.isInteger(l.lat) || Number.isInteger(l.lon)
        ? 'ses coordonnées : jamais rondes, au millième de degré (2.999, pas 3) — un nombre rond se confond avec un compteur de la vue'
        : null,
    () => (Number.isInteger(l.annee) ? null : 'son année : un nombre entier (« 52 av. J.-C. » vaut −52)'),
    () => refusDuTexte('sa date', l.date),
    () => refusDuTexte('son récit', l.recit, RECIT_MAX),
    () => refusDuTexte('sa question', l.question, QUESTION_MAX),
    () => (DEMANDE_OU.test(l.question as string) ? null : 'sa question demande où : « Où … ? »'),
    () => refusDuTexte('son « Le savais-tu ? »', l.savais, SAVAIS_MAX),
    () => refusDeLaCategorie(l.categorie),
    () => {
      for (const [quoi, texte] of [['son thème', l.theme], ['sa date', l.date], ['son récit', l.recit], ['sa question', l.question]] as const) {
        for (const nom of [l.commune, l.departement] as string[]) {
          if (ecritDans(texte as string, nom)) return `${quoi} dit « ${nom} » : la manche le montre avant son verdict, ce serait la réponse`
        }
      }
      return null
    },
  )
}

const CHAMPS_DE_LA_FICHE = ['id', 'reponse', 'cles', 'indices', 'savais', 'categorie'] as const

/**
 * Pourquoi cette fiche ne se pose pas — null : elle se pose. Cinq indices
 * courts, du plus obscur au plus évident ; des clés en minuscules sans accents,
 * de trois lettres au moins (`arc` en est une). Une saisie ne trouve la
 * personne que si elle tient une clé — sans quoi « un roi » trouverait tout le
 * monde. Ce qu'elle doit être pour trouver — ses mots comptés, la faute de
 * frappe tolérée, les petits mots qu'elle laisse — est la règle du jeu des
 * Indices (`bonneIdentite`, `shared/cabinet/jeux/indices.ts`), et ce juge
 * passe par elle, sans la recopier : la réponse tapée en entier trouve la
 * personne, chaque clé tapée seule aussi — « des », un petit mot que la saisie
 * écarte, ne trouverait rien —, et aucun indice n'écrit la réponse, ni un mot
 * qu'une saisie prendrait pour une clé : « Césars », à une faute de `cesar`,
 * la soufflerait.
 */
export function refusDeLaFiche(brut: unknown): string | null {
  const champs = refusDesChamps(brut, CHAMPS_DE_LA_FICHE)
  if (champs) return champs
  const f = brut as Record<(typeof CHAMPS_DE_LA_FICHE)[number], unknown>
  return premier(
    () => refusDeLIdentifiant(f.id),
    () => refusDuTexte('sa réponse', f.reponse),
    () => {
      const cles = f.cles
      if (!Array.isArray(cles) || cles.length < 1 || cles.length > CLES_MAX) return `ses clés : de une à ${CLES_MAX}`
      if (!cles.every(c => typeof c === 'string' && FORME_D_UNE_CLE.test(c))) return 'ses clés : des minuscules sans accents, trois lettres au moins'
      if (new Set(cles).size !== cles.length) return 'ses clés : chacune une fois'
      const fiche = { reponse: f.reponse as string, cles: cles as string[] }
      // Tapée seule, une clé doit trouver la personne : un petit mot (« des », « les »), la saisie l'écarte.
      const muette = fiche.cles.find(c => !bonneIdentite(c, fiche))
      if (muette !== undefined) return `ses clés : « ${muette} » ne désigne personne — un petit mot, que la saisie écarte`
      const mots = motsUtiles(fiche.reponse).length
      if (mots > MOTS_D_UNE_IDENTITE_MAX) return `sa réponse : ${mots} mots, pour ${MOTS_D_UNE_IDENTITE_MAX} au plus — tapée en entier, elle ne trouverait personne`
      return bonneIdentite(fiche.reponse, fiche) ? null : 'ses clés : une au moins se lit dans la réponse, sinon la réponse tapée en entier ne trouverait personne'
    },
    () => {
      const indices = f.indices
      if (!Array.isArray(indices) || indices.length !== INDICES_D_UNE_FICHE) return `ses indices : ${INDICES_D_UNE_FICHE}, du plus obscur au plus évident`
      for (const [k, indice] of indices.entries()) {
        const refus = refusDuTexte(`son indice ${k + 1}`, indice, INDICE_MAX)
        if (refus) return refus
        for (const dit of [f.reponse as string, ...(f.cles as string[])]) {
          if (ecritDans(indice as string, dit)) return `son indice ${k + 1} dit « ${dit} » : il donnerait la réponse`
        }
        // Lu comme une saisie le lirait : un mot à une faute d'une clé, tapé, trouverait la personne.
        for (const mot of motsUtiles(indice as string)) {
          const cle = (f.cles as string[]).find(c => proches(mot, c))
          if (cle !== undefined) return `son indice ${k + 1} dit « ${mot} », à une faute de la clé « ${cle} » : tapé, il trouverait la personne`
        }
      }
      return null
    },
    () => refusDuTexte('son « Le savais-tu ? »', f.savais, SAVAIS_MAX),
    () => refusDeLaCategorie(f.categorie),
  )
}

const CHAMPS_DE_LA_REPLIQUE = ['id', 'avant', 'mot', 'apres', 'leurres', 'qui', 'autres', 'source', 'savais', 'categorie'] as const

/** Des propositions qui ne se confondent pas, ni entre elles ni avec la bonne : sans accents ni capitales, « Pays » et « pays » ne font qu'une. */
const toutesDistinctes = (propositions: readonly string[]) => new Set(propositions.map(empreinte)).size === propositions.length

/**
 * Pourquoi cette réplique ne se pose pas — null : elle se pose. Un seul mot
 * qui manque, trois leurres d'un mot qui ne se confondent pas avec lui, la
 * personne qui l'a dite et deux autres, distinctes ; la réplique entière tient
 * en quinze mots — elle se lit d'un coup, chrono en marche. Le trou se pose
 * entre `avant` et `apres` : `avant` finit sans blanc — la page met une espace
 * avant le mot, sauf après une apostrophe (`'Vers l’'`, `'infini'`) —, et
 * `apres` porte le sien quand il en faut un (`' et Paris.'`, `' !'`) ou
 * commence par ce qui se soude au mot (`','`, `'-moi !'`).
 */
export function refusDeLaReplique(brut: unknown): string | null {
  const champs = refusDesChamps(brut, CHAMPS_DE_LA_REPLIQUE)
  if (champs) return champs
  const r = brut as Record<(typeof CHAMPS_DE_LA_REPLIQUE)[number], unknown>
  return premier(
    () => refusDeLIdentifiant(r.id),
    () => refusDuTexte('ce qui précède le mot', r.avant),
    () => refusDuTexte('le mot qui manque', r.mot),
    () => (UN_MOT.test(r.mot as string) ? null : 'le mot qui manque : un seul mot'),
    () => {
      const apres = r.apres
      if (typeof apres !== 'string' || apres === '' || apres !== apres.trimEnd() || /\s\s|\n/.test(apres)) return 'ce qui suit le mot : sur une ligne, sans blanc au bout ni double espace'
      if (EMOJI.test(apres)) return "ce qui suit le mot : pas d'emoji"
      return /^[\p{L}\p{N}]/u.test(apres) ? 'ce qui suit le mot : un blanc d’abord, ou ce qui colle au mot (« , », « -moi ») — sinon le mot s’y soude' : null
    },
    () => {
      const leurres = r.leurres
      if (!Array.isArray(leurres) || leurres.length !== LEURRES_D_UNE_REPLIQUE) return `ses leurres : ${LEURRES_D_UNE_REPLIQUE}`
      for (const leurre of leurres) {
        const refus = refusDuTexte('un leurre', leurre)
        if (refus) return refus
        if (!UN_MOT.test(leurre)) return `un leurre, « ${leurre} » : un seul mot, comme celui qui manque`
      }
      return toutesDistinctes([r.mot as string, ...leurres]) ? null : 'ses leurres : distincts entre eux et du mot qui manque'
    },
    () => refusDuTexte('qui l’a dite', r.qui),
    () => {
      const autres = r.autres
      if (!Array.isArray(autres) || autres.length !== AUTRES_D_UNE_REPLIQUE) return `les autres personnes : ${AUTRES_D_UNE_REPLIQUE}`
      for (const autre of autres) {
        const refus = refusDuTexte('une autre personne', autre)
        if (refus) return refus
      }
      return toutesDistinctes([r.qui as string, ...autres]) ? null : 'les autres personnes : distinctes entre elles et de qui l’a dite'
    },
    () => {
      const mots = `${r.avant} ${r.mot}${r.apres}`.split(/\s+/).filter(m => /\p{L}/u.test(m)).length
      return mots > MOTS_D_UNE_REPLIQUE_MAX ? `la réplique : ${mots} mots, pour ${MOTS_D_UNE_REPLIQUE_MAX} au plus` : null
    },
    () => refusDuTexte('sa source', r.source),
    () => refusDuTexte('son « Le savais-tu ? »', r.savais, SAVAIS_MAX),
    () => refusDeLaCategorie(r.categorie),
  )
}

const CHAMPS_DE_LA_FRISE = ['id', 'theme', 'evenements', 'savais', 'categorie'] as const
const CHAMPS_D_UN_EVENEMENT = ['libelle', 'annee'] as const

/**
 * Pourquoi cette frise à thème ne se pose pas — null : elle se pose. Autant
 * d'événements que ses trois vagues en posent, chacun une ligne qui ne dit
 * jamais quand (`refusDuLibelle`, la règle des frises de l'Expédition), leurs
 * années entières, distinctes et à trois ans d'écart au moins — deux années
 * trop proches se rangeraient au hasard.
 */
export function refusDeLaFriseATheme(brut: unknown): string | null {
  const champs = refusDesChamps(brut, CHAMPS_DE_LA_FRISE)
  if (champs) return champs
  const f = brut as Record<(typeof CHAMPS_DE_LA_FRISE)[number], unknown>
  return premier(
    () => refusDeLIdentifiant(f.id),
    () => refusDuTexte('son thème', f.theme),
    () => {
      const evenements = f.evenements
      if (!Array.isArray(evenements) || evenements.length !== EVENEMENTS_D_UNE_FRISE_A_THEME) return `ses événements : ${EVENEMENTS_D_UNE_FRISE_A_THEME}`
      for (const [k, e] of evenements.entries()) {
        const refus = refusDesChamps(e, CHAMPS_D_UN_EVENEMENT)
        if (refus) return `son événement ${k + 1} : ${refus}`
        const libelle = refusDuLibelle(e.libelle)
        if (libelle) return `son événement ${k + 1}, « ${e.libelle} » : ${libelle}`
        if (EMOJI.test(e.libelle)) return `son événement ${k + 1} : pas d'emoji`
        if (!Number.isInteger(e.annee)) return `son événement ${k + 1} : une année entière`
      }
      if (!toutesDistinctes(evenements.map(e => e.libelle as string))) return 'ses événements : chacun une fois'
      const annees = evenements.map(e => e.annee as number).sort((a, b) => a - b)
      for (let i = 1; i < annees.length; i++) {
        if (annees[i] - annees[i - 1] < ECART_DES_ANNEES_DE_LA_FRISE) return `ses années : ${ECART_DES_ANNEES_DE_LA_FRISE} ans d'écart au moins, ${annees[i - 1]} et ${annees[i]} sont trop proches`
      }
      return null
    },
    () => refusDuTexte('son « Le savais-tu ? »', f.savais, SAVAIS_MAX),
    () => refusDeLaCategorie(f.categorie),
  )
}

// ── Les sortes, et ce qui fait deux fois la même entrée ─────────────────────

/** Une sorte du contenu : son fichier, son juge, et ce qui la fait se répéter. */
export interface SorteDeContenu<T> {
  /** Son fichier, dans `server/content/cabinet/`. */
  fichier: string
  /** Comment le journal et le script nomment l'une de ses entrées. */
  nom: string
  /** Ses champs, dans l'ordre où le fichier les écrit. */
  champs: readonly string[]
  refus(brut: unknown): string | null
  /** Ce qui ne se redit pas : deux entrées qui partagent une de ces clés sont la même — l'identifiant, la personne, la citation, le thème. */
  memes(e: T): readonly { quoi: string; cle: string }[]
  /** Deux entrées trop proches pour aller ensemble sans partager de clé ; le motif, ou null. */
  voisines?(a: T, b: T): string | null
}

const sonIdentifiant = (e: { id: string }) => ({ quoi: 'le même identifiant', cle: e.id })

export const SORTES: { readonly [S in SorteDuContenu]: SorteDeContenu<EntreeDuContenu<S>> } = {
  lieux: {
    fichier: 'lieux.json',
    nom: 'lieu',
    champs: CHAMPS_DU_LIEU,
    refus: refusDuLieu,
    memes: l => [sonIdentifiant(l)],
    voisines: (a, b) => {
      const km = distanceKm(a, b)
      return km < LIEUX_VOISINS_KM ? `à ${km.toFixed(1).replace('.', ',')} km` : null
    },
  },
  fiches: {
    fichier: 'indices.json',
    nom: 'fiche',
    champs: CHAMPS_DE_LA_FICHE,
    refus: refusDeLaFiche,
    memes: f => [sonIdentifiant(f), { quoi: 'la même personne', cle: empreinte(f.reponse) }],
  },
  repliques: {
    fichier: 'repliques.json',
    nom: 'réplique',
    champs: CHAMPS_DE_LA_REPLIQUE,
    refus: refusDeLaReplique,
    memes: r => [sonIdentifiant(r), { quoi: 'la même citation', cle: empreinte(`${r.avant} ${r.mot}${r.apres}`) }],
  },
  frises: {
    fichier: 'frises.json',
    nom: 'frise',
    champs: CHAMPS_DE_LA_FRISE,
    refus: refusDeLaFriseATheme,
    memes: f => [sonIdentifiant(f), { quoi: 'le même thème', cle: empreinte(f.theme) }],
  },
}

/** Une entrée qui ne se pose pas, et pourquoi. */
export interface EntreeEcartee {
  entree: unknown
  motif: string
}

/**
 * Trie des entrées d'une sorte : celles qui se posent, et celles qui
 * s'écartent avec leur motif — refusées par leur juge, ou qui redisent une
 * entrée déjà là (`deja`, le contenu rangé) ou gardée avant elles. Le juge
 * passe d'abord : une entrée qui ne se pose pas ne cache pas celle qui la suit.
 */
export function trier<S extends SorteDuContenu>(
  sorte: S,
  entrees: readonly unknown[],
  deja: readonly EntreeDuContenu<S>[] = [],
): { gardees: EntreeDuContenu<S>[]; ecartees: EntreeEcartee[] } {
  const s: SorteDeContenu<EntreeDuContenu<S>> = SORTES[sorte]
  const vues = new Map<string, string>()
  const posees: EntreeDuContenu<S>[] = []
  const poser = (e: EntreeDuContenu<S>) => {
    for (const m of s.memes(e)) vues.set(`${m.quoi}\n${m.cle}`, e.id)
    posees.push(e)
  }
  for (const e of deja) poser(e)
  const gardees: EntreeDuContenu<S>[] = []
  const ecartees: EntreeEcartee[] = []
  for (const brut of entrees) {
    const refus = s.refus(brut)
    if (refus) {
      ecartees.push({ entree: brut, motif: refus })
      continue
    }
    const e = brut as EntreeDuContenu<S>
    const redit = (() => {
      for (const m of s.memes(e)) {
        const autre = vues.get(`${m.quoi}\n${m.cle}`)
        if (autre !== undefined) return `${m.quoi} que ${autre}`
      }
      if (s.voisines) {
        for (const autre of posees) {
          const motif = s.voisines(e, autre)
          if (motif) return `${motif} de ${autre.id}`
        }
      }
      return null
    })()
    if (redit) ecartees.push({ entree: brut, motif: `déjà là : ${redit}` })
    else {
      poser(e)
      gardees.push(e)
    }
  }
  return { gardees, ecartees }
}

/** Une entrée telle que son fichier l'écrit : une ligne, ses champs dans l'ordre de sa sorte — un diff qui se relit entrée par entrée. */
export function ligneDe<S extends SorteDuContenu>(sorte: S, e: EntreeDuContenu<S>): string {
  const champs = SORTES[sorte].champs
  return JSON.stringify(Object.fromEntries(champs.map(c => [c, (e as unknown as Record<string, unknown>)[c]])))
}

/** Un fichier du contenu, en JSON ; un tableau vide s'il manque ou ne se lit pas — le journal le dit. */
function lireLeFichier(dossier: string, fichier: string): unknown[] {
  try {
    const brut = JSON.parse(fs.readFileSync(path.join(dossier, fichier), 'utf8'))
    if (Array.isArray(brut)) return brut
    console.warn(`[cabinet] ${fichier} n'est pas un tableau : le Cabinet s'en passera`)
  } catch (e) {
    console.warn(`[cabinet] ${fichier} illisible : le Cabinet s'en passera —`, e instanceof Error ? e.message : e)
  }
  return []
}

/** Le contenu d'un dossier, chaque entrée jugée, aucune deux fois ; ce qui s'écarte se dit au journal, avec son motif. */
export function lireLeContenu(dossier: string): ContenuDuCabinet {
  const sorte = <S extends SorteDuContenu>(s: S): EntreeDuContenu<S>[] => {
    const { gardees, ecartees } = trier(s, lireLeFichier(dossier, SORTES[s].fichier))
    for (const { entree, motif } of ecartees) console.warn(`[cabinet] ${SORTES[s].nom} écarté (${(entree as { id?: unknown })?.id ?? '?'}) : ${motif}`)
    return gardees
  }
  return { lieux: sorte('lieux'), fiches: sorte('fiches'), repliques: sorte('repliques'), frises: sorte('frises') }
}

let lu: ContenuDuCabinet | null = null

/** Le contenu livré, lu du disque la première fois qu'on le demande. */
export function contenuDuCabinet(): ContenuDuCabinet {
  lu ??= lireLeContenu(DOSSIER_DU_CONTENU)
  return lu
}
