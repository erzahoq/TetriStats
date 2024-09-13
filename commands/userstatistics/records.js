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
        let pages = {};
        let buttons = [];

        Object.entries(records).forEach(([category, data]) => {
            const embed = new EmbedBuilder()
                .setColor('#57b1ff')
                .setThumbnail(`https://tetr.io/user-content/avatars/${tetrioID}.jpg`)
                .setTitle(`${capitalizeFirstLetter(username)}'s ${gametypeMapping[category]} Records:`)
                .setURL(`https://ch.tetr.io/u/${username}`)
            const button = new ButtonBuilder()
                .setCustomId(`recordspage_${buttons.length}`)
                .setDisabled(buttons.length === 0)
                .setLabel(gametypeMapping[category])
                .setStyle(ButtonStyle.Primary)
            
            let desc = "";
            desc += `<:news_lblocal:1280356184640983122> ${formatRecord(data['top'][0])}`
            data['all'].forEach((rec) => {
                desc += `\n${formatRecord(rec)}`;
            })

            embed.setDescription(desc);
            pages[category] = embed;
            buttons.push(button)
        })

        const row = new ActionRowBuilder()
            .addComponents(buttons);
        
        await interaction.reply({
            embeds: [pages[0]],
            components: [row]
        });
        
        interaction.client.pageData = {
            [interaction.id]: {
                pages,
                currentPage: 0,
                buttons
            }
        };

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
    let stats = record.results.stats
    switch (record.gamemode) {
        case ('40l'):
            formatted += `**${Math.floor(stats.finaltime/60000)}:${Math.floor(record.stats.finaltime/1000%60)}.${record.stats.finaltime%1000}**`;
            break;
        case ('blitz'):
            formatted += `**${formatNumber(stats.score)}**`;
            break;
        case ('zenithex'):
        case ('zenith'):
            formatted += `**${formatNumber(Math.round(stats.zenith.altitude*10)/10)}m**`;
            stats = record.results.aggregatestats;
            if (record.extras.zenith.mods) {
                formatted += ' ';
                record.extras.zenith.mods.forEach(mod => {
                    formatted += getModEmoji(mod);
                })
            }
            break;
        case ('league'):
            const players = record.results.leaderboard
            stats = players[0].stats
            switch (record.result) {
                case ('victory'):
                    formatted += `**VICTORY ${players[0].wins}-${players[1].wins}**`;
                    break;
                case ('dqvictory'):
                    formatted += `**VICTORY by DQ**`;
                    break;
                case ('defeat'):
                    formatted += `**DEFEAT ${players[0].wins}-${players[1].wins}**`;
                    break;
                case ('dqdefeat'):
                    formatted += `**DEFEAT by DQ**`;
            }
            formatted += ` vs ${players[1].username}`;
    }
    if (['zenith','zenithex','league'].indexOf(record.gamemode) != -1)
        formatted += ` | ${formatNumber(Math.round(stats.apm*100)/100)} APM, ${formatNumber(Math.round(stats.pps*100)/100)} PPS, ${formatNumber(Math.round(stats.vsscore*100)/100)} VS`;
    else 
        formatted += ` | ${formatNumber(Math.round(record.results.aggregatestats*100)/100)} PPS, ${Math.round(stats.finesse.perfectpieces/stats.piecesplaced*10000)/100}% (${stats.finesse.faults}F) Finesse`;

    formatted += ` | [[Replay]](https://tetr.io/#R:${record.replayid})`;

    return formatted;
}

function formatNumber(num) {
    const numStr = num.toString();
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function getModEmoji(emoji) {
    const mapping = {
        "expert":     "1284286589576675348",
        "nohold":     "1284286599319912468",
        "messy":      "1284286607754793031",
        "gravity":    "1284286616629809193",
        "volatile":   "1284286624523354163",
        "doublehole": "1284286635118301245",
        "invisible":  "1284286644328988734",
        "allspin":    "1284286652759412899",
        "duo":        "1284286660800020620",
    };
    return `<:${emoji}:${mapping[emoji]}>`;
}