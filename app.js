/* Set PDF.js worker script path once globally */
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/* =========================================
   1. PAGE & TAB SWITCHING LOGIC
   ========================================= */
const tabBtns = document.querySelectorAll('.tab-btn');
const appCards = document.querySelectorAll('.app-card');
const homePage = document.getElementById('home-page');
const workspace = document.getElementById('workspace');
const homeBtn = document.getElementById('homeBtn');

function showHomePage() {
  tabBtns.forEach(b => b.classList.remove('active'));
  appCards.forEach(c => c.classList.remove('active'));
  workspace.classList.remove('active');
  homePage.style.display = 'flex';
}

homeBtn.addEventListener('click', (e) => {
  e.preventDefault();
  showHomePage();
});

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    appCards.forEach(c => c.classList.remove('active'));
    
    homePage.style.display = 'none';
    workspace.classList.add('active');

    btn.classList.add('active');
    const targetId = btn.getAttribute('data-target');
    document.getElementById(targetId).classList.add('active');
  });
});

/* =========================================
   HELPER: FORMAT BYTES
   ========================================= */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/* =========================================
   2. IMAGE CROPPER LOGIC
   ========================================= */
(function() {
  const imageElement = document.getElementById('cropImage');
  const fileInput = document.getElementById('cropFileInput');
  const resetButton = document.getElementById('cropResetButton');
  const downloadButton = document.getElementById('cropDownloadButton');
  const uploadArea = document.getElementById('cropUploadArea');
  const editorPanel = document.getElementById('cropEditorPanel');
  let cropper = null;

  function updateButtonStates() {
    const hasImage = !!imageElement.src && imageElement.src !== window.location.href && cropper !== null;
    resetButton.disabled = !hasImage;
    downloadButton.disabled = !hasImage;
  }

  fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (cropper) cropper.destroy();
      uploadArea.style.display = 'none';
      editorPanel.style.display = 'flex';
      imageElement.style.display = 'block';
      imageElement.src = ev.target.result;
      imageElement.onload = function() {
        cropper = new Cropper(imageElement, {
          aspectRatio: NaN, viewMode: 1, dragMode: 'crop', autoCropArea: 0.8,
          cropBoxMovable: true, cropBoxResizable: true, toggleDragModeOnDblclick: false,
          responsive: true, background: false, zoomable: true, scalable: true,
          ready: function() { updateButtonStates(); },
        });
      };
    };
    reader.readAsDataURL(file);
  });

  resetButton.addEventListener('click', () => { if (cropper) cropper.reset(); });

  downloadButton.addEventListener('click', function() {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({ maxWidth: 4096, maxHeight: 4096, fillColor: '#fff' });
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `lostcrop-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
})();

/* =========================================
   3. IMAGE COMPRESSOR LOGIC
   ========================================= */
(function() {
  const imageElement = document.getElementById('compressImage');
  const fileInput = document.getElementById('compressFileInput');
  const resetButton = document.getElementById('compressResetButton');
  const downloadButton = document.getElementById('compressDownloadButton');
  const uploadArea = document.getElementById('compressUploadArea');
  const editorPanel = document.getElementById('compressEditorPanel');
  const infoPanel = document.querySelector('#compress-tool .file-info');
  const originalSizeText = document.getElementById('originalSize');
  const compressedSizeText = document.getElementById('compressedSize');
  const qualitySlider = document.getElementById('qualitySlider');
  const qualityValue = document.getElementById('qualityValue');
  
  let originalFile = null;
  let debounceTimer = null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  function calculateCompressionSize() {
    if (!imageElement.src || imageElement.src === window.location.href) return;
    const quality = parseInt(qualitySlider.value) / 100;
    const img = new Image();
    img.onload = function() {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const compressedData = canvas.toDataURL('image/jpeg', quality);
      const head = compressedData.indexOf(',') + 1;
      const size = Math.ceil((compressedData.length - head) * 3 / 4);
      
      if (originalFile && originalFile.size > 0) {
        const savings = originalFile.size - size;
        const savingsPercent = Math.round((savings / originalFile.size) * 100);
        if (savings > 0) {
          compressedSizeText.textContent = `Est: ${formatBytes(size)} (${savingsPercent}% saved)`;
          compressedSizeText.style.color = '#10b981'; 
        } else {
          compressedSizeText.textContent = `Est: ${formatBytes(size)} (Larger!)`;
          compressedSizeText.style.color = '#ef4444';
        }
      }
    };
    img.src = imageElement.src;
  }

  function updateSliderVisuals() {
    const val = qualitySlider.value;
    qualityValue.textContent = `${val}%`;
    const percent = ((val - qualitySlider.min) / (qualitySlider.max - qualitySlider.min)) * 100;
    qualitySlider.style.setProperty('--val', `${percent}%`);
    compressedSizeText.textContent = 'Calculating...';
    compressedSizeText.style.color = 'var(--text-muted)';
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(calculateCompressionSize, 150);
  }

  fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    originalFile = file;
    uploadArea.style.display = 'none';
    editorPanel.style.display = 'flex';
    infoPanel.style.display = 'flex';
    originalSizeText.textContent = formatBytes(file.size);
    compressedSizeText.textContent = 'Calculating...';
    const reader = new FileReader();
    reader.onload = function(ev) {
      imageElement.src = ev.target.result;
      imageElement.style.display = 'block';
      imageElement.onload = () => updateSliderVisuals();
    };
    reader.readAsDataURL(file);
  });

  qualitySlider.addEventListener('input', updateSliderVisuals);

  downloadButton.addEventListener('click', function() {
    if (!imageElement.src) return;
    const img = new Image();
    const quality = parseInt(qualitySlider.value) / 100;
    img.onload = function() {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const compressedData = canvas.toDataURL('image/jpeg', quality);
      const link = document.createElement('a');
      link.download = `lostcrop-compressed-${Date.now()}.jpg`;
      link.href = compressedData;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = imageElement.src;
  });

  resetButton.addEventListener('click', function() {
    imageElement.src = '';
    imageElement.style.display = 'none';
    fileInput.value = '';
    originalFile = null;
    uploadArea.style.display = 'flex';
    editorPanel.style.display = 'none';
    infoPanel.style.display = 'none';
    qualitySlider.value = 70;
    qualitySlider.style.setProperty('--val', '66.6%');
    qualityValue.textContent = '70%';
  });
  
  qualitySlider.style.setProperty('--val', '66.6%');
})();

/* =========================================
   4. IMAGE ROTATOR LOGIC
   ========================================= */
(function() {
  const imageElement = document.getElementById('rotateImage');
  const fileInput = document.getElementById('rotateFileInput');
  const resetButton = document.getElementById('rotateResetButton');
  const downloadButton = document.getElementById('rotateDownloadButton');
  const uploadArea = document.getElementById('rotateUploadArea');
  const editorPanel = document.getElementById('rotateEditorPanel');
  
  const rotateLeftBtn = document.getElementById('rotateLeftBtn');
  const rotateRightBtn = document.getElementById('rotateRightBtn');
  const flipHBtn = document.getElementById('flipHBtn');
  const flipVBtn = document.getElementById('flipVBtn');

  let currentRotation = 0;
  let currentFlipH = false;
  let currentFlipV = false;
  let originalImage = new Image();

  function updateTransform() {
    let transform = `rotate(${currentRotation}deg)`;
    if (currentFlipH) transform += ` scaleX(-1)`;
    if (currentFlipV) transform += ` scaleY(-1)`;
    imageElement.style.transform = transform;
    if (currentRotation % 180 !== 0) {
       imageElement.style.maxWidth = '40vh';
       imageElement.style.maxHeight = '100%';
    } else {
       imageElement.style.maxWidth = '100%';
       imageElement.style.maxHeight = '40vh';
    }
  }

  fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      currentRotation = 0;
      currentFlipH = false;
      currentFlipV = false;
      
      originalImage.src = ev.target.result;
      imageElement.src = ev.target.result;
      
      uploadArea.style.display = 'none';
      editorPanel.style.display = 'flex';
      imageElement.style.display = 'block';
      
      updateTransform();
    };
    reader.readAsDataURL(file);
  });

  rotateLeftBtn.addEventListener('click', () => { currentRotation -= 90; updateTransform(); });
  rotateRightBtn.addEventListener('click', () => { currentRotation += 90; updateTransform(); });
  flipHBtn.addEventListener('click', () => { currentFlipH = !currentFlipH; updateTransform(); });
  flipVBtn.addEventListener('click', () => { currentFlipV = !currentFlipV; updateTransform(); });

  resetButton.addEventListener('click', function() {
    currentRotation = 0;
    currentFlipH = false;
    currentFlipV = false;
    updateTransform();
  });

  downloadButton.addEventListener('click', function() {
    if (!originalImage.src) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const isRotated = currentRotation % 180 !== 0;
    canvas.width = isRotated ? originalImage.height : originalImage.width;
    canvas.height = isRotated ? originalImage.width : originalImage.height;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(currentRotation * Math.PI / 180);
    ctx.scale(currentFlipH ? -1 : 1, currentFlipV ? -1 : 1);
    
    ctx.drawImage(originalImage, -originalImage.width / 2, -originalImage.height / 2);
    ctx.restore();

    const link = document.createElement('a');
    link.download = `lostcrop-rotated-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
})();

