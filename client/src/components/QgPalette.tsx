import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { api } from '../api'
import { Icon, type IconName } from './Icon'
import { Feuille } from './Pieces'
import { PERIODE_EN_TOUTES_LETTRES, type PeriodeDuQg } from '../../../shared/qgPeriodes'
import type { ProfilDAdministration } from '../../../shared/profil'

/** Une page du QG, telle que la palette la propose : son nom, son groupe du rail, son icône. */
export interface PageDeLaPalette<E> {
  ecran: E
  nom: string
  groupe: string
  icone: IconName
}

interface Choix {
  cle: string
  groupe: string
  nom: string
  detail?: string
  icone: IconName
  faire: () => void
}

/** On cherche sans accent ni majuscule : « economie » trouve « L’économie ». */
const simple = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/**
 * La palette du QG 2 (⌘K, Ctrl+K ou « / » de partout ; la loupe de la barre) :
 * aller à une page, changer la période, comparer, ouvrir la fiche d'un
 * joueur cherché par son prénom ou son identifiant — sans passer par le rail.
 * Le clavier la parcourt (↑ ↓, Entrée) ; le doigt la touche. Une feuille, comme
 * toute fenêtre de l'application (`Feuille` : le reste de la page inerte,
 * Échap la ferme, le focus revient d'où l'on venait). Les profils se cherchent
 * par la route de « Les profils », le temps de finir le mot.
 */
export function PaletteDuQg<E>({
  pages,
  aller,
  periode,
  periodes,
  changerDePeriode,
  comparer,
  changerLaComparaison,
  ouvrirLeProfil,
  onFermer,
}: {
  pages: readonly PageDeLaPalette<E>[]
  aller: (e: E) => void
  /** La période de la page, quand elle en lit une ; sinon, la palette n'en propose pas. */
  periode: PeriodeDuQg | null
  /** Celles que la page offre : le serveur ne garde pas trente jours. */
  periodes: readonly PeriodeDuQg[]
  changerDePeriode: (p: PeriodeDuQg) => void
  /** Null sur une page qui ne compare pas. */
  comparer: boolean | null
  changerLaComparaison: (oui: boolean) => void
  ouvrirLeProfil: (p: Pick<ProfilDAdministration, 'id' | 'nom'>) => void
  onFermer: () => void
}) {
  const [cherche, setCherche] = useState('')
  const [profils, setProfils] = useState<ProfilDAdministration[]>([])
  const [actif, setActif] = useState(0)
  const champ = useRef<HTMLInputElement>(null)
  const id = useId()

  useEffect(() => {
    champ.current?.focus()
  }, [])
  useEffect(() => {
    const q = cherche.trim()
    if (q.length < 2) return setProfils([])
    let perimee = false
    const minuteur = setTimeout(() => {
      api.admin.profils(q).then(
        l => !perimee && setProfils(l.profils.slice(0, 6)),
        () => !perimee && setProfils([]),
      )
    }, 250)
    return () => {
      perimee = true
      clearTimeout(minuteur)
    }
  }, [cherche])

  const fermerPuis = (geste: () => void) => () => {
    onFermer()
    geste()
  }
  const tous: Choix[] = [
    ...pages.map(p => ({ cle: `page-${p.nom}`, groupe: 'Les pages', nom: p.nom, detail: p.groupe, icone: p.icone, faire: fermerPuis(() => aller(p.ecran)) })),
    ...(periode === null
      ? []
      : [
          ...periodes
            .filter(p => p !== periode)
            .map(p => ({
              cle: `periode-${p}`,
              groupe: 'La période',
              nom: `Voir ${PERIODE_EN_TOUTES_LETTRES[p]}`,
              icone: 'clock' as IconName,
              faire: fermerPuis(() => changerDePeriode(p)),
            })),
          ...(comparer === null
            ? []
            : [
                {
                  cle: 'comparer',
                  groupe: 'La période',
                  nom: comparer ? 'Ne plus comparer à la période d’avant' : 'Comparer à la période d’avant',
                  icone: 'bar-chart' as IconName,
                  faire: fermerPuis(() => changerLaComparaison(!comparer)),
                },
              ]),
        ]),
  ]
  const q = simple(cherche.trim())
  const visibles = [
    ...(q ? tous.filter(c => simple(`${c.nom} ${c.detail ?? ''}`).includes(q)) : tous),
    ...profils.map(p => ({
      cle: `profil-${p.id}`,
      groupe: 'Les profils',
      nom: p.nom,
      detail: `@${p.login}`,
      icone: 'users' as IconName,
      faire: fermerPuis(() => ouvrirLeProfil({ id: p.id, nom: p.nom })),
    })),
  ]
  const choisi = Math.min(actif, Math.max(0, visibles.length - 1))
  const clavier = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActif(Math.max(0, Math.min(visibles.length - 1, choisi + (e.key === 'ArrowDown' ? 1 : -1))))
    } else if (e.key === 'Enter' && visibles[choisi]) {
      e.preventDefault()
      visibles[choisi].faire()
    }
  }

  let groupe = ''
  return (
    <Feuille titre="Aller à…" onFermer={onFermer} className="qg-palette">
      <label className="qg-palette-champ">
        <Icon name="search" />
        <span className="sr-only">Une page, une période, un joueur</span>
        <input
          ref={champ}
          type="search"
          value={cherche}
          placeholder="Une page, une période, un joueur…"
          role="combobox"
          aria-expanded="true"
          aria-controls={`${id}-liste`}
          aria-activedescendant={visibles[choisi] ? `${id}-${choisi}` : undefined}
          autoComplete="off"
          onChange={e => {
            setCherche(e.target.value)
            setActif(0)
          }}
          onKeyDown={clavier}
        />
      </label>
      <ul className="qg-palette-liste" id={`${id}-liste`} role="listbox" aria-label="Où aller">
        {visibles.length === 0 && (
          <li className="qg-palette-vide" role="presentation">
            {q.length >= 2 ? 'Rien ne correspond — un prénom, une page, « 30 jours »…' : 'Rien ne correspond.'}
          </li>
        )}
        {visibles.map((c, i) => {
          const tete = c.groupe !== groupe
          groupe = c.groupe
          return [
            tete && (
              <li key={`${c.groupe}-tete`} className="qg-palette-groupe" role="presentation">
                {c.groupe}
              </li>
            ),
            <li
              key={c.cle}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === choisi}
              className="qg-palette-choix"
              onPointerMove={() => i !== choisi && setActif(i)}
              onClick={c.faire}
            >
              <Icon name={c.icone} />
              <span className="qg-palette-nom">{c.nom}</span>
              {c.detail && <span className="qg-palette-detail">{c.detail}</span>}
            </li>,
          ]
        })}
      </ul>
      <p className="qg-palette-pied muted small">↑ ↓ pour choisir · Entrée pour ouvrir · « / » l’ouvre de partout</p>
    </Feuille>
  )
}
