<script setup>
import { computed, onMounted, ref } from 'vue'
import { getAmapConfig, searchPlaceByName } from '../services/amapLoader'
import {
  createRoute,
  createRouteShare,
  deleteRoute,
  deleteImage,
  getRoute,
  listRoutes,
  optimizeRoute,
  planRoute,
  updatePlaceNote,
  updateRoute,
  uploadPlaceImage,
} from '../services/routeApi'
import { clearDraft, loadDraft, saveDraft } from '../utils/storage'
import { createPendingPlaces, parsePlaceNames } from '../utils/placeParser'
import MapView from './MapView.vue'
import ImagePreviewModal from './ImagePreviewModal.vue'
import PlaceDetailPanel from './PlaceDetailPanel.vue'
import PlaceList from './PlaceList.vue'
import RouteLibrary from './RouteLibrary.vue'

const routeTitle = ref('杭州打卡路线')
const city = ref('杭州')
const rawPlacesText = ref('西湖\n灵隐寺，法喜寺、河坊街\n城市阳台')
const travelMode = ref('polyline')
const smartSortEnabled = ref(false)
const sortResult = ref(null)
const places = ref([])
const plannedSegments = ref([])
const plannedSummary = ref(null)
const plannedTravelMode = ref('')
const plannedAt = ref('')
const planStale = ref(false)
const activePlaceId = ref('')
const resolving = ref(false)
const notice = ref('')
const error = ref('')
const serverRouteId = ref('')
const savedRoutes = ref([])
const loadingRoutes = ref(false)
const savingServer = ref(false)
const viewMode = ref('editor')
const libraryDetailRoute = ref(null)
const libraryDetailLoading = ref(false)
const deletingRouteId = ref('')
const previewImage = ref(null)
const sharingRouteId = ref('')
const shareRouteId = ref('')
const shareLink = ref('')
const shareMessage = ref('')

const activePlace = computed(() => places.value.find((place) => place.id === activePlaceId.value) || null)
const hasCurrentPlan = computed(() => plannedSegments.value.length > 0 && !planStale.value)

onMounted(() => {
  const draft = loadDraft()
  if (!draft) return

  routeTitle.value = draft.routeTitle || routeTitle.value
  city.value = draft.city || city.value
  rawPlacesText.value = draft.rawPlacesText || rawPlacesText.value
  travelMode.value = draft.travelMode || travelMode.value
  smartSortEnabled.value = Boolean(draft.smartSortEnabled)
  sortResult.value = draft.sortResult || null
  places.value = Array.isArray(draft.places) ? draft.places : []
  plannedSegments.value = Array.isArray(draft.plannedSegments) ? draft.plannedSegments : []
  plannedSummary.value = draft.plannedSummary || null
  plannedTravelMode.value = draft.plannedTravelMode || ''
  plannedAt.value = draft.plannedAt || ''
  planStale.value = Boolean(draft.planStale)
  serverRouteId.value = draft.serverRouteId || ''
  notice.value = draft.updatedAt ? `已读取草稿，最后保存于 ${formatDate(draft.updatedAt)}` : '已读取草稿。'
})

async function generateRoute() {
  notice.value = ''
  error.value = ''
  resetPlanSnapshot()
  sortResult.value = null

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
        amapPoiId: result.amapPoiId || previous?.amapPoiId || null,
        candidates: result.candidates || [],
        selectedCandidateIndex: result.selectedCandidateIndex ?? 0,
        candidateCount: result.candidateCount || 0,
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
        candidates: [],
        selectedCandidateIndex: -1,
        candidateCount: 0,
        note: previous?.note || '',
        images: previous?.images || [],
      }
      resolved.push(place)
      places.value = replaceAtOrder(places.value, place)
    }
  }

  let nextPlaces = resolved
  const failedCount = resolved.filter((place) => place.status === 'failed').length
  let baseNotice = failedCount ? `路线已生成，其中 ${failedCount} 个地点解析失败。` : '路线已生成。'

  if (smartSortEnabled.value) {
    try {
      const optimized = await optimizeCurrentRoute(resolved)
      if (optimized) {
        sortResult.value = optimized
        nextPlaces = reorderPlacesByOptimizedOrder(resolved, optimized.optimizedOrder)
        rawPlacesText.value = nextPlaces.map((place) => place.inputName || place.name).join('\n')
        baseNotice = `${baseNotice} 已根据预计耗时重新排序。`
      }
    } catch (err) {
      error.value = err.message || '智能排序失败，已保留原顺序。'
      baseNotice = `${baseNotice} 智能排序失败，已保留原顺序。`
    }
  }

  places.value = nextPlaces

  try {
    const plan = await planCurrentRoute(nextPlaces)
    notice.value = appendCandidateNotice(buildPlanNotice(baseNotice, plan), nextPlaces)
  } catch (err) {
    resetPlanSnapshot()
    notice.value = appendCandidateNotice(`${baseNotice} 路线规划失败，已使用简单连线兜底。`, nextPlaces)
    error.value = error.value || err.message || '路线规划失败。'
  } finally {
    resolving.value = false
  }
}

