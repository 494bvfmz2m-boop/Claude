const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db, getGuildSettings } = require('../../database/db');
const { orderEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('order')
    .setDescription('Post an order notification embed.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) => o.setName('order_ref').setDescription('Order reference / ID').setRequired(true))
    .addStringOption((o) => o.setName('product').setDescription('Product / item ordered').setRequired(true))
    .addStringOption((o) => o.setName('customer').setDescription('Customer name or mention'))
    .addStringOption((o) => o.setName('amount').setDescription('Order amount, e.g. $25.00'))
    .addStringOption((o) => o.setName('status').setDescription('Order status').addChoices(
      { name: 'Received', value: 'received' },
      { name: 'Paid', value: 'paid' },
      { name: 'Fulfilled', value: 'fulfilled' },
      { name: 'Cancelled', value: 'cancelled' },
      { name: 'Refunded', value: 'refunded' },
    )),

  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    if (!settings.order_channel_id) {
      return interaction.reply({ content: 'Set an order channel first with `/config orders`.', ephemeral: true });
    }

    const orderRef = interaction.options.getString('order_ref', true);
    const product = interaction.options.getString('product', true);
    const customer = interaction.options.getString('customer') || interaction.user.tag;
    const amount = interaction.options.getString('amount') || 'N/A';
    const status = interaction.options.getString('status') || 'received';

    db.prepare('INSERT INTO orders (guild_id, order_ref, customer, product, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(interaction.guild.id, orderRef, customer, product, amount, status, Date.now());

    const channel = await interaction.guild.channels.fetch(settings.order_channel_id).catch(() => null);
    if (!channel?.isTextBased()) {
      return interaction.reply({ content: 'The configured order channel is invalid.', ephemeral: true });
    }
    await channel.send({ embeds: [orderEmbed({ orderRef, customer, product, amount, status })] });
    await interaction.reply({ content: `Order embed posted in ${channel}.`, ephemeral: true });
  },
};
