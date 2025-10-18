const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
    class LeagueStat extends Model {}

    LeagueStat.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },

        stat: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        statGroup: {
            type: DataTypes.ENUM("sprint", "blitz", "league", "zenith", "zenithex", "achievements"),
            allowNull: false,
        },

        // formatted as { "rank": value, ... }
        values: {
            type: DataTypes.JSON,
            defaultValue: {},
        }
    }, {
        sequelize,
        modelName: 'LeagueStat',
        timestamps: false,
    })

    return LeagueStat;
}