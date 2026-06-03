<script setup>
import RouteDetailView from './RouteDetailView.vue'

defineProps({
  routes: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  detailRoute: {
    type: Object,
    default: null,
  },
  detailLoading: {
    type: Boolean,
    default: false,
  },
  deletingRouteId: {
    type: String,
    default: '',
  },
  shareLink: {
    type: String,
    default: '',
  },
  shareMessage: {
    type: String,
    default: '',
  },
  sharingRouteId: {
    type: String,
    default: '',
  },
})

defineEmits(['close-detail', 'copy-share-link', 'delete-route', 'preview-image', 'refresh', 'share-route', 'view-detail', 'view-route'])

function travelModeText(mode) {
  if (mode === 'driving') return '驾车'
  if (mode === 'walking') return '步行'
  return '连线'
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
</script>

<template>
  <main class="library-layout">
    <section class="library-list-panel">
      <header class="library-header">
        <div>
          <span class="eyebrow">Route Library</span>
          <h1>旅游路线列表</h1>
        </div>
        <button class="secondary-button" type="button" :disabled="loading" @click="$emit('refresh')">
          {{ loading ? '刷新中...' : '刷新列表' }}
        </button>
      </header>

      <section v-if="shareLink" class="share-link-panel">
        <div>
          <strong>分享链接</strong>
          <p>{{ shareMessage || '已生成只读分享链接。' }}</p>
        </div>
        <div class="share-link-row">
          <input :value="shareLink" readonly type="text" @focus="$event.target.select()" />
          <button class="secondary-button" type="button" @click="$emit('copy-share-link')">复制</button>
        </div>
      </section>

      <div v-if="loading" class="empty-state">路线列表加载中...</div>
      <div v-else-if="!routes.length" class="empty-state">还没有保存的路线。</div>
      <div v-else class="route-library-list">
        <article v-for="route in routes" :key="route.id" class="route-library-card">
          <header>
            <div>
              <h2>{{ route.title }}</h2>
              <p>{{ route.city || '未设置城市' }}</p>
            </div>
            <span class="snapshot-badge" :class="{ muted: !route.hasPlannedRoute }">
              {{ route.hasPlannedRoute ? '有规划' : '无规划' }}
            </span>
          </header>

          <dl class="route-card-meta">
            <div>
              <dt>出行</dt>
              <dd>{{ travelModeText(route.travelMode) }}</dd>
            </div>
            <div>
              <dt>地点</dt>
              <dd>{{ route.placeCount }}</dd>
            </div>
            <div>
              <dt>图片</dt>
              <dd>{{ route.imageCount }}</dd>
            </div>
            <div>
              <dt>更新</dt>
              <dd>{{ formatDate(route.updatedAt) }}</dd>
            </div>
            <div>
              <dt>创建</dt>
              <dd>{{ formatDate(route.createdAt) }}</dd>
            </div>
          </dl>

          <div class="library-card-actions">
            <button class="secondary-button" type="button" @click="$emit('view-detail', route.id)">查看详情</button>
            <button class="primary-button" type="button" @click="$emit('view-route', route.id)">查看路线</button>
            <button class="secondary-button" type="button" :disabled="sharingRouteId === route.id" @click="$emit('share-route', route.id)">
              {{ sharingRouteId === route.id ? '生成中...' : '分享' }}
            </button>
            <button
              class="danger-button"
              type="button"
              :disabled="deletingRouteId === route.id"
              @click="$emit('delete-route', route)"
            >
              {{ deletingRouteId === route.id ? '删除中...' : '删除' }}
            </button>
          </div>
        </article>
      </div>
    </section>

    <RouteDetailView
      :loading="detailLoading"
      :route="detailRoute"
      @close="$emit('close-detail')"
      @preview-image="$emit('preview-image', $event)"
      @share-route="$emit('share-route', $event)"
      @view-route="$emit('view-route', $event)"
    />
  </main>
</template>
