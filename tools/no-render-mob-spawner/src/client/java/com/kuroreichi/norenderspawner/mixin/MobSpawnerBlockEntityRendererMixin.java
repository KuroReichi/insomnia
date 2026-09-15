package com.kuroreichi.norenderspawner.mixin;

import com.kuroreichi.norenderspawner.NoRenderMobSpawnerClient;
import net.minecraft.block.entity.MobSpawnerBlockEntity;
import net.minecraft.client.render.block.entity.MobSpawnerBlockEntityRenderer;
import net.minecraft.client.render.block.entity.state.MobSpawnerBlockEntityRenderState;
import net.minecraft.client.render.command.ModelCommandRenderer;
import net.minecraft.client.render.command.OrderedRenderCommandQueue;
import net.minecraft.client.render.state.CameraRenderState;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.math.Vec3d;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(MobSpawnerBlockEntityRenderer.class)
public abstract class MobSpawnerBlockEntityRendererMixin {
    @Inject(method = "render", at = @At("HEAD"), cancellable = true)
    private void noRenderMobSpawner$render(MobSpawnerBlockEntityRenderState state, MatrixStack matrices, OrderedRenderCommandQueue queue, CameraRenderState cameraRenderState, CallbackInfo ci) {
        if (NoRenderMobSpawnerClient.CONFIG.enabled && NoRenderMobSpawnerClient.CONFIG.hidePreviewAndEffects) {
            ci.cancel();
        }
    }

    @Inject(method = "updateRenderState", at = @At("HEAD"), cancellable = true)
    private void noRenderMobSpawner$updateRenderState(MobSpawnerBlockEntity blockEntity, MobSpawnerBlockEntityRenderState state, float tickProgress, Vec3d cameraPos, ModelCommandRenderer.CrumblingOverlayCommand crumblingOverlay, CallbackInfo ci) {
        if (NoRenderMobSpawnerClient.CONFIG.enabled
                && NoRenderMobSpawnerClient.CONFIG.hidePreviewAndEffects
                && NoRenderMobSpawnerClient.CONFIG.optimizeBlockEntityUpdates) {
            ci.cancel();
        }
    }
}
