import { Player } from "@minecraft/server";
import { registerCommand } from "../../core/registry/index.js";
import { helpCommand } from "../common/help.js";

/**
 * Represents the naming structure of a Familia.
 * @typedef {Object} FamiliaName
 * @property {string} abbreviation - Max 5 characters (Reusable by other players).
 * @property {string} fullName - Max 28 characters (Must be unique to 1 Familia).
 */

/**
 * Represents the relational ties between Familias.
 * @typedef {Object} FamiliaRelations
 * @property {string} uid - The 2048-bit UID of the target Familia.
 * @property {"ally" | "enemy" | "neutral"} type - The type of relationship.
 * @property {number} since - Timestamp of relation establishment.
 */

/**
 * Represents the core data and metadata of a Familia.
 * @typedef {Object} FamiliaData
 * @property {string} description - The description of the Familia.
 * @property {string[]} tags - Searchable tags associated with the Familia.
 * @property {string} motd - Message of the Day.
 * @property {string} uid - Unique 2048-bit identifier.
 * @property {string} founder - Founder's name or identifier.
 * @property {boolean} open - Whether the Familia is open to public joins.
 * @property {number} since - Timestamp of creation (`new Date().valueOf()`).
 * @property {FamiliaRelations[]} relations - Associated relationships with other Familias.

 */

/**
 * Represents a player's data within a Familia.
 * @typedef {Object} FamiliaPlayerData
 * @property {string} uid - The UID of the Familia they belong to.
 * @property {"member" | "officer" | "co-leader" | "agent"} rank - The player's assigned rank.
 * @property {string} title - Custom title given to the player.
 * @property {number} power - The total value accumulated from members' contribution power.
 * @property {number} since - Timestamp of when the player joined.
 */

/**
 * Represents the Familia state of a player.
 * Stored to Player database: `database.set("familia", {FamiliaPlayer}, player.name)`
 * @typedef {Object} FamiliaPlayer
 * @property {boolean} haveFamilia - Indicates if the player is currently in a Familia.
 * @property {FamiliaPlayerData | null} data - Detailed data if the player is in a Familia.
 */

/**
 * Context for:
 * /familia create <abbreviation:string> <full:string>
 * @typedef {Object} FamiliaCreateContext
 * @property {string} abbreviation
 * @property {string} full
 */

/**
 * Context for:
 * /familia join <faction:string>
 * @typedef {Object} FamiliaJoinContext
 * @property {string} faction
 */

/**
 * Context for:
 * /familia chat mode <mode:"familia"|"ally"|"public">
 * @typedef {Object} FamiliaChatModeContext
 * @property {"familia" | "ally" | "public"} mode
 */

/**
 * Context for:
 * /familia invite <player:player>
 * @typedef {Object} FamiliaInviteContext
 * @property {Player} player
 */

/**
 * Context for:
 * /familia kick <player:player>
 * @typedef {Object} FamiliaKickContext
 * @property {Player} player
 */

/**
 * Context for:
 * /familia setrank <player:player> <rank:"member"|"officer"|"co-leader"|"agent">
 * @typedef {Object} FamiliaSetRankContext
 * @property {Player} player
 * @property {"member" | "officer" | "co-leader" | "agent"} rank
 */

/**
 * Context for:
 * /familia title <player:player> <title:string>
 * @typedef {Object} FamiliaTitleContext
 * @property {Player} player
 * @property {string} title
 */

/**
 * Context for:
 * /familia setname abbreviation <name:string>
 * /familia setname fullname <name:string>
 * @typedef {Object} FamiliaSetNameContext
 * @property {string} name
 */

/**
 * Context for:
 * /familia motd <motd:string>
 * @typedef {Object} FamiliaMotdContext
 * @property {string} motd
 */

/**
 * Context for:
 * /familia disband <confirm:"confirm"|"cancel">
 * @typedef {Object} FamiliaDisbandContext
 * @property {"confirm" | "cancel"} confirm
 */

