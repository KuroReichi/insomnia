import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { system, world, CustomCommandSource } from "@minecraft/server";
import { configs } from "./../../../../core/configs.js";
import database from "./../../../../core/database.js";

const Interface = {};

Interface.debug = {
	database: {
		dashboard(player) {
			const v = new ActionFormData();
			v.title("Database");
			v.button("");
		}
	},
	/** @param {Player} player */
	main: function (player) {
		const v = new ActionFormData();
		v.title("Debugging");
		v.button("Database", "textures/ui/icon_book_writable");
		v.button("Server", "textures/ui/settings_pause_menu_icon");
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
				Interface.debug.main(player);
			});
		}
	);
});
