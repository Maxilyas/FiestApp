import { Avatar } from './Avatar'
import { NomLaure } from './Laurier'
import { Ecrin, EmblemeDeLaPlaque, classeDeLaPlaque } from './Plaque'
import { AUCUNE_PLAQUE, nomDeLaPlaque, plaqueAvecSonCamp, plaquePortee, plaquesOuvertes } from '../../../shared/plaques'
import { theme } from '../../../shared/themes'
import { bordurePortee } from '../../../shared/duels'
import { cibleEclat } from '../../../shared/legendaires'
import { eclatChez, sceauVisible, type PublicProfileDetail } from '../../../shared/profil'
import { ceQueDitLaVignette, classesDeLaVignette, type EtatDUneVignette } from './LigneDeCollection'
import type { PropsDUnePiece } from './choix'

// La plaque de son nom, là où elle se choisit et là où elle se vend : dans
// la pièce « Thème » de la loge (`MaPlaque`, derrière l'onglet « Ma
// plaque »), et sur la fiche d'un thème à la boutique (`LigneDePlaque`).
// Sa ligne telle que les classements la montrent — son avatar dans l'écrin de
// la plaque, son prénom : on choisit ce qu'on voit, pas un nom dans une liste.

type SaLigne = Pick<PublicProfileDetail, 'name' | 'laurier' | 'avatar' | 'finition' | 'legendaire' | 'eclats' | 'eclatsEteints' | 'matieres' | 'matieresPortees' | 'scelles' | 'sceauMasque' | 'bordureChoisie' | 'bordures'>

/** Ce que sa ligne montre : son avatar, tel qu'il le porte, dans l'écrin de la plaque — sans plaque, la place vide —, et son prénom. */
function SonNom({ profil, plaque }: { profil: SaLigne; plaque: string | null }) {
  return (
    <>
      <Ecrin plaque={plaque}>
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
      </Ecrin>
      <span className="lb-name">
        <NomLaure nom={profil.name} laurier={profil.laurier} />
      </span>
    </>
  )
}

/**
 * Sa ligne sous une plaque, à regarder seulement : la fiche d'un thème de la
 * boutique dit ainsi ce que les autres verront de lui, et la loge ce qu'ils
 * voient avec la plaque qu'il essaie — son avatar dans son écrin ; sans
 * plaque (`null`), la ligne de tous.
 */
export function LigneDePlaque({ profil, plaque }: { profil: SaLigne; plaque: string | null }) {
  return (
    <div
      className="lb-row plaque-apercu"
      role="img"
      aria-label={plaque ? `Ta ligne aux classements, sous la plaque ${nomDeLaPlaque(plaque)}` : 'Ta ligne aux classements, sans plaque'}
    >
      <SonNom profil={profil} plaque={plaque} />
    </div>
  )
}

/**
 * Les plaques de la loge, d'une seule lecture : ce qu'il a choisi, ce que la
 * page montre (l'essai, sinon son choix), et chaque choix avec la plaque
 * qu'il ferait voir. « Comme mon thème » suit le thème que la page porte :
 * celui qu'il essaie, sinon le sien. L'onglet « Ma plaque » en montre
 * l'échantillon, son panneau la liste : les deux lisent la même règle.
 */
export function plaquesDeLaLoge(profil: PublicProfileDetail, essai: PropsDUnePiece['essai']) {
  const portee = profil.plaqueChoisie ?? 'auto'
  const montree = essai.plaque ?? portee
  const themeMontre = essai.theme !== undefined ? essai.theme : (profil.theme ?? null)
  // La plaque des Deux Bannières porte son camp — l'essayé, sinon le sien —, comme le serveur la dit aux autres.
  const campMontre = essai.camp !== undefined ? essai.camp : (profil.camp ?? null)
  const avecSonCamp = (p: string | null) => plaqueAvecSonCamp(p, campMontre)
  const choix: { cle: string; nom: string; vue: string | null }[] = [
    { cle: 'auto', nom: 'Comme mon thème', vue: avecSonCamp(plaquePortee('auto', themeMontre)) },
    { cle: AUCUNE_PLAQUE, nom: 'Aucune', vue: null },
    ...plaquesOuvertes(profil.boutique?.possedes ?? []).map(k => ({ cle: k, nom: theme(k)?.nom ?? k, vue: avecSonCamp(k) })),
  ]
  // Une plaque choisie d'un thème qu'il n'a plus (un serveur qui en sait moins) : la règle du serveur la dit quand même.
  const vue = choix.find(c => c.cle === montree)?.vue ?? avecSonCamp(plaquePortee(montree, themeMontre))
  return { portee, montree, choix, vue }
}

