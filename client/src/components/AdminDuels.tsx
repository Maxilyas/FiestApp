import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { confirmDialog } from './Dialog'
import { AujourdhuiDesDuels, ClassementDesDuelsAuQg, DuelsEnAttente, DuelsParJour, LiguesAuQg } from './QgDuels'
import { confirmerLeMasque } from './QgModes'
import { showToast } from '../state'
import type { LigneDesDuels } from '../../../shared/duels'
import type { VueDEnsemble } from '../../../shared/qg'
import type { DuelEnAttente, SuiviDesDuels } from '../../../shared/qgDuels'

/**
 * Les duels, côté administrateur (`/admin#duels`, le choix du 13 octobre
 * 2026, sur maquettes) : les chiffres d'aujourd'hui, les duels par jour, les
 * ligues et le classement — « Masquer » sur chaque ligne —, les duels qui
 * attendent leur adversaire — « Annuler » sur chacun (`QgDuels.tsx`). La vue
 * d'ensemble du QG lui prête ses trente jours : déjà lus, ils ne se relisent
 * pas ici.
 */
export function AdminDuels({ vue }: { vue: VueDEnsemble | null }) {
  const [suivi, setSuivi] = useState<SuiviDesDuels | null>(null)
  const [enPanne, setEnPanne] = useState(false)
  const [occupe, setOccupe] = useState(false)

  const charger = () =>
    api.admin.suiviDesDuels().then(
      s => {
        setSuivi(s)
        setEnPanne(false)
      },
      () => setEnPanne(true),
    )
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

  return (
    <>
      <AujourdhuiDesDuels vue={vue} suivi={suivi} />
      {enPanne && <p className="serif-note">La base permanente ne répond pas : les duels reviendront en rouvrant la page.</p>}
      <DuelsParJour vue={vue} suivi={suivi} />
      <div className="qg-deux qg-deux-haut">
        <LiguesAuQg suivi={suivi} />
        <ClassementDesDuelsAuQg suivi={suivi} occupe={occupe} masquer={masquer} />
      </div>
      <DuelsEnAttente suivi={suivi} occupe={occupe} annuler={annuler} />
    </>
  )
}
