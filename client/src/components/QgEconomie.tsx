import { useState } from 'react'
import { Chiffre, GrapheDesJours } from './QgModes'
import { aLaDemande, useALaDemande } from '../aLaDemande'
import { formatNumber } from '../../../shared/typographie'
import { NOM_DU_COFFRE, RANGS_DU_COFFRE, TAMPONS_DU_RANG, type RangDuCoffre } from '../../../shared/coffre'
import { lundiDe } from '../../../shared/missions'
import { heureEcrite } from '../../../shared/qg'
import { PRIX_D_UN_COMPAGNON } from '../../../shared/compagnons'
import {
  DEPENSES_DE_CONFETTIS,
  NOM_DE_LA_DEPENSE,
  NOM_DE_LA_SOURCE,
  SOURCES_DE_CONFETTIS,
  type DepenseDeConfettis,
  type PageDeLEconomie,
} from '../../../shared/qgEconomie'

/**
 * Ce que le QG suit de l'économie (`/admin#economie`, le choix du 13 octobre
 * 2026, sur maquettes) : les confettis gagnés et dépensés aujourd'hui et jour
 * par jour, d'où ils viennent et où ils partent, ceux qui circulent, les
 * meilleures ventes, les Éclats et les légendaires. Une seule couleur, celle
 * des confettis : une source n'est pas un mode, et la couleur d'un mode y
 * aurait fait lire « la campagne » là où l'on compte des achats.
 */

