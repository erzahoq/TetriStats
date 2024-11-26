const { SlashCommandBuilder } = require('discord.js');
const api = `https://ch.tetr.io/api`

module.exports = {
	data: new SlashCommandBuilder()
		.setName('performance')
		.setDescription('Provides a detailed breakdown of a player\'s advanced TETR.IO stats.')
        .addStringOption((option) =>
			option
				.setName('user')
				.setDescription('the username/ID to search for')
				.setRequired(true),
		),
	async execute(interaction) {
		const user = interaction.options.getString('user').toLowerCase();

        let response = await fetch(`https://ch.tetr.io/api/users/${user}`);
        let userStats = await response.json();

        if (!userStats.success) {
            if (userStats.error.msg === "No such user! | Either you mistyped something, or the account no longer exists.") {
                return await interaction.reply({
                    content: 'No such user! Either you mistyped something, or this user no longer exists.',
                    ephemeral: true
                });
            } else {
                return await interaction.reply({
                    content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                    ephemeral: true
                });
            }
        }

		response = await fetch(`https://ch.tetr.io/api/users/${user}/summaries/league`);
		let leagueStats = await response.json();
		response = await fetch(`https://ch.tetr.io/api/labs/leagueflow/${user}`);
		let matchProgressionStats = await response.json();
		response = await fetch(`https://ch.tetr.io/api/general/stats`);
		let generalStats = await response.json();

		userStats = userStats.data;
		leagueStats = leagueStats.data;
		matchProgressionStats = matchProgressionStats.data;
		generalStats = generalStats.data;

		const analysisData = {
			username: userStats.username,
			country: countryCodeToEmoji(userStats.country),
			gamesPlayed: userStats.gamesplayed,
			gamesWon: userStats.gameswon,
			gameTime: userStats.gametime,
			tr: leagueStats.tr,
			glicko:  leagueStats.glicko,
			rd:  leagueStats.rd,
			apm:  leagueStats.apm,
			pps: leagueStats.pps,
			vs: leagueStats.vs,
			linesCleared: matchProgressionStats.linescleared || 0,
			piecesPlaced: matchProgressionStats.piecesplaced || 0,
			inputs: generalStats.inputs || 0,
			downstackLines: matchProgressionStats.downstack || 0,
			winStreak: matchProgressionStats.currentwinstreak || 0,
			bestStreak: matchProgressionStats.bestwinstreak || 0,
			highestApm: matchProgressionStats.highestApm || 0,
			highestPps: matchProgressionStats.highestPps || 0,
			highestVs: matchProgressionStats.highestVs || 0
		  };

		  console.log(generateAnalysis(analysisData))


	},
};


//comedically large function
function generateAnalysis({
	username,
	country,
	gamesPlayed,
	gamesWon,
	gameTime, // in seconds
	tr,
	glicko,
	rd,
	apm,
	pps,
	vs,
	linesCleared,
	piecesPlaced,
	inputs,
	downstackLines,
	winStreak,
	bestStreak,
	highestApm,
	highestPps,
	highestVs
  }) {
	// Derived Metrics (these numbers work and idk why but other bots use these so)
//writing code on phone is awful maybe i shouldnt do that
	const winRate = ((gamesWon / gamesPlayed) * 100).toFixed(2);
	const totalGameTime = `${Math.floor(gameTime / 3600)}h ${Math.floor((gameTime % 3600) / 60)}m`;
	const app = (apm / (pps * 60)).toFixed(2);
	const dsSecond = (vs / 100 - apm / 60).toFixed(2);
	const dsPiece = (dsSecond / pps).toFixed(2);
	const cheeseIndex = ((dsPiece * 150) + (((vs / apm) - 2) * 50) + ((0.6 - app) * 125)).toFixed(2);
	const lineEfficiency = (linesCleared / piecesPlaced).toFixed(2);
	const garbageEfficiency = (vs * downstackLines / Math.pow(piecesPlaced, 2)).toFixed(4);
	const survivalEfficiency = (gameTime / linesCleared).toFixed(2);
	const garbagePerSecond = (vs / gameTime).toFixed(2);
	const attackEfficiency = (vs / linesCleared).toFixed(2);
	const winLossRatio = (gamesWon / (gamesPlayed - gamesWon)).toFixed(2);
  
	// Formatting the Output
	return `  
  Analysis for Player: ${username}
  --------------------------------
  📋 Basic Info:
  - TR: ${tr} | Glicko: ${glicko} ± ${rd}
  - Country: ${country || "Unknown"}
  - Games Played: ${gamesPlayed} | Games Won: ${gamesWon} (${winRate}% Win Rate)
  - Total Game Time: ${totalGameTime}
  
  🎮 Core Stats:
  - APM: ${apm} | PPS: ${pps} | VS: ${vs}
  - Lines Cleared: ${linesCleared} | Pieces Placed: ${piecesPlaced}
  
  📊 Advanced Metrics:
  - APP: ${app} | DS/Second: ${dsSecond} | DS/Piece: ${dsPiece}
  - Cheese Index: ${cheeseIndex}
  - Line Efficiency: ${lineEfficiency}
  - Garbage Efficiency: ${garbageEfficiency}
  
  🛡️ Survival & Attack:
  - Survival Efficiency: ${survivalEfficiency}s/line
  - Garbage Per Second: ${garbagePerSecond}
  - Attack Efficiency: ${attackEfficiency}
  
  📈 Win/Loss & Risk:
  - Win/Loss Ratio: ${winLossRatio}
  - Current Streak: ${winStreak} Wins | Best Streak: ${bestStreak} Wins
  
  🔥 Peak Stats:
  - Highest APM: ${highestApm} | Highest PPS: ${highestPps} | Highest VS: ${highestVs}
	`;
  }
  

  // Convert country code to flag emoji
function countryCodeToEmoji(countryCode) {
	if (countryCode === 'xm') return ("<:flag_xm:1310891739078328374>")
    const codePoints = countryCode
        .toUpperCase() // Make sure the code is uppercase
        .split('')     // Split the letters
        .map(char => 127397 + char.charCodeAt()); // Convert to regional indicator symbol

    return String.fromCodePoint(...codePoints);
}
