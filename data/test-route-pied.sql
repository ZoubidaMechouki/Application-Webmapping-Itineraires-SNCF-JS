WITH pt AS (
  SELECT ST_SetSRID(ST_MakePoint(-1.4476, 43.3395), 4326) AS geom
),
gare AS (
  SELECT g.gid, g.nom, g.geom FROM gares_pb g, pt
  ORDER BY g.geom <-> pt.geom LIMIT 1
),
v_pt AS (
  SELECT v.id FROM foot_ways_vertices_pgr v, pt
  ORDER BY v.the_geom <-> pt.geom LIMIT 1
),
v_gare AS (
  SELECT v.id FROM foot_ways_vertices_pgr v, gare
  ORDER BY v.the_geom <-> gare.geom LIMIT 1
),
route AS (
  SELECT * FROM pgr_dijkstra(
    'SELECT gid AS id, source, target,
          length_m AS cost, length_m AS reverse_cost
     FROM foot_ways',
    (SELECT id FROM v_pt), (SELECT id FROM v_gare), true)
)
SELECT
  (SELECT nom FROM gare)  AS gare,
  round(sum(w.length_m) * 3600 / 5000) AS secondes,
  round(sum(w.length_m))  AS metres,
  count(*)                AS troncons
FROM route r
JOIN foot_ways w ON w.gid = r.edge;