import { system } from "@minecraft/server";
import { registerCommand } from "../../core/registry/index.js";

registerCommand({
	name: "rtp",
	aliases: ["randomtp"],
	async run(player) {
		system.run(() => {
			player.sendMessage("§cRTP is not available right now.");
			player.playSound("note.bass");
		});
	}
});
