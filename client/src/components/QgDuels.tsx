import { Icon } from './Icon'
import { Chiffre, GrapheDesJours } from './QgModes'
import { formatNumber } from '../../../shared/typographie'
import { dureeEcrite, type VueDEnsemble } from '../../../shared/qg'
import { LIGUES, ligueParCle, type LigneDesDuels } from '../../../shared/duels'
import type { DuelEnAttente, SuiviDesDuels } from '../../../shared/qgDuels'

/**
 * Ce que le QG suit des duels (`/admin#duels`, le choix du 13 octobre 2026,
 * sur maquettes) : les chiffres d'aujourd'hui, les duels contre Automate et
 * ceux classés entre joueurs jour par jour, les ligues et le classement — et
 * son « Masquer » —, les duels qui attendent leur adversaire — et les
 * annuler. Les parties jour par jour viennent de la vue d'ensemble : déjà
 * lues, elles ne se relisent pas ici.
 */

const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${formatNumber(n)} ${n > 1 ? motPluriel : mot}`

/** Les quatre chiffres d'aujourd'hui : les duels joués, leurs joueurs, ceux qui attendent, les confettis de ligue. */
export function AujourdhuiDesDuels({ vue, suivi }: { vue: VueDEnsemble | null; suivi: SuiviDesDuels | null }) {
  const joues = vue?.aujourdhui.duels
  const ceJour = vue?.duels.parJour.at(-1)
  return (
    <section className="qg-jour" aria-labelledby="duels-aujourdhui">
      <div className="qg-section-tete">
        <h2 className="compte-groupe" id="duels-aujourdhui">
          Aujourd’hui
        </h2>
        <span className="muted small">comparé à la même heure des sept jours d’avant</span>
      </div>
      <ul className="qg-tuiles qg-tuiles-quatre">
        <Chiffre
          nom="Duels joués"
          valeur={joues ? formatNumber(joues.aujourdhui) : '–'}
          compte={joues}
          detail={ceJour ? `${formatNumber(ceJour.automate)} contre Automate · ${formatNumber(ceJour.contre)} contre un joueur` : undefined}
        />
        <Chiffre nom="Joueurs" valeur={vue ? formatNumber(vue.duels.joueurs.aujourdhui) : '–'} compte={vue?.duels.joueurs} />
        <Chiffre
          nom="En attente"
          valeur={suivi ? formatNumber(suivi.attente.total) : '–'}
          detail={suivi ? `${suivi.attente.total > 1 ? 'duels partis' : 'duel parti'} sans réponse` : undefined}
        />
        <Chiffre
          nom="Confettis de ligue"
          valeur={suivi ? formatNumber(suivi.semainePassee.confettis) : '–'}
          detail={suivi ? `la semaine dernière · ${pluriel(suivi.semainePassee.payes, 'joueur payé', 'joueurs payés')}` : undefined}
        />
      </ul>
    </section>
  )
}

/** Les duels par jour : contre Automate, et classés entre joueurs, sur trente jours. */
export function DuelsParJour({ vue, suivi }: { vue: VueDEnsemble | null; suivi: SuiviDesDuels | null }) {
  const jours = vue?.duels.parJour ?? []
  const automate = jours.map(j => j.automate)
  const total = (xs: readonly number[]) => xs.reduce((n, x) => n + x, 0)
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="duels-par-jour">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="duels-par-jour">Les duels par jour</h2>
        <span className="muted small">les trente derniers jours</span>
      </div>
      <ul className="qg-multiples qg-multiples-deux">
        <li className="qg-multiple">
          <div className="qg-multiple-tete">
            <b>Contre Automate</b>
            <span className="num">{vue ? formatNumber(total(automate)) : '–'}</span>
          </div>
          {vue ? (
            <GrapheDesJours jours={jours.map(j => j.jour)} valeurs={automate} classe="qg-mode-duel" dire={n => pluriel(n, 'duel')} titre="Les duels contre Automate, jour par jour" petit />
          ) : (
            <p className="serif-note">Chargement…</p>
          )}
          <span className="muted small">les dés : un adversaire simulé, de son niveau, toujours classé</span>
        </li>
        <li className="qg-multiple">
          <div className="qg-multiple-tete">
            <b>Classés, entre joueurs</b>
            <span className="num">{suivi ? formatNumber(total(suivi.lances)) : '–'}</span>
          </div>
          {suivi ? (
            <GrapheDesJours jours={suivi.jours} valeurs={suivi.lances} classe="qg-mode-duel" dire={n => pluriel(n, 'duel lancé', 'duels lancés')} titre="Les duels classés lancés, jour par jour" petit />
          ) : (
            <p className="serif-note">Chargement…</p>
          )}
          <span className="muted small">{suivi ? `${pluriel(total(suivi.lances), 'lancé', 'lancés')}, dont ${formatNumber(suivi.jouesDesDeuxCotes)} joués des deux côtés` : ''}</span>
        </li>
      </ul>
    </section>
  )
}

/** Les ligues : ceux qui ont joué un duel classé ces quatre semaines, des maîtres aux bronzes. */
export function LiguesAuQg({ suivi }: { suivi: SuiviDesDuels | null }) {
  const ligues = suivi ? [...suivi.ligues].reverse() : []
  const max = Math.max(1, ...ligues.map(l => l.joueurs))
  const classes = ligues.reduce((n, l) => n + l.joueurs, 0)
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="duels-ligues">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="duels-ligues">Les ligues</h2>
        <span className="muted small">les joueurs classés, par ligue</span>
      </div>
      {!suivi ? (
        <p className="serif-note">Chargement…</p>
      ) : (
        <>
          <ul className="qg-pistes">
            {ligues.map(l => {
              const ligue = ligueParCle(l.cle)
              const seuil = Number.isFinite(ligue.depuis) ? ` · ${formatNumber(ligue.depuis)}${LIGUES.at(-1) === ligue ? ' et plus' : ''}` : ''
              return (
                <li key={l.cle} className="qg-piste-ligne">
                  <span className="qg-piste-nom">{`${ligue.court}${seuil}`}</span>
                  <span className="qg-piste" aria-hidden="true">
                    {l.joueurs > 0 && <i className="qg-mode-duel" style={{ width: `${(l.joueurs / max) * 100}%` }} />}
                  </span>
                  <b className="num">{formatNumber(l.joueurs)}</b>
                </li>
              )
            })}
          </ul>
          <p className="muted small">
            {`${pluriel(classes, 'joueur classé', 'joueurs classés')} : un duel classé fini ces quatre dernières semaines. La semaine dernière : ${pluriel(suivi.semainePassee.payes, 'joueur payé', 'joueurs payés')} pour trois duels joués, ${pluriel(suivi.semainePassee.confettis, 'confetti')} de ligue.`}
          </p>
        </>
      )}
    </section>
  )
}

/** Le classement des duels, tel que les joueurs le voient, et « Masquer » au bout de chaque ligne. */
export function ClassementDesDuelsAuQg({ suivi, occupe, masquer }: { suivi: SuiviDesDuels | null; occupe: boolean; masquer: (l: LigneDesDuels) => void }) {
  const c = suivi?.classement
  return (
    <section className="qg-carte" aria-labelledby="duels-classement">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="duels-classement">Le classement</h2>
        <span className="muted small">{c ? `les cotes, sur les quatre dernières semaines · ${pluriel(c.joueurs, 'joueur classé', 'joueurs classés')}` : 'Chargement…'}</span>
      </div>
      {c && c.lignes.length === 0 && <p className="muted small">Personne n’a encore fini de duel classé ces quatre semaines.</p>}
      {c && c.lignes.length > 0 && (
        <ol className="qg-liste qg-classement">
          {c.lignes.map(l => (
            <li key={l.profileId} className="qg-rang">
              <span className="qg-rang-place num">{l.rang}</span>
              <span className="qg-avatar" aria-hidden="true">
                {l.avatar}
              </span>
              <span className="qg-ligne-texte">
                <b>{l.nom}</b>
                <span className="muted small">{`${ligueParCle(l.ligue).court} · ${pluriel(l.duels, 'duel')}`}</span>
              </span>
              <span className="qg-rang-points num">{formatNumber(l.cote)}</span>
              <button type="button" className="salon-geste" disabled={occupe} onClick={() => masquer(l)}>
                <Icon name="eye-off" />
                Masquer
              </button>
            </li>
          ))}
        </ol>
      )}
      {c && <p className="muted small">Masqué, un profil sort de ce classement et de celui du quiz du jour, et on ne peut plus le défier.</p>}
    </section>
  )
}

/** « Parti il y a 6 j » : ce qu'un duel en attente a déjà attendu. Insécable, comme « expire dans 6 j » : au téléphone, « 6 j » restait seul en début de ligne. */
const depuisQuand = (instant: number, maintenant: number) => (maintenant - instant < 60_000 ? 'parti à l’instant' : `parti il y a\u00a0${dureeEcrite(maintenant - instant)}`)

/** Les duels classés qui attendent leur adversaire, les plus près d'expirer d'abord, et « Annuler » sur chacun. */
export function DuelsEnAttente({ suivi, occupe, annuler }: { suivi: SuiviDesDuels | null; occupe: boolean; annuler: (d: DuelEnAttente) => void }) {
  const a = suivi?.attente
  return (
    <section className="qg-carte" aria-labelledby="duels-attente">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="duels-attente">En attente</h2>
        <span className="muted small">les duels classés partis que le profil défié n’a pas encore commencés</span>
      </div>
      {!a || !suivi ? (
        <p className="serif-note">Chargement…</p>
      ) : (
        <>
          {a.duels.length === 0 ? (
            <p className="muted small">Aucun duel n’attend son adversaire.</p>
          ) : (
            <ul className="qg-liste">
              {a.duels.map(d => (
                <li key={d.code} className="qg-ligne qg-attente">
                  <span className="qg-ligne-texte">
                    <b>
                      {`${d.auteur.avatar} ${d.auteur.nom}`} <Icon name="chevron-right" /> {`${d.adversaire.avatar} ${d.adversaire.nom}`}
                    </b>
                    <span className="muted small">{`${depuisQuand(d.envoyeLe, suivi.maintenant)}\u00a0· expire\u00a0dans\u00a0${dureeEcrite(d.fermeLe - suivi.maintenant)}`}</span>
                  </span>
                  <button type="button" className="salon-geste" disabled={occupe} onClick={() => annuler(d)}>
                    <Icon name="x" />
                    Annuler
                  </button>
                </li>
              ))}
            </ul>
          )}
          {a.total > a.duels.length && <p className="muted small">{`Et ${pluriel(a.total - a.duels.length, 'autre')}, qui expire${a.total - a.duels.length > 1 ? 'nt' : ''} plus tard.`}</p>}
          <ul className="qg-tuiles">
            <Chiffre
              nom="Partis, sans réponse"
              valeur={formatNumber(a.total)}
              detail={a.plusAncien !== null ? `le plus ancien : ${dureeEcrite(suivi.maintenant - a.plusAncien)}` : 'aucun'}
            />
            <Chiffre nom="Fermés sans réponse" valeur={formatNumber(a.fermesSansReponse)} detail="ces sept jours · ils ne comptent pas" />
          </ul>
          <p className="muted small">Annulé, un duel se ferme comme à son expiration : il ne compte pour personne. Commencé par l’autre, il ne s’annule plus.</p>
        </>
      )}
    </section>
  )
}
