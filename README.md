# Quizz Romane 30 🎉

Quiz façon Kahoot, gratuit et auto-hébergé, pour les 30 ans de Romane (19 septembre 2026). Chaque invité joue depuis son téléphone (navigateur, rien à installer), un écran commun (TV/vidéoprojecteur) anime la soirée, et un classement cumulé traverse tous les quiz de la soirée.

## Démarrage rapide

Prérequis : Node ≥ 20.

```bash
npm install
```

```bash
npm run dev
```

- **Joueur** : http://localhost:5173 (depuis un téléphone du même réseau : `http://<IP-du-PC>:5173`, l'IP est affichée par Vite au démarrage)
- **Écran commun** : http://localhost:5173/host?key=romane

```bash
npm run check
```

```bash
npm run smoke
```

`check` = typecheck serveur + client. `smoke` = test de bout en bout (inscription, quiz complet, scoring, classement, reconnexion).

## Personnaliser les quiz

⚠️ Étape provisoire : les questions vivent aujourd'hui dans `server/content/quiz/*.json` — un fichier = un quiz, relu à chaque lancement (éditable sans redémarrer le serveur). L'éditeur intégré dans le navigateur arrive au lot 2 et remplacera ces fichiers.

```json
{
  "title": "⭐ Spécial Romane",
  "questions": [
    {
      "text": "Quelle danse Romane préfère-t-elle ?",
      "answers": ["La salsa", "Le tango", "La valse", "Le rock"],
      "correct": 0,
      "duration": 20,
      "image": "romane-bebe.jpg"
    }
  ]
}
```

- `answers` : 2 à 4 réponses (2 = vrai/faux) ; `correct` : index de la bonne réponse **en partant de 0**
- `duration` (optionnel, défaut 20 s) : temps de réponse pour cette question
- `image` (optionnel) : nom d'un fichier placé dans `server/content/quiz/images/` (photos d'enfance…)
- Score : 100 pts par bonne réponse + jusqu'à 100 pts de bonus de rapidité
- `special-fete.json` est un modèle : remplacez les réponses ✏️ et les index `correct`

## Déroulé d'une partie

L'animateur clique **Lancer un quiz** sur l'écran commun, choisit le quiz, et le 3-2-1 démarre. Pour chaque question : la question s'affiche, chacun répond sur son téléphone, la révélation montre la bonne réponse, la répartition des réponses, le plus rapide et le top 5. À la fin, podium — et les points s'ajoutent au **classement de la soirée**, qui survit d'un quiz à l'autre (et à un redémarrage du serveur).

Les invités qui arrivent après le lancement d'un quiz attendent le suivant (l'entrée en cours de partie arrive au lot 3).

## Tester avec de vrais téléphones (à la maison)

1. PC et téléphones sur le **même wifi**.
2. `npm run build && npm start` → tout est servi sur `http://<IP-du-PC>:3001` (l'IP s'affiche au démarrage ; l'écran commun peut rester en `localhost`, le QR code affiche automatiquement l'adresse réseau).
3. **Une fois pour toutes, dans un PowerShell administrateur** (sinon Windows bloque les connexions entrantes) :

```powershell
Set-NetConnectionProfile -NetworkCategory Private
```

```powershell
New-NetFirewallRule -DisplayName "Quizz Romane 30" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001,5173
```

Pour simuler des invités sans téléphone :

```bash
node server/scripts/fake-player.mjs http://localhost:3001 Test1 300
```

## Le soir J

Cible : **hébergement gratuit en ligne** (lot 5), les invités se connectent en 4G/5G en scannant le QR — aucun réseau à installer sur place. Il faut un hébergeur qui supporte les WebSocket : GitHub Pages, Vercel et Netlify ne conviennent pas.

Repli toujours disponible : tout relancer en local sur le PC (voir ci-dessus) avec un routeur wifi sur place. Dans ce cas, renseignez `WIFI_SSID`/`WIFI_PASS` : l'écran commun affiche alors **deux QR codes** (1️⃣ rejoindre le wifi, 2️⃣ ouvrir le quiz).

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3001` | Port du serveur |
| `HOST_KEY` | `romane` | Clé d'accès de l'écran commun (`/host?key=...`) |
| `DB_PATH` | `server/data/quizz.db` | Fichier SQLite |
| `PUBLIC_URL` | — | URL publique à mettre dans le QR code (hébergement en ligne) |
| `WIFI_SSID` / `WIFI_PASS` | — | Si définis : QR « rejoindre le wifi » sur l'écran commun |

## Architecture

```
client/   React + Vite — 2 routes : "/" (téléphone joueur) et "/host" (écran commun)
server/   Node + Socket.io + Express — logique de jeu 100% côté serveur
shared/   Types TS partagés (protocole socket + vues du quiz)
```

- **Party** (`server/src/core/party.ts`) — registre des joueurs. L'identité survit aux coupures : un token stocké sur le téléphone permet de retrouver son joueur après un refresh, une perte de réseau ou un redémarrage du serveur.
- **ScoreLedger** (`scores.ts`) — scores en append-only : chaque gain est une ligne (joueur, points, raison). Classement = somme par joueur, historique gratuit.
- **GameEngine** (`engine.ts`) — pilote la partie en cours (une seule à la fois) : route actions/commandes/timers vers le module de jeu, persiste l'état en SQLite après chaque changement (reprise après crash) et rediffuse les **vues filtrées**.
- **Vues filtrées** — les clients ne reçoivent jamais l'état brut : chaque joueur reçoit `playerView(state, playerId)`, l'écran `hostView(state)`. C'est ce qui empêche la bonne réponse d'arriver dans le téléphone avant la révélation.
- **Module quiz** (`server/src/games/quiz.ts`) — les règles : phases, timers, scoring, vues.

## Feuille de route

| Lot | Contenu | Statut |
|---|---|---|
| 1 | Nettoyage : application 100 % quiz | ✅ |
| 2 | Base externe gratuite + éditeur de quiz dans le navigateur | à faire |
| 3 | Question aussi sur le mobile, questions « estimation », entrée en cours de quiz | à faire |
| 4 | Habillage show (couleurs, barre de temps, podium animé, sons) | à faire |
| 5 | Déploiement gratuit, QR public, test de charge à 50 joueurs | à faire |
