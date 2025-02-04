module.exports = (sequelize, DataTypes) => {
    return sequelize.define('users', {
        userId: {
            type: DataTypes.STRING,
            primarykey: true,
        },
        tetrioId: {
            type: DataTypes.STRING,
        },

        ratingAlert: { // next rating alert time
            type: DataTypes.DATE,
            allowNull: true,
        },
        ratingAlerted: { // if rating alert has already triggered
            type:DataTypes.BOOL,
            allowNull: true,
        }

    }, {
        timestamps: false,
    });
};