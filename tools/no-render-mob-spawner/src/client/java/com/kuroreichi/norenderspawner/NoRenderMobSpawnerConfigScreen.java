package com.kuroreichi.norenderspawner;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public final class NoRenderMobSpawnerConfigScreen extends Screen {
    private final Screen parent;
    private boolean enabled;
    private boolean hideSpawnerBlock;
    private boolean hidePreviewAndEffects;
    private boolean optimizeBlockEntityUpdates;

    public NoRenderMobSpawnerConfigScreen(Screen parent) {
        super(Component.literal("No Render Mob Spawner"));
        this.parent = parent;
        this.enabled = NoRenderMobSpawnerClient.CONFIG.enabled;
        this.hideSpawnerBlock = NoRenderMobSpawnerClient.CONFIG.hideSpawnerBlock;
        this.hidePreviewAndEffects = NoRenderMobSpawnerClient.CONFIG.hidePreviewAndEffects;
        this.optimizeBlockEntityUpdates = NoRenderMobSpawnerClient.CONFIG.optimizeBlockEntityUpdates;
    }

    @Override
    protected void init() {
        int width = Math.min(700, this.width - 50);
        int left = (this.width - width) / 2;

        addRenderableWidget(Button.builder(Component.literal("No Render Spawner: " + (enabled ? "ON" : "OFF")), b -> {
            enabled = !enabled;
            b.setMessage(Component.literal("No Render Spawner: " + (enabled ? "ON" : "OFF")));
        }).bounds(left, 62, width, 20).build());

        addRenderableWidget(Button.builder(Component.literal("Hide Spawner Block: " + (hideSpawnerBlock ? "ON" : "OFF")), b -> {
            hideSpawnerBlock = !hideSpawnerBlock;
            b.setMessage(Component.literal("Hide Spawner Block: " + (hideSpawnerBlock ? "ON" : "OFF")));
        }).bounds(left, 91, width, 20).build());

        addRenderableWidget(Button.builder(Component.literal("Hide Preview & Effects: " + (hidePreviewAndEffects ? "ON" : "OFF")), b -> {
            hidePreviewAndEffects = !hidePreviewAndEffects;
            b.setMessage(Component.literal("Hide Preview & Effects: " + (hidePreviewAndEffects ? "ON" : "OFF")));
        }).bounds(left, 120, width, 20).build());

        addRenderableWidget(Button.builder(Component.literal("Skip Spawner Render Updates: " + (optimizeBlockEntityUpdates ? "ON" : "OFF")), b -> {
            optimizeBlockEntityUpdates = !optimizeBlockEntityUpdates;
            b.setMessage(Component.literal("Skip Spawner Render Updates: " + (optimizeBlockEntityUpdates ? "ON" : "OFF")));
        }).bounds(left, 149, width, 20).build());

        addRenderableWidget(Button.builder(Component.literal("Cancel"), b -> onClose())
                .bounds(left, this.height - 42, 120, 20).build());
        addRenderableWidget(Button.builder(Component.literal("Save"), b -> saveAndClose())
                .bounds(left + width - 120, this.height - 42, 120, 20).build());
    }

    private void saveAndClose() {
        NoRenderMobSpawnerConfig config = NoRenderMobSpawnerClient.CONFIG;
        config.enabled = enabled;
        config.hideSpawnerBlock = hideSpawnerBlock;
        config.hidePreviewAndEffects = hidePreviewAndEffects;
        config.optimizeBlockEntityUpdates = optimizeBlockEntityUpdates;
        config.save();
        onClose();
    }

    @Override
    public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float partialTicks) {
        super.extractRenderState(graphics, mouseX, mouseY, partialTicks);
        int width = Math.min(700, this.width - 50);
        int left = (this.width - width) / 2;
        graphics.centeredText(this.font, this.title, this.width / 2, 26, 0xFFFFFFFF);
        graphics.centeredText(this.font, Component.literal("Selection outline remains available when targeting a hidden spawner"), this.width / 2, 43, 0xFFAAAAAA);
        graphics.fill(left, 54, left + width, 180, 0x50000000);
        graphics.outline(left, 54, width, 126, 0x80FFFFFF);
        graphics.centeredText(this.font, Component.literal("Skip Render Updates only affects spawner visual state work"), this.width / 2, 192, 0xFFAAAAAA);
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
