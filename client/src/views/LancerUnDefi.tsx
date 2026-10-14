import { useEffect, useState } from 'react'
import { api } from '../api'
import { Icon } from '../components/Icon'
import { Sortie } from '../components/Pieces'
import { FeuilleDuChoix, LigneDuChoix } from '../components/ChoixDuTheme'
import { OR, lueur } from '../components/Atlas'
import { useCarteDUnProfil } from '../components/CarteDUnProfil'
import { espacesFines } from '../format'
import { PAGE_DES_DUELS } from './adressesDesDuels'
import { ChercherUnJoueur, LigneDeJoueur } from './Joueurs'
import { JetonsDeLEnjeu } from './Rencontre'
import { COTE_DE_DEPART, RAISON_DU_CROISEMENT, enjeuContre, type EnjeuDuDuel, type JoueurADefier, type JoueurCroise } from '../../../shared/duels'
import type { Sujet } from '../../../shared/sujets'
import type { AmiDeCampagne } from '../../../shared/campagne'

/**
 * Défier quelqu'un (`/duels#defier`, le souhait du propriétaire du 11 octobre
 * 2026 : « tu choisis sur quoi tu veux défier, une barre de recherche, un
 * classement de la ligue avec des petites épées ; une fois le quiz fait de
 * mon côté, ça envoie automatiquement une notification, pas de lien à
 * partager »), en trois temps : contre qui — celui dont la carte a dit
 * « Défier » (`GestesDuJoueur`), sinon trouvé par son prénom, parmi ses amis
 * ou parmi les joueurs qu'il a croisés —, sur quoi — une ligne, et la feuille
 * du choix de la série derrière « Changer » —, puis on le joue d'abord. À sa
 * dernière réponse, il lui part : dans ses duels, et son accueil le lui dit —
 * sans notification depuis le 13 octobre 2026 : seul le quiz du jour en a. Un
 * duel classé : quand il l'a joué, les deux cotes bougent, et ce qui se joue
 * se voit dès qu'on l'a choisi, en deux jetons sous lui (`enjeuContre` ; le
 * souhait du propriétaire du 14 octobre 2026 : « quand je lance un défi et
 * que je choisis quelqu'un, voir ce que je gagne / perds ») — dit dans la
 * phrase sous « Jouer le duel », il sortait de l'écran du téléphone. Chaque
 * prénom ouvre sa carte, entière — « Défier » à son pied le choisit ici même
 * —, et « Choisir » est à côté : on sait contre qui l'on joue avant de le
 * choisir.
 */
