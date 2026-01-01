const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, InteractionContextType, ApplicationIntegrationType, MessageFlags } = require('discord.js');

const { formatNumber, escapeUnderscores, countryCodeToEmoji, convertToTimeFormat, playtimeConvert, getEmojiOfAch, getEmojiOfRank, reformatTimestamp, getModCombos, addRankComparisonField, buildModeHeaderEmbed } = require('../../helpers/functions');
const { getEmoji } = require('../../helpers/emojis');
const { database } = require('../../database'); 

let replayStatRankData = {};

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
        // show "Bot is thinking..." to avoid interaction timeout
        await interaction.deferReply();

        const replayAttachment = interaction.options.getAttachment('replay');

        if (!replayAttachment.name.endsWith('.ttr')) {
            return interaction.editReply({ content: 'Please upload a valid .ttr replay file.' });
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

            //check the gamemode
            let gamemode = "Unknown";
            if (replay.gamemode === 'zenith') gamemode = "Quick Play";
            if (replay.gamemode === 'zenithex') gamemode = "Quick Play EX";
            if (replay.gamemode === '40l') gamemode = "40 Lines";
            if (replay.gamemode === 'blitz') gamemode = "Blitz";

            // choose emoji for quickplay vs quickplay expert (zenithex)
            let quickplayEmoji = 'quickplay';
            if (replay.gamemode === 'zenithex') quickplayEmoji = 'quickplayexpert';
            
            let row; //for buttons

            //general stats
            const date = new Date(replay.ts);
            const formattedDate = `<t:${Math.floor(date.getTime() / 1000)}:F>`;


            const finesse = (replayStats.finesse.perfectpieces / replayStats.piecesplaced) ?? -1;


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

                const zenithStats = replayStats.zenith;


                // silly performance stuff idk
                const height = zenithStats.altitude;
                const pps = replayData.results.aggregatestats.pps;
                const apm = replayData.results.aggregatestats.apm;
                const climbSpeed = zenithStats.rank;
                const btb = replayStats.topbtb;


                // the function will just skip the "compared to [rank]" line.
                const effectiveRank = null; // or whatever idk

                let heightString = "";
                let ppsString = "";
                let apmString = "";
                let climbSpeedString = "";
                let btbString = "";
                let finesseString = "";

                //check if zenith expert
                const zenithMods = Array.isArray(replayData.options?.zenith_mods) ? replayData.options.zenith_mods : [];

                //big ass if statement
                if (replay.gamemode === "zenith") {
                    heightString = await buildReplayStatComparisonString(
                        'zenith/height',              // same db key as in /performance
                        'Meters',       
                        height,                      
                        effectiveRank,             // player baseline rank
                        { decimals: 1 }            // extras
                    );

                    ppsString = await buildReplayStatComparisonString(
                        'zenith/pps',              // same db key as in /performance
                        'Pieces Per Second',       
                        pps,                      
                        effectiveRank,             // player baseline rank
                        { decimals: 3 }            // extras
                    );

                    apmString = await buildReplayStatComparisonString(
                        'zenith/apm',              // same db key as in /performance
                        'Attack Per Minute',
                        apm,
                        effectiveRank,             // player baseline rank
                        { decimals: 2 }            // extras
                    );

                    climbSpeedString = await buildReplayStatComparisonString(
                        'zenith/climbSpeed',              // same db key as in /performance
                        'Average Climb Speed',
                        climbSpeed,
                        effectiveRank,             // player baseline rank
                        { decimals: 3 }            // extras
                    );

                    btbString = await buildReplayStatComparisonString(
                        'zenith/btb',              // same db key as in /performance
                        'Highest Back-to-Back',
                        btb,
                        effectiveRank,             // player baseline rank
                        { decimals: 0 }            // extras
                    );

                    finesseString = await buildReplayStatComparisonString(
                        'zenith/finesse',              // same db key as in /performance
                        'Finesse',
                        finesse,
                        effectiveRank,             // player baseline rank
                        { decimals: 4, isPercentage: true }            // extras
                    );
                } else if (replay.gamemode === "zenithex") {
                    //expert mode !! yay
                    heightString = await buildReplayStatComparisonString(
                        'zenithEx/height',              // same db key as in /performance
                        'Meters',       
                        height,                      
                        effectiveRank,             // player baseline rank
                        { decimals: 1 }            // extras
                    );

                    ppsString = await buildReplayStatComparisonString(
                        'zenithEx/pps',              // same db key as in /performance
                        'Pieces Per Second',       
                        pps,                      
                        effectiveRank,             // player baseline rank
                        { decimals: 3 }            // extras
                    );

                    apmString = await buildReplayStatComparisonString(
                        'zenithEx/apm',              // same db key as in /performance
                        'Attack Per Minute',
                        apm,
                        effectiveRank,             // player baseline rank
                        { decimals: 2 }            // extras
                    );

                    // only show/build climb speed if NOT reverse-expert
                    if (!zenithMods.includes('expert_reversed')) {
                        climbSpeedString = await buildReplayStatComparisonString(
                            'zenithEx/climbSpeed',              // same db key as in /performance
                            'Average Climb Speed',
                            climbSpeed,
                            effectiveRank,             // player baseline rank
                            { decimals: 3 }            // extras
                        );
                    } else {
                        // explicitly blank so the template doesn't print "null"
                        climbSpeedString = '';
                    }

                    btbString = await buildReplayStatComparisonString(
                        'zenithEx/btb',                        
                        'Highest Back-to-Back',
                        btb,
                        effectiveRank,                        
                        { decimals: 0 }                    
                    );

                    finesseString = await buildReplayStatComparisonString(
                        'zenithEx/finesse',              // same db key as in /performance
                        'Finesse',
                        finesse,
                        effectiveRank,             // player baseline rank
                        { decimals: 4, isPercentage: true }            // extras
                    );
            }

            let disclamer = "";

            // treat reverse-expert as expert for messaging
            const isExpertMod = mods.includes('expert') || zenithMods.includes('expert_reversed');

            // don't show a warning if the only mod is "expert" (including reversed)
            if (mods.length > 0 && !(mods.length === 1 && isExpertMod)) {
                if (isExpertMod) {
                    disclamer = `\n-# ${getEmoji("windup_4")} These stats are based off of Expert Quick Play runs without mods! Be wary when comparing.`;
                } else {
                    disclamer = `\n-# ${getEmoji("windup_4")} These stats are based off of Quick Play runs without mods! Be wary when comparing.`;
                }
            }

            // build performance block without empty lines
            const perfStatBlock = [heightString, ppsString, apmString, climbSpeedString, btbString, finesseString]
                .filter(s => typeof s === 'string' ? s.trim().length > 0 : Boolean(s))
                .join('\n');

            //full page
            const stats = replayStats;
            const garbageStats = replayStats.garbage;
            const handling = replayData.options.handling;

            let inputCounts = {};
            for (const h of ["hardDrop", "softDrop", "hold", "moveLeft", "moveRight", "rotateCW", "rotateCCW", "rotate180"]) inputCounts[h] = 0;
            for (const frameEvent of replayData.events) {
                if (frameEvent.type === 'keydown') {
                    inputCounts[frameEvent.data.key]++;
                }
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
- **Climbed ${zenithStats.altitude.toFixed(1)}m (Floor ${zenithStats.floor})**
  - Reached ${zenithStats.peakrank.toFixed(2)} climb speed, averaged ${zenithStats.rank.toFixed(2)}
  - Reached ${replayStats.topbtb} B2B
- **KO'd ${replayStats.kills} players**
  - Sent ${formatNumber(replayStats.garbage.sent)} lines 
  - Received ${formatNumber(replayStats.garbage.received)} lines

-# [${escapeUnderscores(replay.users[0].username).toUpperCase()}](https://ch.tetr.io/u/${replay.users[0].username}) ${countryCodeToEmoji(replay.users[0].country)} | ${formattedDate}
`),

                    new EmbedBuilder().setColor('#ffb980').setDescription(`### __[Replay ${replay.id} (${gamemode})](https://tetr.io/#R:${replay.id}) -> Full__
- **Placed ${stats.piecesplaced} pieces**
  - Held ${stats.holds} pieces
  - Pressed ${stats.inputs} inputs
    - ⇊ ${inputCounts.hardDrop} | ⇃ ${inputCounts.softDrop} | ⇄ ${inputCounts.hold}
    - ← ${inputCounts.moveLeft} | → ${inputCounts.moveRight}
    - ↶ ${inputCounts.rotateCCW} | ↷ ${inputCounts.rotateCW} | ⟳ ${inputCounts.rotate180}
  - ${handling.arr}F ARR | ${handling.das}F DAS | ${handling.sdf === 41 ? "∞" : handling.sdf}x SDF
- **Cleared ${stats.lines} lines**
  - ${stats.clears.singles} singles (${stats.clears.tspinsingles ?? 0} spins) 
  - ${stats.clears.doubles} doubles (${stats.clears.tspindoubles ?? 0} spins) 
  - ${stats.clears.triples} triples (${stats.clears.tspintriples ?? 0} spins)
  - ${stats.clears.quads} quads
- **Sent ${formatNumber(garbageStats.sent)} garbage lines**
  - Recieved ${formatNumber(garbageStats.received)}
  - Cleared ${formatNumber(garbageStats.cleared)}
  - Generated ${formatNumber(garbageStats.attack)} total attack
  - Sent a ${formatNumber(garbageStats.maxspike)} spike${finesse === -1 ? '' : `
- **Had ${(finesse * 100).toFixed(2)}% finesse**
  - Reached a ${stats.finesse.combo} chain
  - Made ${stats.finesse.faults} faults
  - Placed ${stats.finesse.perfectpieces} pieces perfectly`}
- **Scored ${formatNumber(stats.score)} points**
  - Reached a ${stats.topcombo} combo
  - Reached a ${stats.topbtb} Back-to-Back chain

-# [${escapeUnderscores(replay.users[0].username).toUpperCase()}](https://ch.tetr.io/u/${replay.users[0].username}) ${countryCodeToEmoji(replay.users[0].country)} | ${formattedDate}`),
                    new EmbedBuilder().setColor('#ff80d9')
                    .setDescription(`### __[Replay ${replay.id} (${gamemode})](https://tetr.io/#R:${replay.id}) -> Splits__
${splitFormat(zenithStats.splits)}
-# [${escapeUnderscores(replay.users[0].username).toUpperCase()}](https://ch.tetr.io/u/${replay.users[0].username}) ${countryCodeToEmoji(replay.users[0].country)} | ${formattedDate}                        `),
                    new EmbedBuilder().setColor('#80ffc4').setDescription(`### __[Replay ${replay.id} (${gamemode})](https://tetr.io/#R:${replay.id}) -> Performance__${disclamer}
${perfStatBlock}
-# [${escapeUnderscores(replay.users[0].username).toUpperCase()}](https://ch.tetr.io/u/${replay.users[0].username}) ${countryCodeToEmoji(replay.users[0].country)} | ${formattedDate}`),
                ]
                
                //initial row of buttons
                row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('replaypage_0')
                        .setLabel('Overview')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true), //disable the first button initially
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
            } else if (replay.gamemode === '40l') {

                // silly performance stuff idk
                const time = replayStats.finaltime;
                const pps = replayData.results.aggregatestats.pps;
                const kpp = replayStats.inputs / replayStats.piecesplaced;
                const kps = replayStats.inputs / (time / 1000);

                // the function will just skip the "compared to [rank]" line.
                const effectiveRank = null; // or whatever idk

                let timeString = "";
                let ppsString = "";
                let kppString = "";
                let kpsString = "";
                let finesseString = "";

                timeString = await buildReplayStatComparisonString(
                    'sprint/time',              // same db key as in /performance
                    'Time',
                    time,
                    effectiveRank,             // player baseline rank
                    { lowerIsBetter: true, isTime: true }            // extras
                );

                ppsString = await buildReplayStatComparisonString(
                    'sprint/pps',              // same db key as in /performance
                    'Pieces Per Second',       
                    pps,                      
                    effectiveRank,             // player baseline rank
                    { decimals: 3 }            // extras
                );

                kppString = await buildReplayStatComparisonString(
                    'sprint/kpp',              // same db key as in /performance
                    'Keys Per Piece',
                    kpp,
                    effectiveRank,             // player baseline rank
                    { decimals: 3 }            // extras
                );

                kpsString = await buildReplayStatComparisonString(
                    'sprint/kps',              // same db key as in /performance
                    'Keys Per Second',
                    kps,
                    effectiveRank,             // player baseline rank
                    { decimals: 3 }            // extras
                );

                finesseString = await buildReplayStatComparisonString(
                    'sprint/finesse',              // same db key as in /performance
                    'Finesse',
                    finesse,
                    effectiveRank,             // player baseline rank
                    { decimals: 4, isPercentage: true }            // extras
                );

                // build performance block without empty lines
                const perfStatBlock = [timeString, ppsString, kppString, kpsString, finesseString]
                    .filter(s => typeof s === 'string' ? s.trim().length > 0 : Boolean(s))
                    .join('\n');

                //full page
                const handling = replayData.options.handling;

                let inputCounts = {};
                for (const h of ["hardDrop", "softDrop", "hold", "moveLeft", "moveRight", "rotateCW", "rotateCCW", "rotate180"]) inputCounts[h] = 0;
                for (const frameEvent of replayData.events) {
                    if (frameEvent.type === 'keydown') {
                        inputCounts[frameEvent.data.key]++;
                    }
                }

                pages = [
                    new EmbedBuilder().setColor('#80ff80')
                .setDescription(`### __[Replay ${replay.id} (${gamemode})](https://tetr.io/#R:${replay.id}) -> Overview__
- **Finished in ${convertToTimeFormat(time)}**
  - ${pps.toFixed(2)} PPS
  - ${kpp.toFixed(2)} Keys Per Piece
  - ${kps.toFixed(2)} Keys Per Second
  - ${((finesse)*100).toFixed(2)}% Finesse | ${replayStats.finesse.faults} Faults

-# [${escapeUnderscores(replay.users[0].username).toUpperCase()}](https://ch.tetr.io/u/${replay.users[0].username}) ${countryCodeToEmoji(replay.users[0].country)} | ${formattedDate}
`),

                    new EmbedBuilder().setColor('#ffb980').setDescription(`### __[Replay ${replay.id} (${gamemode})](https://tetr.io/#R:${replay.id}) -> Full__
- **Placed ${replayStats.piecesplaced} pieces**
  - Held ${replayStats.holds} pieces
  - Pressed ${replayStats.inputs} inputs
    - ⇊ ${inputCounts.hardDrop} | ⇃ ${inputCounts.softDrop} | ⇄ ${inputCounts.hold}
    - ← ${inputCounts.moveLeft} | → ${inputCounts.moveRight}
    - ↶ ${inputCounts.rotateCCW} | ↷ ${inputCounts.rotateCW} | ⟳ ${inputCounts.rotate180}
  - ${handling.arr}F ARR | ${handling.das}F DAS | ${handling.sdf === 41 ? "∞" : handling.sdf}x SDF
- **Cleared ${replayStats.lines} lines**
  - ${replayStats.clears.singles} singles (${replayStats.clears.tspinsingles ?? 0} spins) 
  - ${replayStats.clears.doubles} doubles (${replayStats.clears.tspindoubles ?? 0} spins) 
  - ${replayStats.clears.triples} triples (${replayStats.clears.tspintriples ?? 0} spins)
  - ${replayStats.clears.quads} quads${finesse === -1 ? '' : `
- **Had ${(finesse * 100).toFixed(2)}% finesse**
  - Reached a ${replayStats.finesse.combo} chain
  - Made ${replayStats.finesse.faults} faults
  - Placed ${replayStats.finesse.perfectpieces} pieces perfectly`}

-# [${escapeUnderscores(replay.users[0].username).toUpperCase()}](https://ch.tetr.io/u/${replay.users[0].username}) ${countryCodeToEmoji(replay.users[0].country)} | ${formattedDate}`),
                    new EmbedBuilder().setColor('#80ffc4').setDescription(`### __[Replay ${replay.id} (${gamemode})](https://tetr.io/#R:${replay.id}) -> Performance__
${perfStatBlock}
-# [${escapeUnderscores(replay.users[0].username).toUpperCase()}](https://ch.tetr.io/u/${replay.users[0].username}) ${countryCodeToEmoji(replay.users[0].country)} | ${formattedDate}`),
                ]
                
                //initial row of buttons
                row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('replaypage_0')
                        .setLabel('Overview')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true), //disable the first button initially
                    new ButtonBuilder()
                        .setCustomId('replaypage_1')
                        .setLabel('Full')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('replaypage_2')
                        .setLabel('Performance')
                        .setStyle(ButtonStyle.Primary)
                );

            } else if (replay.gamemode === 'blitz') {
                const score = replayStats.score;
                const pps = replayData.results.aggregatestats.pps;
                const spp = score / replayStats.piecesplaced;

                // the function will just skip the "compared to [rank]" line.
                const effectiveRank = null; // or whatever idk

                let scoreString = "";
                let ppsString = "";
                let sppString = "";
                let finesseString = "";

                scoreString = await buildReplayStatComparisonString(
                    'blitz/score',              // same db key as in /performance
                    'Score',
                    score,
                    effectiveRank,             // player baseline rank
                    { decimals: 0 }            // extras
                );

                ppsString = await buildReplayStatComparisonString(
                    'blitz/pps',              // same db key as in /performance
                    'Pieces Per Second',
                    pps,                      
                    effectiveRank,             // player baseline rank
                    { decimals: 3 }            // extras
                );

                sppString = await buildReplayStatComparisonString(
                    'blitz/spp',              // same db key as in /performance
                    'Score Per Piece',
                    spp,
                    effectiveRank,             // player baseline rank
                    { decimals: 2 }            // extras
                );


                finesseString = await buildReplayStatComparisonString(
                    'blitz/finesse',              // same db key as in /performance
                    'Finesse',
                    finesse,
                    effectiveRank,             // player baseline rank
                    { decimals: 4, isPercentage: true }            // extras
                );

                // build performance block without empty lines
                const perfStatBlock = [scoreString, ppsString, sppString, finesseString]
                    .filter(s => typeof s === 'string' ? s.trim().length > 0 : Boolean(s))
                    .join('\n');

                //full page
                const handling = replayData.options.handling;

                let inputCounts = {};
                for (const h of ["hardDrop", "softDrop", "hold", "moveLeft", "moveRight", "rotateCW", "rotateCCW", "rotate180"]) inputCounts[h] = 0;
                for (const frameEvent of replayData.events) {
                    if (frameEvent.type === 'keydown') {
                        inputCounts[frameEvent.data.key]++;
                    }
                }

                pages = [
                    new EmbedBuilder().setColor('#80ff80')
                .setDescription(`### __[Replay ${replay.id} (${gamemode})](https://tetr.io/#R:${replay.id}) -> Overview__
- **Scored ${formatNumber(score)} points**
  - ${pps.toFixed(2)} PPS
  - ${spp.toFixed(2)} Points Per Piece
  - ${((finesse)*100).toFixed(2)}% Finesse | ${replayStats.finesse.faults} Faults

-# [${escapeUnderscores(replay.users[0].username).toUpperCase()}](https://ch.tetr.io/u/${replay.users[0].username}) ${countryCodeToEmoji(replay.users[0].country)} | ${formattedDate}
`),

                    new EmbedBuilder().setColor('#ffb980').setDescription(`### __[Replay ${replay.id} (${gamemode})](https://tetr.io/#R:${replay.id}) -> Full__
- **Placed ${replayStats.piecesplaced} pieces**
  - Held ${replayStats.holds} pieces
  - Pressed ${replayStats.inputs} inputs
    - ⇊ ${inputCounts.hardDrop} | ⇃ ${inputCounts.softDrop} | ⇄ ${inputCounts.hold}
    - ← ${inputCounts.moveLeft} | → ${inputCounts.moveRight}
    - ↶ ${inputCounts.rotateCCW} | ↷ ${inputCounts.rotateCW} | ⟳ ${inputCounts.rotate180}
  - ${handling.arr}F ARR | ${handling.das}F DAS | ${handling.sdf === 41 ? "∞" : handling.sdf}x SDF
- **Cleared ${replayStats.lines} lines**
  - ${replayStats.clears.singles} singles (${replayStats.clears.tspinsingles ?? 0} spins) 
  - ${replayStats.clears.doubles} doubles (${replayStats.clears.tspindoubles ?? 0} spins) 
  - ${replayStats.clears.triples} triples (${replayStats.clears.tspintriples ?? 0} spins)
  - ${replayStats.clears.quads} quads${finesse === -1 ? '' : `
- **Had ${(finesse * 100).toFixed(2)}% finesse**
  - Reached a ${replayStats.finesse.combo} chain
  - Made ${replayStats.finesse.faults} faults
  - Placed ${replayStats.finesse.perfectpieces} pieces perfectly`}

-# [${escapeUnderscores(replay.users[0].username).toUpperCase()}](https://ch.tetr.io/u/${replay.users[0].username}) ${countryCodeToEmoji(replay.users[0].country)} | ${formattedDate}`),
                    new EmbedBuilder().setColor('#80ffc4').setDescription(`### __[Replay ${replay.id} (${gamemode})](https://tetr.io/#R:${replay.id}) -> Performance__
${perfStatBlock}
-# [${escapeUnderscores(replay.users[0].username).toUpperCase()}](https://ch.tetr.io/u/${replay.users[0].username}) ${countryCodeToEmoji(replay.users[0].country)} | ${formattedDate}`),
                ]
                
                //initial row of buttons
                row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('replaypage_0')
                        .setLabel('Overview')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true), //disable the first button initially
                    new ButtonBuilder()
                        .setCustomId('replaypage_1')
                        .setLabel('Full')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('replaypage_2')
                        .setLabel('Performance')
                        .setStyle(ButtonStyle.Primary)
                );                
            } else {
                return interaction.editReply({content: 'This type of replay file has not been accounted for yet, please contact the developers if you believe this is a mistake.'})
            }

            //send the initial message with the first page and buttons
            await interaction.editReply({
                embeds: [pages[0]],
                components: [row]
            });

            //attach pages to the interaction for future reference
            interaction.client.pageData = {
                [interaction.id]: {
                    pages,
                    currentPage: 0
                }
            };
            
        } catch (error) {
            console.error('Error analyzing replay:', error);
            return interaction.editReply({ content: 'An error occurred while analyzing the replay. Please ensure it is a valid .ttr file.' });
        }
    }
};

