const handlers = require('./handlers');

function register(client) {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const handler = handlers[interaction.commandName];
    if (!handler) return;

    try {
      await handler(interaction);
    } catch (err) {
      console.error(`Error handling /${interaction.commandName}:`, err);
      const payload = { content: 'Something broke on that one. Try again?', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        interaction.followUp(payload).catch(() => {});
      } else {
        interaction.reply(payload).catch(() => {});
      }
    }
  });
}

module.exports = { register };
