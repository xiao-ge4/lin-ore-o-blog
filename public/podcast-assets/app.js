/**
 * KPodcast - 前端逻辑
 * 功能：音频波形、拖拽排序、骨架屏、字数统计、复制脚本、历史记录
 */

// API 基础地址
const API_BASE = window.PODCAST_API_BASE || 'http://localhost:8001';

// 状态
let currentMode = 'Query';
let selectedFiles = [];
let isGenerating = false;
let isSynthesizing = false;
let isGeneratingPPT = false;
let isExportingSlides = false;
let wavesurfer = null;
let isPlaying = false;

// PPT 相关状态
let currentSlidesMarkdown = '';
let previewHtmlSlides = [];
let currentSlideIndex = 0;

// 临时存储（脚本生成后、语音合成前）
let pendingScript = '';
let pendingTitle = '';
let pendingSources = [];
let pendingHostMode = 'dual';

// 历史记录（从 COS 云端加载）
let historyCache = [];

// DOM 元素缓存
const elements = {};

// 初始化
function init() {
  bindElements();
  bindEvents();
  loadVoices();
  updateInputMode();
  loadHistory();
  initWaveSurfer();
}

// 绑定 DOM 元素
function bindElements() {
  elements.inputMain = document.getElementById('inputMain');
  elements.inputPlaceholder = document.getElementById('inputPlaceholder');
  elements.inputSection = document.getElementById('inputSection');
  elements.charCount = document.getElementById('charCount');
  elements.fileInput = document.getElementById('fileInput');
  elements.fileSection = document.getElementById('fileSection');
  elements.fileList = document.getElementById('fileList');
  
  elements.btnModeText = document.getElementById('btnModeText');
  elements.btnModeUrl = document.getElementById('btnModeUrl');
  elements.btnModeFile = document.getElementById('btnModeFile');
  
  elements.instructionInput = document.getElementById('instructionInput');
  elements.hostModeSelect = document.getElementById('hostModeSelect');
  elements.styleSelect = document.getElementById('styleSelect');
  elements.customStyleContainer = document.getElementById('customStyleContainer');
  elements.customStyleInput = document.getElementById('customStyleInput');
  elements.introStyleSelect = document.getElementById('introStyleSelect');
  elements.customIntroContainer = document.getElementById('customIntroContainer');
  elements.customIntroScript = document.getElementById('customIntroScript');
  elements.customIntroBgmContainer = document.getElementById('customIntroBgmContainer');
  elements.customIntroBgm = document.getElementById('customIntroBgm');
  elements.voiceA = document.getElementById('voiceA');
  elements.voiceB = document.getElementById('voiceB');
  elements.voiceAContainer = document.getElementById('voiceAContainer');
  elements.voiceBContainer = document.getElementById('voiceBContainer');
  elements.voiceALabel = document.getElementById('voiceALabel');
  elements.ttsSpeed = document.getElementById('ttsSpeed');
  elements.autoDetect = document.getElementById('autoDetect');
  
  elements.generateBtn = document.getElementById('generateBtn');
  elements.progressSection = document.getElementById('progressSection');
  elements.progressFill = document.getElementById('progressFill');
  elements.progressText = document.getElementById('progressText');
  elements.errorMessage = document.getElementById('errorMessage');
  
  elements.resultPlaceholder = document.getElementById('resultPlaceholder');
  elements.skeletonContainer = document.getElementById('skeletonContainer');
  elements.resultContent = document.getElementById('resultContent');
  elements.audioPlayer = document.getElementById('audioPlayer');
  elements.playBtn = document.getElementById('playBtn');
  elements.currentTime = document.getElementById('currentTime');
  elements.totalTime = document.getElementById('totalTime');
  elements.downloadBtn = document.getElementById('downloadBtn');
  elements.scriptContent = document.getElementById('scriptContent');
  elements.scriptEditor = document.getElementById('scriptEditor');
  elements.scriptEditHint = document.getElementById('scriptEditHint');
  elements.synthesizeSection = document.getElementById('synthesizeSection');
  elements.synthesizeBtn = document.getElementById('synthesizeBtn');
  elements.audioCard = document.getElementById('audioCard');
  elements.copyScriptBtn = document.getElementById('copyScriptBtn');
  elements.primarySources = document.getElementById('primarySources');
  elements.supplementarySources = document.getElementById('supplementarySources');
  elements.supplementaryGroup = document.getElementById('supplementaryGroup');
  elements.historyList = document.getElementById('historyList');
  elements.clearHistoryBtn = document.getElementById('clearHistoryBtn');
  
  // PPT 相关元素
  elements.generatePPTBtn = document.getElementById('generatePPTBtn');
  elements.pptEditorSection = document.getElementById('pptEditorSection');
  elements.slidesMarkdown = document.getElementById('slidesMarkdown');
  elements.previewSlidesBtn = document.getElementById('previewSlidesBtn');
  elements.exportPdfBtn = document.getElementById('exportPdfBtn');
  elements.exportPptxBtn = document.getElementById('exportPptxBtn');
  elements.downloadMarkdownBtn = document.getElementById('downloadMarkdownBtn');
  elements.pptStatusMessage = document.getElementById('pptStatusMessage');
  elements.previewModal = document.getElementById('previewModal');
  elements.closePreviewBtn = document.getElementById('closePreviewBtn');
  elements.previewContainer = document.getElementById('previewContainer');
  elements.prevSlideBtn = document.getElementById('prevSlideBtn');
  elements.nextSlideBtn = document.getElementById('nextSlideBtn');
  elements.slideCounter = document.getElementById('slideCounter');
}

// 绑定事件
function bindEvents() {
  // 模式切换按钮
  elements.btnModeText?.addEventListener('click', () => setMode('text'));
  elements.btnModeUrl?.addEventListener('click', () => setMode('url'));
  elements.btnModeFile?.addEventListener('click', () => setMode('file'));
  
  // 主持人模式切换
  elements.hostModeSelect?.addEventListener('change', updateHostModeUI);
  
  // 播客风格切换
  elements.styleSelect?.addEventListener('change', updateStyleUI);
  
  // 开场风格切换
  elements.introStyleSelect?.addEventListener('change', updateIntroStyleUI);
  
  // 输入字数统计
  elements.inputMain?.addEventListener('input', updateCharCount);
  
  // 文件上传
  elements.inputSection?.addEventListener('click', (e) => {
    if (currentMode === 'PDF文件' && (e.target === elements.inputSection || e.target.classList.contains('input-placeholder'))) {
      elements.fileInput?.click();
    }
  });
  
  elements.inputSection?.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (currentMode === 'PDF文件') {
      elements.inputSection.classList.add('dragover');
    }
  });
  
  elements.inputSection?.addEventListener('dragleave', () => {
    elements.inputSection.classList.remove('dragover');
  });
  
  elements.inputSection?.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.inputSection.classList.remove('dragover');
    if (currentMode === 'PDF文件') {
      handleFiles(e.dataTransfer.files);
    }
  });
  
  elements.fileInput?.addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });
  
  // 生成脚本按钮
  elements.generateBtn?.addEventListener('click', generateScript);
  
  // 合成语音按钮
  elements.synthesizeBtn?.addEventListener('click', synthesizeAudio);
  
  // 播放按钮
  elements.playBtn?.addEventListener('click', togglePlay);
  
  // 下载按钮
  elements.downloadBtn?.addEventListener('click', downloadAudio);
  
  // 复制脚本按钮
  elements.copyScriptBtn?.addEventListener('click', copyScript);
  
  // 清除历史
  elements.clearHistoryBtn?.addEventListener('click', clearHistory);
  
  // PPT 相关事件
  elements.generatePPTBtn?.addEventListener('click', generatePPT);
  elements.previewSlidesBtn?.addEventListener('click', previewSlides);
  elements.exportPdfBtn?.addEventListener('click', () => exportSlides('pdf'));
  elements.exportPptxBtn?.addEventListener('click', () => exportSlides('pptx'));
  elements.downloadMarkdownBtn?.addEventListener('click', downloadMarkdown);
  elements.closePreviewBtn?.addEventListener('click', closePreview);
  elements.prevSlideBtn?.addEventListener('click', prevSlide);
  elements.nextSlideBtn?.addEventListener('click', nextSlide);
}

