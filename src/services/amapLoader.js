let amapPromise
const AMAP_SCRIPT_ID = 'amap-js-api-script'

export function getAmapConfig() {
  return {
    key: import.meta.env.VITE_AMAP_KEY || '',
    securityCode: import.meta.env.VITE_AMAP_SECURITY_CODE || '',
  }
}

export function loadAmap() {
  if (window.AMap) {
    return Promise.resolve(window.AMap)
  }

  if (amapPromise) {
    return amapPromise
  }

  const { key, securityCode } = getAmapConfig()

  if (!key) {
    return Promise.reject(new Error('缺少 VITE_AMAP_KEY，请先配置高德 JS API Key。'))
  }

  if (securityCode) {
    window._AMapSecurityConfig = {
      securityJsCode: securityCode,
    }
  }

  amapPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(AMAP_SCRIPT_ID)
    if (existingScript) {
      existingScript.remove()
    }

    const script = document.createElement('script')
    script.id = AMAP_SCRIPT_ID
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(
      key,
    )}&plugin=AMap.PlaceSearch,AMap.Geocoder`
    script.async = true
    script.onload = () => {
      if (window.AMap) {
        resolve(window.AMap)
      } else {
        amapPromise = null
        script.remove()
        reject(new Error('高德地图脚本已加载，但 AMap 对象不可用。'))
      }
    }
    script.onerror = () => {
      amapPromise = null
      script.remove()
      reject(new Error('高德地图脚本加载失败，请检查网络或 Key 配置。'))
    }
    document.head.appendChild(script)
  })

  return amapPromise
}

export async function searchPlaceByName(name, city) {
  const AMap = await loadAmap()

  return new Promise((resolve) => {
    const searcher = new AMap.PlaceSearch({
      city: city || '全国',
      citylimit: Boolean(city),
      pageSize: 1,
      pageIndex: 1,
    })

    searcher.search(name, (status, result) => {
      const firstPoi = result?.poiList?.pois?.[0]
      const location = firstPoi?.location

      if (status === 'complete' && firstPoi && location) {
        resolve({
          inputName: name,
          name: firstPoi.name || name,
          address: firstPoi.address || firstPoi.district || '',
          lng: Number(location.lng),
          lat: Number(location.lat),
          status: 'success',
        })
        return
      }

      resolve({
        inputName: name,
        name,
        address: '',
        lng: null,
        lat: null,
        status: 'failed',
      })
    })
  })
}
