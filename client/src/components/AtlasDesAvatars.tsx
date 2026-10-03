import { Fragment, useState, type CSSProperties, type ReactNode } from 'react'
import { Icon } from './Icon'
import { DetailPortrait } from './Apparence'
import { DetailDivin, DetailLegendaire } from './Carriere'
import { Legendaire } from './Legendaire'
import { Divin } from './Divin'
import { LEGENDAIRES } from '../../../shared/legendaires'
import { DIVINS } from '../../../shared/divins'
import { Case, LILAS, LUEUR, OR, Orbe, Panneau, Rail, lueur } from './Atlas'
import { dessinDuPortrait, useDessins } from './medaillons'
import type { ChoixDuProfil } from './choix'
import { BRANCHES, nomDansLaPhrase, ouvertsDansLaBranche, portraitsOuverts, portrait, prochainDansLaBranche, savoirDesEcussons, type Branche, type CleDeBranche } from '../../../shared/branches'
import { brilleChez, type PublicProfileDetail } from '../../../shared/profil'

// Les avatars du savoir, en atlas : un rail des douze branches, chacune un
// orbe dont l'anneau se remplit à chaque portrait gagné, puis la branche
// choisie en chemin lumineux — six étapes, du visage à la forme ultime, la
// prochaine qui palpite et dit ce qui manque. On parcourt d'un doigt (le
// rail, ou les flèches), sans déplier ni replier une liste. Les fiches
// (« Le porter ») sont celles de toujours (`Apparence`, `Carriere`).

const SORTES = BRANCHES.map(b => `branche:${b.key}` as const)

/** La branche qu'on ouvre d'abord : celle du portrait porté, sinon la plus avancée qui a encore à gagner. */
function brancheDuDebut(savoir: Record<string, number>, porte: string | null | undefined): CleDeBranche {
  const p = portrait(porte)
  if (p) return p.branche
  const enCours = BRANCHES.filter(b => prochainDansLaBranche(b, savoir))
  return [...enCours].sort((a, b) => (savoir[b.categorie] ?? 0) - (savoir[a.categorie] ?? 0))[0]?.key ?? BRANCHES[0].key
}

const bonnes = (n: number) => `${n} bonne${n > 1 ? 's' : ''} réponse${n > 1 ? 's' : ''}`

/**
 * Les légendaires dans leur écrin, ou le savoir en atlas — un onglet chacun
 * de « Mes avatars ». Une seule façon de parcourir — glisser, toucher un
 * orbe, toucher une case —, et la fiche de chaque avatar pour le porter.
 */
