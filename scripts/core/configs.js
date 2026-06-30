/**
 * @typedef {Object} RegionTargetFilter
 * @property {"blacklist" | "whitelist"} type
 * @property {(BlockTypeIDs | EntityTypeIDs | ItemTypeIDs)[]} list
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
 * @property {DimensionTypeIDs} dimension
 * @property {RegionData} data
 */

export const configs = {
	commandPrefix: "!",
	server: {
		name: "Insomnia Lifesteal",
		subname: undefined,
		founder: "KuroReichii",
		license: "MIT",
		production: "Legiun Studio"
	},
	modules: {
		realtime: {
			enabled: true,
			timezone: "Asia/Jakarta"
		},
		regionProtect: [
			{
				/** @type {DimensionTypeIDs} */
				dimension: "minecraft:overworld",
				data: {
					id: "insomnia.spawn",
					enabled: true,
					priority: 100,
					bypass: {
						operator: false,
						tags: [],
						gamertags: ["KuroReichii", "HikariKurumi"]
					},
					type: "radius",
					value: {
						center: "spawn",
						radius: 250
					},
					permission: {
						pvp: false,
						explosion: false,
						blocks: {
							break: false,
							place: false,
							interact: {
								type: "whitelist",
								/** @type {BlockTypeIDs[]} */
								list: [
									"minecraft:ender_chest",
									"minecraft:enchanting_table"
								]
							}
						},
						entities: {
							spawn: {
								animals: false,
								monster: false
							},
							interact: {
								type: "whitelist",
								/** @type {EntityTypeIDs[]} */
								list: ["minecraft:npc"]
							}
						},
						items: {
							pickup: false,
							drop: false,
							interact: {
								type: "whitelist",
								/** @type {ItemTypeIDs[]} */
								list: ["minecraft:ender_pearl"]
							}
						}
					}
				}
			}
		],
		economy: {
			currency: "$",
			default: 10000
		},
		bounty: {
			min: 1000
		}
	}
};
