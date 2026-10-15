import { useEffect, useId, useState, type CSSProperties } from 'react'
import { Icon, type IconName } from './Icon'
import { Feuille } from './Pieces'
import { aLaDemande, useALaDemande } from '../aLaDemande'
import { relireLesMissions, viserLaCategorie } from '../missions'
import { COFFRES_PEINTS } from './coffres-peints'
import { espacesFines, formatNumber } from '../format'
import {
  CONFETTIS_D_UNE_MISSION,
  CONFETTIS_DES_TROIS,
  NOM_DE_LA_FAMILLE,
  RANG_DES_TROIS,
  resteAGagner,
  XP_D_UNE_MISSION,
  XP_DES_TROIS,
  type MissionsDuJour,
  type MissionVue,
  type SorteDeMission,
} from '../../../shared/missions'
import { NOM_DU_COFFRE, rangDuCoffre, TAMPONS_DU_RANG, TAMPONS_PAR_SEMAINE, type CoffreEnAttente } from '../../../shared/coffre'
import { jourEnToutesLettres } from '../../../shared/jour'

// Les missions du jour sur l'accueil, leur feuille, et ce que la fin d'une
// partie en annonce (le plan d'action validé avec le propriétaire le 14
// octobre 2026 ; la maquette C — une ligne fine sous le bandeau, qui ne
// repousse pas les gros boutons de jeu). La scène du coffre, lourde de ses
// images et de son animation, vient à la demande (`Coffre.tsx`).

/** La scène de l'ouverture d'un coffre, à la demande : elle ne pèse rien à l'accueil tant qu'aucun coffre n'attend. */
export const laSceneDuCoffre = aLaDemande(() => import('./Coffre'))

const ICONE: Readonly<Record<SorteDeMission, IconName>> = {
  jour: 'sun',
  'jour-etoiles': 'star',
  justes: 'check-circle',
  categorie: 'bulb',
  serie: 'target',
  duel: 'swords',
  sentier: 'mountain',
  parcours: 'book',
  defi: 'trophy',
  revision: 'rotate',
}

/** L'anneau d'une mission : plein et coché quand elle est faite, sa part d'or sinon. */
function Anneau({ m }: { m: MissionVue }) {
  if (m.faite) {
    return (
      <span className="mission-anneau mission-anneau-fait">
        <Icon name="check" />
      </span>
    )
  }
  return <span className="mission-anneau" style={{ '--part': `${Math.round((m.avance / m.cible) * 100)}%` } as CSSProperties} />
}

/** « plus que 7 h », « plus que 40 min » : le temps qui reste à ses missions du jour. */
function avantMinuit(minutes: number): string {
  if (minutes >= 60) return `plus que ${Math.floor(minutes / 60)} h`
  return `plus que ${Math.max(1, minutes)} min`
}

/**
 * La ligne des missions, sur l'accueil : ce qui reste à gagner aujourd'hui,
 * et trois anneaux. Un coffre qui attend passe devant : elle s'allume d'or.
 * Toujours à sa place, même en chemin — sa hauteur est gardée, rien ne saute
 * sous le doigt quand elle arrive.
 */
