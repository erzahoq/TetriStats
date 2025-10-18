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

            console.log(replayStats);

            //check the gamemode
            let gamemode = "Unknown";
            if (replay.gamemode === 'zenith') gamemode = "Quick Play";
            if (replay.gamemode === 'zenithex') gamemode = "Quick Play EX";
            if (replay.gamemode === '40l') gamemode = "40 Lines";
            if (replay.gamemode === 'blitz') gamemode = "Blitz";

            let row; //for buttons

            //general stats
            const date = new Date(replay.ts);
            const formattedDate = `<t:${Math.floor(date.getTime() / 1000)}:F>`;


            //=== For each gamemode, create a list of pages ===
            // Zenith gamemode :3
            // expert and normal are together because their stats are extremely similar
            if (replay.gamemode === "zenith" || replay.gamemode === "zenithex") {      

                pages = [
                    new EmbedBuilder()
                    .setDescription(`### __[Replay ${replay.id} (${gamemode})](https://tetr.io/#R:${replay.id}) -> Overview__
**[${escapeUnderscores(replay.users[0].username).toUpperCase()}](https://ch.tetr.io/u/${replay.users[0].username}) ${countryCodeToEmoji(replay.users[0].country)}**
${formattedDate}
__**General**__
- Time: ${framesToTime(replayData.frames)} | Pieces Placed: ${formatNumber(replayStats.piecesplaced)} | Lines Cleared: ${formatNumber(replayStats.lines)}
- PPS: ${replayData.results.aggregatestats.pps.toFixed(2)} | APM: ${replayData.results.aggregatestats.apm.toFixed(2)} | VS: ${replayData.results.aggregatestats.vsscore.toFixed(2)}\n
__**Stats**__
- Altitude: ${replayStats.zenith.altitude.toFixed(1)} (Floor ${replayStats.zenith.floor})
- Avg. Climb Speed: ${replayStats.zenith.rank.toFixed(2)} | Max Climb Speed: ${replayStats.zenith.peakrank.toFixed(2)}
- B2B: \n
__**Garbage**__
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
    if (mods.length === 0) {
        return "None";
    }

    //special combos of mods check
    //A Modern Classic
    if (JSON.stringify(mods.map(mod => mod.toLowerCase())) === JSON.stringify(["gravity", "nohold"])) {
        return "A Modern Classic (No Hold, Gravity)"; // Return a specific message
    }
    //Deadlock
    else if (JSON.stringify(mods.map(mod => mod.toLowerCase())) === JSON.stringify(["doublehole", "messy", "nohold"])) {
        return "Deadlock (No Hold, Double Hole Garbage, Messier Garbage)"; // Return a specific message
    }

    //TODO ADD THE REST OF THE SPECIAL MODS
    //VERY IMPORTANT !!!


    const formattedWords = mods
    .map(mod => {
        if (mod.toLowerCase() === 'doublehole') return "Double Hole"
        else if (mod.toLowerCase() === 'nohold') return "No Hold"
        else if (mod.toLowerCase() === 'messy') return "Messier Garbage"
 
        return mod.charAt(0).toUpperCase() + mod.slice(1).toLowerCase(); //capitals (of cities)
    })
    .reverse(); // reverse the list :thubm_up:


    // Join the formatted mods
    return formattedWords.join(", ");
}

