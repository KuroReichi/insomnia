import { world } from "@minecraft/server";

/**
 * @typedef {import("@minecraft/server").Player} Player
 * @typedef {import("@minecraft/server").Vector3} Vector3
 * @typedef {string | number | boolean | Vector3 | undefined} DynamicPropertyValue
 * @typedef {Record<string, DynamicPropertyValue>} DynamicPropertyMap
 * @typedef {null | string | number | boolean | Vector3 | Record<string, unknown> | Array<unknown> | undefined} DatabaseValue
 *
 * @typedef {{
 * 	name: string,
 * 	value: DatabaseValue
 * }} DatabaseBulkItem
 *
 * @typedef {{
 * 	enabled?: boolean,
 * 	type?: "whitelist" | "blacklist",
 * 	namespace?: string[]
 * }} DatabaseOverwriteOptions
 *
 * @typedef {{
 * 	overwrite?: DatabaseOverwriteOptions,
 * 	createIfMissing?: boolean
 * }} DatabaseBulkOptions
 *
 * @typedef {{
 * 	list: DatabaseBulkItem[],
 * 	key?: string,
 * 	options?: DatabaseBulkOptions
 * }} DatabaseBulkInput
 *
 * @typedef {Record<string, DatabaseValue>} DatabaseBulkObjectInput
 * @typedef {DatabaseBulkInput | DatabaseBulkObjectInput} DatabaseSetObjectInput
 *
 * @typedef {{id: string, data: DatabaseValue | undefined}} DatabaseEntry
 * @typedef {{id: string, source: string}} DatabaseIndexEntry
 *
 * @typedef {{
 * 	set(id: string | DatabaseSetObjectInput, value?: DatabaseValue, key?: string, overwrite?: boolean): DynamicPropertyValue | boolean,
 * 	get<T = DatabaseValue>(id: string, key?: string): T | undefined,
 * 	getAllBy(key?: string): DatabaseEntry[],
 * 	getAll(key?: string): DatabaseIndexEntry[],
 * 	delete(id: string, key?: string): boolean,
 * 	add(id: string, key?: string, value?: number): number,
 * 	remove(id: string, key?: string, value?: number): number,
 * }} DatabaseApi
 *
 * @typedef {{
 * 	set(id: string, value: DatabaseValue, overwrite?: boolean): DynamicPropertyValue | boolean,
 * 	get<T = DatabaseValue>(id: string): T | undefined,
 * 	delete(id: string): boolean,
 * 	add(id: string, value?: number): number,
 * 	remove(id: string, value?: number): number,
 * 	getAll(): DatabaseIndexEntry[]
 * }} DatabasePlayerApi
 */

/**
 * @param {DatabaseValue} value
 * @returns {DynamicPropertyValue}
 */
function toDynamicValue(value) {
	if (value === undefined) return undefined;
	if (value !== null && typeof value === "object") {
		return /** @type {DynamicPropertyValue} */ (JSON.stringify(value));
	}
	return /** @type {DynamicPropertyValue} */ (value);
}

/**
 * @param {DatabaseBulkOptions | undefined} options
 * @param {string} name
 * @param {boolean} exists
 * @returns {{create: boolean, overwrite: boolean}}
 */
function resolveBulkRule(options, name, exists) {
	const createIfMissing = options?.createIfMissing ?? true;
	const overwrite = options?.overwrite ?? {};
	const overwriteEnabled = overwrite.enabled ?? true;
	const overwriteType = overwrite.type ?? "blacklist";
	const namespace = overwrite.namespace ?? [];

	const create = exists ? true : createIfMissing;
	let canOverwrite = exists ? overwriteEnabled : false;

	if (exists && overwriteEnabled) {
		canOverwrite = overwriteType === "whitelist" ? namespace.includes(name) : !namespace.includes(name);
	}

	return { create, overwrite: canOverwrite };
}

