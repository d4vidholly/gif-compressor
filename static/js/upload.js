(function () {
  'use strict';

  // ─── State ─────────────────────────────────────────────────────────────────
  let currentFile = null;
  let activePreset = null;
  let activePresetMaxBytes = null;
  let _fromLabel = '';
  let _toLabel = '';

  // ─── Elements ──────────────────────────────────────────────────────────────
  const dropZone       = document.getElementById('drop-zone');
  const dropPreview    = document.getElementById('drop-preview');
  const fileInput      = document.getElementById('file-input');
  const controls       = document.getElementById('controls');
  const presetBtns     = document.querySelectorAll('.preset-btn');
  const compressBtn    = document.getElementById('compress-btn');
  const progressWrap   = document.getElementById('progress-wrap');
  const progressFill   = document.getElementById('progress-fill');
  const progressEta    = document.getElementById('progress-eta');
  const cancelBtn      = document.getElementById('cancel-btn');
  const statusBar      = document.getElementById('status-bar');
  const comparison     = document.getElementById('comparison');
  const beforeImg      = document.getElementById('before-img');
  const afterImg       = document.getElementById('after-img');
  const beforeSize     = document.getElementById('before-size');
  const afterSize      = document.getElementById('after-size');
  const downloadBar      = document.getElementById('download-bar');
  const downloadBtn      = document.getElementById('download-btn');
  const copyBtn          = document.getElementById('copy-btn');
  const reductionBadge   = document.getElementById('reduction-badge');
  const qualityWarning   = document.getElementById('quality-warning');
  const qualityWarningText = document.getElementById('quality-warning-text');

  // ─── Progress ───────────────────────────────────────────────────────────────
  const SECS_PER_MB    = 30;  // timeout budget per MB of input
  const MIN_TIMEOUT_SECS = 60;
  const EST_SECS_PER_MB  = 3; // for "taking longer" warning threshold

  let _timeoutTimer    = null;
  let _abortController = null;
  let _timedOut        = false;
  let _lastProgressPct = 0;
  let _lastDownloadUrl = null;

  function startProgress(fileSizeBytes, targetBytes) {
    const fileMB = fileSizeBytes / (1024 * 1024);
    const maxSecs = Math.max(MIN_TIMEOUT_SECS, Math.ceil(fileMB * SECS_PER_MB));
    _fromLabel = formatBytes(fileSizeBytes);
    _toLabel   = formatBytes(targetBytes);
    _lastProgressPct = 0;
    progressFill.style.transition = 'none';
    progressFill.style.width = '0%';
    progressWrap.classList.add('visible');
    cancelBtn.style.display = '';
    progressEta.innerHTML = `Optimising &middot; ${_fromLabel} &rarr; ${_toLabel} &middot; 0%`;

    _timeoutTimer = setTimeout(() => {
      _timedOut = true;
      if (_abortController) _abortController.abort();
    }, maxSecs * 1000);
  }

  function updateProgress(pct, step) {
    if (pct == null || pct < _lastProgressPct) return; // never go backward
    _lastProgressPct = pct;
    const label = step || 'Optimising';
    progressFill.style.transition = 'width 0.4s ease-out';
    progressFill.style.width = pct + '%';
    progressEta.innerHTML = `${label} &middot; ${_fromLabel} &rarr; ${_toLabel} &middot; ${pct}%`;
  }

  function finishProgress() {
    clearTimeout(_timeoutTimer);
    _timeoutTimer = null;
    cancelBtn.style.display = 'none';
    progressFill.style.transition = 'width 0.2s ease-out';
    progressFill.style.width = '100%';
    progressEta.textContent = '';
    setTimeout(() => {
      progressWrap.classList.remove('visible');
      progressFill.style.width = '0%';
    }, 500);
  }

  function resetProgress() {
    clearTimeout(_timeoutTimer);
    _timeoutTimer = null;
    cancelBtn.style.display = 'none';
    progressWrap.classList.remove('visible');
    progressFill.style.width = '0%';
    progressEta.textContent = '';
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function formatBytes(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
    return bytes + ' B';
  }

  function setStatus(msg, isError = false) {
    statusBar.textContent = msg;
    statusBar.classList.toggle('error', isError);
    statusBar.classList.add('visible');
  }

  function clearStatus() {
    statusBar.textContent = '';
    statusBar.classList.remove('visible', 'error');
  }

  function resetComparison() {
    comparison.classList.remove('visible');
    downloadBar.classList.remove('visible');
    qualityWarning.classList.remove('visible');
    afterImg.src = '';
    afterSize.textContent = '';
    reductionBadge.textContent = '';
    qualityWarningText.textContent = '';
    copyBtn.textContent = 'Copy';
    copyBtn.disabled = false;
    _lastDownloadUrl = null;
  }

  async function copyGifToClipboard(url) {
    if (!window.ClipboardItem || !navigator.clipboard?.write) return false;
    try {
      const blob = await fetch(url).then(r => r.blob());
      await navigator.clipboard.write([new ClipboardItem({ 'image/gif': blob })]);
      return true;
    } catch {
      return false;
    }
  }

  copyBtn.addEventListener('click', async () => {
    if (!_lastDownloadUrl) return;
    copyBtn.disabled = true;
    copyBtn.textContent = 'Copying…';
    const ok = await copyGifToClipboard(_lastDownloadUrl);
    copyBtn.textContent = ok ? 'Copied!' : 'Not supported';
    copyBtn.disabled = false;
    if (ok) setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
  });

  // ─── File selection ─────────────────────────────────────────────────────────
  function handleFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.gif')) {
      setStatus('Only GIF files are supported.', true);
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setStatus('File too large. Maximum size is 50 MB.', true);
      return;
    }

    currentFile = file;
    clearStatus();
    resetComparison();
    dropZone.classList.remove('has-file');

    const reader = new FileReader();
    reader.onload = (e) => {
      dropPreview.src = e.target.result;
      dropZone.classList.add('has-file');
      beforeSize.textContent = formatBytes(file.size);
      beforeImg.onload = () => {
        beforeSize.textContent = `${formatBytes(file.size)} · ${beforeImg.naturalWidth}×${beforeImg.naturalHeight}`;
      };
      beforeImg.src = e.target.result;
    };
    reader.readAsDataURL(file);

    controls.classList.add('visible');
    updateCompressBtn();

    dropZone.querySelector('.drop-zone-label').innerHTML =
      '<strong>' + file.name + '</strong> &mdash; ' + formatBytes(file.size);
  }

  // ─── Mode selector ──────────────────────────────────────────────────────────
  const modeBtns   = document.querySelectorAll('.mode-btn');
  const singleMode = document.getElementById('single-mode');
  const batchMode  = document.getElementById('batch-mode');

  modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      modeBtns.forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const isSingle = btn.dataset.mode === 'single';
      singleMode.hidden = !isSingle;
      batchMode.hidden  = isSingle;
    });
  });

  // ─── Drag and drop ──────────────────────────────────────────────────────────
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', () => {
    handleFile(fileInput.files[0]);
  });

  // ─── Preset buttons ─────────────────────────────────────────────────────────
  function updateCompressBtn() {
    const ready = currentFile !== null && activePreset !== null;
    compressBtn.disabled = !ready;
    compressBtn.title = ready ? '' : (currentFile ? 'Select a platform preset' : 'Drop a GIF and select a preset');
  }

  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (activePreset === btn.dataset.preset) {
        btn.classList.remove('active');
        activePreset = null;
        activePresetMaxBytes = null;
      } else {
        presetBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activePreset = btn.dataset.preset;
        activePresetMaxBytes = parseInt(btn.dataset.maxBytes);
        localStorage.setItem('giffit_last_preset', activePreset);
      }
      updateCompressBtn();
    });
  });

  // Restore last-used preset on load
  const lastPreset = localStorage.getItem('giffit_last_preset');
  if (lastPreset) {
    const btn = document.querySelector(`[data-preset="${lastPreset}"]`);
    if (btn) {
      btn.classList.add('active');
      activePreset = lastPreset;
      activePresetMaxBytes = parseInt(btn.dataset.maxBytes);
      updateCompressBtn();
    }
  }

  // ─── Compress ───────────────────────────────────────────────────────────────
  compressBtn.addEventListener('click', async () => {
    if (!currentFile || !activePreset) return;

    compressBtn.disabled = true;
    compressBtn.textContent = 'Compressing…';
    _timedOut = false;
    clearStatus();
    resetComparison();
    startProgress(currentFile.size, activePresetMaxBytes);

    const formData = new FormData();
    formData.append('file', currentFile);
    formData.append('preset', activePreset);

    try {
      _abortController = new AbortController();
      const response = await fetch('/api/compress', {
        method: 'POST',
        body: formData,
        signal: _abortController.signal,
      });

      const submitData = await response.json();

      if (!response.ok) {
        resetProgress();
        setStatus(submitData.error || 'Compression failed.', true);
        return;
      }

      const sessionId = submitData.session_id;
      const fileMB = currentFile.size / (1024 * 1024);
      const estimatedMs = Math.max(5000, Math.ceil(fileMB * EST_SECS_PER_MB) * 1000);
      const pollStart = performance.now();
      let warnShown = false;
      let result = null;

      while (true) {
        if (_abortController.signal.aborted) break;
        await new Promise(resolve => setTimeout(resolve, 500));
        if (_abortController.signal.aborted) break;

        const statusResponse = await fetch(`/api/status/${sessionId}`, {
          signal: _abortController.signal,
        });
        const statusData = await statusResponse.json();

        if (statusData.state === 'done') {
          result = statusData.result;
          break;
        } else if (statusData.state === 'error') {
          resetProgress();
          setStatus(statusData.error || 'Compression failed.', true);
          return;
        }

        // state === 'processing' — update bar from real server progress
        updateProgress(statusData.progress, statusData.step || 'Optimising');

        if (!warnShown && performance.now() - pollStart > estimatedMs) {
          warnShown = true;
          setStatus('Taking longer than expected — still working.');
        }
      }

      if (!result) return;

      finishProgress();

      const afterResponse = await fetch(result.download_url);
      const blob = await afterResponse.blob();
      afterImg.src = URL.createObjectURL(blob);
      const [outW, outH] = result.compressed_dimensions || [];
      afterSize.textContent = outW
        ? `${formatBytes(result.compressed_size)} · ${outW}×${outH}`
        : formatBytes(result.compressed_size);
      afterSize.classList.add('reduced');
      comparison.classList.add('visible');

      if (result.quality_warning) {
        qualityWarningText.textContent = result.warning_reason;
        qualityWarning.classList.add('visible');
      }

      reductionBadge.textContent = `${result.reduction_pct}% smaller`;
      downloadBtn.href = result.download_url;
      _lastDownloadUrl = result.download_url;
      copyBtn.style.display = (window.ClipboardItem && navigator.clipboard?.write) ? '' : 'none';
      downloadBar.classList.add('visible');

      clearStatus();

    } catch (err) {
      resetProgress();
      if (err.name === 'AbortError') {
        if (_timedOut) {
          setStatus('Compression timed out. Try a smaller file or a different preset.', true);
        }
      } else {
        setStatus('Something went wrong. Please try again.', true);
        console.error(err);
      }
    } finally {
      _abortController = null;
      compressBtn.textContent = 'Compress';
      updateCompressBtn();
    }
  });

  cancelBtn.addEventListener('click', () => {
    if (_abortController) _abortController.abort();
  });

})();
