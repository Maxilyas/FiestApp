import fs from 'node:fs'
import path from 'node:path'
import type { NextFunction, Request, Response } from 'express'

/**
 * Sert les fichiers du paquet déjà compressés au build (`client/vite.config.ts`) :
 * le `.br` à qui accepte brotli, le `.gz` à qui accepte gzip, et sinon le
 * fichier nu, par `express.static` derrière.
 *
 * Recompressés à la volée, ils coûtaient la moitié du processeur d'une
 * arrivée, en brotli rapide — plus gros que gzip. Précompressés en brotli
 * 11 : 14 % d'octets en moins, et plus aucun calcul au scan du QR.
 *
 * Seuls les fichiers trouvés au démarrage se servent ici : l'adresse
 * demandée n'est qu'une clé dans cette liste, jamais un chemin qu'on
 * ouvrirait.
 */
export function servirPrecompresse(dossier: string, options: { maxAge: string; immutable?: boolean }) {
  const connus = new Map<string, { br?: string; gz?: string }>()
  if (fs.existsSync(dossier)) {
    for (const nom of fs.readdirSync(dossier)) {
      const m = /^(.+)\.(br|gz)$/.exec(nom)
      if (!m || !fs.existsSync(path.join(dossier, m[1]))) continue
      const variantes = connus.get(`/${m[1]}`) ?? {}
      variantes[m[2] as 'br' | 'gz'] = path.join(dossier, nom)
      connus.set(`/${m[1]}`, variantes)
    }
  }
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    const variantes = connus.get(req.path)
    if (!variantes) return next()
    res.vary('Accept-Encoding')
    // Pas `acceptsEncodings('br', 'gzip')` : à préférence égale, il garde
    // l'ordre du téléphone, qui annonce gzip avant br.
    const encodage =
      variantes.br && req.acceptsEncodings('br') === 'br'
        ? 'br'
        : variantes.gz && req.acceptsEncodings('gzip') === 'gzip'
          ? 'gzip'
          : null
    if (!encodage) return next()
    const fichier = encodage === 'br' ? variantes.br! : variantes.gz!
    // Le type est celui du fichier nu : `send` ne le devine plus s'il est posé.
    res.type(path.extname(req.path))
    res.set('Content-Encoding', encodage)
    res.sendFile(fichier, { maxAge: options.maxAge, immutable: options.immutable }, e => {
      if (e) next(e)
    })
  }
}
