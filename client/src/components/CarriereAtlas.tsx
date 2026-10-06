import { useEffect, useState } from 'react'
import { Courbes } from './Carriere'
import { MesJours, pointsDesJours } from './Jour'
import { CIEL, Jauge, LILAS, LUEUR, OR, Orbe, Panneau, Rail, lueur } from './Atlas'
import { api } from '../api'
import { formatNumber, secondes } from '../format'
import { BRANCHES } from '../../../shared/branches'
import type { EtatDeCampagne } from '../../../shared/campagne'
import type { PublicProfileDetail } from '../../../shared/profil'

// La carrière, dans la langue de l'atlas : trois jauges qui se lisent d'un
// coup d'œil — la précision, le coup d'œil, le flair, jamais fondus en un
// seul chiffre —, les chiffres en cases, puis un rail de quatre vues : les
// soirées, les catégories, la campagne, le quiz du jour. Les courbes sont
// celles de toujours (`Courbes`), posées sur la trame.

type Vue = 'soirees' | 'categories' | 'campagne' | 'jour'

const ORDRE: Vue[] = ['soirees', 'categories', 'campagne', 'jour']
const COULEURS: Record<Vue, string> = { soirees: OR, categories: '#7ccf6a', campagne: '#ff9f5a', jour: '#ffd36e' }
const lueurDe = (categorie: string) => LUEUR[BRANCHES.find(b => b.categorie === categorie)?.key ?? 'monde']
const pourcent = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`)
/** « 3 séries jouées » : chaque mot prend la marque du pluriel. */
const pluriel = (n: number, mots: string) => `${formatNumber(n)} ${n > 1 ? mots.replace(/(\S+)/g, '$1s') : mots}`

export function CarriereAtlas({ profil }: { profil: PublicProfileDetail }) {
  const [vue, setVue] = useState<Vue>('soirees')
  // La campagne vit à part (`/api/campagne`) : sa vue attend sa réponse, et
  // une panne la laisse muette plutôt que de faire tomber la page.
  const [campagne, setCampagne] = useState<EtatDeCampagne | null>(null)
  useEffect(() => {
    let vivant = true
    api.campagne
      .etat()
      .then(e => vivant && setCampagne(e))
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [])
  const f = profil.fiche
  const i = ORDRE.indexOf(vue)
  const voisin = (d: number) => () => setVue(ORDRE[(i + d + ORDRE.length) % ORDRE.length])
  const categories = Object.entries(profil.categories)
    .filter(([, c]) => c.questions > 0)
    .map(([nom, c]) => ({ nom, ...c, part: c.justes / c.questions }))
    .sort((a, b) => b.part - a.part)
  const jours = profil.jour?.joues ?? 0

  return (
    <div className="atlas">
      <div className="hud-jauges">
        <Jauge part={f.precision ?? 0} valeur={pourcent(f.precision)} nom="Précision" detail={`${formatNumber(f.justes)} sur ${formatNumber(f.qcm)} QCM`} couleur={CIEL} />
        <Jauge part={f.coupDOeil ?? 0} valeur={pourcent(f.coupDOeil)} nom="Coup d’œil" detail={pluriel(f.estimationsComparees, 'estimation')} couleur={LILAS} />
        <Jauge part={f.flair ?? 0} valeur={pourcent(f.flair)} nom="Flair" detail="seul contre tous" couleur="#ff9f5a" />
      </div>
      {/* La précision compte tous ses QCM ; le coup d'œil, le flair et les
          chiffres d'en dessous ne se mesurent qu'en soirée — sans cette
          ligne, ses « 312 sur 400 QCM » ne se retrouveraient pas dans ses
          soirées. */}
      {f.precision !== null && <p className="muted small">La précision compte tous tes QCM : soirées, quiz du jour et campagne.</p>}
      {f.coupDOeil !== null && <p className="muted small">Le coup d’œil : la part de la salle que tes estimations battent ou égalent, en moyenne.</p>}
      <div className="hud-chiffres">
        <span>
          <b>{formatNumber(f.soirees)}</b>soirées
        </span>
        <span>
          <b>{formatNumber(f.quizGagnes)}</b>quiz gagnés
        </span>
        <span>
          <b>{formatNumber(f.podiumsQuiz)}</b>podiums
        </span>
        <span>
          <b>{secondes(f.reflexeMoyenMs)}</b>réflexe moyen
        </span>
        <span>
          <b>{secondes(f.meilleurTempsMs)}</b>record de vitesse
        </span>
        <span>
          <b>{formatNumber(f.meilleureSerie)}</b>meilleure série
        </span>
        <span>
          <b>{formatNumber(f.reponses)}</b>réponses
        </span>
        <span>
          <b>{formatNumber(f.estimationsExactes)}</b>estimations exactes
        </span>
        <span>
          <b>{formatNumber(f.hotes)}</b>hôtes différents
        </span>
      </div>

      <Rail choisi={vue} label="Ma carrière">
        <Orbe nom="Soirées" compte={formatNumber(profil.soirees.length)} part={1} couleur={COULEURS.soirees} choisi={vue === 'soirees'} onClick={() => setVue('soirees')}>
          <span className="orbe-emoji">🎉</span>
        </Orbe>
        <Orbe nom="Catégories" compte={formatNumber(categories.length)} part={1} couleur={COULEURS.categories} choisi={vue === 'categories'} onClick={() => setVue('categories')}>
          <span className="orbe-emoji">🧭</span>
        </Orbe>
        <Orbe nom="Campagne" compte={campagne ? `record ${campagne.record}` : '—'} part={1} couleur={COULEURS.campagne} choisi={vue === 'campagne'} onClick={() => setVue('campagne')}>
          <span className="orbe-emoji">🎯</span>
        </Orbe>
        <Orbe nom="Quiz du jour" compte={pluriel(jours, 'jour')} part={1} couleur={COULEURS.jour} choisi={vue === 'jour'} onClick={() => setVue('jour')}>
          <span className="orbe-emoji">☀️</span>
        </Orbe>
      </Rail>

      {vue === 'soirees' && (
        <Panneau couleur={COULEURS.soirees} surtitre="Ta progression" titre="Soirée après soirée" compteur={pluriel(profil.soirees.length, 'soirée')} onPrecedent={voisin(-1)} onSuivant={voisin(1)}>
          <div className="hud-courbes">
            <Courbes soirees={profil.soirees} />
          </div>
        </Panneau>
      )}
      {vue === 'categories' && (
        <Panneau couleur={COULEURS.categories} surtitre="Ce que tu sais" titre="Par catégorie" compteur="Bonnes réponses, et précision" onPrecedent={voisin(-1)} onSuivant={voisin(1)}>
          {categories.length === 0 ? (
            <p className="atlas-objectif">Pas encore de question jouée.</p>
          ) : (
            <>
              <ul className="hud-barres">
                {categories.map(c => (
                  <li key={c.nom} style={lueur(lueurDe(c.nom))}>
                    <span className="hud-barre-nom">{c.nom}</span>
                    <span className="hud-barre-valeur">
                      {c.justes}/{c.questions} · {Math.round(c.part * 100)} %
                    </span>
                    <span className="jauge-fine" aria-hidden="true">
                      <span style={{ width: `${c.part * 100}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
              {/* Tous les modes de jeu, comme ses écussons et sa précision. */}
              <p className="muted small">Tes soirées, le quiz du jour et la campagne ensemble, comme tes écussons.</p>
            </>
          )}
        </Panneau>
      )}
      {vue === 'campagne' && (
        <Panneau
          couleur={COULEURS.campagne}
          surtitre="Seul, sans chrono"
          titre="Ma campagne"
          compteur={campagne ? pluriel(campagne.series, 'série jouée') : undefined}
          onPrecedent={voisin(-1)}
          onSuivant={voisin(1)}
        >
          {campagne && (
            <div className="campagne-record">
              <b>{campagne.record}</b>
              <span>bonnes réponses d’affilée : ton record</span>
            </div>
          )}
          <p className="atlas-objectif">
            <a className="link-inline" href="/campagne">
              {campagne && campagne.series > 0 ? 'Rejouer la campagne' : 'Jouer la campagne'}
            </a>
          </p>
        </Panneau>
      )}
      {vue === 'jour' && (
        <>
          <Panneau couleur={COULEURS.jour} surtitre="Chaque matin" titre="Jour après jour" compteur={pluriel(jours, 'jour joué')} onPrecedent={voisin(-1)} onSuivant={voisin(1)}>
            {profil.jour && profil.jour.jours.length > 0 ? (
              <div className="hud-courbes">
                <Courbes unite="jour" soirees={pointsDesJours(profil.jour.jours)} />
              </div>
            ) : (
              <p className="atlas-objectif">
                Pas encore de quiz du jour.{' '}
                <a className="link-inline" href="/jour">
                  Jouer celui d’aujourd’hui
                </a>
              </p>
            )}
          </Panneau>
          <MesJours jour={profil.jour} />
        </>
      )}
    </div>
  )
}
