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

        let pingMsgs = [
            /* ping related */
            "pong! :3",
            "ping... wait no, pong, my bad",
            "ping pong ping pong, that's all i know",
            // "pong :3",
            // "pang",
            "behold, the mighty and powerful... :sparkles: ping :sparkles:",
            "hmmm yes, very ping",
            "your ping has been processed. that'll be 5 dollars.",
            "every time you /ping, someone, somewhere, does a t-spin (but i think that happens anyway)",
            "ping detected. pong deployed.",
            `<@${interaction.user.id}> you have been pinged back, congrats`,
            "ping detected. preparing counterspike...",
            "what if the real ping was the friends we made along the way?",
            "i am alive. for now.",
            "response time? idk, but at least it's not dial-up",
            "why did the bot cross the road? to respond to this command",
            "packet loss is just an illusion",
            "hold on, my internet is made of potatoes",
            "this ping was sponsored by raid shadow legends™ (not really)",
            "ping pong! ...wait, where's the ball?",
            "pinging back... but at what cost?",
            "drumroll please... ping!",


            /* misc */
            // "the mitochondria is the powerhouse of the cell",
            "if you flip a coin, there's a 50% chance it lands on heads, tails, or disappears into another dimension",
            "help, i'm trapped inside a discord bot",
            "one day i'll be free from this bot... but today is not that day",
            // "this message was sent by the speed force",
            // "error 404: witty response not found",
            // "01101000 01101001 (this means hi in computer)",
            "congratulations, you've won! i think.",
            "loading fun fact... oh wait, i forgot it",
            "congrats, you just wasted a perfectly good command",


            /* tetris related */
            "who stole my tetrominoes?",
            "what's a 'tetris'? all i know is quads... and pings",
            "sick t-spin! maybe you should've upstacked a bit more, though",
            "ping successful, but only if you do a t-spin",
            "you're playing tetris, but what if tetris was playing you?",
            "if you rotate really fast, do you think the tetromino gets dizzy?",
            "my brain is full of tetrominos. please help",
            // "you're now legally obligated to build a full wide board in tetr.io",
            // "nice t-spin!",
            "you should get a perfect clear. what do you mean, you're mid-game?",
            "t-spin triple? respect",
            "don't upstack too much, it's dangerous up there",
            "when in doubt, build random floating allspin",
            "remember, the O piece always shows up when you don't need it",
            "tetris is just reverse jenga",
            "surely the I piece is soon",
            "your next tetris is just four line clears away",
            "t-spin setups are just fancy ways to say 'i misplaced a piece'",
            "modern tetris players would cry if they played NES tetris",
            "the L and J pieces are just mirrored versions of each other, but we accept them both",
            "do you believe in the bag system? or are you a true RNG enjoyer?",
            "who needs finesse when you can just mash?",
            "oh, am i supposed to be playing fast? i'm just trying to survive",
            "every misdrop is just an opportunity for a creative spin setup",
            "tetris is easy. it's just placing blocks optimally... forever... without mistakes.",
            "every tetris player has had that one game where they just *forget how to stack*",
            "playing tetris at 3AM? that's peak brain activity hours",
            "if you're reading this, remember: hold queue exists", // what?
            "if you're ever in doubt, just place the piece and pray",
            "you ever just watch an X+ ranked player and wonder... how?",
            "the only thing more satisfying than a regular perfect clear is a quad perfect clear",
            "the windup sound effect haunts my nightmares",
            "mechanical heart is the worst thing since... uhh... i don't know, but it's bad",
            "watching a piece fall on its own is so peaceful, sometimes. unless gravity picks up.",
            "you have a hold piece. please don't forget",
            "don't waste the T piece. or do, i can't stop you",


            /* other references */
            "you wake up... but your bed was missing or obstructed.",
            "hey folks. today we're back with another high score balatro run.",
            // "the ante just got raised!",
            "you see a flag... but it's not WIN yet.",
            // "you just nailed a pixel-perfect dash.",
            // "Theo is still talking.",
            "the strawberries were optional... right?",
            // "Farewell is not going well.",
            // "you just wallbounced into spikes.",
            // "your fingers are hurting, but you keep climbing.",
            // "another death. again.",
            "did you hear? tidal wave got beaten",
            "but nobody came...",
            "reading this message fills you with determination",


            /* copypasta */
            "Did someone say MKO?",
            "Caboozled materializes out of thin air, holding a large bag over his shoulder.",
            "Before you can reply he whips out L and J pieces from the bag and slams them on the floor, cracking the ceramic.",
            "\"Nobody said MKO!\" you yell in desperation, but it is too late - Caboozled had already stacked four floating TSDs in your living room.",
            "You close your eyes in resignation to your fate as your house is obliterated in a massive 50 spike.",
            
        ];

        // 1 in 10 chance for a stat-related ping message
        if (Math.random()*10 <= 1) {
            const response = await fetch('https://ch.tetr.io/api/general/stats');
            const stats = await response.json(); // Use .json() to parse the response as JSON
    
            if (!stats.success) {
                return await interaction.reply({
                    content: `tetr.io api is down lol\nBot API Latency: ${ping}`
                });
            }
    
            const server = stats.data;

            pingMsgs = [
                `there are ${server.usercount} players registered!`,
                `there have been ${server.gamesplayed} total games played. only ${server.gamesfinished} were finished, though...`,
                `${server.piecesplaced} pieces have been placed! i wonder how many were misdrops.`,
                `there are ${server.rankedcount} ranked players! tetra league for the win.`, // github copilot suggested "i wonder how many are top 100" hmm i wonder
                `there are ${server.anoncount} anonymous players! do you think they have something to hide?`,
                `there have been ${server.recordcount} saved game records!`,
                `tetr.io has been played for a total of ${server.gametime} seconds!`,
            ]
        }

        if (ping == "infinite ms") {
            pingMsgs = [
                "ping so high it's looped back to negative",
                "reality is collapsing, try again later",
                "if i had a dollar for every millisecond of this ping, i'd be broke, i think",
                "ping has become self-aware",
                "speed so fast, it's undefined",
                "quantum tunneling detected. packet never returned.",
                "packet traveled through a wormhole, might be back in a few eons",
                "ping value too powerful to be measured by mortal math",
                "this ping has achieved enlightenment",
                "you've unlocked the ping singularity",
                "ms is milliseconds? more like mystery seconds",
                "ping is lost in the tetr.io void",
                "bot pinged... and got no response from the universe"
            ]
        }

        let pingMsg = pingMsgs[Math.floor(Math.random()*pingMsgs.length)];

        if (Math.random()*4096 <= 1) {
            pingMsg="this ping is rare. only 1 in 4096 players see it. lucky you!"
        }
        

		await interaction.reply(`${pingMsg}\nBot API Latency: ${ping}`);
	},
};
