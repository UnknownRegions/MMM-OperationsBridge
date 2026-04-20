# MMM-OperationsBridge

MagicMirror module for displaying the Operations Bridge wallboard view.

## Purpose

`MMM-OperationsBridge` can now run in two modes:
- `data` mode, which polls a live Operations Bridge JSON feed and renders a native MagicMirror wallboard
- `iframe` mode, which embeds the browser mirror view directly

The recommended posture is now `data` mode for lighter-weight live wallboard rendering.

## Example config

### Live data mode

```js
{
  module: "MMM-OperationsBridge",
  position: "fullscreen_above",
  config: {
    mode: "data",
    dataUrl: "http://localhost:3000/api/mirror/status",
    refreshSeconds: 30,
    maxSignalsPerSite: 4,
    showActions: false
  }
}
```

### Iframe fallback mode

```js
{
  module: "MMM-OperationsBridge",
  position: "fullscreen_above",
  config: {
    mode: "iframe",
    bridgeUrl: "http://localhost:3000/?view=mirror",
    refreshSeconds: 30,
    zoom: 1,
    frameHeight: "100vh",
    frameWidth: "100%"
  }
}
```

## Configuration

| Option | Type | Default | Notes |
|---|---|---:|---|
| `mode` | string | `"data"` | `data` renders from JSON feed, `iframe` embeds the mirror UI |
| `dataUrl` | string | `"http://localhost:3000/api/mirror/status"` | Live OB JSON feed for native MagicMirror rendering |
| `eventsUrl` | string | `"http://localhost:3000/api/bridge/events"` | SSE event stream for near-instant wallboard refresh when OB state changes |
| `bridgeUrl` | string | `"http://localhost:3000/?view=mirror"` | Browser mirror surface when using iframe mode |
| `refreshSeconds` | number | `30` | Poll interval for data mode or reload interval for iframe mode |
| `maxSignalsPerSite` | number | `4` | Maximum live telemetry signals shown per site card in data mode |
| `showActions` | boolean | `false` | Whether to show site action links in data mode |
| `zoom` | number | `1` | CSS scale factor for iframe mode |
| `frameHeight` | string | `"100vh"` | Height for iframe mode |
| `frameWidth` | string | `"100%"` | Width for iframe mode |
| `allowInteraction` | boolean | `false` | When true, iframe mode allows pointer interaction |

## Feed contract

The current live feed is served by Operations Bridge at:
- `/api/mirror/status`

It returns:
- global fleet counts by health bucket
- checked-at timestamp
- Dispatch queue and findings summary
- Operations lane counts and active cards
- Build playbook count
- per-site live summary
- per-site prioritized top signals
- optional action links

The Operations Bridge app now shares queue, findings, board, build, and site state through the server feed, so MagicMirror reflects live OB surface changes as they are saved into the shared model.

It also listens to the bridge event stream so shared-state changes can appear near instantly without waiting for the next poll interval. Polling remains as fallback protection.

The bridge server also emits a periodic heartbeat tick, so the full dashboard and wallboard keep re-syncing on an active cadence even when no one manually changes state.
