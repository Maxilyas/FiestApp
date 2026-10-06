import { useEffect, useState, type ReactNode } from 'react'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { AtlasDesAvatars } from './AtlasDesAvatars'
import { COLLECTION_HAUTE } from './Apparence'
import { JaugeFine, LigneDeCollection, TropheesAtlas } from './TropheesAtlas'
import { ThemesAGagner } from './Boutique'
import { CIEL, LILAS, OR } from './Atlas'
import { espacesFines, formatNumber } from '../format'
import { compteDeLaCollection, type FamilleDeLaCollection, type LigneDuCompte, type PartieDeLaCollection } from '../../../shared/collection'
import { COLLECTION } from '../../../shared/avatars'
import { FONDS } from '../../../shared/fonds'
import { GERBES } from '../../../shared/gerbes'
import { THEMES, enBoutique, prixDe } from '../../../shared/themes'
import { FINITIONS, NIVEAU_FINITION, NOM_FINITION, brilleChez, type PublicProfileDetail } from '../../../shared/profil'

// « Ma collection » : tout ce qui se gagne, d'un coup d'œil — ce qu'on a, ce
// qui reste, et où le gagner. Trois familles, comptées par la même règle que
// la tuile du profil (`shared/collection.ts`) : les avatars, le style, les
// trophées.
//
// On n'y règle rien : ce qu'on a se porte dans « Mon avatar », « Ma carte »
// et « Mon thème », et chaque ligne le dit, un lien vers l'écran qui le
// porte. Les écrans où l'on choisit ne montrent que ce qu'on a ; c'est ici
// que vit tout le reste.

/** Ce que chaque ligne des avatars et du style dit d'elle — les trophées ont les leurs (`TropheesAtlas`). */
const LIGNES: Partial<Record<PartieDeLaCollection, { emoji: string; nom: string; detail: string; couleur: string }>> = {
  savoir: { emoji: '🧭', nom: 'Le savoir', detail: 'Six portraits par branche, sur les sentiers', couleur: '#7ccf6a' },
  legendaires: { emoji: '🐉', nom: 'Légendaires et Divins', detail: 'Un exploit chacun — les Divins ne disent pas comment', couleur: OR },
  emojis: { emoji: '🐳', nom: 'Emojis de collection', detail: 'Un à chaque niveau qui n’ouvre pas de finition', couleur: CIEL },
  themes: { emoji: '🎨', nom: 'Thèmes', detail: 'Ils habillent toutes tes pages', couleur: LILAS },
  fonds: { emoji: '🖼️', nom: 'Fonds de carte', detail: 'Derrière ta carte, quand on touche ton nom', couleur: '#5fa8ff' },
  gerbes: { emoji: '🎉', nom: 'Gerbes', detail: 'Ce qui éclate à chaque bonne réponse', couleur: '#ff9f5a' },
  finitions: { emoji: '✨', nom: 'Finitions', detail: 'Le cercle de ton avatar, au fil des niveaux', couleur: '#ffd36e' },
}

const NOM_DE_FAMILLE: Record<FamilleDeLaCollection, string> = { avatars: 'Avatars', style: 'Style', trophees: 'Trophées' }

/** L'adresse d'une ligne : `#collection-themes`. « Mon thème » y mène, ouverte sur ceux qui se gagnent. */
const ADRESSE = 'collection'

function partieDeLAdresse(): PartieDeLaCollection | null {
  const h = window.location.hash.slice(1)
  const partie = h.startsWith(`${ADRESSE}-`) ? h.slice(ADRESSE.length + 1) : ''
  return partie in LIGNES ? (partie as PartieDeLaCollection) : null
}

/** « Le porter : Mon avatar » — l'écran où ce qu'on a se porte, sous chaque ligne. */
function OuLePorter({ ecran, nom, quoi = 'Ce qui est à toi se porte dans' }: { ecran: string; nom: string; quoi?: string }) {
  return (
    <p className="muted small">
      {quoi}{' '}
      <a className="link-inline" href={`#${ecran}`}>
        {`« ${nom} »`}
      </a>
      .
    </p>
  )
}

