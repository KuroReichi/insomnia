package com.kuroreichi.filterattack;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.EntityType;
import net.minecraft.resources.ResourceLocation;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

public final class FilterAttackConfigScreen extends Screen {
    private final Screen parent;
    private EditBox searchBox;
    private boolean enabled;
    private int scrollOffset;
    private List<String> filteredEntities = List.of();

    private static final int ROW_HEIGHT = 28;
    private static final int LIST_TOP = 128;
    private static final int LIST_BOTTOM_OFFSET = 74;
    private static final int MAX_VISIBLE = 10;

    public FilterAttackConfigScreen(Screen parent) {
        super(Component.literal("Filter Attack"));
        this.parent = parent;
        this.enabled = FilterAttackClient.CONFIG != null && FilterAttackClient.CONFIG.enabled;
    }

    @Override
    protected void init() {
        int center = this.width / 2;
        int listWidth = Math.min(620, this.width - 80);

        searchBox = new EditBox(this.font, center - listWidth / 2, 76, listWidth, 20,
                Component.literal("Search"));
        searchBox.setHint(Component.literal("Search blocked entities..."));
        searchBox.setResponder(value -> {
            scrollOffset = 0;
            rebuildFilteredEntities();
        });
        this.addRenderableWidget(searchBox);

        this.addRenderableWidget(Button.builder(Component.literal("+ Add Entity"), button ->
                this.minecraft.gui.setScreen(new FilterAttackEntityPickerScreen(this)))
                .bounds(center + listWidth / 2 - 150, 103, 150, 20).build());

        this.addRenderableWidget(Button.builder(toggleText(), button -> {
            enabled = !enabled;
            button.setMessage(toggleText());
        }).bounds(center - listWidth / 2, 103, 135, 20).build());

        this.addRenderableWidget(Button.builder(Component.literal("Save"), button -> saveAndClose())
                .bounds(center - 75, this.height - 46, 150, 20).build());

        this.addRenderableWidget(Button.builder(Component.literal("Cancel"), button -> onClose())
                .bounds(center - listWidth / 2, this.height - 46, 120, 20).build());

        rebuildFilteredEntities();
    }

    private Component toggleText() {
        return Component.literal("Filter: " + (enabled ? "ON" : "OFF"));
    }

    private void rebuildFilteredEntities() {
        if (FilterAttackClient.CONFIG == null) {
            filteredEntities = List.of();
            return;
        }

        String query = searchBox == null ? "" : searchBox.getValue().trim().toLowerCase(Locale.ROOT);
        filteredEntities = FilterAttackClient.CONFIG.blockedEntities.stream()
                .filter(id -> query.isEmpty()
                        || id.toLowerCase(Locale.ROOT).contains(query)
                        || getDisplayName(id).toLowerCase(Locale.ROOT).contains(query))
                .sorted()
                .toList();

        int maxScroll = Math.max(0, filteredEntities.size() - MAX_VISIBLE);
        scrollOffset = Math.max(0, Math.min(scrollOffset, maxScroll));
    }

    private static String getDisplayName(String id) {
        try {
            EntityType<?> type = BuiltInRegistries.ENTITY_TYPE.get(ResourceLocation.parse(id));
            return type == null ? id : Component.translatable(type.getDescriptionId()).getString();
        } catch (Exception ignored) {
            return id;
        }
    }

    private void removeEntity(String id) {
        if (FilterAttackClient.CONFIG == null) return;
        FilterAttackClient.CONFIG.blockedEntities.remove(id);
        rebuildFilteredEntities();
    }

    private void saveAndClose() {
        if (FilterAttackClient.CONFIG != null) {
            FilterAttackClient.CONFIG.enabled = enabled;
            FilterAttackClient.CONFIG.normalize();
            FilterAttackClient.CONFIG.save();
        }
        onClose();
    }

    @Override
    public void onClose() {
        this.minecraft.gui.setScreen(parent);
    }

