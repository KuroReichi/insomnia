import { Player } from "@minecraft/server";

export interface CommandContext {
	[key: string]: any;
}

export type CommandExecutor<TContext extends CommandContext = CommandContext> = (player: Player, args: TContext) => void | Promise<void>;

export interface CommandNode<TContext extends CommandContext = CommandContext> {
	type: "literal" | "argument";
	name: string;
	argType?: "string" | "number" | "boolean" | "player" | "enum";
	values?: string[];

	run?: CommandExecutor<TContext>;

	children?: CommandNode<any>[];
}

export interface Command<TContext extends CommandContext = CommandContext> {
	name: string;
	aliases?: string[];
	description?: string;

	run?: CommandExecutor<TContext>;

	children?: CommandNode<any>[];
}

export interface CommandQueueSuccess {
	status: "Success";
	message: string;
}

export interface CommandQueueFailure {
	status: "Failed";
	message: string;
}

export type CommandQueueResult = CommandQueueSuccess | CommandQueueFailure;

export interface ValidationSuccess {
	success: true;
	value: any;
}

export interface ValidationFailure {
	success: false;
	error: string;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

export interface TraversalSuccess {
	success: true;
}

export interface TraversalFailure {
	success: false;
	error: string;
	token?: string;
}

export type TraversalResult = TraversalSuccess | TraversalFailure;

export function getCommands(): Command[];

export function registerCommand(command: Command<any>): void;

export function CommandQueue(player: Player, input: string | string[]): Promise<CommandQueueResult>;
