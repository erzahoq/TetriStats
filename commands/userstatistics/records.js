const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, MessageFlags, ApplicationIntegrationType } = require('discord.js');

const { formatNumber, formatTime, formatISOString, formatUsername, buildPageButtonRows } = require('../../helpers/formatters');
const { getUser } = require('../../helpers/getuser');
const { getEmoji } = require('../../helpers/emojis');

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

        const user = await getUser(interaction.options.getString('user').toLowerCase()); // calls API only once

        if (user === "no such user") {
            return await interaction.editReply({
                content: 'No such user found on TETR.IO! Either the account no longer exists, or this person has not linked their Discord with TETR.IO.',
                flags: MessageFlags.Ephemeral
            });
        } else if (user === "server error") {
            return await interaction.editReply({
                content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                flags: MessageFlags.Ephemeral
            });
        }

        const records = await fetchAll(user._id)

        // mappings and vars
        const gametypeMapping = {
            '40l': '40 Lines',
            'blitz': "Blitz",
            'zenith': 'Quick Play',
            'zenithex': 'Expert Quick Play',
            'league': 'Tetra League'
        }

        const colourMapping = {
            '40l': '#ffd94f',
            'blitz': '#ff5410',
            'zenith': '#ff7024',
            'zenithex': '#ffc800',
            'league': '#c51111'
        };

        const pages = {};
        const buttons = [];

        // loop through each category and what was fetched (see fetchAll)
        Object.entries(records).forEach(([category, fetched]) => {

            // create embed and button
            const embed = new EmbedBuilder()
                .setColor(colourMapping[category])
                .setThumbnail(`https://tetr.io/user-content/avatars/${user._id}.jpg`)
            const button = new ButtonBuilder()
                .setCustomId(`recordspage_${category}_${buttons.length}`)
                .setDisabled(buttons.length === 0)
                .setLabel(gametypeMapping[category])
                .setStyle(ButtonStyle.Primary)

            // do the description
            const title = `### __${formatUsername(user.username)} -> Records -> ${gametypeMapping[category]}__`
            let desc = `${title}\n`;
            if (fetched.top) {
                desc += `- ${getEmoji('news_lblocal')} Personal best
  ${formatRecord(fetched.top)}\n\n`
            }
            fetched.all.forEach((rec) => {
                desc += `${formatRecord(rec)}\n`;
            })

            if (desc.trim() === title) {
                desc += `${getEmoji('ach_none')} No ${gametypeMapping[category]} records yet...`
            }

            // set description and push to list
            embed.setDescription(desc);
            pages[category] = embed;
            buttons.push(button)
        })

        const key = interaction.id;
        const commandName = 'records';

        const labels = buttons.map(b => b.data.label); // same order as buttons were built
        const pageList = Object.values(pages);         // embeds in the same order as buttons/pages

        interaction.client.pageData.set(key, {
            commandName,
            ownerId: interaction.user.id,
            pages: pageList,
            labels,
            currentPage: 0,
            ttlMs: 10 * 60 * 1000,
            expiresAt: Date.now() + 10 * 60 * 1000,
        });

        // rebuild buttons using the shared format: records:page-<key>-<i>
        const rows = buildPageButtonRows({ commandName, key, labels });

        // edit reply to use new rows
        await interaction.editReply({
            embeds: [pageList[0]],
            components: rows,
        });



    }
}

async function fetchAll(user) {
    const toFetch = ['40l', 'blitz', 'zenith', 'zenithex', 'league'];
    const responses = {};

    // go through each category and fetch them
    for (const item of toFetch) {
        responses[item] = {};

        // fetch the last 10 games
        let allResponse = await fetch(`https://ch.tetr.io/api/users/${user}/records/${item}/recent?limit=${maxItems}`);
        allResponse = await allResponse.json();
        responses[item].all = allResponse.data.entries;

        // ignore league because it doesn't have a top
        if (item === 'league') {
            continue;
        }

        // fetch the top game
        let topResponse = await fetch(`https://ch.tetr.io/api/users/${user}/records/${item}/top?limit=1`);
        topResponse = await topResponse.json();
        responses[item].top = topResponse.data.entries[0];
    }

    return responses;
}

function formatRecord(record) {
    let formatted = `- `; 
    let stats = record.results.stats;

    // Determine the type of record and format accordingly
    if (record.gamemode === '40l') {
        formatted += `**${formatTime(stats.finaltime)}**`;
    } 
    else if (record.gamemode === 'blitz') {
        formatted += `**${formatNumber(stats.score)}**`;
    } 
    else if (record.gamemode === 'zenithex' || record.gamemode === 'zenith') {
        formatted += `**${formatNumber(stats.zenith.altitude, 1)}m**`;
        stats = record.results.aggregatestats; // PPS and VS Score are in aggregate

        // Add any active mod emojis
        if (record.extras.zenith.mods) {
            formatted += ' ';
            record.extras.zenith.mods.forEach(mod => {
                formatted += getEmoji("mod_" + mod);
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
        formatted += ` vs **${formatUsername(record.otherusers[0].username, false)}**`;
    } 
    else {
        formatted += `[Invalid gamemode.]`; // Should never happen
    }

    // Add general performance stats (APM, PPS, VS Score)
    if (['zenith', 'zenithex', 'league'].includes(record.gamemode)) {
        formatted += `
  - **APM:** ${formatNumber(stats.apm, 2)}
  - **PPS:** ${formatNumber(stats.pps, 2)}
  - **VS Score:** ${formatNumber(stats.vsscore, 2)}`;
    } 
    else {
        formatted += `
  - **PPS:** ${formatNumber(record.results.aggregatestats.pps, 2)}
  - **Finesse:** ${formatNumber(stats.finesse.perfectpieces / stats.piecesplaced * 100, 2)}% (${formatNumber(stats.finesse.faults)} faults)`;
    }

    // Add timestamp and replay link
    formatted += `
  - [${formatISOString(record.ts)}](https://tetr.io/#R:${record.replayid})`;

    return formatted;
}

