const modules = [
	// Path Module(s)
	"./lib/common/help.js",
	"./lib/familia/main.js",
	"./lib/debug/main.js",
	"./lib/common/ping.js"
];

modules.sort((a, b) =>
	a.localeCompare(b, undefined, {
		sensitivity: "base"
	})
);

modules.forEach(m => import(m));
