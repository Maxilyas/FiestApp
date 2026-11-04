import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from './Icon'
import { Feuille } from './Pieces'
import { CarteDeChaleur, GrapheDuTemps, TuileDuQg, type CaseDeChaleur } from './QgGraphes'
import { reperesDeLaCourbe, useReperesDuQg } from '../qgReperes'
import { FicheDuJoueurAuQg } from './QgFicheJoueur'
import { supprimerLeProfil } from './AdminProfils'
import { espacesFines } from '../format'
import { formatNumber } from '../../../shared/typographie'
import { jourAvant, jourDe, jourEnToutesLettres } from '../../../shared/jour'
import { MODES_DU_QG, NOM_DU_MODE, ecartALHabitude, jourAbrege, quandEcrit, type EcartALHabitude, type ModeDuQg } from '../../../shared/qg'
import { ecartALaPeriodeDAvant } from '../../../shared/qgPeriodes'
import {
  NOM_DE_L_ORIGINE,
  NOM_DU_SEGMENT,
  PROFILS_D_AVANT_L_ORIGINE,
  PROFILS_D_UN_SEGMENT,
  REGLE_DU_SEGMENT,
  SEMAINES_DE_RETOUR,
  joursEntre,
  minuitDuJour,
  nomDeLaCombinaison,
  partEcrite,
  type MembreMontre,
  type PageDesJoueurs,
  type PasDesNes,
  type PremiersPas,
  type SegmentDuQg,
  type SegmentMontre,
} from '../../../shared/qgJoueurs'
import type { OrigineLue } from '../../../shared/origines'

/** « 1 profil », « 0 profil », « 12 profils » : zéro s'écrit au singulier. */
const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${formatNumber(n)} ${n > 1 ? motPluriel : mot}`
/** Une part en pour cent, l'espace insécable devant le signe. */
const pourcents = (part: number) => `${formatNumber(Math.round(part * 100))} %`

/** Les membres qu'un segment montre d'abord ; « Et N de plus » montre le reste, jusqu'à cinquante. */
const MEMBRES_D_ABORD = 10

/** Le segment qu'on regarde à l'ouverture : celui qu'on peut encore rappeler, s'il a du monde. */
const SEGMENTS_D_ABORD: readonly SegmentDuQg[] = ['a-risque', 'endormis', 'nouveaux', 'occasionnels', 'reguliers', 'perdus']

/**
 * Les joueurs au QG (`/admin#joueurs`, en tête d'« Audience » — le lot 6 du
 * QG 2, le 4 novembre 2026) : combien jouent, combien reviennent, et qui
 * décroche. Les profils seulement : un invité sans profil se compte, il ne se
 * suit pas d'un soir à l'autre et ne se nomme nulle part. La page se lit à son
 * ouverture ; sa mémoire, au serveur, s'écrit une fois par jour fini
 * (`server/src/joueursDuQg.ts`).
 */
export function QgJoueurs({ versLesAnnonces }: { versLesAnnonces: (segment: SegmentDuQg) => void }) {
  const [page, setPage] = useState<PageDesJoueurs | null>(null)
  const [error, setError] = useState('')
  const [relire, setRelire] = useState(0)
  useEffect(() => {
    api.admin.joueurs().then(
      p => {
        setPage(p)
        setError('')
      },
      e => setError(motifDe(e)),
    )
  }, [relire])

  if (error) return <p className="error">{error}</p>
  if (!page) return <p className="serif-note">Chargement…</p>
  return <JoueursAuQg page={page} versLesAnnonces={versLesAnnonces} apresUnGeste={() => setRelire(n => n + 1)} />
}