// 初始化波形
function initWaveSurfer() {
  if (typeof WaveSurfer === 'undefined') {
    // 优先使用本地文件，备选 CDN
    const sources = [
      '/podcast-assets/wavesurfer.min.js',  // 本地文件优先
      'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/wavesurfer.js/7.8.6/wavesurfer.min.js'
    ];
    
    let loaded = false;
    
    function tryLoad(index) {
      if (index >= sources.length || loaded) {
        if (!loaded) {
          console.error('WaveSurfer 所有来源加载失败，音频波形不可用');
        }
        return;
      }
      
      const script = document.createElement('script');
      script.src = sources[index];
      script.onload = () => {
        loaded = true;
        console.log('WaveSurfer 加载成功:', sources[index]);
        createWaveSurfer();
      };
      script.onerror = () => {
        console.warn('WaveSurfer 加载失败:', sources[index]);
        tryLoad(index + 1);
      };
      document.head.appendChild(script);
    }
    
    tryLoad(0);
  } else {
    createWaveSurfer();
  }
}

function createWaveSurfer() {
  const container = document.getElementById('waveform');
  if (!container || typeof WaveSurfer === 'undefined') return;
  
  wavesurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: '#D4D4D8',
    progressColor: '#7C3AED',
    cursorColor: '#7C3AED',
    barWidth: 3,
    barRadius: 3,
    barGap: 2,
    height: 80,
    responsive: true,
  });
  
  wavesurfer.on('ready', () => {
    if (elements.totalTime) {
      elements.totalTime.textContent = formatTime(wavesurfer.getDuration());
    }
  });
  
  wavesurfer.on('audioprocess', () => {
    if (elements.currentTime) {
      elements.currentTime.textContent = formatTime(wavesurfer.getCurrentTime());
    }
  });
  
  wavesurfer.on('finish', () => {
    isPlaying = false;
    updatePlayButton();
  });
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function togglePlay() {
  if (!wavesurfer) return;
  wavesurfer.playPause();
  isPlaying = !isPlaying;
  updatePlayButton();
}

function updatePlayButton() {
  if (elements.playBtn) {
    elements.playBtn.textContent = isPlaying ? '⏸' : '▶';
  }
}

// 更新字数统计
function updateCharCount() {
  if (!elements.charCount || !elements.inputMain) return;
  
  const length = elements.inputMain.value.length;
  elements.charCount.textContent = `${length} 字`;
  
  // 根据字数显示不同颜色
  elements.charCount.classList.remove('warning', 'danger');
  if (length > 50000) {
    elements.charCount.classList.add('danger');
  } else if (length > 30000) {
    elements.charCount.classList.add('warning');
  }
}

// 设置输入模式
function setMode(mode) {
  elements.btnModeText?.classList.toggle('active', mode === 'text');
  elements.btnModeUrl?.classList.toggle('active', mode === 'url');
  elements.btnModeFile?.classList.toggle('active', mode === 'file');
  
  if (mode === 'text') {
    currentMode = 'Query';
  } else if (mode === 'url') {
    currentMode = 'URL';
  } else if (mode === 'file') {
    currentMode = 'PDF文件';
  }
  
  updateInputMode();
}

// 更新主持人模式 UI
function updateHostModeUI() {
  const hostMode = elements.hostModeSelect?.value || 'dual';
  const isSingleMode = hostMode === 'single';
  
  // 显示/隐藏主持人 B 选择器
  if (elements.voiceBContainer) {
    elements.voiceBContainer.style.display = isSingleMode ? 'none' : 'block';
  }
  
  // 更新主持人 A 标签
  if (elements.voiceALabel) {
    elements.voiceALabel.textContent = isSingleMode ? '主持人' : '主持人 A';
  }
}

// 更新播客风格 UI
function updateStyleUI() {
  const style = elements.styleSelect?.value || 'chat';
  const isCustom = style === 'custom';
  
  // 显示/隐藏自定义风格输入框
  if (elements.customStyleContainer) {
    elements.customStyleContainer.style.display = isCustom ? 'block' : 'none';
  }
}

// 更新开场风格 UI
function updateIntroStyleUI() {
  const introStyle = elements.introStyleSelect?.value || 'general';
  const isCustom = introStyle === 'custom';
  
  // 显示/隐藏自定义片头输入框
  if (elements.customIntroContainer) {
    elements.customIntroContainer.style.display = isCustom ? 'block' : 'none';
  }
  if (elements.customIntroBgmContainer) {
    elements.customIntroBgmContainer.style.display = isCustom ? 'block' : 'none';
  }
}

// 更新输入区域
function updateInputMode() {
  const isFileMode = currentMode === 'PDF文件';
  
  if (elements.inputPlaceholder) {
    if (currentMode === 'Query') {
      elements.inputPlaceholder.textContent = '输入关键词或主题，AI 将搜索相关内容生成播客';
    } else if (currentMode === 'URL') {
      elements.inputPlaceholder.textContent = '粘贴网页链接，AI 将提取内容生成播客';
    } else {
      elements.inputPlaceholder.textContent = '点击上传或拖拽 PDF 文件到此处';
    }
  }
  
  if (elements.inputMain) {
    elements.inputMain.style.display = isFileMode ? 'none' : 'block';
    elements.inputMain.placeholder = currentMode === 'URL' 
      ? 'https://example.com/article' 
      : '例如：人工智能最新发展趋势、量子计算入门...';
  }
  
  if (elements.charCount) {
    elements.charCount.style.display = isFileMode ? 'none' : 'block';
  }
  
  if (elements.fileSection) {
    elements.fileSection.classList.toggle('visible', isFileMode && selectedFiles.length > 0);
  }
  
  if (elements.inputSection) {
    elements.inputSection.style.cursor = isFileMode ? 'pointer' : 'text';
  }
}

// 处理文件
function handleFiles(files) {
  for (const file of files) {
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      if (!selectedFiles.some(f => f.name === file.name)) {
        selectedFiles.push(file);
      }
    }
  }
  updateFileList();
  updateInputMode();
}

