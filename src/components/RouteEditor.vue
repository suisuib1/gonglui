<script setup>
import { computed, onMounted, ref } from 'vue'
import { getAmapConfig, searchPlaceByName } from '../services/amapLoader'
import {
  createRoute,
  deleteImage,
  getRoute,
  listRoutes,
  planRoute,
  updatePlaceNote,
  updateRoute,
  uploadPlaceImage,
} from '../services/routeApi'
import { clearDraft, loadDraft, saveDraft } from '../utils/storage'
import { createPendingPlaces, parsePlaceNames } from '../utils/placeParser'
import MapView from './MapView.vue'
import PlaceDetailPanel from './PlaceDetailPanel.vue'
import PlaceList from './PlaceList.vue'

const routeTitle = ref('杭州打卡路线')
const city = ref('杭州')
const rawPlacesText = ref('西湖\n灵隐寺，法喜寺、河坊街\n城市阳台')
const travelMode = ref('polyline')
const places = ref([])
const plannedSegments = ref([])
const activePlaceId = ref('')
const resolving = ref(false)
const notice = ref('')
const error = ref('')
const serverRouteId = ref('')
const savedRoutes = ref([])
const loadingRoutes = ref(false)
const savingServer = ref(false)

const activePlace = computed(() => places.value.find((place) => place.id === activePlaceId.value) || null)

onMounted(() => {
  const draft = loadDraft()
  if (!draft) return

  routeTitle.value = draft.routeTitle || routeTitle.value
  city.value = draft.city || city.value
  rawPlacesText.value = draft.rawPlacesText || rawPlacesText.value
  travelMode.value = draft.travelMode || travelMode.value
  places.value = Array.isArray(draft.places) ? draft.places : []
  plannedSegments.value = Array.isArray(draft.plannedSegments) ? draft.plannedSegments : []
  serverRouteId.value = draft.serverRouteId || ''
  notice.value = draft.updatedAt ? `已读取草稿，最后保存于 ${formatDate(draft.updatedAt)}` : '已读取草稿。'
})

async function generateRoute() {
  notice.value = ''
  error.value = ''
  plannedSegments.value = []

  const names = parsePlaceNames(rawPlacesText.value)
  if (!names.length) {
    error.value = '请至少输入一个地点。'
    places.value = []
    activePlaceId.value = ''
    return
  }

  if (!getAmapConfig().key) {
    error.value = '请先根据 .env.example 配置 VITE_AMAP_KEY，然后重启开发服务器。'
    return
  }

  resolving.value = true
  const previousPlaces = places.value
  places.value = createPendingPlaces(names).map((place) => ({
    ...place,
    status: 'loading',
  }))
  activePlaceId.value = ''

  const resolved = []

  for (const [index, name] of names.entries()) {
    const previous = findExistingPlace(previousPlaces, name, index + 1)
    try {
      const result = await searchPlaceByName(name, city.value.trim())
      const place = {
        ...(previous || {}),
        id: previous?.id || `${Date.now()}-${index}-${name}`,
        order: index + 1,
        inputName: name,
        name: result.name,
        address: result.address,
        lng: result.lng,
        lat: result.lat,
        status: result.status,
        note: previous?.note || '',
        images: previous?.images || [],
      }
      resolved.push(place)
      places.value = replaceAtOrder(places.value, place)
    } catch (err) {
      const place = {
        ...(previous || {}),
        id: previous?.id || `${Date.now()}-${index}-${name}`,
        order: index + 1,
        inputName: name,
        name,
        address: '',
        lng: null,
        lat: null,
        status: 'failed',
        note: previous?.note || '',
        images: previous?.images || [],
      }
      resolved.push(place)
      places.value = replaceAtOrder(places.value, place)
    }
  }

  places.value = resolved
  const failedCount = resolved.filter((place) => place.status === 'failed').length
  const baseNotice = failedCount ? `路线已生成，其中 ${failedCount} 个地点解析失败。` : '路线已生成。'

  try {
    const plan = await planCurrentRoute(resolved)
    notice.value = buildPlanNotice(baseNotice, plan)
  } catch (err) {
    plannedSegments.value = []
    notice.value = `${baseNotice} 路线规划失败，已使用简单连线兜底。`
    error.value = err.message || '路线规划失败。'
  } finally {
    resolving.value = false
  }
}

async function planCurrentRoute(sourcePlaces) {
  const routePoints = sourcePlaces
    .filter((place) => place.status === 'success' && Number.isFinite(place.lng) && Number.isFinite(place.lat))
    .map((place) => ({
      name: place.name || place.inputName,
      longitude: place.lng,
      latitude: place.lat,
    }))

  if (routePoints.length < 2) {
    plannedSegments.value = []
    return null
  }

  const plan = await planRoute({
    travelMode: travelMode.value,
    points: routePoints,
  })
  plannedSegments.value = Array.isArray(plan.segments) ? plan.segments : []
  return plan
}

function buildPlanNotice(baseNotice, plan) {
  if (!plan) return `${baseNotice} 可规划地点不足 2 个，地图保留点位。`
  if (plan.fallbackUsed) return `${baseNotice} 部分路段已回退为直线。`
  return `${baseNotice} 已生成${travelModeText(travelMode.value)}。`
}

