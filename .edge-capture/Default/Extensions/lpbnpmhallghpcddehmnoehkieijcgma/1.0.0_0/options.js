const listEl = document.getElementById('list')
const keyEl = document.getElementById('key')
const addBtn = document.getElementById('add')
const enabledEl = document.getElementById('enabled')
const noHoverEl = document.getElementById('nohover')

async function getState() {
  const { ytBlocklist, ytBlockEnabled, ytBlockNoHover } =
    await chrome.storage.sync.get({ ytBlocklist: [], ytBlockEnabled: true, ytBlockNoHover: false })
  return { set: new Set(ytBlocklist), enabled: !!ytBlockEnabled, noHover: !!ytBlockNoHover }
}

async function setList(set) {
  await chrome.storage.sync.set({ ytBlocklist: Array.from(set) })
}

async function setEnabled(on) {
  await chrome.storage.sync.set({ ytBlockEnabled: !!on })
}

async function setNoHover(on) {
  await chrome.storage.sync.set({ ytBlockNoHover: !!on })
}

function render(items) {
  listEl.innerHTML = ''
  for (const key of items) {
    const div = document.createElement('div')
    div.className = 'item'
    div.innerHTML = `<span class="key">${key}</span><button data-k="${key}">Remove</button>`
    listEl.appendChild(div)
  }
}

async function refresh() {
  const { set, enabled, noHover } = await getState()
  enabledEl.checked = enabled
  noHoverEl.checked = noHover
  render(set)
}

addBtn.addEventListener('click', async () => {
  const val = keyEl.value.trim()
  if (!val) return
  const { set } = await getState()
  const key = val.startsWith('/@') ? 'handle:' + val.slice(2).toLowerCase()
    : val.startsWith('@') ? 'handle:' + val.slice(1).toLowerCase()
      : val.startsWith('UC') ? 'id:' + val.toLowerCase()
        : val.startsWith('/channel/') ? 'id:' + val.split('/')[2].toLowerCase()
          : val.startsWith('/c/') || val.startsWith('/user/') ? 'path:' + val.toLowerCase()
            : val
  set.add(key)
  await setList(set)
  keyEl.value = ''
  await refresh()
})

listEl.addEventListener('click', async e => {
  const k = e.target && e.target.getAttribute('data-k')
  if (!k) return
  const { set } = await getState()
  set.delete(k)
  await setList(set)
  await refresh()
})

enabledEl.addEventListener('change', async () => {
  await setEnabled(enabledEl.checked)
})

noHoverEl.addEventListener('change', async () => {
  await setNoHover(noHoverEl.checked)
})

refresh()