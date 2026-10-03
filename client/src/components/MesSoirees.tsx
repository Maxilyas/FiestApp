import { useState } from 'react'
import { formatNumber, place, reponsesParType } from '../format'
import { spacePath } from '../routes'
import { coupDOeilMoyen, type PublicProfileDetail, type SoireeJouee } from '../../../shared/profil'

// Toutes ses soirées, au même endroit : celles qu'il a jouées ailleurs et
// celles de son salon. Trois filtres en mots soulignés, qui tiennent sur une
// ligne ; chaque soirée, une carte : sa date en grand, son nom, ce qu'il y a
// fait, l'expérience. Son nom ouvre son souvenir, « Mon bilan » le sien.

type Filtre = 'toutes' | 'chez-moi' | 'ailleurs'

const FILTRES: [Filtre, string][] = [
  ['toutes', 'Toutes'],
  ['chez-moi', 'Chez moi'],
  ['ailleurs', 'Ailleurs'],
]

export function MesSoirees({ profil, monEspace }: { profil: PublicProfileDetail; /** L'adresse de son salon : ses soirées y sont « chez moi ». */ monEspace?: string | null }) {
  const [filtre, setFiltre] = useState<Filtre>('toutes')
  const chezMoi = (s: SoireeJouee) => !!monEspace && s.slug === monEspace
  const garder = (f: Filtre) => (s: SoireeJouee) => (f === 'toutes' ? true : f === 'chez-moi' ? chezMoi(s) : !chezMoi(s))
  const liste = profil.soirees.filter(garder(filtre))
  const cetteAnnee = new Date().getFullYear()
  return (
    <section className="soirees">
      {/* Les filtres ne disent quelque chose qu'à qui a un salon à lui. */}
      {monEspace && profil.soirees.length > 0 && (
        <nav className="rayons-texte" aria-label="Montrer">
          {FILTRES.map(([f, nom]) => (
            <button key={f} type="button" aria-pressed={filtre === f} onClick={() => setFiltre(f)}>
              {nom} <span className="rayon-compte">{profil.soirees.filter(garder(f)).length}</span>
            </button>
          ))}
        </nav>
      )}
      {profil.soirees.length === 0 && <p className="muted">Pas encore de soirée : la première s’ajoutera ici.</p>}
      {profil.soirees.length > 0 && liste.length === 0 && <p className="muted">Aucune soirée ici pour l’instant.</p>}
      <ol className="soirees-liste">
        {liste.map(s => {
          const d = new Date(s.at)
          const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
          const ici = chezMoi(s)
          // Le titre que l'animateur lui a donné, la date sinon : une liste de
          // dates ne disait pas laquelle était la fête de Marc.
          const nom = s.titre ?? date
          return (
            <li key={s.soireeId} className="soiree-carte">
              <span className={'soiree-date' + (ici ? ' soiree-chez-moi' : '')} title={date}>
                <b>{d.getDate()}</b>
                {d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}
                {/* L'année, seulement quand ce n'est plus celle-ci : sinon la date se lit d'un coup d'œil. */}
                {d.getFullYear() !== cetteAnnee && <span className="soiree-annee">{d.getFullYear()}</span>}
              </span>
              <span className="soiree-texte">
                {/* Le souvenir de la soirée, dans l'espace où elle s'est jouée. */}
                {s.slug ? (
                  <a className="soiree-nom" href={spacePath(s.slug, 'souvenir', s.soireeId)}>
                    {nom}
                  </a>
                ) : (
                  <b className="soiree-nom">{nom}</b>
                )}
                <span className="soiree-detail">
                  {ici ? 'chez moi · ' : s.chez ? `chez ${s.chez} · ` : ''}
                  {s.espaceFerme && 'un espace fermé · '}
                  {/* Par type de question : « 64 réponses, 1 juste » ne disait pas
                      que soixante-deux étaient des estimations. */}
                  {reponsesParType({ ...s.releve, coupDOeil: coupDOeilMoyen(s.releve) }, { compte: false }) || 'aucune réponse'}
                  {s.releve.rang > 0 && s.releve.rang <= 3 && ` · ${place(s.releve.rang)}`}
                </span>
                {/* Son bilan à soi, d'un toucher : il redemandait « Qui es-tu ? ». */}
                {s.slug && s.joueurId && (
                  <a className="link-inline small" href={`${spacePath(s.slug, 'bilan', s.soireeId)}#p=${encodeURIComponent(s.joueurId)}`}>
                    Mon bilan
                  </a>
                )}
              </span>
              <span className="soiree-gain">
                +{formatNumber(s.xp)}
                <small>XP</small>
              </span>
            </li>
          )
        })}
      </ol>
      {/* Les lignes à part : sans ce mot, la somme des soirées ne faisait pas
          le total, et rien ne disait pourquoi. */}
      <p className="muted small center">Les paliers de carrière, le quiz du jour et la campagne s’ajoutent à part.</p>
    </section>
  )
}
