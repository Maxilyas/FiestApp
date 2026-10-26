import { useId } from 'react'
import { Icon, type IconName } from '../../../components/Icon'
import { espacesFines } from '../../../format'
import { questionSizeClass } from '../../../games/quiz/questionSize'
import { toucher } from '../../../toucher'
import type { Point } from '../../../../../shared/cabinet/france'
import { pointADistance, type EpingleMontree, type EpingleRevelee, type ZoneDEclairer } from '../../../../../shared/cabinet/jeux/epingle'
import { CarteDeFrance, DessinDeLEpingle, DessinDeLaZone, DessinDuLieu, DessinDuTrait, IconeDeLEpingle, IconeDuLieu } from '../CarteDeFrance'
import { GRAND_PAS, MILIEU_DE_LA_FRANCE, deplacer, ouEstLEpingle, type Fleche } from '../contourDeLaFrance'
import type { JeuALEcran, PropsDUneManche } from '../Partie'

// L'Épingle à l'écran (§ 3.1) : un récit daté, une question « Où ? », et la
// carte de France — la métropole et la Corse — où il plante son épingle au
// doigt. La page ne connaît du lieu ni les coordonnées, ni la commune, ni le
// département avant la révélation (invariant 1) : elle dessine la carte, tient
// l'épingle, et le serveur la juge à sa distance du lieu.
//
// La question se colle sous la tête de la partie, et la carte se borne à ce qui
// reste entre elle et le pied (`styles.css`) : au petit téléphone, texte
// agrandi, elles ne tenaient jamais ensemble, et Jeanne oubliait la question en
// allant chercher la carte (la tablée du 25 octobre 2026). Au-dessus de la
// carte, la consigne dit où est l'épingle dès qu'elle est posée, par la ville
// repère la plus proche (« Près de Lyon ») — sous le doigt qui la plante,
// l'épingle ne se voit pas, et un lecteur d'écran ne lit pas un dessin. Elle
// garde ses deux lignes quoi qu'elle dise — l'indice d'Éclairer y prend sa
// place aussi — : rien au-dessus de la carte ne change de hauteur sous le doigt
// qui voulait corriger. Touchée ailleurs, la carte déplace l'épingle.
//
// Le pied, sous le pouce (`JeuALEcran.Pied`) : « Pas à pas », qui ouvre au-dessus
// de lui les quatre pas de l'épingle et la bascule des grands pas — au doigt, ce
// que font les flèches au clavier : sous TalkBack, un double toucher plantait au
// centre de la carte —, et « Planter ici », qui attend une épingle. Au clavier,
// les flèches la mènent et Entrée la plante.
//
// Ce que la page tient — l'épingle posée — part d'elle-même à l'échéance ; sans
// épingle, rien ne part, et la manche se juge « Pas d'épingle ». Recharger la
// perd : rien de cela ne disait la réponse (§ 2.8).

/** Ce que la page tient d'une manche de l'Épingle : l'épingle posée, pas encore plantée, et ses boutons de direction. */
export interface LocalDeLEpingle {
  readonly epingle: Point | null
  /** Les boutons de direction à grands pas (`GRAND_PAS` petits), comme Maj au clavier. */
  readonly grands: boolean
  /** Les boutons de direction ouverts, par « Pas à pas ». */
  readonly pasAPas: boolean
}

/**
 * Un pas d'un bouton de direction : l'épingle menée comme par sa flèche au
 * clavier — la même règle, `deplacer` —, du milieu de la France s'il n'y en a
 * pas encore. Hugo, au lecteur d'écran, ne pouvait pas la placer : un double
 * toucher la plantait au centre de la carte (la tablée du 25 octobre 2026).
 */
export function pasDeLEpingle(l: LocalDeLEpingle, fleche: Fleche): LocalDeLEpingle {
  return { ...l, epingle: deplacer(l.epingle ?? MILIEU_DE_LA_FRANCE, fleche, l.grands) }
}

/** Les quatre pas, dans l'ordre des flèches d'un clavier : ← ↑ ↓ →. */
const LES_PAS: readonly { fleche: Fleche; nom: string; icone: IconName }[] = [
  { fleche: 'ArrowLeft', nom: 'Vers l’ouest', icone: 'arrow-left' },
  { fleche: 'ArrowUp', nom: 'Vers le nord', icone: 'arrow-up' },
  { fleche: 'ArrowDown', nom: 'Vers le sud', icone: 'arrow-down' },
  { fleche: 'ArrowRight', nom: 'Vers l’est', icone: 'arrow-right' },
]

/**
 * Le tour de la zone qu'Éclairer entoure, un point tous les quinze degrés,
 * pris sur la Terre (`pointADistance`, la règle même qui l'a tirée) : un rond
 * dessiné à plat, le rayon compté en degrés, se serait aplati au nord, et la
 * zone dessinée aurait pu laisser dehors le lieu que la vraie contient.
 */
