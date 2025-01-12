const Command = require("../../base/Command")

class SetName extends Command {
	constructor(client) {
		super(client, {
			name: "setname",
			description: "Set your community's name",
			aliases: [],
			usage: [ "{{p}}setname [name]" ],
			examples: [ "{{p}}setname AwF" ],
			category: "config",
			dirname: __dirname,
			enabled: true,
			memberPermissions: [ "ADMINISTRATOR" ],
			botPermissions: [ "SEND_MESSAGES", "EMBED_LINKS" ],
			ownerOnly: false,
			cooldown: 3000,
			requiredConfig: true,
			customPermissions: [ "setConfig" ],
		})
	}
	async run(message, args, config) {
		if (!config.apikey)
			return message.channel.send(
				`${this.client.emotes.warn} You must have an API key set for this command`
			)
		if (!args[0] || !args.join(" "))
			return message.channel.send(`${this.client.emotes.warn} No name provided`)

		await this.client.fagc.communities.setCommunityConfig({
			config: {
				name: args.join(" "),
			},
			reqConfig: { apikey: config.apikey }
		})
		return message.channel.send(
			"Name saved successfully. Changes may take a few minutes to take effect"
		)
	}
}
module.exports = SetName
