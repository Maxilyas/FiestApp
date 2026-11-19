import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { confirmDialog } from './Dialog'
import { Icon } from './Icon'
import { Flot } from './GrandPrix'
import { PrenomDuJoueur } from './PrenomDuJoueur'
import { showToast } from '../state'
import { espacesFines } from '../format'
import { formatNumber } from '../../../shared/typographie'
import { jourEnToutesLettres } from '../../../shared/jour'
import type { ProfilDAdministration } from '../../../shared/profil'
import {
  MOT_DU_GRAND_PRIX_MAX,
  RUBAN_PAR_DEFAUT,
  TITRE_DU_GRAND_PRIX_MAX,
  type ApercuDuFantome,
  type CleDeRuban,
  type FantomeVu,
  type GrandPrixAuQg,
  type PageDesGrandsPrix,
} from '../../../shared/grandPrix'

/** Le fantôme choisi : ce que la recherche en dit, puis ce qu'il a de quoi courir. */
interface FantomeChoisi {
  id: string
  nom: string
  /** Celui du flot — l'avatar qu'il porte, ou, cherché, l'emoji enregistré : le serveur fige le vrai au jour venu. */
  vu: FantomeVu
}

const nQuestions = (n: number) => `${formatNumber(n)} question${n > 1 ? 's' : ''}`

/** Le formulaire vide, ou celui d'un Grand Prix qu'on reprend avant son jour. */
function depuis(g: GrandPrixAuQg | null) {
  return {
    id: g?.id ?? null,
    fantome: g?.fantome ? { id: g.fantome.id, nom: g.fantome.nom, vu: g.fantome } : null,
    jour: g?.jour ?? '',
    titre: g?.titre ?? '',
    ruban: g?.ruban ?? RUBAN_PAR_DEFAUT,
    mot: g?.mot ?? '',
    prix: g?.prix ?? null,
    prixFete: g?.prixFete ?? null,
  }
}

/**
 * Le Grand Prix au QG (`/admin#grand-prix`, sous « Animer ») — le jour d'un
 * joueur : on choisit son fantôme, le jour où il court, la couleur de son
 * flot, l'avatar en plus que gagnent ceux qui le battent et celui que la
 * personne fêtée reçoit le matin, et un mot pour elle. Le vivier se fige à
 * l'enregistrement : le fantôme ne rejoue que ce qu'il a joué jusque-là.
 * Puis la liste : « Essayer » le court comme un joueur, hors classement et
 * sans flot ; « Modifier » et « Retirer » tant que son jour n'est pas venu.
 * Chaque geste va au journal, sous les annonces.
 */
