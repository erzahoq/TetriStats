const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, InteractionContextType, ApplicationIntegrationType, MessageFlags } = require('discord.js');

const { formatNumber, escapeUnderscores, countryCodeToEmoji, convertToTimeFormat, playtimeConvert, getEmojiOfAch, getEmojiOfRank, reformatTimestamp, calculateLevel } = require('../../helpers/functions');
const { getEmoji } = require('../../helpers/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('analyzereplay')
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
        .setDescription('(WIP) Analyzes a Tetr.io replay file uploaded by the user.')
        .addAttachmentOption(option =>
            option.setName('replay')
                .setDescription('The replay file to analyze (.ttr format).')
                .setRequired(true)),

    async execute(interaction) {
        const replayAttachment = interaction.options.getAttachment('replay');

        if (!replayAttachment.name.endsWith('.ttr')) {
            return interaction.reply({ content: 'Please upload a valid .ttr replay file.', flags: MessageFlags.Ephemeral });
        }

        try {
            // Fetch the replay file
            const response = await fetch(replayAttachment.url);
            if (!response.ok) {
                throw new Error(`Failed to fetch replay file: ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const replayDataBuffer = Buffer.from(arrayBuffer);

            // Parse the file as JSON
            const replay = JSON.parse(replayDataBuffer.toString());

            let replayData = replay.replay;

            let replayStats = replayData.results.stats;

            //initially define list of pages 
            let pages = [];

            console.log(replayData);

            //check the gamemode
            let gamemode = "Unknown";
            if (replay.gamemode === 'zenith') gamemode = "Quick Play";
            if (replay.gamemode === 'zenithex') gamemode = "Quick Play EX";

            // choose emoji for quickplay vs quickplay expert (zenithex)
            let quickplayEmoji = 'quickplay';
            if (replay.gamemode === 'zenithex') quickplayEmoji = 'quickplayexpert';
            
            let row; //for buttons

            //general stats
            const date = new Date(replay.ts);
            const formattedDate = `<t:${Math.floor(date.getTime() / 1000)}:F>`;


            //=== For each gamemode, create a list of pages ===
            // Zenith gamemode :3
            // expert and normal are together because their stats are extremely similar
            if (replay.gamemode === "zenith" || replay.gamemode === "zenithex") {      

                pages = [
                    new EmbedBuilder().setColor('#80ff80')
                    .setDescription(`### __[Replay ${replay.id} (${gamemode})](https://tetr.io/#R:${replay.id}) -> Overview__
${formatModList(replayData.options.zenith_mods)}
- **Finished in ${framesToTime(replayData.frames)}**
  - ${replayData.results.aggregatestats.pps.toFixed(2)} PPS
  - ${replayData.results.aggregatestats.apm.toFixed(2)} APM
  - ${replayData.results.aggregatestats.vsscore.toFixed(2)} VS Score
  - ${((replayStats.finesse.perfectpieces/replayStats.piecesplaced)*100).toFixed(2)}% Finesse | ${replayStats.finesse.faults} Faults
- **Climbed ${replayStats.zenith.altitude.toFixed(1)}m (Floor ${replayStats.zenith.floor})**
  - Reached ${replayStats.zenith.peakrank.toFixed(2)} climb speed, averaged ${replayStats.zenith.rank.toFixed(2)}
  - Reached ${replayStats.topbtb} B2B
- **KO'd ${replayStats.kills} players**
  - Sent ${formatNumber(replayStats.garbage.sent)} lines 
  - Received ${formatNumber(replayStats.garbage.received)} lines

-# [${escapeUnderscores(replay.users[0].username).toUpperCase()}](https://ch.tetr.io/u/${replay.users[0].username}) ${countryCodeToEmoji(replay.users[0].country)} | ${formattedDate}
`),

                    new EmbedBuilder(),
                    new EmbedBuilder(),
                    new EmbedBuilder(),
                ]
                
                // Initial row of buttons
                row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('replaypage_0')
                        .setLabel('Overview')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true), // Disable the first button initially
                    new ButtonBuilder()
                        .setCustomId('replaypage_1')
                        .setLabel('Full')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('replaypage_2')
                        .setLabel('Splits')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('replaypage_3')
                        .setLabel('Performance')
                        .setStyle(ButtonStyle.Primary)
                );
            } else {
                return interaction.reply({content: 'This type of replay file has not been accounted for yet, please contact the developers if you believe this is a mistake.', flags: MessageFlags.Ephemeral})
            }

            // Send the initial message with the first page and buttons
            await interaction.reply({
                embeds: [pages[0]],
                components: [row]
            });

            // Attach pages to the interaction for future reference
            interaction.client.pageData = {
                [interaction.id]: {
                    pages,
                    currentPage: 0
                }
            };
            
        } catch (error) {
            console.error('Error analyzing replay:', error);
            return interaction.reply({ content: 'An error occurred while analyzing the replay. Please ensure it is a valid .ttr file.', flags: MessageFlags.Ephemeral });
        }
    }
};

function framesToTime(frames) {
    const fps = 60; // frames per second
    const totalSeconds = frames / fps;

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor((totalSeconds % 1) * 1000);

    // Format as MM:SS.MSMS
    const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
    return formattedTime;
}

function formatModList(mods) {
    if (!mods || mods.length === 0) {
        return "";
    }

    let combo = "";

    // define combos: entries either list exact mods, or specify allowedMods + count (for "any N of M" rules)
    const combos = [
        { name: "Deadlock", mods: ['nohold', 'doublehole', 'messy'] },
        { name: "The Starving Artist", mods: ['nohold', 'allspin'] },
        { name: "The Grandmaster", mods: ['gravity', 'invisible'] },
        { name: "The Con Artist", mods: ['expert', 'volatile', 'allspin'] },
        { name: "Divine Mastery", mods: ['expert', 'doublehole', 'volatile', 'messy'] },
        { name: "A Modern Classic", mods: ['nohold', 'gravity'] },
        { name: "The Escape Artist", mods: ['doublehole', 'messy', 'allspin'] },
        { name: "Block Rationing", mods: ['expert', 'messy'] },
        { name: "Emperor's Decadence", mods: ['expert', 'doublehole', 'nohold'] },
        //any 7 of the 8 mods
        { name: "Swamp Water Lite", allowedMods: ['nohold', 'doublehole', 'messy', 'allspin', 'gravity', 'invisible', 'expert', 'volatile'], count: 7 },
        { name: "Swamp Water", mods: ['nohold', 'doublehole', 'messy', 'allspin', 'gravity', 'invisible', 'expert', 'volatile'] },

        //reversed mods
        { name: "Asceticism", mods: ["nohold_reversed"] },
        { name: "Freefall", mods: ["gravity_reversed"] },
        { name: "The Exile", mods: ["invisible_reversed"] },
        { name: "Loaded Dice", mods: ["messy_reversed"] },
        { name: "The Warlock", mods: ["allspin_reversed"] },
        { name: "Damnation", mods: ["doublehole_reversed"] },
        { name: "Last Stand", mods: ["volatile_reversed"] },
        { name: "The Tyrant", mods: ["expert_reversed"] },
    ];

    const flavourTexts = {
        "Deadlock": "\"Escape has become a distant dream, yet still we struggle...\"",
        "The Starving Artist": "Creativity cultivated through limitation.",
        "The Grandmaster": "When the world descends into chaos, the grandmaster remains at peace.",
        "The Con Artist": "Would the perfect lie not be an art worthy of admiration?",
        "Divine Mastery": "The universe is yours.",
        "A Modern Classic": "Times were different back then...",
        "The Escape Artist": "\"An impossible situation! A daring illusionist! Will he make it out alive?\"",
        "Block Rationing": "Adversity favours the resourceful.",
        "Emperor's Decadence": "The Devil's lesson in humility.",
        "Swamp Water Lite": "Comes in 8 different flavors!",
        "Swamp Water": "The worst of all worlds.",
        "Asceticism": "A detachment from even that which is moderate.",
        "Freefall": "In retrospect, the ground you stood on never existed in the first place.",
        "The Exile": "Never underestimate blind faith.",
        "Loaded Dice": "In a rigged game, your mind is the only fair advantage.",
        "The Warlock": "Into realms beyond heaven and earth.",
        "Damnation": "Neither the freedom of life or peace of death.",
        "Last Stand": "Strength isn't necessary for those with nothing to lose.",
        "The Tyrant": "Fear, oppression, and limitless ambition.",
    }

    const modsSet = new Set(mods);

    for (const entry of combos) {
        if (entry.mods) {
            const reqSet = new Set(entry.mods);
            if (modsSet.size === reqSet.size && entry.mods.every(m => modsSet.has(m))) {
                combo = entry.name;
                break;
            }
        } else if (entry.allowedMods && Number.isInteger(entry.count)) {
            // match when mods contains exactly `count` items and all are within allowedMods
            if (modsSet.size === entry.count && [...modsSet].every(m => entry.allowedMods.includes(m))) {
                combo = entry.name;
                break;
            }
        }
    }

    const emojis = mods
        .map(mod => getEmoji("mod_" + mod))
        .reverse()
        .join(""); // reverse the list and join

    if (combo) {
        const flavour = flavourTexts[combo] ? `${flavourTexts[combo]}` : "";
        // bold combo name, include flavour text on same line, then newline before mod icons
        return `${emojis} **${combo}**\n-# *${flavour}*`;
    }

    return emojis;
}

