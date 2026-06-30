import { system, world } from "@minecraft/server";
import { registerCommand } from "../../core/registry/index.js";

/** @type {Map<string, boolean>} */
const rtpLock = new Map();

const MIN_RADIUS = 251;
const MAX_RADIUS = 500;
const TOP_Y = 319;
const BOTTOM_Y = -64;
const LOAD_DELAY_TICKS = 5;
const MAX_ATTEMPTS = 20;

const UNSAFE_BLOCKS = new Set([
	"minecraft:air",
	"minecraft:cave_air",
	"minecraft:void_air",
	"minecraft:water",
	"minecraft:flowing_water",
	"minecraft:lava",
	"minecraft:flowing_lava",
	"minecraft:fire",
	"minecraft:soul_fire",
	"minecraft:campfire",
	"minecraft:soul_campfire",
	"minecraft:magma_block",
	"minecraft:cactus",
	"minecraft:sweet_berry_bush",
	"minecraft:powder_snow",
	"minecraft:short_grass",
	"minecraft:tall_grass",
	"minecraft:fern",
	"minecraft:large_fern",
	"minecraft:torch",
	"minecraft:redstone_torch",
	"minecraft:soul_torch",
	"minecraft:lever",
	"minecraft:stone_button",
	"minecraft:oak_button",
	"minecraft:spruce_button",
	"minecraft:birch_button",
	"minecraft:jungle_button",
	"minecraft:acacia_button",
	"minecraft:dark_oak_button",
	"minecraft:mangrove_button",
	"minecraft:cherry_button",
	"minecraft:bamboo_button",
	"minecraft:pale_oak_button",
	"minecraft:pressure_plate",
	"minecraft:light_weighted_pressure_plate",
	"minecraft:heavy_weighted_pressure_plate",
	"minecraft:carpet",
	"minecraft:snow_layer",
	"minecraft:vine",
	"minecraft:glow_lichen",
	"minecraft:tripwire",
	"minecraft:sea_pickle",
	"minecraft:waterlily",
	"minecraft:door",
	"minecraft:trapdoor",
	"minecraft:sign",
	"minecraft:hanging_sign",
	"minecraft:banner",
	"minecraft:rail",
	"minecraft:ladder",
	"minecraft:fence_gate",
	"minecraft:portal"
]);

/**
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * @returns {{x: number, z: number}}
 */
function randomXZ() {
	while (true) {
		const x = randInt(-MAX_RADIUS, MAX_RADIUS);
		const z = randInt(-MAX_RADIUS, MAX_RADIUS);

		if (Math.max(Math.abs(x), Math.abs(z)) < MIN_RADIUS) continue;
		return { x, z };
	}
}

/**
 * @returns {{x: number, y: number, z: number}}
 */
function getWorldSpawn() {
	const anyWorld = /** @type {any} */ (world);

	if (typeof anyWorld.getDefaultSpawnLocation === "function") {
		const spawn = anyWorld.getDefaultSpawnLocation();
		return {
			x: Math.floor(Number(spawn?.x ?? 0)),
			y: Math.floor(Number(spawn?.y ?? 0)),
			z: Math.floor(Number(spawn?.z ?? 0))
		};
	}

	return { x: 0, y: 0, z: 0 };
}

/**
 * @param {string} value
 * @returns {string}
 */
function safeId(value) {
	return String(value ?? "")
		.replace(/[^a-zA-Z0-9_:-]/g, "_")
		.slice(0, 32);
}

/**
 * @param {string} blockId
 * @returns {boolean}
 */
function isUnsafeBlockId(blockId) {
	if (!blockId) return true;
	if (UNSAFE_BLOCKS.has(blockId)) return true;

	if (
		blockId.includes("door") ||
		blockId.includes("trapdoor") ||
		blockId.includes("button") ||
		blockId.includes("pressure_plate") ||
		blockId.includes("sign") ||
		blockId.includes("hanging_sign") ||
		blockId.includes("banner") ||
		blockId.includes("torch") ||
		blockId.includes("rail") ||
		blockId.includes("vine") ||
		blockId.includes("ladder") ||
		blockId.includes("fence_gate") ||
		blockId.includes("crop") ||
		blockId.includes("sapling") ||
		blockId.includes("flower") ||
		blockId.includes("mushroom") ||
		blockId.includes("coral") ||
		blockId.includes("bush") ||
		blockId.includes("leaf") ||
		blockId.includes("roots") ||
		blockId.includes("kelp") ||
		blockId.includes("seagrass") ||
		blockId.includes("dripleaf") ||
		blockId.includes("candle") ||
		blockId.includes("cake") ||
		blockId.includes("bed") ||
		blockId.includes("spawner") ||
		blockId.includes("portal") ||
		blockId.includes("slab") ||
		blockId.includes("stairs") ||
		blockId.includes("wall") ||
		blockId.includes("pane") ||
		blockId.includes("fence") ||
		blockId.includes("chain") ||
		blockId.includes("bars") ||
		blockId.includes("grate") ||
		blockId.includes("lantern")
	) {
		return true;
	}

	return false;
}

