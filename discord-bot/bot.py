import discord
from discord.ext import commands
from discord import app_commands
import requests
import os
import secrets

ALLOWED_USER_IDS = [1300548891611234356, 841749813702688858]
SEND_INBOX_USER_IDS = [841749813702688858, 1300548891611234356, 617174993242947585, 921959442080215071, 1303366956438523917]
SITE_URL = os.getenv('SITE_URL', 'https://rebootcord.world').rstrip('/')
DISCORD_TOKEN = os.getenv('DISCORD_BOT_TOKEN')
REBOOTCORD_API_KEY = os.getenv('REBOOTCORD_API_KEY')

if not DISCORD_TOKEN:
    raise SystemExit('DISCORD_BOT_TOKEN environment variable is not set.')
if not REBOOTCORD_API_KEY:
    raise SystemExit('REBOOTCORD_API_KEY environment variable is not set. Generate one from an admin account on the site dashboard and set it before starting the bot.')

API_HEADERS = {'Authorization': REBOOTCORD_API_KEY}

intents = discord.Intents.default()
intents.message_content = True
intents.dm_messages = True
intents.guilds = True

bot = commands.Bot(command_prefix='$', intents=intents)


def generate_code():
    part1 = secrets.token_hex(3)[:5]
    part2 = secrets.token_hex(4)[:7]
    return f"rebootcord-{part1}-{part2}"


async def request_code_for(username):
    code = generate_code()
    response = requests.post(
        f'{SITE_URL}/api/createcode',
        json={'code': code, 'user': username},
        headers=API_HEADERS,
        timeout=10
    )
    if response.status_code != 200:
        return None, f'Site returned {response.status_code}: {response.text[:200]}'
    data = response.json()
    if not data.get('success'):
        return None, data.get('message', 'Unknown error')
    return code, None


@bot.event
async def on_ready():
    print(f'Logged in as {bot.user.name}')
    try:
        synced = await bot.tree.sync()
        print(f'Synced {len(synced)} command(s)')
    except Exception as e:
        print(f'Error syncing commands: {e}')


@bot.tree.command(name='createcode', description='Generate an invite code for a user')
async def createcode_slash(interaction: discord.Interaction, user: discord.User):
    if interaction.user.id not in ALLOWED_USER_IDS:
        await interaction.response.send_message('You do not have permission to use this command.', ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)
    code, error = await request_code_for(user.name)
    if error:
        print(f'/createcode failed for {user.name}: {error}')
        await interaction.followup.send('Failed to generate code. Please try again.', ephemeral=True)
        return

    try:
        embed = discord.Embed(
            title='Your Reboot Cord Invite Code',
            description=f'Code: `{code}`\n\nThis code is bound to your Discord username: **{user.name}**\n\nUse this code to register at: {SITE_URL}',
            color=0xe63946
        )
        await user.send(embed=embed)
        await interaction.followup.send(f'Code sent to {user.name}', ephemeral=True)
    except discord.Forbidden:
        await interaction.followup.send(f'Generated code: `{code}`\nCould not DM user (they may have DMs disabled). The code is bound to {user.name}', ephemeral=True)


@bot.command(name='createcode')
async def createcode_prefix(ctx, user: discord.User):
    if ctx.author.id not in ALLOWED_USER_IDS:
        return

    code, error = await request_code_for(user.name)
    if error:
        print(f'$createcode failed for {user.name}: {error}')
        await ctx.send('Failed to generate code. Please try again.')
        return

    try:
        embed = discord.Embed(
            title='Your Reboot Cord Invite Code',
            description=f'Code: `{code}`\n\nThis code is bound to your Discord username: **{user.name}**\n\nUse this code to register at: {SITE_URL}',
            color=0xe63946
        )
        await user.send(embed=embed)
        await ctx.send(f'Code sent to {user.name}')
    except discord.Forbidden:
        await ctx.send(f'Generated code: `{code}`\nCould not DM user (they may have DMs disabled). The code is bound to {user.name}')


class InboxModal(discord.ui.Modal, title='Send Inbox Message'):
    message_input = discord.ui.TextInput(
        label='send your message here',
        style=discord.TextStyle.paragraph,
        required=True,
        max_length=1000
    )

    async def on_submit(self, interaction: discord.Interaction):
        sender = interaction.user.display_name
        try:
            response = requests.post(
                f'{SITE_URL}/api/inbox/discord',
                json={'message': str(self.message_input.value), 'sender': sender},
                headers=API_HEADERS,
                timeout=10
            )
        except requests.RequestException:
            await interaction.response.send_message('Failed to send message. Please try again.', ephemeral=True)
            return
        if response.status_code != 200 or not response.json().get('success'):
            await interaction.response.send_message('Failed to send message. Please try again.', ephemeral=True)
            return
        await interaction.response.send_message('Message sent to the inbox.', ephemeral=True)


@bot.tree.command(name='users', description='check created registared verified accounts. In the website.')
async def users(interaction: discord.Interaction):
    try:
        response = requests.get(f'{SITE_URL}/api/users', timeout=10)
        response.raise_for_status()
        data = response.json()
    except requests.RequestException:
        await interaction.response.send_message('Failed to fetch registered users.', ephemeral=True)
        return

    usernames = data.get('users', [])
    count = data.get('count', len(usernames))
    if usernames:
        description = '\n'.join(f'{i + 1}. {name}' for i, name in enumerate(usernames))
    else:
        description = 'No registered users found.'

    embed = discord.Embed(
        title='Registered Reboot Cord Users',
        description=description,
        color=0xe63946
    )
    embed.set_footer(text=f'{count} total registered user(s)')
    await interaction.response.send_message(embed=embed)


@bot.tree.command(name='send-inbox', description="staff's uses this command to send inbox messages. To the inbox system page.")
async def send_inbox(interaction: discord.Interaction):
    if interaction.user.id not in SEND_INBOX_USER_IDS:
        await interaction.response.send_message('You do NOT have permission to run that command.', ephemeral=True)
        return
    await interaction.response.send_modal(InboxModal())


bot.run(DISCORD_TOKEN)
