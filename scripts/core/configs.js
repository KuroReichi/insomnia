import { MinecraftDimensionTypes } from "@minecraft/vanilla-data";

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
				/** @type {MinecraftDimensionTypes} */
				dimension: MinecraftDimensionTypes.Overworld,
				data: {
					/** @type {"point"|"radius"} */
					type: "radius",
					/** @type {string|{center:Vector2,radius:number}} */
					value: {
						center: "spawn",
						radius: 500
					},
					/** Controls permissions of player interaction */
					permission: {
						/**
						 * @type {boolean}
						 * Controls is player can attack any entities inside the region.
						 */
						pvp: false,
						/**
						 * @type {{break:boolean,place:boolean}}
						 * Controls is player can break or place a block inside region.
						 */
						blocks: {
							break: false,
							place: false
						},
						items: {
							pickup: true,
							drop: true
						},
						/** @description */
						entities: {
							animals: false,
							monster: false
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
