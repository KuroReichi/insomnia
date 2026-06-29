import { Player } from "@minecraft/server";
import { registerCommand } from "../../core//registry/index.js";

/**
 * @name Ping
 * @description Display current ping to executor
 * @param {Player} player
 * @returns {void}
 */
function Ping(player) {
	player.sendMessage({
		text: `§l§3> §r§fYour Ping§8: §b${player.getPing()}`
	});
	player.playSound("random.orb");
}

registerCommand({
	name: "ping",
	description: "Display your ping",
	run: Ping
});
