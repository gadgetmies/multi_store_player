const L = require('partial.lenses')
const R = require('ramda')

const idToString = id => id.toString()

const beatportUrl = type => ({ id, slug }) => `https://www.beatport.com/${type}/${slug}/${id}`

const sharedArtistPropsLens = {
  name: 'name',
  id: ['id', L.reread(n => n.toString(10))],
  url: [L.props('slug', 'id'), L.reread(beatportUrl('artist'))]
}

const bpKeysToCamelot = {
  'C maj': '1d',
  'G maj': '2d',
  'D maj': '3d',
  'A maj': '4d',
  'E maj': '5d',
  'B maj': '6d',
  'F♯ maj': '7d',
  'G♭ maj': '7d',
  'C♯ maj': '8d',
  'D♭ maj': '8d',
  'G♯ maj': '9d',
  'A♭ maj': '9d',
  'D♯ maj': '10d',
  'E♭ maj': '10d',
  'A♯ maj': '11d',
  'B♭ maj': '11d',
  'F maj': '12d',
  'A min': '1m',
  'E min': '2m',
  'B min': '3m',
  'F♯ min': '4m',
  'G♭ min': '4m',
  'C♯ min': '5m',
  'D♭ min': '5m',
  'G♯ min': '6m',
  'A♭ min': '6m',
  'D♯ min': '7m',
  'E♭ min': '7m',
  'A♯ min': '8m',
  'B♭ min': '8m',
  'F min': '9m',
  'C min': '10m',
  'G min': '11m',
  'D min': '12m'
}

const previewUrlPath = [1, 'url']
const keyedPreviewsLens = ['preview', L.keyed, L.filter(R.path(previewUrlPath))]
const removeOriginalMix = L.cond([R.equals('Original Mix'), L.zero], [[]])
module.exports.beatportTracksTransform = L.collect([
  L.elems,
  L.pick({
    title: [
      L.props('title', 'name', 'mix'),
      L.reread(({ title, name, mix }) => (title || name).replace(` (${mix})`, ''))
    ],
    version: ['mix', removeOriginalMix],
    id: ['id', L.reread(idToString)],
    url: [L.props('slug', 'id'), L.reread(beatportUrl('track'))],
    artists: L.partsOf(
      L.branch({
        artists: [
          L.elems,
          L.pick({
            ...sharedArtistPropsLens,
            role: R.always('author')
          })
        ],
        remixers: [
          L.elems,
          L.pick({
            ...sharedArtistPropsLens,
            role: R.always('remixer')
          })
        ]
      })
    ),
    genres: L.partsOf(['genres', L.elems, 'name']),
    duration_ms: ['duration', 'milliseconds'],
    release: [
      'release',
      L.pick({
        id: ['id', L.reread(idToString)],
        title: 'name',
        url: [L.props('slug', 'id'), L.reread(beatportUrl('release'))]
      })
    ],
    released: ['date', 'released'],
    published: ['date', 'published'],
    previews: L.partsOf([
      keyedPreviewsLens,
      L.elems,
      L.pick({
        format: 0,
        url: previewUrlPath,
        start_ms: [1, 'offset', 'start'],
        end_ms: [1, 'offset', 'end']
      })
    ]),
    label: [
      'label',
      L.pick({
        id: ['id', L.reread(idToString)],
        name: 'name',
        url: [L.props('slug', 'id'), L.reread(beatportUrl('label'))]
      })
    ],
    waveform: [
      L.pick({
        url: ['waveform', 'large', 'url'],
        start_ms: [keyedPreviewsLens, 0, 1, 'offset', 'start'],
        end_ms: [keyedPreviewsLens, 0, 1, 'offset', 'end']
      })
    ],
    key: ['key', L.reread(bpKey => bpKeysToCamelot[bpKey])],
    store_details: []
  })
])

module.exports.beatportLibraryTransform = L.collect([
  L.elems,
  L.pick({
    title: ['name'],
    version: ['mix_name', removeOriginalMix],
    id: ['id', L.reread(idToString)],
    url: [L.props('slug', 'id'), L.reread(beatportUrl('track'))],
    artists: L.partsOf(
      L.branch({
        artists: [
          L.elems,
          L.pick({
            ...sharedArtistPropsLens,
            role: R.always('author')
          })
        ],
        remixers: [
          L.elems,
          L.pick({
            ...sharedArtistPropsLens,
            role: R.always('remixer')
          })
        ]
      })
    ),
    genres: L.partsOf(['genre', 'name']),
    duration_ms: ['length_ms'],
    release: [
      'release',
      L.pick({
        id: ['id', L.reread(idToString)],
        title: 'name',
        url: [L.props('slug', 'id'), L.reread(beatportUrl('release'))]
      })
    ],
    released: ['new_release_date'],
    published: ['publish_date'],
    purchased: ['purchase_date'],
    previews: L.partsOf(
      L.pick({
        format: R.always('mp3'),
        url: ['sample_url'],
        start_ms: ['sample_start_ms'],
        end_ms: ['sample_end_ms']
      })
    ),
    label: [
      'release',
      'label',
      L.pick({
        id: ['id', L.reread(idToString)],
        name: 'name',
        url: [L.props('slug', 'id'), L.reread(beatportUrl('label'))]
      })
    ],
    key: [
      L.props('camelot_number', 'camelot_letter'),
      L.reread(({ camelot_number, camelot_letter }) => `${camelot_number}${camelot_letter}`)
    ],
    store_details: []
  })
])
