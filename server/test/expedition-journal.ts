// Un journal d'expédition écrit comme le serveur l'écrit — ses gestes, puis ce
// que le pli demande de tirer —, sur des plans faits à la main : de quoi jouer
// une carte dans le vrai pli, et la lever dans les vraies pièces de la page.
// Le jeu complet (`expedition-jeu-complet.test.ts`) et les cartes améliorées
// (`expedition-ameliorations.test.ts`) s'en servent ; ce n'est pas un fichier
// de tests (`*.test.ts`) : `npm test` ne le lance pas seul.
import React from 'react'
import { NIVEAU_MAX, codexDuNiveau } from '../../shared/codex'
import { VERSION_DU_JEU_COMPLET, ameliorer, carteDeRencontre, formeDeLaCarte, type ApercuDuTour, type CarteDeRencontre, type VueDeLaRencontre } from '../../shared/rencontres'
import {
  GARDIEN,
  pliDeLExpedition,
  vueDeLaRencontre,
  type CarteDUnActe,
  type DepartDExpedition,
  type EtatDeLExpedition,
  type GesteDExpedition,
  type QuestionPosee,
} from '../../shared/expedition'

/** Une question d'Histoire, à quatre choix, chance 0,7 : toutes les escales à question des plans faits à la main. */
const HISTOIRE = { theme: { categories: ['Histoire'] }, forme: 'quatre' as const, chance: 0.7 }

/** Un plan fait à la main : une question d'Histoire au bas, un coffre, une élite, une question, le campement, le gardien. */
export function carte(): CarteDUnActe {
  return {
    depart: ['e00'],
    chanceDuGardien: 0.6,
    escales: [
      { id: 'e00', etage: 0, colonne: 0, sorte: 'question', ...HISTOIRE, suite: ['e10'] },
      { id: 'e10', etage: 1, colonne: 0, sorte: 'coffre', suite: ['e20'] },
      { id: 'e20', etage: 2, colonne: 0, sorte: 'elite', ...HISTOIRE, suite: ['e30'] },
      { id: 'e30', etage: 3, colonne: 0, sorte: 'question', ...HISTOIRE, suite: ['cg'] },
      { id: 'cg', etage: 6, colonne: 0, sorte: 'campement', suite: [GARDIEN] },
      { id: GARDIEN, etage: 7, colonne: 0, sorte: 'gardien', suite: [] },
    ],
  }
}

/**
 * Le même plan, avec une forge : un campement entre le coffre et l'élite
 * (`e15`), où une carte prise en bas s'améliore avant la rencontre d'après.
 */
export function carteDeLaForge(): CarteDUnActe {
  const c = carte()
  return {
    ...c,
    escales: c.escales.flatMap(e =>
      e.id === 'e10'
        ? [
            { ...e, suite: ['e15'] },
            { id: 'e15', etage: 2, colonne: 1, sorte: 'campement' as const, suite: ['e20'] },
          ]
        : e.id === 'e20'
          ? [{ ...e, etage: 3 }]
          : e.id === 'e30'
            ? [{ ...e, etage: 4 }]
            : [e],
    ),
  }
}

/** Un départ du jeu complet, au codex entier — le pari, les fioles, la fétiche —, mais dont les offres ne tirent que ces cartes. */
export const depart = (graine: string, cartes: readonly string[], plus: Partial<DepartDExpedition> = {}): DepartDExpedition => ({
  v: VERSION_DU_JEU_COMPLET,
  graine,
  numero: 10_000,
  gardiens: ['lg:kraken', 'lg:dragon', 'lg:oracle'],
  cartes: [carte(), carte(), carte()],
  moyen: true,
  equipee: ['lg:licorne'],
  invite: 'lg:licorne',
  chanceDeLaSource: 0.6,
  fetiche: 'Histoire',
  codex: { ...codexDuNiveau(NIVEAU_MAX, []), cartes: [...cartes] },
  ...plus,
})

