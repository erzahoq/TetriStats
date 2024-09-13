const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
import("node-fetch");

const maxItems = 10;

module.exports = {
    data: new SlashCommandBuilder()
		.setName('records')
		.setDescription('Get a user\'s latest and top records via their TETR.IO (or Discord) username/ID.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('tetrio')
                .setDescription('Get a user\'s latest and top records via their TETR.IO username/ID.')
                .addStringOption((option) =>
                    option
                      .setName('user')
                      .setDescription('the username/ID to search for')
                      .setRequired(true),
                  ),
        )        
        .addSubcommand(subcommand =>
            subcommand
                .setName('discord')
                .setDescription('Get a user\'s latest and top records via their Discord, the user must have linked their Discord to TETR.IO')
                .addUserOption((option) =>
                    option
                      .setName('user')
                      .setDescription('the discord user to search for')
                      .setRequired(true),
                  ),
            ),
    async execute(interaction) {
        let records, tetrioID;
        if (interaction.options.getSubcommand() === 'tetrio') {
			const user = interaction.options.getString('user').toLowerCase();

            const response = await fetch(`https://ch.tetr.io/api/users/${user}`);
            stats = await response.json();

            if (!stats.success) {
                if (stats.error.msg === "No such user! | Either you mistyped something, or the account no longer exists.") {
                    return await interaction.reply({
                        content: 'No such user! Either you mistyped something, or this user no longer exists.', 
                        ephemeral: true
                    });
                } else {
                    return await interaction.reply({
                        content: 'I had an issue accessing the TETR.IO servers! Please try again later.', 
                        ephemeral: true
                    });
                }
            }   

            records = await fetchAll(user);
            tetrioID = response._id
		} else if (interaction.options.getSubcommand() === 'discord') {
			const user = interaction.options.getUser('user');

            let response = await fetch(`https://ch.tetr.io/api/users/search/discord:${user.id}`);
            stats = await response.json();

            if (stats.data === null) {
                return await interaction.reply({
                    content: 'No such user found on TETR.IO! Either the account no longer exists, or this person has not linked their Discord with TETR.IO.', 
                    ephemeral: true
                });
            }

            if (!stats.success) {
                return await interaction.reply({
                    content: 'I had an issue accessing the TETR.IO servers! Please try again later.', 
                    ephemeral: true
                });
            }

            tetrioID = stats.data.user._id
            records = await fetchAll(tetrioID);
		}

        const gametypeMapping = {
            '40l': '40 Lines',
            'blitz': "Blitz",
            'zenith': 'Quick Play',
            'zenithex': 'Expert Quick Play',
            'league': 'Tetra League'
        }
        let embeds = {};

        Object.entries(records).forEach(([category, data]) => {
            let embed = new EmbedBuilder()
                .setColor('#57b1ff')
                .setThumbnail(`https://tetr.io/user-content/avatars/${tetrioID}.jpg`)
                .setTitle(`${capitalizeFirstLetter(username)}'s ${catMap[category]} Records:`)
                .setURL(`https://ch.tetr.io/u/${username}`)
            let desc = "";


        })

    }
}

async function fetchAll(user) {
    const toFetch = ['40l','blitz','zenith','zenithex','league'];
    let responses = {};

    toFetch.forEach(async item => {
        responses[item] = {};
        responses[item]['all'] = await fetch(`https://ch.tetr.io/api/users/${user}/records/${item}/recent?limit=${maxItems}`);
        responses[item]['top'] = await fetch(`https://ch.tetr.io/api/users/${user}/records/${item}/top?limit=1`);
    })

    return responses;
}

function formatRecord(record) {
    let formatted = `<t:${record.ts}:d> <t:${record.ts}:t> - `
    switch (record.gamemode) {
        case ('40l'):
            formatted += `**${Math.floor(record.stats.finaltime/60000)}:${Math.floor(record.stats.finaltime/1000%60)}.${record.stats.finaltime%1000}**`
            break;
        case ('blitz'):
            formatted += `**${formatNumber(record.stats.score)}**`
            break;
        case ('zenithex'):
        case ('zenith'):
            formatted += ``
            break;
    }

}

function formatNumber(num) {
    const numStr = num.toString();
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}