// 更新文件列表（支持拖拽排序）
function updateFileList() {
  if (!elements.fileList) return;
  
  elements.fileList.innerHTML = selectedFiles.map((file, index) => `
    <div class="file-item" draggable="true" data-index="${index}">
      <div class="file-item-left">
        <span class="file-drag-handle">⋮⋮</span>
        <span class="file-item-index">${index + 1}</span>
        <span>📄</span>
        <span class="file-item-name">${file.name}</span>
      </div>
      <span class="file-remove" onclick="removeFile(${index})">×</span>
    </div>
  `).join('');
  
  // 绑定拖拽事件
  bindDragEvents();
}

// 绑定拖拽排序事件
function bindDragEvents() {
  const items = elements.fileList?.querySelectorAll('.file-item');
  if (!items) return;
  
  let draggedItem = null;
  
  items.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedItem = null;
      items.forEach(i => i.classList.remove('drag-over'));
    });
    
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (item !== draggedItem) {
        item.classList.add('drag-over');
      }
    });
    
    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });
    
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      
      if (draggedItem && item !== draggedItem) {
        const fromIndex = parseInt(draggedItem.dataset.index);
        const toIndex = parseInt(item.dataset.index);
        
        // 重新排序
        const [movedFile] = selectedFiles.splice(fromIndex, 1);
        selectedFiles.splice(toIndex, 0, movedFile);
        
        updateFileList();
      }
    });
  });
}

// 移除文件
window.removeFile = function(index) {
  selectedFiles.splice(index, 1);
  updateFileList();
  updateInputMode();
};

// 加载音色列表
async function loadVoices() {
  try {
    const res = await fetch(`${API_BASE}/api/voices`);
    const data = await res.json();
    
    if (data.voices && data.voices.length > 0) {
      const options = data.voices.map(v => 
        `<option value="${v.value}" data-sample-url="${v.sample_url || ''}">${v.label}</option>`
      ).join('');
      
      if (elements.voiceA) elements.voiceA.innerHTML = options;
      if (elements.voiceB) elements.voiceB.innerHTML = options;
      
      if (elements.voiceB && data.voices.length > 1) {
        elements.voiceB.selectedIndex = 1;
      }
    }
  } catch (e) {
    console.log('无法加载音色列表，使用默认值');
  }
}

// 试听音色
window.previewVoice = function(voiceType) {
  const selectElement = voiceType === 'A' ? elements.voiceA : elements.voiceB;
  if (!selectElement) {
    console.error('找不到音色选择器:', voiceType);
    return;
  }
  
  const selectedOption = selectElement.options[selectElement.selectedIndex];
  const sampleUrl = selectedOption ? selectedOption.getAttribute('data-sample-url') : null;
  
  // 从 value 中提取音色编号
  const voiceValue = selectElement.value;
  const voiceId = voiceValue.split(':')[0];
  
  if (sampleUrl && sampleUrl !== 'undefined' && sampleUrl !== '') {
    playVoiceSample(`${API_BASE}${sampleUrl}`);
  } else {
    playVoiceSample(`${API_BASE}/api/voice-sample/${voiceId}`);
  }
};

// 播放音色样本
function playVoiceSample(url) {
  console.log('播放音色样本:', url);
  
  // 创建新的音频元素播放
  const audio = new Audio(url);
  audio.play().then(() => {
    console.log('播放成功');
  }).catch(e => {
    console.error('播放失败:', e);
    showError('试听失败，请稍后重试');
  });
}

// 第一阶段：生成脚本
async function generateScript() {
  if (isGenerating) return;
  
  const validation = validateInput();
  if (!validation.valid) {
    showError(validation.message);
    return;
  }

  isGenerating = true;
  hideError();
  showSkeleton();
  elements.generateBtn.disabled = true;
  elements.generateBtn.classList.add('loading');
  elements.generateBtn.innerHTML = '<span>⏳</span> 生成脚本中...';

  try {
    const formData = new FormData();
    formData.append('mode', currentMode);
    
    if (currentMode === 'Query') {
      formData.append('query', elements.inputMain?.value || '');
    } else if (currentMode === 'URL') {
      formData.append('url', elements.inputMain?.value || '');
    } else if (currentMode === 'PDF文件') {
      selectedFiles.forEach(file => {
        formData.append('pdf_files', file);
      });
    }

    formData.append('instruction', elements.instructionInput?.value || '');
    const selectedStyle = elements.styleSelect?.value || 'chat';
    formData.append('style', selectedStyle);
    if (selectedStyle === 'custom') {
      formData.append('custom_style', elements.customStyleInput?.value || '');
    }
    formData.append('host_mode', elements.hostModeSelect?.value || 'dual');

    const res = await fetch(`${API_BASE}/api/generate-script`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || '生成脚本失败');
    }

    const data = await res.json();
    
    // 保存到临时状态
    pendingScript = data.script || '';
    pendingTitle = data.title || '未命名播客';
    pendingSources = data.sources || [];
    pendingHostMode = data.host_mode || 'dual';

    hideSkeleton();
    showScriptEditor(data);

  } catch (e) {
    hideSkeleton();
    showError(e.message || '生成脚本失败，请重试');
  } finally {
    isGenerating = false;
    elements.generateBtn.disabled = false;
    elements.generateBtn.classList.remove('loading');
    elements.generateBtn.innerHTML = '<span>📝</span> 生成脚本';
  }
}

// 第二阶段：合成语音
async function synthesizeAudio() {
  if (isSynthesizing) return;
  
  // 获取编辑后的脚本
  const editedScript = elements.scriptEditor?.value || '';
  if (!editedScript.trim()) {
    showError('脚本内容不能为空');
    return;
  }

  isSynthesizing = true;
  hideError();
  elements.synthesizeBtn.disabled = true;
  elements.synthesizeBtn.classList.add('loading');
  elements.synthesizeBtn.innerHTML = '<span>⏳</span> 合成中...';

  try {
    const formData = new FormData();
    formData.append('script', editedScript);
    formData.append('host_mode', pendingHostMode);
    formData.append('intro_style', elements.introStyleSelect?.value || 'general');
    formData.append('tts_speed', elements.ttsSpeed?.value || '0');
    formData.append('voice_a', elements.voiceA?.value || '501006:千嶂');
    if (pendingHostMode === 'dual') {
      formData.append('voice_b', elements.voiceB?.value || '601007:爱小叶');
    }
    formData.append('title', pendingTitle);
    formData.append('sources', JSON.stringify(pendingSources));
    
    // 自定义片头参数
    const introStyle = elements.introStyleSelect?.value || 'general';
    if (introStyle === 'custom') {
      const customScript = elements.customIntroScript?.value || '';
      if (customScript.trim()) {
        formData.append('custom_intro_script', customScript);
      }
      // 自定义BGM文件
      const customBgmFile = elements.customIntroBgm?.files?.[0];
      if (customBgmFile) {
        formData.append('custom_intro_bgm', customBgmFile);
      }
    }

    const res = await fetch(`${API_BASE}/api/synthesize`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || '合成语音失败');
    }

    const data = await res.json();
    
    // 合成成功后刷新历史记录
    loadHistory();

    // 显示音频播放器
    showAudioPlayer(data);
    showToast('语音合成完成！', 'success');

  } catch (e) {
    showError(e.message || '合成语音失败，请重试');
  } finally {
    isSynthesizing = false;
    elements.synthesizeBtn.disabled = false;
    elements.synthesizeBtn.classList.remove('loading');
    elements.synthesizeBtn.innerHTML = '<span>🎵</span> 合成语音';
  }
}

