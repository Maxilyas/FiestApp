import type { ReactNode } from 'react'
import { Avatar } from './Avatar'
import { NomLaure } from './Laurier'
import { Ecrin, EmblemeDeLaPlaque, classeDeLaPlaque } from './Plaque'
import { PodiumDuClassement } from './PodiumDuClassement'
import { AUCUNE_PLAQUE, nomDeLaPlaque, plaqueAvecSonCamp, plaquePortee, plaquesOuvertes } from '../../../shared/plaques'
import { theme } from '../../../shared/themes'
import { bordurePortee } from '../../../shared/duels'
import { cibleEclat } from '../../../shared/legendaires'
import { eclatChez, sceauVisible, type PublicProfileDetail } from '../../../shared/profil'
import { ceQueDitLaVignette, classesDeLaVignette, type EtatDUneVignette } from './LigneDeCollection'
import type { PropsDUnePiece } from './choix'

// Son podium — « la plaque » dans le code, la colonne et l'API —, là où il se
// choisit et là où il se vend : dans la pièce « Thème » de la loge
// (`MaPlaque`, derrière l'onglet « Mon podium »), et sur la fiche d'un thème à
// la boutique (`ApercuDuPodium`). Il s'appelait « Ma plaque » à l'écran
// jusqu'au 24 novembre 2026 : « la plaque n'est pas représentative de ce que
// ça donne vraiment, un skin de podium » (le propriétaire) — ce qu'elle
// montre aux autres, c'est d'abord sa marche peinte, quand il monte sur un
// podium ; et son écrin dans chaque liste. L'aperçu montre les deux : on
// choisit ce qu'on voit, pas un nom dans une liste.

type SaLigne = Pick<PublicProfileDetail, 'name' | 'laurier' | 'avatar' | 'finition' | 'legendaire' | 'eclats' | 'eclatsEteints' | 'matieres' | 'matieresPortees' | 'scelles' | 'sceauMasque' | 'bordureChoisie' | 'bordures'>

/** Son avatar tel qu'il le porte, à la classe des classements (`lb-avatar`) : sur sa ligne comme sur sa marche. */
function SonAvatar({ profil }: { profil: SaLigne }) {
  return (
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
  )
}

/** Ce que sa ligne montre : son avatar, tel qu'il le porte, dans l'écrin de la plaque — sans plaque, la place vide —, et son prénom. */
function SonNom({ profil, plaque }: { profil: SaLigne; plaque: string | null }) {
  return (
    <>
      <Ecrin plaque={plaque}>
        <SonAvatar profil={profil} />
      </Ecrin>
      <span className="lb-name">
        <NomLaure nom={profil.name} laurier={profil.laurier} />
      </span>
    </>
  )
}

/**
 * Ce que les autres voient de son podium, à regarder seulement : lui debout
 * sur la première marche, peinte au thème de la plaque — la vraie pièce des
 * classements (`PodiumDuClassement`), pas une image d'elle : une marche qui
 * change change ici aussi —, et à côté, sa ligne des listes, son avatar dans
 * l'écrin. Sans plaque (`null`), la marche de la maison, le Velours, et
 * l'écrin vide : ce que tous ont. La loge le montre au-dessus de ses choix
 * (ce qu'il essaie), la fiche d'un thème à la boutique avec la plaque de ce
 * thème. Il ne disait que la ligne jusqu'au 24 novembre 2026 : « j'aimerais
 * pouvoir avoir une visualisation de ce que donne la plaque, que ce soit dans
 * habiller mais aussi dans la boutique quand on essaye » (le propriétaire) —
 * la marche, la pièce qui se voit le plus, ne se découvrait qu'au classement.
 *
 * Ni prénom ni score sur la marche : sa ligne, à côté, dit son prénom, et ce
 * n'est pas un classement. Sa légende (`legende`, la boutique) se pose dans la
 * colonne de sa ligne, au-dessus d'elle, sur une ligne : sur sa propre rangée,
 * « Son podium · les autres te verront ainsi » en deux lignes, elle faisait
 * défiler le présentoir d'un thème de 57 px en 360 × 640. Le role `img` la
 * tait à l'oreille : son nom dit tout.
 */
export function ApercuDuPodium({ profil, plaque, legende }: { profil: SaLigne; plaque: string | null; legende?: ReactNode }) {
  const nom = plaque ? `Ton podium ${nomDeLaPlaque(plaque)}` : 'Ton podium classique'
  return (
    <div className="podium-apercu" role="img" aria-label={`${nom}, tel que les autres le verront : ta marche quand tu montes sur un podium, et ta ligne dans les classements`}>
      <PodiumDuClassement
        marches={[{ profileId: 'apercu', rang: 1, plaque, label: profil.name, visage: <SonAvatar profil={profil} />, nom: <NomLaure nom={profil.name} laurier={profil.laurier} />, valeur: null }]}
      />
      <div className="podium-apercu-cote">
        {legende && <span className="label podium-apercu-legende">{legende}</span>}
        <div className="lb-row plaque-apercu">
          <SonNom profil={profil} plaque={plaque} />
        </div>
      </div>
    </div>
  )
}

/**
 * Les plaques de la loge, d'une seule lecture : ce qu'il a choisi, ce que la
 * page montre (l'essai, sinon son choix), et chaque choix avec la plaque
 * qu'il ferait voir. « Comme mon thème » suit le thème que la page porte :
 * celui qu'il essaie, sinon le sien. « Classique », c'est `aucune` : la
 * marche de la maison, que tous ont sans plaque — « Aucune » se disait d'une
 * plaque, et l'aperçu montre bien une marche. L'onglet « Mon podium » en
 * montre l'échantillon, son panneau la liste : les deux lisent la même règle.
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
    { cle: AUCUNE_PLAQUE, nom: 'Classique', vue: null },
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
 * « Mon podium », le second onglet de la pièce « Thème » : l'aperçu une
 * seule fois — sa marche et sa ligne de classement, sous la plaque que la
 * page montre (`ApercuDuPodium`) —, puis chaque choix en vignette, une petite
 * plaque qui porte son nom à son encre, et son emblème — son
 * prénom, l'aperçu au-dessus le montre déjà ; son nom sous elle prenait une
 * ligne de plus, deux pour « Comme mon thème » — : « Comme mon thème »,
 * d'office, « Classique », puis la
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
      <ApercuDuPodium profil={profil} plaque={vue} />
      <ul className="loge-vignettes loge-plaques" aria-label="Mes podiums">
        {choix.map(c => {
          // La plaque d'un thème neuf est neuve avec lui : le rouge mène jusqu'à elle.
          const etat: EtatDUneVignette = { montre: montree === c.cle, porte: portee === c.cle, neuve: !!neufs?.has(c.cle) }
          return (
            <li key={c.cle}>
              <button
                type="button"
                className={'loge-vignette' + classesDeLaVignette(etat)}
                aria-pressed={etat.montre}
                aria-label={`Podium ${c.nom}` + ceQueDitLaVignette(etat, 'porté', 'nouveau')}
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
