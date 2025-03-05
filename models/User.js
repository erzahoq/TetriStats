const { Sequelize, DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
    class User extends Model {
        async checkAlert(forceUpdate) {
            if (!this.ratingAlert && !forceUpdate) return false; // user has alerts turned off and isn't turning them on

            // if the user doesn't have a TETR.IO id linked to them yet
            if (!this.tetrioId) {
                const discordSearch = await (await fetch(`https://ch.tetr.io/api/users/search/discord:${this.userId}`)).json();
                if (!discordSearch.success) return new Error("Unable to access TETR.IO servers!"); // wuh oh
                if (!discordSearch.data) return new Error("User doesn't have their account linked!") // ok that's not our fault

                // update user
                this.tetrioId = discordSearch.data.user._id;
            }

            const lastGameData = await (await fetch(`https://ch.tetr.io/api/users/${this.tetrioId}/records/league/recent?limit=1`)).json();
            console.log(`Fetched most recent league for ${this.userId}, got `,lastGameData.data.entries)
            if (!lastGameData.success) return new Error("Unable to access TETR.IO servers!"); // i love copy/pasting code
            const gameTime = new Date(lastGameData.data.entries[0].ts);
            const alertTime = gameTime + 604800000 // one week

            // update rating alert time if outdated or if turning on
            if (alertTime > this.ratingAlert || forceUpdate) {
                this.ratingAlert = alertTime;
            }

            // alert the user
            if (this.ratingAlert > Date.now() && !this.ratingAlerted) {
                this.ratingAlerted = true;
                await this.save();
                return true;
            }

            await this.save()
            return false;
        }
    }

    User.init({
        userId: {
            type: DataTypes.STRING,
            primaryKey: true
        },
        tetrioId: {
            type: DataTypes.STRING
        },

        ratingAlert: {
            type: DataTypes.DATE,
            allowNull: true
        },
        ratingAlerted: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        }
    }, {
        sequelize,
        timestamps: false,
        modelName: "User",
    })

    return User;
    // return sequelize.define('users', {
    //     userId: {
    //         type: DataTypes.STRING,
    //         primaryKey: true,
    //     },
    //     tetrioId: {
    //         type: DataTypes.STRING,
    //     },

    //     ratingAlert: { // next rating alert time
    //         type: DataTypes.DATE,
    //         allowNull: true,
    //     },
    //     ratingAlerted: { // if rating alert has already triggered
    //         type: DataTypes.BOOLEAN,
    //         allowNull: true,
    //     }

    // }, {
    //     timestamps: false,
    // });
};