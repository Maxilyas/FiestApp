import { Icon } from './Icon'
import { Legendaire } from './Legendaire'
import { formatNumber } from '../format'
import type { PropsDUnePiece } from './choix'
import { VITRINE_MAX, ceQuIlAFallu, cleRangee, hautFait, hautsFaitsGagnes, palierDe, titreDePalier } from '../../../shared/hautsfaits'
import { vitrineDeLaCarte } from '../../../shared/carte'
import { hautFaitPrincipal, legendaire } from '../../../shared/legendaires'
import { lePremierHautFait, recompensesDe, type Proche } from '../../../shared/proches'
import type { PublicProfileDetail } from '../../../shared/profil'

// Les pièces des trophées que d'autres écrans reprennent : sa vitrine — ce
// que sa carte montre à la salle, qui se règle dans la loge (« M'habiller »,
// pièce « Vitrine ») — et un objectif commencé. L'album lui-même vit dans
// `AlbumDesTrophees`, sous « Ma collection ».

/**
 * Ce que sa vitrine montre — celle qu'il a choisie, sinon ses trois plus
 * beaux, la règle de la carte (`vitrineDeLaCarte`) —, et de quoi la choisir.
 */
export function laVitrine(profil: PublicProfileDetail) {
  const recompenses = recompensesDe(profil.hautsFaits)
  const parCle = new Map(profil.vitrine.map(b => [b.key, b]))
  const badgeDe = (cle: string) => {
    const rangee = cleRangee(cle, recompenses)
    return rangee ? parCle.get(rangee) : undefined
  }
  const gagnes = hautsFaitsGagnes(recompenses).filter(cle => badgeDe(cle))
  const choisie = profil.vitrineChoisie ?? null
  const montres = vitrineDeLaCarte(profil.vitrine, choisie, recompenses)
  return { badgeDe, gagnes, montres }
}

/**
 * Sa vitrine : les hauts faits que sa carte montre à qui touche son nom.
 * D'office, les trois plus durs à obtenir (`plusBeaux`) ; il peut aussi les
 * choisir — un coup du sort compris, s'il en est fier —, dans l'ordre où la
 * carte les montrera. Un haut fait de carrière s'y montre à son plus haut
 * palier, qui monte avec lui.
 *
 * Dans la loge, ses hauts faits se touchent directement : chacun entre
 * dans la vitrine essayée — la carte en tête la montre —, ou en sort ; sans
 * aucun, c'est la vitrine d'office. « Choisir moi-même » puis « Montrer
 * ceux-là » faisaient deux gestes de plus que les autres pièces. La vitrine
 * d'office est une option de la liste, en tête, comme « Aucun » parmi les
 * titres : un bouton qui ne paraissait qu'une vitrine choisie partait sous
 * le doigt qui le touchait, et le focus tombait sur la page.
 */
