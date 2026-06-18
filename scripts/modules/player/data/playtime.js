import { Player, TicksPerSecond, system, world } from "@minecraft/server";
import database from "../../../core/database.js";

const PLAYTIME_ID = "playtime";

/**
 * Represents a player's playtime.
 */
export class Playtime {
	/**
	 * @param {Player} player
	 * @returns {void}
	 */
	static addTick(player) {
		database.add(`${PLAYTIME_ID}.ticks`, player.name, 1);
	}

	/**
	 * @param {Player} player
	 * @returns {void}
	 */
	static reset(player) {
		database.set(`${PLAYTIME_ID}.ticks`, 0, player.name);
	}

	/** @param {Player} player */
	constructor(player) {
		this.player = player;
	}

	/** @returns {number} */
	get ticks() {
		return database.get(`${PLAYTIME_ID}.ticks`, this.player.name) ?? 0;
	}

	/** @returns {number} */
	get totalSeconds() {
		return Math.floor(this.ticks / TicksPerSecond);
	}

	/** @returns {number} */
	get totalMinutes() {
		return Math.floor(this.totalSeconds / 60);
	}

	/** @returns {number} */
	get totalHours() {
		return Math.floor(this.totalMinutes / 60);
	}

	/** @returns {number} */
	get totalDays() {
		return Math.floor(this.totalHours / 24);
	}

	/** @returns {number} */
	get days() {
		return Math.floor(this.totalSeconds / 86400);
	}

	/** @returns {number} */
	get hours() {
		return Math.floor((this.totalSeconds % 86400) / 3600);
	}

	/** @returns {number} */
	get minutes() {
		return Math.floor((this.totalSeconds % 3600) / 60);
	}

	/** @returns {number} */
	get seconds() {
		return this.totalSeconds % 60;
	}

	/**
	 * @returns {{
	 *	ticks: number,
	 *	totalSeconds: number,
	 *	days: number,
	 *	hours: number,
	 *	minutes: number,
	 *	seconds: number
	 * }}
	 */
	toJSON() {
		return {
			ticks: this.ticks,
			totalSeconds: this.totalSeconds,
			days: this.days,
			hours: this.hours,
			minutes: this.minutes,
			seconds: this.seconds
		};
	}

	/**
	 * @param {string} format
	 * @returns {string}
	 */
	format(format) {
		/** @type {Record<string, number>} */
		const values = {
			ticks: this.ticks,
			seconds: this.totalSeconds,

			d: this.days,
			h: this.hours,
			m: this.minutes,
			s: this.seconds
		};

		return format.replace(/%([a-zA-Z]+)%/g, (match, token) => {
			const key = token[0];

			if (!(key in values)) {
				return match;
			}

			const value = String(values[key]);
			return token.length === 1 ? value : value.padStart(token.length, "0");
		});
	}

	/** @returns {string} */
	toString() {
		return `${this.days}d ${this.hours}h ${this.minutes}m ${this.seconds}s`;
	}
}

system.run(() => {
	system.runInterval(() => {
		for (const player of world.getAllPlayers()) {
			Playtime.addTick(player);
		}
	}, 1);
});
