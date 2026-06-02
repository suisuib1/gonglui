const DRAFT_KEY = 'amap-route-checkin-draft'

export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    console.warn('读取草稿失败', error)
    return null
  }
}

export function saveDraft(draft) {
  const payload = {
    ...draft,
    updatedAt: new Date().toISOString(),
  }

  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
    return {
      ok: true,
      draft: payload,
    }
  } catch (error) {
    const isQuotaError =
      error?.name === 'QuotaExceededError' ||
      error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error?.code === 22 ||
      error?.code === 1014

    return {
      ok: false,
      message: isQuotaError
        ? '当前本地草稿容量不足，请删除部分图片或等待后续后端上传版本。'
        : '草稿保存失败，请稍后重试。',
    }
  }
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}
