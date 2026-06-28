import { world, system } from "@minecraft/server";
import { configs } from "../../../core/configs.js";
import database from "./../../../core/database.js";

/**
 * @typedef {Object} TimezoneLocation
 * @property {number} hour
 * @property {number} minute
 * @property {number} second
 */

/**
 * @typedef {string | number | boolean | import("@minecraft/server").Vector3 | Record<string, unknown> | undefined} DatabaseValue
 */

/**
 * @returns {string}
 */
function getServerTimezone() {
	return String(
		database.get("timezone.location") ?? configs.modules.realtime.timezone
	);
}

/**
 * @returns {TimezoneLocation}
 */
function getTimezoneLoc() {
	const now = new Date();
	const localized = new Date(
		now.toLocaleString("en-US", {
			timeZone: getServerTimezone()
		})
	);

	return {
		hour: localized.getHours(),
		minute: localized.getMinutes(),
		second: localized.getSeconds()
	};
}

/**
 * Converts current IRL time into Minecraft daytime ticks.
 * @returns {number}
 */
function getMinecraftTimeFromIRL() {
	const { hour, minute, second } = getTimezoneLoc();
	const irlHours = hour + minute / 60 + second / 3600;
	let mcHours = irlHours - 6;
	if (mcHours < 0) mcHours += 24;
	return Math.floor(mcHours * 1000);
}

/**
 * Returns how many full days have passed since server start.
 * @returns {number}
 */
function getDayPassed() {
	const startRaw = /** @type {DatabaseValue} */ (
		database.get("server.start_date", "server")
	);
	if (startRaw === undefined || startRaw === null) return 0;

	const tz = getServerTimezone();
	const startDate = new Date(
		new Date(String(startRaw)).toLocaleString("en-US", { timeZone: tz })
	);
	const nowDate = new Date(
		new Date().toLocaleString("en-US", { timeZone: tz })
	);

	startDate.setHours(0, 0, 0, 0);
	nowDate.setHours(0, 0, 0, 0);

	const diff = Number(nowDate) - Number(startDate);
	return Math.max(Math.floor(diff / 86400000), 0);
}

/**
 * Keeps overworld time synchronized with real-world time.
 * @type {number}
 */
export const runtime = system.runInterval(() => {
	if (!configs.modules.realtime.enabled) {
		system.clearRun(runtime);
		world.gameRules.doDayLightCycle = true;
		return;
	}

	if (world.gameRules.doDayLightCycle === true) {
		world.gameRules.doDayLightCycle = false;
	}

	const ticks = getMinecraftTimeFromIRL();
	const days = getDayPassed();
	const finalTime = (ticks + days * 24000) % 2147483647;

	world
		.getDimension("minecraft:overworld")
		.runCommand(`time set ${finalTime}`);
}, 5);
