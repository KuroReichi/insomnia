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

const DAY_MS = 86400000;
const MC_DAY_TICKS = 24000;
const MC_DAY_START_HOUR = 6;

/**
 * @returns {string}
 */
function getServerTimezone() {
	return String(
		database.get("timezone.location") ??
			configs.modules.realtime.timezone ??
			"UTC"
	);
}

/**
 * Convert timezone string to offset minutes without Intl.
 * Supports:
 * - Asia/Jakarta
 * - Asia/Singapore
 * - Asia/Makassar
 * - Asia/Jayapura
 * - UTC / Etc/UTC
 * - GMT+7, UTC+7, +07:00, -03:30
 * - raw minute numbers
 *
 * @param {string | number} tz
 * @returns {number}
 */
function getTimezoneOffsetMinutes(tz) {
	if (typeof tz === "number" && Number.isFinite(tz)) {
		return tz;
	}

	const value = String(tz).trim();

	/** @type {Record<string, number>} */
	const namedOffsets = {
		UTC: 0,
		"Etc/UTC": 0,
		GMT: 0,
		WIB: 7 * 60,
		WITA: 8 * 60,
		WIT: 9 * 60,
		"Asia/Jakarta": 7 * 60,
		"Asia/Singapore": 8 * 60,
		"Asia/Makassar": 8 * 60,
		"Asia/Jayapura": 9 * 60
	};

	if (value in namedOffsets) {
		return namedOffsets[value];
	}

	const match = value.match(
		/^(?:UTC|GMT)?\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/i
	);

	if (match) {
		const sign = match[1] === "-" ? -1 : 1;
		const hours = Number(match[2]);
		const minutes = Number(match[3] ?? 0);

		if (Number.isFinite(hours) && Number.isFinite(minutes)) {
			return sign * (hours * 60 + minutes);
		}
	}

	const numeric = Number(value);
	if (Number.isFinite(numeric)) {
		return numeric;
	}

	return 0;
}

/**
 * @returns {{ offsetMinutes: number, nowMs: number, adjustedMs: number }}
 */
function getTimezoneClockMs() {
	const offsetMinutes = getTimezoneOffsetMinutes(getServerTimezone());
	const nowMs = Date.now();
	const adjustedMs = nowMs + offsetMinutes * 60000;

	return { offsetMinutes, nowMs, adjustedMs };
}

/**
 * @returns {TimezoneLocation}
 */
function getTimezoneLoc() {
	const { adjustedMs } = getTimezoneClockMs();
	const d = new Date(adjustedMs);

	return {
		hour: d.getUTCHours(),
		minute: d.getUTCMinutes(),
		second: d.getUTCSeconds()
	};
}

/**
 * Converts current IRL time into Minecraft daytime ticks.
 * 06:00 -> 0 ticks
 * 12:00 -> 6000 ticks
 * 18:00 -> 12000 ticks
 * 00:00 -> 18000 ticks
 *
 * @returns {number}
 */
function getMinecraftTimeFromIRL() {
	const { hour, minute, second } = getTimezoneLoc();
	const totalSeconds = hour * 3600 + minute * 60 + second;
	const shiftedSeconds =
		(totalSeconds - MC_DAY_START_HOUR * 3600 + DAY_MS / 1000) %
		(DAY_MS / 1000);
	return Math.floor((shiftedSeconds / (DAY_MS / 1000)) * MC_DAY_TICKS);
}

/**
 * @param {DatabaseValue} raw
 * @returns {number}
 */
function toTimestamp(raw) {
	if (typeof raw === "number" && Number.isFinite(raw)) return raw;
	if (raw === undefined || raw === null) return NaN;

	const parsed = Date.parse(String(raw));
	return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * @returns {number}
 */
function getDayPassed() {
	const startRaw = /** @type {DatabaseValue} */ (
		database.get("server.start_date", "server")
	);

	const startMs = toTimestamp(startRaw);
	if (!Number.isFinite(startMs)) return 0;

	const tzOffsetMs = getTimezoneOffsetMinutes(getServerTimezone()) * 60000;

	const nowDayIndex = Math.floor((Date.now() + tzOffsetMs) / DAY_MS);
	const startDayIndex = Math.floor((startMs + tzOffsetMs) / DAY_MS);

	return Math.max(nowDayIndex - startDayIndex, 0);
}

/**
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
	const finalTime = (ticks + days * MC_DAY_TICKS) % 2147483647;

	world
		.getDimension("minecraft:overworld")
		.runCommand(`time set ${finalTime}`);
}, 5);