/** La page lue : les chiffres, puis les joueurs actifs jour par jour, les segments, les cohortes, le rythme, le mélange, les arrivées. */
export function JoueursAuQg({ page, versLesAnnonces, apresUnGeste }: { page: PageDesJoueurs; versLesAnnonces: (segment: SegmentDuQg) => void; apresUnGeste?: () => void }) {
  const [segment, setSegment] = useState<SegmentDuQg>(() => SEGMENTS_D_ABORD.find(s => (page.segments.find(x => x.segment === s)?.profils ?? 0) > 0) ?? 'a-risque')
  const choisi = page.segments.find(s => s.segment === segment)
  return (
    <div className="qg-joueurs-page">
      <p className="muted small qg-joueurs-chapo">
        {espacesFines(
          `Combien jouent, combien reviennent, et qui décroche. Des profils seulement : un invité sans profil ne se suit pas d’un soir à l’autre — il se compte, il ne se nomme pas.${
            page.depuis ? ` La mémoire remonte au ${jourEnToutesLettres(page.depuis, true)}.` : ''
          }`,
        )}
      </p>
      <LesChiffres page={page} />
      <LesActifs page={page} />
      <LesSegments page={page} choisi={segment} choisir={setSegment} />
      {choisi && <LeSegment s={choisi} maintenant={page.maintenant} versLesAnnonces={versLesAnnonces} apresUnGeste={apresUnGeste} />}
      {/* Entre les segments et les cohortes (la revue d'analyse du 4 novembre 2026, P1.2) : la première semaine d'un profil, et la soirée qui en fait naître. */}
      {page.premiersPas && <LesPremiersPas premiersPas={page.premiersPas} />}
      <LesCohortes page={page} />
      <QuandOnJoue page={page} />
      <QuiJoueAQuoi page={page} />
      <DOuIlsViennent page={page} />
    </div>
  )
}

// ── Les chiffres ────────────────────────────────────────────────────────────

/** L'écart de la fidélité, en points : « 3 points » de plus qu'il y a un mois — un pourcentage d'un pourcentage ne se lit pas. */
function ecartEnPoints(valeur: number | null, avant: number | null): EcartALHabitude | null {
  if (valeur === null || avant === null) return null
  if (valeur === avant) return { sens: null, texte: 'comme il y a un mois', suite: '' }
  const ecart = Math.abs(valeur - avant)
  return {
    sens: valeur > avant ? 'plus' : 'moins',
    texte: pluriel(ecart, 'point'),
    suite: valeur > avant ? ' de plus qu’il y a un mois' : ' de moins qu’il y a un mois',
  }
}

function LesChiffres({ page }: { page: PageDesJoueurs }) {
  const a = page.actifs
  const derniers = page.parJour.slice(-30)
  return (
    <section className="qg-joueurs-chiffres" aria-labelledby="joueurs-chiffres">
      <h2 className="sr-only" id="joueurs-chiffres">
        Les chiffres
      </h2>
      <ul className="qg-tuiles qg-joueurs-tuiles">
        {/* Des profils, pas des personnes : le poste de commande, lui, compte aussi chaque invité sans profil — ses « Personnes ». */}
        <TuileDuQg
          nom="Profils actifs du jour"
          valeur={a.jour.valeur}
          ecart={ecartALHabitude({ aujourdhui: a.jour.valeur, habituel: a.jour.avant, parJour: [] })}
          etincelle={derniers.map(j => j.profils)}
        />
        <TuileDuQg
          nom="De la semaine"
          valeur={a.semaine.valeur}
          ecart={ecartALaPeriodeDAvant(a.semaine.valeur, a.semaine.avant)}
          detail="ces sept jours"
          etincelle={derniers.map(j => j.semaine)}
        />
        <TuileDuQg nom="Du mois" valeur={a.mois.valeur} ecart={ecartALaPeriodeDAvant(a.mois.valeur, a.mois.avant)} detail="ces trente jours" etincelle={derniers.map(j => j.mois)} />
        <TuileDuQg nom="Fidélité" valeur={a.fidelite.valeur} unite=" %" ecart={ecartEnPoints(a.fidelite.valeur, a.fidelite.avant)} detail="un jour moyen, sur ceux du mois" />
        <TuileDuQg nom="Nouveaux profils" valeur={page.nouveaux.valeur} ecart={ecartALaPeriodeDAvant(page.nouveaux.valeur, page.nouveaux.avant)} detail="ces trente jours" />
        {/* Des passages, pas des gens : un invité sans profil compte une fois par soirée, et ne se suit pas d'un soir à l'autre. */}
        <TuileDuQg
          nom="Passages d’invités"
          valeur={page.invites.valeur}
          ecart={ecartALaPeriodeDAvant(page.invites.valeur, page.invites.avant)}
          detail="sans profil, une fois par soirée · ces trente jours"
        />
      </ul>
    </section>
  )
}

// ── Les joueurs actifs, jour par jour ───────────────────────────────────────

/** Les jours sous l'axe : autant qu'il en tient, comptés depuis aujourd'hui. */
function axeDesJours(jours: readonly string[], i: number, largeur: number): string | null {
  const n = jours.length
  const saut = Math.ceil(n / Math.max(2, Math.floor((largeur - 40) / 72)))
  if ((n - 1 - i) % saut !== 0) return null
  return i === n - 1 ? 'aujourd’hui' : jourAbrege(jours[i])
}

