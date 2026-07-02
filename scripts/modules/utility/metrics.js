/**
 * @name metricNumber
 * @param {number} value
 * @param {number} decimals
 * @returns {string}
 */
export function metricNumber(value, decimals = 2) {
	if (!Number.isFinite(value)) return "0";
	if (value === 0) return "0";

	const dm = Math.max(0, Math.floor(decimals));
	const absValue = Math.abs(value);
	const sizes = ["", "k", "M", "G", "T", "P", "E", "Z", "Y"];
	const k = 1000;

	/**
	 * @param {number} num
	 * @param {number} d
	 * @returns {string}
	 */
	function formatRounded(num, d) {
		const factor = Math.pow(10, d);
		const rounded =
			Math.round((num + Math.sign(num) * Number.EPSILON) * factor) /
			factor;

		if (d <= 0) return String(Math.round(rounded));

		return rounded.toFixed(d).replace(/\.?0+$/, "");
	}

	if (absValue < k) {
		return formatRounded(value, dm);
	}

	let i = Math.floor(Math.log(absValue) / Math.log(k));
	if (i >= sizes.length) i = sizes.length - 1;

	const scaled = absValue / Math.pow(k, i);
	const prefix = value < 0 ? "-" : "";

	return `${prefix}${formatRounded(scaled, dm)}${sizes[i]}`;
}
