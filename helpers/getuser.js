// this figures out if a user entered is a Discord user ID or a TETR.IO username, and then returns the TETR.IO ID.

async function getUser(user) {
    user = user.trim().replace(/^@/g, ""); // remove first @ in case discord does a silly
    let discordRegex = new RegExp("[0-9]{18,}"); // regex to check if there are 18 or more numbers in the name, meaning its probably a discord username
    let isDiscordUser = false;

    if (discordRegex.test(user)) { // check if it matches
        isDiscordUser = true;
    }

    // Fetch the account with either discord or tetrio
    if (isDiscordUser) {
        let userID = user
        const discordMatch = userID.match(/<@(\d+)>/);
        if (discordMatch) {
            userID = discordMatch[1]
        }

        let response = await fetch(`https://ch.tetr.io/api/users/search/discord:id:${userID}`);
        stats = await response.json();

        if (stats.data.users[0] === undefined) {
            return "no such user"
        }

        if (!stats.success) {
            return "server error"
        }

        return {
            "_id": stats.data.users[0]._id,
            "username": stats.data.users[0].username
        }; // return tetrio small info
    } else {
        const response = await fetch(`https://ch.tetr.io/api/users/${user}`);
        stats = await response.json();

        if (!stats.success) {
            if (stats.error.msg === "No such user! | Either you mistyped something, or the account no longer exists.") {
                return "no such user"
            } else {
                return "server error"
            }
        }

        return {
            "_id": stats.data._id,
            "username": stats.data.username
        }; // return tetrio small info
    }
}

module.exports = {
    getUser
}