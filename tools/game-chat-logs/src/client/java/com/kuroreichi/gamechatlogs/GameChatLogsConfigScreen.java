package com.kuroreichi.gamechatlogs;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public final class GameChatLogsConfigScreen extends Screen {
    private final Screen parent;
    private boolean enabled;
    private boolean includeGame;
    private boolean github;
    private boolean external;
    private EditBox ownerBox;
    private EditBox repoBox;
    private EditBox branchBox;
    private EditBox tokenBox;

    public GameChatLogsConfigScreen(Screen parent) {
        super(Component.literal("Game Chat Logs"));
        this.parent = parent;
        this.enabled = GameChatLogsClient.CONFIG.enabled;
        this.includeGame = GameChatLogsClient.CONFIG.includeGameMessages;
        this.github = GameChatLogsClient.CONFIG.githubSync;
        this.external = !"instance".equalsIgnoreCase(GameChatLogsClient.CONFIG.storageMode);
    }

    @Override
    protected void init() {
        int width = Math.min(700, this.width - 50);
        int left = (this.width - width) / 2;
        int right = left + width;

        addRenderableWidget(Button.builder(Component.literal("Logging: " + (enabled ? "ON" : "OFF")), b -> {
            enabled = !enabled;
            b.setMessage(Component.literal("Logging: " + (enabled ? "ON" : "OFF")));
        }).bounds(left, 62, 220, 20).build());

        addRenderableWidget(Button.builder(Component.literal("Server messages: " + (includeGame ? "ON" : "OFF")), b -> {
            includeGame = !includeGame;
            b.setMessage(Component.literal("Server messages: " + (includeGame ? "ON" : "OFF")));
        }).bounds(right - 220, 62, 220, 20).build());

        addRenderableWidget(Button.builder(Component.literal("Storage: " + (external ? "External" : "Instance")), b -> {
            external = !external;
            b.setMessage(Component.literal("Storage: " + (external ? "External" : "Instance")));
        }).bounds(left, 91, width, 20).build());

        ownerBox = new EditBox(this.font, left, 132, width, 20, Component.literal("GitHub Owner"));
        ownerBox.setValue(GameChatLogsClient.CONFIG.githubOwner);
        ownerBox.setHint(Component.literal("GitHub owner / username"));
        addRenderableWidget(ownerBox);

        repoBox = new EditBox(this.font, left, 160, width, 20, Component.literal("Repository"));
        repoBox.setValue(GameChatLogsClient.CONFIG.githubRepository);
        repoBox.setHint(Component.literal("Existing repository name"));
        addRenderableWidget(repoBox);

        branchBox = new EditBox(this.font, left, 188, width, 20, Component.literal("Branch"));
        branchBox.setValue(GameChatLogsClient.CONFIG.githubBranch);
        branchBox.setHint(Component.literal("main"));
        addRenderableWidget(branchBox);

        tokenBox = new EditBox(this.font, left, 216, width, 20, Component.literal("Token"));
        tokenBox.setValue(GameChatLogsClient.CONFIG.githubToken);
        tokenBox.setHint(Component.literal("Fine-grained token with Contents: Read and write"));
        addRenderableWidget(tokenBox);

        addRenderableWidget(Button.builder(Component.literal("GitHub Sync: " + (github ? "ON" : "OFF")), b -> {
            github = !github;
            b.setMessage(Component.literal("GitHub Sync: " + (github ? "ON" : "OFF")));
        }).bounds(left, 247, width, 20).build());

        addRenderableWidget(Button.builder(Component.literal("Cancel"), b -> onClose())
                .bounds(left, this.height - 42, 120, 20).build());
        addRenderableWidget(Button.builder(Component.literal("Save"), b -> saveAndClose())
                .bounds(right - 120, this.height - 42, 120, 20).build());
    }

    private void saveAndClose() {
        GameChatLogsConfig config = GameChatLogsClient.CONFIG;
        config.enabled = enabled;
        config.includeGameMessages = includeGame;
        config.githubSync = github;
        config.storageMode = external ? "external" : "instance";
        config.githubOwner = ownerBox.getValue().trim();
        config.githubRepository = repoBox.getValue().trim();
        config.githubBranch = branchBox.getValue().trim().isBlank() ? "main" : branchBox.getValue().trim();
        config.githubToken = tokenBox.getValue().trim();
        config.save();
        onClose();
    }

    @Override
    public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float partialTicks) {
        super.extractRenderState(graphics, mouseX, mouseY, partialTicks);
        int width = Math.min(700, this.width - 50);
        int left = (this.width - width) / 2;
        graphics.centeredText(this.font, this.title, this.width / 2, 26, 0xFFFFFFFF);
        graphics.centeredText(this.font, Component.literal("Logs are written outside the instance when External is selected"), this.width / 2, 43, 0xFFAAAAAA);
        graphics.fill(left, 124, left + width, 240, 0x50000000);
        graphics.outline(left, 124, width, 116, 0x80FFFFFF);
        graphics.centeredText(this.font, Component.literal("GitHub sync uploads finalized history logs to an existing repository"), this.width / 2, 287, 0xFFAAAAAA);
    }

    @Override
    public void onClose() {
        this.minecraft.gui.setScreen(parent);
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }
}