/** @type {DatabaseApi & { prefix: string, query: string, player(player: Player): DatabasePlayerApi }} */
const database = {
	prefix: "MiawDB",
	query: "?",

	/**
	 * @param {string | DatabaseSetObjectInput} id
	 * @param {DatabaseValue} [value]
	 * @param {string} [key="global"]
	 * @param {boolean} [overwrite=true]
	 * @returns {DynamicPropertyValue | boolean}
	 */
	set(id, value, key = "global", overwrite = true) {
		if (/:/.test(key)) {
			throw new Error("The character ':' is not allowed in (key) database!.");
		}

		if (typeof id === "object" && id !== null && !Array.isArray(id)) {
			if ("list" in id && Array.isArray(id.list)) {
				/** @type {DatabaseBulkInput} */
				const bulkInput = /** @type {DatabaseBulkInput} */ (id);
				const bulkKey = bulkInput.key ?? key ?? "global";

				if (/:/.test(bulkKey)) {
					throw new Error("The character ':' is not allowed in (key) database!.");
				}

				/** @type {DynamicPropertyMap} */
				const bulkData = {};

				for (const entry of bulkInput.list) {
					const fullKey = database.prefix + database.query + bulkKey + ":" + entry.name;
					const exists = world.getDynamicProperty(fullKey) !== undefined;
					const rule = resolveBulkRule(bulkInput.options, entry.name, exists);

					if (!exists && !rule.create) continue;
					if (exists && !rule.overwrite) continue;

					bulkData[fullKey] = toDynamicValue(entry.value);
				}

				if (Object.keys(bulkData).length > 0) {
					world.setDynamicProperties(bulkData);
				}
				return true;
			}

			/** @type {DatabaseBulkObjectInput} */
			const bulkObject = /** @type {DatabaseBulkObjectInput} */ (id);
			/** @type {DynamicPropertyMap} */
			const bulkData = {};
			/** @type {[string, DatabaseValue][]} */
			const entries = Object.entries(bulkObject);

			for (const [bulkId, bulkValue] of entries) {
				const fullKey = database.prefix + database.query + key + ":" + bulkId;
				if (!overwrite && world.getDynamicProperty(fullKey) !== undefined) continue;
				bulkData[fullKey] = toDynamicValue(bulkValue);
			}

			if (Object.keys(bulkData).length > 0) {
				world.setDynamicProperties(bulkData);
			}
			return true;
		}

		const fullKey = database.prefix + database.query + key + ":" + id;
		if (world.getDynamicProperty(fullKey) === undefined || overwrite) {
			world.setDynamicProperty(fullKey, toDynamicValue(value));
		}
		return /** @type {DynamicPropertyValue} */ (world.getDynamicProperty(fullKey));
	},

	/**
	 * @template T
	 * @param {string} id
	 * @param {string} [key="global"]
	 * @returns {T | undefined}
	 */
	get(id, key = "global") {
		const fullKey = database.prefix + database.query + key + ":" + id;
		const value = world.getDynamicProperty(fullKey);

		if (value === undefined) return undefined;
		if (typeof value !== "string") return /** @type {T} */ (value);

		try {
			return /** @type {T} */ (JSON.parse(value));
		} catch {
			return /** @type {T} */ (value);
		}
	},

	/**
	 * @param {string} [key="global"]
	 * @returns {DatabaseEntry[]}
	 */
	getAllBy(key = "global") {
		return world
			.getDynamicPropertyIds()
			.filter(propertyID => propertyID.startsWith(database.prefix + database.query + key + ":"))
			.map(propertyID => {
				const id = propertyID.replace(database.prefix + database.query + key + ":", "");
				return { id, data: database.get(id, key) };
			});
	},

	/**
	 * @param {string} [key="global"]
	 * @returns {DatabaseIndexEntry[]}
	 */
	getAll(key = "global") {
		return world
			.getDynamicPropertyIds()
			.filter(propertyID => propertyID.startsWith(database.prefix + database.query + key + ":"))
			.map(propertyID => ({
				id: propertyID.substring(propertyID.lastIndexOf(":") + 1),
				source: propertyID.slice(propertyID.indexOf(database.query) + 1, propertyID.lastIndexOf(":"))
			}));
	},

	/**
	 * @param {string} id
	 * @param {string} [key="global"]
	 * @returns {boolean}
	 */
	delete(id, key = "global") {
		const fullKey = database.prefix + database.query + key + ":" + id;
		if (world.getDynamicProperty(fullKey) === undefined) return false;
		world.setDynamicProperty(fullKey, undefined);
		return true;
	},

	/**
	 * @param {string} id
	 * @param {string} [key="global"]
	 * @param {number} [value=0]
	 * @returns {number}
	 */
	add(id, key = "global", value = 0) {
		if (typeof value !== "number") {
			throw new ReferenceError(`Unexpected type at » database.add(...) «, value must be a number, but it present ${typeof value}`);
		}
		const next = Number(database.get(id, key) ?? 0) + value;
		database.set(id, next, key, true);
		return next;
	},

	/**
	 * @param {string} id
	 * @param {string} [key="global"]
	 * @param {number} [value=0]
	 * @returns {number}
	 */
	remove(id, key = "global", value = 0) {
		if (typeof value !== "number") {
			throw new ReferenceError(`Unexpected type at » database.remove(...) «, value must be a number, but it present ${typeof value}`);
		}
		const next = Number(database.get(id, key) ?? 0) - value;
		database.set(id, next, key, true);
		return next;
	},

	/**
	 * @param {Player} player
	 * @returns {DatabasePlayerApi}
	 */
	player(player) {
		const key = player.name;
		return {
			/**
			 * @param {string} id
			 * @param {DatabaseValue} value
			 * @param {boolean} [overwrite=true]
			 * @returns {DynamicPropertyValue | boolean}
			 */
			set: (id, value, overwrite = true) => database.set(id, value, key, overwrite),

			/**
			 * @template T
			 * @param {string} id
			 * @returns {T | undefined}
			 */
			get: id => database.get(id, key),

			/**
			 * @param {string} id
			 * @returns {boolean}
			 */
			delete: id => database.delete(id, key),

			/**
			 * @param {string} id
			 * @param {number} [value=0]
			 * @returns {number}
			 */
			add: (id, value) => database.add(id, key, value),

			/**
			 * @param {string} id
			 * @param {number} [value=0]
			 * @returns {number}
			 */
			remove: (id, value) => database.remove(id, key, value),

			/**
			 * @returns {DatabaseIndexEntry[]}
			 */
			getAll: () => database.getAll(key)
		};
	}
};

export default database;
