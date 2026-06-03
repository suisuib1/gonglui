<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { getSharedRoute } from '../services/routeApi'
import ImagePreviewModal from './ImagePreviewModal.vue'
import MapView from './MapView.vue'

const IMAGE_TYPES = [
  { value: 'scenery', label: '景点图' },
  { value: 'pose', label: '打卡姿势图' },
  { value: 'other', label: '其他' },
]

const props = defineProps({
  token: {
    type: String,
    required: true,
  },
})

const route = ref(null)
const loading = ref(false)
const error = ref('')
const activePlaceId = ref('')
const previewImage = ref(null)

const activePlace = computed(() => route.value?.places?.find((place) => place.id === activePlaceId.value) || null)
const plannedSegments = computed(() => (Array.isArray(route.value?.plannedSegments) ? route.value.plannedSegments : []))
const imageCount = computed(() =>
  (route.value?.places || []).reduce((sum, place) => sum + (Array.isArray(place.images) ? place.images.length : 0), 0),
)

onMounted(loadSharedRoute)

watch(
  () => props.token,
  () => {
    activePlaceId.value = ''
    loadSharedRoute()
  },
)

async function loadSharedRoute() {
  loading.value = true
  error.value = ''
  route.value = null

  try {
    route.value = await getSharedRoute(props.token)
  } catch (err) {
    error.value = err.message || '路线不存在或分享已失效。'
  } finally {
    loading.value = false
  }
}

function selectPlace(place) {
  activePlaceId.value = place.id
}

function groupedImages(place, type) {
  return (place.images || []).filter((image) => (image.imageType || image.type || 'other') === type && image.imageUrl)
}

function travelModeText(mode) {
  if (mode === 'driving') return '驾车路线'
  if (mode === 'walking') return '步行路线'
  return '简单连线'
}

function formatDate(value) {
  if (!value) return '暂无'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function imageName(image) {
  return image.name || image.originalName || 'route-image'
}
</script>

<template>
  <main class="share-page">
    <section v-if="loading" class="share-state">分享路线加载中...</section>
    <section v-else-if="error" class="share-state error">
      <h1>路线不存在或分享已失效</h1>
      <p>{{ error }}</p>
    </section>
    <template v-else-if="route">
      <header class="share-header">
        <div>
          <span class="eyebrow">Shared Route</span>
          <h1>{{ route.title }}</h1>
          <p>{{ route.city || '未设置城市' }} · {{ travelModeText(route.travelMode) }}</p>
        </div>
        <dl class="share-meta">
          <div>
            <dt>地点</dt>
            <dd>{{ route.places?.length || 0 }}</dd>
          </div>
          <div>
            <dt>图片</dt>
            <dd>{{ imageCount }}</dd>
          </div>
          <div>
            <dt>路线规划</dt>
            <dd>{{ plannedSegments.length ? '已保存' : '简单连线' }}</dd>
          </div>
          <div>
            <dt>更新</dt>
            <dd>{{ formatDate(route.updatedAt) }}</dd>
          </div>
        </dl>
      </header>

      <section class="share-map-grid">
        <MapView :active-place-id="activePlaceId" :places="route.places || []" :planned-segments="plannedSegments" @select-place="selectPlace" />
        <aside class="share-active-place">
          <span class="section-title">地点信息</span>
          <template v-if="activePlace">
            <h2>{{ activePlace.order }}. {{ activePlace.name || activePlace.inputName }}</h2>
            <p>{{ activePlace.address || '暂无地址' }}</p>
            <div class="album-note">
              <strong>备注</strong>
              <p>{{ activePlace.note || '暂无备注' }}</p>
            </div>
          </template>
          <p v-else>点击地图 Marker 查看地点信息。</p>
        </aside>
      </section>

      <section class="share-place-list">
        <article v-for="place in route.places" :key="place.id" class="album-place-card">
          <header class="album-place-header">
            <button class="place-order" type="button" @click="selectPlace(place)">{{ place.order }}</button>
            <div>
              <h2>{{ place.name || place.inputName }}</h2>
              <p>{{ place.address || '暂无地址' }}</p>
            </div>
          </header>

          <section class="album-note">
            <strong>备注</strong>
            <p>{{ place.note || '暂无备注' }}</p>
          </section>

          <section class="album-groups">
            <div v-for="type in IMAGE_TYPES" :key="type.value" class="album-image-group">
              <div class="album-group-title">{{ type.label }}</div>
              <div v-if="groupedImages(place, type.value).length" class="album-image-grid">
                <button
                  v-for="image in groupedImages(place, type.value)"
                  :key="image.id"
                  class="album-thumb"
                  type="button"
                  @click="previewImage = image"
                >
                  <img :src="image.imageUrl" :alt="imageName(image)" />
                </button>
              </div>
              <div v-else class="album-empty">暂无图片</div>
            </div>
          </section>
        </article>
      </section>
    </template>

    <ImagePreviewModal :image="previewImage" @close="previewImage = null" />
  </main>
</template>
