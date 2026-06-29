import { world } from "@minecraft/server";
import { CommandQueue } from "../commands/core/registry/index.js";
import { configs } from "../../core/configs.js";
import database from "../../core/database.js";

/**
 * @type {Console} console
 * @typedef Console
 * @property {Function} info
 */
if (configs.commandPrefix.startsWith("/")) {
	console.info(`§4[§cERROR§4]§7: §eat §ghandler.js`);
	console.info(
		`    The prefix: ">> ${configs.commandPrefix.substring(configs.commandPrefix.indexOf("/"), 1)} << ${configs.commandPrefix.slice(configs.commandPrefix.indexOf("/") + 1, 3)}${configs.commandPrefix.length >= 3 ? "..." : ""}", cannot starts with a slash (/).`
	);
	configs.commandPrefix = "!";
	console.info(
		`§2[§aINFO§2]§7: §fChanged the prefix to standard character, now the prefix is "!".`
	);
}

world.beforeEvents.chatSend.subscribe(async event => {
	let query = event.message;
	if (query.startsWith(configs.commandPrefix)) {
		event.cancel = true;
		query =
			event.message
				.slice(configs.commandPrefix.length)
				.trim()
				.match(/"[^"]*"|'[^']*'|`[^`]*`|\S+/g) ?? [];
		query = query.map(v => v.replace(/^["'`]|["'`]$/g, ""));

		if (configs.server.founder !== event.sender.name)
			console.info(`${event.sender.name}: ${event.message}`);
		CommandQueue(event.sender, query).then(response => {
			const logs = database.get("command-logs") ?? new Array();

			logs.push({
				sender: event.sender.name,
				status: response.status,
				message: response.message
			});

			if (logs.length > 100) logs.shift();
			database.set("command-logs", logs);
		});
	} else {
		system.run(() => {
			event.cancel = true;
			event.sender.sendMessage({
				rawtext: [
					{
						text: "§c",
						translate: "permissions.chatmute"
					}
				]
			});
		});
	}
});