/**
 * L'échantillon d'une plaque : un bout de sa plaque, à ses couleurs — son
 * fond, son trait, un texte à son encre (son nom, dans la grille), son emblème
 * après lui. Ce n'est ni un écrin ni une ligne de classement : la classe de la
 * plaque (`.plaque-<clé>`) ne lui donne que ses jetons
 * (`--p-bg`, `--p-ink`, `--p-trait`, `--p-embleme`), qu'elle lit elle-même
 * (`.loge-plaque-echantillon`). Sans plaque, le sol et l'encre de la page :
 * la ligne de tous.
 */
export function EchantillonDePlaque({ plaque, texte }: { plaque: string | null; texte?: string }) {
  return (
    <span className={'loge-plaque-echantillon' + classeDeLaPlaque(plaque)} aria-hidden="true">
      {texte && <span className="loge-plaque-texte">{texte}</span>}
      <EmblemeDeLaPlaque plaque={plaque} />
    </span>
  )
}

/**
 * « Ma plaque », le second onglet de la pièce « Thème » : sa ligne de
 * classement une seule fois, sous la plaque que la page montre, puis chaque
 * choix en vignette, une petite plaque qui porte son nom à son encre, et son emblème — son
 * prénom, la ligne au-dessus le montre déjà ; son nom sous elle prenait une
 * ligne de plus, deux pour « Comme mon thème » — : « Comme mon thème »,
 * d'office, « Aucune », puis la
 * plaque de chaque thème qu'il possède, qu'il le porte ou non : on peut jouer
 * sous le Ciel du jour et se montrer en Kintsugi. Un toucher l'essaie,
 * « Porter » l'enregistre, comme toute la loge. Une ligne entière par choix
 * l'avait précédée (le 10 novembre 2026), sous les thèmes : 64 px chacune, et
 * la plaque commençait à 1180 px en 360 × 640 — personne ne la trouvait (le
 * propriétaire, le 17 novembre 2026 : « la plaque des thèmes qui est caché
 * tout en bas et donc impossible pour des utilisateurs de savoir que ça
 * existe »).
 */
export function MaPlaque({ profil, essai, essayer, neufs }: Pick<PropsDUnePiece, 'profil' | 'essai' | 'essayer' | 'neufs'>) {
  const { portee, montree, choix, vue } = plaquesDeLaLoge(profil, essai)
  return (
    <>
      <LigneDePlaque profil={profil} plaque={vue} />
      <ul className="loge-vignettes loge-plaques" aria-label="Mes plaques">
        {choix.map(c => {
          // La plaque d'un thème neuf est neuve avec lui : le rouge mène jusqu'à elle.
          const etat: EtatDUneVignette = { montre: montree === c.cle, porte: portee === c.cle, neuve: !!neufs?.has(c.cle) }
          return (
            <li key={c.cle}>
              <button
                type="button"
                className={'loge-vignette' + classesDeLaVignette(etat)}
                aria-pressed={etat.montre}
                aria-label={`Plaque ${c.nom}` + ceQueDitLaVignette(etat, 'portée', 'nouvelle')}
                onClick={() => essayer({ plaque: c.cle })}
              >
                <span className="loge-vignette-image">
                  <EchantillonDePlaque plaque={c.vue} texte={c.nom} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
