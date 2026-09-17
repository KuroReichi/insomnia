package com.kuroreichi.norenderspawner.mixin;

import com.kuroreichi.norenderspawner.NoRenderMobSpawnerClient;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(targets = "net.minecraft.client.renderer.blockentity.SpawnerRenderer")
public abstract class MobSpawnerBlockEntityRendererMixin {
    @Inject(method = "submit", at = @At("HEAD"), cancellable = true)
    private void noRenderMobSpawner$submit(CallbackInfo ci) {
        if (NoRenderMobSpawnerClient.CONFIG.enabled
                && NoRenderMobSpawnerClient.CONFIG.hidePreviewAndEffects) {
            ci.cancel();
        }
    }

    @Inject(method = "extractRenderState", at = @At("HEAD"), cancellable = true)
    private void noRenderMobSpawner$extractRenderState(CallbackInfo ci) {
        if (NoRenderMobSpawnerClient.CONFIG.enabled
                && NoRenderMobSpawnerClient.CONFIG.optimizeBlockEntityUpdates) {
            ci.cancel();
        }
    }
}
