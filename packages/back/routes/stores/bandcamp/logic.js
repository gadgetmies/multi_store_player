const R = require('ramda')
const BPromise = require('bluebird')
const { bandcampReleasesTransform } = require('multi_store_player_chrome_extension/src/js/transforms/bandcamp')
const { queryPreviewDetails } = require('../../shared/db/preview.js')
const { queryStoreId, queryFollowRegexes } = require('../../shared/db/store.js')
const {
  getReleaseAsync,
  getTagAsync,
  getArtistAsync,
  getLabelAsync,
  getPageDetailsAsync,
  getTagReleasesAsync
} = require('./bandcamp-api.js')

const { queryAlbumUrl } = require('./db.js')
const logger = require('../../../logger')(__filename)

let storeDbId = null
const storeName = (module.exports.storeName = 'Bandcamp')
module.exports.storeUrl = 'https://bandcamp.com'

const getStoreDbId = () => {
  if (storeDbId) {
    return BPromise.resolve(storeDbId)
  } else {
    return queryStoreId(storeName).then(store_id => {
      storeDbId = store_id
      return storeDbId
    })
  }
}

module.exports.getPreviewDetails = async previewId => {
  const storeId = await getStoreDbId()
  const details = await queryPreviewDetails(previewId)
  const storeTrackId = details.store_track_id
  const albumUrl = await queryAlbumUrl(storeId, storeTrackId)
  const albumInfo = await getReleaseAsync(albumUrl)
  const url = await albumInfo.trackinfo.find(R.propEq('track_id', parseInt(storeTrackId, 10))).file['mp3-128']
  return {
    ...details,
    url: url
  }
}

const getTagFromUrl = function(playlistUrl) {
  const match = playlistUrl.match(/^https:\/\/bandcamp.com\/tag\/([^/?]+)/)
  return match[1]
}

module.exports.getArtistName = async url => {
  const { name } = await getArtistAsync(url)
  logger.info(name)
  return name
}

module.exports.getLabelName = async url => {
  const { name } = await getLabelAsync(url)
  logger.info(name)
  return name
}

module.exports.getPlaylistId = getTagFromUrl

const getPlaylistName = (module.exports.getPlaylistName = async (type, url) => {
  if (type === 'tag') {
    const res = await getTagAsync(getTagFromUrl(url))
    return res.name
  }
})

module.exports.getFollowDetails = async url => {
  const regexes = await queryFollowRegexes(storeName)
  const store = storeName.toLowerCase()
  for (const { regex, type } of regexes) {
    if (url.match(regex)) {
      if (['artist', 'label'].includes(type)) {
        const { name, type: pageType } = await getPageDetailsAsync(url)
        return { label: name, type: pageType, store }
      } else if (type === 'tag') {
        const label = await getPlaylistName(type, url)
        return { label: `Tag: ${label}`, type: 'playlist', store }
      } else {
        throw new Error('URL did not match any regex')
      }
    }
  }

  return undefined
}

const getTracksFromReleases = async releaseUrls => {
  const errors = []

  let releaseDetails = []
  for (const releaseUrl of releaseUrls) {
    logger.info(`Processing release: ${releaseUrl}`)
    try {
      const releaseInfo = await getReleaseAsync(releaseUrl)
      releaseDetails.push(releaseInfo)
    } catch (e) {
      const error = [`Failed to fetch release details from ${releaseUrl}`, e]
      logger.error(...error)
      errors.push(error)
    }
  }

  const transformed = bandcampReleasesTransform(releaseDetails)
  logger.info(`Found ${transformed.length} tracks for ${releaseUrls.length} releases`)
  if (transformed.length === 0) {
    const error = `No tracks found for releases ${releaseUrls.join(', ')}`
    logger.error(error)
    errors.push([error])
    return errors
  }

  return { errors, tracks: transformed }
}

module.exports.getArtistTracks = async ({ url }) => {
  const { releaseUrls } = await getArtistAsync(url)
  return await getTracksFromReleases(releaseUrls)
}

module.exports.getLabelTracks = async ({ url }) => {
  const { releaseUrls } = await getLabelAsync(url)
  return await getTracksFromReleases(releaseUrls)
}

module.exports.getPlaylistTracks = async function*({ playlistStoreId, type }) {
  if (type === 'tag') {
    const releases = await getTagReleasesAsync(playlistStoreId)
    const releaseUrls = R.uniq(R.flatten(releases.map(R.prop('items'))).map(R.prop('tralbum_url'))).filter(R.identity)
    logger.info(`Found ${releaseUrls.length} releases for tag ${playlistStoreId}`)
    for (const releaseUrl of releaseUrls) {
      try {
        yield await getTracksFromReleases([releaseUrl])
      } catch (e) {
        yield { tracks: [], errors: [e] }
      }
    }
  } else {
    throw new Error(`Unsupported playlist type: '${type}' (supported: 'tag') ${type === 'tag'}`)
  }
}