export function QgGrandPrix() {
  const [page, setPage] = useState<PageDesGrandsPrix | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState(() => depuis(null))
  const [apercu, setApercu] = useState<ApercuDuFantome | null>(null)
  const [cherche, setCherche] = useState('')
  const [trouves, setTrouves] = useState<ProfilDAdministration[] | null>(null)
  const [occupe, setOccupe] = useState<string | null>(null)

  useEffect(() => {
    api.admin.grandsPrix().then(
      p => {
        setPage(p)
        setError('')
      },
      e => setError(motifDe(e)),
    )
  }, [])

  // Le temps de finir le mot, et une recherche partie avant la suivante ne remplace jamais sa liste.
  useEffect(() => {
    const q = cherche.trim()
    if (q.length < 2) {
      setTrouves(null)
      return
    }
    let perimee = false
    const minuteur = setTimeout(() => {
      api.admin.profils(q).then(
        l => !perimee && setTrouves(l.profils),
        e => !perimee && showToast({ kind: 'error', message: motifDe(e) }),
      )
    }, 250)
    return () => {
      perimee = true
      clearTimeout(minuteur)
    }
  }, [cherche])

  // Ce que le fantôme a de quoi courir, lu dès qu'il est choisi : 20 réponses au moins, sinon le serveur refusera.
  const idDuFantome = form.fantome?.id ?? null
  useEffect(() => {
    setApercu(null)
    if (!idDuFantome) return
    let perime = false
    api.admin.fantome(idDuFantome).then(
      a => !perime && setApercu(a),
      e => !perime && showToast({ kind: 'error', message: motifDe(e) }),
    )
    return () => {
      perime = true
    }
  }, [idDuFantome])

  if (error) return <p className="error">{error}</p>
  if (!page) return <p className="serif-note">Chargement…</p>

  const aujourdhui = page.aujourdhui
  const prete = !!form.fantome && /^\d{4}-\d{2}-\d{2}$/.test(form.jour) && form.jour >= aujourdhui && apercu?.pret === true
  const dejaCeJour = page.grandsPrix.find(g => g.jour === form.jour && g.id !== form.id)
  const nomDuPrix = (cle: string | null) => (cle ? (page.prix.find(p => p.cle === cle)?.nom ?? cle) : null)
  const titreDOffice = form.fantome ? `Le Grand Prix de ${form.fantome.nom}` : 'Le Grand Prix de…'

  const choisirLeFantome = (p: ProfilDAdministration) => {
    setForm(f => ({ ...f, fantome: { id: p.id, nom: p.nom, vu: { id: p.id, nom: p.nom, avatar: p.avatar } } }))
    setCherche('')
    setTrouves(null)
  }

  const programmer = async () => {
    if (occupe || !prete || !form.fantome) return
    const ok = await confirmDialog({
      title: form.id ? 'Enregistrer ce Grand Prix ?' : 'Programmer ce Grand Prix ?',
      message: espacesFines(
        `Le ${jourEnToutesLettres(form.jour)}, chaque profil courra contre le fantôme de ${form.fantome.nom}, et le verra sur son accueil. Son vivier se fige maintenant : ${
          apercu ? `${nQuestions(apercu.jour + apercu.campagne)}` : 'ses réponses'
        }.${form.prix ? ` Qui le bat gagne son flot et ${nomDuPrix(form.prix)}.` : ' Qui le bat gagne son flot.'}`,
      ),
      confirmLabel: form.id ? 'Enregistrer' : 'Programmer',
    })
    if (!ok) return
    setOccupe('programmer')
    try {
      const p = await api.admin.programmer({
        ...(form.id ? { id: form.id } : {}),
        fantome: form.fantome.id,
        jour: form.jour,
        titre: form.titre,
        ruban: form.ruban,
        mot: form.mot,
        prix: form.prix,
        prixFete: form.prixFete,
      })
      setPage(p)
      setForm(depuis(null))
      showToast({ kind: 'info', message: form.id ? 'Grand Prix enregistré' : 'Grand Prix programmé' })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(null)
    }
  }

  const retirer = async (g: GrandPrixAuQg) => {
    if (occupe) return
    const ok = await confirmDialog({
      title: 'Retirer ce Grand Prix ?',
      message: espacesFines(`« ${g.titre} » ne courra pas le ${jourEnToutesLettres(g.jour)}.`),
      confirmLabel: 'Retirer',
    })
    if (!ok) return
    setOccupe(g.id)
    try {
      setPage(await api.admin.retirerLeGrandPrix(g.id))
      if (form.id === g.id) setForm(depuis(null))
      showToast({ kind: 'info', message: 'Grand Prix retiré' })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(null)
    }
  }

  const reprendre = (g: GrandPrixAuQg) => {
    setForm(depuis(g))
    document.getElementById('grand-prix-nouveau')?.scrollIntoView({ block: 'start' })
  }

  const proposes = (trouves ?? []).filter(p => !p.suspendu && p.id !== form.fantome?.id).slice(0, 6)

  return (
    <>
      <p className="muted small">
        {espacesFines(
          'Le jour d’un joueur : tout le monde court dix obstacles contre son fantôme — ses vraies réponses du quiz du jour et de la campagne, rejouées à son rythme. Une barre ou un refus coûtent 4 points, le temps départage. Qui le bat gagne son flot, à son avatar ; la personne fêtée reçoit le sien le matin, en or. Ni expérience ni confettis.',
        )}
      </p>

      <section className="qg-carte gp-qg" aria-labelledby="grand-prix-nouveau">
        <div className="qg-carte-tete">
          <h2 id="grand-prix-nouveau">{form.id ? 'Modifier le Grand Prix' : 'Un Grand Prix'}</h2>
          {form.id && (
            <button type="button" className="salon-geste" onClick={() => setForm(depuis(null))}>
              <Icon name="x" />
              Abandonner la modification
            </button>
          )}
        </div>

        <div className="gp-qg-apercu" aria-hidden="true">
          <Flot ruban={form.ruban} fantome={form.fantome?.vu ?? null} nom="" taille={92} />
          <span className="gp-qg-apercu-titre">{espacesFines(form.titre.trim() || titreDOffice)}</span>
        </div>

        <span className="label" id="grand-prix-fantome">
          Le fantôme
        </span>
        {form.fantome ? (
          <div className="gp-qg-fantome">
            <span>
              <b>{espacesFines(form.fantome.nom)}</b>
              <span className="muted small">
                {' · '}
                {apercu
                  ? espacesFines(
                      `${nQuestions(apercu.jour)} du quiz du jour, ${nQuestions(apercu.campagne)} de la campagne${apercu.pret ? '' : ' — pas encore assez pour courir (20 au moins)'}`,
                    )
                  : 'ce qu’il a joué…'}
              </span>
            </span>
            {!form.id && (
              <button type="button" className="salon-geste" onClick={() => setForm(f => ({ ...f, fantome: null }))}>
                <Icon name="x" />
                Changer
              </button>
            )}
          </div>
        ) : (
          <>
            <label className="champ-recherche">
              <Icon name="search" />
              <input
                className="input"
                type="search"
                value={cherche}
                placeholder="Son prénom ou son identifiant…"
                aria-labelledby="grand-prix-fantome"
                onChange={e => setCherche(e.target.value)}
              />
            </label>
            {trouves && proposes.length === 0 && <p className="muted small">Aucun profil ne correspond.</p>}
            {proposes.length > 0 && (
              <ul className="maintenance-testeurs-liste">
                {proposes.map(p => (
                  <li key={p.id}>
                    <span className="maintenance-testeur">
                      <b>{espacesFines(p.nom)}</b> <span className="muted small">@{p.login}</span>
                    </span>
                    <button type="button" className="salon-geste" onClick={() => choisirLeFantome(p)}>
                      <Icon name="check" />
                      Choisir
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <label className="label" htmlFor="grand-prix-jour">
          Le jour
        </label>
        <input id="grand-prix-jour" className="input gp-qg-jour" type="date" min={aujourdhui} value={form.jour} onChange={e => setForm(f => ({ ...f, jour: e.target.value }))} />
        {form.jour && <p className="muted small">{espacesFines(form.jour < aujourdhui ? 'Ce jour est passé.' : `De minuit à minuit, le ${jourEnToutesLettres(form.jour)}, à l’heure de Paris.`)}</p>}
        {dejaCeJour && <p className="muted small">{espacesFines(`« ${dejaCeJour.titre} » court déjà ce jour-là.`)}</p>}

        <label className="label" htmlFor="grand-prix-titre">
          Son titre
        </label>
        <input id="grand-prix-titre" className="input" maxLength={TITRE_DU_GRAND_PRIX_MAX} value={form.titre} placeholder={titreDOffice} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} />

        <span className="label" id="grand-prix-ruban">
          Le ruban du flot
        </span>
        <div className="annonce-sortes" role="radiogroup" aria-labelledby="grand-prix-ruban">
          {page.rubans.map(r => (
            <button
              key={r.cle}
              type="button"
              role="radio"
              aria-checked={form.ruban === r.cle}
              className={'annonce-sorte gp-qg-ruban' + (form.ruban === r.cle ? ' actif' : '')}
              onClick={() => setForm(f => ({ ...f, ruban: r.cle as CleDeRuban }))}
            >
              <span className="gp-qg-pastille" style={{ background: r.rond }} aria-hidden="true" />
              {r.nom}
            </button>
          ))}
        </div>

        <span className="label" id="grand-prix-prix">
          L’avatar en plus, pour qui le bat
        </span>
        <div className="annonce-sortes" role="radiogroup" aria-labelledby="grand-prix-prix">
          {[{ cle: null, nom: 'Aucun' }, ...page.prix].map(p => (
            <button key={p.cle ?? 'aucun'} type="button" role="radio" aria-checked={form.prix === p.cle} className={'annonce-sorte' + (form.prix === p.cle ? ' actif' : '')} onClick={() => setForm(f => ({ ...f, prix: p.cle }))}>
              {p.nom}
            </button>
          ))}
        </div>

        <span className="label" id="grand-prix-prix-fete">
          Pour la personne fêtée, le matin
        </span>
        <div className="annonce-sortes" role="radiogroup" aria-labelledby="grand-prix-prix-fete">
          {[{ cle: null, nom: 'Aucun' }, ...page.prix].map(p => (
            <button
              key={p.cle ?? 'aucun'}
              type="button"
              role="radio"
              aria-checked={form.prixFete === p.cle}
              className={'annonce-sorte' + (form.prixFete === p.cle ? ' actif' : '')}
              onClick={() => setForm(f => ({ ...f, prixFete: p.cle }))}
            >
              {p.nom}
            </button>
          ))}
        </div>
        <p className="muted small">{espacesFines('Avec son flot d’honneur. Les avatars des Grands Prix sont secrets : seuls ceux qui les ont les voient.')}</p>

        <label className="label" htmlFor="grand-prix-mot">
          Un mot pour la personne fêtée
        </label>
        <textarea
          id="grand-prix-mot"
          className="input"
          rows={3}
          maxLength={MOT_DU_GRAND_PRIX_MAX}
          value={form.mot}
          placeholder="Elle le lira en ouvrant l’application, le jour venu."
          onChange={e => setForm(f => ({ ...f, mot: e.target.value }))}
        />
        <p className="muted small maintenance-compte">
          {Array.from(form.mot.trim()).length} / {MOT_DU_GRAND_PRIX_MAX}
        </p>

        <div className="admin-gestes maintenance-gestes">
          <button type="button" className="salon-geste admin-geste-oui" aria-disabled={!prete || !!dejaCeJour || occupe !== null || undefined} onClick={() => void programmer()}>
            <Icon name="award" />
            {occupe === 'programmer' ? '…' : form.id ? 'Enregistrer' : 'Programmer'}
          </button>
        </div>
      </section>

      {page.grandsPrix.length > 0 && (
        <section className="qg-carte" aria-labelledby="grand-prix-liste">
          <div className="qg-carte-tete">
            <h2 id="grand-prix-liste">Les Grands Prix</h2>
            <span className="etiquette num">{page.grandsPrix.length}</span>
          </div>
          <ul className="qg-liste maintenance-gestes">
            {page.grandsPrix.map(g => {
              const avenir = g.jour > aujourdhui
              const court = g.jour === aujourdhui
              return (
                <li key={g.id} className={'annonce-faite' + (avenir || court ? '' : ' annonce-faite-tue')}>
                  <span className="annonce-faite-texte">
                    <b>{espacesFines(`« ${g.titre} »`)}</b>
                    <span className="muted small">
                      {espacesFines(`le ${jourEnToutesLettres(g.jour)} · le fantôme de `)}
                      <PrenomDuJoueur id={g.fantome?.id} nom={g.fantome?.nom ?? '?'} />
                      {espacesFines(` · ${nQuestions(g.vivier.jour + g.vivier.campagne)} dans son vivier`)}
                    </span>
                    <span className="small">
                      {espacesFines(
                        [
                          g.prix ? `en jeu : ${nomDuPrix(g.prix)}` : 'en jeu : son flot',
                          g.prixFete ? `pour la fêtée : ${nomDuPrix(g.prixFete)}` : null,
                          g.mot ? 'un mot pour elle' : null,
                        ]
                          .filter(Boolean)
                          .join(' · '),
                      )}
                    </span>
                    {!avenir && (
                      <span className="small">
                        {espacesFines(
                          g.coureurs === 0
                            ? 'Personne n’a encore fini une course'
                            : `${formatNumber(g.coureurs)} coureur${g.coureurs > 1 ? 's' : ''}, ${formatNumber(g.departs)} course${g.departs > 1 ? 's' : ''} finie${g.departs > 1 ? 's' : ''} · ${
                                g.vainqueurs === 0 ? 'personne ne l’a battu' : `${formatNumber(g.vainqueurs)} l’${g.vainqueurs > 1 ? 'ont' : 'a'} battu`
                              }`,
                        )}
                      </span>
                    )}
                    <span className="annonce-faite-etat">{avenir ? 'À venir' : court ? 'Court aujourd’hui' : 'Couru'}</span>
                  </span>
                  <span className="annonce-faite-gestes">
                    <a className="salon-geste" href={`/grand-prix?essai=${encodeURIComponent(g.id)}`}>
                      <Icon name="play" />
                      Essayer
                    </a>
                    {avenir && (
                      <button type="button" className="salon-geste" aria-disabled={occupe !== null || undefined} onClick={() => reprendre(g)}>
                        <Icon name="edit" />
                        Modifier
                      </button>
                    )}
                    {avenir && (
                      <button type="button" className="salon-geste" aria-disabled={occupe !== null || undefined} onClick={() => void retirer(g)}>
                        <Icon name="x" />
                        {occupe === g.id ? '…' : 'Retirer'}
                      </button>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}
