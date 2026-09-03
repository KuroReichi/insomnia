package com.kuroreichi.filterattack;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public final class FilterAttackConfigScreen extends Screen {
    private final Screen parent;
    private EditBox entityBox;
    private boolean enabled;

    public FilterAttackConfigScreen(Screen parent) {
        super(Component.literal("Filter Attack"));
        this.parent = parent;
        this.enabled = FilterAttackClient.CONFIG.enabled;
    }

    @Override
    protected void init() {
        int center = this.width / 2;
        int top = 70;

        this.entityBox = new EditBox(this.font, center - 155, top, 310, 120, Component.literal("Blocked entity IDs"));
        this.entityBox.setValue(FilterAttackClient.CONFIG.getBlockedText());
        this.entityBox.setHint(Component.literal("minecraft:creeper\\nminecraft:zombie"));
        this.entityBox.setMaxLength(32767);
        this.addRenderableWidget(this.entityBox);

        this.addRenderableWidget(Button.builder(toggleText(), button -> {
            enabled = !enabled;
            button.setMessage(toggleText());
        }).bounds(center - 155, 200, 150, 20).build());

        this.addRenderableWidget(Button.builder(Component.literal("Save"), button -> saveAndClose())
                .bounds(center + 5, 200, 150, 20).build());

        this.addRenderableWidget(Button.builder(Component.literal("Cancel"), button -> onClose())
                .bounds(center - 155, 228, 150, 20).build());
    }

    private Component toggleText() {
        return Component.literal("Filter: " + (enabled ? "ON" : "OFF"));
    }

    private void saveAndClose() {
        FilterAttackClient.CONFIG.enabled = enabled;
        FilterAttackClient.CONFIG.setBlockedFromText(entityBox.getValue());
        FilterAttackClient.CONFIG.save();
        onClose();
    }

    @Override
    public void onClose() {
        this.minecraft.setScreen(parent);
    }

    @Override
    public void render(GuiGraphics graphics, int mouseX, int mouseY, float delta) {
        this.renderBackground(graphics, mouseX, mouseY, delta);
        super.render(graphics, mouseX, mouseY, delta);
        int center = this.width / 2;
        graphics.drawCenteredString(this.font, this.title, center, 35, 0xFFFFFF);
        graphics.drawCenteredString(this.font, Component.literal("One entity ID per line (commas also work)"), center, 52, 0xAAAAAA);
        graphics.drawCenteredString(this.font, Component.literal("Example: minecraft:creeper"), center, 188, 0x777777);
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }
}