    @Override
    public boolean mouseScrolled(double mouseX, double mouseY, double horizontalAmount, double verticalAmount) {
        if (mouseY >= LIST_TOP && mouseY <= this.height - LIST_BOTTOM_OFFSET) {
            int maxScroll = Math.max(0, filteredEntities.size() - MAX_VISIBLE);
            scrollOffset = Math.max(0, Math.min(maxScroll,
                    scrollOffset - (int) Math.signum(verticalAmount)));
            return true;
        }
        return super.mouseScrolled(mouseX, mouseY, horizontalAmount, verticalAmount);
    }

    @Override
    public boolean mouseClicked(double mouseX, double mouseY, int button) {
        int center = this.width / 2;
        int listWidth = Math.min(620, this.width - 80);
        int left = center - listWidth / 2;
        int right = center + listWidth / 2;

        if (button == 0 && mouseX >= left && mouseX <= right
                && mouseY >= LIST_TOP && mouseY <= this.height - LIST_BOTTOM_OFFSET) {
            int index = (int) ((mouseY - LIST_TOP) / ROW_HEIGHT) + scrollOffset;
            if (index >= 0 && index < filteredEntities.size()) {
                int removeX = right - 48;
                if (mouseX >= removeX) {
                    removeEntity(filteredEntities.get(index));
                    return true;
                }
            }
        }
        return super.mouseClicked(mouseX, mouseY, button);
    }

    @Override
    public void render(GuiGraphics graphics, int mouseX, int mouseY, float delta) {
        renderBackground(graphics, mouseX, mouseY, delta);

        int center = this.width / 2;
        int listWidth = Math.min(620, this.width - 80);
        int left = center - listWidth / 2;
        int right = center + listWidth / 2;
        int listBottom = this.height - LIST_BOTTOM_OFFSET;

        graphics.drawCenteredString(this.font, this.title, center, 28, 0xFFFFFF);
        graphics.drawCenteredString(this.font,
                Component.literal("Choose which entity types the client will never attack"),
                center, 48, 0xAAAAAA);

        graphics.fill(left, LIST_TOP - 2, right, listBottom, 0x70000000);

        if (filteredEntities.isEmpty()) {
            String message = FilterAttackClient.CONFIG == null
                    || FilterAttackClient.CONFIG.blockedEntities.isEmpty()
                    ? "No blocked entities"
                    : "No entities match your search";
            graphics.drawCenteredString(this.font, Component.literal(message),
                    center, LIST_TOP + 62, 0xAAAAAA);
        } else {
            int visible = Math.min(MAX_VISIBLE, filteredEntities.size() - scrollOffset);
            for (int row = 0; row < visible; row++) {
                int index = row + scrollOffset;
                int y = LIST_TOP + row * ROW_HEIGHT;

                if ((row & 1) == 1) {
                    graphics.fill(left + 1, y, right - 1, y + ROW_HEIGHT, 0x18000000);
                }

                String id = filteredEntities.get(index);
                graphics.drawString(this.font,
                        Component.literal(getDisplayName(id)),
                        left + 12, y + 5, 0xFFFFFF);
                graphics.drawString(this.font,
                        Component.literal(id),
                        left + 12, y + 16, 0x777777);

                graphics.fill(right - 48, y + 5, right - 8, y + 23, 0x80AA2222);
                graphics.drawCenteredString(this.font,
                        Component.literal("×"), right - 28, y + 8, 0xFFFFFF);
            }
        }

        int count = FilterAttackClient.CONFIG == null
                ? 0 : FilterAttackClient.CONFIG.blockedEntities.size();
        graphics.drawString(this.font,
                Component.literal(count + " blocked"), left + 4, listBottom + 8, 0xAAAAAA);

        int maxScroll = Math.max(0, filteredEntities.size() - MAX_VISIBLE);
        if (maxScroll > 0) {
            float ratio = MAX_VISIBLE / (float) filteredEntities.size();
            int trackHeight = listBottom - LIST_TOP - 8;
            int thumbHeight = Math.max(18, (int) (trackHeight * ratio));
            int thumbY = LIST_TOP + 4
                    + (int) ((trackHeight - thumbHeight)
                    * (scrollOffset / (float) maxScroll));
            graphics.fill(right - 6, LIST_TOP + 4, right - 3, listBottom - 4, 0x30FFFFFF);
            graphics.fill(right - 6, thumbY, right - 3, thumbY + thumbHeight, 0xA0FFFFFF);
        }

        super.render(graphics, mouseX, mouseY, delta);
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }

