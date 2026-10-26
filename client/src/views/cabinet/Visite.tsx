import { useContext, useId } from 'react'
import { OeuvrePeinte, RARETE_DITE } from '../../components/OeuvrePeinte'
import { PieceTete, Sortie } from '../../components/Pieces'
import { espacesFines } from '../../format'
import { toucher } from '../../toucher'
import { CLES_DES_JEUX, JEUX } from '../../../../shared/cabinet/jeux/regle'
import { JEU_PAS_LIVRE, SON_OEUVRE_EST_A_TOI, type EnjeuDUneCase } from '../../../../shared/cabinet/musee'
import { oeuvre as oeuvreDe } from '../../../../shared/cabinet/oeuvres'
import type { IssueDUnePartie, Manche } from '../../../../shared/cabinet/partie'
import { salle } from '../../../../shared/cabinet/salles'
import type { CaseVue, PageDuCabinet } from '../../../../shared/cabinet/vues'
import { RetourAuMusee, type PartieDemandee } from './ecrans'
import { caseEnCours, casesFaites, compte, laPartieQuiAttend } from './Musee'
import { BoutonReprendre, PartieQuiAttend } from './PartieQuiAttend'
import { oeuvreMontree } from './Salle'

// Ce que la journée propose : la visite du jour — trois parties, trois jeux,
// chacune une œuvre en jeu qu'elle ne nomme pas tant qu'elle n'est pas
// gagnée (invariant 1 : la page ne la reçoit même pas) — et les jeux libres,
// à volonté. Rien ne coûte avant « Commencer », à l'annonce : toucher une
// case ou un jeu n'y mène que. Une case commencée et pas finie est la partie
// qui attend — « En cours », « Reprendre » ; manquée, son œuvre se retente au
// même jeu pour une chasse, par sa case (`CaseVue.retenter`).
//
// Chaque geste passe au lever du doigt (`toucher`) : l'annonce ou la manche
// paraît sous lui. Et chacun se nomme à l'oreille de son jeu — trois « Jouer »
// et trois « Changer de jeu » de même nom, Hugo ne savait lequel il touchait
// (la tablée du 25 octobre 2026) ; à l'œil, rien ne change.

/**
 * L'œuvre qu'une case — ou une partie — met en jeu « pour dorer » a-t-elle déjà son cadre doré ? Dorée dans la journée — la
 * dorure achetée, une chasse —, sa case reste « pour dorer » (`enjeuDe` ne lit que la possession) : il n'y a plus qu'un double à
 * y gagner (`issueDe`), et l'annonce promettait encore le cadre (la relecture du lot page-2). La page le lit de ses salles.
 */
export function dejaDoree(page: Pick<PageDuCabinet, 'salles'>, enJeu: EnjeuDUneCase | null): boolean {
  if (!enJeu || !('pourDorer' in enJeu)) return false
  const cle = enJeu.pourDorer
  return page.salles.some(s => s.oeuvres.some(o => o.cle === cle && o.doree))
}

/**
 * Ce qu'une case met en jeu, en clair : une rareté et une salle, l'œuvre à dorer — elle est à lui —, ou la poussière d'or. Son
 * cadre déjà doré (`doree`, `dejaDoree`), l'œuvre ne se joue plus que pour son double.
 */
export function enJeuDit(enJeu: EnjeuDUneCase, doree = false): string {
  if ('pourDorer' in enJeu) {
    const nom = oeuvreDe(enJeu.pourDorer)?.nom ?? 'ton œuvre'
    return doree ? `Pour un double de ${nom}` : `Pour dorer ${nom}`
  }
  if ('poussiere' in enJeu) return 'Pour la poussière d’or'
  return `Peut te faire gagner une œuvre ${RARETE_DITE[enJeu.rarete]} ${salle(enJeu.salle)?.deLaSalle ?? ''}`.trimEnd()
}

/**
 * L'œuvre d'une case manquée est-elle à lui depuis ? Gagnée en chasse ou achetée après la partie, elle fait passer sa case
 * « pour dorer » (`enjeuDe`) ; et seule une case qui visait une œuvre à gagner porte `retenter` (`retenteDeLaCase` n'en dit rien
 * d'une case qui était pour dorer) : les deux ensemble ne disent rien d'autre. Le serveur refuse alors la retente — mais dit
 * d'abord la partie qui attend, ou les chasses prises (`cadreDuDepart`) : la case ne lit pas l'ordre de ses refus. Elle disait
 * « Pas de dorure cette fois », et « Retenter » en sourdine pour une œuvre déjà à lui (la relecture du lot page-2).
 */
