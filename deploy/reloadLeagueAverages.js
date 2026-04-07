const { formatNumber, formatPreciseTime } = require('../helpers/formatters.js');
const { database } = require('../database.js');
const uuid = require('uuid');
const fs = require('fs');

let sessionId;

// request cooldowns (in seconds)
const USER_DATA_REQUEST_COOLDOWN = 1.05;
const LEAGUE_USERS_REQUEST_COOLDOWN = 1.35;

const USERS_PER_RANK = 700;
const MAX_ERRORS = 5;
const BAR_SIZE = 35;
const RANKS = ['d', 'd+', 'c-', 'c', 'c+', 'b-', 'b', 'b+', 'a-', 'a', 'a+', 's-', 's', 's+', 'ss', 'u', 'x', 'x+'];

let rankUserList = {};
let userDataList = {};
let lastRequestTime = new Date(0);

async function main() {
    console.log("hi welcome to league average fetch machine thing")
    console.log("what do you wanna do?")
    console.log(`1. start running from scratch${fs.existsSync('userList.json') || fs.existsSync('rankData.json') ? " (SAVED DATA EXISTS!)" : ""}\n2. resume from last saved progress\n3. actually nvm\n`)

    const choice = await new Promise((resolve) => {
        process.stdin.once('data', (data) => {
            resolve(data.toString().trim());
        });
    });

    if (choice === '3') {
        console.log("ok bye");
        process.exit(0);
    }
    else if (choice === '2') {
        if (fs.existsSync('userList.json')) {
            rankUserList = JSON.parse(fs.readFileSync('userList.json'));
            console.log("userList loaded")
        }
        if (fs.existsSync('rankData.json')) {
            userDataList = JSON.parse(fs.readFileSync('rankData.json'));
            console.log("rankData loaded")
        }
    } else {
        console.log("starting from scratch");
    }

    sessionId = uuid.v4();

    if (Object.keys(rankUserList).length === 0) {
        await fetchAllLeagueUsers();
        chooseRandomUsers();
        saveProgress();
    } else {
        console.log("\nskipping fetching league users, already have user list from resumed progress");
    }
    
    sessionId = uuid.v4();
    await fetchUserAverages();

    await calculateRankAverages();

    console.log("\nall done!");
    console.log("you may delete userList.json and rankData.json now if you want");

    process.exit(0);
}

function saveProgress() {
    if (Object.keys(rankUserList).length > 0) fs.writeFileSync('userList.json', JSON.stringify(rankUserList, null, 2));
    if (Object.keys(userDataList).length > 0) fs.writeFileSync('rankData.json', JSON.stringify(userDataList, null, 2));
}

async function fetchAllLeagueUsers() {
        const response = await fetchWithCooldown('https://ch.tetr.io/api/labs/league_ranks');
        const data = await response.json();
        
        if (!data.success) {
            throw new Error("failed to get total players: " + (data.error?.msg || 'unknown error'));
        }
        
        const totalPlayers = data.data.data.d.pos; // data.data.data very cool
        
        // sorting is a bit silly, requiring 3 floats instead of 1 (osk api moment i guess)
        let pageTR = "25000:0:0";
        let currentPlayers = 0;
        let totalErrors = 0;

        console.log(`fetching all ${totalPlayers} league players...`);
        
        for (const rank of RANKS) {
            rankUserList[rank] = [];
        }

    while (true) {
        const response = await fetchWithCooldown(`https://ch.tetr.io/api/users/by/league?after=${pageTR}&limit=100`, LEAGUE_USERS_REQUEST_COOLDOWN);
        const data = await response.json();
        
        if (!data.success) {
            totalErrors++;
            if (totalErrors >= MAX_ERRORS) {
                throw Error("something went wrong! gave up after " + MAX_ERRORS + " failures");
            }
            
            console.error("failed to fetch league users: " + data.error.msg + " retrying in 5 seconds...");
            await sleep(5000);
            continue;
        }
        
        for (const user of data.data.entries) {
            const rank = user?.league?.rank;
            if (!rank) {
                console.warn(`\nSkipping user ${user?.username || '<unknown>'}: missing league rank`);
                continue;
            }

            if (!rankUserList[rank]) {
                console.warn(`\nSkipping user ${user.username}: unexpected league rank '${rank}'`);
                continue;
            }

            rankUserList[rank].push(user.username);
        }
        currentPlayers += data.data.entries.length;

        if (data.data.entries.length > 0) {
            const lastUser = data.data.entries[data.data.entries.length - 1];
            if (lastUser.p) pageTR = `${lastUser.p.pri}:${lastUser.p.sec}:${lastUser.p.ter}`; // very cool pagination system
        }
        
        printBar(currentPlayers, totalPlayers, LEAGUE_USERS_REQUEST_COOLDOWN/100);
        
        if (currentPlayers >= totalPlayers) {
            break;
        }
        
        totalErrors = 0;
    }

    console.log(`fetched ${currentPlayers} users total`);
}

