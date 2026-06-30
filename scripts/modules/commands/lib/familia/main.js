import { registerCommand } from "../../core/registry/index.js";
import { helpCommand } from "../common/help.js";

import { createFamilia } from "./modules/create.js";
import { joinFamilia } from "./modules/join.js";
import { leaveFamilia } from "./modules/leave.js";
import { getFamiliaHome, setFamiliaHome } from "./modules/home.js";
import { openFamilia, closeFamilia } from "./modules/status.js";
import { showFamiliaInfo, listFamilias } from "./modules/info.js";
import { listRequests, acceptRequest, denyRequest } from "./modules/request.js";
import {
	setRelation,
	removeRelation,
	listRelations
} from "./modules/relation.js";
import {
	inviteFamilia,
	kickFamilia,
	setFamiliaRank,
	promoteFamilia,
	demoteFamilia,
	setFamiliaTitle,
	setFamiliaAbbreviation,
	setFamiliaFullname,
	setFamiliaMotd,
	setFamiliaDescription,
	disbandFamilia
} from "./modules/manage.js";
import { helpFamilia } from "./modules/help.js";

/**
 * @typedef {import("@minecraft/server").Player} Player
 */

/**
 * @typedef {Object} FamiliaCreateContext
 * @property {string} abbreviation
 * @property {string} full
 */

/**
 * @typedef {Object} FamiliaJoinContext
 * @property {string} faction
 */

/**
 * @typedef {Object} FamiliaHomeContext
 * @property {string} [faction]
 */

/**
 * @typedef {Object} FamiliaInviteContext
 * @property {Player} player
 */

/**
 * @typedef {Object} FamiliaKickContext
 * @property {Player} player
 */

/**
 * @typedef {Object} FamiliaSetRankContext
 * @property {Player} player
 * @property {"member"|"officer"|"co-leader"|"agent"} rank
 */

/**
 * @typedef {Object} FamiliaTitleContext
 * @property {Player} player
 * @property {string} title
 */

/**
 * @typedef {Object} FamiliaSetNameContext
 * @property {string} name
 */

/**
 * @typedef {Object} FamiliaMotdContext
 * @property {string} motd
 */

/**
 * @typedef {Object} FamiliaDisbandContext
 * @property {"confirm"|"cancel"} confirm
 */

/**
 * @typedef {Object} FamiliaHelpContext
 * @property {string} command
 */

/**
 * @typedef {Object} FamiliaInfoContext
 * @property {string} [faction]
 */

/**
 * @typedef {Object} FamiliaRequestContext
 * @property {Player} player
 */

/**
 * @typedef {Object} FamiliaRelationContext
 * @property {string} faction
 */

/**
 * @typedef {Object} FamiliaDescriptionContext
 * @property {string} text
 */

/**
 * Root command loader for Familia.
 * This file only registers the command tree and delegates logic into modules.
 */
