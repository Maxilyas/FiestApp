import { useState } from 'react'
import { Icon } from '../components/Icon'
import { Sortie } from '../components/Pieces'
import { ChoixDuTheme } from '../components/ChoixDuTheme'
import { OR, lueur } from '../components/Atlas'
import { espacesFines } from '../format'
import { PAGE_DES_DUELS } from './adressesDesDuels'
import { ChercherUnJoueur, LigneDeJoueur } from './Joueurs'
import { ecartSigne } from './Rencontre'
import { nomDuChoix } from '../../../shared/nomDuChoix'
import { COTE_DE_DEPART, enjeuContre, type EnjeuDuDuel, type JoueurADefier } from '../../../shared/duels'
import type { Sujet } from '../../../shared/sujets'
import type { AmiDeCampagne } from '../../../shared/campagne'

/**
 * Défier quelqu'un (`/duels#defier`, le souhait du propriétaire du 11 octobre
 * 2026 : « tu choisis sur quoi tu veux défier, une barre de recherche, un
 * classement de la ligue avec des petites épées ; une fois le quiz fait de
 * mon côté, ça envoie automatiquement une notification, pas de lien à
 * partager »), en trois temps : contre qui — celui que l'épée du classement
 * ou la ligne d'un ami a choisi, sinon trouvé par son prénom ou parmi ses
 * amis —, sur quoi — la grille de la série, catégories ou sujet —, puis on
 * le joue d'abord. À sa dernière réponse, il lui part : dans ses duels, et
 * son téléphone sonne. Un duel classé : quand il l'a joué, les deux cotes
 * bougent, et ce qui se joue se dit avant (`enjeuContre`).
 */
export function LancerUnDefi({
  amis,
  categoriesJouables,
  sujets,
  depart,
  busy,
  erreur,
  onLancer,
  onRetour,
}: {
  /** Ses amis ; null tant qu'ils arrivent. */
  amis: readonly AmiDeCampagne[] | null
  categoriesJouables: readonly string[]
  sujets: readonly Sujet[]
  /**
   * Ce qui est choisi en arrivant : les catégories ou le sujet de sa dernière
   * série, l'adversaire touché — l'épée d'une ligne du classement, un ami —,
   * et sa propre cote, pour dire ce qui se joue.
   */
  depart: { categories: readonly string[]; sujet: string | null; adversaire?: JoueurADefier; moi?: { cote: number; joues: number } }
  busy: boolean
  erreur: string
  /** Lancer le duel : ce qu'il fait jouer, contre qui — et ce qu'il met en jeu, que la partie redit à chaque question. */
  onLancer: (categories: string[], sujet: string | null, adversaire: JoueurADefier, enjeu?: EnjeuDuDuel) => void
  onRetour: () => void
}) {
  const [choisi, setChoisi] = useState<JoueurADefier | null>(depart.adversaire ?? null)
  const [categories, setCategoriesBrut] = useState<string[]>(() => [...depart.categories])
  const [sujet, setSujet] = useState<string | null>(depart.sujet)
  // Toucher une catégorie quitte le sujet, comme dans la série.
  const setCategories = (c: string[]) => {
    setCategoriesBrut(c)
    setSujet(null)
  }
  const quoi = nomDuChoix(categories, sujet) ?? 'toutes les catégories'
  const enjeu = choisi && depart.moi ? enjeuContre(depart.moi.cote, choisi.cote ?? COTE_DE_DEPART, depart.moi.joues) : null
  const choisir = (j: JoueurADefier) => (
    <button type="button" className="btn btn-small" aria-label={`Défier ${j.nom}`} onClick={() => setChoisi(j)}>
      <Icon name="swords" />
      Choisir
    </button>
  )
  return (
    <div className="player-shell campagne">
      <Sortie vers="Les duels" href={PAGE_DES_DUELS} onClick={onRetour} />
      <section className="atlas-branche campagne-heros defi-heros" style={lueur(OR)}>
        <span className="atlas-categorie">Duel classé</span>
        <h1>{choisi ? `Défier ${choisi.nom}` : 'Défier quelqu’un'}</h1>
        <ol className="defier-etapes">
          <li>
            <b>1</b> contre qui
          </li>
          <li>
            <b>2</b> sur quoi
          </li>
          <li>
            <b>3</b> tu joues d’abord
          </li>
        </ol>
      </section>

      <section className="card defier-etape" aria-labelledby="defier-qui">
        <h2 id="defier-qui" className="defier-titre">
          <span className="defier-numero" aria-hidden="true">
            1
          </span>
          Contre qui ?
        </h2>
        {choisi ? (
          <LigneDeJoueur joueur={choisi}>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setChoisi(null)}>
              Changer
            </button>
          </LigneDeJoueur>
        ) : (
          <>
            <ChercherUnJoueur libelle="Chercher un joueur par son prénom" rendre={j => <LigneDeJoueur joueur={j}>{choisir(j)}</LigneDeJoueur>} />
            {amis === null ? (
              <p className="muted small" aria-busy="true">
                Tes amis arrivent…
              </p>
            ) : amis.length > 0 ? (
              <>
                <p className="label defier-amis-titre">Tes amis</p>
                <ul className="joueurs-trouves" aria-label="Défier l’un de tes amis">
                  {amis.map(a => (
                    <li key={a.profileId}>
                      <LigneDeJoueur joueur={a}>{choisir(a)}</LigneDeJoueur>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted small">{espacesFines('Cherche un prénom, ou touche l’épée d’un joueur dans le classement des duels.')}</p>
            )}
          </>
        )}
      </section>

      <section className="card defier-etape" aria-labelledby="defier-quoi">
        <h2 id="defier-quoi" className="defier-titre">
          <span className="defier-numero" aria-hidden="true">
            2
          </span>
          Sur quoi ?
          <span className="defier-choix">{quoi}</span>
        </h2>
        <ChoixDuTheme categoriesJouables={categoriesJouables} sujets={sujets} categories={categories} sujet={sujet} onCategories={setCategories} onSujet={setSujet} />
      </section>

      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary btn-big btn-block"
        aria-disabled={busy || !choisi || undefined}
        onClick={() => choisi && onLancer(sujet ? [] : categories, sujet, choisi, enjeu ?? undefined)}
      >
        <Icon name="swords" />
        {/* Le prénom dans la phrase dessous : en capitales, un long prénom faisait déborder le gros bouton. */}
        Jouer le duel
      </button>
      <p className="muted small centre">
        {espacesFines(
          choisi
            ? `Tu joues d’abord, trois vies. À ta dernière réponse, ${choisi.nom} reçoit le duel : dans ses duels, et son téléphone sonne s’il a activé les notifications. Quand il l’a joué, vos deux cotes bougent${enjeu ? ` — pour toi, ${ecartSigne(enjeu.gagne)} si tu gagnes, ${ecartSigne(enjeu.perdu)} si tu perds` : ''}.`
            : 'Choisis d’abord contre qui : un prénom, un ami, ou l’épée d’un joueur du classement.',
        )}
      </p>
    </div>
  )
}
