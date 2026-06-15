import { Player } from "@minecraft/server";
import { registerCommand, getCommands } from "../../core/registry.js";

/** @param {Player} player */
function Ping(player) {
	player.sendMessage(`§7Your Ping§8: §b${player.getPing()}`);
}

registerCommand({
	name: "ping",
	description: "Returns your ping",
	run: Ping
});
