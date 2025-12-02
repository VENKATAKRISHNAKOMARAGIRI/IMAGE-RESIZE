// script.js — Pro Image Resizer
// External file: put next to index.html and style.css

/* ---------- Elements ---------- */
const fileInput = document.getElementById('fileInput');
const openCameraBtn = document.getElementById('openCameraBtn');
const captureBtn = document.getElementById('captureBtn');
const stopCameraBtn = document.getElementById('stopCameraBtn');
const resetBtn = document.getElementById('resetBtn');

const previewImg = document.getElementById('previewImg');
const cameraVideo = document.getElementById('cameraVideo');
const previewPlaceholder = document.getElementById('previewPlaceholder');

const presets = document.querySelectorAll('.preset');
const unitSelect = document.getElementById('unitSelect');
const inputA = document.getElementById('inputA');
const inputB = document.getElementById('inputB');
const dpiInput = document.getElementById('dpi');
const bgColor = document.getElementById('bgColor');
const modeSelect = document.getElementById('modeSelect');
const formatSelect = document.getElementById('formatSelect');
const jpegQuality = document.getElementById('jpegQuality');

const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const resultCanvas = document.getElementById('resultCanvas');
const downloadCanvasBtn = document.getElementById('downloadCanvasBtn');
const saveGalleryBtn = document.getElementById('saveGalleryBtn');
const galleryEl = document.getElementById('gallery');
const resultInfo = document.getElementById('resultInfo');

/* ---------- State ---------- */
let sourceImage = new Image();
let sourceDataUrl = null;
let mediaStream = null;

/* ---------- Utility ---------- */
function setStatus(text) {
  resultInfo.textContent = text;
}
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
function toNumber(v, fallback=0) { const n = Number(v); return isNaN(n) ? fallback : n; }

/* ---------- Load image from file input ---------- */
fileInput.addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  await loadSource(url);
});

/* ---------- Drag & drop support on preview ---------- */
const previewBox = document.querySelector('.preview');
previewBox.addEventListener('dragover', e => { e.preventDefault(); previewBox.style.outline = '2px dashed rgba(255,255,255,0.06)'; });
previewBox.addEventListener('dragleave', e => { previewBox.style.outline = 'none'; });
previewBox.addEventListener('drop', async (e) => {
  e.preventDefault(); previewBox.style.outline = 'none';
  const f = e.dataTransfer.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  await loadSource(url);
});

/* ---------- Load and show source image ---------- */
function loadSource(url) {
  return new Promise((resolve,reject) => {
    sourceImage = new Image();
    sourceImage.crossOrigin = 'anonymous';
    sourceImage.onload = () => {
      sourceDataUrl = url;
      previewImg.src = url;
      previewImg.classList.remove('hidden');
      cameraVideo.classList.add('hidden');
      previewPlaceholder.classList.add('hidden');
      captureBtn.disabled = false;
      stopCameraBtn.disabled = true;
      setStatus(`Loaded ${sourceImage.width}×${sourceImage.height}`);
      resolve();
    };
    sourceImage.onerror = (e) => reject(e);
    sourceImage.src = url;
  });
}

/* ---------- Camera controls ---------- */
openCameraBtn.addEventListener('click', async () => {
  if (mediaStream) return;
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    cameraVideo.srcObject = mediaStream;
    cameraVideo.classList.remove('hidden');
    previewImg.classList.add('hidden');
    previewPlaceholder.classList.add('hidden');
    captureBtn.disabled = false;
    stopCameraBtn.disabled = false;
    setStatus('Camera active — click Capture to take a photo');
  } catch (err) {
    alert('Camera error: ' + err.message);
  }
});

captureBtn.addEventListener('click', () => {
  if (!mediaStream && cameraVideo.srcObject == null) return;
  const w = cameraVideo.videoWidth;
  const h = cameraVideo.videoHeight;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(cameraVideo, 0, 0, w, h);
  const durl = c.toDataURL('image/png');
  loadSource(durl);
  // stop camera
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  cameraVideo.classList.add('hidden');
  stopCameraBtn.disabled = true;
});

stopCameraBtn.addEventListener('click', () => {
  if (!mediaStream) return;
  mediaStream.getTracks().forEach(t => t.stop());
  mediaStream = null;
  cameraVideo.classList.add('hidden');
  previewPlaceholder.classList.remove('hidden');
  captureBtn.disabled = true;
  stopCameraBtn.disabled = true;
  setStatus('Camera stopped');
});

/* ---------- Reset ---------- */
resetBtn.addEventListener('click', () => {
  previewImg.src = '';
  previewImg.classList.add('hidden');
  cameraVideo.classList.add('hidden');
  previewPlaceholder.classList.remove('hidden');
  sourceDataUrl = null;
  resultCanvas.width = resultCanvas.height = 0;
  downloadBtn.disabled = true;
  downloadCanvasBtn.disabled = true;
  saveGalleryBtn.disabled = true;
  setStatus('Reset done');
});

/* ---------- Preset buttons ---------- */
presets.forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (btn.dataset.type === 'A4') {
      unitSelect.value = 'cm';
      inputA.value = btn.dataset.wcm;
      inputB.value = btn.dataset.hcm;
    } else if (btn.dataset.w && btn.dataset.h) {
      unitSelect.value = 'px';
      inputA.value = btn.dataset.w;
      inputB.value = btn.dataset.h;
    } else {
      unitSelect.value = 'px';
      inputA.value = '';
      inputB.value = '';
    }
  });
});

