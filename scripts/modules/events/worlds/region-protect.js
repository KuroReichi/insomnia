import { world, PlayerPermissionLevel } from "@minecraft/server";
import {
	MinecraftDimensionTypes,
	MinecraftEntityTypes
} from "@minecraft/vanilla-data";
import { configs } from "../../../core/configs.js";
import database from "../../../core/database.js";

/**
 * @typedef {import("@minecraft/server").Player} Player
 * @typedef {import("@minecraft/server").Block} Block
 * @typedef {import("@minecraft/server").Entity} Entity
 * @typedef {import("@minecraft/server").Vector3} Vector3
 * @typedef {import("@minecraft/server").Dimension} Dimension
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
 * @property {Vector3} [point]
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
	[MinecraftDimensionTypes.Overworld]: [],
	[MinecraftDimensionTypes.Nether]: [],
	[MinecraftDimensionTypes.TheEnd]: []
};

let booted = false;

/**
 * @param {unknown} value
 * @returns {string}
 */
const str = value => String(value ?? "").trim();

/**
 * Digunakan untuk fallback jika configs memiliki id dimensi kustom,
 * dan memastikan penulisan identik dengan vanilla-data.
 * @param {string} value
 * @returns {string}
 */
const normalizeDimensionId = value => {
	const raw = str(value).toLowerCase();
	if (raw.includes("nether")) return MinecraftDimensionTypes.Nether;
	if (raw.includes("end")) return MinecraftDimensionTypes.TheEnd;
	if (!raw || raw.includes("overworld"))
		return MinecraftDimensionTypes.Overworld;
	return raw;
};

/**
 * @param {Player | Entity | undefined} entity
 * @param {RegionBypass} bypass
 * @returns {boolean}
 */
const hasBypass = (entity, bypass) => {
	if (!entity || !bypass) return false;

	// Integrasi dengan namespace "@minecraft/vanilla-data"
	if (entity.typeId !== MinecraftEntityTypes.Player) return false;

	// Casting eksplisit ke Player API
	const player = /** @type {Player} */ (/** @type {unknown} */ (entity));

	// Membaca property `playerPermissionLevel` seperti dokumentasi Bedrock Scripting modern
	if (
		bypass.operator &&
		(player.playerPermissionLevel === PlayerPermissionLevel.Operator ||
			player.playerPermissionLevel === PlayerPermissionLevel.Custom)
	) {
		return true;
	}

	if (bypass.gamertags.length > 0 && bypass.gamertags.includes(player.name)) {
		return true;
	}

	if (bypass.tags.length > 0 && bypass.tags.some(tag => player.hasTag(tag))) {
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
	if (!filter || !Array.isArray(filter.list) || filter.list.length === 0)
		return false;
	const matched = filter.list.includes(targetId);
	return filter.type === "whitelist" ? !matched : matched;
};

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
		)
			return null;

		return {
			id: str(data.id),
			dimensionId,
			enabled: data.enabled !== false,
			priority,
			bypass,
			type: "radius",
			center: { x: center.x, z: center.z },
			radius,
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
		)
			return null;

		return {
			id: str(data.id),
			dimensionId,
			enabled: data.enabled !== false,
			priority,
			bypass,
			type: "point",
			point: { x: pt.x, y: pt.y, z: pt.z },
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

	// Evaluasi titik 3D murni menggunakan native JS (Lebih ringan & independen tanpa module)
	if (region.type === "point" && region.point) {
		return (
			Math.floor(location.x) === Math.floor(region.point.x) &&
			Math.floor(location.y) === Math.floor(region.point.y) &&
			Math.floor(location.z) === Math.floor(region.point.z)
		);
	}

	// Evaluasi silindris radius 2D murni (Native pythagoras)
	if (
		region.type === "radius" &&
		region.center &&
		region.radius !== undefined
	) {
		const dx = location.x - region.center.x;
		const dz = location.z - region.center.z;
		return dx * dx + dz * dz <= region.radius * region.radius;
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
		if (!dimensionRegions[region.dimensionId])
			dimensionRegions[region.dimensionId] = [];
		dimensionRegions[region.dimensionId].push(region);
	}

	const existingEntries = database.getAllBy(REGION_DB_KEY);
	if (existingEntries && Array.isArray(existingEntries)) {
		for (const entry of existingEntries)
			database.delete(entry.id, REGION_DB_KEY);
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
		}
	});

	world.beforeEvents.entityHurt?.subscribe(event => {
		const { hurtEntity, damageSource } = event;
		const damagingEntity = damageSource?.damagingEntity;

		if (
			hurtEntity?.typeId !== MinecraftEntityTypes.Player ||
			damagingEntity?.typeId !== MinecraftEntityTypes.Player
		)
			return;

		const region = getBestRegion(
			hurtEntity.location,
			hurtEntity.dimension.id
		);
		if (region && region.permission.pvp === false) {
			event.cancel = true;
		}
	});

	world.beforeEvents.explosion?.subscribe(event => {
		const impactedBlocks =
			typeof event.getImpactedBlocks === "function"
				? event.getImpactedBlocks()
				: [];
		if (impactedBlocks.length === 0) return;

		const dimensionId = event.dimension.id;
		const regions = dimensionRegions[normalizeDimensionId(dimensionId)];
		if (!regions || regions.length === 0) return;

		for (const block of impactedBlocks) {
			const region = getBestRegion(block.location, dimensionId);
			if (region && region.permission.explosion === false) {
				event.cancel = true;
				return;
			}
		}
	});

	world.afterEvents.entityItemDrop?.subscribe(event => {
		const { entity } = event;
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
		}
	});

	world.afterEvents.entitySpawn?.subscribe(event => {
		const { entity } = event;
		if (!entity || entity.typeId === MinecraftEntityTypes.Player) return;

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
