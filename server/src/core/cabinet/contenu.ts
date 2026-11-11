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
import { enTranches } from '../tourniquet'
import { dUneTraite, type CalculEnTranches } from '../../../../shared/tranches'
import { CATEGORIES } from '../../../../shared/categories'
import { refusDuLibelle } from '../../../../shared/frise'
import { dansLaFrance, distanceKm } from '../../../../shared/cabinet/france'
import {
  ANS_PRES_D_UN_INDICE,
  AUTRES_D_UNE_REPLIQUE,
  CLES_MAX,
  ECART_DES_ANNEES_DE_LA_FRISE,
  EVENEMENTS_D_UNE_FRISE_A_THEME,
  INDICES_D_UNE_FICHE,
  INDICE_DU_FILET_MAX,
  INDICE_MAX,
  LEURRES_D_UNE_REPLIQUE,
  LIEUX_VOISINS_KM,
  MOTS_D_UNE_IDENTITE_MAX,
  MOTS_D_UNE_REPLIQUE_MAX,
  PART_PRES_D_UN_INDICE,
  PISTE_MAX,
  QUESTION_MAX,
  RECIT_MAX,
  REPERE_DU_FILET_MAX,
  SAVAIS_MAX,
} from '../../../../shared/cabinet/bareme'
import {
  FORME_D_UN_IDENTIFIANT,
  FORME_D_UNE_CLE,
  type Fiche,
  type FriseATheme,
  type Lieu,
  type QuestionDuFilet,
  type RepereCommun,
  type Replique,
} from '../../../../shared/cabinet/contenu'
import { bonneIdentite, motsDe, motsUtiles, proches } from '../../../../shared/cabinet/jeux/indices'
import { borneDeGrandeur, largeurDesEpoques } from '../../../../shared/cabinet/jeux/filetEnDeuxTemps'

export const DOSSIER_DU_CONTENU = path.join(SERVEUR, 'content/cabinet')

/**
 * Le contenu neuf, sorte par sorte : chaque entrée jugée, aucune deux fois. Le Filet en deux temps y range ce qu'il
 * ajoute aux questions de la base — l'acte, l'indice, l'étiquette d'un repère (`filet`) — et les repères que tout le
 * monde connaît (`reperes`).
 */
export interface ContenuDuCabinet {
  lieux: readonly Lieu[]
  fiches: readonly Fiche[]
  repliques: readonly Replique[]
  frises: readonly FriseATheme[]
  filet: readonly QuestionDuFilet[]
  reperes: readonly RepereCommun[]
}

export type SorteDuContenu = keyof ContenuDuCabinet
export type EntreeDuContenu<S extends SorteDuContenu> = ContenuDuCabinet[S][number]

export const SORTES_DU_CONTENU: readonly SorteDuContenu[] = ['lieux', 'fiches', 'repliques', 'frises', 'filet', 'reperes']

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