const sonOeuvreEstALui = (c: Pick<CaseVue, 'enJeu' | 'retenter'>): boolean => c.retenter?.refus === SON_OEUVRE_EST_A_TOI || (c.retenter !== undefined && 'pourDorer' in c.enJeu)

/** « Retenter » tel qu'une case faite le montre : celui du serveur, sauf quand son œuvre est à lui — plus rien à retenter. */
const laRetenteMontree = (c: CaseVue): NonNullable<CaseVue['retenter']> | null => (c.faite && c.retenter && !sonOeuvreEstALui(c) ? c.retenter : null)

/** Ce qu'une case faite a donné. Manquée, ce qui reste à faire : rien pour dorer, et « Retenter » pour son œuvre. */
function issueDite(c: CaseVue): string {
  const nom = c.oeuvre && oeuvreDe(c.oeuvre)?.nom
  if (c.issue === 'manquee') {
    if (sonOeuvreEstALui(c)) return SON_OEUVRE_EST_A_TOI
    if ('pourDorer' in c.enJeu) return 'Pas de dorure cette fois'
    return c.retenter?.possible ? 'L’œuvre reste à gagner : retente-la pour une chasse' : 'L’œuvre reste à gagner'
  }
  const issues: Record<Exclude<IssueDUnePartie, 'manquee'>, string> = {
    gagnee: `Tu as gagné ${nom ?? 'son œuvre'}`,
    'gagnee-doree': `Tu as gagné ${nom ?? 'son œuvre'}, dans un cadre doré`,
    doree: `${nom ?? 'Son œuvre'} a pris son cadre doré`,
    double: 'Une œuvre déjà à toi : sa poussière d’or en plus',
    libre: 'Pour la poussière d’or',
  }
  return c.issue ? issues[c.issue] : enJeuDit(c.enJeu)
}

/**
 * « Retenter cette œuvre au Pari · une chasse », sous la case manquée et au
 * bilan de sa partie : il part, ou se met en sourdine avec la raison du
 * serveur (`aria-disabled`, jamais `disabled` : le focus resterait sur un
 * bouton mort), qu'il désigne à l'oreille. Son œuvre gagnée depuis, il n'y a
 * plus rien à retenter : la case le dit, sans bouton. `dite` : l'identifiant
 * d'une raison que l'écran dit déjà, plus haut — la partie qui attend, dite une
 * fois au-dessus des cases avec son « Reprendre » : il la désigne sans la
 * redire, sans quoi chaque case manquée la répétait sous elle.
 */
export function BoutonRetenter({
  jeu,
  retenter,
  id,
  dite,
  busy = false,
  classe = 'btn',
  onRetenter,
}: {
  jeu: CaseVue['jeu']
  retenter: NonNullable<CaseVue['retenter']>
  id: string
  dite?: string
  busy?: boolean
  classe?: string
  onRetenter: () => void
}) {
  if (retenter.refus === SON_OEUVRE_EST_A_TOI) return null
  const refus = retenter.possible ? null : (retenter.refus ?? null)
  return (
    <>
      <button
        type="button"
        className={classe}
        aria-disabled={refus !== null || busy || undefined}
        aria-describedby={refus === null ? undefined : (dite ?? id)}
        {...toucher(() => refus === null && !busy && onRetenter())}
      >
        {espacesFines(`Retenter cette œuvre ${JEUX[jeu].a} · une chasse`)}
      </button>
      {refus !== null && dite === undefined && (
        <p id={id} className="cab-raison">
          {espacesFines(refus)}
        </p>
      )}
    </>
  )
}

/** La raison qui éteint les gestes de la visite — une partie attend, et rien d'autre ne part —, dite une fois au-dessus des cases. */
interface LaPartieAttendIci {
  /** Ce que chaque geste éteint désigne à l'oreille (`aria-describedby`). */
  id: string
  /** Ses mots, ceux du serveur (`laPartieAttend`) : un « Retenter » refusé pour elle la reconnaît à eux. */
  raison: string
}

/**
 * Une case de la visite. `attend` : la raison qui éteint son « Jouer », et son
 * « Retenter » quand le serveur le refuse pour elle — dite une fois au-dessus
 * des cases, que chacun désigne à l'oreille. `ici` : c'est sa partie qui
 * attend (`caseEnCours`). `doree` : son œuvre à dorer a déjà son cadre
 * (`dejaDoree`).
 */
