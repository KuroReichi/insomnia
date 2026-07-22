type InspectValue = unknown;

interface WritableLike {
	write(chunk: string): void;
}

declare global {
	interface ConsoleOptions {
		stdout: WritableLike;
		stderr?: WritableLike;
		ignoreErrors?: boolean;
		colorMode?: boolean | "auto";
		inspectOptions?: unknown;
		groupIndentation?: number;
	}

	interface Console {
		assert(condition?: unknown, ...data: unknown[]): void;
		clear(): void;
		count(label?: string): void;
		countReset(label?: string): void;
		debug(...data: unknown[]): void;
		dir(item?: InspectValue, options?: unknown): void;
		dirxml(...data: unknown[]): void;
		error(...data: unknown[]): void;
		group(...data: unknown[]): void;
		groupCollapsed(...data: unknown[]): void;
		groupEnd(): void;
		info(...data: unknown[]): void;
		log(...data: unknown[]): void;
		table(tabularData?: unknown, properties?: string[]): void;
		time(label?: string): void;
		timeEnd(label?: string): void;
		timeLog(label?: string, ...data: unknown[]): void;
		trace(...data: unknown[]): void;
		warn(...data: unknown[]): void;
		profile(label?: string): void;
		profileEnd(label?: string): void;
		timeStamp(label?: string): void;
		success(...data: unknown[]): void;
	}

	const console: Console;
}

export {};
