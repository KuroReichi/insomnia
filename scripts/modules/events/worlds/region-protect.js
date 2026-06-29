import { world, PlayerPermissionLevel } from "@minecraft/server";
import { configs } from "../../../core/configs.js";
import database from "../../../core/database.js";

/**
 * @typedef {import("@minecraft/server").Player} Player
 * @typedef {import("@minecraft/server").Entity} Entity
 * @typedef {import("@minecraft/server").Vector3} Vector3
 */

/**
 * @typedef {Object} RegionTargetFilter
 * @property {"blacklist" | "whitelist"} type
 * @property {string[]} list
 */

/**
 * @typedef {Object} RegionBypass
 * @property {boolean} operator
 * @property {string[]} tags
 * @property {string[]} gamertags
 */

/**
 * @typedef {Object} RegionBlockPermission
 * @property {boolean} break
 * @property {boolean} place
 * @property {RegionTargetFilter} interact
 */

/**
 * @typedef {Object} RegionEntitySpawnPermission
 * @property {boolean} animals
 * @property {boolean} monster
 */

/**
 * @typedef {Object} RegionEntityPermission
 * @property {RegionEntitySpawnPermission} spawn
 * @property {RegionTargetFilter} interact
 */

/**
 * @typedef {Object} RegionItemPermission
 * @property {boolean} pickup
 * @property {boolean} drop
 * @property {RegionTargetFilter} interact
 */

/**
 * @typedef {Object} RegionPermission
 * @property {boolean} pvp
 * @property {boolean} explosion
 * @property {RegionBlockPermission} blocks
 * @property {RegionEntityPermission} entities
 * @property {RegionItemPermission} items
 */

/**
 * @typedef {Object} RegionRadiusCenterCoordinates
 * @property {number} x
 * @property {number} z
 */

/**
 * @typedef {Object} RegionRadiusValue
 * @property {"spawn" | RegionRadiusCenterCoordinates} center
 * @property {number} radius
 */

/**
 * @typedef {Object} RegionPointValue
 * @property {{x:number, y:number, z:number}} point
 */

/**
 * @typedef {Object} RegionData
 * @property {string} id
 * @property {boolean} [enabled]
 * @property {number} [priority]
 * @property {RegionBypass} bypass
 * @property {"point" | "radius"} type
 * @property {RegionRadiusValue | RegionPointValue} value
 * @property {RegionPermission} permission
 */

/**
 * @typedef {Object} RegionProtectConfig
 * @property {string} dimension
 * @property {RegionData} data
 */

/**
 * @typedef {Object} CompiledRegion
 * @property {string} id
 * @property {string} dimensionId
 * @property {boolean} enabled
 * @property {number} priority
 * @property {RegionBypass} bypass
 * @property {"point" | "radius"} type
 * @property {RegionPermission} permission
 * @property {{x:number, z:number}} [point]
 * @property {{x:number, z:number}} [center]
 * @property {number} [radius]
 */

const REGION_DB_KEY = "region";

/** @type {RegionProtectConfig[]} */
const regionConfigs = Array.isArray(configs?.modules?.regionProtect)
	? configs.modules.regionProtect
	: [];

/** @type {Record<string, CompiledRegion[]>} */
const dimensionRegions = {
	"minecraft:overworld": [],
	"minecraft:nether": [],
	"minecraft:the_end": []
};

let booted = false;

/**
 * @param {unknown} value
 * @returns {string}
 */
const str = value => String(value ?? "").trim();

/**
 * @param {string} value
 * @returns {string}
 */
const normalizeDimensionId = value => {
	const raw = str(value).toLowerCase();
	if (raw.includes("nether")) return "minecraft:nether";
	if (raw.includes("end")) return "minecraft:the_end";
	if (!raw || raw.includes("overworld")) return "minecraft:overworld";
	return raw;
};

/**
 * @param {Player | Entity | undefined} entity
 * @param {RegionBypass} bypass
 * @returns {boolean}
 */
const hasBypass = (entity, bypass) => {
	if (!entity || !bypass) return false;
	if (entity.typeId !== "minecraft:player") return false;

	const player = /** @type {Player} */ (/** @type {unknown} */ (entity));

	if (
		bypass.operator &&
		(player.playerPermissionLevel === PlayerPermissionLevel.Operator ||
			player.playerPermissionLevel === PlayerPermissionLevel.Custom)
	) {
		return true;
	}

	if (
		Array.isArray(bypass.gamertags) &&
		bypass.gamertags.includes(player.name)
	) {
		return true;
	}

	if (
		Array.isArray(bypass.tags) &&
		bypass.tags.some(tag => player.hasTag(tag))
	) {
		return true;
	}

	return false;
};

/**
 * @param {RegionTargetFilter | undefined} filter
 * @param {string} targetId
 * @returns {boolean}
 */
const isTargetDenied = (filter, targetId) => {
	if (!filter || !Array.isArray(filter.list) || filter.list.length === 0) {
		return false;
	}

	const matched = filter.list.includes(targetId);
	return filter.type === "whitelist" ? !matched : matched;
};

