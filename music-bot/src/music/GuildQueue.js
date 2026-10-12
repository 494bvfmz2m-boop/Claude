import { config } from '../config.js';

const HISTORY_LIMIT = 50;

/** Per-guild music state. A queued track is a Lavalink Track plus a `requester` user id. */
export class GuildQueue {
  constructor({ guildId, player, voiceChannelId, textChannelId }) {
    this.guildId = guildId;
    this.player = player;
    this.voiceChannelId = voiceChannelId;
    this.textChannelId = textChannelId;

    this.current = null;
    this.tracks = [];
    this.history = [];

    this.loop = 'off'; // 'off' | 'track' | 'queue'
    this.autoplay = false;
    this.stay = false; // 24/7 mode
    this.filter = 'off';
    this.volume = config.defaultVolume;

    this.nowPlayingMessage = null;
    this.idleTimer = null;

    // Set right before stopTrack() so the resulting "end" event knows why it happened.
    this.skipRequested = false;
    this.stopRequested = false;
  }

  get isPlaying() {
    return this.current !== null;
  }

  pushHistory(track) {
    this.history.push(track);
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
  }

  shuffle() {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
  }

  clearIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }
}
