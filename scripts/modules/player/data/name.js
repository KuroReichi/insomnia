import { world, system } from "@minecraft/server";
import { metricNumber } from "../../utility/metrics";
import { configs } from "../../../core/configs";
import database from "../../../core/database";

/**
 * @param {import("@minecraft/server").Player} player
 * @returns {number}
 */
function getPlayerPing(player) {
	if (typeof player.getPing === "function") {
		return Number(player.getPing()) || 0;
	}

	return Number(/** @type {any} */ (player).getPing ?? 0) || 0;
}

/**
 * @param {number} ping
 * @returns {string}
 */
function getPingColor(ping) {
	if (ping < 70) return "§a";
	if (ping < 140) return "§6";
	if (ping < 250) return "§c";
	return "§4";
}

/**
 * @param {import("@minecraft/server").Player} player
 * @returns {string}
 */
function getFamiliaNametagPrefix(player) {
	/** @type {any} */
	const state = database.get("familia", player.name);

	if (!state?.haveFamilia || !state.data?.uid) {
		return "";
	}

	/** @type {any} */
	const family = database.get(state.data.uid, "familia");
	const abbreviation = String(family?.name?.abbreviation ?? "").trim();
	const fullName = String(family?.name?.fullName ?? "").trim();

	if (!abbreviation && !fullName) {
		return "";
	}

	const parts = [];

	if (fullName) {
		parts.push(`§b${fullName}`);
	}

	if (abbreviation) {
		if (abbreviation) parts.push("\n");
		parts.push(`§3§l${abbreviation}§r`);
	}

	return parts.length > 0 ? `${parts.join(" ")} ` : "";
}

/**
 * @param {import("@minecraft/server").Player} player
 * @returns {void}
 */
function updateNametag(player) {
	try {
		const ping = getPlayerPing(player);
		const pingColor = getPingColor(ping);

		const familiaPrefix = getFamiliaNametagPrefix(player);
		const bountyValue = Number(
			/** @type {any} */ (database.get("bounty", player.name)) ?? 0
		);
		const moneyValue = Number(
			/** @type {any} */ (database.get("money", player.name)) ?? 0
		);
		const bounty = metricNumber(Math.floor(moneyValue / 70) + bountyValue);

		player.nameTag = [
			`${familiaPrefix} §7- ${pingColor}${player.name}`,
			`§cBounty §e${configs.modules.economy.currency}${bounty}§r`
		].join("\n");
	} catch (e) {}
}

world.beforeEvents.playerInteractWithEntity.subscribe(event => {
	if (event.itemStack) {
		if (
			event.itemStack?.typeId === "minecraft:name_tag" &&
			event.target.typeId === "minecraft:player"
		) {
			event.cancel = true;
		}
	}
});

world.afterEvents.worldLoad.subscribe(() => {
	system.runInterval(() => {
		for (const player of world.getAllPlayers()) {
			updateNametag(player);
		}
	}, 20);
});
