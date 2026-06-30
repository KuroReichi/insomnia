import { system, world } from "@minecraft/server";
import { configs } from "../../../core/configs.js";
import database from "../../../core/database.js";
import { valuable } from "./configs.js";
import { getDate } from "../../utility/date";

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
 * @property {"break" | "place"} type
 */

const REWARD_DELAY = 20 * 2;
const currency = configs.modules.economy.currency;

const PLACE_MIN_PERCENT = 32.71;
const PLACE_MAX_PERCENT = 44.39;

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
function setMoney(playerName, amount) {
	database.set("money", Math.max(0, Math.floor(amount)), playerName);
}

/**
 * @param {string} playerName
 * @param {number} amount
 */
function addMoney(playerName, amount) {
	if (amount <= 0) return;
	setMoney(playerName, getMoney(playerName) + amount);
}

/**
 * @param {string} playerName
 * @param {number} amount
 */
function takeMoney(playerName, amount) {
	if (amount <= 0) return;
	setMoney(playerName, getMoney(playerName) - amount);
}

/**
 * @param {string} playerName
 * @param {"break" | "place"} type
 * @param {number} amount
 */
function addDailyStat(playerName, type, amount) {
	if (amount <= 0) return;

	const date = getDate();
	const key = `blockStats:${type}`;

	/** @type {Record<string, number>} */
	const stats = database.get(key, playerName) ?? {};
	stats[date] = Number(stats[date] ?? 0) + amount;

	database.set(key, stats, playerName);
}

/**
 * @param {Player} player
 * @param {number} amount
 * @param {"break" | "place"} type
 */
function queueTransaction(player, amount, type) {
	const playerName = player.name;
	let pending = pendingRewards.get(playerName);

	if (!pending) {
		pending = {
			amount: 0,
			timer: 0,
			player,
			type
		};

		pendingRewards.set(playerName, pending);
	}

	pending.amount += amount;
	pending.player = player;
	pending.type = type;

	system.clearRun(pending.timer);

	const sign = pending.type === "break" ? "+" : "-";
	const absPending = Math.abs(pending.amount);

	player.onScreenDisplay.setActionBar(
		`§e${sign}${currency}${amount} §7(§6${sign}${currency}${absPending}§7)`
	);

	pending.timer = system.runTimeout(() => {
		flushPending(playerName);
	}, REWARD_DELAY);
}

/**
 * @param {string} playerName
 */
function flushPending(playerName) {
	const pending = pendingRewards.get(playerName);
	if (!pending) return;

	if (pending.type === "break") {
		addMoney(playerName, pending.amount);
	} else {
		takeMoney(playerName, pending.amount);
	}

	if (pending.player.isValid) {
		const sign = pending.type === "break" ? "+" : "-";
		pending.player.onScreenDisplay.setActionBar(
			`§a${sign}${currency}${pending.amount}`
		);

		if (pending.type === "break") {
			pending.player.runCommand("playsound random.levelup @s ~~~ 1 3");
		} else {
			pending.player.runCommand("playsound random.glass @s ~~~ 1 0.5");
		}
	}

	pendingRewards.delete(playerName);
}

/**
 * @param {number} price
 * @returns {number}
 */
function getRandomPlacePenalty(price) {
	const percent =
		PLACE_MIN_PERCENT +
		Math.random() * (PLACE_MAX_PERCENT - PLACE_MIN_PERCENT);
	return Math.max(1, Math.floor(price * (percent / 100)));
}

world.afterEvents.playerBreakBlock.subscribe(event => {
	const player = event.player;
	if (!player.isValid) return;

	const blockId =
		event.brokenBlockPermutation?.type?.id ?? event.block?.typeId ?? "";

	const item = getValuable(blockId);
	if (!item) return;

	addDailyStat(player.name, "break", 1);
	queueTransaction(player, item.price, "break");
});

world.afterEvents.playerPlaceBlock.subscribe(event => {
	const player = event.player;
	if (!player.isValid) return;

	const blockId =
		event.block?.typeId ?? event.block.permutation.type.id ?? "";

	const item = getValuable(blockId);
	if (!item) return;

	addDailyStat(player.name, "place", 1);

	const penalty = getRandomPlacePenalty(item.price);
	queueTransaction(player, penalty, "place");
});
