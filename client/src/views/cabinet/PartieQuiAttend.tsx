import { Icon } from '../../components/Icon'
import { GrosBouton } from '../../components/Pieces'
import { espacesFines } from '../../format'
import { toucher } from '../../toucher'
import { JEUX, type CleDeJeu } from '../../../../shared/cabinet/jeux/regle'
import { laPartieAttend } from '../../../../shared/cabinet/musee'
import type { PageDuCabinet } from '../../../../shared/cabinet/vues'

// La partie qui attend, et de quoi la reprendre, partout où elle éteint un
// départ. Une seule partie à la fois : tant qu'elle n'est pas finie, rien ne
// part ni ne se dépense (`cadreDuDepart`, `refusDeLAchat`). Seul le musée la
// reprenait (« Reprends-la où tu l'as laissée ») : rechargée en pleine manche
// depuis la visite, Ophélie retombait sur « 1 sur 3 faite », une case sans
// bouton et « Ta partie au Pari t'attend » en texte nu, et l'a crue perdue
// pendant que son chrono courait (la tablée du 25 octobre 2026). Le refus se
// dit dans les mots du serveur, importés, et « Reprendre » la rouvre telle que
// la page la tient — son chrono, lui, ne s'est jamais arrêté.

/**
 * « Reprendre » : au lever du doigt (`toucher`), comme chaque geste qui change
 * l'écran au Cabinet — la manche paraît sous le doigt, et le `click` qui suit
 * n'y joue rien. Une case de la visite en cours le porte elle-même.
 */
export function BoutonReprendre({ classe = 'btn btn-primary btn-block', onReprendre }: { classe?: string; onReprendre: () => void }) {
  return (
    <button type="button" className={`${classe} cab-reprendre`} {...toucher(onReprendre)}>
      <Icon name="play" />
      Reprendre
    </button>
  )
}

/**
 * La raison d'un départ éteint par la partie qui attend, au-dessus de ce
 * qu'elle éteint (`enTete` : les cases de la visite, les neuf jeux) ou sous le
 * dernier geste (une œuvre, l'annonce), et « Reprendre » dessous — sauf quand
 * le geste est déjà là, sur la case qu'elle joue (`onReprendre` absent) : un
 * seul « Reprendre » par écran. `id` : ce que chaque bouton éteint désigne à
 * l'oreille. Rien n'attend : rien.
 */
export function PartieQuiAttend({ page, id, enTete = false, onReprendre }: { page: Pick<PageDuCabinet, 'enCours'>; id?: string; enTete?: boolean; onReprendre?: () => void }) {
  const enCours = page.enCours
  if (!enCours) return null
  return (
    <>
      <p id={id} className={enTete ? 'cab-raison cab-raison-en-tete' : 'cab-raison'}>
        {espacesFines(laPartieAttend(enCours.jeu))}
      </p>
      {onReprendre && <BoutonReprendre onReprendre={onReprendre} />}
    </>
  )
}

/** Au musée, la partie qui attend passe devant tout : un gros bouton, le geste du moment. */
export function TaPartieTAttend({ jeu, onReprendre }: { jeu: CleDeJeu; onReprendre: () => void }) {
  return (
    <GrosBouton principal icone={<Icon name="play" />} titre={espacesFines(`Ta partie ${JEUX[jeu].a} t’attend`)} detail="Reprends-la où tu l’as laissée" onClick={onReprendre} />
  )
}