function framesToTime(frames) {
    const fps = 60; // frames per second (wow really genius)
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
    ];

    const lines = [];
    for (let idx = 0; idx < splits.length; idx++) {
        const totalMs = splits[idx];
        if (!totalMs || typeof totalMs !== 'number' || totalMs <= 0) {
            lines.push(`${floors[idx]} \`x:xx:xxx\``);
            break;
        }
        const prevTime = idx === 0 ? 0 : (splits[idx - 1] || 0);
        const delta = totalMs - prevTime;
        lines.push(`${floors[idx]} \`${fmt(delta)}\` \`${fmt(totalMs)}\``);
    }

    return lines.join('\n');
}

async function getClosestRankForReplay(userValue, statKey, lowerIsBetter = false) {
    if (!replayStatRankData[statKey]) {
        const row = await database.LeagueStat.findByPk(statKey);
        // guard in case the DB returns nothing
        replayStatRankData[statKey] = row?.values || {};
    }

    let bestRank = 'd';
    let bestDiff = Infinity;

    for (const [rank, value] of Object.entries(replayStatRankData[statKey])) {
        if (!value) continue;
        const diff = Math.abs(Number(userValue) - value);

        if (diff < bestDiff) {
            bestRank = rank;
            bestDiff = diff;
        } else if (diff === bestDiff) {
            // tie-breaker: bias toward the “better” rank
            const better =
                (!lowerIsBetter && value > replayStatRankData[statKey][bestRank]) ||
                (lowerIsBetter && value < replayStatRankData[statKey][bestRank]);
            if (better) bestRank = rank;
        }
    }

    return bestRank;
}

