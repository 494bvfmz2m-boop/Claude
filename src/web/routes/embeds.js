const express = require('express');
const { EmbedBuilder } = require('discord.js');
const { EmbedTemplates } = require('../../db/repo');
const { getGuildOr404, guildChannelOptions } = require('../lib/getGuild');
const { requireArea } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(requireArea('embeds'));

function embedDataFromBody(body) {
  const names = [].concat(body.fieldName || []);
  const values = [].concat(body.fieldValue || []);
  const inlines = [].concat(body.fieldInline || []);
  const fields = names
    .map((name, i) => ({ name: (name || '').trim(), value: (values[i] || '').trim(), inline: inlines[i] === 'true' }))
    .filter((f) => f.name && f.value);

  return {
    title: (body.title || '').trim(),
    description: (body.description || '').trim(),
    color: body.color || '#5865F2',
    url: (body.url || '').trim(),
    authorName: (body.authorName || '').trim(),
    authorIconUrl: (body.authorIconUrl || '').trim(),
    footerText: (body.footerText || '').trim(),
    footerIconUrl: (body.footerIconUrl || '').trim(),
    thumbnailUrl: (body.thumbnailUrl || '').trim(),
    imageUrl: (body.imageUrl || '').trim(),
    fields,
  };
}

function buildDiscordEmbed(data) {
  const embed = new EmbedBuilder().setColor(data.color || '#5865F2');
  if (data.title) embed.setTitle(data.title.slice(0, 256));
  if (data.description) embed.setDescription(data.description.slice(0, 4096));
  if (data.url) embed.setURL(data.url);
  if (data.authorName) embed.setAuthor({ name: data.authorName.slice(0, 256), iconURL: data.authorIconUrl || undefined });
  if (data.footerText) embed.setFooter({ text: data.footerText.slice(0, 2048), iconURL: data.footerIconUrl || undefined });
  if (data.thumbnailUrl) embed.setThumbnail(data.thumbnailUrl);
  if (data.imageUrl) embed.setImage(data.imageUrl);
  if (data.fields?.length) embed.addFields(data.fields.slice(0, 25));
  return embed;
}

router.get('/embeds', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const templates = EmbedTemplates.listForGuild(guild.id);
  let loaded = null;
  if (req.query.load) {
    const t = EmbedTemplates.get(req.query.load);
    if (t && t.guild_id === guild.id) loaded = t;
  }
  res.render('embeds', { guild, templates, loaded, options: guildChannelOptions(guild) });
});

router.post('/embeds/save', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const data = embedDataFromBody(req.body);
  const name = (req.body.templateName || 'Untitled').trim();

  if (req.body.templateId) {
    const existing = EmbedTemplates.get(req.body.templateId);
    if (existing && existing.guild_id === guild.id) {
      EmbedTemplates.update(req.body.templateId, name, data);
      return res.redirect(`/dashboard/${guild.id}/embeds?load=${req.body.templateId}`);
    }
  }
  const id = EmbedTemplates.create(guild.id, name, data);
  res.redirect(`/dashboard/${guild.id}/embeds?load=${id}`);
});

router.post('/embeds/send', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const channelId = req.body.channelId;
  const channel = channelId ? await guild.channels.fetch(channelId).catch(() => null) : null;
  if (!channel || !channel.isTextBased()) {
    return res.status(400).render('error', { message: 'Pick a valid text channel to send the embed to.' });
  }

  const data = embedDataFromBody(req.body);
  const embed = buildDiscordEmbed(data);

  try {
    await channel.send({ content: (req.body.messageContent || '').trim() || undefined, embeds: [embed] });
  } catch (err) {
    return res.status(500).render('error', { message: `Failed to send: ${err.message}` });
  }

  res.redirect(`/dashboard/${guild.id}/embeds`);
});

router.post('/embeds/:id/delete', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const t = EmbedTemplates.get(req.params.id);
  if (t && t.guild_id === guild.id) EmbedTemplates.delete(req.params.id);
  res.redirect(`/dashboard/${guild.id}/embeds`);
});

module.exports = router;
