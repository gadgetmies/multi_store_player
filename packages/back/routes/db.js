const sql = require('sql-template-strings')
const R = require('ramda')
const pg = require('../db/pg.js')
const { apiURL } = require('../config')

module.exports.queryLongestPreviewForTrack = (id, format, skip) =>
  pg
    .queryRowsAsync(
      // language=PostgreSQL
      sql`-- queryLongestPreviewForTrack
SELECT
  store__track_preview_url AS url
, store__track_preview_id  AS "previewId"
FROM
  store__track_preview
  NATURAL JOIN
    store__track
  NATURAL JOIN
    store
WHERE
    track_id = ${id}
AND store__track_preview_format = ${format}
ORDER BY
  store__track_preview_end_ms - store__track_preview_start_ms DESC NULLS LAST
OFFSET ${skip} LIMIT 1;
`
    )
    .then(R.head)

module.exports.searchForTracks = (query, username) =>
  pg.queryRowsAsync(
    // language=PostgreSQL
    sql`-- searchForTracks
WITH logged_user AS (
  SELECT meta_account_user_id 
  FROM meta_account
  WHERE meta_account_username = ${username}
)
SELECT
  track_id AS id
, *
FROM
  track_details(
      (SELECT
         array_agg(track_id)
       FROM
         (SELECT
            track_id
          FROM
            track
            NATURAL JOIN track__artist
            NATURAL JOIN artist
            NATURAL LEFT JOIN track__label
            NATURAL LEFT JOIN label
            NATURAL JOIN store__track
          GROUP BY track_id, track_title, track_version
          HAVING
              to_tsvector(
                  'simple',
                  unaccent(track_title || ' ' ||
                           coalesce(track_version, '') || ' ' ||
                           string_agg(artist_name, ' ') || ' ' ||
                           string_agg(coalesce(label_name, ''), ' '))) @@
              websearch_to_tsquery('simple', unaccent(${query}))
          ORDER BY MAX(LEAST(store__track_published, store__track_released)) DESC) AS tracks)
    , (SELECT meta_account_user_id FROM logged_user))`
  )