/** Une liste à lire : ce qu'on a, coché, et ce qui manque, avec ce qu'il faut. Rien à toucher. */
function ListeAGagner({ items }: { items: { cle: string; apercu: ReactNode; nom: string; aToi: string | null; regle: string }[] }) {
  return (
    <ul className="a-gagner">
      {items.map(i => (
        <li key={i.cle} className={i.aToi ? 'a-gagner-a-toi' : 'a-gagner-reste'}>
          <span className="a-gagner-apercu" aria-hidden="true">
            {i.apercu}
          </span>
          <span className="a-gagner-texte">
            <b>{i.nom}</b>
            <span className="small">{i.aToi ?? espacesFines(majuscule(i.regle))}</span>
          </span>
          <Icon name={i.aToi ? 'check' : 'lock'} className="a-gagner-marque" />
        </li>
      ))}
    </ul>
  )
}

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Les emojis de collection, à regarder : ceux qu'on a, et la silhouette des autres avec leur niveau. */
function EmojisDeCollection({ profil }: { profil: PublicProfileDetail }) {
  return (
    <div className="emoji-grid" role="group" aria-label="Les emojis de collection">
      {COLLECTION.map(c => {
        const anneau = c.niveau < COLLECTION_HAUTE ? ' anneau-collection' : ' anneau-collection-haut'
        if (profil.niveau < c.niveau) {
          return (
            <span key={c.emoji} className={'emoji-btn case-avatar ferme' + anneau} role="img" aria-label={`Emoji de collection, s’ouvre au niveau ${c.niveau}`}>
              <span className="silhouette" aria-hidden="true">
                {c.emoji}
              </span>
              <span className="case-niveau" aria-hidden="true">
                niv. {c.niveau}
              </span>
            </span>
          )
        }
        return (
          <span key={c.emoji} className={'emoji-btn case-avatar' + anneau} role="img" aria-label={`Avatar ${c.emoji}, de collection, à toi`}>
            <Avatar avatar={c.emoji} finition={profil.finition} eclat={brilleChez(profil, c.emoji)} />
          </span>
        )
      })}
    </div>
  )
}

/** Les thèmes : ceux qu'on a, ce que la boutique vend, et ceux qui se gagnent — dans leurs cartes, avec le lieu. */
function ThemesDeLaCollection({ profil }: { profil: PublicProfileDetail }) {
  const boutique = profil.boutique
  if (!boutique) return null
  const possedes = new Set(boutique.possedes)
  const siens = THEMES.filter(t => possedes.has(t.key))
  const enVente = THEMES.filter(t => !possedes.has(t.key) && enBoutique(t, boutique.jour))
  // Hors de leur saison, ils ne sont pas en boutique : ils reviendront.
  const ailleurs = THEMES.filter(t => !possedes.has(t.key) && !t.gagne && !enBoutique(t, boutique.jour)).length
  const prix = enVente.map(prixDe)
  return (
    <>
      <p className="small">
        <b>{`À toi · ${siens.length}`}</b> — {siens.map(t => t.nom).join(', ')}.{' '}
        <a className="link-inline" href="#theme">
          Les porter
        </a>
      </p>
      <p className="small">
        <b>{`À la boutique · ${enVente.length}`}</b>
        {prix.length > 0 && ` — de 🎊 ${formatNumber(Math.min(...prix))} à 🎊 ${formatNumber(Math.max(...prix))}`}
        {ailleurs > 0 && `, et ${ailleurs} de saison qui reviendr${ailleurs > 1 ? 'ont' : 'a'}`}.{' '}
        <a className="link-inline" href="/boutique">
          La boutique
        </a>
      </p>
      <ThemesAGagner possedes={possedes} tous titre="Ceux qui ne se vendent pas" />
    </>
  )
}

