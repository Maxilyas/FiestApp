import { useState } from 'react'
import { activationUrl, api, motifDe } from '../api'
import { Icon } from './Icon'
import { Feuille } from './Pieces'
import { choixDialog, confirmDialog, promptDialog } from './Dialog'
import { showToast } from '../state'
import { deNom, espacesFines, quand } from '../format'
import { copierTexte } from '../copier'
import { normalizeSlug, type EspaceDAdministration } from '../../../shared/space'

type Filtre = 'tous' | 'orphelins' | 'fermes'
const FILTRES: [Filtre, string][] = [
  ['tous', 'Tous'],
  ['orphelins', 'Sans titulaire'],
  ['fermes', 'Désactivés'],
]
const garder = (f: Filtre) => (e: EspaceDAdministration) =>
  f === 'tous' ? true : f === 'orphelins' ? e.salon && !e.titulaire : e.status === 'disabled'

/** Le nom qu'on lit : un salon porte celui de son titulaire — son identifiant `p-…` ne disait rien. */
function nomDe(e: EspaceDAdministration): string {
  if (!e.salon) return e.name
  return e.titulaire ? `Le salon ${deNom(e.titulaire.nom)}` : `Un salon sans titulaire · ${e.name}`
}

/**
 * « Les salons », à `/admin#salons` : tous les espaces du serveur — les
 * salons que les profils ouvrent, et les comptes d'animateur d'avant, à mot
 * de passe. Une ligne chacun, qui ouvre sa feuille : le renommer, le fermer
 * (désactiver), le rouvrir, le supprimer une fois fermé. Un salon dont le
 * profil a été supprimé reste, sans titulaire, pour que les souvenirs de ses
 * soirées s'ouvrent toujours : c'est ici qu'on le supprime, quand on veut.
 */
export function AdminSalons({ espaces, onChange }: { espaces?: EspaceDAdministration[]; onChange: () => void }) {
  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [ouvert, setOuvert] = useState<string | null>(null)
  if (!espaces) return <p className="serif-note">Chargement…</p>
  const liste = espaces.filter(garder(filtre))
  const fiche = espaces.find(e => e.id === ouvert)
  return (
    <>
      <nav className="rayons-texte" aria-label="Montrer">
        {FILTRES.map(([f, nom]) => (
          <button key={f} type="button" aria-pressed={filtre === f} onClick={() => setFiltre(f)}>
            {nom} <span className="rayon-compte">{espaces.filter(garder(f)).length}</span>
          </button>
        ))}
      </nav>
      {liste.length === 0 && <p className="serif-note">Aucun espace ici.</p>}
      <ul className="style-liste admin-espaces">
        {liste.map(e => (
          <li key={e.id}>
            <button type="button" onClick={() => setOuvert(e.id)}>
              <span className="admin-pastille" aria-hidden="true">
                {e.titulaire ? e.titulaire.avatar : <Icon name={e.salon ? 'home' : 'lock'} />}
              </span>
              <span className="admin-espace-texte">
                <b>{espacesFines(nomDe(e))}</b>
                <span className="muted small">
                  /{e.slug} · {e.quiz} quiz{e.lastLoginAt ? ` · vu ${quand(e.lastLoginAt)}` : ''}
                </span>
              </span>
              <Etat espace={e} />
              <Icon name="chevron-down" className="style-chevron" />
            </button>
          </li>
        ))}
      </ul>
      {fiche && (
        <FicheDEspace
          espace={fiche}
          onFermer={() => setOuvert(null)}
          onChange={() => {
            setOuvert(null)
            onChange()
          }}
        />
      )}
    </>
  )
}

/** Ce qui le distingue d'un coup d'œil — rien pour un salon tenu, le cas ordinaire. */
function Etat({ espace: e }: { espace: EspaceDAdministration }) {
  if (e.toi) return <span className="etiquette">toi</span>
  if (e.status === 'disabled') return <span className="etiquette admin-etat-ferme">désactivé</span>
  if (!e.titulaire && e.salon) return <span className="etiquette admin-etat-orphelin">sans titulaire</span>
  if (!e.salon) return <span className="etiquette">{e.status === 'pending' ? 'à activer' : 'mot de passe'}</span>
  return null
}

/**
 * La feuille d'un espace : ce qu'il est, puis ses gestes. Le lien
 * d'activation ne vaut que pour un compte à mot de passe — un salon n'en a
 * pas, son profil est sa porte —, et jamais pour le sien : son mot de passe
 * se change dans « Mon compte », en donnant l'actuel.
 */
