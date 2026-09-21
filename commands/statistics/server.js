const {
    SlashCommandBuilder,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    InteractionContextType,
} = require("discord.js");

const { formatNumber } = require('../../helpers/formatters');
const { fetchCached } = require('../../helpers/fetch');
const { getEmoji } = require('../../helpers/emojis');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('server-stats')
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .setDescription('Gets the general statistics of TETR.IO servers.'),
    async execute(interaction) {
        const stats = await fetchCached('https://ch.tetr.io/api/general/stats');

        if (!stats.success) {
            return await interaction.reply({
                content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                flags: MessageFlags.Ephemeral
            });
        }

        const data = stats.data;

        const apiCreationTimestamp = 1598576400000;
        const now = Date.now();

        const gamesPlayedOverTime = (data.gamesplayed / ((now - apiCreationTimestamp) / 1000))

        // massive wall of embed but luckily everything is just a number
        const container = new ContainerBuilder()
            .setAccentColor(0x81ff7d)
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(`### __TETR.IO -> Server Statistics__`),
                new TextDisplayBuilder()
                    .setContent(`${getEmoji("top")}Total of **${formatNumber(data.usercount)} Players**
${getEmoji("mid")}${formatNumber(data.usercount - data.anoncount)} are registered (*${formatNumber(100 * (data.usercount - data.anoncount) / data.usercount, 2)}%*)
${getEmoji("mid")}${formatNumber(data.rankedcount)} are ranked (*${formatNumber(100 * data.rankedcount / data.totalaccounts, 2)}% of total, ${formatNumber(100 * data.rankedcount / (data.usercount - data.anoncount), 2)}% of registered*)
${getEmoji("mid")}${formatNumber(data.anoncount)} are anonymous (*${formatNumber(100 * data.anoncount / data.usercount, 2)}%*)`),
                new TextDisplayBuilder()
                    .setContent(`${getEmoji("top")}**${formatNumber(data.gamesplayed)} Games** played
${getEmoji("mid")}${formatNumber(data.gamesfinished)} were finished (*${formatNumber(100 * data.gamesfinished / data.gamesplayed, 2)}%*)
${getEmoji("mid")}${formatNumber(data.recordcount)} were saved as replays (*${formatNumber(100 * data.recordcount / data.gamesplayed, 2)}%*)
${getEmoji("mid")}A total of ${formatNumber(data.gamesplayed_delta, 1)} games per second
${getEmoji("mid")}Or ${formatNumber(gamesPlayedOverTime * 60 * 60, 2)} games per hour`),
                new TextDisplayBuilder()
                    .setContent(`${getEmoji("top")}**${formatNumber(secondsToDays(data.gametime), 1)} Days** of playtime
${getEmoji("mid")}Or ${formatNumber(data.gametime)} seconds
${getEmoji("mid")}Or ${formatNumber(secondsToYears(data.gametime), 2)} years`),
                new TextDisplayBuilder()
                    .setContent(`${getEmoji("top")}**${formatNumber(data.piecesplaced)} Pieces** placed
${getEmoji("mid")}${formatNumber(data.piecesplaced / data.gametime, 2)} pieces per second on average
${getEmoji("mid")}${formatNumber(data.inputs)} Inputs (${formatNumber(data.inputs / data.piecesplaced, 3)} per piece)
${getEmoji("mid")}${formatNumber(data.inputs / data.gametime, 3)} inputs per second on average`),
            );
    
        await interaction.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [container],
        });

    },
};

//these are very important functions yes
function secondsToDays(seconds) {
    const secondsPerDay = 24 * 60 * 60; // 86,400 seconds in a day
    return seconds / secondsPerDay;
}

function secondsToYears(seconds) {
    const secondsPerYear = 365.25 * 24 * 60 * 60; // Approx. 31,557,600 seconds in a year
    return seconds / secondsPerYear;
}