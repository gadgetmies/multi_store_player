import Preview from './Preview.js'
import Tracks from './Tracks.js'
import { requestJSONwithCredentials, requestWithCredentials } from './request-json-with-credentials.js'
import React, { Component } from 'react'
import * as R from 'ramda'
import MediaSession from '@mebtte/react-media-session'
import { artistNamesToString } from './TrackTitle'

class Player extends Component {
  constructor(props) {
    super(props)

    this.state = {
      currentTrack: null,
      heardTracks: [],
      listenedTracks: 0,
      listState: 'new'
    }

    this.preview = React.createRef()

    // if (this.props.tracks.length !== 0) {
    //   const storedTrack = JSON.parse(localStorage.getItem('currentTrack') || '{}')
    //   const currentTrack = storedTrack.track_id && this.props.tracks.find(R.propEq('track_id', storedTrack.track_id)) ||
    //     this.props.tracks[0]
    //   this.setCurrentTrack(currentTrack)
    // }
  }

  componentDidMount() {
    const that = this
    document.addEventListener('keydown', event => {
      if (
        event instanceof KeyboardEvent &&
        !event.target.form &&
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey
      ) {
        switch (event.key) {
          case 'e':
            this.playNextTrack()
            break
          case 'q':
            this.playPreviousTrack()
            break
          case 'w':
            that.preview.current.togglePlaying()
            break
          case 'r':
            this.playNextUnheard()
            break
          case 'd':
            that.preview.current.scan(10)
            break
          case 'a':
            that.preview.current.scan(-10)
            break
          default:
        }
      }
    })
  }

  async setCurrentTrack(track) {
    localStorage.setItem('currentTrack', JSON.stringify(track))
    this.setState({ currentTrack: track })
    await requestWithCredentials({
      path: `/me/tracks/${track.id}`,
      method: 'POST',
      body: { heard: true }
    })
    this.markAsPlayed(track.id)
  }

  markAsPlayed(trackId) {
    if (this.state.listState === 'heard') {
      return
    }

    let updatedHeardTracks = this.state.heardTracks
    const updatedTrack = R.assoc('heard', true, this.props.tracks.new.find(R.propEq('id', trackId)))
    const playedTrackIndex = this.state.heardTracks.findIndex(R.propEq('id', trackId))
    if (playedTrackIndex !== -1) {
      updatedHeardTracks.splice(playedTrackIndex, 1)
    } else {
      this.setState({ listenedTracks: this.state.listenedTracks + 1 })
    }

    updatedHeardTracks = R.prepend(updatedTrack, updatedHeardTracks)
    this.setState({ heardTracks: updatedHeardTracks })
  }

  getCurrentTrackIndex() {
    return this.getTrackIndex(this.state.currentTrack)
  }

  getTrackIndex(track) {
    return R.findIndex(R.propEq('id', track.id), this.getTracks())
  }

  async addToCart(store, id) {
    await requestJSONwithCredentials({
      path: `/stores/${store}/carts/default`,
      method: 'POST',
      body: { trackId: id }
    })
    this.props.onAddToCart(store)
  }

  async removeFromCart(store, id) {
    await requestJSONwithCredentials({
      path: `/stores/${store}/carts/cart`,
      method: 'DELETE',
      body: { trackId: id }
    })
    // TODO: add removed notification?
    this.props.onRemoveFromCart(store)
  }

  jumpTracks(numberOfTracksToJump) {
    const currentTrackIndex = this.getCurrentTrackIndex()
    const indexToJumpTo = R.clamp(0, this.getTracks().length - 1, currentTrackIndex + numberOfTracksToJump)
    this.setCurrentTrack(this.getTracks()[indexToJumpTo])
  }

  playPreviousTrack() {
    this.jumpTracks(-1)
  }

  playNextTrack() {
    this.jumpTracks(1)
  }

  playNextUnheard() {
    const firstUnplayed = this.getTracks().findIndex(R.propSatisfies(R.isNil, 'heard'))
    this.jumpTracks(firstUnplayed - this.getCurrentTrackIndex())
  }

  setPlaying(playing) {
    this.preview.current.setPlaying(playing)
  }

  async ignoreArtistsByLabels(artistsAndLabels) {
    await requestWithCredentials({
      path: `/me/ignores/labels`,
      method: 'POST',
      body: artistsAndLabels
    })
  }

  setListState(listState) {
    this.setState({ listState })
  }

  getTracks() {
    const heardTracks = this.state.heardTracks
    let tracks

    if (this.state.listState === 'new') {
      tracks = this.props.tracks.new.slice()
      heardTracks.forEach(heardTrack => {
        const index = tracks.findIndex(R.propEq('id', parseInt(heardTrack.id, 10)))
        if (index !== -1) {
          tracks[index] = heardTrack
        }
      })
    } else {
      tracks = this.props.tracks.heard.slice()
      heardTracks.forEach(heardTrack => {
        const index = tracks.findIndex(R.propEq('id', parseInt(heardTrack.id, 10)))
        if (index !== -1) {
          tracks.splice(index, 1)
        }
      })
      tracks = this.state.heardTracks.concat(tracks)
    }

    return tracks
  }

  render() {
    const tracks = this.getTracks()
    const currentTrack = this.state.currentTrack
    return (
      <>
        <MediaSession
          title={currentTrack ? currentTrack.title : ''}
          artist={currentTrack ? artistNamesToString(currentTrack.artists) : ''}
          onPlay={() => this.setPlaying(true)}
          onPause={() => this.setPlaying(false)}
          onSeekBackward={() => console.log('seek backward')}
          onSeekForward={() => console.log('seek forward')}
          onPreviousTrack={() => this.playPreviousTrack()}
          onNextTrack={() => this.playNextTrack()}
        />
        <Preview
          key={'preview'}
          showHint={tracks.length === 0}
          currentTrack={currentTrack}
          onMenuClicked={() => this.props.onMenuClicked()}
          onPrevious={() => this.playPreviousTrack()}
          onNext={() => this.playNextTrack()}
          ref={this.preview}
        />
        <Tracks
          key={'tracks'}
          carts={this.props.carts}
          tracks={tracks}
          listState={this.state.listState}
          newTracks={this.props.newTracks - this.state.listenedTracks}
          totalTracks={this.props.totalTracks}
          currentTrack={(currentTrack || {}).id}
          onMarkAllHeardClicked={this.props.onMarkAllHeardClicked}
          onUpdateTracksClicked={this.props.onUpdateTracksClicked}
          onAddToCart={this.addToCart}
          onRemoveFromCart={this.removeFromCart}
          onIgnoreArtistsByLabels={this.ignoreArtistsByLabels}
          onPreviewRequested={id => {
            const requestedTrack = R.find(R.propEq('id', id), this.getTracks())
            this.setCurrentTrack(requestedTrack)
            this.setPlaying(true)
          }}
          onShowNewClicked={this.setListState.bind(this, 'new')}
          onShowHeardClicked={this.setListState.bind(this, 'heard')}
        />
      </>
    )
  }
}

export default Player
