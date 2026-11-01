// Des plans d'essai pour les règles pures du Cabinet : un contenu tiré de
// chacun des dix jeux, un départ, et de quoi jouer une partie geste à geste
// comme le serveur la jouera — l'heure d'arrivée de chaque geste à la main.
// Les exemples sont fabriqués ici, petits et lisibles ; le contenu livré a son
// juge et son test (`cabinet-contenu.test.ts`), le tirage du serveur les siens.
import assert from 'node:assert/strict'
import { hasardDe } from '../../shared/missions'
import type { Fiche, Lieu, Replique } from '../../shared/cabinet/contenu'
import { chronoDuDepart, jouerUnGeste, type CarteDuDepart, type DepartDUnePartie, type EtatDeLaPartie, type GesteDuCabinet, type GesteEcrit, ETAT_DU_DEPART } from '../../shared/cabinet/partie'
import type { ContenuTire } from '../../shared/cabinet/jeux/index'
import type { CleDeJeu } from '../../shared/cabinet/jeux/regle'
import type { QuestionTiree } from '../../shared/cabinet/jeux/outils'
import { epingleTiree } from '../../shared/cabinet/jeux/epingle'
import { friseEnVagues } from '../../shared/cabinet/jeux/frise'
import { repliqueTiree } from '../../shared/cabinet/jeux/replique'

/** Le 24 octobre 2026 à midi, heure de Paris : le zéro des horloges d'essai. */
export const MIDI = Date.UTC(2026, 9, 24, 10, 0, 0)
export const JOUR = '2026-10-24'
export const S = 1000

export const qcm = (id: string, bonne = 1, o: Partial<QuestionTiree> = {}): QuestionTiree => ({
  id,
  texte: `Quelle est la réponse ${id} ?`,
  reponses: ['Riga', 'Vilnius', 'Tallinn', 'Minsk'],
  bonne,
  categorie: 'Géographie',
  anecdote: `Le savais-tu de ${id}.`,
  niveau: 'facile',
  ...o,
})

export const lieu = (k: number): Lieu => ({
  id: `siege-${k}`,
  theme: 'Les grands sièges',
  nom: `La place forte ${k}`,
  commune: 'Orléans',
  departement: 'Loiret',
  lat: 47.902 + k / 100,
  lon: 1.909,
  annee: 1429,
  date: '1429',
  recit: 'Une ville assiégée sur la Loire, délivrée en neuf jours.',
  question: 'Où se trouve cette place forte ?',
  savais: 'La ville fête encore sa délivrance chaque mois de mai.',
  categorie: 'Histoire',
})

export const fiche = (k: number): Fiche => ({
  id: `hugo-${k}`,
  reponse: 'Victor Hugo',
  cles: ['hugo'],
  indices: ['Je suis né à Besançon.', 'J’ai vécu en exil à Guernesey.', 'J’ai écrit Hernani.', 'J’ai écrit Notre-Dame de Paris.', 'J’ai écrit Les Misérables.'],
  savais: 'Il repose au Panthéon.',
  categorie: 'Arts & lettres',
})

export const replique = (k: number): Replique => ({
  id: `arletty-${k}`,
  avant: 'Atmosphère,',
  mot: 'atmosphère',
  apres: ' ! Est-ce que j’ai une gueule d’atmosphère ?',
  leurres: ['misère', 'lumière', 'frontière'],
  qui: 'Arletty',
  autres: ['Michèle Morgan', 'Simone Signoret'],
  source: 'Hôtel du Nord, 1938',
  savais: 'La réplique a été écrite par Henri Jeanson.',
  categorie: 'Cinéma & séries',
})

/** Les sept événements d'une frise à thème, à plus de trois ans l'un de l'autre. */
const FRISE = friseEnVagues(
  {
    sorte: 'theme',
    cle: 'aviation',
    theme: 'L’aviation',
    evenements: [
      { libelle: 'Le premier vol des frères Wright', annee: 1903 },
      { libelle: 'Blériot traverse la Manche', annee: 1909 },
      { libelle: 'Lindbergh traverse l’Atlantique', annee: 1927 },
      { libelle: 'Le premier vol d’un avion à réaction', annee: 1939 },
      { libelle: 'Le mur du son franchi', annee: 1947 },
      { libelle: 'Le premier vol du Concorde', annee: 1969 },
      { libelle: 'Le premier vol de l’A380', annee: 2005 },
    ],
    savais: 'Le Concorde reliait Paris à New York en trois heures et demie.',
    categorie: 'Histoire',
  },
  hasardDe('frise:aviation'),
)!

