(function () {
  'use strict';

  // ─── State ─────────────────────────────────────────────────────────────────
  let currentFile          = null;
  let activePreset         = null;
  let activePresetMaxBytes = null;
  let _abortController     = null;
  let _timedOut            = false;
  let _compressStart       = null;
  let _lastDownloadUrl     = null;
  let _lastPct             = 0;
  let _lastStageText       = { current: null, next: null };
  let _dotsInterval        = null;
  let _originalFrameCount  = null;

  // ─── Elements ──────────────────────────────────────────────────────────────
  const stage          = document.getElementById('stage');
  const fileInput      = document.getElementById('file-input');
  const fileInputRep   = document.getElementById('file-input-replace');
  const dropOverlay    = document.getElementById('drop-overlay');
  const dropPreview    = document.getElementById('drop-preview');
  const compThumb      = document.getElementById('compressing-thumb');
  const readyFilename  = document.getElementById('ready-filename');
  const readyFilesize  = document.getElementById('ready-filesize');
  const presetBtns     = document.querySelectorAll('.preset-btn');
  const compressBtn    = document.getElementById('compress-btn');
  const cancelBtn      = document.getElementById('cancel-btn');
  const flowLayout     = document.getElementById('flow-layout');
  const panelLeft      = document.getElementById('panel-left');
  const panelRight     = document.getElementById('panel-right');
  const panelLeftName  = document.getElementById('panel-left-name');
  const panelLeftSub   = document.getElementById('panel-left-sub');
  const panelLeftStat  = document.getElementById('panel-left-stat');
  const panelLeftStamp = document.getElementById('panel-left-stamp');
  const panelRightName = document.getElementById('panel-right-name');
  const panelRightSub  = document.getElementById('panel-right-sub');
  const panelRightStat = document.getElementById('panel-right-stat');
  const flowThumbFrame = document.getElementById('flow-thumb-frame');
  const beforeImg      = document.getElementById('before-img');
  const afterImg       = document.getElementById('after-img');
  const beforeSize     = document.getElementById('before-size');
  const afterSize      = document.getElementById('after-size');
  const statReduction  = document.getElementById('stat-reduction');
  const statTime       = document.getElementById('stat-time');
  const statQuality    = document.getElementById('stat-quality');
  const qualityWarn    = document.getElementById('quality-warning');
  const qualityText    = document.getElementById('quality-warning-text');
  const downloadBtn    = document.getElementById('download-btn');
  const copyBtn        = document.getElementById('copy-btn');
  const newFileBtn     = document.getElementById('new-file-btn');
  const printerText    = document.getElementById('printer-text');
  const printerDots    = document.getElementById('printer-dots');
  const printerCursor  = document.getElementById('printer-cursor');
  const statusLight    = document.getElementById('status-light');
  const stageLabel     = document.getElementById('stage-header-label');
  const stageProgress  = document.getElementById('stage-progress');
  const progressSegs   = ['seg-0','seg-1','seg-2','seg-3','seg-4','seg-5','seg-6','seg-7'].map(id => document.getElementById(id));

  // ─── State machine ──────────────────────────────────────────────────────────
  const STATE_META = {
    idle:             { light: '',           label: 'Standby',       cursor: true  },
    ready:            { light: 'ready',      label: 'File received', cursor: true  },
    compressing:      { light: 'processing', label: 'Processing',    cursor: false },
    'complete-flash': { light: 'done',       label: 'Complete',      cursor: false },
    done:             { light: 'done',       label: 'Complete',      cursor: false },
  };

  function setState(s) {
    stage.dataset.state = s;
    const meta = STATE_META[s];
    statusLight.dataset.state = meta.light;
    stageLabel.textContent    = meta.label;
    printerCursor.classList.toggle('hidden', !meta.cursor);
    // Lock mode tabs during compression so user can't navigate away mid-job
    const isCompressing = s === 'compressing';
    document.querySelectorAll('.mode-btn').forEach(b => { b.disabled = isCompressing; });
  }

  function setPrinter(msg) {
    printerText.textContent = msg;
  }

  function startDots() {
    let n = 0;
    printerDots.textContent = '';
    _dotsInterval = setInterval(() => {
      n = (n + 1) % 4;
      printerDots.textContent = '.'.repeat(n);
    }, 420);
  }

  function stopDots() {
    if (_dotsInterval) { clearInterval(_dotsInterval); _dotsInterval = null; }
    printerDots.textContent = '';
  }

  function setError(msg) {
    setPrinter(msg);
    statusLight.dataset.state = 'error';
    stageLabel.textContent = 'Error';
  }

  // ─── Progress segment ranges — 8 equal segments across 0–100 ───────────────
  const SEG_RANGES = Array.from({length: 8}, (_, i) => [i * 12.5, (i + 1) * 12.5]);

  function updateSegments(pct) {
    SEG_RANGES.forEach(([start, end], i) => {
      const fill = pct <= start ? 0 : pct >= end ? 100 : Math.round((pct - start) / (end - start) * 100);
      progressSegs[i].style.setProperty('--fill', fill + '%');
    });
  }

  // ─── Pipeline stages ────────────────────────────────────────────────────────
  const STAGES = [
    {
      from:    0,
      stage:   'stage-01',
      name:    'COLOUR PRESS',
      sub:     'palette under pressure',
      stat:    '256 → 64 colours',
      printer: 'Running colours through the press. 256 → 64.',
      next:    { name: 'FRAME TRIMMER', sub: 'excess removed' },
    },
    {
      from:    45,
      stage:   'stage-02',
      name:    'FRAME TRIMMER',
      sub:     'excess removed',
      stat:    'cadence reduced',
      printer: 'Trimming the frames. No one will notice.',
      next:    { name: 'OUTPUT STAGE', sub: 'fitting to tolerance' },
    },
    {
      from:    78,
      stage:   'stage-03',
      name:    'OUTPUT STAGE',
      sub:     'fitting to tolerance',
      stat:    null,
      printer: 'Squeezing it through. Almost there.',
      next:    { name: 'APPROVED', sub: 'within spec' },
    },
  ];

  function getPipelineStage(pct) {
    let s = STAGES[0];
    for (const candidate of STAGES) {
      if (pct >= candidate.from) s = candidate;
    }
    return s;
  }

  function flickerIn(el) {
    el.classList.remove('crt-on');
    void el.offsetWidth;
    el.classList.add('crt-on');
    setTimeout(() => el.classList.remove('crt-on'), 400);
  }

  function setStatFlicker(el, text) {
    el.classList.add('updating');
    setTimeout(() => {
      el.textContent = text;
      el.classList.remove('updating');
      void el.offsetWidth;
    }, 140);
  }

  function updatePanels(stageEntry) {
    if (stageEntry.name === _lastStageText.current && stageEntry.next.name === _lastStageText.next) return;
    const firstSet = _lastStageText.current === null;
    _lastStageText = { current: stageEntry.name, next: stageEntry.next.name };

    flowLayout.className = 'flow-layout ' + stageEntry.stage;

    let effectiveStat = stageEntry.stat;
    if (_originalFrameCount != null) {
      if (stageEntry.stage === 'stage-01') effectiveStat = `${_originalFrameCount} frames · 256 colours`;
      else if (stageEntry.stage === 'stage-02') effectiveStat = `${_originalFrameCount} frames → reducing`;
    }

    if (firstSet) {
      panelLeftName.textContent  = stageEntry.name;
      panelLeftSub.textContent   = stageEntry.sub;
      panelLeftStat.textContent  = effectiveStat || '';
      panelRightName.textContent = stageEntry.next.name;
      panelRightSub.textContent  = stageEntry.next.sub;
      panelRightStat.textContent = '';
      flickerIn(panelLeftName);
      flickerIn(panelRightName);
      return;
    }

    // DONE stamp briefly on outgoing panel
    panelLeftStamp.classList.add('visible');

    const HALF = 160;
    [panelLeft, panelRight].forEach(el => {
      el.style.animation = `panel-slide-out ${HALF}ms ease-in forwards`;
    });

    setTimeout(() => {
      panelLeftStamp.classList.remove('visible');
      panelLeftName.textContent  = stageEntry.name;
      panelLeftSub.textContent   = stageEntry.sub;
      panelLeftStat.textContent  = effectiveStat || '';
      panelRightName.textContent = stageEntry.next.name;
      panelRightSub.textContent  = stageEntry.next.sub;
      panelRightStat.textContent = '';

      panelLeft.style.animation  = `panel-slide-in ${HALF}ms ease-out`;
      panelRight.style.animation = `panel-slide-in-faded ${HALF}ms ease-out forwards`;
      flickerIn(panelLeftName);
      flickerIn(panelRightName);

      setTimeout(() => {
        panelLeft.style.animation  = '';
        panelRight.style.animation = '';
      }, HALF + 20);
    }, HALF);
  }

  // ─── Progress ───────────────────────────────────────────────────────────────
  function startProgress() {
    _lastPct = 0;
    progressSegs.forEach(s => s.style.setProperty('--fill', '0%'));
    stageProgress.classList.add('visible');
    flowLayout.className = 'flow-layout stage-01';
    flowThumbFrame.classList.remove('complete');
    startDots();
  }

  function updateProgress(pct, step) {
    if (pct == null || pct < _lastPct) return;
    _lastPct = pct;
    updateSegments(pct);
    const ps = getPipelineStage(pct);
    setPrinter(ps.printer);
    updatePanels(ps);
  }

  function finishProgress() {
    stopDots();
    flowLayout.className = 'flow-layout stage-done';
    flowThumbFrame.classList.add('complete');
    progressSegs.forEach(s => s.style.setProperty('--fill', '100%'));
    setTimeout(() => {
      stageProgress.classList.remove('visible');
      progressSegs.forEach(s => s.style.setProperty('--fill', '0%'));
    }, 600);
  }

  function resetProgress() {
    stopDots();
    stageProgress.classList.remove('visible');
    progressSegs.forEach(s => s.style.setProperty('--fill', '0%'));
    _lastPct = 0;
    _lastStageText = { current: null, next: null };
    _originalFrameCount = null;
    flowLayout.className = 'flow-layout';
    panelLeftStat.textContent  = '';
    panelRightStat.textContent = '';
    panelLeftStamp.classList.remove('visible');
    flowThumbFrame.classList.remove('complete');
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function formatBytes(bytes) {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024)    return Math.round(bytes / 1024) + ' KB';
    return bytes + ' B';
  }

  function formatElapsed(ms) {
    const s = Math.round(ms / 1000);
    return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  }

  function qualityRating(reductionPct, hasWarning) {
    if (hasWarning)         return 'Degraded';
    if (reductionPct >= 90) return 'Acceptable';
    if (reductionPct >= 60) return 'Good';
    return 'Excellent';
  }

  function resetResult() {
    afterImg.src            = '';
    afterSize.textContent   = '';
    statReduction.innerHTML = '';
    statTime.innerHTML      = '';
    statQuality.innerHTML   = '';
    qualityWarn.classList.remove('visible');
    qualityText.textContent = '';
    copyBtn.textContent     = 'Copy';
    copyBtn.disabled        = false;
    _lastDownloadUrl        = null;
  }

  // ─── File handling ──────────────────────────────────────────────────────────
  function handleFile(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.gif')) {
      setState('idle');
      setError('Error 415 — Unrecognised material. GIF files only. Feed it in again.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setState('idle');
      setError('Error 413 — Material exceeds intake tolerance. Max 50 MB. This is a gif compressor, not a miracle.');
      return;
    }

    currentFile = file;
    resetResult();

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target.result;
      dropPreview.src = src;
      compThumb.src   = src;
      beforeImg.src   = src;
      dropPreview.onload = () => {
        const dim  = `${dropPreview.naturalWidth}×${dropPreview.naturalHeight}`;
        const info = `${formatBytes(file.size)} · ${dim}`;
        readyFilesize.textContent = info;
        beforeSize.textContent    = info;
      };
    };
    reader.readAsDataURL(file);

    readyFilename.textContent = file.name;
    readyFilesize.textContent = formatBytes(file.size);

    setState('ready');
    setPrinter(
      `${formatBytes(file.size)} received. Confirm tolerance spec to compress. Press thumbnail to edit.`
    );
    updateCompressBtn();
  }

  // ─── Drag / drop ───────────────────────────────────────────────────────────
  stage.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropOverlay.classList.add('active');
  });

  stage.addEventListener('dragleave', (e) => {
    if (!stage.contains(e.relatedTarget)) {
      dropOverlay.classList.remove('active');
    }
  });

  stage.addEventListener('drop', (e) => {
    e.preventDefault();
    dropOverlay.classList.remove('active');
    handleFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change',    () => { handleFile(fileInput.files[0]);    fileInput.value    = ''; });
  fileInputRep.addEventListener('change', () => { handleFile(fileInputRep.files[0]); fileInputRep.value = ''; });

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
      batchMode.hidden  =  isSingle;
    });
  });

  // ─── Preset buttons ─────────────────────────────────────────────────────────
  function updateCompressBtn() {
    compressBtn.disabled = !(currentFile && activePreset);
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
        activePreset         = btn.dataset.preset;
        activePresetMaxBytes = parseInt(btn.dataset.maxBytes);
        localStorage.setItem('giffit_last_preset', activePreset);
      }
      updateCompressBtn();
    });
  });

  const lastPreset = localStorage.getItem('giffit_last_preset');
  if (lastPreset) {
    const btn = document.querySelector(`[data-preset="${lastPreset}"]`);
    if (btn) {
      btn.classList.add('active');
      activePreset         = lastPreset;
      activePresetMaxBytes = parseInt(btn.dataset.maxBytes);
    }
  }

  // ─── Compress ───────────────────────────────────────────────────────────────
  compressBtn.addEventListener('click', async () => {
    if (!currentFile || !activePreset) return;

    compressBtn.disabled = true;
    _timedOut            = false;
    _compressStart       = Date.now();

    setState('compressing');
    _lastStageText = { current: null, next: null };
    startProgress();
    updatePanels(STAGES[0]);
    setPrinter('Material received. Assessing the situation.');

    const fileMB   = currentFile.size / 1048576;
    const maxMs    = Math.max(60000, Math.ceil(fileMB * 30) * 1000);
    const formData = new FormData();
    formData.append('file',   currentFile);
    formData.append('preset', activePreset);

    try {
      _abortController  = new AbortController();
      const timeoutId   = setTimeout(() => { _timedOut = true; _abortController.abort(); }, maxMs);

      const response   = await fetch('/api/compress', { method: 'POST', body: formData, signal: _abortController.signal });
      const submitData = await response.json();

      if (!response.ok) {
        clearTimeout(timeoutId);
        resetProgress();
        setState('ready');
        setError(submitData.error || 'Error 500 — The machinery encountered resistance. Try again.');
        updateCompressBtn();
        return;
      }

      const sessionId = submitData.session_id;
      let result      = null;

      while (true) {
        if (_abortController.signal.aborted) break;
        await new Promise(r => setTimeout(r, 500));
        if (_abortController.signal.aborted) break;

        const sr = await fetch(`/api/status/${sessionId}`, { signal: _abortController.signal });
        const sd = await sr.json();

        if (sd.state === 'done') {
          result = sd.result;
          clearTimeout(timeoutId);
          break;
        }
        if (sd.state === 'error') {
          clearTimeout(timeoutId);
          resetProgress();
          setState('ready');
          setError(sd.error || 'Error 500 — The machinery encountered resistance. Try again.');
          updateCompressBtn();
          return;
        }

        if (sd.original_frame_count != null && _originalFrameCount === null) {
          _originalFrameCount = sd.original_frame_count;
        }

        updateProgress(sd.progress, sd.step || 'Optimising');
      }

      if (!result) return;

      finishProgress();

      // Show real final numbers in the panel stat while the blob is being fetched
      if (result.final_frame_count != null || result.final_palette != null) {
        const parts = [];
        if (result.final_frame_count != null) parts.push(`${result.final_frame_count} frames`);
        if (result.final_palette != null) parts.push(`${result.final_palette} colours`);
        setStatFlicker(panelLeftStat, parts.join(' · '));
      }

      const elapsed   = Date.now() - _compressStart;
      const fromLabel = formatBytes(currentFile.size);
      const toLabel   = formatBytes(result.compressed_size);

      // Populate after-image
      const blob = await fetch(result.download_url).then(r => r.blob());
      afterImg.src = URL.createObjectURL(blob);

      const [outW, outH] = result.compressed_dimensions || [];
      afterSize.textContent = outW ? `${toLabel} · ${outW}×${outH}` : toLabel;

      // Stats row
      statReduction.innerHTML = `<span class="stat-label">Size</span>${fromLabel} → ${toLabel} · ${result.reduction_pct}% smaller`;
      statTime.innerHTML      = `<span class="stat-label">Time</span>${formatElapsed(elapsed)}`;
      statQuality.innerHTML   = `<span class="stat-label">Quality</span>${qualityRating(result.reduction_pct, result.quality_warning)}`;

      if (result.quality_warning) {
        qualityText.textContent = result.warning_reason;
        qualityWarn.classList.add('visible');
      }

      downloadBtn.href     = result.download_url;
      _lastDownloadUrl     = result.download_url;
      copyBtn.style.display = (window.ClipboardItem && navigator.clipboard?.write) ? '' : 'none';

      setPrinter(`Fit. ${toLabel}. The machinery did not break.`);
      setState('complete-flash');
      setTimeout(() => setState('done'), 900);

    } catch (err) {
      resetProgress();
      setState('ready');
      if (err.name === 'AbortError') {
        if (_timedOut) setError('Error 408 — The press needs a moment. Try a smaller file or a different preset.');
      } else {
        setError('Error 503 — The machinery encountered resistance. Try again.');
        console.error(err);
      }
      updateCompressBtn();
    } finally {
      _abortController = null;
      compressBtn.disabled = false;
    }
  });

  cancelBtn.addEventListener('click', () => {
    if (_abortController) _abortController.abort();
    resetProgress();
    setPrinter('Operation aborted. Select tolerance spec to try again.');
    setState('ready');
    updateCompressBtn();
  });

  // ─── Copy ───────────────────────────────────────────────────────────────────
  async function copyGif(url) {
    if (!window.ClipboardItem || !navigator.clipboard?.write) return false;
    try {
      const blob = await fetch(url).then(r => r.blob());
      await navigator.clipboard.write([new ClipboardItem({ 'image/gif': blob })]);
      return true;
    } catch { return false; }
  }

  copyBtn.addEventListener('click', async () => {
    if (!_lastDownloadUrl) return;
    copyBtn.disabled    = true;
    copyBtn.textContent = 'Copying…';
    const ok            = await copyGif(_lastDownloadUrl);
    copyBtn.textContent = ok ? 'Copied.' : 'Not supported';
    copyBtn.disabled    = false;
    if (ok) setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
  });

  // ─── New file ───────────────────────────────────────────────────────────────
  newFileBtn.addEventListener('click', () => {
    currentFile          = null;
    activePreset         = null;
    activePresetMaxBytes = null;
    presetBtns.forEach(b => b.classList.remove('active'));
    dropPreview.src = '';
    compThumb.src   = '';
    beforeImg.src   = '';
    fileInput.value    = '';
    fileInputRep.value = '';
    resetResult();
    setState('idle');
    setPrinter('No material loaded.');
    updateCompressBtn();
  });

})();
