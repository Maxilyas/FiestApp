import { useContext } from 'react'
import { OeuvrePeinte, RARETE_DITE } from '../../components/OeuvrePeinte'
import { PieceTete, Sortie } from '../../components/Pieces'
import { espacesFines } from '../../format'
import { CLES_DES_JEUX, JEUX } from '../../../../shared/cabinet/jeux/regle'
import type { EnjeuDUneCase } from '../../../../shared/cabinet/musee'
import { oeuvre as oeuvreDe } from '../../../../shared/cabinet/oeuvres'
import type { IssueDUnePartie, Manche } from '../../../../shared/cabinet/partie'
import { salle } from '../../../../shared/cabinet/salles'
import type { CaseVue, PageDuCabinet } from '../../../../shared/cabinet/vues'
import { RetourAuMusee, type PartieDemandee } from './ecrans'
import { compte } from './Musee'
import { oeuvreMontree } from './Salle'

// Ce que la journée propose : la visite du jour — trois parties, trois jeux,
// chacune une œuvre en jeu qu'elle ne nomme pas tant qu'elle n'est pas
// gagnée (invariant 1 : la page ne la reçoit même pas) — et les jeux libres,
// à volonté. Rien ne coûte avant « Commencer », à l'annonce : toucher une
// case ou un jeu n'y mène que.

/** Ce qu'une case met en jeu, en clair : une rareté et une salle, l'œuvre à dorer — elle est à lui —, ou la poussière d'or. */
export function enJeuDit(enJeu: EnjeuDUneCase): string {
  if ('pourDorer' in enJeu) return `Pour dorer ${oeuvreDe(enJeu.pourDorer)?.nom ?? 'ton œuvre'}`
  if ('poussiere' in enJeu) return 'Pour la poussière d’or'
  return `Peut te faire gagner une œuvre ${RARETE_DITE[enJeu.rarete]} ${salle(enJeu.salle)?.deLaSalle ?? ''}`.trimEnd()
}

/** Ce qu'une case faite a donné. */
function issueDite(c: CaseVue): string {
  const nom = c.oeuvre && oeuvreDe(c.oeuvre)?.nom
  const issues: Record<IssueDUnePartie, string> = {
    gagnee: `Tu as gagné ${nom ?? 'son œuvre'}`,
    'gagnee-doree': `Tu as gagné ${nom ?? 'son œuvre'}, dans un cadre doré`,
    doree: `${nom ?? 'Son œuvre'} a pris son cadre doré`,
    double: 'Une œuvre déjà à toi : sa poussière d’or en plus',
    manquee: 'L’œuvre reste à gagner',
    libre: 'Pour la poussière d’or',
  }
  return c.issue ? issues[c.issue] : 'Commencée'
}

function CaseDeLaVisite({ c, k, echange, busy, onJouer, onEchanger }: { c: CaseVue; k: Manche; echange: boolean; busy: boolean; onJouer: (p: PartieDemandee) => void; onEchanger: (k: Manche) => void }) {
  const jeu = JEUX[c.jeu]
  // Montrée seulement quand elle est à lui : gagnée, ou la case qui la dore.
  const montree = c.oeuvre ?? ('pourDorer' in c.enJeu ? c.enJeu.pourDorer : undefined)
  const o = montree && oeuvreDe(montree)
  return (
    <li className={'cab-case' + (c.faite ? ' cab-faite' : '')}>
      <span className="cab-vignette" aria-hidden="true">
        {o ? <OeuvrePeinte oeuvre={oeuvreMontree(o, o.salle)} taille="main" /> : <span className="cab-inconnue">?</span>}
      </span>
      <span className="cab-case-texte">
        <span className="cab-surtitre">{c.faite ? 'Faite' : 'À jouer'}</span>
        <b className="cab-case-jeu">{jeu.nom}</b>
        <span className="cab-ligne">{espacesFines(c.faite ? issueDite(c) : enJeuDit(c.enJeu))}</span>
        {!c.faite &&
          (c.bientot ? (
            <span className="cab-raison">Ce jeu arrive bientôt</span>
          ) : (
            <span className="cab-gestes">
              <button type="button" className="btn btn-primary" aria-disabled={busy || undefined} onClick={() => !busy && onJouer({ origine: 'visite', case: k })}>
                Jouer
              </button>
              {echange && (
                <button type="button" className="btn" aria-disabled={busy || undefined} onClick={() => !busy && onEchanger(k)}>
                  Changer de jeu
                </button>
              )}
            </span>
          ))}
      </span>
    </li>
  )
}