const CHAMPS_DU_LIEU = ['id', 'theme', 'nom', 'commune', 'departement', 'lat', 'lon', 'annee', 'date', 'recit', 'question', 'piste', 'savais', 'categorie'] as const

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
 * verdict — le thème, la date, le récit, la question, la piste —, puisqu'ils
 * sont la réponse. Le nom du lieu, lui, peut s'y dire : « Où se trouve la place
 * Stanislas ? » demande de savoir où est Nancy. Sa piste — le premier indice,
 * qu'il demande contre une étoile (le 11 novembre 2026) — est une phrase qui
 * dit le coin de France, pas une question de plus : un lieu du Nord n'y dit pas
 * « dans le nord », ni un lieu de la Manche « sur la Manche ».
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
    () => refusDuTexte('sa piste', l.piste, PISTE_MAX),
    () => (/[.!]$/.test(l.piste as string) && !(l.piste as string).includes('?') ? null : 'sa piste : une phrase qui dit le coin de France, et finit par un point — pas une question'),
    () => refusDuTexte('son « Le savais-tu ? »', l.savais, SAVAIS_MAX),
    () => refusDeLaCategorie(l.categorie),
    () => {
      for (const [quoi, texte] of [['son thème', l.theme], ['sa date', l.date], ['son récit', l.recit], ['sa question', l.question], ['sa piste', l.piste]] as const) {
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

const CHAMPS_DE_LA_QUESTION_DU_FILET = ['id', 'chacun', 'panel', 'indice', 'repere'] as const

/**
 * Pourquoi cette question du Filet en deux temps ne se pose pas — null : elle se pose. L'identifiant d'une question de
 * la base ; chaque Français la sait-il placer (le classement du vivier, une question à la fois) ; la note du panel, de
 * zéro à cent ; un indice d'une ligne, ou null quand l'énoncé donne déjà l'époque ; l'étiquette de son fait. Ce que
 * l'indice ne doit pas écrire — un nombre trop près de la réponse —, la réponse n'est pas ici : `cabinet-contenu.test.ts`
 * le lit contre la base, comme le juge à la lettre de la chaîne d'écriture.
 */
export function refusDeLaQuestionDuFilet(brut: unknown): string | null {
  const champs = refusDesChamps(brut, CHAMPS_DE_LA_QUESTION_DU_FILET)
  if (champs) return champs
  const q = brut as Record<(typeof CHAMPS_DE_LA_QUESTION_DU_FILET)[number], unknown>
  return premier(
    () => refusDeLIdentifiant(q.id),
    () => (typeof q.chacun === 'boolean' ? null : 'chaque Français la sait-il placer : vrai ou faux'),
    () => (Number.isInteger(q.panel) && (q.panel as number) >= 0 && (q.panel as number) <= 100 ? null : 'sa note du panel : un entier de 0 à 100'),
    () => (q.indice === null ? null : refusDuTexte('son indice', q.indice, INDICE_DU_FILET_MAX)),
    () => (q.repere === null ? null : refusDuTexte('son repère', q.repere, REPERE_DU_FILET_MAX)),
  )
}

/** Les mots des nombres, de zéro à un milliard : « quatre-vingt-dix », « deux cents », « trois mille » se lisent comme 90, 200, 3000. */
const MOTS_DES_NOMBRES: Readonly<Record<string, number>> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13,
  quatorze: 14, quinze: 15, seize: 16, vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100, cents: 100,
  mille: 1000, mil: 1000, million: 1e6, millions: 1e6, milliard: 1e9, milliards: 1e9,
}

/** Les dizaines qu'un « et » prolonge : « vingt et un », « soixante et onze » — ailleurs, « et » sépare deux nombres. */
const DIZAINES_A_ET = new Set(['vingt', 'trente', 'quarante', 'cinquante', 'soixante'])

/**
 * Les nombres d'un texte, en chiffres (« 1929 », « 1 000 », « 3,5 ») et en lettres (« quatre-vingt-dix ») ; « un »,
 * « une » seuls sont des articles, et une ponctuation sépare deux nombres (« dix, vingt »), un « et » aussi, hors de
 * « vingt et un » : « entre deux cents et trois cents » se lisait 20 300.
 */
export function nombresDUnTexte(texte: string): number[] {
  const enChiffres = [...texte.matchAll(/\d[\d   ]*(?:[.,]\d+)?/g)].map(m => Number(m[0].replace(/[   ]/g, '').replace(',', '.'))).filter(Number.isFinite)
  // Chaque ponctuation devient un mot qui n'est pas un nombre : elle coupe la suite des mots d'un nombre.
  const mots = texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-’']/g, ' ')
    .replace(/[,;.:!?()«»—–]/g, ' | ')
    .split(/[^a-z|]+/)
    .filter(Boolean)
  const enLettres: number[] = []
  let total = 0
  let courant = 0
  let dedans = false
  const finir = () => {
    if (dedans) enLettres.push(total + courant)
    total = 0
    courant = 0
    dedans = false
  }
  for (let i = 0; i < mots.length; i++) {
    const m = mots[i]
    const v = MOTS_DES_NOMBRES[m]
    if (m === 'et' && dedans && DIZAINES_A_ET.has(mots[i - 1]) && ['un', 'une', 'onze'].includes(mots[i + 1])) continue
    if (v === undefined || ((m === 'un' || m === 'une') && !dedans && MOTS_DES_NOMBRES[mots[i + 1]] === undefined)) {
      finir()
      continue
    }
    dedans = true
    if (v === 100) courant = (courant || 1) * 100
    else if (v >= 1000) {
      total += (courant || 1) * v
      courant = 0
    }
    // « quatre-vingt » : le quatre est déjà compté — 904 devient 980, pas 924.
    else if (m.startsWith('vingt') && mots[i - 1] === 'quatre') courant += 76
    else courant += v
  }
  finir()
  return [...enChiffres, ...enLettres]
}

/** Un nombre, en chiffres ou en lettres, tel que `nombresDUnTexte` le lit. */
const UN_NOMBRE = `(?:\\d[\\d\\u00a0\\u202f ]*(?:[.,]\\d+)?|(?:(?:${Object.keys(MOTS_DES_NOMBRES).join('|')}|et)\\b\\s*)+)`
/** Ce qui fait d'un nombre une borne : « plus de dix », « avant 1950 », « entre 1925 et 1950 ». */
const UNE_BORNE_DITE = new RegExp(
  `\\b(?:(?:plus|moins|au dela|au dessus|au dessous|en dessous) d(?:e|es)?|avant|apres|depuis|jusqu a)\\s+(${UN_NOMBRE})|\\bentre\\s+(${UN_NOMBRE})\\s*et\\s+(${UN_NOMBRE})`,
  'g',
)

/** Les nombres qu'un texte dit comme des bornes — au-delà, en deçà, entre —, jamais comme une valeur (« vers 1950 »). */
export function bornesDitesDUnTexte(texte: string): number[] {
  const plat = texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-’']/g, ' ')
  return [...plat.matchAll(UNE_BORNE_DITE)].flatMap(m => m.slice(1).flatMap(g => (g ? nombresDUnTexte(g) : [])))
}

/**
 * Le juge à la lettre d'un indice du Filet : aucun nombre à moins de quinze ans d'une année, ni à moins de 20 % d'une
 * grandeur, en chiffres ni en lettres — « vingt ans » écrit en toutes lettres passait le premier script de la maquette.
 * Les autres nombres aident (« la crise de 1929 » pour 1946), et la borne d'une tranche dite comme une borne aussi, que
 * la frise écrit déjà : « plus de dix secondes, mais moins d'une demi-minute » recopie 10–30 pour 12 secondes — c'est la
 * cible d'un indice. Dite comme une valeur, la même borne la donne : « environ trois cents mètres » pour 330, « en 1950 »
 * pour 1946. Une décennie qui borne une fenêtre large n'est pas refusée : seule, elle donnerait la réponse à cinq ans
 * près, et c'est le juge à l'aveugle qui le voit.
 */
export function refusDeLIndiceALaLettre(indice: string, valeur: number, annee: boolean): string | null {
  const largeur = largeurDesEpoques(valeur)
  const dites = new Set(bornesDitesDUnTexte(indice))
  const borne = (n: number) =>
    dites.has(n) &&
    (annee ? Number.isInteger(n) && (n % largeur === 0 || (n + 1) % largeur === 0) : Array.from({ length: 40 }, (_, k) => borneDeGrandeur(k)).includes(n))
  for (const n of nombresDUnTexte(indice)) {
    if (borne(n)) continue
    if (annee ? Math.abs(n - valeur) < ANS_PRES_D_UN_INDICE : Math.abs(n - valeur) < PART_PRES_D_UN_INDICE * valeur) return `${n}, trop près de la réponse`
  }
  return null
}

const CHAMPS_DU_REPERE = ['id', 'valeur', 'texte', 'unite'] as const

/**
 * Pourquoi ce repère ne se pose pas — null : il se pose. Une date que tout Français a apprise ou vécue (son unité
 * null), ou une grandeur du quotidien dans son unité — la tour Eiffel, un marathon. Jamais la définition d'une unité :
 * « 100 ans · Un siècle », pour l'âge d'Orson Welles, apprenait à Huguette ce qu'est un siècle.
 */
export function refusDuRepere(brut: unknown): string | null {
  const champs = refusDesChamps(brut, CHAMPS_DU_REPERE)
  if (champs) return champs
  const r = brut as Record<(typeof CHAMPS_DU_REPERE)[number], unknown>
  return premier(
    () => refusDeLIdentifiant(r.id),
    () => (typeof r.valeur === 'number' && Number.isFinite(r.valeur) ? null : 'sa valeur : un nombre'),
    () => refusDuTexte('son texte', r.texte, REPERE_DU_FILET_MAX),
    () => (r.unite === null ? null : refusDuTexte('son unité', r.unite)),
    () => (r.unite === null && !Number.isInteger(r.valeur) ? 'une année : un entier' : null),
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
  filet: {
    fichier: 'filet.json',
    nom: 'question du Filet',
    champs: CHAMPS_DE_LA_QUESTION_DU_FILET,
    refus: refusDeLaQuestionDuFilet,
    memes: q => [sonIdentifiant(q)],
  },
  reperes: {
    fichier: 'reperes.json',
    nom: 'repère',
    champs: CHAMPS_DU_REPERE,
    refus: refusDuRepere,
    // Deux repères de la même valeur, dans la même unité, se poseraient l'un sur l'autre sur la frise.
    memes: r => [sonIdentifiant(r), { quoi: 'la même valeur', cle: `${r.valeur}|${r.unite ?? 'an'}` }],
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
  return dUneTraite(trierEnTranches(sorte, entrees, deja, Infinity))
}

/**
 * Les entrées qu'un tri passe d'une traite : chacune son juge et ses voisines,
 * une à deux millisecondes les dix sur un vrai cœur. D'une traite, le
 * contenu entier — vingt-six à quarante-trois millisecondes — gelait la boucle
 * plus d'une seconde au dixième de cœur, sous le premier départ d'un
 * processus (le banc bridé du 3 novembre 2026).
 */
export const ENTREES_PAR_TRANCHE = 10

/** Le même tri, en tranches de `tranche` entrées (`CalculEnTranches`). */
export function* trierEnTranches<S extends SorteDuContenu>(
  sorte: S,
  entrees: readonly unknown[],
  deja: readonly EntreeDuContenu<S>[] = [],
  tranche = ENTREES_PAR_TRANCHE,
): CalculEnTranches<{ gardees: EntreeDuContenu<S>[]; ecartees: EntreeEcartee[] }> {
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
  for (let i = 0; i < entrees.length; i++) {
    if (i > 0 && i % tranche === 0) yield
    const brut = entrees[i]
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
  return dUneTraite(lireLeContenuEnTranches(dossier, Infinity))
}

/** Le même, en tranches (`CalculEnTranches`) : chaque sorte à son tour, ses entrées `tranche` à la fois. */
export function* lireLeContenuEnTranches(dossier: string, tranche = ENTREES_PAR_TRANCHE): CalculEnTranches<ContenuDuCabinet> {
  function* sorte<S extends SorteDuContenu>(s: S): CalculEnTranches<EntreeDuContenu<S>[]> {
    yield
    const { gardees, ecartees } = yield* trierEnTranches(s, lireLeFichier(dossier, SORTES[s].fichier), [], tranche)
    for (const { entree, motif } of ecartees) console.warn(`[cabinet] ${SORTES[s].nom} écarté (${(entree as { id?: unknown })?.id ?? '?'}) : ${motif}`)
    return gardees
  }
  const lieux = yield* sorte('lieux')
  const fiches = yield* sorte('fiches')
  const repliques = yield* sorte('repliques')
  const frises = yield* sorte('frises')
  const filet = yield* sorte('filet')
  const reperes = yield* sorte('reperes')
  return { lieux, fiches, repliques, frises, filet, reperes }
}

let lu: ContenuDuCabinet | null = null
let enLecture: Promise<ContenuDuCabinet> | null = null

/** Le contenu livré, lu du disque la première fois qu'on le demande. */
export function contenuDuCabinet(): ContenuDuCabinet {
  lu ??= lireLeContenu(DOSSIER_DU_CONTENU)
  return lu
}

/**
 * Le même, lu en tranches, une par tour de boucle (`enTranches`) : la
 * préparation des tas le lit ainsi (`preparerLesTas`), et le tireur qui le
 * demande ensuite le trouve lu. Une seule lecture à la fois.
 */
export function contenuDuCabinetEnTranches(): Promise<ContenuDuCabinet> {
  if (lu) return Promise.resolve(lu)
  enLecture ??= enTranches(lireLeContenuEnTranches(DOSSIER_DU_CONTENU)).then(
    c => (lu ??= c),
    e => {
      enLecture = null
      throw e
    },
  )
  return enLecture
}
