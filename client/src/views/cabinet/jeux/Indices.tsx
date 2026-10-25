import { useEffect, useId, useRef, type FormEvent, type RefObject } from 'react'
import { Etoiles } from '../../../components/Etoiles'
import { espacesFines } from '../../../format'
import { toucher } from '../../../toucher'
import { SIGNES_D_UN_GESTE_MAX } from '../../../../../shared/cabinet/bareme'
import { QUESTION_DES_INDICES, type IndicesMontres, type IndicesReveles } from '../../../../../shared/cabinet/jeux/indices'
import type { JeuALEcran, PropsDUneManche } from '../Partie'

// Les Indices à l'écran (§ 3.8) : « Qui suis-je ? », cinq indices du plus
// obscur au plus évident, le premier d'office ; un de plus à la demande, qui
// coûte, et la réponse tapée — un nom, jugé au serveur, qui seul connaît la
// fiche (invariant 1) : la page ne sait ni la réponse, ni ses clés, ni les
// indices encore cachés.
//
// Le champ et ses deux gestes collent au bas de l'écran (`JeuALEcran.Pied`),
// dans un `.join`, que `installerClavier` (`client/src/clavier.ts`) garde
// au-dessus du clavier du téléphone avec « Répondre » ; il ne prend jamais le
// focus d'office : le clavier levé cacherait les indices qu'on vient de lire. Ce que vaut
// une bonne réponse, la vue le dit (`vaut`) : un nom faux montre un indice de
// plus et compte une erreur, mais ne coûte pas toujours une étoile — au
// premier indice, trois au compte valent encore les trois —, et la page ne
// promet aucune perte que la vue ne dise (le barème du 25 octobre 2026).
//
// La page ne tient que le nom en train de s'écrire : il repart de zéro à
// chaque nom refusé par la manche — il rejoint « Déjà essayé » —, et ne part
// pas à l'échéance : un nom tapé et pas envoyé ne compte pas.

