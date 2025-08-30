const { database } = require('../database.js');
const uuid = require('uuid');
const fs = require('fs');

let sessionId;

// request cooldowns (in seconds)
const USER_DATA_REQUEST_COOLDOWN = 1.05;
const LEAGUE_USERS_REQUEST_COOLDOWN = 1.35;

const USERS_PER_RANK = 150;
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
        console.log("skipping fetching league users, already have user list from resumed progress");
    }
    
    sessionId = uuid.v4();
    await fetchUserAverages();

    await calculateRankAverages();

    console.log("all done!");
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
            rankUserList[user.league.rank].push(user.username);
        }
        currentPlayers += data.data.entries.length;

        const lastUser = data.data.entries[data.data.entries.length - 1];
        pageTR = `${lastUser.p.pri}:${lastUser.p.sec}:${lastUser.p.ter}`; // very cool pagination system
        
        printPretty(currentPlayers, totalPlayers, LEAGUE_USERS_REQUEST_COOLDOWN/100);
        
        if (currentPlayers >= totalPlayers) {
            break;
        }
        
        totalErrors = 0;
    }

    console.log(`fetched ${currentPlayers} users total`);
}

function chooseRandomUsers() {
    let oldRankList = {...rankUserList};
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
    console.log("fetching user data...");
    const totalUsers = Object.values(rankUserList).flat().length;
    let currentUsers = 0;

    for (const rank of RANKS) {
        if (userDataList[rank] && userDataList[rank].length === rankUserList[rank].length) {
            currentUsers += userDataList[rank].length;
            console.log(`rank ${rank} is already fetched from resumed progress, skipping...`);
            printPretty(currentUsers, totalUsers, USER_DATA_REQUEST_COOLDOWN);
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
                    printPretty(currentUsers, totalUsers, USER_DATA_REQUEST_COOLDOWN);
                    break;
                    
                } catch (error) {
                    retryCount++;
                    if (retryCount > maxRetries) {
                        totalErrors++;
                        console.error(`failed to fetch data for ${username} after ${maxRetries} retries: ${error.message}; trying next user...`);
                        
                        if (totalErrors >= MAX_ERRORS) {
                            throw new Error("something went very wrong! gave up after " + MAX_ERRORS + " failures");
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

    console.log("all user data fetched");
}

// horrific looking function that i could *probably* softcode but it's... fine
async function calculateRankAverages() {
    for (const rank of RANKS) {
        console.log(`calculating averages for rank ${rank}...`);

        const rankTotals = {
            sprintTime: 0,
            sprintPps: 0,
            sprintKpp: 0,
            sprintKps: 0,
            sprintFinesse: 0,

            blitzScore: 0,
            blitzPps: 0,
            blitzSpp: 0,
            blitzFinesse: 0,

            zenithHeight: 0,
            zenithPps: 0,
            zenithApm: 0,
            zenithClimbSpeed: 0,
            zenithBtb: 0,
            zenithFinesse: 0,

            zenithExHeight: 0,
            zenithExPps: 0,
            zenithExApm: 0,
            zenithExClimbSpeed: 0,
            zenithExBtb: 0,
            zenithExFinesse: 0,

            leaguePps: 0,
            leagueVs: 0,
            leagueApm: 0
        }

        for (const userData of userDataList[rank]) {
            let recordResults;

            if (userData["40l"]?.record) {
                recordResults = userData["40l"].record.results;

                rankTotals.sprintTime += recordResults.stats.finaltime;
                rankTotals.sprintPps += recordResults.aggregatestats.pps;
                rankTotals.sprintKpp += recordResults.stats.inputs / recordResults.stats.piecesplaced;
                rankTotals.sprintKps += recordResults.stats.inputs / (recordResults.stats.finaltime / 1000);

                
                if (recordResults.stats.finesse) rankTotals.sprintFinesse += recordResults.stats.finesse.perfectpieces / recordResults.stats.piecesplaced;
            }

            if (userData.blitz?.record) {
                recordResults = userData.blitz.record.results;

                rankTotals.blitzScore += recordResults.stats.score;
                rankTotals.blitzPps += recordResults.aggregatestats.pps;
                rankTotals.blitzSpp += recordResults.stats.score / recordResults.stats.piecesplaced;

                if (recordResults.stats.finesse) rankTotals.blitzFinesse += recordResults.stats.finesse.perfectpieces / (recordResults.stats.piecesplaced || 1);
            }

            if (userData.zenith && (userData.zenith.best?.record || userData.zenith.record)) {
                recordResults = (userData.zenith.best?.record || userData.zenith.record).results;

                rankTotals.zenithHeight += recordResults.stats.zenith.altitude;
                rankTotals.zenithPps += recordResults.aggregatestats.pps;
                rankTotals.zenithApm += recordResults.aggregatestats.apm;
                rankTotals.zenithClimbSpeed += recordResults.stats.zenith.rank;
                rankTotals.zenithBtb += recordResults.stats.topbtb;
                rankTotals.zenithFinesse += recordResults.stats.finesse.perfectpieces / (recordResults.stats.piecesplaced || 1);
            }

            if (userData.zenithex && (userData.zenithex.best?.record || userData.zenithex.record)) {
                recordResults = (userData.zenithex.best?.record || userData.zenithex.record).results;

                rankTotals.zenithExHeight += recordResults.stats.zenith.altitude;
                rankTotals.zenithExPps += recordResults.aggregatestats.pps;
                rankTotals.zenithExApm += recordResults.aggregatestats.apm;
                rankTotals.zenithExClimbSpeed += recordResults.stats.zenith.rank;
                rankTotals.zenithExBtb += recordResults.stats.topbtb;
                rankTotals.zenithExFinesse += recordResults.stats.finesse.perfectpieces / (recordResults.stats.piecesplaced || 1);
            }

            // league is guaranteed
            rankTotals.leaguePps += userData.league.pps;
            rankTotals.leagueVs += userData.league.vs;
            rankTotals.leagueApm += userData.league.apm;
        }

        const numUsers = userDataList[rank].length;
        for (const k of Object.keys(rankTotals)) {
            rankTotals[k] /= numUsers;
        }

        await database.LeagueAverage.upsert({
            rank: rank,
            ...rankTotals
        });

        printPretty(RANKS.indexOf(rank)+1, RANKS.length);
    }
}

// wow! pretty logging. very necessary
function printPretty(progress, total, durationEach = null) {
    const barLen = Math.floor(progress * BAR_SIZE/total);
    const percent = ((progress/total)*100).toFixed(2).padStart(5, '0');

    let toLog = `[ #${'#'.repeat(barLen)}` + 
                `${' '.repeat(BAR_SIZE - barLen)} ]` +
                ` ${percent}%`;

    if (durationEach) {
        toLog += ` (about ${(Math.ceil((total - progress) * 100 * durationEach) / 100).toFixed(2)}s left)`;
    }
    toLog += ``;

    console.log(toLog);
}

async function sleep(ms) {
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
        const response = await fetch(url, { headers: { 'X-Session-ID': sessionId } });
        return response;
    }
    catch (error) {
        return {success: false, error: { msg: `${error.message}` } };
    }
}


main();