import { useState, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { GrapheDuTemps, TuileDuQg, type SerieDuGraphe } from './QgGraphes'
import { formatNumber } from '../../../shared/typographie'
import { jourDe, jourEnToutesLettres, minutesDeParis } from '../../../shared/jour'
import {
  MODES_DU_QG,
  NOM_DU_MODE,
  dureeEcrite,
  heureEcrite,
  jourAbrege,
  lesChosesATraiter,
  ouEnEstLaSoiree,
  quandEcrit,
  type ChoseATraiter,
  type DirectDuQg,
  type ModeDuQg,
  type SoireeDuQg,
  type VueDEnsemble,
} from '../../../shared/qg'
import { PERIODE_EN_TOUTES_LETTRES, ecartALaPeriodeDAvant, type ActiviteDUnePeriode, type PeriodeDuQg } from '../../../shared/qgPeriodes'
import { etatDuService, phraseDeLEtat, type VoyantDuService } from '../../../shared/qgEtat'

/** Les écrans du QG qu'une chose à traiter, un voyant ou une tuile ouvrent — la tuile d'un mode, sa page. */
type EcranATraiter = NonNullable<ChoseATraiter['ecran']> | 'campagne' | 'cabinet' | 'duels'

/**
 * Le poste de commande du QG 2 (`/admin`, la proposition du 3 novembre 2026
 * que le propriétaire a faite sienne le 4 : « suis tes recommandations ») :
 * l'état du service en voyants, les chiffres de la période que la barre du
 * haut a choisie, la participation seau par seau, ce qui attend un geste, le
 * direct, les soirées en cours, le serveur. Il remplace la vue d'ensemble
 * des maquettes du 13 octobre 2026, qui ne regardait que trente jours et
 * « aujourd'hui à la même heure ». Des soirées des autres, rien que des
 * chiffres : où elles en sont, combien d'invités, jamais un prénom ni un quiz
 * (`server/src/qg.ts`).
 *
 * Au téléphone, une colonne : l'état, ce qui attend un geste, les chiffres,
 * puis le reste. À l'ordinateur, la grille de la maquette (`.qg-poste`).
 */
export function VueDEnsembleDuQg({
  vue,
  direct,
  vueEnPanne,
  directEnPanne,
  ouvrir,
  periode = '24h',
  comparer = false,
}: {
  vue: VueDEnsemble | null
  direct: DirectDuQg | null
  /** La dernière lecture a échoué : on montre la précédente, et on le dit. */
  vueEnPanne: boolean
  directEnPanne: boolean
  ouvrir: (e: EcranATraiter) => void
  periode?: PeriodeDuQg
  /** La période d'avant en filet sur le graphique — l'écart des tuiles se dit toujours. */
  comparer?: boolean
}) {
  const choses = lesChosesATraiter(vue?.aTraiter ?? null, direct, direct?.maintenant ?? vue?.maintenant)
  return (
    <div className="qg-poste">
      <EtatDuService direct={direct} vue={vue} enPanne={directEnPanne} ouvrir={ouvrir} />
      <ATraiter choses={choses} chargement={!vue && !direct && !vueEnPanne} ouvrir={ouvrir} />
      <ChiffresDeLaPeriode vue={vue} periode={periode} ouvrir={ouvrir} />
      <Participations vue={vue} enPanne={vueEnPanne} periode={periode} comparer={comparer} />
      <EnCeMoment direct={direct} enPanne={directEnPanne} />
      <SoireesEnCours direct={direct} ouvrir={() => ouvrir('soirees')} />
      <LeServeur direct={direct} vue={vue} ouvrir={() => ouvrir('serveur')} />
    </div>
  )
}

// ── L'état du service ─────────────────────────────────────────────────────

const ETAT_DIT: Record<VoyantDuService['etat'], string> = { ok: 'au vert', veille: 'à surveiller', serieux: 'sérieux', critique: 'critique', inconnu: 'en attente' }

/**
 * Les voyants du serveur, ce qui ne va pas d'abord (`etatDuService`) : un mot
 * et un chiffre chacun, et la page qui en dit plus. Au téléphone, ceux au
 * vert se replient derrière « Voir les dix voyants » : dix cases sur cinq
 * rangées repoussaient « À traiter » sous le pli, et ce qui ne va pas reste
 * toujours dehors (`.qg-etat-replie`, sans effet à l'ordinateur).
 */
function EtatDuService({ direct, vue, enPanne, ouvrir }: { direct: DirectDuQg | null; vue: VueDEnsemble | null; enPanne: boolean; ouvrir: (e: EcranATraiter) => void }) {
  const [tout, setTout] = useState(false)
  const voyants = etatDuService(direct, vue?.aTraiter.serveur ?? null)
  const { aRegarder, phrase } = phraseDeLEtat(voyants)
  const replies = voyants.length - aRegarder
  return (
    <section
      className={'qg-console qg-etat-du-service' + (aRegarder > 0 || enPanne ? ' qg-hud-alerte' : ' qg-hud') + (tout ? '' : ' qg-etat-replie')}
      aria-labelledby="qg-etat-titre"
    >
      <div className="qg-console-tete">
        <span className="qg-etiquette" id="qg-etat-titre">
          <span className="admin-pouls" aria-hidden="true" />
          État du service
        </span>
        <span className="qg-etat-phrase">
          {enPanne ? 'Le serveur ne répond plus' : phrase}
          {aRegarder > 0 && !enPanne && <span className="muted"> · le reste est au vert</span>}
        </span>
      </div>
      <ul className="qg-voyants">
        {voyants.map(v => {
          const contenu = (
            <>
              <i className={`qg-voyant qg-voyant-${v.etat}`} aria-hidden="true" />
              <b>{v.nom}</b>
              <span className="qg-voyant-detail">
                {v.detail}
                <span className="sr-only"> — {ETAT_DIT[v.etat]}</span>
              </span>
            </>
          )
          const ecran = v.ecran
          return (
            <li key={v.cle} className={`qg-voyant-bloc qg-voyant-bloc-${v.etat}`}>
              {ecran ? (
                <button type="button" onClick={() => ouvrir(ecran)}>
                  {contenu}
                </button>
              ) : (
                <div>{contenu}</div>
              )}
            </li>
          )
        })}
      </ul>
      {replies > 0 && (
        <button type="button" className="lien-discret qg-etat-deplier" aria-expanded={tout} onClick={() => setTout(!tout)}>
          {tout ? 'Replier ceux au vert' : aRegarder > 0 ? `Voir les ${formatNumber(replies)} autres voyants` : `Voir les ${formatNumber(replies)} voyants`}
          <Icon name="chevron-down" />
        </button>
      )}
    </section>
  )
}

// ── Les chiffres de la période ─────────────────────────────────────────────

/** La page de chaque mode : le Cabinet a la sienne depuis le 4 novembre 2026 — la campagne le garde encore parmi ses sous-modes. */
const PAGE_DU_MODE: Record<ModeDuQg, EcranATraiter> = { soiree: 'soirees', campagne: 'campagne', cabinet: 'cabinet', jour: 'jour', duel: 'duels' }

const somme = (parties: Record<ModeDuQg, number>) => MODES_DU_QG.reduce((n, m) => n + parties[m], 0)

function ChiffresDeLaPeriode({ vue, periode, ouvrir }: { vue: VueDEnsemble | null; periode: PeriodeDuQg; ouvrir: (e: EcranATraiter) => void }) {
  const a: ActiviteDUnePeriode | undefined = vue?.periodes?.[periode]
  const avant = a?.avant?.totaux
  const t = a?.totaux
  return (
    <section className="qg-chiffres" aria-labelledby="qg-chiffres-titre">
      <div className="qg-section-tete">
        <h2 className="compte-groupe" id="qg-chiffres-titre">
          Sur {PERIODE_EN_TOUTES_LETTRES[periode]}
        </h2>
        <span className="muted small">{a?.avant ? 'comparé à la période d’avant, arrêtée au même instant' : periode === '30j' ? 'le mois d’avant n’est pas gardé' : ''}</span>
      </div>
      <ul className="qg-tuiles qg-tuiles-quatre">
        {/* Des personnes, pas des profils : chaque invité sans profil y compte une fois par soirée — la page des joueurs, elle, ne compte que des profils. */}
        <TuileDuQg nom="Personnes" valeur={t?.joueurs} ecart={t && ecartALaPeriodeDAvant(t.joueurs, avant?.joueurs)} detail="invités compris" etincelle={a?.seaux.map(s => s.joueurs)} />
        <TuileDuQg nom="Participations" valeur={t && somme(t.parties)} ecart={t && ecartALaPeriodeDAvant(somme(t.parties), avant && somme(avant.parties))} etincelle={a?.seaux.map(s => somme(s.parties))} />
        <TuileDuQg nom="Nouveaux profils" valeur={t?.nouveauxProfils} ecart={t && ecartALaPeriodeDAvant(t.nouveauxProfils, avant?.nouveauxProfils)} />
        <TuileDuQg nom="Achats en boutique" valeur={t?.achats} ecart={t && ecartALaPeriodeDAvant(t.achats, avant?.achats)} />
      </ul>
      {/* Mode par mode, ses participations ; un toucher ouvre sa page. */}
      <ul className="qg-tuiles qg-tuiles-cinq qg-modes">
        {MODES_DU_QG.map(m => (
          <TuileDuQg
            key={m}
            nom={NOM_DU_MODE[m]}
            mode={m}
            valeur={t?.parties[m]}
            ecart={t && ecartALaPeriodeDAvant(t.parties[m], avant?.parties[m])}
            detail={t ? `${formatNumber(t.modes[m])} joueur${t.modes[m] > 1 ? 's' : ''}` : undefined}
            etincelle={a?.seaux.map(s => s.parties[m])}
            onOuvrir={() => ouvrir(PAGE_DU_MODE[m])}
          />
        ))}
      </ul>
    </section>
  )
}

// ── La participation, seau par seau ───────────────────────────────────────

/**
 * Ce que le graphique compte (le souhait du propriétaire du 2 novembre 2026 :
 * « le nombre de personnes unique qui participent mais aussi pouvoir switcher
 * sur la quantité peu importe l'utilisateur ») : les joueurs, chacun une fois
 * par seau ; ou les participations, chaque partie jouée.
 */
export const COMPTES_DU_GRAPHE = ['joueurs', 'participations'] as const
export type CompteDuGraphe = (typeof COMPTES_DU_GRAPHE)[number]

const NOM_DU_COMPTE: Record<CompteDuGraphe, string> = { joueurs: 'Joueurs', participations: 'Participations' }
const REGLE_DU_COMPTE: Record<CompteDuGraphe, string> = {
  joueurs: 'Chaque personne compte une fois par seau, à quoi qu’elle joue',
  participations: 'Chaque partie compte, qui que ce soit ; en soirée, chaque invité qui a joué',
}

const HEURE = 3_600_000

/** Le nom d'un seau dans l'infobulle et la lecture : « mardi 3 novembre », « mardi 3 novembre, 18 h 00 → 21 h 00 », « 21 h 00 → 22 h 00 ». */
export function nomDuSeau(debut: number, pas: number, fin: number): string {
  const jusqua = Math.min(debut + pas, fin)
  if (pas >= 20 * HEURE) return jourEnToutesLettres(jourDe(debut + 12 * HEURE))
  if (pas >= 3 * HEURE) return `${jourEnToutesLettres(jourDe(debut))}, ${heureEcrite(debut)} → ${heureEcrite(jusqua)}`
  return `${heureEcrite(debut)} → ${heureEcrite(jusqua)}`
}

/**
 * Les étiquettes sous l'axe, comptées depuis le dernier seau : une heure,
 * un jour — à minuit, pour une semaine en seaux de trois heures —, autant
 * qu'il en tient, jamais l'une sur l'autre.
 */
export function etiquetteDeLAxe(debuts: readonly number[], pas: number, i: number, largeur: number): string | null {
  const n = debuts.length
  const tiennent = Math.max(2, Math.floor((largeur - 40) / 72))
  if (pas >= 3 * HEURE && pas < 20 * HEURE) {
    const minuits = debuts.map((d, k) => (minutesDeParis(d) === 0 ? k : -1)).filter(k => k >= 0)
    const rang = minuits.indexOf(i)
    if (rang < 0) return null
    const saut = Math.ceil(minuits.length / tiennent)
    return (minuits.length - 1 - rang) % saut === 0 ? jourAbrege(jourDe(debuts[i])) : null
  }
  const saut = Math.ceil(n / tiennent)
  if ((n - 1 - i) % saut !== 0) return null
  if (pas >= 20 * HEURE) return i === n - 1 ? 'aujourd’hui' : jourAbrege(jourDe(debuts[i] + 12 * HEURE))
  return heureEcrite(debuts[i])
}

/**
 * Le graphique vit dans l'écran nocturne du QG (`.qg`) : ses cinq couleurs y
 * ont été vérifiées — voisines dans la pile, elles restent distinctes aux
 * daltonismes. Les joueurs s'y dressent en une seule série : empilés par
 * mode, qui joue à deux modes aurait compté deux fois dans la hauteur ; leurs
 * modes se lisent dans la légende. Les participations, elles, s'additionnent :
 * leur pile se lit mode par mode. La période d'avant, quand on compare, se
 * pose en filet.
 */
export function Participations({
  vue,
  enPanne,
  periode = '24h',
  comparer = false,
  depart = 'joueurs',
}: {
  vue: VueDEnsemble | null
  enPanne: boolean
  periode?: PeriodeDuQg
  comparer?: boolean
  depart?: CompteDuGraphe
}) {
  const [quoi, setQuoi] = useState<CompteDuGraphe>(depart)
  const [tableau, setTableau] = useState(false)
  const a = vue?.periodes?.[periode]
  const seaux = a?.seaux ?? []
  const fin = vue?.maintenant ?? 0
  const debuts = seaux.map(s => s.debut)
  const etiquettes = seaux.map(s => nomDuSeau(s.debut, a?.pas ?? HEURE, fin))
  const empile = quoi === 'participations'
  const series: SerieDuGraphe[] = empile
    ? MODES_DU_QG.map(m => ({ cle: m, nom: NOM_DU_MODE[m], valeurs: seaux.map(s => s.parties[m]), classe: `qg-mode-${m}` }))
    : [{ cle: 'joueurs', nom: 'Joueurs', valeurs: seaux.map(s => s.joueurs), classe: 'qg-joueurs' }]
  const avant = comparer && a?.avant ? a.avant.seaux.map(s => (empile ? somme(s.parties) : s.joueurs)) : null
  const totaux = seaux.map(s => (empile ? somme(s.parties) : s.joueurs))
  const vide = totaux.every(v => v === 0)
  const dernier = seaux.at(-1)
  return (
    <section className="qg-console qg-participations" aria-labelledby="qg-participations-titre">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">{NOM_DU_COMPTE[quoi]}</span>
          <h2 id="qg-participations-titre">Seau par seau, sur {PERIODE_EN_TOUTES_LETTRES[periode]}</h2>
          <span className="muted small">{REGLE_DU_COMPTE[quoi]}</span>
        </div>
        <div className="onglets onglets-puces" role="group" aria-label="Ce que le graphique compte">
          {COMPTES_DU_GRAPHE.map(q => (
            <button key={q} type="button" className={'onglet' + (quoi === q ? ' actif' : '')} aria-pressed={quoi === q} onClick={() => setQuoi(q)}>
              {NOM_DU_COMPTE[q]}
            </button>
          ))}
        </div>
      </div>
      {!a ? (
        <p className="serif-note">{enPanne ? 'La base permanente ne répond pas : la vue se relira toute seule.' : 'Chargement…'}</p>
      ) : vide ? (
        <p className="muted small">Personne n’a joué sur {PERIODE_EN_TOUTES_LETTRES[periode]}.</p>
      ) : (
        <>
          <GrapheDuTemps
            etiquettes={etiquettes}
            axe={(i, largeur) => etiquetteDeLAxe(debuts, a.pas, i, largeur)}
            series={series}
            empile={empile}
            avant={avant}
            repartition={empile ? undefined : seaux.map(s => MODES_DU_QG.map(m => ({ nom: NOM_DU_MODE[m], valeur: s.modes[m] })))}
            nomDuTotal={empile ? 'participation' : 'joueur'}
            resume={`${empile ? 'Participations par mode' : 'Joueurs, tous modes confondus'}, sur ${PERIODE_EN_TOUTES_LETTRES[periode]} : de ${formatNumber(Math.min(...totaux))} à ${formatNumber(Math.max(...totaux))} par seau, ${formatNumber(totaux.at(-1) ?? 0)} dans le dernier.`}
          />
          {dernier && (
            <div className="qg-legende">
              <ul>
                {MODES_DU_QG.map(m => (
                  <li key={m}>
                    {/* La pastille dit la couleur d'une pile : les joueurs n'en ont qu'une, la leur. */}
                    {empile && <i className={`qg-pastille-mode qg-mode-${m}`} aria-hidden="true" />}
                    {NOM_DU_MODE[m]} <b className="num">{formatNumber(empile ? a.totaux.parties[m] : a.totaux.modes[m])}</b>
                  </li>
                ))}
                {avant && (
                  <li>
                    <i className="qg-pastille-avant" aria-hidden="true" />
                    La période d’avant
                  </li>
                )}
              </ul>
              {!empile && <span className="muted small">Qui joue à plusieurs modes compte dans chacun, une fois dans le total.</span>}
            </div>
          )}
          {/* Rendu à l'ouverture seulement : replié, le tableau n'a pas à se construire. */}
          <details className="qg-tableau" onToggle={e => setTableau(e.currentTarget.open)}>
            <summary>Les chiffres, seau par seau</summary>
            {tableau && (
              <table>
                <caption className="sr-only">{`${NOM_DU_COMPTE[quoi]} par seau et par mode`}</caption>
                <thead>
                  <tr>
                    <th scope="col">Seau</th>
                    {MODES_DU_QG.map(m => (
                      <th key={m} scope="col">
                        {NOM_DU_MODE[m]}
                      </th>
                    ))}
                    <th scope="col">Tous modes</th>
                  </tr>
                </thead>
                <tbody>
                  {[...seaux].reverse().map((s, k) => (
                    <tr key={s.debut}>
                      <th scope="row">{etiquettes[seaux.length - 1 - k]}</th>
                      {MODES_DU_QG.map(m => (
                        <td key={m} className="num">
                          {formatNumber(empile ? s.parties[m] : s.modes[m])}
                        </td>
                      ))}
                      <td className="num">{formatNumber(empile ? somme(s.parties) : s.joueurs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </details>
        </>
      )}
    </section>
  )
}

// ── En ce moment ──────────────────────────────────────────────────────────

function EnCeMoment({ direct, enPanne }: { direct: DirectDuQg | null; enPanne: boolean }) {
  const soirees = direct?.soirees ?? []
  const enCours = soirees.filter(s => s.etat === 'en-cours')
  const enPlan = soirees.length - enCours.length
  const inscrits = enCours.reduce((n, s) => n + s.inscrits, 0)
  const miroir = direct?.miroir ?? null
  const panne = !!miroir && (miroir.enEchecDepuis !== null || miroir.espacesEnRetard > 0)
  const base = direct?.serveur.baseP95Ms
  return (
    <section className={'admin-hud qg-direct' + (enPanne ? ' admin-hud-alerte' : '')} aria-labelledby="qg-direct-titre">
      <span className="salon-hud-label" id="qg-direct-titre">
        <span className="admin-pouls" aria-hidden="true" />
        {enPanne ? 'Le serveur ne répond plus' : 'En ce moment'}
      </span>
      <div className="admin-cadrans qg-cadrans">
        <Cadran
          chiffre={direct ? enCours.length : undefined}
          nom={enCours.length > 1 ? 'soirées en cours' : 'soirée en cours'}
          detail={enPlan > 0 ? `et ${enPlan} laissée${enPlan > 1 ? 's' : ''} en plan` : undefined}
        />
        <Cadran
          chiffre={direct?.invitesConnectes}
          nom={direct?.invitesConnectes === 1 ? 'invité connecté' : 'invités connectés'}
          detail={inscrits > 0 ? `sur ${formatNumber(inscrits)} inscrit${inscrits > 1 ? 's' : ''} ce soir` : undefined}
        />
        <Cadran chiffre={direct?.profilsEnLigne} nom={direct?.profilsEnLigne === 1 ? 'profil en ligne' : 'profils en ligne'} detail="ces cinq dernières minutes" />
        <Cadran
          chiffre={miroir?.enAttente}
          nom={miroir?.enAttente === 1 ? 'écriture en attente' : 'écritures en attente'}
          alerte={panne}
          detail={
            !miroir
              ? undefined
              : miroir.enEchecDepuis !== null
                ? `Turso en échec depuis ${heureEcrite(Date.parse(miroir.enEchecDepuis))}`
                : miroir.espacesEnRetard > 0
                  ? `${miroir.espacesEnRetard} salon${miroir.espacesEnRetard > 1 ? 's' : ''} en retard`
                  : `miroir à jour${typeof base === 'number' ? ` · Turso ${formatNumber(base)} ms` : ''}`
          }
        />
      </div>
    </section>
  )
}

/** Un chiffre du direct : un tiret tant qu'il n'est pas arrivé. Il se lit, il ne s'ouvre pas — les soirées mènent à leur page par leur carte, plus bas. */
function Cadran({ chiffre, nom, detail, alerte }: { chiffre?: number; nom: string; detail?: string; alerte?: boolean }) {
  return (
    <div className={'admin-cadran admin-cadran-fixe' + (alerte ? ' admin-cadran-alerte' : '')}>
      <span className="admin-cadran-chiffre num">{chiffre === undefined ? '–' : formatNumber(chiffre)}</span>
      <span className="admin-cadran-nom">{nom}</span>
      {detail && <span className="admin-cadran-detail">{detail}</span>}
    </div>
  )
}

// ── À traiter ─────────────────────────────────────────────────────────────

function iconeDe(c: ChoseATraiter): IconName {
  if (c.alerte) return 'alert'
  if (c.cle.startsWith('signalements')) return 'flag'
  if (c.cle === 'catalogue') return 'globe'
  if (c.cle.startsWith('en-plan')) return 'clock'
  return 'bell'
}

function ATraiter({ choses, chargement, ouvrir }: { choses: ChoseATraiter[]; chargement: boolean; ouvrir: (e: EcranATraiter) => void }) {
  return (
    <section className="qg-console qg-traiter" aria-labelledby="qg-traiter-titre">
      <div className="qg-console-tete">
        <h2 id="qg-traiter-titre">À traiter</h2>
        {choses.length > 0 && <span className="etiquette num">{choses.length}</span>}
      </div>
      {chargement ? (
        <p className="serif-note">Chargement…</p>
      ) : choses.length === 0 ? (
        <p className="muted small">Rien n’attend de geste : la réserve tient, personne ne signale rien.</p>
      ) : (
        <ul className="qg-liste">
          {choses.map(c => {
            const ecran = c.ecran
            const contenu = (
              <>
                <span className={'qg-rond' + (c.alerte ? ' qg-rond-alerte' : '')}>
                  <Icon name={iconeDe(c)} />
                </span>
                <span className="qg-ligne-texte">
                  <b>{c.titre}</b>
                  <span className="muted small">{c.detail}</span>
                </span>
                {ecran && <Icon name="chevron-right" className="qg-chevron" />}
              </>
            )
            return (
              <li key={c.cle}>
                {ecran ? (
                  <button type="button" className={'qg-ligne' + (c.alerte ? ' qg-ligne-alerte' : '')} onClick={() => ouvrir(ecran)}>
                    {contenu}
                  </button>
                ) : (
                  <div className={'qg-ligne' + (c.alerte ? ' qg-ligne-alerte' : '')}>{contenu}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ── Les soirées en cours ──────────────────────────────────────────────────

function SoireesEnCours({ direct, ouvrir }: { direct: DirectDuQg | null; ouvrir: () => void }) {
  const soirees = direct?.soirees ?? []
  return (
    <section className="qg-console qg-soirees" aria-labelledby="qg-soirees-titre">
      <div className="qg-console-tete">
        <h2 id="qg-soirees-titre">Soirées en cours</h2>
        {soirees.length > 0 && <span className="etiquette num">{soirees.length}</span>}
      </div>
      {!direct ? (
        <p className="serif-note">Chargement…</p>
      ) : soirees.length === 0 ? (
        <p className="muted small">Aucune soirée ne se joue en ce moment.</p>
      ) : (
        <ul className="qg-liste">
          {soirees.map(s => (
            <LigneDeSoiree key={s.spaceId} s={s} maintenant={direct.maintenant} />
          ))}
        </ul>
      )}
      <button type="button" className="lien-discret qg-suite" onClick={ouvrir}>
        Toutes les soirées
        <Icon name="chevron-right" />
      </button>
    </section>
  )
}

/**
 * Une soirée pas encore close : son salon, où elle en est, depuis quand,
 * combien de téléphones, sa sauvegarde — et, sur la page des soirées, le
 * geste qui la clôt (`children`). Des chiffres seulement.
 */
export function LigneDeSoiree({ s, maintenant, children }: { s: SoireeDuQg; maintenant: number; children?: ReactNode }) {
  return (
    <li className={'qg-soiree' + (s.etat === 'en-plan' ? ' qg-soiree-en-plan' : '')}>
      <span className="qg-avatar" aria-hidden="true">
        {s.salon.avatar ?? <Icon name="home" />}
      </span>
      <span className="qg-ligne-texte">
        <b>{s.salon.nom}</b>
        <span className="muted small">
          {ouEnEstLaSoiree(s)} ·{' '}
          {s.etat === 'en-plan' ? `sans un geste depuis ${dureeEcrite(maintenant - s.dernierSigne)}` : `depuis ${dureeEcrite(maintenant - s.depuis)}`}
        </span>
        <span className="small">
          {formatNumber(s.connectes)} sur {formatNumber(s.inscrits)} connecté{s.inscrits > 1 ? 's' : ''}
          {s.etat === 'en-cours' && !s.ecran && ' · aucun écran branché'}
        </span>
      </span>
      {/* Au téléphone, sous le texte ; à l'ordinateur, au bout de la ligne. */}
      {s.sauvegardeEnRetard ? (
        <span className="qg-etat qg-etat-alerte">
          <Icon name="alert" />
          sauvegarde en retard
        </span>
      ) : (
        <span className="qg-etat qg-etat-ok">
          <Icon name="check-circle" />
          sauvegardée
        </span>
      )}
      {children && <span className="qg-soiree-geste">{children}</span>}
    </li>
  )
}

// ── Le serveur ────────────────────────────────────────────────────────────

const pourcents = (n: number | null) => (n === null ? '–' : `${formatNumber(n)} %`)

function LeServeur({ direct, vue, ouvrir }: { direct: DirectDuQg | null; vue: VueDEnsemble | null; ouvrir: () => void }) {
  const s = direct?.serveur
  const routine = vue?.aTraiter.routine
  const maintenant = vue?.maintenant ?? direct?.maintenant ?? 0
  const depot = (t: number | null | undefined) => (t == null ? 'rien encore' : quandEcrit(t, maintenant))
  return (
    <section className="qg-console qg-serveur" aria-labelledby="qg-serveur-titre">
      <div className="qg-console-tete">
        <h2 id="qg-serveur-titre">Le serveur</h2>
        {s && (
          <span className="muted small">
            {s.env === 'production' ? 'Production' : s.env}
            {s.version && ` · version ${s.version.slice(0, 7)}`} · en marche depuis {dureeEcrite(s.enMarcheDepuisS * 1000)}
          </span>
        )}
      </div>
      <dl className="admin-fiche">
        <div>
          <dt>Mémoire</dt>
          <dd className="num">{s?.memoireMo == null ? '–' : `${formatNumber(s.memoireMo)} Mo`}</dd>
        </div>
        <div>
          <dt>Processeur</dt>
          <dd className="num">{s ? `${pourcents(s.cpuPct)} d’un cœur` : '–'}</dd>
        </div>
        <div>
          <dt>Boucle occupée</dt>
          <dd className="num">{s ? pourcents(s.bouclePct) : '–'}</dd>
        </div>
        <div>
          <dt>Turso, 95ᵉ centile</dt>
          <dd className="num">{s?.baseP95Ms == null ? '–' : `${formatNumber(s.baseP95Ms)} ms`}</dd>
        </div>
        <div>
          <dt>Connexions temps réel</dt>
          <dd className="num">{s?.connexions == null ? '–' : formatNumber(s.connexions)}</dd>
        </div>
        {/* Le dernier dépôt de la routine du matin, dans chaque réserve : celle qui se tait ne prévient pas. */}
        <div>
          <dt>Routine, quiz du jour</dt>
          <dd>{routine ? depot(routine.jour) : '–'}</dd>
        </div>
        <div>
          <dt>Routine, campagne</dt>
          <dd>{routine ? depot(routine.campagne) : '–'}</dd>
        </div>
      </dl>
      {/* L'instant ici ; la semaine — les temps de réponse, les réveils, les erreurs — sur sa page. */}
      <button type="button" className="lien-discret qg-suite" onClick={ouvrir}>
        Les sept derniers jours
        <Icon name="chevron-right" />
      </button>
    </section>
  )
}
