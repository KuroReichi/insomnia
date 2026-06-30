import { configs } from "../../../../core/configs.js";
import { registerCommand } from "../../core/registry/index.js";
import database from "../../../../core/database.js";
import { metricNumber } from "../../../utility/metrics.js";

/**
 * @typedef {{ name: string, money: number }} BaltopEntry
 */

/**
 * @param {number} current
 * @param {number} compare
 * @param {number} percent
 * @returns {boolean}
 */
function isAtLeastPercentAbove(current, compare, percent) {
	return compare > 0 && current >= compare * (1 + percent);
}

/**
 * @param {number} current
 * @param {number} compare
 * @param {number} percent
 * @returns {boolean}
 */
function isWithinPercentBelow(current, compare, percent) {
	return (
		compare > 0 && current <= compare && current >= compare * (1 - percent)
	);
}

/**
 * @param {number} current
 * @param {number} compare
 * @param {number} percent
 * @returns {boolean}
 */
function isWithinPercentAbove(current, compare, percent) {
	return (
		compare > 0 && current >= compare && current <= compare * (1 + percent)
	);
}

/**
 * @returns {string[]}
 */
function getRegisteredPlayers() {
	const registered = database.get("player.registered");
	if (!Array.isArray(registered)) return [];

	return [...new Set(registered.map(name => String(name)).filter(Boolean))];
}

/**
 * @param {number} limit
 * @returns {BaltopEntry[]}
 */
function getBaltopEntries(limit = 5) {
	const players = getRegisteredPlayers();

	return players
		.map(name => ({
			name,
			money: Number(database.get("money", name) ?? 0)
		}))
		.filter(entry => Number.isFinite(entry.money))
		.sort((a, b) => b.money - a.money)
		.slice(0, limit);
}

/**
 * @param {BaltopEntry[]} entries
 * @param {number} index
 * @returns {{ prefix: string, name: string }}
 */
function getLeaderboardStyle(entries, index) {
	const current = entries[index];
	const above = entries[index - 1];
	const below = entries[index + 1];

	if (
		index === 0 &&
		below &&
		isAtLeastPercentAbove(current.money, below.money, 0.3)
	) {
		return {
			prefix: "  §6",
			name: "§e"
		};
	}

	if (
		index <= 2 &&
		below &&
		isWithinPercentAbove(current.money, below.money, 0.05)
	) {
		return {
			prefix: "  §4",
			name: "§c"
		};
	}

	if (
		index >= 1 &&
		index <= 2 &&
		above &&
		isWithinPercentBelow(current.money, above.money, 0.15)
	) {
		return {
			prefix: "  §2",
			name: "§a"
		};
	}

	return {
		prefix: "  §7",
		name: "§f"
	};
}

registerCommand({
	name: "baltop",
	description: "Display top 5 richest player in economy.",
	run(player) {
		const entries = getBaltopEntries(5);

		if (entries.length === 0) {
			player.sendMessage("§cNo baltop data found.");
			return;
		}

		const currency = configs.modules.economy.currency;
		const lines = ["§6§lBaltop§r"];

		for (const [index, entry] of entries.entries()) {
			const rank = index + 1;
			const style = getLeaderboardStyle(entries, index);

			lines.push(
				`${style.prefix}${rank}§7. ${style.name}${entry.name}§r §7- §a${currency}${metricNumber(entry.money)}`
			);
		}

		player.sendMessage(lines.join("\n"));
	}
});
