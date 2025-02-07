module.exports = (sequelize, DataTypes) => {
    return sequelize.define('users', {
        userId: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        tetrioId: {
            type: DataTypes.STRING,
        },

        ratingAlert: { // next rating alert time
            type: DataTypes.DATE,
            allowNull: true,
        },
        ratingAlerted: { // if rating alert has already triggered
            type: DataTypes.BOOLEAN,
            allowNull: true,
        }

    }, {
        timestamps: false,
    });
};