/**
 * @param {Player | undefined} player
 * @param {string} action
 * @returns {void}
 */
function sendDeniedMessage(player, action) {
	if (!player) return;

	player.sendMessage(
		`§l§6> §r§cYou cannot §7${action} §cInside this region.`
	);
	player.playSound?.("note.bass");
}

/**
 * @param {RegionProtectConfig} config
 * @returns {CompiledRegion | null}
 */
const compileRegion = config => {
	const { data, dimension } = config;
	if (!data?.id || !data?.type || !data?.permission) return null;

	const priority = Number(data.priority ?? 0);
	if (!Number.isFinite(priority)) return null;

	const dimensionId = normalizeDimensionId(dimension);

	/** @type {RegionBypass} */
	const bypass = {
		operator: Boolean(data.bypass?.operator),
		tags: Array.isArray(data.bypass?.tags) ? data.bypass.tags : [],
		gamertags: Array.isArray(data.bypass?.gamertags)
			? data.bypass.gamertags
			: []
	};

	if (data.type === "radius") {
		const value = /** @type {RegionRadiusValue} */ (data.value);
		const radius = Number(value?.radius ?? 0);
		if (radius < 0 || !Number.isFinite(radius)) return null;

		let center = value?.center ?? "spawn";
		if (center === "spawn") {
			const spawn = world.getDefaultSpawnLocation();
			center = { x: spawn.x, z: spawn.z };
		}

		if (
			typeof center !== "object" ||
			typeof center.x !== "number" ||
			typeof center.z !== "number"
		) {
			return null;
		}

		return {
			id: str(data.id),
			dimensionId,
			enabled: data.enabled !== false,
			priority,
			bypass,
			type: "radius",
			center: {
				x: Math.floor(center.x),
				z: Math.floor(center.z)
			},
			radius: Math.floor(radius),
			permission: data.permission
		};
	}

	if (data.type === "point") {
		const value = /** @type {RegionPointValue} */ (data.value);
		const pt = value?.point;

		if (
			!pt ||
			typeof pt.x !== "number" ||
			typeof pt.y !== "number" ||
			typeof pt.z !== "number"
		) {
			return null;
		}

		return {
			id: str(data.id),
			dimensionId,
			enabled: data.enabled !== false,
			priority,
			bypass,
			type: "point",
			point: {
				x: Math.floor(pt.x),
				z: Math.floor(pt.z)
			},
			permission: data.permission
		};
	}

	return null;
};

/**
 * @param {CompiledRegion} region
 * @param {Vector3} location
 * @returns {boolean}
 */
const regionContains = (region, location) => {
	if (!region.enabled) return false;

	const x = Math.floor(location.x);
	const z = Math.floor(location.z);

	if (region.type === "point" && region.point) {
		return x === region.point.x && z === region.point.z;
	}

	if (
		region.type === "radius" &&
		region.center &&
		region.radius !== undefined
	) {
		return (
			Math.abs(x - region.center.x) <= region.radius &&
			Math.abs(z - region.center.z) <= region.radius
		);
	}

	return false;
};

/**
 * @param {Vector3} location
 * @param {string} dimensionId
 * @returns {CompiledRegion | null}
 */
const getBestRegion = (location, dimensionId) => {
	const dim = normalizeDimensionId(dimensionId);
	const regions = dimensionRegions[dim];
	if (!regions) return null;

	for (const region of regions) {
		if (regionContains(region, location)) return region;
	}

	return null;
};

/**
 * @returns {void}
 */
const loadRegionProtect = () => {
	/** @type {CompiledRegion[]} */
	const compiled = [];

	for (const config of regionConfigs) {
		const region = compileRegion(config);
		if (region) compiled.push(region);
	}

	compiled.sort(
		(a, b) =>
			b.priority - a.priority ||
			a.id.localeCompare(b.id, undefined, { sensitivity: "base" })
	);

	for (const key of Object.keys(dimensionRegions)) {
		dimensionRegions[key] = [];
	}

	for (const region of compiled) {
		if (!dimensionRegions[region.dimensionId]) {
			dimensionRegions[region.dimensionId] = [];
		}
		dimensionRegions[region.dimensionId].push(region);
	}

	const existingEntries = database.getAllBy(REGION_DB_KEY);
	if (Array.isArray(existingEntries)) {
		for (const entry of existingEntries) {
			database.delete(entry.id, REGION_DB_KEY);
		}
	}

	for (const region of compiled) {
		database.set(region.id, region, REGION_DB_KEY, true);
	}
};

