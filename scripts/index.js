import { world, system } from "@minecraft/server";
import { configs } from "./core/configs.js";
import { metricNumber } from "./modules/utility/metrics.js";
import database from "./core/database.js";

import "./modules/events/worlds/spawn-data.js";
import "./modules/events/worlds/region-protect.js";
import "./modules/events/worlds/lifesteal.js";
import "./modules/events/worlds/realtime.js";
import "./modules/messages/chat.js";
import "./modules/player/data/playtime.js";
import "./modules/player/data/statistics.js";
import "./modules/commands/loader.js";

world.afterEvents.worldLoad.subscribe(() => {
	system.runInterval(() => {
		world.getAllPlayers().forEach(player => {
			if (player.isValid) {
				/** @type {string} */
				const bounty = /** @type {string} */ metricNumber(
					Math.floor(
						Number(
							/** @type {number} */
							database.get("money", player.name)
						) / 70
					) +
						Number(
							/** @type {number} */
							database.get("bounty", player.name)
						)
				);
				player.nameTag = [
					`${database.get("familia", player.name) ? "" : ""}§f${player.name} §8- §3${player.getPing}`,
					`§cBounty §e${configs.modules.economy.currency}${bounty}`
				].join("\n");
			}
		});
	}, 1);
});
