import { Fragment, useState, type ReactNode } from 'react'
import { Avatar } from './Avatar'
import { Icon, type IconName } from './Icon'
import { GerbeDeJuste } from './Gerbe'
import { EtapeDuChemin } from './LigneDeCollection'
import { useFiche } from './Boutique'
import { espacesFines } from '../format'
import { gemme } from '../gemmes'
import { objetsDuStyle, type LieuDuStyle, type ObjetDuStyle, type PartieDuStyle } from '../../../shared/style'
import { OU_JOUER } from '../../../shared/trophees'
import { gerbe } from '../../../shared/gerbes'
import { CRANS_D_UNE_BORDURE, ligueParCle, type CleDeLigue } from '../../../shared/duels'
import { divin } from '../../../shared/divins'
import { avatarDeLApercu, sonAvatar } from '../../../shared/sonAvatar'
import type { Finition, PublicProfileDetail } from '../../../shared/profil'

// Le style, dans « Ma collection » : les fonds de carte, les gerbes, les
// finitions et les bordures de ligue, chacun en album — comme les avatars et
// les trophées : ce qu'on a en couleur, ce qui reste éteint, ce qu'il faut en
// deux mots sous sa case. Trois listes cochées les disaient sans dire où l'on
// en était, et les bordures n'y étaient pas. Toucher une case ouvre sa fiche
// sous sa rangée : ce qu'il habille, comment l'avoir et où l'on en est, le
// chemin de l'écran qui le donne — et, à lui, « Essayer », qui ouvre la loge
// avec lui sur la carte. Rien ne s'y porte. Les règles sont pures
// (`shared/style.ts`).

/** Ce que chaque ligne habille, en tête de sa fiche. */
const CE_QU_IL_HABILLE: Record<PartieDuStyle, string> = {
  fonds: 'Derrière ta carte, quand quelqu’un touche ton nom.',
  gerbes: 'Elle éclate sur ton téléphone à chaque bonne réponse : toi seul la vois.',
  finitions: 'Le cercle de ton avatar, partout où la salle le voit.',
  bordures: 'Autour de ton avatar : chaque duel gagné dans sa ligue en sertit un cran.',
}

/** Ce qu'il est, à la place d'une rareté dans sa fiche : le style n'en a pas. */
const SORTE: Record<PartieDuStyle, string> = { fonds: 'Fond de carte', gerbes: 'Gerbe', finitions: 'Finition', bordures: 'Bordure de ligue' }

/** Porté ou portée : un fond, une gerbe, une finition, une bordure. */
const PORTE: Record<PartieDuStyle, string> = { fonds: 'porté', gerbes: 'portée', finitions: 'portée', bordures: 'portée' }
/** Et sa fiche l'accorde de même : « Comment il se gagne » sous une gerbe se lisait de travers. */
const IL: Record<PartieDuStyle, { il: string; le: string }> = {
  fonds: { il: 'il', le: 'le' },
  gerbes: { il: 'elle', le: 'la' },
  finitions: { il: 'elle', le: 'la' },
  bordures: { il: 'elle', le: 'la' },
}

/**
 * La pièce de la loge où il s'essaie, et la clé que l'essai y lit
 * (`essaiDemande`) : celles des nouveautés de la loge.
 */
const ESSAI: Record<PartieDuStyle, { piece: string; cle: (o: ObjetDuStyle) => string }> = {
  fonds: { piece: 'fond', cle: o => o.cle },
  gerbes: { piece: 'gerbe', cle: o => o.cle },
  finitions: { piece: 'avatar', cle: o => `finition:${o.cle}` },
  bordures: { piece: 'avatar', cle: o => `bordure:${o.cle}` },
}

const ICONE_DU_LIEU: Record<LieuDuStyle, IconName> = {
  soiree: 'sparkles',
  jour: 'sun',
  campagne: 'target',
  sentiers: 'mountain',
  duels: 'swords',
  niveau: 'star',
  profil: 'heart',
}

