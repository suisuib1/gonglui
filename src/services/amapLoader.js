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
      pageSize: 10,
      pageIndex: 1,
    })

    searcher.search(name, (status, result) => {
      const candidates = normalizePoiCandidates(result?.poiList?.pois)
      const firstPoi = candidates[0]

      if (status === 'complete' && firstPoi) {
        resolve({
          inputName: name,
          ...candidateToPlace(firstPoi, name),
          status: 'success',
          candidates,
          selectedCandidateIndex: 0,
          candidateCount: candidates.length,
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
        candidates: [],
        selectedCandidateIndex: -1,
        candidateCount: 0,
      })
    })
  })
}

function normalizePoiCandidates(pois) {
  if (!Array.isArray(pois)) return []

  return pois.map(normalizePoiCandidate).filter((candidate) => candidate && Number.isFinite(candidate.longitude) && Number.isFinite(candidate.latitude))
}

function normalizePoiCandidate(poi) {
  const location = poi?.location
  const longitude = Number(location?.lng ?? location?.longitude)
  const latitude = Number(location?.lat ?? location?.latitude)

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null

  const district = [poi.pname, poi.cityname, poi.adname]
    .map(toText)
    .filter(Boolean)
    .filter((value, index, source) => source.indexOf(value) === index)
    .join(' · ')

  return {
    name: toText(poi.name),
    address: toText(poi.address) || district,
    longitude,
    latitude,
    amapPoiId: toText(poi.id),
    district,
    type: toText(poi.type),
  }
}

function candidateToPlace(candidate, fallbackName) {
  return {
    name: candidate.name || fallbackName,
    address: candidate.address || candidate.district || '',
    lng: candidate.longitude,
    lat: candidate.latitude,
    amapPoiId: candidate.amapPoiId || null,
  }
}

function toText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(' ')
  return String(value ?? '').trim()
}
