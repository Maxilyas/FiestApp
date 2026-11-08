// Sa force sur les sentiers, tenue à jour de ses seules réponses nouvelles
// (le 8 novembre 2026, `retours/2026-11-08/`).
//
// La page des sentiers dit à chacun sa chance de valider le palier qui
// l'attend, et ce qu'elle valait il y a une semaine
// (`CampagneStore.chancesPourLui`) : sa force, relue de toutes ses premières
// réponses, partie de celle du modèle du savoir. Refaite à chaque visite, elle
// prenait la moitié du processeur de la page ; gardée d'une visite à l'autre
// tant qu'il n'avait pas répondu (le 6 novembre 2026), elle se refaisait encore
// à chaque retour d'une épreuve — le chemin même d'un joueur des sentiers : cinq
// gels de 0,9 à 1,9 s l'après-midi du 6 novembre, ses 9 000 premières réponses
// rangées chaque fois dans trois tables neuves, puis en tableaux, deux fois.
//
// Ici, ses premières réponses vivent en tableaux, sous la série de référence
// qui en a lu les difficultés — rangées une fois, complétées des seules
// nouvelles (`JournalDesReponses.lirePremieres`) —, et sa force se relit dessus
// (`forceDesTableaux`) : les mêmes tableaux, dans le même ordre, partis du même
// endroit que `forceDuJoueur`, donnent la même force au bit près
// (`force-tenue.test.ts`). Sa semaine — sa force d'il y a une semaine, ses
// premières réponses de part et d'autre — se refait à l'heure, et quand sa
// force change.

import { CATEGORIES } from '../../../shared/categories'
import { forceDesTableaux, type ForceDUnJoueur } from './modeleDuSavoir'
import type { JournalDesReponses } from './journalDesReponses'

const C = CATEGORIES.length

/** La place de départ de ses tableaux : ils doublent quand il la dépasse. */
const PLACE_DE_DEPART = 256

/** Les indices 0, 1, 2… : sa force sur toutes ses premières réponses les lit dans l'ordre (`quelles`). Agrandi au besoin, jamais changé. */
let identite = new Int32Array(0)
function lesPremiers(n: number): Int32Array {
  if (identite.length < n) {
    identite = new Int32Array(Math.max(n, identite.length * 2, PLACE_DE_DEPART))
    for (let i = 0; i < identite.length; i++) identite[i] = i
  }
  return identite.subarray(0, n)
}

/**
 * Ce que sa force lit d'une question, sans rien allouer : sa catégorie — sa
 * place dans les douze, −1 hors de la base ou hors des douze, et la question
 * ne compte pas — et sa difficulté, en logit, lue seulement pour une question
 * qui compte.
 */
export interface LesQuestions {
  categorie(id: string): number
  difficulte(id: string): number
}

function agrandi<T extends Float64Array | Int8Array | Uint8Array>(avant: T, apres: T): T {
  apres.set(avant)
  return apres
}

export class ForceTenue {
  /** Ses premières réponses dans la base, en tableaux : la difficulté, la catégorie, juste ou non, l'instant de chacune. */
  n = 0
  difficultes = new Float64Array(PLACE_DE_DEPART)
  categories = new Int8Array(PLACE_DE_DEPART)
  justes = new Uint8Array(PLACE_DE_DEPART)
  les = new Float64Array(PLACE_DE_DEPART)
  /** Où il en est du journal : ses questions vues, ses premières changées en place, ses réponses lues (`versionDe`). */
  private vues = 0
  private retouches = 0
  private version = -1
  /** Sa force sur toutes ses premières réponses ; null : à faire. */
  lui: ForceDUnJoueur | null = null
  /** L'heure de sa semaine ; −1 : à refaire. */
  private heure = -1
  /** Sa force d'il y a une semaine, sur ses seules premières réponses d'avant ; null sous le seuil. */
  luiAvant: ForceDUnJoueur | null = null
  /** Ses premières réponses par catégorie, d'avant la semaine et de la semaine. */
  readonly anciennes = new Array<number>(C).fill(0)
  readonly recentes = new Array<number>(C).fill(0)

  /** Le journal qu'elle suit : un journal refait (`oublierProfil`) en demande une neuve. */
  constructor(readonly journal: JournalDesReponses) {}

  private ajouter(difficulte: number, categorie: number, juste: boolean, le: number) {
    if (this.n === this.justes.length) {
      const place = this.n * 2
      this.difficultes = agrandi(this.difficultes, new Float64Array(place))
      this.categories = agrandi(this.categories, new Int8Array(place))
      this.justes = agrandi(this.justes, new Uint8Array(place))
      this.les = agrandi(this.les, new Float64Array(place))
    }
    this.difficultes[this.n] = difficulte
    this.categories[this.n] = categorie
    this.justes[this.n] = juste ? 1 : 0
    this.les[this.n] = le
    this.n++
  }

  /**
   * Sa force, ses premières réponses rattrapées sur le journal : rien à faire
   * s'il n'a pas répondu depuis ; ses seules nouvelles premières réponses
   * sinon — une réponse à une question déjà vue n'en ajoute pas, et sa force
   * ne bouge pas —, ou toutes si l'une d'avant a changé en place. `depart` :
   * d'où part sa force, celle du modèle, comme `forceDuJoueur`.
   */
  tenir(qui: string, questions: LesQuestions, forceDeDepart: number, depart: Pick<ForceDUnJoueur, 'force' | 'ecarts'> | undefined): ForceDUnJoueur {
    const version = this.journal.versionDe(qui)
    if (this.lui && version === this.version) return this.lui
    let refaire = this.lui === null
    const retouches = this.journal.retouchesDe(qui)
    if (retouches !== this.retouches) {
      this.n = 0
      this.vues = 0
      this.retouches = retouches
      refaire = true
    }
    const avant = this.n
    this.vues = this.journal.lirePremieres(qui, this.vues, (id, le, juste) => {
      const c = questions.categorie(id)
      if (c >= 0) this.ajouter(questions.difficulte(id), c, juste, le)
    })
    this.version = version
    if (refaire || this.n !== avant) {
      this.lui = forceDesTableaux(
        { difficultes: this.difficultes, categories: this.categories, quelles: lesPremiers(this.n), justes: this.justes.subarray(0, this.n) },
        forceDeDepart,
        depart,
      )
      this.heure = -1
    }
    return this.lui!
  }

  /**
   * Sa semaine, pour l'heure : sa force sur ses seules premières réponses
   * d'avant `depuis`, partie de la sienne — null quand sa force tient sur
   * moins de `seuil` premières réponses : la page n'en dit rien —, et ses
   * premières réponses par catégorie, de part et d'autre. Refaite à l'heure —
   * sa semaine glisse — et quand sa force change : elle en part.
   */
  saSemaine(heure: number, depuis: number, forceDeDepart: number, seuil: number): void {
    if (this.heure === heure || !this.lui) return
    this.anciennes.fill(0)
    this.recentes.fill(0)
    let avant = 0
    for (let i = 0; i < this.n; i++) if (this.les[i] < depuis) avant++
    const quelles = new Int32Array(avant)
    const justes = new Uint8Array(avant)
    for (let i = 0, k = 0; i < this.n; i++) {
      if (this.les[i] < depuis) {
        quelles[k] = i
        justes[k++] = this.justes[i]
        this.anciennes[this.categories[i]]++
      } else this.recentes[this.categories[i]]++
    }
    this.luiAvant = this.lui.reponses < seuil ? null : forceDesTableaux({ difficultes: this.difficultes, categories: this.categories, quelles, justes }, forceDeDepart, this.lui)
    this.heure = heure
  }
}