    private final class FilterAttackEntityPickerScreen extends Screen {
        private final FilterAttackConfigScreen parentScreen;
        private EditBox pickerSearch;
        private List<EntityType<?>> entityTypes = List.of();
        private int pickerScroll;

        FilterAttackEntityPickerScreen(FilterAttackConfigScreen parent) {
            super(Component.literal("Add Entity"));
            this.parentScreen = parent;
        }

        @Override
        protected void init() {
            int center = this.width / 2;
            int listWidth = Math.min(650, this.width - 80);

            pickerSearch = new EditBox(this.font,
                    center - listWidth / 2, 58, listWidth, 20,
                    Component.literal("Search"));
            pickerSearch.setHint(Component.literal("Search entity name or ID..."));
            pickerSearch.setResponder(value -> {
                pickerScroll = 0;
                rebuildPicker();
            });
            this.addRenderableWidget(pickerSearch);

            this.addRenderableWidget(Button.builder(Component.literal("Back"), b ->
                    this.minecraft.gui.setScreen(parentScreen))
                    .bounds(center - listWidth / 2, this.height - 42, 120, 20).build());

            rebuildPicker();
        }

        private void rebuildPicker() {
            String query = pickerSearch == null
                    ? "" : pickerSearch.getValue().trim().toLowerCase(Locale.ROOT);

            List<EntityType<?>> types = new ArrayList<>();
            for (EntityType<?> type : BuiltInRegistries.ENTITY_TYPE) {
                var key = BuiltInRegistries.ENTITY_TYPE.getKey(type);
                if (key == null) continue;

                String id = key.toString();
                String name = Component.translatable(type.getDescriptionId()).getString();

                if (query.isEmpty()
                        || id.toLowerCase(Locale.ROOT).contains(query)
                        || name.toLowerCase(Locale.ROOT).contains(query)) {
                    types.add(type);
                }
            }

            types.sort(Comparator.comparing(type ->
                    BuiltInRegistries.ENTITY_TYPE.getKey(type).toString()));
            entityTypes = types;

            int maxScroll = Math.max(0, entityTypes.size() - MAX_VISIBLE);
            pickerScroll = Math.max(0, Math.min(pickerScroll, maxScroll));
        }

        @Override
        public boolean mouseScrolled(double mouseX, double mouseY,
                                     double horizontalAmount, double verticalAmount) {
            int top = 92;
            int bottom = this.height - 62;
            if (mouseY >= top && mouseY <= bottom) {
                int maxScroll = Math.max(0, entityTypes.size() - MAX_VISIBLE);
                pickerScroll = Math.max(0, Math.min(maxScroll,
                        pickerScroll - (int) Math.signum(verticalAmount)));
                return true;
            }
            return super.mouseScrolled(mouseX, mouseY, horizontalAmount, verticalAmount);
        }

        @Override
        public boolean mouseClicked(double mouseX, double mouseY, int button) {
            if (button == 0) {
                int center = this.width / 2;
                int listWidth = Math.min(650, this.width - 80);
                int left = center - listWidth / 2;
                int right = center + listWidth / 2;
                int top = 92;

                if (mouseX >= left && mouseX <= right
                        && mouseY >= top && mouseY <= this.height - 62) {
                    int index = (int) ((mouseY - top) / ROW_HEIGHT) + pickerScroll;
                    if (index >= 0 && index < entityTypes.size()) {
                        var key = BuiltInRegistries.ENTITY_TYPE.getKey(entityTypes.get(index));
                        if (key != null) {
                            parentScreen.addEntity(key.toString());
                            return true;
                        }
                    }
                }
            }
            return super.mouseClicked(mouseX, mouseY, button);
        }

