const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class LeagueAverage extends Model {}
    
    LeagueAverage.init({
        rank: {
            type: DataTypes.STRING,
            primaryKey: true,
            validate: {
                isIn: [['d', 'd+', 'c-', 'c', 'c+', 'b-', 'b', 'b+', 'a-', 'a', 'a+', 's-', 's', 's+', 'ss', 'u', 'x', 'x+']]
            }
        },

        // 40l stats
        sprintTime: { // in milliseconds
            type: DataTypes.FLOAT
        },
        sprintPps: {
            type: DataTypes.FLOAT
        },
        sprintKpp: {
            type: DataTypes.FLOAT
        },
        sprintKps: {
            type: DataTypes.FLOAT
        },
        sprintFinesse: {
            type: DataTypes.FLOAT
        },

        // blitz stats
        blitzScore: {
            type: DataTypes.FLOAT
        },
        blitzPps: {
            type: DataTypes.FLOAT
        },
        blitzSpp: {
            type: DataTypes.FLOAT
        },
        blitzFinesse: {
            type: DataTypes.FLOAT
        },

        // Zenith tower stats
        zenithHeight: {
            type: DataTypes.FLOAT
        },
        zenithPps: {
            type: DataTypes.FLOAT
        },
        zenithApm: {
            type: DataTypes.FLOAT
        },
        zenithApp: {
            type: DataTypes.VIRTUAL,
            get() {
                return (this.zenithApm / 60) / this.zenithPps;
            }
        },
        zenithClimbSpeed: {
            type: DataTypes.FLOAT
        },
        zenithBtb: {
            type: DataTypes.FLOAT
        },
        zenithFinesse: {
            type: DataTypes.FLOAT
        },

        // Zenith Expert stats
        zenithExHeight: {
            type: DataTypes.FLOAT
        },
        zenithExPps: {
            type: DataTypes.FLOAT
        },
        zenithExApm: {
            type: DataTypes.FLOAT
        },
        zenithExApp: {
            type: DataTypes.VIRTUAL,
            get() {
                return (this.zenithExApm / 60) / this.zenithExPps;
            }
        },
        zenithExClimbSpeed: {
            type: DataTypes.FLOAT
        },
        zenithExBtb: {
            type: DataTypes.FLOAT
        },
        zenithExFinesse: {
            type: DataTypes.FLOAT
        },


        // league stats
        leaguePps: {
            type: DataTypes.FLOAT
        },
        leagueVs: {
            type: DataTypes.FLOAT
        },
        leagueApm: {
            type: DataTypes.FLOAT
        },
        leagueApp: {
            type: DataTypes.VIRTUAL,
            get() {
                return (this.leagueApm / 60) / this.leaguePps;
            }
        }

    }, {
        sequelize,
        modelName: 'LeagueAverage',
        tableName: 'league_averages',
        timestamps: true
    });
    
    return LeagueAverage;
}