function chooseRandomUsers() {
    const oldRankList = {...rankUserList};
    rankUserList = {};

    for (const rank of RANKS) {
        rankUserList[rank] = [];

        if (oldRankList[rank].length <= USERS_PER_RANK) {
            rankUserList[rank] = oldRankList[rank];
            continue;
        }

        while (rankUserList[rank].length < USERS_PER_RANK) {
            const randomIndex = Math.floor(Math.random() * oldRankList[rank].length);
            rankUserList[rank].push(oldRankList[rank][randomIndex]);
            oldRankList[rank].splice(randomIndex, 1);
        }
    }

    console.log(`selected ${USERS_PER_RANK} users from each rank, for a total of ${Object.values(rankUserList).flat().length} users`);
}

async function fetchUserAverages() {
    console.log("\nfetching user data...");
    const totalUsers = Object.values(rankUserList).flat().length;
    let currentUsers = 0;

    for (const rank of RANKS) {
        if (userDataList[rank] && userDataList[rank].length === rankUserList[rank].length) {
            currentUsers += userDataList[rank].length;
            console.log(`\nrank ${rank} is already fetched from resumed progress, skipping...`);
            printBar(currentUsers, totalUsers, USER_DATA_REQUEST_COOLDOWN);
            continue;
        }
        console.log(`working on rank ${rank}...`);

        // console.debug(`usernames: ${userRankList[rank].join(', ')}`);

        userDataList[rank] = [];
        let totalErrors = 0;

        for (const username of rankUserList[rank]) {
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount <= maxRetries) {
                try {
                    // console.debug(`fetching data for ${username}...`);
                    const response = await fetchWithCooldown(`https://ch.tetr.io/api/users/${username}/summaries`, USER_DATA_REQUEST_COOLDOWN);
                    const data = await response.json();

                    if (!data.success) {
                        throw new Error(`failed to fetch user ${username}: ` + (data.error?.msg || 'unknown error'));
                    }

                    userDataList[rank].push(data.data);
                    currentUsers++;
                    printBar(currentUsers, totalUsers, USER_DATA_REQUEST_COOLDOWN);
                    break;
                    
                } catch (error) {
                    retryCount++;
                    if (retryCount > maxRetries) {
                        totalErrors++;
                        console.error(`failed to fetch data for ${username} after ${maxRetries} retries: ${error.message}; trying next user...`);
                        
                        if (totalErrors >= MAX_ERRORS) {
                            throw new Error("something went very wrong! gave up after " + MAX_ERRORS + " failures", {
                                cause: error
                            });
                        }
                        break;
                    }
                    
                    console.warn(`error fetching data for ${username} (attempt ${retryCount}/${maxRetries}): ${error.message}, retrying...`);
                    await sleep(2000 * retryCount);
                }
            }
        }

        saveProgress();
    }

    console.log("\nall user data fetched");
}