export function AtlasDesAvatars({
  profil,
  busy,
  enregistrer,
  onglet,
}: {
  profil: PublicProfileDetail
  busy: boolean
  enregistrer: (patch: ChoixDuProfil) => void
  /** Les légendaires seuls, ou le savoir seul : chaque onglet de « Mes avatars » a le sien. */
  onglet: 'legendaires' | 'savoir'
}) {
  const savoir = savoirDesEcussons(profil.ecussons ?? [])
  const porte = profil.legendaire ?? null
  const [rayon, setRayon] = useState<'legendaires' | CleDeBranche>(() => (onglet === 'legendaires' ? 'legendaires' : brancheDuDebut(savoir, porte)))
  const [ouvert, setOuvert] = useState<string | null>(null)
  const dessins = useDessins(...SORTES, 'legendaire', 'divin')
  const { Portrait } = dessins
  // Les flèches passent d'une branche à l'autre, dans l'onglet du savoir.
  const ordre: CleDeBranche[] = BRANCHES.map(b => b.key)
  const index = rayon === 'legendaires' ? -1 : ordre.indexOf(rayon)
  const choisir = (r: 'legendaires' | CleDeBranche) => {
    setRayon(r)
    setOuvert(null)
  }
  const voisin = (d: number) => () => choisir(ordre[(index + d + ordre.length) % ordre.length])
  const toucher = (k: string) => setOuvert(o => (o === k ? null : k))
  const brille = (k: string) => profil.eclats.includes(k) && brilleChez(profil, k)
  const dessin = (k: string, verrouille: boolean) =>
    Portrait && dessinDuPortrait(dessins, k) ? <Portrait cle={k} verrouille={verrouille} eclat={brille(k)} /> : <span className="pt" aria-hidden="true" />
  const divins = profil.divins ?? []

  return (
    <div className="atlas">
      {onglet === 'savoir' && (
      <Rail choisi={rayon} label="Les douze branches" compact>
        {BRANCHES.map(x => {
          const n = ouvertsDansLaBranche(x, savoir)
          return (
            <Orbe
              key={x.key}
              nom={x.nom}
              compte={`${n}/${x.portraits.length}`}
              part={n / x.portraits.length}
              couleur={LUEUR[x.key]}
              choisi={rayon === x.key}
              compact
              onClick={() => choisir(x.key)}
            >
              {dessin(x.portraits[Math.max(0, n - 1)].key, n === 0)}
            </Orbe>
          )
        })}
      </Rail>
      )}

      {rayon === 'legendaires' && (
        <Panneau
          couleur={OR}
          surtitre="Tes exploits"
          titre="Les légendaires"
          compteur={`${profil.legendaires.length} sur ${LEGENDAIRES.length}`}
          objectif="Chacun se réveille par un exploit. Touche-le pour savoir lequel."
        >
          <div className="hud-grille">
            {LEGENDAIRES.map(l => {
              const gagne = profil.legendaires.includes(l.key)
              return (
                <Fragment key={l.key}>
                  <Case gagne={gagne} porte={porte === l.key} ouverte={ouvert === l.key} label={`${l.nom}${gagne ? '' : ', à gagner'}`} onClick={() => toucher(l.key)}>
                    <Legendaire cle={l.key} verrouille={!gagne} eclat={brille(l.key)} />
                  </Case>
                  {ouvert === l.key && (
                    <div className="fiche-case hud-fiche">
                      <DetailLegendaire
                        cle={l.key}
                        debloques={profil.legendaires}
                        eclats={profil.eclats}
                        eteints={profil.eclatsEteints ?? []}
                        porte={porte}
                        hautsFaits={profil.hautsFaits}
                        busy={busy}
                        onPorter={k => enregistrer({ legendaire: k })}
                        onEclat={b => enregistrer({ eclat: { cle: l.key, brille: b } })}
                        dessin={<Legendaire cle={l.key} verrouille={!gagne} eclat={brille(l.key)} grand />}
                      />
                    </div>
                  )}
                </Fragment>
              )
            })}
          </div>
          <div className="hud-divins" style={lueur(LILAS)}>
            <h4 className="hud-titre">
              Les Divins <span>{divins.length ? `${divins.length} descendu${divins.length > 1 ? 's' : ''}` : 'Ils ne disent pas comment'}</span>
            </h4>
            <div className="hud-grille hud-grille-divins">
              {DIVINS.map(d => {
                const la = divins.some(x => x.key === d.key)
                return (
                  <Fragment key={d.key}>
                    <Case gagne={la} porte={porte === d.key} ouverte={ouvert === d.key} label={la ? d.nom : 'Un Divin, inconnu'} onClick={() => toucher(d.key)}>
                      <Divin cle={d.key} verrouille={!la} />
                    </Case>
                    {ouvert === d.key && (
                      <div className="fiche-case hud-fiche">
                        <DetailDivin cle={d.key} descendus={divins} porte={porte} busy={busy} onPorter={k => enregistrer({ legendaire: k })} dessin={<Divin cle={d.key} verrouille={!la} grand />} />
                      </div>
                    )}
                  </Fragment>
                )
              })}
            </div>
          </div>
        </Panneau>
      )}

      {rayon !== 'legendaires' && (
        <Chemin
          branche={BRANCHES[index]}
          savoir={savoir}
          porte={porte}
          ouvert={ouvert}
          dessin={dessin}
          onToucher={toucher}
          onPrecedente={voisin(-1)}
          onSuivante={voisin(1)}
          fiche={k => (
            <>
            <span className="detail-dessin detail-portrait-grand" aria-hidden="true">
              {dessin(k, !portraitsOuverts(savoir).includes(k))}
            </span>
            <DetailPortrait
              cle={k}
              savoir={savoir}
              porte={porte}
              eclat={profil.eclats.includes(k)}
              brille={brilleChez(profil, k)}
              busy={busy}
              onPorter={l => enregistrer({ legendaire: l })}
              onEclat={b => enregistrer({ eclat: { cle: k, brille: b } })}
            />
            </>
          )}
        />
      )}
    </div>
  )
}