/**
 * @param {import("@minecraft/server").Block | undefined} block
 * @returns {boolean}
 */
function isValidStandBlock(block) {
	if (!block) return false;

	const typeId = block.typeId ?? "";
	if (isUnsafeBlockId(typeId)) return false;

	/** @type {any} */
	const anyBlock = block;
	if (typeof anyBlock.isAir === "boolean" && anyBlock.isAir) return false;
	if (typeof anyBlock.isLiquid === "boolean" && anyBlock.isLiquid)
		return false;

	return true;
}

/**
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {{x: number, y: number, z: number}} pos
 * @returns {boolean}
 */
function isAirLike(dimension, pos) {
	const block = dimension.getBlock(pos);
	if (!block) return true;

	const typeId = block.typeId ?? "";
	if (!typeId || isUnsafeBlockId(typeId)) return true;

	/** @type {any} */
	const anyBlock = block;
	if (typeof anyBlock.isAir === "boolean" && anyBlock.isAir) return true;
	if (typeof anyBlock.isLiquid === "boolean" && anyBlock.isLiquid)
		return true;

	return false;
}

/**
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {{x: number, z: number}} xz
 * @returns {{x: number, y: number, z: number} | null}
 */
function findSafeSurface(dimension, xz) {
	for (let y = TOP_Y; y >= BOTTOM_Y + 1; y--) {
		const ground = dimension.getBlock({ x: xz.x, y, z: xz.z });
		if (!isValidStandBlock(ground)) continue;

		if (!isAirLike(dimension, { x: xz.x, y: y + 1, z: xz.z })) continue;
		if (!isAirLike(dimension, { x: xz.x, y: y + 2, z: xz.z })) continue;

		return { x: xz.x + 0.5, y: y + 1, z: xz.z + 0.5 };
	}

	return null;
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} text
 */
function msg(player, text) {
	player.sendMessage(text);
}

/**
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {string} name
 */
function removeTickingAreaSafe(dimension, name) {
	try {
		dimension.runCommand(`tickingarea remove ${name}`);
	} catch {}
}

/**
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {string} name
 * @param {number} x
 * @param {number} z
 */
function addTickingAreaSafe(dimension, name, x, z) {
	dimension.runCommand(
		`tickingarea add ${x} ${BOTTOM_Y} ${z} ${x} ${TOP_Y} ${z} ${name}`
	);
}

/**
 * @param {import("@minecraft/server").Player} player
 */
function startRtp(player) {
	const key = player.name;

	if (rtpLock.get(key)) {
		msg(player, "§eRTP is already running...");
		return;
	}

	rtpLock.set(key, true);

	const overworld = world.getDimension("minecraft:overworld");
	const spawn = getWorldSpawn();
	const tickingName = `rtp_${safeId(player.name)}`;

	let attempt = 0;

	const cleanup = () => {
		removeTickingAreaSafe(overworld, tickingName);
		rtpLock.delete(key);
	};

	const step = () => {
		if (!player.isValid) {
			cleanup();
			return;
		}

		if (attempt >= MAX_ATTEMPTS) {
			msg(player, "§cFailed to find a safe RTP location.");
			cleanup();
			return;
		}

		attempt++;

		const offset = randomXZ();
		const x = spawn.x + offset.x;
		const z = spawn.z + offset.z;

		removeTickingAreaSafe(overworld, tickingName);

		try {
			addTickingAreaSafe(overworld, tickingName, x, z);
		} catch {
			system.runTimeout(step, 1);
			return;
		}

		system.runTimeout(() => {
			if (!player.isValid) {
				cleanup();
				return;
			}

			const chosen = findSafeSurface(overworld, { x, z });
			if (!chosen) {
				removeTickingAreaSafe(overworld, tickingName);
				system.runTimeout(step, 1);
				return;
			}

			try {
				player.teleport(chosen, { dimension: overworld });
				msg(
					player,
					`§aTeleported to §e${Math.floor(chosen.x)}, ${Math.floor(chosen.y)}, ${Math.floor(chosen.z)}§a.`
				);
			} catch (error) {
				msg(
					player,
					`§cRTP teleport error: ${String(error ?? "unknown")}`
				);
				cleanup();
				return;
			}

			system.runTimeout(() => {
				cleanup();
			}, 10);
		}, LOAD_DELAY_TICKS);
	};

	msg(player, "§7Searching safe location...");
	step();
}

registerCommand({
	name: "rtp",
	aliases: ["randomtp"],
	run: function (player) {
		startRtp(player);
	}
});
