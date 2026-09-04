package com.kuroreichi.filterattack;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.EntityType;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

public final class FilterAttackConfigScreen extends Screen {
    private static final int ROWS_PER_PAGE = 7;
    private final Screen parent;
    private EditBox searchBox;
    private boolean enabled;
    private int page;
    private List<String> filtered = List.of();

    public FilterAttackConfigScreen(Screen parent) {
        super(Component.literal("Filter Attack"));
        this.parent = parent;
        this.enabled = FilterAttackClient.CONFIG != null && FilterAttackClient.CONFIG.enabled;
    }

    @Override
    protected void init() {
        int center = this.width / 2;
        int width = Math.min(640, this.width - 60);
        int left = center - width / 2;

        searchBox = new EditBox(this.font, left, 66, width, 20, Component.literal("Search"));
        searchBox.setHint(Component.literal("Search blocked entities..."));
        searchBox.setResponder(value -> {
            page = 0;
            rebuildFiltered();
            rebuildButtons();
        });
        this.addRenderableWidget(searchBox);

        rebuildFiltered();
        rebuildButtons();
    }

    private void rebuildFiltered() {
        if (FilterAttackClient.CONFIG == null) {
            filtered = List.of();
            return;
        }

        String q = searchBox == null ? "" : searchBox.getValue().trim().toLowerCase(Locale.ROOT);
        filtered = FilterAttackClient.CONFIG.blockedEntities.stream()
                .filter(id -> q.isEmpty()
                        || id.toLowerCase(Locale.ROOT).contains(q)
                        || displayName(id).toLowerCase(Locale.ROOT).contains(q))
                .sorted()
                .toList();

        page = Math.max(0, Math.min(page, maxPage()));
    }

    private int maxPage() {
        return Math.max(0, (filtered.size() - 1) / ROWS_PER_PAGE);
    }

    private int pageCount() {
        return maxPage() + 1;
    }

    private static String displayName(String id) {
        try {
            EntityType<?> type = BuiltInRegistries.ENTITY_TYPE.getOptional(net.minecraft.resources.Identifier.parse(id)).orElse(null);
            return type == null ? id : Component.translatable(type.getDescriptionId()).getString();
        } catch (Exception ignored) {
            return id;
        }
    }

    private void rebuildButtons() {
        this.clearWidgets();

        int center = this.width / 2;
        int width = Math.min(640, this.width - 60);
        int left = center - width / 2;
        int right = left + width;

        addRenderableWidget(Button.builder(Component.literal("Filter: " + (enabled ? "ON" : "OFF")), button -> {
            enabled = !enabled;
            button.setMessage(Component.literal("Filter: " + (enabled ? "ON" : "OFF")));
        }).bounds(left, 94, 120, 20).build());

        addRenderableWidget(Button.builder(Component.literal("+ Add Entity"), button ->
                this.minecraft.gui.setScreen(new FilterAttackEntityPickerScreen(this)))
                .bounds(right - 150, 94, 150, 20).build());

        int first = page * ROWS_PER_PAGE;
        int count = Math.min(ROWS_PER_PAGE, Math.max(0, filtered.size() - first));
        for (int i = 0; i < count; i++) {
            String id = filtered.get(first + i);
            int y = 126 + i * 30;

            Button row = Button.builder(Component.literal(displayName(id) + "  —  " + id), button -> {})
                    .bounds(left, y, width - 42, 26)
                    .build();
            row.active = false;
            addRenderableWidget(row);

            addRenderableWidget(Button.builder(Component.literal("×"), button -> {
                FilterAttackClient.CONFIG.blockedEntities.remove(id);
                rebuildFiltered();
                rebuildButtons();
            }).bounds(right - 36, y, 36, 26).build());
        }

        int footerY = 126 + ROWS_PER_PAGE * 30 + 4;
        addRenderableWidget(Button.builder(Component.literal("<"), button -> {
            page = Math.max(0, page - 1);
            rebuildButtons();
        }).bounds(left, footerY, 40, 20).build());

        addRenderableWidget(Button.builder(
                Component.literal((filtered.isEmpty() ? "0" : (page + 1) + " / " + pageCount()) + "  •  " + filtered.size() + " blocked"),
                button -> {}).bounds(left + 46, footerY, width - 92, 20).build());

        addRenderableWidget(Button.builder(Component.literal(">"), button -> {
            page = Math.min(maxPage(), page + 1);
            rebuildButtons();
        }).bounds(right - 40, footerY, 40, 20).build());

        int bottomY = footerY + 28;
        addRenderableWidget(Button.builder(Component.literal("Cancel"), button -> onClose())
                .bounds(left, bottomY, 120, 20).build());
        addRenderableWidget(Button.builder(Component.literal("Save"), button -> saveAndClose())
                .bounds(center - 75, bottomY, 150, 20).build());
    }

