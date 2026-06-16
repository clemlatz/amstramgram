# mediaKind + carouselTotal dans le JSON sidecar — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter `media.kind` ("image"|"video") et `media.carouselTotal` (entier ≥ 1) au JSON sidecar Amstragram, en alimentant ces champs depuis chaque point de construction de l'objet `meta`.

**Architecture:** Toutes les modifications sont dans `amstragram.js`. Les objets `meta` sont construits à 6 endroits distincts ; chacun reçoit deux nouveaux champs (`mediaKind`, `carouselTotal`). La fonction `buildMetadataSidecarPayload` (L17028) lit ces champs et les expose dans l'objet `media` du JSON. Le numéro de schéma passe de `v1.1` à `v1.2`. Aucun test automatisé disponible — vérification manuelle par inspection du JSON produit.

**Tech Stack:** JavaScript (userscript Tampermonkey), fichier unique `amstragram.js`.

---

### Task 1 : `buildMetadataSidecarPayload` — exposer `kind` et `carouselTotal` + bump de schéma

**Files:**
- Modify: `amstragram.js:17028-17076`

- [ ] **Étape 1 : Localiser la ligne du schéma et la modifier**

Trouver (L17051) :
```js
      schema: "amstragram-media-metadata-v1.1",
```
Remplacer par :
```js
      schema: "amstragram-media-metadata-v1.2",
```

- [ ] **Étape 2 : Ajouter `kind` et `carouselTotal` dans l'objet `media` retourné**

Trouver (L17056–17062) :
```js
      media: {
        type: type || null,
        shortcode: shortcode || null,
        id: mediaId,
        index: Number.isFinite(numericIndex) && numericIndex > 0 ? Math.floor(numericIndex) : null,
        extension: extension || null
      },
```
Remplacer par :
```js
      media: {
        type: type || null,
        shortcode: shortcode || null,
        id: mediaId,
        index: Number.isFinite(numericIndex) && numericIndex > 0 ? Math.floor(numericIndex) : null,
        extension: extension || null,
        kind: typeof metadata.mediaKind === "string" && metadata.mediaKind ? metadata.mediaKind : null,
        carouselTotal: Number.isInteger(metadata.carouselTotal) && metadata.carouselTotal >= 1
          ? metadata.carouselTotal
          : null
      },
```

- [ ] **Étape 3 : Vérifier visuellement**

Chercher `amstragram-media-metadata-v1.2` dans le fichier — doit apparaître exactement une fois.
Chercher `carouselTotal` dans `buildMetadataSidecarPayload` — doit apparaître dans le bloc `media`.

- [ ] **Étape 4 : Commit**

```bash
git add amstragram.js
git commit -m "feat: expose media.kind and media.carouselTotal in JSON sidecar (schema v1.2)"
```

---

### Task 2 : `buildPostDownloadMeta` — posts et reels (clic droit)

**Files:**
- Modify: `amstragram.js:14413-14443`

- [ ] **Étape 1 : Ajouter `mediaKind` et `carouselTotal` dans l'objet retourné**

Trouver (L14427–14442) :
```js
    return {
      type: mediaType,
      username: parsed?.username || "instagram",
      fullName: parsed?.fullName || "",
      shortcode: shortcode || parsed?.code || "",
      id: mediaId,
      index: index,
      ext: ext,
      caption: metadata.caption || "",
      altText: metadata.altText || "",
      hashtags: Array.isArray(metadata.hashtags) ? metadata.hashtags : [],
      takenAt: metadata.takenAt ?? null,
      authorId: metadata.authorId || "",
      authorUsername: metadata.authorUsername || (parsed?.username || "instagram"),
      permalink: metadata.permalink || fallbackPermalink
    };
```
Remplacer par :
```js
    return {
      type: mediaType,
      username: parsed?.username || "instagram",
      fullName: parsed?.fullName || "",
      shortcode: shortcode || parsed?.code || "",
      id: mediaId,
      index: index,
      ext: ext,
      caption: metadata.caption || "",
      altText: metadata.altText || "",
      hashtags: Array.isArray(metadata.hashtags) ? metadata.hashtags : [],
      takenAt: metadata.takenAt ?? null,
      authorId: metadata.authorId || "",
      authorUsername: metadata.authorUsername || (parsed?.username || "instagram"),
      permalink: metadata.permalink || fallbackPermalink,
      mediaKind: item?.isVideo ? "video" : "image",
      carouselTotal: Array.isArray(parsed?.items) && parsed.items.length >= 1 ? parsed.items.length : 1
    };
```