function LesActifs({ page }: { page: PageDesJoueurs }) {
  const jours = page.parJour.map(j => j.jour)
  // Ce qui s'est passé jour par jour (la revue du 4 novembre 2026, P2.2) : chaque jour de Paris, de son minuit au suivant.
  const reperes = reperesDeLaCourbe(useReperesDuQg(), jours.map(j => [minuitDuJour(j), minuitDuJour(jourAvant(j, -1))] as const))
  return (
    <section className="qg-console qg-joueurs-actifs" aria-labelledby="joueurs-actifs">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Actifs</span>
          <h2 id="joueurs-actifs">Profils actifs du jour, de la semaine, du mois</h2>
          <span className="muted small">
            {`Jour par jour, ${pluriel(jours.length, 'jour')} : les barres disent les profils du jour, les traits ceux des sept et des trente jours qui finissent ce jour-là.`}
          </span>
        </div>
      </div>
      <GrapheDuTemps
        etiquettes={page.parJour.map((j, i) => (i === page.parJour.length - 1 ? `${jourEnToutesLettres(j.jour)}, entamé` : jourEnToutesLettres(j.jour)))}
        axe={(i, largeur) => axeDesJours(jours, i, largeur)}
        series={[{ cle: 'jour', nom: 'du jour', valeurs: page.parJour.map(j => j.profils), classe: 'qg-joueurs' }]}
        lignes={[
          { cle: 'semaine', nom: 'de la semaine', valeurs: page.parJour.map(j => j.semaine), classe: 'qg-joueurs-semaine' },
          { cle: 'mois', nom: 'du mois', valeurs: page.parJour.map(j => j.mois), classe: 'qg-joueurs-mois' },
        ]}
        empile={false}
        reperes={reperes}
        nomDuTotal="profil"
        resume={`Les profils actifs, jour par jour sur ${pluriel(jours.length, 'jour')} : ${pluriel(page.actifs.jour.valeur, 'profil')} aujourd’hui, ${formatNumber(page.actifs.semaine.valeur)} ces sept jours, ${formatNumber(page.actifs.mois.valeur)} ces trente jours.`}
      />
      <div className="qg-legende">
        <ul>
          <li>
            <i className="qg-pastille-mode qg-joueurs" aria-hidden="true" />
            du jour
          </li>
          <li>
            <i className="qg-joueurs-cle qg-joueurs-semaine" aria-hidden="true" />
            de la semaine
          </li>
          <li>
            <i className="qg-joueurs-cle qg-joueurs-mois" aria-hidden="true" />
            du mois
          </li>
        </ul>
        <span className="muted small">Un profil compte une fois par fenêtre, à quoi qu’il joue. La fidélité : un jour moyen de la semaine finie, sur les joueurs du mois.</span>
      </div>
    </section>
  )
}

// ── Les segments ────────────────────────────────────────────────────────────

