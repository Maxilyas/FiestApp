import { useEffect, useState, type ReactNode } from 'react'
import { api, motifDe } from '../api'
import { Icon } from '../components/Icon'
import { Sortie } from '../components/Pieces'
import { Shape } from '../components/Shape'
import { BoutonCopier, BoutonPartager } from '../components/Partage'
import { OR, lueur } from '../components/Atlas'
import { espacesFines } from '../format'
import { placeDuJour } from '../../../shared/course'
import { NOM_NIVEAU, type AmiDeCampagne, type CorrectionDeCampagne, type DefiRecu, type DuelEntreAmis, type ResumeDuDuel, type SerieDeCampagne } from '../../../shared/campagne'
import { LigneDuDefiVue, useCarteDuClassement } from './Defi'
import { aLaDemande, useALaDemande } from '../aLaDemande'
import { nomDuChoix } from '../../../shared/nomDuChoix'

/** L'adresse d'un défi entre amis, dans la campagne : son lien. */
export const adresseDuDuel = (code: string) => `#duel-${code}`

/** L'adresse où l'on prépare un défi entre amis (`LancerUnDefi`, chargé à la demande). */
export const ADRESSE_DU_LANCEMENT = '#defier'
const lienDuDuel = (code: string) => `${window.location.origin}/campagne${adresseDuDuel(code)}`

const bonnes = (n: number) => `${n} bonne${n > 1 ? 's' : ''} réponse${n > 1 ? 's' : ''}`

/** Ce que dit le message qui part avec le lien : son score, s'il a joué. */
export const texteDuDefi = (justes: number | null) =>
  justes === null ? 'Un défi à la campagne de FiestApp : feras-tu mieux que moi ?' : `${bonnes(justes)} à ce défi de la campagne de FiestApp : feras-tu mieux ?`

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
        <BoutonPartager titre="Un défi à la campagne de FiestApp" texte={texte} url={lien} className="btn btn-primary" />
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
 * entre amis (`shared/campagne.ts`) : il les attend sous leur onglet du
 * défi, sans lien à faire suivre, et leur téléphone sonne. Rien de coché
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
        {espacesFines('Tes amis viendront ici : ceux qui relèvent un de tes défis, ou dont tu en relèves un. La prochaine fois, ton défi les attendra sous leur onglet Défi, sans lien à envoyer.')}
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

/** « Parti à Tom et Inès : … » — ce qui vient de leur arriver, sans promettre une notification qu'ils n'ont peut-être pas voulue. */
const partiAvec = (noms: readonly string[]) =>
  espacesFines(
    `Parti à ${enPhrase(noms)} : il ${noms.length > 1 ? 'les ' : 'l’'}attend sous ${noms.length > 1 ? 'leur' : 'son'} onglet Défi, et ${noms.length > 1 ? 'leur' : 'son'} téléphone sonne s’${noms.length > 1 ? 'ils ont' : 'il a'} activé les notifications.`,
  )

/**
 * La fin de sa tentative à un défi entre amis : sa place pour l'instant (sur
 * l'écran de la série), à qui il vient de partir (`partiA` : les amis choisis
 * en le lançant), puis de quoi l'envoyer encore — à d'autres amis d'un
 * toucher, aux autres par son lien —, et son classement.
 */
