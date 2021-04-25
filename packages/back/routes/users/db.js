const sql = require('sql-template-strings')
const R = require('ramda')
const { using } = require('bluebird')
const pg = require('../../db/pg.js')
const { apiURL } = require('../../config')

module.exports.addPurchasedTrackToUser = async (userId, storeTrack) => {
  await pg.queryRowsAsync(
    // language=PostgreSQL
    sql`-- addPurchasedTrackToUser
INSERT INTO user__store__track_purchased
  (meta_account_user_id, user__store__track_purchased_time, store__track_id)
SELECT
  ${userId}
, ${storeTrack.purchased}
, store__track_id
FROM store__track
WHERE
  store__track_store_id = ${storeTrack.id}
ON CONFLICT
  ON CONSTRAINT user__store__track_purchased_meta_account_user_id_store__tr_key
  DO UPDATE SET
  user__store__track_purchased_time = ${storeTrack.purchased}
`
  )
}

module.exports.addArtistWatch = async (tx, userId, artistId) => {
  await tx.queryAsync(
    // language=PostgreSQL
    sql`-- addArtistWatch INSERT INTO store__artist_watch
INSERT INTO store__artist_watch
  (store__artist_id)
SELECT
  store__artist_id
FROM
  store__artist
  NATURAL JOIN artist
WHERE
  artist_id = ${artistId}
ON CONFLICT DO NOTHING
  `
  )

  await tx.queryAsync(
    // language=PostgreSQL
    sql`-- addArtistWatch INSERT INTO store__artist_watch__user
INSERT INTO store__artist_watch__user
  (store__artist_watch_id, meta_account_user_id)
SELECT
  store__artist_watch_id
, ${userId}
FROM
  store__artist_watch
  NATURAL JOIN store__artist
  NATURAL JOIN artist
WHERE
  artist_id = ${artistId}
ON CONFLICT DO NOTHING
  `
  )

  return (
    await tx.queryRowsAsync(
      // language=PostgreSQL
      sql`-- addArtistWatch SELECT store__artist_watch_id
SELECT
  store__artist_watch_id AS "followId"
FROM
  store__artist_watch
  NATURAL JOIN store__artist_watch__user
  NATURAL JOIN store__artist
WHERE
    meta_account_user_id = ${userId}
AND artist_id = ${artistId}`
    )
  )[0].followId
}

module.exports.addLabelWatch = async (tx, userId, labelId) => {
  await tx.queryAsync(
    // language=PostgreSQL
    sql`-- addLabelWatch INSERT INTO store__label_watch
INSERT INTO store__label_watch
  (store__label_id)
SELECT
  store__label_id
FROM
  store__label
  NATURAL JOIN label
WHERE
  label_id = ${labelId}
ON CONFLICT DO NOTHING
`
  )

  await tx.queryRowsAsync(
    // language=PostgreSQL
    sql`-- addLabelWatch INSERT INTO store__label_watch__user
INSERT INTO store__label_watch__user
  (store__label_watch_id, meta_account_user_id)
SELECT
  store__label_watch_id
, ${userId}
FROM
  store__label_watch
  NATURAL JOIN store__label
WHERE
  label_id = ${labelId}
ON CONFLICT DO NOTHING
`
  )

  return (
    await tx.queryRowsAsync(
      // language=PostgreSQL
      sql`-- addLabelWatch SELECT store__label_watch_id
SELECT
  store__label_watch_id AS "followId"
FROM
  store__label_watch
  NATURAL JOIN store__label_watch__user
  NATURAL JOIN store__label
WHERE
    meta_account_user_id = ${userId}
AND label_id = ${labelId}`
    )
  )[0].followId
}

module.exports.deleteArtistWatchesFromUser = async (storeUrl, user) => {
  // language=PostgreSQL
  await pg.queryAsync(
    sql`--deleteArtistWatchesFromUser
DELETE
FROM store__artist_watch__user
WHERE
    meta_account_user_id = ${user.id}
AND store__artist_watch_id IN
    (SELECT
       store__artist_watch_id
     FROM
       store__artist_watch
       NATURAL JOIN store__artist
       NATURAL JOIN store
     WHERE
       store_url = ${storeUrl})
    `
  )
}