function LesSegments({ page, choisi, choisir }: { page: PageDesJoueurs; choisi: SegmentDuQg; choisir: (s: SegmentDuQg) => void }) {
  const total = page.segments.reduce((t, s) => t + s.profils, 0)
  const plus = Math.max(1, ...page.segments.map(s => s.profils))
  return (
    <section className="qg-console qg-joueurs-segments" aria-labelledby="joueurs-segments">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Segments</span>
          <h2 id="joueurs-segments">Où en est chacun</h2>
          <span className="muted small">{`${pluriel(total, 'profil')}, sans les suspendus : chacun dans un seul segment, le premier dont il suit la règle.`}</span>
        </div>
      </div>
      <ul className="qg-joueurs-liste-segments">
        {page.segments.map(s => (
          <li key={s.segment}>
            <button type="button" className="qg-joueurs-segment" aria-pressed={choisi === s.segment} onClick={() => choisir(s.segment)}>
              <span className="qg-joueurs-segment-tete">
                <b>{NOM_DU_SEGMENT[s.segment]}</b>
                <span className="num">{formatNumber(s.profils)}</span>
              </span>
              <span className="muted small">{espacesFines(REGLE_DU_SEGMENT[s.segment])}</span>
              <span className="qg-piste" aria-hidden="true">
                <i className="qg-joueurs" style={{ width: `${(s.profils / plus) * 100}%` }} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Où en est un membre, d'une ligne : son inscription, ses jours de jeu, ses modes, ou depuis quand il ne joue plus. */
function ouEnEst(m: MembreMontre, segment: SegmentDuQg, maintenant: number): string {
  const aujourdhui = jourDe(maintenant)
  const modes = m.modes.map(x => NOM_DU_MODE[x].toLowerCase()).join(', ')
  const absent = m.dernier === null ? null : joursEntre(m.dernier, aujourdhui)
  switch (segment) {
    case 'nouveaux':
      return [`Inscription ${quandEcrit(m.cree, maintenant)}`, m.jours > 0 ? `${pluriel(m.jours, 'jour')} de jeu` : 'pas encore joué', modes].filter(Boolean).join(' · ')
    case 'reguliers':
    case 'occasionnels':
      return [`${pluriel(m.jours, 'jour')} de jeu ces trente jours`, modes].filter(Boolean).join(' · ')
    case 'a-risque':
    case 'endormis':
      return [absent === null ? null : `Dernière partie il y a ${pluriel(absent, 'jour')}`, modes].filter(Boolean).join(' · ')
    case 'perdus':
      return `Rien depuis trente jours · inscription ${quandEcrit(m.cree, maintenant)}`
  }
}

/**
 * Les profils d'un segment, les cinquante premiers dans l'ordre de sa règle —
 * une ligne ouvre sa fiche, comme dans « Les profils » — et « Leur écrire »,
 * qui ouvre les annonces sur ce segment.
 */
function LeSegment({ s, maintenant, versLesAnnonces, apresUnGeste }: { s: SegmentMontre; maintenant: number; versLesAnnonces: (segment: SegmentDuQg) => void; apresUnGeste?: () => void }) {
  const [tous, setTous] = useState(false)
  const [ouvert, setOuvert] = useState<{ id: string; nom: string } | null>(null)
  // Un autre segment choisi repart replié.
  useEffect(() => setTous(false), [s.segment])
  const montres = tous ? s.montres : s.montres.slice(0, MEMBRES_D_ABORD)
  const autres = s.profils - s.montres.length
  return (
    <section className="qg-console qg-joueurs-membres" aria-labelledby="joueurs-membres">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Le segment</span>
          <h2 id="joueurs-membres">{`${NOM_DU_SEGMENT[s.segment]} · ${pluriel(s.profils, 'profil')}`}</h2>
          <span className="muted small">{espacesFines(REGLE_DU_SEGMENT[s.segment])}</span>
        </div>
        <button type="button" className="salon-geste" aria-disabled={s.profils === 0 || undefined} onClick={() => s.profils > 0 && versLesAnnonces(s.segment)}>
          <Icon name="megaphone" />
          Leur écrire
        </button>
      </div>
      {s.profils === 0 ? (
        <p className="muted small">Personne dans ce segment aujourd’hui.</p>
      ) : (
        <>
          <ol className="qg-liste">
            {montres.map(m => (
              <li key={m.id}>
                <button type="button" className="qg-ligne" onClick={() => setOuvert({ id: m.id, nom: m.nom })}>
                  <span className="qg-ligne-texte">
                    <span>
                      <b>{espacesFines(m.nom)}</b> <span className="muted small">@{m.login}</span>
                    </span>
                    <span className="muted small">{espacesFines(ouEnEst(m, s.segment, maintenant))}</span>
                  </span>
                  <Icon name="chevron-right" className="qg-chevron" />
                </button>
              </li>
            ))}
          </ol>
          {!tous && s.montres.length > MEMBRES_D_ABORD && (
            <button type="button" className="lien-discret qg-suite" onClick={() => setTous(true)}>
              Et {formatNumber(s.montres.length - MEMBRES_D_ABORD)} de plus
              <Icon name="chevron-down" />
            </button>
          )}
          {(tous || s.montres.length <= MEMBRES_D_ABORD) && autres > 0 && (
            <p className="muted small">{`Les ${formatNumber(PROFILS_D_UN_SEGMENT)} premiers se nomment ici ; ${pluriel(autres, 'autre profil', 'autres profils')} se comptent avec eux, et l’annonce les touche aussi.`}</p>
          )}
        </>
      )}
      {ouvert && (
        <Feuille titre={ouvert.nom} onFermer={() => setOuvert(null)}>
          <FicheDuJoueurAuQg
            key={ouvert.id}
            profil={ouvert}
            onChange={f => {
              setOuvert({ id: f.id, nom: f.nom })
              apresUnGeste?.()
            }}
            onSupprimer={p => {
              void supprimerLeProfil(p).then(fait => {
                if (!fait) return
                setOuvert(null)
                apresUnGeste?.()
              })
            }}
          />
        </Feuille>
      )}
    </section>
  )
}

// ── Les premiers pas ────────────────────────────────────────────────────────

/** Les pas d'une première semaine, dans l'ordre où ils se font. */
const PAS: { cle: Exclude<keyof PasDesNes, 'nes'>; nom: string; titre: string }[] = [
  { cle: 'jourMeme', nom: 'Le jour même', titre: 'Ont joué le jour de leur naissance — sur ceux nés avant aujourd’hui' },
  { cle: 'lendemain', nom: 'Le lendemain', titre: 'Ont joué le lendemain de leur naissance — sur ceux dont le lendemain est fini' },
  { cle: 'deuxJours', nom: '2 jours ou plus', titre: 'Ont joué deux jours ou plus leur première semaine — sur ceux dont la semaine est finie' },
  { cle: 'secondMode', nom: '2 modes ou plus', titre: 'Ont joué à deux modes ou plus leur première semaine — sur ceux dont la semaine est finie' },
  { cle: 'jamais', nom: 'Jamais joué', titre: 'N’ont pas joué une seule fois depuis leur naissance — sur ceux nés avant aujourd’hui' },
]

/** Les soirées closes qu'on lit d'abord ; « Et N de plus » montre le reste. */
const SOIREES_D_ABORD = 8

/** Le nom d'un écran de naissance, dans les puces : « Tous les écrans », « Pendant une soirée », « D'avant le 4 novembre 2026 ». */
const nomDeLEcran = (o: OrigineLue | null | 'tous') => (o === 'tous' ? 'Tous les écrans' : o === null ? PROFILS_D_AVANT_L_ORIGINE : NOM_DE_L_ORIGINE[o])

/**
 * Les premiers pas des profils nés ces neuf semaines — le jour même, le
 * lendemain, leur première semaine —, par écran de naissance ; le pont des nés
 * en soirée vers le jeu seul ; puis ce que chaque soirée close de ces trente
 * jours a fait naître. Sous vingt, « 4 sur 9 ».
 */
function LesPremiersPas({ premiersPas: pp }: { premiersPas: PremiersPas }) {
  const [ecran, setEcran] = useState<OrigineLue | null | 'tous'>('tous')
  const [toutes, setToutes] = useState(false)
  const choisi = pp.ecrans.find(e => e.origine === ecran) ?? pp.ecrans[0]
  // Les semaines où personne n'est né ne disent rien : la plus récente reste, même vide.
  const lignes = pp.semaines.map((semaine, i) => ({ semaine, pas: choisi?.parSemaine[i] })).filter((l, i) => i === 0 || (l.pas?.nes ?? 0) > 0)
  const soirees = toutes ? pp.soirees : pp.soirees.slice(0, SOIREES_D_ABORD)
  const semaineDe = (lundi: string, i: number) => (i === 0 && lundi === pp.semaines[0] ? 'Cette semaine' : `Sem. du ${jourAbrege(lundi)}`)
  return (
    <section className="qg-console qg-joueurs-premiers-pas" aria-labelledby="joueurs-premiers-pas">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Premiers pas</span>
          <h2 id="joueurs-premiers-pas">La première semaine d’un profil</h2>
          <span className="muted small">
            {espacesFines(
              'Chaque semaine de naissance, du lundi au dimanche, et ce que ses profils ont fait. Chaque part ne compte que ceux dont le délai est passé : un profil né ce matin n’a encore rien manqué.',
            )}
          </span>
        </div>
      </div>
      {pp.ecrans.length > 1 && (
        <div className="onglets onglets-puces" role="group" aria-label="L’écran où ils sont nés">
          {pp.ecrans.map(e => (
            <button key={e.origine ?? 'avant'} type="button" className={'onglet' + (e.origine === ecran ? ' actif' : '')} aria-pressed={e.origine === ecran} onClick={() => setEcran(e.origine)}>
              {espacesFines(nomDeLEcran(e.origine))} <span className="rayon-compte">{formatNumber(e.total.nes)}</span>
            </button>
          ))}
        </div>
      )}
      {!choisi || choisi.total.nes === 0 ? (
        <p className="muted small">Aucun profil né ces neuf semaines.</p>
      ) : (
        <>
          <div className="qg-table-cadre qg-cote-table">
            <table className="qg-table">
              <caption className="sr-only">{`Les premiers pas des profils nés ces neuf semaines — ${nomDeLEcran(choisi.origine).toLowerCase()}`}</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="qg-tri">Semaine</span>
                  </th>
                  <th scope="col" className="qg-nombre">
                    <span className="qg-tri">Nés</span>
                  </th>
                  {PAS.map(p => (
                    <th key={p.cle} scope="col" className="qg-nombre">
                      <span className="qg-tri" title={p.titre}>
                        {p.nom}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map((l, i) => (
                  <tr key={l.semaine}>
                    <th scope="row">{semaineDe(l.semaine, i)}</th>
                    <td className="qg-nombre">{formatNumber(l.pas?.nes ?? 0)}</td>
                    {PAS.map(p => (
                      <td key={p.cle} className="qg-nombre">
                        {l.pas ? partEcrite(l.pas[p.cle].n, l.pas[p.cle].sur) : '–'}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="qg-joueurs-total">
                  <th scope="row">Neuf semaines</th>
                  <td className="qg-nombre">{formatNumber(choisi.total.nes)}</td>
                  {PAS.map(p => (
                    <td key={p.cle} className="qg-nombre">
                      {partEcrite(choisi.total[p.cle].n, choisi.total[p.cle].sur)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {/* Au téléphone, une carte par semaine : sept colonnes ne tiennent pas sans défiler de côté. */}
          <ul className="qg-liste qg-cote-cartes">
            {[...lignes.map((l, i) => ({ nom: semaineDe(l.semaine, i), pas: l.pas })), { nom: 'Neuf semaines', pas: choisi.total }].map(l => (
              <li key={l.nom} className="qg-cote-carte">
                <b>{`${l.nom} · ${pluriel(l.pas?.nes ?? 0, 'né', 'nés')}`}</b>
                <dl className="qg-cote-chiffres">
                  {PAS.map(p => (
                    <div key={p.cle}>
                      <dt>{p.nom}</dt>
                      <dd className="num">{l.pas ? partEcrite(l.pas[p.cle].n, l.pas[p.cle].sur) : '–'}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="small qg-joueurs-pont">
        {espacesFines(
          pp.pont.sur === 0
            ? 'Le pont : aucun profil né en soirée n’a encore fini sa première semaine.'
            : `Le pont : ${partEcrite(pp.pont.n, pp.pont.sur)} des profils nés en soirée — à son entrée, pendant elle, à sa fin — ont joué seuls leur première semaine : le quiz du jour, la campagne, le Cabinet ou un duel.`,
        )}
      </p>
      <h3 className="label">Soirée par soirée</h3>
      {soirees.length === 0 ? (
        <p className="muted small">Aucune soirée close ces trente jours.</p>
      ) : (
        <>
          <ul className="qg-liste">
            {soirees.map(s => (
              <li key={s.quand} className="qg-ligne">
                <span className="qg-ligne-texte">
                  <span>{`${jourEnToutesLettres(jourDe(s.quand), true)} · ${pluriel(s.invites, 'invité')}`}</span>
                  <span className="muted small">
                    {espacesFines(
                      // Les deux chiffres en clair : « 2 sur 10 venus sans profil » se lisait de travers, « 20 % venus sans profil » aussi.
                      `${pluriel(s.avecUnProfil, 'venu', 'venus')} avec un profil · ${
                        s.sansProfil === 0
                          ? 'personne sans profil'
                          : `${pluriel(s.sansProfil, 'venu', 'venus')} sans, dont ${s.nes === 0 ? 'aucun n’a' : `${formatNumber(s.nes)} ${s.nes > 1 ? 'ont' : 'a'}`} créé le sien`
                      }`,
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {!toutes && pp.soirees.length > SOIREES_D_ABORD && (
            <button type="button" className="lien-discret qg-suite" onClick={() => setToutes(true)}>
              Et {formatNumber(pp.soirees.length - SOIREES_D_ABORD)} de plus
              <Icon name="chevron-down" />
            </button>
          )}
        </>
      )}
      <p className="muted small">
        {espacesFines(
          'Un profil né à l’entrée d’une soirée ou pendant elle se compte à la soirée qui le compte parmi ses joueurs ; né à sa fin, il passe par l’accueil, et la page ne devine pas sa soirée. Les invités sans profil se comptent soirée par soirée : ils ne se suivent pas d’un soir à l’autre.',
        )}
      </p>
    </section>
  )
}

// ── Les cohortes ────────────────────────────────────────────────────────────

const semaines = (k: number) => (k > 1 ? `${k} semaines après` : '1 semaine après')

function LesCohortes({ page }: { page: PageDesJoueurs }) {
  const cases: CaseDeChaleur[][] = page.cohortes.map(c =>
    c.revenus.map((n, k) => {
      const debut = `Inscrits la semaine du ${jourEnToutesLettres(c.semaine, true)}, ${semaines(k + 1)}`
      if (n === null) return { part: null, dit: `${debut} : pas encore — la semaine n’est pas finie` }
      const part = c.taille > 0 ? n / c.taille : 0
      return { part, texte: formatNumber(Math.round(part * 100)), dit: `${debut} : ${pourcents(part)} — ${formatNumber(n)} sur ${pluriel(c.taille, 'profil')}` }
    }),
  )
  return (
    <section className="qg-console qg-joueurs-cohortes" aria-labelledby="joueurs-cohortes">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Rétention</span>
          <h2 id="joueurs-cohortes">Qui revient, semaine après semaine</h2>
          <span className="muted small">
            Chaque ligne : les profils inscrits une semaine, du lundi au dimanche ; chaque case : la part d’entre eux, en pour cent, qui a joué une, deux… huit
            semaines plus tard.
          </span>
        </div>
      </div>
      {page.cohortes.length === 0 ? (
        <p className="muted small">Pas encore de semaine à suivre : une semaine d’inscription se lit une fois la suivante finie.</p>
      ) : (
        <CarteDeChaleur
          resume={`Les cohortes : ${pluriel(page.cohortes.length, 'semaine')} d’inscription, et la part revenue chacune des huit semaines suivantes`}
          // Au téléphone, huit colonnes de plus : l'en-tête d'une ligne tient en « 31 août » et son compte ; l'oreille entend la semaine.
          lignes={page.cohortes.map(c => ({ nom: `Semaine du ${jourEnToutesLettres(c.semaine, true)}`, court: jourAbrege(c.semaine), detail: pluriel(c.taille, 'profil') }))}
          colonnes={Array.from({ length: SEMAINES_DE_RETOUR }, (_, k) => ({ court: `+${k + 1}`, nom: semaines(k + 1) }))}
          cases={cases}
          legende={['peu reviennent', 'tous reviennent']}
        />
      )}
    </section>
  )
}

// ── Quand on joue ───────────────────────────────────────────────────────────

const JOURS = [
  { nom: 'lundi', court: 'lun.' },
  { nom: 'mardi', court: 'mar.' },
  { nom: 'mercredi', court: 'mer.' },
  { nom: 'jeudi', court: 'jeu.' },
  { nom: 'vendredi', court: 'ven.' },
  { nom: 'samedi', court: 'sam.' },
  { nom: 'dimanche', court: 'dim.' },
] as const

function QuandOnJoue({ page }: { page: PageDesJoueurs }) {
  const { grille, jours } = page.heures
  const total = grille.flat().reduce((t, n) => t + n, 0)
  const haut = Math.max(0, ...grille.flat())
  // Le pic : la première heure qui atteint le plus haut, du lundi matin au dimanche soir.
  const j = haut > 0 ? grille.findIndex(r => r.includes(haut)) : -1
  const lePic = j >= 0 ? { j, h: grille[j].indexOf(haut) } : null
  const cases: CaseDeChaleur[][] = grille.map((r, j) =>
    r.map((n, h) => ({
      part: haut > 0 ? n / haut : 0,
      dit: `${JOURS[j].nom}, ${h} h → ${h + 1} h : ${total > 0 ? pourcents(n / total) : '0 %'} des participations (${formatNumber(n)})`,
    })),
  )
  return (
    <section className="qg-console qg-joueurs-heures" aria-labelledby="joueurs-heures">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Rythme</span>
          <h2 id="joueurs-heures">Quand on joue</h2>
          <span className="muted small">
            {espacesFines(
              `Les participations des quatre dernières semaines finies — ${pluriel(jours, 'jour')} gardés —, jour de la semaine par heure de Paris ; les invités des soirées compris.`,
            )}
          </span>
        </div>
      </div>
      {total === 0 ? (
        <p className="muted small">Personne n’a joué ces quatre semaines.</p>
      ) : (
        <>
          <CarteDeChaleur
            resume="Quand on joue : les participations, jour de la semaine par heure de Paris"
            lignes={JOURS.map(j => ({ nom: j.nom, court: j.court }))}
            colonnes={Array.from({ length: 24 }, (_, h) => ({ court: h % 3 === 0 ? `${h} h` : '', nom: `${h} h` }))}
            cases={cases}
            legende={['calme', 'le pic']}
            compacte
          />
          {lePic && (
            <p className="small">{espacesFines(`Le pic : le ${JOURS[lePic.j].nom}, de ${lePic.h} h à ${lePic.h + 1} h — ${pourcents(haut / total)} des participations.`)}</p>
          )}
        </>
      )}
    </section>
  )
}

// ── Qui joue à quoi, d'où viennent les profils ───────────────────────────────

/** Les cinq modes en points : allumés ceux de la combinaison, éteints les autres. */
function PointsDesModes({ modes }: { modes: readonly ModeDuQg[] }) {
  return (
    <span className="qg-joueurs-points" aria-hidden="true">
      {MODES_DU_QG.map(m => (
        <i key={m} className={modes.includes(m) ? `qg-pastille-mode qg-mode-${m}` : 'qg-pastille-mode qg-joueurs-eteint'} />
      ))}
    </span>
  )
}

function QuiJoueAQuoi({ page }: { page: PageDesJoueurs }) {
  const plus = Math.max(1, ...page.combinaisons.map(c => c.profils))
  return (
    <section className="qg-console qg-joueurs-combinaisons" aria-labelledby="joueurs-combinaisons">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Mélange</span>
          <h2 id="joueurs-combinaisons">Qui joue à quoi</h2>
          <span className="muted small">{`${pluriel(page.profilsActifs, 'profil actif', 'profils actifs')} ces trente jours, rangés par les modes qu’ils ont joués.`}</span>
        </div>
      </div>
      {page.combinaisons.length === 0 ? (
        <p className="muted small">Aucun profil n’a joué ces trente jours.</p>
      ) : (
        <ul className="qg-joueurs-barres">
          {page.combinaisons.map(c => (
            <li key={c.modes.join('+') || 'autres'}>
              <span className="qg-joueurs-barre-tete">
                {c.modes.length > 0 && <PointsDesModes modes={c.modes} />}
                <span className="qg-joueurs-barre-nom">{nomDeLaCombinaison(c.modes)}</span>
                <b className="num">{formatNumber(c.profils)}</b>
                <span className="muted small num">{pourcents(c.profils / Math.max(1, page.profilsActifs))}</span>
              </span>
              <span className="qg-piste" aria-hidden="true">
                <i className="qg-joueurs" style={{ width: `${(c.profils / plus) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DOuIlsViennent({ page }: { page: PageDesJoueurs }) {
  const total = page.origines.reduce((t, o) => t + o.profils, 0)
  const plus = Math.max(1, ...page.origines.map(o => o.profils))
  return (
    <section className="qg-console qg-joueurs-origines" aria-labelledby="joueurs-origines">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Arrivées</span>
          <h2 id="joueurs-origines">D’où viennent les profils</h2>
          <span className="muted small">{`${pluriel(total, 'profil')} né${total > 1 ? 's' : ''} ces trente jours, par l’écran où ${total > 1 ? 'ils sont nés' : 'il est né'}.`}</span>
        </div>
      </div>
      {total === 0 ? (
        <p className="muted small">Aucun profil n’est né ces trente jours.</p>
      ) : (
        <ul className="qg-joueurs-barres">
          {page.origines.map(o => (
            <li key={o.origine ?? 'avant'} className={o.origine === null ? 'qg-joueurs-d-avant' : undefined}>
              <span className="qg-joueurs-barre-tete">
                <span className="qg-joueurs-barre-nom">{espacesFines(o.origine === null ? PROFILS_D_AVANT_L_ORIGINE : NOM_DE_L_ORIGINE[o.origine])}</span>
                <b className="num">{formatNumber(o.profils)}</b>
                <span className="muted small num">{pourcents(o.profils / total)}</span>
              </span>
              <span className="qg-piste" aria-hidden="true">
                <i className="qg-joueurs" style={{ width: `${(o.profils / plus) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">
        {espacesFines(
          'Depuis le 4 novembre 2026, chaque profil dit l’écran où il naît. Ceux d’avant ne le disent pas, et la page ne le devine pas : ils se comptent à part.',
        )}
      </p>
    </section>
  )
}
