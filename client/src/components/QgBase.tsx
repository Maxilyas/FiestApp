import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from './Icon'
import { LeQuotaDeTurso, Turso, quandDuServeur } from './QgServeur'
import { formatNumber } from '../../../shared/typographie'
import { dureeEcrite } from '../../../shared/qg'
import { SAUVEGARDE_ANCIENNE_MS, type BaseDuQg, type PageDuServeur, type PeriodeDuServeur, type VoieDuMiroir } from '../../../shared/santeDuServeur'

/**
 * La base et le miroir au QG (`/admin#base`, le QG 2, le 4 novembre 2026) :
 * sortis de la page « Le serveur », où ils se perdaient parmi quinze
 * graphiques — Turso, un aller-retour et ses connexions sur la période de la
 * barre, son quota du mois et ce qui lit le plus ; puis le miroir de chaque
 * salon, sa file et ses échecs, lus en mémoire ; enfin les sauvegardes de la
 * base, que `npm run sauvegarde` note en finissant — rien ne disait à quand
 * remontait la dernière.
 */
export function QgBase({ periode = '7j' }: { periode?: PeriodeDuServeur }) {
  const [page, setPage] = useState<PageDuServeur | null>(null)
  const [base, setBase] = useState<BaseDuQg | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let perimee = false
    api.admin.serveur(periode).then(
      p => !perimee && setPage(p),
      e => !perimee && setError(motifDe(e)),
    )
    return () => {
      perimee = true
    }
  }, [periode])
  useEffect(() => {
    api.admin.base().then(setBase, e => setError(motifDe(e)))
  }, [])

  if (error && !page && !base) return <p className="error">{error}</p>
  return <BaseEtMiroirAuQg page={page} base={base} />
}

/** La page lue : Turso et son quota, le miroir salon par salon, les sauvegardes ; chacun dès qu'il arrive. */
export function BaseEtMiroirAuQg({ page, base }: { page: PageDuServeur | null; base: BaseDuQg | null }) {
  return (
    <>
      {page ? (
        <>
          <Turso heures={page.heures} maintenant={page.maintenant} />
          <LeQuotaDeTurso page={page} />
        </>
      ) : (
        <p className="serif-note">Chargement…</p>
      )}
      {base && <LeMiroir base={base} />}
      {base && <LesSauvegardes base={base} />}
    </>
  )
}

/** La file d'un salon, en mots : ce qui attend, ce qui a échoué, depuis quand. */
function etatDeLaFile(v: VoieDuMiroir, maintenant: number): string {
  if (v.enEchecDepuis !== null) return `${formatNumber(v.echecs)} échec${v.echecs > 1 ? 's' : ''} d’affilée depuis ${quandDuServeur(v.enEchecDepuis, maintenant)}`
  if (v.enAttente > 0) return `${formatNumber(v.enAttente)} écriture${v.enAttente > 1 ? 's' : ''} en attente`
  return v.dernierSucces === null ? 'rien envoyé depuis le démarrage' : `à jour · dernier envoi ${quandDuServeur(v.dernierSucces, maintenant)}`
}

/**
 * Le miroir de chaque salon : la file que la soirée écrit vers Turso, qui
 * insiste jusqu'au succès (invariant 13). Celles en retard d'abord — leur
 * écran commun dit « Sauvegarde en retard » —, puis celles qui échouent ou
 * attendent ; les files à jour derrière. Des salons, rien que des chiffres.
 */
