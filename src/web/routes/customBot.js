const express = require('express');
const config = require('../../config');
const { CustomBots } = require('../../db/repo');
const { getGuildOr404 } = require('../lib/getGuild');
const { requirePremiumFeature } = require('../lib/subscriptionGate');
const { isConfigured, encrypt, decrypt } = require('../lib/tokenCrypto');
const { buildCustomBotInviteUrl } = require('../lib/discordOAuth');
const { startCustomBot, stopCustomBot, fetchApplicationInfo } = require('../../bot/customBots');

const router = express.Router({ mergeParams: true });
router.use(requirePremiumFeature('custom_bot'));

function redirectUriFor(guildId) {
  if (!config.dashboardUrl) return null;
  return `${config.dashboardUrl.replace(/\/+$/, '')}/dashboard/${guildId}/custom-bot/callback`;
}

function notice(req) {
  return req.query.msg ? { ok: req.query.ok === '1', text: req.query.msg } : null;
}

function redirectWithNotice(res, guildId, ok, text) {
  const qs = new URLSearchParams({ ok: ok ? '1' : '0', msg: text });
  res.redirect(`/dashboard/${guildId}/custom-bot?${qs.toString()}`);
}

router.get('/custom-bot', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const record = CustomBots.get(guild.id);
  const redirectUri = redirectUriFor(guild.id);
  const inviteUrl = (record?.application_id && redirectUri)
    ? buildCustomBotInviteUrl(record.application_id, guild.id, redirectUri)
    : null;
  res.render('customBot', {
    guild,
    record,
    tokenCryptoConfigured: isConfigured(),
    redirectUri,
    inviteUrl,
    notice: notice(req),
  });
});

// Step 1: validate + store the token. Only a REST call (no gateway login
// yet) -- gets the application ID an invite link needs and confirms the
// token is real, without opening a websocket connection before the bot
// has even been invited anywhere.
router.post('/custom-bot/token', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  if (!isConfigured()) {
    return redirectWithNotice(res, guild.id, false, 'Custom bots aren\'t set up on this install yet -- ask the owner to set TOKEN_ENCRYPTION_KEY and restart.');
  }
  const token = (req.body.token || '').trim();
  if (!token) return redirectWithNotice(res, guild.id, false, 'Paste your bot token.');

  let appInfo;
  try {
    appInfo = await fetchApplicationInfo(token);
  } catch (err) {
    return redirectWithNotice(res, guild.id, false, err.message);
  }

  CustomBots.upsert(guild.id, req.session.discordUser.id, encrypt(token));
  CustomBots.setIdentity(guild.id, {
    applicationId: appInfo.id,
    botUsername: appInfo.bot?.username || appInfo.name,
    botAvatar: appInfo.bot?.icon ? `https://cdn.discordapp.com/avatars/${appInfo.bot.id}/${appInfo.bot.icon}.png` : null,
  });
  return redirectWithNotice(res, guild.id, true, 'Token saved. Invite the bot below, then it connects automatically.');
});

// Step 2: Discord sends the browser here after the invite completes.
// There's no code exchange to do for a plain bot invite -- guild_id in the
// query confirms which server it was for, and connecting for real (the
// actual proof it worked) happens right here.
router.get('/custom-bot/callback', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const record = CustomBots.get(guild.id);
  if (!record) return redirectWithNotice(res, guild.id, false, 'No token on file -- upload one first.');

  const token = decrypt(record.encrypted_token);
  if (!token) return redirectWithNotice(res, guild.id, false, 'Stored token could not be read -- re-upload it.');

  try {
    const result = await startCustomBot(guild.id, token);
    return redirectWithNotice(res, guild.id, true, `Connected as ${result.botTag} -- it's live.`);
  } catch (err) {
    CustomBots.setError(guild.id, err.message);
    return redirectWithNotice(res, guild.id, false, err.message);
  }
});

// A retry button for "pending"/"error" without re-inviting -- covers a
// transient failure (Discord hiccup, the process restarting mid-connect).
router.post('/custom-bot/reconnect', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const record = CustomBots.get(guild.id);
  if (!record) return redirectWithNotice(res, guild.id, false, 'No token on file -- upload one first.');
  const token = decrypt(record.encrypted_token);
  if (!token) return redirectWithNotice(res, guild.id, false, 'Stored token could not be read -- re-upload it.');
  try {
    const result = await startCustomBot(guild.id, token);
    return redirectWithNotice(res, guild.id, true, `Connected as ${result.botTag}.`);
  } catch (err) {
    CustomBots.setError(guild.id, err.message);
    return redirectWithNotice(res, guild.id, false, err.message);
  }
});

router.post('/custom-bot/remove', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  await stopCustomBot(guild.id);
  CustomBots.remove(guild.id);
  return redirectWithNotice(res, guild.id, true, 'Custom bot removed -- this server is back on the shared bot.');
});

module.exports = router;
