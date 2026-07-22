import { Player, RawMessage, world } from "@minecraft/server";
import { Database } from "../../core/Database.js";

export function GlobalMessage(message: string | RawMessage | (string | RawMessage)[]): void {
	world.getAllPlayers().forEach((player) => {
		if (new Database(player.name).HAS("GlobalChatMute")) return;
		player.sendMessage(message);
	});
}

export function MessageSyntax(player: Player, message: string, disableColor: boolean = false) {
	if (disableColor) message.replaceAll("§", "");
	return message.replace(/\[([^\]]+)\]/g, (_, key) => {
		switch (key.toLowerCase()) {
			case "item":
				return "...";

			case "offhand":
				return "...";

			case "ping": {
				const ping = player.getPing();

				if (ping >= 180) {
					return `§r§c${ping}§4ms`;
				}

				if (ping >= 95) {
					return `§r§e${ping}§6ms`;
				}

				if (ping >= 1) {
					return `§r§a${ping}§2ms`;
				}

				return `§r§b${ping}§3ms`;
			}
			case "location":
				return "...";

			default:
				return `[${key}]`;
		}
	});
}