/** Un journal qu'on écrit comme le serveur : chaque geste, puis ce que le pli demande de tirer — une question d'Histoire, facile, à quatre choix. */
export class Journal {
  gestes: GesteDExpedition[] = []
  questions: QuestionPosee[] = []
  reponses = new Map<number, boolean>()
  constructor(readonly depart: DepartDExpedition) {}
  etat(): EtatDeLExpedition {
    return pliDeLExpedition(this.depart, this.gestes, this.questions, this.reponses)
  }
  private tirer() {
    const e = this.etat()
    for (let k = 0; e.aTirer && k < e.aTirer.combien; k++) {
      this.questions.push({ escale: e.aTirer.escale, acte: e.aTirer.acte, reponses: 4, niveau: 'facile', tiree: 'quatre', six: true, datee: true, categorie: 'Histoire' })
    }
  }
  geste(g: GesteDExpedition): EtatDeLExpedition {
    this.gestes.push(g)
    this.tirer()
    return this.etat()
  }
  avancer(vers: string) {
    return this.geste({ quoi: 'avancer', vers })
  }
  voir(mise = 0) {
    return this.geste({ quoi: 'voir', mise, position: this.etat().enAttente! })
  }
  /** Une carte jouée ; celle qui change la forme de la question — améliorée ou non —, le serveur la repose à sa forme neuve (`questionsApresLeGeste`) : ici aussi. */
  jouer(cle: string) {
    const i = this.etat().enAttente!
    const e = this.geste({ quoi: 'jouer', joker: cle, position: i })
    const vers = formeDeLaCarte(cle)
    if (vers && e.rencontre?.tour.jouees.includes(cle)) this.questions[i] = { ...this.questions[i], forme: vers, reponses: vers === 'six' ? 6 : 2 }
    return this.etat()
  }
  /** La question qui attend, posée autrement : à une autre marche, à une autre forme. */
  poser(q: Partial<QuestionPosee>) {
    const i = this.etat().enAttente!
    this.questions[i] = { ...this.questions[i], ...q }
    return this.etat()
  }
  repondre(juste: boolean) {
    let e = this.etat()
    if (e.rencontre?.tour.phase === 'preparation') e = this.voir()
    this.reponses.set(e.enAttente!, juste)
    this.tirer()
    return this.etat()
  }
  prendre(cartes: string[] = []) {
    return this.geste({ quoi: 'prendre', jokers: cartes })
  }
  /** Tout juste, jusqu'au bout de ce qui attend. */
  gagner(): EtatDeLExpedition {
    let e = this.etat()
    for (let n = 0; n < 30 && (e.rencontre || e.enAttente !== null); n++) e = this.repondre(true)
    return e
  }
  /** L'offre qui attend : cette carte prise si elle la propose et qu'il ne l'a pas encore, sinon rien. */
  prendreSiOfferte(cle?: string) {
    const e = this.etat()
    if (!e.offre) return e
    return this.prendre(cle !== undefined && e.offre.jokers.includes(cle) && !e.paquet.includes(cle) ? [cle] : [])
  }
  /** Un acte entier, tout juste, la carte prise dès qu'on la propose ; le gardien vaincu, son trésor attend. */
  acte(cle?: string): EtatDeLExpedition {
    for (const vers of ['e00', 'e10', 'e20', 'e30']) {
      this.avancer(vers)
      this.gagner()
      this.prendreSiOfferte(cle)
    }
    this.avancer('cg')
    this.geste({ quoi: 'camper' })
    this.avancer(GARDIEN)
    return this.gagner()
  }
  /** Le même journal, à part : de quoi jouer l'autre réponse. */
  copie(): Journal {
    const k = new Journal(this.depart)
    k.gestes = [...this.gestes]
    k.questions = [...this.questions]
    k.reponses = new Map(this.reponses)
    return k
  }
  vue(): VueDeLaRencontre {
    return vueDeLaRencontre(this.depart, this.etat(), this.questions)!
  }
}

/**
 * Un journal où cette carte est dans la première main de l'élite : prise au
 * coffre de l'acte 1 — une maudite, à la première offre de l'acte 2, l'acte 1
 * n'en offrant aucune —, après une erreur à la rencontre d'en bas : au courage
 * plein, les soins ne se jouent pas. Puis le scénario, s'il y en a un, à cette
 * main. Une graine cherchée, jamais choisie : le vrai hasard du pli.
 */
