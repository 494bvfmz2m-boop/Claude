import { Connectors, LoadType, Shoukaku } from 'shoukaku';
import { config } from '../config.js';
import { GuildQueue } from './GuildQueue.js';
import { filterPresets } from './filters.js';
import { controlRow, errorEmbed, infoEmbed, nowPlayingEmbed } from './ui.js';

const URL_PATTERN = /^https?:\/\//i;

export class MusicManager {
  constructor(client) {
    this.client = client;
    /** @type {Map<string, GuildQueue>} */
    this.queues = new Map();

    this.shoukaku = new Shoukaku(
      new Connectors.DiscordJS(client),
      [{ name: 'main', url: new URL(config.lavalink.url).host, auth: config.lavalink.password, secure: config.lavalink.url.startsWith('https') }],
      { reconnectTries: 30, reconnectInterval: 5, moveOnDisconnect: false },
    );

    this.shoukaku.on('ready', (name) => console.log(`[lavalink] node "${name}" connected`));
    this.shoukaku.on('error', (name, error) => console.error(`[lavalink] node "${name}" error:`, error.message));
    this.shoukaku.on('close', (name, code, reason) => console.warn(`[lavalink] node "${name}" closed (${code}) ${reason || ''}`));
    this.shoukaku.on('disconnect', (name) => console.warn(`[lavalink] node "${name}" disconnected`));
  }

  get node() {
    return this.shoukaku.getIdealNode();
  }

  get(guildId) {
    return this.queues.get(guildId);
  }

  /** Searches Lavalink. Returns { tracks, playlistName } or throws with a user-facing message. */
  async search(query) {
    const node = this.node;
    if (!node) throw new Error('The audio server is not connected yet, try again in a moment.');

    const identifier = URL_PATTERN.test(query) ? query : `${config.defaultSearch}:${query}`;
    const result = await node.rest.resolve(identifier);

    switch (result?.loadType) {
      case LoadType.TRACK:
        return { tracks: [result.data], playlistName: null };
      case LoadType.SEARCH:
        if (!result.data.length) break;
        return { tracks: [result.data[0]], playlistName: null };
      case LoadType.PLAYLIST:
        return { tracks: result.data.tracks, playlistName: result.data.info.name };
      case LoadType.ERROR:
        throw new Error(`Couldn't load that: ${result.data.message}`);
    }
    throw new Error('No results found.');
  }

  /** Returns the guild's queue, joining the voice channel first if needed. */
  async connect({ guild, voiceChannel, textChannel }) {
    let queue = this.queues.get(guild.id);
    if (queue) return queue;

    const player = await this.shoukaku.joinVoiceChannel({
      guildId: guild.id,
      channelId: voiceChannel.id,
      shardId: guild.shardId,
      deaf: true,
    });

    queue = new GuildQueue({ guildId: guild.id, player, voiceChannelId: voiceChannel.id, textChannelId: textChannel.id });
    this.queues.set(guild.id, queue);
    await player.setGlobalVolume(queue.volume);
    this.#bindPlayerEvents(queue);
    return queue;
  }

  /** Adds tracks to the queue and starts playback if idle. */
  async enqueue(queue, tracks, requesterId) {
    queue.clearIdleTimer();
    queue.tracks.push(...tracks.map((t) => ({ ...t, requester: requesterId })));
    if (!queue.isPlaying) await this.#playNext(queue);
  }

  async skip(queue) {
    if (!queue.isPlaying) return;
    queue.skipRequested = true;
    await queue.player.stopTrack();
  }

  /** Clears the queue and stops playback, staying connected (the idle timer decides when to leave). */
  async stop(queue) {
    queue.tracks = [];
    queue.loop = 'off';
    if (!queue.isPlaying) return;
    queue.stopRequested = true;
    await queue.player.stopTrack();
  }

  async previous(queue) {
    const prev = queue.history.pop();
    if (!prev) return false;
    if (queue.current) queue.tracks.unshift(queue.current);
    await this.#play(queue, prev);
    return true;
  }

  async skipTo(queue, index) {
    queue.tracks.splice(0, index);
    await this.skip(queue);
  }

  async setVolume(queue, volume) {
    queue.volume = volume;
    await queue.player.setGlobalVolume(volume);
  }

  async setFilter(queue, name) {
    queue.filter = name;
    await queue.player.setFilters(filterPresets[name].filters);
  }

  async destroy(guildId) {
    const queue = this.queues.get(guildId);
    if (!queue) return;
    this.queues.delete(guildId);
    queue.clearIdleTimer();
    await this.#disableNowPlaying(queue);
    await this.shoukaku.leaveVoiceChannel(guildId).catch(() => {});
  }

  /** Called on voice state changes: leave when the bot is alone, unless 24/7 is on. */
  handleChannelOccupancy(queue, humansInChannel) {
    if (queue.stay) return;
    if (humansInChannel > 0) {
      if (queue.isPlaying) queue.clearIdleTimer();
      return;
    }
    this.#scheduleLeave(queue, 'Left the voice channel because everyone else did.');
  }

