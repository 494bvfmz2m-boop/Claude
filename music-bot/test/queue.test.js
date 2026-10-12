// Simulates Lavalink player events against MusicManager's queue logic. Run: npm test
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';

process.env.IDLE_TIMEOUT = '0.05';
const { MusicManager } = await import('../src/music/MusicManager.js');

const tick = () => new Promise((r) => setTimeout(r, 5));
const track = (id, source = 'youtube') => ({
  encoded: `enc-${id}`,
  info: { identifier: id, title: `Song ${id}`, author: 'Artist', length: 180000, isStream: false, isSeekable: true, sourceName: source },
});

class FakePlayer extends EventEmitter {
  playing = null;
  paused = false;
  position = 0;
  played = [];
  async playTrack({ track: { encoded } }) {
    const replaced = this.playing;
    this.playing = encoded;
    this.played.push(encoded);
    if (replaced) this.emit('end', { reason: 'replaced' });
    this.emit('start', {});
  }
  async stopTrack() {
    if (!this.playing) return;
    this.playing = null;
    queueMicrotask(() => this.emit('end', { reason: 'stopped' }));
  }
  finish() {
    this.playing = null;
    this.emit('end', { reason: 'finished' });
  }
  async setGlobalVolume() {}
}

function setup({ resolve } = {}) {
  const client = new EventEmitter();
  client.channels = { cache: new Map() };
  client.guilds = { cache: new Map() };
  const music = new MusicManager(client);
  const player = new FakePlayer();
  music.shoukaku.joinVoiceChannel = async () => player;
  music.shoukaku.leaveVoiceChannel = async () => {};
  if (resolve) Object.defineProperty(music, 'node', { get: () => ({ rest: { resolve } }) });
  return { music, player };
}

async function start(music, ids) {
  const queue = await music.connect({ guild: { id: 'g', shardId: 0 }, voiceChannel: { id: 'vc' }, textChannel: { id: 'tc' } });
  await music.enqueue(queue, ids.map((id) => track(id)), 'user');
  return queue;
}

test('plays tracks in order and goes idle at the end', async () => {
  const { music, player } = setup();
  const queue = await start(music, ['a', 'b']);
  assert.equal(queue.current.info.identifier, 'a');
  player.finish(); await tick();
  assert.equal(queue.current.info.identifier, 'b');
  player.finish(); await tick();
  assert.equal(queue.current, null);
  assert.deepEqual(player.played, ['enc-a', 'enc-b']);
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(music.get('g'), undefined, 'leaves after idle timeout');
});

test('skip advances, and bypasses track loop', async () => {
  const { music, player } = setup();
  const queue = await start(music, ['a', 'b', 'c']);
  queue.loop = 'track';
  player.finish(); await tick();
  assert.equal(queue.current.info.identifier, 'a', 'track loop repeats on natural finish');
  await music.skip(queue); await tick();
  assert.equal(queue.current.info.identifier, 'b');
});

test('queue loop re-appends finished tracks', async () => {
  const { music, player } = setup();
  const queue = await start(music, ['a', 'b']);
  queue.loop = 'queue';
  player.finish(); await tick();
  player.finish(); await tick();
  assert.equal(queue.current.info.identifier, 'a');
  assert.deepEqual(queue.tracks.map((t) => t.info.identifier), ['b']);
});

test('previous replays the last track and requeues the current one', async () => {
  const { music, player } = setup();
  const queue = await start(music, ['a', 'b', 'c']);
  player.finish(); await tick();
  assert.equal(await music.previous(queue), true); await tick();
  assert.equal(queue.current.info.identifier, 'a');
  assert.deepEqual(queue.tracks.map((t) => t.info.identifier), ['b', 'c']);
});

test('stop clears everything and does not trigger autoplay', async () => {
  const { music, player } = setup({ resolve: async () => assert.fail('autoplay should not run') });
  const queue = await start(music, ['a', 'b']);
  queue.autoplay = true;
  await music.stop(queue); await tick();
  assert.equal(queue.current, null);
  assert.equal(queue.tracks.length, 0);
});

test('autoplay picks an unplayed track from the YouTube mix', async () => {
  const calls = [];
  const { music, player } = setup({
    resolve: async (id) => {
      calls.push(id);
      return { loadType: 'playlist', data: { info: { name: 'Mix' }, tracks: [track('a'), track('z')] } };
    },
  });
  const queue = await start(music, ['a']);
  queue.autoplay = true;
  player.finish(); await tick();
  assert.equal(calls[0], 'https://www.youtube.com/watch?v=a&list=RDa');
  assert.equal(queue.current.info.identifier, 'z');
  assert.equal(queue.current.requester, null);
});

test('24/7 mode stays connected when idle', async () => {
  const { music, player } = setup();
  const queue = await start(music, ['a']);
  queue.stay = true;
  player.finish(); await tick();
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(music.get('g'), queue);
});
