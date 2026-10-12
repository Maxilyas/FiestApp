import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Sortie } from '../components/Pieces'
import { Shape } from '../components/Shape'
import { BoutonCopier, BoutonPartager } from '../components/Partage'
import { OR, lueur } from '../components/Atlas'
import { espacesFines } from '../format'
import { placeDuJour } from '../../../shared/course'
import { deNom } from '../../../shared/typographie'
import { NOM_NIVEAU, type AmiDeCampagne, type CorrectionDeCampagne, type DefiRecu, type DuelEntreAmis, type ResumeDuDuel, type SerieDeCampagne } from '../../../shared/campagne'
import { LigneDuDefiVue } from './Defi'
import { useCarteDUnProfil } from '../components/CarteDUnProfil'
import { aLaDemande, useALaDemande } from '../aLaDemande'
import { nomDuChoix } from '../../../shared/nomDuChoix'
import { PAGE_DES_DUELS, adresseDuDuel } from './adressesDesDuels'
import { ecartSigne, type ContreEnJeu } from './Rencontre'
import type { DuelContre } from '../../../shared/duels'

export { ADRESSE_DU_LANCEMENT, adresseDuDuel } from './adressesDesDuels'

const lienDuDuel = (code: string) => `${window.location.origin}${PAGE_DES_DUELS}${adresseDuDuel(code)}`

const bonnes = (n: number) => `${n} bonne${n > 1 ? 's' : ''} réponse${n > 1 ? 's' : ''}`

/** Ce que dit le message qui part avec le lien : son score, s'il a joué. */
export const texteDuDefi = (justes: number | null) =>
  justes === null ? 'Un défi entre amis sur FiestApp : feras-tu mieux que moi ?' : `${bonnes(justes)} à ce défi sur FiestApp : feras-tu mieux ?`

/** « Ferme dans 3 jours » : ce qui reste à un défi entre amis. */
export function fermeture(minutes: number): string {
  if (minutes <= 0) return 'Fermé : son classement est figé'
  // Un nombre ne quitte pas son mot à la ligne : « Ferme dans 7 » d'un côté, « jours » de l'autre.
  if (minutes < 60) return `Ferme dans ${minutes}\u00a0minute${minutes > 1 ? 's' : ''}`
  const heures = Math.floor(minutes / 60)
  if (heures < 24) return `Ferme dans ${heures}\u00a0heure${heures > 1 ? 's' : ''}`
  const jours = Math.floor(heures / 24)
  return `Ferme dans ${jours}\u00a0jour${jours > 1 ? 's' : ''}`
}

/**
 * Envoyer un défi : la feuille de partage du téléphone, le lien à copier, et
 * son code — de quoi le dire à voix haute. Sans l'une ni l'autre (une page
 * en http), le lien reste écrit, à sélectionner.
 */
function EnvoyerLeDefi({ code, texte }: { code: string; texte: string }) {
  const lien = lienDuDuel(code)
  return (
    <section className="card duel-envoi" aria-labelledby={`envoi-${code}`}>
      <h2 id={`envoi-${code}`} className="label">
        Envoie ce défi
      </h2>
      <p className="small">Qui ouvre son lien, profil en main, joue les mêmes questions — une fois, d’ici une semaine.</p>
      <div className="row duel-boutons">
        <BoutonPartager titre="Un défi entre amis sur FiestApp" texte={texte} url={lien} className="btn btn-primary" />
        <BoutonCopier texte={lien} />
      </div>
      <p className="muted small">
        <span className="duel-lien">{lien}</span> · son code : <b>{code}</b>
      </p>
    </section>
  )
}