function CaseDeLaVisite({
  c,
  k,
  ici,
  doree,
  echange,
  attend,
  busy,
  onJouer,
  onEchanger,
  onReprendre,
}: {
  c: CaseVue
  k: Manche
  ici: boolean
  doree: boolean
  echange: boolean
  attend: LaPartieAttendIci | null
  busy: boolean
  onJouer: (p: PartieDemandee) => void
  onEchanger: (k: Manche) => void
  onReprendre?: () => void
}) {
  const idDeLaRetente = useId()
  const jeu = JEUX[c.jeu]
  // Montrée seulement quand elle est à lui : gagnée, ou la case qui la dore.
  const montree = c.oeuvre ?? ('pourDorer' in c.enJeu ? c.enJeu.pourDorer : undefined)
  const o = montree && oeuvreDe(montree)
  const faite = c.faite && !ici
  const retente = faite ? laRetenteMontree(c) : null
  return (
    <li className={'cab-case' + (faite ? ' cab-faite' : '')}>
      <span className="cab-vignette" aria-hidden="true">
        {/* Son cadre déjà doré se voit : la ligne dit « Pour un double », la peinture dit pourquoi. */}
        {o ? <OeuvrePeinte oeuvre={oeuvreMontree(o, o.salle)} taille="main" doree={doree} /> : <span className="cab-inconnue">?</span>}
      </span>
      <span className="cab-case-texte">
        <span className="cab-surtitre">{ici ? 'En cours' : faite ? 'Faite' : 'À jouer'}</span>
        <b className="cab-case-jeu">{jeu.nom}</b>
        <span className="cab-ligne">{espacesFines(faite ? issueDite(c) : enJeuDit(c.enJeu, doree))}</span>
        {/* La partie qui attend, c'est elle : elle se reprend d'ici, son chrono n'a pas attendu. */}
        {ici && onReprendre && (
          <span className="cab-gestes">
            <BoutonReprendre classe="btn btn-primary" onReprendre={onReprendre} />
          </span>
        )}
        {retente && (
          <span className="cab-gestes">
            <BoutonRetenter
              jeu={c.jeu}
              retenter={retente}
              id={idDeLaRetente}
              dite={attend && retente.refus === attend.raison ? attend.id : undefined}
              busy={busy}
              onRetenter={() => onJouer({ origine: 'chasse', case: k, retente: true })}
            />
          </span>
        )}
        {!c.faite && c.bientot && <span className="cab-raison">{JEU_PAS_LIVRE}</span>}
        {/* Un jeu qui n'est pas encore là ne se joue pas, mais il se change : l'échange est ce qui rend sa case jouable. */}
        {!c.faite && (!c.bientot || echange) && (
          <span className="cab-gestes">
            {!c.bientot && (
              <button
                type="button"
                className="btn btn-primary"
                aria-label={`Jouer ${jeu.a}`}
                aria-disabled={busy || attend !== null || undefined}
                aria-describedby={attend?.id}
                {...toucher(() => !busy && attend === null && onJouer({ origine: 'visite', case: k }))}
              >
                Jouer
              </button>
            )}
            {/* Changer de jeu ne fait rien partir : le serveur l'accepte pendant une partie (`refusDeLEchange`). */}
            {echange && (
              <button type="button" className="btn" aria-label={`Changer de jeu : ${jeu.nom}`} aria-disabled={busy || undefined} {...toucher(() => !busy && onEchanger(k))}>
                Changer de jeu
              </button>
            )}
          </span>
        )}
      </span>
    </li>
  )
}