export function FinDuDuel({ code, justes, partiA = [], onClassement }: { code: string; justes: number; partiA?: readonly string[]; onClassement: () => void }) {
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
 * Un défi entre amis (`/campagne#duel-K7M2QX`) : qui l'a lancé, ce qu'il
 * fait jouer, le temps qui reste, sa tentative et le classement ; fermé, sa
 * correction. La partie se joue sur l'écran de la série (`CampagneApp`),
 * comme celle du défi de la semaine.
 */
export function PageDuDuel({
  code,
  onglets,
  onJouer,
}: {
  code: string
  onglets: ReactNode
  /** `lance` : le sien, repris — sa fin dit « Défi lancé ». */
  onJouer: (tentative: SerieDeCampagne, code: string, lance: boolean) => void
}) {
  const [duel, setDuel] = useState<DuelEntreAmis | null>(null)
  const [erreur, setErreur] = useState('')
  const [busy, setBusy] = useState(false)
  const [correction, setCorrection] = useState<CorrectionDeCampagne[] | null>(null)
  const { ouvrir: ouvrirLaCarte, carte } = useCarteDuClassement()

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
      if (tentative.question) onJouer(tentative, code, !!duel?.auteur.toi)
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

  return (
    <div className="player-shell campagne">
      <Sortie />
      {onglets}
      <section className="atlas-branche campagne-heros defi-heros" style={lueur(OR)}>
        <span className="atlas-categorie">{duel?.auteur.toi ? 'Ton défi entre amis' : 'Un défi entre amis'}</span>
        <h1>{!duel ? 'Le défi' : duel.auteur.toi ? 'Qui fera mieux que toi ?' : `${duel.auteur.nom} te défie`}</h1>
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
                {duel && duel.joueurs > 1 ? 'joueurs l’ont relevé' : 'joueur l’a relevé'}
                <br />
                {duel ? fermeture(duel.minutesRestantes) : '…'}
              </>
            )}
          </span>
        </div>
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
        </ul>
      </section>

      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}

      {duel && ouvert && !t && (
        <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void relever()}>
          <Icon name="play" />
          Relever le défi
        </button>
      )}
      {duel && ouvert && t && !t.finie && (
        <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void relever()}>
          <Icon name="play" />
          {`Reprendre mon défi · ${bonnes(t.justes)}`}
        </button>
      )}
      {duel && !ouvert && !t && <p className="muted small centre">Ce défi est fermé : son classement est figé. Lance le tien depuis l’onglet du défi.</p>}

      {/* Le sien, pas encore joué jusqu'au bout : à qui il partira à sa dernière réponse. */}
      {duel && ouvert && duel.prevus && duel.prevus.length > 0 && (
        <p className="card duel-parti duel-prevu">
          <Icon name="users" />
          <span>{espacesFines(`À ta dernière réponse, il partira à ${enPhrase(duel.prevus)}, ton score à battre avec lui.`)}</span>
        </p>
      )}
      {/* Le sien, ouvert : à d'autres amis d'un toucher, aux autres par son lien. */}
      {duel && ouvert && duel.auteur.toi && <EnvoyerAuxAmis code={duel.code} />}
      {duel && ouvert && (duel.auteur.toi || t?.finie) && (
        <EnvoyerLeDefi code={duel.code} texte={texteDuDefi(t?.finie ? t.justes : null)} />
      )}

      {duel && (
        <section className="defi-classement" aria-labelledby="duel-classement-titre">
          <h2 id="duel-classement-titre" className="label">
            {ouvert ? 'Le classement, pour l’instant' : 'Le classement final'}
          </h2>
          {duel.joueurs === 0 ? (
            <p className="muted small">Personne n’a encore répondu : la première place t’attend.</p>
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

      {duel && !ouvert && t && !correction && (
        <button type="button" className="btn btn-block" onClick={() => void voirCorrection(t.id)}>
          <Icon name="book" />
          La correction du défi
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
 * Défier un ami, en tête de l'onglet du défi (le souhait du propriétaire du
 * 11 octobre 2026 : « choisir avec qui je le lance, sur quel thème ») : ses
 * amis en visages — un toucher, et le défi se prépare pour lui —, ou
 * « Lancer un défi », qui demande à qui et sur quoi (`LancerUnDefi`). Puis la
 * cloche des défis : son téléphone sonne quand un ami le défie. Il était
 * sous la série, à lancer sur les catégories qu'on y avait choisies, sans
 * dire à qui il partirait.
 */
export function DefierUnAmi({ amis, onLancer }: { amis: readonly AmiDeCampagne[] | null; onLancer: (ami?: AmiDeCampagne) => void }) {
  return (
    <section className="card defier-un-ami" aria-labelledby="defier-un-ami-titre">
      <div className="defier-un-ami-tete">
        <span className="gros-icone" aria-hidden="true">
          <Icon name="users" />
        </span>
        <div>
          <h2 id="defier-un-ami-titre">Défier un ami</h2>
          <p className="muted small">{espacesFines('Choisis qui et sur quoi : tu joues d’abord, et ton score à battre lui part à ta dernière réponse.')}</p>
        </div>
      </div>
      {amis && amis.length > 0 && (
        <ul className="defier-visages" aria-label="Défier l’un de tes amis">
          {amis.slice(0, VISAGES_MONTRES).map(a => (
            <li key={a.profileId}>
              <button type="button" className="defier-visage" aria-label={`Défier ${a.nom}`} onClick={() => onLancer(a)}>
                <span className="defier-visage-avatar" aria-hidden="true">
                  {a.avatar}
                </span>
                <span className="defier-visage-nom" aria-hidden="true">
                  {a.nom}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-primary btn-block" onClick={() => onLancer()}>
        <Icon name="plus" />
        Lancer un défi
      </button>
      <LaClocheDesDefis />
    </section>
  )
}

/**
 * La cloche des défis, chargée avec l'onglet du défi seulement : elle tire
 * le service worker et l'abonnement (`rappel.ts`), que la série, qui ouvre
 * le plus souvent la campagne, n'a pas à télécharger.
 */
const cloche = aLaDemande(() => import('../components/ClocheDesDefis'))
function LaClocheDesDefis() {
  const laCloche = useALaDemande(cloche)
  return laCloche && laCloche !== 'perdu' ? <laCloche.ClocheDesDefis /> : null
}

/** Les visages d'amis en tête de l'onglet : une rangée au téléphone — les autres, dans « Lancer un défi » et sous « Tes amis ». */
const VISAGES_MONTRES = 5

/**
 * Les défis que ses amis lui ont envoyés, en tête de l'onglet du défi : qui
 * le défie, sur quoi, le temps qui reste — un toucher, et il le relève.
 * Rien tant qu'on ne lui a rien envoyé.
 */
export function DefisRecus({ recus, onOuvrir }: { recus: readonly DefiRecu[]; onOuvrir: (code: string) => void }) {
  if (recus.length === 0) return null
  return (
    <section className="duel-liste duel-recus" aria-labelledby="defis-recus-titre">
      <h2 id="defis-recus-titre" className="label">
        Tes amis te défient
      </h2>
      <ul>
        {recus.map(d => (
          <li key={d.code}>
            <button type="button" className="btn btn-block duel-ligne" onClick={() => onOuvrir(d.code)}>
              <span>
                <b>
                  <span aria-hidden="true">{d.auteur.avatar}</span> {`${d.auteur.nom} te défie`}
                </b>
                <span className="muted small">{[nomDuChoix(d.categories ?? [], d.sujet) ?? 'toutes les catégories', fermeture(d.minutesRestantes)].join(' · ')}</span>
              </span>
              <span className="duel-score">Relever</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Ses amis, sous ses défis : ceux qui ont relevé un de ses défis, ou dont il
 * a relevé un — ce qui fait un ami, dit en une phrase, puisqu'on ne
 * l'ajoute pas soi-même. Chacun se défie d'un toucher (`LancerUnDefi`, lui
 * déjà choisi), et se retire, après confirmation ; il revient s'ils jouent
 * de nouveau ensemble. Sans ami encore : comment ça marche.
 */
export function TesAmis({ amis, onDefier, onRetirer }: { amis: readonly AmiDeCampagne[]; onDefier: (ami: AmiDeCampagne) => void; onRetirer: (ami: AmiDeCampagne) => void }) {
  return (
    <section className="duel-liste tes-amis" aria-labelledby="tes-amis-titre">
      <h2 id="tes-amis-titre" className="label">
        {amis.length > 0 ? `Tes amis · ${amis.length}` : 'Défier des amis : comment ça marche'}
      </h2>
      {amis.length > 0 ? (
        <>
          <ul className="tes-amis-liste">
            {amis.map(a => (
              <li key={a.profileId}>
                <span className="duel-ami-avatar" aria-hidden="true">
                  {a.avatar}
                </span>
                <span className="duel-ami-nom">{a.nom}</span>
                <button type="button" className="btn btn-small tes-amis-defier" aria-label={`Défier ${a.nom}`} onClick={() => onDefier(a)}>
                  <Icon name="trophy" />
                  Défier
                </button>
                <button type="button" className="btn btn-ghost btn-small" aria-label={`Retirer ${a.nom} de mes amis`} onClick={() => onRetirer(a)}>
                  Retirer
                </button>
              </li>
            ))}
          </ul>
          <p className="muted small">
            {espacesFines('Ceux qui ont relevé un de tes défis, ou dont tu en as relevé un. Défie-les en lançant un défi : tu le joues d’abord, et à ta dernière réponse il leur part — sous leur onglet Défi, et leur téléphone sonne.')}
          </p>
        </>
      ) : (
        <ol className="muted small tes-amis-etapes">
          <li>{espacesFines('« Lancer un défi », en haut de cet onglet : choisis le thème, et tu le joues le premier.')}</li>
          <li>{espacesFines('À sa fin, envoie son lien : qui l’ouvre, profil en main, joue les mêmes questions, une fois, dans la semaine.')}</li>
          <li>{espacesFines('Ceux qui le relèvent deviennent tes amis : le prochain, tu les choisis en le lançant — il leur part à ta dernière réponse, et leur téléphone sonne.')}</li>
        </ol>
      )}
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
    titre: d.auteur === 'toi' ? 'Ton défi' : `Le défi de ${d.auteur}`,
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
 * Ses défis entre amis, sous le défi de la semaine : ceux qu'il a lancés ou
 * relevés ces trente derniers jours — un lien perdu ne perd pas le défi.
 * Rien tant qu'il n'en a aucun : la série dit comment en lancer un.
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
