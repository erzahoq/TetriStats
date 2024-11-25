const { SlashCommandBuilder } = require('discord.js');
const api = `https://ch.tetr.io/api`

module.exports = {
	data: new SlashCommandBuilder()
		.setName('performance')
		.setDescription('Generates a detailed performance report for a TETR.IO player.')
        .addStringOption(option => 
            option.setName('username')
                .setDescription('The TETR.IO username')
                .setRequired(true)),
	async execute(interaction) {
		let response;
		
		let userInfo;
		let gamemodeInfo;
		let leagueflowInfo;
		let skillflowInfo40L;
		let skillflowInfoBlitz;

        	//interaction.reply('tba (tetris battle advanced)') //this is truely one of the most battle advanced of all time

		// get user info at /users/:user
		response = await fetch(`${api}/users/${user}`);
            	userInfo = await response.json();

		//check if the API call succeeded
		if (!userInfo.success) {
			//check if it failed, and if it did, check if it was the user's fault
	                if (userInfo.error.msg === "No such user! | Either you mistyped something, or the account no longer exists.") {
	                    return await interaction.reply({
	                        content: 'No such user! Either you mistyped something, or this user no longer exists.',
	                        ephemeral: true
	                    });
	                } else {
			//API fault L
	                    return await interaction.reply({
	                        content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
	                        ephemeral: true
	                    });
	                }
	            }
		//if it's all okay, then:
		// get gamemode specific info at /users/:user/summaries
		response = await fetch(`${api}/users/${user}/summaries`);
            	gamemodeInfo = await response.json(); 	
		// get leagueflow info at /labs/leagueflow/:user (for Tetra League)
		response = await fetch(`${api}/labs/leagueflow/${user}`);
		leagueflowInfo = await response.json();
		// get skillflow info at /labs/scoreflow/:user/:gamemode (for 40L and Blitz)
		response = await fetch(`${api}/labs/scoreflow/${user}/40l`);
		skillflowInfo40L = await response.json();
		response = await fetch(`${api}/labs/scoreflow/${user}/blitz`);
		skillflowInfoBlitz = await response.json();
		

		
	},
};

function fetchData() {
    
}
