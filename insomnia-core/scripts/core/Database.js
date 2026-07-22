import { world } from "@minecraft/server";
import { configs } from "./Configuration.js";
export class Database {
    constructor(KEY = String(configs["database.default.key"])) {
        this.key = this.normalizeKey(KEY);
    }
    normalizeKey(key) {
        const value = String(key ?? "").trim();
        return value.length > 0 ? value : String(configs["database.default.key"] ?? "Global");
    }
    buildStorageKey(key) {
        return `${String(configs["database.prefix"] ?? "MIAW-DynamicProperty")}${String(configs["database.query"] ?? "?")}${this.normalizeKey(key)}`;
    }
    get storageKey() {
        return this.buildStorageKey(this.key);
    }
    readRoot() {
        const raw = world.getDynamicProperty(this.storageKey);
        if (typeof raw !== "string" || raw.length === 0) {
            return {};
        }
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
                ? parsed
                : {};
        }
        catch {
            return {};
        }
    }
    writeRoot(root) {
        world.setDynamicProperty(this.storageKey, JSON.stringify(root));
    }
    clone(value) {
        return value === undefined ? value : JSON.parse(JSON.stringify(value));
    }
    splitPath(path) {
        return String(path ?? "")
            .split(".")
            .map((v) => v.trim())
            .filter(Boolean);
    }
    deepGet(target, path) {
        let current = target;
        for (const part of path) {
            if (current === null || current === undefined)
                return undefined;
            current = current[part];
        }
        return current;
    }
    deepSet(target, path, value) {
        if (path.length === 0)
            return;
        let current = target;
        for (let i = 0; i < path.length - 1; i++) {
            const key = path[i];
            const next = current[key];
            if (next === null ||
                next === undefined ||
                typeof next !== "object" ||
                Array.isArray(next)) {
                current[key] = {};
            }
            current = current[key];
        }
        current[path[path.length - 1]] = value;
    }
    deepDelete(target, path) {
        if (path.length === 0)
            return false;
        let current = target;
        for (let i = 0; i < path.length - 1; i++) {
            const key = path[i];
            current = current[key];
            if (current === null || current === undefined)
                return false;
            if (typeof current !== "object")
                return false;
        }
        return delete current[path[path.length - 1]];
    }
    register(ID, VALUE, OVERWRITE = true) {
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
    unregister(ID) {
        const root = this.readRoot();
        const path = this.splitPath(ID);
        if (path.length === 0)
            return false;
        const existed = this.deepGet(root, path) !== undefined;
        if (!existed)
            return false;
        const removed = this.deepDelete(root, path);
        if (removed)
            this.writeRoot(root);
        return removed;
    }
    get(ID) {
        const root = this.readRoot();
        const path = this.splitPath(ID);
        if (path.length === 0)
            return undefined;
        return this.clone(this.deepGet(root, path));
    }
    HAS(ID) {
        const root = this.readRoot();
        const path = this.splitPath(ID);
        if (path.length === 0)
            return false;
        return this.deepGet(root, path) !== undefined;
    }
    DELETE(ID) {
        const root = this.readRoot();
        const path = this.splitPath(ID);
        if (path.length === 0)
            return false;
        if (this.deepGet(root, path) === undefined)
            return false;
        const removed = this.deepDelete(root, path);
        if (removed)
            this.writeRoot(root);
        return removed;
    }
    PUT(ID, VALUE) {
        const root = this.readRoot();
        const path = this.splitPath(ID);
        this.deepSet(root, path, this.clone(VALUE));
        this.writeRoot(root);
        return this.clone(VALUE);
    }
    PATCH(ID, PATH, CALLBACK) {
        const root = this.readRoot();
        const idPath = this.splitPath(ID);
        const subPath = this.splitPath(PATH);
        if (idPath.length === 0)
            return undefined;
        if (subPath.length === 0)
            return undefined;
        const currentRoot = this.deepGet(root, idPath);
        const base = currentRoot === undefined ? {} : this.clone(currentRoot);
        let target = base;
        for (let i = 0; i < subPath.length - 1; i++) {
            const key = subPath[i];
            if (target[key] === null ||
                target[key] === undefined ||
                typeof target[key] !== "object") {
                target[key] = {};
            }
            target = target[key];
        }
        const lastKey = subPath[subPath.length - 1];
        const currentValue = target[lastKey];
        const result = CALLBACK(this.clone(currentValue));
        const nextValue = (result === undefined ? currentValue : result);
        target[lastKey] = this.clone(nextValue);
        this.deepSet(root, idPath, base);
        this.writeRoot(root);
        return this.clone(nextValue);
    }
}
