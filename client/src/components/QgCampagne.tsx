import { useState } from 'react'
import { AvatarEnLigne } from './Avatar'
import { Chiffre, GrapheDesJours, enPourcentsEcrits } from './QgModes'
import { barreArrondie, useLargeur } from './QgVueDEnsemble'
import { espacesFines } from '../format'
import { formatNumber } from '../../../shared/typographie'
import { jourEnToutesLettres } from '../../../shared/jour'
import { dureeEcrite, graduations, quandEcrit, type VueDEnsemble } from '../../../shared/qg'
import { INTERVALLES_DE_REVISION } from '../../../shared/revision'
import { QUESTIONS_D_UN_PALIER_DE_SUJET, PALIERS_DES_SUJETS } from '../../../shared/sentiersDeSujets'
import { VIES_PAR_JOUR } from '../../../shared/sentiers'
import { NOM_DU_SOUS_MODE, SOUS_MODES_DE_CAMPAGNE, medianeDesScores, type SousModeDeCampagne, type SuiviDeLaCampagne } from '../../../shared/qgCampagne'

/**
 * Ce que le QG suit de la campagne, au-dessus des sentiers et de la base
 * (`AdminCampagne.tsx`) : les chiffres d'aujourd'hui, ce qu'on joue sous-mode
 * par sous-mode sur trente jours, le défi de la semaine, les parcours de
 * thème, les vies (le choix du 13 octobre 2026, sur maquettes). Ce qu'on joue
 * jour par jour vient de la vue d'ensemble : déjà lu, il ne se relit pas ici.
 */

const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${formatNumber(n)} ${n > 1 ? motPluriel : mot}`
/** « 8 » ou « 8,5 » : une médiane tombe entre deux scores. */
const demi = (x: number) => (Number.isInteger(x) ? formatNumber(x) : String(x).replace('.', ','))
/** « 1, 3 et 7 » : une liste, à la française. */
const enListe = (xs: readonly (string | number)[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} et ${xs.at(-1)}` : String(xs[0] ?? ''))

/** Ce que chaque sous-mode est, en quelques mots, sous son graphique. */
const CE_QU_IL_EST: Record<SousModeDeCampagne, string> = {
  serie: 'de marche en marche, trois vies',
  sentier: 'épreuves de seize questions, rejeux compris',
  sujet: `${PALIERS_DES_SUJETS.length} étapes de ${QUESTIONS_D_UN_PALIER_DE_SUJET} questions`,
  revision: `le carnet, à ${enListe(INTERVALLES_DE_REVISION)} jours`,
  defi: 'une tentative par semaine',
  cabinet: 'trois manches d’un mini-jeu',
}

/** Les quatre chiffres d'aujourd'hui : les joueurs, les parties, les paliers validés, le défi. */
export function AujourdhuiDeLaCampagne({ vue, suivi }: { vue: VueDEnsemble | null; suivi: SuiviDeLaCampagne | null }) {
  const c = vue?.campagne
  const parties = vue?.aujourdhui.seriesDeCampagne
  return (
    <section className="qg-jour" aria-labelledby="campagne-aujourdhui">
      <div className="qg-section-tete">
        <h2 className="compte-groupe" id="campagne-aujourdhui">
          Aujourd’hui
        </h2>
        <span className="muted small">comparé à la même heure des sept jours d’avant</span>
      </div>
      <ul className="qg-tuiles qg-tuiles-quatre">
        <Chiffre
          nom="Joueurs"
          valeur={c ? formatNumber(c.joueurs.aujourdhui) : '–'}
          compte={c?.joueurs}
          detail={c ? `${formatNumber(c.aujourdhui.sentier.joueurs)} sur les sentiers` : undefined}
        />
        <Chiffre
          nom="Parties"
          valeur={parties ? formatNumber(parties.aujourdhui) : '–'}
          compte={parties}
          detail={c ? `${pluriel(c.aujourdhui.serie.parties, 'série')} · ${pluriel(c.aujourdhui.sentier.parties, 'épreuve')}` : undefined}
        />
        <Chiffre
          nom="Paliers validés"
          valeur={suivi ? formatNumber(suivi.paliers.valides) : '–'}
          detail={suivi ? `${formatNumber(suivi.paliers.premierCoup)} du premier coup` : undefined}
        />
        <Chiffre
          nom="Défi"
          valeur={suivi ? formatNumber(suivi.defi.joueurs) : '–'}
          detail={suivi ? (suivi.defi.tire ? `${suivi.defi.joueurs > 1 ? 'joueurs' : 'joueur'} cette semaine` : 'pas encore ouvert cette semaine') : undefined}
        />
      </ul>
    </section>
  )
}

