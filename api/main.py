import json
import os

import psycopg
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="API itinéraire")

# Le widget sera servi depuis une autre adresse que l'API : on autorise ses appels (CORS).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Zone couverte par les données (Pays basque français) : xmin, ymin, xmax, ymax
ZONE = (-1.85, 42.95, -0.75, 43.60)
MARGE = 0.1              # marge (en degrés) autour du trajet, pour limiter le calcul
VITESSE_PIED_KMH = 5
FACTEUR_VOITURE = 1.0    # à augmenter (par exemple 1.3) pour un temps plus réaliste


def connexion():
    # Les identifiants viennent du fichier .env, transmis au conteneur par docker-compose
    return psycopg.connect(
        host="db",
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
    )


def sommet_proche(cur, prefixe, lon, lat):
    # Intersection du graphe la plus proche d'un point
    cur.execute(
        f"SELECT id FROM {prefixe}_ways_vertices_pgr "
        "ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326) LIMIT 1",
        (lon, lat),
    )
    return cur.fetchone()[0]


def calcul(cur, prefixe, cout, lon, lat, glon, glat):
    depart = sommet_proche(cur, prefixe, lon, lat)
    arrivee = sommet_proche(cur, prefixe, glon, glat)

    # On ne donne à pgRouting que les tronçons autour du trajet : bien plus rapide
    xmin, xmax = min(lon, glon) - MARGE, max(lon, glon) + MARGE
    ymin, ymax = min(lat, glat) - MARGE, max(lat, glat) + MARGE
    troncons = (
        f"SELECT gid AS id, source, target, {cout[0]} AS cost, {cout[1]} AS reverse_cost "
        f"FROM {prefixe}_ways "
        f"WHERE the_geom && ST_MakeEnvelope({xmin}, {ymin}, {xmax}, {ymax}, 4326)"
    )
    cur.execute(
        f"""
        WITH route AS (
          SELECT * FROM pgr_dijkstra(%s::text, %s::bigint, %s::bigint, true)
        )
        SELECT sum(r.cost), sum(w.length_m),
               ST_AsGeoJSON(ST_LineMerge(ST_Collect(w.the_geom ORDER BY r.seq)))
        FROM route r JOIN {prefixe}_ways w ON w.gid = r.edge
        """,
        (troncons, depart, arrivee),
    )
    return cur.fetchone()


@app.get("/sante")
def sante():
    return {"statut": "ok"}


@app.get("/gares")
def chercher_gares(nom: str = Query(..., min_length=2)):
    with connexion() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT gid, nom, ST_X(geom), ST_Y(geom) FROM gares_pb "
            "WHERE nom ILIKE %s ORDER BY nom LIMIT 10",
            ("%" + nom + "%",),
        )
        lignes = cur.fetchall()
    return [{"gid": g, "nom": n, "lon": x, "lat": y} for g, n, x, y in lignes]

@app.get("/itineraire")
def itineraire(
    lon: float = Query(..., description="Longitude du point cliqué (WGS84)"),
    lat: float = Query(..., description="Latitude du point cliqué (WGS84)"),
    gare: int | None = Query(None, description="gid de la gare choisie (sinon : la plus proche)"),
):
    xmin, ymin, xmax, ymax = ZONE
    if not (xmin <= lon <= xmax and ymin <= lat <= ymax):
        raise HTTPException(status_code=400, detail="Point hors de la zone couverte (Pays basque).")

    with connexion() as conn, conn.cursor() as cur:
        if gare is None:
            # Pas de gare choisie : la plus proche à vol d'oiseau
            cur.execute(
                "SELECT nom, ST_X(geom), ST_Y(geom) FROM gares_pb "
                "ORDER BY geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326) LIMIT 1",
                (lon, lat),
            )
        else:
            # Gare choisie par l'utilisateur
            cur.execute(
                "SELECT nom, ST_X(geom), ST_Y(geom) FROM gares_pb WHERE gid = %s",
                (gare,),
            )
        ligne = cur.fetchone()
        if ligne is None:
            raise HTTPException(status_code=404, detail="Gare introuvable.")
        nom, glon, glat = ligne

        # Voiture : chemin le plus rapide. À pied : chemin le plus court.
        voiture = calcul(cur, "car", ("cost_s", "reverse_cost_s"), lon, lat, glon, glat)
        pied = calcul(cur, "foot", ("length_m", "length_m"), lon, lat, glon, glat)

    if voiture[0] is None or pied[0] is None:
        raise HTTPException(status_code=404, detail="Aucun itinéraire trouvé.")

    return {
        "gare": {"nom": nom, "lon": glon, "lat": glat},
        "voiture": {
            "distance_m": round(voiture[1]),
            "duree_s": round(voiture[0] * FACTEUR_VOITURE),
            "trace": json.loads(voiture[2]),
        },
        "pied": {
            "distance_m": round(pied[1]),
            "duree_s": round(pied[1] * 3600 / (VITESSE_PIED_KMH * 1000)),
            "trace": json.loads(pied[2]),
        },
    }