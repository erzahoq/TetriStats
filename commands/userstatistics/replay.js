const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('analyzereplay')
        .setDescription('Analyzes a Tetr.io replay file uploaded by the user.')
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

            //=== For each gamemode, create a list of pages ===
            // Zenith gamemode :3
            if (replayData.gamemode === "zenith") {
                console.log(replayData/*.replay.results.stats*/);

                pages = [
                    new EmbedBuilder().setTitle('Replay Analysis')
                        .setColor('#ff9747')
                        .setDescription(`**Here\'s the summary of your replay:**
Gamemode: Quick Play
Player: ${replayData.users?.[0]?.username} (${countryCodeToEmoji(replayData.users?.[0]?.country)})
Playtime: ${framesToTime(replayData.replay?.frames)} (${(replayData.replay?.frames / 60).toFixed(2)}s)`),
                    new EmbedBuilder().setTitle('page2'), new EmbedBuilder().setTitle('page3'), new EmbedBuilder().setTitle('page4')
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
                    .setLabel('Records')
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