/* =========================================
   5. ADD TEXT TO IMAGE LOGIC
   ========================================= */
(function() {
  const canvas = document.getElementById('textCanvas');
  const ctx = canvas.getContext('2d');
  const fileInput = document.getElementById('textFileInput');
  const uploadArea = document.getElementById('textUploadArea');
  const editorPanel = document.getElementById('textEditorPanel');
  
  const textInput = document.getElementById('imageTextInput');
  const colorInput = document.getElementById('textColor');
  const sizeSlider = document.getElementById('textSize');
  const sizeValue = document.getElementById('textSizeValue');
  
  const resetButton = document.getElementById('textResetButton');
  const downloadButton = document.getElementById('textDownloadButton');

  let img = new Image();
  let textX = 0, textY = 0;
  let isDragging = false;
  let dragOffsetX = 0, dragOffsetY = 0;
  let originalWidth = 0, originalHeight = 0;
  let displayScale = 1;

  function draw() {
    if (!img.src) return;
    
    canvas.width = originalWidth;
    canvas.height = originalHeight;
    
    ctx.drawImage(img, 0, 0, originalWidth, originalHeight);

    const text = textInput.value;
    if (!text) return;

    const size = parseInt(sizeSlider.value) * (originalWidth / 500); 
    ctx.font = `bold ${size}px sans-serif`;
    ctx.fillStyle = colorInput.value;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = size / 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillText(text, textX, textY);
    ctx.shadowColor = 'transparent';

    const container = canvas.parentElement;
    const maxW = container.clientWidth - 32;
    const maxH = window.innerHeight * 0.4;
    
    const scaleX = maxW / originalWidth;
    const scaleY = maxH / originalHeight;
    displayScale = Math.min(scaleX, scaleY, 1);

    canvas.style.width = `${originalWidth * displayScale}px`;
    canvas.style.height = `${originalHeight * displayScale}px`;
  }

  fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = function() {
        originalWidth = img.width;
        originalHeight = img.height;
        
        textX = originalWidth / 2;
        textY = originalHeight / 2;

        uploadArea.style.display = 'none';
        editorPanel.style.display = 'flex';
        
        draw();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  textInput.addEventListener('input', draw);
  colorInput.addEventListener('input', draw);
  sizeSlider.addEventListener('input', function() {
    sizeValue.textContent = this.value;
    draw();
  });

  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) / displayScale,
      y: (clientY - rect.top) / displayScale
    };
  }

  function startDrag(e) {
    e.preventDefault();
    const pos = getMousePos(e);
    
    const size = parseInt(sizeSlider.value) * (originalWidth / 500);
    const textWidth = ctx.measureText(textInput.value).width;
    const textHeight = size;

    if (Math.abs(pos.x - textX) < textWidth/2 + 20 && Math.abs(pos.y - textY) < textHeight/2 + 20) {
      isDragging = true;
      dragOffsetX = pos.x - textX;
      dragOffsetY = pos.y - textY;
    }
  }

  function onDrag(e) {
    if (!isDragging) return;
    e.preventDefault();
    const pos = getMousePos(e);
    textX = pos.x - dragOffsetX;
    textY = pos.y - dragOffsetY;
    draw();
  }

  function stopDrag() {
    isDragging = false;
  }

  canvas.addEventListener('mousedown', startDrag);
  canvas.addEventListener('mousemove', onDrag);
  canvas.addEventListener('mouseup', stopDrag);
  canvas.addEventListener('mouseleave', stopDrag);

  canvas.addEventListener('touchstart', startDrag, {passive: false});
  canvas.addEventListener('touchmove', onDrag, {passive: false});
  canvas.addEventListener('touchend', stopDrag);

  resetButton.addEventListener('click', function() {
    img.src = '';
    canvas.width = 0;
    canvas.height = 0;
    textInput.value = 'Hello World';
    sizeSlider.value = 40;
    sizeValue.textContent = '40';
    uploadArea.style.display = 'flex';
    editorPanel.style.display = 'none';
  });

  downloadButton.addEventListener('click', function() {
    if (!img.src) return;
    const link = document.createElement('a');
    link.download = `lostcrop-text-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
})();

/* =========================================
   6. IMAGE TO PDF LOGIC
   ========================================= */
(function() {
  const fileInput = document.getElementById('pdfFileInput');
  const uploadArea = document.getElementById('pdfUploadArea');
  const editorPanel = document.getElementById('pdfEditorPanel');
  const pdfGrid = document.getElementById('pdfGrid');
  const downloadButton = document.getElementById('pdfDownloadButton');
  const resetButton = document.getElementById('pdfResetButton');
  const filterSelect = document.getElementById('pdfFilterSelect');
  
  let selectedFiles = [];

  filterSelect.addEventListener('change', function() {
    const filter = this.value;
    const images = pdfGrid.querySelectorAll('img');
    images.forEach(img => {
      img.style.filter = filter === 'none' ? '' : filter;
    });
  });

  fileInput.addEventListener('change', function(e) {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    selectedFiles = [...selectedFiles, ...files];
    renderGrid();
  });

  function renderGrid() {
    if (selectedFiles.length === 0) {
      uploadArea.style.display = 'flex';
      editorPanel.style.display = 'none';
      downloadButton.disabled = true;
      return;
    }
    uploadArea.style.display = 'none';
    editorPanel.style.display = 'flex';
    pdfGrid.innerHTML = ''; 
    downloadButton.disabled = false;
    
    const currentFilter = filterSelect.value;

    selectedFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const div = document.createElement('div');
        div.className = 'pdf-item';
        
        const img = document.createElement('img');
        img.src = e.target.result;
        if (currentFilter !== 'none') img.style.filter = currentFilter;
        
        const btn = document.createElement('button');
        btn.className = 'remove-btn';
        btn.innerHTML = '✕';
        btn.onclick = () => removeFile(index);
        
        div.appendChild(img);
        div.appendChild(btn);
        pdfGrid.appendChild(div);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeFile(index) {
    selectedFiles.splice(index, 1);
    fileInput.value = ''; 
    renderGrid();
  }

  downloadButton.addEventListener('click', async function() {
    if (selectedFiles.length === 0) return;
    const originalText = downloadButton.innerHTML;
    downloadButton.innerHTML = '⏳ Generating...';
    downloadButton.disabled = true;

    const activeFilter = filterSelect.value;

    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const imagePromises = selectedFiles.map(file => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve({ dataUrl: e.target.result });
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const images = await Promise.all(imagePromises);

      for (let i = 0; i < images.length; i++) {
        if (i > 0) pdf.addPage();
        
        const imgObj = new Image();
        imgObj.src = images[i].dataUrl;
        await new Promise(resolve => { imgObj.onload = resolve; });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = imgObj.width;
        canvas.height = imgObj.height;
        
        if (activeFilter !== 'none') {
          ctx.filter = activeFilter;
        }
        ctx.drawImage(imgObj, 0, 0);
        
        const processedDataUrl = canvas.toDataURL('image/jpeg', 0.9);

        const margin = 10;
        const maxW = pageWidth - margin * 2;
        const maxH = pageHeight - margin * 2;
        let imgW = canvas.width;
        let imgH = canvas.height;
        const ratio = Math.min(maxW / imgW, maxH / imgH);
        imgW = imgW * ratio;
        imgH = imgH * ratio;
        const x = (pageWidth - imgW) / 2;
        const y = (pageHeight - imgH) / 2;
        
        pdf.addImage(processedDataUrl, 'JPEG', x, y, imgW, imgH, undefined, 'FAST');
      }

      pdf.save(`lostcrop-images-${Date.now()}.pdf`);
      downloadButton.innerHTML = originalText;
      downloadButton.disabled = false;
    } catch (error) {
      console.error(error);
      alert('Error generating PDF.');
      downloadButton.innerHTML = originalText;
      downloadButton.disabled = false;
    }
  });

  resetButton.addEventListener('click', function() {
    selectedFiles = [];
    pdfGrid.innerHTML = '';
    fileInput.value = '';
    filterSelect.value = 'none';
    renderGrid();
  });
})();

/* =========================================
   7. PDF COMPRESSOR LOGIC
   ========================================= */
(function() {
  const fileInput = document.getElementById('pdfCompressFileInput');
  const uploadArea = document.getElementById('pdfCompressUploadArea');
  const editorPanel = document.getElementById('pdfCompressEditorPanel');
  const pdfNameText = document.getElementById('pdfName');
  const pdfOriginalSizeText = document.getElementById('pdfOriginalSize');
  const pdfStatusText = document.getElementById('pdfStatus');
  const qualitySlider = document.getElementById('pdfQualitySlider');
  const qualityValue = document.getElementById('pdfQualityValue');
  const downloadButton = document.getElementById('pdfCompressDownloadButton');
  const resetButton = document.getElementById('pdfCompressResetButton');

  let currentPdfFile = null;
  let pdfDoc = null;

  function updateSliderVisuals() {
    const val = qualitySlider.value;
    qualityValue.textContent = `${val}%`;
    const percent = ((val - qualitySlider.min) / (qualitySlider.max - qualitySlider.min)) * 100;
    qualitySlider.style.setProperty('--val', `${percent}%`);
  }

  qualitySlider.addEventListener('input', updateSliderVisuals);

  fileInput.addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') return;

    currentPdfFile = file;
    pdfNameText.textContent = file.name;
    pdfOriginalSizeText.textContent = formatBytes(file.size);
    pdfStatusText.textContent = 'Loading PDF...';
    pdfStatusText.style.color = 'var(--text-muted)';

    uploadArea.style.display = 'none';
    editorPanel.style.display = 'flex';

    try {
      const arrayBuffer = await file.arrayBuffer();
      pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      pdfStatusText.textContent = `Ready (${pdfDoc.numPages} pages)`;
    } catch (error) {
      console.error(error);
      pdfStatusText.textContent = 'Error loading PDF';
      pdfStatusText.style.color = '#ef4444';
    }
  });

  downloadButton.addEventListener('click', async function() {
    if (!currentPdfFile || !pdfDoc) return;

    const originalText = downloadButton.innerHTML;
    downloadButton.innerHTML = '⏳ Compressing...';
    downloadButton.disabled = true;
    pdfStatusText.textContent = 'Processing pages...';
    pdfStatusText.style.color = 'var(--text-main)';

    try {
      const { PDFDocument } = PDFLib;
      const newPdf = await PDFDocument.create();
      
      const quality = parseInt(qualitySlider.value) / 100;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 }); 
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        const imgDataUrl = canvas.toDataURL('image/jpeg', quality);
        const img = await newPdf.embedJpg(imgDataUrl);
        
        const newPage = newPdf.addPage([viewport.width, viewport.height]);
        newPage.drawImage(img, {
          x: 0, y: 0, width: viewport.width, height: viewport.height,
        });

        pdfStatusText.textContent = `Processing page ${i} of ${pdfDoc.numPages}...`;
      }

      const compressedPdfBytes = await newPdf.save();
      const blob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.download = `lostcrop-compressed-${Date.now()}.pdf`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      pdfStatusText.textContent = '✅ Done!';
      pdfStatusText.style.color = '#10b981';

    } catch (error) {
      console.error(error);
      pdfStatusText.textContent = 'Error compressing';
      pdfStatusText.style.color = '#ef4444';
    } finally {
      downloadButton.innerHTML = originalText;
      downloadButton.disabled = false;
    }
  });

  resetButton.addEventListener('click', function() {
    currentPdfFile = null;
    pdfDoc = null;
    fileInput.value = '';
    uploadArea.style.display = 'flex';
    editorPanel.style.display = 'none';
    qualitySlider.value = 70;
    updateSliderVisuals();
  });

  updateSliderVisuals();
})();

/* =========================================
   8. PDF PAGE REMOVER LOGIC
   ========================================= */
(function() {
  const fileInput = document.getElementById('pdfRemoveFileInput');
  const uploadArea = document.getElementById('pdfRemoveUploadArea');
  const editorPanel = document.getElementById('pdfRemoveEditorPanel');
  const pageGrid = document.getElementById('pageGrid');
  const downloadButton = document.getElementById('pdfRemoveDownloadButton');
  const resetButton = document.getElementById('pdfRemoveResetButton');
  const selectAllBtn = document.getElementById('removeSelectAllBtn');
  const deselectAllBtn = document.getElementById('removeDeselectAllBtn');

  let currentPdfBytes = null;
  let pdfDoc = null;
  let totalPages = 0;
  let pagesToDelete = new Set(); 

  function togglePageSelection(pageNum, element) {
    if (pagesToDelete.has(pageNum)) {
      pagesToDelete.delete(pageNum);
      element.classList.remove('selected');
    } else {
      if (pagesToDelete.size === totalPages - 1) {
        alert("You cannot delete all pages. At least one page must remain.");
        return;
      }
      pagesToDelete.add(pageNum);
      element.classList.add('selected');
    }
  }

  async function renderThumbnails() {
    pageGrid.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 0.4 }); 
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      
      const imgUrl = canvas.toDataURL('image/jpeg');

      const pageDiv = document.createElement('div');
      pageDiv.className = 'page-item';
      
      const img = document.createElement('img');
      img.src = imgUrl;
      
      const pageNumLabel = document.createElement('span');
      pageNumLabel.className = 'page-num';
      pageNumLabel.textContent = i;

      pageDiv.appendChild(img);
      pageDiv.appendChild(pageNumLabel);
      
      pageDiv.addEventListener('click', () => {
        togglePageSelection(i, pageDiv);
      });

      pageGrid.appendChild(pageDiv);
    }
  }

  fileInput.addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') return;

    uploadArea.style.display = 'none';
    editorPanel.style.display = 'flex';
    pageGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted);">⏳ Loading thumbnails...</div>';
    pagesToDelete.clear();

    try {
      const arrayBuffer = await file.arrayBuffer();
      currentPdfBytes = arrayBuffer;
      pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      totalPages = pdfDoc.numPages;
      
      await renderThumbnails();
    } catch (error) {
      console.error(error);
      pageGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #ef4444;">Error loading PDF.</div>';
    }
  });

  selectAllBtn.addEventListener('click', () => {
    const items = pageGrid.querySelectorAll('.page-item');
    pagesToDelete.clear();
    items.forEach((item, index) => {
      const pageNum = index + 1;
      if (pageNum !== totalPages) {
        pagesToDelete.add(pageNum);
        item.classList.add('selected');
      }
    });
  });

  deselectAllBtn.addEventListener('click', () => {
    const items = pageGrid.querySelectorAll('.page-item');
    pagesToDelete.clear();
    items.forEach(item => item.classList.remove('selected'));
  });

  downloadButton.addEventListener('click', async function() {
    if (!currentPdfBytes || pagesToDelete.size === 0) {
      alert("Please select at least one page to delete.");
      return;
    }

    const originalText = downloadButton.innerHTML;
    downloadButton.innerHTML = '⏳ Processing...';
    downloadButton.disabled = true;

    try {
      const { PDFDocument } = PDFLib;
      const originalPdf = await PDFDocument.load(currentPdfBytes);
      
      const pagesToKeepIndices = [];
      for (let i = 1; i <= totalPages; i++) {
        if (!pagesToDelete.has(i)) {
          pagesToKeepIndices.push(i - 1); 
        }
      }

      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(originalPdf, pagesToKeepIndices);
      copiedPages.forEach(page => newPdf.addPage(page));

      const newPdfBytes = await newPdf.save();
      const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.download = `lostcrop-modified-${Date.now()}.pdf`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error(error);
      alert("An error occurred while modifying the PDF.");
    } finally {
      downloadButton.innerHTML = originalText;
      downloadButton.disabled = false;
    }
  });

  resetButton.addEventListener('click', function() {
    currentPdfBytes = null;
    pdfDoc = null;
    totalPages = 0;
    pagesToDelete.clear();
    pageGrid.innerHTML = '';
    fileInput.value = '';
    uploadArea.style.display = 'flex';
    editorPanel.style.display = 'none';
  });
})();

/* =========================================
   9. CROP PDF LOGIC
   ========================================= */
(function() {
  const fileInput = document.getElementById('pdfCropFileInput');
  const uploadArea = document.getElementById('pdfCropUploadArea');
  const editorPanel = document.getElementById('pdfCropEditorPanel');
  const imageElement = document.getElementById('pdfCropImage');
  const pageCountText = document.getElementById('pdfCropPageCount');
  const statusText = document.getElementById('pdfCropStatus');
  const downloadButton = document.getElementById('pdfCropDownloadButton');
  const resetButton = document.getElementById('pdfCropResetButton');

  let pdfBytes = null;
  let pdfDoc = null;
  let originalViewport = null;
  let cropper = null;

  fileInput.addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') return;

    uploadArea.style.display = 'none';
    editorPanel.style.display = 'flex';
    statusText.textContent = 'Loading...';
    statusText.style.color = 'var(--text-muted)';
    downloadButton.disabled = true;

    if (cropper) { cropper.destroy(); cropper = null; }

    try {
      const arrayBuffer = await file.arrayBuffer();
      pdfBytes = arrayBuffer;
      pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      pageCountText.textContent = pdfDoc.numPages;

      const page = await pdfDoc.getPage(1);
      originalViewport = page.getViewport({ scale: 2.0 }); 
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = originalViewport.width;
      canvas.height = originalViewport.height;
      
      await page.render({ canvasContext: ctx, viewport: originalViewport }).promise;
      
      imageElement.src = canvas.toDataURL('image/jpeg');
      imageElement.style.display = 'block';

      imageElement.onload = () => {
        cropper = new Cropper(imageElement, {
          aspectRatio: NaN, viewMode: 1, dragMode: 'crop', autoCropArea: 0.9,
          cropBoxMovable: true, cropBoxResizable: true, toggleDragModeOnDblclick: false,
          background: false,
          ready: function() {
            statusText.textContent = 'Drag box to crop';
            statusText.style.color = '#10b981';
            downloadButton.disabled = false;
          }
        });
      };
    } catch (error) {
      console.error(error);
      statusText.textContent = 'Error loading PDF';
      statusText.style.color = '#ef4444';
    }
  });

  downloadButton.addEventListener('click', async function() {
    if (!cropper || !pdfBytes) return;

    const originalText = downloadButton.innerHTML;
    downloadButton.innerHTML = '⏳ Cropping...';
    downloadButton.disabled = true;
    statusText.textContent = 'Processing...';

    try {
      const cropData = cropper.getData(true);
      const unscaledViewport = originalViewport;
      const scale = unscaledViewport.scale;
      
      const cropX = cropData.x / scale;
      const cropWidth = cropData.width / scale;
      const cropHeight = cropData.height / scale;
      const cropY = (unscaledViewport.height / scale) - ((cropData.y + cropData.height) / scale);

      const { PDFDocument } = PDFLib;
      const originalPdf = await PDFDocument.load(pdfBytes);
      const totalPages = originalPdf.getPageCount();

      for (let i = 0; i < totalPages; i++) {
        const page = originalPdf.getPage(i);
        const { width, height } = page.getSize();
        
        const finalX = Math.max(0, Math.min(cropX, width));
        const finalY = Math.max(0, Math.min(cropY, height));
        const finalWidth = Math.min(cropWidth, width - finalX);
        const finalHeight = Math.min(cropHeight, height - finalY);

        page.setCropBox(finalX, finalY, finalWidth, finalHeight);
        page.setMediaBox(finalX, finalY, finalWidth, finalHeight);
      }

      const newPdfBytes = await originalPdf.save();
      const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.download = `lostcrop-cropped-${Date.now()}.pdf`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      statusText.textContent = '✅ Done!';
      statusText.style.color = '#10b981';

    } catch (error) {
      console.error(error);
      statusText.textContent = 'Error cropping PDF';
      statusText.style.color = '#ef4444';
    } finally {
      downloadButton.innerHTML = originalText;
      downloadButton.disabled = false;
    }
  });

  resetButton.addEventListener('click', function() {
    if (cropper) { cropper.destroy(); cropper = null; }
    pdfBytes = null;
    pdfDoc = null;
    fileInput.value = '';
    imageElement.src = '';
    imageElement.style.display = 'none';
    uploadArea.style.display = 'flex';
    editorPanel.style.display = 'none';
  });
})();

/* =========================================
   10. MERGE PDFs LOGIC
   ========================================= */
(function() {
  const fileInput = document.getElementById('mergePdfFileInput');
  const uploadArea = document.getElementById('mergePdfUploadArea');
  const editorPanel = document.getElementById('mergePdfEditorPanel');
  const mergeList = document.getElementById('mergeList');
  const downloadButton = document.getElementById('mergePdfDownloadButton');
  const resetButton = document.getElementById('mergePdfResetButton');

  let selectedPdfs = []; 

  fileInput.addEventListener('change', function(e) {
    const files = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
    if (files.length === 0) return;
    
    selectedPdfs = [...selectedPdfs, ...files];
    renderList();
  });

  function renderList() {
    if (selectedPdfs.length === 0) {
      uploadArea.style.display = 'flex';
      editorPanel.style.display = 'none';
      downloadButton.disabled = true;
      return;
    }

    uploadArea.style.display = 'none';
    editorPanel.style.display = 'flex';
    mergeList.innerHTML = '';
    
    downloadButton.disabled = selectedPdfs.length <
