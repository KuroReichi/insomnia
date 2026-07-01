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
 * @property {(player: Player) => Origin2D} origin
 */

/** @type {Map<string, boolean>} */
const rtpLock = new Map();

const CHUNK_LOAD_DELAY_TICKS = 5;
const COUNTDOWN_SECONDS = 5;
const MAX_ATTEMPTS = 20;

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

const UNSAFE_PATTERNS = [
	"door",
	"trapdoor",
	"button",
	"pressure_plate",
	"sign",
	"hanging_sign",
	"banner",
	"torch",
	"rail",
	"vine",
	"ladder",
	"fence_gate",
	"crop",
	"sapling",
	"mushroom",
	"coral",
	"bush",
	"leaf",
	"roots",
	"kelp",
	"seagrass",
	"dripleaf",
	"candle",
	"cake",
	"bed",
	"spawner",
	"portal",
	"slab",
	"stairs",
	"wall",
	"pane",
	"fence",
	"chain",
	"bars",
	"lantern"
];

/** @type {Record<string, RtpProfile>} */
const RTP_PROFILES = {
	"minecraft:overworld": {
		minDistance: 251,
		maxDistance: 1000,
		topY: 319,
		bottomY: 0,
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
		maxDistance: 600,
		topY: 123,
		bottomY: 4,
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
		origin: () => ({ x: 0, z: 0 })
	}
};

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
 * Random point inside an annulus, efficiently.
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
function isUnsafeBlockId(blockId) {
	if (!blockId) return true;
	if (UNSAFE_BLOCKS.has(blockId)) return true;
	if (WATER_BLOCKS.has(blockId)) return true;

	for (const pattern of UNSAFE_PATTERNS) {
		if (blockId.includes(pattern)) return true;
	}

	return false;
}

/**
 * @param {string} blockId
 * @returns {boolean}
 */
function isWaterBlockId(blockId) {
	return WATER_BLOCKS.has(blockId);
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
 * @param {Dimension} dimension
 * @param {Vec3} pos
 * @returns {boolean}
 */
function isAirLike(dimension, pos) {
	const block = dimension.getBlock(pos);
	if (!block) return true;

	const typeId = block.typeId ?? "";
	if (!typeId) return true;
	if (isUnsafeBlockId(typeId)) return true;

	/** @type {any} */
	const anyBlock = block;
	if (typeof anyBlock.isAir === "boolean" && anyBlock.isAir) return true;
	if (typeof anyBlock.isLiquid === "boolean" && anyBlock.isLiquid)
		return true;

	return false;
}

/**
 * @param {Dimension} dimension
 * @param {Vec2} xz
 * @param {number} topY
 * @param {number} bottomY
 * @returns {Vec3 | null}
 */
function findSafeSurface(dimension, xz, topY, bottomY) {
	for (let y = topY; y >= bottomY; y--) {
		const block = dimension.getBlock({ x: xz.x, y, z: xz.z });
		if (!block) continue;

		const typeId = block.typeId ?? "";
		if (!typeId) continue;

		/**
		 * Shallow water rule:
		 * - depth 1 => allowed if block below is solid
		 * - depth 2+ => reject column
		 */
		if (isWaterBlockId(typeId)) {
			let depth = 1;

			for (let ny = y - 1; ny >= bottomY; ny--) {
				const lower = dimension.getBlock({ x: xz.x, y: ny, z: xz.z });
				if (!lower || !isWaterBlockId(lower.typeId ?? "")) break;
				depth++;
				if (depth > 1) return null;
			}

			const below = dimension.getBlock({ x: xz.x, y: y - 1, z: xz.z });
			if (!isValidStandBlock(below)) return null;
			if (!isAirLike(dimension, { x: xz.x, y: y + 1, z: xz.z }))
				return null;
			if (!isAirLike(dimension, { x: xz.x, y: y + 2, z: xz.z }))
				return null;

			return {
				x: xz.x + 0.5,
				y: y + 1,
				z: xz.z + 0.5
			};
		}

		if (!isValidStandBlock(block)) continue;
		if (!isAirLike(dimension, { x: xz.x, y: y + 1, z: xz.z })) continue;
		if (!isAirLike(dimension, { x: xz.x, y: y + 2, z: xz.z })) continue;

		return {
			x: xz.x + 0.5,
			y: y + 1,
			z: xz.z + 0.5
		};
	}

	return null;
}

/**
 * @param {Player} player
 * @param {string} text
 * @returns {void}
 */
function showCountdownText(player, text) {
	/** @type {any} */
	const display = player.sendMessage;

	if (typeof display === "function") {
		try {
			display(text);
			return;
		} catch {}
	}
}

/**
 * @param {Player} player
 * @param {number} seconds
 * @returns {Promise<void>}
 */
function countdown(player, seconds) {
	return new Promise(resolve => {
		let remaining = seconds + 1;

		const tick = () => {
			if (!player.isValid) {
				resolve();
				return;
			}

			if (remaining <= 0) {
				resolve();
				return;
			}

			remaining--;
			showCountdownText(
				player,
				`§aYou will be teleported in §e${remaining}`
			);
			player.playSound("random.pop");

			system.runTimeout(tick, 20);
		};

		tick();
	});
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
 * @returns {void}
 */
function startRtp(player) {
	const key = player.name;

	if (rtpLock.get(key)) {
		player.sendMessage("§eRTP is already running...");
		return;
	}

	rtpLock.set(key, true);

	const dimension = player.dimension;
	const profile = getRtpProfile(dimension.id);
	const origin = profile.origin(player);
	const tickingName = `rtp_${safeId(player.name)}`;

	let attempt = 0;
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

	/**
	 * @returns {void}
	 */
	const step = () => {
		if (!player.isValid) {
			cleanup();
			return;
		}

		if (attempt >= MAX_ATTEMPTS) {
			player.sendMessage("§cFailed to find a safe RTP location.");
			cleanup();
			return;
		}

		attempt++;

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

		system.runTimeout(() => {
			if (!player.isValid) {
				cleanup();
				return;
			}

			const chosen = findSafeSurface(
				dimension,
				{ x, z },
				profile.topY,
				profile.bottomY
			);

			if (!chosen) {
				removeTickingAreaSafe(dimension, tickingName);
				system.runTimeout(step, 1);
				return;
			}

			countdown(player, COUNTDOWN_SECONDS).then(() => {
				if (!player.isValid) {
					cleanup();
					return;
				}

				try {
					player.teleport(chosen, { dimension });
					player.sendMessage(
						`§aTeleported to §e${Math.floor(chosen.x)}, ${Math.floor(chosen.y)}, ${Math.floor(chosen.z)}§a.`
					);
					player.runCommand("playsound random.levelup @s ~~~ 1 3");
				} catch (error) {
					player.sendMessage(
						`§cRTP teleport error: ${String(error ?? "unknown")}`
					);
				}

				system.runTimeout(() => {
					cleanup();
				}, 10);
			});
		}, CHUNK_LOAD_DELAY_TICKS);
	};

	player.sendMessage("§7Searching safe location...");
	step();
}

registerCommand({
	name: "rtp",
	aliases: ["randomtp"],
	run(player) {
		startRtp(player);
	}
});
