import { ActionFormData } from "@minecraft/server-ui";
import { system, world, CustomCommandSource } from "@minecraft/server";
import database from "../../../../core/database.js";

/**
 * @typedef {import("@minecraft/server").Player} Player
 */

class DebugMenu {
	/**
	 * @param {unknown} value
	 * @returns {string}
	 */
	static stringify(value) {
		if (value === undefined) return "undefined";
		if (value === null) return "null";
		if (typeof value === "string") return value;
		if (typeof value === "number" || typeof value === "boolean")
			return String(value);

		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return String(value);
		}
	}

	/**
	 * @param {unknown} value
	 * @param {number} [max=48]
	 * @returns {string}
	 */
	static preview(value, max = 48) {
		const text = DebugMenu.stringify(value).replace(/\s+/g, " ").trim();
		return text.length > max ? `${text.slice(0, max)}...` : text;
	}

	/**
	 * @param {string} text
	 * @param {number} [size=220]
	 * @returns {string[]}
	 */
	static chunk(text, size = 220) {
		const out = [];
		for (let i = 0; i < text.length; i += size) {
			out.push(text.slice(i, i + size));
		}
		return out.length > 0 ? out : [""];
	}

	/**
	 * @param {Player} player
	 * @param {string} title
	 * @param {unknown} value
	 * @returns {void}
	 */
	static showValue(player, title, value) {
		player.sendMessage(`§6§l${title}§r`);
		for (const line of DebugMenu.chunk(DebugMenu.stringify(value), 300)) {
			player.sendMessage(`§f${line}`);
		}
	}

	/**
	 * @returns {string[]}
	 */
	static getSources() {
		const prefix = `${database.prefix}${database.query}`;
		/** @type {Set<string>} */
		const sources = new Set();

		for (const propertyId of world.getDynamicPropertyIds()) {
			if (!propertyId.startsWith(prefix)) continue;

			const colon = propertyId.lastIndexOf(":");
			if (colon < 0) continue;

			const source = propertyId.slice(prefix.length, colon);
			if (source) sources.add(source);
		}

		return [...sources].sort((a, b) =>
			a.localeCompare(b, undefined, { sensitivity: "base" })
		);
	}

	/**
	 * @param {string} source
	 * @returns {string[]}
	 */
	static getIdsBySource(source) {
		const prefix = `${database.prefix}${database.query}${source}:`;

		return world
			.getDynamicPropertyIds()
			.filter(propertyId => propertyId.startsWith(prefix))
			.map(propertyId =>
				propertyId.slice(propertyId.lastIndexOf(":") + 1)
			)
			.sort((a, b) =>
				a.localeCompare(b, undefined, { sensitivity: "base" })
			);
	}

	/**
	 * @param {string} source
	 * @param {string} id
	 * @returns {unknown}
	 */
	static getValueBySource(source, id) {
		return database.get(id, source);
	}

	/**
	 * @returns {string[]}
	 */
	static getRegisteredPlayers() {
		const list = database.get("player.registered");
		if (!Array.isArray(list)) return [];
		return [...new Set(list.map(v => String(v)).filter(Boolean))].sort(
			(a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })
		);
	}

	/**
	 * @returns {string[]}
	 */
	static getPlayerSources() {
		return DebugMenu.getSources().filter(source => source !== "global");
	}

	/**
	 * @param {Player} player
	 * @returns {Promise<void>}
	 */
	static async openMain(player) {
		const form = new ActionFormData()
			.title("Debugging")
			.body("Select a module to inspect.")
			.button("Database", "textures/ui/icon_book_writable")
			.button("Server", "textures/ui/settings_pause_menu_icon");

		const { canceled, selection } = await form.show(player);
		if (canceled) return;

		if (selection === 0)
			return DebugMenu.openDatabaseDashboard(player, () =>
				DebugMenu.openMain(player)
			);
		if (selection === 1)
			return DebugMenu.openServerDashboard(player, () =>
				DebugMenu.openMain(player)
			);
	}

	/**
	 * @param {Player} player
	 * @param {() => Promise<void> | void} [back]
	 * @returns {Promise<void>}
	 */
	static async openDatabaseDashboard(
		player,
		back = () => DebugMenu.openMain(player)
	) {
		const form = new ActionFormData()
			.title("Database")
			.body("Choose a database utility.")
			.button("Back", "textures/ui/arrow_left")
			.button("All Database", "textures/ui/book_open")
			.button("Player Database", "textures/ui/icon_book_writable");

		const { canceled, selection } = await form.show(player);
		if (canceled) return;

		switch (selection) {
			case 0:
				return back();
			case 1:
				return DebugMenu.openAllDatabaseSources(player, () =>
					DebugMenu.openDatabaseDashboard(player, back)
				);
			case 2:
				return DebugMenu.openPlayerDatabaseDashboard(player, () =>
					DebugMenu.openDatabaseDashboard(player, back)
				);
		}
	}

	/**
	 * @param {Player} player
	 * @param {() => Promise<void> | void} [back]
	 * @returns {Promise<void>}
	 */
	static async openAllDatabaseSources(
		player,
		back = () => DebugMenu.openDatabaseDashboard(player)
	) {
		const sources = DebugMenu.getSources();

		const form = new ActionFormData()
			.title("All Database")
			.body("Select a source.");

		form.button("Back", "textures/ui/arrow_left");

		for (const source of sources) {
			const ids = DebugMenu.getIdsBySource(source);
			const label = `${source}\n§7${ids.length} id(s)`;
			form.button(label, "textures/ui/book_open");
		}

		const { canceled, selection } = await form.show(player);
		if (canceled) return;

		if (selection === 0) return back();

		const source = sources[selection - 1];
		if (!source) return;

		return DebugMenu.openSourceEntries(player, source, () =>
			DebugMenu.openAllDatabaseSources(player, back)
		);
	}

	/**
	 * @param {Player} player
	 * @param {string} source
	 * @param {() => Promise<void> | void} back
	 * @returns {Promise<void>}
	 */
	static async openSourceEntries(player, source, back) {
		const ids = DebugMenu.getIdsBySource(source);

		const form = new ActionFormData()
			.title(
				source === "global" ? "Global Database" : `Database: ${source}`
			)
			.body("Choose an id.");

		form.button("Back", "textures/ui/arrow_left");

		for (const id of ids) {
			const value = DebugMenu.getValueBySource(source, id);
			const label = DebugMenu.hasValue(value)
				? `${id}\n§7${DebugMenu.preview(value)}`
				: `${id}\n§8(empty)`;
			form.button(label, "textures/ui/book_open");
		}

		const { canceled, selection } = await form.show(player);
		if (canceled) return;

		if (selection === 0) return back();

		const id = ids[selection - 1];
		if (!id) return;

		return DebugMenu.openEntryMenu(player, source, id, () =>
			DebugMenu.openSourceEntries(player, source, back)
		);
	}

	/**
	 * @param {unknown} value
	 * @returns {boolean}
	 */
	static hasValue(value) {
		return value !== undefined && value !== null;
	}

	/**
	 * @param {Player} player
	 * @param {string} source
	 * @param {string} id
	 * @param {() => Promise<void> | void} back
	 * @returns {Promise<void>}
	 */
	static async openEntryMenu(player, source, id, back) {
		const value = DebugMenu.getValueBySource(source, id);

		const form = new ActionFormData()
			.title(`${source}:${id}`)
			.body(
				[
					`Source: ${source}`,
					`Id: ${id}`,
					`Type: ${Array.isArray(value) ? "array" : typeof value}`,
					`Preview: ${DebugMenu.preview(value, 120)}`
				].join("\n")
			)
			.button("Back", "textures/ui/arrow_left")
			.button("View", "textures/ui/magnifying_glass")
			.button("Delete", "textures/ui/trash");

		const { canceled, selection } = await form.show(player);
		if (canceled) return;

		switch (selection) {
			case 0:
				return back();
			case 1:
				DebugMenu.showValue(player, `${source}:${id}`, value);
				return DebugMenu.openEntryMenu(player, source, id, back);
			case 2:
				return DebugMenu.confirmDeleteEntry(player, source, id, back);
		}
	}

	/**
	 * @param {Player} player
	 * @param {string} source
	 * @param {string} id
	 * @param {() => Promise<void> | void} back
	 * @returns {Promise<void>}
	 */
	static async confirmDeleteEntry(player, source, id, back) {
		const form = new ActionFormData()
			.title("Confirm Delete")
			.body(`Delete ${source}:${id}?`)
			.button("Cancel", "textures/ui/arrow_left")
			.button("Delete", "textures/ui/trash");

		const { canceled, selection } = await form.show(player);
		if (canceled || selection === 0) return back();

		if (selection === 1) {
			const ok = database.delete(id, source);
			player.sendMessage(
				ok
					? `§aDeleted §f${source}:${id}§a.`
					: `§cFailed to delete §f${source}:${id}§c.`
			);
			return DebugMenu.openSourceEntries(player, source, back);
		}
	}

	/**
	 * @param {Player} player
	 * @param {() => Promise<void> | void} [back]
	 * @returns {Promise<void>}
	 */
	static async openPlayerDatabaseDashboard(
		player,
		back = () => DebugMenu.openDatabaseDashboard(player)
	) {
		const form = new ActionFormData()
			.title("Player Database")
			.body("Choose a player database tool.")
			.button("Back", "textures/ui/arrow_left")
			.button("Register Player List", "textures/ui/multiplayer_player")
			.button("All Database", "textures/ui/book_open")
			.button("Delete Player Name Data", "textures/ui/trash");

		const { canceled, selection } = await form.show(player);
		if (canceled) return;

		switch (selection) {
			case 0:
				return back();
			case 1:
				return DebugMenu.openRegisteredPlayerList(player, () =>
					DebugMenu.openPlayerDatabaseDashboard(player, back)
				);
			case 2:
				return DebugMenu.openPlayerSources(player, () =>
					DebugMenu.openPlayerDatabaseDashboard(player, back)
				);
			case 3:
				return DebugMenu.confirmDeleteRegisteredPlayers(player, () =>
					DebugMenu.openPlayerDatabaseDashboard(player, back)
				);
		}
	}

	/**
	 * @param {Player} player
	 * @param {() => Promise<void> | void} back
	 * @returns {Promise<void>}
	 */
	static async openRegisteredPlayerList(player, back) {
		const list = DebugMenu.getRegisteredPlayers();

		const form = new ActionFormData()
			.title("Register Player List")
			.body("Select a player name.");

		form.button("Back", "textures/ui/arrow_left");

		for (const name of list) {
			form.button(name, "textures/ui/multiplayer_player");
		}

		const { canceled, selection } = await form.show(player);
		if (canceled) return;

		if (selection === 0) return back();

		const target = list[selection - 1];
		if (!target) return;

		return DebugMenu.openPlayerSourceEntries(player, target, () =>
			DebugMenu.openRegisteredPlayerList(player, back)
		);
	}

	/**
	 * @param {Player} player
	 * @param {() => Promise<void> | void} back
	 * @returns {Promise<void>}
	 */
	static async openPlayerSources(player, back) {
		const sources = DebugMenu.getPlayerSources();

		const form = new ActionFormData()
			.title("All Player Database")
			.body("Select a player source.");

		form.button("Back", "textures/ui/arrow_left");

		for (const source of sources) {
			const ids = DebugMenu.getIdsBySource(source);
			form.button(
				`${source}\n§7${ids.length} id(s)`,
				"textures/ui/multiplayer_player"
			);
		}

		const { canceled, selection } = await form.show(player);
		if (canceled) return;

		if (selection === 0) return back();

		const source = sources[selection - 1];
		if (!source) return;

		return DebugMenu.openPlayerSourceEntries(player, source, () =>
			DebugMenu.openPlayerSources(player, back)
		);
	}

	/**
	 * @param {Player} player
	 * @param {string} targetName
	 * @param {() => Promise<void> | void} back
	 * @returns {Promise<void>}
	 */
	static async openPlayerSourceEntries(player, targetName, back) {
		const ids = DebugMenu.getIdsBySource(targetName);

		const form = new ActionFormData()
			.title(`Player: ${targetName}`)
			.body("Choose an id.");

		form.button("Back", "textures/ui/arrow_left");

		for (const id of ids) {
			const value = DebugMenu.getValueBySource(targetName, id);
			const label = DebugMenu.hasValue(value)
				? `${id}\n§7${DebugMenu.preview(value)}`
				: `${id}\n§8(empty)`;
			form.button(label, "textures/ui/book_open");
		}

		const { canceled, selection } = await form.show(player);
		if (canceled) return;

		if (selection === 0) return back();

		const id = ids[selection - 1];
		if (!id) return;

		return DebugMenu.openPlayerEntryMenu(player, targetName, id, () =>
			DebugMenu.openPlayerSourceEntries(player, targetName, back)
		);
	}

	/**
	 * @param {Player} player
	 * @param {string} targetName
	 * @param {string} id
	 * @param {() => Promise<void> | void} back
	 * @returns {Promise<void>}
	 */
	static async openPlayerEntryMenu(player, targetName, id, back) {
		const value = DebugMenu.getValueBySource(targetName, id);

		const form = new ActionFormData()
			.title(`${targetName}:${id}`)
			.body(
				[
					`Player: ${targetName}`,
					`Id: ${id}`,
					`Type: ${Array.isArray(value) ? "array" : typeof value}`,
					`Preview: ${DebugMenu.preview(value, 120)}`
				].join("\n")
			)
			.button("Back", "textures/ui/arrow_left")
			.button("View", "textures/ui/magnifying_glass")
			.button("Delete", "textures/ui/trash");

		const { canceled, selection } = await form.show(player);
		if (canceled) return;

		switch (selection) {
			case 0:
				return back();
			case 1:
				DebugMenu.showValue(player, `${targetName}:${id}`, value);
				return DebugMenu.openPlayerEntryMenu(
					player,
					targetName,
					id,
					back
				);
			case 2:
				return DebugMenu.confirmDeletePlayerEntry(
					player,
					targetName,
					id,
					back
				);
		}
	}

	/**
	 * @param {Player} player
	 * @param {string} targetName
	 * @param {string} id
	 * @param {() => Promise<void> | void} back
	 * @returns {Promise<void>}
	 */
	static async confirmDeletePlayerEntry(player, targetName, id, back) {
		const form = new ActionFormData()
			.title("Confirm Delete")
			.body(`Delete ${targetName}:${id}?`)
			.button("Cancel", "textures/ui/arrow_left")
			.button("Delete", "textures/ui/trash");

		const { canceled, selection } = await form.show(player);
		if (canceled || selection === 0) return back();

		if (selection === 1) {
			const ok = database.delete(id, targetName);
			player.sendMessage(
				ok
					? `§aDeleted §f${targetName}:${id}§a.`
					: `§cFailed to delete §f${targetName}:${id}§c.`
			);
			return DebugMenu.openPlayerSourceEntries(player, targetName, back);
		}
	}

	/**
	 * @param {Player} player
	 * @param {() => Promise<void> | void} back
	 * @returns {Promise<void>}
	 */
	static async confirmDeleteRegisteredPlayers(player, back) {
		const list = DebugMenu.getRegisteredPlayers();

		const form = new ActionFormData()
			.title("Confirm Delete")
			.body("Delete player.registered ?")
			.button("Cancel", "textures/ui/arrow_left")
			.button("Delete", "textures/ui/trash");

		const { canceled, selection } = await form.show(player);
		if (canceled || selection === 0) return back();

		if (selection === 1) {
			const ok = database.delete("player.registered");
			player.sendMessage(
				ok
					? `§aDeleted player.registered (${list.length} names).`
					: "§cFailed to delete player.registered."
			);
			return DebugMenu.openPlayerDatabaseDashboard(player, back);
		}
	}

	/**
	 * @param {Player} player
	 * @param {() => Promise<void> | void} [back]
	 * @returns {Promise<void>}
	 */
	static async openServerDashboard(
		player,
		back = () => DebugMenu.openMain(player)
	) {
		const form = new ActionFormData()
			.title("Server")
			.body("Choose a server tool.")
			.button("Back", "textures/ui/arrow_left")
			.button("Command Logs", "textures/ui/book_open")
			.button("Show Info", "textures/ui/mashup_pack_icon");

		const { canceled, selection } = await form.show(player);
		if (canceled) return;

		switch (selection) {
			case 0:
				return back();
			case 1:
				return DebugMenu.openCommandLogsPlayers(player, () =>
					DebugMenu.openServerDashboard(player, back)
				);
			case 2:
				player.sendMessage(
					"§6Server debug info is not implemented yet."
				);
				return;
		}
	}

	/**
	 * @param {Player} player
	 * @param {() => Promise<void> | void} back
	 * @returns {Promise<void>}
	 */
	static async openCommandLogsPlayers(player, back) {
		const logs = database.get("command-logs");
		const list = Array.isArray(logs) ? logs : [];

		const players = [
			...new Set(
				list
					.map(log => String(log?.sender ?? "Unknown"))
					.filter(Boolean)
			)
		].sort((a, b) =>
			a.localeCompare(b, undefined, { sensitivity: "base" })
		);

		const form = new ActionFormData()
			.title("Command Logs")
			.body("Choose a player.");

		form.button("Back", "textures/ui/arrow_left");

		for (const name of players) {
			const count = list.filter(
				log => String(log?.sender ?? "") === name
			).length;
			form.button(
				`${name}\n§7${count} log(s)`,
				"textures/ui/multiplayer_player"
			);
		}

		const { canceled, selection } = await form.show(player);
		if (canceled) return;

		if (selection === 0) return back();

		const sender = players[selection - 1];
		if (!sender) return;

		return DebugMenu.openCommandLogsForPlayer(player, sender, () =>
			DebugMenu.openCommandLogsPlayers(player, back)
		);
	}

	/**
	 * @param {Player} player
	 * @param {string} sender
	 * @param {() => Promise<void> | void} back
	 * @returns {Promise<void>}
	 */
	static async openCommandLogsForPlayer(player, sender, back) {
		const logs = database.get("command-logs");
		const list = Array.isArray(logs) ? logs : [];
		const filtered = list.filter(
			log => String(log?.sender ?? "") === sender
		);

		const form = new ActionFormData()
			.title(`Logs: ${sender}`)
			.body(`Total logs: ${filtered.length}`);

		form.button("Back", "textures/ui/arrow_left");

		filtered.forEach((log, index) => {
			const status = String(log?.status ?? "Unknown");
			const message = String(log?.message ?? "");
			form.button(
				`#${index + 1} §7[${status}]§r\n${DebugMenu.preview(message, 36)}`,
				"textures/ui/book_open"
			);
		});

		const { canceled, selection } = await form.show(player);
		if (canceled) return;

		if (selection === 0) return back();

		const log = filtered[selection - 1];
		if (!log) return;

		return DebugMenu.openCommandLogDetail(player, sender, log, () =>
			DebugMenu.openCommandLogsForPlayer(player, sender, back)
		);
	}

	/**
	 * @param {Player} player
	 * @param {string} sender
	 * @param {any} log
	 * @param {() => Promise<void> | void} back
	 * @returns {Promise<void>}
	 */
	static async openCommandLogDetail(player, sender, log, back) {
		const form = new ActionFormData()
			.title(`Log: ${sender}`)
			.body(
				[
					`Sender: ${sender}`,
					`Status: ${log?.status ?? "-"}`,
					`Message: ${log?.message ?? "-"}`,
					`Time: ${log?.time ?? log?.date ?? "-"}`
				].join("\n")
			)
			.button("Back", "textures/ui/arrow_left")
			.button("View Raw", "textures/ui/magnifying_glass");

		const { canceled, selection } = await form.show(player);
		if (canceled) return;

		switch (selection) {
			case 0:
				return back();
			case 1:
				DebugMenu.showValue(player, `Log Raw :: ${sender}`, log);
				return DebugMenu.openCommandLogDetail(
					player,
					sender,
					log,
					back
				);
		}
	}
}

system.beforeEvents.startup.subscribe(event => {
	event.customCommandRegistry.registerCommand(
		{
			name: "q:debug",
			description: "Open Debug Menu",
			permissionLevel: 0,
			cheatsRequired: false,
			mandatoryParameters: [],
			optionalParameters: []
		},
		origin => {
			if (origin.sourceType !== CustomCommandSource.Entity) return;

			const player = origin.sourceEntity;
			if (!player || player.typeId !== "minecraft:player") return;

			system.run(() => {
				void DebugMenu.openMain(/** @type {Player} */ (player));
			});
		}
	);
});
