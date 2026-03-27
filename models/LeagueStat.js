const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
    class LeagueStat extends Model {}

    LeagueStat.init({
        stat: {
            type: DataTypes.STRING,
            primaryKey: true,
        },

        statGroup: {
            type: DataTypes.ENUM("sprint", "blitz", "league", "zenith", "zenithex", "achievements"),
            allowNull: false,
        },

        // formatted as { "rank": value, ... }
        values: {
            type: DataTypes.JSON,
            defaultValue: {},
        },

        seenCount: {
            type: DataTypes.JSON,
            defaultValue: {},
        }
    }, {
        sequelize,
        modelName: 'LeagueStat',
        timestamps: true,
    })

    return LeagueStat;
}