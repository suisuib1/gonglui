<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getAmapConfig, loadAmap } from '../services/amapLoader'

const props = defineProps({
  places: {
    type: Array,
    default: () => [],
  },
  activePlaceId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['select-place'])

const mapEl = ref(null)
const loading = ref(false)
const error = ref('')
const mapReady = ref(false)
const missingKey = computed(() => !getAmapConfig().key)
const hasVisiblePlaces = computed(() =>
  props.places.some((place) => place.status === 'success' && Number.isFinite(place.lng) && Number.isFinite(place.lat)),
)

let map
let markers = []
let polyline

onMounted(initMap)

onBeforeUnmount(() => {
  clearOverlays()
  map?.destroy?.()
})

watch(
  () => props.places,
  () => {
    if (mapReady.value) renderPlaces()
  },
  { deep: true },
)

watch(
  () => props.activePlaceId,
  () => {
    if (mapReady.value) renderMarkerStates()
  },
)

async function initMap() {
  if (missingKey.value) {
    error.value = '请先根据 .env.example 配置 VITE_AMAP_KEY，然后重启开发服务器。'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const AMap = await loadAmap()
    map = new AMap.Map(mapEl.value, {
      zoom: 11,
      center: [120.1551, 30.2741],
      viewMode: '2D',
    })
    mapReady.value = true
    renderPlaces()
  } catch (err) {
    error.value = err.message || '地图加载失败。'
  } finally {
    loading.value = false
  }
}

function clearOverlays() {
  if (!map) return
  markers.forEach((marker) => map.remove(marker))
  markers = []
  if (polyline) {
    map.remove(polyline)
    polyline = null
  }
}

function renderPlaces() {
  if (!window.AMap || !map) return

  clearOverlays()

  const points = props.places.filter(
    (place) => place.status === 'success' && Number.isFinite(place.lng) && Number.isFinite(place.lat),
  )

  markers = points.map((place) => {
    const marker = new window.AMap.Marker({
      position: [place.lng, place.lat],
      title: place.name,
      label: {
        content: `<div class="amap-marker-label-inner">${place.order}</div>`,
        direction: 'top',
      },
    })

    marker.setExtData(place.id)
    marker.on('click', () => emit('select-place', place))
    marker.setMap(map)
    return marker
  })

  if (points.length >= 2) {
    polyline = new window.AMap.Polyline({
      path: points.map((place) => [place.lng, place.lat]),
      strokeColor: '#2563eb',
      strokeWeight: 5,
      strokeOpacity: 0.85,
      lineJoin: 'round',
    })
    polyline.setMap(map)
  }

  if (points.length) {
    map.setFitView(markers, false, [60, 60, 60, 60])
  }

  renderMarkerStates()
}

function renderMarkerStates() {
  markers.forEach((marker) => {
    const place = props.places.find((item) => item.id === marker.getExtData())
    if (!place) return
    marker.setzIndex(place.id === props.activePlaceId ? 120 : 100)
  })
}
</script>

<template>
  <section class="map-shell">
    <div ref="mapEl" class="map-container"></div>
    <div v-if="mapReady && !hasVisiblePlaces" class="map-message">请输入地点并生成路线。</div>
    <div v-if="loading" class="map-message">地图加载中...</div>
    <div v-if="error" class="map-message error">{{ error }}</div>
  </section>
</template>
