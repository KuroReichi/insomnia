/**
 * @param {number} value
 * @returns {string}
 */
export function pad(value) {
	return String(value).padStart(2, "0");
}

/**
 * @param {Date} [date]
 * @returns {string}
 */
export function getDate(date = new Date()) {
	return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}
