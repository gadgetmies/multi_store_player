import FontAwesome from 'react-fontawesome'
import React, { Component } from 'react'
import { requestJSONwithCredentials, requestWithCredentials } from './request-json-with-credentials'

class Settings extends Component {
  constructor(props) {
    super(props)
    this.state = {
      playlist: '',
      artistFollows: [],
      labelFollows: [],
      playlistFollows: []
    }
  }

  async componentDidMount() {
    try {
      await this.updateFollows()
    } catch (e) {
      console.error(e)
    }

    this.setState({ loading: false })
  }

  async updateFollows() {
    await this.updateArtistFollows()
    await this.updateLabelFollows()
    await this.updatePlaylistFollows()
  }

  async updateArtistFollows() {
    const artistFollows = await requestJSONwithCredentials({
      path: `/me/follows/artists`
    })

    this.setState({ artistFollows })
  }

  async updateLabelFollows() {
    const labelFollows = await requestJSONwithCredentials({
      path: `/me/follows/labels`
    })
    this.setState({ labelFollows })
  }

  async updatePlaylistFollows() {
    const playlistFollows = await requestJSONwithCredentials({
      path: `/me/follows/playlists`
    })
    this.setState({ playlistFollows })
  }

  render() {
    return (
      <>
        <div className="page-container">
          <h2>Settings</h2>
          <h3>Following</h3>
          <h4>Playlists ({this.state.playlistFollows.length})</h4>
          <label>
            Add playlists to follow:
            <br />
            <div className="input-layout">
              <input
                className="text-input text-input-small"
                value={this.state.playlist}
                onChange={e => this.setState({ playlist: e.target.value })}
              />
              <button
                className="button button-push_button-small button-push_button-primary"
                onClick={async () => {
                  await requestJSONwithCredentials({
                    path: '/me/follows/playlists',
                    method: 'POST',
                    body: { url: this.state.playlist }
                  })
                  this.setState({ playlist: '' })
                  await this.updatePlaylistFollows()
                }}
              >
                Add
              </button>
            </div>
          </label>
          <ul className="no-style-list follow-list">
            {this.state.playlistFollows.map(playlist => (
              <li>
                <button
                  key={playlist.id}
                  className="button pill pill-button"
                  onClick={async () => {
                    await requestWithCredentials({ path: `/me/follows/playlists/${playlist.id}`, method: 'DELETE' })
                    await this.updatePlaylistFollows()
                  }}
                >
                  <span className="pill-button-contents">
                    {playlist.storeName === 'Spotify' ? <FontAwesome name="spotify" /> : null} {playlist.title} <FontAwesome name="close" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <h4>Artists ({this.state.artistFollows.length})</h4>
          <label>
            Add artists to follow:
            <br />
            <div className="input-layout">
              <input className="text-input text-input-small" />
              <button className="button button-push_button-small button-push_button-primary">Add</button>
            </div>
          </label>
          <ul className="no-style-list follow-list">
            {this.state.artistFollows.map(artist => (
              <li>
                <button
                  className="button pill pill-button"
                  onClick={async () => {
                    await requestWithCredentials({ path: `/me/follows/artists/${artist.id}`, method: 'DELETE' })
                    await this.updateArtistFollows()
                  }}
                >
                  <span className="pill-button-contents">
                    {artist.name}&nbsp;
                    <FontAwesome name="close" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <h4>Labels ({this.state.labelFollows.length})</h4>
          <label>
            Add labels to follow:
            <br />
            <div className="input-layout">
              <input className="text-input text-input-small" />
              <button className="button button-push_button-small button-push_button-primary">Add</button>
            </div>
          </label>
          <ul className="no-style-list follow-list">
            {this.state.labelFollows.map(label => (
              <li>
                <button
                  className="button pill pill-button"
                  onClick={async () => {
                    await requestWithCredentials({ path: `/me/follows/labels/${label.id}`, method: 'DELETE' })
                    await this.updateLabelFollows()
                  }}
                >
                  <span className="pill-button-contents">
                    {label.name}&nbsp;
                    <FontAwesome name="close" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </>
    )
  }
}

export default Settings