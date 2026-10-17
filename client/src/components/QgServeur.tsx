import { useEffect, useState, type ReactNode } from 'react'
import { api, motifDe } from '../api'
import { copierTexte } from '../copier'
import { showToast } from '../state'
import { Icon, type IconName } from './Icon'
import { Feuille } from './Pieces'
import { barreArrondie, useLargeur } from './QgVueDEnsemble'
import { formatNumber } from '../../../shared/typographie'
import { jourAvant, jourDe } from '../../../shared/jour'
import { JOURS_DE_LA_SEMAINE, dureeEcrite, graduations, heureEcrite, jourAbrege, jourDeLaSemaine, quandEcrit } from '../../../shared/qg'
import {
  MEMOIRE_DE_L_HEBERGEUR_MO,
  PROCESSEUR_DE_L_HEBERGEUR_PCT,
  requetesServies,
  tempsDeReponse,
  type ErreurDeLaSemaine,
  type EvenementDuServeur,
  type HeureDuServeur,
  type PageDuServeur,
  type PlafondsDuConteneur,
} from '../../../shared/santeDuServeur'

/** Une semaine de réveils en compte une quinzaine : les douze derniers d'emblée, le reste sur demande. */
const EVENEMENTS_MONTRES = 12
/** Les erreurs de la semaine montrées d'emblée, les plus récentes : le reste sur demande. */
const ERREURS_MONTREES_D_ABORD = 10
/** Les heures d'une erreur que sa fiche détaille : une panne qui a duré la semaine les remplirait toutes. */
const HEURES_D_UNE_ERREUR = 12

/** « mar. 13 oct. » */
const dateCourte = (instant: number) => `${JOURS_DE_LA_SEMAINE[jourDeLaSemaine(instant)].court} ${jourAbrege(jourDe(instant))}`

/** « aujourd’hui, 21 h », « hier, 23 h », « mar. 13 oct., 14 h » : une heure du relevé — il ne sait pas la minute. */
function heureDuReleve(heure: number, maintenant: number): string {
  const ronde = heureEcrite(heure).replace(/ 00$/, '')
  const jour = jourDe(heure)
  const aujourdhui = jourDe(maintenant)
  return `${jour === aujourdhui ? 'aujourd’hui' : jour === jourAvant(aujourdhui) ? 'hier' : dateCourte(heure)}, ${ronde}`
}

/** « aujourd’hui à 7 h 02 », « hier à 23 h 10 », « ven. 9 oct. à 14 h 12 » : l'heure d'un réveil compte, même une semaine après. */
function quandDuServeur(instant: number, maintenant: number): string {
  const jour = jourDe(instant)
  const aujourdhui = jourDe(maintenant)
  if (jour === aujourdhui || jour === jourAvant(aujourdhui)) return quandEcrit(instant, maintenant)
  return `${dateCourte(instant)} à ${heureEcrite(instant)}`
}

const erreurs = (n: number) => `${formatNumber(n)} erreur${n > 1 ? 's' : ''}`
const fois = (n: number) => `${formatNumber(n)} fois`

/** « 3 erreurs : POST /api/jour/reponse (2), socket host:launch (1) » — l'heure lue nomme ses sources ; sans erreur, elle s'en tait. */
const erreursDeLHeure = (h: HeureDuServeur) =>
  h.erreurs === 0 ? null : `${erreurs(h.erreurs)} : ${h.erreursParSource.map(s => `${s.source} (${formatNumber(s.n)})`).join(', ')}`

/**
 * La santé du serveur au QG (`/admin#serveur`, les choix du 13 octobre 2026) :
 * sept jours heure par heure, gardés dans la base permanente — ce que les
 * joueurs attendent, la charge à côté des invités connectés, les erreurs,
 * les réveils et les arrêts. La page se lit à son ouverture ; le serveur ne
 * relit la base qu'une fois la minute.
 */
export function QgServeur() {
  const [page, setPage] = useState<PageDuServeur | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api.admin.serveur().then(setPage, e => setError(motifDe(e)))
  }, [])

  if (error) return <p className="error">{error}</p>
  if (!page) return <p className="serif-note">Chargement…</p>
  return <SanteDuServeurAuQg page={page} />
}

