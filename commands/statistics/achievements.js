//idk this one was kinda weird to migrate to cv2 
//the pages are built weird i think
const {
    SlashCommandBuilder,
    MessageFlags,
    InteractionContextType,
    ContainerBuilder,
    TextDisplayBuilder,
} = require("discord.js");const { fetchCached } = require('../../helpers/fetch.js');
const { getEmoji } = require('../../helpers/emojis.js');
const {
    formatAchievementVal,
    formatUsername,
    buildPageSelectRow,
    formatNumber,
    capitalizeFirstLetter,
    getEmojiOfRank,
} = require("../../helpers/formatters.js");const { database } = require('../../database.js');
const { autocomplete, getChoice } = require('../../helpers/achAutocomplete.js');

const RANKS = ['d', 'd+', 'c-', 'c', 'c+', 'b-', 'b', 'b+', 'a-', 'a', 'a+', 's-', 's', 's+', 'ss', 'u', 'x', 'x+'].reverse();
const qp2Floors = [3,5,7,9,10];
let seenRankTotals = {};

async function updateRankTotals() {
    if (Object.keys(seenRankTotals).length > 0) return;
    const stat = await database.LeagueStat.findByPk("league/apm");
    seenRankTotals = stat.seenCount;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('achievement')
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .setDescription('Gets data about a specific achievement.')
        .addStringOption(option =>
            option.setName('achievement')
                .setDescription('The achievement to view.')
                .setRequired(true)
                .setAutocomplete(true)
        ),
    async execute(interaction) {
        const achString = interaction.options.getString('achievement');
        const achId = await getChoice(achString);
        if (!achId) {
            await interaction.reply(`No achievement found for \`${achString}\`!`);
            return;
        }
        
        const achData = await fetchCached(`https://ch.tetr.io/api/achievements/${achId}`);

        if (!achData.success) {
            await interaction.reply(`Achievement with ID ${achId} not found!`);
            return;
        }
        
        const ach = achData.data.achievement;

        let achText = `### __Achievements -> [${ach.name}](https://ch.tetr.io/achievements/${achId})__`
        if (ach.object) achText += `\n**${capitalizeFirstLetter(ach.object)}**`
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
            // woomy
            for (const achType of achievementTiers) {
                if (!cutoffPercents[i] && ach.rt !== 3 || cutoffs[`${achType}_count`] === 0) {
                    i--;
                    continue;
                }

                let cutoffText = "";
                if (cutoffs[achType]) {
                    cutoffText = `**${formatAchievementVal(ach, cutoffs[achType], qp2Floors[i])}**`
                }
                if (cutoffPercents[i] === 100 && !cutoffs[`${achType}`]) {
                    cutoffText = `**Any**`
                }
                if (
                    cutoffPercents[i] === 100 && ach.min 
                    && ach.min !== -9007199254740991 // osk why T-T
                ) cutoffText = `**${formatAchievementVal(ach, ach.min, null)}**`

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

        const pageDefinitions = [
            {
                label: "Overview",
                content: achText,
            },
        ];

        if (!ach.nolb) {

            let lbText = `### __Achievements -> [${ach.name}](https://ch.tetr.io/achievements/${achId}) -> Leaderboard__\n\n`
            const lb = achData.data.leaderboard;
            const seenUsers = [];
            for (let i = 0; i < Math.min(15, lb.length); i++) { //just in case lb has less than 15 entries
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

            pageDefinitions.push({
                label: "Leaderboard",
                content: lbText,
            });
        }

        const achievementShortName = await database.Achievement.findByPk(achId).then(ach => ach.shortname);
        const leagueData = await database.LeagueStat.findByPk(`achievements/${achievementShortName}`);
        if (leagueData) {
            await updateRankTotals();

            const achievementCutoffNotes = {
                51: `${getEmoji('windup_2')} These averages don't include runs under 50.0m`,
                41: `${getEmoji('windup_2')} These averages don't include runs under 3 revives`,
                48: `${getEmoji('windup_2')} These averages don't include runs over 300 inputs`,
            };

            let leagueText = `### __Achievements -> [${ach.name}](https://ch.tetr.io/achievements/${achId}) -> League Averages__\n\n`
            
            let maxLength = 0;
            for (const rank of RANKS) {
                maxLength = Math.max(maxLength, formatAchievementVal(ach, leagueData.values[rank], null).length);
            }

            for (const rank of RANKS) {
                const emoji = getEmojiOfRank(rank);
                if (!leagueData.seenCount[rank] || !leagueData.values[rank]) {
                    continue;
                }

                if (ach.rt === 2) {
                    const value = `${formatNumber(leagueData.values[rank] * 100, 2)}%`
                    leagueText += `\n${emoji} **\`${"0".repeat(6 - value.length)}${value}\`**`;
                    continue;
                }

                const seenPercent = leagueData.seenCount[rank] / seenRankTotals[rank];
                const value = formatAchievementVal(ach, leagueData.values[rank], null);
                if (seenPercent > 0.7) {
                    leagueText += `\n${emoji} **\`${" ".repeat(maxLength - value.length)}${value}\`**`;
                } else if (seenPercent > 0.05) {
                    leagueText += `\n${emoji} \`${" ".repeat(maxLength - value.length)}${value}\` (*${formatNumber(seenPercent * 100, 2)}%*)`;
                } else {
                    continue;
                }
            }
            if (achievementCutoffNotes[achId]) {
                leagueText += `\n\n-# ${achievementCutoffNotes[achId]}\n`;
            } else {
                leagueText += `\n\n`;
            }
            leagueText += `-# Sample of 700 players per rank
-# Data updated <t:${Math.floor(new Date(leagueData.updatedAt).getTime() / 1000)}:R>`; //maybe add this to the other commands? idk

            pageDefinitions.push({
                label: "League Averages",
                content: leagueText,
            });
        }

        const key = interaction.id;
        const commandName = "achievement";
        const labels = pageDefinitions.map((page) => page.label);

        const pages = pageDefinitions.map((page, index) => {
            const container = new ContainerBuilder()
                .setAccentColor(0xa1ffd9)
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent(page.content),
                );

            if (pageDefinitions.length > 1) {
                container
                    .addActionRowComponents(
                        buildPageSelectRow({
                            commandName,
                            key,
                            labels,
                            activeIndex: index,
                        }),
                    );
            }

            return container;
        });

        if (pages.length > 1) {
            interaction.client.pageData.set(key, {
                commandName,
                ownerId: interaction.user.id,
                pages,
                labels,
                currentPage: 0,
                ttlMs: 10 * 60 * 1000,
                expiresAt: Date.now() + 10 * 60 * 1000,
                useComponentsV2: true,
            });
        }

        await interaction.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [pages[0]],
        });
    },
    async autocomplete(interaction) {
        return await autocomplete(interaction);
    }
}
