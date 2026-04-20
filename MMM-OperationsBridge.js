Module.register("MMM-OperationsBridge", {
  defaults: {
    bridgeUrl: "http://localhost:4173/?view=mirror",
    reloadMinutes: 15,
    zoom: 1,
    frameHeight: "100vh",
    frameWidth: "100%",
    allowInteraction: false,
  },

  start() {
    this.lastReloadAt = Date.now()
    this.scheduleRefresh()
  },

  scheduleRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
    }

    const minutes = Number(this.config.reloadMinutes)
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return
    }

    this.refreshTimer = setInterval(() => {
      this.lastReloadAt = Date.now()
      this.updateDom(300)
    }, minutes * 60 * 1000)
  },

  getStyles() {
    return ["MMM-OperationsBridge.css"]
  },

  getDom() {
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
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  },

  resume() {
    this.lastReloadAt = Date.now()
    this.scheduleRefresh()
    this.updateDom(300)
  },
})