export function tourDeLaZone(z: ZoneDEclairer): Point[] {
  return Array.from({ length: 24 }, (_, i) => pointADistance(z, z.rayonKm, i * 15))
}

/**
 * La ligne au-dessus de la carte, deux lignes gardées quoi qu'elle dise : ce
 * qu'il y fait ; Éclairer joué, ce que dit la zone ; l'épingle posée, où elle
 * est. Ajoutée au-dessus de la carte, la ligne de la zone la poussait de
 * soixante pixels sous le doigt qui venait d'Éclairer et allait la toucher ;
 * au pied, où est l'épingle le faisait monter sur la carte, et prenait la place
 * qui manquait pour voir la question et la carte ensemble. Une région qui se
 * dit (`aria-live`), le même élément d'un état à l'autre : chaque épingle
 * posée — d'un toucher, d'une flèche, d'un pas — s'entend.
 */
function Consigne({ m, epingle }: { m: EpingleMontree; epingle: Point | null }) {
  if (epingle) {
    return (
      <p className="cab-ligne cab-consigne-carte cab-ou-est" aria-live="polite">
        <IconeDeLEpingle />
        <span className="sr-only">Ton épingle : </span>
        {espacesFines(ouEstLEpingle(epingle))}
      </p>
    )
  }
  if (m.zone) {
    return (
      <p className="cab-ligne cab-consigne-carte cab-souffle" aria-live="polite">
        <Icon name="bulb" />
        {espacesFines('Indice : c’est quelque part dans la zone entourée.')}
      </p>
    )
  }
  return (
    <p className="cab-ligne cab-consigne-carte" aria-live="polite">
      {espacesFines('Touche la carte de France pour planter ton épingle.')}
    </p>
  )
}

function MancheDeLEpingle({ montree: m, local, setLocal, envoyer, gardeDeLEcran, busy }: PropsDUneManche<EpingleMontree, LocalDeLEpingle>) {
  // Posée dans la demi-seconde d'un écran neuf, l'épingle visait la manche d'avant : le second toucher d'un double sur « Manche
  // suivante » tombe sur la carte.
  const poser = (p: Point) => !busy && gardeDeLEcran() && setLocal({ ...local, epingle: p })
  const planter = () => !busy && local.epingle && envoyer({ quoi: 'repondre', reponse: { epingle: local.epingle } })
  // Revenu sur la carte, le lecteur d'écran entend la consigne, ce qui la mène sans clavier — fermé, « Pas à pas » ne se devine
  // pas —, puis où est l'épingle : la ligne au-dessus l'a dite en la posant, une fois.
  const aide = espacesFines(
    `Touche-la pour planter ton épingle. Au clavier, les flèches la mènent, Maj à grands pas, et Entrée la plante. Sans clavier, « Pas à pas », au bas de l’écran, ouvre les boutons qui la mènent.${local.epingle ? ` Ton épingle : ${ouEstLEpingle(local.epingle)}.` : ''}`,
  )
  return (
    <>
      <div className="cab-tete-question">
        <span className="cab-surtitre">{espacesFines(`${m.date} · ${m.theme}`)}</span>
      </div>
      <p className="cab-ligne cab-recit">{espacesFines(m.recit)}</p>
      <h2 className={'quiz-question cab-question' + questionSizeClass(m.question)}>{espacesFines(m.question)}</h2>
      <Consigne m={m} epingle={local.epingle} />
      <CarteDeFrance nom="La carte de France" jouable={{ epingle: local.epingle, poser, planter, aide }}>
        {m.zone && <DessinDeLaZone tour={tourDeLaZone(m.zone)} />}
        {local.epingle && <DessinDeLEpingle point={local.epingle} />}
      </CarteDeFrance>
    </>
  )
}

/**
 * Le pied collé : « Pas à pas » et « Planter ici », sous le pouce, sur une
 * ligne ; ouverts, les quatre pas de l'épingle et la bascule des grands pas,
 * une rangée de cinq carrés de 44 px au-dessus d'eux — le pied grandit vers le
 * haut, et « Pas à pas » reste sous le doigt qui l'a touché. Fermés d'office :
 * ouverts, avec la carte-bonus qui sert encore, ils prenaient en 277 × 492 la
 * place qu'il fallait pour voir la question et la carte ensemble. Un pas se
 * joue vite, comme un cran du Filet : deux touchers en font deux ; seul un
 * écran neuf le retient une demi-seconde, comme la carte (`gardeDeLEcran`).
 * « Planter ici » attend une épingle (`aria-disabled` : le focus y reste), et
 * sa demi-seconde de garde à chaque vue neuve : touché deux fois, il ne plante
 * pas à la manche suivante. Où est l'épingle se dit au-dessus de la carte
 * (`Consigne`) : ici, sa ligne prenait la place qui manquait à la carte.
 */
