WITH pt AS (
  SELECT ST_SetSRID(ST_MakePoint(-1.4476, 43.3395), 4326) AS geom
),
gare AS (
  SELECT g.gid, g.nom, g.geom FROM gares_pb g, pt
  ORDER BY g.geom <-> pt.geom LIMIT 1
),
v_pt AS (
  SELECT v.id FROM car_ways_vertices_pgr v, pt
  ORDER BY v.the_geom <-> pt.geom LIMIT 1
),
v_gare AS (
  SELECT v.id FROM car_ways_vertices_pgr v, gare
  ORDER BY v.the_geom <-> gare.geom LIMIT 1
),
route AS (
  SELECT * FROM pgr_dijkstra(
    'SELECT gid AS id, source, target,
            cost_s AS cost, reverse_cost_s AS reverse_cost
     FROM car_ways',
    (SELECT id FROM v_pt), (SELECT id FROM v_gare), true)
)
SELECT
  (SELECT nom FROM gare)  AS gare,
  round(sum(r.cost))      AS secondes,
  round(sum(w.length_m))  AS metres,
  count(*)                AS troncons
FROM route r
JOIN car_ways w ON w.gid = r.edge;