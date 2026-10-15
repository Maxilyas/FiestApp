import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from './Icon'
import { espacesFines } from '../format'
import { PAGE_DES_DUELS, adresseDuDuel, adresseDuLancementContre } from '../views/adressesDesDuels'
import { DIT_DU_DUEL_OUVERT, EnJeu } from '../views/Rencontre'
import { COTE_DE_DEPART, enjeuContre, type DuelOuvert, type EnjeuDuDuel, type FaceAFace, type JoueurADefier } from '../../../shared/duels'

/**
 * Ce qu'on fait d'un joueur, au pied de sa carte (le souhait du propriétaire
 * du 11 octobre 2026 : « reprendre comme de partout la carte qui s'affiche du
 * joueur » ; ajouter, supprimer, défier) : le défier, l'ajouter à ses amis ou
 * l'en retirer. Les lignes — d'un classement, de ses amis, d'une recherche —
 * n'ont plus de bouton à elles : une épée et une croix sur chaque ligne
 * encombraient la page, et l'on défie maintenant qui l'on a vu.
 */
export interface GestesDeLaCarte {
  profileId: string
  /** Le défier ici même — la page des duels ouvre sa préparation ; sans lui, la carte y mène (`/duels#defier-<id>`). */
  onDefier?: (joueur: JoueurADefier, moi: FaceAFace['moi']) => void
  /** Rouvrir ici même le duel déjà ouvert entre eux — la page des duels ouvre sa page ; sans lui, la carte y mène (`/duels#duel-<code>`). */
  onOuvrirDuel?: (code: string) => void
  /** Sa liste d'amis a changé : la page qui la montre la relit. */
  onAmis?: () => void
}

/**
 * Les gestes, chargés avec la carte d'un profil touché hors d'une soirée
 * (`CarteJoueur`, `gestes`) : ce que la recherche dirait de lui, d'une
 * requête (`GET /api/duels/joueurs/:id`). Lui-même, un masqué : rien — la
 * carte reste. Retirer un ami se confirme ici, sous le doigt : un second
 * dialogue par-dessus la carte se disputait son clavier.
 */
export function GestesDuJoueur({ gestes, visibles = true, onFermer }: { gestes: GestesDeLaCarte; /** Cachés sans rien oublier : sous l'avatar en grand. */ visibles?: boolean; onFermer: () => void }) {
  const [face, setFace] = useState<FaceAFace | null>(null)
  const [aConfirmer, setAConfirmer] = useState(false)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  const { profileId } = gestes

  useEffect(() => {
    let vivant = true
    setFace(null)
    api.duels
      .joueur(profileId)
      .then(f => vivant && setFace(f))
      // Rien à faire de lui (sa propre carte, un masqué) ou pas de réseau : la carte se lit sans ses gestes.
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [profileId])

  if (!face || !visibles) return null
  const { joueur, moi, enCours } = face

  const defier = () => {
    if (gestes.onDefier) {
      onFermer()
      gestes.onDefier(joueur, moi)
      return
    }
    window.location.assign(`${PAGE_DES_DUELS}${adresseDuLancementContre(joueur.profileId)}`)
  }

  const ouvrirLeDuel = (code: string) => {
    if (gestes.onOuvrirDuel) {
      onFermer()
      gestes.onOuvrirDuel(code)
      return
    }
    window.location.assign(`${PAGE_DES_DUELS}${adresseDuDuel(code)}`)
  }

  const changer = async (ajouter: boolean) => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      await (ajouter ? api.campagne.amis.ajouter(joueur.profileId) : api.campagne.amis.retirer(joueur.profileId))
      const { ami: _, ...sansAmi } = joueur
      setFace({ ...face, joueur: ajouter ? { ...sansAmi, ami: true } : sansAmi })
      setAConfirmer(false)
      gestes.onAmis?.()
      // Remis dans ses amis, son duel retenu lui parvient (`ajouterUnAmi`) : la carte le relit, pour le rouvrir d'ici.
      if (ajouter && enCours?.ou === 'retenu') {
        void api.duels
          .joueur(joueur.profileId)
          .then(setFace)
          .catch(() => {})
      }
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <GestesVue
      joueur={joueur}
      // Ce que le défier mettrait en jeu, comme la préparation le dira : sa cote contre la sienne, sa part de lanceur comprise.
      enjeu={enjeuContre(moi, joueur.cote ?? COTE_DE_DEPART, true)}
      enCours={enCours}
      aConfirmer={aConfirmer}
      busy={busy}
      erreur={erreur}
      onDefier={defier}
      onOuvrirDuel={ouvrirLeDuel}
      onAjouter={() => void changer(true)}
      onRetirer={() => setAConfirmer(true)}
      onConfirmer={() => void changer(false)}
      onGarder={() => setAConfirmer(false)}
    />
  )
}