/** La page lue : quatre chiffres, les temps de réponse, la charge, les erreurs, les réveils et les arrêts, le tableau. */
export function SanteDuServeurAuQg({ page }: { page: PageDuServeur }) {
  const { chiffres: c, enMarche, maintenant } = page
  return (
    <>
      <p className="muted small">
        {enMarche.env === 'production' || enMarche.env === null ? 'Production' : enMarche.env}
        {enMarche.version && ` · version ${enMarche.version}`} · en marche depuis {dureeEcrite(maintenant - enMarche.depuis)}. Sept jours heure par heure ;
        la nuit, l’hébergeur endort le serveur : ses heures sont hachurées.
        {page.mesuresDeLHebergeur && (
          <>
            {' '}
            Ce que le serveur mesure de lui-même ; Render garde aussi{' '}
            <a className="link-inline" href={page.mesuresDeLHebergeur} target="_blank" rel="noreferrer">
              ses propres graphiques
            </a>
            , vus de dehors.
          </>
        )}
      </p>

      <section className="qg-jour" aria-labelledby="serveur-semaine">
        <div className="qg-section-tete">
          <h2 className="compte-groupe" id="serveur-semaine">
            Cette semaine
          </h2>
        </div>
        <ul className="qg-tuiles qg-tuiles-quatre">
          <Tuile
            nom="Démarrages"
            valeur={formatNumber(c.demarrages.n)}
            detail={c.demarrages.plusLongMs === null ? 'réveils et mises en ligne' : `le plus long : prêt en ${tempsDeReponse(c.demarrages.plusLongMs)}`}
            alerte={c.arretsNets > 0 ? `${formatNumber(c.arretsNets)} arrêt${c.arretsNets > 1 ? 's' : ''} net${c.arretsNets > 1 ? 's' : ''}` : null}
          />
          <Tuile
            nom="Erreurs serveur"
            valeur={formatNumber(c.erreurs.n)}
            detail={c.erreurs.derniere === null ? 'aucune cette semaine' : `la dernière : ${heureDuReleve(c.erreurs.derniere, maintenant)}`}
          />
          <Tuile
            nom="Turso, 95ᵉ centile"
            valeur={c.base.derniere === null ? '–' : tempsDeReponse(c.base.derniere)}
            detail={c.base.habituelle === null ? 'la dernière heure mesurée' : `${tempsDeReponse(c.base.habituelle)} d’habitude`}
          />
          <Tuile
            nom="Routes, 95ᵉ centile"
            valeur={c.routes.derniere === null ? '–' : tempsDeReponse(c.routes.derniere)}
            detail={
              c.routes.plusLente
                ? `la plus lente : ${c.routes.plusLente.route}`
                : c.routes.habituelle === null
                  ? 'la dernière heure mesurée'
                  : `${tempsDeReponse(c.routes.habituelle)} d’habitude`
            }
          />
        </ul>
      </section>

      <Heures
        id="serveur-routes"
        titre="Ce qu’un joueur attend"
        sousTitre="le 95ᵉ centile des routes d’API, heure par heure"
        heures={page.heures}
        valeur={h => h.routes}
        ecrire={tempsDeReponse}
        classe="qg-serveur-temps"
        maintenant={maintenant}
      />
      <Turso heures={page.heures} maintenant={maintenant} />
      <LaCharge heures={page.heures} maintenant={maintenant} plafonds={page.plafonds} />
      <LeTrafic heures={page.heures} maintenant={maintenant} />
      <Heures
        id="serveur-erreurs"
        titre="Les erreurs serveur"
        sousTitre="les routes et les sockets en erreur, et les exceptions échappées, heure par heure"
        heures={page.heures}
        valeur={h => (h.eveille ? h.erreurs : null)}
        ecrire={erreurs}
        legende={erreursDeLHeure}
        classe="qg-serveur-erreur"
        maintenant={maintenant}
      />
      <CeQuiAEchoue page={page} />

      <Evenements evenements={page.evenements} maintenant={maintenant} />
      <TableauDesHeures heures={page.heures} maintenant={maintenant} />
    </>
  )
}

function Tuile({ nom, valeur, detail, alerte }: { nom: string; valeur: string; detail: ReactNode; alerte?: string | null }) {
  return (
    <li className="qg-tuile">
      <span className="qg-tuile-nom">{nom}</span>
      <span className="qg-tuile-valeur num">{valeur}</span>
      <span className="qg-ecart qg-tuile-detail">{detail}</span>
      {alerte && (
        <span className="qg-ecart qg-ecart-moins">
          <Icon name="alert" />
          {alerte}
        </span>
      )}
    </li>
  )
}

/** Sans survol, la dernière heure mesurée : celle-ci, à peine commencée, n'a souvent rien encore. */
function derniereMesuree(valeurs: readonly (number | null)[]): number {
  let i = valeurs.length - 1
  while (i > 0 && valeurs[i] === null) i--
  return i
}

/**
 * Une carte, un graphique : sept jours heure par heure, et l'heure survolée
 * — touchée, au téléphone — sous lui : à cent soixante-huit barres, aucune
 * ne porte son chiffre.
 */
function Heures({
  id,
  titre,
  sousTitre,
  heures,
  valeur,
  ecrire,
  legende,
  classe,
  maintenant,
}: {
  id: string
  titre: string
  sousTitre: string
  heures: HeureDuServeur[]
  valeur: (h: HeureDuServeur) => number | null
  ecrire: (v: number) => string
  /** Ce que l'heure lue en dit, plus que son chiffre ; null, son chiffre seul. */
  legende?: (h: HeureDuServeur) => string | null
  classe: string
  maintenant: number
}) {
  const [choisie, setChoisie] = useState<number | null>(null)
  const h = heures[choisie ?? derniereMesuree(heures.map(valeur))]
  const v = valeur(h)
  return (
    <section className="qg-carte qg-ecran" aria-labelledby={id}>
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id={id}>{titre}</h2>
        <span className="muted small">{sousTitre}</span>
      </div>
      <GrapheDesHeures id={id} nom={titre} heures={heures} valeur={valeur} ecrire={ecrire} classe={classe} maintenant={maintenant} choisie={choisie} choisir={setChoisie} />
      <p className="qg-legende-jour" aria-live="polite">
        {heureDuReleve(h.heure, maintenant)} : {!h.eveille ? 'endormi' : v === null ? 'rien de mesuré' : (legende?.(h) ?? ecrire(v))}
      </p>
    </section>
  )
}

/**
 * Ce qui a échoué cette semaine (le souhait du propriétaire du 17 octobre
 * 2026 : « mieux voir les erreurs, d'où elles proviennent, et avoir des
 * détails en cliquant dessus ») : les mêmes fondues, la plus récente
 * d'abord — d'où elle vient, sa sorte et son message, l'endroit du code qui
 * l'a levée —, chacune ouvre sa fiche. Le graphique disait combien et
 * quand, rien de ce qu'il fallait réparer. Hors de l'écran nocturne : la
 * fiche s'ouvre dans le thème de la page.
 */
