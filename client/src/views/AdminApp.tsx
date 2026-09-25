import { useEffect, useState, type FormEvent } from 'react'
import { activationUrl, api, UnauthorizedError, type Me } from '../api'
import { Icon } from '../components/Icon'
import { LienConsole } from '../components/LienConsole'
import { confirmDialog, promptDialog } from '../components/Dialog'
import { showToast, useAppState } from '../state'
import { formatDay } from '../../../shared/archive'
import { normalizeSlug, type PublicAccount } from '../../../shared/space'

/**
 * Les comptes (`/admin`), pour l'administrateur seul : créer le compte d'un
 * ami, lui donner son lien d'activation, en refaire un s'il a perdu son mot
 * de passe, désactiver ou réactiver — et supprimer un compte désactivé, avec
 * tout ce qu'il a laissé. Rien d'autre : les quiz et les soirées des autres
 * ne se voient pas d'ici.
 */
export function AdminApp() {
  const { toast } = useAppState()
  const [me, setMe] = useState<Me | null>(null)
  const [accounts, setAccounts] = useState<PublicAccount[] | null>(null)
  const [error, setError] = useState('')

  const load = () =>
    api.admin
      .list()
      .then(setAccounts)
      .catch(e => setError((e as Error).message))

  useEffect(() => {
    api.auth
      .me()
      .then(m => {
        setMe(m)
        if (m.account.role !== 'admin') setError('Cette page est réservée à l’administrateur.')
        else load()
      })
      .catch(e => {
        if (e instanceof UnauthorizedError) window.location.replace('/connexion?next=/admin')
        else setError((e as Error).message)
      })
  }, [])

  /** Le lien d'activation, à copier et à envoyer par le canal qu'on veut. */
  const showActivation = async (account: PublicAccount, token: string) => {
    const link = activationUrl(token)
    const value = await promptDialog({
      title: `Le lien d'activation de ${account.name}`,
      message:
        'Envoie-lui ce lien : il choisira son mot de passe. Il vaut sept jours et ne sert qu’une fois — en refaire un annule celui-ci.',
      input: { value: link },
      confirmLabel: 'Copier le lien',
    })
    if (value) {
      await navigator.clipboard.writeText(link).catch(() => {})
      showToast({ kind: 'info', message: 'Lien copié' })
    }
  }

  if (error) {
    return (
      <main className="center-page">
        <p className="error">{error}</p>
      </main>
    )
  }
  if (!me || !accounts) {
    return (
      <main className="center-page">
        <p className="serif-note">Chargement…</p>
      </main>
    )
  }

  return (
    <div className="recap account">
      <header className="recap-header">
        <span className="label">Administration</span>
        <h1>Les comptes</h1>
        <p className="muted">Un compte par animateur : son espace, ses quiz, ses soirées.</p>
        <hr className="hairline" />
      </header>

      <nav className="row bilan-tabs">
        <a className="btn" href="/compte">
          <Icon name="users" />
          Mon compte
        </a>
        <LienConsole className="btn" />
      </nav>
      <main className="page-corps">
        <CreateForm onCreated={(account, token) => load().then(() => showActivation(account, token))} />

        <section className="card">
          <h2>Tous les comptes</h2>
          <div className="stats-scroll">
            <table className="stats-table accounts-table">
              <thead>
                <tr>
                  <th className="stats-name">Compte</th>
                  <th>Adresse</th>
                  <th>État</th>
                  <th>Dernière connexion</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id}>
                    <td className="stats-name">
                      <strong>{a.name}</strong> <span className="muted">{a.login}</span>
                      {a.role === 'admin' && <span className="pill">admin</span>}
                    </td>
                    <td>
                      <code>/{a.slug}</code>
                    </td>
                    <td>
                      <span className={'pill status-' + a.status}>
                        {a.status === 'pending' ? 'en attente' : a.status === 'active' ? 'actif' : 'désactivé'}
                      </span>
                    </td>
                    <td className="muted" data-libelle="Dernière connexion : ">{a.lastLoginAt ? formatDay(a.lastLoginAt) : 'jamais'}</td>
                    <td>
                      <div className="row account-actions">
                        {/* Un compte en pause ne reçoit pas de lien : le serveur
                            le refuse, et le proposer laissait croire qu'il
                            rouvrirait la porte. */}
                        {a.status !== 'disabled' && (
                          <button
                            className="btn btn-small"
                            title="Un nouveau lien d'activation — pour un mot de passe oublié"
                            onClick={async () => {
                              try {
                                const { activation } = await api.admin.activation(a.id)
                                await showActivation(a, activation.token)
                              } catch (e) {
                                showToast({ kind: 'error', message: (e as Error).message })
                              }
                            }}
                          >
                            <Icon name="sparkles" />
                            Lien
                          </button>
                        )}
                        <button
                          className="btn btn-small btn-ghost"
                          title="Renommer, ou changer l'adresse"
                          onClick={async () => {
                            const name = await promptDialog({
                              title: 'Le prénom ou le nom affiché',
                              input: { value: a.name, maxLength: 40 },
                              confirmLabel: 'Suivant',
                            })
                            if (!name) return
                            const slug = await promptDialog({
                              title: 'Le nom dans l’adresse',
                              message: 'Minuscules, chiffres et tirets. Changer l’adresse casse les liens déjà partagés.',
                              input: { value: a.slug, maxLength: 24 },
                              confirmLabel: 'Enregistrer',
                            })
                            if (!slug) return
                            try {
                              await api.admin.update(a.id, { name, slug: normalizeSlug(slug) })
                              await load()
                            } catch (e) {
                              showToast({ kind: 'error', message: (e as Error).message })
                            }
                          }}
                        >
                          <Icon name="edit" />
                        </button>
                        {a.id !== me.account.id &&
                          (a.status === 'disabled' ? (
                            <>
                              <button
                                className="btn btn-small btn-ghost"
                                onClick={() => api.admin.enable(a.id).then(load).catch(e => showToast({ kind: 'error', message: e.message }))}
                              >
                                Réactiver
                              </button>
                              <button
                                className="btn btn-small btn-ghost"
                                title="Supprimer le compte et tout ce qu'il a laissé"
                                onClick={async () => {
                                  const ok = await confirmDialog({
                                    title: `Supprimer le compte de ${a.name} ?`,
                                    message:
                                      'Ses quiz, ses photos, ses soirées archivées et sa soirée en cours seront effacés, sans retour. Son identifiant et son adresse redeviennent libres.\n\nPour en garder une trace, exporte ses soirées avant (npm run export).',
                                    confirmLabel: 'Supprimer le compte',
                                    danger: true,
                                  })
                                  if (!ok) return
                                  try {
                                    await api.admin.remove(a.id)
                                    await load()
                                    showToast({ kind: 'info', message: `Le compte de ${a.name} est supprimé` })
                                  } catch (e) {
                                    showToast({ kind: 'error', message: (e as Error).message })
                                  }
                                }}
                              >
                                <Icon name="trash" />
                                Supprimer
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn-small btn-ghost"
                              onClick={async () => {
                                const ok = await confirmDialog({
                                  title: `Désactiver le compte de ${a.name} ?`,
                                  message: 'Il ne pourra plus se connecter et ses écrans communs se fermeront. Ses quiz et ses soirées restent : tu peux le réactiver, ou le supprimer pour de bon.',
                                  confirmLabel: 'Désactiver',
                                  danger: true,
                                })
                                if (ok) api.admin.disable(a.id).then(load).catch(e => showToast({ kind: 'error', message: e.message }))
                              }}
                            >
                              Désactiver
                            </button>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {toast && <div className={`toast toast-${toast.kind}`}>{toast.message}</div>}
      </main>
    </div>
  )
}

function CreateForm({ onCreated }: { onCreated: (account: PublicAccount, token: string) => void }) {
  const [name, setName] = useState('')
  const [login, setLogin] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  /**
   * L'identifiant suit le prénom tant qu'on n'y a pas touché. Il ne se
   * remplissait qu'à la première lettre (« if (!login) ») : « Nadia »
   * donnait l'identifiant « n ».
   */
  const [loginTouched, setLoginTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { account, activation } = await api.admin.create({ login, name, slug: normalizeSlug(slug) })
      setName('')
      setLogin('')
      setSlug('')
      setSlugTouched(false)
      setLoginTouched(false)
      onCreated(account, activation.token)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card settings-form" onSubmit={submit}>
      <h2>Créer un compte</h2>
      <p className="muted small">
        Tu recevras un lien d'activation à lui envoyer : c'est lui qui choisira son mot de passe.
      </p>
      <div className="settings-grid">
        <div className="field">
          <label className="label" htmlFor="new-name">
            Prénom ou nom
          </label>
          <input
            id="new-name"
            className="input"
            maxLength={40}
            value={name}
            onChange={e => {
              setName(e.target.value)
              if (!slugTouched) setSlug(normalizeSlug(e.target.value))
              if (!loginTouched) setLogin(normalizeSlug(e.target.value).replace(/-/g, '.'))
            }}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="new-login">
            Identifiant de connexion
          </label>
          <input
            id="new-login"
            className="input"
            maxLength={32}
            autoCapitalize="none"
            value={login}
            onChange={e => {
              setLoginTouched(true)
              setLogin(e.target.value.toLowerCase())
            }}
          />
          {login.trim().length === 1 && <p className="muted small">Trop court : deux caractères au moins.</p>}
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="new-slug">
          Nom dans l'adresse
        </label>
        <input
          id="new-slug"
          className="input"
          maxLength={24}
          autoCapitalize="none"
          value={slug}
          // Normalisé à la sortie du champ, pas à chaque touche : le tiret
          // qu'on venait de taper au bout de « chez » disparaissait aussitôt
          // (`normalizeSlug` retire le tiret final), et « chez-nadia » ne se
          // tapait pas.
          onChange={e => {
            setSlugTouched(true)
            setSlug(e.target.value)
          }}
          onBlur={() => setSlug(normalizeSlug(slug))}
        />
        <p className="muted small">
          Ses invités ouvriront <code>{window.location.origin}/{normalizeSlug(slug) || '…'}</code>
        </p>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn btn-primary" disabled={busy || !name || !login || !normalizeSlug(slug)}>
          <Icon name="plus" />
          Créer et obtenir le lien
        </button>
      </div>
    </form>
  )
}
