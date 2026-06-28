import { world, system } from "@minecraft/server";
import { configs } from "../../../core/configs.js";
import database from "./../../../core/database.js";

const TIMEZONE = configs.modules.realtime.timezone;

/**
 * @name getTimezoneLoc
 * @returns {TimezoneLocation}
 * @typedef {Object} TimezoneLocation
 * @property {number} hour
 * @property {number} minute
 * @property {number} second
 */
function getTimezoneLoc() {
	const date = new Date();
	const timez = new Date(date.toLocaleString("en-US", { timeZone: database.get("timezone.location") ?? TIMEZONE }));

	return {
		hour: timez.getHours(),
		minute: timez.getMinutes(),
		second: timez.getSeconds()
	};
}

function getMinecraftTimeFromIRL() {
	const { hour, minute, second } = getTimezoneLoc();
	const irlHours = hour + minute / 60 + second / 3600;
	let mcHours = irlHours - 6;
	if (mcHours < 0) mcHours += 24;
	return Math.floor(mcHours * 1000);
}

function getDayPassed() {
	const start = database.get("server.start_date", "server");
	if (!start) return 0;

	const tz = database.get("timezone.location") ?? "Asia/Jakarta";
	const startDate = new Date(new Date(start).toLocaleString("en-US", { timeZone: tz }));
	const nowDate = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));

	startDate.setHours(0, 0, 0, 0);
	nowDate.setHours(0, 0, 0, 0);

	const diff = Number(nowDate) - Number(startDate);
	return Math.max(Math.floor(diff / 86400000), 0);
}

export let runtime = system.runInterval(() => {
	if (!configs.modules.realtime.enabled) {
		system.clearRun(runtime);
		world.gameRules.doDayLightCycle = true;
		return;
	}
	if (world.gameRules.doDayLightCycle === true) world.gameRules.doDayLightCycle = false;
	const ticks = getMinecraftTimeFromIRL();
	const days = getDayPassed();

	const finalTime = (ticks + days * 24000) % 2147483647;

	world.getDimension("overworld").runCommand(`time set ${finalTime}`);
}, 5);
