<template>
  <div id="podcast-app">
    <!-- 头部 -->
    <header class="app-header">
      <div class="header-left">
        <div class="logo">
          <span class="logo-icon">🎙️</span>
          <span>KPodcast</span>
        </div>
        <span class="tagline">把你的创意转为播客</span>
      </div>
      <div class="header-right">
        <button class="icon-btn" title="帮助">❓</button>
      </div>
    </header>

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 左侧面板 - 输入区域 -->
      <div class="left-panel">
        <!-- 模式标签 -->
        <div class="mode-badge">
          <span>🎙️</span>
          <span>AI 播客</span>
        </div>

        <!-- 错误提示 -->
        <div id="errorMessage" class="error-message"></div>

        <!-- 输入区域 -->
        <div id="inputSection" class="input-section">
          <div class="input-header">
            <div id="inputPlaceholder" class="input-placeholder">
              输入关键词或主题，AI 将搜索相关内容生成播客
            </div>
            <div id="charCount" class="char-count">0 字</div>
          </div>
          <textarea 
            id="inputMain" 
            class="input-main" 
            placeholder="例如：人工智能最新发展趋势、量子计算入门..."
            rows="3"
          ></textarea>
          <div class="input-actions">
            <button id="btnModeText" class="input-action-btn active">
              <span>📝</span> 文字/主题
            </button>
            <button id="btnModeUrl" class="input-action-btn">
              <span>🔗</span> 网页链接
            </button>
            <button id="btnModeFile" class="input-action-btn">
              <span>📁</span> PDF文件
            </button>
          </div>
          <input type="file" id="fileInput" accept=".pdf" multiple style="display: none;" />
        </div>

        <!-- 文件列表 -->
        <div id="fileSection" class="file-section">
          <div class="section-title">
            <span>📁</span> 已上传文件 
            <span class="section-title-hint">（拖拽调整顺序）</span>
          </div>
          <div id="fileList" class="file-list"></div>
        </div>

        <!-- 额外指令 -->
        <div class="instruction-section">
          <div class="section-title">
            <span>💡</span> 额外指令（可选）
          </div>
          <textarea 
            id="instructionInput" 
            placeholder="添加特殊要求，如：生成一分钟短播客、重点讨论技术细节、使用轻松幽默的风格..."
          ></textarea>
        </div>

        <!-- 设置区域 -->
        <div class="settings-section">
          <div class="section-title">
            <span>⚙️</span> 播客设置
          </div>
          <div class="settings-grid">
            <div class="setting-item">
              <label class="setting-label">播客风格</label>
              <select id="styleSelect" class="setting-select">
                <option value="news">新闻播报</option>
                <option value="chat">轻松对话</option>
                <option value="interview">访谈风格</option>
                <option value="story">故事叙述</option>
              </select>
            </div>
            <div class="setting-item">
              <label class="setting-label">开场风格</label>
              <select id="introStyleSelect" class="setting-select">
                <option value="tongyong">通用</option>
                <option value="chengzhang">成长</option>
                <option value="kejigan">科技</option>
                <option value="shangye">商业</option>
                <option value="yingshi">影视</option>
                <option value="zhichang">职场</option>
              </select>
            </div>
            <div class="setting-item">
              <label class="setting-label">主持人 A</label>
              <select id="voiceA" class="setting-select">
                <option value="501006:千嶂">501006:千嶂</option>
              </select>
            </div>
            <div class="setting-item">
              <label class="setting-label">主持人 B</label>
              <select id="voiceB" class="setting-select">
                <option value="601007:爱小叶">601007:爱小叶</option>
              </select>
            </div>
            <div class="setting-item">
              <label class="setting-label">语速</label>
              <select id="ttsSpeed" class="setting-select">
                <option value="-2">很慢</option>
                <option value="-1">较慢</option>
                <option value="0" selected>正常</option>
                <option value="1">较快</option>
                <option value="2">很快</option>
              </select>
            </div>
            <div class="setting-item">
              <label class="setting-checkbox">
                <input type="checkbox" id="autoDetect" />
                <span>自动检测内容风格</span>
              </label>
            </div>
          </div>
        </div>

        <!-- 进度条 -->
        <div id="progressSection" class="progress-section">
          <div class="progress-bar">
            <div id="progressFill" class="progress-fill" style="width: 0%"></div>
          </div>
          <div id="progressText" class="progress-text">准备中...</div>
        </div>

        <!-- 生成按钮 -->
        <button id="generateBtn" class="generate-btn">
          <span>🎬</span> 生成播客
        </button>

        <!-- 历史记录 -->
        <div class="history-section">
          <div class="history-header">
            <div class="history-title">
              <span>📚</span> 历史记录
            </div>
            <span id="clearHistoryBtn" class="history-clear">清除全部</span>
          </div>
          <div id="historyList" class="history-list">
            <div class="history-empty">暂无历史记录</div>
          </div>
        </div>
      </div>

      <!-- 右侧面板 - 结果区域 -->
      <div class="right-panel">
        <!-- 占位状态 -->
        <div id="resultPlaceholder" class="result-placeholder">
          <div class="result-placeholder-icon">🎙️</div>
          <div class="result-placeholder-text">输入内容后点击生成</div>
          <div class="result-placeholder-hint">开始创作你的 AI 播客</div>
        </div>

        <!-- 骨架屏 -->
        <div id="skeletonContainer" class="skeleton-container">
          <div class="skeleton-card">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-audio"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text short"></div>
          </div>
          <div class="skeleton-card">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text medium"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text short"></div>
          </div>
          <div class="skeleton-card">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text medium"></div>
          </div>
        </div>

        <!-- 结果内容 -->
        <div id="resultContent" class="result-content">
          <!-- 音频播放器 -->
          <div class="result-card">
            <div class="result-card-header">
              <div class="result-card-title">
                <span>🎧</span> 生成结果
              </div>
            </div>
            <div class="audio-player-wrapper">
              <!-- 波形容器 -->
              <div class="waveform-container">
                <div id="waveform"></div>
              </div>
              <!-- 时间显示 -->
              <div class="audio-time">
                <span id="currentTime">0:00</span>
                <span id="totalTime">0:00</span>
              </div>
              <!-- 播放控制 -->
              <div class="audio-controls">
                <button id="playBtn" class="play-btn">▶</button>
              </div>
              <!-- 隐藏的原生播放器（备用） -->
              <audio id="audioPlayer" class="audio-player"></audio>
              <!-- 操作按钮 -->
              <div class="audio-actions">
                <button id="downloadBtn" class="audio-action-btn">
                  <span>⬇️</span> 下载音频
                </button>
              </div>
            </div>
          </div>

          <!-- 播客脚本 -->
          <div class="result-card">
            <div class="result-card-header">
              <div class="result-card-title">
                <span>📜</span> 播客脚本
              </div>
              <div class="result-card-actions">
                <button id="copyScriptBtn" class="copy-btn">
                  <span>📋</span> 复制
                </button>
              </div>
            </div>
            <div id="scriptContent" class="script-content"></div>
          </div>

          <!-- 参考来源 -->
          <div class="result-card">
            <div class="result-card-header">
              <div class="result-card-title">
                <span>📚</span> 参考来源
              </div>
            </div>
            <div class="sources-section">
              <!-- 主要资料 -->
              <div>
                <div class="sources-group-title">
                  <span>📌</span> 主要资料 <span class="badge">核心内容</span>
                </div>
                <div id="primarySources"></div>
              </div>
              
              <!-- 补充资料 -->
              <div id="supplementaryGroup">
                <div class="sources-group-title supplementary">
                  <span>📎</span> 补充资料 <span class="badge">扩展阅读</span>
                </div>
                <div id="supplementarySources"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { onMounted, onUnmounted } from 'vue'

export default {
  name: 'PodcastGenerator',
  setup() {
    let appScript = null

    onMounted(() => {
      loadPodcastApp()
    })

    onUnmounted(() => {
      if (appScript) {
        document.body.removeChild(appScript)
      }
    })

    function loadPodcastApp() {
      // 设置 API 基础地址
      window.PODCAST_API_BASE = import.meta.env.VITE_PODCAST_API_BASE || 'http://localhost:8001'

      // 动态加载 app.js
      appScript = document.createElement('script')
      appScript.src = '/podcast-assets/app.js'
      appScript.type = 'module'
      document.body.appendChild(appScript)
    }

    return {}
  }
}
</script>

<style>
@import '/podcast-assets/styles.css';
</style>
<style scoped>
#podcast-app {
  isolation: isolate;
}
</style>