- [ ] **Étape 2 : Vérifier visuellement**

Chercher `mediaKind` dans `buildPostDownloadMeta` — doit apparaître dans l'objet retourné.

- [ ] **Étape 3 : Commit**

```bash
git add amstragram.js
git commit -m "feat: add mediaKind/carouselTotal to post/reel download meta"
```

---

### Task 3 : `buildProfileItemDownloadTasks` — téléchargement en masse de profil

**Files:**
- Modify: `amstragram.js:22028-22057`

- [ ] **Étape 1 : Ajouter `mediaKind` et `carouselTotal` dans l'objet `meta`**

Trouver (L22032–22046) :
```js
        meta: {
          type: mediaType,
          username: username,
          shortcode: shortcode,
          id: mediaId,
          index: i + 1,
          ext: selected.ext,
          caption: mediaMetadata.caption || sharedMetadata.caption || "",
          altText: mediaMetadata.altText || sharedMetadata.altText || "",
          hashtags: mediaMetadata.hashtags || sharedMetadata.hashtags || [],
          takenAt: mediaMetadata.takenAt ?? sharedMetadata.takenAt ?? null,
          authorId: mediaMetadata.authorId || sharedMetadata.authorId || "",
          authorUsername: mediaMetadata.authorUsername || sharedMetadata.authorUsername || username,
          permalink: mediaMetadata.permalink || sharedMetadata.permalink || postPermalink
        },
```
Remplacer par :
```js
        meta: {
          type: mediaType,
          username: username,
          shortcode: shortcode,
          id: mediaId,
          index: i + 1,
          ext: selected.ext,
          caption: mediaMetadata.caption || sharedMetadata.caption || "",
          altText: mediaMetadata.altText || sharedMetadata.altText || "",
          hashtags: mediaMetadata.hashtags || sharedMetadata.hashtags || [],
          takenAt: mediaMetadata.takenAt ?? sharedMetadata.takenAt ?? null,
          authorId: mediaMetadata.authorId || sharedMetadata.authorId || "",
          authorUsername: mediaMetadata.authorUsername || sharedMetadata.authorUsername || username,
          permalink: mediaMetadata.permalink || sharedMetadata.permalink || postPermalink,
          mediaKind: selected.isVideo ? "video" : "image",
          carouselTotal: mediaItems.length
        },
```

- [ ] **Étape 2 : Vérifier visuellement**

Chercher `mediaKind: selected.isVideo` dans le fichier — doit apparaître dans le bloc `meta` de `buildProfileItemDownloadTasks`.

- [ ] **Étape 3 : Commit**

```bash
git add amstragram.js
git commit -m "feat: add mediaKind/carouselTotal to profile bulk download meta"
```

---

### Task 4 : Builder highlights (profil) — objet `meta` direct

**Files:**
- Modify: `amstragram.js:22130-22144`

- [ ] **Étape 1 : Ajouter `mediaKind` et `carouselTotal` dans le `meta` des highlights de profil**

Trouver (L22130–22144) :
```js
        meta: {
          type: "highlight",
          username: username,
          shortcode: normalizedHighlightId,
          id: itemId,
          index: i + 1,
          ext: media.ext,
          caption: itemMetadata.caption || "",
          altText: itemMetadata.altText || "",
          hashtags: itemMetadata.hashtags || [],
          takenAt: itemMetadata.takenAt ?? null,
          authorId: itemMetadata.authorId || "",
          authorUsername: itemMetadata.authorUsername || username,
          permalink: itemMetadata.permalink || ""
        }
```
Remplacer par :
```js
        meta: {
          type: "highlight",
          username: username,
          shortcode: normalizedHighlightId,
          id: itemId,
          index: i + 1,
          ext: media.ext,
          caption: itemMetadata.caption || "",
          altText: itemMetadata.altText || "",
          hashtags: itemMetadata.hashtags || [],
          takenAt: itemMetadata.takenAt ?? null,
          authorId: itemMetadata.authorId || "",
          authorUsername: itemMetadata.authorUsername || username,
          permalink: itemMetadata.permalink || "",
          mediaKind: media.isVideo ? "video" : "image",
          carouselTotal: 1
        }
```