// horrific looking function that i could *probably* softcode but it's... fine
async function calculateRankAverages() {
    await database.LeagueStat.destroy({ where: {} });
    await database.Achievement.destroy({ where: {} });
    
    const dbObjects = {};
    const BASE_RANK_TOTAL = {
      sprint: {
        time: 0,
        pps: 0,
        kpp: 0,
        kps: 0,
        finesse: 0,
      },
      blitz: {
        score: 0,
        pps: 0,
        spp: 0,
        finesse: 0,
      },
      zenith: {
        height: 0,
        pps: 0,
        apm: 0,
        climbSpeed: 0,
        btb: 0,
        app: 0,
        finesse: 0,
      },
      zenithEx: {
        height: 0,
        pps: 0,
        apm: 0,
        climbSpeed: 0,
        btb: 0,
        app: 0,
        finesse: 0,
      },
      league: {
        pps: 0,
        vs: 0,
        apm: 0,
      },
      achievements: {},
    };

    console.log("\nprepping database...");

    const allAches = [];
    for (const rank of RANKS) {
        for (const userData of userDataList[rank]) {
            for (const achievement of userData.achievements || []) {
                if (!allAches.find(a => a.n === achievement.n)) {
                    allAches.push(achievement);
                }
            }
        }
    }

    for (const group of Object.keys(BASE_RANK_TOTAL)) {
        dbObjects[group] = {};
        for (const stat of Object.keys(BASE_RANK_TOTAL[group])) {
            dbObjects[group][stat] = await database.LeagueStat.create({
                stat: `${group}/${stat}`,
                statGroup: group,
            });
        }
    }
    for (const ach of allAches) {
        dbObjects.achievements[ach.n] = await database.LeagueStat.create({
            stat: `achievements/${ach.n}`,
            statGroup: "achievements",
            achId: ach.k
        });
        await database.Achievement.create({
            id: ach.k,
            name: ach.name,
            shortname: ach.n,
            objective: ach.object,
        })
    }
    printBar(1, RANKS.length+2);

    for (const rank of RANKS) {
        console.log(`\ncalculating averages for rank ${rank}...`);

        const rankTotals = JSON.parse(JSON.stringify(BASE_RANK_TOTAL));

        // count finesse seperately because some replays don't have it for some reason
        const dataSeenCount = {
            "sprint": { overall: 0, finesse: 0 },
            "blitz": { overall: 0, finesse: 0 },
            "zenith": { overall: 0, finesse: 0 },
            "zenithEx": { overall: 0, finesse: 0 },
            "league": { overall: userDataList[rank].length },
            "achievements": {} // each achievement will be counted separately
        }

        for (const userData of userDataList[rank]) {
            let recordResults;

            if (userData["40l"]?.record) {
                recordResults = userData["40l"].record.results;
                dataSeenCount.sprint.overall += 1;

                rankTotals.sprint.time += recordResults.stats.finaltime;
                rankTotals.sprint.pps += recordResults.aggregatestats.pps;
                rankTotals.sprint.kpp += recordResults.stats.inputs / recordResults.stats.piecesplaced;
                rankTotals.sprint.kps += recordResults.stats.inputs / (recordResults.stats.finaltime / 1000);

                
                if (recordResults.stats.finesse) {
                    dataSeenCount.sprint.finesse += 1;
                    rankTotals.sprint.finesse += recordResults.stats.finesse.perfectpieces / recordResults.stats.piecesplaced
                };
            }

            if (userData.blitz?.record) {
                recordResults = userData.blitz.record.results;
                dataSeenCount.blitz.overall += 1;

                rankTotals.blitz.score += recordResults.stats.score;
                rankTotals.blitz.pps += recordResults.aggregatestats.pps;
                rankTotals.blitz.spp += recordResults.stats.score / recordResults.stats.piecesplaced;

                if (recordResults.stats.finesse) {
                    dataSeenCount.blitz.finesse += 1;
                    rankTotals.blitz.finesse += recordResults.stats.finesse.perfectpieces / (recordResults.stats.piecesplaced || 1)
                };
            }

            if (userData.zenith && (userData.zenith.best?.record || userData.zenith.record)) {
                recordResults = (userData.zenith.best?.record || userData.zenith.record).results;
                dataSeenCount.zenith.overall += 1;

                rankTotals.zenith.height += recordResults.stats.zenith.altitude;
                rankTotals.zenith.pps += recordResults.aggregatestats.pps;
                rankTotals.zenith.apm += recordResults.aggregatestats.apm;
                rankTotals.zenith.climbSpeed += recordResults.stats.zenith.rank;
                rankTotals.zenith.btb += recordResults.stats.topbtb;
                rankTotals.zenith.app += (recordResults.stats.garbage.attack/recordResults.stats.piecesplaced) || 0;

                if (recordResults.stats.finesse) {
                    dataSeenCount.zenith.finesse += 1;
                    rankTotals.zenith.finesse += recordResults.stats.finesse.perfectpieces / (recordResults.stats.piecesplaced || 1);
                }
            }

            if (userData.zenithex && (userData.zenithex.best?.record || userData.zenithex.record)) {
                recordResults = (userData.zenithex.best?.record || userData.zenithex.record).results;
                dataSeenCount.zenithEx.overall += 1;

                rankTotals.zenithEx.height += recordResults.stats.zenith.altitude;
                rankTotals.zenithEx.pps += recordResults.aggregatestats.pps;
                rankTotals.zenithEx.apm += recordResults.aggregatestats.apm;
                rankTotals.zenithEx.climbSpeed += recordResults.stats.zenith.rank;
                rankTotals.zenithEx.btb += recordResults.stats.topbtb;
                rankTotals.zenithEx.app += (recordResults.stats.garbage.attack/recordResults.stats.piecesplaced) || 0;

                if (recordResults.stats.finesse) {
                    dataSeenCount.zenithEx.finesse += 1;
                    rankTotals.zenithEx.finesse += recordResults.stats.finesse.perfectpieces / (recordResults.stats.piecesplaced || 1)
                };
            }

            // league is guaranteed
            rankTotals.league.pps += userData.league.pps;
            rankTotals.league.vs += userData.league.vs;
            rankTotals.league.apm += userData.league.apm;
            
            for (const achievement of userData.achievements || []) {
                if (!rankTotals.achievements[achievement.n]) {
                    rankTotals.achievements[achievement.n] = 0;
                    dataSeenCount.achievements[achievement.n] = 0;
                }

                if (achievement.rank === 100) {
                    // issued achievement; calculate for percentage instead
                    rankTotals.achievements[achievement.n]++;

                    if (!dataSeenCount.achievements[achievement.n]) {
                        dataSeenCount.achievements[achievement.n] = userDataList[rank].length;
                    }
                    continue;
                }

                if (!achievement.v) continue;

                rankTotals.achievements[achievement.n] += achievement.v;
                dataSeenCount.achievements[achievement.n] += 1;
            }
        }
        
        for (const statGroup in rankTotals) {
            for (const stat in rankTotals[statGroup]) {
                const seenCount = dataSeenCount[statGroup][stat] || dataSeenCount[statGroup].overall;
                rankTotals[statGroup][stat] /= (seenCount || 1);

                if (!dbObjects[statGroup][stat]) {
                    dbObjects[statGroup][stat] = await database.LeagueStat.create({
                        stat: `${statGroup}/${stat}`,
                        statGroup: statGroup,
                    });
                }
                dbObjects[statGroup][stat].values[rank] = rankTotals[statGroup][stat];
                dbObjects[statGroup][stat].seenCount[rank] = seenCount;
            }
        }

        printBar(RANKS.indexOf(rank)+2, RANKS.length+2);
    }

    console.log("\nsaving to database...");
    for (const group of Object.keys(dbObjects)) {
        for (const stat of Object.keys(dbObjects[group])) {
            dbObjects[group][stat].changed('values', true);
            dbObjects[group][stat].changed('seenCount', true);
            await dbObjects[group][stat].save();
        }
    }
    printBar(RANKS.length+2, RANKS.length+2);
}

// wow! pretty logging. very necessary
function printBar(progress, total, durationEach = null) {
    const barLen = Math.floor(progress * BAR_SIZE/total);
    const percent = formatNumber((progress/total)*100, 2).padStart(5, '0');

    let toLog = `[ #${'#'.repeat(barLen)}` + 
                `${' '.repeat(BAR_SIZE - barLen)} ]` +
                ` ${percent}%`;

    if (durationEach) {
        toLog += ` (about ${formatPreciseTime((total - progress) * durationEach * 1000, 2)} left)`;
    }

    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(toLog);
    // console.log(toLog);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithCooldown(url, cooldown) {
    cooldown *= 1000; // convert to ms

    const timeSinceLastRequest = Date.now() - lastRequestTime;
    if (timeSinceLastRequest < cooldown) {
        await sleep(cooldown - timeSinceLastRequest);
    }

    if (!sessionId) {
        sessionId = uuid.v4();
    }

    lastRequestTime = Date.now();
    try {
        const response = await fetch(url, { headers: { 'X-Session-ID': sessionId, 'User-Agent': "TetriStats-League-Averager/0.1 by @erzahoq" } });
        return response;
    }
    catch (error) {
        return {success: false, error: { msg: `${error.message}` } };
    }
}


main();