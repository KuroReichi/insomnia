import { Player } from "@minecraft/server";
import { registerCommand } from "../../core/registry/index.js";

/** @param {Player} player */
function Ping(player) {
	player.sendMessage(`§7Your Ping§8: §b${player.getPing()}`);
}

registerCommand({
	name: "ping",
	description: "Display your ping",
	run: Ping
});
