/*const {
    SlashCommandBuilder,
    MessageFlags,
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    InteractionContextType,
    ApplicationIntegrationType,
    SeparatorBuilder,
} = require("discord.js");

const { formatNumber, escapeUnderscores, countryCodeToEmoji, formatLongTime, getEmojiOfRank, calculateLevel, formatUsername } = require('../../helpers/formatters');
const { getUser } = require('../../helpers/getuser')
const { fetchCached } = require('../../helpers/fetch');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('compare')
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
        .setDescription('Compare two users\' statistics on TETR.IO.')
        .addStringOption((option) =>
            option
                .setName('user1')
                .setDescription('the username/ID to search for')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('user2')
                .setDescription('the username/ID to search for')
                .setRequired(true),
        ),
    async execute(interaction) {
        await interaction.deferReply() // but here's the thinker

        const user1 = await getUser(interaction.options.getString('user1').toLowerCase())
        const user2 = await getUser(interaction.options.getString('user2').toLowerCase())

        if (user1 === "no such user") {
            return await interaction.reply({
                content: 'User 1 not found on TETR.IO! Either the account no longer exists, or this person has not linked their Discord with TETR.IO.',
                flags: MessageFlags.Ephemeral
            });
        } else if (user2 === "no such user") {
            return await interaction.reply({
                content: 'User 2 not found on TETR.IO! Either the account no longer exists, or this person has not linked their Discord with TETR.IO.',
                flags: MessageFlags.Ephemeral
            });
        } else if (user1 === "server error" || user2 === "server error") {
            return await interaction.reply({
                content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                flags: MessageFlags.Ephemeral
            });
        }

        let userStats1 = await fetchCached(`https://ch.tetr.io/api/users/${user1._id}`);
        let userStats2 = await fetchCached(`https://ch.tetr.io/api/users/${user2._id}`);

        userStats1 = userStats1.data;
        userStats2 = userStats2.data;

        let userSummary1 = await fetchCached(`https://ch.tetr.io/api/users/${userStats1._id}/summaries`);
        let userSummary2 = await fetchCached(`https://ch.tetr.io/api/users/${userStats2._id}/summaries`);

        //im not smart enough to make this better
        userSummary1 = userSummary1.data;
        userSummary2 = userSummary2.data;
        
        // Create the embed
        const comparisonEmbed = new EmbedBuilder()
            .setColor('#5865F2') 
            .setDescription(`### __Compare -> ${formatUsername(userStats1.username)} vs ${formatUsername(userStats2.username)}__`)
            .addFields(
                { name: 'Statistic', value: `
                **Country**
                **Games Played**
                **Wins (Win Rate)**
                **Playtime**
                **Level**
                **Achievement Rating**
                **Tetra League Rank**
                **Tetra Rating**
                **Pieces Per Second**
                **Attack Per Minute**`, inline: true },

                { name: `${escapeUnderscores(userStats1.username.toUpperCase())}`, value: `
                ${countryCodeToEmoji(userStats1.country) || '?'}
                ${userStats1.gamesplayed===-1?"N/A":formatNumber(userStats1.gamesplayed)}
                ${userStats1.gameswon===-1?"N/A":`${formatNumber(userStats1.gameswon)} (${formatNumber(userStats1.gameswon / userStats1.gamesplayed * 100, 2)}%)`}
                ${formatLongTime(userStats1.gametime, true)}
                ${formatNumber(Math.floor(calculateLevel(userStats1.xp)))}
                ${formatNumber(userStats1.ar)} AR
                ${getEmojiOfRank(userSummary1.league.rank)}
                ${calculateTR(userSummary1.league.tr)} TR
                ${formatNumber(userSummary1.league.pps, 2)} PPS
                ${formatNumber(userSummary1.league.apm, 2)} APM`, inline: true },

                { name: `${escapeUnderscores(userStats2.username.toUpperCase())}`, value: `
                ${countryCodeToEmoji(userStats2.country) || '?'}
                ${userStats2.gamesplayed===-1?"N/A":formatNumber(userStats2.gamesplayed)}
                ${userStats2.gameswon===-1?"N/A":formatNumber(userStats2.gameswon)} (${formatNumber(userStats2.gameswon / userStats2.gamesplayed * 100, 2)}%)
                ${formatLongTime(userStats2.gametime, true)}
                ${formatNumber(Math.floor(calculateLevel(userStats2.xp)))}
                ${formatNumber(userStats2.ar)} AR
                ${getEmojiOfRank(userSummary2.league.rank)}
                ${calculateTR(userSummary2.league.tr)} TR
                ${formatNumber(userSummary2.league.pps, 2)} PPS
                ${formatNumber(userSummary2.league.apm, 2)} APM`, inline: true }
            )
            .setTimestamp();


        interaction.editReply({ embeds: [comparisonEmbed] });

    },
};
 
function calculateTR(tr) {
    if (tr === -1) {
        return "N/A";
    } 
    return formatNumber(Math.round(tr));
    
}

*/