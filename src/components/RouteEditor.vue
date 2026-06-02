<script setup>
import { computed, onMounted, ref } from 'vue'
import { getAmapConfig, searchPlaceByName } from '../services/amapLoader'
import { clearDraft, loadDraft, saveDraft } from '../utils/storage'
import { createPendingPlaces, parsePlaceNames } from '../utils/placeParser'
import MapView from './MapView.vue'
import PlaceDetailPanel from './PlaceDetailPanel.vue'
import PlaceList from './PlaceList.vue'

const routeTitle = ref('杭州打卡路线')
const city = ref('杭州')
const rawPlacesText = ref('西湖\n灵隐寺，法喜寺、河坊街\n城市阳台')
const places = ref([])
const activePlaceId = ref('')
const resolving = ref(false)
const notice = ref('')
const error = ref('')

const activePlace = computed(() => places.value.find((place) => place.id === activePlaceId.value) || null)

onMounted(() => {
  const draft = loadDraft()
  if (!draft) return

  routeTitle.value = draft.routeTitle || routeTitle.value
  city.value = draft.city || city.value
  rawPlacesText.value = draft.rawPlacesText || rawPlacesText.value
  places.value = Array.isArray(draft.places) ? draft.places : []
  notice.value = draft.updatedAt ? `已读取草稿，最后保存于 ${formatDate(draft.updatedAt)}` : '已读取草稿。'
})

async function generateRoute() {
  notice.value = ''
  error.value = ''

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

  resolving.value = false
  const failedCount = resolved.filter((place) => place.status === 'failed').length
  notice.value = failedCount ? `路线已生成，其中 ${failedCount} 个地点解析失败。` : '路线已生成。'
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

function saveCurrentDraft() {
  const result = saveDraft({
    routeTitle: routeTitle.value,
    city: city.value,
    rawPlacesText: rawPlacesText.value,
    places: places.value,
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
  places.value = []
  activePlaceId.value = ''
  notice.value = '草稿已清空。'
  error.value = ''
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
      <button class="ghost-button" type="button" @click="clearCurrentDraft">清空草稿</button>

      <p v-if="notice" class="notice-text">{{ notice }}</p>
      <p v-if="error" class="error-text">{{ error }}</p>

      <PlaceList :places="places" :active-place-id="activePlaceId" @select="selectPlace" />
    </aside>

    <section class="workspace">
      <MapView :places="places" :active-place-id="activePlaceId" @select-place="selectPlace" />
      <PlaceDetailPanel
        :place="activePlace"
        @append-place-image="appendPlaceImage"
        @close="activePlaceId = ''"
        @update-place="updatePlace"
      />
    </section>
  </main>
</template>
