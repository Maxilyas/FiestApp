import { Icon } from '../../../components/Icon'
import { espacesFines } from '../../../format'
import { questionSizeClass } from '../../../games/quiz/questionSize'
import { toucher } from '../../../toucher'
import type { Point } from '../../../../../shared/cabinet/france'
import { pointADistance, type EpingleMontree, type EpingleRevelee, type ZoneDEclairer } from '../../../../../shared/cabinet/jeux/epingle'
import { CarteDeFrance, DessinDeLEpingle, DessinDeLaZone, DessinDuLieu, DessinDuTrait, IconeDeLEpingle, IconeDuLieu } from '../CarteDeFrance'
import { ouEstLEpingle } from '../contourDeLaFrance'
import type { JeuALEcran, PropsDUneManche } from '../Partie'

// L'Épingle à l'écran (§ 3.1) : un récit daté, une question « Où ? », et la
// carte de France — la métropole et la Corse — où il plante son épingle au
// doigt. La page ne connaît du lieu ni les coordonnées, ni la commune, ni le
// département avant la révélation (invariant 1) : elle dessine la carte, tient
// l'épingle, et le serveur la juge à sa distance du lieu.
//
// La carte prend toute la largeur. « Planter ici » colle au bas de l'écran,
// sous le pouce (`JeuALEcran.Pied`), et attend une épingle ; au-dessus de lui,
// une ligne dit où elle est, par la ville repère la plus proche (« près de
// Lyon ») — sous le doigt qui la plante, l'épingle ne se voit pas, et un
// lecteur d'écran ne lit pas un dessin. Touchée ailleurs, la carte la déplace.
// Rien au-dessus de la carte ne change de hauteur d'une épingle à l'autre, ni à
// Éclairer : la consigne garde ses deux lignes — l'indice de la zone y prend sa
// place —, et ce qui varie vit dans le pied ; sans quoi la carte glissait sous
// le doigt qui voulait corriger. Au clavier, les flèches la mènent et Entrée la
// plante.
//
// Ce que la page tient — l'épingle posée — part d'elle-même à l'échéance ; sans
// épingle, rien ne part, et la manche se juge « Pas d'épingle ». Recharger la
// perd : rien de cela ne disait la réponse (§ 2.8).

/** Ce que la page tient d'une manche de l'Épingle : l'épingle posée, pas encore plantée. */
export interface LocalDeLEpingle {
  readonly epingle: Point | null
}

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
 * qu'il y fait, puis, Éclairer joué, ce que dit la zone. Ajoutée au-dessus de la
 * carte, la ligne de la zone la poussait de soixante pixels sous le doigt qui
 * venait d'Éclairer et allait la toucher.
 */
function Consigne({ m, epingle }: { m: EpingleMontree; epingle: Point | null }) {
  if (m.zone) {
    return (
      <p className="cab-ligne cab-consigne-carte cab-souffle">
        <Icon name="bulb" />
        {espacesFines('Indice : c’est quelque part dans la zone entourée.')}
      </p>
    )
  }
  return <p className="cab-ligne cab-consigne-carte">{espacesFines(epingle ? 'Touche ailleurs pour déplacer ton épingle.' : 'Touche la carte de France pour planter ton épingle.')}</p>
}

function MancheDeLEpingle({ montree: m, local, setLocal, envoyer, gardeDeLEcran, busy }: PropsDUneManche<EpingleMontree, LocalDeLEpingle>) {
  // Posée dans la demi-seconde d'un écran neuf, l'épingle visait la manche d'avant : le second toucher d'un double sur « Manche
  // suivante » tombe sur la carte.
  const poser = (p: Point) => !busy && gardeDeLEcran() && setLocal({ epingle: p })
  const planter = () => !busy && local.epingle && envoyer({ quoi: 'repondre', reponse: { epingle: local.epingle } })
  return (
    <>
      <div className="cab-tete-question">
        <span className="cab-surtitre">{espacesFines(`${m.date} · ${m.theme}`)}</span>
      </div>
      <p className="cab-ligne cab-recit">{espacesFines(m.recit)}</p>
      <h2 className={'quiz-question cab-question' + questionSizeClass(m.question)}>{espacesFines(m.question)}</h2>
      <Consigne m={m} epingle={local.epingle} />
      <CarteDeFrance
        nom="La carte de France"
        jouable={{ epingle: local.epingle, poser, planter, aide: 'Touche-la pour planter ton épingle. Au clavier, les flèches la mènent, Maj à grands pas, et Entrée la plante.' }}
      >
        {m.zone && <DessinDeLaZone tour={tourDeLaZone(m.zone)} />}
        {local.epingle && <DessinDeLEpingle point={local.epingle} />}
      </CarteDeFrance>
    </>
  )
}

/**
 * Le pied collé : où est l'épingle — dit à l'oreille à chaque épingle posée,
 * un toucher ou un pas de flèche ; vide tant qu'il n'y en a pas, la consigne
 * le dit au-dessus de la carte —, et « Planter ici », sous le pouce. Il attend
 * une épingle (`aria-disabled` : le focus y reste), et sa demi-seconde de
 * garde à chaque vue neuve : touché deux fois, il ne plante pas à la manche
 * suivante.
 */
function PlanterIci({ local, envoyer, garde, busy }: PropsDUneManche<EpingleMontree, LocalDeLEpingle>) {
  const epingle = local.epingle
  return (
    <>
      <p className="cab-ou-est" aria-live="polite">
        {epingle && (
          <>
            <IconeDeLEpingle />
            <span className="sr-only">Ton épingle : </span>
            {espacesFines(ouEstLEpingle(epingle))}
          </>
        )}
      </p>
      <button
        type="button"
        className="btn btn-primary btn-big btn-block cab-planter"
        aria-disabled={!epingle || busy || undefined}
        {...toucher(() => epingle && !busy && garde() && envoyer({ quoi: 'repondre', reponse: { epingle } }))}
      >
        Planter ici
      </button>
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
  localDe: () => ({ epingle: null }),
  // Le lieu de la manche : « Changer » en pose un autre, et l'épingle d'avant ne lui dit rien. La zone d'Éclairer n'y change rien.
  cleDe: m => `${m.date}|${m.question}`,
  aLEcheance: (_m, l) => (l.epingle ? { epingle: l.epingle } : undefined),
  // Pas de `sousEcranDe` : une épingle posée ne bouge rien sous le doigt — la carte garde sa place, « Planter ici » aussi.
  Manche: MancheDeLEpingle,
  Pied: PlanterIci,
  Revelation: RevelationDeLEpingle,
}
