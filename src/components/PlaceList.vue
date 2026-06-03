<script setup>
import { ref } from 'vue'
import PlaceCandidatePanel from './PlaceCandidatePanel.vue'

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

defineEmits(['select', 'use-candidate'])

const expandedPlaceId = ref('')

const statusText = {
  pending: '未解析',
  loading: '解析中',
  success: '成功',
  failed: '失败',
}

function toggleCandidates(place) {
  expandedPlaceId.value = expandedPlaceId.value === place.id ? '' : place.id
}

function coordinateText(place) {
  if (!Number.isFinite(place.lng) || !Number.isFinite(place.lat)) return ''
  return `${place.lng.toFixed(5)}, ${place.lat.toFixed(5)}`
}
</script>

<template>
  <section class="place-list">
    <div class="section-title">地点列表</div>
    <div v-if="!places.length" class="empty-state">输入地点后生成路线。</div>

    <article v-for="place in places" :key="place.id" class="place-list-item">
      <button
        class="place-card"
        :class="{ active: place.id === activePlaceId }"
        type="button"
        @click="$emit('select', place)"
      >
        <span class="place-order">{{ place.order }}</span>
        <span class="place-main">
          <strong>{{ place.name || place.inputName }}</strong>
          <small>{{ place.address || '暂无地址' }}</small>
          <small v-if="coordinateText(place)">{{ coordinateText(place) }}</small>
          <small v-if="place.candidateCount > 1" class="candidate-hint">多个候选，可切换</small>
        </span>
        <span class="status-pill" :class="place.status">{{ statusText[place.status] || place.status }}</span>
      </button>

      <button
        v-if="place.candidateCount > 1"
        class="ghost-button small candidate-toggle"
        type="button"
        @click="toggleCandidates(place)"
      >
        {{ expandedPlaceId === place.id ? '收起候选' : '切换候选' }}
      </button>

      <PlaceCandidatePanel
        v-if="expandedPlaceId === place.id"
        :place="place"
        @use-candidate="$emit('use-candidate', $event)"
      />
    </article>
  </section>
</template>