module.exports.deleteArtistWatchFromUser = async (userId, artistId) => {
  console.log({ userId, artistId })
  // language=PostgreSQL
  await pg.queryAsync(
    sql`-- deleteArtistWatchFromUser
DELETE
FROM store__artist_watch__user
WHERE
    meta_account_user_id = ${userId}
AND store__artist_watch_id IN
    (SELECT
       store__artist_watch_id
     FROM
       store__artist_watch
       NATURAL JOIN store__artist
       NATURAL JOIN store
     WHERE
       artist_id = ${artistId})
`
  )
}

module.exports.deleteLabelWatchesFromUser = async (storeUrl, user) => {
  // language=PostgreSQL
  await pg.queryAsync(
    sql`-- deleteLabelWatchesFromUser
DELETE
FROM store__label_watch__user
WHERE
    meta_account_user_id = ${user.id}
AND store__label_watch_id IN
    (SELECT
       store__label_watch_id
     FROM
       store__label_watch
       NATURAL JOIN store__label
       NATURAL JOIN store
     WHERE
       store_url = ${storeUrl})
`
  )
}

module.exports.deleteLabelWatchFromUser = async (userId, labelId) => {
  // language=PostgreSQL
  await pg.queryAsync(
    sql`-- deleteLabelWatchFromUser
DELETE
FROM store__label_watch__user
WHERE
    meta_account_user_id = ${userId}
AND store__label_watch_id IN
    (SELECT
       store__label_watch_id
     FROM
       store__label_watch
       NATURAL JOIN store__label
       NATURAL JOIN store
     WHERE
       label_id = ${labelId})
`
  )
}

module.exports.queryUserArtistFollows = async userId => {
  return pg.queryRowsAsync(
    // language=PostgreSQL
    sql`-- queryUserArtistFollows
WITH
  distinct_store_artists AS (
    SELECT DISTINCT
      artist_name
    , artist_id
    , store_name
    , store_id
    FROM
      artist
      NATURAL JOIN store__artist
      NATURAL JOIN store__artist_watch
      NATURAL JOIN store__artist_watch__user
      NATURAL JOIN store
    WHERE
        meta_account_user_id = ${userId}
    AND (store_name <> 'Bandcamp' OR store__artist_url IS NOT NULL)
  )
SELECT
  artist_name                                                      AS name
, artist_id                                                        AS id
, array_agg(json_build_object('name', store_name, 'id', store_id)) AS stores
FROM distinct_store_artists
GROUP BY
  1, 2
ORDER BY
  1
`
  )
}

module.exports.queryUserLabelFollows = async userId => {
  return pg.queryRowsAsync(
    // language=PostgreSQL
    sql`-- queryUserLabelFollows
WITH
  distinct_store_labels AS (
    SELECT DISTINCT
      label_name
    , label_id
    , store_name
    , store_id
    FROM
      label
      NATURAL JOIN store__label
      NATURAL JOIN store__label_watch
      NATURAL JOIN store__label_watch__user
      NATURAL JOIN store
    WHERE
      meta_account_user_id = ${userId}
  )
SELECT
  label_name                                                       AS name
, label_id                                                         AS id
, array_agg(json_build_object('name', store_name, 'id', store_id)) AS stores
FROM distinct_store_labels
GROUP BY
  1, 2
ORDER BY
  1
`
  )
}

module.exports.queryUserPlaylistFollows = async userId => {
  return pg.queryRowsAsync(
    // language=PostgreSQL
    sql`-- queryUserPlaylistFollows
SELECT
  concat_ws(': ', store_playlist_type_label, playlist_title) AS title
, playlist_id                                                AS id
, store_name                                                 AS "storeName"
, store_id                                                   AS "storeId"
FROM
  playlist
  NATURAL JOIN user__playlist_watch
  NATURAL JOIN store_playlist_type
  NATURAL JOIN store
WHERE
  meta_account_user_id = ${userId}
ORDER BY
  1
`
  )
}

