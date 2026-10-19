# Les captures de la maquette, recadrées et passées en JPEG pour la planche.
# Les téléphones sont photographiés en 2x (780 de large) : on garde le 2x.
import os
import sys
from PIL import Image

ICI = os.path.dirname(os.path.abspath(__file__))
CAPTURES = os.path.join(ICI, 'captures')
SORTIE = sys.argv[1]
os.makedirs(SORTIE, exist_ok=True)

# nom de sortie : (capture, hauteur gardée en pixels de l'image, ou None pour tout)
PLANCHE = {
    'solo-accueil': ('solo-accueil', None),
    'solo-jour-juste': ('solo-jour-juste', None),
    'solo-jour-ratee': ('solo-jour-ratee', None),
    'solo-jour-fin': ('solo-jour-fin', 1880),
    'solo-duel': ('solo-duel', 1100),
    'soiree-attente': ('tel-attente', None),
    'soiree-juste': ('tel-revelation-juste', None),
    'soiree-ratee': ('tel-revelation-ratee', None),
    'soiree-podium': ('tel-podium', None),
    'soiree-fin': ('tel-cloture', 1540),
    'tele-arrivee': ('tv-arrivee', None),
    'tele-podium': ('tv-podium', None),
    'tele-cloture': ('tv-cloture', None),
    'tele-classement': ('tv-revelation-0-brut', None),
    'profil-loge': ('solo-loge-pleine', 1800),
    'profil-carte': ('solo-carte', None),
    'profil-adoption': ('solo-boutique', None),
}

for nom, (capture, hauteur) in PLANCHE.items():
    im = Image.open(os.path.join(CAPTURES, capture + '.png')).convert('RGB')
    if hauteur and im.height > hauteur:
        im = im.crop((0, 0, im.width, hauteur))
    chemin = os.path.join(SORTIE, nom + '.jpg')
    im.save(chemin, 'JPEG', quality=86, optimize=True, progressive=True)
    print(f'{nom}.jpg {im.width}x{im.height} {os.path.getsize(chemin) // 1024} Ko')
