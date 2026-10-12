import { Client, Events, GatewayIntentBits } from 'discord.js';
import { loadCommands } from './commands.js';
import { config } from './config.js';
import { MusicManager } from './music/MusicManager.js';
import { controlRow, infoEmbed, nowPlayingEmbed } from './music/ui.js';
import { getControllableQueue, replyError } from './util/guards.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
client.commands = await loadCommands();
client.music = new MusicManager(client);

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag} — ${c.guilds.cache.size} servers, ${client.commands.size} commands`);
  c.user.setActivity('/play');
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.inGuild()) return;
  try {
    if (interaction.isAutocomplete()) {
      await client.commands.get(interaction.commandName)?.autocomplete?.(interaction);
    } else if (interaction.isChatInputCommand()) {
      await client.commands.get(interaction.commandName)?.execute(interaction);
    } else if (interaction.isButton() && interaction.customId.startsWith('music:')) {
      await handleButton(interaction);
    }
  } catch (error) {
    console.error(`[interaction] ${interaction.commandName ?? interaction.customId}:`, error);
    if (interaction.isRepliable()) await replyError(interaction, 'Something went wrong.').catch(() => {});
  }
});

async function handleButton(interaction) {
  const queue = await getControllableQueue(interaction, { playing: true });
  if (!queue) return;
  const { music } = client;
  const by = `by <@${interaction.user.id}>`;

  switch (interaction.customId) {
    case 'music:pause':
      await queue.player.setPaused(!queue.player.paused);
      return interaction.update({ embeds: [nowPlayingEmbed(queue)], components: [controlRow(queue)] });
    case 'music:skip':
      await interaction.reply({ embeds: [infoEmbed(`⏭️ Skipped ${by}`)] });
      return music.skip(queue);
    case 'music:previous':
      if (!(await music.previous(queue))) return replyError(interaction, 'There is no previous song.');
      return interaction.reply({ embeds: [infoEmbed(`⏮️ Previous song ${by}`)] });
    case 'music:loop':
      queue.loop = { off: 'queue', queue: 'track', track: 'off' }[queue.loop];
      return interaction.update({ embeds: [nowPlayingEmbed(queue)], components: [controlRow(queue)] });
    case 'music:stop':
      await interaction.reply({ embeds: [infoEmbed(`⏹️ Stopped ${by}`)] });
      return music.stop(queue);
  }
}

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  const queue = client.music.get(newState.guild.id);
  if (!queue) return;

  // The bot itself was moved (follow it) or disconnected by someone (clean up).
  if (newState.id === client.user.id) {
    if (newState.channelId) queue.voiceChannelId = newState.channelId;
    else client.music.destroy(newState.guild.id);
    return;
  }

  // Someone joined or left the bot's channel: decide whether to stay.
  if (oldState.channelId !== queue.voiceChannelId && newState.channelId !== queue.voiceChannelId) return;
  const channel = newState.guild.channels.cache.get(queue.voiceChannelId);
  const humans = channel?.members.filter((m) => !m.user.bot).size ?? 0;
  client.music.handleChannelOccupancy(queue, humans);
});

process.on('unhandledRejection', (error) => console.error('[unhandledRejection]', error));

await client.login(config.token);
