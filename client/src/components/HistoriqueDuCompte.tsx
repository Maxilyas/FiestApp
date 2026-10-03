import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from './Icon'
import { Feuille } from './Pieces'
import { confirmDialog, promptDialog } from './Dialog'
import { showToast } from '../state'
import { dataUrl, spacePath } from '../routes'
import { espacesFines } from '../format'
import type { ArchiveList, ArchiveSummary } from '../../../shared/archive'

/**
 * L'historique de son espace, dans « Mon compte » (`/compte#historique`) :
 * une ligne par soirée — sa date, son nom, ses chiffres, son vainqueur —, et
 * sous chacune ses deux pages, le souvenir et le bilan, d'un toucher.
 * Renommer une soirée ou la retirer de l'historique se fait dans sa feuille,
 * à l'écart : c'est le geste qui défait quelque chose.
 *
 * C'était une page publique à part (`/<espace>/soirees`), une carte haute
 * par soirée, sans la barre du menu ni de retour au compte (la remarque du
 * propriétaire du 3 octobre 2026). La page publique reste, pour les invités.
 */
export function HistoriqueDuCompte({ slug }: { slug: string }) {
  const [liste, setListe] = useState<ArchiveList | null>(null)
  const [erreur, setErreur] = useState('')
  const [ouverte, setOuverte] = useState<ArchiveSummary | null>(null)
  const [occupe, setOccupe] = useState(false)

  const charger = () =>
    fetch(dataUrl(slug, 'soirees.json'))
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('Impossible de charger l’historique. Réessaie dans un instant.'))))
      .then(setListe)
      .catch(e => setErreur(motifDe(e)))
  useEffect(() => {
    void charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const faire = async (geste: () => Promise<unknown>, merci: string) => {
    setOccupe(true)
    try {
      await geste()
      setOuverte(null)
      showToast({ kind: 'info', message: merci })
      await charger()
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(false)
    }
  }
  const renommer = async (a: ArchiveSummary) => {
    const title = await promptDialog({ title: 'Renommer la soirée', input: { value: a.title, maxLength: 80 }, confirmLabel: 'Renommer' })
    if (title) await faire(() => api.archives.rename(a.id, title), 'Soirée renommée')
  }
  const retirer = async (a: ArchiveSummary) => {
    const ok = await confirmDialog({
      title: `Retirer « ${a.title} » de l'historique ?`,
      message: 'Son souvenir et son bilan disparaissent, et ce qu’elle avait rapporté aux profils avec — expérience, prix, hauts faits. C’est définitif.',
      confirmLabel: 'Retirer',
      danger: true,
    })
    if (ok) await faire(() => api.archives.remove(a.id), 'Soirée retirée de l’historique')
  }

  if (erreur) return <p className="error">{erreur}</p>
  if (!liste) return <p className="serif-note">Chargement…</p>
  return (
    <>
      <ListeDesSoirees slug={slug} liste={liste} onGerer={setOuverte} />
      {ouverte && (
        <Feuille titre={ouverte.title} onFermer={() => setOuverte(null)}>
          <div className="admin-gestes">
            <button type="button" className="salon-geste" disabled={occupe} onClick={() => void renommer(ouverte)}>
              <Icon name="edit" />
              Renommer
            </button>
            <button type="button" className="salon-geste admin-geste-danger" disabled={occupe} onClick={() => void retirer(ouverte)}>
              <Icon name="trash" />
              Retirer de l’historique
            </button>
          </div>
          <p className="muted small">Retirée, une soirée reprend aux profils ce qu’elle leur avait rapporté.</p>
        </Feuille>
      )}
    </>
  )
}

/** Une ligne par soirée — celle en cours d'abord —, ses deux pages sous chacune. */
export function ListeDesSoirees({ slug, liste, onGerer }: { slug: string; liste: ArchiveList; onGerer: (a: ArchiveSummary) => void }) {
  const { current, archives } = liste
  return (
    <>
      {current && (
        <section className="historique-groupe" aria-labelledby="historique-en-cours">
          <h2 className="compte-groupe" id="historique-en-cours">
            En cours
          </h2>
          <ol className="soirees-liste">
            <li className="soiree-carte historique-carte">
              <DateDeSoiree quand={current.since} />
              <span className="soiree-texte">
                <b className="soiree-nom">{espacesFines(current.title ?? 'La soirée du moment')}</b>
                <span className="muted small">{chiffres(current)}</span>
                <PagesDeLaSoiree slug={slug} id={null} />
              </span>
            </li>
          </ol>
        </section>
      )}

      <section className="historique-groupe" aria-labelledby="historique-closes">
        <h2 className="compte-groupe" id="historique-closes">
          Les soirées closes {archives.length > 0 && <span className="etiquette">{archives.length}</span>}
        </h2>
        {archives.length === 0 && (
          <p className="muted small">Aucune pour l’instant : une soirée rejoint la liste quand on la clôt.</p>
        )}
        <ol className="soirees-liste">
          {archives.map(a => (
            <li key={a.id} className="soiree-carte historique-carte">
              <DateDeSoiree quand={a.heldAt} />
              <span className="soiree-texte">
                <b className="soiree-nom">{espacesFines(a.title)}</b>
                <span className="muted small">
                  {chiffres(a)}
                  {vainqueur(a)}
                </span>
                <PagesDeLaSoiree slug={slug} id={a.id} />
              </span>
              <button type="button" className="historique-plus" aria-label={`Renommer ou retirer « ${a.title} »`} onClick={() => onGerer(a)}>
                <Icon name="more" />
              </button>
            </li>
          ))}
        </ol>
      </section>

    </>
  )
}

/** Le souvenir et le bilan d'une soirée — `null`, celle qui se joue encore. */
function PagesDeLaSoiree({ slug, id }: { slug: string; id: string | null }) {
  return (
    <span className="historique-pages">
      <a className="salon-geste" href={spacePath(slug, 'souvenir', id)}>
        <Icon name="book" />
        Souvenir
      </a>
      <a className="salon-geste" href={spacePath(slug, 'bilan', id)}>
        <Icon name="list" />
        Bilan
      </a>
    </span>
  )
}

/** Le jour en grand, le mois dessous, l'année quand ce n'est plus celle-ci — comme « Mes soirées ». */
function DateDeSoiree({ quand }: { quand: number | null }) {
  if (quand === null) {
    return (
      <span className="soiree-date" aria-hidden="true">
        <Icon name="play" />
      </span>
    )
  }
  const d = new Date(quand)
  return (
    <span className="soiree-date" title={d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}>
      <b>{d.getDate()}</b>
      {d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}
      {d.getFullYear() !== new Date().getFullYear() && <span className="soiree-annee">{d.getFullYear()}</span>}
    </span>
  )
}

const chiffres = (s: { players: number; quizzes: number }) => `${s.players} joueur${s.players > 1 ? 's' : ''} · ${s.quizzes} quiz`

/** Le vainqueur en quelques mots — ses points sont au souvenir : la ligne tient sur une ligne. Plusieurs, le premier et « ex æquo ». */
function vainqueur(a: ArchiveSummary): string {
  const [premier] = a.winners
  if (!premier) return ''
  return ` · 🏆 ${premier.avatar} ${premier.name}${a.winners.length > 1 ? ' ex æquo' : ''}`
}
