import { configs } from "../../../core/configs";
import { Player } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";

export const Profile = {
	/**
	 * @param {string} a - Target
	 * @param {Player} b - Watcher
	 */
	async show(a, b) {
		const m = new ActionFormData();
		const d = /** @type {object} */ (databse.player(a));
		if (a === b.name) {
		} else {
		}
	}
};
