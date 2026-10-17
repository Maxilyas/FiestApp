# Les humeurs peintes, recadrées pour la maquette.
#
# Les quatre expressions d'une forme sont peintes sur la même pose (seules la
# tête, la queue et la mine bougent) : on les rogne toutes au même cadre — la
# réunion de leurs silhouettes —, sinon passer de « neutre » à « ravi » ferait
# sauter la bête, la queue levée élargissant son cadre.
import json
import os
import sys
from PIL import Image

SOURCE = sys.argv[1]  # le dossier `compagnons/` de l'archive
SORTIE = sys.argv[2]
os.makedirs(SORTIE, exist_ok=True)

HUMEURS = ['neutre', 'ravi', 'depite', 'triomphe']
FORMES = {
    'loup': ['louveteau', 'jeune', 'adulte', 'ultime'],
    'chat': ['chaton', 'jeune', 'adulte', 'esprit'],
    'tortue': ['bebe', 'jeune', 'adulte', 'ile'],
}


def boite(im, seuil_alpha=110):
    """Le cadre des colonnes et des rangées vraiment pleines : les flocons du louveteau n'y comptent pas."""
    a = im.getchannel('A').point(lambda v: 255 if v > seuil_alpha else 0)
    w, h = im.size
    px = a.load()
    cols = [0] * w
    rows = [0] * h
    for y in range(h):
        for x in range(w):
            if px[x, y]:
                cols[x] += 1
                rows[y] += 1
    seuil = max(3, w // 64)
    x0 = next((x for x in range(w) if cols[x] >= seuil), 0)
    x1 = next((x for x in range(w - 1, -1, -1) if cols[x] >= seuil), w - 1)
    y0 = next((y for y in range(h) if rows[y] >= seuil), 0)
    y1 = next((y for y in range(h - 1, -1, -1) if rows[y] >= seuil), h - 1)
    return x0, y0, x1, y1


def union(boites, w, h, marge):
    x0 = max(0, min(b[0] for b in boites) - marge)
    y0 = max(0, min(b[1] for b in boites) - marge)
    x1 = min(w - 1, max(b[2] for b in boites) + marge)
    y1 = min(h - 1, max(b[3] for b in boites) + marge)
    return x0, y0, x1 + 1, y1 + 1


index = {}
for c, formes in FORMES.items():
    for f in formes:
        ims = {}
        for hm in HUMEURS:
            chemin = os.path.join(SOURCE, c, f'{f}-{hm}.webp')
            if os.path.exists(chemin):
                ims[hm] = Image.open(chemin).convert('RGBA')
        if not ims:
            continue
        w, h = next(iter(ims.values())).size
        cadre = union([boite(im) for im in ims.values()], w, h, round(w * 0.012))
        ratio = (cadre[2] - cadre[0]) / (cadre[3] - cadre[1])
        for hm, im in ims.items():
            im.crop(cadre).save(os.path.join(SORTIE, f'{c}-{f}-{hm}.webp'), 'WEBP', quality=92, method=6)
        index[f'{c}-{f}'] = {'ratio': round(ratio, 4), 'humeurs': sorted(ims)}
        print(f'{c}-{f}: {sorted(ims)} ratio {ratio:.3f}')

# Le bond du loup des étoiles, rogné seul.
bond = Image.open(os.path.join(SOURCE, 'loup', 'bond.webp')).convert('RGBA')
cadre = union([boite(bond)], *bond.size, round(bond.size[0] * 0.012))
bond.crop(cadre).save(os.path.join(SORTIE, 'loup-bond.webp'), 'WEBP', quality=92, method=6)
index['loup-bond'] = {'ratio': round((cadre[2] - cadre[0]) / (cadre[3] - cadre[1]), 4), 'humeurs': []}
print('loup-bond', index['loup-bond'])

with open(os.path.join(SORTIE, 'index.json'), 'w') as f:
    json.dump(index, f, indent=1)