        @Override
        public void render(GuiGraphics graphics, int mouseX, int mouseY, float delta) {
            renderBackground(graphics, mouseX, mouseY, delta);

            int center = this.width / 2;
            int listWidth = Math.min(650, this.width - 80);
            int left = center - listWidth / 2;
            int right = center + listWidth / 2;
            int top = 92;
            int bottom = this.height - 62;

            graphics.drawCenteredString(this.font, this.title, center, 28, 0xFFFFFF);
            graphics.drawCenteredString(this.font,
                    Component.literal("Click an entity to add it to the blocked list"),
                    center, 42, 0xAAAAAA);

            graphics.fill(left, top - 2, right, bottom, 0x70000000);

            int visible = Math.min(MAX_VISIBLE, entityTypes.size() - pickerScroll);
            for (int row = 0; row < visible; row++) {
                int index = pickerScroll + row;
                int y = top + row * ROW_HEIGHT;

                if ((row & 1) == 1) {
                    graphics.fill(left + 1, y, right - 1, y + ROW_HEIGHT, 0x18000000);
                }

                EntityType<?> type = entityTypes.get(index);
                var key = BuiltInRegistries.ENTITY_TYPE.getKey(type);
                String id = key == null ? "" : key.toString();
                String name = Component.translatable(type.getDescriptionId()).getString();

                boolean blocked = FilterAttackClient.CONFIG != null
                        && FilterAttackClient.CONFIG.blockedEntities.contains(id);

                graphics.drawString(this.font, Component.literal(name),
                        left + 12, y + 5, 0xFFFFFF);
                graphics.drawString(this.font, Component.literal(id),
                        left + 12, y + 16, 0x777777);

                if (blocked) {
                    graphics.drawCenteredString(this.font,
                            Component.literal("BLOCKED"), right - 55, y + 9, 0xAAAAAA);
                } else {
                    graphics.fill(right - 88, y + 5, right - 8, y + 23, 0x804A7FB0);
                    graphics.drawCenteredString(this.font,
                            Component.literal("ADD"), right - 48, y + 9, 0xFFFFFF);
                }
            }

            int maxScroll = Math.max(0, entityTypes.size() - MAX_VISIBLE);
            if (maxScroll > 0) {
                float ratio = MAX_VISIBLE / (float) entityTypes.size();
                int trackHeight = bottom - top - 8;
                int thumbHeight = Math.max(18, (int) (trackHeight * ratio));
                int thumbY = top + 4
                        + (int) ((trackHeight - thumbHeight)
                        * (pickerScroll / (float) maxScroll));
                graphics.fill(right - 6, top + 4, right - 3, bottom - 4, 0x30FFFFFF);
                graphics.fill(right - 6, thumbY, right - 3, thumbY + thumbHeight, 0xA0FFFFFF);
            }

            super.render(graphics, mouseX, mouseY, delta);
        }

        @Override
        public void onClose() {
            this.minecraft.gui.setScreen(parentScreen);
        }

        @Override
        public boolean isPauseScreen() {
            return false;
        }
    }

    private void addEntity(String id) {
        if (FilterAttackClient.CONFIG == null || id == null || id.isBlank()) return;
        if (!FilterAttackClient.CONFIG.blockedEntities.contains(id)) {
            FilterAttackClient.CONFIG.blockedEntities.add(id);
            FilterAttackClient.CONFIG.normalize();
        }
        rebuildFilteredEntities();
        this.minecraft.gui.setScreen(this);
    }
}