export function LigneDesMissions({ missions, onOuvrir }: { missions: MissionsDuJour | null | 'perdu'; onOuvrir: () => void }) {
  if (missions === 'perdu') return null
  if (!missions) return <div className="missions-ligne missions-en-chemin" aria-hidden="true" />
  const faites = missions.missions.filter(m => m.faite).length
  const coffre = missions.coffres[0]
  const reste = resteAGagner(missions)
  const titre = coffre ? 'Ton coffre t’attend !' : 'Missions du jour'
  // Une ligne chacun, en 360 de large : le titre et ses anneaux, puis ce qui reste — sur trois colonnes, tout passait à la ligne.
  const detail = coffre
    ? `${NOM_DU_COFFRE[coffre.rang]} de ta semaine`
    : missions.trois
      ? 'Les trois sont faites : à demain'
      : `🎊 ${reste.confettis} et ${reste.xp} XP à gagner aujourd’hui`
  return (
    <button type="button" className={'missions-ligne' + (coffre ? ' missions-coffre' : '')} onClick={onOuvrir} onPointerDown={() => coffre && void laSceneDuCoffre.charger().catch(() => {})}>
      <span className="missions-icone" aria-hidden="true">
        <Icon name={coffre ? 'coffre' : 'missions'} />
      </span>
      <span className="missions-texte">
        <span className="missions-tete">
          <b>
            {titre}
            {/* Les anneaux le disent à l'œil ; le compte, à l'oreille. */}
            {!coffre && <span className="sr-only">{`, ${faites} sur ${missions.missions.length} faites`}</span>}
          </b>
          <span className="missions-anneaux" aria-hidden="true">
            {missions.missions.map(m => (
              <Anneau key={m.rang} m={m} />
            ))}
          </span>
        </span>
        <span className="missions-detail">{espacesFines(detail)}</span>
      </span>
    </button>
  )
}

/** Une mission dans sa feuille : sa famille, ce qu'il faut faire, où il en est, et où la faire d'un toucher. */
function CarteDeMission({ m }: { m: MissionVue }) {
  return (
    <li className={'mission' + (m.faite ? ' mission-faite' : '')}>
      <span className="mission-coche" aria-hidden="true">
        <Icon name={m.faite ? 'check' : ICONE[m.sorte]} />
      </span>
      <span className="mission-texte">
        {/* Ce qu'elle paie, sur la ligne de sa famille : à côté du titre, il le faisait passer sur trois lignes. */}
        <span className="mission-tete">
          <span className={`mission-famille mission-famille-${m.famille}`}>{NOM_DE_LA_FAMILLE[m.famille]}</span>
          {!m.faite && <span className="mission-gain">{espacesFines(`🎊 ${CONFETTIS_D_UNE_MISSION} · ${XP_D_UNE_MISSION} XP`)}</span>}
        </span>
        <b>{espacesFines(m.titre)}</b>
        <span className="mission-aide">{espacesFines(m.aide)}</span>
        {m.faite ? (
          <span className="mission-faite-le">Faite · 🎊 +{CONFETTIS_D_UNE_MISSION} · +{XP_D_UNE_MISSION} XP</span>
        ) : (
          <span className="mission-pied">
            <span className="jauge-fine" aria-hidden="true">
              <span style={{ width: `${Math.round((m.avance / m.cible) * 100)}%` }} />
            </span>
            <span className="mission-compte">{`${m.avance} / ${m.cible}`}</span>
            <a className="mission-aller" href={m.lien.href} onClick={() => m.lien.categorie && viserLaCategorie(m.lien.categorie)}>
              {m.lien.libelle}
              <Icon name="chevron-right" />
            </a>
          </span>
        )}
      </span>
    </li>
  )
}

const JOURS_COURTS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/**
 * La carte de la semaine : un tampon par jour aux trois missions faites, du
 * lundi au dimanche, et le coffre qu'ils remplissent — de bois dès un tampon,
 * royal à sept. Le jour d'aujourd'hui cerclé, les jours à venir en attente.
 */