function PlanterIci({ local, setLocal, envoyer, garde, gardeDeLEcran, busy }: PropsDUneManche<EpingleMontree, LocalDeLEpingle>) {
  const rangee = useId()
  const epingle = local.epingle
  const unPas = (fleche: Fleche) => !busy && gardeDeLEcran() && setLocal(pasDeLEpingle(local, fleche))
  return (
    <>
      {local.pasAPas && (
        <div id={rangee} className="cab-pas-de-l-epingle" role="group" aria-label="Mener l’épingle pas à pas">
          {LES_PAS.map(p => (
            <button key={p.fleche} type="button" className="cab-pas" aria-label={p.nom} aria-disabled={busy || undefined} {...toucher(() => unPas(p.fleche))}>
              <Icon name={p.icone} />
            </button>
          ))}
          {/* Un nom fixe, l'état par `aria-pressed` ; à l'œil, ce que vaut un grand pas. */}
          <button type="button" className="cab-pas cab-pas-grands" aria-label="Grands pas" aria-pressed={!!local.grands} {...toucher(() => !busy && setLocal({ ...local, grands: !local.grands }))}>
            <span aria-hidden="true">{`×${GRAND_PAS}`}</span>
          </button>
        </div>
      )}
      <div className="cab-planter-ici">
        <button
          type="button"
          className="btn cab-pas-a-pas"
          aria-expanded={!!local.pasAPas}
          aria-controls={local.pasAPas ? rangee : undefined}
          {...toucher(() => !busy && setLocal({ ...local, pasAPas: !local.pasAPas }))}
        >
          Pas à pas
        </button>
        <button
          type="button"
          className="btn btn-primary btn-big cab-planter"
          aria-disabled={!epingle || busy || undefined}
          {...toucher(() => epingle && !busy && garde() && envoyer({ quoi: 'repondre', reponse: { epingle } }))}
        >
          Planter ici
        </button>
      </div>
    </>
  )
}

/**
 * La révélation : le lieu nommé, sa commune et son département, sa date ; la
 * carte avec le lieu, l'épingle et le trait qui les joint — la distance est au
 * titre (« À 37 km ») —, la zone d'Éclairer s'il l'avait ; et ce que chaque
 * marque est, en mots. Sans épingle, le lieu seul.
 */
function RevelationDeLEpingle({ corps: r }: { corps: EpingleRevelee }) {
  const l = r.lieu
  return (
    <section className="cab-lieu-revele" aria-label="Le lieu">
      <p className="cab-lieu-nom">{espacesFines(l.nom)}</p>
      <p className="cab-ligne cab-lieu-ou">{espacesFines(`${l.commune} (${l.departement}) · ${l.date}`)}</p>
      <CarteDeFrance nom={r.epingle ? 'Le lieu et ton épingle, sur la carte de France' : 'Le lieu, sur la carte de France'}>
        {r.zone && <DessinDeLaZone tour={tourDeLaZone(r.zone)} />}
        {r.epingle && <DessinDuTrait de={r.epingle} a={l} />}
        {r.epingle && <DessinDeLEpingle point={r.epingle} />}
        {/* Le lieu par-dessus l'épingle : c'est la réponse, et plantée tout près, la pointe le cachait. */}
        <DessinDuLieu point={l} />
      </CarteDeFrance>
      <ul className="cab-legende-carte" aria-hidden="true">
        <li>
          <IconeDuLieu />
          le lieu
        </li>
        {r.epingle && (
          <li>
            <IconeDeLEpingle />
            ton épingle
          </li>
        )}
        {r.zone && (
          <li>
            <span className="cab-legende-zone" />
            la zone d’Éclairer
          </li>
        )}
      </ul>
    </section>
  )
}

export const EPINGLE: JeuALEcran<EpingleMontree, EpingleRevelee, LocalDeLEpingle> = {
  localDe: () => ({ epingle: null, grands: false, pasAPas: false }),
  // Le lieu de la manche : « Changer » en pose un autre, et l'épingle d'avant ne lui dit rien. La zone d'Éclairer n'y change rien.
  cleDe: m => `${m.date}|${m.question}`,
  aLEcheance: (_m, l) => (l.epingle ? { epingle: l.epingle } : undefined),
  // Pas de `sousEcranDe` : une épingle posée ne bouge rien sous le doigt — la carte garde sa place, « Planter ici » aussi.
  Manche: MancheDeLEpingle,
  Pied: PlanterIci,
  Revelation: RevelationDeLEpingle,
}
