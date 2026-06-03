<script setup>
import { computed, ref, watch } from 'vue'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024

const props = defineProps({
  place: {
    type: Object,
    default: null,
  },
  serverRouteId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits([
  'append-place-image',
  'close',
  'delete-place-image',
  'save-place-note',
  'update-place',
  'upload-place-image',
])

const imageType = ref('scenery')
const imageError = ref('')
const fileInput = ref(null)
const noteDraft = ref('')

const isOpen = computed(() => Boolean(props.place))
const canUploadToServer = computed(() => Boolean(props.serverRouteId && isServerPlaceId(props.place?.id)))
const filteredImages = computed(() => {
  const images = Array.isArray(props.place?.images) ? props.place.images : []
  return images.filter((image) => normalizeImageType(image) === imageType.value)
})
const currentImageCountText = computed(() => `当前分类：${imageTypeText(imageType.value)}，${filteredImages.value.length} 张`)
const emptyImageText = computed(() => `暂无${imageType.value === 'other' ? '其他图片' : imageTypeText(imageType.value)}`)

watch(
  () => props.place?.id,
  () => {
    noteDraft.value = props.place?.note || ''
    imageError.value = ''
    imageType.value = 'scenery'
  },
  { immediate: true },
)

function updateNote() {
  if (!props.place) return
  emit('update-place', {
    ...props.place,
    note: noteDraft.value,
  })
}

function saveNote() {
  if (!props.place || !canUploadToServer.value) return
  emit('save-place-note', {
    placeId: props.place.id,
    note: noteDraft.value,
  })
}

function triggerFilePicker() {
  fileInput.value?.click()
}

function onFileChange(event) {
  addFiles(Array.from(event.target.files || []))
  event.target.value = ''
}

function onPaste(event) {
  const items = Array.from(event.clipboardData?.items || [])
  const files = items
    .filter((item) => item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter(Boolean)

  if (files.length) {
    event.preventDefault()
    addFiles(files)
  }
}

function addFiles(files) {
  imageError.value = ''
  files
    .filter((file) => {
      if (!file.type.startsWith('image/')) {
        imageError.value = '只能添加图片文件。'
        return false
      }

      if (file.size > MAX_IMAGE_SIZE) {
        imageError.value = '单张图片不能超过 5MB。'
        return false
      }

      return true
    })
    .forEach((file) => {
      if (canUploadToServer.value) {
        emit('upload-place-image', {
          placeId: props.place.id,
          file,
          type: imageType.value,
        })
        return
      }

      imageError.value = '路线还未保存到服务器，已先保留本地预览。'
      readImageFile(file)
    })
}

function readImageFile(file) {
  const targetPlaceId = props.place?.id
  const targetImageType = imageType.value

  if (!targetPlaceId) return

  const reader = new FileReader()
  reader.onload = () => {
    const image = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: targetImageType,
      name: file.name || 'clipboard-image.png',
      size: file.size,
      mimeType: file.type,
      dataUrl: reader.result,
      createdAt: new Date().toISOString(),
    }

    emit('append-place-image', {
      placeId: targetPlaceId,
      image,
    })
  }
  reader.readAsDataURL(file)
}

function removeImage(image) {
  if (!props.place) return
  emit('delete-place-image', {
    placeId: props.place.id,
    image,
  })
}

function imageSrc(image) {
  return image.imageUrl || image.dataUrl
}

function imageName(image) {
  return image.name || image.originalName || 'route-image'
}

function imageTypeText(type) {
  if (type === 'scenery') return '景点图'
  if (type === 'pose') return '打卡姿势图'
  return '其他'
}

function normalizeImageType(image = {}) {
  const type = image.imageType || image.type

  if (type === 'scenery' || type === 'pose') {
    return type
  }

  return 'other'
}

function isServerPlaceId(value) {
  return /^c[a-z0-9]{20,}$/i.test(String(value || ''))
}

function formatSize(size) {
  if (!size) return ''
  return size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(size / 1024)}KB`
}
</script>

<template>
  <aside v-if="isOpen" class="detail-panel" @paste="onPaste">
    <header class="detail-header">
      <div>
        <span class="eyebrow">地点详情</span>
        <h2>{{ place.order }}. {{ place.name }}</h2>
      </div>
      <button class="icon-button" type="button" aria-label="关闭详情" @click="$emit('close')">x</button>
    </header>

    <dl class="detail-meta">
      <div>
        <dt>地址</dt>
        <dd>{{ place.address || '暂无地址' }}</dd>
      </div>
      <div>
        <dt>经纬度</dt>
        <dd v-if="place.lng && place.lat">{{ place.lng.toFixed(6) }}, {{ place.lat.toFixed(6) }}</dd>
        <dd v-else>暂无</dd>
      </div>
    </dl>

    <label class="field">
      <span>备注</span>
      <textarea
        v-model="noteDraft"
        rows="4"
        placeholder="写下打卡姿势、机位、注意事项..."
        @blur="saveNote"
        @input="updateNote"
      />
    </label>

    <div class="image-toolbar">
      <label class="field compact">
        <span>图片分类</span>
        <select v-model="imageType">
          <option value="scenery">景点图</option>
          <option value="pose">打卡姿势图</option>
          <option value="other">其他</option>
        </select>
      </label>
      <button class="secondary-button" type="button" @click="triggerFilePicker">
        {{ canUploadToServer ? '上传图片' : '本地预览' }}
      </button>
      <input ref="fileInput" class="sr-only" type="file" accept="image/*" multiple @change="onFileChange" />
    </div>

    <div class="paste-zone" tabindex="0">
      点击这里后粘贴截图或图片，单张不超过 5MB。
    </div>
    <p class="image-count-text">{{ currentImageCountText }}</p>
    <p v-if="imageError" class="error-text">{{ imageError }}</p>

    <div v-if="filteredImages.length" class="image-grid">
      <figure v-for="image in filteredImages" :key="image.id" class="image-card">
        <img :src="imageSrc(image)" :alt="imageName(image)" />
        <figcaption>
          <span>{{ imageTypeText(normalizeImageType(image)) }}</span>
          <small>{{ formatSize(image.size) }}</small>
        </figcaption>
        <button type="button" @click="removeImage(image)">删除</button>
      </figure>
    </div>
    <div v-else class="empty-state">{{ emptyImageText }}</div>
  </aside>
</template>
