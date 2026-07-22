import { world } from "@minecraft/server";
import { Database } from "../../../core/Database";
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    const PlayerDB = new Database(player.name);
    if (initialSpawn) {
        if (PlayerDB.HAS("MemberSince")) {
            world.sendMessage({
                text: `§l§3> §r§7Welcome§8, §b${player.name} §7to §dInsomnia§7 for the first time!§8.§f`
            });
        }
        else {
            player.sendMessage({
                "rawtext": [
                    {
                        "text": "§l§3> §r"
                    },
                    {
                        "translate": "authentication.welcome",
                        "with": [player.name]
                    }
                ]
            });
        }
    }
    else {
    }
});