/**
 * Context for:
 * /familia help <command:string>
 * @typedef {Object} FamiliaHelpContext
 * @property {string} command
 */

export class Familia {
	/**
	 * Contains predefined error handlers for commands.
	 */
	static error = {
		/**
		 * Handles missing or invalid arguments dynamically.
		 * @param {Player} player
		 * @param {import("../../core/registry").CommandContext} _context
		 * @returns {void}
		 */
		argument: (player, _context) => {
			player.sendMessage("§cInvalid or missing arguments. Type §e/familia help§c for proper command usage.");
			player.playSound("note.bass");
		}
	};

	/**
	 * Contains teleportation logic handlers for Familia bases.
	 */
	static teleport = {
		/**
		 * Teleports the player to the Familia base.
		 * @param {Player} player
		 * @param {import("../../core/registry").CommandContext} _context
		 * @returns {void}
		 */
		home: (player, _context) => {
			player.sendMessage("§aTeleporting to your Familia home...");
		},

		/**
		 * Sets the Familia base location to the player's current position.
		 * @param {Player} player
		 * @param {import("../../core/registry").CommandContext} _context
		 * @returns {void}
		 */
		sethome: (player, _context) => {
			player.sendMessage("§aSuccessfully updated the Familia home location.");
			// Database update log
		}
	};

	/**
	 * Handles the creation of a new Familia.
	 * @param {Player} player
	 * @param {FamiliaCreateContext} context
	 * @returns {void}
	 */
	static create(player, context) {
		const { abbreviation, full } = context;

		if (!abbreviation || !full) {
			return Familia.error.argument(player, context);
		}

		if (abbreviation.length > 5) {
			player.sendMessage("§cAbbreviation must be at most §e5 characters§c.");
			return;
		}

		if (full.length > 28) {
			player.sendMessage("§cFull name must be at most §e28 characters§c.");
			return;
		}

		player.sendMessage(`§aSuccessfully founded the Familia: §e${full} §7[${abbreviation}]`);
		// Generate UID and store to DB logic here
	}

	/**
	 * Requests to join an existing Familia.
	 * @param {Player} player
	 * @param {FamiliaJoinContext} context
	 * @returns {void}
	 */
	static join(player, context) {
		if (!context.faction) return Familia.error.argument(player, context);
		player.sendMessage(`§eRequest sent to join §a${context.faction}§e. Waiting for approval...`);
	}

	/**
	 * Leaves the current Familia.
	 * @param {Player} player
	 * @param {import("../../core/registry").CommandContext} _context
	 * @returns {void}
	 */
	static leave(player, _context) {
		player.sendMessage("§eYou have successfully left your Familia.");
	}

	/**
	 * Switches the active chat channel.
	 * @param {Player} player
	 * @param {FamiliaChatModeContext} context
	 * @returns {void}
	 */
	static chat_mode(player, context) {
		if (!context.mode) return Familia.error.argument(player, context);
		player.sendMessage(`§aChat channel switched to: §e${context.mode}`);
	}

	/**
	 * Toggles between available chat channels sequentially.
	 * @param {Player} player
	 * @param {import("../../core/registry").CommandContext} _context
	 * @returns {void}
	 */
	static chat_toggle(player, _context) {
		player.sendMessage("§aToggled active chat channel.");
	}

	/**
	 * Invites a player to the Familia.
	 * @param {Player} player
	 * @param {FamiliaInviteContext} context
	 * @returns {void}
	 */
	static invite(player, context) {
		if (!context.player) return Familia.error.argument(player, context);
		player.sendMessage(`§aSuccessfully invited §e${context.player.name}§a to the Familia.`);
		context.player.sendMessage(`§eYou have been invited to join §a${player.name}'s§e Familia.`);
	}

	/**
	 * Kicks a player from the Familia.
	 * @param {Player} player
	 * @param {FamiliaKickContext} context
	 * @returns {void}
	 */
	static kick(player, context) {
		if (!context.player) return Familia.error.argument(player, context);
		player.sendMessage(`§e${context.player.name} §chas been kicked from the Familia.`);
		context.player.sendMessage(`§cYou have been kicked from §e${player.name}'s§c Familia.`);
	}