/* ---------- Convert inputs to pixels ---------- */
function toTargetPixels() {
  const unit = unitSelect.value;
  const dpi = toNumber(dpiInput.value, 300);
  if (unit === 'px') {
    return { w: Math.round(toNumber(inputA.value, 1920)), h: Math.round(toNumber(inputB.value, 1080)) };
  } else if (unit === 'ratio') {
    // treat ratio A:B — use base width 1920 for good quality
    const a = toNumber(inputA.value, 16);
    const b = toNumber(inputB.value, 9);
    const base = 1920;
    const w = Math.round(base * (a / b));
    const h = Math.round(base);
    return { w, h };
  } else if (unit === 'cm' || unit === 'm') {
    const factor = unit === 'm' ? 100 : 1; // meters -> cm
    const cmW = toNumber(inputA.value, 21) * factor;
    const cmH = toNumber(inputB.value, 29.7) * factor;
    const pxW = Math.round((cmW * dpi) / 2.54);
    const pxH = Math.round((cmH * dpi) / 2.54);
    return { w: pxW, h: pxH };
  }
  // fallback
  return { w: 1920, h: 1080 };
}

/* ---------- Draw source image to result canvas ---------- */
function drawToCanvas(targetW, targetH, mode='contain', background='#ffffff') {
  // Use devicePixelRatio for crisp output
  const dpr = window.devicePixelRatio || 1;
  const canvas = resultCanvas;
  canvas.width = targetW * dpr;
  canvas.height = targetH * dpr;
  canvas.style.width = targetW + 'px';
  canvas.style.height = targetH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);

  // fill bg
  ctx.fillStyle = background;
  ctx.fillRect(0,0,targetW,targetH);

  // source dimensions
  const sw = sourceImage.width;
  const sh = sourceImage.height;

  if (!sw || !sh) {
    setStatus('Source image not ready');
    return;
  }

  let scale;
  if (mode === 'contain') {
    scale = Math.min(targetW / sw, targetH / sh);
  } else {
    scale = Math.max(targetW / sw, targetH / sh);
  }
  const dw = Math.round(sw * scale);
  const dh = Math.round(sh * scale);
  const dx = Math.round((targetW - dw) / 2);
  const dy = Math.round((targetH - dh) / 2);

  // high quality smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceImage, 0, 0, sw, sh, dx, dy, dw, dh);

  setStatus(`Rendered ${targetW}×${targetH}px (${mode})`);
  downloadBtn.disabled = false;
  downloadCanvasBtn.disabled = false;
  saveGalleryBtn.disabled = false;
}

/* ---------- Generate button ---------- */
generateBtn.addEventListener('click', () => {
  if (!sourceDataUrl) { alert('Please upload or capture an image first.'); return; }

  const { w, h } = toTargetPixels();
  const mode = modeSelect.value;
  const bg = bgColor.value || '#ffffff';

  // safety clamp to avoid extremely huge renders
  const MAX_PIXELS = 10000 * 10000; // absolute limit (very large)
  if (w * h > MAX_PIXELS) {
    alert('Requested size too large. Choose smaller dimensions.');
    return;
  }

  drawToCanvas(w, h, mode, bg);
});

/* ---------- Download handlers ---------- */
downloadCanvasBtn.addEventListener('click', () => {
  const fmt = formatSelect.value;
  const quality = parseFloat(jpegQuality.value) || 0.92;
  let dataUrl;
  if (fmt === 'png') dataUrl = resultCanvas.toDataURL('image/png');
  else dataUrl = resultCanvas.toDataURL('image/jpeg', quality);
  triggerDownload(dataUrl, `resized.${fmt === 'png' ? 'png' : 'jpg'}`);
});
downloadBtn.addEventListener('click', () => downloadCanvasBtn.click());

function triggerDownload(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------- Save to gallery ---------- */
saveGalleryBtn.addEventListener('click', () => {
  const data = resultCanvas.toDataURL('image/png');
  const arr = JSON.parse(localStorage.getItem('resizer_gallery_v1') || '[]');
  arr.unshift(data);
  localStorage.setItem('resizer_gallery_v1', JSON.stringify(arr.slice(0, 30)));
  renderGallery();
});

/* ---------- Render gallery ---------- */
function renderGallery() {
  galleryEl.innerHTML = '';
  const arr = JSON.parse(localStorage.getItem('resizer_gallery_v1') || '[]');
  arr.forEach(src => {
    const im = document.createElement('img');
    im.src = src;
    im.addEventListener('click', () => {
      // open in new tab
      const w = window.open('');
      w.document.write(`<img src="${src}" style="max-width:100%;">`);
    });
    galleryEl.appendChild(im);
  });
}
renderGallery();

/* ---------- Utility triggers ---------- */
function initDefaults() {
  // set some sensible defaults
  unitSelect.value = 'px';
  inputA.value = 1920;
  inputB.value = 1080;
  dpiInput.value = 300;
  bgColor.value = '#ffffff';
  modeSelect.value = 'contain';
  formatSelect.value = 'png';
  jpegQuality.value = 0.92;
}
initDefaults();

/* ---------- Small UX: click preview to open camera capture if active ---------- */
previewImg.addEventListener('click', () => {
  // nothing for now — could open editor
});
cameraVideo.addEventListener('click', async () => {
  if (!mediaStream) return;
  const w = cameraVideo.videoWidth;
  const h = cameraVideo.videoHeight;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(cameraVideo, 0, 0, w, h);
  const durl = c.toDataURL('image/png');
  await loadSource(durl);
});

/* ---------- helper if user drags to top area ---------- */
async function loadSource(url) {
  await (new Promise((resolve,reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { sourceImage = img; sourceDataUrl = url; previewImg.src = url; previewImg.classList.remove('hidden'); cameraVideo.classList.add('hidden'); previewPlaceholder.classList.add('hidden'); resolve(); };
    img.onerror = reject;
    img.src = url;
  }));
}

/* Done */
setStatus('Ready — upload an image or open the camera.');
