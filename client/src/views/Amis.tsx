import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { Feuille } from '../components/Pieces'
import { useCarteDUnProfil } from '../components/CarteDUnProfil'
import { espacesFines } from '../format'
import { sansAccent } from '../../../shared/homonymes'
import { RAISON_DU_CROISEMENT, type FaceAFace, type JoueurADefier, type JoueurCroise } from '../../../shared/duels'
import type { AmiDeCampagne, AmisDeLaFeuille } from '../../../shared/campagne'
import { ChampDUnPrenom, LigneDeJoueur, useJoueursTrouves } from './Joueurs'

/**
 * La feuille des amis (le souhait du propriétaire du 11 octobre 2026 : « une
 * interface pour la liste d'amis par-dessus l'accueil ou une autre page, une
 * fenêtre avec la liste des amis, s'il est connecté, ajouter, supprimer,
 * défier […] la plus facile et claire possible, sans trop de choses qui
 * encombrent ») : elle monte sur la page qu'on regarde — l'accueil, les
 * duels — et se referme où l'on était. Pas une bulle posée sur toutes les
 * pages : au téléphone, elle couvrait la barre du menu et les gros boutons,
 * et chaque page aurait lu la liste. Un seul champ en tête : vide, sa liste ;
 * tapé, ses amis qu'il désigne, puis les autres joueurs — une recherche
 * seule obligeait à retaper le prénom d'une amie à chaque duel. Aucune ligne
 * n'a de bouton à elle : un toucher ouvre la carte du joueur, comme partout,
 * entière, et ses gestes au pied — le défier, l'ajouter, le retirer
 * (`GestesDuJoueur`).
 */
export function FeuilleDesAmis({
  onFermer,
  onDefier,
  onAmis,
}: {
  onFermer: () => void
  /** Défier ici même (la page des duels) ; sans lui, la carte mène à sa préparation (`/duels#defier-<id>`). */
  onDefier?: (joueur: JoueurADefier, moi: FaceAFace['moi']) => void
  /** Sa liste a changé : la page qui en dit quelque chose la relit. */
  onAmis?: () => void
}) {
  const [cercle, setCercle] = useState<AmisDeLaFeuille | null>(null)
  const [erreur, setErreur] = useState('')
  const [texte, setTexte] = useState('')
  const relire = () =>
    api.duels
      .amis()
      .then(c => {
        setCercle(c)
        setErreur('')
      })
      .catch(e => setErreur(motifDe(e)))
  useEffect(() => {
    void relire()
  }, [])
  const { ouvrir, carte } = useCarteDUnProfil({
    onDefier,
    onAmis: () => {
      void relire()
      onAmis?.()
    },
  })
  const recherche = useJoueursTrouves(texte)
  return (
    <>
      {/* Sa hauteur ne suit pas sa liste : à chaque lettre tapée, la feuille rapetissait et son champ glissait sous le doigt. */}
      <Feuille titre={cercle && cercle.amis.length > 0 ? `Mes amis · ${cercle.amis.length}` : 'Mes amis'} onFermer={onFermer} className="feuille-des-amis">
        <ChampDUnPrenom libelle="Chercher un ami, ou quelqu’un à ajouter, par son prénom" texte={texte} onTexte={setTexte} />
        {(erreur || recherche.erreur) && (
          <p className="error" role="alert">
            {erreur || recherche.erreur}
          </p>
        )}
        <ListeDesAmis cercle={cercle} texte={texte} trouves={recherche.joueurs} onOuvrir={j => ouvrir(j.profileId)} />
      </Feuille>
      {carte}
    </>
  )
}

/**
 * Ce que la feuille montre sous son champ. Vide : ceux qui l'ont ajouté sans
 * qu'il les ait ajoutés — de quoi rendre la pareille, et voir alors qui est
 * en ligne —, puis sa liste, lue comme un classement, puis des joueurs qu'il
 * a croisés, chacun ce qui le fait paraître (le souhait du propriétaire du
 * 11 octobre 2026 : « c'est dommage que ça montre pas des joueurs pour les
 * ajouter en ami ») : sans eux, il fallait connaître un prénom. Tapé : ses
 * amis que le texte désigne, dès la première lettre, puis les autres
 * joueurs, dès la deuxième (`LETTRES_POUR_CHERCHER`).
 */
