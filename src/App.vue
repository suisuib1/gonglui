<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import RouteEditor from './components/RouteEditor.vue'
import ShareRouteView from './components/ShareRouteView.vue'

const shareToken = ref(readShareToken())
const isShareMode = computed(() => Boolean(shareToken.value))

onMounted(() => {
  window.addEventListener('hashchange', updateShareToken)
  window.addEventListener('popstate', updateShareToken)
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', updateShareToken)
  window.removeEventListener('popstate', updateShareToken)
})

function updateShareToken() {
  shareToken.value = readShareToken()
}

function readShareToken() {
  const hashMatch = window.location.hash.match(/^#\/share\/([^/?#]+)/)
  if (hashMatch) return decodeURIComponent(hashMatch[1])

  const pathMatch = window.location.pathname.match(/^\/share\/([^/?#]+)/)
  if (pathMatch) return decodeURIComponent(pathMatch[1])

  return ''
}
</script>

<template>
  <ShareRouteView v-if="isShareMode" :token="shareToken" />
  <RouteEditor v-else />
</template>