world.afterEvents.worldLoad.subscribe(() => {
	if (booted) return;
	booted = true;

	loadRegionProtect();

	world.beforeEvents.playerBreakBlock?.subscribe(event => {
		const { player, block } = event;
		const region = getBestRegion(block.location, block.dimension.id);

		if (
			region &&
			region.permission.blocks.break === false &&
			!hasBypass(player, region.bypass)
		) {
			event.cancel = true;
			sendDeniedMessage(player, "break blocks");
		}
	});

	world.beforeEvents.playerPlaceBlock?.subscribe(event => {
		const { player, block } = event;
		const region = getBestRegion(block.location, block.dimension.id);

		if (
			region &&
			region.permission.blocks.place === false &&
			!hasBypass(player, region.bypass)
		) {
			event.cancel = true;
			sendDeniedMessage(player, "place blocks");
		}
	});

	world.beforeEvents.playerInteractWithBlock?.subscribe(event => {
		const { player, block } = event;
		const region = getBestRegion(block.location, block.dimension.id);

		if (
			region &&
			isTargetDenied(region.permission.blocks.interact, block.typeId) &&
			!hasBypass(player, region.bypass)
		) {
			event.cancel = true;
			sendDeniedMessage(player, "interact with this block");
		}
	});

	world.beforeEvents.playerInteractWithEntity?.subscribe(event => {
		const { player, target } = event;
		const region = getBestRegion(target.location, target.dimension.id);

		if (
			region &&
			isTargetDenied(
				region.permission.entities.interact,
				target.typeId
			) &&
			!hasBypass(player, region.bypass)
		) {
			event.cancel = true;
			sendDeniedMessage(player, "interact with this entity");
		}
	});

	world.beforeEvents.itemUse?.subscribe(event => {
		const { source, itemStack } = event;
		if (!source || !itemStack) return;

		const region = getBestRegion(source.location, source.dimension.id);

		if (
			region &&
			isTargetDenied(
				region.permission.items.interact,
				itemStack.typeId
			) &&
			!hasBypass(source, region.bypass)
		) {
			event.cancel = true;
			sendDeniedMessage(/** @type {Player} */ (source), "use this item");
		}
	});

	world.beforeEvents.entityItemPickup?.subscribe(event => {
		const { entity } = event;
		const region = getBestRegion(entity.location, entity.dimension.id);

		if (
			region &&
			region.permission.items.pickup === false &&
			!hasBypass(entity, region.bypass)
		) {
			event.cancel = true;
			sendDeniedMessage(/** @type {Player} */ (entity), "pickup items");
		}
	});

	world.beforeEvents.entityHurt?.subscribe(event => {
		const { hurtEntity, damageSource } = event;
		const damagingEntity = damageSource?.damagingEntity;

		if (
			hurtEntity?.typeId !== "minecraft:player" ||
			damagingEntity?.typeId !== "minecraft:player"
		) {
			return;
		}

		const attacker = /** @type {Player} */ (damagingEntity);
		const region = getBestRegion(
			hurtEntity.location,
			hurtEntity.dimension.id
		);

		if (
			region &&
			region.permission.pvp === false &&
			!hasBypass(attacker, region.bypass)
		) {
			event.cancel = true;
			sendDeniedMessage(attacker, "attack players");
		}
	});

	world.beforeEvents.explosion.subscribe(event => {
		const impactedBlocks =
			typeof event.getImpactedBlocks === "function"
				? event.getImpactedBlocks()
				: [];

		if (impactedBlocks.length === 0) return;

		/** @type {import("@minecraft/server").Block[]} */
		const filtered = [];

		for (const block of impactedBlocks) {
			const region = getBestRegion(block.location, block.dimension.id);

			if (region && region.permission.explosion === false) {
				continue;
			}

			filtered.push(block);
		}

		if (typeof event.setImpactedBlocks === "function") {
			event.setImpactedBlocks(filtered);
		}
	});

	world.afterEvents.entityItemDrop?.subscribe(event => {
		const entity = event.entity;
		if (!entity) return;

		const region = getBestRegion(entity.location, entity.dimension.id);

		if (
			region &&
			region.permission.items.drop === false &&
			!hasBypass(entity, region.bypass)
		) {
			const payload = /** @type {any} */ (event);
			const dropped =
				payload.itemEntity ?? payload.item ?? payload.droppedItem;

			if (dropped?.remove) dropped.remove();
			sendDeniedMessage(/** @type {Player} */ (entity), "drop items");
		}
	});

	world.afterEvents.entitySpawn?.subscribe(event => {
		const { entity } = event;
		if (!entity || entity.typeId === "minecraft:player") return;

		const region = getBestRegion(entity.location, entity.dimension.id);
		if (!region) return;

		const familyComponent = /** @type {any} */ (
			entity.getComponent("minecraft:type_family")
		);

		const isAnimal =
			typeof familyComponent?.hasTypeFamily === "function" &&
			familyComponent.hasTypeFamily("animal");

		const isMonster =
			typeof familyComponent?.hasTypeFamily === "function" &&
			familyComponent.hasTypeFamily("monster");

		const rules = region.permission.entities.spawn;
		if (
			(rules.animals === false && isAnimal) ||
			(rules.monster === false && isMonster)
		) {
			entity.remove();
		}
	});
});