export function MaVitrine({ profil, essai, essayer, neufs }: PropsDUnePiece) {
  const { badgeDe, gagnes } = laVitrine(profil)
  const choisie = profil.vitrineChoisie ?? null
  // Ce que la carte montre : la vitrine essayée, sinon celle qu'il porte ; null, celle d'office.
  const montree = essai.vitrine !== undefined ? essai.vitrine : choisie
  const complet = (montree?.length ?? 0) >= VITRINE_MAX
  const basculer = (cle: string) => {
    const avant = montree ?? []
    const apres = avant.includes(cle) ? avant.filter(k => k !== cle) : complet ? avant : [...avant, cle]
    essayer({ vitrine: apres.length > 0 ? apres : null })
  }
  // La vitrine d'office : montrée par la carte, et portée — ou à l'essai.
  const office = { montre: montree === null, porte: choisie === null }
  const plusDurs = Math.min(VITRINE_MAX, gagnes.length)

  if (gagnes.length > 0) {
    return (
      <section className="card">
        {/* Sa pièce s'appelle « Vitrine » : la carte dit ce qu'elle range — des trophées, le mot de l'album et des fins de partie. */}
        <h3>
          <Icon name="award" />
          Mes trophées <span className="muted small titre-compte">{`${gagnes.length} à toi`}</span>
        </h3>
        <p className="muted small">{`Touches-en jusqu’à ${VITRINE_MAX}, dans l’ordre où ta carte les montrera.`}</p>
        {/* Une liste, pas un groupe : `role="group"` lui retirait ses éléments. */}
        <ul className="vitrine-choix vitrine-a-choisir" aria-label="Les trophées de ma carte">
          <li>
            <button
              type="button"
              className={'vitrine-option' + (office.montre ? ' selected' : '') + (office.montre && !office.porte ? ' essaye' : '')}
              aria-pressed={office.montre}
              onClick={() => essayer({ vitrine: null })}
            >
              <span className="hf-emoji" aria-hidden="true">
                ✨
              </span>
              <span className="hf-corps">
                <span className="hf-titre">Les plus durs, d’office</span>
                <span className="muted small">{plusDurs > 1 ? `Ta carte choisit tes ${plusDurs} plus durs.` : 'Ta carte le montre d’office.'}</span>
              </span>
              {office.porte && !office.montre && <span className="titre-etat">porté</span>}
            </button>
          </li>
          {gagnes.map(cle => {
            const b = badgeDe(cle)!
            const rang = montree ? montree.indexOf(cle) : -1
            const pris = rang >= 0
            const neuf = neufs?.has(cle)
            return (
              <li key={cle}>
                <button
                  type="button"
                  className={'vitrine-option' + (pris ? ' selected' : '') + (neuf ? ' neuve' : '')}
                  aria-pressed={pris}
                  aria-disabled={(!pris && complet) || undefined}
                  onClick={() => basculer(cle)}
                >
                  <span className="hf-emoji" aria-hidden="true">
                    {b.emoji}
                  </span>
                  <span className="hf-corps">
                    <span className="hf-titre">{b.title}</span>
                    <span className="muted small">{ceQuIlAFallu(b.key)}</span>
                  </span>
                  {/* Son rang sur la carte, dit aussi à l'oreille : il n'était qu'à l'œil. */}
                  {pris && (
                    <span className="vitrine-rang">
                      <span className="sr-only">, montré </span>
                      {rang + 1}
                      <span className="sr-only">{rang === 0 ? 'ᵉʳ' : 'ᵉ'}</span>
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    )
  }

  return (
    <section className="card">
      <h3>
        <Icon name="award" />
        Sur ta carte
      </h3>
      <p className="muted small">
        {/* « À la fin de chaque soirée », disait-elle : faux pour qui joue seul — le quiz du jour et la
            campagne ont leurs hauts faits —, et il concluait que la vitrine n'était pas pour lui
            (l'experte du jeu solo, le 11 octobre 2026). */}
        Ta carte montrera tes trois plus beaux trophées : ils se gagnent en soirée, au quiz du jour et en campagne.
      </p>
      <PremierHautFait profil={profil} />
    </section>
  )
}

/** Un objectif commencé : le légendaire en silhouette dorée, ou l'emoji du haut fait — ce qu'on compte, et la jauge. */
export function UnProche({ p }: { p: Proche }) {
  const l = legendaire(p.key)
  const palier = palierDe(p.key)
  // La voie qui le représente : celle qu'il avance le plus. Une voie qui en
  // demande plusieurs à la fois (la Chimère) n'a pas de haut fait à elle :
  // elle se compte en conditions tenues.
  const cleDuHautFait = p.hautFait ?? (l ? hautFaitPrincipal(l) : null)
  const h = l ? (cleDuHautFait ? hautFait(cleDuHautFait) : undefined) : palier?.hautFait
  if (!h && !l) return null
  const titre = l ? l.nom : titreDePalier(palier!.hautFait, palier!.palier)
  const compte = !h
    ? `${p.acquis} conditions sur ${p.requis}`
    : h.famille === 'carriere'
      ? `${formatNumber(p.acquis)} sur ${formatNumber(p.requis)} ${p.requis < 2 ? h.mesureUne : h.mesure}`
      : `${h.title} : ${p.acquis} fois sur ${p.requis}`
  return (
    <div className="approche">
      {l ? (
        <span className="approche-medaillon">
          <Legendaire cle={p.key} verrouille />
        </span>
      ) : (
        <span className="approche-emoji" aria-hidden="true">
          {h?.emoji}
        </span>
      )}
      <div className="approche-corps">
        <b>{titre}</b>
        <span className="muted small">{compte}</span>
        <span className="jauge" aria-label={`${p.acquis} sur ${p.requis}`}>
          <span className="jauge-plein" style={{ width: `${Math.min(100, (p.acquis / p.requis) * 100)}%` }} />
        </span>
      </div>
    </div>
  )
}

/**
 * Le plus simple pour commencer, à qui n'a rien commencé : une série de
 * campagne y suffit, sans personne et à toute heure — Le Lève-tôt demande de
 * jouer avant huit heures, Le Sans-Faute un quiz du jour sans une faute.
 */
const LE_PLUS_SIMPLE = 'hf:alpiniste'

/**
 * Ce que disent « Mon titre » et « Ma vitrine » à qui n'a encore aucun haut
 * fait : « 53 titres à gagner » ne disait pas comment gagner le premier, et
 * le crayon du vestiaire menait à une page sans choix (l'experte du jeu solo,
 * le 11 octobre 2026). Celui qu'il a le plus avancé, avec sa jauge ; sinon le
 * plus simple, sans jauge : « 0 sur 10 » ne s'approche de rien.
 */
export function PremierHautFait({ profil }: { profil: Pick<PublicProfileDetail, 'hautsFaits' | 'legendaires'> }) {
  const proche = lePremierHautFait(profil.hautsFaits, profil.legendaires)
  if (proche) {
    return (
      <div className="proches">
        <span className="label">Le plus proche</span>
        <UnProche p={proche} />
      </div>
    )
  }
  const h = hautFait(LE_PLUS_SIMPLE)
  if (h?.famille !== 'carriere') return null
  return (
    <div className="proches">
      <span className="label">Le plus simple pour commencer</span>
      <div className="approche">
        <span className="approche-emoji" aria-hidden="true">
          {h.emoji}
        </span>
        <div className="approche-corps">
          <b>{titreDePalier(h, 1)}</b>
          <span className="muted small">{`${formatNumber(h.paliers[0])} ${h.paliers[0] < 2 ? h.mesureUne : h.mesure}`}</span>
        </div>
      </div>
    </div>
  )
}
