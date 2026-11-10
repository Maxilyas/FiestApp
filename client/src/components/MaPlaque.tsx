import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { NomLaure } from './Laurier'
import { MotifDeLaPlaque, classeDeLaPlaque } from './Plaque'
import { AUCUNE_PLAQUE, plaquePortee, plaquesOuvertes } from '../../../shared/plaques'
import { theme } from '../../../shared/themes'
import { bordurePortee } from '../../../shared/duels'
import { cibleEclat } from '../../../shared/legendaires'
import { eclatChez, sceauVisible, type PublicProfileDetail } from '../../../shared/profil'
import type { PropsDUnePiece } from './choix'

// La plaque de son nom, là où elle se choisit et là où elle se vend : dans
// la pièce « Thème » de la loge (`MaPlaque`), et sur la fiche d'un thème à
// la boutique (`LigneDePlaque`). Partout, sa ligne telle qu'un classement la
// montrerait — son avatar, son prénom, la plaque : on choisit ce qu'on voit,
// pas un nom dans une liste.

type SaLigne = Pick<PublicProfileDetail, 'name' | 'laurier' | 'avatar' | 'finition' | 'legendaire' | 'eclats' | 'eclatsEteints' | 'matieres' | 'matieresPortees' | 'scelles' | 'sceauMasque' | 'bordureChoisie' | 'bordures'>

/** Ce que sa ligne montre avant la plaque : son avatar, tel qu'il le porte, et son prénom. */
function SonNom({ profil }: { profil: SaLigne }) {
  return (
    <>
      <Avatar
        className="lb-avatar"
        avatar={profil.avatar}
        finition={profil.finition}
        // Un profil d'un serveur d'avant, sans ses Éclats : rien ne brille, la ligne se montre quand même.
        eclat={profil.eclats ? eclatChez(profil, cibleEclat(profil.legendaire ?? undefined, profil.avatar)) : false}
        legendaire={profil.legendaire ?? undefined}
        sceau={sceauVisible(profil)}
        bordure={bordurePortee(profil.bordureChoisie ?? 'auto', profil.bordures)}
      />
      <span className="lb-name">
        <NomLaure nom={profil.name} laurier={profil.laurier} />
      </span>
    </>
  )
}

/**
 * Sa ligne sous la plaque d'un thème, à regarder seulement : la fiche d'un
 * thème de la boutique dit ainsi ce que les autres verront de lui.
 */
export function LigneDePlaque({ profil, plaque }: { profil: SaLigne; plaque: string }) {
  return (
    <div className={'lb-row plaque-apercu' + classeDeLaPlaque(plaque)} role="img" aria-label={`Ta ligne aux classements, sous la plaque ${theme(plaque)?.nom ?? ''}`}>
      <SonNom profil={profil} />
      <MotifDeLaPlaque plaque={plaque} />
    </div>
  )
}

/**
 * « Ma plaque », sous ses thèmes : comme son thème — d'office —, aucune, ou
 * celle d'un thème qu'il possède, qu'il le porte ou non. On peut jouer sous
 * le Ciel du jour et se montrer en Kintsugi : chaque thème qu'on a garde une
 * raison d'être, même rangé. Un toucher l'essaie, « Porter » l'enregistre,
 * comme toute la loge.
 */
export function MaPlaque({ profil, essai, essayer }: Pick<PropsDUnePiece, 'profil' | 'essai' | 'essayer'>) {
  const portee = profil.plaqueChoisie ?? 'auto'
  const montree = essai.plaque ?? portee
  // « Comme mon thème » suit le thème que la page porte : celui qu'il essaie, sinon le sien.
  const themeMontre = essai.theme !== undefined ? essai.theme : (profil.theme ?? null)
  const choix: { cle: string; nom: string; vue: string | null }[] = [
    { cle: 'auto', nom: 'Comme mon thème', vue: plaquePortee('auto', themeMontre) },
    { cle: AUCUNE_PLAQUE, nom: 'Aucune', vue: null },
    ...plaquesOuvertes(profil.boutique?.possedes ?? []).map(k => ({ cle: k, nom: theme(k)?.nom ?? k, vue: k })),
  ]
  return (
    <div className="ma-plaque" role="group" aria-label="Ma plaque">
      <h3 className="label">Ma plaque</h3>
      <p className="muted small">Ta ligne aux classements du quiz du jour, du défi et des duels. Les autres la voient.</p>
      <div className="leaderboard">
        {choix.map(c => {
          const choisie = montree === c.cle
          const etat = portee === c.cle ? ', portée' : choisie ? ', à l’essai' : ''
          return (
            <button
              key={c.cle}
              type="button"
              // « La mienne » : la ligne choisie prend l'anneau qui dit sa ligne dans un classement.
              className={'lb-row lb-ouvrable plaque-choix' + (choisie ? ' me' : '') + classeDeLaPlaque(c.vue)}
              aria-pressed={choisie}
              aria-label={`Plaque : ${c.nom}${etat}`}
              onClick={() => essayer({ plaque: c.cle })}
            >
              <SonNom profil={profil} />
              <MotifDeLaPlaque plaque={c.vue} />
              <span className="plaque-choix-nom">
                {portee === c.cle && <Icon name="check" />}
                {c.nom}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