export function CarteDesTampons({ missions, compacte = false }: { missions: MissionsDuJour; compacte?: boolean }) {
  const { tampons, lundi } = missions.semaine
  const n = tampons.filter(Boolean).length
  const rang = rangDuCoffre(n)
  const aujourdhui = Math.round((Date.UTC(...(missions.jour.split('-').map(Number) as [number, number, number])) - Date.UTC(...(lundi.split('-').map(Number) as [number, number, number]))) / 86_400_000)
  const prochain = (['bois', 'argent', 'or', 'royal'] as const).find(r => TAMPONS_DU_RANG[r] > n)
  return (
    <section className={'tampons' + (compacte ? ' tampons-compacte' : '')} aria-label={`Ta carte de la semaine : ${n} tampon${n > 1 ? 's' : ''} sur ${TAMPONS_PAR_SEMAINE}`}>
      {!compacte && (
        <div className="tampons-tete">
          <b>Ton coffre de la semaine</b>
          <span className={'tampons-rang' + (rang ? ` tampons-rang-${rang}` : '')}>{rang ? NOM_DU_COFFRE[rang] : 'Pas encore de coffre'}</span>
        </div>
      )}
      <ol className="tampons-jours">
        {tampons.map((fait, i) => (
          <li key={i} className={'tampon' + (fait ? ' tampon-fait' : '') + (i === aujourdhui ? ' tampon-aujourdhui' : '') + (i > aujourdhui ? ' tampon-a-venir' : '')}>
            <span className="tampon-sceau" aria-hidden="true">
              {fait && <Icon name="star" />}
            </span>
            <span className="tampon-jour" aria-hidden="true">
              {JOURS_COURTS[i]}
            </span>
          </li>
        ))}
      </ol>
      {!compacte && (
        <p className="tampons-texte">
          {espacesFines(
            `Lundi, ton coffre s’ouvre : un thème, un compagnon, un fond de carte du trésor… ${
              prochain ? `Encore ${TAMPONS_DU_RANG[prochain] - n} tampon${TAMPONS_DU_RANG[prochain] - n > 1 ? 's' : ''} pour ${NOM_DU_COFFRE[prochain].toLowerCase()}.` : 'Le coffre royal est à toi.'
            }`,
          )}
        </p>
      )}
    </section>
  )
}

/** Un coffre qui attend son ouverture, en tête de la feuille : son dessin, son rang, et « Ouvrir ». */
function CoffreQuiAttend({ coffre, onOuvrir }: { coffre: CoffreEnAttente; onOuvrir: () => void }) {
  const peint = COFFRES_PEINTS[coffre.rang]
  return (
    <button type="button" className={`coffre-attend coffre-attend-${coffre.rang}`} onClick={onOuvrir} onPointerDown={() => void laSceneDuCoffre.charger().catch(() => {})}>
      {peint ? <img className="coffre-attend-image" src={peint.ferme} alt="" width={96} height={Math.round(96 * peint.rapport)} /> : <Icon name="coffre" />}
      <span className="coffre-attend-texte">
        <b>{`${NOM_DU_COFFRE[coffre.rang]} t’attend`}</b>
        <span>{espacesFines(`${coffre.tampons} tampon${coffre.tampons > 1 ? 's' : ''}, la semaine du ${jourEnToutesLettres(coffre.semaine, true)}`)}</span>
      </span>
      <span className="btn btn-primary coffre-attend-ouvrir">Ouvrir</span>
    </button>
  )
}

/**
 * La feuille des missions du jour : un coffre qui attend en tête, les trois
 * missions — où il en est, où les faire d'un toucher —, ce que paient les
 * trois, et la carte de la semaine.
 */
