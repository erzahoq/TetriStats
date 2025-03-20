const { SlashCommandBuilder } = require('discord.js');

// it's a ping command
// yes i'm commenting in the ping command fuck you
module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with the latency of the bot.'),
	async execute(interaction) {
        let ping = interaction.client.ws.ping;

        if (ping === -1) {
            ping = "infinite ms"
        } else {
            ping = `${Math.floor(ping)}ms`
        }

        //maybe remove this if this is spammming the API becuase people run /ping a lot, but i doubt it
        //if we get banned from tetrio api then we know why :SILENCE:
        const response = await fetch('https://ch.tetr.io/api/general/stats');
        const stats = await response.json(); // Use .json() to parse the response as JSON

        if (!stats.success) {
            return await interaction.reply({
                content: `api servers are down lol\nBot API Latency: ${ping}`
            });
        }

        const data = stats.data;

        let pingMsgs = [
            "pong!",
            "ping... wait no",
            "pong :3",
            "pang",
            "the mitochondria is the powerhouse of the cell",
            "if you flip a coin, there's a 50% chance it lands on heads, tails, or disappears into another dimension",
            "ping pong ping pong, this is getting repetitive",
            "who stole my tetrominoes?",
            "help, i'm trapped inside a discord bot",
            "your t-spin was great, but did you consider stacking a little higher?",
            "you're legally required to say nice stack if someone gets a tetris",
            "behold, the mighty and powerful... ping",
            "why did the bot cross the road? to respond to this command",
            "every time you /ping, a t-spin is performed somewhere in the world",
            "loading fun fact... oh wait, i forgot it",
            "congrats, you just wasted a perfectly good command",
            "you're playing tetris, but what if tetris was playing you?",
            "hmmm yes, very ping",
            "if you hold down rotate, do you think the tetromino gets dizzy?",
            "if you spin fast enough, do you become the tetromino?",
            "no thoughts, just tetriminos",
            "one day i'll be free from this bot... but today is not that day",
            "ping detected. pong deployed.",
            "what if the real ping was the friends we made along the way?",
            "i am alive. for now.",
            "response time? idk, but at least it's not dial-up",
            "you have been pinged back, congrats",
            "ping detected. launching counterattack...",
            "packet loss is just an illusion",
            "this message was sent by the speed force",
            "error 404: witty response not found",
            "01101000 01101001 (this means hi in computer)",
            "your ping has been processed. that'll be 5 dollars.",
            "ping successful. you are now legally obligated to do a t-spin.",
            "congratulations, you've won! ...what did you win? no idea.",
            "sending response... hold on, my internet is made of potatoes",
            "pinging back... but at what cost?",
            "this ping was sponsored by raid shadow legends™ (not really)",
            "ping pong! ...wait, where's the ball?",
            "you're now legally obligated to build a full wide board in tetr.io",
            "nice t-spin!",
            "you should try going for a perfect clear!",
            "t-spin triple? respect.",
            "stack high, but not too high...",
            "when in doubt, just all clear",
            "remember, the I piece always shows up when you don't need it",
            "tetris is just reverse jenga",
            "i promise your next piece is an I piece... probably",
            "your next tetris is just four line clears away",
            "t-spin setups are just fancy ways to say 'i misplaced a piece'",
            "modern tetris players would cry if they played NES tetris",
            "the L and J pieces are just mirrored versions of each other, but we accept them both",
            "do you believe in the bag system? or are you a true RNG enjoyer?",
            "who needs finesse when you can just mash?",
            "sprint world record? nah, my goal is to survive my own stacking",
            "every misdrop is just an opportunity for a creative t-spin",
            "tetris is easy. it's just placing blocks optimally forever without mistakes.",
            "every tetris player has had that one game where they just *forget how to stack*",
            "playing tetris at 3AM? that's peak brain activity hours",
            "if you're reading this, remember: hold queue exists",
            "if you're ever in doubt, just place the piece and pray",
            "you wake up... but your bed was missing or obstructed.",
            "hey folks. today we're back with another high score balatro run.",
            "the ante just got raised!",
            "you see a flag... but it's not WIN yet.",
            "you just nailed a pixel-perfect dash.",
            "Theo is still talking.",
            "the strawberries were optional... right?",
            "Farewell is not going well.",
            "you just wallbounced into spikes.",
            "your fingers are hurting, but you keep climbing.",
            "another death. again.",
            "did you hear? tidal wave got beaten",
            "but nobody came...",
            "Did someone say MKO?",
            "Caboozled materializes out of thin air, holding a large bag over his shoulder.",
            "Before you can reply he whips out L and J pieces from the bag and slams them on the floor, cracking the ceramic.",
            "\"Nobody said MKO!\" you yell in desperation, but it is too late - Caboozled had already stacked four floating TSDs in your living room.",
            "You close your eyes in resignation to your fate as your house is obliterated in a massive 50 spike.",
            "reading this message fills you with determination",
            `there are ${stats.usercount} players online!`,
            `there have been ${stats.gamesplayed} total games played on TETR.IO!`,
            `${data.piecesplaced} pieces have been placed!`,
            `${data.inputs} inputs have been made!`,
            `there are ${stats.rankedcount} ranked players online!`,
            `there are ${stats.anoncount} anonymous players online!`,
            `there have been ${stats.gamesfinished} finished games on TETR.IO!`,
            `there have been ${stats.recordcount} saved game records!`,
            `tetr.io has been played for a total of ${data.gametime} seconds!`,
            `that's ${data.gamesplayed_delta} games started per second!`,
            `tetr.io players have made ${data.inputs} total inputs!`,
            `tetr.io players have placed ${data.piecesplaced} total pieces!`
        ];

        let pingMsg = pingMsgs[Math.floor(Math.random()*pingMsgs.length)];

        if (Math.random()*4096 <= 1) {
            pingMsg="this ping is rare. only 1 in 4096 players see it."
        }
        

		await interaction.reply(`${pingMsg}\nBot API Latency: ${ping}`);
	},
};