	/**
	 * Sets a specific rank for a Familia member.
	 * @param {Player} player
	 * @param {FamiliaSetRankContext} context
	 * @returns {void}
	 */
	static setrank(player, context) {
		if (!context.player || !context.rank) return Familia.error.argument(player, context);
		player.sendMessage(`§aUpdated §e${context.player.name}'s§a rank to §e${context.rank}§a.`);
	}

	/**
	 * Promotes a member to the next rank tier.
	 * @param {Player} player
	 * @param {FamiliaKickContext} context
	 * @returns {void}
	 */
	static promote(player, context) {
		if (!context.player) return Familia.error.argument(player, context);
		player.sendMessage(`§aSuccessfully promoted §e${context.player.name}§a.`);
	}

	/**
	 * Demotes a member to the previous rank tier.
	 * @param {Player} player
	 * @param {FamiliaKickContext} context
	 * @returns {void}
	 */
	static demote(player, context) {
		if (!context.player) return Familia.error.argument(player, context);
		player.sendMessage(`§cDemoted §e${context.player.name}§c.`);
	}

	/**
	 * Assigns a custom cosmetic title to a member.
	 * @function setTitle
	 * @param {Player} player
	 * @param {FamiliaTitleContext} context
	 * @returns {void}
	 */
	static setTitle(player, context) {
		if (!context.player || !context.title) return Familia.error.argument(player, context);
		player.sendMessage(`§aAssigned the title '§r${context.title}§a' to §e${context.player.name}§a.`);
	}

	/**
	 * Updates the Familia's 5-character abbreviation.
	 * @param {Player} player
	 * @param {FamiliaSetNameContext} context
	 * @returns {void}
	 */
	static setAbbreviation(player, context) {
		if (!context.name) return Familia.error.argument(player, context);
		player.sendMessage(`§aFamilia abbreviation has been updated to: §e${context.name}`);
	}

	/**
	 * Updates the Familia's full name.
	 * @param {Player} player
	 * @param {FamiliaSetNameContext} context
	 * @returns {void}
	 */
	static setFullname(player, context) {
		if (!context.name) return Familia.error.argument(player, context);
		player.sendMessage(`§aFamilia name has been updated to: §e${context.name}`);
	}

	/**
	 * Updates the Message of the Day (MOTD).
	 * @param {Player} player
	 * @param {FamiliaMotdContext} context
	 * @returns {void}
	 */
	static motd(player, context) {
		if (!context.motd) return Familia.error.argument(player, context);
		player.sendMessage(`§aFamilia MOTD updated to:\n§r${context.motd}`);
	}

	/**
	 * Handles Familia disbandment procedures.
	 * @param {Player} player
	 * @param {FamiliaDisbandContext} context
	 * @returns {void}
	 */
	static disband(player, context) {
		if (context.confirm === "confirm") {
			player.sendMessage("§cThe Familia has been officially disbanded.");
		} else if (context.confirm === "cancel") {
			player.sendMessage("§aDisbandment process cancelled.");
		} else {
			player.sendMessage("§eAre you sure you want to disband the Familia? Type §c/familia disband confirm§e to proceed.");
		}
	}

	/**
	 * Displays help documentation for Familia commands.
	 * @param {Player} player
	 * @param {FamiliaHelpContext} context
	 * @returns {void}
	 */
	static help(player, context) {
		if (!context.command) {
			player.sendMessage({
				text: "§c",
				translate: "command"
			});
		}
	}

