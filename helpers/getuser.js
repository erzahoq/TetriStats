const { fetchCached } = require('./fetch');


// this figures out if a user entered is a Discord user ID or a TETR.IO username, and then returns the TETR.IO ID.

async function getUser(user, interaction) {
    user = user.trim().replace(/^@/g, ""); // remove first @ in case discord does a silly
    const discordRegex = new RegExp("[0-9]{18,}"); // regex to check if there are 18 or more numbers in the name, meaning its probably a discord username
    let isDiscordUser = false;

    if (discordRegex.test(user)) { // check if it matches
        isDiscordUser = true;
    }

    if (user === "me") {
        isDiscordUser = true;
        user = `<@${interaction.user.id}>`;
    }

    // Fetch the account with either discord or tetrio
    if (isDiscordUser) {
        let userID = user
        const discordMatch = userID.match(/<@(\d+)>/);
        if (discordMatch) {
            userID = discordMatch[1]
        }

        const stats = await fetchCached(`https://ch.tetr.io/api/users/search/discord:id:${userID}`);

        if (!stats.success) {
            return "server error"
        }

        if (stats.data.users[0] === undefined) {
            return "no such user"
        }

        return {
            "_id": stats.data.users[0]._id,
            "username": stats.data.users[0].username
        }; // return tetrio small info
    } 
    const stats = await fetchCached(`https://ch.tetr.io/api/users/${user}`);

    if (!stats.success) {
        if (stats.error.msg === "No such user! | Either you mistyped something, or the account no longer exists.") {
            return "no such user"
        } 
        return "server error"
        
    }

    return {
        "_id": stats.data._id,
        "username": stats.data.username
    }; // return tetrio small info
    
}

module.exports = {
    getUser
}