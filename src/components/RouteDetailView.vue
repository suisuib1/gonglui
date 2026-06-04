<script setup>
import { computed, ref } from 'vue'
import { deleteImage, getRoute, uploadPlaceImage } from '../services/routeApi'
import { extractClipboardImageFiles, IMAGE_TYPES, normalizeImageType, validateImageFile } from '../utils/routeImages'

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

const emit = defineEmits(['close', 'delete-image', 'edit-route', 'preview-image', 'route-updated', 'share-route', 'view-route'])

const imageCount = computed(() =>
  (props.route?.places || []).reduce((sum, place) => sum + (Array.isArray(place.images) ? place.images.length : 0), 0),
)

const hasPlannedRoute = computed(() => Array.isArray(props.route?.plannedSegments) && props.route.plannedSegments.length > 0)
const failedImageIds = ref(new Set())
const uploadTypes = ref({})
const uploadErrors = ref({})
const uploadNotices = ref({})
const uploadingPlaceIds = ref(new Set())
const deletingImageIds = ref(new Set())

function groupedImages(place, type) {
  return (place.images || []).filter((image) => normalizeImageType(image) === type && image.imageUrl)
}

function placeImageCount(place) {
  return Array.isArray(place.images) ? place.images.length : 0
}

function imageKey(image) {
  return image.id || image.imageUrl
}

function markImageFailed(image) {
  const next = new Set(failedImageIds.value)
  next.add(imageKey(image))
  failedImageIds.value = next
}

function isImageFailed(image) {
  return failedImageIds.value.has(imageKey(image))
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

function uploadTypeFor(place) {
  return uploadTypes.value[place.id] || 'scenery'
}

function setUploadType(place, type) {
  uploadTypes.value = {
    ...uploadTypes.value,
    [place.id]: type,
  }
  clearPlaceMessage(place.id)
}

function triggerUpload(event, place) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  uploadImageForPlace(place, file)
}

async function uploadImageForPlace(place, file) {
  await uploadImagesForPlace(place, [file])
}

function pasteImagesForPlace(event, place) {
  const placeId = place?.id
  clearPlaceMessage(placeId)

  if (isUploading(place)) {
    event.preventDefault()
    return
  }

  const files = extractClipboardImageFiles(event.clipboardData?.items || [])
  if (!files.length) {
    setPlaceNotice(placeId, '剪贴板中没有可上传的图片')
    return
  }

  event.preventDefault()
  uploadImagesForPlace(place, files)
}

async function uploadImagesForPlace(place, files) {
  const placeId = place?.id
  clearPlaceMessage(placeId)

  if (!props.route?.id || !isServerPlaceId(placeId)) {
    setPlaceError(placeId, '请先保存路线到服务器，再上传地点图片。')
    return
  }

  const validFiles = []
  for (const file of files) {
    const validation = validateImageFile(file)
    if (!validation.ok) {
      setPlaceError(placeId, validation.message)
      return
    }
    validFiles.push(file)
  }

  setBusy(uploadingPlaceIds, placeId, true)

  try {
    for (const file of validFiles) {
      await uploadPlaceImage(placeId, file, uploadTypeFor(place))
    }
    await refreshRouteFromServer('图片上传成功', placeId)
  } catch (err) {
    setPlaceError(placeId, '图片上传失败，请重试')
  } finally {
    setBusy(uploadingPlaceIds, placeId, false)
  }
}

async function removeImageFromPlace(place, image) {
  const placeId = place?.id
  const targetImageId = image?.id
  clearPlaceMessage(placeId)

  if (!targetImageId) {
    setPlaceError(placeId, '图片缺少服务器 ID，无法删除。')
    return
  }

  setBusy(deletingImageIds, targetImageId, true)

  try {
    await deleteImage(targetImageId)
    emit('delete-image', { placeId, imageId: targetImageId })
    await refreshRouteFromServer('图片已删除。', placeId)
  } catch (err) {
    setPlaceError(placeId, err.message || '图片删除失败。')
  } finally {
    setBusy(deletingImageIds, targetImageId, false)
  }
}

async function refreshRouteFromServer(message, placeId) {
  const route = await getRoute(props.route.id)
  setPlaceNotice(placeId, message)
  emit('route-updated', route)
}

