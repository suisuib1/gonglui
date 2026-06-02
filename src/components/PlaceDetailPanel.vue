<script setup>
import { computed, ref, watch } from 'vue'

const MAX_IMAGE_SIZE = 1 * 1024 * 1024

const props = defineProps({
  place: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['append-place-image', 'close', 'update-place'])

const imageType = ref('scenery')
const imageError = ref('')
const fileInput = ref(null)
const noteDraft = ref('')

const isOpen = computed(() => Boolean(props.place))

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
        imageError.value = '单张图片不能超过 1MB。'
        return false
      }

      return true
    })
    .forEach(readImageFile)
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

function removeImage(imageId) {
  if (!props.place) return
  emit('update-place', {
    ...props.place,
    images: (props.place.images || []).filter((image) => image.id !== imageId),
  })
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
      <button class="icon-button" type="button" aria-label="关闭详情" @click="$emit('close')">×</button>
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
      <textarea v-model="noteDraft" rows="4" placeholder="写下打卡姿势、机位、注意事项..." @input="updateNote" />
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
      <button class="secondary-button" type="button" @click="triggerFilePicker">上传图片</button>
      <input ref="fileInput" class="sr-only" type="file" accept="image/*" multiple @change="onFileChange" />
    </div>

    <div class="paste-zone" tabindex="0">
      点击这里后粘贴截图或图片，单张不超过 1MB。
    </div>
    <p v-if="imageError" class="error-text">{{ imageError }}</p>

    <div v-if="place.images?.length" class="image-grid">
      <figure v-for="image in place.images" :key="image.id" class="image-card">
        <img :src="image.dataUrl" :alt="image.name" />
        <figcaption>
          <span>{{ image.type === 'scenery' ? '景点图' : image.type === 'pose' ? '打卡姿势图' : '其他' }}</span>
          <small>{{ formatSize(image.size) }}</small>
        </figcaption>
        <button type="button" @click="removeImage(image.id)">删除</button>
      </figure>
    </div>
    <div v-else class="empty-state">还没有图片。</div>
  </aside>
</template>
