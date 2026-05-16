# Video Support Design

**Date:** 2026-05-16

## Overview

Add video support to amstramgram. Videos stored as `.mp4` are already indexed by the DB but are currently excluded from all API queries and the image-serving route. This feature makes them first-class alongside images throughout the stack.

## Goals

1. Click/tap a video to play or pause it.
2. Videos always loop.
3. Videos always start muted; a small overlay button toggles sound per video.
4. Feed page: videos paused by default.
5. Random page: videos autoplay (muted) by default.
6. Scheduler: skip posts that contain any video (pure video posts and carousels with at least one video slide).
7. Saved posts sync: download reels only (`product_type == 'clips'`); skip all other video types.

## Backend

### `/api/media/{encoded}` (renamed from `/api/image/`)

Extend the content-type map:

```python
_CONTENT_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "png": "image/png",
    "mp4": "video/mp4",
}
```

Route path changes from `/image/{encoded}` to `/media/{encoded}`. Behaviour is otherwise identical (security check, file read, `Cache-Control: public, max-age=86400`).

### API response shape

Both `/api/feed` and `/api/random` switch from:

```json
{ "images": ["/api/image/abc"] }
```

to:

```json
{
  "media": [
    { "url": "/api/media/abc", "type": "image" },
    { "url": "/api/media/def", "type": "video" }
  ]
}
```

`type` is derived from the file extension: `mp4` → `"video"`, everything else → `"image"`.

### `db.py` — query changes

`get_recent_photos` and `get_random_neutral_photo`: extend the extension filter from `('jpg', 'jpeg', 'webp', 'png')` to `('jpg', 'jpeg', 'webp', 'png', 'mp4')`. The post-grouping logic in `get_recent_photos` already handles mixed-extension posts correctly.

### `saved.py` — reel-only filter

Current behaviour skips all video posts. New behaviour: skip all video posts **except** reels.

```python
if post.is_video and getattr(post, 'product_type', None) != 'clips':
    record_saved_seen(shortcode, db_path)
    continue
```

Reels (`product_type == 'clips'`) proceed to download. Regular feed videos and IGTV are skipped and recorded in `saved_seen`.

### `scheduler.py` — skip video-containing posts

Add a helper before calling `download_post` in both `_download_account_fast` and the catchup loop:

```python
def _post_has_video(post) -> bool:
    if post.is_video:
        return True
    if post.typename == 'GraphSidecar':
        return any(node.is_video for node in post.get_sidecar_nodes())
    return False
```

If `_post_has_video(post)` is True, skip the post silently (no download, no DB entry).

## Frontend

### API contract change

`post.images: string[]` → `post.media: Array<{ url: string, type: 'image' | 'video' }>`.

Update `+page.js` and `random/+page.js` if needed (they pass the full API response as-is, so changes may be minimal).

### `PostCard.svelte`

- Replace `post.images` references with `post.media`.
- `isCarousel`: `post.media.length > 1` (unchanged logic).
- In the carousel swiper, each slide renders `<video>` or `<img>` based on `item.type`.
- For a single-item post, render `<video>` if `type === 'video'`, `<img>` otherwise.

**Video element:**

```svelte
<div class="video-wrapper">
  <video
    src={item.url}
    loop
    muted
    playsinline
    autoplay={false}
    onclick={togglePlayPause}
  />
  <button class="mute-btn" onclick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
    <!-- speaker SVG icon, slashed when muted -->
  </button>
</div>
```

- `autoplay={false}` — feed videos start paused.
- `muted` attribute always present at mount; mute state resets whenever the component remounts.
- Click/tap on the video → `video.paused ? video.play() : video.pause()`.
- Mute button (small semi-transparent circle, bottom-right) toggles `video.muted` and updates icon.

### `random/+page.svelte`

Same `{url, type}` rendering as PostCard. Differences for the random page:

- Single video posts: `autoplay muted loop playsinline` — video plays automatically but silently.
- Mute state resets to muted when `photo` changes (after rating, component re-renders with new `{#key photo.shortcode}`).
- Click/tap on video → play/pause.
- Mute button identical to PostCard.

## Out of scope

- Thumbnails / poster frames for videos.
- Progress bar or playback position.
- Volume level control (mute/unmute only).
- Downloading videos via the scheduler (always skipped).
