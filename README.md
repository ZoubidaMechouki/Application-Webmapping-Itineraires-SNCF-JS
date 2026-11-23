# Calcul de l'itinéraire vers les gares SNCF (Lizmap, JavaScript, FastAPI, PostgreSQL/pgRouting, Docker)

## Contexte

Application de webmapping qui permet, dans une carte **Lizmap**, de choisir un point de départ par un clic et d'obtenir l'itinéraire vers une gare du **Pays basque français** : soit vers une gare choisie dans une liste, soit automatiquement vers la plus proche.

Ce projet personnel s'appuie sur les données ouvertes (Open Data) des gares de voyageurs et d'OpenStreetMap. Le calcul d'itinéraire est réalisé directement par ma base de données **PostgreSQL / PostGIS / pgRouting**, sans dépendre d'une API externe de routage.

**Mots-clés** : SIG, webmapping, Lizmap, QGIS, JavaScript, OpenLayers, PostgreSQL, PostGIS, pgRouting, FastAPI, Docker, OpenStreetMap.

## Points clés

- **Routage dans la base de données** : le calcul d'itinéraire est fait en SQL avec `pgr_dijkstra` (pgRouting), sur un graphe issu d'OpenStreetMap. Aucune clé d'API n'est nécessaire, et aucun quota ne s'applique.
- **Deux graphes** : un réseau routier pour la voiture (plus rapide) et un réseau piéton pour la marche (plus court).
- **API Python (FastAPI)** entre le widget et la base : recherche de gares par nom et calcul d'itinéraire, avec réponse au format GeoJSON.
- **Widget JavaScript dans Lizmap** : panneau de recherche, clic sur la carte, affichage de la gare, des distances et durées, et du tracé.
- **Transformation de projections** entre WGS84 (EPSG:4326, utilisé par la base et l'API) et le système de la carte Lizmap (EPSG:3857).
- **Tout est conteneurisé avec Docker** : la base et l'API d'un côté, la pile Lizmap (Lizmap, QGIS Server, PostgreSQL, redis, nginx) de l'autre.

## Fonctionnalités

- Recherche d'une gare par son nom (liste cliquable)
- Sélection du point de départ par un clic sur la carte
- Gare d'arrivée : celle qui a été choisie, sinon la plus proche du point cliqué
- Distance et temps de trajet **en voiture** et **à pied**
- Affichage du tracé du trajet en voiture, du point de départ et de la gare
- Zoom automatique sur le trajet
- Bouton de réinitialisation

## Architecture

```
Navigateur (carte Lizmap + widget JavaScript)
        |  clic / recherche (HTTP)
        v
   API FastAPI (Python)
        |  requêtes SQL
        v
PostgreSQL + PostGIS + pgRouting
   - gares (16 gares du Pays basque)
   - réseau routier voiture (car_ways)
   - réseau piéton (foot_ways)
```

## Technologies utilisées

- **Lizmap Web Client 3.9** et **QGIS** (publication de la carte, plugin Lizmap)
- **JavaScript** (widget intégré à Lizmap) et **OpenLayers** (affichage de la carte et du tracé)
- **PostgreSQL**, **PostGIS**, **pgRouting 3.6**
- **osm2pgrouting** et **osmium** (import et découpe des données OpenStreetMap)
- **Python**, **FastAPI**, **psycopg**
- **Docker** et **Docker Compose**

## Données

- **Gares** : jeu de données « Gares de voyageurs » (SNCF, open data), limité au Pays basque français. Voir la licence sur data.sncf.com.
- **Réseau routier et piéton** : OpenStreetMap, extrait Geofabrik découpé sur la zone. © les contributeurs d'OpenStreetMap (licence ODbL).

## Organisation du dépôt (proposition)

```
api/                  API FastAPI (main.py, Dockerfile, requirements.txt)
data/                 scripts SQL de test (les gros fichiers de données ne sont pas versionnés)
initdb/               création des extensions PostgreSQL
widget/itineraire.js  widget JavaScript à placer dans le dossier media/js du projet Lizmap
docker-compose.yml    base de données et API
.env.example          exemple de variables d'environnement
```

## Lancement (résumé)

1. Copier `.env.example` en `.env` et choisir un mot de passe.
2. Démarrer la base et l'API : `docker compose up -d --build`.
3. Importer les gares et les réseaux OpenStreetMap dans PostgreSQL (osmium pour découper l'extrait, osm2pgrouting pour construire les graphes voiture et piéton).
4. Installer Lizmap (dépôt `3liz/lizmap-docker-compose`), publier le projet QGIS avec le plugin Lizmap, puis placer `itineraire.js` dans `media/js/<projet>/` du répertoire de projets, avec l'option JavaScript activée pour ce répertoire.

## Notes d'installation (pièges rencontrés)

- **Configuration piéton d'osm2pgrouting** : avec la version utilisée, le fichier `mapconfig_for_pedestrian.xml` fourni avec l'outil contient un commentaire XML invalide (une ligne avec `--addnodes`) et l'import échoue avec « not well-formed ». Faire une copie du fichier, supprimer cette ligne, et passer la copie à `--conf`.
- **Import séparé voiture / piéton** : deux imports avec `--prefix car_` et `--prefix foot_`.
- **Sous Windows, avec la pile `3liz/lizmap-docker-compose`** : dans la version utilisée, `configure.bat` avait un espace manquant avant `_configure` dans le nom de l'image, et les scripts `.sh` doivent être en fins de ligne LF (et non CRLF), sinon les conteneurs plantent au démarrage.
- **Ports** : la base du projet utilise le port 5432. Changer `POSTGIS_PORT` (par exemple 5433) dans le fichier d'environnement de Lizmap pour éviter le conflit.
- **Après chaque modification de `api/main.py`**, reconstruire l'image : `docker compose up -d --build api`.

## Limites connues

- La **durée en voiture** est une estimation théorique, calculée à partir des vitesses maximales de la voirie OpenStreetMap, sans circulation, feux ni arrêts. Elle est optimiste.
- La **gare la plus proche** est choisie à vol d'oiseau, pas selon le trajet par la route.
- Seul le tracé en **voiture** est dessiné sur la carte ; le trajet à pied est calculé mais pas affiché.
- La recherche de gare **ne tolère pas les accents** (« Guethary » ne trouve pas « Guéthary »).
- Les données couvrent uniquement le **Pays basque français** : un clic en dehors de la zone est refusé.
- Configuration prévue pour un usage **local** : accès à l'API autorisé depuis toutes les origines (CORS), mot de passe de base dans un fichier `.env` à ne pas publier.

## Pistes d'amélioration

- Afficher le trajet à pied, avec un choix voiture / à pied.
- Étendre la zone en important un autre extrait OpenStreetMap.
- Rechercher les gares sans tenir compte des accents (extension `unaccent`).
- Choisir la gare la plus proche selon le trajet par la route.
