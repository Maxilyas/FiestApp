import { Corrige } from '../../../components/Corrige'
import { Icon } from '../../../components/Icon'
import { espacesFines } from '../../../format'
import { questionSizeClass } from '../../../games/quiz/questionSize'
import { toucher } from '../../../toucher'
import type { EclairMontre, EclairRevele } from '../../../../../shared/cabinet/jeux/eclair'
import type { JeuALEcran, PropsDUneManche } from '../Partie'

// L'Éclair à l'écran (§ 3.7) : cinq affirmations d'une même catégorie, vraies
// ou fausses, sous un seul chrono. Elles arrivent ensemble ; la page les
// montre une à une, tient les réponses, et les envoie ensemble — à la
// cinquième, ou d'elle-même à l'échéance, avec celles qu'il a eu le temps de
// dire. Elle ne compte jamais les justes en route : le compte aurait trahi
// chaque vérité (invariant 1) ; ses points disent celles qui sont dites, pas
// ce qu'elles valent.
//
// Ce que la page tient, le serveur l'ignore jusqu'à l'envoi : recharger le
// perd — rien de cela ne disait la réponse (§ 2.8) —, et « Changer », qui
// vient avant de répondre, se grise dès la première réponse dite sur place.

/** Ce que la page tient d'une manche de l'Éclair : ses réponses dans l'ordre des affirmations, et celle qu'il a sous les yeux. */
export interface LocalDeLEclair {
  reponses: readonly (boolean | null)[]
  ici: number
}

function MancheDeLEclair({ montree: m, local, setLocal, envoyer, garde, busy }: PropsDUneManche<EclairMontre, LocalDeLEclair>) {
  const n = m.affirmations.length
  const ici = Math.max(0, Math.min(local.ici, n - 1))
  const a = m.affirmations[ici]
  const soufflee = m.soufflees.find(s => s.affirmation === ici)
  const repondre = (vraie: boolean) => {
    if (busy || !garde()) return
    const reponses = local.reponses.map((r, i) => (i === ici ? vraie : r))
    const suivante = reponses.findIndex(r => r === null)
    setLocal({ reponses, ici: suivante < 0 ? ici : suivante })
    if (suivante < 0) envoyer({ quoi: 'repondre', reponse: { eclair: { reponses } } })
  }
  if (!a) return null
  return (
    <>
      <div className="cab-tete-question">
        <span className="cab-surtitre">{`Affirmation ${ici + 1} sur ${n}`}</span>
        {m.categorie && <span className="label quiz-categorie">{m.categorie}</span>}
      </div>
      {/* Celles qui sont dites, sans dire si elles sont justes. */}
      <ol className="cab-cinq" aria-hidden="true">
        {m.affirmations.map((_, i) => (
          <li key={i} className={i === ici ? 'cab-ici' : local.reponses[i] !== null ? 'cab-dite' : undefined} />
        ))}
      </ol>
      <h2 className={'quiz-question cab-question' + questionSizeClass(a.texte)}>{espacesFines(a.texte)}</h2>
      <p className="cab-proposee">{espacesFines(`« ${a.proposee} »`)}</p>
      {soufflee && (
        <p className="cab-souffle">
          <Icon name="bulb" />
          {soufflee.vraie ? 'Indice : c’est vrai.' : 'Indice : c’est faux.'}
        </p>
      )}
      <div className="cab-vrai-faux">
        <button type="button" className="ans-btn cab-faux" aria-disabled={busy || undefined} {...toucher(() => repondre(false))}>
          <Icon name="x" />
          <span className="ans-text">Faux</span>
        </button>
        <button type="button" className="ans-btn cab-vrai" aria-disabled={busy || undefined} {...toucher(() => repondre(true))}>
          <Icon name="check" />
          <span className="ans-text">Vrai</span>
        </button>
      </div>
    </>
  )
}

/** La révélation : chacune vraie, ou fausse et la réponse qu'elle cachait ; ce qu'il avait dit, ou rien. */
function RevelationDeLEclair({ corps }: { corps: EclairRevele }) {
  return (
    <>
      <ol className="campagne-correction cab-corrige">
        {corps.affirmations.map((a, i) => (
          <Corrige
            key={i}
            verdict={a.reponse === null ? 'Sans réponse' : a.juste ? 'Juste' : 'Faux'}
            tete={`Affirmation ${i + 1}`}
            texte={`${a.texte} « ${a.proposee} »`}
            reponses={[]}
            bonne={0}
            choix={null}
            formes={false}
            corps={
              <p className="corrige-vraie">
                <b>{a.vraie ? 'Vrai' : `Faux, c’était ${a.bonne}`}</b>
                {a.reponse === null ? ' · pas répondu' : ` · tu as dit ${a.reponse ? 'vrai' : 'faux'}`}
              </p>
            }
          />
        ))}
      </ol>
      {/* Cinq questions récrites en une pièce hors de la base : aucune n'est celle qu'on revoit au carnet (§ 0.2, question 7). */}
      <p className="cab-ligne cab-hors-carnet">Les affirmations ne vont pas au carnet.</p>
    </>
  )
}

export const ECLAIR: JeuALEcran<EclairMontre, EclairRevele, LocalDeLEclair> = {
  localDe: m => ({ reponses: m.affirmations.map(() => null), ici: 0 }),
  cleDe: m => m.affirmations.map(a => `${a.texte}|${a.proposee}`).join('·'),
  aLEcheance: (_m, l) => ({ eclair: { reponses: [...l.reponses] } }),
  cibleDEclairer: (_m, l) => l.ici,
  aJoueSurPlace: (_m, l) => l.reponses.some(r => r !== null),
  // L'affirmation sous les yeux change sous les mêmes « Faux » et « Vrai » : le cadre y relance la demi-seconde de garde.
  sousEcranDe: (_m, l) => String(l.ici),
  Manche: MancheDeLEclair,
  Revelation: RevelationDeLEclair,
}
