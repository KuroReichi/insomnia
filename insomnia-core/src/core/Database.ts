import { world } from "@minecraft/server";
import { configs } from "./Configuration.js";

type DBValue = string | number | boolean | null | DBValue[] | { [key: string]: DBValue };

type DBObject = Record<string, DBValue>;
type PathValue = DBValue | undefined;

export class Database {
	public readonly key: string;

	constructor(KEY: string = String(configs["database.default.key"])) {
		this.key = this.normalizeKey(KEY);
	}

	private normalizeKey(key?: string): string {
		const value = String(key ?? "").trim();
		return value.length > 0 ? value : String(configs["database.default.key"] ?? "Global");
	}

	private buildStorageKey(key?: string): string {
		return `${String(configs["database.prefix"] ?? "MIAW-DynamicProperty")}${String(configs["database.query"] ?? "?")}${this.normalizeKey(key)}`;
	}

	private get storageKey(): string {
		return this.buildStorageKey(this.key);
	}

	private readRoot(): DBObject {
		const raw = world.getDynamicProperty(this.storageKey);

		if (typeof raw !== "string" || raw.length === 0) {
			return {};
		}

		try {
			const parsed = JSON.parse(raw);
			return parsed && typeof parsed === "object" && !Array.isArray(parsed)
				? (parsed as DBObject)
				: {};
		} catch {
			return {};
		}
	}

	private writeRoot(root: DBObject): void {
		world.setDynamicProperty(this.storageKey, JSON.stringify(root));
	}

	private clone<T>(value: T): T {
		return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
	}

	private splitPath(path: string): string[] {
		return String(path ?? "")
			.split(".")
			.map((v) => v.trim())
			.filter(Boolean);
	}

	private deepGet(target: unknown, path: string[]): PathValue {
		let current: any = target;

		for (const part of path) {
			if (current === null || current === undefined) return undefined;
			current = current[part];
		}

		return current as PathValue;
	}

	private deepSet(target: DBObject, path: string[], value: DBValue): void {
		if (path.length === 0) return;

		let current: any = target;

		for (let i = 0; i < path.length - 1; i++) {
			const key = path[i];
			const next = current[key];

			if (
				next === null ||
				next === undefined ||
				typeof next !== "object" ||
				Array.isArray(next)
			) {
				current[key] = {};
			}

			current = current[key];
		}

		current[path[path.length - 1]] = value;
	}

	private deepDelete(target: DBObject, path: string[]): boolean {
		if (path.length === 0) return false;

		let current: any = target;

		for (let i = 0; i < path.length - 1; i++) {
			const key = path[i];
			current = current[key];

			if (current === null || current === undefined) return false;
			if (typeof current !== "object") return false;
		}

		return delete current[path[path.length - 1]];
	}

	public register(ID: string, VALUE: DBValue, OVERWRITE: boolean = true): PathValue {
		const root = this.readRoot();
		const path = this.splitPath(ID);
		const current = this.deepGet(root, path);

		if (current !== undefined && !OVERWRITE) {
			return this.clone(current);
		}

		this.deepSet(root, path, this.clone(VALUE));
		this.writeRoot(root);

		return this.clone(VALUE);
	}

	public unregister(ID: string): boolean {
		const root = this.readRoot();
		const path = this.splitPath(ID);

		if (path.length === 0) return false;

		const existed = this.deepGet(root, path) !== undefined;
		if (!existed) return false;

		const removed = this.deepDelete(root, path);
		if (removed) this.writeRoot(root);

		return removed;
	}

	public get(ID: string): PathValue {
		const root = this.readRoot();
		const path = this.splitPath(ID);

		if (path.length === 0) return undefined;

		return this.clone(this.deepGet(root, path));
	}

	public HAS(ID: string): boolean {
		const root = this.readRoot();
		const path = this.splitPath(ID);

		if (path.length === 0) return false;

		return this.deepGet(root, path) !== undefined;
	}

	public DELETE(ID: string): boolean {
		const root = this.readRoot();
		const path = this.splitPath(ID);

		if (path.length === 0) return false;
		if (this.deepGet(root, path) === undefined) return false;

		const removed = this.deepDelete(root, path);
		if (removed) this.writeRoot(root);

		return removed;
	}

	public PUT<T extends DBValue>(ID: string, VALUE: T): T {
		const root = this.readRoot();
		const path = this.splitPath(ID);

		this.deepSet(root, path, this.clone(VALUE));
		this.writeRoot(root);

		return this.clone(VALUE);
	}

	public PATCH<T extends DBValue>(
		ID: string,
		PATH: string,
		CALLBACK: (value: T) => T | void
	): T | undefined {
		const root = this.readRoot();
		const idPath = this.splitPath(ID);
		const subPath = this.splitPath(PATH);

		if (idPath.length === 0) return undefined;
		if (subPath.length === 0) return undefined;

		const currentRoot = this.deepGet(root, idPath);
		const base: DBValue = currentRoot === undefined ? {} : this.clone(currentRoot);

		let target: any = base;

		for (let i = 0; i < subPath.length - 1; i++) {
			const key = subPath[i];

			if (
				target[key] === null ||
				target[key] === undefined ||
				typeof target[key] !== "object"
			) {
				target[key] = {};
			}

			target = target[key];
		}

		const lastKey = subPath[subPath.length - 1];
		const currentValue = target[lastKey] as T;
		const result = CALLBACK(this.clone(currentValue));
		const nextValue = (result === undefined ? currentValue : result) as T;

		target[lastKey] = this.clone(nextValue);
		this.deepSet(root, idPath, base);
		this.writeRoot(root);

		return this.clone(nextValue);
	}
}