/** Une branche en chemin : six étapes reliées par un trait qui s'allume jusqu'au dernier portrait gagné. */
function Chemin({
  branche: b,
  savoir,
  porte,
  ouvert,
  dessin,
  fiche,
  onToucher,
  onPrecedente,
  onSuivante,
}: {
  branche: Branche
  savoir: Record<string, number>
  porte: string | null
  ouvert: string | null
  dessin: (cle: string, verrouille: boolean) => ReactNode
  fiche: (cle: string) => ReactNode
  onToucher: (cle: string) => void
  onPrecedente: () => void
  onSuivante: () => void
}) {
  const justes = savoir[b.categorie] ?? 0
  const n = ouvertsDansLaBranche(b, savoir)
  const prochain = prochainDansLaBranche(b, savoir)
  return (
    <section className="atlas-branche" style={{ '--lueur': LUEUR[b.key], '--fait': n / b.portraits.length } as CSSProperties} aria-labelledby="atlas-nom">
      <header className="atlas-tete">
        <button type="button" className="atlas-fleche" aria-label="Branche précédente" onClick={onPrecedente}>
          <Icon name="chevron-down" />
        </button>
        <div>
          <span className="atlas-categorie">{b.categorie}</span>
          <h3 id="atlas-nom">{b.nom}</h3>
          <span className="atlas-compteur">
            {justes} bonnes réponses · {n} sur {b.portraits.length}
          </span>
        </div>
        <button type="button" className="atlas-fleche atlas-fleche-suivante" aria-label="Branche suivante" onClick={onSuivante}>
          <Icon name="chevron-down" />
        </button>
      </header>
      <p className="atlas-objectif">
        {prochain ? (
          <>
            Encore <b>{bonnes(prochain.manque)}</b> en {b.categorie} pour {nomDansLaPhrase(prochain.portrait.nom)}
          </>
        ) : (
          'Branche complète : tous ses portraits sont à toi.'
        )}
      </p>
      <ol className="atlas-chemin">
        {b.portraits.map(p => {
          const gagne = justes >= p.seuil
          const etat = gagne ? 'gagne' : prochain?.portrait.key === p.key ? 'prochain' : 'ferme'
          return (
            <Fragment key={p.key}>
              <li className={`atlas-etape atlas-${etat}`}>
                <button type="button" className="atlas-noeud" aria-expanded={ouvert === p.key} onClick={() => onToucher(p.key)}>
                  <span className="atlas-medaillon">{dessin(p.key, !gagne)}</span>
                  <span className="atlas-texte">
                    <b>{p.nom}</b>
                    <span className="atlas-seuil">
                      {gagne ? `Gagné · ${bonnes(p.seuil)}` : etat === 'prochain' ? `À ${p.seuil} · encore ${p.seuil - justes}` : `À ${bonnes(p.seuil)}`}
                    </span>
                  </span>
                  {porte === p.key && <span className="pastille-attente">Porté</span>}
                </button>
                {ouvert === p.key && <div className="fiche-case atlas-fiche">{fiche(p.key)}</div>}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </section>
  )
}