/** Ce que la page tient d'une manche des Indices : le nom qui s'écrit. */
export interface LocalDesIndices {
  readonly texte: string
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

/** « 3 indices sous tes yeux, dont 1 offert · encore 2 cachés » : ce qu'il voit, ce qu'Éclairer a donné, ce qui reste. */
export function ceQuIlVoit(m: Pick<IndicesMontres, 'indices' | 'offerts' | 'caches'>): string {
  const offerts = m.offerts ? `, dont ${pluriel(m.offerts, 'offert')}` : ''
  const caches = m.caches > 0 ? ` · encore ${pluriel(m.caches, 'caché')}` : ' · tous les indices sont là'
  return `${pluriel(m.indices.length, 'indice')} sous tes yeux${offerts}${caches}`
}

/**
 * Les indices, l'un sous l'autre, chacun son rang dans une pastille — en
 * surtitre sur sa ligne, il coûtait une ligne à chacun, et le cinquième
 * passait sous le pied. Le dernier venu, d'un liseré : celui qu'on n'a pas
 * encore lu.
 */
function LesIndices({ indices, dernier }: { indices: readonly string[]; dernier?: RefObject<HTMLLIElement | null> }) {
  return (
    <ol className="cab-indices" aria-label="Les indices">
      {indices.map((indice, i) => (
        <li key={i} ref={dernier && i === indices.length - 1 ? dernier : undefined} className={dernier && i > 0 && i === indices.length - 1 ? 'cab-indice cab-indice-neuf' : 'cab-indice'}>
          <b className="cab-indice-rang" aria-hidden="true">
            {i + 1}
          </b>
          <span>
            <span className="sr-only">{`Indice ${i + 1} : `}</span>
            {espacesFines(indice)}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Le défilement doux, sauf à qui demande moins de mouvement — sous try/catch, comme tout ce que le navigateur peut refuser. */
const doucement = (): ScrollBehavior => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  } catch {
    return 'auto'
  }
}

function MancheDesIndices({ montree: m }: PropsDUneManche<IndicesMontres, LocalDesIndices>) {
  const dernier = useRef<HTMLLIElement>(null)
  // Un indice de plus — demandé, offert, ou montré par un nom faux — arrive au bout de la liste, que le pied collé couvre : il
  // revient au milieu de l'écran, une image plus tard (le cadre remet un écran neuf en haut après les effets de ses enfants).
  useEffect(() => {
    if (m.indices.length < 2) return
    const id = requestAnimationFrame(() => dernier.current?.scrollIntoView({ block: 'center', behavior: doucement() }))
    return () => cancelAnimationFrame(id)
  }, [m.indices.length])
  return (
    <>
      <h2 className="quiz-question cab-question">{espacesFines(QUESTION_DES_INDICES)}</h2>
      <p className="cab-vaut">
        Ta réponse vaut <Etoiles n={m.vaut} />
      </p>
      <LesIndices indices={m.indices} dernier={dernier} />
      <p className="cab-ligne cab-compte">{espacesFines(ceQuIlVoit(m))}</p>
      {m.essayes.length > 0 && <p className="cab-ligne cab-essayes">{espacesFines(`Déjà essayé : ${m.essayes.join(', ')}`)}</p>}
    </>
  )
}

/**
 * Le pied collé : ce que le dernier nom a donné, le champ, « Un indice de
 * plus » et « Répondre ». Le nom part à « Répondre », ou à « Envoyer » du
 * clavier du téléphone (le formulaire) ; vide, « Répondre » attend. Les deux
 * gestes attendent la demi-seconde de chaque vue neuve (`garde`) : un double
 * toucher ne demande pas deux indices.
 */
function ChampDuNom({ montree: m, local, setLocal, envoyer, garde, busy }: PropsDUneManche<IndicesMontres, LocalDesIndices>) {
  const champ = useId()
  const vide = local.texte.trim() === ''
  const repondre = () => !vide && !busy && envoyer({ quoi: 'nom', texte: local.texte })
  const unIndice = () => m.caches > 0 && !busy && garde() && envoyer({ quoi: 'indice' })
  const soumettre = (e: FormEvent) => {
    e.preventDefault()
    repondre()
  }
  // Le nom refusé vient de rejoindre « Déjà essayé », et le champ s'est vidé : la ligne le dit, jusqu'au nom suivant.
  const dernier = vide ? m.essayes.at(-1) : undefined
  return (
    <form className="join cab-nom" onSubmit={soumettre}>
      <p className="cab-ligne cab-non" role="status">
        {dernier ? espacesFines(`Non, ce n’est pas « ${dernier} ».`) : ''}
      </p>
      <label className="sr-only" htmlFor={champ}>
        Ta réponse : un nom
      </label>
      <input
        id={champ}
        className="input"
        type="text"
        name="nom"
        placeholder="Ta réponse : un nom"
        autoComplete="off"
        autoCapitalize="words"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="send"
        maxLength={SIGNES_D_UN_GESTE_MAX}
        value={local.texte}
        onChange={e => setLocal({ texte: e.currentTarget.value })}
      />
      <div className="cab-gestes-du-nom">
        <button type="button" className="btn" aria-disabled={m.caches === 0 || busy || undefined} {...toucher(unIndice)}>
          Un indice de plus
        </button>
        <button type="button" className="btn btn-primary" aria-disabled={vide || busy || undefined} {...toucher(() => garde() && repondre())}>
          Répondre
        </button>
      </div>
    </form>
  )
}

/** La révélation : trouvé, et avec quoi sous les yeux — sinon le titre dit qui c'était —, puis les cinq indices. */
function RevelationDesIndices({ corps: r }: { corps: IndicesReveles }) {
  return (
    <section className="cab-indices-reveles" aria-label="Les cinq indices">
      {r.detail && <p className="cab-ligne">{espacesFines(r.detail)}</p>}
      <LesIndices indices={r.indices} />
    </section>
  )
}

export const INDICES: JeuALEcran<IndicesMontres, IndicesReveles, LocalDesIndices> = {
  localDe: () => ({ texte: '' }),
  // La fiche (son premier indice) et les noms refusés : un nom faux vide le champ, « Changer » pose une autre fiche ; un indice de
  // plus, demandé ou offert, laisse le nom qui s'écrivait.
  cleDe: m => `${m.indices[0] ?? ''}|${m.essayes.length}`,
  aLEcheance: () => undefined,
  // Pas de `sousEcranDe` : un nom qui s'écrit ne bouge rien sous le doigt, et chaque nom ou indice rend une vue neuve, que le cadre garde.
  Manche: MancheDesIndices,
  Pied: ChampDuNom,
  Revelation: RevelationDesIndices,
}
