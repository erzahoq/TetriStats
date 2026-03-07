const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { database } = require('./../../database.js')
const { Op } = require('sequelize');
const { getEmojiOfRank, formatPreciseTime, formatNumber } = require('../../helpers/formatters.js');

const statOptions = {};
let seenRankTotals = {};
const RANKS = ['d', 'd+', 'c-', 'c', 'c+', 'b-', 'b', 'b+', 'a-', 'a', 'a+', 's-', 's', 's+', 'ss', 'u', 'x', 'x+'].reverse();

const modeMap = {
    "sprint": "40 Lines",
    "blitz": "Blitz",
    "league": "Tetra League",
    "zenith": "Quick Play",
    "zenithEx": "Quick Play Expert"
}
const statMap = {
    "apm": "Attack Per Minute",
    "pps": "Pieces Per Second",
    "vs": "VS Score",
    "finesse": "Finesse",
    "time": "Time",
    "height": "Height",
    "btb": "Back-to-Back Chain",
    "climbSpeed": "Average Climb Speed",
    "kpp": "Keys Per Piece",
    "kps": "Keys Per Second",
    "score": "Score",
    "spp": "Score Per Piece",
    "app": "Attack Per Piece",
}
const statShorthandMap = {
    "climbSpeed": "Avg. Climb Speed",
    "btb": "Max B2B chain",
    "finesse": "Finesse %",
    "score": "Score",
    "time": "Time",
    "height": "Height",
    "vs": "VS Score",
}

async function getStatOptions() {
    const statList = await database.LeagueStat.findAll({
        where: {
            statGroup: {
                [Op.not]: "achievements"
            }
        }
    });

    for (const statEntry of statList) {
        const splitStat = statEntry.stat.split("/")[1]
        statOptions[`${statEntry.stat}`] = `${statMap[splitStat]} (${modeMap[statEntry.statGroup]})`;
    }
}

async function updateRankTotals() {
    if (Object.keys(seenRankTotals).length > 0) return;
    const stat = await database.LeagueStat.findByPk("league/apm");
    seenRankTotals = stat.seenCount;
}

function formatValue(stat, value) {
    if (stat.includes("time")) {
        return formatPreciseTime(value);
    }
    if (stat.includes("btb") || stat.includes("score")) {
        return formatNumber(value);
    }
    if (stat.includes("height")) {
        return `${formatNumber(value, 2)}m`;
    }
    if (stat.includes("finesse")) {
        return `${formatNumber(value * 100, 2)}%`;
    }
    if (stat.includes("climbSpeed") || stat.includes("app") || stat.includes("pps")) {
        return formatNumber(value, 3);
    }
    return formatNumber(value, 2);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank-stats')
        .setDescription('Gets averages for each rank for a specific stat.')
        .addStringOption(option =>
            option.setName('stat')
            .setDescription('The stat to get averages for.')
            .setRequired(true)
            .setAutocomplete(true)
        ),
    async execute(interaction) {
        if (Object.keys(statOptions).length === 0) await getStatOptions();
        const stat = interaction.options.getString('stat');
        if (!statOptions[stat]) {
            await interaction.reply(`${stat} is not a valid stat!`);
            return;
        }

        const statEntry = await database.LeagueStat.findByPk(stat);
        if (!statEntry) {
            await interaction.reply(`No data found for ${stat}!`);
            return;
        }
        await updateRankTotals();

        const embed = new EmbedBuilder()
            .setFooter({ text: `Sample of 700 players per rank` })
            .setTimestamp(new Date(statEntry.updatedAt))
            .setColor('#5394c0')
        const statShorthand = statShorthandMap[stat.split("/")[1]] || stat.split("/")[1].toUpperCase();
        
        let description = `### __League Averages -> ${modeMap[stat.split("/")[0]]} -> ${statShorthand}__`;
        let maxLength = 0;

        for (const rank of RANKS) {
            maxLength = Math.max(maxLength, formatValue(stat, statEntry.values[rank]).length);
        }
        for (const rank of RANKS) {
            const emoji = getEmojiOfRank(rank);
            if (statEntry.seenCount[rank] === 0) {
                description += `\n${emoji} \`${"-".repeat(maxLength)}\``;
                continue;
            }

            const value = formatValue(stat, statEntry.values[rank]);
            const seenPercent = statEntry.seenCount[rank] / seenRankTotals[rank];

            description += `\n${emoji} `;
            if (seenPercent > 0.7) {
                description += `**\`${" ".repeat(maxLength - value.length)}${value}\`**`;
            } else if (seenPercent > 0.2) {
                description += `\`${" ".repeat(maxLength - value.length)}${value}\` (*${formatNumber(seenPercent * 100, 2)}% of players*)`;
            } else if (statEntry.seenCount[rank] > 5) {
                description += `\`${"-".repeat(maxLength)}\` (*${value} / ${formatNumber(seenPercent * 100, 2)}% of players*)`;
            } else {
                description += `\`${"-".repeat(maxLength)}\` (*${value} / ${statEntry.seenCount[rank]} player${statEntry.seenCount[rank] === 1 ? "" : "s"}*)`;
            }
        }

        embed.setDescription(description);

        await interaction.reply({ embeds: [embed] });
    },
    async autocomplete(interaction) {
        if (Object.keys(statOptions).length === 0) {
            await getStatOptions();
        }

        const focusedValue = interaction.options.getFocused();
        let correctedValue = focusedValue;
        const corrections = {
            "40l": "sprint",
            "qp2": "zenith",
            "qp": "zenith",
            "b2b": "btb",
            "back to back": "btb",
            "back to": "back-to",
        }
        for (const [key, value] of Object.entries(corrections)) {
            correctedValue = correctedValue.replace(key, value);
        }

        const filtered = Object.keys(statOptions).filter(option => 
            // allow both "app" and "attack per piece" to match, for example
            statOptions[option].toLowerCase().includes(correctedValue.toLowerCase())
            || option.toLowerCase().includes(correctedValue.toLowerCase())
        );
        const limited = filtered.slice(0, 25);
        await interaction.respond(
            limited.map(option => ({ name: statOptions[option], value: option }))
        );
    }
}