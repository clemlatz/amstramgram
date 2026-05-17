<script>
  let { checked = false, disabled = false, onchange = null, label = null, describedby = null } = $props();
</script>

<label class="toggle">
  <input
    type="checkbox"
    {checked}
    {disabled}
    aria-label={label}
    aria-describedby={describedby}
    onchange={onchange}
  />
  <span class="track"></span>
</label>

<style>
  .toggle {
    flex-shrink: 0;
    position: relative;
    width: 51px;
    height: 31px;
    cursor: pointer;
  }

  .toggle input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle input:disabled ~ .track {
    opacity: 0.4;
    cursor: default;
  }

  .track {
    display: block;
    width: 51px;
    height: 31px;
    border-radius: 16px;
    background: #e5e5ea;
    transition: background 0.2s;
    position: relative;
  }

  .track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 27px;
    height: 27px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
    transition: transform 0.2s;
  }

  .toggle input:checked ~ .track {
    background: #34c759;
  }

  .toggle input:checked ~ .track::after {
    transform: translateX(20px);
  }

  @media (prefers-color-scheme: dark) {
    .track {
      background: #3a3a3c;
    }
  }
</style>