function CeQuiAEchoue({ page }: { page: PageDuServeur }) {
  const [toutes, setToutes] = useState(false)
  const [ouverte, setOuverte] = useState<ErreurDeLaSemaine | null>(null)
  const { erreurs: liste, erreursSansDetail: sansDetail, maintenant } = page
  const montrees = toutes ? liste : liste.slice(0, ERREURS_MONTREES_D_ABORD)
  return (
    <section className="qg-carte" aria-labelledby="serveur-echecs">
      <div className="qg-carte-tete">
        <h2 id="serveur-echecs">Ce qui a échoué</h2>
        {liste.length > 0 && <span className="etiquette num">{liste.length}</span>}
      </div>
      {liste.length === 0 && sansDetail.length === 0 && <p className="muted small">Aucune erreur serveur cette semaine.</p>}
      {liste.length > 0 && (
        <ul className="qg-liste">
          {montrees.map(e => (
            <li key={e.cle}>
              <button type="button" className="qg-ligne" onClick={() => setOuverte(e)}>
                <span className="qg-rond qg-rond-alerte" aria-hidden="true">
                  <Icon name="alert" />
                </span>
                <span className="qg-ligne-texte">
                  <span className="qg-source">{e.source}</span>
                  <b className="qg-echec-message">{e.message ? `${e.nom} : ${e.message}` : e.nom}</b>
                  <span className="muted small">{[fois(e.n), `la dernière ${quandDuServeur(e.derniere, maintenant)}`, e.ou].filter(Boolean).join(' · ')}</span>
                </span>
                <Icon name="chevron-right" className="qg-chevron" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!toutes && liste.length > ERREURS_MONTREES_D_ABORD && (
        <button type="button" className="lien-discret qg-suite" onClick={() => setToutes(true)}>
          Et {formatNumber(liste.length - ERREURS_MONTREES_D_ABORD)} de plus cette semaine
          <Icon name="chevron-down" />
        </button>
      )}
      {sansDetail.length > 0 && (
        <div className="qg-fiche-groupe">
          {/* Comptées, jamais perdues : d'avant le détail, ou au-delà de douze dans l'heure (`ERREURS_EN_DETAIL`). */}
          <p className="muted small">Comptées sans leur détail — d’avant le 17 octobre 2026, ou au-delà de douze dans l’heure :</p>
          <ul className="qg-liste qg-sources">
            {sansDetail.map(s => (
              <li key={s.source}>
                <span className="qg-source">{s.source}</span>
                <span className="num">{erreurs(s.n)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {ouverte && (
        <Feuille
          // Sa sorte seule : avec son code, « LibsqlError · SQLITE_BUSY » passait sur deux lignes au téléphone.
          titre={ouverte.nom}
          onFermer={() => setOuverte(null)}
          pied={
            <button
              type="button"
              className="btn btn-block"
              onClick={async () => {
                const copie = await copierTexte(texteDeLErreur(ouverte, page))
                showToast({ kind: copie ? 'info' : 'error', message: copie ? 'Détail copié' : 'Copie impossible : sélectionne-le à la main' })
              }}
            >
              <Icon name="copy" />
              Copier le détail
            </button>
          }
        >
          <FicheDeLErreur erreur={ouverte} page={page} />
        </Feuille>
      )}
    </section>
  )
}

/**
 * La fiche d'une erreur : son message entier, d'où elle vient — la route,
 * le socket — et l'endroit du code, combien de fois et quand, sous quelles
 * versions — encore là après une mise en ligne, elle n'est pas réparée —,
 * ses heures, et sa pile d'appels ramenée aux fichiers du dépôt.
 */
export function FicheDeLErreur({ erreur: e, page }: { erreur: ErreurDeLaSemaine; page: PageDuServeur }) {
  const { maintenant, enMarche } = page
  const heures = e.heures.slice(0, HEURES_D_UNE_ERREUR)
  return (
    <div className="qg-fiche">
      <p className="qg-echec-entier">{e.message || 'Sans message.'}</p>
      <dl className="admin-fiche">
        <Ligne nom="D’où">
          <span className="qg-source">{e.source}</span>
        </Ligne>
        <Ligne nom="Dans le code">{e.ou ? <span className="qg-source">{e.ou}</span> : 'hors du dépôt'}</Ligne>
        {e.code && (
          <Ligne nom="Code">
            <span className="qg-source">{e.code}</span>
          </Ligne>
        )}
        <Ligne nom="Combien">
          {fois(e.n)}, en {formatNumber(e.heures.length)} heure{e.heures.length > 1 ? 's' : ''}
        </Ligne>
        <Ligne nom="La première">{quandDuServeur(e.premiere, maintenant)}</Ligne>
        <Ligne nom="La dernière">{quandDuServeur(e.derniere, maintenant)}</Ligne>
        {e.versions.length > 0 && <Ligne nom={e.versions.length > 1 ? 'Versions' : 'Version'}>{e.versions.join(', ')}</Ligne>}
      </dl>
      {enMarche.version && (
        <p className="qg-fiche-note">
          <Icon name={e.versions.includes(enMarche.version) ? 'alert' : 'check'} />
          <span>
            {e.versions.includes(enMarche.version)
              ? `Tombée sous la version en marche (${enMarche.version}) : pas réparée.`
              : `Pas revue depuis la mise en ligne de la version ${enMarche.version} : peut-être réparée.`}
          </span>
        </p>
      )}
      {e.pile.length > 0 && (
        <div className="qg-fiche-groupe">
          <p className="label">La pile d’appels</p>
          <ol className="qg-pile">
            {e.pile.map((cadre, i) => (
              <li key={i}>{cadre}</li>
            ))}
          </ol>
        </div>
      )}
      <div className="qg-fiche-groupe">
        <p className="label">Ses heures</p>
        <ul className="qg-liste qg-sources">
          {heures.map(h => (
            <li key={h.heure}>
              <span>{heureDuReleve(h.heure, maintenant)}</span>
              <span className="num">{fois(h.n)}</span>
            </li>
          ))}
        </ul>
        {e.heures.length > heures.length && (
          <p className="muted small">
            Et {formatNumber(e.heures.length - heures.length)} heure{e.heures.length - heures.length > 1 ? 's' : ''} de plus.
          </p>
        )}
      </div>
      <p className="muted small">
        Le joueur, lui, a lu « Erreur serveur — réessaie dans un instant ». Le journal du service, sur Render, en garde la pile entière, à la minute de la
        dernière.
      </p>
    </div>
  )
}

/** Le détail d'une erreur en texte, à coller ailleurs — un ticket, une conversation qui la réparera. */
export function texteDeLErreur(e: ErreurDeLaSemaine, page: PageDuServeur): string {
  const { maintenant } = page
  return [
    e.code ? `${e.nom} · ${e.code}` : e.nom,
    e.message,
    `D’où : ${e.source}`,
    e.ou && `Dans le code : ${e.ou}`,
    `${fois(e.n)} cette semaine — la première ${quandDuServeur(e.premiere, maintenant)}, la dernière ${quandDuServeur(e.derniere, maintenant)}`,
    e.versions.length > 0 && `Versions : ${e.versions.join(', ')}`,
    e.pile.length > 0 && ['Pile :', ...e.pile.map(c => `  ${c}`)].join('\n'),
  ]
    .filter(Boolean)
    .join('\n')
}

function Ligne({ nom, children }: { nom: string; children: ReactNode }) {
  return (
    <div>
      <dt>{nom}</dt>
      <dd>{children}</dd>
    </div>
  )
}

const pourcentsDUnCoeur = (v: number) => `${formatNumber(v)} %`
const megaOctets = (v: number) => `${formatNumber(v)} Mo`
const invites = (v: number) => `${formatNumber(v)} invité${v > 1 ? 's' : ''}`

const pourcents = (v: number) => `${formatNumber(v)} %`

/**
 * Ce que les connexions d'une heure disent, après son temps : la part des
 * neuves, la garde — ou l'entretien qui les garde chaudes, ses battements et
 * ce qu'il a dû rouvrir —, et ce qu'une garde trop longue faisait voir.
 */
function connexionsDeLHeure(h: HeureDuServeur): string[] {
  const c = h.connexions
  if (!c) return []
  const morceaux = h.connexionsNeuves === null ? [] : [`${pourcents(h.connexionsNeuves)} de connexions neuves`]
  if (c.chaudes) {
    // Le nombre tient à son mot : au téléphone, « 260 » finissait une ligne et « battements » ouvrait la suivante.
    const n = c.battements ?? 0
    morceaux.push(n > 0 ? `gardées chaudes par ${formatNumber(n)} battement${n > 1 ? 's' : ''}` : 'gardées chaudes')
    const tombes = c.battementsTombes ?? 0
    if (tombes > 0) morceaux.push(`${formatNumber(tombes)} ${tombes > 1 ? 'battements tombés' : 'battement tombé'}`)
    const rouvertes = c.ouvertesParUnBattement ?? 0
    if (rouvertes > 0) morceaux.push(`${formatNumber(rouvertes)} rouverte${rouvertes > 1 ? 's' : ''} par un battement`)
  } else morceaux.push(`gardées ${tempsDeReponse(c.gardeMs)}`)
  // Annoncé, le délai de Turso passe avant la garde : c'est lui qui vaut.
  if (c.annonceeMs !== null && c.annonceeMs !== undefined) morceaux.push(`Turso annonce ${tempsDeReponse(c.annonceeMs)}`)
  if (c.refermeesParLaBase > 0) {
    const plusJeune = c.plusJeuneRefermeeMs === null ? '' : `, la plus jeune à ${tempsDeReponse(c.plusJeuneRefermeeMs)}`
    morceaux.push(`${formatNumber(c.refermeesParLaBase)} refermée${c.refermeesParLaBase > 1 ? 's' : ''} par Turso${plusJeune}`)
  }
  if (c.echecs > 0) morceaux.push(`${formatNumber(c.echecs)} ${c.echecs > 1 ? 'allers-retours tombés' : 'aller-retour tombé'} en route`)
  return morceaux
}

/**
 * Turso et ses connexions, heure par heure (la revue du 14 octobre 2026) : le
 * temps d'un aller-retour dit qu'il a été lent, la part des connexions neuves
 * dit pourquoi — à 100 %, chacun a refait sa poignée de main, 225 ms au lieu
 * de 29 en production. La légende dit la garde en vigueur ou l'entretien qui
 * les garde chaudes, et ce qu'une garde plus longue que le délai de Turso
 * faisait voir : des connexions qu'il referme, des allers-retours tombés en
 * route — c'est ainsi qu'on a lu ses 5 s.
 */
function Turso({ heures, maintenant }: { heures: HeureDuServeur[]; maintenant: number }) {
  const [choisie, setChoisie] = useState<number | null>(null)
  const h = heures[choisie ?? derniereMesuree(heures.map(x => x.base))]
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="serveur-turso">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="serveur-turso">Turso</h2>
        <span className="muted small">un aller-retour vers la base, et les connexions qu’il a fallu ouvrir, heure par heure</span>
      </div>
      <div className="qg-charge">
        <span className="qg-charge-nom">
          <b>Temps</b> · le 95ᵉ centile d’un aller-retour
        </span>
        <GrapheDesHeures
          id="serveur-turso-temps"
          nom="Turso"
          heures={heures}
          valeur={x => x.base}
          ecrire={tempsDeReponse}
          classe="qg-serveur-temps"
          maintenant={maintenant}
          choisie={choisie}
          choisir={setChoisie}
          compact
          sansJours
        />
      </div>
      <div className="qg-charge">
        <span className="qg-charge-nom">
          <b>Connexions neuves</b> · la part des allers-retours qui ont refait leur poignée de main
        </span>
        <GrapheDesHeures
          id="serveur-connexions"
          nom="Connexions neuves"
          heures={heures}
          valeur={x => x.connexionsNeuves}
          ecrire={pourcents}
          classe="qg-serveur-temps"
          maintenant={maintenant}
          choisie={choisie}
          choisir={setChoisie}
          compact
        />
      </div>
      <p className="qg-legende-jour" aria-live="polite">
        {heureDuReleve(h.heure, maintenant)} :{' '}
        {!h.eveille ? 'endormi' : h.base === null ? 'rien de mesuré' : [`95ᵉ centile ${tempsDeReponse(h.base)}`, ...connexionsDeLHeure(h)].join(' · ')}
      </p>
    </section>
  )
}

/** Un graphique d'une pile : ce qu'il montre, comment l'écrire, et ce que l'heure lue en dit. */
interface MesureDeLaPile {
  cle: string
  nom: string
  detail: string
  valeur: (h: HeureDuServeur) => number | null
  ecrire: (v: number) => string
  ecrireAxe?: (v: number) => string
  /** Un trait pointillé : le plafond de l'hébergeur. */
  plafond?: number
  /** Son morceau de la légende ; null, il s'en tait. Par défaut, son nom et sa valeur. */
  legende?: (h: HeureDuServeur) => string | null
}

/**
 * Des graphiques l'un sous l'autre, le même temps pour tous : une heure
 * choisie l'est dans chacun, et la légende la lit dans tous. `mesuree` dit
 * si une heure a été mesurée — sans survol, la dernière qui l'a été.
 */
function PileDeGraphes({
  id,
  titre,
  sousTitre,
  mesures,
  mesuree,
  heures,
  maintenant,
}: {
  id: string
  titre: string
  sousTitre: string
  mesures: MesureDeLaPile[]
  mesuree: (h: HeureDuServeur) => number | null
  heures: HeureDuServeur[]
  maintenant: number
}) {
  const [choisie, setChoisie] = useState<number | null>(null)
  const h = heures[choisie ?? derniereMesuree(heures.map(mesuree))]
  return (
    <section className="qg-carte qg-ecran" aria-labelledby={id}>
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id={id}>{titre}</h2>
        <span className="muted small">{sousTitre}</span>
      </div>
      {mesures.map((m, i) => (
        <div key={m.cle} className="qg-charge">
          <span className="qg-charge-nom">
            <b>{m.nom}</b> · {m.detail}
          </span>
          <GrapheDesHeures
            id={`serveur-${m.cle}`}
            nom={m.nom}
            heures={heures}
            valeur={m.valeur}
            ecrire={m.ecrire}
            ecrireAxe={m.ecrireAxe}
            classe="qg-serveur-temps"
            maintenant={maintenant}
            choisie={choisie}
            choisir={setChoisie}
            plafond={m.plafond}
            compact
            sansJours={i < mesures.length - 1}
          />
        </div>
      ))}
      <p className="qg-legende-jour" aria-live="polite">
        {heureDuReleve(h.heure, maintenant)} :{' '}
        {!h.eveille
          ? 'endormi'
          : mesuree(h) === null
            ? 'rien de mesuré'
            : mesures
                .map(m => {
                  if (m.legende) return m.legende(h)
                  const v = m.valeur(h)
                  return `${m.nom.toLowerCase()} ${v === null ? '–' : m.ecrire(v)}`
                })
                .filter((morceau): morceau is string => morceau !== null)
                .join(' · ')}
      </p>
    </section>
  )
}

const connexions = (v: number) => `${formatNumber(v)} connexion${v > 1 ? 's' : ''}`

/**
 * Les graphiques de la charge. Le gel de l'hébergeur sous le processeur (le
 * banc du 16 octobre 2026) : la boucle se figeait deux secondes chaque heure
 * et Turso paraissait lent, sans rien qui dise que le dixième de cœur
 * manquait. Les plafonds sont ceux du conteneur quand il les dit — une autre
 * offre déplace le trait —, ceux de l'offre gratuite sinon.
 */
function mesuresDeLaCharge(plafonds: PlafondsDuConteneur): MesureDeLaPile[] {
  return [
    {
      cle: 'processeur',
      nom: 'Processeur',
      detail: 'la moyenne de l’heure, en part d’un cœur',
      valeur: h => h.processeur,
      ecrire: pourcentsDUnCoeur,
      plafond: plafonds.processeurPct ?? PROCESSEUR_DE_L_HEBERGEUR_PCT,
    },
    { cle: 'gele', nom: 'Gel de l’hébergeur', detail: 'la part de l’heure où le processeur manquait', valeur: h => h.gele, ecrire: pourcents },
    { cle: 'boucle', nom: 'Boucle', detail: 'le pire gel de l’heure — toute la salle l’attend', valeur: h => h.boucle, ecrire: tempsDeReponse },
    { cle: 'memoire', nom: 'Mémoire', detail: 'le pic de l’heure', valeur: h => h.memoire, ecrire: megaOctets, plafond: plafonds.memoireMo ?? MEMOIRE_DE_L_HEBERGEUR_MO },
    {
      cle: 'invites',
      nom: 'Invités connectés',
      detail: 'le pic de l’heure, toutes soirées confondues',
      valeur: h => h.invites,
      ecrire: invites,
      ecrireAxe: formatNumber,
      legende: h => invites(h.invites ?? 0),
    },
    {
      cle: 'connexions',
      nom: 'Connexions ouvertes',
      detail: 'le pic de l’heure — chaque téléphone, chaque écran en tient une',
      valeur: h => h.connexionsOuvertes,
      ecrire: connexions,
      ecrireAxe: formatNumber,
      // Une heure d'avant leur compte n'en dit rien, plutôt qu'un tiret.
      legende: h =>
        h.connexionsOuvertes === null
          ? null
          : `${connexions(h.connexionsOuvertes)} ouverte${h.connexionsOuvertes > 1 ? 's' : ''}` +
            (h.tempsReel === null ? '' : `, ${formatNumber(h.tempsReel)} en temps réel`),
    },
  ]
}

/**
 * La charge, heure par heure (le conseil suivi le 13 octobre 2026) : les
 * temps de réponse disent qu'une soirée a été lente, la charge dit pourquoi
 * — le processeur au plafond de l'hébergeur, un gel de la boucle, la mémoire
 * —, à côté de la salle qui la fait et des connexions qu'elle tient ouvertes.
 */
function LaCharge({ heures, maintenant, plafonds }: { heures: HeureDuServeur[]; maintenant: number; plafonds: PlafondsDuConteneur }) {
  const lus = plafonds.processeurPct !== null && plafonds.memoireMo !== null
  return (
    <PileDeGraphes
      id="serveur-charge"
      titre="La charge, heure par heure"
      sousTitre={
        'relevée toutes les dix secondes ; en pointillé, ' +
        (lus
          ? `les plafonds du conteneur : ${pourcentsDUnCoeur(plafonds.processeurPct!)} d’un cœur, ${megaOctets(plafonds.memoireMo!)}`
          : 'les plafonds de l’hébergeur gratuit')
      }
      mesures={mesuresDeLaCharge(plafonds)}
      mesuree={h => h.processeur}
      heures={heures}
      maintenant={maintenant}
    />
  )
}

const requetes = (v: number) => `${formatNumber(v)} requête${v > 1 ? 's' : ''}`

/** « 850 Ko », « 12,4 Mo », « 1,2 Go » : ce que la machine a envoyé ou reçu. */
function volume(mo: number): string {
  if (mo < 1) return `${formatNumber(Math.round(mo * 1024))} Ko`
  if (mo < 1024) return `${formatNumber(Math.round(mo * 10) / 10)} Mo`
  return `${formatNumber(Math.round((mo / 1024) * 10) / 10)} Go`
}

/** Le détail des requêtes d'une heure : « 1 240 requêtes — 1 180 réussies, 52 redirigées, 8 refusées, 0 en erreur ». */
function detailDesRequetes(h: HeureDuServeur): string | null {
  const r = h.requetes
  if (!r) return null
  const n = requetesServies(r)
  if (n === 0) return 'aucune requête'
  const s = (v: number) => (v > 1 ? 's' : '')
  return `${requetes(n)} — ${formatNumber(r.reussies)} réussie${s(r.reussies)}, ${formatNumber(r.redirigees)} redirigée${s(r.redirigees)}, ${formatNumber(r.refusees)} refusée${s(r.refusees)}, ${formatNumber(r.enErreur)} en erreur`
}

const MESURES_DU_TRAFIC: MesureDeLaPile[] = [
  {
    cle: 'requetes',
    nom: 'Requêtes',
    detail: 'les pages, les fichiers et l’API servis — ni le temps réel, ni les sondes de /healthz',
    valeur: h => (h.requetes ? requetesServies(h.requetes) : null),
    ecrire: requetes,
    ecrireAxe: formatNumber,
    legende: detailDesRequetes,
  },
  {
    cle: 'refusees',
    nom: 'Refusées',
    detail: 'les 4xx : une page introuvable, une session expirée, une inscription refusée',
    valeur: h => h.requetes?.refusees ?? null,
    ecrire: requetes,
    ecrireAxe: formatNumber,
    // Déjà dites dans le détail des requêtes.
    legende: () => null,
  },
  {
    cle: 'envoye',
    nom: 'Envoyé',
    detail: 'ce que la machine a envoyé : les pages, le temps réel, les requêtes à Turso',
    valeur: h => h.envoyesMo,
    ecrire: volume,
    legende: h => (h.envoyesMo === null ? null : `${volume(h.envoyesMo)} envoyés`),
  },
  {
    cle: 'recu',
    nom: 'Reçu',
    detail: 'ce qu’elle a reçu : les réponses de Turso, ce que les téléphones envoient',
    valeur: h => h.recusMo,
    ecrire: volume,
    legende: h => (h.recusMo === null ? null : `${volume(h.recusMo)} reçus`),
  },
]

/**
 * Le trafic, heure par heure (le 17 octobre 2026, « combien de connexions »,
 * sans clé de l'hébergeur) : les requêtes servies et ce qu'il en a refusé,
 * ce que la machine a envoyé et reçu — ce que le tableau de bord de Render
 * montre de dehors, mesuré par le serveur lui-même et gardé avec le reste.
 */
function LeTrafic({ heures, maintenant }: { heures: HeureDuServeur[]; maintenant: number }) {
  return (
    <PileDeGraphes
      id="serveur-trafic"
      titre="Le trafic, heure par heure"
      sousTitre="les requêtes servies, et ce que la machine a envoyé et reçu"
      mesures={MESURES_DU_TRAFIC}
      mesuree={h => (h.requetes ? requetesServies(h.requetes) : (h.envoyesMo ?? null))}
      heures={heures}
      maintenant={maintenant}
    />
  )
}

const MARGE = { gauche: 52, droite: 4, haut: 14, bas: 22 }

/**
 * Sept jours heure par heure, en barres d'une seule série dans l'écran
 * nocturne : cent soixante-huit heures, la nuit endormie hachurée. Le
 * survol se partage : dans la pile de la charge, une heure choisie l'est
 * dans les quatre graphiques.
 */
function GrapheDesHeures({
  id,
  nom,
  heures,
  valeur,
  ecrire,
  ecrireAxe = ecrire,
  classe,
  maintenant,
  choisie,
  choisir,
  plafond,
  compact = false,
  sansJours = false,
}: {
  id: string
  nom: string
  heures: HeureDuServeur[]
  valeur: (h: HeureDuServeur) => number | null
  ecrire: (v: number) => string
  ecrireAxe?: (v: number) => string
  classe: string
  maintenant: number
  choisie: number | null
  choisir: (i: number | null) => void
  /** Un trait pointillé : le plafond de l'hébergeur. L'échelle le contient toujours. */
  plafond?: number
  compact?: boolean
  /** Sans les jours sous l'axe : un graphique de la pile, sous lequel un autre les porte. */
  sansJours?: boolean
}) {
  const [boite, largeur] = useLargeur(640)
  const hauteur = compact ? Math.round(Math.min(110, Math.max(80, largeur * 0.12))) : Math.round(Math.min(190, Math.max(130, largeur * 0.22)))
  const marge = { ...MARGE, bas: sansJours ? 6 : MARGE.bas }
  const valeurs = heures.map(valeur)
  const crans = graduations(Math.max(0, plafond ?? 0, ...valeurs.map(v => v ?? 0)))
  const sommet = crans[crans.length - 1] || 1
  const utile = { l: Math.max(1, largeur - marge.gauche - marge.droite), h: hauteur - marge.haut - marge.bas }
  const n = heures.length
  const pas = utile.l / n
  const barre = Math.max(1, pas * 0.7)
  const y = (v: number) => marge.haut + utile.h - (v / sommet) * utile.h
  const xDe = (i: number) => marge.gauche + i * pas

  // Les jours, et les plages endormies : des indices consécutifs.
  const jours: { debut: number; fin: number }[] = []
  const endormies: { debut: number; fin: number }[] = []
  heures.forEach((h, i) => {
    const dernier = jours.at(-1)
    if (dernier && jourDe(heures[dernier.debut].heure) === jourDe(h.heure)) dernier.fin = i
    else jours.push({ debut: i, fin: i })
    if (h.eveille) return
    const plage = endormies.at(-1)
    if (plage && plage.fin === i - 1) plage.fin = i
    else endormies.push({ debut: i, fin: i })
  })

  const mesurees = valeurs.filter((x): x is number => x !== null)
  const resume = mesurees.length
    ? `${nom}, sept jours : de ${ecrire(Math.min(...mesurees))} à ${ecrire(Math.max(...mesurees))} selon l’heure.`
    : `${nom}, sept jours : rien de mesuré.`

  return (
    <div ref={boite} className="qg-graphe">
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} role="img" aria-label={resume} onPointerLeave={() => choisir(null)}>
        <defs>
          <pattern id={`${id}-endormi`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" className="qg-endormi-trait" />
          </pattern>
        </defs>
        {endormies.map(p => (
          <rect key={p.debut} x={xDe(p.debut)} y={marge.haut} width={(p.fin - p.debut + 1) * pas} height={utile.h} fill={`url(#${id}-endormi)`} />
        ))}
        {choisie !== null && <rect className="qg-graphe-choisi" x={xDe(choisie)} y={marge.haut} width={Math.max(pas, 2)} height={utile.h} />}
        <g className="qg-graphe-grille">
          {crans.map(cran => (
            <line key={cran} x1={marge.gauche} x2={largeur - marge.droite} y1={y(cran)} y2={y(cran)} />
          ))}
          {jours.slice(1).map(j => (
            <line key={j.debut} className="qg-graphe-jour" x1={xDe(j.debut)} x2={xDe(j.debut)} y1={marge.haut} y2={marge.haut + utile.h} />
          ))}
        </g>
        <g className="qg-graphe-axe" textAnchor="end">
          {crans.map(cran => (
            <text key={cran} x={marge.gauche - 8} y={y(cran) + 4}>
              {cran === 0 ? '0' : ecrireAxe(cran)}
            </text>
          ))}
        </g>
        {!sansJours && (
          <g className="qg-graphe-axe" textAnchor="middle">
            {jours.map(j => {
              const large = (j.fin - j.debut + 1) * pas
              if (large < 26) return null
              const debut = heures[j.debut].heure
              return (
                <text key={j.debut} x={xDe(j.debut) + large / 2} y={hauteur - 6}>
                  {jourDe(debut) === jourDe(maintenant) ? 'auj.' : JOURS_DE_LA_SEMAINE[jourDeLaSemaine(debut)].court}
                </text>
              )
            })}
          </g>
        )}
        {valeurs.map((val, i) =>
          val !== null && val > 0 ? <path key={i} className={classe} d={barreArrondie(xDe(i) + (pas - barre) / 2, y(val), barre, (val / sommet) * utile.h)} /> : null,
        )}
        {plafond !== undefined && (
          <g>
            <line className="qg-graphe-plafond" x1={marge.gauche} x2={largeur - marge.droite} y1={y(plafond)} y2={y(plafond)} />
            <text className="qg-graphe-plafond-nom" x={largeur - marge.droite} y={y(plafond) - 4} textAnchor="end">
              plafond
            </text>
          </g>
        )}
        {heures.map((heure, i) => (
          <rect
            key={heure.heure}
            className="qg-graphe-cible"
            x={xDe(i)}
            y={marge.haut}
            width={pas}
            height={utile.h}
            onPointerEnter={() => choisir(i)}
            onClick={() => choisir(i)}
          />
        ))}
      </svg>
    </div>
  )
}

const SORTES: Record<EvenementDuServeur['sorte'], { icone: IconName; nom: string; alerte?: boolean }> = {
  reveil: { icone: 'sun', nom: 'Réveil' },
  'mise-en-ligne': { icone: 'arrow-up', nom: 'Mise en ligne' },
  relance: { icone: 'rotate', nom: 'Relancé' },
  'apres-arret': { icone: 'rotate', nom: 'Redémarrage après un arrêt net' },
  'arret-net': { icone: 'alert', nom: 'Arrêt net', alerte: true },
}

/** Les réveils, les mises en ligne et les arrêts nets, le plus récent d'abord. */
function Evenements({ evenements, maintenant }: { evenements: EvenementDuServeur[]; maintenant: number }) {
  const [tous, setTous] = useState(false)
  const montres = tous ? evenements : evenements.slice(0, EVENEMENTS_MONTRES)
  return (
    <section className="qg-carte" aria-labelledby="serveur-evenements">
      <div className="qg-carte-tete">
        <h2 id="serveur-evenements">Réveils et arrêts</h2>
        {evenements.length > 0 && <span className="etiquette num">{evenements.length}</span>}
      </div>
      {evenements.length === 0 ? (
        <p className="muted small">Aucun démarrage cette semaine.</p>
      ) : (
        <ul className="qg-liste">
          {montres.map(e => {
            const sorte = SORTES[e.sorte]
            const quand = quandDuServeur(e.quand, maintenant)
            return (
              <li key={`${e.sorte}-${e.quand}`} className="qg-geste">
                <span className={'qg-rond' + (sorte.alerte ? ' qg-rond-alerte' : '')} aria-hidden="true">
                  <Icon name={sorte.icone} />
                </span>
                <span className="qg-ligne-texte">
                  <b>{sorte.nom}</b>
                  <span className="muted small">
                    {e.sorte === 'arret-net'
                      ? `dernier signe ${quand} : il ne s’est pas éteint proprement`
                      : [quand, e.pretEnMs !== null && `prêt en ${tempsDeReponse(e.pretEnMs)}`, e.sorte === 'mise-en-ligne' && e.version && `version ${e.version}`]
                          .filter(Boolean)
                          .join(' · ')}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {!tous && evenements.length > EVENEMENTS_MONTRES && (
        <button type="button" className="lien-discret qg-suite" onClick={() => setTous(true)}>
          Et {evenements.length - EVENEMENTS_MONTRES} de plus cette semaine
          <Icon name="chevron-down" />
        </button>
      )}
    </section>
  )
}

/** Les chiffres, heure par heure : le tableau des graphiques, rendu à l'ouverture seulement — cent soixante-huit lignes. */
function TableauDesHeures({ heures, maintenant }: { heures: HeureDuServeur[]; maintenant: number }) {
  const [ouvert, setOuvert] = useState(false)
  const eveillees = heures.filter(h => h.eveille).reverse()
  return (
    <section className="qg-carte" aria-labelledby="serveur-tableau">
      <div className="qg-carte-tete">
        <h2 id="serveur-tableau">Heure par heure</h2>
      </div>
      <details className="qg-tableau" onToggle={e => setOuvert((e.target as HTMLDetailsElement).open)}>
        <summary>Les chiffres des {formatNumber(eveillees.length)} heures éveillées</summary>
        {ouvert && (
          <table>
            <thead>
              <tr>
                <th scope="col">Heure</th>
                <th scope="col">Routes</th>
                <th scope="col">Turso</th>
                <th scope="col" className="qg-colonne-large">
                  Connexions neuves
                </th>
                <th scope="col">Erreurs</th>
                {/* La charge, à l'ordinateur seulement : au téléphone, l'heure n'avait plus de place. */}
                <th scope="col" className="qg-colonne-large">
                  Processeur
                </th>
                <th scope="col" className="qg-colonne-large">
                  Mémoire
                </th>
                <th scope="col" className="qg-colonne-large">
                  Invités
                </th>
                <th scope="col" className="qg-colonne-large">
                  Connexions
                </th>
                <th scope="col" className="qg-colonne-large">
                  Requêtes
                </th>
              </tr>
            </thead>
            <tbody>
              {eveillees.map(h => (
                <tr key={h.heure}>
                  <th scope="row">{heureDuReleve(h.heure, maintenant)}</th>
                  <td className="num">{h.routes === null ? '–' : tempsDeReponse(h.routes)}</td>
                  <td className="num">{h.base === null ? '–' : tempsDeReponse(h.base)}</td>
                  <td className="num qg-colonne-large">{h.connexionsNeuves === null ? '–' : pourcents(h.connexionsNeuves)}</td>
                  <td className="num">{formatNumber(h.erreurs)}</td>
                  <td className="num qg-colonne-large">{h.processeur === null ? '–' : pourcentsDUnCoeur(h.processeur)}</td>
                  <td className="num qg-colonne-large">{h.memoire === null ? '–' : megaOctets(h.memoire)}</td>
                  <td className="num qg-colonne-large">{h.invites === null ? '–' : formatNumber(h.invites)}</td>
                  <td className="num qg-colonne-large">{h.connexionsOuvertes === null ? '–' : formatNumber(h.connexionsOuvertes)}</td>
                  <td className="num qg-colonne-large">{h.requetes === null ? '–' : formatNumber(requetesServies(h.requetes))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>
    </section>
  )
}
