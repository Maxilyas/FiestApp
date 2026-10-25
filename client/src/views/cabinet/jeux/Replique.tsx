import { Icon } from '../../../components/Icon'
import { Shape } from '../../../components/Shape'
import { espacesFines } from '../../../format'
import { answersSizeClass } from '../../../games/quiz/questionSize'
import { toucher } from '../../../toucher'
import { repliqueEntiere, type RepliqueMontree, type RepliqueRevelee } from '../../../../../shared/cabinet/jeux/replique'
import type { FinDUneManche } from '../../../../../shared/cabinet/partie'
import type { JeuALEcran, PropsDUneManche } from '../Partie'

// La Réplique à l'écran (§ 3.9) : une réplique célèbre, un mot en moins. Deux
// étapes, chacune son chrono, que le cadre lit dans la vue : d'abord le mot
// qui manque, parmi quatre ; puis qui l'a dite, parmi trois, le mot choisi posé
// dans le trou — sans jamais dire s'il était le bon avant la révélation
// (invariant 1). Le temps du mot écoulé, « Qui l'a dit ? » s'ouvre quand même,
// le trou vide : on ne perd pas la seconde question à cause de la première.
//
// Chaque étape est un écran (l'étape de la vue, `etapeDe` dans `Partie.tsx`) :
// le cadre remonte en haut, pose le focus sur sa question, relance la
// demi-seconde de garde — le second toucher d'un double ne choisit pas qui l'a
// dite —, et la réponse partie d'elle-même à l'échéance du mot ferme
// « Quitter ? » (`laReponseTourneLaPage`) : la pause close avec l'étape, la
// confirmation ne promettait plus rien de vrai.
//
// La page ne tient rien : un mot, un nom partent au toucher, et rien ne part à
// l'échéance — le serveur a déjà le mot, et une personne pas choisie ne compte pas.

/**
 * La réplique, son mot à sa place — le trou, ou le mot choisi —, soudé comme
 * la règle le soude (`repliqueEntiere` : une espace, sauf après une
 * apostrophe ; ce qui suit porte son blanc). Le mot se repère par un
 * caractère que le contenu n'écrit jamais, puis la phrase se coupe autour de
 * lui : la soudure ne se recopie pas ici.
 */
export function autourDuMot(avant: string, apres: string): [string, string] {
  const repere = '\u0000'
  const [debut, fin] = repliqueEntiere(avant, repere, apres).split(repere)
  return [debut, fin]
}

function LaReplique({ avant, apres, mot }: { avant: string; apres: string; mot: string | null }) {
  const [debut, fin] = autourDuMot(avant, apres)
  // Ce qui se soude au mot le suit sur sa ligne — le point, « -moi », et ce qu'`espacesFines` colle d'une espace fine (« ! ») — :
  // le trou est une boîte, et sans cela le point final passait seul à la ligne suivante.
  const [, soude, reste] = /^(\S*)([\s\S]*)$/.exec(espacesFines(`${fin} »`)) ?? ['', '', '']
  return (
    <blockquote className="cab-replique">
      {espacesFines(`« ${debut}`)}
      <span className="cab-insecable">
        {/* Le trou a la largeur d'un mot, pas la sienne : sa longueur aurait soufflé celle du mot. */}
        {mot === null ? (
          <span className="cab-trou">
            <span className="sr-only">le mot qui manque</span>
          </span>
        ) : (
          <span className="cab-trou cab-trou-rempli">{espacesFines(mot)}</span>
        )}
        {soude}
      </span>
      {reste}
    </blockquote>
  )
}