function LeMiroir({ base }: { base: BaseDuQg }) {
  const enPanne = base.miroir.filter(v => v.enRetard || v.enEchecDepuis !== null).length
  return (
    <section className={'qg-console' + (enPanne > 0 ? ' qg-hud-alerte' : '')} aria-labelledby="base-miroir">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Le miroir</span>
          <h2 id="base-miroir">Chaque salon, sa file vers Turso</h2>
          <span className="muted small">les écritures de la soirée, envoyées dans l’ordre jusqu’au succès ; lues en mémoire, depuis le démarrage</span>
        </div>
        {enPanne > 0 && <span className="etiquette num">{formatNumber(enPanne)}</span>}
      </div>
      {base.miroir.length === 0 ? (
        <p className="muted small">Aucune soirée n’a écrit depuis le démarrage : aucune file ouverte.</p>
      ) : (
        <ul className="qg-liste">
          {base.miroir.map(v => {
            const alerte = v.enRetard || v.enEchecDepuis !== null
            return (
              <li key={v.spaceId} className={'qg-soiree' + (alerte ? ' qg-soiree-en-plan' : '')}>
                <span className="qg-avatar" aria-hidden="true">
                  {v.salon.avatar ?? <Icon name="home" />}
                </span>
                <span className="qg-ligne-texte">
                  <b>{v.salon.nom}</b>
                  <span className="muted small">{etatDeLaFile(v, base.maintenant)}</span>
                </span>
                {alerte ? (
                  <span className="qg-etat qg-etat-alerte">
                    <Icon name="alert" />
                    {v.enRetard ? 'sauvegarde en retard' : 'en échec'}
                  </span>
                ) : (
                  <span className="qg-etat qg-etat-ok">
                    <Icon name="check-circle" />
                    {v.enAttente > 0 ? 'en route' : 'à jour'}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** « 12,4 Mo » : la taille d'une sauvegarde. */
const enMo = (octets: number) => `${formatNumber(Math.round((octets / 1024 / 1024) * 10) / 10)} Mo`

/**
 * Les sauvegardes de la base permanente (`npm run sauvegarde`, à la main
 * depuis un ordinateur) : la dernière en tête, en rouge au-delà d'une semaine
 * (`SAUVEGARDE_ANCIENNE_MS`), puis les précédentes — quand, combien de
 * lignes, sa taille, son temps.
 */
function LesSauvegardes({ base }: { base: BaseDuQg }) {
  const [derniere, ...avant] = base.sauvegardes
  const ancienne = !derniere || base.maintenant - derniere.faiteLe > SAUVEGARDE_ANCIENNE_MS
  return (
    <section className={'qg-console' + (ancienne ? ' qg-hud-alerte' : '')} aria-labelledby="base-sauvegardes">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Les sauvegardes</span>
          <h2 id="base-sauvegardes">La base permanente, en SQL daté</h2>
          <span className="muted small">
            <code>npm run sauvegarde</code>, depuis un ordinateur : un fichier restaurable par <code>turso db shell</code>
          </span>
        </div>
      </div>
      {!derniere ? (
        <p className="qg-erreurs-etat qg-erreurs-etat-alerte">
          <Icon name="alert" />
          {/* Une seule boîte pour la phrase : la ligne est une rangée flexible, et chaque `<code>` y serait une colonne. */}
          <span>
            Aucune sauvegarde notée : la première se lance depuis un ordinateur, <code>QUIZ_DB_URL</code> et <code>QUIZ_DB_TOKEN</code> posés.
          </span>
        </p>
      ) : (
        <>
          <p className={'qg-erreurs-etat' + (ancienne ? ' qg-erreurs-etat-alerte' : '')}>
            <Icon name={ancienne ? 'alert' : 'check-circle'} />
            <span>
              La dernière : {quandDuServeur(derniere.faiteLe, base.maintenant)} — il y a {dureeEcrite(base.maintenant - derniere.faiteLe)}
              {ancienne ? ', plus d’une semaine : à refaire.' : '.'}
            </span>
          </p>
          <ul className="qg-liste">
            {[derniere, ...avant].map(s => (
              <li key={s.faiteLe} className="qg-ligne">
                <span className="qg-ligne-texte">
                  <b>{quandDuServeur(s.faiteLe, base.maintenant)}</b>
                  <span className="muted small">
                    {formatNumber(s.tables)} tables · {formatNumber(s.lignes)} lignes · {enMo(s.octets)} · en {dureeEcrite(s.dureeMs)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