- [ ] **Étape 2 : Commit**

```bash
git add amstragram.js
git commit -m "feat: add mediaKind/carouselTotal to profile highlight download meta"
```

---

### Task 5 : `buildStoryDownloadMeta` — stories et highlights (clic droit)

**Files:**
- Modify: `amstragram.js:18797-18823` (définition)
- Modify: `amstragram.js:18906` (appel clic droit individuel)
- Modify: `amstragram.js:18837` (appel batch)

- [ ] **Étape 1 : Ajouter le paramètre `isVideo` et les deux champs dans `buildStoryDownloadMeta`**

Trouver (L18797) :
```js
  function buildStoryDownloadMeta(item, safeName, isHighlight, idForName, index, ext, storyShortcode = "") {
```
Remplacer par :
```js
  function buildStoryDownloadMeta(item, safeName, isHighlight, idForName, index, ext, storyShortcode = "", isVideo = false) {
```

Trouver (L18808–18822) :
```js
    return {
      type: type,
      username: safeName,
      shortcode: normalizedShortcode,
      id: idForName,
      index: index,
      ext: ext,
      caption: metadata.caption || "",
      altText: metadata.altText || "",
      hashtags: Array.isArray(metadata.hashtags) ? metadata.hashtags : [],
      takenAt: metadata.takenAt ?? null,
      authorId: metadata.authorId || "",
      authorUsername: metadata.authorUsername || safeName,
      permalink: metadata.permalink || fallbackPermalink
    };
```
Remplacer par :
```js
    return {
      type: type,
      username: safeName,
      shortcode: normalizedShortcode,
      id: idForName,
      index: index,
      ext: ext,
      caption: metadata.caption || "",
      altText: metadata.altText || "",
      hashtags: Array.isArray(metadata.hashtags) ? metadata.hashtags : [],
      takenAt: metadata.takenAt ?? null,
      authorId: metadata.authorId || "",
      authorUsername: metadata.authorUsername || safeName,
      permalink: metadata.permalink || fallbackPermalink,
      mediaKind: isVideo ? "video" : "image",
      carouselTotal: 1
    };
```

- [ ] **Étape 2 : Mettre à jour l'appel dans le clic droit individuel (L18906)**

Trouver :
```js
        const meta = buildStoryDownloadMeta(item, safeName, isHighlight, idForName, 1, ext, storyShortcode);
```
Remplacer par :
```js
        const meta = buildStoryDownloadMeta(item, safeName, isHighlight, idForName, 1, ext, storyShortcode, media.isVideo);
```

- [ ] **Étape 3 : Mettre à jour l'appel dans `buildStoryBatchTasks` (L18837)**

Trouver :
```js
        meta: buildStoryDownloadMeta(item, safeName, isHighlight, itemId, i + 1, media.ext, storyShortcode)
```
Remplacer par :
```js
        meta: buildStoryDownloadMeta(item, safeName, isHighlight, itemId, i + 1, media.ext, storyShortcode, media.isVideo)
```

- [ ] **Étape 4 : Vérifier qu'il n'existe pas d'autres appels à `buildStoryDownloadMeta`**

```bash
grep -n "buildStoryDownloadMeta" amstragram.js
```
Attendu : exactement 3 lignes (définition L18797, appel L18906, appel L18837).

- [ ] **Étape 5 : Commit**

```bash
git add amstragram.js
git commit -m "feat: add mediaKind/carouselTotal to story/highlight download meta"
```

---

### Task 6 : `buildCommentMediaMenuItems` — médias de commentaires

**Files:**
- Modify: `amstragram.js:15491-15505`

- [ ] **Étape 1 : Ajouter `mediaKind` et `carouselTotal` dans `resolvedMeta`**

