/** @type {string[]} */
const modules = [
	"./lib/debug/main.js",
	"./lib/common/help.js",
	"./lib/common/playtime.js",
	"./lib/common/ping.js",
	"./lib/common/rtp.js",
	"./lib/economy/baltop.js",
	"./lib/economy/bounty.js",
	"./lib/economy/money.js",
	"./lib/familia/main.js"
];

modules.sort((a, b) =>
	a.localeCompare(b, undefined, {
		sensitivity: "base"
	})
);

modules.forEach(m => import(m));
