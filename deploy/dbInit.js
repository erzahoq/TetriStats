const { Sequelize } = require('sequelize');
const path = require('node:path');
const fs = require('node:fs');

async function run() {
	const sequelize = new Sequelize('database', 'user', 'password', {
		host: 'localhost',
		dialect: 'sqlite',
		logging: false,
		// SQLite only
		storage: __dirname + '/../database.sqlite',
	});

	const modelsPath = path.join(__dirname, '/../models');
	const modelFiles = fs.readdirSync(modelsPath).filter(file => file.endsWith('.js'));
	const list = {}; // list of all models

	for (const file of modelFiles) {
		const filePath = path.join(modelsPath, file);
		list[file] = require(filePath)(sequelize, Sequelize.DataTypes);
	}

	await sequelize.sync({ force: true });

	sequelize.close();
}

run();