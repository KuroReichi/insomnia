import { configs } from "../../core/configs.js";
import database from "../../core/database.js";

/**
 * @param {number} value
 * @returns {string}
 */
export function pad(value) {
	return String(value).padStart(2, "0");
}

/**
 * @returns {string}
 */
export function getServerTimezone() {
	return String(
		database.get("timezone.location") ??
			configs.modules.realtime.timezone ??
			"UTC"
	);
}

/**
 * @param {string} timezone
 * @returns {number}
 */
export function getTimezoneOffsetMinutes(timezone) {
	switch (timezone) {
		case "Asia/Jakarta":
		case "WIB":
			return 7 * 60;

		case "Asia/Singapore":
		case "Asia/Makassar":
		case "WITA":
			return 8 * 60;

		case "Asia/Jayapura":
		case "WIT":
			return 9 * 60;

		case "UTC":
		default:
			return 0;
	}
}

/**
 * @param {number | string | Date} [value]
 * @returns {Date}
 */
export function getTimezoneDate(value = Date.now()) {
	const date = new Date(value);
	const offset = getTimezoneOffsetMinutes(getServerTimezone());

	return new Date(date.getTime() + offset * 60000);
}

/**
 * DD/MM/YYYY
 *
 * @param {number | string | Date} [value]
 * @returns {string}
 */
export function getDate(value = Date.now()) {
	const date = getTimezoneDate(value);

	return [
		pad(date.getUTCDate()),
		pad(date.getUTCMonth() + 1),
		date.getUTCFullYear()
	].join("/");
}

/**
 * HH:mm
 *
 * @param {number | string | Date} [value]
 * @returns {string}
 */
export function getTime(value = Date.now()) {
	const date = getTimezoneDate(value);

	return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/**
 * DD/MM/YYYY, HH:mm TZ
 *
 * @param {number | string | Date} [value]
 * @returns {string}
 */
export function formatDate(value = Date.now()) {
	const timezone = getServerTimezone();

	const label =
		timezone === "Asia/Jakarta"
			? "WIB"
			: timezone === "Asia/Makassar"
				? "WITA"
				: timezone === "Asia/Jayapura"
					? "WIT"
					: timezone === "Asia/Singapore"
						? "SGT"
						: timezone;

	return `${getDate(value)}, ${getTime(value)} ${label}`;
}