/**
 * L'écran où aller le gagner, quand il en a un : une soirée se rejoint par
 * son code, et le niveau vient de tout ce qu'on joue.
 */
const OU_ALLER: Partial<Record<LieuDuStyle, { nom: string; href: string }>> = {
  jour: OU_JOUER.jour,
  campagne: OU_JOUER.campagne,
  sentiers: OU_JOUER.sentiers,
  duels: OU_JOUER.duels,
}

/** L'adresse qui l'essaie dans la loge : `?essayer=finition:or#avatar`. */
export const adresseDeLEssaiDuStyle = (partie: PartieDuStyle, o: ObjetDuStyle) => `?essayer=${encodeURIComponent(ESSAI[partie].cle(o))}#${ESSAI[partie].piece}`

/**
 * Une ligne du style, en album : ses cases dans l'ordre du catalogue, la
 * fiche de la touchée sous sa rangée. Une gerbe touchée éclate, même à
 * gagner : on sait ce qu'on vise.
 */
export function AlbumDuStyle({ partie, profil }: { partie: PartieDuStyle; profil: PublicProfileDetail }) {
  const objets = objetsDuStyle(partie, profil)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const detail = useFiche(ouvert, partie)
  const [eclat, setEclat] = useState<{ cle: string; n: number } | null>(null)
  const toucher = (o: ObjetDuStyle) => {
    setOuvert(x => (x === o.cle ? null : o.cle))
    if (partie === 'gerbes') setEclat(e => ({ cle: o.cle, n: (e?.n ?? 0) + 1 }))
  }
  /**
   * Son aperçu : le fond lui-même, la gerbe en ses particules, son avatar dans
   * la finition ou la bordure — celui qu'il porte, un légendaire compris :
   * l'emoji d'en dessous s'y montrait (le 14 octobre 2026). Sous un Divin, qui
   * n'en prend aucune, la finition ou la bordure seule (`avatarDeLApercu`).
   */
  const visuel = (o: ObjetDuStyle, grand = false): ReactNode => {
    switch (partie) {
      case 'fonds':
        return <span className={`fond-apercu carte-fond fond-${o.cle}`}>{grand && <Avatar {...sonAvatar(profil)} finition={profil.finition} />}</span>
      case 'gerbes': {
        const g = gerbe(o.cle)
        return <span className={'style-gerbe' + (o.aLui ? '' : ' silhouette')}>{grand ? g?.particules.join(' ') : g?.particules[0]}</span>
      }
      case 'finitions':
        return <Avatar {...avatarDeLApercu(profil)} finition={o.cle as Finition} />
      case 'bordures':
        return <Avatar {...avatarDeLApercu(profil)} finition={profil.finition} bordure={{ ligue: o.cle as CleDeLigue, crans: o.crans ?? 0 }} />
    }
  }
  // Un Divin a sa propre lumière : ce que ces deux albums montrent se voit sous ses autres avatars.
  const divinPorte = partie === 'finitions' || partie === 'bordures' ? divin(profil.legendaire) : undefined
  return (
    <>
      <div className={`trophees-grille style-grille style-${partie}`}>
        {objets.map(o => (
          <Fragment key={o.cle}>
            <button
              type="button"
              className={'trophee-case style-case' + (o.aLui ? '' : ' trophee-manque')}
              style={gemme('offert')}
              aria-expanded={ouvert === o.cle}
              aria-controls={ouvert === o.cle ? 'fiche-style' : undefined}
              aria-label={`${o.nom}, ${o.porte ? PORTE[partie] : o.aLui ? 'à toi' : `à gagner : ${o.court}`}`}
              onClick={() => toucher(o)}
            >
              <span className="trophee-medaillon" aria-hidden="true">
                {visuel(o)}
                {o.porte && (
                  <span className="album-coche">
                    <Icon name="check" />
                  </span>
                )}
              </span>
              <span className="trophee-nom" aria-hidden="true">
                {o.nom}
              </span>
              {/* Ce qu'il faut, tant qu'il reste à gagner ; une bordure dit ses crans. */}
              {(!o.aLui || partie === 'bordures') && (
                <span className="trophee-sous" aria-hidden="true">
                  {o.court}
                </span>
              )}
            </button>
            {ouvert === o.cle && (
              <div id="fiche-style" className="fiche-case album-fiche" ref={detail}>
                <FicheDuStyle o={o} partie={partie} visuel={visuel(o, true)} />
              </div>
            )}
          </Fragment>
        ))}
      </div>
      {divinPorte && (
        <p className="muted small">{`${divinPorte.nom} a sa propre lumière : ${partie === 'finitions' ? 'ta finition' : 'ta bordure'} se voit sous tes autres avatars.`}</p>
      )}
      <p className="muted small">{espacesFines('En couleur, ce qui est à toi ; éteint, ce qui reste. Touches-en un : comment l’avoir, et où tu en es.')}</p>
      {eclat && <GerbeDeJuste key={eclat.n} cle={eclat.cle} />}
    </>
  )
}