export function avecEnMain(cle: string, scenario: (j: Journal) => boolean = () => true): Journal {
  const maudite = carteDeRencontre(cle)!.rarete === 'maudit'
  for (let n = 0; n < 800; n++) {
    const j = new Journal(depart(`complet:${cle}:${n}`, [cle]))
    if (maudite) {
      j.acte(cle)
      j.prendreSiOfferte(cle)
    }
    j.avancer('e00')
    j.repondre(false)
    j.gagner()
    j.prendreSiOfferte(cle)
    j.avancer('e10')
    j.prendreSiOfferte(cle)
    const e = j.avancer('e20')
    if (e.rencontre?.sorte === 'elite' && e.rencontre.main.includes(cle) && scenario(j)) return j
  }
  throw new Error(`aucune graine ne met ${cle} dans la main de l’élite`)
}

/**
 * La même chose, la carte améliorée : prise en bas ou au coffre — ou déjà là,
 * une carte du paquet de départ —, améliorée à la forge (`carteDeLaForge`),
 * puis tirée dans la première main de l'élite. `erreurs` : les mauvaises
 * réponses de la rencontre d'en bas — trois laissent 29 de courage, de quoi
 * voir ce qu'un soin rend sous le plafond.
 */
export function avecEnMainAmelioree(cle: string, scenario: (j: Journal) => boolean = () => true, erreurs = 1): Journal {
  const plus = ameliorer(cle)
  for (let n = 0; n < 1500; n++) {
    const j = new Journal(depart(`ameliore:${cle}:${n}`, [cle], { cartes: [carteDeLaForge(), carteDeLaForge(), carteDeLaForge()] }))
    j.avancer('e00')
    for (let k = 0; k < erreurs; k++) j.repondre(false)
    j.gagner()
    j.prendreSiOfferte(cle)
    j.avancer('e10')
    j.prendreSiOfferte(cle)
    j.avancer('e15')
    if (!j.geste({ quoi: 'camper', ameliorer: cle }).paquet.includes(plus)) continue
    const e = j.avancer('e20')
    if (e.rencontre?.sorte === 'elite' && e.rencontre.main.includes(plus) && scenario(j)) return j
  }
  throw new Error(`aucune graine ne met ${plus} dans la main de l’élite`)
}

/** La main du tour qui s'ouvre tient-elle cette carte ? */
export const enMain = (j: Journal, cle: string) => !!j.etat().rencontre?.main.includes(cle)

// ── La page ─────────────────────────────────────────────────────────────────

export type Composant = (props: Record<string, unknown>) => React.ReactNode
export interface Pieces {
  CarteLevee: Composant
  CarteDessinee: Composant
  RangeeDeCartes: Composant
  AvantApres: Composant
  FeuilleDuCodex: Composant
  Apercu: Composant
  FeuilleDesRegles: Composant
  apercuALaMise: (r: VueDeLaRencontre, mise: number, fetiche: string | undefined, avec?: string) => ApercuDuTour | undefined
  changementDeLaCarte: (r: VueDeLaRencontre, mise: number, fetiche: string | undefined, cle: string) => { avant: ApercuDuTour; apres: ApercuDuTour } | null
  comptesDesCartes: (cles: readonly string[]) => { cle: string; nom: string; n: number }[]
  gemmeDeLaCarte: (c: CarteDeRencontre) => Record<string, string>
  energieDite: (energie: readonly number[]) => string
}
/** Les pièces des rencontres, chargées par leur adresse : le typage du serveur ne lit pas le JSX du client. */
export const pieces = (): Promise<Pieces> => import(new URL('../../client/src/views/RencontresDExpedition.tsx', import.meta.url).href)

export const rien = () => {}

export async function rendre(composant: Composant, props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(composant, props))
}

/** Ce qu'on lit à l'écran : le texte seul, ses espaces fines rendues ordinaires. */
export const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/[\s  ]+/g, ' ')
