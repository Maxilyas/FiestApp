import { AGagner, EnteteDeLaPiece, PiedDeLaPiece } from './LigneDeCollection'
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
 *
 * Des médailles, quatre par rangée au téléphone (le souhait du propriétaire du
 * 17 novembre 2026 : « on est obligé de scroller trop […] la présentation ne
 * donne pas trop envie ») : l'emoji du trophée en grand dans un rond, son nom
 * dessous, et, choisi, son rang sur la carte en pastille d'or au coin. Une ligne
 * de 65 px par trophée, deux lignes de texte chacun, en montrait deux avant de
 * défiler. Le mot reste « trophée » : la médaille n'est que le dessin. Ce qu'il a
 * fallu pour l'obtenir (`ceQuIlAFallu`) ne s'écrit plus sous chaque nom — il
 * doublait la hauteur de la ligne — mais se lit toujours à l'oreille
 * (`aria-describedby`) : sous une grille de quarante trophées, une ligne
 * de règle pour le dernier touché serait restée loin du doigt, et l'album de
 * « Ma collection » dit la règle de chacun.
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
  // Ce qui reste à gagner, compté comme le fait la pièce « Titre » : les trophées du catalogue qu'il n'a pas.
  const aGagner = profil.hautsFaits.length - gagnes.length

  if (gagnes.length > 0) {
    return (
      <section className="loge-vitrine-piece">
        {/* Sa pièce s'appelle « Vitrine » : l'en-tête dit ce qu'elle range, des trophées — le mot de l'album et des fins de partie. */}
        <EnteteDeLaPiece id="loge-vitrine-entete" titre="Mes trophées" compte={`${gagnes.length} à toi`} consigne={`Jusqu’à ${VITRINE_MAX} sur ta carte, dans l’ordre.`} />
        {/* Une liste, pas un groupe : `role="group"` lui retirait ses éléments. */}
        <ul className="loge-vignettes loge-medailles" aria-labelledby="loge-vitrine-entete">
          <li>
            <button
              type="button"
              className={'loge-vignette loge-medaille' + (office.montre ? ' selected' : '') + (office.montre && !office.porte ? ' essaye' : '') + (!office.montre && office.porte ? ' porte' : '')}
              aria-pressed={office.montre}
              aria-describedby="loge-vitrine-office"
              onClick={() => essayer({ vitrine: null })}
            >
              <span className="loge-vignette-image" aria-hidden="true">
                <span className="loge-medaille-emoji">✨</span>
              </span>
              {/* « Les plus durs, d'office » sur trois lignes dans une médaille : « d'office » se dit à l'oreille, et la consigne de la carte le dit à l'œil. */}
              <span className="loge-vignette-nom">
                Les plus durs<span className="sr-only">, d’office</span>
              </span>
              {office.porte && !office.montre && <span className="sr-only">, porté</span>}
              <span id="loge-vitrine-office" className="sr-only">
                {plusDurs > 1 ? `Ta carte choisit tes ${plusDurs} plus durs.` : 'Ta carte le montre d’office.'}
              </span>
            </button>
          </li>
          {gagnes.map(cle => {
            const b = badgeDe(cle)!
            const rang = montree ? montree.indexOf(cle) : -1
            const pris = rang >= 0
            const neuf = neufs?.has(cle)
            // Une piste de carrière se range à un métal, que la médaille porte en liseré (bronze, argent, or) ; son nom
            // le dit encore à l'oreille : « Le Sans-Faute · Bronze » devenait « Le Sans-Faute · … » sur deux lignes.
            const metal = palierDe(b.key)?.palier
            const [nom, ...suite] = b.title.split(' · ')
            return (
              <li key={cle}>
                <button
                  type="button"
                  className={'loge-vignette loge-medaille' + (metal ? ` loge-medaille-m${metal}` : '') + (pris ? ' selected' : '') + (neuf ? ' neuve' : '')}
                  aria-pressed={pris}
                  aria-disabled={(!pris && complet) || undefined}
                  aria-describedby={`loge-vitrine-regle-${cle}`}
                  onClick={() => basculer(cle)}
                >
                  <span className="loge-vignette-image" aria-hidden="true">
                    <span className="loge-medaille-emoji">{b.emoji}</span>
                  </span>
                  <span className="loge-vignette-nom">
                    {nom}
                    {suite.length > 0 && <span className="sr-only">{` · ${suite.join(' · ')}`}</span>}
                  </span>
                  {neuf && <span className="sr-only">, nouveau</span>}
                  {/* Son rang sur la carte, dit aussi à l'oreille : il n'était qu'à l'œil. */}
                  {pris && (
                    <span className="loge-medaille-rang">
                      <span className="sr-only">, montré </span>
                      {rang + 1}
                      <span className="sr-only">{rang === 0 ? 'ᵉʳ' : 'ᵉ'}</span>
                    </span>
                  )}
                  <span id={`loge-vitrine-regle-${cle}`} className="sr-only">
                    {ceQuIlAFallu(b.key)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {aGagner > 0 && (
          <PiedDeLaPiece>
            <AGagner n={aGagner} un="trophée" plusieurs="trophées" href="#collection-trophees" />
          </PiedDeLaPiece>
        )}
      </section>
    )
  }

  return (
    <section className="loge-vitrine-piece">
      <EnteteDeLaPiece id="loge-vitrine-entete" titre="Sur ta carte" />
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