export class FamiliaMain {
	/**
	 * Build and register the `${prefix}familia` command tree.
	 * All branches remain here so the parser shape stays centralized.
	 */
	constructor() {
		/** @type {import("../../core/registry").Command} */
		const structure = {
			name: "familia",
			aliases: ["fam", "f"],
			description: "Manage your Familia, allies, and relations.",
			run:
				/** @type {import("../../core/registry/index.js").CommandExecutor} */
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
									run: createFamilia
								}
							],
							run: createFamilia
						}
					],
					run: createFamilia
				},
				{
					name: "join",
					type: "literal",
					children: [
						{
							name: "faction",
							type: "argument",
							argType: "string",
							run: joinFamilia
						}
					],
					run: joinFamilia
				},
				{
					name: "leave",
					type: "literal",
					run: leaveFamilia
				},
				{
					name: "home",
					type: "literal",
					run: getFamiliaHome
				},
				{
					name: "sethome",
					type: "literal",
					run: setFamiliaHome
				},
				{
					name: "open",
					type: "literal",
					run: openFamilia
				},
				{
					name: "close",
					type: "literal",
					run: closeFamilia
				},
				{
					name: "info",
					type: "literal",
					children: [
						{
							name: "faction",
							type: "argument",
							argType: "string",
							run: showFamiliaInfo
						}
					],
					run: showFamiliaInfo
				},
				{
					name: "list",
					type: "literal",
					run: listFamilias
				},
				{
					name: "request",
					type: "literal",
					children: [
						{
							name: "list",
							type: "literal",
							run: listRequests
						},
						{
							name: "accept",
							type: "literal",
							children: [
								{
									name: "player",
									type: "argument",
									argType: "player",
									run: acceptRequest
								}
							],
							run: acceptRequest
						},
						{
							name: "deny",
							type: "literal",
							children: [
								{
									name: "player",
									type: "argument",
									argType: "player",
									run: denyRequest
								}
							],
							run: denyRequest
						}
					],
					run: listRequests
				},
				{
					name: "relation",
					type: "literal",
					children: [
						{
							name: "ally",
							type: "literal",
							children: [
								{
									name: "faction",
									type: "argument",
									argType: "string",
									run: (player, context) =>
										setRelation(
											player,
											/** @type {FamiliaRelationContext} */ (
												context
											),
											"ally"
										)
								}
							],
							run: (player, context) =>
								setRelation(
									player,
									/** @type {FamiliaRelationContext} */ (
										context
									),
									"ally"
								)
						},
						{
							name: "enemy",
							type: "literal",
							children: [
								{
									name: "faction",
									type: "argument",
									argType: "string",
									run: (player, context) =>
										setRelation(
											player,
											/** @type {FamiliaRelationContext} */ (
												context
											),
											"enemy"
										)
								}
							],
							run: (player, context) =>
								setRelation(
									player,
									/** @type {FamiliaRelationContext} */ (
										context
									),
									"enemy"
								)
						},
						{
							name: "neutral",
							type: "literal",
							children: [
								{
									name: "faction",
									type: "argument",
									argType: "string",
									run: (player, context) =>
										setRelation(
											player,
											/** @type {FamiliaRelationContext} */ (
												context
											),
											"neutral"
										)
								}
							],
							run: (player, context) =>
								setRelation(
									player,
									/** @type {FamiliaRelationContext} */ (
										context
									),
									"neutral"
								)
						},
						{
							name: "remove",
							type: "literal",
							children: [
								{
									name: "faction",
									type: "argument",
									argType: "string",
									run: removeRelation
								}
							],
							run: removeRelation
						},
						{
							name: "list",
							type: "literal",
							run: listRelations
						}
					],
					run: listRelations
				},
				{
					name: "invite",
					type: "literal",
					children: [
						{
							name: "player",
							type: "argument",
							argType: "player",
							run: inviteFamilia
						}
					],
					run: inviteFamilia
				},
				{
					name: "kick",
					type: "literal",
					children: [
						{
							name: "player",
							type: "argument",
							argType: "player",
							run: kickFamilia
						}
					],
					run: kickFamilia
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
									values: [
										"member",
										"officer",
										"co-leader",
										"agent"
									],
									run: setFamiliaRank
								}
							],
							run: setFamiliaRank
						}
					],
					run: setFamiliaRank
				},
				{
					name: "promote",
					type: "literal",
					children: [
						{
							name: "player",
							type: "argument",
							argType: "player",
							run: promoteFamilia
						}
					],
					run: promoteFamilia
				},
				{
					name: "demote",
					type: "literal",
					children: [
						{
							name: "player",
							type: "argument",
							argType: "player",
							run: demoteFamilia
						}
					],
					run: demoteFamilia
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
									run: setFamiliaTitle
								}
							],
							run: setFamiliaTitle
						}
					],
					run: setFamiliaTitle
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
									run: setFamiliaAbbreviation
								}
							],
							run: setFamiliaAbbreviation
						},
						{
							name: "fullname",
							type: "literal",
							children: [
								{
									name: "name",
									type: "argument",
									argType: "string",
									run: setFamiliaFullname
								}
							],
							run: setFamiliaFullname
						}
					],
					run: setFamiliaAbbreviation
				},
				{
					name: "motd",
					type: "literal",
					children: [
						{
							name: "motd",
							type: "argument",
							argType: "string",
							run: setFamiliaMotd
						}
					],
					run: setFamiliaMotd
				},
				{
					name: "description",
					type: "literal",
					children: [
						{
							name: "text",
							type: "argument",
							argType: "string",
							run: setFamiliaDescription
						}
					],
					run: setFamiliaDescription
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
							run: disbandFamilia
						}
					],
					run: disbandFamilia
				},
				{
					name: "help",
					type: "literal",
					children: [
						{
							name: "command",
							type: "argument",
							argType: "string",
							run: helpFamilia
						}
					],
					run: helpFamilia
				},
				{
					name: "?",
					type: "literal",
					children: [
						{
							name: "command",
							type: "argument",
							argType: "string",
							run: helpFamilia
						}
					],
					run: helpFamilia
				}
			]
		};

		registerCommand(structure);
	}
}

new FamiliaMain();
