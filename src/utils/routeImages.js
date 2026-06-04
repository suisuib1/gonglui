export const MAX_IMAGE_SIZE = 5 * 1024 * 1024

export const IMAGE_TYPES = [
  { value: 'scenery', label: '景点图' },
  { value: 'pose', label: '打卡姿势图' },
  { value: 'other', label: '其他' },
]

export function validateImageFile(file) {
  if (!file?.type?.startsWith('image/')) {
    return {
      ok: false,
      message: '只能上传图片文件。',
    }
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return {
      ok: false,
      message: '单张图片不能超过 5MB。',
    }
  }

  return {
    ok: true,
    message: '',
  }
}

export function normalizeImageType(image = {}) {
  const type = image.imageType || image.type || 'other'
  return IMAGE_TYPES.some((item) => item.value === type) ? type : 'other'
}

export function imageTypeText(type) {
  return IMAGE_TYPES.find((item) => item.value === type)?.label || '其他'
}