export function ListeDesAmis({
  cercle,
  texte,
  trouves,
  onOuvrir,
}: {
  cercle: AmisDeLaFeuille | null
  texte: string
  /** Les joueurs que le texte désigne ; null sous deux lettres, et en chemin. */
  trouves: JoueurADefier[] | null
  onOuvrir: (j: JoueurADefier | AmiDeCampagne) => void
}) {
  if (!cercle) {
    return (
      <p className="muted small" aria-busy="true">
        Tes amis arrivent…
      </p>
    )
  }
  const ligne = (j: JoueurADefier | AmiDeCampagne) => (
    <li key={j.profileId}>
      <LigneDeJoueur joueur={j} onOuvrir={() => onOuvrir(j)} />
    </li>
  )
  // Un joueur croisé dit ce qui le fait paraître : « en soirée avec toi ».
  const croisee = (c: JoueurCroise) => (
    <li key={c.profileId}>
      <LigneDeJoueur joueur={c} detail={RAISON_DU_CROISEMENT[c.croise]} onOuvrir={() => onOuvrir(c)} />
    </li>
  )
  const cherche = sansAccent(texte)
  if (cherche) {
    const sesAmis = cercle.amis.filter(a => sansAccent(a.nom).includes(cherche))
    const ids = new Set(cercle.amis.map(a => a.profileId))
    const autres = (trouves ?? []).filter(j => !j.ami && !ids.has(j.profileId))
    return (
      <div className="amis-sections" role="status" aria-live="polite">
        {sesAmis.length > 0 && (
          <section className="amis-section" aria-labelledby="amis-siens-titre">
            <h3 id="amis-siens-titre" className="label">
              Tes amis
            </h3>
            <ul className="joueurs-trouves">{sesAmis.map(ligne)}</ul>
          </section>
        )}
        {autres.length > 0 && (
          <section className="amis-section" aria-labelledby="amis-autres-titre">
            <h3 id="amis-autres-titre" className="label">
              Autres joueurs
            </h3>
            <ul className="joueurs-trouves">{autres.map(ligne)}</ul>
          </section>
        )}
        {sesAmis.length === 0 && autres.length === 0 && trouves !== null && (
          <p className="muted small">{espacesFines(`Personne ne s’appelle « ${texte.trim()} » ici.`)}</p>
        )}
      </div>
    )
  }
  return (
    <div className="amis-sections">
      {cercle.tOntAjoute.length > 0 && (
        <section className="amis-section" aria-labelledby="amis-ajoute-titre">
          <h3 id="amis-ajoute-titre" className="label">
            Ils t’ont ajouté
          </h3>
          <ul className="joueurs-trouves">{cercle.tOntAjoute.map(ligne)}</ul>
        </section>
      )}
      {cercle.amis.length > 0 ? (
        <section className="amis-section" aria-labelledby="amis-liste-titre">
          <h3 id="amis-liste-titre" className="label">
            Tes amis
          </h3>
          <ul className="joueurs-trouves">{cercle.amis.map(ligne)}</ul>
          {cercle.amis.some(a => a.enLigne) && (
            <p className="muted small amis-legende">
              <span className="en-ligne-point" aria-hidden="true" />
              {espacesFines('en ligne : un ami qui t’a ajouté aussi, passé ces cinq dernières minutes')}
            </p>
          )}
        </section>
      ) : (
        <p className="muted small">
          {espacesFines('Tape le prénom d’un ami ci-dessus : sa carte s’ouvre, et « Ajouter à mes amis » le met dans ta liste — sans demande ni attente. Tu y verras sa ligue et sa cote, et tu le défieras d’un toucher.')}
        </p>
      )}
      {/* Un serveur d'avant ne les dit pas : rien, pas une section vide. */}
      {(cercle.croises ?? []).length > 0 && (
        <section className="amis-section" aria-labelledby="amis-croises-titre">
          <h3 id="amis-croises-titre" className="label">
            Joueurs croisés
          </h3>
          <ul className="joueurs-trouves">{cercle.croises.map(croisee)}</ul>
        </section>
      )}
    </div>
  )
}
