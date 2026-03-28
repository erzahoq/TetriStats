const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require('discord.js');
const { fetchCached } = require('../../helpers/fetch.js');
const { getEmoji } = require('../../helpers/emojis.js');
const { formatAchievementVal, formatUsername, buildPageButtonRows, formatNumber } = require('../../helpers/formatters.js');
const { database } = require('../../database.js');

const searchStrings = {};
const idToName = {};

async function getAchievementSearchStrings() {
    const aches = await database.Achievement.findAll();
    for (const ach of aches) {
        searchStrings[ach.id] = `${ach.name}\n${ach.shortname}\n${ach.objective}`;
        idToName[ach.id] = ach.name;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('achievement')
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .setDescription('Gets data about a specific achievement.')
        .addIntegerOption(option =>
            option.setName('achievement')
            .setDescription('The achievement to view.')
            .setRequired(true)
            .setAutocomplete(true)
        ),
    async execute(interaction) {
        const achId = interaction.options.getInteger('stat');
        const achData = await fetchCached(`https://ch.tetr.io/api/achievements/${achId}`);

        if (!achData.success) {
            await interaction.reply(`Achievement with ID ${achId} not found!`);
            return;
        }
        
        const ach = achData.data.achievement;

        let achText = `### __Achievements -> [${ach.name}](https://ch.tetr.io/achievements/${achId})__`
        if (ach.object) achText += `\n**${ach.object}**`
        achText += `\n-# *${ach.desc}*\n`

        if (ach.art === 0) {
            achText += `\n${getEmoji('au')} **UNRANKED** / This achievement does not contribute to your Achievement Rating.`
        } else if (ach.art === 2) {
            achText += `\n${getEmoji('ac')} **COMPETITIVE** / This achievement grants extra Achievement Rating to those who place in its Top 100 leaderboard.`
        }
        if (ach.hidden) {
            achText += `\n${getEmoji('ah')} **HIDDEN** / This achievement is only visible to the worthy.`
        }
        if (ach.event) {
            const eventName = ach.event;
            let extraText = '';
            if (ach.category === 'legacy') extraText = " It is no longer available."
            let currentText = 'is part';
            if (ach.category === 'legacy') currentText = "was part"
            achText += `\n${getEmoji('ae')} **EVENT** / This achievement ${currentText} of the ${eventName} event.${extraText}`;
        }

        const achievementTiers = [
            'diamond', 'platinum', 'gold', 'silver', 'bronze'
        ];

        if (ach.art !== 1 || ach.hidden || ach.event) {
            achText += `\n`
        }

        const cutoffs = achData.data.cutoffs;
        if (ach.rt === 2) {
            achText += `${getEmoji('ach_issued')} ${cutoffs.total} issued`
        } else {
            let cutoffPercents;
            switch (ach.rt) {
                case 1:
                    cutoffPercents = [70, 50, 30, 10, 5]
                    break;
                case 3:
                    // zenith floors
                    cutoffPercents = [null, null, null, null, null]
                    break;
                case 4:
                    cutoffPercents = [null, 100, 60, 20, 5]
                    break;
                case 5:
                    cutoffPercents = [null, null, 100, 50, 20]
                    break;
                case 6:
                    cutoffPercents = [null, 100, 50, 20, 10]
                    break;
                case 7:
                    cutoffPercents = [100, 70, 50, 30, 10]
                    break;
            }

            let i = 4;
            // this is a mess sorry
            for (const achType of achievementTiers) {
                if (!cutoffPercents[i] && ach.rt !== 3 || cutoffs[`${achType}_count`] === 0) {
                    i--;
                    continue;
                }

                let cutoffText = "";
                if (cutoffs[achType]) {
                    cutoffText = `**${formatAchievementVal(ach, cutoffs[achType], [3,5,7,9,10][i] /*qp2 floors*/)}**`
                }
                if (cutoffPercents[i] === 100 && !cutoffs[`${achType}`]) {
                    cutoffText = `**Any**`
                }

                let minted = formatNumber(cutoffs[`${achType}_count`]);
                if (!cutoffs[`${achType}_count`]) {
                    minted = formatNumber(cutoffs.total);
                }

                let percentText = `(${cutoffPercents && cutoffPercents[i] !== 100 ? `Top ${cutoffPercents[i]}%, ` : ""}${minted} minted)`
                if (ach.rt === 3) {
                    percentText = `(${minted} minted)`
                }

                achText += `\n${getEmoji('ach_' + achType)} ${cutoffText} ${percentText}`;
                i--;
            }
        }

        const labels = ["Overview"]
        const pages = [
            new EmbedBuilder()
                .setDescription(achText),
        ]

        if (!ach.nolb) {
            labels.push("Leaderboard");

            let lbText = `### __Achievements -> [${ach.name}](https://ch.tetr.io/achievements/${achId}) -> Leaderboard__\n\n`
            const lb = achData.data.leaderboard;
            const seenUsers = [];
            for (let i = 0; i < 15; i++) {
                if (ach.pair && seenUsers.includes(lb[i].u.username)) continue;
                lbText += `- `

                // not diamond tier; mainly for swamp water aches :P
                if (lb[i].v < cutoffs.diamond) {
                    for (const achType of achievementTiers) {
                        if (lb[i].v >= cutoffs[achType]) {
                            lbText += getEmoji('ach_' + achType) + " ";
                            break;
                        }
                    }
                }

                lbText += `#${i+1} `
                if (ach.pair && lb[i].x?.ally) {
                    lbText += `${formatUsername(lb[i].u.username)} with ${formatUsername(lb[i].x.ally.username)}`
                    seenUsers.push(lb[i].x.ally.username);
                } else {
                    lbText += `${formatUsername(lb[i].u.username)}`
                }
                lbText += ` - **${formatAchievementVal(ach, lb[i].v, lb[i].a)}**\n`
            }

            pages.push(new EmbedBuilder()
                .setDescription(lbText)
            );
        }

        // TODO: league stats go here

        if (pages.length === 1) {
            await interaction.reply({ embeds: pages });
            return;
        }

        const rows = buildPageButtonRows({ commandName: "achievement", key: interaction.id, labels })

        await interaction.reply({ embeds: [pages[0]], components: rows })

        interaction.client.pageData.set(interaction.id, { 
            commandName: "achievement",
            ownerId: interaction.user.id,
            pages,
            labels,
            currentPage: 0,
            ttlMs: 10 * 60 * 1000,
            expiresAt: Date.now() + 10 * 60 * 1000
        })
    },
    // TODO: change autocomplete sorting to search by name first then secondary stuff
    async autocomplete(interaction) { 
        if (Object.keys(searchStrings).length === 0) await getAchievementSearchStrings();
        
        const focusedValue = interaction.options.getFocused();
        let correctedValue = focusedValue;
        const corrections = {
            "hfd": "highest floor discovered",
            "40l": "40 lines",
            "qp2": "zenith",
            "qp": "zenith",
            "kill": "KO",

            "back to back": "btb",
            "b2b": "btb",
            "btb": "back-to-back",
        }
        for (const [key, value] of Object.entries(corrections)) {
            correctedValue = correctedValue.replace(key, value);
        }
        
        const filtered = Object.entries(searchStrings).filter(([, str]) => {
            return str.toLowerCase().includes(correctedValue.toLowerCase())
        });
        const filteredIds = filtered.map(([id]) => id);
        const limited = filteredIds.slice(0, 25);
        const response = limited.map(id => ({ name: idToName[id], value: id }));

        await interaction.respond(response)
    }
}