async function optimizeCurrentRoute(sourcePlaces) {
  const routePlaces = sourcePlaces.filter((place) => place.status === 'success' && Number.isFinite(place.lng) && Number.isFinite(place.lat))

  if (routePlaces.length < 2) return null

  return optimizeRoute({
    travelMode: travelMode.value,
    points: routePlaces.map((place) => ({
      name: place.name || place.inputName,
      longitude: place.lng,
      latitude: place.lat,
    })),
    options: {
      fixedStart: true,
      returnToStart: false,
      objective: 'duration',
    },
  })
}

function reorderPlacesByOptimizedOrder(sourcePlaces, optimizedOrder) {
  const successPlaces = sourcePlaces.filter((place) => place.status === 'success' && Number.isFinite(place.lng) && Number.isFinite(place.lat))
  const failedPlaces = sourcePlaces.filter((place) => !(place.status === 'success' && Number.isFinite(place.lng) && Number.isFinite(place.lat)))
  const orderedSuccess = optimizedOrder.map((index) => successPlaces[index]).filter(Boolean)
  return [...orderedSuccess, ...failedPlaces].map((place, index) => ({
    ...place,
    order: index + 1,
  }))
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
    resetPlanSnapshot()
    return null
  }

  const plan = await planRoute({
    travelMode: travelMode.value,
    points: routePoints,
  })
  setPlanSnapshot(plan)
  return plan
}

function setPlanSnapshot(plan) {
  plannedSegments.value = Array.isArray(plan?.segments) ? plan.segments : []
  plannedSummary.value = plan?.summary || null
  plannedTravelMode.value = plan?.travelMode || travelMode.value
  plannedAt.value = new Date().toISOString()
  planStale.value = false
}

function resetPlanSnapshot() {
  plannedSegments.value = []
  plannedSummary.value = null
  plannedTravelMode.value = ''
  plannedAt.value = ''
  planStale.value = false
}

function markPlanStale() {
  if (!plannedSegments.value.length) return
  planStale.value = true
}

function appendCandidateNotice(message, sourcePlaces) {
  if (!sourcePlaces.some((place) => place.candidateCount > 1)) return message
  return `${message} 部分地点存在多个候选，请确认是否选择正确。`
}

function usePlaceCandidate({ placeId, index }) {
  const targetPlace = places.value.find((place) => place.id === placeId)
  const candidate = targetPlace?.candidates?.[index]
  if (!targetPlace || !candidate) return
  if (targetPlace.selectedCandidateIndex === index) return

  places.value = places.value.map((place) =>
    place.id === placeId
      ? {
          ...place,
          name: candidate.name || place.inputName,
          address: candidate.address || candidate.district || '',
          lng: candidate.longitude,
          lat: candidate.latitude,
          amapPoiId: candidate.amapPoiId || null,
          status: 'success',
          selectedCandidateIndex: index,
          candidateCount: place.candidates?.length || 0,
        }
      : place,
  )
  markPlanStale()
  notice.value = '地点已变更，请重新生成路线。'
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
  if (!routeTitle.value.trim()) {
    error.value = '请先填写路线名称。'
    notice.value = ''
    return
  }

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
    const clearedStalePlan = planStale.value && plannedSegments.value.length > 0
    const localPlaces = places.value
    const route = serverRouteId.value ? await updateRoute(serverRouteId.value, payload) : await createRoute(payload)
    applyServerRoute(route, { preserveLocalImagesFrom: localPlaces })
    saveCurrentDraft()
    await loadSavedRoutes({ silent: true })
    notice.value = clearedStalePlan
      ? '路线和地点已保存，地点或模式已变更，请重新生成路线后再保存最新路线。'
      : '路线已保存到服务器。'
  } catch (err) {
    error.value = err.message || '路线保存到服务器失败。'
  } finally {
    savingServer.value = false
  }
}

