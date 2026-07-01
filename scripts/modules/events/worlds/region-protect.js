import { world, system, PlayerPermissionLevel } from "@minecraft/server";
import { configs } from "../../../core/configs.js";
import database from "../../../core/database.js";

/**
 * @typedef {import("@minecraft/server").Player} Player
 * @typedef {import("@minecraft/server").Entity} Entity
 * @typedef {import("@minecraft/server").Vector3} Vector3
 * @typedef {import("@minecraft/server").Container} Container
 * @typedef {import("@minecraft/server").EntityInventoryComponent} EntityInventoryComponent
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

/**
 * @typedef {Object} ActionLedger
 * @property {number} tick
 * @property {Set<string>} workflows
 * @property {boolean} alerted
 */

const REGION_DB_KEY = "region";

/** @type {any[]} */
const rawRegionConfigs = configs?.modules?.regionProtect;
/** @type {RegionProtectConfig[]} */
const regionConfigs = Array.isArray(rawRegionConfigs) ? rawRegionConfigs : [];

/** @type {Record<string, CompiledRegion[]>} */
const dimensionRegions = {
	"minecraft:overworld": [],
	"minecraft:nether": [],
	"minecraft:the_end": []
};

/** @type {Map<string, ActionLedger>} */
const actionLedger = new Map();

let booted = false;
let ready = false;

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
 * @returns {number}
 */
function getCurrentTick() {
	return Number(/** @type {any} */ (system).currentTick ?? 0);
}

/**
 * @param {Player} player
 * @returns {ActionLedger}
 */
function getLedger(player) {
	const tick = getCurrentTick();
	const current = actionLedger.get(player.name);

	if (!current || current.tick !== tick) {
		const next = {
			tick,
			workflows: new Set(),
			alerted: false
		};
		actionLedger.set(player.name, next);
		return next;
	}

	return current;
}

/**
 * @param {Player | Entity | undefined} entity
 * @param {RegionBypass} bypass
 * @returns {boolean}
 */