/**
 * Les gestes tels qu'ils se montrent : « Défier » en grand, ce que le duel
 * mettrait en jeu dessous — partout où l'on choisit qui défier, on voit ce
 * qu'on gagne et ce qu'on perd (le souhait du propriétaire du 14 octobre
 * 2026) — ou, un duel déjà ouvert entre eux, où il en est et de quoi le
 * rouvrir (`DIT_DU_DUEL_OUVERT`) ; puis l'ajouter — ou, son ami, le retirer,
 * confirmé sur place.
 */
export function GestesVue({
  joueur,
  enjeu,
  enCours,
  aConfirmer,
  busy,
  erreur,
  onDefier,
  onOuvrirDuel,
  onAjouter,
  onRetirer,
  onConfirmer,
  onGarder,
}: {
  joueur: JoueurADefier
  /** Ce que le défier mettrait en jeu sur sa cote (`enjeuContre`). */
  enjeu?: EnjeuDuDuel
  /** Le duel classé déjà ouvert entre eux : un seul à la fois, il prend la place de « Défier ». */
  enCours?: DuelOuvert
  aConfirmer: boolean
  busy: boolean
  erreur: string
  onDefier: () => void
  /** Rouvrir le duel ouvert entre eux, par son code. */
  onOuvrirDuel?: (code: string) => void
  onAjouter: () => void
  onRetirer: () => void
  onConfirmer: () => void
  onGarder: () => void
}) {
  const dit = enCours && DIT_DU_DUEL_OUVERT[enCours.ou]
  const code = enCours?.code
  return (
    <footer className="carte-gestes">
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      {aConfirmer ? (
        <div className="carte-gestes-retrait" role="group" aria-label={`Retirer ${joueur.nom} de tes amis ?`}>
          <p className="small">{espacesFines(`Retirer ${joueur.nom} de tes amis ? Ses duels ne te parviendront plus ; tu pourras le rajouter par son prénom.`)}</p>
          <div className="carte-gestes-rangee">
            <button type="button" className="btn btn-small" aria-disabled={busy || undefined} onClick={onConfirmer}>
              Retirer
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={onGarder}>
              Garder
            </button>
          </div>
        </div>
      ) : (
        <>
          {dit ? (
            <>
              {/* Où il en est d'abord : c'est ce qu'il fallait savoir avant de le défier. */}
              <p className="small carte-gestes-duel">{espacesFines(dit.phrase(joueur.nom))}</p>
              {dit.bouton && code && (
                <button type="button" className={dit.bouton.aToi ? 'btn btn-primary btn-block' : 'btn btn-block'} onClick={() => onOuvrirDuel?.(code)}>
                  <Icon name={dit.bouton.icone} />
                  {dit.bouton.texte}
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" className="btn btn-primary btn-block" onClick={onDefier}>
                <Icon name="swords" />
                <span className="carte-gestes-nom">{`Défier ${joueur.nom}`}</span>
              </button>
              {enjeu && <EnJeu enjeu={enjeu} className="small carte-gestes-enjeu" />}
            </>
          )}
          {joueur.ami ? (
            <p className="carte-gestes-ami small">
              <span>
                <Icon name="check" /> Dans tes amis
              </span>
              <button type="button" className="btn btn-ghost btn-small" aria-label={`Retirer ${joueur.nom} de mes amis`} onClick={onRetirer}>
                Retirer
              </button>
            </p>
          ) : (
            <button type="button" className="btn btn-block" aria-disabled={busy || undefined} onClick={onAjouter}>
              <Icon name="plus" />
              Ajouter à mes amis
            </button>
          )}
        </>
      )}
    </footer>
  )
}
