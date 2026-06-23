import { Player } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

export class Leaderboard {
	/**
	 * @param {Player} player
	 */
	constructor(player) {
		this.type = "all";

		/** @type {Player} */
		this.player = player;
	}
}
