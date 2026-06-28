import { world } from "@minecraft/server";
import { registerCommand } from "../../core/registry/index.js";
import { configs } from "../../../../core/configs.js";
import database from "../../../../core/database.js";
import { metricNumber } from "../../../utility/metrics.js";

const currency = configs.modules.economy.currency;
const bountyMin = Number(configs.modules.bounty.min ?? 0);

/** @param {string} name */
function getMoney(name) {
	return Number(database.get("money", name) ?? 0);
}

/** @param {string} name */
function getBounty(name) {
	return Number(database.get("bounty", name) ?? 0);
}

registerCommand({
	name: "bounty",
	description: "Manage player bounty.",
	children: [
		{
			type: "literal",
			name: "add",
			children: [
				{
					type: "argument",
					name: "player",
					argType: "playerName",
					children: [
						{
							type: "argument",
							name: "amount",
							argType: "number",
							run(player, args) {
								const targetName = args.player;
								const amount = Math.floor(args.amount);

								if (amount <= 0) {
									player.sendMessage(`§l§6> §r§cAmount must be greater than §g${currency}${metricNumber(0)}`);
									player.playSound("note.bass");
									return;
								}

								if (amount < bountyMin) {
									player.sendMessage(`§l§6> §r§cAmount must be greater than §g${currency}${metricNumber(bountyMin)}`);
									player.playSound("note.bass");
									return;
								}

								const money = getMoney(player.name);
								if (amount > money) {
									player.sendMessage({
										text: `§l§6> §r§cYou need §e${currency}${metricNumber(amount - money)} §cmore money to add bounty to this person.`
									});
									player.playSound("note.bass");
									return;
								}

								database.remove("money", player.name, amount);
								database.add("bounty", targetName, amount);

								world.sendMessage(`§l§9> §r§3${player.name} §badded §a${currency}${metricNumber(amount)}§b bounty to §e${targetName} §g${currency}${metricNumber(getBounty(targetName))}`);
							}
						}
					]
				}
			]
		},
		{
			type: "literal",
			name: "check",
			run(player) {
				const bounty = getBounty(player.name);
				player.sendMessage({
					text: `§l§9> §r§bYour bounty is §g${currency}${metricNumber(bounty)}`
				});
				player.playSound("random.orb");
			},
			children: [
				{
					type: "argument",
					name: "player",
					argType: "playerName",
					run(player, args) {
						const targetName = args.player;
						const bounty = getBounty(targetName);
						player.sendMessage({
							text: `§l§9> §r§b${targetName} bounty is §g${currency}${metricNumber(bounty)}`
						});
						player.playSound("random.orb");
					}
				}
			]
		},
		{
			type: "literal",
			name: "top",
			run(player) {
				/** @type {string[]} */
				const registered = /** @type {string[]} */ (database.get("player.registered") ?? []);

				const list = registered
					.map(name => ({
						name,
						bounty: getBounty(name)
					}))
					.sort((a, b) => b.bounty - a.bounty)
					.slice(0, 10);

				player.sendMessage("§2---------- §aTop Bounty §2----------");

				if (!list.length) {
					player.sendMessage("§7No bounty data found.");
					return;
				}

				for (const [index, data] of list.entries()) {
					player.sendMessage(`§a${index + 1}§2. §f${data.name} §8- §e${currency}${metricNumber(data.bounty)}`);
				}
			}
		}
	]
});
