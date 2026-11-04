import { Fragment, useState } from 'react'
import { Icon } from './Icon'
import { Avatar, AvatarEnLigne } from './Avatar'
import { Chiffre, GrapheDesJours, enPourcentsEcrits } from './QgModes'
import { espacesFines, formatNumber } from '../../../shared/typographie'
import { jourAvant, jourEnToutesLettres, moisEnToutesLettres, type LigneDuJour } from '../../../shared/jour'
import type { VueDEnsemble } from '../../../shared/qg'
import { TRANCHES_DE_SERIE, enPourcents, type QuestionDuSuivi, type SuiviDuJour } from '../../../shared/qgDuJour'

/**
 * Ce que le QG suit du quiz du jour, à côté de la réserve et des signalements
 * (`AdminDuJour.tsx`) : les chiffres d'aujourd'hui, le tirage question par
 * question — et l'annuler sans attendre un signalement —, les joueurs des
 * trente derniers jours, le classement du mois — et y masquer un profil —,
 * les séries qui tiennent, le rappel du soir (le choix du 13 octobre 2026,
 * sur maquettes).
 */

const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${formatNumber(n)} ${n > 1 ? motPluriel : mot}`
const secondes = (ms: number) => `${formatNumber(Math.round(ms / 100) / 10)} s`

/** La part de bonnes réponses d'une question : sa bonne réponse, sur ce qui a été posé. */
function partDe(q: QuestionDuSuivi): { justes: number; sur: number } {
  return { justes: q.parReponse[q.bonne] ?? 0, sur: q.parReponse.reduce((n, x) => n + x, 0) + q.sansReponse }
}

/** Les quatre chiffres d'aujourd'hui : les parties, les bonnes réponses, les séries, le rappel. */
export function AujourdhuiDuJour({ suivi, vue }: { suivi: SuiviDuJour | null; vue: VueDEnsemble | null }) {
  const compte = vue?.aujourdhui.partiesDuJour
  const bonnes = suivi && enPourcents(suivi.bonnes.aujourdhui)
  const hier = suivi?.bonnes.hier ? enPourcents(suivi.bonnes.hier) : null
  const plusLongue = suivi?.series.plusLongues[0]
  const derniere = suivi?.rappel.tournees[0]
  return (
    <section className="qg-jour" aria-labelledby="jour-aujourdhui">
      <div className="qg-section-tete">
        <h2 className="compte-groupe" id="jour-aujourdhui">
          Aujourd’hui
        </h2>
        <span className="muted small">{suivi ? `${jourEnToutesLettres(suivi.jour)} · dix questions tirées à minuit, les mêmes pour tous` : 'Chargement…'}</span>
      </div>
      <ul className="qg-tuiles qg-tuiles-quatre">
        <Chiffre
          nom="Parties"
          valeur={suivi ? formatNumber(suivi.parties.commencees) : '–'}
          // L'écart se lit sur le compte d'à l'instant, pas sur celui de la vue, relue toutes les cinq minutes.
          compte={compte && suivi ? { ...compte, aujourdhui: suivi.parties.commencees } : null}
          detail={suivi ? pluriel(suivi.parties.finies, 'finie') : undefined}
        />
        <Chiffre
          nom="Bonnes réponses"
          valeur={enPourcentsEcrits(bonnes ?? null)}
          detail={
            suivi
              ? `${formatNumber(suivi.bonnes.aujourdhui.justes)} sur ${pluriel(suivi.bonnes.aujourdhui.sur, 'question posée', 'questions posées')}${hier !== null ? ` · hier ${enPourcentsEcrits(hier)}` : ''}`
              : undefined
          }
        />
        <Chiffre
          nom="Séries en cours"
          valeur={suivi ? formatNumber(suivi.series.total) : '–'}
          detail={plusLongue ? `la plus longue : ${pluriel(plusLongue.serie, 'jour')}` : undefined}
        />
        <Chiffre
          nom="Abonnés au rappel"
          valeur={suivi ? formatNumber(suivi.rappel.telephones) : '–'}
          detail={
            suivi
              ? derniere
                ? `${derniere.jour === suivi.jour ? 'ce soir' : derniere.jour === jourAvant(suivi.jour) ? 'hier' : jourEnToutesLettres(derniere.jour, true)} : ${pluriel(derniere.envoyes, 'envoyé')}${derniere.ouverts > 0 ? `, ${pluriel(derniere.ouverts, 'ouvert')}` : ''}${derniere.echecs > 0 ? `, ${pluriel(derniere.echecs, 'échec')}` : ''}`
                : 'aucune tournée encore'
              : undefined
          }
        />
      </ul>
    </section>
  )
}

/**
 * Le tirage d'aujourd'hui, question par question : la part de bonnes
 * réponses de chacune, ses signalements ; touchée, ce que chaque réponse a
 * recueilli — une question piège se voit à la mauvaise réponse qui
 * l'emporte —, et de quoi l'annuler pour tous sans attendre qu'on la signale,
 * ou la retirer de la réserve.
 */
export function QuestionsDuJour({
  suivi,
  enPanne,
  occupe,
  annuler,
  retirer,
}: {
  suivi: SuiviDuJour | null
  enPanne: boolean
  occupe: boolean
  annuler: (q: QuestionDuSuivi) => void
  retirer: (q: QuestionDuSuivi) => void
}) {
  const [ouverte, setOuverte] = useState<number | null>(null)
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="jour-questions">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="jour-questions">Question par question</h2>
        <span className="muted small">la part de bonnes réponses du tirage d’aujourd’hui</span>
      </div>
      {!suivi ? (
        <p className="serif-note">{enPanne ? 'La base permanente ne répond pas : rouvre la page dans un instant.' : 'Chargement…'}</p>
      ) : suivi.questions.length === 0 ? (
        <p className="muted small">Personne n’a encore joué aujourd’hui : le tirage se fait à la première partie.</p>
      ) : (
        <ol className="qg-questions">
          {suivi.questions.map(q => {
            const part = partDe(q)
            const pct = enPourcents(part)
            const ouvert = ouverte === q.index
            const id = `jour-question-${q.index}`
            return (
              <li key={q.index} className={q.annulee ? 'qg-question-annulee' : undefined}>
                <button type="button" className="qg-question" aria-expanded={ouvert} aria-controls={id} onClick={() => setOuverte(ouvert ? null : q.index)}>
                  <span className="qg-question-n num">{q.index + 1}</span>
                  <span className="qg-question-texte">{q.texte}</span>
                  <span className="qg-piste" aria-hidden="true">
                    {pct !== null && pct > 0 && <i className="qg-mode-jour" style={{ width: `${pct}%` }} />}
                  </span>
                  <span className="qg-question-part num">
                    {enPourcentsEcrits(pct)}
                    <span className="sr-only"> de bonnes réponses, sur {pluriel(part.sur, 'question posée', 'questions posées')}</span>
                  </span>
                  <span className="qg-question-marques">
                    {q.annulee && <span className="etiquette">annulée</span>}
                    {q.signalements > 0 && (
                      <span className="qg-drapeau">
                        <Icon name="flag" />
                        {pluriel(q.signalements, 'signalement')}
                      </span>
                    )}
                  </span>
                </button>
                {ouvert && (
                  <div className="qg-question-detail" id={id}>
                    <p className="muted small">
                      {pluriel(part.sur - q.sansReponse, 'réponse')}
                      {q.sansReponse > 0 && `, ${formatNumber(q.sansReponse)} laissée${q.sansReponse > 1 ? 's' : ''} au temps`}
                      {q.msMoyen !== null && ` · ${secondes(q.msMoyen)} en moyenne`}
                      {q.categorie && ` · ${q.categorie}`}
                    </p>
                    <ul className="qg-pistes">
                      {q.reponses.map((r, i) => {
                        const n = q.parReponse[i] ?? 0
                        const p = part.sur > 0 ? Math.round((n / part.sur) * 100) : 0
                        const bonne = i === q.bonne
                        return (
                          <li key={i} className="qg-piste-ligne">
                            <span className="qg-piste-nom">
                              {bonne && <Icon name="check" />}
                              {r}
                              {bonne && <span className="sr-only"> (la bonne réponse)</span>}
                            </span>
                            <span className="qg-piste" aria-hidden="true">
                              {p > 0 && <i className={bonne ? 'qg-mode-jour' : 'qg-piste-autre'} style={{ width: `${p}%` }} />}
                            </span>
                            <b className="num">
                              {formatNumber(p)} %<span className="sr-only">, {pluriel(n, 'joueur')}</span>
                            </b>
                          </li>
                        )
                      })}
                    </ul>
                    <div className="admin-gestes">
                      {!q.annulee && (
                        <button type="button" className="btn btn-small btn-danger" disabled={occupe} onClick={() => annuler(q)}>
                          Annuler ses points pour tous
                        </button>
                      )}
                      <button type="button" className="btn btn-small" disabled={occupe} onClick={() => retirer(q)}>
                        Retirer de la réserve
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

/** Les joueurs du quiz du jour, jour par jour : la participation que la vue d'ensemble a déjà lue. */
export function JoueursParJour({ vue }: { vue: VueDEnsemble | null }) {
  const jours = vue?.participations ?? []
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="jour-par-jour">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="jour-par-jour">Joueurs par jour</h2>
        <span className="muted small">les trente derniers jours · un joueur compte une fois par jour</span>
      </div>
      {!vue ? (
        <p className="serif-note">Chargement…</p>
      ) : (
        <GrapheDesJours
          jours={jours.map(p => p.jour)}
          valeurs={jours.map(p => p.modes.jour)}
          classe="qg-mode-jour"
          dire={n => pluriel(n, 'joueur')}
          titre="Les joueurs du quiz du jour, jour par jour"
        />
      )}
    </section>
  )
}

/** Le classement du mois, tel que les joueurs le voient, et « Masquer » au bout de chaque ligne. */
export function ClassementDuMoisAuQg({ suivi, occupe, masquer }: { suivi: SuiviDuJour | null; occupe: boolean; masquer: (l: LigneDuJour) => void }) {
  const mois = suivi?.mois
  return (
    <section className="qg-carte" aria-labelledby="jour-mois">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="jour-mois">Le classement du mois</h2>
        <span className="muted small">{mois ? `${moisEnToutesLettres(mois.mois)} · ${pluriel(mois.joueurs, 'joueur classé', 'joueurs classés')}` : 'Chargement…'}</span>
      </div>
      {mois && mois.lignes.length === 0 && <p className="muted small">Personne n’a encore joué ce mois-ci.</p>}
      {mois && mois.lignes.length > 0 && (
        <ol className="qg-liste qg-classement">
          {mois.lignes.map(l => (
            <li key={l.profileId} className="qg-rang">
              <span className="qg-rang-place num">{l.rang}</span>
              {/* Tel que les joueurs le voient : ce qu'il porte, pas l'emoji d'en dessous. */}
              <span className="qg-avatar" aria-hidden="true">
                <Avatar avatar={l.avatar} finition={l.finition} legendaire={l.legendaire} eclat={l.eclat} />
              </span>
              <span className="qg-ligne-texte">
                <b>{l.nom}</b>
              </span>
              <span className="qg-rang-points num">{pluriel(l.points, 'pt')}</span>
              <button type="button" className="salon-geste" disabled={occupe} onClick={() => masquer(l)}>
                <Icon name="eye-off" />
                Masquer
              </button>
            </li>
          ))}
        </ol>
      )}
      {mois && (
        <p className="muted small">
          Masqué, un profil joue toujours, mais il sort des classements, des podiums et des lauriers, et il n’en est pas averti.
          {mois.masques > 0 && (
            <>
              {' '}
              <a href="#masques">{pluriel(mois.masques, 'profil masqué', 'profils masqués')}</a>, à remettre plus bas.
            </>
          )}
        </p>
      )}
    </section>
  )
}

/** Les séries qui tiennent encore, par longueur, et les plus longues. */
export function SeriesDuJourAuQg({ suivi }: { suivi: SuiviDuJour | null }) {
  const s = suivi?.series
  const max = s ? Math.max(1, ...s.parTranche) : 1
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="jour-series">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="jour-series">Les séries en cours</h2>
        <span className="muted small">les joueurs dont la série tient encore, selon sa longueur</span>
      </div>
      {!s ? (
        <p className="serif-note">Chargement…</p>
      ) : s.total === 0 ? (
        <p className="muted small">Aucune série ne tient en ce moment.</p>
      ) : (
        <>
          <ul className="qg-pistes">
            {TRANCHES_DE_SERIE.map((t, i) => (
              <li key={t.nom} className="qg-piste-ligne">
                <span className="qg-piste-nom">{t.nom}</span>
                <span className="qg-piste" aria-hidden="true">
                  {s.parTranche[i] > 0 && <i className="qg-mode-jour" style={{ width: `${(s.parTranche[i] / max) * 100}%` }} />}
                </span>
                <b className="num">{formatNumber(s.parTranche[i])}</b>
              </li>
            ))}
          </ul>
          {s.plusLongues.length > 0 && (
            <p className="muted small">
              Les plus longues :{' '}
              {s.plusLongues.map((l, i) => (
                <Fragment key={l.profileId}>
                  {i > 0 && ' · '}
                  <AvatarEnLigne de={l} /> {`${l.nom}, ${pluriel(l.serie, 'jour')}`}
                </Fragment>
              ))}
              .
            </p>
          )}
        </>
      )}
      {s && (
        <p className="muted small">
          Ce mois-ci, {pluriel(s.sabliersDuMois, 'sablier acheté', 'sabliers achetés')} pour sauver une série.
        </p>
      )}
    </section>
  )
}

/** « 34 % » : la part des rappels envoyés qu'on a touchés, un soir. */
const partOuverte = (t: { envoyes: number; ouverts: number }) => `${formatNumber(Math.round((t.ouverts / t.envoyes) * 100))} %`

/**
 * Le rappel du soir : les téléphones abonnés, et ce que chaque tournée a fait — jusqu'aux rappels touchés, et aux
 * parties qu'ils ont fait jouer (la revue du 4 novembre 2026, P2.1).
 */
export function RappelDuSoirAuQg({ suivi }: { suivi: SuiviDuJour | null }) {
  const r = suivi?.rappel
  const derniere = r?.tournees[0]
  const veille = r && derniere ? r.tournees.find(t => t.jour === jourAvant(derniere.jour)) : undefined
  // « Joué après » ne se compte qu'un soir fini : ce soir attend demain, et la tuile dit le plus récent des soirs comptés.
  const compte = r?.tournees.find(t => t.joues != null)
  const compteLaVeille = r && compte ? r.tournees.find(t => t.jour === jourAvant(compte.jour) && t.joues != null) : undefined
  return (
    <section className="qg-carte" aria-labelledby="jour-rappel">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="jour-rappel">Le rappel du soir</h2>
        <span className="muted small">à 18 h, aux téléphones qui l’ont demandé et dont la partie n’est pas finie</span>
      </div>
      {!r ? (
        <p className="serif-note">Chargement…</p>
      ) : (
        <>
          <ul className="qg-tuiles qg-tuiles-cinq">
            <Chiffre nom="Téléphones abonnés" valeur={formatNumber(r.telephones)} detail={pluriel(r.profils, 'profil')} />
            <Chiffre
              nom="Dernier soir"
              valeur={derniere ? formatNumber(derniere.envoyes) : '–'}
              detail={derniere ? `envoyés · ${jourEnToutesLettres(derniere.jour)} · ${formatNumber(derniere.finis)} avaient déjà joué` : 'aucune tournée encore'}
            />
            <Chiffre
              nom="Ouverts"
              valeur={derniere ? formatNumber(derniere.ouverts) : '–'}
              detail={
                derniere && derniere.envoyes > 0
                  ? `${partOuverte(derniere)} des envoyés${veille && veille.envoyes > 0 ? ` · la veille ${partOuverte(veille)}` : ''}`
                  : 'touchés sur le téléphone'
              }
            />
            <Chiffre
              nom="Joué après"
              valeur={compte?.joues != null ? formatNumber(compte.joues) : '–'}
              detail={
                compte?.joues != null
                  ? `sur ${formatNumber(compte.envoyes)} envoyés · ${jourEnToutesLettres(compte.jour)}${compteLaVeille?.joues != null ? ` · la veille ${formatNumber(compteLaVeille.joues)}` : ''}`
                  : 'compté le soir fini, le lendemain'
              }
            />
            <Chiffre
              nom="Échecs"
              valeur={derniere ? formatNumber(derniere.echecs) : '–'}
              detail={veille ? `la veille : ${formatNumber(veille.echecs)}` : 'le service de push a refusé'}
            />
          </ul>
          {r.tournees.length > 0 ? (
            <div className="qg-tableau qg-rappel-soirs">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Soir</th>
                    {/* Au téléphone, ce qu'un soir a fait — ouverts, joué après — d'abord : le reste se lit à l'ordinateur,
                        la note le dit. Sept colonnes coupaient la table au bord de l'écran, sans un signe. */}
                    <th scope="col" className="qg-colonne-large">
                      Envoyés
                    </th>
                    <th scope="col">Ouverts</th>
                    <th scope="col">Joué après</th>
                    <th scope="col" className="qg-colonne-large">
                      Déjà joué
                    </th>
                    <th scope="col" className="qg-colonne-large">
                      Échecs
                    </th>
                    <th scope="col" className="qg-colonne-large">
                      Partis
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.tournees.map(t => (
                    <tr key={t.jour}>
                      <th scope="row">{jourEnToutesLettres(t.jour, true)}</th>
                      <td className="num qg-colonne-large">{formatNumber(t.envoyes)}</td>
                      <td className="num">{t.envoyes > 0 ? `${formatNumber(t.ouverts)} · ${partOuverte(t)}` : formatNumber(t.ouverts)}</td>
                      <td className="num">{t.joues == null ? '–' : formatNumber(t.joues)}</td>
                      <td className="num qg-colonne-large">{formatNumber(t.finis)}</td>
                      <td className="num qg-colonne-large">{formatNumber(t.echecs)}</td>
                      <td className="num qg-colonne-large">{formatNumber(t.retires)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted small">Aucune tournée gardée pour l’instant : la première s’écrira à 18 h.</p>
          )}
          <p className="muted small">
            {espacesFines(
              '« Ouverts » : les rappels touchés sur le téléphone, que la page du jour a ouverts, et leur part des envoyés — comptés depuis le 4 novembre 2026. « Joué après » : les téléphones prévenus dont le profil a commencé ou repris sa partie après la tournée, ce soir-là — compté une fois le soir fini, avant le rappel du lendemain, « – » tant qu’il ne l’est pas. « Partis » : des abonnements défaits — une session close, ou un téléphone que son service dit désabonné. Au téléphone, les envoyés, « Déjà joué », les échecs et « Partis » se lisent à l’ordinateur.',
            )}
          </p>
        </>
      )}
    </section>
  )
}
