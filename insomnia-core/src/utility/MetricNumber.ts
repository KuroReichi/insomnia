export function metricNumber(
	value: number | string,
	type: "normal" | "reverse" = "normal",
	decimals: number = 2
): string | number {
	if (type === "reverse") {
		return reverseMetricNumber(value);
	}

	return formatMetricNumber(Number(value), decimals);
}

function formatMetricNumber(value: number, decimals: number = 2) {
	if (!Number.isFinite(value)) return "0";
	if (value === 0) return "0";

	const dm = Math.max(0, Math.floor(decimals));
	const absValue = Math.abs(value);
	const sizes = ["", "k", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
	const k = 1000;

	function formatRounded(num: number, d: number): string {
		const factor = Math.pow(10, d);
		const rounded = Math.round((num + Math.sign(num) * Number.EPSILON) * factor) / factor;

		if (d <= 0) return String(Math.round(rounded));

		return rounded.toFixed(d).replace(/\.?0+$/, "");
	}

	if (absValue < k) {
		return formatRounded(value, dm);
	}

	let i = Math.floor(Math.log(absValue) / Math.log(k));
	if (i >= sizes.length) i = sizes.length - 1;

	let scaled = absValue / Math.pow(k, i);
	let formatted = Number(formatRounded(scaled, dm));

	if (formatted >= 1000 && i < sizes.length - 1) {
		i++;
		scaled = absValue / Math.pow(k, i);
		formatted = Number(formatRounded(scaled, dm));
	}

	const prefix = value < 0 ? "-" : "";
	return `${prefix}${formatRounded(formatted, dm)}${sizes[i]}`;
}

function normalizeLocalizedNumberString(input: string) {
	let value = String(input).trim().replace(/\s+/g, "");

	if (value.includes(",") && value.includes(".")) {
		if (value.lastIndexOf(",") > value.lastIndexOf(".")) {
			value = value.replace(/\./g, "").replace(",", ".");
		} else {
			value = value.replace(/,/g, "");
		}
	} else if (value.includes(",")) {
		const parts = value.split(",");
		if (parts.length === 2 && parts[1].length <= 2) {
			value = `${parts[0].replace(/\./g, "")}.${parts[1]}`;
		} else {
			value = value.replace(/,/g, "");
		}
	}

	return value;
}

function reverseMetricNumber(value: number | string): number {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : 0;
	}

	if (typeof value !== "string") return 0;

	const normalized = normalizeLocalizedNumberString(value);
	const match = normalized.match(/^([+-]?\d+(?:\.\d+)?)([kKmMbBtTQq][a-zA-Z]*)?$/);

	if (!match) {
		const fallback = Number(normalized);
		return Number.isFinite(fallback) ? fallback : 0;
	}

	const num = Number(match[1]);
	const unit = String(match[2] ?? "").toLowerCase();

	const multipliers = {
		"": 1,
		k: 1e3,
		m: 1e6,
		b: 1e9,
		t: 1e12,
		qa: 1e15,
		qi: 1e18,
		sx: 1e21,
		sp: 1e24,
		oc: 1e27,
		no: 1e30,
		dc: 1e33
	} as const;

	type MetricUnit = keyof typeof multipliers;

	// prettier-ignore
	const normalizedUnit =
		unit.startsWith("qa") ? "qa" :
		unit.startsWith("qi") ? "qi" :
		unit.startsWith("sx") ? "sx" :
		unit.startsWith("sp") ? "sp" :
		unit.startsWith("oc") ? "oc" :
		unit.startsWith("no") ? "no" :
		unit.startsWith("dc") ? "dc" :
		unit.slice(0, 1) as MetricUnit;

	return num * (multipliers[normalizedUnit] ?? 1);
}
