let lastChannel = null
let blacklist = new Set()
let enabled = true
let noHover = false
let scanScheduled = false
let shortsBlockedApplied = false
let noHoverStyle = null

const TILE_SEL = [
  'ytd-video-renderer',
  'ytd-rich-item-renderer',
  'ytd-grid-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-reel-item-renderer',
  'ytd-reel-video-renderer',
  'ytd-playlist-panel-video-renderer'
].join(', ')

const CHANNEL_ANCHOR_SEL = [
  '#channel-name a',
  'ytd-channel-name a',
  'a#avatar-link[href^="/channel/"]',
  'a#avatar-link[href^="/@"]',
  'a[href^="/@"]'
].join(', ')

function keyFromLink(href) {
  try {
    const u = new URL(href, location.href)
    const p = u.pathname
    if (p.startsWith('/channel/')) return 'id:' + (p.split('/')[2] || '').toLowerCase()
    if (p.startsWith('/@')) return 'handle:' + p.slice(2).toLowerCase()
    if (p.startsWith('/c/') || p.startsWith('/user/')) return 'path:' + p.toLowerCase()
  } catch (e) {}
  return ''
}

function normalizeName(s) {
  return String(s || '').trim().toLowerCase()
}

function getTileFromNode(node) {
  let el = node instanceof Element ? node : null
  while (el && el !== document.documentElement) {
    if (el.matches && el.matches(TILE_SEL)) return el
    el = el.parentElement
  }
  return null
}

function getTileFromEvent(evt) {
  const path = typeof evt.composedPath === 'function' ? evt.composedPath() : []
  for (const n of path) {
    if (n instanceof Element) {
      const t = getTileFromNode(n)
      if (t) return t
    }
  }

  const stack = document.elementsFromPoint(evt.clientX, evt.clientY) || []
  for (const n of stack) {
    const t = n instanceof Element ? getTileFromNode(n) : null
    if (t) return t
  }

  const offsets = [[0, 0], [0, 2], [0, -2], [2, 0], [-2, 0], [3, 0], [-3, 0], [0, 3], [0, -3]]
  for (const [dx, dy] of offsets) {
    const el = document.elementFromPoint(evt.clientX + dx, evt.clientY + dy)
    const t = el && getTileFromNode(el)
    if (t) return t
  }

  return null
}

function queryChannelLink(tile) {
  if (!tile) return null

  let a =
    tile.querySelector('#channel-name a') ||
    tile.querySelector('ytd-channel-name a') ||
    tile.querySelector('a#avatar-link[href^="/channel/"]') ||
    tile.querySelector('a#avatar-link[href^="/@"]')

  if (!a && tile.matches('ytd-reel-item-renderer,ytd-reel-video-renderer')) {
    a =
      tile.querySelector('a[href^="/@"]') ||
      tile.querySelector('a[href^="/channel/"]')
  }

  if (!a) a = tile.querySelector(CHANNEL_ANCHOR_SEL)
  return a || null
}

function getChannelInfoFromTile(tile) {
  const link = queryChannelLink(tile)
  if (!link) return null

  const key = keyFromLink(link.getAttribute('href') || '')
  if (!key) return null

  const nameContainer =
    link.closest('#channel-name, ytd-channel-name') ||
    tile.querySelector('#channel-name') ||
    tile.querySelector('ytd-channel-name') ||
    link

  const name = nameContainer ? nameContainer.textContent.trim() : ''
  const href = link.href
  return { key, name, href }
}

function killInlinePreviewsForTile(tile) {
  tile.querySelectorAll('ytd-thumbnail, ytd-moving-thumbnail-renderer, ytd-inline-preview-renderer').forEach(n => {
    n.style.display = 'none'
  })
  tile.querySelectorAll('video').forEach(v => {
    try { v.pause() } catch (e) {}
    try { v.src = '' } catch (e) {}
    try { v.load() } catch (e) {}
    v.remove()
  })
}

function mark(tile, hide) {
  if (hide) {
    killInlinePreviewsForTile(tile)
    tile.style.display = 'none'
    tile.setAttribute('data-ytblock-hidden', '1')
  } else {
    if (tile.style.display === 'none' && tile.hasAttribute('data-ytblock-hidden')) {
      tile.style.display = ''
      tile.removeAttribute('data-ytblock-hidden')
    }
  }
}

function shouldHide(tile) {
  const info = getChannelInfoFromTile(tile)
  if (!info) return false
  if (info.key && blacklist.has(info.key)) return true

  const nameKey = info.name ? 'name:' + normalizeName(info.name) : ''
  if (nameKey && blacklist.has(nameKey)) return true

  return false
}

function scanOnce(root) {
  if (!enabled) {
    document.querySelectorAll('[data-ytblock-hidden]').forEach(el => {
      el.style.display = ''
      el.removeAttribute('data-ytblock-hidden')
    })
    return
  }

  const nodes = root.querySelectorAll(TILE_SEL)
  for (const tile of nodes) {
    const hide = shouldHide(tile)
    mark(tile, hide)
  }

  const shelves = root.querySelectorAll('ytd-item-section-renderer ytd-reel-shelf-renderer, ytd-item-section-renderer ytd-reel-item-renderer')
  for (const tile of shelves) {
    const hide = shouldHide(tile)
    mark(tile, hide)
  }

  checkShortsWatch()
}

function scheduleScan(root = document) {
  if (scanScheduled) return
  scanScheduled = true
  const run = () => {
    scanScheduled = false
    scanOnce(root)
  }
  if ('requestIdleCallback' in window) {
    requestIdleCallback(run, { timeout: 500 })
  } else {
    requestAnimationFrame(run)
  }
}

