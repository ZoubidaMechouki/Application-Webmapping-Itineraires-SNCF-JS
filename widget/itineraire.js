lizMap.events.on({
    uicreated: function () {
        // NOUVEAU : la gare choisie (null = la plus proche du point cliqué)
        let gareChoisie = null;

        // --- Le panneau ---
        const panneau = document.createElement("div");
        panneau.style.position = "absolute";
        panneau.style.top = "60px";
        panneau.style.left = "280px";
        panneau.style.width = "300px";
        panneau.style.padding = "10px";
        panneau.style.backgroundColor = "white";
        panneau.style.border = "1px solid #ccc";
        panneau.style.boxShadow = "0 0 5px rgba(0, 0, 0, 0.2)";
        panneau.style.zIndex = "1000";

        const titre = document.createElement("strong");
        titre.textContent = "Itinéraire vers une gare";
        panneau.appendChild(titre);

        // NOUVEAU : ligne de recherche (champ + boutons)
        const ligneRecherche = document.createElement("div");
        ligneRecherche.style.marginTop = "8px";
        const champ = document.createElement("input");
        champ.type = "text";
        champ.placeholder = "Nom de la gare (facultatif)";
        champ.style.width = "150px";
        const boutonChercher = document.createElement("button");
        boutonChercher.textContent = "Chercher";
        boutonChercher.style.marginLeft = "4px";
        const boutonAnnuler = document.createElement("button");
        boutonAnnuler.textContent = "Annuler";
        boutonAnnuler.style.marginLeft = "4px";
        ligneRecherche.appendChild(champ);
        ligneRecherche.appendChild(boutonChercher);
        ligneRecherche.appendChild(boutonAnnuler);
        panneau.appendChild(ligneRecherche);

         // NOUVEAU : bouton pour tout remettre à zéro
        const boutonReinit = document.createElement("button");
        boutonReinit.textContent = "Réinitialiser";
        boutonReinit.style.marginTop = "6px";
        panneau.appendChild(boutonReinit);

        // NOUVEAU : liste des gares trouvées et rappel du choix
        const listeGares = document.createElement("div");
        panneau.appendChild(listeGares);

        const infoChoix = document.createElement("div");
        infoChoix.textContent = "Gare d'arrivée : la plus proche du point choisi";
        infoChoix.style.marginTop = "6px";
        panneau.appendChild(infoChoix);

        const consigne = document.createElement("div");
        consigne.textContent = "Cliquez sur la carte pour choisir un point de départ.";
        consigne.style.marginTop = "8px";
        panneau.appendChild(consigne);

        const coords = document.createElement("div");
        coords.textContent = "Point choisi : aucun";
        coords.style.marginTop = "8px";
        panneau.appendChild(coords);

        const infoGare = document.createElement("div");
        const infoVoiture = document.createElement("div");
        const infoPied = document.createElement("div");
        infoGare.style.marginTop = "8px";
        panneau.appendChild(infoGare);
        panneau.appendChild(infoVoiture);
        panneau.appendChild(infoPied);

        document.body.appendChild(panneau);

        // --- NOUVEAU : chercher des gares par leur nom ---
        function chercherGares() {
            const texte = champ.value.trim();
            listeGares.textContent = "";
            if (texte.length < 2) {
                listeGares.textContent = "Tapez au moins 2 lettres.";
                return;
            }
            fetch("http://localhost:8000/gares?nom=" + encodeURIComponent(texte))
                .then(function (reponse) { return reponse.json(); })
                .then(function (gares) {
                    if (gares.length === 0) {
                        listeGares.textContent = "Aucune gare trouvée.";
                        return;
                    }
                    gares.forEach(function (g) {
                        const ligne = document.createElement("div");
                        ligne.textContent = g.nom;
                        ligne.style.cursor = "pointer";
                        ligne.style.color = "#0066cc";
                        ligne.addEventListener("click", function () {
                            gareChoisie = g;
                            infoChoix.textContent = "Gare d'arrivée : " + g.nom;
                            listeGares.textContent = "";
                        });
                        listeGares.appendChild(ligne);
                    });
                })
                .catch(function (erreur) {
                    listeGares.textContent = "Recherche impossible.";
                    console.error(erreur);
                });
        }
        boutonChercher.addEventListener("click", chercherGares);
        champ.addEventListener("keydown", function (evenement) {
            if (evenement.key === "Enter") {
                chercherGares();
            }
        });

        // --- NOUVEAU : annuler le choix de la gare ---
        boutonAnnuler.addEventListener("click", function () {
            gareChoisie = null;
            champ.value = "";
            listeGares.textContent = "";
            infoChoix.textContent = "Gare d'arrivée : la plus proche du point choisi";
        });

        // --- NOUVEAU : tout effacer ---
        boutonReinit.addEventListener("click", function () {
            gareChoisie = null;
            champ.value = "";
            listeGares.textContent = "";
            infoChoix.textContent = "Gare d'arrivée : la plus proche du point choisi";
            coords.textContent = "Point choisi : aucun";
            infoGare.textContent = "";
            infoVoiture.textContent = "";
            infoPied.textContent = "";
            lizMap.mainLizmap.map.clearHighlightFeatures();
        });

        // --- Transformer des secondes en "1 h 5 min" ---
        function formaterDuree(secondes) {
            const total = Math.round(secondes / 60);
            const heures = Math.floor(total / 60);
            const minutes = total % 60;
            if (heures > 0) {
                return heures + " h " + minutes + " min";
            }
            return minutes + " min";
        }

        // --- Zoomer sur le trajet (par l'ancienne carte) ---
        function zoomerSurTrace(trace) {
            try {
                const xs = trace.coordinates.map(function (c) { return c[0]; });
                const ys = trace.coordinates.map(function (c) { return c[1]; });
                const basGauche = lizMap.mainLizmap.transform(
                    [Math.min.apply(null, xs), Math.min.apply(null, ys)],
                    "EPSG:4326", lizMap.mainLizmap.projection
                );
                const hautDroit = lizMap.mainLizmap.transform(
                    [Math.max.apply(null, xs), Math.max.apply(null, ys)],
                    "EPSG:4326", lizMap.mainLizmap.projection
                );
                const marge = Math.max(hautDroit[0] - basGauche[0], hautDroit[1] - basGauche[1]) * 0.5 + 200;
                lizMap.map.zoomToExtent(new OpenLayers.Bounds(
                    basGauche[0] - marge, basGauche[1] - marge,
                    hautDroit[0] + marge, hautDroit[1] + marge
                ));
            } catch (erreur) {
                console.warn("Zoom impossible :", erreur);
            }
        }

        // --- Dessiner le trajet, le départ et la gare ---
        function dessinerTraces(donnees, lon, lat) {
            const collection = {
                type: "FeatureCollection",
                features: [
                    { type: "Feature", properties: {}, geometry: donnees.voiture.trace },
                    { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [lon, lat] } },
                    { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [donnees.gare.lon, donnees.gare.lat] } }
                ]
            };
            lizMap.mainLizmap.map.clearHighlightFeatures();
            lizMap.mainLizmap.map.setHighlightFeatures(JSON.stringify(collection), "geojson", "EPSG:4326");
            zoomerSurTrace(donnees.voiture.trace);
        }

        // --- Demander l'itinéraire à l'API et afficher la réponse ---
        function calculer(lon, lat) {
            infoGare.textContent = "Calcul en cours...";
            infoVoiture.textContent = "";
            infoPied.textContent = "";

            // NOUVEAU : on ajoute la gare choisie à l'adresse, s'il y en a une
            let adresse = "http://localhost:8000/itineraire?lon=" + lon + "&lat=" + lat;
            if (gareChoisie) {
                adresse = adresse + "&gare=" + gareChoisie.gid;
            }

            fetch(adresse)
                .then(function (reponse) {
                    if (!reponse.ok) {
                        return reponse.json().then(function (d) {
                            throw new Error(d.detail || "Erreur " + reponse.status);
                        });
                    }
                    return reponse.json();
                })
                .then(function (donnees) {
                    infoGare.textContent = "Gare : " + donnees.gare.nom;
                    infoVoiture.textContent = "En voiture : "
                        + (donnees.voiture.distance_m / 1000).toFixed(1) + " km, "
                        + formaterDuree(donnees.voiture.duree_s);
                    infoPied.textContent = "À pied : "
                        + (donnees.pied.distance_m / 1000).toFixed(1) + " km, "
                        + formaterDuree(donnees.pied.duree_s);
                    dessinerTraces(donnees, lon, lat);
                })
                .catch(function (erreur) {
                    infoGare.textContent = "Impossible de calculer : " + erreur.message;
                    console.error(erreur);
                });
        }

        // --- Le clic sur la carte ---
        lizMap.mainLizmap.map.on("singleclick", function (evenement) {
            const wgs84 = lizMap.mainLizmap.transform(
                evenement.coordinate,
                lizMap.mainLizmap.projection,
                "EPSG:4326"
            );
            const lon = wgs84[0];
            const lat = wgs84[1];

            coords.textContent = "Point choisi : " + lon.toFixed(5) + ", " + lat.toFixed(5);
            calculer(lon, lat);
        });
    }
});
