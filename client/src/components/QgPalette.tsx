import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { api } from '../api'
import { Icon, type IconName } from './Icon'
import { Feuille } from './Pieces'
import { PERIODE_EN_TOUTES_LETTRES, type PeriodeDuQg } from '../../../shared/qgPeriodes'
import type { ProfilDAdministration } from '../../../shared/profil'

/** Une page du QG, telle que la palette la propose : son nom, son groupe du rail, son icône, et ce qu'on y trouve. */
export interface PageDeLaPalette<E> {
  ecran: E
  nom: string
  groupe: string
  icone: IconName
  /** Ce qu'on tape pour y venir sans connaître son nom : sa description, et d'autres mots (« turso », « bandeau »). */
  mots?: string
}

/** Un geste, qu'on cherche par ce qu'on veut faire : il ouvre la page où il se fait. */
export interface GesteDeLaPalette<E> {
  nom: string
  icone: IconName
  ecran: E
  mots: string
}

interface Choix {
  cle: string
  groupe: string
  nom: string
  detail?: string
  /** Ce que la recherche lit en plus du nom, sans le montrer. */
  mots?: string
  /** Ne se montre qu'à la recherche. */
  cache?: boolean
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
 * aller à une page, faire un geste, changer la période, comparer, ouvrir la
 * fiche d'un joueur cherché par son prénom ou son identifiant — sans passer
 * par le rail. Une page se trouve aussi par ce qu'on y fait (« bandeau »,
 * « réserve », « turso » ne trouvaient rien, la revue d'ergonomie du
 * 4 novembre 2026). Le clavier la parcourt (↑ ↓, Entrée) ; le doigt la touche.
 * Une feuille, comme toute fenêtre de l'application (`Feuille` : le reste de
 * la page inerte, Échap la ferme, le focus revient d'où l'on venait). Les
 * profils se cherchent par la route de « Chercher un joueur », le temps de
 * finir le mot.
 */
export function PaletteDuQg<E>({
  pages,
  gestes = [],
  aller,
  periode,
  periodes,
  changerDePeriode,
  comparer,
  changerLaComparaison,
  ouvrirLeProfil,
  raccourci = '⌘K',
  onFermer,
}: {
  pages: readonly PageDeLaPalette<E>[]
  gestes?: readonly GesteDeLaPalette<E>[]
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
  /** « ⌘K » sur un Mac, « Ctrl K » ailleurs. */
  raccourci?: string
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
    ...pages.map(p => ({ cle: `page-${p.nom}`, groupe: 'Les pages', nom: p.nom, detail: p.groupe, mots: p.mots, icone: p.icone, faire: fermerPuis(() => aller(p.ecran)) })),
    // Les gestes ne se montrent qu'à la recherche : la liste d'office reste celle des pages.
    ...gestes.map(g => ({ cle: `geste-${g.nom}`, groupe: 'Les gestes', nom: g.nom, mots: g.mots, icone: g.icone, cache: true, faire: fermerPuis(() => aller(g.ecran)) })),
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
    ...(q ? tous.filter(c => simple(`${c.nom} ${c.detail ?? ''} ${c.mots ?? ''}`).includes(q)) : tous.filter(c => !c.cache)),
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
        <span className="sr-only">Une page, un geste, une période, un joueur</span>
        <input
          ref={champ}
          type="search"
          value={cherche}
          placeholder="Une page, un geste, un joueur…"
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
            {q.length >= 2 ? 'Rien ne correspond — un prénom, une page, un geste, « 30 jours »…' : 'Rien ne correspond.'}
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
      {/* Le clavier, au clavier seulement : au toucher, ces mots ne disaient rien (`.qg-palette-pied`, caché sans souris). */}
      <p className="qg-palette-pied muted small">↑ ↓ pour choisir · Entrée pour ouvrir · « / » ou {raccourci} l’ouvrent de partout</p>
    </Feuille>
  )
}
