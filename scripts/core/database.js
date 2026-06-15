import { world } from "@minecraft/server";

const database = {
	prefix: "MiawDB",
	query: "?",
	set(id, value, key = "global", overwrite = true) {
		if (typeof id === "object" && id !== null && !Array.isArray(id)) {
			const entries = Object.entries(id);
			const bulkData = {};
			for (const [bulkId, bulkValue] of entries) {
				if (/:/.test(key))
					throw new Error(
						"The character ':' is not allowed in (key) database!.",
					);
				const fullKey =
					database.prefix + database.query + key + ":" + bulkId;
				if (
					!overwrite &&
					world.getDynamicProperty(fullKey) !== undefined
				)
					continue;
				bulkData[fullKey] =
					typeof bulkValue === "object"
						? JSON.stringify(bulkValue)
						: bulkValue;
			}
			world.setDynamicProperties(bulkData);
			return true;
		}

		if (/:/.test(key))
			throw new Error(
				"The character ':' is not allowed in (key) database!.",
			);
		const fullKey = database.prefix + database.query + key + ":" + id;

		if (world.getDynamicProperty(fullKey) === undefined || overwrite) {
			world.setDynamicProperty(
				fullKey,
				typeof value === "object" ? JSON.stringify(value) : value,
			);
		}

		return world.getDynamicProperty(fullKey);
	},

	get(id, key = "global") {
		try {
			return JSON.parse(
				world.getDynamicProperty(
					database.prefix + database.query + key + ":" + id,
				),
			);
		} catch (e) {
			return world.getDynamicProperty(
				database.prefix + database.query + key + ":" + id,
			);
		}
	},

	getAllBy(key = "global") {
		return world
			.getDynamicPropertyIds()
			.filter((propertyID) =>
				propertyID.startsWith(
					database.prefix + database.query + key + ":",
				),
			)
			.map((propertyID) => ({
				id: propertyID.replace(
					database.prefix + database.query + key + ":",
					"",
				),
				data: database.get(
					propertyID.replace(
						database.prefix + database.query + key + ":",
						"",
					),
					key,
				),
			}));
	},

	getAll() {
		return world
			.getDynamicPropertyIds()
			.filter((propertyID) =>
				propertyID.startsWith(database.prefix + database.query),
			)
			.map((propertyID) => ({
				id: propertyID.substring(propertyID.lastIndexOf(":") + 1),
				source: propertyID.slice(
					propertyID.indexOf(database.query) + 1,
					propertyID.lastIndexOf(":"),
				),
			}));
	},

	delete(id, key = "global") {
		if (
			world.getDynamicProperty(
				database.prefix + database.query + key + ":" + id,
			) === undefined
		)
			return false;
		world.setDynamicProperty(
			database.prefix + database.query + key + ":" + id,
			undefined,
		);
		return true;
	},

	add(id, key = "global", value = 0) {
		if (typeof value !== "number")
			throw new ReferenceError(
				`Unexpected type at » database.add(...) «, value must be a number, but it present ${typeof value}`,
			);
		return database.set(id, database.get(id, key) + value, key, true);
	},

	remove(id, key = "global", value = 0) {
		if (typeof value !== "number")
			throw new ReferenceError(
				`Unexpected type at » database.remove(...) «, value must be a number, but it present ${typeof value}`,
			);
		return database.set(id, database.get(id, key) - value, key, true);
	},

	player(player) {
		const key = player.name;
		return {
			set: (id, value, overwrite = true) =>
				database.set(id, value, key, overwrite),
			get: (id) => database.get(id, key),
			delete: (id) => database.delete(id, key),
			add: (id, value) => database.add(id, key, value),
			remove: (id, value) => database.remove(id, key, value),
			getAll: () => database.getAll(key),
		};
	},
};

export default database;
