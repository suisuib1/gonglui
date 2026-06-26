<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import LoginPage from './components/LoginPage.vue'
import RouteEditor from './components/RouteEditor.vue'
import ShareRouteView from './components/ShareRouteView.vue'
import { clearAuth, getUser, isLoggedIn, saveAuth } from './utils/authStorage'

const shareToken = ref(readShareToken())
const currentUser = ref(isLoggedIn() ? getUser() : null)
const isShareMode = computed(() => Boolean(shareToken.value))
const isAuthenticated = computed(() => Boolean(currentUser.value) && isLoggedIn())

onMounted(() => {
  window.addEventListener('hashchange', updateShareToken)
  window.addEventListener('popstate', updateShareToken)
  window.addEventListener('auth:unauthorized', handleUnauthorized)
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', updateShareToken)
  window.removeEventListener('popstate', updateShareToken)
  window.removeEventListener('auth:unauthorized', handleUnauthorized)
})

function updateShareToken() {
  shareToken.value = readShareToken()
}

function handleLoginSuccess(auth) {
  saveAuth(auth)
  currentUser.value = auth.user || null
}

function handleLogout() {
  clearAuth()
  currentUser.value = null
}

function handleUnauthorized() {
  currentUser.value = null
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
  <LoginPage v-else-if="!isAuthenticated" @login-success="handleLoginSuccess" />
  <RouteEditor v-else :user="currentUser" @logout="handleLogout" />
</template>
