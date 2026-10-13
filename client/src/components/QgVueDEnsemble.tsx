import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { formatNumber } from '../../../shared/typographie'
import { jourEnToutesLettres } from '../../../shared/jour'
import {
  MODES_DU_QG,
  NOM_DE_LA_TUILE,
  NOM_DU_MODE,
  TUILES_DU_QG,
  dureeEcrite,
  ecartALHabitude,
  graduations,
  heureEcrite,
  jourAbrege,
  lesChosesATraiter,
  ouEnEstLaSoiree,
  quandEcrit,
  type ChoseATraiter,
  type CompteDuJour,
  type DirectDuQg,
  type ParticipationsDuJour,
  type SoireeDuQg,
  type VueDEnsemble,
} from '../../../shared/qg'

/** Les écrans du QG qu'une chose à traiter ouvre. */
type EcranATraiter = NonNullable<ChoseATraiter['ecran']>

/**
 * La vue d'ensemble du QG (`/admin`) : ce qui se passe en ce moment, ce qu'on
 * joue aujourd'hui comparé à la même heure, trente jours de participations
 * mode par mode, ce qui attend un geste, les soirées en cours, le serveur.
 * La tour de contrôle des maquettes du 13 octobre 2026 — des chiffres
 * d'abord. Des soirées des autres, rien que des chiffres : où elles en sont,
 * combien d'invités, jamais un prénom ni un quiz (`server/src/qg.ts`).
 *
 * Au téléphone, une colonne : le direct, ce qui attend un geste, puis le
 * reste. À l'ordinateur, la grille des maquettes (`.qg-vue`, `styles.css`).
 */
