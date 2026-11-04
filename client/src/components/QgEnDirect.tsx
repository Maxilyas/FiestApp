import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { Etincelle, GrapheDuTemps, TuileDuQg } from './QgGraphes'
import { LigneDeSoiree } from './QgVueDEnsemble'
import { NomDeLaRoute } from './QgServeur'
import { fluxDuQg } from '../qgFlux'
import { formatNumber } from '../../../shared/typographie'
import { MODES_DU_QG, NOM_DU_MODE, heureEcrite } from '../../../shared/qg'
import { MEMOIRE_DE_L_HEBERGEUR_MO, PROCESSEUR_DE_L_HEBERGEUR_PCT, tempsDeReponse } from '../../../shared/santeDuServeur'
import { APPELS_POUR_LE_RESSENTI, NOM_DE_LA_GRAVITE, REGLE, depasse, graviteDe, seuilEcrit, type CleDeRegle, type Gravite, type SeuilsDesRegles } from '../../../shared/qgAlertes'
import { FILTRES_DU_FIL, POINTS_DU_DIRECT, type EvenementDuFil, type PointDuDirect, type RouteDuDirect, type SorteDuFil } from '../../../shared/qgDirect'

/**
 * Le direct du QG (`/admin#direct`, le QG 2, lot 3, le 4 novembre 2026 : « je
 * ne peux pas … voir … sur du temps réel ») : la seconde du serveur, poussée
 * toutes les deux secondes par le flux (`qgFlux.ts`) — huit compteurs, qui
 * joue à quoi en ce moment, quinze minutes au pas de dix secondes, le fil de
 * ce qui arrive, les routes de la dernière minute, les soirées en cours. Tout
 * vient de la mémoire du serveur : la page ne coûte rien à Turso, et ce
 * qu'elle montre s'efface au redémarrage.
 */
