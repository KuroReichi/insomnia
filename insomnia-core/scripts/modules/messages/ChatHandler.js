import { world, system } from "@minecraft/server";
import { configs } from "../../core/Configuration.js";
import { MessageSyntax, GlobalMessage } from "./ChatMessage.js";
import { Database } from "../../core/Database.js";
if (configs["command.prefix"].startsWith("/")) {
    console.error("At Configuration:['command.prefix'] cannot start with \"/\"");
}
else {
    function CommandQueue(player, query) {
        return new Promise((resolve) => {
            system.run(() => {
                player;
                query;
                resolve(true);
            });
        });
    }
    world.beforeEvents.chatSend.subscribe((e) => {
        e.cancel = true;
        const player = e.sender;
        const PlayerDB = new Database(player.name);
        if (e.message.startsWith(configs["command.prefix"])) {
            let command = e.message
                .slice(configs["command.prefix"].length)
                .trim()
                .match(/"[^"]*"|'[^']*'|`[^`]*`|\S+/g) ?? [];
            let query = command.map((v) => v.replace(/^["'`]|["'`]$/g, ""));
            CommandQueue(player, query);
        }
        else {
            if (PlayerDB.HAS("ChatMode")) {
                let ChatMode = PlayerDB.get("ChatMode");
            }
            else {
                player.sendMessage({
                    text: `§g[§eGlobal§g] §7${player.name}§f: ${MessageSyntax(player, e.message)}`
                });
                for (let accept of world.getPlayers({
                    excludeNames: [player.name]
                })) {
                    GlobalMessage({
                        text: `§2[§aGlobal§2] §7${player.name}§f: ${MessageSyntax(player, e.message)}`
                    });
                }
                console.info(`[CHAT] ${player.name}: ${e.message}`);
            }
        }
    });
}
