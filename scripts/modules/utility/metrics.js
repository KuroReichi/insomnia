/**
 *	@name metricNumber
 *	@param {number} value
 *	@param {number} decimals
 *	@returns {number}
 **/
export function metricNumber(value, decimals = 2) {
	if (value === 0) return "0";
	const absValue = Math.abs(value);
	if (absValue < 1000) return value.toString();
	const k = 1000;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["", "k", "M", "G", "T", "P", "E", "Z", "Y"];
	let i = Math.floor(Math.log(absValue) / Math.log(k));
	if (i >= sizes.length) i = sizes.length - 1;
	const formattedNumber = parseFloat((absValue / Math.pow(k, i)).toFixed(dm));
	return (value < 0 ? "-" : "") + formattedNumber + sizes[i];
}
