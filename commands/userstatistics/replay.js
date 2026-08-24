const {
    SlashCommandBuilder,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    InteractionContextType,
    ApplicationIntegrationType,
    SeparatorBuilder,
} = require("discord.js");

const {
    formatNumber,
    countryCodeToEmoji,
    formatPreciseTime,
    getModCombos,
    formatISOString,
    formatUsername,
    buildPageSelectRow,
    addStatComparisonField,
} = require("../../helpers/formatters");const { getEmoji } = require('../../helpers/emojis');


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

        // league is different because stuipd ???
        let isLeague = false;

        if (replayAttachment.name.endsWith('.ttrm')) {
            isLeague = true;
        } else if (!replayAttachment.name.endsWith('.ttr')) {
            return interaction.editReply({ content: 'Please upload a valid .ttr or .ttrm replay file.' });
        }
        
        // Fetch the replay file
        const response = await fetch(replayAttachment.url);
        if (!response.ok) {
            throw new Error(`Failed to fetch replay file: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const replayDataBuffer = Buffer.from(arrayBuffer);

        // optional: save replay file locally before analysing
        /*
        try {
            const tmpDir = path.join(__dirname, '..', '..', 'tmp', 'replays');
            await fs.promises.mkdir(tmpDir, { recursive: true });
            const baseName = `${replayAttachment.id ?? Date.now()}`;
            const rawFile = path.join(tmpDir, `${baseName}${isLeague ? '.ttrm' : '.ttr'}`);
            await fs.promises.writeFile(rawFile, replayDataBuffer);
            // also save a human-readable JSON copy if the file is JSON
            const jsonFile = path.join(tmpDir, `${baseName}.json`);
            await fs.promises.writeFile(jsonFile, replayDataBuffer.toString());
            console.log('Saved replay files:', rawFile, jsonFile);
        } catch (err) {
            console.warn('Could not save replay locally:', err.message);
        }*/

        // Parse the file as JSON
        const replay = JSON.parse(replayDataBuffer.toString());
        if (!replay || !replay.id || !replay.users) { // some easy checks to see if common replay file structure is there
            return interaction.editReply({ content: 'The uploaded file does not appear to be a valid TETR.IO replay.' });
            // note this doesn't technically prevent uploading malformed files
            // with the right structure but it's a start and should catch most user errors
        }

        const replayData = replay.replay;

        //i hate league why did you have to do a different format :aysm:
        //i mean fair because there's different rounds but still :(
        if (isLeague) {
            const leaderboard = replayData.leaderboard;
            const rounds = replayData.rounds;

            if (!Array.isArray(leaderboard) || !Array.isArray(rounds) || leaderboard.length !== 2 || rounds.length === 0) {
                return interaction.editReply({
                    content: "This League replay has an unsupported structure."
                });
            }

            const formattedDate = formatISOString(replay.ts);

            //overview stuff

            const [player1, player2] = leaderboard;

            const player1User = replay.users.find(user => user.id === player1.id);
            const player2User = replay.users.find(user => user.id === player2.id);

            let scoreString = `**🏆 ${player1.username.toUpperCase()} ${player1.wins}**-${player2.wins} ${player2.username.toUpperCase()}`

            if (player1.wins < player2.wins) {
                scoreString = `${player1.username.toUpperCase()} ${player1.wins}-**${player2.wins} ${player2.username.toUpperCase()}** 🏆`
            }

            const userSuffix =
            `${formatUsername(player1.username)} ${countryCodeToEmoji(player1User?.country)} vs ${formatUsername(player2.username)} ${countryCodeToEmoji(player2User?.country)} | ${formattedDate}`;

            const leagueOverviewContainer = new ContainerBuilder()
                .setAccentColor(0x80ffc4)
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent(`### __[Replay ${replay.id} (League)](https://tetr.io/#R:${replay.id}) -> Overview__
${scoreString}

**${player1.username.toUpperCase()}**
- ${formatNumber(player1.stats.pps, 2)} PPS | ${formatNumber(player1.stats.apm, 2)} APM | ${formatNumber(player1.stats.vsscore, 2)} VS Score
- Sent ${formatNumber(player1.stats.garbagesent)} | Received ${formatNumber(player1.stats.garbagereceived)}

**${player2.username.toUpperCase()}**
- ${formatNumber(player2.stats.pps, 2)} PPS | ${formatNumber(player2.stats.apm, 2)} APM | ${formatNumber(player2.stats.vsscore, 2)} VS Score
- Sent ${formatNumber(player2.stats.garbagesent)} | Received ${formatNumber(player2.stats.garbagereceived)}

${userSuffix}`)
                );

            //rounds
            const roundLines = rounds.map((round, index) => {
                const roundPlayer1 = round.find(player => player.id === player1.id);
                const roundPlayer2 = round.find(player => player.id === player2.id);

                if (!roundPlayer1 || !roundPlayer2) {
                    return `**Round ${index + 1}**\n- Round data unavailable`;
                }

                const roundWinner = roundPlayer1.alive
                    ? roundPlayer1
                    : roundPlayer2.alive
                        ? roundPlayer2
                        : null;

                const duration = Math.max(
                    roundPlayer1.lifetime,
                    roundPlayer2.lifetime
                );

                const winnerText = roundWinner
                    ? `${roundWinner.username.toUpperCase()} won`
                    : "No winner";

                return `**Round ${index + 1} — ${winnerText} in ${formatPreciseTime(duration)}**
            - **${player1.username.toUpperCase()}:** ${formatNumber(roundPlayer1.stats.pps, 2)} PPS | ${formatNumber(roundPlayer1.stats.apm, 2)} APM | ${formatNumber(roundPlayer1.stats.vsscore, 2)} VS | ${formatNumber(roundPlayer1.stats.garbagesent)} sent
            - **${player2.username.toUpperCase()}:** ${formatNumber(roundPlayer2.stats.pps, 2)} PPS | ${formatNumber(roundPlayer2.stats.apm, 2)} APM | ${formatNumber(roundPlayer2.stats.vsscore, 2)} VS | ${formatNumber(roundPlayer2.stats.garbagesent)} sent`;
            }).join("\n\n");

            const leagueRoundsContainer = new ContainerBuilder()
                .setAccentColor(0xffb980)
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent(`### __[Replay ${replay.id} (League)](https://tetr.io/#R:${replay.id}) -> Rounds__
${roundLines}

${userSuffix}`)
                );
            

            //pages
            const pages = [
                leagueOverviewContainer,
                leagueRoundsContainer,
            ];

            const labels = [
                "Overview",
                "Rounds",
            ];

            const key = interaction.id;
            const commandName = "analyzereplay";

            pages.forEach((container, pageIndex) => {
                container
                    .addSeparatorComponents(
                        new SeparatorBuilder(),
                    )
                    .addActionRowComponents(
                        buildPageSelectRow({
                            commandName,
                            key,
                            labels,
                            activeIndex: pageIndex,
                        }),
                    );
            });

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

            await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [pages[0]],
            });
            
        } else {
            const replayStats = replayData.results.stats;

            //initially define list of pages 
            let pages;

            //check the gamemode
            let gamemode = "Unknown";
            if (replay.gamemode === 'zenith') gamemode = "Quick Play";
            if (replay.gamemode === 'zenithex') gamemode = "Quick Play EX";
            if (replay.gamemode === '40l') gamemode = "40 Lines";
            if (replay.gamemode === 'blitz') gamemode = "Blitz";

            // common stats
            const replayLinkFormat = `[Replay ${replay.id} (${gamemode})](https://tetr.io/#R:${replay.id})`;
            const formattedDate = formatISOString(replay.ts);
            const finesse = replayStats.finesse ? (replayStats.finesse.perfectpieces / replayStats.piecesplaced) : -1;

            const inputCounts = {};
            for (const h of ["hardDrop", "softDrop", "hold", "moveLeft", "moveRight", "rotateCW", "rotateCCW", "rotate180"]) inputCounts[h] = 0;
            for (const frameEvent of replayData.events) {
                if (frameEvent.type === 'keydown') {
                    inputCounts[frameEvent.data.key]++;
                }
            }
            const handling = replayData.options.handling;
            const inputCountString = `- **Placed ${formatNumber(replayStats.piecesplaced)} pieces**
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

            let performanceDisclaimer = "";
            // skips the "compared to rank" line for performance tab
            // TODO maybe add an API call here to get an actual rank
            const effectiveRank = null;

            const userSuffix = `\n${formatUsername(replay.users[0].username)} ${countryCodeToEmoji(replay.users[0].country)} | ${formattedDate}`;

            const performanceEmbed = new ContainerBuilder()
                .setAccentColor(0x80ffc4)
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent(`### __${replayLinkFormat} -> Performance__${performanceDisclaimer}\n${userSuffix}`)
                )


            //=== For each gamemode, create a list of pages ===
            // Zenith gamemode :3
            // expert and normal are together because their stats are extremely similar
            if (replay.gamemode === "zenith" || replay.gamemode === "zenithex") {     
                const combos = getModCombos(replayData.options.zenith_mods)

                const emojis = combos.emojis || "";
                const flavour = combos.flavour || "";
                const foundEntry = combos.name || "";
                const mods = combos.mods || [];

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
                const app = replayStats.garbage.attack / replayStats.piecesplaced;

                //check if zenith expert
                const zenithMods = Array.isArray(replayData.options?.zenith_mods) ? replayData.options.zenith_mods : [];
                const isExpertMod = mods.includes('expert') || zenithMods.includes('expert_reversed');

                // time for performance strings yay!
                const zenithVer = isExpertMod ? 'zenithEx' : 'zenith';
                await addStatComparisonField(performanceEmbed, `${zenithVer}/height`, 'Meters', height, effectiveRank, { decimals: 1 });
                await addStatComparisonField(performanceEmbed, `${zenithVer}/pps`, 'Pieces Per Second', pps, effectiveRank, { decimals: 3 });
                await addStatComparisonField(performanceEmbed, `${zenithVer}/apm`, 'Attack Per Minute', apm, effectiveRank, { decimals: 2 });

                if (!zenithMods.includes('expert_reversed')) {
                    await addStatComparisonField(performanceEmbed, `${zenithVer}/climbSpeed`, 'Average Climb Speed', climbSpeed, effectiveRank, { decimals: 3 });
                }

                await addStatComparisonField(performanceEmbed, `${zenithVer}/btb`, 'Highest Back-to-Back', btb, effectiveRank, { decimals: 0 });
                await addStatComparisonField(performanceEmbed, `${zenithVer}/app`, 'Attack Per Piece', app, effectiveRank, { decimals: 3 });
                await addStatComparisonField(performanceEmbed, `${zenithVer}/finesse`, 'Finesse', finesse, effectiveRank, { isPercentage: true });

                // don't show a warning if the only mod is "expert" (including reversed)
                if (mods.length > 0 && !(mods.length === 1 && isExpertMod)) {
                    if (isExpertMod) {
                        performanceDisclaimer = `\n-# ${getEmoji("windup_4")} These stats are based off of Expert Quick Play runs without other mods! Be wary when comparing.`;
                    } else {
                        performanceDisclaimer = `\n-# ${getEmoji("windup_4")} These stats are based off of Quick Play runs without mods! Be wary when comparing.`;
                    }
                }

                //full page
                const stats = replayStats;
                const garbageStats = replayStats.garbage;


                pages = [
                    new ContainerBuilder()
                        .setAccentColor(0x80ff80)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder()
                                .setContent(`### __${replayLinkFormat} -> Overview__
${modString}
- **Finished in ${framesToTime(replayData.frames)}**
- ${formatNumber(pps,2)} PPS
- ${formatNumber(apm,2)} APM
- ${formatNumber(replayData.results.aggregatestats.vsscore,2)} VS Score
- ${formatNumber(finesse * 100, 2)}% Finesse | ${replayStats.finesse.faults} Faults
- **Climbed ${formatNumber(height, 1)}m (Floor ${zenithStats.floor})**
- Reached ${formatNumber(zenithStats.peakrank, 2)} climb speed, averaged ${formatNumber(zenithStats.rank, 2)}
- Reached ${(replayStats.topbtb) - 1} B2B
- **KO'd ${replayStats.kills} players**
- Sent ${formatNumber(garbageStats.sent)} lines 
- Received ${formatNumber(garbageStats.received)} lines
${userSuffix}`)
                        ),

                    new ContainerBuilder()
                        .setAccentColor(0xffb980)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder()
                                .setContent(`### __${replayLinkFormat} -> Full__
${inputCountString}
- **Sent ${formatNumber(garbageStats.sent)} garbage lines**
- Recieved ${formatNumber(garbageStats.received)}
- Cleared ${formatNumber(garbageStats.cleared)}
- Generated ${formatNumber(garbageStats.attack)} total attack
- Sent a ${formatNumber(garbageStats.maxspike)} spike
- **Scored ${formatNumber(stats.score)} points**
- Reached a ${stats.topcombo} combo
- Reached a ${(stats.topbtb) - 1} Back-to-Back chain
${userSuffix}`)
                        ),
                    new ContainerBuilder()
                        .setAccentColor(0xff80d9)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder()
                                .setContent(`### __${replayLinkFormat} -> Splits__
${splitFormat(zenithStats.splits)}
    ${userSuffix}`)
                        ),
                ]
            } else if (replay.gamemode === '40l') {

                // silly performance stuff idk
                const time = replayStats.finaltime;
                const pps = replayData.results.aggregatestats.pps;
                const kpp = replayStats.inputs / replayStats.piecesplaced;
                const kps = replayStats.inputs / (time / 1000);

                await addStatComparisonField(performanceEmbed, 'sprint/time', 'Time', time, effectiveRank, { lowerIsBetter: true, isTime: true });
                await addStatComparisonField(performanceEmbed, 'sprint/pps', 'Pieces Per Second', pps, effectiveRank, { decimals: 3 });
                await addStatComparisonField(performanceEmbed, 'sprint/kpp', 'Keys Per Piece', kpp, effectiveRank, { decimals: 3, lowerIsBetter: true });
                await addStatComparisonField(performanceEmbed, 'sprint/kps', 'Keys Per Second', kps, effectiveRank, { decimals: 3 });
                await addStatComparisonField(performanceEmbed, 'sprint/finesse', 'Finesse', finesse, effectiveRank, { isPercentage: true });

                pages = [
                    new ContainerBuilder()
                        .setAccentColor(0x80ff80)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder()
                                .setContent(`### __${replayLinkFormat} -> Overview__
- **Finished in ${formatPreciseTime(time)}**
- ${formatNumber(pps, 2)} PPS
- ${formatNumber(kpp, 2)} Keys Per Piece
- ${formatNumber(kps, 2)} Keys Per Second
- ${formatNumber(finesse * 100, 2)}% Finesse | ${replayStats.finesse.faults} Faults
${userSuffix}
    `)
                        ),
                    new ContainerBuilder()
                        .setAccentColor(0xffb980)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder()
                                .setContent(`### __${replayLinkFormat} -> Full__
    ${inputCountString}
    ${userSuffix}`)
                        ),
                ]
            } else if (replay.gamemode === 'blitz') {
                const score = replayStats.score;
                const pps = replayData.results.aggregatestats.pps;
                const spp = score / replayStats.piecesplaced;

                await addStatComparisonField(performanceEmbed, 'blitz/score', 'Score', score, effectiveRank, { decimals: 0 });
                await addStatComparisonField(performanceEmbed, 'blitz/pps', 'Pieces Per Second', pps, effectiveRank, { decimals: 3 });
                await addStatComparisonField(performanceEmbed, 'blitz/spp', 'Score Per Piece', spp, effectiveRank, { decimals: 2 });
                await addStatComparisonField(performanceEmbed,"blitz/finesse", "Finesse", finesse, effectiveRank, { isPercentage: true });

                pages = [
                    new ContainerBuilder()
                        .setAccentColor(0x80ff80)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder()
                                .setContent(`### __${replayLinkFormat} -> Overview__
- **Scored ${formatNumber(score)} points**
- ${formatNumber(pps, 2)} PPS
- ${formatNumber(spp, 2)} Points Per Piece
- ${formatNumber(finesse * 100, 2)}% Finesse | ${replayStats.finesse.faults} Faults
${userSuffix}
    `)
                        ),

                    new ContainerBuilder()
                        .setAccentColor(0xffb980)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder()
                                .setContent(`### __${replayLinkFormat} -> Full__
    ${inputCountString}
    ${userSuffix}`)
                        ),
                ]              
            
            } else {
                return interaction.editReply({content: 'This type of replay file has not been accounted for yet, please contact the developers if you believe this is a mistake.'})
            }
            
            if (performanceDisclaimer) {
                performanceEmbed.addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent(performanceDisclaimer),
                );
            }

            pages.push(performanceEmbed);

            const key = interaction.id;
            const commandName = "analyzereplay";

            const labels =
                pages.length === 4
                    ? ["Overview", "Full", "Splits", "Performance"]
                    : ["Overview", "Full", "Performance"];

            // Add the page dropdown to every container.
            pages.forEach((container, pageIndex) => {
                container
                    .addSeparatorComponents(
                        new SeparatorBuilder(),
                    )
                    .addActionRowComponents(
                        buildPageSelectRow({
                            commandName,
                            key,
                            labels,
                            activeIndex: pageIndex,
                        }),
                    );
            });

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

            await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [pages[0]],
            });
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