function replaceAtOrder(currentPlaces, nextPlace) {
  return currentPlaces.map((place) => (place.order === nextPlace.order ? nextPlace : place))
}

function findExistingPlace(sourcePlaces, inputName, order) {
  return sourcePlaces.find((place) => place.inputName === inputName && place.order === order)
}

function selectPlace(place) {
  activePlaceId.value = place.id
}

function updatePlace(nextPlace) {
  places.value = places.value.map((place) => (place.id === nextPlace.id ? nextPlace : place))
}

function appendPlaceImage({ placeId, image }) {
  const targetPlace = places.value.find((place) => place.id === placeId)
  if (!targetPlace) return

  places.value = places.value.map((place) =>
    place.id === placeId
      ? {
          ...place,
          images: [...(place.images || []), image],
        }
      : place,
  )
}

async function saveCurrentRouteToServer() {
  if (!places.value.length) {
    error.value = '请先生成路线，再保存到服务器。'
    notice.value = ''
    return
  }

  savingServer.value = true
  error.value = ''
  notice.value = ''

  try {
    const payload = buildRoutePayload()
    const localPlaces = places.value
    const route = serverRouteId.value ? await updateRoute(serverRouteId.value, payload) : await createRoute(payload)
    applyServerRoute(route, { preserveLocalImagesFrom: localPlaces })
    saveCurrentDraft()
    notice.value = '路线已保存到服务器。'
    await loadSavedRoutes()
  } catch (err) {
    error.value = err.message || '路线保存到服务器失败。'
  } finally {
    savingServer.value = false
  }
}

async function loadSavedRoutes() {
  loadingRoutes.value = true
  error.value = ''

  try {
    savedRoutes.value = await listRoutes()
    notice.value = savedRoutes.value.length ? '已加载服务器路线列表。' : '服务器还没有保存的路线。'
  } catch (err) {
    error.value = err.message || '加载服务器路线列表失败。'
  } finally {
    loadingRoutes.value = false
  }
}

async function loadRouteFromServer(routeId) {
  error.value = ''
  notice.value = ''

  try {
    const route = await getRoute(routeId)
    applyServerRoute(route)
    saveCurrentDraft()
    notice.value = '已加载服务器路线。重新点击“生成路线”可刷新真实路线。'
  } catch (err) {
    error.value = err.message || '加载路线详情失败。'
  }
}

async function uploadImageToServer({ placeId, file, type }) {
  error.value = ''
  notice.value = ''

  if (!serverRouteId.value || !isServerPlaceId(placeId)) {
    error.value = '请先保存路线到服务器，再上传图片。'
    return
  }

  try {
    const image = await uploadPlaceImage(placeId, file, type)
    appendPlaceImage({ placeId, image })
    notice.value = '图片已上传到服务器。'
  } catch (err) {
    error.value = err.message || '图片上传失败。'
  }
}

async function removePlaceImage({ placeId, image }) {
  if (!image?.imageUrl) {
    updatePlace({
      ...places.value.find((place) => place.id === placeId),
      images: (places.value.find((place) => place.id === placeId)?.images || []).filter((item) => item.id !== image.id),
    })
    return
  }

  try {
    await deleteImage(image.id)
    places.value = places.value.map((place) =>
      place.id === placeId
        ? {
            ...place,
            images: (place.images || []).filter((item) => item.id !== image.id),
          }
        : place,
    )
    notice.value = '图片已删除。'
  } catch (err) {
    error.value = err.message || '删除图片失败。'
  }
}

async function savePlaceNoteToServer({ placeId, note }) {
  if (!serverRouteId.value || !isServerPlaceId(placeId)) return

  try {
    await updatePlaceNote(placeId, note)
  } catch (err) {
    error.value = err.message || '备注保存到服务器失败。'
  }
}

function applyServerRoute(route, options = {}) {
  serverRouteId.value = route.id
  routeTitle.value = route.title || routeTitle.value
  city.value = route.city || city.value
  travelMode.value = route.travelMode || 'polyline'
  places.value = mergeLocalImages(Array.isArray(route.places) ? route.places : [], options.preserveLocalImagesFrom)
  plannedSegments.value = []
  rawPlacesText.value = places.value.map((place) => place.inputName || place.name).join('\n')
  activePlaceId.value = ''
}

function mergeLocalImages(serverPlaces, localPlaces) {
  if (!Array.isArray(localPlaces) || !localPlaces.length) return serverPlaces

  return serverPlaces.map((serverPlace, index) => {
    const localPlace = localPlaces.find((place) => place.order === serverPlace.order) || localPlaces[index]
    const localImages = (localPlace?.images || []).filter((image) => image.dataUrl && !image.imageUrl)
    if (!localImages.length) return serverPlace

    return {
      ...serverPlace,
      images: [...(serverPlace.images || []), ...localImages],
    }
  })
}