export function QgEnDirect({ ouvrir }: { ouvrir: (e: 'soirees' | 'serveur' | 'erreurs', onglet?: string) => void }) {
  const etat = useSyncExternalStore(fluxDuQg.abonner, fluxDuQg.lire)
  const vivant = useSyncExternalStore(fluxDuQg.abonner, fluxDuQg.estVivant)
  // La page le demande aussi : ouverte seule — un onglet sur `/admin#direct` —, elle a son flux.
  useEffect(() => fluxDuQg.demarrer(), [])

  if (!etat.enCours) {
    return (
      <p className="serif-note" aria-live="polite">
        {vivant ? 'Le direct arrive…' : 'Le direct se branche… S’il ne vient pas, la page relit le serveur toutes les dix secondes.'}
      </p>
    )
  }
  const points = [...etat.points, etat.enCours].slice(-POINTS_DU_DIRECT)
  return (
    <>
      <p className={'qg-direct-etat' + (vivant ? '' : ' qg-direct-etat-coupe')} role="status">
        <span className="qg-vif-point" aria-hidden="true" />
        {vivant
          ? 'Relu toutes les deux secondes, dans la mémoire du serveur : rien n’en coûte à Turso, et tout s’efface à son redémarrage.'
          : `Le flux s’est tu à ${heureEcrite(etat.maintenant)} : la page relit le direct toutes les dix secondes, et rouvre le flux.`}
      </p>
      <Compteurs points={points} etat={etat} ouvrir={ouvrir} />
      <QuiJoue points={points} />
      <Courbes points={points} plafondProcesseur={etat.plafonds.processeurPct ?? PROCESSEUR_DE_L_HEBERGEUR_PCT} />
      <div className="qg-direct-bas">
        <LeFil fil={etat.fil} maintenant={etat.maintenant} />
        <RoutesDeLaMinute routes={etat.routes} seuils={etat.direct?.seuils ?? {}} />
      </div>
      {etat.direct && etat.direct.soirees.length > 0 && (
        <section className="qg-console" aria-labelledby="direct-soirees">
          <div className="qg-console-tete">
            <div>
              <span className="qg-etiquette">Les soirées</span>
              <h2 id="direct-soirees">En cours, salon par salon</h2>
              <span className="muted small">des chiffres, rien d’autre : où elle en est, ses téléphones, sa sauvegarde</span>
            </div>
            <button type="button" className="qg-bouton" onClick={() => ouvrir('soirees')}>
              Les soirées
              <Icon name="arrow-right" />
            </button>
          </div>
          <ul className="qg-liste">
            {etat.direct.soirees.map(s => (
              <LigneDeSoiree key={s.spaceId} s={s} maintenant={etat.direct!.maintenant} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

const somme = (ps: readonly PointDuDirect[], f: (p: PointDuDirect) => number) => ps.reduce((s, p) => s + f(p), 0)
const dernierConnu = (ps: readonly PointDuDirect[], f: (p: PointDuDirect) => number | null): number | null => {
  for (let i = ps.length - 1; i >= 0; i--) {
    const v = f(ps[i])
    if (v !== null) return v
  }
  return null
}

/**
 * Un compteur : son nom, sa valeur dite avec son unité, ce qu'elle veut dire, et sa courbe des quinze minutes. Passé le
 * seuil de sa règle, il en prend l'état — sa bordure, une icône et le mot de sa gravité —, jamais la couleur seule.
 */
function Compteur({
  nom,
  valeur,
  detail,
  courbe,
  gravite = null,
  onOuvrir,
}: {
  nom: string
  valeur: string
  detail: ReactNode
  courbe: number[]
  gravite?: Gravite | null
  onOuvrir?: () => void
}) {
  const contenu = (
    <>
      <span className="qg-tuile-nom">
        {gravite && <Icon name="alert" />}
        {nom}
      </span>
      <span className="qg-tuile-valeur num">{valeur}</span>
      <span className="qg-ecart qg-tuile-detail">
        {gravite && <span className={`qg-gravite qg-gravite-${gravite}`}>{NOM_DE_LA_GRAVITE[gravite]}</span>}
        {detail}
      </span>
      {courbe.length > 1 && <Etincelle valeurs={courbe} />}
    </>
  )
  const classe = 'qg-tuile' + (gravite ? ` qg-tuile-alerte qg-tuile-${gravite}` : '')
  return onOuvrir ? (
    <li className={classe + ' qg-tuile-ouvre'}>
      <button type="button" onClick={onOuvrir}>
        {contenu}
      </button>
    </li>
  ) : (
    <li className={classe}>{contenu}</li>
  )
}

/**
 * Huit compteurs, la dernière minute ou l'instant : qui est là, ce que le
 * serveur sert et en combien de temps, ce qui casse, ce qu'il lui reste —
 * chacun sa courbe des quinze minutes. Chacun se juge au seuil réglé de sa
 * règle, celui du voyant du poste de commande (`graviteDe`, que le direct
 * prête) : un seuil écrit ici rougissait à 800 ms quand la règle était réglée
 * à 900, et un gel de 25,8 s restait neutre (la revue d'ergonomie du
 * 4 novembre 2026). Le processeur, sans règle, au-delà de la part que
 * l'hébergeur donne, comme son voyant.
 */
function Compteurs({ points, etat, ouvrir }: { points: PointDuDirect[]; etat: ReturnType<typeof fluxDuQg.lire>; ouvrir: (e: 'serveur' | 'erreurs', onglet?: string) => void }) {
  const minute = points.slice(-7, -1)
  const cinqMinutes = points.slice(-31)
  const d = etat.direct
  const seuils: SeuilsDesRegles = d?.seuils ?? {}
  const enLigne = d ? d.profilsEnLigne + d.invitesConnectes : null
  const ressenti = d?.serveur.routesP95Ms ?? null
  const erreurs = somme(cinqMinutes, p => p.erreurs)
  const processeur = dernierConnu(points, p => p.processeur)
  const memoire = dernierConnu(points, p => p.memoireMo)
  const gel = minute.length ? Math.max(0, ...minute.map(p => p.boucleMaxMs ?? 0)) : null
  const turso = d?.serveur.baseP95Ms ?? null
  const plafondMo = etat.plafonds.memoireMo ?? MEMOIRE_DE_L_HEBERGEUR_MO
  const plafondPct = etat.plafonds.processeurPct ?? PROCESSEUR_DE_L_HEBERGEUR_PCT
  /** « seuil 3 s » : ce qu'un compteur passé son seuil dit après le mot de sa gravité. */
  const auSeuil = (cle: CleDeRegle, g: Gravite | null) => (g ? ` · seuil ${seuilEcrit(cle, seuils[cle] ?? REGLE[cle].seuil?.defaut ?? 0)}` : '')
  const lent = (d?.serveur.routesParMin ?? 0) >= APPELS_POUR_LE_RESSENTI ? graviteDe('ressenti', ressenti, seuils) : null
  const pleine = graviteDe('memoire', memoire, seuils)
  const gele = graviteDe('gel-long', gel, seuils)
  const tursoLent = graviteDe('turso-lent', turso, seuils)
  return (
    <section className="qg-chiffres" aria-labelledby="direct-maintenant">
      <div className="qg-section-tete">
        <h2 className="compte-groupe" id="direct-maintenant">
          Maintenant
        </h2>
      </div>
      <ul className="qg-tuiles qg-tuiles-quatre">
        <Compteur
          nom="En ligne"
          valeur={enLigne === null ? '–' : formatNumber(enLigne)}
          detail={d ? `${formatNumber(d.profilsEnLigne)} profil${d.profilsEnLigne > 1 ? 's' : ''} · ${formatNumber(d.invitesConnectes)} en soirée` : 'le direct arrive'}
          courbe={points.map(p => p.invites ?? 0)}
        />
        <Compteur nom="Requêtes" valeur={formatNumber(somme(minute, p => p.requetes))} detail="sur la dernière minute" courbe={points.map(p => p.requetes)} />
        <Compteur
          nom="Ce qu’un joueur attend"
          valeur={ressenti === null ? '–' : tempsDeReponse(ressenti)}
          detail={d?.serveur.routesParMin ? `pour 19 appels sur 20 · ${formatNumber(d.serveur.routesParMin)} cette minute${auSeuil('ressenti', lent)}` : 'aucun appel sur la minute'}
          courbe={points.map(p => p.routes?.p95 ?? 0)}
          gravite={lent}
          onOuvrir={() => ouvrir('serveur')}
        />
        <Compteur
          nom="Erreurs serveur"
          valeur={formatNumber(erreurs)}
          detail="ces cinq dernières minutes"
          courbe={points.map(p => p.erreurs)}
          gravite={erreurs > 0 ? REGLE.erreurs.gravite : null}
          onOuvrir={() => ouvrir('erreurs')}
        />
        <Compteur
          nom="Processeur"
          valeur={processeur === null ? '–' : `${formatNumber(processeur)} %`}
          detail={`d’un cœur · l’hébergeur en donne ${formatNumber(plafondPct)} %`}
          courbe={points.map(p => p.processeur ?? 0)}
          gravite={processeur !== null && processeur >= plafondPct ? 'veille' : null}
        />
        <Compteur
          nom="Mémoire"
          valeur={memoire === null ? '–' : `${formatNumber(memoire)} Mo`}
          detail={`sur ${formatNumber(plafondMo)} Mo${auSeuil('memoire', pleine)}`}
          courbe={points.map(p => p.memoireMo ?? 0)}
          gravite={pleine}
        />
        {/* « La boucle » ne parlait qu'à un ingénieur : ce qu'on lit, c'est le serveur qui ne répond plus à personne. Il
            ouvre « Ce qui gèle », où l'on voit ce qui tournait. */}
        <Compteur
          nom="Pire gel"
          valeur={gel === null ? '–' : tempsDeReponse(gel)}
          detail={`le serveur figé d’un tenant, sur la minute${auSeuil('gel-long', gele)}`}
          courbe={points.map(p => p.boucleMaxMs ?? 0)}
          gravite={gele}
          onOuvrir={() => ouvrir('serveur', 'gels')}
        />
        <Compteur
          nom="Turso"
          valeur={turso === null ? '–' : tempsDeReponse(turso)}
          detail={`pour 19 allers-retours sur 20${auSeuil('turso-lent', tursoLent)}`}
          courbe={points.map(p => p.base?.p95 ?? 0)}
          gravite={tursoLent}
        />
      </ul>
    </section>
  )
}

/**
 * Qui joue, mode par mode : les profils passés sur ses routes ces cinq
 * dernières minutes — en soirée, les téléphones connectés —, et ses quinze
 * minutes. Des nombres : le serveur ne dit pas qui.
 */
function QuiJoue({ points }: { points: PointDuDirect[] }) {
  const maintenant = points[points.length - 1]
  return (
    <section className="qg-chiffres" aria-labelledby="direct-modes">
      <div className="qg-section-tete">
        <h2 className="compte-groupe" id="direct-modes">
          Qui joue, en ce moment
        </h2>
        <span className="muted small">les profils passés ces cinq minutes ; en soirée, les téléphones connectés</span>
      </div>
      <ul className="qg-tuiles qg-tuiles-cinq">
        {MODES_DU_QG.map(m => (
          <TuileDuQg
            key={m}
            nom={NOM_DU_MODE[m]}
            mode={m}
            valeur={maintenant.modes[m]}
            detail={m === 'soiree' ? 'téléphones connectés' : maintenant.modes[m] > 1 ? 'profils' : 'profil'}
            etincelle={points.map(p => p.modes[m])}
          />
        ))}
      </ul>
    </section>
  )
}

/** « 21 h 40 min 10 s » : un pas de dix secondes, à la seconde près. */
function aLaSeconde(t: number): string {
  const s = Math.floor((t % 60_000) / 1000)
  return `${heureEcrite(t)} min ${s} s`
}

/** Quinze minutes en six graphiques, au pas de dix secondes : ce qu'un joueur attend, le trafic, les erreurs, la charge, la salle. */
function Courbes({ points, plafondProcesseur }: { points: PointDuDirect[]; plafondProcesseur: number }) {
  const etiquettes = points.map(p => aLaSeconde(p.a))
  // Une heure sous l'axe toutes les cinq minutes, et celle d'à présent au bout.
  const axe = (i: number) => (i === points.length - 1 ? 'maintenant' : points[i].a % 300_000 === 0 && points.length - 1 - i > 6 ? heureEcrite(points[i].a) : null)
  const graphes: { cle: string; nom: string; detail: string; valeurs: number[]; lire: (v: number) => string; nomDuTotal: string }[] = [
    { cle: 'attend', nom: 'Ce qu’un joueur attend', detail: 'ce que 19 appels sur 20 ne dépassent pas', valeurs: points.map(p => p.routes?.p95 ?? 0), lire: tempsDeReponse, nomDuTotal: 'ms' },
    { cle: 'requetes', nom: 'Requêtes', detail: 'les pages, les fichiers, l’API', valeurs: points.map(p => p.requetes), lire: v => `${formatNumber(v)} requête${v > 1 ? 's' : ''}`, nomDuTotal: 'requête' },
    { cle: 'erreurs', nom: 'Erreurs serveur', detail: 'les routes, les sockets, les exceptions', valeurs: points.map(p => p.erreurs), lire: v => `${formatNumber(v)} erreur${v > 1 ? 's' : ''}`, nomDuTotal: 'erreur' },
    {
      cle: 'processeur',
      nom: 'Processeur',
      detail: `d’un cœur ; l’hébergeur en donne ${formatNumber(plafondProcesseur)} %`,
      valeurs: points.map(p => p.processeur ?? 0),
      lire: v => `${formatNumber(v)} %`,
      nomDuTotal: '%',
    },
    { cle: 'memoire', nom: 'Mémoire', detail: 'au dernier relevé', valeurs: points.map(p => p.memoireMo ?? 0), lire: v => `${formatNumber(v)} Mo`, nomDuTotal: 'Mo' },
    { cle: 'invites', nom: 'Invités connectés', detail: 'toutes soirées confondues', valeurs: points.map(p => p.invites ?? 0), lire: v => `${formatNumber(v)} invité${v > 1 ? 's' : ''}`, nomDuTotal: 'invité' },
  ]
  return (
    <section className="qg-chiffres" aria-labelledby="direct-courbes">
      <div className="qg-section-tete">
        <h2 className="compte-groupe" id="direct-courbes">
          Quinze minutes, dix secondes par dix secondes
        </h2>
      </div>
      <div className="qg-direct-graphes">
        {graphes.map(g => {
          const max = Math.max(0, ...g.valeurs)
          return (
            <section key={g.cle} className="qg-carte qg-ecran" aria-labelledby={`direct-${g.cle}`}>
              <div className="qg-carte-tete qg-carte-tete-pile">
                <h3 id={`direct-${g.cle}`}>{g.nom}</h3>
                <span className="muted small">{g.detail}</span>
              </div>
              <GrapheDuTemps
                etiquettes={etiquettes}
                axe={axe}
                series={[{ cle: g.cle, nom: g.nom, valeurs: g.valeurs, classe: 'qg-joueurs' }]}
                empile={false}
                resume={`${g.nom}, quinze minutes : au plus ${g.lire(max)}.`}
                nomDuTotal={g.nomDuTotal}
                lire={g.lire}
              />
            </section>
          )
        })}
      </div>
    </section>
  )
}

const ICONE_DU_FIL: Record<SorteDuFil, IconName> = { partie: 'play', soiree: 'glass', profil: 'users', boutique: 'bag', erreur: 'alert', serveur: 'zap' }

/** « à l'instant », « il y a 40 s », « il y a 3 min » : le fil se lit au présent. */
function ilYA(a: number, maintenant: number): string {
  const s = Math.max(0, Math.round((maintenant - a) / 1000))
  if (s < 5) return 'à l’instant'
  if (s < 60) return `il y a ${s} s`
  const min = Math.floor(s / 60)
  return min < 60 ? `il y a ${min} min` : heureEcrite(a)
}

/**
 * Le fil de ce qui arrive : les parties qui commencent, les soirées qui
 * s'ouvrent ou finissent un quiz, les profils qui naissent, les achats, les
 * erreurs, les démarrages et les pannes — le plus récent en tête, filtré, et
 * qu'on met en pause pour le lire. Rien n'y nomme un joueur.
 */
function LeFil({ fil, maintenant }: { fil: EvenementDuFil[]; maintenant: number }) {
  const [filtre, setFiltre] = useState<(typeof FILTRES_DU_FIL)[number]['cle']>('tout')
  const [fige, setFige] = useState<{ fil: EvenementDuFil[]; maintenant: number } | null>(null)
  const [toutes, setToutes] = useState(false)
  const montre = fige ?? { fil, maintenant }
  const sortes = FILTRES_DU_FIL.find(f => f.cle === filtre)!.sortes
  const filtrees = montre.fil.filter(e => sortes.includes(e.sorte))
  // Les plus récentes d'abord, puis « Les suivantes » : au téléphone, le fil suit la page, et ses quatre-vingts lignes
  // repoussaient les routes de quatre mille pixels (la revue d'ergonomie du 4 novembre 2026).
  const lignes = toutes ? filtrees : filtrees.slice(0, LIGNES_DU_FIL)
  const neufs = fige ? fil.filter(e => !fige.fil.some(f => f.id === e.id && f.n === e.n)).length : 0
  return (
    <section className="qg-console qg-fil" aria-labelledby="direct-fil">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Le fil</span>
          <h2 id="direct-fil">Ce qui arrive</h2>
          <span className="muted small">le plus récent en tête ; les mêmes, dans les dix secondes, comptés ensemble</span>
        </div>
        <button type="button" className="qg-bouton" aria-pressed={!!fige} onClick={() => setFige(fige ? null : { fil, maintenant })}>
          <Icon name={fige ? 'play' : 'pause'} />
          {fige ? (neufs > 0 ? `Reprendre · ${formatNumber(neufs)} de plus` : 'Reprendre') : 'Pause'}
        </button>
      </div>
      <div className="onglets onglets-puces" role="group" aria-label="Ce que le fil montre">
        {FILTRES_DU_FIL.map(f => (
          <button key={f.cle} type="button" className={'onglet' + (filtre === f.cle ? ' actif' : '')} aria-pressed={filtre === f.cle} onClick={() => setFiltre(f.cle)}>
            {f.nom}
          </button>
        ))}
      </div>
      {lignes.length === 0 ? (
        <p className="muted small">Rien encore depuis le démarrage du serveur.</p>
      ) : (
        <ul className="qg-liste qg-fil-liste" aria-live={fige ? 'off' : 'polite'}>
          {lignes.map(e => (
            <li key={e.id} className={'qg-ligne qg-fil-ligne' + (e.sorte === 'erreur' ? ' qg-fil-erreur' : '')}>
              <span className={'qg-rond' + (e.sorte === 'erreur' ? ' qg-rond-alerte' : '')}>
                <Icon name={ICONE_DU_FIL[e.sorte]} />
              </span>
              <span className="qg-ligne-texte">
                <b>
                  {e.mode && <i className={`qg-tuile-cle qg-mode-${e.mode}`} aria-hidden="true" />}
                  {e.texte}
                  {e.n > 1 && <span className="qg-fil-n"> × {formatNumber(e.n)}</span>}
                </b>
                <span className="muted small">{ilYA(e.a, montre.maintenant)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {filtrees.length > LIGNES_DU_FIL && (
        <button type="button" className="qg-bouton qg-plus" onClick={() => setToutes(!toutes)} aria-expanded={toutes}>
          <Icon name="chevron-down" />
          {toutes ? 'Les plus récentes seulement' : `Les ${formatNumber(filtrees.length - LIGNES_DU_FIL)} suivantes`}
        </button>
      )}
    </section>
  )
}

/** Les lignes du fil montrées d'emblée : un écran de téléphone, à peu près. */
const LIGNES_DU_FIL = 12

type CleDesRoutes = 'route' | 'parMin' | 'p50' | 'p95' | 'max'
const COLONNES_DES_ROUTES: { cle: CleDesRoutes; nom: string }[] = [
  { cle: 'route', nom: 'Route' },
  { cle: 'parMin', nom: 'Appels' },
  { cle: 'p50', nom: 'Médiane' },
  // « 95ᵉ centile » ne se lisait que d'un ingénieur : la valeur que dix-neuf appels sur vingt ne dépassent pas.
  { cle: 'p95', nom: '19 sur 20' },
  { cle: 'max', nom: 'Pire' },
]

/** Les routes montrées d'emblée : la table entière, une cinquantaine de lignes, poussait les soirées loin sous le fil. */
const ROUTES_MONTREES = 12

/** Les routes d'API de la dernière minute, la plus coûteuse d'abord, triables : ce qui ralentit maintenant — au seuil réglé du ressenti. */
function RoutesDeLaMinute({ routes, seuils }: { routes: RouteDuDirect[]; seuils: SeuilsDesRegles }) {
  const [tri, setTri] = useState<{ cle: CleDesRoutes; sens: 1 | -1 } | null>(null)
  const [toutes, setToutes] = useState(false)
  const triees = useMemo(() => {
    if (!tri) return routes
    return [...routes].sort((a, b) => (tri.cle === 'route' ? a.route.localeCompare(b.route) : a[tri.cle] - b[tri.cle]) * tri.sens)
  }, [routes, tri])
  const montrees = toutes ? triees : triees.slice(0, ROUTES_MONTREES)
  return (
    <section className="qg-console" aria-labelledby="direct-routes">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Les routes</span>
          <h2 id="direct-routes">La dernière minute</h2>
          <span className="muted small">la plus coûteuse au serveur d’abord : ses appels fois sa médiane</span>
        </div>
        <span className="etiquette num">{formatNumber(routes.length)}</span>
      </div>
      {routes.length === 0 ? (
        <p className="muted small">Aucune route appelée sur la minute.</p>
      ) : (
        <div className="qg-table-cadre">
          <table className="qg-table">
            <caption className="sr-only">Les routes d’API de la dernière minute</caption>
            <thead>
              <tr>
                {COLONNES_DES_ROUTES.map(c => (
                  <th
                    key={c.cle}
                    scope="col"
                    className={c.cle === 'route' ? '' : 'qg-nombre'}
                    aria-sort={tri?.cle === c.cle ? (tri.sens === 1 ? 'ascending' : 'descending') : undefined}
                  >
                    <button
                      type="button"
                      className="qg-tri"
                      onClick={() => setTri(t => (t?.cle === c.cle ? { cle: c.cle, sens: t.sens === 1 ? -1 : 1 } : { cle: c.cle, sens: c.cle === 'route' ? 1 : -1 }))}
                    >
                      {c.nom}
                      {tri?.cle === c.cle && <Icon name={tri.sens === 1 ? 'arrow-up' : 'arrow-down'} />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {montrees.map(r => (
                <tr key={r.route}>
                  <th scope="row">
                    <span className="qg-route">
                      <NomDeLaRoute route={r.route} />
                    </span>
                  </th>
                  <td className="qg-nombre">{formatNumber(r.parMin)}</td>
                  <td className="qg-nombre">{tempsDeReponse(r.p50)}</td>
                  {/* Au-delà du seuil, une icône avec le rouge : la couleur seule ne se lit pas de tous. */}
                  <td className={'qg-nombre' + (depasse('ressenti', r.p95, seuils) ? ' qg-table-alerte' : '')}>
                    {depasse('ressenti', r.p95, seuils) && (
                      <>
                        <Icon name="alert" />
                        <span className="sr-only">au-delà du seuil : </span>
                      </>
                    )}
                    {tempsDeReponse(r.p95)}
                  </td>
                  <td className="qg-nombre">{tempsDeReponse(r.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {routes.length > ROUTES_MONTREES && (
        <button type="button" className="qg-bouton qg-plus" onClick={() => setToutes(!toutes)} aria-expanded={toutes}>
          <Icon name="chevron-down" />
          {toutes ? 'Les plus coûteuses seulement' : `Les ${formatNumber(routes.length - ROUTES_MONTREES)} autres routes`}
        </button>
      )}
    </section>
  )
}
