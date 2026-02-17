const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, ApplicationIntegrationType } = require('discord.js');

const { formatNumber, countryCodeToEmoji, formatTime, getEmojiOfRank, getModCombos, formatISOString, formatUsername } = require('../../helpers/formatters');
const { getEmoji } = require('../../helpers/emojis');
const { database } = require('../../database'); 

let replayStatRankData = {};


// TODO: reformat this hell


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

        if (!replayAttachment.name.endsWith('.ttr') && !replayAttachment.name.endsWith('.json')) {
            return interaction.editReply({ content: 'Please upload a valid .ttr replay file.' });
        }
        
        // Fetch the replay file
        const response = await fetch(replayAttachment.url);
        if (!response.ok) {
            throw new Error(`Failed to fetch replay file: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const replayDataBuffer = Buffer.from(arrayBuffer);

        // Parse the file as JSON
        const replay = JSON.parse(replayDataBuffer.toString());
        if (!replay || !replay.id || !replay.users) { // some easy checks to see if common replay file structure is there
            return interaction.editReply({ content: 'The uploaded file does not appear to be a valid TETR.IO replay.' });
            // note this doesn't technically prevent uploading malformed files
            // with the right structure but it's a start and should catch most user errors
        }

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

        // common stats
        const replayLinkFormat = `[Replay ${replay.id} (${gamemode})](https://tetr.io/#R:${replay.id})`;
        const formattedDate = formatISOString(replay.ts);
        const finesse = (replayStats.finesse.perfectpieces / replayStats.piecesplaced) ?? -1;

        let inputCounts = {};
        for (const h of ["hardDrop", "softDrop", "hold", "moveLeft", "moveRight", "rotateCW", "rotateCCW", "rotate180"]) inputCounts[h] = 0;
        for (const frameEvent of replayData.events) {
            if (frameEvent.type === 'keydown') {
                inputCounts[frameEvent.data.key]++;
            }
        }
        const handling = replayData.options.handling;
        const inputCountString = 
`- **Placed ${formatNumber(replayStats.piecesplaced)} pieces**
  - Held ${formatNumber(replayStats.holds)} pieces
  - Pressed ${formatNumber(replayStats.inputs)} inputs
  - ⇊ ${formatNumber(inputCounts.hardDrop)} | ⇃ ${formatNumber(inputCounts.softDrop)} | ⇄ ${formatNumber(inputCounts.hold)}
  - ← ${formatNumber(inputCounts.moveLeft)} | → ${formatNumber(inputCounts.moveRight)}
  - ↶ ${formatNumber(inputCounts.rotateCCW)} | ↷ ${formatNumber(inputCounts.rotateCW)} | ⟳ ${formatNumber(inputCounts.rotate180)}
  - ${handling.arr}F ARR | ${handling.das}F DAS | ${handling.sdf === 41 ? "∞" : handling.sdf}x SDF
- **Cleared ${formatNumber(replayStats.lines)} lines**
  - ${replayStats.clears.singles} singles (${replayStats.clears.tspinsingles ?? 0} spins) 
  - ${replayStats.clears.doubles} doubles (${replayStats.clears.tspindoubles ?? 0} spins) 
  - ${replayStats.clears.triples} triples (${replayStats.clears.tspintriples ?? 0} spins)
  - ${replayStats.clears.quads} quads${finesse === -1 ? '' : `
- **Had ${formatNumber(finesse * 100, 2)}% finesse**
  - Reached a ${replayStats.finesse.combo} chain
  - Made ${replayStats.finesse.faults} faults
  - Placed ${replayStats.finesse.perfectpieces} pieces perfectly`}`;

        let performanceStrings = [];
        let performanceDisclaimer = "";
        // skips the "compared to rank" line for performance tab
        // TODO maybe add an API call here to get an actual rank
        const effectiveRank = null;

        const userSuffix = `
-# ${formatUsername(replay.users[0].username)} ${countryCodeToEmoji(replay.users[0].country)} | ${formattedDate}`;


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

            //check if zenith expert
            const zenithMods = Array.isArray(replayData.options?.zenith_mods) ? replayData.options.zenith_mods : [];
            const isExpertMod = mods.includes('expert') || zenithMods.includes('expert_reversed');

            // time for performance strings yay!
            const zenithVer = isExpertMod ? 'zenithEx' : 'zenith';
            performanceStrings.push(await buildReplayStatComparisonString(
                `${zenithVer}/height`,
                'Meters',       
                height,                      
                effectiveRank,
                { decimals: 1 }
            ));
            performanceStrings.push(await buildReplayStatComparisonString(
                `${zenithVer}/pps`,
                'Pieces Per Second',       
                pps,                      
                effectiveRank,
                { decimals: 3 }
            ));
            performanceStrings.push(await buildReplayStatComparisonString(
                `${zenithVer}/apm`,
                'Attack Per Minute',
                apm,
                effectiveRank,
                { decimals: 2 }
            ));
            // only show/build climb speed if NOT reverse-expert
            if (!zenithMods.includes('expert_reversed')) {
                performanceStrings.push(await buildReplayStatComparisonString(
                    `${zenithVer}/climbSpeed`,
                    'Average Climb Speed',
                    climbSpeed,
                    effectiveRank,
                    { decimals: 3 }
                ));
            }
            performanceStrings.push(await buildReplayStatComparisonString(
                `${zenithVer}/btb`,
                'Highest Back-to-Back',
                btb,
                effectiveRank,
                { decimals: 0 }
            ));
            performanceStrings.push(await buildReplayStatComparisonString(
                `${zenithVer}/finesse`,
                'Finesse',
                finesse,
                effectiveRank,
                { decimals: 4, isPercentage: true }
            ));

            // don't show a warning if the only mod is "expert" (including reversed)
            if (mods.length > 0 && !(mods.length === 1 && isExpertMod)) {
                if (isExpertMod) {
                    performanceDisclaimer = `\n-# ${getEmoji("windup_4")} These stats are based off of Expert Quick Play runs without mods! Be wary when comparing.`;
                } else {
                    performanceDisclaimer = `\n-# ${getEmoji("windup_4")} These stats are based off of Quick Play runs without mods! Be wary when comparing.`;
                }
            }

            //full page
            const stats = replayStats;
            const garbageStats = replayStats.garbage;


            pages = [
                new EmbedBuilder().setColor('#80ff80')
                .setDescription(`### __${replayLinkFormat} -> Overview__
${modString}
- **Finished in ${framesToTime(replayData.frames)}**
  - ${formatNumber(pps,2)} PPS
  - ${formatNumber(apm,2)} APM
  - ${formatNumber(replayData.results.aggregatestats.vsscore,2)} VS Score
  - ${formatNumber(finesse * 100, 2)}% Finesse | ${replayStats.finesse.faults} Faults
- **Climbed ${formatNumber(height, 1)}m (Floor ${zenithStats.floor})**
  - Reached ${zenithStats.peakrank.toFixed(2)} climb speed, averaged ${zenithStats.rank.toFixed(2)}
  - Reached ${replayStats.topbtb} B2B
- **KO'd ${replayStats.kills} players**
  - Sent ${formatNumber(garbageStats.sent)} lines 
  - Received ${formatNumber(garbageStats.received)} lines
${userSuffix}`),

                new EmbedBuilder().setColor('#ffb980').setDescription(`### __${replayLinkFormat} -> Full__
${inputCountString}
- **Sent ${formatNumber(garbageStats.sent)} garbage lines**
  - Recieved ${formatNumber(garbageStats.received)}
  - Cleared ${formatNumber(garbageStats.cleared)}
  - Generated ${formatNumber(garbageStats.attack)} total attack
  - Sent a ${formatNumber(garbageStats.maxspike)} spike
- **Scored ${formatNumber(stats.score)} points**
  - Reached a ${stats.topcombo} combo
  - Reached a ${stats.topbtb} Back-to-Back chain
${userSuffix}`),
                new EmbedBuilder().setColor('#ff80d9')
                .setDescription(`### __${replayLinkFormat} -> Splits__
${splitFormat(zenithStats.splits)}
${userSuffix}`),
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

            performanceStrings.push(await buildReplayStatComparisonString(
                'sprint/time',
                'Time',
                time,
                effectiveRank,
                { lowerIsBetter: true, isTime: true }
            ));

            performanceStrings.push(await buildReplayStatComparisonString(
                'sprint/pps',
                'Pieces Per Second',       
                pps,                      
                effectiveRank,
                { decimals: 3 }
            ));

            performanceStrings.push(await buildReplayStatComparisonString(
                'sprint/kpp',
                'Keys Per Piece',
                kpp,
                effectiveRank,
                { decimals: 3 }
            ));

            performanceStrings.push(await buildReplayStatComparisonString(
                'sprint/kps',
                'Keys Per Second',
                kps,
                effectiveRank,
                { decimals: 3 }
            ));

            performanceStrings.push(await buildReplayStatComparisonString(
                'sprint/finesse',
                'Finesse',
                finesse,
                effectiveRank,
                { decimals: 4, isPercentage: true }
            ));

            pages = [
                new EmbedBuilder().setColor('#80ff80')
            .setDescription(`### __${replayLinkFormat} -> Overview__
- **Finished in ${formatTime(time)}**
  - ${pps.toFixed(2)} PPS
  - ${kpp.toFixed(2)} Keys Per Piece
  - ${kps.toFixed(2)} Keys Per Second
  - ${formatNumber(finesse * 100, 2)}% Finesse | ${replayStats.finesse.faults} Faults
${userSuffix}
`),
                new EmbedBuilder().setColor('#ffb980').setDescription(`### __${replayLinkFormat} -> Full__
${inputCountString}
${userSuffix}`),
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

            performanceStrings.push(await buildReplayStatComparisonString(
                'blitz/score',
                'Score',
                score,
                effectiveRank,
                { decimals: 0 }
            ));

            performanceStrings.push(await buildReplayStatComparisonString(
                'blitz/pps',
                'Pieces Per Second',
                pps,                      
                effectiveRank,
                { decimals: 3 }
            ));

            performanceStrings.push(await buildReplayStatComparisonString(
                'blitz/spp',
                'Score Per Piece',
                spp,
                effectiveRank,
                { decimals: 2 }
            ));


            performanceStrings.push(await buildReplayStatComparisonString(
                'blitz/finesse',
                'Finesse',
                finesse,
                effectiveRank,
                { decimals: 4, isPercentage: true }
            ));

            pages = [
                new EmbedBuilder().setColor('#80ff80')
            .setDescription(`### __${replayLinkFormat} -> Overview__
- **Scored ${formatNumber(score)} points**
  - ${pps.toFixed(2)} PPS
  - ${spp.toFixed(2)} Points Per Piece
  - ${formatNumber(finesse * 100, 2)}% Finesse | ${replayStats.finesse.faults} Faults
${userSuffix}
`),

                new EmbedBuilder().setColor('#ffb980').setDescription(`### __${replayLinkFormat} -> Full__
${inputCountString}
${userSuffix}`),
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

        const perfStatBlock = performanceStrings
                .filter(s => typeof s === 'string' ? s.trim().length > 0 : Boolean(s))
                .join('\n');
        
        pages.push(
            new EmbedBuilder()
            .setColor('#80ffc4')
            .setDescription(`### __${replayLinkFormat} -> Performance__${performanceDisclaimer}
${perfStatBlock}
${userSuffix}`));

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
// TODO test this function to make sure it actually works w/ the database (since i don't have a copy)
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
