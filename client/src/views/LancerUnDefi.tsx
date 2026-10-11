import { useState } from 'react'
import { Icon } from '../components/Icon'
import { Sortie } from '../components/Pieces'
import { ChoixDuTheme } from '../components/ChoixDuTheme'
import { OR, lueur } from '../components/Atlas'
import { espacesFines } from '../format'
import { PAGE_DES_DUELS } from './adressesDesDuels'
import { nomDuChoix } from '../../../shared/nomDuChoix'
import type { Sujet } from '../../../shared/sujets'
import type { AmiDeCampagne } from '../../../shared/campagne'

/** « Tom, Hugo et Inès » : des prénoms dans une phrase. */
const enPhrase = (noms: readonly string[]) => (noms.length <= 1 ? (noms[0] ?? '') : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`)

/**
 * Lancer un défi entre amis (`/duels#defier`), en trois temps : avec qui
 * — ses amis, en pastilles qu'on coche —, sur quoi — la grille de la série,
 * catégories ou sujet —, puis on le joue d'abord. À sa dernière réponse, il
 * part aux amis choisis, son score à battre avec lui, et leur téléphone
 * sonne (le souhait du propriétaire du 11 octobre 2026 : « choisir avec qui
 * je le lance, sur quel thème. Quitte à faire le quiz moi et que ça envoie
 * une notif à la personne pour faire le même »). Sans ami encore, il part
 * par son lien, à sa fin.
 */
export function LancerUnDefi({
  amis,
  categoriesJouables,
  sujets,
  depart,
  busy,
  erreur,
  onLancer,
  onRetour,
}: {
  /** Ses amis ; null tant qu'ils arrivent. */
  amis: readonly AmiDeCampagne[] | null
  categoriesJouables: readonly string[]
  sujets: readonly Sujet[]
  /** Ce qui est choisi en arrivant : les catégories ou le sujet de sa dernière série, l'ami touché dans la page des duels. */
  depart: { categories: readonly string[]; sujet: string | null; ami?: string }
  busy: boolean
  erreur: string
  onLancer: (categories: string[], sujet: string | null, amis: string[]) => void
  onRetour: () => void
}) {
  const [choisis, setChoisis] = useState<ReadonlySet<string>>(() => new Set(depart.ami ? [depart.ami] : []))
  const [categories, setCategoriesBrut] = useState<string[]>(() => [...depart.categories])
  const [sujet, setSujet] = useState<string | null>(depart.sujet)
  // Toucher une catégorie quitte le sujet, comme dans la série.
  const setCategories = (c: string[]) => {
    setCategoriesBrut(c)
    setSujet(null)
  }
  const basculer = (id: string) =>
    setChoisis(c => {
      const n = new Set(c)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  // Un ami parti de la liste entre-temps (retiré, masqué) ne se défie plus.
  const defies = (amis ?? []).filter(a => choisis.has(a.profileId))
  const quoi = nomDuChoix(categories, sujet) ?? 'toutes les catégories'
  return (
    <div className="player-shell campagne">
      <Sortie vers="Les duels" href={PAGE_DES_DUELS} onClick={onRetour} />
      <section className="atlas-branche campagne-heros defi-heros" style={lueur(OR)}>
        <span className="atlas-categorie">Défi entre amis</span>
        <h1>Lance ton défi</h1>
        <ol className="defier-etapes">
          <li>
            <b>1</b> avec qui
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
          Avec qui ?
        </h2>
        {amis === null ? (
          <p className="muted small" aria-busy="true">
            Tes amis arrivent…
          </p>
        ) : amis.length === 0 ? (
          <p className="muted small">
            {espacesFines('Pas encore d’amis ici : à la fin, tu enverras son lien à qui tu veux. Ceux qui le relèvent deviennent tes amis — le prochain, tu les choisiras ici.')}
          </p>
        ) : (
          <>
            <div className="duel-amis-liste" role="group" aria-label="Les amis à défier">
              {amis.map(a => {
                const coche = choisis.has(a.profileId)
                return (
                  <button key={a.profileId} type="button" className={'duel-ami' + (coche ? ' choisi' : '')} aria-pressed={coche} onClick={() => basculer(a.profileId)}>
                    <span className="duel-ami-avatar" aria-hidden="true">
                      {a.avatar}
                    </span>
                    <span className="duel-ami-nom">{a.nom}</span>
                    <Icon name={coche ? 'check' : 'plus'} />
                  </button>
                )
              })}
            </div>
            <p className="muted small">{defies.length === 0 ? 'Personne de choisi : il partira par son lien, à la fin.' : 'Et à qui tu veux d’autre, par son lien, à la fin.'}</p>
          </>
        )}
      </section>

      <section className="card defier-etape" aria-labelledby="defier-quoi">
        <h2 id="defier-quoi" className="defier-titre">
          <span className="defier-numero" aria-hidden="true">
            2
          </span>
          Sur quoi ?
          <span className="defier-choix">{quoi}</span>
        </h2>
        <ChoixDuTheme categoriesJouables={categoriesJouables} sujets={sujets} categories={categories} sujet={sujet} onCategories={setCategories} onSujet={setSujet} />
      </section>

      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary btn-big btn-block"
        aria-disabled={busy || undefined}
        onClick={() =>
          onLancer(
            sujet ? [] : categories,
            sujet,
            defies.map(a => a.profileId),
          )
        }
      >
        <Icon name="play" />
        {/* Les prénoms dans la phrase dessous : en capitales, deux suffisaient à faire déborder le gros bouton. */}
        Jouer le défi
      </button>
      <p className="muted small centre">
        {espacesFines(
          defies.length > 0
            ? `Tu joues d’abord, trois vies. À ta dernière réponse, il part à ${enPhrase(defies.map(a => a.nom))} : dans ${defies.length > 1 ? 'leurs' : 'ses'} duels, et ${defies.length > 1 ? 'leur' : 'son'} téléphone sonne s’${defies.length > 1 ? 'ils ont' : 'il a'} activé les notifications.`
            : 'Tu joues d’abord, trois vies. À la fin, envoie son lien : qui l’ouvre, profil en main, joue les mêmes questions, une fois, dans la semaine.',
        )}
      </p>
    </div>
  )
}