const hasBypass = (entity, bypass) => {
	if (!entity || !bypass || entity.typeId !== "minecraft:player")
		return false;

	const player = /** @type {Player} */ (entity);

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
 * @param {CompiledRegion} region
 * @param {Player | Entity | undefined} entity
 * @returns {boolean}
 */
const canBypass = (region, entity) => hasBypass(entity, region.bypass);

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
 * @param {Player | undefined} player
 * @param {string} action
 * @returns {void}
 */
function queueDeniedMessage(player, action) {
	if (!player) return;

	system.run(() => {
		if (!player.isValid) return;

		player.sendMessage(
			`§l§6> §r§cYou cannot §7${action} §cinside this region.`
		);
		player.playSound("note.bass");
	});
}

/**
 * @param {string} kind
 * @param {...(string | number)} parts
 * @returns {string}
 */
function makeWorkflowKey(kind, ...parts) {
	return [kind, ...parts].join("|");
}

/**
 * @param {Player} player
 * @param {string} workflowKey
 * @param {string} action
 * @returns {void}
 */
function notifyDenied(player, workflowKey, action) {
	const ledger = getLedger(player);

	if (ledger.workflows.has(workflowKey)) return;
	ledger.workflows.add(workflowKey);

	if (ledger.alerted) return;
	ledger.alerted = true;

	queueDeniedMessage(player, action);
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
 * @param {Player} player
 * @param {CompiledRegion} region
 * @param {string} targetId
 * @param {RegionTargetFilter | undefined} filter
 * @param {string} action
 * @param {string} workflowKey
 * @returns {boolean}
 */
function denyTargetInteraction(
	player,
	region,
	targetId,
	filter,
	action,
	workflowKey
) {
	if (canBypass(region, player)) return false;
	if (!isTargetDenied(filter, targetId)) return false;

	notifyDenied(player, workflowKey, action);
	return true;
}

/**
 * @param {unknown} payload
 * @returns {unknown[]}
 */
function collectItemPayloads(payload) {
	/** @type {unknown[]} */
	const out = [];

	if (Array.isArray(payload)) return payload;

	if (!payload || typeof payload !== "object") return out;

	const data = /** @type {any} */ (payload);

	if (Array.isArray(data.items)) out.push(...data.items);
	if (Array.isArray(data.itemEntities)) out.push(...data.itemEntities);

	for (const key of [
		"itemEntity",
		"item",
		"droppedItem",
		"itemStack",
		"stack"
	]) {
		if (data[key] != null) out.push(data[key]);
	}

	return out;
}

/**
 * @param {unknown} value
 * @returns {import("@minecraft/server").ItemStack | undefined}
 */
function extractItemStack(value) {
	if (!value || typeof value !== "object") return undefined;

	const anyValue = /** @type {any} */ (value);

	if (
		typeof anyValue.clone === "function" &&
		typeof anyValue.typeId === "string" &&
		typeof anyValue.amount === "number"
	) {
		return /** @type {import("@minecraft/server").ItemStack} */ (anyValue);
	}

	const stack =
		anyValue.itemStack ??
		anyValue.item ??
		anyValue.droppedItem ??
		anyValue.stack;

	if (
		stack &&
		typeof stack === "object" &&
		typeof stack.clone === "function" &&
		typeof stack.typeId === "string" &&
		typeof stack.amount === "number"
	) {
		return /** @type {import("@minecraft/server").ItemStack} */ (stack);
	}

	const itemComp = anyValue.getComponent?.("minecraft:item");
	const itemStack = itemComp?.itemStack;

	if (
		itemStack &&
		typeof itemStack.clone === "function" &&
		typeof itemStack.typeId === "string" &&
		typeof itemStack.amount === "number"
	) {
		return /** @type {import("@minecraft/server").ItemStack} */ (itemStack);
	}

	return undefined;
}

/**
 * @param {Container} container
 * @param {import("@minecraft/server").ItemStack} stack
 * @returns {boolean}
 */
function removeItemStackFromContainer(container, stack) {
	let remaining = stack.amount;

	for (let slot = 0; slot < container.size && remaining > 0; slot++) {
		const current = container.getItem(slot);
		if (!current || current.typeId !== stack.typeId) continue;

		const take = Math.min(current.amount, remaining);
		current.amount -= take;
		remaining -= take;

		if (current.amount <= 0) {
			container.setItem(slot, undefined);
		} else {
			container.setItem(slot, current);
		}
	}

	return remaining <= 0;
}

/**
 * @param {Player} player
 * @param {unknown} payload
 * @returns {void}
 */
function restorePickedUpItems(player, payload) {
	const inventory = /** @type {EntityInventoryComponent} */ (
		player.getComponent("minecraft:inventory")
	);
	const container = inventory?.container;
	if (!container) return;

	for (const raw of collectItemPayloads(payload)) {
		const stack = extractItemStack(raw);
		if (!stack) continue;

		const clone = stack.clone();

		if (!removeItemStackFromContainer(container, clone)) {
			continue;
		}

		const location = /** @type {any} */ (raw)?.location ?? player.location;

		try {
			player.dimension.spawnItem(clone, location);
		} catch {}
	}
}

/**
 * @param {Player} player
 * @param {unknown} payload
 * @returns {void}
 */
function restoreDroppedItems(player, payload) {
	const inventory = /** @type {EntityInventoryComponent} */ (
		player.getComponent("minecraft:inventory")
	);
	const container = inventory?.container;
	if (!container) return;

	const slot = player.selectedSlotIndex;

	for (const raw of collectItemPayloads(payload)) {
		if (
			raw &&
			typeof raw === "object" &&
			typeof (/** @type {any} */ (raw).remove) === "function"
		) {
			try {
				/** @type {any} */ (raw).remove();
			} catch {}
		}

		const stack = extractItemStack(raw);
		if (!stack) continue;

		const clone = stack.clone();
		const current = container.getItem(slot);

		if (!current) {
			container.setItem(slot, clone);
			continue;
		}

		if (current.typeId === clone.typeId) {
			current.amount = Math.min(
				current.amount + clone.amount,
				current.maxAmount
			);
			container.setItem(slot, current);
			continue;
		}

		container.addItem(clone);
	}
}

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

/**
 * @returns {void}
 */
function bindRegionProtectEvents() {
	world.beforeEvents.playerBreakBlock?.subscribe(event => {
		if (!ready) return;

		const { player, block } = event;
		const region = getBestRegion(block.location, block.dimension.id);
		if (!region) return;
		if (canBypass(region, player)) return;

		if (region.permission.blocks.break === false) {
			event.cancel = true;
			notifyDenied(
				player,
				makeWorkflowKey(
					"block.break",
					block.dimension.id,
					Math.floor(block.location.x),
					Math.floor(block.location.y),
					Math.floor(block.location.z)
				),
				"break blocks"
			);
		}
	});

	world.beforeEvents.playerPlaceBlock?.subscribe(event => {
		if (!ready) return;

		const { player, block } = event;
		const region = getBestRegion(block.location, block.dimension.id);
		if (!region) return;
		if (canBypass(region, player)) return;

		if (region.permission.blocks.place === false) {
			event.cancel = true;
			notifyDenied(
				player,
				makeWorkflowKey(
					"block.place",
					block.dimension.id,
					Math.floor(block.location.x),
					Math.floor(block.location.y),
					Math.floor(block.location.z)
				),
				"place blocks"
			);
		}
	});

	world.beforeEvents.playerInteractWithBlock?.subscribe(event => {
		if (!ready) return;

		const { player, block } = event;
		const region = getBestRegion(block.location, block.dimension.id);
		if (!region) return;

		if (
			denyTargetInteraction(
				player,
				region,
				block.typeId,
				region.permission.blocks.interact,
				"interact with this block",
				makeWorkflowKey(
					"block.interact",
					block.dimension.id,
					Math.floor(block.location.x),
					Math.floor(block.location.y),
					Math.floor(block.location.z),
					block.typeId
				)
			)
		) {
			event.cancel = true;
		}
	});

	world.beforeEvents.itemUse?.subscribe(event => {
		if (!ready) return;

		const { source, itemStack } = event;
		if (!source || source.typeId !== "minecraft:player" || !itemStack)
			return;

		const player = /** @type {Player} */ (source);
		const region = getBestRegion(player.location, player.dimension.id);
		if (!region) return;

		if (
			denyTargetInteraction(
				player,
				region,
				itemStack.typeId,
				region.permission.items.interact,
				"use this item",
				makeWorkflowKey(
					"item.use",
					player.dimension.id,
					Math.floor(player.location.x),
					Math.floor(player.location.y),
					Math.floor(player.location.z),
					itemStack.typeId
				)
			)
		) {
			event.cancel = true;
		}
	});

	world.beforeEvents.playerInteractWithEntity?.subscribe(event => {
		if (!ready) return;

		const { player, target } = event;
		const region = getBestRegion(target.location, target.dimension.id);
		if (!region) return;
		if (canBypass(region, player)) return;

		if (
			isTargetDenied(region.permission.entities.interact, target.typeId)
		) {
			event.cancel = true;
			notifyDenied(
				player,
				makeWorkflowKey(
					"entity.interact",
					target.dimension.id,
					Math.floor(target.location.x),
					Math.floor(target.location.y),
					Math.floor(target.location.z),
					target.typeId
				),
				"interact with this entity"
			);
		}
	});

	world.afterEvents.entityItemPickup?.subscribe(event => {
		if (!ready) return;

		const payload = /** @type {any} */ (event);
		const entity = payload.entity;
		if (!entity || entity.typeId !== "minecraft:player") return;

		const player = /** @type {Player} */ (entity);
		const region = getBestRegion(player.location, player.dimension.id);
		if (!region) return;
		if (canBypass(region, player)) return;

		if (region.permission.items.pickup === false) {
			restorePickedUpItems(
				player,
				payload.items ?? payload.itemStack ?? payload.item ?? payload
			);
		}
	});

	world.beforeEvents.entityHurt?.subscribe(event => {
		if (!ready) return;

		const { hurtEntity, damageSource } = event;
		if (!hurtEntity) return;

		const region = getBestRegion(
			hurtEntity.location,
			hurtEntity.dimension.id
		);
		if (!region || region.permission.pvp !== false) return;

		const attacker = damageSource?.damagingEntity;

		if (
			attacker?.typeId === "minecraft:player" &&
			canBypass(region, /** @type {Player} */ (attacker))
		) {
			return;
		}

		event.cancel = true;

		if (attacker?.typeId === "minecraft:player") {
			notifyDenied(
				/** @type {Player} */ (attacker),
				makeWorkflowKey(
					"entity.hurt",
					hurtEntity.dimension.id,
					Math.floor(hurtEntity.location.x),
					Math.floor(hurtEntity.location.y),
					Math.floor(hurtEntity.location.z)
				),
				"damage entities"
			);
		}
	});

	world.beforeEvents.explosion?.subscribe(event => {
		if (!ready) return;

		const impactedBlocks =
			typeof event.getImpactedBlocks === "function"
				? event.getImpactedBlocks()
				: [];

		if (impactedBlocks.length === 0) return;

		/** @type {import("@minecraft/server").Block[]} */
		const filtered = [];

		for (const block of impactedBlocks) {
			const region = getBestRegion(block.location, block.dimension.id);
			if (region && region.permission.explosion === false) continue;
			filtered.push(block);
		}

		if (typeof event.setImpactedBlocks === "function") {
			event.setImpactedBlocks(filtered);
		}
	});

	world.afterEvents.entityItemDrop?.subscribe(event => {
		if (!ready) return;

		const payload = /** @type {any} */ (event);
		const entity = payload.entity;
		if (!entity || entity.typeId !== "minecraft:player") return;

		const player = /** @type {Player} */ (entity);
		const region = getBestRegion(player.location, player.dimension.id);
		if (!region) return;
		if (canBypass(region, player)) return;

		if (region.permission.items.drop === false) {
			restoreDroppedItems(
				player,
				payload.items ??
					payload.itemEntity ??
					payload.item ??
					payload.droppedItem ??
					payload
			);
			notifyDenied(
				player,
				makeWorkflowKey(
					"item.drop",
					player.dimension.id,
					Math.floor(player.location.x),
					Math.floor(player.location.y),
					Math.floor(player.location.z)
				),
				"drop items"
			);
		}
	});

	world.afterEvents.entitySpawn?.subscribe(event => {
		if (!ready) return;

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
			try {
				entity.remove();
			} catch {}
		}
	});
}

bindRegionProtectEvents();

world.afterEvents.worldLoad.subscribe(() => {
	if (booted) return;
	booted = true;

	loadRegionProtect();
	ready = true;
});