  #bindPlayerEvents(queue) {
    const { player } = queue;

    player.on('start', () => this.#sendNowPlaying(queue));

    player.on('end', async (event) => {
      if (event.reason === 'replaced' || event.reason === 'cleanup') return;
      try {
        await this.#playNext(queue, event.reason);
      } catch (error) {
        console.error(`[music] failed to advance queue in ${queue.guildId}:`, error);
      }
    });

    player.on('exception', (event) => {
      this.#send(queue, errorEmbed(`Playback error: ${event.exception.message}`));
    });

    player.on('stuck', () => {
      this.#send(queue, errorEmbed('The track got stuck, skipping.'));
      player.stopTrack().catch(() => {});
    });

    player.on('closed', (event) => {
      // 4014/4006: voice connection gone. Moving channels can also emit this, so only clean
      // up if the bot really isn't in a voice channel anymore.
      if (event.code !== 4014 && event.code !== 4006) return;
      setTimeout(() => {
        const guild = this.client.guilds.cache.get(queue.guildId);
        if (!guild?.members.me?.voice.channelId) this.destroy(queue.guildId);
      }, 2000);
    });
  }

  async #playNext(queue, endReason = null) {
    const finished = queue.current;
    const skipped = queue.skipRequested;
    const stopped = queue.stopRequested;
    queue.skipRequested = false;
    queue.stopRequested = false;

    if (finished) {
      queue.pushHistory(finished);
      if (!stopped) {
        if (queue.loop === 'track' && !skipped && endReason === 'finished') {
          return this.#play(queue, finished);
        }
        if (queue.loop === 'queue') queue.tracks.push(finished);
      }
    }

    let next = queue.tracks.shift();
    if (!next && !stopped && queue.autoplay && finished) {
      next = await this.#findRelated(queue, finished).catch((e) => {
        console.warn('[music] autoplay lookup failed:', e.message);
        return null;
      });
    }

    if (next) return this.#play(queue, next);

    queue.current = null;
    await this.#disableNowPlaying(queue);
    if (!stopped) this.#send(queue, infoEmbed('✅ Queue finished. Add more with `/play`.'));
    if (!queue.stay) this.#scheduleLeave(queue, 'Left the voice channel after being idle.');
  }

  async #play(queue, track) {
    queue.clearIdleTimer();
    queue.current = track;
    await queue.player.playTrack({ track: { encoded: track.encoded } });
  }

  /**
   * Autoplay: use YouTube's "mix" playlist for the last track (finding a YouTube equivalent
   * first if it came from another source) and pick something we haven't played recently.
   */
  async #findRelated(queue, seed) {
    const node = this.node;
    if (!node) return null;

    let videoId = seed.info.sourceName === 'youtube' ? seed.info.identifier : null;
    if (!videoId) {
      const found = await node.rest.resolve(`ytsearch:${seed.info.author} - ${seed.info.title}`);
      if (found?.loadType === LoadType.SEARCH && found.data.length) videoId = found.data[0].info.identifier;
    }
    if (!videoId) return null;

    const mix = await node.rest.resolve(`https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`);
    if (mix?.loadType !== LoadType.PLAYLIST) return null;

    const seen = new Set([...queue.history, seed].flatMap((t) => [t.info.identifier, t.info.title.toLowerCase()]));
    const candidates = mix.data.tracks.filter(
      (t) => !seen.has(t.info.identifier) && !seen.has(t.info.title.toLowerCase()) && !t.info.isStream,
    );
    const pick = candidates[Math.floor(Math.random() * Math.min(candidates.length, 5))];
    return pick ? { ...pick, requester: null } : null;
  }

  #scheduleLeave(queue, message) {
    queue.clearIdleTimer();
    queue.idleTimer = setTimeout(async () => {
      if (queue.stay || this.queues.get(queue.guildId) !== queue) return;
      await this.#send(queue, infoEmbed(`👋 ${message}`));
      await this.destroy(queue.guildId);
    }, config.idleTimeoutMs);
  }

  async #sendNowPlaying(queue) {
    await this.#disableNowPlaying(queue);
    queue.nowPlayingMessage = await this.#send(queue, nowPlayingEmbed(queue), [controlRow(queue)]);
  }

  async refreshNowPlaying(queue) {
    if (!queue.nowPlayingMessage || !queue.current) return;
    await queue.nowPlayingMessage
      .edit({ embeds: [nowPlayingEmbed(queue)], components: [controlRow(queue)] })
      .catch(() => {});
  }

  async #disableNowPlaying(queue) {
    const msg = queue.nowPlayingMessage;
    queue.nowPlayingMessage = null;
    if (msg) await msg.edit({ components: [controlRow(null, true)] }).catch(() => {});
  }

  async #send(queue, embed, components = []) {
    const channel = this.client.channels.cache.get(queue.textChannelId);
    if (!channel?.isTextBased()) return null;
    return channel.send({ embeds: [embed], components }).catch(() => null);
  }
}
