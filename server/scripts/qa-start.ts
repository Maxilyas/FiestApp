// Démarrage "QA" : serveur normal mais base de données jetable, pour tester
// l'appli sans toucher aux données de la vraie soirée. Port via PORT (env).
import path from 'node:path'
import os from 'node:os'
import { mkdtempSync } from 'node:fs'

process.env.DB_PATH ??= path.join(mkdtempSync(path.join(os.tmpdir(), 'quizz-qa-')), 'qa.db')
process.env.WIFI_SSID ??= 'QuizzDemo'
process.env.WIFI_PASS ??= 'demo1234'

await import('../src/index')
