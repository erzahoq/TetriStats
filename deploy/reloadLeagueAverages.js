const { database } = require('../database.js');
const uuid = require('uuid');

let sessionId;

// request cooldowns (in seconds)
const USER_DATA_REQUEST_COOLDOWN = 1.05;
const LEAGUE_USERS_REQUEST_COOLDOWN = 1.35;

const USERS_PER_RANK = 150;
const MAX_ERRORS = 5;
const BAR_SIZE = 35;
const RANKS = ['d', 'd+', 'c-', 'c', 'c+', 'b-', 'b', 'b+', 'a-', 'a', 'a+', 's-', 's', 's+', 'ss', 'u', 'x', 'x+'];

let userRankList = {};
let userDataList = {};
let lastRequestTime = new Date(0);

async function main() {
    console.log("starting... this'll take a while!")
    sessionId = uuid.v4();

    await fetchAllLeagueUsers();
    chooseRandomUsers();
    
    sessionId = uuid.v4();
    await fetchUserAverages();

    await calculateRankAverages();

    console.log("all done!");
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
            userRankList[rank] = [];
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
            userRankList[user.league.rank].push(user.username);
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
    let oldRankList = {...userRankList};
    userRankList = {};

    for (const rank of RANKS) {
        userRankList[rank] = [];

        if (oldRankList[rank].length <= USERS_PER_RANK) {
            userRankList[rank] = oldRankList[rank];
            continue;
        }

        while (userRankList[rank].length < USERS_PER_RANK) {
            const randomIndex = Math.floor(Math.random() * oldRankList[rank].length);
            userRankList[rank].push(oldRankList[rank][randomIndex]);
            oldRankList[rank].splice(randomIndex, 1);
        }
    }

    console.log(`selected ${USERS_PER_RANK} users from each rank, for a total of ${Object.values(userRankList).flat().length} users`);
}

async function fetchUserAverages() {
    console.log("fetching user data...");
    const totalUsers = Object.values(userRankList).flat().length;
    let currentUsers = 0;

    for (const rank of RANKS) {
        console.log(`working on rank ${rank}...`);

        // console.debug(`usernames: ${userRankList[rank].join(', ')}`);

        userDataList[rank] = [];
        let totalErrors = 0;

        for (const username of userRankList[rank]) {
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
                rankTotals.sprintFinesse += recordResults.stats.finesse.perfectpieces / recordResults.stats.piecesplaced;
            }

            if (userData.blitz?.record) {
                recordResults = userData.blitz.record.results;

                rankTotals.blitzScore += recordResults.stats.score;
                rankTotals.blitzPps += recordResults.aggregatestats.pps;
                rankTotals.blitzSpp += recordResults.stats.score / recordResults.stats.piecesplaced;
                rankTotals.blitzFinesse += recordResults.stats.finesse.perfectpieces / recordResults.stats.piecesplaced;
            }

            if (userData.zenith && (userData.zenith.best?.record || userData.zenith.record)) {
                recordResults = (userData.zenith.best?.record || userData.zenith.record).results;

                rankTotals.zenithHeight += recordResults.stats.zenith.altitude;
                rankTotals.zenithPps += recordResults.aggregatestats.pps;
                rankTotals.zenithApm += recordResults.aggregatestats.apm;
                rankTotals.zenithClimbSpeed += recordResults.stats.zenith.rank;
                rankTotals.zenithBtb += recordResults.stats.topbtb;
                rankTotals.zenithFinesse += recordResults.stats.finesse.perfectpieces / recordResults.stats.piecesplaced;
            }

            if (userData.zenithex && (userData.zenithex.best?.record || userData.zenithex.record)) {
                recordResults = (userData.zenithex.best?.record || userData.zenithex.record).results;

                rankTotals.zenithExHeight += recordResults.stats.zenith.altitude;
                rankTotals.zenithExPps += recordResults.aggregatestats.pps;
                rankTotals.zenithExApm += recordResults.aggregatestats.apm;
                rankTotals.zenithExClimbSpeed += recordResults.stats.zenith.rank;
                rankTotals.zenithExBtb += recordResults.stats.topbtb;
                rankTotals.zenithExFinesse += recordResults.stats.finesse.perfectpieces / recordResults.stats.piecesplaced;
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