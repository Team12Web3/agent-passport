const MENU_ADD = 'ytblock_add'

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ADD,
      title: 'Block this channel',
      contexts: ['link', 'image', 'selection', 'page'],
      documentUrlPatterns: ['https://www.youtube.com/*', 'https://m.youtube.com/*']
    })
  })

  const { ytBlocklist = [] } = await chrome.storage.sync.get({ ytBlocklist: [] })
  const cleaned = ytBlocklist.filter(k => !String(k).toLowerCase().startsWith('name:'))
  if (cleaned.length !== ytBlocklist.length) {
    await chrome.storage.sync.set({ ytBlocklist: cleaned })
  }
})

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage())

async function getYTActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const t = tabs && tabs[0]
  if (!t || !t.id || !t.url) return null
  if (!/^https:\/\/(www\.|m\.)?youtube\.com\//i.test(t.url)) return null
  return t
}

async function getBlacklist() {
  const { ytBlocklist } = await chrome.storage.sync.get({ ytBlocklist: [] })
  return new Set(ytBlocklist)
}

async function setBlacklist(set) {
  await chrome.storage.sync.set({ ytBlocklist: Array.from(set) })
}

async function askContent(tabId, msg) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, msg)
    if (!res) console.log('[ytblock] no response for', msg)
    return res
  } catch (e) {
    console.log('[ytblock] askContent error', msg, e && e.message)
    return null
  }
}


chrome.contextMenus.onClicked.addListener(async info => {
  if (info.menuItemId !== MENU_ADD) return
  const tab = await getYTActiveTab()
  if (!tab) return

  const last = await askContent(tab.id, { type: 'ytblock_get_last_channel' })
  if (!last || !last.key) return

  const list = await getBlacklist()
  list.add(last.key)
  await setBlacklist(list)

  await askContent(tab.id, { type: 'ytblock_refresh' })
})