export function Visite({
  page,
  busy,
  onJouer,
  onEchanger,
  onReprendre,
}: {
  page: PageDuCabinet
  busy: boolean
  onJouer: (p: PartieDemandee) => void
  onEchanger: (k: Manche) => void
  /** La partie qui attend, rouverte telle que la page la tient. */
  onReprendre?: () => void
}) {
  const auMusee = useContext(RetourAuMusee)
  const idDeLAttente = useId()
  const { cases, echange } = page.visite
  // « Changer de jeu » : sur chaque case pas encore jouée, tant que la règle des échanges (`refusDeLEchange`, au serveur) le
  // permet — une fois par jour, la case de son choix. Elle ne dépend de la case que par « déjà jouée », que `faite` dit déjà.
  const aJouerEncore = cases.some(c => !c.faite)
  // Une partie qui attend éteint chaque « Jouer », comme la chasse d'une œuvre : sinon l'annonce s'ouvrait, et « Commencer » ne
  // le disait qu'en toast. Elle éteint aussi « Retenter » (le serveur le refuse pour elle) — et la retente même est une chasse.
  // Sa raison se dit une fois, s'il reste un geste qu'elle éteint, au-dessus des cases : sous la troisième, elle tombait sous le
  // pli en 360 × 640, et les gestes en sourdine ne disaient pas pourquoi ; sous chaque case manquée, elle se répétait, et les
  // trois faites, la visite la disait trois fois sans un seul « Reprendre » (la relecture du lot page-2).
  const raison = laPartieQuiAttend(page)
  const eteinte = (c: CaseVue) => (!c.faite && !c.bientot) || (raison !== null && laRetenteMontree(c)?.refus === raison)
  const attend = raison !== null && cases.some(eteinte) ? { id: idDeLAttente, raison } : null
  // Une partie de la visite qui attend se reprend de sa case : « Reprendre » une seule fois, là où elle se joue. Une chasse ou une
  // libre, sous la raison.
  const saCase = cases.some(c => caseEnCours(c, page.enCours))
  const faites = casesFaites(page)
  const { jours, aJouer } = page.serie
  return (
    <div className="player-shell cab-page">
      <Sortie vers="Le Cabinet" href="/cabinet" onClick={auMusee} />
      <PieceTete piece={`${faites} sur ${cases.length} faite${faites > 1 ? 's' : ''}`} titre="La visite du jour" />
      <p className="cab-ligne">{espacesFines('Chacune peut te faire gagner une œuvre : tu la découvres en la gagnant.')}</p>
      {attend && <PartieQuiAttend page={page} id={idDeLAttente} enTete onReprendre={saCase ? undefined : onReprendre} />}
      <ol className="cab-cases">
        {cases.map((c, k) => (
          <CaseDeLaVisite
            key={k}
            c={c}
            k={k as Manche}
            ici={caseEnCours(c, page.enCours)}
            doree={dejaDoree(page, c.enJeu)}
            echange={echange.possible && !c.faite}
            attend={attend}
            busy={busy}
            onJouer={onJouer}
            onEchanger={onEchanger}
            onReprendre={onReprendre}
          />
        ))}
      </ol>
      {!echange.possible && echange.refus && aJouerEncore && <p className="cab-raison">{espacesFines(echange.refus)}</p>}
      <section className="cab-bloc" aria-labelledby="cab-la-chasse">
        <h2 id="cab-la-chasse">{espacesFines(`La chasse · ${compte(page.chasses.restent, 'chasse')} aujourd’hui`)}</h2>
        <p className="cab-ligne">{espacesFines('Dans une salle, touche un cadre vide : il dit où chercher son œuvre.')}</p>
      </section>
      {jours > 0 && (jours > 1 || aJouer) && <p className="cab-ligne">{espacesFines(`${compte(jours, 'jour')} de visite d’affilée${aJouer ? ' : joue aujourd’hui pour garder ta série.' : '.'}`)}</p>}
    </div>
  )
}

export function JouerLibrement({ page, onJouer, onReprendre }: { page: PageDuCabinet; onJouer: (p: PartieDemandee) => void; onReprendre?: () => void }) {
  const auMusee = useContext(RetourAuMusee)
  const idDeLAttente = useId()
  const paient = page.libres.paientEncore
  // Une partie qui attend éteint les neuf jeux : sa raison se dit une fois, au-dessus — sous le dernier des neuf, elle tombait
  // loin sous le pli —, et « Reprendre » sous elle.
  const attend = laPartieQuiAttend(page)
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
      {attend && <PartieQuiAttend page={page} id={idDeLAttente} enTete onReprendre={onReprendre} />}
      {/* Ceux qui se jouent d'abord, dans l'ordre du Cabinet : au milieu des sept qui arrivent, le Pari et l'Éclair se cherchaient. */}
      <ul className="cab-jeux">
        {[...CLES_DES_JEUX].sort((a, c) => Number(!page.jeux.includes(a)) - Number(!page.jeux.includes(c))).map(j => {
          const pret = page.jeux.includes(j)
          return (
            <li key={j}>
              <button
                type="button"
                className="cab-jeu"
                aria-disabled={!pret || attend !== null || undefined}
                aria-describedby={attend === null ? undefined : idDeLAttente}
                {...toucher(() => pret && attend === null && onJouer({ origine: 'libre', jeu: j }))}
              >
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
