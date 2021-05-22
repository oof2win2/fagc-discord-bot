const fetch = require("node-fetch")
const { MessageEmbed } = require("discord.js")
const { handleErrors } = require("../../utils/functions")
const Command = require("../../base/Command")

class RevokeAllname extends Command {
	constructor(client) {
		super(client, {
			name: "revokeallname",
			description: "Revokes your offense of a player by offense ID (revoke all violations of a player by playername)",
			aliases: ["revokeoffense"],
			category: "violations",
			usage: "[playername]",
			examples: ["{{p}}revokeallname Windsinger"],
			dirname: __dirname,
			enabled: true,
			memberPermissions: ["BAN_MEMBERS"],
			botPermissions: ["SEND_MESSAGES", "EMBED_LINKS"],
			ownerOnly: false,
			cooldown: 3000,
			requiredConfig: true,
			customPermissions: ["violations"],
		})
	}
	async run(message, args, config) {
		if (!args[0]) return message.reply("Provide a player name to get violations of")
		const playername = args.shift()
		if (!config.apikey) return message.reply("No API key set")
		const offenseRaw = await fetch(`${this.client.config.apiurl}/offenses/getcommunity?playername=${playername}&communityid=${config.communityid}`)
		const offense = await offenseRaw.json()
		if (offense === null)
			return message.reply(`Player \`${playername}\` has no offenses in community ${config.communityname}`)

		let embed = new MessageEmbed()
			.setTitle("FAGC Offense Revocation")
			.setColor("GREEN")
			.setTimestamp()
			.setAuthor("FAGC Community")
			.setDescription(`FAGC Offense of player \`${playername}\` in community ${config.communityname}`)

		offense.violations.forEach(async (violation, i) => {
			if (i == 25) {
				message.channel.send(embed)
				embed.fields = []
			}
			const admin = await this.client.users.fetch(violation.admin_id)
			embed.addField(violation.readableid,
				`By: <@${admin.id}> | ${admin.tag}\nBroken rule: ${violation.broken_rule}\n` +
                `Proof: ${violation.proof}\nDescription: ${violation.description}\n` +
                `Automated: ${violation.automated}\nViolated time: ${(new Date(violation.violated_time)).toUTCString()}`,
				true
			)
		})
		message.channel.send(embed)

		const reactionFilter = (reaction, user) => {
			return user.id == message.author.id
		}
		const confirm = await message.channel.send("Are you sure you want to revoke this player's offense?")
		confirm.react("✅")
		confirm.react("❌")
		let reactions
		try {
			reactions = (await confirm.awaitReactions(reactionFilter, { max: 1, time: 120000, errors: ["time"] }))
		} catch (error) {
			return message.channel.send("Timed out.")
		}

		let reaction = reactions.first()
		if (reaction.emoji.name === "❌")
			return message.channel.send("Offense revocation cancelled")

		try {
			const responseRaw = await fetch(`${this.client.config.apiurl}/violations/revokeallname`, {
				method: "DELETE",
				body: JSON.stringify({
					playername: playername,
					admin_id: message.author.id
				}),
				headers: { "apikey": config.apikey, "content-type": "application/json" }
			})
			const response = await responseRaw.json()
			if (response.readableid && response.violations && response.playername && response.communityid) {
				return message.channel.send("Offense revoked!")
			} else {
				return handleErrors(message, response)
			}
		} catch (error) {
			console.error({ error })
			return message.channel.send("Error removing offense. Please check logs.")
		}
	}
}
module.exports = RevokeAllname