// this figures out if a user entered is a Discord user ID or a TETR.IO username, and then returns the TETR.IO ID.

async function getUser(user) {
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
                return "no such user" /*await interaction.reply({
                    content: 'No such user found on TETR.IO! Either the account no longer exists, or this person has not linked their Discord with TETR.IO.',
                    ephemeral: true
                });*/
            }

            if (!stats.success) {
                return "server error" /*await interaction.reply({
                    content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                    ephemeral: true
                });*/
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
                    return "no such user" /*await interaction.reply({
                        content: 'No such user! Either you mistyped something, or this user no longer exists.',
                        ephemeral: true
                    });*/
                } else {
                    return "server error" /*await interaction.reply({
                        content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                        ephemeral: true
                    });*/
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