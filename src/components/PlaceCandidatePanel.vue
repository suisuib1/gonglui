<script setup>
defineProps({
  place: {
    type: Object,
    required: true,
  },
})

defineEmits(['use-candidate'])

function formatCoordinate(candidate) {
  if (!Number.isFinite(candidate.longitude) || !Number.isFinite(candidate.latitude)) return '暂无经纬度'
  return `${candidate.longitude.toFixed(5)}, ${candidate.latitude.toFixed(5)}`
}
</script>

<template>
  <div class="candidate-panel">
    <div class="candidate-panel-title">候选地点</div>
    <div v-if="!place.candidates?.length" class="candidate-empty">暂无候选地点。</div>
    <article
      v-for="(candidate, index) in place.candidates"
      v-else
      :key="`${candidate.amapPoiId || candidate.name}-${index}`"
      class="candidate-card"
      :class="{ selected: index === place.selectedCandidateIndex }"
    >
      <div class="candidate-main">
        <strong>{{ candidate.name || place.inputName }}</strong>
        <span>{{ candidate.address || '暂无地址' }}</span>
        <small v-if="candidate.district">{{ candidate.district }}</small>
        <small v-if="candidate.type">{{ candidate.type }}</small>
        <small>{{ formatCoordinate(candidate) }}</small>
      </div>
      <div class="candidate-actions">
        <span v-if="index === place.selectedCandidateIndex" class="selected-candidate">当前使用</span>
        <button class="secondary-button small" type="button" @click="$emit('use-candidate', { placeId: place.id, index })">
          使用此地点
        </button>
      </div>
    </article>
  </div>
</template>
