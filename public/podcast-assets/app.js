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
let wavesurfer = null;
let isPlaying = false;

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
  elements.styleSelect = document.getElementById('styleSelect');
  elements.introStyleSelect = document.getElementById('introStyleSelect');
  elements.voiceA = document.getElementById('voiceA');
  elements.voiceB = document.getElementById('voiceB');
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
  elements.copyScriptBtn = document.getElementById('copyScriptBtn');
  elements.primarySources = document.getElementById('primarySources');
  elements.supplementarySources = document.getElementById('supplementarySources');
  elements.supplementaryGroup = document.getElementById('supplementaryGroup');
  elements.historyList = document.getElementById('historyList');
  elements.clearHistoryBtn = document.getElementById('clearHistoryBtn');
}

// 绑定事件
function bindEvents() {
  // 模式切换按钮
  elements.btnModeText?.addEventListener('click', () => setMode('text'));
  elements.btnModeUrl?.addEventListener('click', () => setMode('url'));
  elements.btnModeFile?.addEventListener('click', () => setMode('file'));
  
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
  
  // 生成按钮
  elements.generateBtn?.addEventListener('click', generatePodcast);
  
  // 播放按钮
  elements.playBtn?.addEventListener('click', togglePlay);
  
  // 下载按钮
  elements.downloadBtn?.addEventListener('click', downloadAudio);
  
  // 复制脚本按钮
  elements.copyScriptBtn?.addEventListener('click', copyScript);
  
  // 清除历史
  elements.clearHistoryBtn?.addEventListener('click', clearHistory);
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
        `<option value="${v.value}">${v.label}</option>`
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

// 生成播客
async function generatePodcast() {
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
  elements.generateBtn.innerHTML = '<span>⏳</span> 生成中...';

  try {
    const formData = new FormData();
    formData.append('mode', currentMode);
    
    let inputContent = '';
    if (currentMode === 'Query') {
      inputContent = elements.inputMain?.value || '';
      formData.append('query', inputContent);
    } else if (currentMode === 'URL') {
      inputContent = elements.inputMain?.value || '';
      formData.append('url', inputContent);
    } else if (currentMode === 'PDF文件') {
      inputContent = selectedFiles.map(f => f.name).join(', ');
      selectedFiles.forEach(file => {
        formData.append('pdf_files', file);
      });
    }

    formData.append('instruction', elements.instructionInput?.value || '');
    formData.append('style', elements.styleSelect?.value || 'news');
    formData.append('intro_style', elements.introStyleSelect?.value || 'tongyong');
    formData.append('auto_detect', elements.autoDetect?.checked || false);
    formData.append('voice_a', elements.voiceA?.value || '501006:千嶂');
    formData.append('voice_b', elements.voiceB?.value || '601007:爱小叶');
    formData.append('tts_speed', elements.ttsSpeed?.value || '0');

    const res = await fetch(`${API_BASE}/api/generate`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || '生成失败');
    }

    const data = await res.json();
    
    // 生成成功后刷新历史记录（从 COS 加载）
    loadHistory();

    hideSkeleton();
    showResult(data);

  } catch (e) {
    hideSkeleton();
    showError(e.message || '生成失败，请重试');
  } finally {
    isGenerating = false;
    elements.generateBtn.disabled = false;
    elements.generateBtn.classList.remove('loading');
    elements.generateBtn.innerHTML = '<span>🎬</span> 生成播客';
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

// 显示结果
function showResult(data) {
  elements.resultPlaceholder?.classList.add('hidden');
  elements.resultContent?.classList.add('visible');

  // 音频 - 优先使用 COS 永久链接
  let audioUrl = null;
  let filename = 'podcast.mp3';
  
  if (data.audio_url) {
    // 使用 COS 云存储链接
    audioUrl = data.audio_url;
    filename = audioUrl.split('/').pop();
  } else if (data.audio_path) {
    // 回退到本地 API 路径
    filename = data.audio_path.split('/').pop().split('\\').pop();
    audioUrl = `${API_BASE}/api/audio/${filename}`;
  }
  
  if (audioUrl) {
    // 加载波形
    if (wavesurfer) {
      wavesurfer.load(audioUrl);
    }
    
    if (elements.downloadBtn) {
      elements.downloadBtn.dataset.url = audioUrl;
      elements.downloadBtn.dataset.filename = filename;
    }
  }

  // 脚本
  if (elements.scriptContent) {
    elements.scriptContent.textContent = data.script || '无脚本内容';
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
  const text = elements.scriptContent?.textContent;
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
    
    // 显示完整脚本
    if (elements.scriptContent) {
      elements.scriptContent.textContent = item.script || item.script_preview || '无脚本内容';
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

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