function clearPlaceMessage(placeId) {
  if (!placeId) return
  const nextErrors = { ...uploadErrors.value }
  const nextNotices = { ...uploadNotices.value }
  delete nextErrors[placeId]
  delete nextNotices[placeId]
  uploadErrors.value = nextErrors
  uploadNotices.value = nextNotices
}

function setPlaceError(placeId, message) {
  if (!placeId) return
  uploadErrors.value = {
    ...uploadErrors.value,
    [placeId]: message,
  }
}

function setPlaceNotice(placeId, message) {
  if (!placeId) return
  uploadNotices.value = {
    ...uploadNotices.value,
    [placeId]: message,
  }
}

function setBusy(targetRef, id, busy) {
  const next = new Set(targetRef.value)
  if (busy) {
    next.add(id)
  } else {
    next.delete(id)
  }
  targetRef.value = next
}

function isUploading(place) {
  return uploadingPlaceIds.value.has(place.id)
}

function isDeletingImage(image) {
  return deletingImageIds.value.has(image.id)
}

function isServerPlaceId(value) {
  return /^c[a-z0-9]{20,}$/i.test(String(value || ''))
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
          <button class="secondary-button" type="button" @click="$emit('share-route', route.id)">分享</button>
          <button class="secondary-button" type="button" @click="$emit('view-route', route.id)">查看路线</button>
          <button class="primary-button" type="button" @click="$emit('edit-route', route.id)">编辑路线</button>
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
          <span class="place-image-count">图片 {{ placeImageCount(place) }} 张</span>
        </header>

        <section class="album-note">
          <strong>备注</strong>
          <p>{{ place.note || '暂无备注' }}</p>
        </section>

        <section
          class="detail-upload-panel"
          tabindex="0"
          @paste="pasteImagesForPlace($event, place)"
        >
          <label class="field compact">
            <span>图片分类</span>
            <select :value="uploadTypeFor(place)" :disabled="isUploading(place)" @change="setUploadType(place, $event.target.value)">
              <option v-for="type in IMAGE_TYPES" :key="type.value" :value="type.value">{{ type.label }}</option>
            </select>
          </label>
          <label class="secondary-button detail-upload-button" :class="{ disabled: isUploading(place) }">
            {{ isUploading(place) ? '上传中...' : '上传图片' }}
            <input
              class="sr-only"
              type="file"
              accept="image/*"
              :disabled="isUploading(place)"
              @change="triggerUpload($event, place)"
            />
          </label>
          <p class="detail-upload-hint">点击上传图片，或将图片复制后粘贴到这里</p>
          <p v-if="uploadNotices[place.id]" class="notice-text detail-upload-message">{{ uploadNotices[place.id] }}</p>
          <p v-if="uploadErrors[place.id]" class="error-text detail-upload-message">{{ uploadErrors[place.id] }}</p>
        </section>

        <section class="album-groups">
          <div v-for="type in IMAGE_TYPES" :key="type.value" class="album-image-group">
            <div class="album-group-title">
              <span>{{ type.label }}</span>
              <span>{{ groupedImages(place, type.value).length }}</span>
            </div>
            <div v-if="groupedImages(place, type.value).length" class="album-image-grid">
              <div v-for="image in groupedImages(place, type.value)" :key="image.id" class="album-thumb-card">
                <button
                  class="album-thumb"
                  :class="{ 'is-broken': isImageFailed(image) }"
                  type="button"
                  @click="$emit('preview-image', image)"
                >
                  <img v-if="!isImageFailed(image)" :src="image.imageUrl" :alt="imageName(image)" @error="markImageFailed(image)" />
                  <span v-else class="album-image-error">图片加载失败</span>
                  <span class="album-preview-hint">点击预览</span>
                </button>
                <button
                  class="album-delete-button"
                  type="button"
                  :disabled="isDeletingImage(image)"
                  @click="removeImageFromPlace(place, image)"
                >
                  {{ isDeletingImage(image) ? '删除中...' : '删除' }}
                </button>
              </div>
            </div>
            <div v-else class="album-empty">暂无图片</div>
          </div>
        </section>
      </article>
    </template>
  </section>
</template>
