import { world } from "@minecraft/server";

/** Radius spawn protect in blocks. */
const SPAWN_PROTECT_RADIUS = 500;
/** Squared radius to avoid sqrt every check. */
const SPAWN_PROTECT_RADIUS_SQ = SPAWN_PROTECT_RADIUS * SPAWN_PROTECT_RADIUS;
/** Default spawn point reference (Overworld). */
const SPAWN = world.getDefaultSpawnLocation();

/**
 * Checks whether a 3D position is inside the spawn protection area.
 *
 * Spawn protection is centered on the world's default spawn location.
 * The check uses squared distance for performance.
 *
 * @param {{x:number,y:number,z:number}} location
 * @returns {boolean}
 */
function isInsideSpawnProtect(location) {
	const dx = location.x - SPAWN.x;
	const dy = location.y - SPAWN.y;
	const dz = location.z - SPAWN.z;
	return dx * dx + dy * dy + dz * dz <= SPAWN_PROTECT_RADIUS_SQ;
}

/**
 * Gets the target block location for a place event.
 * Uses faceLocation because place-before events expose the clicked face position.
 *
 * @param {import("@minecraft/server").PlayerPlaceBlockBeforeEvent} event
 * @returns {{x:number,y:number,z:number}}
 */
function getPlaceTargetLocation(event) {
	return {
		x: event.block.location.x + event.faceLocation.x,
		y: event.block.location.y + event.faceLocation.y,
		z: event.block.location.z + event.faceLocation.z
	};
}

/**
 * Returns whether a player action should be blocked by spawn protection.
 *
 * Only the Overworld is protected here because the default spawn location is an Overworld spawn.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {{x:number,y:number,z:number}} location
 * @returns {boolean}
 */
function shouldBlock(player, location) {
	return player.dimension.id === "minecraft:overworld" && isInsideSpawnProtect(location);
}

/**
 * Cancels block placement inside spawn protection.
 *
 * @param {import("@minecraft/server").PlayerPlaceBlockBeforeEvent} event
 */
function onPlayerPlaceBlock(event) {
	if (shouldBlock(event.player, getPlaceTargetLocation(event))) {
		event.cancel = true;
	}
}

/**
 * Cancels block breaking inside spawn protection.
 *
 * @param {import("@minecraft/server").PlayerBreakBlockBeforeEvent} event
 */
function onPlayerBreakBlock(event) {
	if (shouldBlock(event.player, event.block.location)) {
		event.cancel = true;
	}
}

/**
 * Cancels all incoming damage to players inside spawn protection.
 *
 * @param {import("@minecraft/server").EntityHurtBeforeEvent} event
 */
function onEntityHurt(event) {
	const entity = event.hurtEntity;
	if (entity?.typeId !== "minecraft:player") return;
	if (shouldBlock(entity, entity.location)) {
		event.cancel = true;
	}
}

world.beforeEvents.playerPlaceBlock.subscribe(onPlayerPlaceBlock);
world.beforeEvents.playerBreakBlock.subscribe(onPlayerBreakBlock);
world.beforeEvents.entityHurt.subscribe(onEntityHurt);
