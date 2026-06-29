import { registerCommand } from "../../core//registry/index.js";
import { Playtime } from "../../../player/data/playtime.js";

registerCommand({
	name: "playtime",
	description: "Display your playtime",
	run(player) {
		player.sendMessage({
			text: `§l§3> §r§bTime Played§7: §f${new Playtime(player.name)}`
		});
	}
});
