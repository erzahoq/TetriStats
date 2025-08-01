const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, MessageFlags, ApplicationIntegrationType } = require('discord.js');
import("node-fetch");

const { formatNumber, escapeUnderscores, convertToTimeFormat, reformatTimestamp } = require('../../helpers/functions');
const { getUser } = require('../../helpers/getuser')

const maxItems = 5;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('records')
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
        .setDescription('Get a user\'s latest and top records via their TETR.IO (or Discord) username/ID.')
        .addStringOption((option) =>
            option
                .setName('user')
                .setDescription('the TETR.IO username / Discord to fetch data for')
                .setRequired(true),
        ),

    async execute(interaction) {
        await interaction.deferReply() // defer because this one can take a while (it's 10 API calls :gladeline:)

        let records;

        const user = await getUser(interaction.options.getString('user').toLowerCase()); // calls API only once

        if (user === "no such user") {
            return await interaction.reply({
                    content: 'No such user found on TETR.IO! Either the account no longer exists, or this person has not linked their Discord with TETR.IO.',
                    flags: MessageFlags.Ephemeral
            });
        } else if (user === "server error") {
            return await interaction.reply({
                    content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                    flags: MessageFlags.Ephemeral
            });
        }

        records = await fetchAll(user._id)

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
                .setThumbnail(`https://tetr.io/user-content/avatars/${user._id}.jpg`)
                .setTitle(`${escapeUnderscores(user.username.toUpperCase())}'s ${gametypeMapping[category]} Records:`)
                .setURL(`https://ch.tetr.io/u/${user.username}`)
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
    let formatted = `- `; 
    let stats = record.results.stats;

    // Determine the type of record and format accordingly
    if (record.gamemode === '40l') {
        formatted += `**${convertToTimeFormat(stats.finaltime)}**`;
    } 
    else if (record.gamemode === 'blitz') {
        formatted += `**${formatNumber(stats.score)}**`;
    } 
    else if (record.gamemode === 'zenithex' || record.gamemode === 'zenith') {
        formatted += `**${formatNumber(Math.round(stats.zenith.altitude * 10) / 10)}m**`;
        stats = record.results.aggregatestats; // PPS and VS Score are in aggregate

        // Add any active mod emojis
        if (record.extras.zenith.mods) {
            formatted += ' ';
            record.extras.zenith.mods.forEach(mod => {
                formatted += getModEmoji(mod);
            });
        }
    } 
    else if (record.gamemode === 'league') {
        const players = record.results.leaderboard;
        stats = players[0].stats;

        // Determine result type and format accordingly
        switch (record.extras.result) {
            case ('victory'):
                formatted += `**🏆 VICTORY** (${players[0].wins}-${players[1].wins})`;
                break;
            case ('dqvictory'):
                formatted += `**🏆 VICTORY** (by Disqualification)`;
                break;
            case ('defeat'):
                formatted += `**❌ DEFEAT** (${players[1].wins}-${players[0].wins})`;
                stats = players[1].stats; // The user is only in the first slot if they win
                break;
            case ('dqdefeat'):
                formatted += `**❌ DEFEAT** (by Disqualification)`;
                stats = players[1].stats;
        }
        formatted += ` vs **${escapeUnderscores(record.otherusers[0].username)}**`;
    } 
    else {
        formatted += `[Invalid gamemode.]`; // Should never happen
    }

    // Add general performance stats (APM, PPS, VS Score)
    if (['zenith', 'zenithex', 'league'].includes(record.gamemode)) {
        formatted += `
  - **APM:** ${formatNumber(Math.round(stats.apm * 100) / 100)}
  - **PPS:** ${formatNumber(Math.round(stats.pps * 100) / 100)}
  - **VS Score:** ${formatNumber(Math.round(stats.vsscore * 100) / 100)}`;
    } 
    else {
        formatted += `
  - **PPS:** ${formatNumber(Math.round(record.results.aggregatestats.pps * 100) / 100)}
  - **Finesse:** ${Math.round(stats.finesse.perfectpieces / stats.piecesplaced * 10000) / 100}% (${stats.finesse.faults} faults)`;
    }

    // Add timestamp and replay link
    formatted += `
  - [${reformatTimestamp(record.ts)}](https://tetr.io/#R:${record.replayid})`;

    return formatted;
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
        "expert_reversed": "1346671043883962492",
        "nohold_reversed": "1346670935729770496",
        "messy_reversed": "1346671003975290880",
        "gravity_reversed": "1346670986648621139",
        "volatile_reversed": "1346670955627282442",
        "doublehole_reversed": "1346671018483253278",
        "invisible_reversed": "1346671057586753536",
        "allspin_reversed": "1346670971209121872",
        "snowman": "1321711057034543175",
    };
    return `<:mod_${emoji}:${mapping[emoji]}>`;
}