export function Visite({ page, busy, onJouer, onEchanger }: { page: PageDuCabinet; busy: boolean; onJouer: (p: PartieDemandee) => void; onEchanger: (k: Manche) => void }) {
  const auMusee = useContext(RetourAuMusee)
  const { cases, echange } = page.visite
  // « Changer de jeu » : une fois par jour, sur la première case pas encore jouée — la règle des échanges, au serveur, dit si c'est possible.
  const aEchanger = echange.possible ? cases.findIndex(c => !c.faite) : -1
  const { jours, aJouer } = page.serie
  return (
    <div className="player-shell cab-page">
      <Sortie vers="Le Cabinet" href="/cabinet" onClick={auMusee} />
      <PieceTete piece={`${cases.filter(c => c.faite).length} sur ${cases.length} faite${cases.filter(c => c.faite).length > 1 ? 's' : ''}`} titre="La visite du jour" />
      <p className="cab-ligne">{espacesFines('Chacune peut te faire gagner une œuvre : tu la découvres en la gagnant.')}</p>
      <ol className="cab-cases">
        {cases.map((c, k) => (
          <CaseDeLaVisite key={k} c={c} k={k as Manche} echange={k === aEchanger} busy={busy} onJouer={onJouer} onEchanger={onEchanger} />
        ))}
      </ol>
      {echange.refus && aEchanger < 0 && cases.some(c => !c.faite) && <p className="cab-raison">{espacesFines(echange.refus)}</p>}
      <section className="cab-bloc" aria-labelledby="cab-la-chasse">
        <h2 id="cab-la-chasse">{espacesFines(`La chasse · ${compte(page.chasses.restent, 'chasse')} aujourd’hui`)}</h2>
        <p className="cab-ligne">{espacesFines('Dans une salle, touche un cadre vide : il dit où chercher son œuvre.')}</p>
      </section>
      {jours > 0 && (jours > 1 || aJouer) && <p className="cab-ligne">{espacesFines(`${compte(jours, 'jour')} de visite d’affilée${aJouer ? ' : joue aujourd’hui pour garder ta série.' : '.'}`)}</p>}
    </div>
  )
}

export function JouerLibrement({ page, onJouer }: { page: PageDuCabinet; onJouer: (p: PartieDemandee) => void }) {
  const auMusee = useContext(RetourAuMusee)
  const paient = page.libres.paientEncore
  return (
    <div className="player-shell cab-page">
      <Sortie vers="Le Cabinet" href="/cabinet" onClick={auMusee} />
      <PieceTete piece="Sans œuvre en jeu" titre="Jouer librement" />
      <p className="cab-ligne">
        {espacesFines(
          paient > 1
            ? `Tes ${paient} prochaines parties rapportent de la poussière d’or ; ensuite, c’est pour le plaisir.`
            : paient === 1
              ? 'Ta prochaine partie rapporte de la poussière d’or ; ensuite, c’est pour le plaisir.'
              : 'Pour aujourd’hui, c’est pour le plaisir : la poussière d’or revient à minuit.',
        )}
      </p>
      {/* Ceux qui se jouent d'abord, dans l'ordre du Cabinet : au milieu des sept qui arrivent, le Pari et l'Éclair se cherchaient. */}
      <ul className="cab-jeux">
        {[...CLES_DES_JEUX].sort((a, c) => Number(!page.jeux.includes(a)) - Number(!page.jeux.includes(c))).map(j => {
          const pret = page.jeux.includes(j)
          return (
            <li key={j}>
              <button type="button" className="cab-jeu" aria-disabled={!pret || undefined} onClick={() => pret && onJouer({ origine: 'libre', jeu: j })}>
                <b className="cab-case-jeu">{JEUX[j].nom}</b>
                <span className="cab-ligne">{espacesFines(JEUX[j].geste)}</span>
                {!pret && <span className="cab-pastille">bientôt</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
