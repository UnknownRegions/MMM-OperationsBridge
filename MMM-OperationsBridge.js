Module.register("MMM-OperationsBridge", {
  defaults: {
    mode: "data",
    dataUrl: "http://localhost:3000/api/mirror/status",
    eventsUrl: "http://localhost:3000/api/bridge/events",
    bridgeUrl: "http://localhost:3000/?view=mirror",
    refreshSeconds: 30,
    zoom: 1,
    frameHeight: "100vh",
    frameWidth: "100%",
    allowInteraction: false,
    layout: "lower_third",
    maxSignalsPerSite: 2,
    maxSites: 1,
    showActions: false,
  },

  start() {
    this.feed = null
    this.error = null
    this.lastRefreshAt = null
    this.updateTimer = null
    this.eventSource = null
    this.feedSignature = null
    this.fetchInFlight = false
    this.feedStale = false

    if (this.config.mode === "iframe") {
      this.lastReloadAt = Date.now()
      this.scheduleIframeRefresh()
      return
    }

    this.fetchFeed()
    this.scheduleDataRefresh()
    this.connectEvents()
  },

  scheduleIframeRefresh() {
    if (this.updateTimer) clearInterval(this.updateTimer)
    const seconds = Math.max(Number(this.config.refreshSeconds) || 30, 5)
    this.updateTimer = setInterval(() => {
      this.lastReloadAt = Date.now()
      this.updateDom(300)
    }, seconds * 1000)
  },

  scheduleDataRefresh() {
    if (this.updateTimer) clearInterval(this.updateTimer)
    const seconds = Math.max(Number(this.config.refreshSeconds) || 30, 5)
    this.updateTimer = setInterval(() => this.fetchFeed(), seconds * 1000)
  },

  async fetchFeed() {
    if (this.fetchInFlight) return
    this.fetchInFlight = true

    try {
      const response = await fetch(this.config.dataUrl, { cache: "no-store" })
      if (!response.ok) throw new Error(`Feed returned ${response.status}`)
      const nextFeed = await response.json()
      const nextSignature = JSON.stringify(nextFeed)
      const changed = nextSignature !== this.feedSignature
      this.feed = nextFeed
      this.feedSignature = nextSignature
      this.error = null
      this.feedStale = false
      this.lastRefreshAt = Date.now()
      if (changed) this.updateDom(0)
    } catch (error) {
      const nextError = error instanceof Error ? error.message : "Feed refresh failed"
      this.feedStale = true
      if (nextError !== this.error && !this.feed) {
        this.error = nextError
        this.updateDom(0)
      }
    } finally {
      this.fetchInFlight = false
    }
  },

  connectEvents() {
    if (typeof EventSource === "undefined") return
    if (this.eventSource) this.eventSource.close()

    this.eventSource = new EventSource(this.config.eventsUrl)
    this.eventSource.addEventListener("bridge-state", () => {
      this.fetchFeed()
    })
    this.eventSource.addEventListener("bridge-tick", () => {
      this.fetchFeed()
    })
    this.eventSource.onerror = () => {
      this.feedStale = true
      if (!this.error && !this.feed) {
        this.error = "Live event stream unavailable, using refresh interval"
        this.updateDom(0)
      }
    }
  },

  getStyles() {
    return ["MMM-OperationsBridge.css"]
  },

  statusTone(status) {
    if (status === "Critical" || status === "Offline") return "danger"
    if (status === "Attention" || status === "Awaiting refresh") return "warning"
    return "success"
  },

  formatTime(value) {
    if (!value) return "No refresh yet"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "No refresh yet"
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  },

  getDom() {
    if (this.config.mode === "iframe") {
      return this.getIframeDom()
    }

    const wrapper = document.createElement("div")
    wrapper.className = `mmm-operations-bridge mmm-operations-bridge--data mmm-operations-bridge--${this.config.layout}`

    const header = document.createElement("div")
    header.className = "mmm-ob-header"

    const titleBlock = document.createElement("div")
    const eyebrow = document.createElement("div")
    eyebrow.className = "mmm-ob-eyebrow"
    eyebrow.textContent = "Operations Bridge"
    const title = document.createElement("div")
    title.className = "mmm-ob-title"
    title.textContent = "Live wallboard"
    titleBlock.appendChild(eyebrow)
    titleBlock.appendChild(title)
    header.appendChild(titleBlock)

    const refresh = document.createElement("div")
    refresh.className = "mmm-ob-refresh"
    refresh.textContent = this.feed?.checkedAt || this.lastRefreshAt
      ? `Last refresh ${this.formatTime(this.feed?.checkedAt || (this.lastRefreshAt ? new Date(this.lastRefreshAt).toISOString() : undefined))}`
      : ""
    header.appendChild(refresh)
    wrapper.appendChild(header)

    const countsRow = document.createElement("div")
    countsRow.className = "mmm-ob-counts"
    const counts = this.feed?.counts || {
      Healthy: 0,
      Attention: 0,
      Critical: 0,
      Offline: 0,
      "Awaiting refresh": 0,
    }

    Object.keys(counts).forEach((status) => {
      const tile = document.createElement("div")
      tile.className = "mmm-ob-count-tile"
      const light = document.createElement("span")
      light.className = `mmm-ob-light mmm-ob-light--${this.statusTone(status)}`
      const text = document.createElement("div")
      const strong = document.createElement("strong")
      strong.textContent = status
      const p = document.createElement("p")
      p.textContent = `${counts[status]} site(s)`
      text.appendChild(strong)
      text.appendChild(p)
      tile.appendChild(light)
      tile.appendChild(text)
      countsRow.appendChild(tile)
    })

    const actionCounts = this.feed?.actionCounts || { act: 0, monitor: 0, clear: 0 }
    const actionTile = document.createElement("div")
    actionTile.className = "mmm-ob-count-tile mmm-ob-count-tile--priority"
    const actionLight = document.createElement("span")
    actionLight.className = `mmm-ob-light mmm-ob-light--${actionCounts.act ? 'danger' : actionCounts.monitor ? 'warning' : 'success'}`
    const actionText = document.createElement("div")
    const actionStrong = document.createElement("strong")
    actionStrong.textContent = actionCounts.act ? 'Action required' : actionCounts.monitor ? 'Monitor' : 'No action'
    const actionP = document.createElement("p")
    actionP.textContent = `${actionCounts.act} act, ${actionCounts.monitor} monitor`
    actionText.appendChild(actionStrong)
    actionText.appendChild(actionP)
    actionTile.appendChild(actionLight)
    actionTile.appendChild(actionText)
    countsRow.prepend(actionTile)
    wrapper.appendChild(countsRow)

    const bridge = this.feed?.bridge || {
      dispatch: { queueTotal: 0, findingsTotal: 0, awaitingCommand: 0, reviewBeforeAdmit: 0, topQueue: [] },
      operations: { lanes: { Ready: 0, Active: 0, Review: 0, Done: 0 }, activeCards: [] },
      build: { playbooksTotal: 0 },
    }
    const program = this.feed?.program || null

    const surfaceRow = document.createElement("div")
    surfaceRow.className = "mmm-ob-surfaces"

    const dispatchTile = document.createElement("div")
    dispatchTile.className = "mmm-ob-surface-tile"
    dispatchTile.innerHTML = `<div class="mmm-ob-surface-title">Dispatch</div><div class="mmm-ob-surface-metric">${bridge.dispatch.queueTotal}</div><div class="mmm-ob-surface-copy">Queue, ${bridge.dispatch.findingsTotal} findings</div>`
    surfaceRow.appendChild(dispatchTile)

    const operationsTile = document.createElement("div")
    operationsTile.className = "mmm-ob-surface-tile"
    operationsTile.innerHTML = `<div class="mmm-ob-surface-title">Operations</div><div class="mmm-ob-surface-metric">${bridge.operations.lanes.Active || 0}</div><div class="mmm-ob-surface-copy">Active, ${bridge.operations.lanes.Review || 0} in review</div>`
    surfaceRow.appendChild(operationsTile)

    const buildTile = document.createElement("div")
    buildTile.className = "mmm-ob-surface-tile"
    buildTile.innerHTML = `<div class="mmm-ob-surface-title">Build</div><div class="mmm-ob-surface-metric">${bridge.build.playbooksTotal}</div><div class="mmm-ob-surface-copy">Live playbooks</div>`
    surfaceRow.appendChild(buildTile)

    if (program) {
      const programTile = document.createElement("div")
      programTile.className = "mmm-ob-surface-tile"
      programTile.innerHTML = `<div class="mmm-ob-surface-title">Design loop</div><div class="mmm-ob-surface-metric">${program.dailyTarget}</div><div class="mmm-ob-surface-copy">${program.phase}</div>`
      surfaceRow.appendChild(programTile)
    }

    wrapper.appendChild(surfaceRow)

    if (program) {
      const programPanel = document.createElement("div")
      programPanel.className = "mmm-ob-program"
      programPanel.innerHTML = `
        <div class="mmm-ob-program-head">
          <div>
            <div class="mmm-ob-list-title">${program.title}</div>
            <strong>${program.lowestCategory ? `${program.lowestCategory.label} (${program.lowestCategory.count})` : 'No active category pressure'}</strong>
          </div>
          <span class="mmm-ob-status mmm-ob-status--warning">${program.phase}</span>
        </div>
        <div class="mmm-ob-program-grid">
          <div class="mmm-ob-program-cell"><span>Reserve</span><strong>${program.reserveReady}/${program.reserveTarget}</strong></div>
          <div class="mmm-ob-program-cell"><span>Approved</span><strong>${program.approvedToday}</strong></div>
          <div class="mmm-ob-program-cell"><span>Published</span><strong>${program.publishedToday}</strong></div>
          <div class="mmm-ob-program-cell"><span>Next run</span><strong>${program.nextRunDate || 'Unset'}</strong></div>
        </div>
      `
      wrapper.appendChild(programPanel)
    }

    const queueAndOps = document.createElement("div")
    queueAndOps.className = "mmm-ob-lists"

    const queueList = document.createElement("div")
    queueList.className = "mmm-ob-list"
    queueList.innerHTML = '<div class="mmm-ob-list-title">Top queue</div>'
    ;(bridge.dispatch.topQueue || []).slice(0, 4).forEach((item) => {
      const row = document.createElement("div")
      row.className = "mmm-ob-list-row"
      row.innerHTML = `<strong>${item.title}</strong><span>${item.status}</span>`
      queueList.appendChild(row)
    })
    if (!(bridge.dispatch.topQueue || []).length) {
      const row = document.createElement("div")
      row.className = "mmm-ob-list-row"
      row.innerHTML = '<strong>No queued work</strong><span>Live</span>'
      queueList.appendChild(row)
    }
    queueAndOps.appendChild(queueList)

    const opsList = document.createElement("div")
    opsList.className = "mmm-ob-list"
    opsList.innerHTML = '<div class="mmm-ob-list-title">Active operations</div>'
    ;(bridge.operations.activeCards || []).slice(0, 4).forEach((item) => {
      const row = document.createElement("div")
      row.className = "mmm-ob-list-row"
      row.innerHTML = `<strong>${item.title}</strong><span>${item.owner || 'Unassigned'}</span>`
      opsList.appendChild(row)
    })
    if (!(bridge.operations.activeCards || []).length) {
      const row = document.createElement("div")
      row.className = "mmm-ob-list-row"
      row.innerHTML = '<strong>No active cards</strong><span>Live</span>'
      opsList.appendChild(row)
    }
    queueAndOps.appendChild(opsList)

    wrapper.appendChild(queueAndOps)

    const sitesGrid = document.createElement("div")
    sitesGrid.className = "mmm-ob-sites"

    if (!this.feed?.sites?.length) {
      const empty = document.createElement("div")
      empty.className = "mmm-ob-site"
      empty.innerHTML = '<div class="mmm-ob-site-header"><div class="mmm-ob-site-left"><span class="mmm-ob-light mmm-ob-light--warning"></span><div><strong>Operations Bridge</strong><p>Live data warming up</p></div></div></div>'
      sitesGrid.appendChild(empty)
    } else {
      this.feed.sites.slice(0, this.config.maxSites).forEach((site) => {
        const card = document.createElement("div")
        card.className = "mmm-ob-site"

        const siteHeader = document.createElement("div")
        siteHeader.className = "mmm-ob-site-header"

        const left = document.createElement("div")
        left.className = "mmm-ob-site-left"
        const light = document.createElement("span")
        light.className = `mmm-ob-light mmm-ob-light--${this.statusTone(site.status)}`
        const identity = document.createElement("div")
        const name = document.createElement("strong")
        name.textContent = site.name
        const domain = document.createElement("p")
        domain.textContent = site.domain
        identity.appendChild(name)
        identity.appendChild(domain)
        left.appendChild(light)
        left.appendChild(identity)

        const status = document.createElement("div")
        status.className = `mmm-ob-status mmm-ob-status--${this.statusTone(site.status)}`
        status.textContent = site.status

        siteHeader.appendChild(left)
        siteHeader.appendChild(status)
        card.appendChild(siteHeader)

        const summary = document.createElement("div")
        summary.className = "mmm-ob-summary"
        summary.textContent = site.summary || "No summary available"
        card.appendChild(summary)

        if (site.actionSummary) {
          const actionRow = document.createElement("div")
          actionRow.className = `mmm-ob-action mmm-ob-action--${site.actionState || 'success'}`
          actionRow.textContent = site.actionSummary
          card.appendChild(actionRow)
        }

        const signalGrid = document.createElement("div")
        signalGrid.className = "mmm-ob-signals"
        ;(site.topSignals || []).slice(0, this.config.maxSignalsPerSite).forEach((signal) => {
          const chip = document.createElement("div")
          chip.className = `mmm-ob-signal mmm-ob-signal--${signal.tone}`
          const label = document.createElement("span")
          label.textContent = signal.label
          const value = document.createElement("strong")
          value.textContent = signal.value
          chip.appendChild(label)
          chip.appendChild(value)
          signalGrid.appendChild(chip)
        })
        card.appendChild(signalGrid)

        const footer = document.createElement("div")
        footer.className = "mmm-ob-footer"
        footer.textContent = `Updated ${this.formatTime(site.checkedAt)}`
        card.appendChild(footer)

        if (this.config.showActions && Array.isArray(site.actions) && site.actions.length) {
          const actions = document.createElement("div")
          actions.className = "mmm-ob-actions"
          site.actions.forEach((action) => {
            if (!action.href) return
            const link = document.createElement("a")
            link.className = "mmm-ob-link"
            link.href = action.href
            link.target = "_blank"
            link.rel = "noreferrer"
            link.textContent = action.label
            actions.appendChild(link)
          })
          card.appendChild(actions)
        }

        sitesGrid.appendChild(card)
      })
    }

    wrapper.appendChild(sitesGrid)
    return wrapper
  },

  getIframeDom() {
    const wrapper = document.createElement("div")
    wrapper.className = "mmm-operations-bridge"
    wrapper.style.width = this.config.frameWidth
    wrapper.style.height = this.config.frameHeight

    const frame = document.createElement("iframe")
    const separator = this.config.bridgeUrl.includes("?") ? "&" : "?"
    frame.src = `${this.config.bridgeUrl}${separator}ts=${this.lastReloadAt}`
    frame.className = "mmm-operations-bridge__frame"
    frame.style.width = "100%"
    frame.style.height = "100%"
    frame.style.transform = `scale(${this.config.zoom})`
    frame.style.transformOrigin = "top left"
    frame.style.pointerEvents = this.config.allowInteraction ? "auto" : "none"
    frame.setAttribute("scrolling", "no")
    frame.setAttribute("loading", "eager")
    frame.setAttribute("referrerpolicy", "no-referrer")

    wrapper.appendChild(frame)
    return wrapper
  },

  suspend() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = null
    }
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
  },

  resume() {
    if (this.config.mode === "iframe") {
      this.lastReloadAt = Date.now()
      this.scheduleIframeRefresh()
    } else {
      this.fetchFeed()
      this.scheduleDataRefresh()
      this.connectEvents()
    }
    this.updateDom(0)
  },
})
