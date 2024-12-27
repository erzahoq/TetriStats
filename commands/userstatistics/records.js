const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
import("node-fetch");

const maxItems = 5;

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
                .setDescription('Get a user\'s records via their Discord, the user must have linked their Discord to TETR.IO')
                .addUserOption((option) =>
                    option
                        .setName('user')
                        .setDescription('the discord user to search for')
                        .setRequired(true),
                ),
        ),
    async execute(interaction) {
        await interaction.deferReply() // defer because this one can take a while (it's 10 API calls)

        let records, tetrioID;

        // Fetch the account with either discord or tetrio
        if (interaction.options.getSubcommand() === 'tetrio') {
            const user = interaction.options.getString('user').toLowerCase();

            const response = await fetch(`https://ch.tetr.io/api/users/${user}`);
            stats = await response.json();

            if (!stats.success) {
                if (stats.error.msg === "No such user! | Either you mistyped something, or the account no longer exists.") {
                    return await interaction.editReply({
                        content: 'No such user! Either you mistyped something, or this user no longer exists.',
                        ephemeral: true
                    });
                } else {
                    return await interaction.editReply({
                        content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                        ephemeral: true
                    });
                }
            }

            records = await fetchAll(user);
            tetrioID = stats.data._id
        } else if (interaction.options.getSubcommand() === 'discord') {
            const user = interaction.options.getUser('user');

            let response = await fetch(`https://ch.tetr.io/api/users/search/discord:${user.id}`);
            stats = await response.json();

            response = await fetch(`https://ch.tetr.io/api/users/${stats.data.user.username}`);
            stats = await response.json(); //oopsies :3

            if (stats.data === null) {
                return await interaction.editReply({
                    content: 'No such user found on TETR.IO! Either the account no longer exists, or this person has not linked their Discord with TETR.IO.',
                    ephemeral: true
                });
            }

            if (!stats.success) {
                return await interaction.editReply({
                    content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                    ephemeral: true
                });
            }

            tetrioID = stats.data._id
            records = await fetchAll(tetrioID);
        }

        // mappings and vars
        const gametypeMapping = {
            '40l': '40 Lines',
            'blitz': "Blitz",
            'zenith': 'Quick Play',
            'zenithex': 'Expert Quick Play',
            'league': 'Tetra League'
        }
        let pages = {};
        let buttons = [];

        // loop through each category and what was fetched (see fetchAll)
        Object.entries(records).forEach(([category, fetched]) => {

            // create embed and button
            const embed = new EmbedBuilder()
                .setColor('#57b1ff')
                .setThumbnail(`https://tetr.io/user-content/avatars/${tetrioID}.jpg`)
                .setTitle(`${capitalizeFirstLetter(stats.data.username)}'s ${gametypeMapping[category]} Records:`)
                .setURL(`https://ch.tetr.io/u/${stats.data.username}`)
            const button = new ButtonBuilder()
                .setCustomId(`recordspage_${category}_${buttons.length}`)
                .setDisabled(buttons.length === 0)
                .setLabel(gametypeMapping[category])
                .setStyle(ButtonStyle.Primary)

            // do the description
            let desc = "";
            if (fetched['top']) {
                desc += `- <:news_lblocal:1280356184640983122> Personal best
  ${formatRecord(fetched['top'])}\n\n`
            }
            fetched['all'].forEach((rec) => {
                desc += `${formatRecord(rec)}\n`;
            })

            if (desc === '') {
                desc = `<:ach_none:1278178486586048575> No ${gametypeMapping[category]} records yet...`
            }

            // set description and push to list
            embed.setDescription(desc);
            pages[category] = embed;
            buttons.push(button)
        })

        const row = new ActionRowBuilder()
            .addComponents(buttons);

        await interaction.editReply({
            embeds: [pages['40l']],
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
    const toFetch = ['40l', 'blitz', 'zenith', 'zenithex', 'league'];
    let responses = {};

    // go through each category and fetch them
    for (const item of toFetch) {
        responses[item] = {};

        // fetch the last 10 games
        let allResponse = await fetch(`https://ch.tetr.io/api/users/${user}/records/${item}/recent?limit=${maxItems}`);
        allResponse = await allResponse.json();
        responses[item]['all'] = allResponse.data.entries;

        // ignore league because it doesn't have a top
        if (item === 'league') {
            continue;
        }

        // fetch the top game
        let topResponse = await fetch(`https://ch.tetr.io/api/users/${user}/records/${item}/top?limit=1`);
        topResponse = await topResponse.json();
        responses[item]['top'] = topResponse.data.entries[0];
    }

    return responses;
}

function formatRecord(record) {
    let formatted = `- `
    let stats = record.results.stats

    // checks for each gamemode
    if (record.gamemode === '40l') {
        formatted += `**${convertToTimeFormat(stats.finaltime)}**`;
    } 
    else if (record.gamemode === 'blitz') {
        formatted += `**${formatNumber(stats.score)}**`;
    } 
    else if (record.gamemode === 'zenithex' || record.gamemode === 'zenith') {
        formatted += `**${formatNumber(Math.round(stats.zenith.altitude * 10) / 10)}m**`;
        stats = record.results.aggregatestats; // for some reason pps and vs score are in aggregate

        // add mod emojis
        if (record.extras.zenith.mods) {
            formatted += ' ';
            record.extras.zenith.mods.forEach(mod => {
                formatted += getModEmoji(mod);
            })
        }
    } 
    else if (record.gamemode === 'league') {
        const players = record.results.leaderboard
        stats = players[0].stats

        // switch statement wow!! (checks the result)
        switch (record.extras.result) {
            case ('victory'):
                formatted += `**VICTORY ${players[0].wins}-${players[1].wins}**`;
                break;
            case ('dqvictory'):
                formatted += `**VICTORY by DQ**`;
                break;
            case ('defeat'):
                formatted += `**DEFEAT ${players[1].wins}-${players[0].wins}**`;
                stats = players[1].stats // the user is only in the first slot if they win apparently
                break;
            case ('dqdefeat'):
                stats = players[1].stats
                formatted += `**DEFEAT by DQ**`;
        }
        formatted += ` vs ${escapeUnderscores(record.otherusers[0].username)}`;
    } else {
        formatted += `[Invalid gamemode.]` // this shouldn't be possible
    }

    // add some extra stats
    if (['zenith', 'zenithex', 'league'].indexOf(record.gamemode) != -1)
        formatted += `
  - ${formatNumber(Math.round(stats.apm * 100) / 100)} APM, ${formatNumber(Math.round(stats.pps * 100) / 100)} PPS, ${formatNumber(Math.round(stats.vsscore * 100) / 100)} VS`;
    else
        formatted += `
  - ${formatNumber(Math.round(record.results.aggregatestats.pps * 100) / 100)} PPS, ${Math.round(stats.finesse.perfectpieces / stats.piecesplaced * 10000) / 100}% (${stats.finesse.faults}F) Finesse`;

    formatted += `
  - Done [<t:${reformatTimestamp(record.ts)}:d> <t:${reformatTimestamp(record.ts)}:t>](https://tetr.io/#R:${record.replayid})`;

    return formatted;
}

function formatNumber(num) {
    const numStr = num.toString();
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function getModEmoji(emoji) {
    const mapping = {
        "expert": "1284286589576675348",
        "nohold": "1284286599319912468",
        "messy": "1284286607754793031",
        "gravity": "1284286616629809193",
        "volatile": "1284286624523354163",
        "doublehole": "1284286635118301245",
        "invisible": "1284286644328988734",
        "allspin": "1284286652759412899",
        "duo": "1284286660800020620",
        "snowman": "1321711057034543175",
    };
    return `<:mod_${emoji}:${mapping[emoji]}>`;
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function reformatTimestamp(isoString) {
    if (!isoString) {
        return "Before account creation was tracked"
    }

    // Create a Date object from the ISO string
    const date = new Date(isoString);

    // Return the Unix timestamp by dividing the milliseconds by 1000
    return `${Math.floor(date.getTime() / 1000)}`;
}

function convertToTimeFormat(inputSeconds) {
    const totalSeconds = inputSeconds / 1000
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(3); // keep milliseconds as part of seconds
    
    // format seconds to ensure two digits before decimal
    const [intSeconds, fracSeconds] = seconds.split('.');
    const formattedSeconds = intSeconds.padStart(2, '0') + '.' + (fracSeconds || '000').padEnd(3, '0');

    return `${minutes}:${formattedSeconds}`;
}

function escapeUnderscores(inputString) {
    // replace _ with \_ :3
    return inputString.replace(/_/g, '\\_');
}