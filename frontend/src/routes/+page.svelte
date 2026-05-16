<script>
  import PostCard from '$lib/PostCard.svelte';
  let { data } = $props();
</script>

<div class="feed">
  {#each data.photos as post (post.shortcode)}
    <PostCard {post} />
  {/each}
</div>

<style>
  .feed {
    max-width: 470px;
    margin: 0 auto;
    padding: 16px 0;
  }
</style>
