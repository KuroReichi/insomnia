import { system } from "@minecraft/server";
import { CustomForm, ObservableBoolean, ObservableNumber, ObservableString, uiManager } from "@minecraft/server-ui";
import { Database } from "../../core/Database.js";
import { configs } from "../../core/Configuration.js";
import { metricNumber } from "../../utility/MetricNumber.js";
export class Profile {
    constructor(viewer, target) {
        this.Viewer = viewer;
        this.Target = target;
        this.TargetDB = new Database(target);
    }
    closeAllForms() {
        try {
            uiManager.closeAllForms(this.Viewer);
        }
        catch { }
    }
    isSelf() {
        return this.Viewer.name === this.Target;
    }
    toText(value, fallback = "-") {
        if (value === undefined || value === null)
            return fallback;
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
            }
            catch {
                return fallback;
            }
        }
        return fallback;
    }
    toNumber(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }
    formatMoney(value) {
        const currency = String(configs["economy.currency"] ?? "$");
        return `${currency}${metricNumber(this.toNumber(value, 0))}`;
    }
    readSettings() {
        const raw = this.TargetDB.get("profile.settings");
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
            const data = raw;
            return {
                public: typeof data.public === "boolean" ? data.public : true,
                detailLevel: Math.max(0, Math.min(3, Math.round(this.toNumber(data.detailLevel, 3))))
            };
        }
        return {
            public: true,
            detailLevel: 3
        };
    }
    saveSettings(settings) {
        this.TargetDB.PUT("profile.settings", {
            public: settings.public,
            detailLevel: settings.detailLevel
        });
    }
    getTitleText() {
        return this.toText(this.TargetDB.get("player.title") ?? this.TargetDB.get("title"), "-");
    }
    getFamiliaText() {
        const family = this.TargetDB.get("familia.name.fullName") ??
            this.TargetDB.get("familia.name") ??
            this.TargetDB.get("familia");
        return this.toText(family, "-");
    }
    getLeaderboardText() {
        return this.toText(this.TargetDB.get("leaderboard.title") ??
            this.TargetDB.get("leaderboardTitle") ??
            this.TargetDB.get("leaderboard"), "-");
    }
    getPlaytimeText() {
        const playtime = this.TargetDB.get("playtime") ?? this.TargetDB.get("player.playtime");
        return this.toText(playtime, "0");
    }
    buildMyBody() {
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
    buildOthersBody() {
        const settings = this.readSettings();
        if (!settings.public) {
            return [`§fTarget§8: §b${this.Target}`, `§7`, `§cThis profile is private.`].join("\n");
        }
        const lines = [`§fTarget§8: §b${this.Target}`, `§fTitle§8: §e${this.getTitleText()}`];
        if (settings.detailLevel >= 1) {
            lines.push(`§fMoney§8: §a${this.formatMoney(this.TargetDB.get("money"))}`, `§fBounty§8: §c${this.formatMoney(this.TargetDB.get("bounty"))}`);
        }
        if (settings.detailLevel >= 2) {
            lines.push(`§fFamilia§8: §d${this.getFamiliaText()}`, `§fLeaderboard§8: §b${this.getLeaderboardText()}`);
        }
        if (settings.detailLevel >= 3) {
            lines.push(`§fPlaytime§8: §e${this.getPlaytimeText()}`);
        }
        return lines.join("\n");
    }
    openProfileForm() {
        this.closeAllForms();
        const title = new ObservableString(this.isSelf() ? "My Profile" : `${this.Target}'s Profile`);
        const body = new ObservableString(this.isSelf() ? this.buildMyBody() : this.buildOthersBody());
        const footer = new ObservableString(this.isSelf()
            ? "Manage how others see your profile."
            : "Profile view follows the target's public settings.");
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
        }
        else {
            form.button("Close", () => {
                this.closeAllForms();
            });
        }
        void form.show();
    }
    openManageForm() {
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
    show() {
        this.openProfileForm();
    }
}
