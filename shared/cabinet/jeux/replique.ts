// La Réplique : une réplique célèbre, un mot en moins. Deux étapes, chacune son
// chrono (« un chrono par question », retenu des tours de la maquette) :
// d'abord le mot qui manque, parmi quatre ; puis qui l'a dite, parmi trois —
// le mot choisi posé dans le trou, sans jamais dire s'il était le bon avant la
// révélation (invariant 1). L'étape de « Qui l'a dit ? » s'ouvre au mot
// choisi, ou à l'échéance du premier chrono, le mot perdu : on ne perd pas la
// seconde question à cause de la première.
//
// Ici, la règle pure (le moule : `regle.ts`) : les propositions battues au
// départ (`repliqueTiree`), le barème — le bon mot ★★, la bonne personne ★ —,
// ce qu'Éclairer efface, ce que chaque étape montre et ce que la révélation
// dit, la pièce que le journal garde — `cab:replique:<id>`, hors de la base.
// Le choix de la réplique reste au serveur. Le pli lit `etape` pour ses
// échéances.

import { DUREES_DES_JEUX, ETOILES_DE_LA_REPLIQUE } from '../bareme'
import type { Replique } from '../contenu'
import { idDeLaReplique } from '../pieces'
import { effacablesAuPlus } from '../pouvoirs'
import { GESTE_A_JUGER, SANS_REPONSE, auHasard, battre, champsDuGeste, choixDe, estUnIndex, naturelDe, pieceDuContenu, reponseEnvoyee, rienAEclairer, type RegleQuiTranche } from './duContenu'
import { justeDeLaPiece } from './regle'

/** Ce que le départ fige d'une manche : la réplique, puis ses propositions dans l'ordre où la page les montre, et le rang des bonnes. */
export interface RepliqueTiree {
  jeu: 'replique'
  replique: Replique
  /** Le mot et ses trois leurres, battus. */
  mots: string[]
  /** Qui l'a dite et les deux autres, battus. */
  personnes: string[]
  bonMot: number
  bonneQui: number
}

export interface EtatDeLaReplique {
  /** La question en jeu : le mot, puis « Qui l'a dit ? ». */
  etape: 1 | 2
  /** Le mot choisi, par son rang ; null tant qu'il ne l'a pas choisi, ou perdu à l'échéance. */
  mot: number | null
  /** Ce qu'Éclairer a effacé à chaque étape : jamais la bonne proposition (`effacablesAuPlus`). */
  effaces: readonly [readonly number[], readonly number[]]
}

/**
 * Le mot choisi ; ou « Qui l'a dit ? » répondu — `qui` nul quand la page
 * envoie d'elle-même à l'échéance, sans rien : à la première étape, le mot
 * est perdu et la seconde s'ouvre ; à la seconde, la manche se juge.
 */
export type GesteDeLaReplique = { quoi: 'mot'; choix: number } | { quoi: 'repondre'; qui: number | null }

/** La première étape : la réplique et son trou, les quatre mots — rien de qui l'a dite. */
export interface RepliqueMontreeAuMot {
  jeu: 'replique'
  etape: 1
  avant: string
  apres: string
  mots: { mot: string; efface: boolean }[]
}

/** La seconde : le mot choisi dans le trou — le bon ou un leurre, la vue a la même forme —, et les trois noms. */
export interface RepliqueMontreeAQui {
  jeu: 'replique'
  etape: 2
  avant: string
  apres: string
  /** Null : le temps du mot s'est écoulé (« Temps écoulé pour le mot. Qui l'a dit ? »). */
  motChoisi: string | null
  personnes: { nom: string; efface: boolean }[]
}

export type RepliqueMontree = RepliqueMontreeAuMot | RepliqueMontreeAQui

export interface RepliqueRevelee {
  jeu: 'replique'
  /** « Le bon mot », « C’était « atmosphère » ». */
  titre: string
  bonMot: boolean
  bonneQui: boolean
  /** La réplique entière, son mot à sa place. */
  entiere: string
  /** « Arletty · Hôtel du Nord, 1938 ». */
  qui: string
  source: string
  /** « Tu avais répondu … » : ce qu'il avait choisi à chaque étape, par son texte. */
  repondu: { mot: string | null; qui: string | null }
  /** « Le savais-tu ? » */
  savais: string
}

