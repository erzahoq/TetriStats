const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
import('node-fetch'); // Ensure 'node-fetch' is imported properly

// Import helper functions for formatting and data processing
const { formatNumber, escapeUnderscores, countryCodeToEmoji, convertToTimeFormat, playtimeConvert, getEmojiOfAch, getEmojiOfRank, reformatTimestamp, calculateLevel } = require('../../helpers/functions');
const { getUser } = require('../../helpers/getuser');
const { getEmoji } = require('../../helpers/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('performance')
    .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
    .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
    .setDescription('Get information about the performance of a user via their TETR.IO (or Discord) username/ID.')
    .addStringOption((option) =>
      option
        .setName('user')
        .setDescription('the TETR.IO username / Discord to search for')
        .setRequired(true),
    ),

  async execute(interaction) {
    // Fetch user data from TETR.IO API using provided username/ID
    const user = await getUser(interaction.options.getString('user').toLowerCase()); // calls API only once

    // Handle user not found or server error cases
    if (user === 'no such user') {
      return await interaction.reply({
        content: 'No such user found on TETR.IO! Either the account no longer exists, or this person has not linked their Discord with TETR.IO.',
        flags: MessageFlags.Ephemeral,
      });
    } else if (user === 'server error') {
      return await interaction.reply({
        content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // grab league data to analyse performance
    // i kinda want to like, average all gamemodes for this data but i feel like that is unnecessary for now..? 
    // idk

    // oh actually what i could do is analyse performace for each gamemode, and have buttons to switch between them
    // but i dont wanna do that right now :3
    let response = await fetch(`https://ch.tetr.io/api/users/${user._id}/summaries/league`);
    let userStats = await response.json();

    userStats = userStats.data;

    if (userStats.gamesplayed === 0) {
            return await interaction.reply({ content: `This user has not played any Tetra League games!`, flags: MessageFlags.Ephemeral });
    }

    // fetch labs league data
    response = await fetch(`https://ch.tetr.io/api/labs/league_ranks`);
    let labsLeagueData = await response.json();

    // get rank data from the response
    let rankData = labsLeagueData.data.data;
    const totalUsers = rankData.total;
    // explodes u cutely
    delete rankData.total;

    // ok so i want more than just apm/pps/vs score to analyse, but for now this is fine just as a proof of concept
    let apm = userStats.apm;
    let pps = userStats.pps;
    let vsScore = userStats.vs;
    let rank = userStats.rank;
    let tr = userStats.tr;

    // surely theres a better way to do this
    let apmRank = 'd';
    for (const [rank, data] of Object.entries(rankData)) {
        if (apm >= data.apm) {
            apmRank = rank;
            break;
        }
    }

    let ppsRank = 'd';
    for (const [rank, data] of Object.entries(rankData)) {
        if (pps >= data.pps) {
            ppsRank = rank;
            break;
        }
    }

    let vsScoreRank = 'd';
    for (const [rank, data] of Object.entries(rankData)) {
        if (vsScore >= data.vs) {
            vsScoreRank = rank;
            break;
        }
    }


    const ratingColours = {
                "z": "#7d7d7d",
                "d": "#846b83",
                "d+": "#8a5d8b",
                "c-": "#755188",
                "c": "#733e8f", 
                "c+": "#562a89",
                "b-": "#5550c5",
                "b": "#4f65cb",
                "b+": "#4e99c0",
                "a-": "#45ca7f",
                "a": "#6bcb55",
                "a+": "#4fca18",
                "s-": "#c8b82d",
                "s": "#e8b215",
                "s+": "#ffec0e",
                "ss": "#feaf1b",
                "u": "#ff2713",
                "x": "#fd73fc",
                "x+": "#f018d0"
    }

    const embed = new EmbedBuilder()
      .setColor(ratingColours[rank] || '#ff8c57')
      .setDescription(tr < 0 ? `## Unranked ${getEmojiOfRank('z')}` : `## Ranked ${getEmojiOfRank(rank)}`)
      .setThumbnail(`https://tetr.io/user-content/avatars/${user._id}.jpg`)
      .setURL(`https://tetr.io/u/${user.username}`)
      .addFields(
        { name: 'APM', value: `${formatNumber(apm)} APM (${getEmojiOfRank(apmRank)})`, inline: true },
        { name: 'PPS', value: `${formatNumber(pps)} PPS (${getEmojiOfRank(ppsRank)})`, inline: true },
        { name: 'VS Score', value: `${formatNumber(vsScore)} (${getEmojiOfRank(vsScoreRank)})`, inline: true },
      )
      .setTimestamp()

    await interaction.reply({ embeds: [embed] });
  },
};

