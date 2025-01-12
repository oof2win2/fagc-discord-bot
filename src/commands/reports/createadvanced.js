const { MessageEmbed } = require("discord.js")
const {
	getMessageResponse,
	getConfirmationMessage,
} = require("../../utils/responseGetter")
const { handleErrors, createPagedEmbed } = require("../../utils/functions")
const Command = require("../../base/Command")
const validator = require("validator").default
const { NoAuthError } = require("fagc-api-wrapper")

class CreateReportAdvanced extends Command {
	constructor(client) {
		super(client, {
			name: "createadvanced",
			description:
				"Creates a report - Advanced method. Allows specification of who created the report and when it was created",
			aliases: [ "banadvanced", "createadv", "banadv" ],
			usage: "(playername) (description)",
			examples: [ "{{p}}createadvanced", "{{p}}createadvanced Windsinger", "{{p}}createadvanced Windsinger big bad griefer" ],
			category: "reports",
			dirname: __dirname,
			enabled: true,
			memberPermissions: [ "BAN_MEMBERS" ],
			botPermissions: [ "SEND_MESSAGES", "EMBED_LINKS" ],
			ownerOnly: false,
			cooldown: 3000,
			requiredConfig: true,
			customPermissions: [ "reports" ],
		})
	}

	async run(message, args, config) {
		if (!config.apikey) return message.reply(`${this.client.emotes.warn} No API key set`)

		const playername = args.shift() || (
			await getMessageResponse(
				message,
				`${this.client.emotes.type} Type in a playername for the report`
			)
		)?.content?.split(" ")[0]
		if (playername === undefined)
			return message.channel.send(`${this.client.emotes.warn} Didn't send playername in time`)

		const adminMessage = await getMessageResponse(
			message,
			`${this.client.emotes.type} Type in admin user ID, or ping an admin for the report`
		)
		if (adminMessage === undefined)
			return message.channel.send(`${this.client.emotes.warn} Didn't send admin user ID in time`)
		const adminUser =
			adminMessage.mentions.users.first() ||
			(await this.client.users.fetch(adminMessage.content.split(" ")[0]).catch(() => null))
		if (!adminUser) return message.channel.send(`${this.client.emotes.warn} Sent user is not valid!`)

		let ruleEmbed = new MessageEmbed()
			.setTitle("FAGC Rules")
			.setColor("GREEN")
			.setTimestamp()
			.setAuthor("FAGC Community")
			.setDescription(
				"Filtered FAGC Rules. [Explanation](https://gist.github.com/oof2win2/370050d3aa1f37947a374287a5e011c4#file-trusted-md)"
			)

		const filteredRules = await this.client.getFilteredRules(config)
		const fields = filteredRules.map((rule) => {
			return {
				name: `${config.ruleFilters.indexOf(rule.id)+1}) ${rule.shortdesc} (\`${rule.id}\`)`,
				value: rule.longdesc,
			}
		})
		createPagedEmbed(fields, ruleEmbed, message, { maxPageCount: 10 })

		const ruleids = (
			await getMessageResponse(
				message,
				`${this.client.emotes.type} Type in IDs of rules (or indexes in filtered rules) that has been broken, separated by spaces`
			)
		)?.content
		if (ruleids === undefined)
			return message.channel.send(`${this.client.emotes.warn} Didn't send rule IDs in time`)
		let ruleInput = ruleids.split(" ").map(x => x.toLowerCase())
		const ruleNumbers = ruleInput
			.map((rule, i) => {
				const ruleNumber = parseInt(rule) || undefined
				// remove the number from input if it is a numher
				if (ruleNumber)
					ruleInput = ruleInput.filter((_, inputI) => inputI != i)
				return ruleNumber
			})
			.filter((r) => r)

		// validate that all rule indexes do exist
		const invalid = ruleNumbers
			.map((number) => filteredRules.length < number && number)
			.filter((i) => i)
		if (invalid.length)
			return message.channel.send(
				`${this.client.emotes.warn} Invalid indexes were provided: ${invalid.join(", ")}`
			)

		const numberRules = ruleNumbers.map(
			(ruleNumber) => filteredRules[ruleNumber - 1]
		)
		let rules = await Promise.all(
			ruleInput.map((ruleid) => this.client.fagc.rules.fetchRule({ ruleid: ruleid }))
		)
		rules = rules.filter((r) => r).concat(numberRules)

		if (!rules.length)
			return message.channel.send(`${this.client.emotes.warn} No valid rules were provided`)

		if (rules.length !== ruleids.split(" ").length) {
			const invalidRules = ruleids
				.split(" ")
				.filter((r) => {
					if (parseInt(r)) return false
					return true
				})
				.filter((r) => !rules.find((rule) => rule.id == r) && r)
				.filter((r) => r)
			return message.channel.send(
				`${this.client.emotes.warn} Some rules had invalid IDs: \`${invalidRules.join("`, `")}\``
			)
		}

		for (const rule of rules) {
			if (config.ruleFilters.indexOf(rule.id) === -1)
				return message.channel.send(
					`${this.client.emotes.warn} Rule ${rule.id} is not filtered by your community but you tried to report with it`
				)
		}

		let desc = args.join(" ") || (
			await getMessageResponse(
				message,
				`${this.client.emotes.type} Type in description of the report or \`none\` if you don't want to set one`
			)
		)?.content
		if (!desc || desc.toLowerCase() === "none") desc = undefined

		let proof = (
			await getMessageResponse(
				message,
				`${this.client.emotes.type} Send links to proof of the report, separated with spaces, or \`none\` if there is no proof`
			)
		)?.content
		if (!proof || proof.toLowerCase() === "none") proof = undefined
		else {
			for (const string of proof.split(" ")) {
				if (!validator.isURL(string, { protocols: [ "http", "https" ] })) {
					return message.channel.send(`${this.client.emotes.warn}  \`${string}\` is an invalid link to proof`)
				}
			}
		}

		const timestampMsg = (
			await getMessageResponse(
				message,
				`${this.client.emotes.type} Send a ISO8601 timetsamp representing the date of the report, find one here: <https://www.timestamp-converter.com/>. Type in \`now\` to set the current time`,
				120*1000 // 120 seconds to make time
			)
		)?.content?.split(" ")[0]
		let timestamp = new Date()
		if (!timestampMsg) {
			message.channel.send(
				`${this.client.emotes.warn} No date was provided so the current date will be used instead`
			)
			timestamp = new Date()
		}
		else if (timestampMsg?.toLowerCase() === "now") timestamp = new Date()
		else {
			timestamp = new Date(timestampMsg)
			if (isNaN(timestamp.valueOf())) {
				timestamp = new Date()
				message.channel.send(
					`${this.client.emotes.warn} \`${timestampMsg}\` could not be recognized as a date so the current date will be used instead`
				)
			}
		}

		let embed = new MessageEmbed()
			.setTitle("FAGC Reports")
			.setColor("RED")
			.setTimestamp()
			.setAuthor("FAGC Community")
			.setDescription(`Create FAGC report for \`${playername}\``)
		embed.addFields(
			{
				name: "Admin user",
				value: `<@${adminUser.id}> | ${adminUser.tag}`,
				inline: true,
			},
			{ name: "Player name", value: playername, inline: true },
			{
				name: "Rules",
				value: rules
					.map((rule) => `${rule.shortdesc} (\`${rule.id}\`)`)
					.join(", "),
				inline: true,
			},
			{
				name: "Report description",
				value: desc || "No description",
				inline: true,
			},
			{ name: "Proof", value: proof || "No proof" },
			{
				name: "Violated At",
				value: `<t:${Math.round(timestamp / 1000)}>`,
			}
		)
		message.channel.send(embed)
		const confirm = await getConfirmationMessage(
			message,
			"Do you wish to create these rule reports?"
		)
		if (!confirm) return message.channel.send("Report creation cancelled")

		try {
			const reports = await Promise.all(
				rules.map((rule) =>
					this.client.fagc.reports.create({
						report: {
							playername: playername,
							adminId: adminUser.id,
							brokenRule: rule.id,
							proof: proof,
							description: desc,
							automated: false,
							reportedTime: timestamp,
						},
						reqConfig: { apikey: config.apikey }
					})
				)
			)
			if (
				reports.length &&
				reports[0].brokenRule &&
				reports[0].reportedTime
			) {
				return message.channel.send(
					`Report(s) created! ids: \`${reports
						.map((report) => report.id)
						.join("`, `")}\``
				)
			} else {
				return handleErrors(message, reports)
			}
		} catch (error) {
			if (error instanceof NoAuthError)
				return message.channel.send("Your API key is set incorrectly")
			message.channel.send(`${this.client.emotes.error} Error creating reports. Please check logs.`)
			throw error
		}
	}
}
module.exports = CreateReportAdvanced
