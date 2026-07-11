const { Events, ActivityType, EmbedBuilder } = require("discord.js");

const { initEmojis } = require("../helpers/emojis");
const { database } = require("../database");
const { formatNumber } = require("../helpers/formatters");
const { startCacheCleaner, fetchCached } = require("../helpers/fetch");


module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        await initEmojis(client);

        status(client);
        setInterval(() => status(client), 300000);
        
        checkRdAlerts(client);
        setInterval(() => checkRdAlerts(client), 1000 * 60 * 30);

        client.pageData = new Map();
        setInterval(() => cleanPageData(client), 1000 * 60 * 10);

        startCacheCleaner();
    }
}

async function status(client) {
    try {
        const responseData = await fetchCached('https://ch.tetr.io/api/general/stats'); // Get stats data
        const totalAccounts = responseData.data.usercount;

        // console.log('Successfully fetched player count!');
        client.user.setActivity(`${formatNumber(totalAccounts)} TETR.IO players`, { type: ActivityType.Watching });
    } catch (error) {
        console.log(`Couldn't fetch player count! ${error.message}`);
    }
}

async function checkRdAlerts(client) {
    console.log('Checking RD alerts...');
    const userList = await database.User.findAll();
    let resp;
    for (const user of userList) {
        resp = await user.checkAlert(); // check if alert is needed
        // console.log(`Checked for ${user.userId}, got ${resp}`);
        if (!(resp instanceof Error) && resp) { // make sure it doesn't error, and also is true
            console.log('Alerting ' + user.userId);
            const userToMessage = await client.users.fetch(user.userId);
            userToMessage.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor('ffdd22')
                        .setDescription('Your Tetra League rating deviation has begun rising!')
                        .setTitle('RD Alert')
                ]}).catch(
                (err) => console.log(`Couldn't alert user ${user.userId}! ${err.message}`) // means we can't DM user, cope
            )
        }
        if (resp instanceof Error) {
            console.log(`RD alert check errored for ${user.userId}! ${resp.message}`);
        }
    }
    console.log('Finished checking RD alerts!');
}

function cleanPageData(client) {
    const now = Date.now();
    for (const [key, session] of client.pageData.entries()) {
        if (session?.expiresAt && session.expiresAt <= now) {
            client.pageData.delete(key);
        }
    }
}
