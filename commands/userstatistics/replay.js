const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, InteractionContextType, ApplicationIntegrationType } = require('discord.js');

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
            return interaction.reply({ content: 'Please upload a valid .ttr replay file.', ephemeral: true });
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
            const replayData = JSON.parse(replayDataBuffer.toString());

            //initially define list of pages 
            let pages = [];

            console.log(replayData.replay.results.stats);

            //=== For each gamemode, create a list of pages ===
            // Zenith gamemode :3
            // expert and normal are together because their stats are extremely similar
            if (replayData.gamemode === "zenith" || replayData.gamemode === "zenithex") {

                //check the gamemode
                let gamemode = "Quick Play"
                if (replayData.gamemode === 'zenithex') gamemode = "Expert Quick Play"
                

                pages = [
                    new EmbedBuilder().setTitle('Replay Analysis - General')
                        .setColor('#ff9747')
                        .setDescription(`**Here\'s the summary of your replay:**
Gamemode: ${gamemode}
Player: ${replayData.users?.[0]?.username} (${countryCodeToEmoji(replayData.users?.[0]?.country)})
Playtime: ${framesToTime(replayData.replay?.frames)} (${(replayData.replay?.frames / 60).toFixed(2)}s)
Mods Used: ${formatModList(replayData.replay.options.zenith_mods)}

-# i can probably add more here but`),
                    new EmbedBuilder()
                        .setTitle('Replay Analysis - Statistics')
                        .setColor('#ff9747').setDescription(`**Here are some statistics of your replay:**
APM: ${(replayData.replay.results.aggregatestats.apm).toFixed(2)} | PPS: ${(replayData.replay.results.aggregatestats.pps).toFixed(2)} | VS: ${(replayData.replay.results.aggregatestats.vsscore).toFixed(2)}`),
                    new EmbedBuilder().setTitle('page3'), new EmbedBuilder().setTitle('page4')
                ]
                
            } else {
                return interaction.reply({content: 'This type of replay file has not been accounted for yet, please contact the developers if you believe this is a mistake.', ephemeral: true})
            }

            // Initial row of buttons
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('replaypage_0')
                    .setLabel('General')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true), // Disable the first button initially
                new ButtonBuilder()
                    .setCustomId('replaypage_1')
                    .setLabel('Stats')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('replaypage_2')
                    .setLabel('Tetra League')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('replaypage_3')
                    .setLabel('4')
                    .setStyle(ButtonStyle.Primary)
            );

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
            return interaction.reply({ content: 'An error occurred while analyzing the replay. Please ensure it is a valid .ttr file.', ephemeral: true });
        }
    }
};

// Convert country code to flag emoji
function countryCodeToEmoji(countryCode) {
    if (countryCode === 'XM') return ("<:flag_xm:1310891739078328374>");
    if (!countryCode) return ("❔"); //if a country isn't set i guess
    const codePoints = countryCode
        .toUpperCase() // Make sure the code is uppercase
        .split('')     // Split the letters
        .map(char => 127397 + char.charCodeAt()); // Convert to regional indicator symbol

    return String.fromCodePoint(...codePoints);
}

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
