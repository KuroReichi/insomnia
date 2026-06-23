const modules = [
	// Path Module(s)
	"./lib/common/help.js",
	"./lib/common/ping.js",
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
