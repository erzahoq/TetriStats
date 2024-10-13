const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('compare')
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

        const discordRegex = new RegExp('<@[0-9]+>');

        //calls api 4 times in the worst case sceneario
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

            console.log(user)

            response = await fetch(`https://ch.tetr.io/api/users/search/discord:${user.id}`);
            let stats = await response.json();

            console.log(stats)

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

        console.log(userStats1)
        
        // Create the embed
        const comparisonEmbed = new EmbedBuilder()
            .setColor('#ff9159') // Set embed color
            .setTitle(`${userStats1.username} vs. ${userStats2.username}`)
            .addFields(
            { name: 'Stat', value: 'Games Played\nWins\nPlaytime\nXP', inline: true },

            { name: `${userStats1.username}`, value: `${userStats1.gamesplayed}
            ${userStats1.gameswon} (${Math.round(userStats1.gameswon/userStats1.gamesplayed*10000)/100}%)
            ${playtimeConvert(userStats1.gametime)}
            ${formatNumber(Math.floor(userStats1.xp))} XP (Level ${formatNumber(Math.floor(calculateLevel(userStats1.xp)))})
    

            `, inline: true},
            )
            .setTimestamp();
        
        interaction.editReply({ embeds: [comparisonEmbed] });
	},
};
 

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