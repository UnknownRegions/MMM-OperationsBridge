# MMM-OperationsBridge

MagicMirror module for displaying the Operations Bridge wallboard view.

## Purpose

`MMM-OperationsBridge` embeds the Operations Bridge mirror surface in a MagicMirror installation so the bridge can run as a glanceable command wallboard.

The first version stays intentionally thin:
- loads the existing browser mirror view from Operations Bridge
- displays it in an iframe
- refreshes on a configurable interval
- keeps the display logic separate from the main OB app

## Example config

```js
{
  module: "MMM-OperationsBridge",
  position: "fullscreen_above",
  config: {
    bridgeUrl: "https://operations-bridge.example.com/?view=mirror&cycleMs=12000",
    reloadMinutes: 15,
    zoom: 1,
    frameHeight: "100vh",
    frameWidth: "100%"
  }
}
```

## Configuration

| Option | Type | Default | Notes |
|---|---|---:|---|
| `bridgeUrl` | string | `"http://localhost:4173/?view=mirror"` | Full URL to the Operations Bridge mirror view |
| `reloadMinutes` | number | `15` | Automatic iframe refresh interval |
| `zoom` | number | `1` | CSS scale factor for the embedded bridge |
| `frameHeight` | string | `"100vh"` | Height for the iframe shell |
| `frameWidth` | string | `"100%"` | Width for the iframe shell |
| `allowInteraction` | boolean | `false` | When false, pointer events are disabled for passive wallboard use |

## Notes

- This module assumes the Operations Bridge app exposes the mirror surface with `?view=mirror`.
- The recommended operating posture is to keep the module passive and let the OB app own all presentation logic.
- Future work can add offline fallback, auth-aware embeds, or direct data-feed rendering if the iframe posture proves too thin.