export function LancerUnDefi({
  amis,
  croises,
  categoriesJouables,
  sujets,
  depart,
  busy,
  erreur,
  onLancer,
  onAmis,
  onRetour,
}: {
  /** Ses amis ; null tant qu'ils arrivent. */
  amis: readonly AmiDeCampagne[] | null
  /** Des joueurs qu'il a croisés (`GET /api/duels/croises`) ; null tant qu'ils arrivent. */
  croises?: readonly JoueurCroise[] | null
  categoriesJouables: readonly string[]
  sujets: readonly Sujet[]
  /**
   * Ce qui est choisi en arrivant : les catégories ou le sujet de sa dernière
   * série, l'adversaire touché — « Défier » sur sa carte —, et sa propre
   * cote, pour dire ce qui se joue.
   */
  depart: { categories: readonly string[]; sujet: string | null; adversaire?: JoueurADefier; moi?: { cote: number; joues: number; plancher?: number } }
  busy: boolean
  erreur: string
  /** Lancer le duel : ce qu'il fait jouer, contre qui — et ce qu'il met en jeu, que la partie redit à chaque question. */
  onLancer: (categories: string[], sujet: string | null, adversaire: JoueurADefier, enjeu?: EnjeuDuDuel) => void
  /** Sa liste d'amis a changé, d'une carte : ses amis et les joueurs croisés se relisent. */
  onAmis?: () => void
  onRetour: () => void
}) {
  const [choisi, setChoisi] = useState<JoueurADefier | null>(depart.adversaire ?? null)
  // Sa cote, pour dire ce qui se joue : celle du départ, ou celle que la carte d'un joueur a relue en le défiant.
  const [moi, setMoi] = useState(depart.moi)
  const [categories, setCategories] = useState<string[]>(() => [...depart.categories])
  const [sujet, setSujet] = useState<string | null>(depart.sujet)
  // La feuille du choix, derrière « Changer » : la grille sous les yeux repoussait « Jouer le duel » à trois écrans.
  const [choixOuvert, setChoixOuvert] = useState(false)
  // « Défier » au pied d'une carte ouverte d'ici le choisit ici même.
  const { ouvrir, carte } = useCarteDUnProfil({
    onDefier: (j, m) => {
      setChoisi(j)
      setMoi(m)
    },
    onAmis,
  })
  // Sa cote inconnue — la préparation ouverte telle quelle à son adresse, « Défier » touché avant que la page ait dit la
  // sienne — : ce que les duels savent du joueur choisi la dit (`GET /api/duels/joueurs/:id`), sa cote à lui fraîche avec.
  useEffect(() => {
    if (!choisi || moi) return
    let vivant = true
    api.duels
      .joueur(choisi.profileId)
      .then(f => {
        if (!vivant) return
        setMoi(f.moi)
        setChoisi(f.joueur)
      })
      // Introuvable ou sans réseau : la préparation reste, sans enjeu ; le lancement dira l'erreur.
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [choisi?.profileId, moi])
  // Ce qui se joue pour lui, qui lance le défi : sa part de lanceur comprise, et sa ligue gardée.
  const enjeu = choisi && moi ? enjeuContre(moi, choisi.cote ?? COTE_DE_DEPART, true) : null
  const choisir = (j: JoueurADefier) => (
    <button type="button" className="btn btn-small" aria-label={`Défier ${j.nom}`} onClick={() => setChoisi(j)}>
      <Icon name="swords" />
      Choisir
    </button>
  )
  // Son prénom ouvre sa carte ; « Choisir », à côté, le choisit sans elle.
  const ligne = (j: JoueurADefier, detail?: string) => (
    <LigneDeJoueur joueur={j} detail={detail} onOuvrir={() => ouvrir(j.profileId)}>
      {choisir(j)}
    </LigneDeJoueur>
  )
  const lesCroises = croises ?? null
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
          <>
            <LigneDeJoueur joueur={choisi} onOuvrir={() => ouvrir(choisi.profileId)}>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setChoisi(null)}>
                Changer
              </button>
            </LigneDeJoueur>
            {/* Sous lui, ce que le duel met en jeu : on le voit en le choisissant. */}
            {enjeu && <JetonsDeLEnjeu enjeu={enjeu} petits />}
          </>
        ) : (
          <>
            <ChercherUnJoueur libelle="Chercher un joueur par son prénom" rendre={j => ligne(j)} />
            {amis === null ? (
              <p className="muted small" aria-busy="true">
                Tes amis arrivent…
              </p>
            ) : amis.length > 0 ? (
              <>
                <p className="label defier-amis-titre">Tes amis</p>
                <ul className="joueurs-trouves" aria-label="Défier l’un de tes amis">
                  {amis.map(a => (
                    <li key={a.profileId}>{ligne(a)}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted small">{espacesFines('Cherche un prénom — ou touche un joueur du classement des duels : « Défier » est sur sa carte.')}</p>
            )}
            {/* Ceux qu'il a croisés : sans eux, un joueur sans ami devait connaître un prénom. Rien tant qu'ils arrivent — ses amis passent devant. */}
            {lesCroises && lesCroises.length > 0 && (
              <>
                <p className="label defier-amis-titre">Joueurs croisés</p>
                <ul className="joueurs-trouves" aria-label="Défier un joueur croisé">
                  {lesCroises.map(c => (
                    <li key={c.profileId}>{ligne(c, RAISON_DU_CROISEMENT[c.croise])}</li>
                  ))}
                </ul>
              </>
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
        </h2>
        <LigneDuChoix categories={categories} sujet={sujet} onChanger={() => setChoixOuvert(true)} />
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
            ? `Tu joues d’abord, trois vies. À ta dernière réponse, ${choisi.nom} reçoit le duel : dans ses duels, et son accueil le lui dit. Le duel joué des deux côtés, vos deux cotes bougent.`
            : 'Choisis d’abord contre qui : un prénom, un ami — ou « Défier » sur la carte d’un joueur du classement.',
        )}
      </p>
      {choixOuvert && (
        <FeuilleDuChoix
          categoriesJouables={categoriesJouables}
          sujets={sujets}
          categories={categories}
          sujet={sujet}
          onChoisir={(c, s) => {
            setCategories(c)
            setSujet(s)
          }}
          onFermer={() => setChoixOuvert(false)}
        />
      )}
      {carte}
    </div>
  )
}