/** Le contenu d'une manche de chaque jeu ; `k` les distingue — les rechanges de Changer en prennent d'autres. */
export function tirageDe(jeu: CleDeJeu, k: number): ContenuTire {
  switch (jeu) {
    case 'pari':
      return { jeu, q1: qcm(`p${k}a`, 1), q2: qcm(`p${k}b`, 3, { niveau: 'difficile', anecdote: null }) }
    case 'eclair':
      // Vraies aux rangs pairs (la bonne proposée), fausses aux impairs.
      return { jeu, affirmations: [0, 1, 2, 3, 4].map(i => ({ question: qcm(`e${k}${i}`, 1), proposee: i % 2 === 0 ? 1 : 2 })) }
    case 'mot':
      return { jeu, question: qcm(`m${k}`, 1, { texte: 'Quelle est la capitale de la Lituanie ?' }), lettres: 'VILNIUS', affiche: 'Vilnius' }
    case 'filet':
      return { jeu, question: qcm(`f${k}`, 0, { texte: 'En quelle année naît la Lituanie moderne ?', reponses: ['1852', '1800', '1900', '1950'] }), valeur: 1852, annee: true, piste: { min: 1800, max: 1900, pas: 1 } }
    case 'detail':
      return {
        jeu,
        tableau: { qid: `Q${k}`, titre: `Le tableau ${k}`, peintre: 'Un peintre', annee: 1500 + k },
        titres: [
          { titre: 'Un autre', peintre: 'Quelqu’un' },
          { titre: 'Encore un', peintre: 'Quelqu’un' },
          { titre: `Le tableau ${k}`, peintre: 'Un peintre' },
          { titre: 'Le dernier', peintre: 'Quelqu’un' },
        ],
        bonne: 2,
        anecdote: 'Peint sur un panneau de peuplier.',
        categorie: 'Arts & lettres',
      }
    case 'frise':
      return FRISE[k]
    case 'epingle':
      return epingleTiree(lieu(k), hasardDe(`epingle:${k}`))
    case 'indices':
      return { jeu, fiche: fiche(k) }
    case 'replique':
      return repliqueTiree(replique(k), hasardDe(`replique:${k}`))
    case 'quiz':
      // Quatre questions, leurs bonnes réponses à des places différentes : 1, 0, 2, 3.
      return { jeu, theme: 'Géographie', questions: [1, 0, 2, 3].map((bonne, i) => qcm(`q${k}${i}`, bonne)) }
  }
}

/**
 * Un départ d'essai : trois manches du jeu, et `rechanges` de plus pour « Changer » (jamais à la Frise) ; son
 * chrono figé aux chiffres du jour et à sa carte, comme le serveur l'écrira (`chronoDuDepart`), sauf s'il le dit.
 */
export function departDe(jeu: CleDeJeu, o: Partial<DepartDUnePartie> & { rechanges?: number } = {}): DepartDUnePartie {
  const { rechanges = 0, chrono, ...reste } = o
  const n = jeu === 'frise' ? 3 : 3 + rechanges
  const carte = reste.carte ?? null
  return {
    v: 1,
    jeu,
    origine: 'libre',
    jour: JOUR,
    cible: null,
    but: null,
    seuil: null,
    payee: true,
    carte,
    chrono: chrono ?? chronoDuDepart(jeu, carte),
    graine: 'graine-d-essai',
    tirages: Array.from({ length: n }, (_, k) => tirageDe(jeu, k)),
    ...reste,
  }
}

export const carte = (pouvoir: CarteDuDepart['pouvoir'], force: CarteDuDepart['force'] = 1, cle = 'coup-d-oeil'): CarteDuDepart => ({ cle, pouvoir, force })

/** Une partie qu'on joue geste à geste, l'horloge à la main : chaque geste accepté s'écrit, comme au serveur. */
export class Partie {
  etat: EtatDeLaPartie = ETAT_DU_DEPART
  gestes: GesteEcrit[] = []
  constructor(readonly depart: DepartDUnePartie) {}

  /** Le geste joué à `t` : il doit passer. */
  joue(geste: GesteDuCabinet, t: number): EtatDeLaPartie {
    const r = jouerUnGeste(this.depart, this.etat, geste, t)
    assert.ok(typeof r !== 'string', `${JSON.stringify(geste)} refusé : ${r}`)
    this.etat = r
    this.gestes.push({ geste, faitLe: t })
    return r
  }

  /** Le geste joué à `t` : il doit se refuser, et rien ne change. */
  refuse(geste: GesteDuCabinet, t: number): string {
    const r = jouerUnGeste(this.depart, this.etat, geste, t)
    assert.ok(typeof r === 'string', `${JSON.stringify(geste)} aurait dû se refuser`)
    return r
  }
}

/** La manche `k` ouverte à `t`. */
export const ouvrir = (manche: 0 | 1 | 2, miser?: true): GesteDuCabinet => ({ quoi: 'ouvrir', manche, ...(miser && { miser }) })