/** Ce qu'on joue : les parties commencées chaque jour, sur trente jours, un petit graphique par sous-mode. */
export function CeQuOnJoue({ vue }: { vue: VueDEnsemble | null }) {
  const jours = vue?.campagne.parJour ?? []
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="campagne-sous-modes">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="campagne-sous-modes">Ce qu’on joue</h2>
        <span className="muted small">les parties commencées chaque jour, sur trente jours, sous-mode par sous-mode</span>
      </div>
      {!vue ? (
        <p className="serif-note">Chargement…</p>
      ) : (
        <ul className="qg-multiples">
          {SOUS_MODES_DE_CAMPAGNE.map(m => {
            const valeurs = jours.map(j => j.modes[m])
            const total = valeurs.reduce((n, x) => n + x, 0)
            return (
              <li key={m} className="qg-multiple">
                <div className="qg-multiple-tete">
                  <b>{NOM_DU_SOUS_MODE[m]}</b>
                  <span className="num">{formatNumber(total)}</span>
                </div>
                <GrapheDesJours
                  jours={jours.map(j => j.jour)}
                  valeurs={valeurs}
                  classe="qg-mode-campagne"
                  dire={n => pluriel(n, 'partie')}
                  titre={`${NOM_DU_SOUS_MODE[m]}, les parties commencées`}
                  petit
                />
                <span className="muted small">{`${formatNumber(Math.round(total / Math.max(1, jours.length)))} par jour · ${CE_QU_IL_EST[m]}`}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

const MARGE = { gauche: 36, droite: 4, haut: 20, bas: 24 }

/**
 * Les tentatives finies du défi, par bonnes réponses : une barre par score,
 * dans l'écran nocturne. Le score survolé — touché au téléphone — se dit
 * dessous ; le plus fréquent sinon.
 */
export function GrapheDesScores({ scores }: { scores: readonly number[] }) {
  const [choisi, choisir] = useState<number | null>(null)
  const [boite, largeur] = useLargeur(640)
  const hauteur = Math.round(Math.min(200, Math.max(130, largeur * 0.24)))
  const n = scores.length
  const crans = graduations(Math.max(0, ...scores))
  const sommet = crans[crans.length - 1] || 1
  const utile = { l: Math.max(1, largeur - MARGE.gauche - MARGE.droite), h: hauteur - MARGE.haut - MARGE.bas }
  const pas = utile.l / Math.max(1, n)
  const barre = Math.min(28, Math.max(2, pas * 0.66))
  const y = (v: number) => MARGE.haut + utile.h - (v / sommet) * utile.h
  const xDe = (i: number) => MARGE.gauche + i * pas
  if (n === 0) return null
  const frequent = scores.indexOf(Math.max(...scores))
  const lu = choisi ?? frequent
  // Une étiquette tous les cinq — une marche de la série —, et le dernier score.
  const etiquettes = scores.map((_, i) => i).filter(i => i % 5 === 0 || i === n - 1)
  const dire = (k: number) => `${pluriel(k, 'bonne réponse', 'bonnes réponses')} · ${pluriel(scores[k] ?? 0, 'tentative')}`
  return (
    <div className="qg-jours">
      <div ref={boite} className="qg-graphe">
        <svg
          viewBox={`0 0 ${largeur} ${hauteur}`}
          role="img"
          aria-label={`Les tentatives finies, par bonnes réponses, de 0 à ${n - 1} : ${pluriel(Math.max(...scores), 'tentative')} au plus pour un même score, à ${pluriel(frequent, 'bonne réponse', 'bonnes réponses')}.`}
          onPointerLeave={() => choisir(null)}
        >
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
          <g className="qg-graphe-axe" textAnchor="middle">
            {etiquettes.map(i => (
              <text key={i} x={xDe(i) + pas / 2} y={hauteur - 6}>
                {i}
              </text>
            ))}
          </g>
          {scores.map((v, i) => {
            const h = (v / sommet) * utile.h
            return (
              <g key={i}>
                <title>{dire(i)}</title>
                {v > 0 && <path className="qg-mode-campagne" d={barreArrondie(xDe(i) + (pas - barre) / 2, y(0) - h, barre, h)} />}
                {/* La cible du survol et du toucher : toute la hauteur, toute la largeur du score. */}
                <rect className="qg-graphe-cible" x={xDe(i)} y={MARGE.haut} width={pas} height={utile.h} onPointerEnter={() => choisir(i)} onClick={() => choisir(i)} />
              </g>
            )
          })}
          <text className="qg-graphe-total" x={xDe(lu) + pas / 2} y={Math.max(12, y(scores[lu] ?? 0) - 6)} textAnchor="middle">
            {formatNumber(scores[lu] ?? 0)}
          </text>
        </svg>
      </div>
      <p className="qg-legende-jour">
        {choisi === null ? 'Le plus souvent : ' : ''}
        {dire(lu)}
      </p>
    </div>
  )
}

/** Le défi de la semaine : ses joueurs, son meilleur score, ses scores, les questions les plus ratées, la semaine d'avant. */
export function DefiDeLaSemaineAuQg({ suivi }: { suivi: SuiviDeLaCampagne | null }) {
  const d = suivi?.defi
  const maintenant = suivi?.maintenant ?? 0
  const mediane = d ? medianeDesScores(d.scores) : null
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="campagne-defi">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="campagne-defi">Le défi de la semaine</h2>
        <span className="muted small">
          {d ? `semaine du ${jourEnToutesLettres(d.semaine)} · se clôt dimanche à minuit, dans ${dureeEcrite(d.minutesRestantes * 60_000)}` : 'Chargement…'}
        </span>
      </div>
      {d && (
        <>
          <ul className="qg-tuiles qg-tuiles-quatre">
            <Chiffre nom="Joueurs" valeur={formatNumber(d.joueurs)} detail={pluriel(d.finies, 'tentative finie', 'tentatives finies')} />
            <Chiffre
              nom="Meilleur score"
              valeur={d.meilleur ? formatNumber(d.meilleur.justes) : '–'}
              detail={
                d.meilleur ? (
                  // Ce qu'il porte, comme au classement du défi : l'emoji seul le montrait autrement.
                  <>
                    <AvatarEnLigne de={d.meilleur} />{' '}
                    {`${d.meilleur.nom}${d.meilleur.exAequo > 0 ? ` et ${pluriel(d.meilleur.exAequo, 'autre')}` : ''} · ${d.meilleur.quand === null ? 'en route' : quandEcrit(d.meilleur.quand, maintenant)}`}
                  </>
                ) : (
                  'personne encore'
                )
              }
            />
            <Chiffre nom="Score médian" valeur={mediane === null ? '–' : demi(mediane)} detail="des tentatives finies" />
            <Chiffre
              nom="Semaine dernière"
              valeur={d.passee ? formatNumber(d.passee.joueurs) : '–'}
              detail={
                !d.passee
                  ? 'pas de défi'
                  : d.passee.vainqueurs === null
                    ? `${d.passee.joueurs > 1 ? 'joueurs' : 'joueur'} · pas encore close`
                    : `${d.passee.joueurs > 1 ? 'joueurs' : 'joueur'} · ${d.passee.vainqueurs === 0 ? 'aucun vainqueur' : d.passee.vainqueurs === 1 ? 'un vainqueur' : `${formatNumber(d.passee.vainqueurs)} vainqueurs ex æquo`}`
              }
            />
          </ul>
          {!d.tire ? (
            <p className="muted small">Personne ne l’a encore ouvert cette semaine : il se tirera à la première ouverture, le même pour tous jusqu’à dimanche.</p>
          ) : (
            <>
              <h3 className="qg-sous-titre">
                Les scores <span className="muted small">les tentatives finies, selon leurs bonnes réponses</span>
              </h3>
              {d.scores.length > 0 ? <GrapheDesScores scores={d.scores} /> : <p className="muted small">Aucune tentative finie pour l’instant.</p>}
              <h3 className="qg-sous-titre">
                Question par question <span className="muted small">les plus ratées, la part de bonnes réponses</span>
              </h3>
              {d.ratees.length > 0 ? (
                <ul className="qg-pistes qg-ratees">
                  {d.ratees.map(q => {
                    const pct = Math.round((q.justes / q.reponses) * 100)
                    return (
                      <li key={q.index} className="qg-piste-ligne">
                        <span className="qg-piste-nom">
                          {/* Les espaces fines : au téléphone, le deux-points d'un intitulé ouvrait sa ligne. */}
                          <span className="qg-ratee-texte">{espacesFines(`${q.index + 1} · ${q.texte}`)}</span>
                        </span>
                        <span className="qg-piste" aria-hidden="true">
                          {pct > 0 && <i className="qg-mode-campagne" style={{ width: `${pct}%` }} />}
                        </span>
                        <b className="num">
                          {enPourcentsEcrits(pct)}
                          <span className="sr-only">{`, ${formatNumber(q.justes)} sur ${pluriel(q.reponses, 'réponse')}`}</span>
                        </b>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="muted small">Pas encore assez de réponses : une question se juge à partir de cinq.</p>
              )}
              <p className="muted small">Le défi est le même pour tous depuis sa première ouverture : une question corrigée dans la base ne change pas celui de la semaine.</p>
            </>
          )}
        </>
      )}
    </section>
  )
}

/** Les parcours de thème les plus suivis, sur trente jours. */
export function ParcoursDeThemeAuQg({ suivi }: { suivi: SuiviDeLaCampagne | null }) {
  const p = suivi?.parcours
  return (
    <section className="qg-carte" aria-labelledby="campagne-parcours">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="campagne-parcours">Les parcours de thème</h2>
        <span className="muted small">les plus suivis, sur trente jours</span>
      </div>
      {!p ? (
        <p className="serif-note">Chargement…</p>
      ) : p.lignes.length === 0 ? (
        <p className="muted small">Personne n’a joué de parcours ces trente derniers jours.</p>
      ) : (
        <>
          <div className="qg-tableau">
            <table>
              <thead>
                {/* Des titres courts : « Étapes validées » repoussait « Finis » hors du tableau, au téléphone. */}
                <tr>
                  <th scope="col">Parcours</th>
                  <th scope="col">Joueurs</th>
                  <th scope="col">Étapes</th>
                  <th scope="col">Finis</th>
                </tr>
              </thead>
              <tbody>
                {p.lignes.map(l => (
                  <tr key={l.sujet}>
                    <th scope="row" className="qg-tableau-texte">
                      {l.nom}
                    </th>
                    <td className="num">{formatNumber(l.joueurs)}</td>
                    <td className="num">{formatNumber(l.etapes)}</td>
                    <td className="num">{formatNumber(l.finis)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            {`Sur trente jours : ${pluriel(p.commences, 'parcours commencé', 'parcours commencés')} — un par joueur et par thème —, ${pluriel(p.sujets, 'thème ouvert', 'thèmes ouverts')} au moins une fois. « Étapes » : les étapes validées, une fois par joueur — rejouée pour ses étoiles, une étape ne compte pas deux fois ; « Finis » : la sixième validée.`}
          </p>
        </>
      )}
    </section>
  )
}

/** Les vies des sentiers : achetées chaque jour, perdues, et celles prises dans la réserve. */
export function ViesDesSentiersAuQg({ suivi }: { suivi: SuiviDeLaCampagne | null }) {
  const v = suivi?.vies
  const total = (xs: readonly number[]) => xs.reduce((n, x) => n + x, 0)
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="campagne-vies">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="campagne-vies">Les vies</h2>
        <span className="muted small">achetées chaque jour, sur trente jours</span>
      </div>
      {!v || !suivi ? (
        <p className="serif-note">Chargement…</p>
      ) : (
        <>
          <GrapheDesJours jours={suivi.jours} valeurs={v.achetees} classe="qg-mode-campagne" dire={n => pluriel(n, 'vie achetée', 'vies achetées')} titre="Les vies achetées, jour par jour" />
          <p className="muted small">
            {`Trente jours : ${pluriel(total(v.achetees), 'vie achetée', 'vies achetées')} (${pluriel(v.confettis, 'confetti')}) · ${pluriel(total(v.perdues), 'perdue', 'perdues')}, dont ${formatNumber(total(v.auDela))} au-delà des ${VIES_PAR_JOUR} du jour — prises dans la réserve.`}
          </p>
        </>
      )}
    </section>
  )
}