module.exports.queryUserTracks = username =>
  pg
    .queryRowsAsync(
      // language=PostgreSQL
      sql`-- queryUserTracks
WITH
  logged_user AS (
    SELECT
      meta_account_user_id
    FROM meta_account
    WHERE
      meta_account_username = ${username}
  )
, user_purchased_tracks AS (
  SELECT
    track_id
  FROM
    user__store__track_purchased
    NATURAL JOIN store__track
    NATURAL JOIN logged_user
)
, user_tracks_meta AS (
  SELECT
    COUNT(*)                                          AS total
  , COUNT(*) FILTER (WHERE user__track_heard IS NULL) AS new
  FROM
    user__track
    NATURAL JOIN logged_user
  WHERE
    track_id NOT IN (SELECT track_id FROM user_purchased_tracks)
)
, new_tracks AS (
  SELECT
    track_id
  , track_added
  , user__track_heard
  FROM
    logged_user
    NATURAL JOIN user__track
    NATURAL JOIN track
    NATURAL JOIN store__track
    NATURAL JOIN store
  WHERE
      user__track_heard IS NULL
  AND track_id NOT IN (SELECT track_id FROM user_purchased_tracks)
  GROUP BY 1, 2, 3
)
, label_scores AS (
  SELECT
    track_id
  , SUM(COALESCE(user_label_scores_score, 0)) AS label_score
  FROM
    new_tracks
    NATURAL LEFT JOIN track__label
    NATURAL LEFT JOIN user_label_scores
  GROUP BY 1
)
, artist_scores AS (
  SELECT
    track_id
  , SUM(COALESCE(user_artist_scores_score, 0)) AS artist_score
  FROM
    new_tracks
    NATURAL JOIN track__artist
    NATURAL LEFT JOIN user_artist_scores
  GROUP BY 1
)
, user_score_weights AS (
  SELECT
    user_track_score_weight_code
  , user_track_score_weight_multiplier
  FROM
    user_track_score_weight
    NATURAL JOIN logged_user
)
, new_tracks_with_scores AS (
  SELECT
    track_id
  , user__track_heard
  , label_score * COALESCE(label_multiplier, 0) +
    artist_score * COALESCE(artist_multiplier, 0) +
    COALESCE(added_score.score, 0) * COALESCE(date_added_multiplier, 0) +
    COALESCE(released_score.score, 0) * COALESCE(date_released_multiplier, 0) AS score
  FROM
    (SELECT
       track_id
     , user__track_heard
     , label_score
     , artist_score
     , track_added
     , (SELECT
          user_track_score_weight_multiplier
        FROM user_score_weights
        WHERE
          user_track_score_weight_code = 'label'
       ) AS label_multiplier
     , (SELECT
          user_track_score_weight_multiplier
        FROM user_score_weights
        WHERE
          user_track_score_weight_code = 'artist'
       ) AS artist_multiplier
     , (SELECT
          user_track_score_weight_multiplier
        FROM user_score_weights
        WHERE
          user_track_score_weight_code = 'date_added'
       ) AS date_added_multiplier
     , (SELECT
          user_track_score_weight_multiplier
        FROM user_score_weights
        WHERE
          user_track_score_weight_code = 'date_published'
       ) AS date_released_multiplier
     FROM
       new_tracks
       NATURAL JOIN label_scores
       NATURAL JOIN artist_scores
    ) AS tracks
    LEFT JOIN track_date_added_score AS added_score USING (track_id)
    LEFT JOIN track_date_released_score AS released_score USING (track_id)
  ORDER BY score DESC NULLS LAST
  LIMIT 200
)
, heard_tracks AS (
  SELECT
    track_id
  , user__track_heard
  , NULL :: NUMERIC AS score
  FROM
    user__track
    NATURAL JOIN logged_user
  WHERE
    user__track_heard IS NOT NULL
  ORDER BY user__track_heard DESC
  LIMIT 50
)
, limited_tracks AS (
  SELECT
    track_id
  , user__track_heard
  , score
  FROM new_tracks_with_scores
  UNION ALL
  SELECT
    track_id
  , user__track_heard
  , score
  FROM heard_tracks
)
, tracks_with_details AS (
  SELECT
    track_id AS id
  , title
  , heard
  , duration
  , added
  , artists
  , version
  , labels
  , remixers
  , keys
  , previews
  , stores
  , released
  , score
  FROM
    limited_tracks lt
    JOIN track_details((SELECT ARRAY_AGG(track_id) FROM limited_tracks), ${apiURL}) td USING (track_id)
)
, new_tracks_with_details AS (
  SELECT
    json_agg(t) AS new_tracks
  FROM
    ( -- TODO: Why is the order by needed also here (also in new_tracks_with_scores)
      SELECT * FROM tracks_with_details WHERE heard IS NULL ORDER BY score DESC NULLS LAST, added DESC
    ) t
)
, heard_tracks_with_details AS (
  SELECT
    json_agg(t) AS heard_tracks
  FROM
    (
      SELECT * FROM tracks_with_details WHERE heard IS NOT NULL ORDER BY heard DESC
    ) t
)
SELECT
  json_build_object(
      'new', CASE WHEN new_tracks IS NULL THEN '[]'::JSON ELSE new_tracks END,
      'heard', CASE WHEN heard_tracks IS NULL THEN '[]'::JSON ELSE heard_tracks END
    ) AS tracks
, json_build_object(
      'total', total,
      'new', new
    ) AS meta
FROM
  new_tracks_with_details
, heard_tracks_with_details
, user_tracks_meta`
    )
    .then(R.head)

