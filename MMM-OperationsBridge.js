Module.register("MMM-OperationsBridge", {
  defaults: {
    mode: "data",
    dataUrl: "http://localhost:3000/api/mirror/status",
    bridgeUrl: "http://localhost:3000/?view=mirror",
    refreshSeconds: 30,
    zoom: 1,
    frameHeight: "100vh",
    frameWidth: "100%",
    allowInteraction: false,
    maxSignalsPerSite: 4,
    showActions: false,
  },

  start() {
    this.feed = null
    this.error = null
    this.lastRefreshAt = null
    this.updateTimer = null

    if (this.config.mode === "iframe") {
      this.lastReloadAt = Date.now()
      this.scheduleIframeRefresh()
      return
    }

    this.fetchFeed()
    this.scheduleDataRefresh()
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
    try {
      const response = await fetch(this.config.dataUrl, { cache: "no-store" })
      if (!response.ok) throw new Error(`Feed returned ${response.status}`)
      this.feed = await response.json()
      this.error = null
      this.lastRefreshAt = Date.now()
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Feed refresh failed"
    }

    this.updateDom(300)
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
    wrapper.className = "mmm-operations-bridge mmm-operations-bridge--data"

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
    refresh.textContent = this.error
      ? `Feed error: ${this.error}`
      : `Last refresh ${this.formatTime(this.feed?.checkedAt || (this.lastRefreshAt ? new Date(this.lastRefreshAt).toISOString() : undefined))}`
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
    wrapper.appendChild(countsRow)

    const sitesGrid = document.createElement("div")
    sitesGrid.className = "mmm-ob-sites"

    if (!this.feed?.sites?.length) {
      const empty = document.createElement("div")
      empty.className = "mmm-ob-site"
      empty.textContent = this.error || "Awaiting live data"
      sitesGrid.appendChild(empty)
    } else {
      this.feed.sites.forEach((site) => {
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
  },

  resume() {
    if (this.config.mode === "iframe") {
      this.lastReloadAt = Date.now()
      this.scheduleIframeRefresh()
    } else {
      this.fetchFeed()
      this.scheduleDataRefresh()
    }
    this.updateDom(300)
  },
})
