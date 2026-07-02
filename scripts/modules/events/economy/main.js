import { system, world } from "@minecraft/server";
import { configs } from "../../../core/configs.js";
import database from "../../../core/database.js";
import { valuable } from "./configs.js";
import { getDate } from "../../utility/date";
import { metricNumber } from "../../utility/metrics";

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
 * @typedef {"break" | "place"} TransactionType
 */

/**
 * @typedef {Object} PendingTransaction
 * @property {number} amount
 * @property {number} timer
 * @property {Player} player
 * @property {TransactionType} type
 */

const REWARD_DELAY = 20 * 1;
const currency = configs.modules.economy.currency;

const PLACE_MIN_PERCENT = 132.71;
const PLACE_MAX_PERCENT = 144.39;

/** @type {Map<string, PendingTransaction>} */
const pendingTransactions = new Map();

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
 * @param {string} playerName
 * @param {TransactionType} type
 * @returns {string}
 */
function getTransactionKey(playerName, type) {
	return `${playerName}:${type}`;
}

/**
 * @param {Player} player
 * @param {number} amount
 * @param {TransactionType} type
 */
function queueTransaction(player, amount, type) {
	const playerName = player.name;
	const key = getTransactionKey(playerName, type);

	let pending = pendingTransactions.get(key);

	if (!pending) {
		pending = {
			amount: 0,
			timer: 0,
			player,
			type
		};
		pendingTransactions.set(key, pending);
	}

	pending.amount += amount;
	pending.player = player;
	pending.type = type;

	system.clearRun(pending.timer);

	const sign = type === "break" ? "+" : "-";
	const absPending = Math.abs(pending.amount);

	player.onScreenDisplay.setActionBar(
		`§8${sign}§7${currency}${metricNumber(amount)} ${type === "break" ? "§2" : "§4"}(${type === "break" ? "§a" : "§c"}${currency}${metricNumber(absPending)}${type === "break" ? "§2" : "§4"})`
	);

	pending.timer = system.runTimeout(() => {
		flushPending(key);
	}, REWARD_DELAY);
}

/**
 * @param {string} key
 */
function flushPending(key) {
	const pending = pendingTransactions.get(key);
	if (!pending) return;

	if (pending.type === "break") {
		addMoney(pending.player.name, pending.amount);
	} else {
		takeMoney(pending.player.name, pending.amount);
	}

	if (pending.player.isValid) {
		const sign = pending.type === "break" ? "§2+§a" : "§4-§c";
		pending.player.onScreenDisplay.setActionBar(
			`${sign}${currency}${metricNumber(pending.amount)}`
		);

		if (pending.type === "break") {
			pending.player.runCommand("playsound random.levelup @s ~~~ 1 3");
		} else {
			pending.player.runCommand("playsound random.glass @s ~~~ 1 0.5");
		}
	}

	pendingTransactions.delete(key);
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
		event.block?.typeId ?? event.block?.permutation?.type?.id ?? "";

	const item = getValuable(blockId);
	if (!item) return;

	addDailyStat(player.name, "place", 1);

	const penalty = getRandomPlacePenalty(item.price);
	queueTransaction(player, penalty, "place");
});