Trouver (L15491–15505) :
```js
    const resolvedMeta = {
      type: "comment_media",
      username: meta?.username || "instagram",
      shortcode: meta?.shortcode || "",
      id: meta?.id || "",
      index: 1,
      ext: meta?.ext || mediaInfo.ext,
      caption: "",
      altText: "",
      hashtags: [],
      takenAt: null,
      authorId: meta?.authorId || "",
      authorUsername: meta?.authorUsername || "",
      permalink: meta?.permalink || getCurrentPageHref()
    };
```
Remplacer par :
```js
    const resolvedMeta = {
      type: "comment_media",
      username: meta?.username || "instagram",
      shortcode: meta?.shortcode || "",
      id: meta?.id || "",
      index: 1,
      ext: meta?.ext || mediaInfo.ext,
      caption: "",
      altText: "",
      hashtags: [],
      takenAt: null,
      authorId: meta?.authorId || "",
      authorUsername: meta?.authorUsername || "",
      permalink: meta?.permalink || getCurrentPageHref(),
      mediaKind: mediaInfo?.isVideo ? "video" : "image",
      carouselTotal: 1
    };
```

- [ ] **Étape 2 : Commit**

```bash
git add amstragram.js
git commit -m "feat: add mediaKind/carouselTotal to comment media download meta"
```

---

### Task 7 : Photo de profil

**Files:**
- Modify: `amstragram.js:21981-21999`

- [ ] **Étape 1 : Ajouter `mediaKind` et `carouselTotal` dans le `meta` de la photo de profil**

Trouver (L21984–21998) :
```js
      meta: {
        type: "profile_pic",
        username: username,
        shortcode: "",
        id: userId || username,
        index: 1,
        ext: ext,
        caption: "",
        altText: "",
        hashtags: [],
        takenAt: null,
        authorId: userId || "",
        authorUsername: username,
        permalink: `https://www.instagram.com/${username}/`
      }
```
Remplacer par :
```js
      meta: {
        type: "profile_pic",
        username: username,
        shortcode: "",
        id: userId || username,
        index: 1,
        ext: ext,
        caption: "",
        altText: "",
        hashtags: [],
        takenAt: null,
        authorId: userId || "",
        authorUsername: username,
        permalink: `https://www.instagram.com/${username}/`,
        mediaKind: "image",
        carouselTotal: 1
      }
```

- [ ] **Étape 2 : Commit**

```bash
git add amstragram.js
git commit -m "feat: add mediaKind/carouselTotal to profile picture download meta"
```

---

### Task 8 : Vérification manuelle finale

Pas de framework de test dans ce repo — vérification par inspection du JSON produit.

- [ ] **Étape 1 : Charger le script dans Tampermonkey**

Copier le contenu de `amstragram.js` dans l'éditeur Tampermonkey (ou utiliser `@require file://...` en dev). Naviguer sur `www.instagram.com`.

- [ ] **Étape 2 : Tester un post image seul**

Clic droit sur un post image (1 seule image). Télécharger avec sidecar JSON activé. Ouvrir le `.json`. Vérifier :
```json
"media": {
  "kind": "image",
  "carouselTotal": 1
}
```

- [ ] **Étape 3 : Tester un post vidéo/reel**

Clic droit sur une vidéo ou un reel. Vérifier dans le JSON :
```json
"media": {
  "kind": "video",
  "carouselTotal": 1
}
```

- [ ] **Étape 4 : Tester un carousel**

Clic droit sur un carousel (post multi-images). Télécharger tous les items. Vérifier sur l'item 1 et l'item 2 :
```json
"media": {
  "kind": "image",
  "carouselTotal": 3
}
```
(ou `"video"` si l'item est une vidéo dans le carousel)

- [ ] **Étape 5 : Vérifier le numéro de schéma**

Le champ `schema` doit valoir `"amstragram-media-metadata-v1.2"` dans tous les JSONs produits.

- [ ] **Étape 6 : Vérifier la compatibilité des anciens appels sans `mediaKind`**

Chercher un appel à `buildMetadataSidecarPayload` qui passe un `meta` sans `mediaKind`. Par ex., un ZIP d'archive. Le JSON doit avoir `"kind": null` et `"carouselTotal": null` — pas d'erreur.