function buildRoutePayload() {
  return {
    title: routeTitle.value,
    city: city.value,
    travelMode: travelMode.value,
    places: places.value.map((place, index) => ({
      id: isServerPlaceId(place.id) ? place.id : undefined,
      name: place.name || place.inputName,
      address: place.address,
      longitude: place.lng,
      latitude: place.lat,
      sortOrder: place.order || index + 1,
      note: place.note || '',
      geocodeStatus: place.status || 'pending',
      amapPoiId: place.amapPoiId || null,
    })),
  }
}

function saveCurrentDraft() {
  const result = saveDraft({
    routeTitle: routeTitle.value,
    city: city.value,
    rawPlacesText: rawPlacesText.value,
    travelMode: travelMode.value,
    places: places.value,
    plannedSegments: plannedSegments.value,
    serverRouteId: serverRouteId.value,
  })

  if (result.ok) {
    notice.value = `草稿已保存：${formatDate(result.draft.updatedAt)}`
    error.value = ''
    return
  }

  notice.value = ''
  error.value = result.message
}

function clearCurrentDraft() {
  clearDraft()
  routeTitle.value = '杭州打卡路线'
  city.value = '杭州'
  rawPlacesText.value = ''
  travelMode.value = 'polyline'
  places.value = []
  plannedSegments.value = []
  serverRouteId.value = ''
  activePlaceId.value = ''
  notice.value = '草稿已清空。'
  error.value = ''
}

function travelModeText(mode) {
  if (mode === 'driving') return '驾车路线'
  if (mode === 'walking') return '步行路线'
  return '简单连线'
}

function isServerPlaceId(value) {
  return /^c[a-z0-9]{20,}$/i.test(String(value || ''))
}

function formatDate(value) {
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
  <main class="app-layout">
    <aside class="editor-panel">
      <div class="brand-block">
        <span class="eyebrow">Route Check-in</span>
        <h1>高德地图路线打卡</h1>
      </div>

      <label class="field">
        <span>路线名称</span>
        <input v-model="routeTitle" type="text" placeholder="例如：杭州周末路线" />
      </label>

      <label class="field">
        <span>城市</span>
        <input v-model="city" type="text" placeholder="例如：杭州" />
      </label>

      <label class="field">
        <span>路线模式</span>
        <select v-model="travelMode">
          <option value="polyline">简单连线</option>
          <option value="driving">驾车路线</option>
          <option value="walking">步行路线</option>
        </select>
      </label>

      <label class="field">
        <span>地点</span>
        <textarea
          v-model="rawPlacesText"
          rows="7"
          placeholder="一行一个地点，也支持逗号、顿号、分号分隔"
        />
      </label>

      <div class="button-row">
        <button class="primary-button" type="button" :disabled="resolving" @click="generateRoute">
          {{ resolving ? '生成中...' : '生成路线' }}
        </button>
        <button class="secondary-button" type="button" @click="saveCurrentDraft">保存草稿</button>
      </div>
      <div class="button-row">
        <button class="secondary-button" type="button" :disabled="savingServer" @click="saveCurrentRouteToServer">
          {{ savingServer ? '保存中...' : '保存到服务器' }}
        </button>
        <button class="ghost-button" type="button" @click="clearCurrentDraft">清空草稿</button>
      </div>

      <section class="route-plan-status">
        <span class="section-title">路线状态</span>
        <div class="route-mode-pill">{{ travelModeText(travelMode) }}</div>
        <small v-if="plannedSegments.length">
          {{ plannedSegments.length }} 个路段，{{ plannedSegments.filter((segment) => segment.fallback).length }} 个直线回退
        </small>
      </section>

      <section class="saved-routes">
        <div class="saved-routes-header">
          <span class="section-title">已保存路线</span>
          <button class="ghost-button small" type="button" :disabled="loadingRoutes" @click="loadSavedRoutes">
            {{ loadingRoutes ? '加载中' : '加载列表' }}
          </button>
        </div>
        <div v-if="savedRoutes.length" class="saved-route-list">
          <button
            v-for="route in savedRoutes"
            :key="route.id"
            class="saved-route-card"
            type="button"
            @click="loadRouteFromServer(route.id)"
          >
            <strong>{{ route.title }}</strong>
            <small>{{ route.city }} · {{ route.placeCount }} 个地点 · {{ route.imageCount }} 张图</small>
          </button>
        </div>
      </section>

      <p v-if="notice" class="notice-text">{{ notice }}</p>
      <p v-if="error" class="error-text">{{ error }}</p>

      <PlaceList :places="places" :active-place-id="activePlaceId" @select="selectPlace" />
    </aside>

    <section class="workspace">
      <MapView
        :places="places"
        :active-place-id="activePlaceId"
        :planned-segments="plannedSegments"
        @select-place="selectPlace"
      />
      <PlaceDetailPanel
        :place="activePlace"
        :server-route-id="serverRouteId"
        @append-place-image="appendPlaceImage"
        @close="activePlaceId = ''"
        @delete-place-image="removePlaceImage"
        @save-place-note="savePlaceNoteToServer"
        @update-place="updatePlace"
        @upload-place-image="uploadImageToServer"
      />
    </section>
  </main>
</template>
