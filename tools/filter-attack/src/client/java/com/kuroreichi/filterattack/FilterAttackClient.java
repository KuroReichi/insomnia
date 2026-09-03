package com.kuroreichi.filterattack;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.api.EnvType;
import net.fabricmc.api.Environment;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.event.client.player.ClientPreAttackCallback;
import net.fabricmc.fabric.api.event.player.AttackEntityCallback;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.phys.EntityHitResult;

@Environment(EnvType.CLIENT)
public final class FilterAttackClient implements ClientModInitializer {
    public static FilterAttackConfig CONFIG;

    @Override
    public void onInitializeClient() {
        CONFIG = FilterAttackConfig.load();

        AttackEntityCallback.EVENT.register((player, world, hand, entity, hitResult) ->
                world.isClientSide() && isBlocked(entity) ? InteractionResult.FAIL : InteractionResult.PASS);

        ClientPreAttackCallback.EVENT.register((client, player, clickCount) ->
                client.hitResult instanceof EntityHitResult hit && isBlocked(hit.getEntity()));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (CONFIG == null) CONFIG = FilterAttackConfig.load();
        });
    }

    public static boolean isBlocked(Entity entity) {
        if (CONFIG == null || !CONFIG.enabled || entity == null) return false;
        var id = BuiltInRegistries.ENTITY_TYPE.getKey(entity.getType());
        return id != null && CONFIG.isBlocked(id.toString());
    }

    public static String getEntityId(Entity entity) {
        if (entity == null) return "unknown";
        var id = BuiltInRegistries.ENTITY_TYPE.getKey(entity.getType());
        return id == null ? "unknown" : id.toString();
    }
}
