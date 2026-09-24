// Le geste d'un agent de la tablée — une commande, sa sortie, et c'est tout :
//
//   node server/scripts/tablee/pilote.mjs <qui>[:<onglet>] <geste> [arguments…]
//   node server/scripts/tablee/pilote.mjs aide
//
// La régie (`npm run tablee`, voir regie.ts) tient les navigateurs ; ce
// fichier ne fait que lui porter le geste. Du JavaScript nu, sans `tsx` : un
// agent qui répond à une question chronométrée ne doit pas payer une
// compilation à chaque geste.
import { request } from 'node:http'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = path.dirname(fileURLToPath(import.meta.url))
/** La régie à qui parler : la dernière démarrée, sauf si TABLEE désigne la fiche d'une autre. */
const FICHE = process.env.TABLEE || path.resolve(ICI, '../../../export/tablee/courante.json')

const AIDE = `La tablée — tes gestes, un par commande :

  node server/scripts/tablee/pilote.mjs <qui>[:<onglet>] <geste> [arguments…]

<qui> : ton prénom de personnage en minuscules (jeanne, nadia…) — c'est ton appareil,
allumé à ton premier geste. <onglet> : un autre onglet du même appareil, mêmes cookies
(ex. nadia:tele). Les arguments avec des espaces se mettent entre guillemets.

L'APPAREIL (avant tout autre geste)
  appareil <telephone|petit-telephone|iphone|tablette|portable|tele>
  zoom <pourcentage>          le texte agrandi, comme le réglage « taille du texte » d'un téléphone
  vision <deuteranopie|protanopie|tritanopie|achromatopsie|flou|contraste|normale>
  mouvement <reduit|normal>   la préférence « réduire les animations »
  orientation <portrait|paysage>
  chez <salon>                quand plusieurs soirées ont lieu en même temps (plusieurs écrans communs) :
                              le salon où tu es, ex. « chez nadia » — scanner, tele et la salle ne visent
                              plus que lui. Un animateur est d'office dans le sien.

REGARDER
  voir                        l'écran : son texte et ses éléments, chacun avec sa référence [ref=e12]
  texte                       seulement le texte visible — plus court, pour lire une longue page
  lecteur                     ce qu'annoncerait un lecteur d'écran : l'arbre d'accessibilité de Chrome,
                              sans ce qui lui est caché — pour juger ; « voir » donne les références pour agir
  capture [nom] [--entiere]   une photo de l'écran : un fichier PNG, à regarder avec l'outil Read
  tele [--capture]            lever les yeux vers l'écran commun (la télé de la soirée)

AGIR — chaque geste te rend l'écran d'après
  ouvrir <adresse>            ouvrir /  ·  ouvrir /chez-nadia  ·  ouvrir http://…
  scanner [secondes]          scanner le QR code de l'écran commun (attend qu'il s'allume)
  toucher <ref|texte>         toucher e12  ·  toucher "Jouer sans compte"
  ecrire <ref|étiquette> <texte>     ecrire e7 "Jeanne" : touche le champ, l'efface, puis tape lettre à lettre
  coller <ref|étiquette> <texte>     coller d'un coup un texte préparé ailleurs (une liste de questions)
  touche <Enter|Tab|Escape|Backspace|ArrowDown…>
  clavier                     fermer le clavier du téléphone (il cache le bas de l'écran)
  choisir <ref> <option>      une liste déroulante
  defiler <bas|haut|ref>
  fichier <ref> <chemin>      joindre un fichier — les photos de la tablée : photos/gateau.jpg,
                              photos/ballons.jpg, photos/plage.jpg
  retour · recharger          les boutons du navigateur
  attendre <texte> [secondes] [--tele] [--disparu]    qu'un texte apparaisse (ou parte)

JOUER — des raccourcis, parce que le chronomètre n'attend pas
  question [secondes]         attend la prochaine question ouverte sur ton téléphone et te la lit ;
                              rend aussi la main à sa révélation, à la photo d'une question de
                              mémoire, au podium d'un quiz et à la fin de la soirée
  repondre <n|texte|nombre>   le numéro de la réponse (1 à 4), son texte, ou le nombre d'une estimation

LA SALLE — ce qui se dit à voix haute
  dire <message>              tout le monde l'entend à son prochain geste (tout ton salon, s'il y en a plusieurs)
  ecouter [secondes]          attendre que quelqu'un parle

LES IMPRÉVUS
  reseau <coupe|retabli>      couper ou rendre le réseau du téléphone
  veille <secondes>           l'écran s'éteint (réseau coupé, page figée), puis tu le rallumes
  console                     ce que le navigateur a signalé : erreurs, requêtes refusées
  presse-papiers              ce qu'un bouton « Copier » vient de copier
  onglets · fermer · partir   tes onglets · fermer celui-ci · ranger l'appareil (quitter la soirée)

LA RÉGIE (pour qui orchestre)
  regie etat · regie salle · regie attendre-tele [secondes] [salon] · regie arreter

Les gestes qui attendent (question, scanner, attendre, ecouter) attendent 100 s par défaut,
sous le délai de l'outil Bash. Pour plus long (540 s au plus), donne les secondes ET règle le
délai de l'outil Bash à 600000.`

const [cible, geste = 'voir', ...args] = process.argv.slice(2)
if (!cible || ['aide', '--aide', '-h', '--help'].includes(cible) || geste === 'aide') {
  console.log(AIDE)
  process.exit(0)
}

let fiche
try {
  fiche = JSON.parse(readFileSync(FICHE, 'utf8'))
} catch {
  console.error('✗ La tablée ne tourne pas : démarre la régie avec « npm run tablee » (fiche absente : ' + FICHE + ').')
  process.exit(2)
}

/** Porte un geste à la régie et rend sa réponse : { ok, sortie }. */
function porter(cible, geste, args) {
  const corps = JSON.stringify({ cible, geste, args })
  return new Promise(resolve => {
    const req = request(
      {
        host: '127.0.0.1',
        port: fiche.portRegie,
        path: '/geste',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corps) },
      },
      res => {
        let data = ''
        res.setEncoding('utf8')
        res.on('data', morceau => (data += morceau))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            resolve({ ok: false, sortie: `✗ Réponse illisible de la régie : ${data.slice(0, 300)}` })
          }
        })
      },
    )
    // Pas de délai ici : `question 540` attend exprès. C'est l'outil de l'agent
    // qui borne l'attente, et la régie cesse d'attendre quand il raccroche.
    req.on('error', () => {
      console.error(`✗ La régie ne répond pas (port ${fiche.portRegie}) : elle s'est peut-être arrêtée — « npm run tablee » la relance.`)
      process.exit(2)
    })
    req.end(corps)
  })
}

const { ok, sortie } = await porter(cible, geste, args)
process.stdout.write(sortie.endsWith('\n') ? sortie : sortie + '\n')
process.exit(ok ? 0 : 1)