export function VueDEnsembleDuQg({
  vue,
  direct,
  vueEnPanne,
  directEnPanne,
  ouvrir,
}: {
  vue: VueDEnsemble | null
  direct: DirectDuQg | null
  /** La dernière lecture a échoué : on montre la précédente, et on le dit. */
  vueEnPanne: boolean
  directEnPanne: boolean
  ouvrir: (e: EcranATraiter) => void
}) {
  const choses = lesChosesATraiter(vue?.aTraiter ?? null, direct)
  return (
    <div className="qg-vue">
      <EnCeMoment direct={direct} enPanne={directEnPanne} />
      <ATraiter choses={choses} chargement={!vue && !direct && !vueEnPanne} ouvrir={ouvrir} />
      <Aujourdhui vue={vue} />
      <Participations vue={vue} enPanne={vueEnPanne} />
      <SoireesEnCours direct={direct} ouvrir={() => ouvrir('soirees')} />
      <LeServeur direct={direct} vue={vue} />
    </div>
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
    <section className="qg-carte qg-traiter" aria-labelledby="qg-traiter-titre">
      <div className="qg-carte-tete">
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
                  <button type="button" className="qg-ligne" onClick={() => ouvrir(ecran)}>
                    {contenu}
                  </button>
                ) : (
                  <div className="qg-ligne">{contenu}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ── Aujourd'hui ───────────────────────────────────────────────────────────

function Aujourdhui({ vue }: { vue: VueDEnsemble | null }) {
  return (
    <section className="qg-jour" aria-labelledby="qg-jour-titre">
      <div className="qg-section-tete">
        <h2 className="compte-groupe" id="qg-jour-titre">
          Aujourd’hui
        </h2>
        <span className="muted small">comparé à la même heure, en moyenne sur les sept jours d’avant</span>
      </div>
      <ul className="qg-tuiles">
        {TUILES_DU_QG.map(t => (
          <Tuile key={t} nom={NOM_DE_LA_TUILE[t]} compte={vue?.aujourdhui[t]} />
        ))}
      </ul>
    </section>
  )
}

function Tuile({ nom, compte }: { nom: string; compte?: CompteDuJour }) {
  const ecart = compte ? ecartALHabitude(compte) : null
  return (
    <li className="qg-tuile">
      <span className="qg-tuile-nom">{nom}</span>
      <span className="qg-tuile-valeur num">{compte ? formatNumber(compte.aujourdhui) : '–'}</span>
      {ecart && (
        <span
          className={'qg-ecart' + (ecart.sens ? ` qg-ecart-${ecart.sens}` : '')}
          title={compte?.habituel != null ? `D’habitude à cette heure : ${formatNumber(compte.habituel)}` : undefined}
        >
          {ecart.sens && <Icon name={ecart.sens === 'plus' ? 'arrow-up' : 'arrow-down'} />}
          {ecart.texte}
          {ecart.suite && <span className="sr-only">{ecart.suite}</span>}
        </span>
      )}
      {compte && <Etincelle valeurs={compte.parJour} />}
    </li>
  )
}

/**
 * Les douze derniers jours d'un chiffre, en un trait : depuis zéro, pour
 * qu'une journée à trois ne paraisse pas une chute, et aujourd'hui en point
 * — à l'heure qu'il est, il n'est pas fini. Le point reste rond quelle que
 * soit la largeur de la tuile : un trait de longueur nulle, aux bouts ronds.
 */
function Etincelle({ valeurs }: { valeurs: readonly number[] }) {
  const max = Math.max(0, ...valeurs)
  const n = valeurs.length
  const points = valeurs.map((v, i) => [n > 1 ? (i / (n - 1)) * 100 : 100, max > 0 ? 28 - (v / max) * 24 : 28] as const)
  const [dx, dy] = points[n - 1] ?? [100, 28]
  return (
    <svg className="qg-etincelle" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="qg-etincelle-ligne" d={points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')} />
      <path className="qg-etincelle-point" d={`M${dx.toFixed(1)} ${dy.toFixed(1)}h0`} />
    </svg>
  )
}

// ── Trente jours de participations ────────────────────────────────────────

const totalDe = (p: ParticipationsDuJour) => MODES_DU_QG.reduce((n, m) => n + p.modes[m], 0)
const participations = (n: number) => `${formatNumber(n)} participation${n > 1 ? 's' : ''}`

/**
 * Le graphique tient dans un écran nocturne sous tous les thèmes (`.qg-ecran`) :
 * ses quatre couleurs ont été vérifiées sur ce fond-là — voisines dans la
 * pile, elles restent distinctes aux daltonismes —, pas sur les trente-quatre
 * fonds des thèmes, dont plusieurs sont clairs.
 */
function Participations({ vue, enPanne }: { vue: VueDEnsemble | null; enPanne: boolean }) {
  const [choisi, setChoisi] = useState<number | null>(null)
  const [tableau, setTableau] = useState(false)
  const jours = vue?.participations ?? []
  const lu = choisi !== null && jours[choisi] ? choisi : jours.length - 1
  const jour = jours[lu]
  const vide = jours.every(j => totalDe(j) === 0)
  return (
    <section className="qg-carte qg-ecran qg-participations" aria-labelledby="qg-participations-titre">
      <div className="qg-carte-tete">
        <h2 id="qg-participations-titre">Participations par jour</h2>
        <span className="muted small">Un joueur compte une fois par mode et par jour · {jours.length || 30} jours</span>
      </div>
      {!vue ? (
        <p className="serif-note">{enPanne ? 'La base permanente ne répond pas : la vue se relira toute seule.' : 'Chargement…'}</p>
      ) : vide ? (
        <p className="muted small">Personne n’a joué ces trente derniers jours.</p>
      ) : (
        <>
          <Graphe jours={jours} choisi={choisi} choisir={setChoisi} />
          {jour && (
            <div className="qg-legende">
              <span className="qg-legende-jour">
                {lu === jours.length - 1 ? 'Aujourd’hui' : jourEnToutesLettres(jour.jour)} · {participations(totalDe(jour))}
              </span>
              <ul>
                {MODES_DU_QG.map(m => (
                  <li key={m}>
                    <i className={`qg-pastille-mode qg-mode-${m}`} aria-hidden="true" />
                    {NOM_DU_MODE[m]} <b className="num">{formatNumber(jour.modes[m])}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Rendu à l'ouverture seulement : replié, le tableau n'a pas à se construire. */}
          <details className="qg-tableau" onToggle={e => setTableau(e.currentTarget.open)}>
            <summary>Les chiffres, jour par jour</summary>
            {tableau && (
              <table>
                <thead>
                  <tr>
                    <th scope="col">Jour</th>
                    {MODES_DU_QG.map(m => (
                      <th key={m} scope="col">
                        {NOM_DU_MODE[m]}
                      </th>
                    ))}
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...jours].reverse().map(j => (
                    <tr key={j.jour}>
                      <th scope="row">{jourEnToutesLettres(j.jour)}</th>
                      {MODES_DU_QG.map(m => (
                        <td key={m} className="num">
                          {formatNumber(j.modes[m])}
                        </td>
                      ))}
                      <td className="num">{formatNumber(totalDe(j))}</td>
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

/** La largeur d'une boîte, suivie : le graphique se dessine au pixel près, ses textes à leur taille. */
function useLargeur(defaut: number) {
  const boite = useRef<HTMLDivElement>(null)
  const [largeur, setLargeur] = useState(defaut)
  useEffect(() => {
    const el = boite.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const suivi = new ResizeObserver(([e]) => {
      const l = Math.round(e.contentRect.width)
      if (l > 0) setLargeur(l)
    })
    suivi.observe(el)
    return () => suivi.disconnect()
  }, [])
  return [boite, largeur] as const
}

/** Une barre arrondie en haut — le bout de la donnée —, carrée sur sa base. */
function barreArrondie(x: number, y: number, l: number, h: number): string {
  const r = Math.min(4, l / 2, h)
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + l - r}Q${x + l} ${y} ${x + l} ${y + r}V${y + h}Z`
}

const MARGE = { gauche: 36, droite: 4, haut: 20, bas: 24 }
/** Le filet du fond entre deux segments d'une barre : collées, deux couleurs voisines se fondaient. */
const ECART = 2

function Graphe({ jours, choisi, choisir }: { jours: ParticipationsDuJour[]; choisi: number | null; choisir: (i: number | null) => void }) {
  const [boite, largeur] = useLargeur(640)
  const hauteur = Math.round(Math.min(240, Math.max(160, largeur * 0.3)))
  const totaux = jours.map(totalDe)
  const crans = graduations(Math.max(...totaux))
  const sommet = crans[crans.length - 1] || 1
  const utile = { l: Math.max(1, largeur - MARGE.gauche - MARGE.droite), h: hauteur - MARGE.haut - MARGE.bas }
  const pas = utile.l / jours.length
  const barre = Math.min(24, Math.max(3, pas * 0.66))
  const y = (v: number) => MARGE.haut + utile.h - (v / sommet) * utile.h
  const n = jours.length
  // Au téléphone, trois dates sous l'axe ; à l'ordinateur, une par semaine, comptée depuis aujourd'hui.
  const etiquettes = largeur < 480 ? [0, Math.floor((n - 1) / 2), n - 1] : jours.map((_, i) => i).filter(i => (n - 1 - i) % 7 === 0)
  const lu = choisi ?? n - 1
  const xDe = (i: number) => MARGE.gauche + i * pas
  const ancre = (i: number) => (i >= n - 2 ? 'end' : i <= 1 ? 'start' : 'middle')
  const xTexte = (i: number) => (ancre(i) === 'end' ? xDe(i) + pas : ancre(i) === 'start' ? xDe(i) : xDe(i) + pas / 2)
  // Le total lu s'écrit au-dessus des barres qu'il enjambe : posé sur la sienne seule, il mordait sur une voisine plus haute.
  const enjambees = ancre(lu) === 'end' ? [lu - 2, lu - 1, lu] : ancre(lu) === 'start' ? [lu, lu + 1, lu + 2] : [lu - 1, lu, lu + 1]
  const dessusDuTotal = Math.max(...enjambees.map(i => totaux[i] ?? 0))
  const resume = `Participations par jour et par mode, du ${jourEnToutesLettres(jours[0].jour, true)} à aujourd’hui : de ${formatNumber(Math.min(...totaux))} à ${formatNumber(Math.max(...totaux))} par jour, ${formatNumber(totaux[n - 1])} aujourd’hui.`
  return (
    <div ref={boite} className="qg-graphe">
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} role="img" aria-label={resume} onPointerLeave={() => choisir(null)}>
        {choisi !== null && <rect className="qg-graphe-choisi" x={xDe(choisi)} y={MARGE.haut} width={pas} height={utile.h} rx={4} />}
        <g className="qg-graphe-grille">
          {crans.map(c => (
            <line key={c} x1={MARGE.gauche} x2={largeur - MARGE.droite} y1={y(c)} y2={y(c)} />
          ))}
        </g>
        <g className="qg-graphe-axe" textAnchor="end">
          {crans.map(c => (
            <text key={c} x={MARGE.gauche - 8} y={y(c) + 4}>
              {formatNumber(c)}
            </text>
          ))}
        </g>
        <g className="qg-graphe-axe">
          {etiquettes.map(i => (
            <text key={i} x={xTexte(i)} y={hauteur - 6} textAnchor={ancre(i)}>
              {i === n - 1 ? 'aujourd’hui' : jourAbrege(jours[i].jour)}
            </text>
          ))}
        </g>
        {jours.map((j, i) => {
          const x = xDe(i) + (pas - barre) / 2
          const visibles = MODES_DU_QG.filter(m => j.modes[m] > 0)
          const detail = visibles.map(m => `${NOM_DU_MODE[m].toLowerCase()} ${formatNumber(j.modes[m])}`).join(', ')
          let base = y(0)
          return (
            <g key={j.jour}>
              <title>{`${jourEnToutesLettres(j.jour)} : ${participations(totaux[i])}${detail ? ` — ${detail}` : ''}`}</title>
              {visibles.map((m, k) => {
                const h = (j.modes[m] / sommet) * utile.h
                const haut = base - h
                base = haut
                if (k === visibles.length - 1) return <path key={m} className={`qg-mode-${m}`} d={barreArrondie(x, haut, barre, h)} />
                const visible = Math.max(0, h - ECART)
                return <rect key={m} className={`qg-mode-${m}`} x={x} y={haut + h - visible} width={barre} height={visible} />
              })}
              {/* La cible du survol et du toucher : toute la hauteur, toute la largeur du jour. */}
              <rect className="qg-graphe-cible" x={xDe(i)} y={MARGE.haut} width={pas} height={utile.h} onPointerEnter={() => choisir(i)} onClick={() => choisir(i)} />
            </g>
          )
        })}
        <text className="qg-graphe-total" x={xTexte(lu)} y={Math.max(12, y(dessusDuTotal) - 6)} textAnchor={ancre(lu)}>
          {formatNumber(totaux[lu])}
        </text>
      </svg>
    </div>
  )
}

// ── Les soirées en cours ──────────────────────────────────────────────────

function SoireesEnCours({ direct, ouvrir }: { direct: DirectDuQg | null; ouvrir: () => void }) {
  const soirees = direct?.soirees ?? []
  return (
    <section className="qg-carte qg-soirees" aria-labelledby="qg-soirees-titre">
      <div className="qg-carte-tete">
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

function LeServeur({ direct, vue }: { direct: DirectDuQg | null; vue: VueDEnsemble | null }) {
  const s = direct?.serveur
  const routine = vue?.aTraiter.routine
  const maintenant = vue?.maintenant ?? direct?.maintenant ?? 0
  const depot = (t: number | null | undefined) => (t == null ? 'rien encore' : quandEcrit(t, maintenant))
  return (
    <section className="qg-carte qg-serveur" aria-labelledby="qg-serveur-titre">
      <div className="qg-carte-tete">
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
    </section>
  )
}
