# Design — Ajout de `media.kind` et `media.carouselTotal` dans le JSON sidecar

## Contexte

Le JSON sidecar (`amstragram-media-metadata-v1.1`) ne contient pas d'information sur le format du média (image vs vidéo) ni sur sa nature dans un carousel. Le champ `media.type` reflète le contexte Instagram (`"post"`, `"reel"`…) mais pas le format du fichier.

Le cas d'usage cible est un import de fichiers traités indépendamment : chaque JSON doit être auto-suffisant pour dériver `post_type` sans cross-référencer les autres JSONs du même shortcode.

Table de dérivation :

| `media.kind` | `media.carouselTotal` | → `post_type`  |
|---|---|---|
| `"image"` | 1 | `"image"` |
| `"video"` | 1 | `"video"` |
| `"image"` | N > 1 | `"carousel"` |
| `"video"` | N > 1 | `"carousel"` |

`carouselTotal` permet aussi de détecter un import incomplet (ex. index 1 et 3 présents mais pas 2 d'un carousel de 3).

## Champs ajoutés au JSON sidecar

Sous `media` :

```json
"media": {
  "type": "post",
  "shortcode": "ABC123",
  "id": "...",
  "index": 2,
  "extension": "jpg",
  "kind": "image",
  "carouselTotal": 3
}
```

- `kind` : `"image"` | `"video"` — format du fichier média
- `carouselTotal` : entier ≥ 1 — nombre total d'items dans le carousel ; `1` pour un post solo

## Schema bump

`amstragram-media-metadata-v1.1` → `amstragram-media-metadata-v1.2`

## Sites de modification dans `amstragram.js`

### 1. `buildMetadataSidecarPayload` (L17028, dans `FILE_METADATA_CORE`)

Lire `metadata.mediaKind` et `metadata.carouselTotal` et les exposer dans l'objet `media` retourné. Fallback `null` si absent (compatibilité avec anciens appels).

```js
media: {
  type: type || null,
  shortcode: shortcode || null,
  id: mediaId,
  index: ...,
  extension: extension || null,
  kind: typeof metadata.mediaKind === "string" ? metadata.mediaKind : null,
  carouselTotal: Number.isInteger(metadata.carouselTotal) && metadata.carouselTotal >= 1
    ? metadata.carouselTotal
    : null
}
```

### 2. `buildPostDownloadMeta` (L14427)

Ajouter dans l'objet retourné :
```js
mediaKind: item?.isVideo ? "video" : "image",
carouselTotal: Array.isArray(parsed?.items) ? parsed.items.length : 1
```

### 3. `buildProfileItemDownloadTasks` (L22032, objet `meta` dans le `tasks.push`)

Ajouter :
```js
mediaKind: selected.isVideo ? "video" : "image",
carouselTotal: mediaItems.length
```

### 4. Builder highlights (L22130, objet `meta` dans le `tasks.push`)

Ajouter :
```js
mediaKind: media.isVideo ? "video" : "image",
carouselTotal: 1
```

### 5. `buildStoryDownloadMeta` (L18797) + `buildStoryBatchTasks` (L18825)

`buildStoryDownloadMeta` ne reçoit pas `isVideo` aujourd'hui. Ajouter le paramètre et l'inclure dans le retour :

```js
function buildStoryDownloadMeta(item, safeName, isHighlight, idForName, index, ext, storyShortcode = "", isVideo = false) {
  return {
    ...
    mediaKind: isVideo ? "video" : "image",
    carouselTotal: 1
  };
}
```

Mettre à jour les deux appels :
- L18906 : `buildStoryDownloadMeta(item, safeName, isHighlight, idForName, 1, ext, storyShortcode, media.isVideo)`
- L18837 : `buildStoryDownloadMeta(item, safeName, isHighlight, itemId, i + 1, media.ext, storyShortcode, media.isVideo)`

### 6. `buildCommentMediaMenuItems` (L15491, objet `resolvedMeta`)

Ajouter :
```js
mediaKind: mediaInfo?.isVideo ? "video" : "image",
carouselTotal: 1
```

### 7. Profile pic (L21984, objet `meta` dans `buildProfilePicDownloadTask`)

Ajouter :
```js
mediaKind: "image",
carouselTotal: 1
```

## Compatibilité

Les anciens appels à `buildMetadataSidecarPayload` sans `mediaKind`/`carouselTotal` dans `meta` produiront `null` pour ces deux champs — pas de breaking change.