module.exports.addArtistOnLabelToIgnore = (tx, artistId, labelId, username) =>
  tx.queryAsync(
    // language=PostgreSQL
    sql`-- addArtistOnLabelToIgnore
INSERT INTO user__artist__label_ignore
  (meta_account_user_id, artist_id, label_id)
SELECT
  meta_account_user_id
, ${artistId}
, ${labelId}
FROM meta_account
WHERE
  meta_account_username = ${username}
ON CONFLICT ON CONSTRAINT user__artist__label_ignore_unique DO NOTHING
`
  )

module.exports.setTrackHeard =
  (trackId, username, heard) =>
  pg.queryRowsAsync(
// language=PostgreSQL
    sql`-- setTrackHeard
UPDATE user__track
SET
  user__track_heard = ${heard ? 'now()' : null}
WHERE
    track_id = ${trackId}
AND meta_account_user_id = (SELECT meta_account_user_id FROM meta_account WHERE meta_account_username = ${username})
`
  )

module.exports.setAllHeard =
  (username, heard) =>
  pg.queryAsync(
// language=PostgreSQL
    sql`-- setAllHeard
UPDATE user__track
SET
  user__track_heard = ${heard ? 'NOW()' : null}
WHERE
    meta_account_user_id = (SELECT meta_account_user_id FROM meta_account WHERE meta_account_username = ${username})
`
  )

module.exports.addTrackToUser = async (tx, userId, trackId, source) => {
  await tx.queryAsync(
    // language=PostgreSQL
    sql`--addTrackToUser 
INSERT INTO user__track
  (track_id, meta_account_user_id, user__track_source)
VALUES
  (${trackId}, ${userId}, ${source})
ON CONFLICT ON CONSTRAINT user__track_track_id_meta_account_user_id_key DO NOTHING
`
  )
}

module.exports.deletePlaylistFollowFromUser = async (userId, playlistId) => {
  await pg.queryAsync(
    // language=PostgreSQL
    sql`-- deletePlaylistFollowFromUser
DELETE
FROM user__playlist_watch
WHERE
    meta_account_user_id = ${userId}
AND playlist_id = ${playlistId}`
  )
}
