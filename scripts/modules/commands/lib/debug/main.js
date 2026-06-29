import { ActionFormData } from "@minecraft/server-ui";
import { system, CustomCommandSource } from "@minecraft/server";

/**
 * @typedef {import("@minecraft/server").Player} Player
 */

const Interface = {
	/**
	 * Open the main debug menu.
	 * @param {Player} player
	 * @returns {Promise<void>}
	 */
	async openMain(player) {
		const form = new ActionFormData();

		form.title("Debugging");
		form.body("Select a module to inspect.");
		form.button("Database", "textures/ui/icon_book_writable");
		form.button("Server", "textures/ui/settings_pause_menu_icon");

		const response = await form.show(player);
		if (response.canceled) return;

		switch (response.selection) {
			case 0:
				return Interface.database.openDashboard(player);
			case 1:
				return Interface.server.openDashboard(player);
			default:
				return;
		}
	},

	/**
	 * Database related debug tools.
	 */
	database: {
		/**
		 * Open the database dashboard.
		 * @param {Player} player
		 * @returns {Promise<void>}
		 */
		async openDashboard(player) {
			const form = new ActionFormData();

			form.title("Database");
			form.body("Choose a database utility.");
			form.button("Back", "textures/ui/arrow_left");
			form.button("View Logs", "textures/ui/book_open");
			form.button(
				"Inspect Player Data",
				"textures/ui/icon_book_writable"
			);

			const response = await form.show(player);
			if (response.canceled) return;

			switch (response.selection) {
				case 0:
					return Interface.openMain(player);
				case 1:
					player.sendMessage(
						"§eDatabase logs menu is not implemented yet."
					);
					return;
				case 2:
					player.sendMessage(
						"§ePlayer data inspector is not implemented yet."
					);
					return;
				default:
					return;
			}
		}
	},

	/**
	 * Server related debug tools.
	 */
	server: {
		/**
		 * Open the server dashboard.
		 * @param {Player} player
		 * @returns {Promise<void>}
		 */
		async openDashboard(player) {
			const form = new ActionFormData();

			form.title("Server");
			form.body("Choose a server tool.");
			form.button("Back", "textures/ui/arrow_left");
			form.button("Reload Menus", "textures/ui/icon_refresh");
			form.button("Show Info", "textures/ui/mashup_pack_icon");

			const response = await form.show(player);
			if (response.canceled) return;

			switch (response.selection) {
				case 0:
					return Interface.openMain(player);
				case 1:
					player.sendMessage("§aMenus reloaded.");
					return;
				case 2:
					player.sendMessage(
						"§6Server debug info is not implemented yet."
					);
					return;
				default:
					return;
			}
		}
	}
};

system.beforeEvents.startup.subscribe(event => {
	const registry = event.customCommandRegistry;

	registry.registerCommand(
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
				void Interface.openMain(/** @type {Player} */ (player));
			});
		}
	);
});