	/**
	 * Initializes and registers the Familia command structure.
	 */
	constructor() {
		/** @type {import("../../core/registry").Command} */
		const structure = {
			name: "familia",
			aliases: ["fam", "f"],
			description: "Manage your Familia, allies, and relations.",
			run:
				/** @type {import("../../core/registry").CommandExecutor} */
				player => helpCommand(player, { query: "familia" }),
			children: [
				{
					name: "create",
					type: "literal",
					children: [
						{
							name: "abbreviation",
							type: "argument",
							argType: "string",
							children: [
								{
									name: "full",
									type: "argument",
									argType: "string",
									run: Familia.create
								}
							],
							run: Familia.create
						}
					],
					run: Familia.error.argument
				},
				{
					name: "join",
					type: "literal",
					children: [
						{
							name: "faction",
							type: "argument",
							argType: "string",
							run: Familia.join
						}
					],
					run: Familia.error.argument
				},
				{
					name: "leave",
					type: "literal",
					run: Familia.leave
				},
				{
					name: "home",
					type: "literal",
					run: Familia.teleport.home
				},
				{
					name: "sethome",
					type: "literal",
					run: Familia.teleport.sethome
				},
				{
					name: "chat",
					type: "literal",
					children: [
						{
							name: "mode",
							type: "argument",
							argType: "enum",
							values: ["familia", "ally", "public"],
							run: Familia.chat_mode
						}
					],
					run: Familia.chat_toggle
				},
				{
					name: "invite",
					type: "literal",
					children: [
						{
							name: "player",
							type: "argument",
							argType: "player",
							run: Familia.invite
						}
					],
					run: Familia.error.argument
				},
				{
					name: "kick",
					type: "literal",
					children: [
						{
							name: "player",
							type: "argument",
							argType: "player",
							run: Familia.kick
						}
					],
					run: Familia.error.argument
				},
				{
					name: "setrank",
					type: "literal",
					children: [
						{
							name: "player",
							type: "argument",
							argType: "player",
							children: [
								{
									name: "rank",
									type: "argument",
									argType: "enum",
									values: ["member", "officer", "co-leader", "agent"],
									run: Familia.setrank
								}
							],
							run: Familia.error.argument
						}
					],
					run: Familia.error.argument
				},
				{
					name: "promote",
					type: "literal",
					children: [
						{
							name: "player",
							type: "argument",
							argType: "player",
							run: Familia.promote
						}
					],
					run: Familia.error.argument
				},
				{
					name: "demote",
					type: "literal",
					children: [
						{
							name: "player",
							type: "argument",
							argType: "player",
							run: Familia.demote
						}
					],
					run: Familia.error.argument
				},
				{
					name: "title",
					type: "literal",
					children: [
						{
							name: "player",
							type: "argument",
							argType: "player",
							children: [
								{
									name: "title",
									type: "argument",
									argType: "string",
									run: Familia.setTitle
								}
							],
							run: Familia.error.argument
						}
					],
					run: Familia.error.argument
				},
				{
					name: "setname",
					type: "literal",
					children: [
						{
							name: "abbreviation",
							type: "literal",
							children: [
								{
									name: "name",
									type: "argument",
									argType: "string",
									run: Familia.setAbbreviation
								}
							],
							run: Familia.error.argument
						},
						{
							name: "fullname",
							type: "literal",
							children: [
								{
									name: "name",
									type: "argument",
									argType: "string",
									run: Familia.setFullname
								}
							],
							run: Familia.error.argument
						}
					],
					run: Familia.error.argument
				},
				{
					name: "motd",
					type: "literal",
					children: [
						{
							name: "motd",
							type: "argument",
							argType: "string",
							run: Familia.motd
						}
					],
					run: Familia.error.argument
				},
				{
					name: "disband",
					type: "literal",
					children: [
						{
							name: "confirm",
							type: "argument",
							argType: "enum",
							values: ["confirm", "cancel"],
							run: Familia.disband
						}
					],
					run: Familia.disband
				},
				{
					name: "help",
					type: "literal",
					children: [
						{
							name: "command",
							type: "argument",
							argType: "string",
							run: Familia.help
						}
					],
					run: Familia.help
				}
			]
		};

		registerCommand(structure);
	}
}

new Familia();
