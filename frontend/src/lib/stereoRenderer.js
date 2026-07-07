// Side-by-side stereoscopic renderer with per-eye barrel distortion, for
// phone-in-headset VR viewing. Draws a single source (image or video frame)
// twice — once per eye viewport — applying an adjustable radial distortion so
// straight lines look straight through the headset lenses.
//
// The source is normalised to a square texture: images are contain-fit onto an
// offscreen canvas; videos are uploaded frame-by-frame straight from the
// <video> element. Both are top-origin, so the fragment shader flips Y for both.

const VERT = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform float uAspect, uK1, uK2, uZoom, uSep, uEyeSign;
  void main(){
    vec2 c = vUv * 2.0 - 1.0;
    c.x *= uAspect;
    float r2 = dot(c, c);
    float f = 1.0 + uK1 * r2 + uK2 * r2 * r2;
    vec2 p = c * f;
    p.x /= uAspect;
    p /= uZoom;
    p.x += uEyeSign * uSep;
    vec2 uv = p * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0)
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    else
      gl_FragColor = texture2D(uTex, vec2(uv.x, 1.0 - uv.y));
  }
`;

export function createStereoRenderer(canvas) {
  const gl =
    canvas.getContext('webgl', { antialias: true }) ||
    canvas.getContext('experimental-webgl');
  if (!gl) throw new Error('WebGL unavailable');

  const compile = (type, source) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('Shader compile failed: ' + log);
    }
    return s;
  };

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('Program link failed: ' + gl.getProgramInfoLog(prog));
  }
  gl.useProgram(prog);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ['uAspect', 'uK1', 'uK2', 'uZoom', 'uSep', 'uEyeSign', 'uTex'].forEach(
    (n) => (U[n] = gl.getUniformLocation(prog, n))
  );
  gl.uniform1i(U.uTex, 0);

  // Square source canvas (used for still images).
  const SIZE = 1024;
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = srcCanvas.height = SIZE;
  const sctx = srcCanvas.getContext('2d');

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  let params = { sep: 0, zoom: 1, k1: 0.15, k2: 0 };
  let W = 0;
  let H = 0;
  let video = null;
  let raf = 0;

  function uploadCanvas() {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);
  }

  function setImage(img) {
    video = null;
    sctx.fillStyle = '#000';
    sctx.fillRect(0, 0, SIZE, SIZE);
    const s = Math.min(SIZE / img.width, SIZE / img.height);
    const dw = img.width * s;
    const dh = img.height * s;
    sctx.drawImage(img, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh);
    uploadCanvas();
  }

  function setVideo(el) {
    video = el;
  }

  function clearMedia() {
    video = null;
    sctx.fillStyle = '#000';
    sctx.fillRect(0, 0, SIZE, SIZE);
    uploadCanvas();
  }

  function setParams(next) {
    params = { ...params, ...next };
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = Math.round(window.innerWidth * dpr);
    H = Math.round(window.innerHeight * dpr);
    canvas.width = W;
    canvas.height = H;
  }

  function draw() {
    if (!W || !H) return;
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const halfW = Math.floor(W / 2);
    gl.uniform1f(U.uAspect, halfW / H);
    gl.uniform1f(U.uK1, params.k1);
    gl.uniform1f(U.uK2, params.k2);
    gl.uniform1f(U.uZoom, params.zoom);
    gl.uniform1f(U.uSep, params.sep);
    gl.viewport(0, 0, halfW, H);
    gl.uniform1f(U.uEyeSign, -1.0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.viewport(W - halfW, 0, halfW, H);
    gl.uniform1f(U.uEyeSign, 1.0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function frame() {
    if (video && video.readyState >= 2) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      } catch {
        // frame not yet decodable — keep the previous texture
      }
    }
    draw();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (!raf) frame();
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function destroy() {
    stop();
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }

  return { setImage, setVideo, clearMedia, setParams, resize, start, stop, destroy };
}
