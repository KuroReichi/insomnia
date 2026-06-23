import { world, system } from "@minecraft/server";
import { configs } from "./core/configs.js";
import { metricNumber } from "./modules/utility/metrics.js";
import database from "./core/database.js";

import "./modules/events/world/spawn-data.js";
import "./modules/events/world/spawn-protect.js";
import "./modules/events/world/lifesteal.js";
import "./modules/events/world/realtime.js";
import "./modules/messages/chat.js";
import "./modules/player/data/playtime.js";
import "./modules/player/data/statistics.js";
import "./modules/commands/loader.js";

world.afterEvents.worldLoad.subscribe(() => {
	system.runInterval(() => {
		world.getAllPlayers().forEach(player => {
			if (player.isValid) {
				const bounty = /** @type {string} */ metricNumber(Math.floor(Number(database.get("money", player.name) / 70) + Number(database.get("bounty", player.name))));
				player.nameTag = [`§f${player.name} §8- §3${player.getPing}`, `§cBounty §e${configs.modules.economy.currency}${bounty}`].join("\n");
			}
		});
	}, 1);
});
