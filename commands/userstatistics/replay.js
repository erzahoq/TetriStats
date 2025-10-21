const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, InteractionContextType, ApplicationIntegrationType, MessageFlags } = require('discord.js');

const { formatNumber, escapeUnderscores, countryCodeToEmoji, convertToTimeFormat, playtimeConvert, getEmojiOfAch, getEmojiOfRank, reformatTimestamp, calculateLevel, getModCombos } = require('../../helpers/functions');
const { getEmoji } = require('../../helpers/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('analyzereplay')
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
        .setDescription('Analyzes a TETR.IO replay file uploaded by the user.')
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

            console.log(replayStats);

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
                
                
                let combos = getModCombos(replayData.options.zenith_mods)

                let emojis = combos.emojis || "";
                let flavour = combos.flavour || "";
                let foundEntry = combos.name || "";
                let mods = combos.mods || [];

                let modString = `${emojis} **${foundEntry}**\n-# *${flavour}*`

                if (mods.length === 0) {
                    modString = ``
                }

                 // human-friendly mod names
                const modNames = {
                    nohold: 'No Hold',
                    doublehole: 'Double Hole',
                    messy: 'Messy',
                    allspin: 'All-Spin',
                    gravity: 'Gravity',
                    invisible: 'Invisible',
                    expert: 'Expert',
                    volatile: 'Volatile'
                }

                const modNamesList = mods.slice().reverse().map(m => modNames[m] || m).join(', ');


                if (mods.length > 0 && !foundEntry) {
                    modString = `${emojis}\n-# ${modNamesList}`
                }

                pages = [
                    new EmbedBuilder().setColor('#80ff80')
                    .setDescription(`### __[Replay ${replay.id} (${gamemode})](https://tetr.io/#R:${replay.id}) -> Overview__
${modString}
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

                    new EmbedBuilder().setTitle("Full"),
                    new EmbedBuilder().setColor('#ff80d9')
                    .setDescription(`### __[Replay ${replay.id} (${gamemode})](https://tetr.io/#R:${replay.id}) -> Splits__
${splitFormat(replayStats.zenith.splits)}
-# [${escapeUnderscores(replay.users[0].username).toUpperCase()}](https://ch.tetr.io/u/${replay.users[0].username}) ${countryCodeToEmoji(replay.users[0].country)} | ${formattedDate}                        `),
                    new EmbedBuilder().setTitle("Performance"),
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

function splitFormat(splits) {
    if (!Array.isArray(splits) || splits.length === 0) return 'No splits available';

    const fmt = (ms) => {
        if (typeof ms !== 'number' || ms <= 0) return '0:00.000';
        const totalMs = Math.max(0, Math.floor(ms));
        const hours = Math.floor(totalMs / 3600000);
        const minutes = Math.floor((totalMs % 3600000) / 60000);
        const seconds = Math.floor((totalMs % 60000) / 1000);
        const milliseconds = totalMs % 1000;
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
        }
        return `${minutes}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
    };

    const floors = [
        "`Floor 1: Hall of Beginnings` `-----`",
        "`Floor 2: The Hotel` `--------------`",
        "`Floor 3: The Casino` `-------------`",
        "`Floor 4: The Arena` `--------------`",
        "`Floor 5: The Museum` `-------------`",
        "`Floor 6: Abandoned Offices` `------`",
        "`Floor 7: The Laboratory` `---------`",
        "`Floor 8: The Core` `---------------`",
        "`Floor 9: Corruption` `-------------`",
        "`Floor 10: Platform of the Gods` `--`"
    ]

    const lines = splits.map((totalMs, idx) => {
        const floor = idx + 1; // splits[0] is time to finish floor 1
        if (!totalMs || typeof totalMs !== 'number' || totalMs <= 0) {
            return `${floors[floor]} \`x:xx:xxx\``;
        }
        const prevTime = idx === 0 ? 0 : (splits[idx - 1] || 0);
        const delta = totalMs - prevTime;
        return `${floors[floor]} \`${fmt(delta)}\` \`${fmt(totalMs)}\``;
    });

    return lines.join('\n');
}