/**
 * La fiche d'un objet du style, sous sa rangée : en grand, son nom, ce qu'il
 * habille ; à lui, « Essayer » ; puis comment il se gagne — où il en est tant
 * qu'il ne l'a pas —, et le chemin de l'écran qui le donne.
 */
export function FicheDuStyle({ o, partie, visuel }: { o: ObjetDuStyle; partie: PartieDuStyle; visuel: ReactNode }) {
  const aller = o.aLui ? null : OU_ALLER[o.etape.lieu]
  const crans = o.crans ?? 0
  return (
    <div className={`galerie-detail detail-case album-detail style-fiche style-fiche-${partie}`} style={gemme('offert')}>
      <div className="album-detail-tete">
        <span className="style-fiche-visuel" aria-hidden="true">
          {visuel}
        </span>
        <span className="album-detail-titre">
          <b className="galerie-detail-nom">{o.nom}</b>
          <span className="album-detail-rarete">{partie === 'bordures' ? `${SORTE.bordures} · ${ligueParCle(o.cle as CleDeLigue).court}` : SORTE[partie]}</span>
        </span>
      </div>
      <p className="muted small">{espacesFines(CE_QU_IL_HABILLE[partie])}</p>
      {o.aLui && (
        <p className="small album-a-toi">
          <Icon name="check" />
          <span>{o.porte ? `À toi, et tu ${IL[partie].le} portes.` : 'À toi.'}</span>
        </p>
      )}
      {partie === 'bordures' && o.aLui && (
        <p className="muted small">
          {crans >= CRANS_D_UNE_BORDURE
            ? 'Sertie : ses douze crans gagnés.'
            : espacesFines(`${crans} cran${crans > 1 ? 's' : ''} sur ${CRANS_D_UNE_BORDURE} : encore ${CRANS_D_UNE_BORDURE - crans} victoire${CRANS_D_UNE_BORDURE - crans > 1 ? 's' : ''} dans sa ligue pour la sertir.`)}
        </p>
      )}
      {/* Ce qu'il porte déjà, l'essayer ne montrerait rien de neuf. */}
      {o.aLui && !o.porte && (
        <a className="btn btn-small album-essayer" href={adresseDeLEssaiDuStyle(partie, o)}>
          Essayer
        </a>
      )}
      <span className="label album-etiquette">{o.aLui ? `Comment ${IL[partie].il} se gagne` : 'Comment l’obtenir'}</span>
      <EtapeDuChemin icone={ICONE_DU_LIEU[o.etape.lieu]} titre={o.etape.titre} regle={o.etape.regle} tenue={o.aLui} progres={o.aLui ? null : o.etape.progres} />
      {aller && (
        <a className="btn btn-small album-aller" href={aller.href}>
          {aller.nom}
        </a>
      )}
    </div>
  )
}
