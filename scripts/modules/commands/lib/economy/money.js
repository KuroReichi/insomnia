import { Player } from "@minecraft/server";
import { configs } from "../../../../core/configs.js";
import { registerCommand } from "../../core/registry/index.js";
import database from "../../../../core/database.js";
import { metricNumber } from "../../../utility/metrics.js";

/**
 * @param {Player} player
 * @param {Context} args
 *
 * @typedef {{player:string}} Context
 */
function Money(player, args) {
	if (!args.player) {
		player.sendMessage(
			`§l§2> §r§aYour money§8: §e${configs.modules.economy.currency}${metricNumber(Number(database.get("money", player.name)))}`
		);
	} else {
		player.sendMessage(
			`§l§2> §r§a${args.player} money§8: §e${configs.modules.economy.currency}${metricNumber(Number(database.get("money", args.player)))}`
		);
	}
	player.playSound("random.orb");
}

registerCommand({
	name: "money",
	aliases: ["balance", "bal"],
	description: "Return your current money",
	run: Money,
	children: [
		{
			name: "player",
			type: "argument",
			argType: "playerName",
			run: Money
		}
	]
});
