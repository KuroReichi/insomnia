package com.kuroreichi.filterattack;

import net.minecraft.client.gui.GuiGraphicsExtractor;
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
        this.enabled = FilterAttackClient.CONFIG != null && FilterAttackClient.CONFIG.enabled;
    }

    @Override
    protected void init() {
        int center = this.width / 2;

        entityBox = new EditBox(this.font, center - 155, 68, 310, 115, Component.literal("Blocked entity IDs"));
        entityBox.setValue(FilterAttackClient.CONFIG == null ? "" : FilterAttackClient.CONFIG.getBlockedText());
        entityBox.setHint(Component.literal("minecraft:creeper\\nminecraft:zombie"));
        entityBox.setMaxLength(32767);
        addRenderableWidget(entityBox);

        addRenderableWidget(Button.builder(toggleText(), button -> {
            enabled = !enabled;
            button.setMessage(toggleText());
        }).bounds(center - 155, 195, 150, 20).build());

        addRenderableWidget(Button.builder(Component.literal("Save"), button -> saveAndClose())
                .bounds(center + 5, 195, 150, 20).build());

        addRenderableWidget(Button.builder(Component.literal("Cancel"), button -> onClose())
                .bounds(center - 155, 223, 150, 20).build());
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
        this.minecraft.gui.setScreen(parent);
    }

    @Override
    public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float delta) {
        super.extractRenderState(graphics, mouseX, mouseY, delta);
        int center = this.width / 2;
        graphics.centeredText(this.font, this.title, center, 35, 0xFFFFFFFF);
        graphics.centeredText(this.font, Component.literal("One entity ID per line; commas are also accepted"), center, 51, 0xFFAAAAAA);
        graphics.centeredText(this.font, Component.literal("Short IDs like 'creeper' become 'minecraft:creeper'"), center, 183, 0xFF777777);
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }
}