// 显示脚本编辑器（第一阶段完成后）
function showScriptEditor(data) {
  elements.resultPlaceholder?.classList.add('hidden');
  elements.resultContent?.classList.add('visible');
  
  // 显示脚本编辑器，隐藏音频播放器
  if (elements.scriptEditor) {
    elements.scriptEditor.value = data.script || '';
    elements.scriptEditor.style.display = 'block';
  }
  if (elements.scriptContent) {
    elements.scriptContent.style.display = 'none';
  }
  if (elements.synthesizeSection) {
    elements.synthesizeSection.style.display = 'flex';
  }
  if (elements.scriptEditHint) {
    elements.scriptEditHint.style.display = 'inline';
  }
  if (elements.audioCard) {
    elements.audioCard.style.display = 'none';
  }

  // 渲染参考来源
  renderSources(data.sources || []);
}

// 显示音频播放器（第二阶段完成后）
function showAudioPlayer(data) {
  // 隐藏编辑提示和合成按钮
  if (elements.synthesizeSection) {
    elements.synthesizeSection.style.display = 'none';
  }
  if (elements.scriptEditHint) {
    elements.scriptEditHint.style.display = 'none';
  }
  
  // 将编辑器改为只读显示
  if (elements.scriptEditor) {
    elements.scriptEditor.style.display = 'none';
  }
  if (elements.scriptContent) {
    elements.scriptContent.textContent = elements.scriptEditor?.value || data.script || '';
    elements.scriptContent.style.display = 'block';
  }
  
  // 显示音频播放器
  if (elements.audioCard) {
    elements.audioCard.style.display = 'block';
  }

  // 加载音频
  let audioUrl = null;
  let filename = 'podcast.mp3';
  
  if (data.audio_url) {
    audioUrl = data.audio_url;
    filename = audioUrl.split('/').pop();
  } else if (data.audio_path) {
    filename = data.audio_path.split('/').pop().split('\\').pop();
    audioUrl = `${API_BASE}/api/audio/${filename}`;
  }
  
  if (audioUrl && wavesurfer) {
    wavesurfer.load(audioUrl);
    
    if (elements.downloadBtn) {
      elements.downloadBtn.dataset.url = audioUrl;
      elements.downloadBtn.dataset.filename = filename;
    }
  }
}

// 验证输入
function validateInput() {
  if (currentMode === 'Query') {
    if (!elements.inputMain?.value?.trim()) {
      return { valid: false, message: '请输入查询内容' };
    }
  } else if (currentMode === 'URL') {
    const url = elements.inputMain?.value?.trim();
    if (!url) {
      return { valid: false, message: '请输入 URL 地址' };
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { valid: false, message: '请输入有效的 URL 地址' };
    }
  } else if (currentMode === 'PDF文件') {
    if (selectedFiles.length === 0) {
      return { valid: false, message: '请上传至少一个 PDF 文件' };
    }
  }
  return { valid: true };
}

// 显示骨架屏
function showSkeleton() {
  elements.resultPlaceholder?.classList.add('hidden');
  elements.resultContent?.classList.remove('visible');
  elements.skeletonContainer?.classList.add('visible');
}

// 隐藏骨架屏
function hideSkeleton() {
  elements.skeletonContainer?.classList.remove('visible');
}

// 显示错误
function showError(message) {
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.add('visible');
  }
}

// 隐藏错误
function hideError() {
  elements.errorMessage?.classList.remove('visible');
}

// 显示结果（用于历史记录加载，显示完整的已合成播客）
function showResult(data) {
  elements.resultPlaceholder?.classList.add('hidden');
  elements.resultContent?.classList.add('visible');

  // 隐藏编辑器和合成按钮，显示只读脚本
  if (elements.scriptEditor) {
    elements.scriptEditor.style.display = 'none';
  }
  if (elements.synthesizeSection) {
    elements.synthesizeSection.style.display = 'none';
  }
  if (elements.scriptEditHint) {
    elements.scriptEditHint.style.display = 'none';
  }
  if (elements.scriptContent) {
    elements.scriptContent.textContent = data.script || '无脚本内容';
    elements.scriptContent.style.display = 'block';
  }

  // 显示音频播放器
  if (elements.audioCard) {
    elements.audioCard.style.display = 'block';
  }

  // 音频 - 优先使用 COS 永久链接
  let audioUrl = null;
  let filename = 'podcast.mp3';
  
  if (data.audio_url) {
    audioUrl = data.audio_url;
    filename = audioUrl.split('/').pop();
  } else if (data.audio_path) {
    filename = data.audio_path.split('/').pop().split('\\').pop();
    audioUrl = `${API_BASE}/api/audio/${filename}`;
  }
  
  if (audioUrl) {
    if (wavesurfer) {
      wavesurfer.load(audioUrl);
    }
    
    if (elements.downloadBtn) {
      elements.downloadBtn.dataset.url = audioUrl;
      elements.downloadBtn.dataset.filename = filename;
    }
  }

  // 参考来源
  renderSources(data.sources || []);
}

