import { Player, system } from "@minecraft/server";
import {
	CustomForm,
	ObservableBoolean,
	ObservableNumber,
	ObservableString,
	uiManager
} from "@minecraft/server-ui";
import { Database } from "../../core/Database.js";
import { configs } from "../../core/Configuration.js";
import { metricNumber } from "../../utility/MetricNumber.js";

type ProfileSettings = {
	public: boolean;
	detailLevel: number;
};

export class Profile {
	public readonly Viewer: Player;
	public readonly Target: string;

	private readonly TargetDB: Database;

	constructor(viewer: Player, target: string) {
		this.Viewer = viewer;
		this.Target = target;
		this.TargetDB = new Database(target);
	}

	private closeAllForms(): void {
		try {
			uiManager.closeAllForms(this.Viewer);
		} catch {}
	}

	private isSelf(): boolean {
		return this.Viewer.name === this.Target;
	}

	private toText(value: unknown, fallback = "-"): string {
		if (value === undefined || value === null) return fallback;
		if (typeof value === "string") {
			const text = value.trim();
			return text.length > 0 ? text : fallback;
		}
		if (typeof value === "number") {
			return Number.isFinite(value) ? String(value) : fallback;
		}
		if (typeof value === "boolean") {
			return value ? "true" : "false";
		}
		if (Array.isArray(value)) {
			return value.length > 0 ? value.map((v) => this.toText(v, "")).join(", ") : fallback;
		}
		if (typeof value === "object") {
			try {
				return JSON.stringify(value);
			} catch {
				return fallback;
			}
		}
		return fallback;
	}

	private toNumber(value: unknown, fallback = 0): number {
		const n = Number(value);
		return Number.isFinite(n) ? n : fallback;
	}

	private formatMoney(value: unknown): string {
		const currency = String(configs["economy.currency"] ?? "$");
		return `${currency}${metricNumber(this.toNumber(value, 0))}`;
	}

	private readSettings(): ProfileSettings {
		const raw = this.TargetDB.get("profile.settings");

		if (raw && typeof raw === "object" && !Array.isArray(raw)) {
			const data = raw as Record<string, unknown>;

			return {
				public: typeof data.public === "boolean" ? data.public : true,
				detailLevel: Math.max(
					0,
					Math.min(3, Math.round(this.toNumber(data.detailLevel, 3)))
				)
			};
		}

		return {
			public: true,
			detailLevel: 3
		};
	}

	private saveSettings(settings: ProfileSettings): void {
		this.TargetDB.PUT("profile.settings", {
			public: settings.public,
			detailLevel: settings.detailLevel
		});
	}

	private getTitleText(): string {
		return this.toText(this.TargetDB.get("player.title") ?? this.TargetDB.get("title"), "-");
	}

	private getFamiliaText(): string {
		const family =
			this.TargetDB.get("familia.name.fullName") ??
			this.TargetDB.get("familia.name") ??
			this.TargetDB.get("familia");

		return this.toText(family, "-");
	}

	private getLeaderboardText(): string {
		return this.toText(
			this.TargetDB.get("leaderboard.title") ??
				this.TargetDB.get("leaderboardTitle") ??
				this.TargetDB.get("leaderboard"),
			"-"
		);
	}

	private getPlaytimeText(): string {
		const playtime = this.TargetDB.get("playtime") ?? this.TargetDB.get("player.playtime");
		return this.toText(playtime, "0");
	}

	private buildMyBody(): string {
		const settings = this.readSettings();

		return [
			`§fTarget§8: §b${this.Target}`,
			`§fTitle§8: §e${this.getTitleText()}`,
			`§fMoney§8: §a${this.formatMoney(this.TargetDB.get("money"))}`,
			`§fBounty§8: §c${this.formatMoney(this.TargetDB.get("bounty"))}`,
			`§fFamilia§8: §d${this.getFamiliaText()}`,
			`§fLeaderboard§8: §b${this.getLeaderboardText()}`,
			`§fPlaytime§8: §e${this.getPlaytimeText()}`,
			`§7`,
			`§7Public§8: ${settings.public ? "§aYes" : "§cNo"}`,
			`§7Detail Level§8: §e${settings.detailLevel}`
		].join("\n");
	}

	private buildOthersBody(): string {
		const settings = this.readSettings();

		if (!settings.public) {
			return [`§fTarget§8: §b${this.Target}`, `§7`, `§cThis profile is private.`].join("\n");
		}

		const lines = [`§fTarget§8: §b${this.Target}`, `§fTitle§8: §e${this.getTitleText()}`];

		if (settings.detailLevel >= 1) {
			lines.push(
				`§fMoney§8: §a${this.formatMoney(this.TargetDB.get("money"))}`,
				`§fBounty§8: §c${this.formatMoney(this.TargetDB.get("bounty"))}`
			);
		}

		if (settings.detailLevel >= 2) {
			lines.push(
				`§fFamilia§8: §d${this.getFamiliaText()}`,
				`§fLeaderboard§8: §b${this.getLeaderboardText()}`
			);
		}

		if (settings.detailLevel >= 3) {
			lines.push(`§fPlaytime§8: §e${this.getPlaytimeText()}`);
		}

		return lines.join("\n");
	}

	private openProfileForm(): void {
		this.closeAllForms();

		const title = new ObservableString(
			this.isSelf() ? "My Profile" : `${this.Target}'s Profile`
		);
		const body = new ObservableString(
			this.isSelf() ? this.buildMyBody() : this.buildOthersBody()
		);
		const footer = new ObservableString(
			this.isSelf()
				? "Manage how others see your profile."
				: "Profile view follows the target's public settings."
		);

		const form = new CustomForm(this.Viewer, title).label(body).spacer().label(footer);

		if (this.isSelf()) {
			form.button("Manage", () => {
				system.run(() => {
					void this.openManageForm();
				});
			});

			form.button("Close", () => {
				this.closeAllForms();
			});
		} else {
			form.button("Close", () => {
				this.closeAllForms();
			});
		}

		void form.show();
	}

	private openManageForm(): void {
		this.closeAllForms();

		const settings = this.readSettings();

		const publicToggle = new ObservableBoolean(settings.public);
		const detailLevel = new ObservableNumber(settings.detailLevel);
		const title = new ObservableString("Profile Manager");
		const info = new ObservableString("0 = Minimal, 1 = Money, 2 = Social, 3 = Full");

		const form = new CustomForm(this.Viewer, title)
			.label(new ObservableString("Control how Others see your profile."))
			.toggle(new ObservableString("Public profile"), publicToggle)
			.slider(new ObservableString("Detail level"), detailLevel, 0, 3)
			.label(info)
			.button("Save", () => {
				this.saveSettings({
					public: publicToggle.getData(),
					detailLevel: Math.round(detailLevel.getData())
				});

				system.run(() => {
					void this.openProfileForm();
				});
			})
			.button("Back", () => {
				system.run(() => {
					void this.openProfileForm();
				});
			})
			.closeButton();

		void form.show();
	}

	public show(): void {
		this.openProfileForm();
	}
}