/** « Tom, Hugo et Inès » : des prénoms dans une phrase. */
const enPhrase = (noms: readonly string[]) => (noms.length <= 1 ? (noms[0] ?? '') : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`)

/**
 * L'envoyer à d'autres amis, d'un toucher — ceux avec qui il a joué un défi
 * entre amis (`shared/campagne.ts`) : il les attend dans leurs duels, sans
 * lien à faire suivre, et leur téléphone sonne. Rien de coché
 * d'office : ceux qu'il voulait défier, il les a choisis en le lançant
 * (`LancerUnDefi`) — tous cochés, la fin poussait à défier toute sa liste.
 * Celui qui l'a déjà — reçu ou relevé — ne se coche plus. Sans ami encore,
 * ce qui en fera.
 */
export function EnvoyerAuxAmis({ code }: { code: string }) {
  const [amis, setAmis] = useState<AmiDeCampagne[] | null>(null)
  // Le défi d'un autre se partage par son lien : seul celui qui l'a lancé l'envoie.
  const [sien, setSien] = useState(false)
  const [choisis, setChoisis] = useState<ReadonlySet<string>>(new Set())
  const [envoyes, setEnvoyes] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  useEffect(() => {
    let vivant = true
    api.campagne.amis
      .lire(code)
      .then(m => {
        if (!vivant) return
        setSien(!!m.sien)
        setAmis(m.amis)
      })
      // Une liste qui ne vient pas ne cache rien d'autre : le lien reste là.
      .catch(() => vivant && setAmis([]))
    return () => {
      vivant = false
    }
  }, [code])
  if (!amis || !sien) return null
  if (amis.length === 0) {
    return (
      <p className="muted small duel-amis-vide">
        {espacesFines('Tes amis viendront ici : ceux qui relèvent un de tes défis, ou dont tu en relèves un. La prochaine fois, ton défi les attendra dans leurs duels, sans lien à envoyer.')}
      </p>
    )
  }
  const aEnvoyer = amis.filter(a => !a.deja && choisis.has(a.profileId))
  const basculer = (id: string) =>
    setChoisis(c => {
      const n = new Set(c)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const envoyer = async () => {
    if (busy || aEnvoyer.length === 0) return
    setBusy(true)
    setErreur('')
    try {
      await api.campagne.duel.envoyer(
        code,
        aEnvoyer.map(a => a.profileId),
      )
      const partis = new Set(aEnvoyer.map(a => a.profileId))
      setEnvoyes(aEnvoyer.map(a => a.nom))
      setAmis(liste => liste && liste.map(a => (partis.has(a.profileId) ? { ...a, deja: 'recu' as const } : a)))
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card duel-amis" aria-labelledby={`amis-${code}`}>
      <h2 id={`amis-${code}`} className="label">
        {amis.some(a => a.deja) ? 'À d’autres amis' : 'À tes amis'}
      </h2>
      <div className="duel-amis-liste" role="group" aria-label="Les amis à qui l’envoyer">
        {amis.map(a => {
          const coche = !a.deja && choisis.has(a.profileId)
          return (
            <button
              key={a.profileId}
              type="button"
              className={'duel-ami' + (coche ? ' choisi' : '') + (a.deja ? ' deja' : '')}
              aria-pressed={a.deja ? undefined : coche}
              aria-disabled={a.deja ? true : undefined}
              onClick={() => !a.deja && basculer(a.profileId)}
            >
              <span className="duel-ami-avatar" aria-hidden="true">
                {a.avatar}
              </span>
              <span className="duel-ami-nom">{a.nom}</span>
              {a.deja ? <span className="muted small">{a.deja === 'releve' ? 'l’a relevé' : 'l’a reçu'}</span> : <Icon name={coche ? 'check' : 'plus'} />}
            </button>
          )
        })}
      </div>
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      <p className="small duel-amis-statut" role="status">
        {envoyes && partiAvec(envoyes)}
      </p>
      {aEnvoyer.length > 0 && (
        <button type="button" className="btn btn-primary btn-block" aria-disabled={busy || undefined} onClick={() => void envoyer()}>
          <Icon name="users" />
          {`L’envoyer à ${enPhrase(amis.filter(a => aEnvoyer.includes(a)).map(a => a.nom))}`}
        </button>
      )}
    </section>
  )
}

/**
 * « Parti à Tom et Inès : … » — ce qui vient de leur arriver, sans promettre
 * une notification qu'ils n'ont peut-être pas voulue. Sans « il » ni
 * « elle » : un prénom ne dit pas lequel (« Bérénice s'était arrêté »,
 * l'experte du jeu solo, le 11 octobre 2026).
 */
const partiAvec = (noms: readonly string[]) =>
  espacesFines(
    `Parti à ${enPhrase(noms)} : il ${noms.length > 1 ? 'les ' : 'l’'}attend dans ${noms.length > 1 ? 'leurs' : 'ses'} duels, et ${noms.length > 1 ? 'leur téléphone sonne si leurs' : 'son téléphone sonne si ses'} notifications sont activées.`,
  )

/**
 * La fin de sa tentative à un défi entre amis : sa place pour l'instant (sur
 * l'écran de la série), à qui il vient de partir (`partiA` : les amis choisis
 * en le lançant), puis de quoi l'envoyer encore — à d'autres amis d'un
 * toucher, aux autres par son lien —, et son classement.
 *
 * Un duel classé (`classe`) ne s'envoie à personne d'autre, ni par lien :
 * il est parti à celui qu'il défie. Joué le premier, sa cote bougera quand
 * l'autre l'aura joué ; joué le second, sa cote se dit au-dessus
 * (`CoteApresLeDuelVue`).
 */
export function FinDuDuel({
  code,
  justes,
  partiA = [],
  classe = false,
  onClassement,
}: {
  code: string
  justes: number
  partiA?: readonly string[]
  classe?: boolean
  onClassement: () => void
}) {
  if (classe) {
    return (
      <>
        {partiA.length > 0 && (
          <p className="card duel-parti" role="status">
            <Icon name="check-circle" />
            <span>{espacesFines(`${partiAvec(partiA)} Ta cote bougera quand ${enPhrase(partiA)} l’aura joué.`)}</span>
          </p>
        )}
        <button type="button" className="btn btn-primary btn-big btn-block" onClick={onClassement}>
          <Icon name="swords" />
          Voir le duel
        </button>
        <p className="muted small centre">
          {espacesFines(`La correction s’ouvre quand ${partiA.length > 0 ? enPhrase(partiA) : 'l’autre'} l’aura joué : avant, elle lui soufflerait les réponses.`)}
        </p>
      </>
    )
  }
  return (
    <>
      {partiA.length > 0 && (
        <p className="card duel-parti" role="status">
          <Icon name="check-circle" />
          <span>{partiAvec(partiA)}</span>
        </p>
      )}
      <EnvoyerAuxAmis code={code} />
      <EnvoyerLeDefi code={code} texte={texteDuDefi(justes)} />
      <button type="button" className="btn btn-block" onClick={onClassement}>
        <Icon name="trophy" />
        Le classement du défi
      </button>
      <p className="muted small centre">La correction s’ouvre à sa fermeture : elle soufflerait les réponses à ceux qui jouent encore.</p>
    </>
  )
}

/**
 * Le gros chiffre d'un duel classé : le sien une fois joué — et, joué des
 * deux côtés, qui l'a gagné —, sinon le score à battre, sinon ce qui reste
 * avant qu'il ferme.
 */
function HudDuDuelClasse({ duel }: { duel: DuelEntreAmis }) {
  const t = duel.tentative
  const ferme = fermeture(duel.minutesRestantes)
  if (t?.finie) {
    const issue =
      duel.aBattre === undefined ? null : t.justes > duel.aBattre ? 'gagné' : t.justes === duel.aBattre ? 'égalité' : 'perdu'
    return (
      <div className="campagne-record-hud">
        <b>{t.justes}</b>
        <span>
          {t.justes > 1 ? 'bonnes réponses' : 'bonne réponse'}
          <br />
          {issue ? `${issue}, ${t.justes} à ${duel.aBattre}` : duel.minutesRestantes > 0 ? 'en attente de l’autre' : 'il ne l’a pas joué'}
        </span>
      </div>
    )
  }
  return (
    <div className="campagne-record-hud">
      <b>{duel.aBattre ?? (t ? t.justes : '–')}</b>
      <span>
        {duel.aBattre !== undefined ? 'bonnes réponses à battre' : t ? 'bonnes réponses pour l’instant' : 'à toi de jouer d’abord'}
        <br />
        {ferme}
      </span>
    </div>
  )
}

/**
 * Un défi entre amis (`/duels#duel-K7M2QX`) : qui l'a lancé, ce qu'il fait
 * jouer, le temps qui reste, sa tentative et le classement ; fermé, sa
 * correction. La partie se joue sur l'écran de la série (`CampagneApp`),
 * comme celle d'un duel classé. Un duel contre quelqu'un s'y lit de même,
 * à deux : le score à battre, ce qui se joue sur sa cote, et — joué des deux
 * côtés — qui l'a gagné, et sa correction.
 */
export function PageDuDuel({
  code,
  onRetour,
  onJouer,
}: {
  code: string
  /** « ← Les duels » : la page d'où l'on vient, sans la recharger. */
  onRetour: () => void
  /** `lance` : le sien, repris — sa fin dit « Défi lancé » ; `contre` : un duel classé, qui l'on affronte et ce qui se joue. */
  onJouer: (tentative: SerieDeCampagne, code: string, lance: boolean, contre?: ContreEnJeu) => void
}) {
  const [duel, setDuel] = useState<DuelEntreAmis | null>(null)
  const [erreur, setErreur] = useState('')
  const [busy, setBusy] = useState(false)
  const [correction, setCorrection] = useState<CorrectionDeCampagne[] | null>(null)
  const { ouvrir: ouvrirLaCarte, carte } = useCarteDUnProfil()

  useEffect(() => {
    let vivant = true
    api.campagne.duel
      .lire(code)
      .then(d => vivant && setDuel(d))
      .catch(e => vivant && setErreur(motifDe(e)))
    return () => {
      vivant = false
    }
  }, [code])

  const relever = async () => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const tentative = await api.campagne.duel.relever(code)
      // Un duel classé : la partie dit à chaque question contre qui, le score à battre et ce qui se joue.
      const enFace = duel?.contre && (duel.auteur.toi ? duel.contre : duel.auteur)
      if (tentative.question)
        onJouer(tentative, code, !!duel?.auteur.toi, enFace ? { nom: enFace.nom, avatar: enFace.avatar, justes: duel.aBattre ?? null, ...(duel.enjeu && { enjeu: duel.enjeu }) } : undefined)
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  const voirCorrection = async (serie: string) => {
    try {
      setCorrection(await api.campagne.correction(serie))
    } catch (e) {
      setErreur(motifDe(e))
    }
  }

  const t = duel?.tentative
  const ouvert = !!duel && duel.minutesRestantes > 0
  const sienne = duel && [...duel.lignes, ...(duel.moi ? [duel.moi] : [])].find(l => l.profileId === duel.sienne)
  const joue = duel ? nomDuChoix(duel.categories ?? [], duel.sujet) : null
  // Un duel classé : deux joueurs, leurs deux cotes en jeu, rien à envoyer à d'autres.
  const contre = duel?.contre

  return (
    <div className="player-shell campagne">
      <Sortie vers="Les duels" href={PAGE_DES_DUELS} onClick={onRetour} />
      <section className="atlas-branche campagne-heros defi-heros" style={lueur(OR)}>
        <span className="atlas-categorie">{contre ? 'Duel classé' : duel?.auteur.toi ? 'Ton défi entre amis' : 'Un défi entre amis'}</span>
        <h1>
          {!duel
            ? 'Le défi'
            : contre
              ? duel.auteur.toi
                ? `Ton duel contre ${contre.nom}`
                : `${duel.auteur.nom} te défie`
              : duel.auteur.toi
                ? 'Qui fera mieux que toi ?'
                : `${duel.auteur.nom} te défie`}
        </h1>
        {duel && contre ? (
          <HudDuDuelClasse duel={duel} />
        ) : (
          <div className="campagne-record-hud">
            {t?.finie || (t && !ouvert) ? <b>{t.justes}</b> : <b>{duel ? duel.joueurs : '–'}</b>}
            <span>
              {t?.finie || (t && !ouvert) ? (
                <>
                  {t.justes > 1 ? 'bonnes réponses' : 'bonne réponse'}
                  <br />
                  {(sienne && placeDuJour(sienne.rang, duel!.joueurs, sienne.justes)) ?? 'ta tentative est jouée'}
                </>
              ) : (
                <>
                  {/* Joué, pas relevé : son auteur y compte, et l'on ne relève pas son propre défi. */}
                  {!duel ? 'joueurs' : duel.joueurs === 0 ? 'personne ne l’a joué' : duel.joueurs > 1 ? 'joueurs l’ont joué' : 'joueur l’a joué'}
                  <br />
                  {duel ? fermeture(duel.minutesRestantes) : '…'}
                </>
              )}
            </span>
          </div>
        )}
        <ul className="campagne-puces">
          <li>
            <Icon name="list" /> {joue ?? 'toutes les catégories'}
          </li>
          <li>
            <Icon name="target" /> le même tirage pour chacun, une seule tentative
          </li>
          <li>
            <Icon name="timer" /> trois vies, sans chrono
          </li>
          <li>
            {contre ? (
              <>
                <Icon name="swords" /> classé : vos deux cotes se jouent
              </>
            ) : (
              <>
                <Icon name="users" /> amical : il ne change pas ta cote
              </>
            )}
          </li>
        </ul>
      </section>
      {/* Joué des deux côtés : ce qu'il a fait à sa cote. */}
      {contre && duel?.ecart !== undefined && (
        <p className={'card duels-fin-ecart-ligne ' + (duel.ecart >= 0 ? 'duels-plus' : 'duels-moins')} role="status">
          {espacesFines(`Ta cote : ${ecartSigne(duel.ecart)}`)}
        </p>
      )}

      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}

      {duel && ouvert && !t && (
        <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void relever()}>
          <Icon name={contre ? 'swords' : 'play'} />
          {contre ? (duel.auteur.toi ? 'Jouer mon duel' : 'Relever le duel') : 'Relever le défi'}
        </button>
      )}
      {duel && ouvert && t && !t.finie && (
        <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void relever()}>
          <Icon name="play" />
          {`${contre ? 'Reprendre mon duel' : 'Reprendre mon défi'} · ${bonnes(t.justes)}`}
        </button>
      )}
      {/* Avant de jouer : le score à battre, et ce qui se joue sur sa cote — on sait pour quoi on joue. */}
      {duel && ouvert && contre && !t?.finie && (duel.aBattre !== undefined || duel.enjeu) && (
        <p className="muted small centre duels-sous-bouton">
          {duel.aBattre !== undefined && <b>{espacesFines(`${bonnes(duel.aBattre)} à battre. `)}</b>}
          {duel.enjeu && (
            <>
              En jeu : <b className="duels-plus">{ecartSigne(duel.enjeu.gagne)}</b> si tu gagnes, <b className="duels-moins">{ecartSigne(duel.enjeu.perdu)}</b> si tu perds.
            </>
          )}
        </p>
      )}
      {/* Joué le premier : il attend l'autre. */}
      {duel && ouvert && contre && duel.auteur.toi && t?.finie && duel.ecart === undefined && (
        <p className="muted small centre">{espacesFines(`Parti à ${contre.nom} : vos deux cotes bougeront quand le duel sera joué des deux côtés.`)}</p>
      )}
      {duel && !ouvert && !t && (
        <p className="muted small centre">{contre ? 'Ce duel est fermé : il ne compte plus. Défie quelqu’un depuis tes duels.' : 'Ce défi est fermé : son classement est figé. Lance le tien depuis tes duels.'}</p>
      )}

      {/* Le sien, pas encore joué jusqu'au bout : à qui il partira à sa dernière réponse. */}
      {duel && ouvert && duel.prevus && duel.prevus.length > 0 && (
        <p className="card duel-parti duel-prevu">
          <Icon name="users" />
          <span>{espacesFines(`À ta dernière réponse, il partira à ${enPhrase(duel.prevus)}, ton score à battre avec lui.`)}</span>
        </p>
      )}
      {/* Le sien, ouvert : à d'autres amis d'un toucher, aux autres par son lien. Un duel classé, lui, est parti à qui il défie. */}
      {duel && ouvert && !contre && duel.auteur.toi && <EnvoyerAuxAmis code={duel.code} />}
      {duel && ouvert && !contre && (duel.auteur.toi || t?.finie) && (
        <EnvoyerLeDefi code={duel.code} texte={texteDuDefi(t?.finie ? t.justes : null)} />
      )}

      {duel && (
        <section className="defi-classement" aria-labelledby="duel-classement-titre">
          <h2 id="duel-classement-titre" className="label">
            {contre ? 'Le score' : ouvert ? 'Le classement, pour l’instant' : 'Le classement final'}
          </h2>
          {duel.joueurs === 0 ? (
            <p className="muted small">{contre ? 'Personne n’a encore joué ce duel.' : 'Personne n’a encore répondu : la première place t’attend.'}</p>
          ) : (
            <div className="leaderboard">
              {duel.lignes.map(l => (
                <LigneDuDefiVue key={l.profileId} ligne={l} moi={l.profileId === duel.sienne} onOuvrir={ouvrirLaCarte} />
              ))}
              {duel.moi && (
                <>
                  <p className="muted center small">…</p>
                  <LigneDuDefiVue ligne={duel.moi} moi onOuvrir={ouvrirLaCarte} />
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* Fermé — ou un duel classé joué des deux côtés, qui n'a plus personne à qui souffler ses réponses. */}
      {duel && (!ouvert || duel.corrige) && t && !correction && (
        <button type="button" className="btn btn-block" onClick={() => void voirCorrection(t.id)}>
          <Icon name="book" />
          {contre ? 'La correction du duel' : 'La correction du défi'}
        </button>
      )}
      {correction && (
        <ol className="campagne-correction">
          {correction.map((c, i) => (
            <li key={i} className={'card ' + (c.juste ? 'campagne-juste' : 'campagne-rate')}>
              <span className="label">{NOM_NIVEAU[c.niveau]}</span>
              <p>{espacesFines(c.texte)}</p>
              <p className="muted small">
                <Shape index={c.bonne} inline /> {espacesFines(c.reponses[c.bonne])}
                {!c.juste && c.choix !== null && <> · tu avais dit {espacesFines(c.reponses[c.choix])}</>}
              </p>
              {c.anecdote && <p className="small campagne-anecdote">{espacesFines(c.anecdote)}</p>}
            </li>
          ))}
        </ol>
      )}
      {carte}
    </div>
  )
}

/**
 * La cloche des défis, chargée avec la page des duels seulement : elle tire
 * le service worker et l'abonnement (`rappel.ts`), que la campagne et
 * l'accueil n'ont pas à télécharger. Son téléphone sonne quand on le défie,
 * et quand un duel qu'il a lancé vient d'être joué.
 */
const cloche = aLaDemande(() => import('../components/ClocheDesDefis'))
export function LaClocheDesDefis() {
  const laCloche = useALaDemande(cloche)
  return laCloche && laCloche !== 'perdu' ? <laCloche.ClocheDesDefis /> : null
}

/**
 * Ce qu'on lui a envoyé, en tête de la page des duels : qui le défie, sur
 * quoi, le score à battre, le temps qui reste — un toucher, et il le relève.
 * Un duel classé le dit : sa cote s'y joue. Rien tant qu'on ne lui a rien
 * envoyé.
 */
export function DefisRecus({ recus, onOuvrir }: { recus: readonly DefiRecu[]; onOuvrir: (code: string) => void }) {
  if (recus.length === 0) return null
  return (
    <section className="duel-liste duel-recus" aria-labelledby="defis-recus-titre">
      <h2 id="defis-recus-titre" className="label">
        On te défie
      </h2>
      <ul>
        {recus.map(d => (
          <li key={d.code}>
            <button type="button" className="btn btn-block duel-ligne" onClick={() => onOuvrir(d.code)}>
              <span>
                <b>
                  <span aria-hidden="true">
                    <Avatar avatar={d.auteur.avatar} finition={d.auteur.finition} legendaire={d.auteur.legendaire} eclat={d.auteur.eclat} />
                  </span>{' '}
                  {`${d.auteur.nom} te défie`}
                </b>
                <span className="muted small">
                  {[
                    d.classe ? 'duel classé' : null,
                    nomDuChoix(d.categories ?? [], d.sujet) ?? 'toutes les catégories',
                    d.score !== undefined ? `${bonnes(d.score)} à battre` : null,
                    fermeture(d.minutesRestantes),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className="duel-score">Relever</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** « Contre Tom · Cinéma & séries · gagné 11 à 9 » : la ligne d'un de ses duels contre quelqu'un, et ce qu'elle dit au bout. */
export function ligneDuDuelContre(d: DuelContre): { titre: string; detail: string; score: string } {
  const quoi = nomDuChoix(d.categories ?? [], d.sujet) ?? 'toutes les catégories'
  const ouvert = d.minutesRestantes > 0
  const titre = d.lance ? `Contre ${d.contre.nom}` : `${d.contre.nom} t’a défié`
  if (d.justes !== null && d.sesJustes !== null) {
    const issue = d.justes > d.sesJustes ? 'gagné' : d.justes === d.sesJustes ? 'égalité' : 'perdu'
    return { titre, detail: `${quoi} · ${issue} ${d.justes} à ${d.sesJustes}`, score: d.ecart !== undefined ? ecartSigne(d.ecart) : issue }
  }
  if (!ouvert) return { titre, detail: `${quoi} · ${d.justes === null ? 'pas joué' : `${d.contre.nom} ne l’a pas joué`}`, score: 'fermé' }
  if (d.justes === null) return { titre, detail: [quoi, d.sesJustes !== null ? `${bonnes(d.sesJustes)} à battre` : null, fermeture(d.minutesRestantes)].filter(Boolean).join(' · '), score: 'à toi' }
  return { titre, detail: `${quoi} · ${bonnes(d.justes)} pour toi · ${fermeture(d.minutesRestantes)}`, score: 'à lui' }
}

/** Un duel contre quelqu'un encore en route : ouvert, et pas encore joué des deux côtés — à lui, ou à l'autre. */
export const duelEnRoute = (d: DuelContre) => d.minutesRestantes > 0 && (d.justes === null || d.sesJustes === null)

/**
 * Ses duels contre quelqu'un : ceux où c'est à lui de jouer, ceux qui
 * attendent l'autre — en vue, sous « Défier quelqu'un » —, ou les joués et
 * les fermés, sous « Tes duels joués », repliés (`joues`) : la page qui
 * montrait tout à la suite se lisait mal (la remarque du propriétaire du
 * 11 octobre 2026). Chacun ouvre sa page. Ce qu'on vient de lui envoyer est
 * au-dessus (`DefisRecus`), pas ici une seconde fois.
 */
export function TesDuelsContre({
  duels,
  recus,
  joues = false,
  onOuvrir,
}: {
  duels: readonly DuelContre[]
  recus: readonly DefiRecu[]
  joues?: boolean
  onOuvrir: (code: string) => void
}) {
  const dejaAuDessus = new Set(recus.map(r => r.code))
  const montres = duels.filter(d => !dejaAuDessus.has(d.code) && duelEnRoute(d) !== joues)
  if (montres.length === 0) return null
  const titre = joues ? 'Contre quelqu’un' : 'Tes duels'
  return (
    <section className="duel-liste" aria-labelledby={joues ? 'duels-joues-titre' : 'duels-contre-titre'}>
      <h2 id={joues ? 'duels-joues-titre' : 'duels-contre-titre'} className="label">
        {titre}
      </h2>
      <ul>
        {montres.map(d => {
          const l = ligneDuDuelContre(d)
          return (
            <li key={d.code}>
              <button type="button" className="btn btn-block duel-ligne" onClick={() => onOuvrir(d.code)}>
                <span>
                  <b>
                    <span aria-hidden="true">{d.contre.avatar}</span> {l.titre}
                  </b>
                  <span className="muted small">{l.detail}</span>
                </span>
                <span className={'duel-score' + (d.ecart !== undefined ? (d.ecart >= 0 ? ' duels-plus' : ' duels-moins') : '')}>{l.score}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * La ligne d'un de ses défis : à qui il est, sur quoi, qui l'a joué, le temps
 * qui reste — et sa place, ou ce qu'il lui reste à faire. Personne encore :
 * rien à compter (« 0 joueur » ne disait rien). Et son propre défi se joue,
 * il ne se relève pas : il part à ses amis à sa dernière réponse.
 */
export function ligneDuDuel(d: ResumeDuDuel): { titre: string; detail: string; score: string } {
  const joueurs = d.joueurs > 0 ? `${d.joueurs} joueur${d.joueurs > 1 ? 's' : ''}` : null
  return {
    // « Le défi d’Aline » ; « Un joueur », le nom d'un profil masqué, s'élide sans sa majuscule.
    titre: d.auteur === 'toi' ? 'Ton défi' : d.auteur === 'Un joueur' ? 'Le défi d’un joueur' : `Le défi ${deNom(d.auteur)}`,
    detail: [nomDuChoix(d.categories ?? [], d.sujet) ?? 'toutes les catégories', joueurs, fermeture(d.minutesRestantes)].filter(Boolean).join(' · '),
    score:
      d.justes !== null && d.rang !== null
        ? `${d.rang}${d.rang === 1 ? 'er' : 'e'} · ${d.justes} bonne${d.justes > 1 ? 's' : ''}`
        : d.auteur === 'toi'
          ? 'à jouer'
          : 'à relever',
  }
}

/**
 * Ses défis entre amis, dans la page des duels : ceux qu'il a lancés ou
 * relevés ces trente derniers jours — un lien perdu ne perd pas le défi.
 * Rien tant qu'il n'en a aucun : « Défier un ami » dit comment en lancer un.
 */
export function MesDuels({ onOuvrir }: { onOuvrir: (code: string) => void }) {
  const [duels, setDuels] = useState<ResumeDuDuel[] | null>(null)
  useEffect(() => {
    let vivant = true
    api.campagne.duel
      .miens()
      .then(d => vivant && setDuels(d))
      // Une liste qui ne vient pas ne cache rien d'autre : le défi de la semaine est là.
      .catch(() => vivant && setDuels([]))
    return () => {
      vivant = false
    }
  }, [])
  if (!duels || duels.length === 0) return null
  return (
    <section className="duel-liste" aria-labelledby="mes-duels-titre">
      <h2 id="mes-duels-titre" className="label">
        Tes défis entre amis
      </h2>
      <ul>
        {duels.map(d => {
          const l = ligneDuDuel(d)
          return (
            <li key={d.code}>
              <button type="button" className="btn btn-block duel-ligne" onClick={() => onOuvrir(d.code)}>
                <span>
                  <b>{l.titre}</b>
                  <span className="muted small">{l.detail}</span>
                </span>
                <span className="duel-score">{l.score}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
