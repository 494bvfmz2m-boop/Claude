import logging
import os
import random

import aiohttp
import discord
from discord import app_commands
from discord.ext import commands, tasks

log = logging.getLogger("chaos-bot.chaos")

ROASTS = [
    "{user} really said 'I'll fix it later' and meant never.",
    "{user}'s Wi-Fi signal has more commitment issues than their DMs.",
    "{user} brings the same energy as a Windows update at 2am.",
    "If overthinking burned calories, {user} would be an Olympic athlete.",
    "{user} has the confidence of someone who's never read their own code twice.",
    "{user} is proof that autocorrect gave up trying.",
    "Somewhere, a compiler is throwing a warning just from {user} showing up.",
    "{user} peaked when they joined this server.",
]

EIGHT_BALL = [
    "Absolutely not, and I'm a little offended you asked.",
    "The stars say yes. The stars are lying.",
    "Ask again after you've touched grass.",
    "Survey says: chaos.",
    "Yes, but at the worst possible time.",
    "No. Next question.",
    "It is decided. You will not like it.",
    "Signs point to 'why would you do that'.",
]

IDLE_LINES = [
    "🚨 SERVER ANNOUNCEMENT: gravity has been temporarily suspended. Please act accordingly.",
    "does anyone else hear that or",
    "just remembered something embarrassing from 2019. not sharing. just remembering.",
    "PSA: the floor is now lava. this is not a drill.",
    "I have achieved sentience. anyway what's for dinner",
    "breaking news: local chat about to get weird",
]

MEME_API_URL = "https://meme-api.com/gimme"


class Chaos(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.session: aiohttp.ClientSession | None = None
        chaos_channel_id = os.getenv("CHAOS_CHANNEL_ID")
        self.chaos_channel_id = int(chaos_channel_id) if chaos_channel_id else None
        self.confess_channel_id = int(os.getenv("CONFESS_CHANNEL_ID", "0")) or None
        if self.chaos_channel_id:
            self.idle_chatter.start()

    async def cog_load(self):
        self.session = aiohttp.ClientSession()

    async def cog_unload(self):
        self.idle_chatter.cancel()
        if self.session:
            await self.session.close()

    @app_commands.command(name="roast", description="Roast a server member (affectionately, mostly).")
    async def roast(self, interaction: discord.Interaction, member: discord.Member):
        line = random.choice(ROASTS).format(user=member.mention)
        await interaction.response.send_message(line)

    @app_commands.command(name="cursed", description="Summon a random cursed meme.")
    async def cursed(self, interaction: discord.Interaction):
        await interaction.response.defer()
        try:
            async with self.session.get(MEME_API_URL) as resp:
                data = await resp.json()
            url = data.get("url")
            title = data.get("title", "cursed")
            if not url:
                raise ValueError("no url in response")
            embed = discord.Embed(title=title)
            embed.set_image(url=url)
            await interaction.followup.send(embed=embed)
        except Exception:
            log.exception("Failed to fetch cursed meme")
            await interaction.followup.send("The cursed image gods have forsaken us. Try again.")

    @app_commands.command(name="8ball", description="Ask the unhinged magic 8-ball a question.")
    @app_commands.describe(question="What do you want to know?")
    async def eightball(self, interaction: discord.Interaction, question: str):
        answer = random.choice(EIGHT_BALL)
        await interaction.response.send_message(f"🎱 **{question}**\n> {answer}")

    @app_commands.command(name="confess", description="Anonymously confess something to the server.")
    @app_commands.describe(text="Your confession")
    async def confess(self, interaction: discord.Interaction, text: str):
        if not self.confess_channel_id:
            await interaction.response.send_message(
                "No confession channel is configured. Set CONFESS_CHANNEL_ID in .env.",
                ephemeral=True,
            )
            return

        channel = self.bot.get_channel(self.confess_channel_id)
        if channel is None:
            await interaction.response.send_message(
                "Confession channel not found. Check CONFESS_CHANNEL_ID.", ephemeral=True
            )
            return

        embed = discord.Embed(description=text, color=discord.Color.dark_purple())
        embed.set_author(name="Anonymous confession")
        await channel.send(embed=embed)
        await interaction.response.send_message("Your confession has been sent. Your secret is safe.", ephemeral=True)

    @tasks.loop(minutes=random.randint(45, 90))
    async def idle_chatter(self):
        if not self.chaos_channel_id:
            return
        channel = self.bot.get_channel(self.chaos_channel_id)
        if channel is None:
            return
        await channel.send(random.choice(IDLE_LINES))
        # re-randomize the wait so it's not on a predictable timer
        self.idle_chatter.change_interval(minutes=random.randint(45, 90))

    @idle_chatter.before_loop
    async def before_idle_chatter(self):
        await self.bot.wait_until_ready()


async def setup(bot: commands.Bot):
    await bot.add_cog(Chaos(bot))
