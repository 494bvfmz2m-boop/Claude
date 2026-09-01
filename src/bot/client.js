const { Client } = require('discord.js');
const { CLIENT_OPTIONS } = require('./clientOptions');

const client = new Client(CLIENT_OPTIONS);

module.exports = client;
