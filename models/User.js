const { Sequelize, DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
    class User extends Model {
        async checkAlert() {
            if (!this.alertsEnabled) return false; // user has alerts turned off and isn't turning them on

            // if the user doesn't have a TETR.IO id linked to them yet
            if (!this.tetrioId) {
                const discordSearch = await (await fetch(`https://ch.tetr.io/api/users/search/discord:${this.userId}`)).json();
                if (!discordSearch.success) return new Error("Unable to access TETR.IO servers!"); // wuh oh
                if (!discordSearch.data) { // ok that's not our fault
                    this.alertsEnabled = false;
                    await this.save();
                    return new Error("User doesn't have their account linked!")
                } 

                // update user
                this.tetrioId = discordSearch.data.user._id;
            }

            const leagueInfo = await (await fetch(`https://ch.tetr.io/api/users/${this.tetrioId}/summaries/league`)).json();
            console.log(`Fetched league summary for ${this.userId}, got `,leagueInfo)
            if (!leagueInfo.success) return new Error("Unable to access TETR.IO servers!"); // i love copy/pasting code

            // user was already alerted but their rating is no longer decaying
            if (!leagueInfo.data.decaying && this.ratingAlerted) {
                this.ratingAlerted = false;
            }

            // alert the user
            if (leagueInfo.data.decaying && !this.ratingAlerted) {
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

        alertsEnabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
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