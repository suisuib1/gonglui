<script setup>
defineProps({
  places: {
    type: Array,
    default: () => [],
  },
  activePlaceId: {
    type: String,
    default: '',
  },
})

defineEmits(['select'])

const statusText = {
  pending: '未解析',
  loading: '解析中',
  success: '成功',
  failed: '失败',
}
</script>

<template>
  <section class="place-list">
    <div class="section-title">地点列表</div>
    <div v-if="!places.length" class="empty-state">输入地点后生成路线。</div>

    <button
      v-for="place in places"
      :key="place.id"
      class="place-card"
      :class="{ active: place.id === activePlaceId }"
      type="button"
      @click="$emit('select', place)"
    >
      <span class="place-order">{{ place.order }}</span>
      <span class="place-main">
        <strong>{{ place.name || place.inputName }}</strong>
        <small>{{ place.address || '暂无地址' }}</small>
      </span>
      <span class="status-pill" :class="place.status">{{ statusText[place.status] || place.status }}</span>
    </button>
  </section>
</template>
