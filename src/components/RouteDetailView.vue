<script setup>
import { computed } from 'vue'

const IMAGE_TYPES = [
  { value: 'scenery', label: '景点图' },
  { value: 'pose', label: '打卡姿势图' },
  { value: 'other', label: '其他' },
]

const props = defineProps({
  route: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['close', 'preview-image', 'view-route'])

const imageCount = computed(() =>
  (props.route?.places || []).reduce((sum, place) => sum + (Array.isArray(place.images) ? place.images.length : 0), 0),
)

const hasPlannedRoute = computed(() => Array.isArray(props.route?.plannedSegments) && props.route.plannedSegments.length > 0)

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
  <section class="route-detail-view">
    <div v-if="loading" class="empty-state">路线详情加载中...</div>
    <div v-else-if="!route" class="empty-state">选择一条路线查看相册和备注。</div>
    <template v-else>
      <header class="library-detail-header">
        <div>
          <span class="eyebrow">Route Album</span>
          <h2>{{ route.title }}</h2>
        </div>
        <div class="detail-actions">
          <button class="secondary-button" type="button" @click="$emit('view-route', route.id)">查看路线</button>
          <button class="ghost-button" type="button" @click="$emit('close')">关闭详情</button>
        </div>
      </header>

      <dl class="route-summary-grid">
        <div>
          <dt>城市</dt>
          <dd>{{ route.city || '未设置' }}</dd>
        </div>
        <div>
          <dt>出行方式</dt>
          <dd>{{ travelModeText(route.travelMode) }}</dd>
        </div>
        <div>
          <dt>地点总数</dt>
          <dd>{{ route.places?.length || 0 }}</dd>
        </div>
        <div>
          <dt>图片总数</dt>
          <dd>{{ imageCount }}</dd>
        </div>
        <div>
          <dt>规划快照</dt>
          <dd>{{ hasPlannedRoute ? '已保存' : '暂无' }}</dd>
        </div>
        <div>
          <dt>创建时间</dt>
          <dd>{{ formatDate(route.createdAt) }}</dd>
        </div>
        <div>
          <dt>更新时间</dt>
          <dd>{{ formatDate(route.updatedAt) }}</dd>
        </div>
      </dl>

      <div v-if="!route.places?.length" class="empty-state">这条路线还没有地点。</div>
      <article v-for="place in route.places" v-else :key="place.id" class="album-place-card">
        <header class="album-place-header">
          <span class="place-order">{{ place.order }}</span>
          <div>
            <h3>{{ place.name || place.inputName }}</h3>
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
                @click="$emit('preview-image', image)"
              >
                <img :src="image.imageUrl" :alt="imageName(image)" />
              </button>
            </div>
            <div v-else class="album-empty">暂无图片</div>
          </div>
        </section>
      </article>
    </template>
  </section>
</template>
