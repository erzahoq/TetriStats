const { SlashCommandBuilder, EmbedBuilder, InteractionContextType, ApplicationIntegrationType } = require('discord.js');

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
                    content: 'User 1 could not be found on discord!',
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
                    content: 'User 2 could not be found on discord!',
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
                🌐 **Country**
                🎮 **Games Played**
                🏆 **Wins (Win Rate)**
                ⏰ **Playtime**
                ⭐ **Level**
                🎖️ **Achievement Rating**
                📈 **Tetra League Rank**
                🔢 **Tetra Rating**
                ⚡ **Pieces Per Second**
                🔥 **Attack Per Minute**`, inline: true },

                { name: `${escapeUnderscores(userStats1.username.toUpperCase())}`, value: `
                ${countryCodeToEmoji(userStats1.country) || '🌐'}
                ${formatNumber(userStats1.gamesplayed)}
                ${formatNumber(userStats1.gameswon)} (${(userStats1.gameswon / userStats1.gamesplayed * 100).toFixed(2)}%)
                ${playtimeConvert(userStats1.gametime)}
                ${formatNumber(Math.floor(calculateLevel(userStats1.xp)))}
                ${formatNumber(userStats1.ar)} AR
                ${getEmojiOfRank(userSummary1.league.rank)}
                ${calculateTR(userSummary1.league.tr)} TR
                ${(userSummary1.league.pps || 0).toFixed(2)} PPS
                ${(userSummary1.league.apm || 0).toFixed(2)} APM`, inline: true },

                { name: `${escapeUnderscores(userStats2.username.toUpperCase())}`, value: `
                ${countryCodeToEmoji(userStats2.country) || '🌐'}
                ${formatNumber(userStats2.gamesplayed)}
                ${formatNumber(userStats2.gameswon)} (${(userStats2.gameswon / userStats2.gamesplayed * 100).toFixed(2)}%)
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

function escapeUnderscores(input) {
    const underscoreCount = (input.match(/_/g) || []).length;
    
    // Only escape if the count is a multiple of 2
    if (underscoreCount % 2 === 0 && underscoreCount > 0) {
        return input.replace(/_/g, '\\_');
    }
    
    return input;
}
 
function calculateTR(tr) {
    if (tr === -1) {
        return "N/A";
    } else {
        return formatNumber(Math.round(tr));
    }
}

function playtimeConvert(playtime) {
    if (playtime === 'Hidden') {
        return playtime;
    } 
    return `${Math.round(secondsToHours(playtime) * 10) / 10} Hours`
}

// hahaha its used twice hahahahahah
function secondsToHours(seconds) {
    const secondsPerHour = 60 * 60;
    return seconds / secondsPerHour;
}

function formatNumber(num) {
    const numStr = num.toString();
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// a magic formula stolen from somewhere online
function calculateLevel(xp) {
    return ((xp / 500) ** 0.6) + (xp / (5000 + ((Math.max(0, xp - (4 * 10 ** 6))) / 5000))) + 1
}

// Convert country code to flag emoji
function countryCodeToEmoji(countryCode) {
    if (countryCode === 'XM') return ("<:flag_xm:1310891739078328374>")
    const codePoints = countryCode
        .toUpperCase() // Make sure the code is uppercase
        .split('')     // Split the letters
        .map(char => 127397 + char.charCodeAt()); // Convert to regional indicator symbol

    return String.fromCodePoint(...codePoints);
}

function supporterConvert(supporter, supporterTier) {
    if (supporter) {
        let supporterString = '';

        for (let i = 1; i < supporterTier; i++) { // add stars because those exist
            supporterString = supporterString.concat(" <:supporter_star:1277300953111855231>")

        }
        return (`Supporter ${supporterString}\n`)
    } else {
        return ""
    }
}


function getEmojiOfRank(rank) {
    if (!rank) {
        return;
    }

    const rankEmojis = {
        "rank_xplus": "1277293685058310288",
        "rank_x": "1277293677873463368",
        "rank_u": "1277293667891286046",
        "rank_ss": "1277293658403770388",
        "rank_splus": "1277293647225819196",
        "rank_s": "1277293636928933888",
        "rank_sminus": "1277293624157278228",
        "rank_aplus": "1277293615114358997",
        "rank_a": "1277293607648231527",
        "rank_aminus": "1277293600438227106",
        "rank_bplus": "1277293592511250553",
        "rank_b": "1277293576895856751",
        "rank_bminus": "1277293566284267581",
        "rank_cplus": "1277293553147449505",
        "rank_c": "1277293540547756115",
        "rank_cminus": "1277293530095685745",
        "rank_dplus": "1277293513616265216",
        "rank_d": "1277293312696516690",
        "rank_z": "1277382169538461746",
        "rank_top": "1278185429656670269"
    }
    let formattedRank = 'rank_' + rank.toLowerCase().replace("+", "plus").replace("-", "minus");
    return `<:${formattedRank}:${rankEmojis[formattedRank]}>`
}