function FicheDEspace({ espace: e, onFermer, onChange }: { espace: EspaceDAdministration; onFermer: () => void; onChange: () => void }) {
  const [occupe, setOccupe] = useState(false)
  const faire = async (geste: () => Promise<unknown>, merci?: string) => {
    setOccupe(true)
    try {
      await geste()
      if (merci) showToast({ kind: 'info', message: merci })
      onChange()
    } catch (err) {
      showToast({ kind: 'error', message: motifDe(err) })
    } finally {
      setOccupe(false)
    }
  }

  const renommer = async () => {
    const name = await promptDialog({ title: 'Le nom affiché', input: { value: e.name, maxLength: 40 }, confirmLabel: 'Suivant' })
    if (!name) return
    const slug = await promptDialog({
      title: 'Le nom dans l’adresse',
      message: 'Minuscules, chiffres et tirets. Changer l’adresse casse les liens déjà partagés.',
      input: { value: e.slug, maxLength: 24 },
      confirmLabel: 'Enregistrer',
    })
    if (!slug) return
    await faire(() => api.admin.update(e.id, { name, slug: normalizeSlug(slug) }), 'Enregistré')
  }

  /** Le lien d'activation, à copier et à envoyer par le canal qu'on veut. */
  const lienDActivation = async () => {
    let token: string
    try {
      token = (await api.admin.activation(e.id)).activation.token
    } catch (err) {
      return showToast({ kind: 'error', message: motifDe(err) })
    }
    const link = activationUrl(token)
    const value = await promptDialog({
      title: `Le lien d'activation ${deNom(e.name)}`,
      message: 'Envoie-lui ce lien : il choisira son mot de passe. Il vaut sept jours et ne sert qu’une fois — en refaire un annule celui-ci.',
      input: { value: link },
      confirmLabel: 'Copier le lien',
    })
    if (!value) return
    // Hors https — le repli local —, le presse-papiers moderne n'existe pas :
    // l'appel levait avant son `.catch`, et la boîte se fermait sans copie ni
    // un mot. `copierTexte` passe par l'ancienne commande ; si le navigateur
    // refuse encore, le lien revient à l'écran, à copier à la main.
    if (await copierTexte(link)) return showToast({ kind: 'info', message: 'Lien copié' })
    await promptDialog({
      title: `Le lien d'activation ${deNom(e.name)}`,
      message: 'Le navigateur n’a pas voulu le copier : sélectionne-le, puis copie-le à la main.',
      input: { value: link },
      confirmLabel: 'Fermer',
    })
  }

  const desactiver = async () => {
    const ok = await confirmDialog({
      title: `Désactiver ${nomDe(e)} ?`,
      message: 'Plus personne ne pourra l’ouvrir, et ses écrans communs se fermeront. Ses quiz et ses soirées restent : tu peux le réactiver, ou le supprimer pour de bon.',
      confirmLabel: 'Désactiver',
      danger: true,
    })
    if (ok) await faire(() => api.admin.disable(e.id), 'Désactivé')
  }

  const supprimer = async () => {
    // Ce que ses soirées ont rapporté aux joueurs : un ami qui s'en va le
    // leur laisse, un compte qui fabriquait des soirées le rend —
    // l'administrateur choisit, à chaque fois.
    const choix = await choixDialog({
      title: `Supprimer ${nomDe(e)} ?`,
      message:
        'Ses quiz, ses photos, ses soirées archivées et sa soirée en cours seront effacés, sans retour : leurs souvenirs ne s’ouvriront plus. Son adresse redevient libre.\n\nCe que ses soirées ont rapporté aux joueurs — expérience, prix, hauts faits, paliers — peut leur rester, ou leur être repris : pour un compte qui fabriquait des soirées.\n\nPour en garder une trace, exporte ses soirées avant (npm run export).',
      confirmLabel: 'Supprimer, les joueurs gardent leurs gains',
      danger: true,
      alternative: { label: 'Supprimer, et reprendre leurs gains', danger: true },
    })
    if (!choix) return
    await faire(() => api.admin.remove(e.id, choix.geste === 'alternative' ? 'reprendre' : 'garder'), `${nomDe(e)} est supprimé`)
  }

  return (
    <Feuille titre={nomDe(e)} onFermer={onFermer}>
      <dl className="admin-fiche">
        <div>
          <dt>Titulaire</dt>
          <dd>{e.titulaire ? `${e.titulaire.avatar} ${e.titulaire.nom}` : e.salon ? 'Aucun : son profil a été supprimé' : 'Aucun profil rattaché'}</dd>
        </div>
        <div>
          <dt>Adresse</dt>
          <dd>
            <code>/{e.slug}</code>
          </dd>
        </div>
        <div>
          <dt>Porte</dt>
          <dd>{e.salon ? 'Le profil, sans mot de passe' : e.status === 'pending' ? 'Un mot de passe, pas encore choisi' : `Un mot de passe · identifiant ${e.login}`}</dd>
        </div>
        <div>
          <dt>Quiz</dt>
          <dd>{e.quiz}</dd>
        </div>
        <div>
          <dt>Vu</dt>
          <dd>{e.lastLoginAt ? quand(e.lastLoginAt) : 'jamais'}</dd>
        </div>
      </dl>
      <div className="admin-gestes">
        <button type="button" className="salon-geste" disabled={occupe} onClick={() => void renommer()}>
          <Icon name="edit" />
          Renommer
        </button>
        {!e.salon && !e.toi && e.status !== 'disabled' && (
          <button type="button" className="salon-geste" disabled={occupe} onClick={() => void lienDActivation()}>
            <Icon name="sparkles" />
            Un lien pour son mot de passe
          </button>
        )}
        {!e.toi &&
          (e.status === 'disabled' ? (
            <>
              <button type="button" className="salon-geste" disabled={occupe} onClick={() => void faire(() => api.admin.enable(e.id), 'Réactivé')}>
                <Icon name="rotate" />
                Réactiver
              </button>
              <button type="button" className="salon-geste admin-geste-danger" disabled={occupe} onClick={() => void supprimer()}>
                <Icon name="trash" />
                Supprimer
              </button>
            </>
          ) : (
            <button type="button" className="salon-geste admin-geste-danger" disabled={occupe} onClick={() => void desactiver()}>
              <Icon name="x-circle" />
              Désactiver
            </button>
          ))}
      </div>
      {!e.toi && e.status !== 'disabled' && <p className="muted small">On ne supprime qu’un espace désactivé : c’est le pas de recul.</p>}
    </Feuille>
  )
}
