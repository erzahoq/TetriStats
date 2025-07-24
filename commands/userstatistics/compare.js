const { SlashCommandBuilder, EmbedBuilder, InteractionContextType, ApplicationIntegrationType } = require('discord.js');

const { formatNumber, escapeUnderscores, countryCodeToEmoji, playtimeConvert, getEmojiOfRank, calculateLevel } = require('../../helpers/functions');

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

        const user1 = interaction.options.getString('user1').toLowerCase();
        const user2 = interaction.options.getString('user2').toLowerCase();

        let userStats1;
        let userStats2;

        let response = null;

        let summary = null;

        const discordRegex = new RegExp('<@[0-9]+>');

        //calls api 8 times in the worst case sceneario
        //thats probably bad
        
        //user one
        if (discordRegex.test(user1)) {
            mention = user1.slice(2, -1);

            if (mention.startsWith('!')) {
                mention = mention.slice(1);
            }

            const user = interaction.client.users.cache.get(mention);
            if (!user) {
                return await interaction.editReply({
                    content: 'User 1 could not be found on Discord!',
                    ephemeral: true
                });
            }

            response = await fetch(`https://ch.tetr.io/api/users/search/discord:${user.id}`);
            let stats = await response.json();

            if (!stats.data) {
                return await interaction.editReply({
                    content: 'User 1 has not linked a TETR.IO account!',
                    ephemeral: true
                });
            }
            
            response = await fetch(`https://ch.tetr.io/api/users/${stats.data.user._id}`);

            userStats1 = await response.json();

            if (!userStats1.success) { // not sure if this one can even happen but um, just in case :SILENCE:
                if (userStats1.error.msg === "No such user! | Either you mistyped something, or the account no longer exists.") {
                    return await interaction.editReply({
                        content: 'Could not find user 1! Either you mistyped something, or this user no longer exists.',
                        ephemeral: true
                    });
                } else {
                    return await interaction.editReply({
                        content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                        ephemeral: true
                    });
                }
            }

        } else {
            response = await fetch(`https://ch.tetr.io/api/users/${user1}`);

            userStats1 = await response.json();

            if (!userStats1.success) {
                if (userStats1.error.msg === "No such user! | Either you mistyped something, or the account no longer exists.") {
                    return await interaction.editReply({
                        content: 'Could not find user 1! Either you mistyped something, or this user no longer exists.',
                        ephemeral: true
                    });
                } else {
                    return await interaction.editReply({
                        content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                        ephemeral: true
                    });
                }
            }
        }

        //user two
        if (discordRegex.test(user2)) {
            mention = user2.slice(2, -1);

            if (mention.startsWith('!')) {
                mention = mention.slice(1);
            }

            const user = interaction.client.users.cache.get(mention);
            if (!user) {
                return await interaction.editReply({
                    content: 'User 2 could not be found on Discord!',
                });
            }

            response = await fetch(`https://ch.tetr.io/api/users/search/discord:${user.id}`);
            let stats = await response.json();

            if (!stats.data) {
                return await interaction.editReply({
                    content: 'User 2 has not linked a TETR.IO account!',
                });
            }
            
            response = await fetch(`https://ch.tetr.io/api/users/${stats.data.user._id}`);

            userStats2 = await response.json();

            if (!userStats2.success) { // not sure if this one can even happen but um, just in case :SILENCE:
                if (userStats2.error.msg === "No such user! | Either you mistyped something, or the account no longer exists.") {
                    return await interaction.editReply({
                        content: 'Could not find user 2! Either you mistyped something, or this user no longer exists.',
                    });
                } else {
                    return await interaction.editReply({
                        content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                    });
                }
            }

        } else {
            response = await fetch(`https://ch.tetr.io/api/users/${user2}`);

            userStats2 = await response.json();

            if (!userStats2.success) {
                if (userStats2.error.msg === "No such user! | Either you mistyped something, or the account no longer exists.") {
                    return await interaction.editReply({
                        content: 'Could not find user 2! Either you mistyped something, or this user no longer exists.',
                    });
                } else {
                    return await interaction.editReply({
                        content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                    });
                }
            }
        }

        userStats1 = userStats1.data;
        userStats2 = userStats2.data;

        console.log(userStats1)

        let userSummary1 = await fetch(`https://ch.tetr.io/api/users/${userStats1._id}/summaries`);
        let userSummary2 = await fetch(`https://ch.tetr.io/api/users/${userStats2._id}/summaries`);

        //im not smart enough to make this better
        userSummary1 = await userSummary1.json();
        userSummary2 = await userSummary2.json();
        userSummary1 = userSummary1.data;
        userSummary2 = userSummary2.data;
        
        // Create the embed
        // thanks chatgpt 4.5 very cool
        const comparisonEmbed = new EmbedBuilder()
            .setColor('#5865F2') // Discord blurple is visually pleasing
            .setTitle(`📊 ${escapeUnderscores(userStats1.username.toUpperCase())} vs ${escapeUnderscores(userStats2.username.toUpperCase())}`)
            .setDescription(`Comparison of TETR.IO statistics between **${userStats1.username.toUpperCase()}** ${getEmojiOfRank(userSummary1.league.rank)} and **${userStats2.username.toUpperCase()}** ${getEmojiOfRank(userSummary2.league.rank)}.`)
            .setThumbnail('https://tetr.io/res/logo/logo-light.svg') // Add TETR.IO logo
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
                ${countryCodeToEmoji(userStats1.country) || '🌐'}
                ${userStats1.gamesplayed===-1?"N/A":formatNumber(userStats1.gamesplayed)}
                ${userStats1.gameswon===-1?"N/A":`${formatNumber(userStats1.gameswon)} (${(userStats1.gameswon / userStats1.gamesplayed * 100).toFixed(2)/*this is extremely scuffed but i dont care */}%)`}
                ${playtimeConvert(userStats1.gametime)}
                ${formatNumber(Math.floor(calculateLevel(userStats1.xp)))}
                ${formatNumber(userStats1.ar)} AR
                ${getEmojiOfRank(userSummary1.league.rank)}
                ${calculateTR(userSummary1.league.tr)} TR
                ${(userSummary1.league.pps || 0).toFixed(2)} PPS
                ${(userSummary1.league.apm || 0).toFixed(2)} APM`, inline: true },

                { name: `${escapeUnderscores(userStats2.username.toUpperCase())}`, value: `
                ${countryCodeToEmoji(userStats2.country) || '🌐'}
                ${userStats2.gamesplayed===-1?"N/A":formatNumber(userStats2.gamesplayed)}
                ${userStats2.gameswon===-1?"N/A":formatNumber(userStats2.gameswon)} (${(userStats2.gameswon / userStats2.gamesplayed * 100).toFixed(2)}%)
                ${playtimeConvert(userStats2.gametime)}
                ${formatNumber(Math.floor(calculateLevel(userStats2.xp)))}
                ${formatNumber(userStats2.ar)} AR
                ${getEmojiOfRank(userSummary2.league.rank)}
                ${calculateTR(userSummary2.league.tr)} TR
                ${(userSummary2.league.pps || 0).toFixed(2)} PPS
                ${(userSummary2.league.apm || 0).toFixed(2)} APM`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'TetriStats • Data from TETR.IO' });


interaction.editReply({ embeds: [comparisonEmbed] });

	},
};
 
function calculateTR(tr) {
    if (tr === -1) {
        return "N/A";
    } else {
        return formatNumber(Math.round(tr));
    }
}