export function FeuilleDesMissions({ missions, onFermer }: { missions: MissionsDuJour | null | 'perdu'; onFermer: () => void }) {
  const [scene, setScene] = useState<CoffreEnAttente | null>(null)
  const module = useALaDemande(laSceneDuCoffre, scene !== null)
  // Un coffre qui attend : sa scène vient en fond dès la feuille ouverte, « Ouvrir » la montre tout de suite.
  const attend = missions && missions !== 'perdu' ? missions.coffres[0] : undefined
  useEffect(() => {
    if (attend) void laSceneDuCoffre.charger().catch(() => {})
  }, [attend?.semaine])
  return (
    <>
      <Feuille titre="Missions du jour" onFermer={onFermer} className="feuille-des-missions">
        {missions === 'perdu' ? (
          <p className="error" role="alert">
            Tes missions n’ont pas pu se charger : vérifie ta connexion, puis recharge la page.
          </p>
        ) : !missions ? (
          <p className="muted">Chargement…</p>
        ) : (
          <>
            {attend && <CoffreQuiAttend coffre={attend} onOuvrir={() => setScene(attend)} />}
            <p className="missions-sous-titre">{espacesFines(`Trois nouvelles à minuit : ${avantMinuit(missions.minutesAvantMinuit)} pour les faire.`)}</p>
            <ol className="missions-liste">
              {missions.missions.map(m => (
                <CarteDeMission key={m.rang} m={m} />
              ))}
            </ol>
            <p className={'missions-trois' + (missions.trois ? ' missions-trois-fait' : '')}>
              <Icon name={missions.trois ? 'check-circle' : 'sparkles'} />
              <span>
                {missions.trois ? 'Les trois sont faites : ' : 'Les trois faites : '}
                <b>{espacesFines(`🎊 +${CONFETTIS_DES_TROIS} · +${XP_DES_TROIS} XP`)}</b>
                {missions.trois ? ', et le tampon du jour.' : ', et un tampon.'}
              </span>
            </p>
            <CarteDesTampons missions={missions} />
          </>
        )}
      </Feuille>
      {scene && module && module !== 'perdu' && (
        <module.SceneDuCoffre
          attente={scene}
          onFermer={() => {
            setScene(null)
            void relireLesMissions().catch(() => {})
          }}
        />
      )}
      {scene && module === 'perdu' && (
        <Feuille titre="Le coffre" onFermer={() => setScene(null)}>
          <p className="error" role="alert">
            Le coffre n’a pas pu se charger : vérifie ta connexion, puis recharge la page.
          </p>
        </Feuille>
      )}
    </>
  )
}

/**
 * Ce que la fin d'une partie annonce de ses missions : celles qu'elle vient
 * de faire — la lecture d'après la partie les retient et les dit
 * (`nouvelles`) —, les trois et leur tampon, la carte de la semaine. Rien
 * s'il n'a rien fait de neuf, ou sans profil : la fin reste la même.
 */
export function MissionsDeLaFin() {
  const id = useId()
  const [m, setM] = useState<MissionsDuJour | null>(null)
  useEffect(() => {
    let vivant = true
    relireLesMissions().then(
      lues => vivant && setM(lues),
      () => {},
    )
    return () => {
      vivant = false
    }
  }, [])
  if (!m || m.nouvelles.length === 0) return null
  const faites = m.missions.filter(x => m.nouvelles.includes(x.rang))
  const trois = m.nouvelles.includes(RANG_DES_TROIS)
  const gagnes = faites.length * CONFETTIS_D_UNE_MISSION + (trois ? CONFETTIS_DES_TROIS : 0)
  const xp = faites.length * XP_D_UNE_MISSION + (trois ? XP_DES_TROIS : 0)
  return (
    <section className="card mission-accomplie" aria-labelledby={id}>
      <h3 id={id} className="mission-accomplie-titre">
        <Icon name="check-circle" />
        {faites.length > 1 ? 'Missions accomplies' : 'Mission accomplie'}
        <span className="mission-accomplie-gain">{espacesFines(`🎊 +${formatNumber(gagnes)} · +${formatNumber(xp)} XP`)}</span>
      </h3>
      <ul className="mission-accomplie-liste">
        {faites.map(f => (
          <li key={f.rang}>
            <Icon name={ICONE[f.sorte]} />
            {espacesFines(f.titre)}
          </li>
        ))}
      </ul>
      {trois && (
        <p className="mission-accomplie-trois">
          <b>Les trois missions sont faites !</b> {espacesFines(`Le bonus : 🎊 +${CONFETTIS_DES_TROIS} · +${XP_DES_TROIS} XP, et un tampon de plus.`)}
        </p>
      )}
      <CarteDesTampons missions={m} compacte />
      <a className="mission-accomplie-lien" href="/#missions">
        {m.trois ? 'Ma carte de la semaine' : `Mes missions du jour · ${m.missions.filter(x => x.faite).length} sur ${m.missions.length}`}
        <Icon name="chevron-right" />
      </a>
    </section>
  )
}