export function MaCollection({ profil }: { profil: PublicProfileDetail }) {
  const { familles, total } = compteDeLaCollection(profil)
  const [ouverte, setOuverte] = useState<PartieDeLaCollection | null>(partieDeLAdresse)
  // Ouverte d'un lien (`#collection-themes`), la ligne vient sous les yeux.
  useEffect(() => {
    if (ouverte) document.getElementById(`${ADRESSE}-${ouverte}`)?.scrollIntoView({ block: 'start' })
    // Une fois, à l'ouverture : ensuite, c'est le doigt qui parcourt.
  }, [])
  // Une autre ligne tapée dans l'adresse, la page déjà là : elle s'ouvre.
  useEffect(() => {
    const relire = () => setOuverte(partieDeLAdresse())
    window.addEventListener('hashchange', relire)
    return () => window.removeEventListener('hashchange', relire)
  }, [])
  // La ligne ouverte s'écrit dans l'adresse, sans entrée de plus : revenu
  // d'un écran qu'elle a ouvert (« Les porter »), on la retrouve ouverte.
  const toucher = (p: PartieDeLaCollection) => {
    const suivante = ouverte === p ? null : p
    history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}#${ADRESSE}${suivante ? `-${suivante}` : ''}`)
    setOuverte(suivante)
  }
  const fonds = profil.fonds ?? []
  const gerbes = profil.gerbes ?? []

  const contenus: Partial<Record<PartieDeLaCollection, ReactNode>> = {
    savoir: (
      <>
        <p className="muted small">
          Un portrait tous les deux paliers d’un sentier du savoir, dans la campagne.{' '}
          <a className="link-inline" href="/campagne#sentiers">
            Les sentiers
          </a>
        </p>
        <AtlasDesAvatars profil={profil} onglet="savoir" />
        <OuLePorter ecran="avatar" nom="Mon avatar" />
      </>
    ),
    legendaires: (
      <>
        <AtlasDesAvatars profil={profil} onglet="legendaires" />
        <OuLePorter ecran="avatar" nom="Mon avatar" />
      </>
    ),
    emojis: (
      <>
        <EmojisDeCollection profil={profil} />
        <OuLePorter ecran="avatar" nom="Mon avatar" />
      </>
    ),
    themes: <ThemesDeLaCollection profil={profil} />,
    fonds: (
      <>
        <ListeAGagner
          items={FONDS.map(f => ({
            cle: f.key,
            apercu: <span className={`fond-apercu carte-fond fond-${f.key}`} />,
            nom: f.nom,
            aToi: fonds.includes(f.key) ? (profil.fond === f.key ? 'Porté' : 'À toi') : null,
            regle: f.regle,
          }))}
        />
        <OuLePorter ecran="carte" nom="Ma carte" quoi="Il se porte dans" />
      </>
    ),
    gerbes: (
      <>
        <ListeAGagner
          items={GERBES.map(g => ({
            cle: g.key,
            apercu: <span className="gerbe-apercu">{g.particules.slice(0, 3).join('')}</span>,
            nom: g.nom,
            aToi: gerbes.includes(g.key) ? (profil.gerbe === g.key ? 'Portée' : 'À toi') : null,
            regle: g.regle,
          }))}
        />
        <OuLePorter ecran="theme" nom="Mon thème" quoi="Elle se porte dans" />
      </>
    ),
    finitions: (
      <>
        <ListeAGagner
          items={FINITIONS.map(f => ({
            cle: f,
            apercu: <Avatar avatar={profil.avatar} finition={f} />,
            nom: NOM_FINITION[f],
            aToi: profil.ouvertes.includes(f) ? (profil.finition === f ? 'Portée' : 'À toi') : null,
            regle: `au niveau ${NIVEAU_FINITION[f]}`,
          }))}
        />
        <p className="muted small">
          L’Éclat, lui, ne se gagne pas : une chance sur quarante par soirée jouée à deux ou plus et par quiz du jour, une sur vingt
          par défi de la semaine, et c’est l’avatar lui-même qui change de couleurs.
        </p>
        <OuLePorter ecran="avatar" nom="Mon avatar" quoi="Elle se choisit dans" />
      </>
    ),
  }

  const ligne = (c: LigneDuCompte) => {
    const l = LIGNES[c.partie]
    if (!l) return null
    return (
      <LigneDeCollection
        key={c.partie}
        id={`${ADRESSE}-${c.partie}`}
        emoji={l.emoji}
        nom={l.nom}
        detail={l.detail}
        compte={`${c.acquis}/${c.total}`}
        part={c.acquis / Math.max(1, c.total)}
        couleur={l.couleur}
        ouverte={ouverte === c.partie}
        onToucher={() => toucher(c.partie)}
      >
        {contenus[c.partie]}
      </LigneDeCollection>
    )
  }

  return (
    <div className="collection">
      <div className="collection-tete">
        <p className="collection-total">
          <b>{formatNumber(total.acquis)}</b> sur {formatNumber(total.total)}
        </p>
        <JaugeFine part={total.acquis / Math.max(1, total.total)} />
        <p className="muted small">
          {espacesFines('Touche une ligne : ce que tu as, ce qui reste, et où le gagner. On n’y change rien — ce qui est à toi se porte dans « Mon avatar », « Ma carte » et « Mon thème ».')}
        </p>
      </div>
      {familles.map(f => (
        <section key={f.famille} className="collection-famille" aria-labelledby={`famille-${f.famille}`}>
          <h2 id={`famille-${f.famille}`}>
            {NOM_DE_FAMILLE[f.famille]} <span className="collection-compte">{`${formatNumber(f.acquis)} sur ${formatNumber(f.total)}`}</span>
          </h2>
          {/* Les trophées gardent leurs sept lignes, et ce qu'elles déplient. */}
          {f.famille === 'trophees' ? <TropheesAtlas profil={profil} /> : <ul className="trophees-liste">{f.parties.map(ligne)}</ul>}
        </section>
      ))}
    </div>
  )
}