/**
 * La réplique, un mot dans son trou. Le contenu écrit ce qui précède sans
 * espace au bout, et ce qui suit avec la sienne quand il en faut une
 * (« Tonnerre de » · « Brest » · « ! ») : un mot se pose après une espace,
 * collé seulement derrière une apostrophe (« c'est l'atterrissage »).
 */
export function repliqueEntiere(avant: string, mot: string, apres: string): string {
  const joint = avant === '' || /['’]$/.test(avant) ? '' : ' '
  return `${avant}${joint}${mot}${apres}`
}

/**
 * La question au journal et au cartel : la réplique, son trou en points de
 * suspension (« « Tonnerre de … ! » »). Le point final d'une réplique s'y
 * fond — « C’est pas …. » se serait lu quatre points.
 */
const aTrou = (r: Replique) => `« ${repliqueEntiere(r.avant, '…', r.apres.replace(/^\.(?!\.)/, ''))} »`

/**
 * La manche tirée d'une réplique que le serveur a choisie : ses quatre mots et
 * ses trois personnes battus du hasard de la graine — une reprise après un
 * redémarrage redonne le même ordre. Le rang de la bonne proposition se suit
 * pendant qu'on bat, jamais retrouvé par son texte : un leurre écrit comme le
 * mot ne prendrait pas sa place.
 */
export function repliqueTiree(replique: Replique, hasard: () => number): RepliqueTiree {
  const mots = battre([{ texte: replique.mot, bon: true }, ...replique.leurres.map(texte => ({ texte, bon: false }))], hasard)
  const personnes = battre([{ texte: replique.qui, bon: true }, ...replique.autres.map(texte => ({ texte, bon: false }))], hasard)
  return {
    jeu: 'replique',
    replique,
    mots: mots.map(m => m.texte),
    personnes: personnes.map(p => p.texte),
    bonMot: mots.findIndex(m => m.bon),
    bonneQui: personnes.findIndex(p => p.bon),
  }
}

/** La seconde étape seule se tranche : à la première, « Qui l'a dit ? » n'est pas encore posée. */
const tranche = (e: EtatDeLaReplique, g: GesteDeLaReplique) => g.quoi === 'repondre' && e.etape === 2

/** « 1|2 » : le rang du mot choisi, puis de la personne — `.` sans réponse. */
const composee = (mot: number | null, qui: number | null) => `${mot ?? SANS_REPONSE}|${qui ?? SANS_REPONSE}`

function relue(c: string | null | undefined): { mot: number | null; qui: number | null } | null {
  const m = typeof c === 'string' ? /^(\d+|\.)\|(\d+|\.)$/.exec(c) : null
  const rang = (x: string) => (x === SANS_REPONSE ? null : Number(x))
  return m ? { mot: rang(m[1]), qui: rang(m[2]) } : null
}

/** La réponse dite, au journal : « « atmosphère » — Arletty ». */
const reponseDite = (r: Replique) => `« ${r.mot} » — ${r.qui}`

export const REGLE_DE_LA_REPLIQUE: RegleQuiTranche<RepliqueTiree, EtatDeLaReplique, GesteDeLaReplique, RepliqueMontree, RepliqueRevelee> = {
  cle: 'replique',
  etapes: 2,
  // La même durée à chaque étape : chacune son chrono, qui part à son ouverture.
  dureeMs: () => DUREES_DES_JEUX.replique * 1000,

  ouvrir: () => ({ etape: 1, mot: null, effaces: [[], []] }),

  lireLeGeste(brut, t) {
    const g = champsDuGeste(brut)
    if (g?.quoi === 'mot') return estUnIndex(g.choix, t.mots.length) ? { quoi: 'mot', choix: g.choix } : null
    if (g?.quoi !== 'repondre') return null
    const r = reponseEnvoyee(g, 'replique')
    if (r === undefined) return { quoi: 'repondre', qui: null }
    return r !== null && estUnIndex(r.qui, t.personnes.length) ? { quoi: 'repondre', qui: r.qui } : null
  },

  tranche: (_t, e, g) => tranche(e, g),

  apresLeGeste(_t, e, g) {
    if (tranche(e, g)) return GESTE_A_JUGER
    if (e.etape === 2) return 'Le mot est choisi : dis qui l’a dite'
    if (g.quoi === 'mot') return { etape: 2, mot: g.choix, effaces: [e.effaces[0], []] }
    // « Qui » avant le mot : la page ne montre pas encore les noms. Sans rien, c'est l'échéance du mot.
    if (g.qui !== null) return 'Choisis d’abord le mot qui manque'
    return { etape: 2, mot: null, effaces: [e.effaces[0], []] }
  },

  juger(t, e, reponse) {
    // Le mot, le serveur l'a dès la seconde étape : expirée ou quittée, il compte encore — ce que le serveur
    // savait déjà, comme les essais du Mot mystère. Seul « qui » attend une réponse.
    const mot = e.etape === 2 ? e.mot : null
    const qui = typeof reponse === 'object' && reponse.quoi === 'repondre' ? reponse.qui : null
    const naturel = naturelDe((mot === t.bonMot ? ETOILES_DE_LA_REPLIQUE.mot : 0) + (qui === t.bonneQui ? ETOILES_DE_LA_REPLIQUE.qui : 0))
    // Juste au bon mot : la bonne personne seule ne fait qu'une étoile.
    const juste = justeDeLaPiece(naturel, 'replique') === true
    return { naturel, pieces: [{ juste, choix: choixDe(mot !== null || qui !== null, juste), composee: composee(mot, qui) }] }
  },

  eclairer(t, e, hasard) {
    // Deux mots sur quatre, un nom sur trois : deux propositions restent toujours, une seule serait la réponse.
    const etape = e.etape === 1 ? { propositions: t.mots.length, bonne: t.bonMot } : { propositions: t.personnes.length, bonne: t.bonneQui }
    const deja = e.effaces[e.etape - 1]
    const restants = Array.from({ length: etape.propositions }, (_, i) => i).filter(i => i !== etape.bonne && !deja.includes(i))
    if (deja.length >= effacablesAuPlus(etape.propositions) || restants.length === 0) return rienAEclairer('replique')
    const effaces = [...deja, auHasard(restants, hasard)]
    return { ...e, effaces: e.etape === 1 ? [effaces, e.effaces[1]] : [e.effaces[0], effaces] }
  },

  montrer(t, e) {
    const { avant, apres } = t.replique
    if (e.etape === 1) return { jeu: 'replique', etape: 1, avant, apres, mots: t.mots.map((mot, i) => ({ mot, efface: e.effaces[0].includes(i) })) }
    return {
      jeu: 'replique',
      etape: 2,
      avant,
      apres,
      motChoisi: e.mot === null ? null : t.mots[e.mot],
      personnes: t.personnes.map((nom, i) => ({ nom, efface: e.effaces[1].includes(i) })),
    }
  },

  reveler(t, e, v) {
    const r = t.replique
    const lu = relue(v.pieces[0]?.composee) ?? { mot: e.mot, qui: null }
    const bonMot = lu.mot === t.bonMot
    return {
      jeu: 'replique',
      titre: bonMot ? 'Le bon mot' : `C’était « ${r.mot} »`,
      bonMot,
      bonneQui: lu.qui === t.bonneQui,
      entiere: repliqueEntiere(r.avant, r.mot, r.apres),
      qui: r.qui,
      source: r.source,
      repondu: { mot: lu.mot === null ? null : (t.mots[lu.mot] ?? null), qui: lu.qui === null ? null : (t.personnes[lu.qui] ?? null) },
      savais: r.savais,
    }
  },

  piece: (t, _e, _v, i) =>
    pieceDuContenu({ id: idDeLaReplique(t.replique.id), texte: aTrou(t.replique), reponse: reponseDite(t.replique), categorie: t.replique.categorie, anecdote: t.replique.savais }, 'replique', i),

  cartel: t => ({ sujet: aTrou(t.replique), reponse: `${reponseDite(t.replique)}, ${t.replique.source}`, anecdote: t.replique.savais }),
}
