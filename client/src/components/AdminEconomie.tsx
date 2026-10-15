import { useEffect, useState } from 'react'
import { api } from '../api'
import {
  ApercuDuCoffre,
  AujourdhuiDeLEconomie,
  DepensesDesConfettis,
  EclatsEtLegendairesAuQg,
  EnCirculation,
  GagnesEtDepenses,
  MeilleuresVentes,
  SourcesDesConfettis,
} from './QgEconomie'
import type { PageDeLEconomie } from '../../../shared/qgEconomie'

/**
 * L'économie, côté administrateur (`/admin#economie`, le choix du 13 octobre
 * 2026, sur maquettes) : une page à lire, sans geste — les prix, les seuils
 * et les barèmes restent dans le code (règle `qg.md`). Les confettis ne
 * s'écrivent nulle part : le serveur relit chaque source à ses règles
 * (`shared/qgEconomie.ts`).
 */
export function AdminEconomie() {
  const [page, setPage] = useState<PageDeLEconomie | null>(null)
  const [enPanne, setEnPanne] = useState(false)

  useEffect(() => {
    api.admin.economie().then(setPage, () => setEnPanne(true))
  }, [])

  return (
    <>
      <p className="muted small">Les confettis : ce que les joueurs gagnent, ce qu’ils dépensent, ce qu’ils gardent. Les prix restent dans le code.</p>
      <AujourdhuiDeLEconomie page={page} />
      {enPanne && <p className="serif-note">La base permanente ne répond pas : l’économie reviendra en rouvrant la page.</p>}
      <GagnesEtDepenses page={page} />
      <div className="qg-deux qg-deux-haut">
        <SourcesDesConfettis page={page} />
        <DepensesDesConfettis page={page} />
      </div>
      <EnCirculation page={page} />
      <div className="qg-deux qg-deux-haut">
        <MeilleuresVentes page={page} />
        <EclatsEtLegendairesAuQg page={page} />
      </div>
      <ApercuDuCoffre />
    </>
  )
}
