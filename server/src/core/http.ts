import type { Request, Response } from 'express'

/** Express 4 n'attrape pas les rejets de promesse : on le fait ici. */
export const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response) => {
    fn(req, res).catch((e: Error) => {
      if (!res.headersSent) res.status(400).json({ error: e.message })
    })
  }
