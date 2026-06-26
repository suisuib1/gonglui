<script setup>
import { ref } from 'vue'
import { login } from '../services/authApi'

const emit = defineEmits(['login-success'])

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function submitLogin() {
  if (loading.value) return
  error.value = ''

  if (!email.value.trim() || !password.value) {
    error.value = '请输入邮箱和密码。'
    return
  }

  loading.value = true

  try {
    const auth = await login({
      email: email.value.trim(),
      password: password.value,
    })
    emit('login-success', auth)
  } catch (err) {
    error.value = err.message || '登录失败，请检查账号和密码。'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <form class="login-panel" @submit.prevent="submitLogin">
      <div class="brand-block">
        <span class="eyebrow">Route Check-in</span>
        <h1>登录后台</h1>
      </div>

      <label class="field">
        <span>邮箱</span>
        <input v-model="email" autocomplete="email" name="email" type="email" />
      </label>

      <label class="field">
        <span>密码</span>
        <input v-model="password" autocomplete="current-password" name="password" type="password" />
      </label>

      <button class="primary-button" type="submit" :disabled="loading">
        {{ loading ? '登录中...' : '登录' }}
      </button>

      <p v-if="error" class="error-text">{{ error }}</p>
    </form>
  </main>
</template>