    private void saveAndClose() {
        if (FilterAttackClient.CONFIG != null) {
            FilterAttackClient.CONFIG.enabled = enabled;
            FilterAttackClient.CONFIG.normalize();
            FilterAttackClient.CONFIG.save();
        }
        onClose();
    }

    private void addEntity(String id) {
        if (FilterAttackClient.CONFIG == null || id == null || id.isBlank()) return;
        if (!FilterAttackClient.CONFIG.blockedEntities.contains(id)) {
            FilterAttackClient.CONFIG.blockedEntities.add(id);
            FilterAttackClient.CONFIG.normalize();
        }
        page = maxPage();
        rebuildFiltered();
        this.minecraft.gui.setScreen(this);
    }

    @Override
    public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float partialTicks) {
        super.extractRenderState(graphics, mouseX, mouseY, partialTicks);

        int center = this.width / 2;
        int width = Math.min(640, this.width - 60);
        int left = center - width / 2;
        int right = left + width;

        graphics.centeredText(this.font, this.title, center, 26, 0xFFFFFFFF);
        graphics.centeredText(this.font,
                Component.literal("Blocked entities are never attacked by the client"),
                center, 44, 0xFFAAAAAA);

        graphics.fill(left, 121, right, 121 + ROWS_PER_PAGE * 30 + 6, 0x60000000);
        graphics.outline(left, 121, width, ROWS_PER_PAGE * 30 + 6, 0x80FFFFFF);
    }

    @Override
    public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
        return super.mouseClicked(event, doubleClick);
    }

    @Override
    public void onClose() {
        this.minecraft.gui.setScreen(parent);
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }

    private final class FilterAttackEntityPickerScreen extends Screen {
        private final FilterAttackConfigScreen parentScreen;
        private EditBox pickerSearch;
        private List<EntityType<?>> entityTypes = List.of();
        private int page;

        private FilterAttackEntityPickerScreen(FilterAttackConfigScreen parent) {
            super(Component.literal("Add Entity"));
            this.parentScreen = parent;
        }

        @Override
        protected void init() {
            int center = this.width / 2;
            int width = Math.min(660, this.width - 50);
            int left = center - width / 2;

            pickerSearch = new EditBox(this.font, left, 58, width, 20, Component.literal("Search"));
            pickerSearch.setHint(Component.literal("Search entity name or ID..."));
            pickerSearch.setResponder(value -> {
                page = 0;
                rebuildPicker();
                rebuildPickerButtons();
            });
            addRenderableWidget(pickerSearch);

            rebuildPicker();
            rebuildPickerButtons();
        }

        private void rebuildPicker() {
            String q = pickerSearch == null ? "" : pickerSearch.getValue().trim().toLowerCase(Locale.ROOT);
            List<EntityType<?>> types = new ArrayList<>();

            for (EntityType<?> type : BuiltInRegistries.ENTITY_TYPE) {
                var key = BuiltInRegistries.ENTITY_TYPE.getKey(type);
                if (key == null) continue;
                String id = key.toString();
                String name = Component.translatable(type.getDescriptionId()).getString();
                if (q.isEmpty() || id.toLowerCase(Locale.ROOT).contains(q)
                        || name.toLowerCase(Locale.ROOT).contains(q)) {
                    types.add(type);
                }
            }

            types.sort(Comparator.comparing(type ->
                    BuiltInRegistries.ENTITY_TYPE.getKey(type).toString()));
            entityTypes = types;
            page = Math.max(0, Math.min(page, pickerMaxPage()));
        }

        private int pickerMaxPage() {
            return Math.max(0, (entityTypes.size() - 1) / ROWS_PER_PAGE);
        }

        private void rebuildPickerButtons() {
            this.clearWidgets();

            int center = this.width / 2;
            int width = Math.min(660, this.width - 50);
            int left = center - width / 2;
            int right = left + width;

            int first = page * ROWS_PER_PAGE;
            int count = Math.min(ROWS_PER_PAGE, Math.max(0, entityTypes.size() - first));

            for (int i = 0; i < count; i++) {
                EntityType<?> type = entityTypes.get(first + i);
                var key = BuiltInRegistries.ENTITY_TYPE.getKey(type);
                if (key == null) continue;

                String id = key.toString();
                String name = Component.translatable(type.getDescriptionId()).getString();
                boolean blocked = FilterAttackClient.CONFIG != null
                        && FilterAttackClient.CONFIG.blockedEntities.contains(id);

                int y = 94 + i * 30;
                addRenderableWidget(Button.builder(
                        Component.literal(name + "  —  " + id),
                        button -> {
                            if (!blocked) {
                                parentScreen.addEntity(id);
                                this.minecraft.gui.setScreen(parentScreen);
                            }
                        }).bounds(left, y, width - 42, 26).build());

                addRenderableWidget(Button.builder(Component.literal(blocked ? "BLOCKED" : "ADD"), button -> {
                    if (!blocked) {
                        parentScreen.addEntity(id);
                        this.minecraft.gui.setScreen(parentScreen);
                    }
                }).bounds(right - 36, y, 36, 26).build());
            }

            int footerY = 94 + ROWS_PER_PAGE * 30 + 5;
            addRenderableWidget(Button.builder(Component.literal("<"), button -> {
                page = Math.max(0, page - 1);
                rebuildPickerButtons();
            }).bounds(left, footerY, 40, 20).build());

            addRenderableWidget(Button.builder(
                    Component.literal((entityTypes.isEmpty() ? "0" : (page + 1) + " / " + (pickerMaxPage() + 1))
                            + "  •  " + entityTypes.size() + " entities"),
                    button -> {}).bounds(left + 46, footerY, width - 92, 20).build());

            addRenderableWidget(Button.builder(Component.literal(">"), button -> {
                page = Math.min(pickerMaxPage(), page + 1);
                rebuildPickerButtons();
            }).bounds(right - 40, footerY, 40, 20).build());

            addRenderableWidget(Button.builder(Component.literal("Back"), button ->
                    this.minecraft.gui.setScreen(parentScreen))
                    .bounds(left, footerY + 28, 120, 20).build());
        }

        @Override
        public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float partialTicks) {
            super.extractRenderState(graphics, mouseX, mouseY, partialTicks);

            int center = this.width / 2;
            int width = Math.min(660, this.width - 50);
            int left = center - width / 2;
            int right = left + width;

            graphics.centeredText(this.font, this.title, center, 25, 0xFFFFFFFF);
            graphics.centeredText(this.font,
                    Component.literal("Select an entity type to block"),
                    center, 42, 0xFFAAAAAA);

            graphics.fill(left, 89, right, 89 + ROWS_PER_PAGE * 30 + 6, 0x60000000);
            graphics.outline(left, 89, width, ROWS_PER_PAGE * 30 + 6, 0x80FFFFFF);
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
}
