import { useEffect, useState } from 'react'
import { api, motifDe, type ProfilMasquable } from '../api'
import { confirmDialog } from './Dialog'
import { AujourdhuiDesDuels, ClassementDesDuelsAuQg, DuelsEnAttente, DuelsParJour, LiguesAuQg } from './QgDuels'
import { Chiffre, GabaritDUnMode, TuileParJoueur, confirmerLeMasque } from './QgModes'
import { showToast } from '../state'
import { formatNumber } from '../../../shared/typographie'
import type { LigneDesDuels } from '../../../shared/duels'
import type { VueDEnsemble } from '../../../shared/qg'
import type { DuelEnAttente, SuiviDesDuels } from '../../../shared/qgDuels'
import type { PeriodeDuQg } from '../../../shared/qgPeriodes'
import { entonnoirDesDuels } from '../../../shared/qgModes'

/**
 * Les duels, côté administrateur (`/admin#duels`, le choix du 13 octobre
 * 2026, sur maquettes) : les chiffres d'aujourd'hui, les duels par jour, les
 * ligues et le classement — « Masquer » sur chaque ligne, et les masqués à y
 * remettre —, les duels qui attendent leur adversaire — « Annuler » sur
 * chacun (`QgDuels.tsx`). La vue d'ensemble du QG lui prête ses trente
 * jours : déjà lus, ils ne se relisent pas ici — et, depuis le QG 2 (lot 5),
 * ses périodes, que le gabarit des modes pose en tête (`GabaritDUnMode`).
 */
export function AdminDuels({ vue, periode = '24h', comparer = false }: { vue: VueDEnsemble | null; periode?: PeriodeDuQg; comparer?: boolean }) {
  const [suivi, setSuivi] = useState<SuiviDesDuels | null>(null)
  const [masques, setMasques] = useState<ProfilMasquable[] | null>(null)
  const [enPanne, setEnPanne] = useState(false)
  const [occupe, setOccupe] = useState(false)

  const charger = () =>
    Promise.all([
      api.admin.suiviDesDuels().then(
        s => {
          setSuivi(s)
          setEnPanne(false)
        },
        () => setEnPanne(true),
      ),
      // Le masque est celui du quiz du jour : sa liste aussi. Sans elle, la
      // page garde ses duels, et « Masquer » reste à sa place.
      api.admin.profilsDuJour('').then(setMasques, () => {}),
    ])
  useEffect(() => {
    void charger()
  }, [])

  const faire = async (appel: () => Promise<unknown>, merci: string) => {
    setOccupe(true)
    try {
      await appel()
      showToast({ kind: 'info', message: merci })
      await charger()
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(false)
    }
  }

  const masquer = async (l: LigneDesDuels) => {
    if (await confirmerLeMasque(l.nom)) await faire(() => api.admin.masquerDuJour(l.profileId, true), `Profil masqué du classement : ${l.nom}`)
  }
  // Sans confirmation, comme en bas de la page du quiz du jour : rien ne se perd à remettre un profil.
  const remettre = (p: ProfilMasquable) => void faire(() => api.admin.masquerDuJour(p.id, false), `Profil remis au classement : ${p.nom}`)

  // Les phrases parlent du profil défié, jamais de la personne.
  const annuler = async (d: DuelEnAttente) => {
    const ok = await confirmDialog({
      title: `Annuler le duel de ${d.auteur.nom} contre ${d.adversaire.nom} ?`,
      message: 'Il se ferme tout de suite, comme à son expiration : il ne compte pour personne, et sort des duels à jouer du profil défié. Rien ne le rouvre.',
      confirmLabel: 'Annuler le duel',
      cancelLabel: 'Le garder',
      danger: true,
    })
    if (ok) await faire(() => api.admin.annulerUnDuel(d.code), `Duel annulé : ${d.auteur.nom} contre ${d.adversaire.nom}`)
  }

  // Les duels classés de la période : ceux lancés depuis son premier seau, lus avec le suivi.
  const debut = vue?.periodes?.[periode]?.seaux[0]?.debut
  const lances = suivi?.lancesDuMois && debut !== undefined ? entonnoirDesDuels(suivi.lancesDuMois, debut, suivi.maintenant) : null
  return (
    <>
      <GabaritDUnMode
        mode="duel"
        vue={vue}
        periode={periode}
        comparer={comparer}
        tuiles={
          <>
            <Chiffre
              nom="Duels classés"
              valeur={lances ? formatNumber(lances[0].n) : '–'}
              detail={lances ? `lancés · ${formatNumber(lances[1].n)} joués des deux côtés` : undefined}
            />
            <TuileParJoueur mode="duel" vue={vue} periode={periode} detail="en moyenne, contre Automate compris" />
          </>
        }
        entonnoir={
          lances
            ? {
                titre: 'D’un duel classé lancé à son verdict',
                etapes: lances,
                note: 'Un duel a sept jours pour être joué de l’autre côté : sur une heure, la plupart attendent encore. Contre Automate, rien ne décroche — il répond toujours.',
              }
            : null
        }
      />
      <AujourdhuiDesDuels vue={vue} suivi={suivi} />
      {enPanne && <p className="serif-note">La base permanente ne répond pas : les duels reviendront en rouvrant la page.</p>}
      <DuelsParJour vue={vue} suivi={suivi} />
      <div className="qg-deux qg-deux-haut">
        <LiguesAuQg suivi={suivi} />
        <ClassementDesDuelsAuQg suivi={suivi} occupe={occupe} masquer={masquer} masques={masques} remettre={remettre} />
      </div>
      <DuelsEnAttente suivi={suivi} occupe={occupe} annuler={annuler} />
    </>
  )
}