function MancheDeLaReplique({ montree: m, envoyer, garde, busy }: PropsDUneManche<RepliqueMontree, null>) {
  const propositions = m.etape === 1 ? m.mots.map(p => ({ texte: p.mot, efface: p.efface })) : m.personnes.map(p => ({ texte: p.nom, efface: p.efface }))
  const choisir = (i: number) => {
    if (busy || !garde()) return
    if (m.etape === 1) envoyer({ quoi: 'mot', choix: i })
    else envoyer({ quoi: 'repondre', reponse: { replique: { qui: i } } })
  }
  return (
    <>
      <div className="cab-tete-question">
        <h2 className="cab-question cab-surtitre">{espacesFines(m.etape === 1 ? '1 · Le mot qui manque' : '2 · Qui l’a dit ?')}</h2>
      </div>
      {m.etape === 2 && m.motChoisi === null && <p className="cab-ligne cab-temps-du-mot">Temps écoulé pour le mot.</p>}
      <LaReplique avant={m.avant} apres={m.apres} mot={m.etape === 1 ? null : m.motChoisi} />
      <div className={'ans-grid' + answersSizeClass(propositions.map(p => p.texte))}>
        {propositions.map((p, i) => (
          // La clé dit l'étape : les noms arrivent à la place des mots, leurs cases ne les continuent pas.
          <button
            key={`${m.etape}:${i}`}
            type="button"
            className={'ans-btn' + (p.efface ? ' cab-effacee' : '')}
            aria-disabled={p.efface || busy || undefined}
            {...toucher(() => !p.efface && choisir(i))}
          >
            <Shape index={i} />
            <span className="ans-text">{espacesFines(p.texte)}</span>
            {p.efface && <span className="sr-only">, effacé</span>}
          </button>
        ))}
      </div>
    </>
  )
}

/** Ce qu'il avait répondu à une étape, en mots et d'une marque — jamais la couleur seule. Le mot entre guillemets, la personne sans. */
function Repondu({ quoi, repondu, juste, cite = false }: { quoi: string; repondu: string | null; juste: boolean; cite?: boolean }) {
  const dit = repondu === null ? 'pas de réponse' : juste ? 'juste' : 'pas ça'
  return (
    <li className={repondu !== null && juste ? 'cab-repondu-juste' : 'cab-repondu-faux'}>
      <Icon name={repondu !== null && juste ? 'check' : 'x'} />
      <span>{espacesFines(repondu === null ? `${quoi} : ${dit}` : `${quoi} : ${cite ? `« ${repondu} »` : repondu}, ${dit}`)}</span>
    </li>
  )
}

/**
 * La révélation : la réplique entière, qui l'a dite et d'où elle vient, ce
 * qu'il avait répondu à chaque étape. Quittée au bon mot, le titre dit « Le bon
 * mot » — c'est vrai —, et la manche ne rapporte rien : la révélation dit
 * pourquoi, quand on lui dit comment la manche a fini (`fin`) — le cadre le
 * fait, « Mes réponses » (`Bilan.tsx`), le seul écran qui montre une manche
 * quittée, pas encore.
 */
function RevelationDeLaReplique({ corps: r, fin }: { corps: RepliqueRevelee; fin?: FinDUneManche }) {
  return (
    <section className="cab-replique-revelee" aria-label="La réplique">
      <blockquote className="cab-replique">{espacesFines(`« ${r.entiere} »`)}</blockquote>
      <p className="cab-ligne cab-qui">{espacesFines(`${r.qui} · ${r.source}`)}</p>
      <ul className="cab-repondu">
        <Repondu quoi="Le mot" repondu={r.repondu.mot} juste={r.bonMot} cite />
        <Repondu quoi="Qui l’a dit" repondu={r.repondu.qui} juste={r.bonneQui} />
      </ul>
      {fin === 'quittee' && (
        <p className="cab-ligne cab-quittee">
          {espacesFines(r.bonMot ? 'Manche quittée avant « Qui l’a dit ? » : même le bon mot ne compte pas.' : 'Manche quittée : elle ne compte pas.')}
        </p>
      )}
    </section>
  )
}

export const REPLIQUE: JeuALEcran<RepliqueMontree, RepliqueRevelee, null> = {
  localDe: () => null,
  cleDe: m => `${m.etape}|${m.avant}|${m.apres}`,
  aLEcheance: () => undefined,
  Manche: MancheDeLaReplique,
  Revelation: RevelationDeLaReplique,
}
