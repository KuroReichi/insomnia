const modules: string[] = [""];

modules.sort((a, b) =>
	a.localeCompare(b, undefined, {
		sensitivity: "base"
	})
);

modules.forEach((m) => import(m));
