import { system, world } from "@minecraft/server";
import { configs } from "../../../core/configs.js";
import database from "../../../core/database.js";
import { valuable } from "./configs.js";

/**
 * @typedef {import("@minecraft/server").Player} Player
 */

/**
 * @typedef {Object} ValuableItem
 * @property {BlockTypeIDs} id
 * @property {string} category
 * @property {number} price
 */

/**
 * @typedef {Object} PendingReward
 * @property {number} amount
 * @property {number} timer
 * @property {Player} player
 */

const REWARD_DELAY = 20 * 5;
const currency = configs.modules.economy.currency;

/** @type {Map<string, PendingReward>} */
const pendingRewards = new Map();

/**
 * @param {string} blockId
 * @returns {ValuableItem | undefined}
 */
function getValuable(blockId) {
	return valuable.find(item => item.id === blockId);
}

/**
 * @param {string} playerName
 * @returns {number}
 */
function getMoney(playerName) {
	return Number(database.get("money", playerName) ?? 0);
}

/**
 * @param {string} playerName
 * @param {number} amount
 */
function addMoney(playerName, amount) {
	if (amount <= 0) return;

	database.set("money", getMoney(playerName) + amount, playerName);
}

/**
 * @param {string} playerName
 */
function flushPending(playerName) {
	const pending = pendingRewards.get(playerName);
	if (!pending) return;

	addMoney(playerName, pending.amount);

	if (pending.player.isValid) {
		pending.player.onScreenDisplay.setActionBar(
			`§a+${currency}${pending.amount}`
		);

		pending.player.runCommand("playsound random.levelup @s ~~~ 1 3");
	}

	pendingRewards.delete(playerName);
}

/**
 * @param {Player} player
 * @param {number} reward
 */
function queueReward(player, reward) {
	const playerName = player.name;

	let pending = pendingRewards.get(playerName);

	if (!pending) {
		pending = {
			amount: 0,
			timer: 0,
			player
		};

		pendingRewards.set(playerName, pending);
	}

	pending.amount += reward;
	pending.player = player;

	system.clearRun(pending.timer);

	player.onScreenDisplay.setActionBar(
		`§a+${currency}${reward} §7(§e${currency}${pending.amount}§7)`
	);

	pending.timer = system.runTimeout(() => {
		flushPending(playerName);
	}, REWARD_DELAY);
}

world.afterEvents.playerBreakBlock.subscribe(event => {
	const player = event.player;
	if (!player.isValid) return;

	const blockId =
		event.brokenBlockPermutation?.type?.id ?? event.block?.typeId ?? "";

	const item = getValuable(blockId);
	if (!item) return;

	queueReward(player, item.price);
});
