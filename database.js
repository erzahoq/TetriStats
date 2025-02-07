const { Sequelize } = require('sequelize');
const path = require('node:path');
const fs = require('node:fs');

const sequelize = new Sequelize('database', 'user', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	// SQLite only
	storage: 'database.sqlite',
});

const modelsPath = path.join(__dirname, 'models');
const modelFiles = fs.readdirSync(modelsPath).filter(file => file.endsWith('.js'));
var list = {}; // list of all models

for (const file of modelFiles) {
	const filePath = path.join(modelsPath, file);
	list[file.replace('.js','')] = require(filePath)(sequelize,Sequelize.DataTypes);
}

Reflect.defineProperty(list['User'].prototype, 'checkAlert', {
	value: async (forceUpdate) => {
		if (!this.ratingAlert && !forceUpdate) return false; // user has alerts turned off and isn't turning them on

		// if the user doesn't have a TETR.IO id linked to them yet
		if (!this.tetrioId) {
			const discordSearch = await (await fetch(`https://ch.tetr.io/api/users/search/discord:${this.userId}`)).json();
			if (!discordSearch.success) return new Error("Unable to access TETR.IO servers!"); // wuh oh
			if (!discordSearch.data) return new Error("User doesn't have their account linked!") // ok that's not our fault

			// update user
			this.tetrioId = discordSearch.data.user._id;
		}

		const lastGameData = (await fetch(`https://ch.tetr.io/api/users/${this.tetrioId}/records/league/recent?limit=1`));
		if (!lastGameData.success) return new Error("Unable to access TETR.IO servers!"); // i love copy/pasting code
		const gameTime = new Date(lastGameData[0].ts);
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
})

const database = list;

module.exports = { database }