const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
    class Achievement extends Model {}

    Achievement.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
        },

        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        shortname: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        
        objective: {
            type: DataTypes.STRING,
            allowNull: false,
        }
    }, {
        sequelize,
        modelName: 'Achievement',
        timestamps: true,
    })

    return Achievement;
}