async function loadSavedRoutes(options = {}) {
  loadingRoutes.value = true
  error.value = ''

  try {
    savedRoutes.value = await listRoutes()
    if (!options.silent) {
      notice.value = savedRoutes.value.length ? '已加载服务器路线列表。' : '服务器还没有保存的路线。'
    }
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
    const loadedSavedPlan = plannedSegments.value.length > 0
    notice.value = loadedSavedPlan ? '已加载上次保存的路线规划' : '已加载服务器路线。重新点击“生成路线”可刷新真实路线。'
    viewMode.value = 'editor'
  } catch (err) {
    error.value = err.message || '加载路线详情失败。'
  }
}

async function showRouteLibrary() {
  viewMode.value = 'library'
  await loadSavedRoutes({ silent: true })
}

function showEditor() {
  viewMode.value = 'editor'
}

async function openRouteDetail(routeId) {
  libraryDetailLoading.value = true
  error.value = ''

  try {
    libraryDetailRoute.value = await getRoute(routeId)
  } catch (err) {
    error.value = err.message || '加载路线详情失败。'
  } finally {
    libraryDetailLoading.value = false
  }
}

async function removeSavedRoute(route) {
  deletingRouteId.value = route.id
  error.value = ''
  notice.value = ''

  try {
    await deleteRoute(route.id)
    if (libraryDetailRoute.value?.id === route.id) {
      libraryDetailRoute.value = null
    }
    if (serverRouteId.value === route.id) {
      clearCurrentDraft()
    }
    if (shareRouteId.value === route.id) {
      shareRouteId.value = ''
      shareLink.value = ''
      shareMessage.value = ''
    }
    await loadSavedRoutes({ silent: true })
    notice.value = `已删除路线：${route.title}`
  } catch (err) {
    error.value = err.message || '删除路线失败。'
  } finally {
    deletingRouteId.value = ''
  }
}

async function shareSavedRoute(routeId) {
  sharingRouteId.value = routeId
  shareMessage.value = ''
  error.value = ''

  try {
    const share = await createRouteShare(routeId)
    shareRouteId.value = routeId
    shareLink.value = buildFrontendShareLink(share)
    shareMessage.value = '已生成只读分享链接。'
  } catch (err) {
    error.value = err.message || '生成分享链接失败。'
  } finally {
    sharingRouteId.value = ''
  }
}