//this is probably bigger than i should make functions but oh well
//next time ill split it up better
async function buildReplayStatComparisonString(
    dbStatKey,
    statName,
    statValue,
    effectiveRank,
    extras = { lowerIsBetter: false, isTime: false, decimals: 2, isPercentage: false }
) {
    if (statValue == null || !isFinite(Number(statValue))) return null;

    const lowerIsBetter = !!extras.lowerIsBetter;
    const decimals = Number.isInteger(extras.decimals) ? extras.decimals : 2;

    const delta = (x, ref) => (lowerIsBetter ? (ref - x) : (x - ref));

    const fmtValue = (value) => {
        if (extras.isTime) {
            const seconds = value / 1000;
            if (value >= 60000)
                return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
            return seconds.toFixed(2) + 's';
        }

        if (extras.isPercentage) return (value * 100).toFixed(2) + '%';
        if (decimals === 0) return formatNumber(Math.round(value));

        const decimalShift = 10 ** decimals;
        return (
            formatNumber(Math.floor(value)) +
            '.' +
            (Math.floor(value * decimalShift) % decimalShift)
                .toString()
                .padStart(decimals, '0')
        );
    };

    const fmtDelta = (deltaValue) => {
        const sign = deltaValue > 0 ? '+' : deltaValue === 0 ? '±' : '';

        if (extras.isTime) return `${sign}${(deltaValue / 1000).toFixed(2)}s`;
        if (extras.isPercentage) return `${sign}${(deltaValue * 100).toFixed(2)}%`;
        if (decimals === 0) return `${sign}${formatNumber(Math.round(deltaValue))}`;

        return `${sign}${Number(deltaValue).toFixed(decimals)}`;
    };

    //“around” rank for this stat
    const avgRank = await getClosestRankForReplay(statValue, dbStatKey, lowerIsBetter);
    const avgRankValue = replayStatRankData[dbStatKey][avgRank];
    const deltaToAvg =
        avgRankValue != null && isFinite(Number(avgRankValue))
            ? delta(statValue, Number(avgRankValue))
            : null;

    //user’s baseline rank
    let userRankLabel = null;
    let userRankValue = null;

    if (effectiveRank && effectiveRank !== 'z') {
        userRankLabel = getEmojiOfRank(effectiveRank);
        userRankValue = replayStatRankData[dbStatKey][effectiveRank];
    } else {
        userRankLabel = 'Unranked';
    }

    const deltaToUser =
        userRankValue != null && isFinite(Number(userRankValue))
            ? delta(statValue, Number(userRankValue))
            : null;

    const displayValue = fmtValue(statValue);
    const lines = [`**${displayValue} ${statName}**`];

    const userRankLetter = effectiveRank || null;

    // “around …” line (only if different from the user’s rank)
    if (avgRank && deltaToAvg !== null && avgRank !== userRankLetter) {
        lines.push(`- around ${getEmojiOfRank(avgRank)} (${fmtDelta(deltaToAvg)})`);
    }

    //“compared to [current rank]” line
    if (userRankLabel !== 'Unranked') {
        if (deltaToUser !== null) {
            lines.push(`- ${fmtDelta(deltaToUser)} compared to ${userRankLabel}`);
        } else {
            lines.push(`- compared to ${userRankLabel}`);
        }
    }

    //“compared to next rank …” line
    if (avgRank && avgRank !== 'x+') {
        const order = Object.keys(replayStatRankData[dbStatKey]);
        const avgIdx = order.findIndex((rk) => rk === avgRank);
        const nextIdx = avgIdx >= 0 ? avgIdx + 1 : -1;
        const nextRow = nextIdx >= 0 && nextIdx < order.length ? order[nextIdx] : null;
        const isRedundant = nextRow && nextRow === userRankLetter;

        if (nextRow && !isRedundant) {
            const nextAvg = replayStatRankData[dbStatKey][nextRow];
            if (nextAvg != null && isFinite(Number(nextAvg))) {
                lines.push(
                    `- ${fmtDelta(delta(statValue, Number(nextAvg)))} compared to next rank (${getEmojiOfRank(
                        nextRow
                    )})`
                );
            }
        }
    }

    return lines.join('\n');
}