function observe() {
  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'childList' && m.addedNodes && m.addedNodes.length) {
        scheduleScan(document)
        break
      }
      if (m.type === 'attributes') {
        scheduleScan(document)
        break
      }
    }
  })
  mo.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href', 'title']
  })

  window.addEventListener('scroll', () => scheduleScan(document), { passive: true })
  window.addEventListener('yt-navigate-finish', () => {
    shortsBlockedApplied = false
    scheduleScan(document)
  }, true)
  window.addEventListener('yt-page-data-updated', () => scheduleScan(document), true)
  window.addEventListener('popstate', () => {
    shortsBlockedApplied = false
    scheduleScan(document)
  }, true)
}

function applyHoverPreviewPolicy() {
  if (!noHover) {
    if (noHoverStyle && noHoverStyle.parentNode) noHoverStyle.parentNode.removeChild(noHoverStyle)
    noHoverStyle = null
    return
  }
  if (!noHoverStyle) {
    noHoverStyle = document.createElement('style')
    noHoverStyle.id = 'ytblock-nohover-style'
    document.documentElement.appendChild(noHoverStyle)
  }
  noHoverStyle.textContent = `
    ytd-inline-preview-renderer,
    ytd-moving-thumbnail-renderer,
    ytd-thumbnail #mouseover-overlay,
    ytd-thumbnail #hover-overlays { display: none !important }
  `
  document.querySelectorAll('ytd-inline-preview-renderer video, ytd-moving-thumbnail-renderer video').forEach(v => {
    try { v.pause() } catch (e) {}
  })
}

async function loadState() {
  const { ytBlocklist, ytBlockEnabled, ytBlockNoHover } =
    await chrome.storage.sync.get({ ytBlocklist: [], ytBlockEnabled: true, ytBlockNoHover: false })
  blacklist = new Set(ytBlocklist)
  enabled = !!ytBlockEnabled
  noHover = !!ytBlockNoHover
  applyHoverPreviewPolicy()
}

chrome.storage.onChanged.addListener(changes => {
  if (changes.ytBlocklist) {
    blacklist = new Set(changes.ytBlocklist.newValue || [])
    scheduleScan(document)
  }
  if (changes.ytBlockEnabled) {
    enabled = !!changes.ytBlockEnabled.newValue
    scheduleScan(document)
  }
  if (changes.ytBlockNoHover) {
    noHover = !!changes.ytBlockNoHover.newValue
    applyHoverPreviewPolicy()
  }
})

function wireRightClickTracker() {
  document.addEventListener('contextmenu', e => {
    lastChannel = null
    const tile = getTileFromEvent(e)
    const info = tile ? getChannelInfoFromTile(tile) : null
    if (info) lastChannel = info
  }, true)

  document.addEventListener('mousemove', e => {
    if (lastChannel) return
    const tile = getTileFromNode(e.target)
    const info = tile ? getChannelInfoFromTile(tile) : null
    if (info) lastChannel = info
  }, true)
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return
  if (msg.type === 'ytblock_get_last_channel') {
    sendResponse(lastChannel || {})
    return
  }
  if (msg.type === 'ytblock_refresh') {
    scheduleScan(document)
    return
  }
})

function getShortsWatchChannelInfo() {
  const root =
    document.querySelector('ytd-reel-player-header-renderer') ||
    document.querySelector('ytd-reel-player-overlay-renderer') ||
    document

  const a =
    root.querySelector('a[href^="/@"]') ||
    root.querySelector('a[href^="/channel/"]') ||
    root.querySelector('a[href^="/c/"]') ||
    root.querySelector('a[href^="/user/"]')

  if (!a) return null
  const key = keyFromLink(a.getAttribute('href') || '')
  if (!key) return null
  const name = a.textContent.trim() || ''
  return { key, name, href: a.href }
}

function blockShortsPlayerUI() {
  if (shortsBlockedApplied) return
  shortsBlockedApplied = true

  const style = document.createElement('style')
  style.textContent = `
    ytd-reel-player-renderer,
    ytd-reel-video-renderer[is-active],
    #shorts-container,
    #shorts-inner-container { visibility: hidden !important }
    .ytblock-shorts-overlay {
      position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
      background: #000; color: #fff; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      font-size: 18px; z-index: 100000
    }
    .ytblock-shorts-overlay .inner {
      text-align: center; max-width: 520px; padding: 24px; border: 1px solid #333;
      border-radius: 12px; background: rgba(20,20,20,.9)
    }
    .ytblock-shorts-overlay button {
      margin-top: 14px; font-size: 14px; padding: 8px 12px; border: 0; border-radius: 8px; cursor: pointer
    }
  `
  document.documentElement.appendChild(style)

  const overlay = document.createElement('div')
  overlay.className = 'ytblock-shorts-overlay'
  overlay.innerHTML = `
    <div class="inner">
      <div>This short is from a blocked channel</div>
      <button id="ytblock-shorts-back">Go back</button>
    </div>
  `
  document.documentElement.appendChild(overlay)

  const backBtn = overlay.querySelector('#ytblock-shorts-back')
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (history.length > 1) history.back()
      else location.href = 'https://www.youtube.com/'
    })
  }
}

function checkShortsWatch() {
  if (!enabled) return
  if (!location.pathname.startsWith('/shorts/')) return
  const info = getShortsWatchChannelInfo()
  if (!info) return
  if (blacklist.has(info.key)) {
    blockShortsPlayerUI()
    return
  }
  const nameKey = info.name ? 'name:' + normalizeName(info.name) : ''
  if (nameKey && blacklist.has(nameKey)) blockShortsPlayerUI()
}

async function init() {
  await loadState()
  wireRightClickTracker()
  scheduleScan(document)
  observe()

  let lastPath = location.pathname
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname
      shortsBlockedApplied = false
      scheduleScan(document)
    }
  }, 500)
}

init()