const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${formatNumber(n)} ${n > 1 ? motPluriel : mot}`
/** Un solde peut passer sous zéro : le signe moins, pas le trait d'union. */
const signe = (n: number) => (n < 0 ? `−${formatNumber(-n)}` : formatNumber(n))
const total = (xs: readonly number[]) => xs.reduce((n, x) => n + x, 0)

/** « 19 thèmes · 2 compagnons » : les achats d'aujourd'hui, sorte par sorte — une ligne de vies en achète jusqu'à dix. */
const MOTS_DES_ACHATS: Record<DepenseDeConfettis, [string, string]> = {
  themes: ['thème', 'thèmes'],
  compagnons: ['compagnon', 'compagnons'],
  fonds: ['fond de carte', 'fonds de carte'],
  vies: ['achat de vies', 'achats de vies'],
  sabliers: ['sablier', 'sabliers'],
  eclats: ['Éclat', 'Éclats'],
}

/** Les quatre chiffres d'aujourd'hui : gagnés, dépensés, les achats, ce qui circule. */
export function AujourdhuiDeLEconomie({ page }: { page: PageDeLEconomie | null }) {
  const a = page?.aujourdhui
  const net = a ? a.gagnes.aujourdhui - a.depenses.aujourdhui : 0
  const achats = a ? DEPENSES_DE_CONFETTIS.filter(d => a.achatsParSorte[d] > 0).map(d => pluriel(a.achatsParSorte[d], ...MOTS_DES_ACHATS[d])) : []
  return (
    <section className="qg-jour" aria-labelledby="economie-aujourdhui">
      <div className="qg-section-tete">
        <h2 className="compte-groupe" id="economie-aujourdhui">
          Aujourd’hui
        </h2>
        <span className="muted small">comparé à la même heure des sept jours d’avant</span>
      </div>
      <ul className="qg-tuiles qg-tuiles-quatre">
        <Chiffre nom="Gagnés" valeur={a ? formatNumber(a.gagnes.aujourdhui) : '–'} compte={a?.gagnes} detail={a ? 'confettis, toutes sources' : undefined} />
        <Chiffre nom="Dépensés" valeur={a ? formatNumber(a.depenses.aujourdhui) : '–'} compte={a?.depenses} detail={a ? 'confettis, en boutique' : undefined} />
        <Chiffre nom="Achats" valeur={a ? formatNumber(a.achats.aujourdhui) : '–'} compte={a?.achats} detail={achats.length > 0 ? achats.join(' · ') : a ? 'aucun encore' : undefined} />
        <Chiffre
          nom="En circulation"
          valeur={page?.circulation ? signe(page.circulation.total) : '–'}
          detail={a ? `${net >= 0 ? '+' : '−'} ${formatNumber(Math.abs(net))} aujourd’hui` : undefined}
        />
      </ul>
    </section>
  )
}

/** Les confettis gagnés et dépensés, jour par jour, sur trente jours : deux petits multiples à la même échelle de temps. */
export function GagnesEtDepenses({ page }: { page: PageDeLEconomie | null }) {
  const jours = page?.jours ?? []
  const gagnes = jours.map(j => j.gagnes)
  const depenses = jours.map(j => j.depenses)
  const multiple = (nom: string, valeurs: number[], titre: string) => (
    <li className="qg-multiple">
      <div className="qg-multiple-tete">
        <b>{nom}</b>
        <span className="num">{page ? formatNumber(total(valeurs)) : '–'}</span>
      </div>
      {page ? (
        <GrapheDesJours jours={jours.map(j => j.jour)} valeurs={valeurs} classe="qg-confettis" dire={n => pluriel(n, 'confetti')} titre={titre} petit />
      ) : (
        <p className="serif-note">Chargement…</p>
      )}
    </li>
  )
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="economie-jours">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="economie-jours">Gagnés et dépensés, jour par jour</h2>
        <span className="muted small">les trente derniers jours, en confettis</span>
      </div>
      <ul className="qg-multiples qg-multiples-deux">
        {multiple('Gagnés', gagnes, 'Les confettis gagnés, jour par jour')}
        {multiple('Dépensés', depenses, 'Les confettis dépensés, jour par jour')}
      </ul>
    </section>
  )
}

/** Une liste de pistes, la plus longue au bout : son nom, sa barre, son chiffre. */
function Pistes({ lignes }: { lignes: { cle: string; nom: string; valeur: number }[] }) {
  const max = Math.max(1, ...lignes.map(l => l.valeur))
  return (
    <ul className="qg-pistes">
      {lignes.map(l => (
        <li key={l.cle} className="qg-piste-ligne">
          <span className="qg-piste-nom">{l.nom}</span>
          <span className="qg-piste" aria-hidden="true">
            {l.valeur > 0 && <i className="qg-confettis" style={{ width: `${(l.valeur / max) * 100}%` }} />}
          </span>
          <b className="num">{formatNumber(l.valeur)}</b>
        </li>
      ))}
    </ul>
  )
}

/** D'où viennent les confettis, sur trente jours : la plus grosse source d'abord. */
export function SourcesDesConfettis({ page }: { page: PageDeLEconomie | null }) {
  const lignes = page
    ? SOURCES_DE_CONFETTIS.map(s => ({ cle: s, nom: NOM_DE_LA_SOURCE[s], valeur: page.sources[s] })).sort((a, b) => b.valeur - a.valeur)
    : []
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="economie-sources">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="economie-sources">D’où ils viennent</h2>
        <span className="muted small">trente jours, en confettis</span>
      </div>
      {page ? <Pistes lignes={lignes} /> : <p className="serif-note">Chargement…</p>}
      <p className="muted small">Une bonne réponse vaut un confetti partout. Les ligues paient chaque lundi la semaine close, les étoiles des sentiers à l’épreuve qui atteint la note.</p>
    </section>
  )
}

/** Où partent les confettis, sur trente jours : chaque rayon de la boutique, ses objets et ce qu'ils ont coûté. */
export function DepensesDesConfettis({ page }: { page: PageDeLEconomie | null }) {
  const lignes = page
    ? DEPENSES_DE_CONFETTIS.map(d => ({ cle: d, nom: `${NOM_DE_LA_DEPENSE[d]} · ${formatNumber(page.depenses[d].objets)}`, valeur: page.depenses[d].confettis })).sort(
        (a, b) => b.valeur - a.valeur,
      )
    : []
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="economie-depenses">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="economie-depenses">Où ils partent</h2>
        <span className="muted small">trente jours : les objets achetés, puis les confettis</span>
      </div>
      {page ? <Pistes lignes={lignes} /> : <p className="serif-note">Chargement…</p>}
      <p className="muted small">Un prix payé reste le sien : un thème qui change de prix ne change pas l’achat d’hier.</p>
    </section>
  )
}

/** « Moins de 100 », « 100 à 499 », « 1000 et plus » : une tranche de soldes. */
const nomDeLaTranche = (t: { de: number | null; a: number | null }) =>
  t.de === null ? `Moins de ${formatNumber(t.a ?? 0)}` : t.a === null ? `${formatNumber(t.de)} et plus` : `${formatNumber(t.de)} à ${formatNumber(t.a - 1)}`

/** Ce que les joueurs ont en poche : tous les soldes, relus une fois par jour, et combien en ont. */
export function EnCirculation({ page }: { page: PageDeLEconomie | null }) {
  const c = page?.circulation
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="economie-circulation">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="economie-circulation">En circulation</h2>
        <span className="muted small">{c ? `ce que les joueurs ont en poche · relu à ${heureEcrite(c.le)}, une fois par jour` : 'ce que les joueurs ont en poche'}</span>
      </div>
      {!page ? (
        <p className="serif-note">Chargement…</p>
      ) : !c ? (
        <p className="muted small">Les soldes ne se sont pas relus : la base permanente ne répond pas. Ils reviendront en rouvrant la page.</p>
      ) : (
        <>
          <ul className="qg-tuiles">
            <Chiffre nom="Tous les soldes" valeur={signe(c.total)} detail={`confettis, chez ${pluriel(c.profils, 'profil')}`} />
            <Chiffre
              nom="Solde médian"
              valeur={c.medianeDesActifs === null ? '–' : signe(Math.round(c.medianeDesActifs))}
              detail={c.actifs > 0 ? `des ${pluriel(c.actifs, 'profil')} qui ont joué ces trente jours` : 'personne n’a joué ces trente jours'}
            />
            <Chiffre nom="De quoi un compagnon" valeur={formatNumber(c.deQuoiUnCompagnon)} detail={`profils à ${formatNumber(PRIX_D_UN_COMPAGNON)} confettis et plus`} />
          </ul>
          <Pistes lignes={c.tranches.map((t, i) => ({ cle: String(i), nom: nomDeLaTranche(t), valeur: t.profils }))} />
          <p className="muted small">Les profils par solde. Un solde se relit de tout ce que le profil a joué : une soirée retirée de l’historique emporte ses confettis, et il peut passer sous zéro.</p>
        </>
      )}
    </section>
  )
}

/** Les meilleures ventes : les thèmes et les compagnons, du plus vendu ces trente jours au moins vendu. */
export function MeilleuresVentes({ page }: { page: PageDeLEconomie | null }) {
  return (
    <section className="qg-carte" aria-labelledby="economie-ventes">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="economie-ventes">Les meilleures ventes</h2>
        <span className="muted small">depuis toujours, et ces trente jours</span>
      </div>
      {!page ? (
        <p className="serif-note">Chargement…</p>
      ) : page.ventes.length === 0 ? (
        <p className="muted small">Rien ne s’est encore vendu en boutique.</p>
      ) : (
        <div className="qg-tableau">
          <table>
            <thead>
              <tr>
                <th scope="col">Article</th>
                <th scope="col">Rareté</th>
                <th scope="col">Ventes</th>
                <th scope="col">30 jours</th>
              </tr>
            </thead>
            <tbody>
              {page.ventes.map(v => (
                <tr key={`${v.sorte}:${v.article}`}>
                  <th scope="row" className="qg-tableau-texte">
                    {v.nom}
                  </th>
                  <td className="qg-tableau-texte muted">{v.rarete}</td>
                  <td className="num">{formatNumber(v.ventes)}</td>
                  <td className="num">{formatNumber(v.recentes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">Les vies, les sabliers et les Éclats se comptent dans « Où ils partent ».</p>
    </section>
  )
}

/** La scène de l'ouverture d'un coffre (`Coffre.tsx`), à la demande : le QG ne la télécharge qu'au toucher. */
const laSceneDuCoffre = aLaDemande(() => import('./Coffre'))

/**
 * Le coffre de la semaine, ouvert pour voir (le souhait du propriétaire du
 * 14 octobre 2026 : « une animation encore plus belle si tu le peux » — il
 * faut pouvoir la regarder sans attendre un lundi et sept tampons) : la scène
 * telle que les joueurs la voient, le tirage fait ici à ses vraies chances,
 * comme pour un profil qui n'aurait rien. Rien ne s'écrit, rien ne se gagne :
 * ce n'est pas un geste, le journal n'en sait rien.
 */
export function ApercuDuCoffre() {
  const [rang, setRang] = useState<RangDuCoffre | null>(null)
  const module = useALaDemande(laSceneDuCoffre, rang !== null)
  return (
    <section className="qg-carte" aria-labelledby="economie-coffre">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="economie-coffre">Le coffre de la semaine</h2>
        <span className="muted small">son ouverture telle que les joueurs la voient, pour voir : rien ne s’écrit, rien ne se gagne</span>
      </div>
      <div className="qg-coffres">
        {RANGS_DU_COFFRE.map(r => (
          <button key={r} type="button" className="btn btn-small" onClick={() => setRang(r)} onPointerDown={() => void laSceneDuCoffre.charger().catch(() => {})}>
            {NOM_DU_COFFRE[r]}
          </button>
        ))}
      </div>
      {rang && module === 'perdu' && <p className="error">La scène n’a pas pu se charger : recharge la page.</p>}
      {rang && module && module !== 'perdu' && (
        <module.SceneDuCoffre apercu attente={{ semaine: lundiDe(new Date().toISOString().slice(0, 10)), tampons: TAMPONS_DU_RANG[rang], rang }} onFermer={() => setRang(null)} />
      )}
    </section>
  )
}

/** Les Éclats tombés ces trente jours, et où ; les légendaires portés, les plus portés d'abord. */
export function EclatsEtLegendairesAuQg({ page }: { page: PageDeLEconomie | null }) {
  const e = page?.eclats
  const l = page?.legendaires
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="economie-eclats">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="economie-eclats">Les Éclats et les légendaires</h2>
        <span className="muted small">ce qui est tombé ces trente jours, et les légendaires les plus portés</span>
      </div>
      {!e || !l ? (
        <p className="serif-note">Chargement…</p>
      ) : (
        <>
          <ul className="qg-tuiles">
            <Chiffre
              nom="Éclats tombés"
              valeur={formatNumber(e.total)}
              detail={`trente jours · ${formatNumber(e.jour)} au quiz du jour, ${formatNumber(e.soirees)} en soirée, ${formatNumber(e.defi)} au défi`}
            />
            <Chiffre
              nom="Légendaires portés"
              valeur={formatNumber(l.porteurs)}
              detail={l.plusPortes[0] ? `${l.porteurs > 1 ? 'profils' : 'profil'} · le plus porté : ${l.plusPortes[0].nom}` : 'aucun profil n’en porte'}
            />
          </ul>
          {l.plusPortes.length > 0 && <Pistes lignes={l.plusPortes.map(p => ({ cle: p.cle, nom: p.nom, valeur: p.porteurs }))} />}
        </>
      )}
    </section>
  )
}