// 渲染参考来源
function renderSources(sources) {
  const primarySources = sources.filter(s => s.is_primary !== false);
  const supplementarySources = sources.filter(s => s.is_primary === false);
  
  if (elements.primarySources) {
    if (primarySources.length > 0) {
      elements.primarySources.innerHTML = primarySources.map(source => `
        <div class="source-item">
          <div class="source-title">${escapeHtml(source.title || '未知来源')}</div>
          ${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" class="source-link">查看原文 →</a>` : ''}
          <div class="source-snippet">${escapeHtml(source.snippet || '暂无摘要')}</div>
        </div>
      `).join('');
    } else {
      elements.primarySources.innerHTML = '<div class="source-item"><div class="source-snippet">暂无主要资料</div></div>';
    }
  }
  
  if (elements.supplementaryGroup) {
    elements.supplementaryGroup.style.display = supplementarySources.length > 0 ? 'block' : 'none';
  }
  
  if (elements.supplementarySources && supplementarySources.length > 0) {
    elements.supplementarySources.innerHTML = supplementarySources.map(source => `
      <div class="source-item supplementary">
        <div class="source-title">${escapeHtml(source.title || '未知来源')}</div>
        ${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" class="source-link">查看原文 →</a>` : ''}
        <div class="source-snippet">${escapeHtml(source.snippet || '暂无摘要')}</div>
      </div>
    `).join('');
  }
}

// HTML 转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 下载音频
function downloadAudio() {
  const url = elements.downloadBtn?.dataset.url;
  const filename = elements.downloadBtn?.dataset.filename || 'podcast.mp3';
  
  if (url) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

// 复制脚本
function copyScript() {
  // 优先从编辑器获取，否则从只读区域获取
  const text = elements.scriptEditor?.value || elements.scriptContent?.textContent;
  if (!text) return;
  
  navigator.clipboard.writeText(text).then(() => {
    if (elements.copyScriptBtn) {
      elements.copyScriptBtn.classList.add('copied');
      elements.copyScriptBtn.innerHTML = '<span>✓</span> 已复制';
      
      setTimeout(() => {
        elements.copyScriptBtn.classList.remove('copied');
        elements.copyScriptBtn.innerHTML = '<span>📋</span> 复制';
      }, 2000);
    }
    showToast('脚本已复制到剪贴板', 'success');
  }).catch(() => {
    showToast('复制失败，请手动复制', 'error');
  });
}

// Toast 提示
function showToast(message, type = 'info') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.className = `toast ${type}`;
  
  setTimeout(() => toast.classList.add('visible'), 10);
  setTimeout(() => toast.classList.remove('visible'), 3000);
}

// 历史记录功能 - 从 COS 云端加载
async function loadHistory() {
  if (!elements.historyList) return;
  
  // 显示加载状态
  elements.historyList.innerHTML = '<div class="history-loading">加载中...</div>';
  
  try {
    const res = await fetch(`${API_BASE}/api/history?limit=50`);
    const data = await res.json();
    
    historyCache = data.history || [];
    
    if (historyCache.length === 0) {
      elements.historyList.innerHTML = '<div class="history-empty">暂无历史记录</div>';
      return;
    }
    
    elements.historyList.innerHTML = historyCache.map((item, index) => `
      <div class="history-item" onclick="loadHistoryItem('${item.id}')">
        <div class="history-item-header">
          <div class="history-item-title">${escapeHtml(item.title || '未命名播客')}</div>
          <div class="history-item-date">${formatDate(item.created_at)}</div>
        </div>
        <div class="history-item-preview">${escapeHtml(item.script_preview || '')}</div>
      </div>
    `).join('');
  } catch (e) {
    console.error('加载历史记录失败:', e);
    elements.historyList.innerHTML = '<div class="history-empty">加载失败，请刷新重试</div>';
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  
  return date.toLocaleDateString();
}

// 加载单个播客详情
window.loadHistoryItem = async function(podcastId) {
  try {
    showToast('加载中...');
    
    const res = await fetch(`${API_BASE}/api/podcast/${podcastId}`);
    if (!res.ok) {
      throw new Error('播客不存在');
    }
    
    const item = await res.json();
    
    // 显示历史记录的结果
    elements.resultPlaceholder?.classList.add('hidden');
    elements.resultContent?.classList.add('visible');
    
    // 隐藏编辑器和合成按钮，显示只读脚本
    if (elements.scriptEditor) {
      elements.scriptEditor.style.display = 'none';
    }
    if (elements.synthesizeSection) {
      elements.synthesizeSection.style.display = 'none';
    }
    if (elements.scriptEditHint) {
      elements.scriptEditHint.style.display = 'none';
    }
    
    // 显示完整脚本
    if (elements.scriptContent) {
      elements.scriptContent.textContent = item.script || item.script_preview || '无脚本内容';
      elements.scriptContent.style.display = 'block';
    }
    
    // 显示音频播放器卡片
    if (elements.audioCard) {
      elements.audioCard.style.display = 'block';
    }
    
    // 加载音频
    if (item.audio_url && wavesurfer) {
      const audioUrl = item.audio_url;
      const filename = audioUrl.split('/').pop();
      
      wavesurfer.load(audioUrl);
      
      if (elements.downloadBtn) {
        elements.downloadBtn.dataset.url = audioUrl;
        elements.downloadBtn.dataset.filename = filename;
      }
    }
    
    // 渲染参考来源
    if (item.sources) {
      renderSources(item.sources);
    }
    
    showToast('已加载');
  } catch (e) {
    console.error('加载播客详情失败:', e);
    showToast('加载失败: ' + e.message, 'error');
  }
};

function clearHistory() {
  // 云端历史记录不支持清除（社区共享）
  showToast('社区历史记录不支持清除', 'info');
}

// ==================== PPT 生成功能 ====================

// 生成 PPT
async function generatePPT() {
  if (isGeneratingPPT) return;
  
  // 获取脚本内容
  const script = elements.scriptEditor?.value || pendingScript;
  if (!script.trim()) {
    showError('请先生成播客脚本');
    return;
  }

  isGeneratingPPT = true;
  hideError();
  
  if (elements.generatePPTBtn) {
    elements.generatePPTBtn.disabled = true;
    elements.generatePPTBtn.classList.add('loading');
    elements.generatePPTBtn.innerHTML = '<span>⏳</span> 生成中...';
  }

  try {
    const formData = new FormData();
    formData.append('script', script);
    formData.append('title', pendingTitle || '未命名演示文稿');
    formData.append('style', 'professional');

    const res = await fetch(`${API_BASE}/api/generate-slides`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || '生成 PPT 失败');
    }

    const data = await res.json();
    
    // 保存 Markdown 并显示编辑器
    currentSlidesMarkdown = data.markdown || '';
    showPPTEditor(data);
    showToast(`PPT 生成成功！共 ${data.slide_count || 0} 页`, 'success');

  } catch (e) {
    showError(e.message || '生成 PPT 失败，请重试');
  } finally {
    isGeneratingPPT = false;
    if (elements.generatePPTBtn) {
      elements.generatePPTBtn.disabled = false;
      elements.generatePPTBtn.classList.remove('loading');
      elements.generatePPTBtn.innerHTML = '<span>📊</span> 生成PPT';
    }
  }
}

// 显示 PPT 编辑器
function showPPTEditor(data) {
  if (elements.pptEditorSection) {
    elements.pptEditorSection.style.display = 'block';
  }
  if (elements.slidesMarkdown) {
    elements.slidesMarkdown.value = data.markdown || '';
  }
  showPPTStatus('');
}

// 预览幻灯片
async function previewSlides() {
  const markdown = elements.slidesMarkdown?.value || currentSlidesMarkdown;
  if (!markdown.trim()) {
    showError('没有可预览的内容');
    return;
  }

  showPPTStatus('正在生成预览...');

  try {
    const formData = new FormData();
    formData.append('markdown', markdown);

    const res = await fetch(`${API_BASE}/api/preview-slides`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || '预览生成失败');
    }

    const data = await res.json();
    
    // 解析 HTML 并显示预览
    showPreviewModal(data.html, data.slide_count || 1);
    showPPTStatus('');

  } catch (e) {
    showPPTStatus(`预览失败: ${e.message}`, 'error');
  }
}

// 显示预览模态框
function showPreviewModal(html, slideCount) {
  // 将 HTML 按幻灯片分割
  previewHtmlSlides = html.split('<div class="slide"').filter(s => s.trim());
  if (previewHtmlSlides.length > 0) {
    previewHtmlSlides = previewHtmlSlides.map((s, i) => 
      i === 0 ? s : '<div class="slide"' + s
    );
  }
  
  // 如果分割失败，将整个 HTML 作为一页
  if (previewHtmlSlides.length === 0) {
    previewHtmlSlides = [html];
  }
  
  currentSlideIndex = 0;
  updatePreviewSlide();
  
  if (elements.previewModal) {
    elements.previewModal.classList.add('visible');
  }
}

// 更新预览幻灯片
function updatePreviewSlide() {
  if (elements.previewContainer && previewHtmlSlides.length > 0) {
    elements.previewContainer.innerHTML = previewHtmlSlides[currentSlideIndex] || '';
  }
  if (elements.slideCounter) {
    elements.slideCounter.textContent = `${currentSlideIndex + 1} / ${previewHtmlSlides.length}`;
  }
  
  // 更新导航按钮状态
  if (elements.prevSlideBtn) {
    elements.prevSlideBtn.disabled = currentSlideIndex === 0;
  }
  if (elements.nextSlideBtn) {
    elements.nextSlideBtn.disabled = currentSlideIndex >= previewHtmlSlides.length - 1;
  }
}

// 上一页
function prevSlide() {
  if (currentSlideIndex > 0) {
    currentSlideIndex--;
    updatePreviewSlide();
  }
}

// 下一页
function nextSlide() {
  if (currentSlideIndex < previewHtmlSlides.length - 1) {
    currentSlideIndex++;
    updatePreviewSlide();
  }
}

// 关闭预览
function closePreview() {
  if (elements.previewModal) {
    elements.previewModal.classList.remove('visible');
  }
}

// 导出幻灯片
async function exportSlides(format) {
  if (isExportingSlides) return;
  
  const markdown = elements.slidesMarkdown?.value || currentSlidesMarkdown;
  if (!markdown.trim()) {
    showError('没有可导出的内容');
    return;
  }

  isExportingSlides = true;
  const btnId = format === 'pdf' ? 'exportPdfBtn' : 'exportPptxBtn';
  const btn = elements[btnId];
  const originalText = btn?.innerHTML;
  
  if (btn) {
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = '<span>⏳</span> 导出中...';
  }
  
  showPPTStatus(`正在导出 ${format.toUpperCase()}...`);

  try {
    const formData = new FormData();
    formData.append('markdown', markdown);
    formData.append('format', format);
    formData.append('title', pendingTitle || 'presentation');

    const res = await fetch(`${API_BASE}/api/export-slides`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const error = await res.json();
      // 检查是否有降级方案建议
      if (error.fallback_available) {
        showPPTStatus(`${format.toUpperCase()} 导出失败，建议下载 Markdown 文件`, 'warning');
        return;
      }
      throw new Error(error.detail || `导出 ${format.toUpperCase()} 失败`);
    }

    const data = await res.json();
    
    // 下载文件
    if (data.file_url) {
      downloadFile(data.file_url, `${pendingTitle || 'presentation'}.${format}`);
      showPPTStatus(`${format.toUpperCase()} 导出成功！`, 'success');
      showToast(`${format.toUpperCase()} 导出成功！`, 'success');
    } else if (data.file_path) {
      // 使用本地路径下载
      const filename = data.file_path.split('/').pop().split('\\').pop();
      downloadFile(`${API_BASE}/api/slides-file/${filename}`, filename);
      showPPTStatus(`${format.toUpperCase()} 导出成功！`, 'success');
      showToast(`${format.toUpperCase()} 导出成功！`, 'success');
    } else {
      throw new Error('未获取到文件下载链接');
    }

  } catch (e) {
    showPPTStatus(`导出失败: ${e.message}`, 'error');
    showToast(`导出失败: ${e.message}`, 'error');
  } finally {
    isExportingSlides = false;
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.innerHTML = originalText;
    }
  }
}

// 下载 Markdown 文件（降级方案）
function downloadMarkdown() {
  const markdown = elements.slidesMarkdown?.value || currentSlidesMarkdown;
  if (!markdown.trim()) {
    showError('没有可下载的内容');
    return;
  }

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const filename = `${pendingTitle || 'slides'}.md`;
  
  downloadFile(url, filename);
  URL.revokeObjectURL(url);
  
  showToast('Markdown 文件已下载', 'success');
  showPPTStatus('Markdown 文件已下载，可使用 Slidev CLI 本地导出', 'success');
}

// 通用文件下载
function downloadFile(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// 显示 PPT 状态消息
function showPPTStatus(message, type = 'info') {
  if (elements.pptStatusMessage) {
    elements.pptStatusMessage.textContent = message;
    elements.pptStatusMessage.className = 'ppt-status-message';
    if (message) {
      elements.pptStatusMessage.classList.add('visible', type);
    }
  }
}

// ==================== 对话创作模式 ====================

// 对话创作模式状态
let currentCreationMode = 'quick'; // 'quick' | 'interview'
let interviewSessionId = null;
let interviewMessages = [];
let interviewKeyPoints = [];
let interviewMaterials = [];
let currentMaterialType = null;
let pendingAttachments = []; // 待发送的素材附件（对话模式下）
let interviewHostMode = 'dual'; // 对话模式的播客形式：'dual' 双人访谈，'single' 单人分享

// 设置对话模式的播客形式
window.setInterviewHostMode = function(mode) {
  interviewHostMode = mode;
  console.log('对话模式播客形式:', mode === 'dual' ? '双人访谈' : '单人分享');
};

// 切换创作模式
window.setCreationMode = function(mode) {
  if (mode === currentCreationMode) return;
  
  currentCreationMode = mode;
  
  // 更新按钮状态
  const quickBtn = document.getElementById('quickModeBtn');
  const interviewBtn = document.getElementById('interviewModeBtn');
  const quickSection = document.getElementById('quickModeSection');
  const interviewSection = document.getElementById('interviewModeSection');
  
  if (mode === 'quick') {
    quickBtn?.classList.add('active');
    interviewBtn?.classList.remove('active');
    if (quickSection) quickSection.style.display = 'flex';
    if (interviewSection) {
      interviewSection.style.display = 'none';
      interviewSection.classList.remove('visible');
    }
  } else {
    quickBtn?.classList.remove('active');
    interviewBtn?.classList.add('active');
    if (quickSection) quickSection.style.display = 'none';
    if (interviewSection) {
      interviewSection.style.display = 'flex';
      interviewSection.classList.add('visible');
    }
    
    // 绑定对话模式事件
    bindInterviewEvents();
    
    // 如果还没有开始会话，自动开始
    if (!interviewSessionId) {
      startInterview();
    }
  }
};

// 开始采访会话
async function startInterview() {
  try {
    const res = await fetch(`${API_BASE}/api/interview/start`, {
      method: 'POST'
    });
    
    if (!res.ok) {
      throw new Error('无法开始对话');
    }
    
    const data = await res.json();
    interviewSessionId = data.session_id;
    interviewMessages = [];
    interviewKeyPoints = [];
    interviewMaterials = [];
    
    // 显示欢迎消息
    addChatMessage('assistant', data.welcome_message || '你好！我是你的播客创作助手。告诉我你想做一期关于什么主题的播客？');
    updateInterviewProgress();
    
  } catch (e) {
    console.error('开始对话失败:', e);
    addChatMessage('system', '连接失败，请刷新页面重试');
  }
}

// 发送消息
window.sendInterviewMessage = async function() {
  const input = document.getElementById('chatInput');
  const message = input?.value?.trim();
  
  if (!message && pendingAttachments.length === 0) return;
  if (!interviewSessionId) {
    await startInterview();
  }
  
  // 清空输入框
  input.value = '';
  
  // 获取当前附加的素材ID
  const attachedMaterialIds = pendingAttachments.map(a => a.id);
  
  // 构建显示消息（包含素材标签）
  let displayMessage = message || '';
  if (pendingAttachments.length > 0) {
    const attachmentLabels = pendingAttachments.map(a => `[📎 ${getMaterialTypeName(a.type)}: ${a.title}]`).join(' ');
    displayMessage = attachmentLabels + (message ? '\n' + message : '');
  }
  
  // 清空待发送素材
  const sentAttachments = [...pendingAttachments];
  pendingAttachments = [];
  updateAttachmentsUI();
  
  // 显示用户消息
  addChatMessage('user', displayMessage);
  
  // 显示加载状态
  const loadingId = addChatMessage('assistant', '', true);
  
  try {
    const formData = new FormData();
    formData.append('session_id', interviewSessionId);
    formData.append('message', message || '请帮我分析这些素材');
    
    // 附加素材ID
    if (attachedMaterialIds.length > 0) {
      formData.append('attached_material_ids', JSON.stringify(attachedMaterialIds));
    }
    
    const res = await fetch(`${API_BASE}/api/interview/chat`, {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) {
      throw new Error('发送消息失败');
    }
    
    const data = await res.json();
    
    // 移除加载状态，显示回复
    removeChatMessage(loadingId);
    addChatMessage('assistant', data.reply);
    
    // 更新观点列表
    if (data.key_points) {
      interviewKeyPoints = data.key_points;
      updateKeyPointsUI();
    }
    
    // 更新进度
    updateInterviewProgress(data.message_count);
    
    // 检测到的素材
    if (data.detected_materials && data.detected_materials.length > 0) {
      data.detected_materials.forEach(m => {
        addChatMessage('system', `检测到素材: ${m.type} - ${m.content}`);
      });
    }
    
  } catch (e) {
    removeChatMessage(loadingId);
    addChatMessage('system', '发送失败，请重试');
    console.error('发送消息失败:', e);
  }
};

// 添加聊天消息
function addChatMessage(role, content, isLoading = false) {
  const messagesContainer = document.getElementById('chatMessages');
  if (!messagesContainer) return null;
  
  const messageId = `msg-${Date.now()}`;
  const messageDiv = document.createElement('div');
  messageDiv.id = messageId;
  messageDiv.className = `chat-message ${role}${isLoading ? ' loading' : ''}`;
  
  if (isLoading) {
    messageDiv.innerHTML = `
      <div class="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
  } else {
    messageDiv.innerHTML = `
      <div class="message-content">${escapeHtml(content)}</div>
      <div class="message-time">${formatMessageTime(new Date())}</div>
    `;
    
    // 记录消息
    if (role !== 'system') {
      interviewMessages.push({ role, content, timestamp: new Date() });
    }
  }
  
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  return messageId;
}

// 移除聊天消息
function removeChatMessage(messageId) {
  const message = document.getElementById(messageId);
  if (message) {
    message.remove();
  }
}

// 格式化消息时间
function formatMessageTime(date) {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// 更新对话进度
function updateInterviewProgress(messageCount) {
  const count = messageCount || Math.floor(interviewMessages.length / 2);
  const countEl = document.getElementById('interviewMessageCount');
  const fillEl = document.getElementById('interviewProgressFill');
  const hintEl = document.getElementById('interviewProgressHint');
  
  if (countEl) countEl.textContent = count;
  
  // 进度条：3轮对话为基准
  const progress = Math.min(count / 3 * 100, 100);
  if (fillEl) fillEl.style.width = `${progress}%`;
  
  // 提示文字
  if (hintEl) {
    if (count === 0) {
      hintEl.textContent = '开始对话，让 AI 了解你的想法';
    } else if (count < 3) {
      hintEl.textContent = `再聊 ${3 - count} 轮，内容会更丰富`;
    } else {
      hintEl.textContent = '对话充分，可以生成播客了！';
    }
  }
}

// 更新观点列表 UI
function updateKeyPointsUI() {
  const list = document.getElementById('keyPointsList');
  if (!list) return;
  
  if (interviewKeyPoints.length === 0) {
    list.innerHTML = '<li class="empty-hint">对话中提取的观点将显示在这里</li>';
  } else {
    list.innerHTML = interviewKeyPoints.map(point => 
      `<li>${escapeHtml(point)}</li>`
    ).join('');
  }
}

// 更新素材列表 UI（素材库）
function updateMaterialsUI() {
  const list = document.getElementById('materialsList');
  if (!list) return;
  
  if (interviewMaterials.length === 0) {
    list.innerHTML = '<li class="empty-hint">添加的素材将显示在这里</li>';
  } else {
    list.innerHTML = interviewMaterials.map(m => {
      const isAttached = pendingAttachments.some(a => a.id === m.id);
      return `
      <li class="material-item ${isAttached ? 'attached' : ''}" onclick="attachMaterial('${m.id}')">
        <span class="material-icon">${getMaterialIcon(m.type)}</span>
        <div class="material-info">
          <div class="material-title">${escapeHtml(m.title || m.content)}</div>
          <div class="material-type">${getMaterialTypeName(m.type)}</div>
        </div>
        <span class="material-attach-hint">${isAttached ? '✓ 已添加' : '点击引用'}</span>
      </li>
    `}).join('');
  }
}

// 获取素材类型名称
function getMaterialTypeName(type) {
  switch (type) {
    case 'url': return '网页链接';
    case 'document': return '文档';
    case 'topic': return '话题搜索';
    default: return '素材';
  }
}

// 显示素材添加对话框
window.showMaterialDialog = function(type) {
  currentMaterialType = type;
  const dialog = document.getElementById('materialDialog');
  const title = document.getElementById('materialDialogTitle');
  const input = document.getElementById('materialInput');
  const fileInput = document.getElementById('materialFileInput');
  
  if (!dialog) return;
  
  // 设置标题和占位符
  switch (type) {
    case 'url':
      title.textContent = '添加网页链接';
      input.placeholder = '输入网页 URL，如 https://example.com/article';
      input.style.display = 'block';
      fileInput.style.display = 'none';
      break;
    case 'document':
      title.textContent = '上传文档';
      input.style.display = 'none';
      fileInput.style.display = 'block';
      fileInput.click();
      return; // 文件选择后自动处理
    case 'topic':
      title.textContent = '搜索话题';
      input.placeholder = '输入想要搜索的话题关键词';
      input.style.display = 'block';
      fileInput.style.display = 'none';
      break;
  }
  
  input.value = '';
  dialog.style.display = 'flex';
};

// 关闭素材对话框
window.closeMaterialDialog = function() {
  const dialog = document.getElementById('materialDialog');
  if (dialog) dialog.style.display = 'none';
  currentMaterialType = null;
};

// 提交素材
window.submitMaterial = async function() {
  const input = document.getElementById('materialInput');
  const content = input?.value?.trim();
  
  if (!content || !currentMaterialType) {
    showToast('请输入内容', 'error');
    return;
  }
  
  if (!interviewSessionId) {
    // 如果还没有会话，先开始对话
    await startInterview();
  }
  
  // 保存 material_type，因为 closeMaterialDialog 会将其设置为 null
  const materialType = currentMaterialType;
  
  console.log('提交素材:', { session_id: interviewSessionId, material_type: materialType, content: content.substring(0, 100) });
  
  closeMaterialDialog();
  
  // 显示预解析状态
  const statusMsg = addChatMessage('system', `正在预处理${getMaterialTypeName(materialType)}...`);
  
  try {
    const formData = new FormData();
    formData.append('session_id', interviewSessionId);
    formData.append('material_type', materialType);
    formData.append('content', content);
    
    const res = await fetch(`${API_BASE}/api/interview/material`, {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('服务器返回错误:', res.status, errorData);
      throw new Error(errorData.detail || `添加素材失败 (${res.status})`);
    }
    
    const data = await res.json();
    
    // 移除预处理状态消息
    removeChatMessage(statusMsg);
    
    // 生成素材标题
    const materialTitle = getMaterialTitle(materialType, content, data.summary);
    
    // 添加到素材列表（素材库）
    const newMaterial = {
      id: data.material_id,
      type: materialType,
      content: content,
      title: materialTitle,
      summary: data.summary
    };
    interviewMaterials.push(newMaterial);
    updateMaterialsUI();
    
    // 添加到待发送附件列表
    pendingAttachments.push(newMaterial);
    updateAttachmentsUI();
    
    showToast('素材已添加，可以在消息中引用', 'success');
    
  } catch (e) {
    console.error('添加素材失败:', e);
    removeChatMessage(statusMsg);
    addChatMessage('system', `添加素材失败: ${e.message || '请重试'}`);
  }
};

// 获取素材标题
function getMaterialTitle(type, content, summary) {
  if (type === 'url') {
    try {
      const url = new URL(content);
      return url.hostname + url.pathname.substring(0, 20);
    } catch {
      return content.substring(0, 30);
    }
  } else if (type === 'topic') {
    return content.substring(0, 30);
  } else {
    return summary?.substring(0, 30) || content.substring(0, 30);
  }
}

// 更新待发送附件UI
function updateAttachmentsUI() {
  let container = document.getElementById('pendingAttachments');
  
  // 如果容器不存在，创建它
  if (!container) {
    const chatInputArea = document.querySelector('.chat-input-area');
    if (chatInputArea) {
      container = document.createElement('div');
      container.id = 'pendingAttachments';
      container.className = 'pending-attachments';
      chatInputArea.insertBefore(container, chatInputArea.firstChild);
    }
  }
  
  if (!container) return;
  
  if (pendingAttachments.length === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  
  container.style.display = 'flex';
  container.innerHTML = pendingAttachments.map((a, idx) => `
    <div class="attachment-chip" data-id="${a.id}">
      <span class="attachment-icon">${getMaterialIcon(a.type)}</span>
      <span class="attachment-title">${escapeHtml(a.title)}</span>
      <span class="attachment-remove" onclick="removeAttachment(${idx})">×</span>
    </div>
  `).join('');
}

// 获取素材图标
function getMaterialIcon(type) {
  return { url: '🔗', document: '📄', topic: '🔍' }[type] || '📎';
}

// 移除待发送附件
window.removeAttachment = function(index) {
  pendingAttachments.splice(index, 1);
  updateAttachmentsUI();
};

// 从素材库添加到待发送
window.attachMaterial = function(materialId) {
  const material = interviewMaterials.find(m => m.id === materialId);
  if (!material) return;
  
  // 检查是否已添加
  if (pendingAttachments.some(a => a.id === materialId)) {
    showToast('该素材已添加', 'info');
    return;
  }
  
  pendingAttachments.push(material);
  updateAttachmentsUI();
  showToast('素材已添加到消息', 'success');
};

// 从对话生成播客脚本
// 使用 interviewHostMode 变量决定播客形式
window.generateFromInterview = async function() {
  if (!interviewSessionId) {
    showToast('请先开始对话', 'error');
    return;
  }
  
  const messageCount = Math.floor(interviewMessages.length / 2);
  if (messageCount < 1) {
    showToast('请先与 AI 进行一些对话', 'error');
    return;
  }
  
  const btn = document.getElementById('generateFromInterviewBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> 生成中...';
  }
  
  // 使用当前选择的播客形式
  const hostMode = interviewHostMode;
  console.log('生成播客，形式:', hostMode === 'dual' ? '双人访谈' : '单人分享');
  
  try {
    const formData = new FormData();
    formData.append('session_id', interviewSessionId);
    formData.append('host_mode', hostMode);  // 传递播客形式
    
    const res = await fetch(`${API_BASE}/api/interview/generate`, {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) {
      throw new Error('生成脚本失败');
    }
    
    const data = await res.json();
    
    // 显示警告（如果对话太短）
    if (data.warning) {
      showToast(data.warning, 'warning');
    }
    
    // 保存到临时状态，使用 API 返回的 host_mode
    pendingScript = data.script || '';
    pendingTitle = '对话创作播客';
    pendingSources = data.sources || [];
    pendingHostMode = data.host_mode || hostMode;  // 使用 API 返回的模式
    
    // 显示脚本编辑器
    hideSkeleton();
    showScriptEditor({
      script: data.script,
      sources: data.sources
    });
    
    // 显示风格分析
    if (data.style_analysis) {
      console.log('用户风格分析:', data.style_analysis);
    }
    
    showToast('脚本生成成功！', 'success');
    
  } catch (e) {
    console.error('生成脚本失败:', e);
    showToast('生成失败，请重试', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>🎙️</span> 生成播客脚本';
    }
  }
};

// 处理文档上传（对话模式）
async function handleMaterialFileUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  
  if (!interviewSessionId) {
    showToast('请先开始对话', 'error');
    return;
  }
  
  addChatMessage('system', `正在处理文档: ${file.name}...`);
  
  try {
    const formData = new FormData();
    formData.append('session_id', interviewSessionId);
    formData.append('material_type', 'document');
    formData.append('file', file);
    
    const res = await fetch(`${API_BASE}/api/interview/material`, {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) {
      throw new Error('上传文档失败');
    }
    
    const data = await res.json();
    
    // 添加到素材列表
    interviewMaterials.push({
      id: data.material_id,
      type: 'document',
      content: file.name,
      title: file.name,
      summary: data.summary
    });
    
    updateMaterialsUI();
    
    // 显示 AI 对素材的思考
    if (data.ai_thoughts) {
      addChatMessage('assistant', data.ai_thoughts);
    }
    
    showToast('文档上传成功', 'success');
    
  } catch (e) {
    console.error('上传文档失败:', e);
    addChatMessage('system', '上传文档失败，请重试');
  }
  
  // 清空文件输入
  e.target.value = '';
}

// 监听回车发送消息
function handleChatInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendInterviewMessage();
  }
}

// 绑定对话创作模式事件
function bindInterviewEvents() {
  const materialFileInput = document.getElementById('materialFileInput');
  const chatInput = document.getElementById('chatInput');
  
  if (materialFileInput) {
    materialFileInput.removeEventListener('change', handleMaterialFileUpload);
    materialFileInput.addEventListener('change', handleMaterialFileUpload);
  }
  
  if (chatInput) {
    chatInput.removeEventListener('keydown', handleChatInputKeydown);
    chatInput.addEventListener('keydown', handleChatInputKeydown);
  }
}

// 初始化时尝试绑定，如果元素不存在则延迟绑定
setTimeout(bindInterviewEvents, 100);

// ==================== 初始化 ====================

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
