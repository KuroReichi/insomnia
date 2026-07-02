import { world } from "@minecraft/server";
import { configs } from "../../../core/configs.js";
import database from "../../../core/database.js";
/**
 * @typedef {{killerName:string,date:number}} DeathEntry
 * @typedef {{isDeathRecently:boolean,data:DeathEntry,lastDeaths:DeathEntry[]}} DeathTrack
 */

world.afterEvents.playerSpawn.subscribe(event => {
	const player = event.player;
	world.gameRules.showDeathMessages = false;
	if (event.initialSpawn) {
		if (!database.get("date.first-join", player.name)) {
			const list = /** @type {string[]} */ (
				database.get("player.registered") ?? []
			);
			if (!list.includes(player.name)) {
				list.push(player.name);
				database.set("player.registered", list);
			}
			world.sendMessage({
				text: `§l§2> §r§aWelcome §7${player.name} §ato §6${configs.server.name}§e!§r`
			});
			database.set({
				list: [
					{
						name: "date.first-join",
						value: new Date().valueOf()
					},
					{
						name: "date.session",
						value: new Date().valueOf()
					},
					{
						name: "death.tracks",
						value: {
							isDeathRecently: false,
							data: {
								killerName: undefined,
								date: undefined
							},
							lastDeaths: []
						}
					},
					{
						name: "money",
						value: configs.modules.economy.default
					},
					{
						name: "bounty",
						value: 0
					}
				],
				key: player.name,
				options: {
					overwrite: {
						enabled: true,
						type: "whitelist",
						namespace: ["date.session"]
					},
					createIfMissing: true
				}
			});
		} else {
			player.sendMessage({
				text: `§l§3> §r§bWelcome back to §7${configs.server.name}`
			});
		}
	} else {
		/** @type {DeathTrack} */
		const track = /** @type {DeathTrack} */ (
			database.get("death.tracks", player.name)
		);
		if (track?.isDeathRecently) {
			player.runCommand(
				`event entity ${player.name} miaw:hp_${Math.floor(Number(player.getComponent("minecraft:health")?.defaultValue) - 2)}`
			);

			track.isDeathRecently = false;
			track.data = {
				killerName: "",
				date: 0
			};

			database.set("death.tracks", track, player.name);
		}
	}
});