async function copyShareLink() {
  if (!shareLink.value) return

  try {
    await navigator.clipboard.writeText(shareLink.value)
    shareMessage.value = '分享链接已复制。'
  } catch (err) {
    shareMessage.value = '复制失败，请手动选择链接复制。'
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
  if (Array.isArray(route.plannedSegments) && route.plannedSegments.length) {
    plannedSegments.value = route.plannedSegments
    plannedSummary.value = route.plannedSummary || null
    plannedTravelMode.value = route.plannedTravelMode || route.travelMode || ''
    plannedAt.value = route.plannedAt || ''
    planStale.value = false
  } else {
    resetPlanSnapshot()
  }
  sortResult.value = null
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
  const payload = {
    title: routeTitle.value.trim(),
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

  if (hasCurrentPlan.value) {
    payload.plannedTravelMode = plannedTravelMode.value || travelMode.value
    payload.plannedSegments = plannedSegments.value
    payload.plannedSummary = plannedSummary.value || null
    payload.plannedAt = plannedAt.value || new Date().toISOString()
  } else if (planStale.value && plannedSegments.value.length) {
    payload.plannedTravelMode = null
    payload.plannedSegments = null
    payload.plannedSummary = null
    payload.plannedAt = null
  }

  return payload
}

function saveCurrentDraft() {
  const result = saveDraft({
    routeTitle: routeTitle.value,
    city: city.value,
    rawPlacesText: rawPlacesText.value,
    travelMode: travelMode.value,
    smartSortEnabled: smartSortEnabled.value,
    sortResult: sortResult.value,
    places: places.value,
    plannedSegments: plannedSegments.value,
    plannedSummary: plannedSummary.value,
    plannedTravelMode: plannedTravelMode.value,
    plannedAt: plannedAt.value,
    planStale: planStale.value,
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
  smartSortEnabled.value = false
  sortResult.value = null
  places.value = []
  resetPlanSnapshot()
  serverRouteId.value = ''
  activePlaceId.value = ''
  notice.value = '草稿已清空。'
  error.value = ''
}

function formatOrder(order) {
  return order.map((index) => index + 1).join(' -> ')
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

function buildFrontendShareLink(share) {
  const token = share?.shareToken || String(share?.shareUrl || '').split('/').filter(Boolean).pop()
  return `${window.location.origin}/#/share/${encodeURIComponent(token || '')}`
}
</script>

<template>
  <div class="app-shell">
    <nav class="app-view-tabs" aria-label="应用视图">
      <button type="button" :class="{ active: viewMode === 'editor' }" @click="showEditor">路线编辑</button>
      <button type="button" :class="{ active: viewMode === 'library' }" @click="showRouteLibrary">旅游路线列表</button>
    </nav>

    <main v-if="viewMode === 'editor'" class="app-layout">
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
        <select v-model="travelMode" @change="markPlanStale">
          <option value="polyline">简单连线</option>
          <option value="driving">驾车路线</option>
          <option value="walking">步行路线</option>
        </select>
      </label>

      <label class="check-field">
        <input v-model="smartSortEnabled" type="checkbox" />
        <span>智能排序，固定第一个地点为起点</span>
      </label>

      <label class="field">
        <span>地点</span>
        <textarea
          v-model="rawPlacesText"
          rows="7"
          placeholder="一行一个地点，也支持逗号、顿号、分号分隔"
          @input="markPlanStale"
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
        <small v-if="hasCurrentPlan">
          {{ plannedSegments.length }} 个路段，{{ plannedSegments.filter((segment) => segment.fallback).length }} 个直线回退
        </small>
        <small v-if="planStale">
          地点或模式已变更，请重新生成路线后再保存最新路线。
        </small>
        <small v-if="sortResult">
          原顺序：{{ formatOrder(sortResult.originalOrder) }}
        </small>
        <small v-if="sortResult">
          推荐顺序：{{ formatOrder(sortResult.optimizedOrder) }}
        </small>
      </section>

      <section class="saved-routes">
        <div class="saved-routes-header">
          <span class="section-title">已保存路线</span>
          <div class="saved-route-tools">
            <button class="ghost-button small" type="button" :disabled="loadingRoutes" @click="loadSavedRoutes">
              {{ loadingRoutes ? '加载中' : '加载列表' }}
            </button>
            <button class="secondary-button small" type="button" @click="showRouteLibrary">查看全部路线</button>
          </div>
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
            <small v-if="route.hasPlannedRoute">已保存路线规划</small>
          </button>
        </div>
      </section>

      <p v-if="notice" class="notice-text">{{ notice }}</p>
      <p v-if="error" class="error-text">{{ error }}</p>

      <PlaceList :places="places" :active-place-id="activePlaceId" @select="selectPlace" @use-candidate="usePlaceCandidate" />
    </aside>

    <section class="workspace">
      <MapView
        :places="places"
        :active-place-id="activePlaceId"
        :planned-segments="hasCurrentPlan ? plannedSegments : []"
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

    <RouteLibrary
      v-else
      :deleting-route-id="deletingRouteId"
      :detail-loading="libraryDetailLoading"
      :detail-route="libraryDetailRoute"
      :loading="loadingRoutes"
      :routes="savedRoutes"
      :share-link="shareLink"
      :share-message="shareMessage"
      :sharing-route-id="sharingRouteId"
      @close-detail="libraryDetailRoute = null"
      @copy-share-link="copyShareLink"
      @delete-route="removeSavedRoute"
      @preview-image="previewImage = $event"
      @refresh="loadSavedRoutes"
      @share-route="shareSavedRoute"
      @view-detail="openRouteDetail"
      @view-route="loadRouteFromServer"
    />

    <ImagePreviewModal :image="previewImage" @close="previewImage = null" />
  </div>
</template>
