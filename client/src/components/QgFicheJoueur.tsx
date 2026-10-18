import { useEffect, useState, type ReactNode } from 'react'
import { api, motifDe } from '../api'
import { ChampNombre } from './ChampNombre'
import { confirmDialog, promptDialog } from './Dialog'
import { Icon, type IconName } from './Icon'
import { showToast } from '../state'
import { copierTexte } from '../copier'
import { espacesFines } from '../format'
import { formatNumber } from '../../../shared/typographie'
import { MAX_NAME_LENGTH } from '../../../shared/avatars'
import { LIGUES } from '../../../shared/duels'
import { MODES_DU_QG, NOM_DU_MODE, heureEcrite, quandEcrit, type GesteDuQg } from '../../../shared/qg'
import { totalDesModes, type ActiviteDUnJoueur } from '../../../shared/qgActivite'
import { CONFETTIS_PAR_DON_MAX, MOT_D_UN_DON_MAX, type FicheDuJoueur, type ProfilDAdministration } from '../../../shared/profil'

/** « 1 joué », « 0 gagné », « 3 joués » : zéro s'écrit au singulier. */
const pluriel = (n: number, mot: string) => `${formatNumber(n)} ${mot}${n > 1 ? 's' : ''}`
const nConfettis = (n: number) => pluriel(n, 'confetti')

/**
 * Ses trente jours, sur quoi il s'acharne (le souhait du propriétaire du
 * 17 octobre 2026) : ses questions jouées et ses jours, puis chaque mode où
 * il a joué, le plus joué d'abord — « 340 questions en 12 jours : campagne
 * 280, quiz du jour 60 ». La page de l'activité les montre en barres.
 */
export function sesTrenteJours(a: ActiviteDUnJoueur): string {
  const total = totalDesModes(a.questions)
  const parties = totalDesModes(a.parties)
  if (total === 0 && parties === 0) return 'rien joué'
  // Une partie commencée, la première question pas encore jouée : « 0 question en 1 jour » ne se lisait pas.
  if (total === 0) return `${pluriel(parties, 'partie')} commencée${parties > 1 ? 's' : ''}, aucune question jouée`
  const modes = MODES_DU_QG.filter(m => a.questions[m] > 0)
    .sort((x, y) => a.questions[y] - a.questions[x])
    .map(m => `${NOM_DU_MODE[m].toLowerCase()} ${formatNumber(a.questions[m])}`)
  return `${pluriel(total, 'question')} en ${pluriel(a.jours, 'jour')}${modes.length > 0 ? ` : ${modes.join(', ')}` : ''}`
}

/**
 * La fiche d'un joueur, au QG (`/admin#profils`, dans la feuille qu'ouvre sa
 * ligne) : où il en est dans chaque mode, ses confettis, sa connexion,
 * l'épreuve qui l'attend — puis ce qu'on peut faire pour lui (les choix du
 * 13 octobre 2026) : lui offrir des confettis, l'aider à se reconnecter,
 * rouvrir sa connexion fermée, libérer son épreuve, changer un prénom qui ne
 * va pas, le suspendre ou le réactiver, le supprimer — et, du 14 octobre, le
 * remettre au classement s'il est masqué, et s'offrir des confettis sur son
 * propre profil. Et, dessous, ce que l'administrateur a déjà fait pour lui,
 * lu au journal des gestes.
 */
