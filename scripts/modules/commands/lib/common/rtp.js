import { system, world } from "@minecraft/server";
import { registerCommand } from "../../core/registry/index.js";

/**
 * @typedef {import("@minecraft/server").Player} Player
 * @typedef {import("@minecraft/server").Dimension} Dimension
 * @typedef {{x: number, y: number, z: number}} Vec3
 * @typedef {{x: number, z: number}} Vec2
 * @typedef {{x: number, z: number}} Origin2D
 */

/**
 * @typedef {Object} RtpProfile
 * @property {number} minDistance
 * @property {number} maxDistance
 * @property {number} topY
 * @property {number} bottomY
 * @property {number} scanStep
 * @property {(player: Player) => Origin2D} origin
 */

const rtpLock = new Set();

const COUNTDOWN_SECONDS = 5;
const MAX_ATTEMPTS = 20;
const CHUNK_READY_TIMEOUT_TICKS = 8;

const WATER_BLOCKS = new Set(["minecraft:water", "minecraft:flowing_water"]);

const UNSAFE_BLOCKS = new Set([
	"minecraft:air",
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

const UNSAFE_PATTERN_RE =
	/(door|trapdoor|button|pressure_plate|sign|hanging_sign|banner|torch|rail|vine|ladder|fence_gate|crop|sapling|mushroom|coral|bush|leaf|roots|kelp|seagrass|dripleaf|candle|cake|bed|spawner|portal|slab|stairs|wall|pane|fence|chain|bars|lantern)/i;

/** @type {Record<string, RtpProfile>} */
const RTP_PROFILES = {
	"minecraft:overworld": {
		minDistance: 251,
		maxDistance: 5000,
		topY: 319,
		bottomY: 0,
		scanStep: 8,
		origin: () => {
			const spawn = world.getDefaultSpawnLocation();
			return {
				x: Math.floor(Number(spawn?.x ?? 0)),
				z: Math.floor(Number(spawn?.z ?? 0))
			};
		}
	},
	"minecraft:nether": {
		minDistance: 150,
		maxDistance: 625,
		topY: 123,
		bottomY: 4,
		scanStep: 6,
		origin: player => ({
			x: Math.floor(Number(player.location.x ?? 0)),
			z: Math.floor(Number(player.location.z ?? 0))
		})
	},
	"minecraft:the_end": {
		minDistance: 500,
		maxDistance: 3000,
		topY: 319,
		bottomY: 0,
		scanStep: 8,
		origin: () => ({ x: 0, z: 0 })
	}
};

/**
 * @param {number} ticks
 * @returns {Promise<void>}
 */
function waitTicks(ticks) {
	return new Promise(resolve =>
		system.runTimeout(resolve, Math.max(0, ticks))
	);
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
 * @param {string} dimensionId
 * @returns {RtpProfile}
 */
function getRtpProfile(dimensionId) {
	return RTP_PROFILES[dimensionId] ?? RTP_PROFILES["minecraft:overworld"];
}

/**
 * Random point inside an annulus.
 * @param {number} minRadius
 * @param {number} maxRadius
 * @returns {Vec2}
 */
function randomXZ(minRadius, maxRadius) {
	const min2 = minRadius * minRadius;
	const max2 = maxRadius * maxRadius;
	const radius = Math.sqrt(Math.random() * (max2 - min2) + min2);
	const angle = Math.random() * Math.PI * 2;

	return {
		x: Math.round(Math.cos(angle) * radius),
		z: Math.round(Math.sin(angle) * radius)
	};
}

/**
 * @param {string} blockId
 * @returns {boolean}
 */
function isWaterBlockId(blockId) {
	return WATER_BLOCKS.has(blockId);
}

/**
 * @param {string} blockId
 * @returns {boolean}
 */
function isUnsafeBlockId(blockId) {
	if (!blockId) return true;
	if (UNSAFE_BLOCKS.has(blockId)) return true;
	return UNSAFE_PATTERN_RE.test(blockId);
}

/**
 * @param {import("@minecraft/server").Block | undefined} block
 * @returns {boolean}
 */
function isAirLikeBlock(block) {
	if (!block) return true;

	const typeId = String(block.typeId ?? "");
	if (!typeId) return true;

	/** @type {any} */
	const anyBlock = block;
	if (anyBlock.isAir === true) return true;
	if (anyBlock.isLiquid === true) return true;

	return isUnsafeBlockId(typeId);
}

/**
 * @param {import("@minecraft/server").Block | undefined} block
 * @returns {boolean}
 */
function isStandableBlock(block) {
	if (!block) return false;

	const typeId = String(block.typeId ?? "");
	if (!typeId) return false;
	if (isUnsafeBlockId(typeId)) return false;
	if (isWaterBlockId(typeId)) return false;

	/** @type {any} */
	const anyBlock = block;
	if (anyBlock.isAir === true) return false;
	if (anyBlock.isLiquid === true) return false;

	return true;
}

/**
 * @param {Dimension} dimension
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {boolean}
 */
function hasLoadedBlock(dimension, x, y, z) {
	return !!dimension.getBlock({ x, y, z });
}

/**
 * @param {Dimension} dimension
 * @param {number} x
 * @param {number} z
 * @param {number} topY
 * @param {number} bottomY
 * @returns {Promise<boolean>}
 */
async function waitForColumnReady(dimension, x, z, topY, bottomY) {
	for (let i = 0; i < CHUNK_READY_TIMEOUT_TICKS; i++) {
		if (
			hasLoadedBlock(dimension, x, topY, z) ||
			hasLoadedBlock(dimension, x, bottomY + 1, z)
		) {
			return true;
		}

		await waitTicks(1);
	}

	return (
		hasLoadedBlock(dimension, x, topY, z) ||
		hasLoadedBlock(dimension, x, bottomY + 1, z)
	);
}

/**
 * @param {Dimension} dimension
 * @param {Vec2} xz
 * @param {number} y
 * @returns {Vec3 | null}
 */
function tryLandSurfaceAtY(dimension, xz, y) {
	const block = dimension.getBlock({ x: xz.x, y, z: xz.z });
	if (!isStandableBlock(block)) return null;

	const above1 = dimension.getBlock({ x: xz.x, y: y + 1, z: xz.z });
	const above2 = dimension.getBlock({ x: xz.x, y: y + 2, z: xz.z });

	if (!isAirLikeBlock(above1)) return null;
	if (!isAirLikeBlock(above2)) return null;

	return {
		x: xz.x + 0.5,
		y: y + 1,
		z: xz.z + 0.5
	};
}

/**
 * @param {Dimension} dimension
 * @param {Vec2} xz
 * @param {number} y
 * @returns {Vec3 | null}
 */
function tryShallowWaterSurfaceAtY(dimension, xz, y) {
	const water = dimension.getBlock({ x: xz.x, y, z: xz.z });
	if (!water || !isWaterBlockId(String(water.typeId ?? ""))) return null;

	const below = dimension.getBlock({ x: xz.x, y: y - 1, z: xz.z });
	if (!isStandableBlock(below)) return null;
	if (below && isWaterBlockId(String(below.typeId ?? ""))) return null;

	const above1 = dimension.getBlock({ x: xz.x, y: y + 1, z: xz.z });
	const above2 = dimension.getBlock({ x: xz.x, y: y + 2, z: xz.z });

	if (!isAirLikeBlock(above1)) return null;
	if (!isAirLikeBlock(above2)) return null;

	return {
		x: xz.x + 0.5,
		y: y + 1,
		z: xz.z + 0.5
	};
}

/**
 * Fast coarse-to-fine surface search.
 * It avoids full top-to-bottom scans on every attempt.
 *
 * @param {Dimension} dimension
 * @param {Vec2} xz
 * @param {number} topY
 * @param {number} bottomY
 * @param {number} scanStep
 * @returns {Vec3 | null}
 */
function findSafeSurface(dimension, xz, topY, bottomY, scanStep) {
	for (let y = topY; y >= bottomY; y -= scanStep) {
		const block = dimension.getBlock({ x: xz.x, y, z: xz.z });
		if (!block) continue;

		const typeId = String(block.typeId ?? "");

		if (!typeId || isAirLikeBlock(block)) {
			continue;
		}

		if (isWaterBlockId(typeId)) {
			return tryShallowWaterSurfaceAtY(dimension, xz, y);
		}

		const bandTop = Math.min(topY, y + scanStep - 1);
		const bandBottom = Math.max(bottomY, y - scanStep + 1);

		for (let yy = bandTop; yy >= bandBottom; yy--) {
			const surface = tryLandSurfaceAtY(dimension, xz, yy);
			if (surface) return surface;

			const probe = dimension.getBlock({ x: xz.x, y: yy, z: xz.z });
			if (probe && isWaterBlockId(String(probe.typeId ?? ""))) {
				return tryShallowWaterSurfaceAtY(dimension, xz, yy);
			}
		}

		return null;
	}

	return null;
}

/**
 * @param {Player} player
 * @param {string} text
 * @returns {void}
 */
function showCountdownText(player, text) {
	try {
		player.sendMessage(text);
	} catch {}
}

/**
 * @param {Player} player
 * @param {number} seconds
 * @returns {Promise<void>}
 */
async function countdown(player, seconds) {
	for (let remaining = seconds; remaining > 0; remaining--) {
		if (!player.isValid) return;

		showCountdownText(
			player,
			`§aYou will be teleported in §e${remaining}§a...`
		);
		player.playSound("random.pop");
		await waitTicks(20);
	}
}

/**
 * @param {Dimension} dimension
 * @param {string} name
 * @returns {void}
 */
function removeTickingAreaSafe(dimension, name) {
	try {
		dimension.runCommand(`tickingarea remove ${name}`);
	} catch {}
}

/**
 * @param {Dimension} dimension
 * @param {string} name
 * @param {number} x
 * @param {number} z
 * @param {number} topY
 * @param {number} bottomY
 * @returns {void}
 */
function addTickingAreaSafe(dimension, name, x, z, topY, bottomY) {
	try {
		dimension.runCommand(
			`tickingarea add ${x} ${bottomY} ${z} ${x} ${topY} ${z} ${name}`
		);
	} catch {}
}

/**
 * @param {Player} player
 * @returns {Promise<void>}
 */
async function startRtp(player) {
	const key = player.name;

	if (rtpLock.has(key)) {
		player.sendMessage("§eRTP is already running...");
		return;
	}

	rtpLock.add(key);

	const dimension = player.dimension;
	const profile = getRtpProfile(dimension.id);
	const origin = profile.origin(player);
	const tickingName = `rtp_${safeId(player.name)}_${safeId(dimension.id)}`;

	let cleaned = false;

	/**
	 * @returns {void}
	 */
	const cleanup = () => {
		if (cleaned) return;
		cleaned = true;

		removeTickingAreaSafe(dimension, tickingName);
		rtpLock.delete(key);
	};

	try {
		player.sendMessage("§7Searching safe location...");

		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
			if (!player.isValid) return;

			const offset = randomXZ(profile.minDistance, profile.maxDistance);
			const x = Math.floor(origin.x + offset.x);
			const z = Math.floor(origin.z + offset.z);

			removeTickingAreaSafe(dimension, tickingName);
			addTickingAreaSafe(
				dimension,
				tickingName,
				x,
				z,
				profile.topY,
				profile.bottomY
			);

			const ready = await waitForColumnReady(
				dimension,
				x,
				z,
				profile.topY,
				profile.bottomY
			);

			if (!ready || !player.isValid) {
				removeTickingAreaSafe(dimension, tickingName);
				await waitTicks(1);
				continue;
			}

			const chosen = findSafeSurface(
				dimension,
				{ x, z },
				profile.topY,
				profile.bottomY,
				profile.scanStep
			);

			if (!chosen) {
				removeTickingAreaSafe(dimension, tickingName);
				await waitTicks(1);
				continue;
			}

			await countdown(player, COUNTDOWN_SECONDS);

			if (!player.isValid) return;

			try {
				player.teleport(chosen, { dimension });
				player.sendMessage(
					`§aTeleported to §e${Math.floor(chosen.x)}, ${Math.floor(chosen.y)}, ${Math.floor(chosen.z)}§a.`
				);
				player.runCommand("playsound random.levelup @s ~ ~ ~ 1 3");
			} catch (error) {
				player.sendMessage(
					`§cRTP teleport error: ${String(error ?? "unknown")}`
				);
			}

			await waitTicks(2);
			return;
		}

		player.sendMessage("§cFailed to find a safe RTP location.");
	} finally {
		cleanup();
	}
}

registerCommand({
	name: "rtp",
	aliases: ["randomtp"],
	async run(player) {
		await startRtp(player);
	}
});
