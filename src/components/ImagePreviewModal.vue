<script setup>
defineProps({
  image: {
    type: Object,
    default: null,
  },
})

defineEmits(['close'])

function imageName(image) {
  return image?.name || image?.originalName || 'route-image'
}
</script>

<template>
  <div v-if="image" class="image-preview-backdrop" @click.self="$emit('close')">
    <section class="image-preview-modal" role="dialog" aria-modal="true">
      <header class="image-preview-header">
        <strong>{{ imageName(image) }}</strong>
        <button class="icon-button" type="button" aria-label="关闭图片预览" @click="$emit('close')">x</button>
      </header>
      <img :src="image.imageUrl" :alt="imageName(image)" />
    </section>
  </div>
</template>