export function FicheDuJoueurAuQg({
  profil,
  onChange,
  onSupprimer,
}: {
  /** Le profil à lire : son identifiant suffit — « Les profils » et l'activité l'ouvrent de leur ligne. */
  profil: Pick<ProfilDAdministration, 'id'>
  /** Un prénom, une suspension ont changé : la liste des profils se relit, la feuille reprend son titre. */
  onChange: (f: FicheDuJoueur) => void
  onSupprimer: (p: ProfilDAdministration) => void
}) {
  const [fiche, setFiche] = useState<FicheDuJoueur | null>(null)
  const [gestes, setGestes] = useState<GesteDuQg[] | null>(null)
  const [error, setError] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [don, setDon] = useState<{ confettis: number; mot: string } | null>(null)
  // Le code de secours tiré : montré ici une seule fois, jamais relu.
  const [code, setCode] = useState<{ code: string; login: string } | null>(null)

  const charger = (): Promise<FicheDuJoueur | null> =>
    Promise.all([api.admin.fiche(profil.id), api.admin.gestes({ cible: profil.id })]).then(
      ([f, j]) => {
        setFiche(f)
        setGestes(j.gestes)
        return f
      },
      e => {
        setError(motifDe(e))
        return null
      },
    )
  useEffect(() => {
    void charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profil.id])

  /** Un geste : refusé, il le dit ; fait, la fiche et son journal se relisent. */
  const geste = async (faire: () => Promise<unknown>, merci: string, { liste = false } = {}) => {
    if (occupe) return
    setOccupe(true)
    try {
      await faire()
      showToast({ kind: 'info', message: merci })
      const relue = await charger()
      if (liste && relue) onChange(relue)
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(false)
    }
  }

  if (error) return <p className="error">{error}</p>
  if (!fiche) return <p className="serif-note">Chargement…</p>
  const f = fiche
  const maintenant = Date.now()

  const offrir = () =>
    don &&
    geste(
      async () => {
        await api.admin.offrirDesConfettis(f.id, don.confettis, don.mot)
        setDon(null)
      },
      f.toi ? `${nConfettis(don.confettis)} ajouté${don.confettis > 1 ? 's' : ''} à ton solde` : `${nConfettis(don.confettis)} offert${don.confettis > 1 ? 's' : ''} à ${f.nom}`,
    )

  const reconnecter = async () => {
    const ok = await confirmDialog({
      title: 'Lui tirer un code de secours neuf ?',
      message: `Tu le transmets à ${f.nom}, qui le tape dans « Mot de passe oublié ? » avec son identifiant, @${f.login}, puis choisit un mot de passe. Son code d’avant ne vaudra plus rien.`,
      confirmLabel: 'Tirer un code neuf',
    })
    if (ok) await geste(async () => setCode(await api.admin.codeDeSecours(f.id)), 'Code tiré : transmets-le, il ne sera plus affiché')
  }

  const renommer = async () => {
    const nom = await promptDialog({
      title: 'Changer son prénom',
      message: 'Pour un prénom qui ne va pas, pas pour départager deux homonymes : la salle les distingue d’elle-même. Ses soirées passées gardent l’ancien, et son accueil le lui dira.',
      input: { value: f.nom, maxLength: MAX_NAME_LENGTH },
      confirmLabel: 'Changer',
    })
    if (nom && nom !== f.nom) await geste(() => api.admin.renommer(f.id, nom), 'Prénom changé', { liste: true })
  }

  const suspendre = async () => {
    const ok = await confirmDialog({
      title: `Suspendre le profil de ${f.nom} ?`,
      // Le profil, jamais la personne : un prénom ne dit pas qui l'on est.
      message: 'Ses sessions tombent et le profil ne s’ouvre plus — le bon mot de passe dira qu’il est suspendu —, puis il disparaît des classements, de la recherche et des cartes. Rien ne s’efface : réactivé, il retrouve tout.',
      confirmLabel: 'Suspendre',
      danger: true,
    })
    if (ok) await geste(() => api.admin.suspendre(f.id), 'Profil suspendu', { liste: true })
  }

  const ligue = f.duels ? LIGUES.find(l => l.cle === f.duels!.ligue) : undefined
  const fermee = f.connexion.fermeeJusquA !== null && f.connexion.fermeeJusquA > maintenant
  // Ce qui l'aide, d'un côté, ce qui le modère, de l'autre : un coup de main
  // se donne sans y penser, une suspension se pèse — mêlés en une seule
  // rangée, « Suspendre » et « Supprimer le profil » suivaient les coups de main.
  const aider = [
    // Sur son propre profil aussi : c'est son serveur (le 14 octobre 2026).
    !f.suspendu && !don && (
      <Geste key="don" icone="sparkles" onClick={() => setDon({ confettis: 50, mot: '' })}>
        {f.toi ? 'T’offrir des confettis' : 'Offrir des confettis'}
      </Geste>
    ),
    !f.suspendu && (
      <Geste key="code" icone="lock" occupe={occupe} onClick={() => void reconnecter()}>
        Tirer un code de secours
      </Geste>
    ),
    fermee && (
      <Geste key="verrou" icone="clock" occupe={occupe} onClick={() => void geste(() => api.admin.rouvrirLaConnexion(f.id), 'Connexion rouverte')}>
        Lever le verrou de connexion
      </Geste>
    ),
    f.epreuve && (
      <Geste key="epreuve" icone="target" occupe={occupe} onClick={() => void geste(() => api.admin.libererLEpreuve(f.id), 'Épreuve libérée, sans lui coûter de vie')}>
        Libérer l’épreuve
      </Geste>
    ),
  ].filter(Boolean)
  // Le masque se pose depuis les classements — du quiz du jour, des duels —,
  // et se lève aussi d'ici, où la fiche dit « hors classement » : il ne se
  // levait qu'en bas de la page du quiz du jour (« Je ne peux pas annuler
  // l'action de masquer un profil ? », le 14 octobre 2026). Même sur son
  // propre profil, et suspendu : la route les trouve.
  const moderer = [
    !f.toi && (
      <Geste key="prenom" icone="edit" occupe={occupe} onClick={() => void renommer()}>
        Changer son prénom
      </Geste>
    ),
    f.masque && (
      <Geste key="classement" icone="eye" occupe={occupe} onClick={() => void geste(() => api.admin.masquerDuJour(f.id, false), `Profil remis au classement : ${f.nom}`)}>
        Remettre au classement
      </Geste>
    ),
    !f.toi &&
      (f.suspendu ? (
        <Geste key="reactiver" icone="play" occupe={occupe} onClick={() => void geste(() => api.admin.reactiver(f.id), 'Profil réactivé', { liste: true })}>
          Réactiver
        </Geste>
      ) : (
        <Geste key="suspendre" icone="pause" occupe={occupe} onClick={() => void suspendre()}>
          Suspendre
        </Geste>
      )),
    !f.toi && (
      <Geste key="supprimer" icone="trash" danger occupe={occupe} onClick={() => onSupprimer(f)}>
        Supprimer le profil
      </Geste>
    ),
  ].filter(Boolean)
  return (
    <div className="qg-fiche">
      <div className="qg-fiche-tete">
        <span className="admin-pastille" aria-hidden="true">
          {f.avatar}
        </span>
        <span className="qg-ligne-texte">
          <b>@{f.login}</b>
          {/* Rien qui s'accorde à la personne : « vu », « inscrit » ne disaient que le masculin. */}
          <span className="muted small">
            niv. {f.niveau}
            {f.enLigne ? ' · en ligne' : f.vuLe ? ` · dernier passage ${quandEcrit(f.vuLe, maintenant)}` : ''}
          </span>
        </span>
        {f.toi && <span className="etiquette">toi</span>}
        {f.suspendu && <span className="etiquette admin-etat-ferme">suspendu</span>}
      </div>

      {f.suspendu && f.suspenduLe !== null && (
        <p className="muted small">Profil suspendu {quandEcrit(f.suspenduLe, maintenant)} : il ne s’ouvre plus, et personne ne le voit.</p>
      )}

      {/* Les heures, celles de Paris, comme tout le QG (`quandEcrit`, `heureEcrite`). */}
      <dl className="admin-fiche">
        <Ligne nom="Inscription">{quandEcrit(f.creeLe, maintenant)}</Ligne>
        <Ligne nom="Soirées">{formatNumber(f.soirees)}</Ligne>
        <Ligne nom="Quiz du jour">
          {f.jour ? (f.jour.joues > 0 ? `${pluriel(f.jour.joues, 'joué')} · ${pluriel(f.jour.victoires, 'gagné')}` : 'jamais joué') : '–'}
          {/* Insécable : au téléphone, « hors » finissait la ligne et « classement » ouvrait la suivante. */}
          {f.masque && ' · hors classement'}
        </Ligne>
        <Ligne nom="Campagne">
          {f.campagne
            ? f.campagne.justes > 0
              ? `record ${formatNumber(f.campagne.record)} · ${formatNumber(f.campagne.justes)} bonne${f.campagne.justes > 1 ? 's' : ''} réponse${f.campagne.justes > 1 ? 's' : ''}`
              : 'pas encore'
            : '–'}
        </Ligne>
        <Ligne nom="Duels">{f.duels ? `${ligue?.nom ?? f.duels.ligue} · cote ${formatNumber(f.duels.cote)}` : 'pas encore'}</Ligne>
        <Ligne nom="Trente jours">{f.activite ? sesTrenteJours(f.activite) : '–'}</Ligne>
        <Ligne nom="Confettis">
          {f.confettis ? `${formatNumber(f.confettis.solde)}${f.confettis.offerts > 0 ? ` · dont ${pluriel(f.confettis.offerts, 'offert')}` : ''}` : '–'}
        </Ligne>
        <Ligne nom="Espace">{f.salon ? `${f.salon.propre ? 'Son salon' : 'Le compte d’animateur'} /${f.salon.slug} · ${f.salon.quiz} quiz` : 'Aucun'}</Ligne>
        <Ligne nom="Connexion">{fermee ? `fermée jusqu’à ${heureEcrite(f.connexion.fermeeJusquA!)}` : 'ouverte'}</Ligne>
      </dl>

      {f.epreuve && (
        <p className="qg-fiche-note">
          <Icon name="target" />
          <span>
            Une épreuve l’attend : {f.epreuve.sentier}, palier {f.epreuve.palier}, commencée {quandEcrit(f.epreuve.depuis, maintenant)}
            {f.epreuve.vieEnJeu ? ' · une vie en jeu' : ''}. Tant qu’elle attend, aucune autre ne commence.
          </span>
        </p>
      )}

      {(aider.length > 0 || code || don) && (
        <section className="qg-fiche-groupe" aria-labelledby="fiche-aider">
          <h3 className="label" id="fiche-aider">
            {f.toi ? 'Pour toi' : 'L’aider'}
          </h3>
          {code && (
            <div className="qg-fiche-code" role="status">
              <span className="muted small">Transmets-lui ce code — il ne sera plus affiché :</span>
              <b className="code-secours">{code.code}</b>
              <span className="muted small">
                Il se tape sur « Mot de passe oublié ? », avec l’identifiant @{code.login}, pour choisir un mot de passe ; un code neuf, que personne d’autre ne verra, le remplace alors.
              </span>
              <button
                type="button"
                className="salon-geste"
                onClick={async () => {
                  const copie = await copierTexte(code.code)
                  showToast({ kind: copie ? 'info' : 'error', message: copie ? 'Code copié' : 'Copie impossible : recopie-le' })
                }}
              >
                <Icon name="copy" />
                Copier le code
              </button>
            </div>
          )}
          {don && (
            <div className="qg-fiche-don">
              <label className="label" htmlFor="don-confettis">
                Combien ? De 1 à {CONFETTIS_PAR_DON_MAX}
              </label>
              <ChampNombre
                id="don-confettis"
                valeur={don.confettis}
                min={1}
                max={CONFETTIS_PAR_DON_MAX}
                onValeur={confettis => setDon(d => d && { ...d, confettis })}
                inputMode="numeric"
              />
              <label className="label" htmlFor="don-mot">
                {f.toi ? 'Un mot, lu sur ton accueil' : 'Un mot, lu sur son accueil'}
              </label>
              <input
                id="don-mot"
                className="input"
                value={don.mot}
                maxLength={MOT_D_UN_DON_MAX}
                placeholder={f.toi ? undefined : 'Merci pour samedi !'}
                onChange={e => setDon(d => d && { ...d, mot: e.target.value })}
              />
              <div className="admin-gestes">
                <button type="button" className="salon-geste admin-geste-oui" aria-disabled={occupe || undefined} onClick={() => void offrir()}>
                  <Icon name="sparkles" />
                  {f.toi ? 'T’offrir' : 'Offrir'} {nConfettis(Math.min(CONFETTIS_PAR_DON_MAX, Math.max(1, don.confettis)))}
                </button>
                <button type="button" className="salon-geste" onClick={() => setDon(null)}>
                  Annuler
                </button>
              </div>
            </div>
          )}
          {aider.length > 0 && <div className="admin-gestes">{aider}</div>}
        </section>
      )}

      {moderer.length > 0 && (
        <section className="qg-fiche-groupe" aria-labelledby="fiche-moderer">
          <h3 className="label" id="fiche-moderer">
            Modérer
          </h3>
          <div className="admin-gestes">{moderer}</div>
        </section>
      )}
      {f.toi && <p className="muted small">C’est ton profil : il ne se renomme, ne se suspend ni ne se supprime d’ici.</p>}

      <section className="qg-fiche-gestes" aria-labelledby="fiche-gestes">
        <h3 className="label" id="fiche-gestes">
          Tes gestes sur ce profil
        </h3>
        {!gestes ? (
          <p className="serif-note">Chargement…</p>
        ) : gestes.length === 0 ? (
          <p className="muted small">Rien encore.</p>
        ) : (
          <ul className="qg-liste">
            {gestes.map(g => (
              <li key={g.id} className="qg-fiche-geste">
                <span>{espacesFines(g.resume)}</span>
                <span className="muted small">{quandEcrit(g.quand, maintenant)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Ligne({ nom, children }: { nom: string; children: ReactNode }) {
  return (
    <div>
      <dt>{nom}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Geste({ icone, danger, occupe, onClick, children }: { icone: IconName; danger?: boolean; occupe?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={'salon-geste' + (danger ? ' admin-geste-danger' : '')} aria-disabled={occupe || undefined} onClick={onClick}>
      <Icon name={icone} />
      {children}
    </button>
  )
}
