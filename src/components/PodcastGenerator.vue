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
        <!-- 创作模式选择器 -->
        <div class="creation-mode-selector">
          <button id="quickModeBtn" class="creation-mode-btn active" onclick="setCreationMode('quick')">
            <span>⚡</span> 快速模式
          </button>
          <button id="interviewModeBtn" class="creation-mode-btn" onclick="setCreationMode('interview')">
            <span>💬</span> 对话创作
          </button>
        </div>

        <!-- 快速模式内容 -->
        <div id="quickModeSection" class="mode-section">
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
              <label class="setting-label">主持人模式</label>
              <select id="hostModeSelect" class="setting-select">
                <option value="dual">双人播客</option>
                <option value="single">单人播客</option>
              </select>
            </div>
            <div class="setting-item">
              <label class="setting-label">播客风格</label>
              <select id="styleSelect" class="setting-select">
                <option value="chat">轻松闲聊</option>
                <option value="professional">专业深度</option>
                <option value="story">故事叙述</option>
                <option value="debate">观点碰撞</option>
                <option value="educational">科普教学</option>
                <option value="custom">自定义风格</option>
              </select>
            </div>
            <div class="setting-item-full" id="customStyleContainer" style="display: none;">
              <label class="setting-label">自定义风格描述</label>
              <textarea 
                id="customStyleInput" 
                class="setting-textarea"
                placeholder="描述你想要的播客风格，例如：像老朋友聊天一样轻松、带点幽默感、偶尔吐槽..."
                rows="2"
              ></textarea>
            </div>
            <div class="setting-item">
              <label class="setting-label">开场风格</label>
              <select id="introStyleSelect" class="setting-select">
                <option value="general">通用</option>
                <option value="tech">科技</option>
                <option value="business">商业/财经</option>
                <option value="life">生活/日常</option>
                <option value="culture">文化/历史</option>
                <option value="entertainment">娱乐/轻松</option>
                <option value="education">教育/学习</option>
                <option value="health">健康/养生</option>
                <option value="emotion">情感/心理</option>
                <option value="growth">个人成长</option>
                <option value="custom">自定义</option>
              </select>
            </div>
            <!-- 自定义片头文案（选择自定义时显示） -->
            <div class="setting-item-full" id="customIntroContainer" style="display: none;">
              <label class="setting-label">自定义片头文案</label>
              <textarea 
                id="customIntroScript" 
                class="setting-textarea"
                placeholder="每行一句，双人模式下奇数行为A、偶数行为B&#10;例如：&#10;欢迎收听本期节目&#10;今天我们来聊一个有趣的话题"
                rows="4"
                maxlength="200"
              ></textarea>
              <div class="setting-hint">建议不超过200字</div>
            </div>
            <!-- 自定义片头BGM上传（选择自定义时显示） -->
            <div class="setting-item-full" id="customIntroBgmContainer" style="display: none;">
              <label class="setting-label">自定义片头背景音乐（可选）</label>
              <input type="file" id="customIntroBgm" accept=".mp3,.wav,.m4a" />
              <div class="setting-hint">不上传则自动匹配合适的背景音乐</div>
            </div>
            <div class="setting-item" id="voiceAContainer">
              <label class="setting-label" id="voiceALabel">主持人</label>
              <div class="voice-select-wrapper">
                <select id="voiceA" class="setting-select">
                  <option value="501006:千嶂">501006:千嶂</option>
                </select>
                <button type="button" class="voice-preview-btn" onclick="previewVoice('A')" title="试听">🔊</button>
              </div>
            </div>
            <div class="setting-item" id="voiceBContainer">
              <label class="setting-label">主持人 B</label>
              <div class="voice-select-wrapper">
                <select id="voiceB" class="setting-select">
                  <option value="601007:爱小叶">601007:爱小叶</option>
                </select>
                <button type="button" class="voice-preview-btn" onclick="previewVoice('B')" title="试听">🔊</button>
              </div>
            </div>
            <!-- 隐藏的音频播放器用于试听 -->
            <audio id="voicePreviewAudio" style="display: none;"></audio>
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
          <span>📝</span> 生成脚本
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
        <!-- 快速模式内容结束 -->

        <!-- 对话创作模式内容 -->
        <div id="interviewModeSection" class="mode-section" style="display: none;">
          <!-- 对话区域 -->
          <div class="interview-chat-container">
            <div class="chat-messages" id="chatMessages">
              <!-- 欢迎消息将由 JS 动态添加 -->
            </div>
            <div class="chat-input-area">
              <div class="chat-input-wrapper">
                <textarea 
                  id="chatInput" 
                  class="chat-input" 
                  placeholder="输入消息，与 AI 讨论你的播客想法..."
                  rows="2"
                ></textarea>
                <div class="chat-input-actions">
                  <div class="material-buttons">
                    <button class="material-btn" onclick="showMaterialDialog('url')" title="添加网页链接">
                      <span>🔗</span>
                    </button>
                    <button class="material-btn" onclick="showMaterialDialog('document')" title="上传文档">
                      <span>📄</span>
                    </button>
                    <button class="material-btn" onclick="showMaterialDialog('topic')" title="搜索话题">
                      <span>🔍</span>
                    </button>
                  </div>
                  <button id="sendMessageBtn" class="send-message-btn" onclick="sendInterviewMessage()">
                    <span>发送</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 侧边信息栏 -->
          <div class="interview-sidebar">
            <!-- 对话进度 -->
            <div class="interview-progress-panel">
              <div class="panel-title">
                <span>📊</span> 对话进度
              </div>
              <div class="progress-indicator">
                <div class="progress-depth">
                  <span class="depth-label">对话深度</span>
                  <span id="interviewMessageCount" class="depth-value">0</span>
                  <span class="depth-unit">轮</span>
                </div>
                <div class="progress-bar-mini">
                  <div id="interviewProgressFill" class="progress-fill-mini" style="width: 0%"></div>
                </div>
                <div id="interviewProgressHint" class="progress-hint">开始对话，让 AI 了解你的想法</div>
              </div>
            </div>

            <!-- 已收集的观点 -->
            <div class="key-points-panel">
              <div class="panel-title">
                <span>💡</span> 已收集的观点
              </div>
              <ul id="keyPointsList" class="key-points-list">
                <li class="empty-hint">对话中提取的观点将显示在这里</li>
              </ul>
            </div>

            <!-- 参考素材 -->
            <div class="materials-panel">
              <div class="panel-title">
                <span>📚</span> 参考素材
              </div>
              <ul id="materialsList" class="materials-list">
                <li class="empty-hint">添加的素材将显示在这里</li>
              </ul>
            </div>

            <!-- 播客模式选择 -->
            <div class="interview-host-mode">
              <div class="panel-title">
                <span>🎤</span> 播客形式
              </div>
              <div class="host-mode-options">
                <label class="host-mode-option">
                  <input type="radio" name="interviewHostMode" value="dual" checked onchange="setInterviewHostMode('dual')">
                  <span class="option-label">双人访谈</span>
                  <span class="option-desc">主持人 + 嘉宾(你)</span>
                </label>
                <label class="host-mode-option">
                  <input type="radio" name="interviewHostMode" value="single" onchange="setInterviewHostMode('single')">
                  <span class="option-label">单人分享</span>
                  <span class="option-desc">以"我"的视角独白</span>
                </label>
              </div>
            </div>

            <!-- 生成按钮 -->
            <button id="generateFromInterviewBtn" class="generate-interview-btn" onclick="generateFromInterview()">
              <span>🎙️</span> 生成播客脚本
            </button>
          </div>
        </div>
        <!-- 对话创作模式内容结束 -->

        <!-- 素材添加对话框 -->
        <div id="materialDialog" class="material-dialog" style="display: none;">
          <div class="material-dialog-content">
            <div class="material-dialog-header">
              <span id="materialDialogTitle" class="material-dialog-title">添加素材</span>
              <button class="material-dialog-close" onclick="closeMaterialDialog()">×</button>
            </div>
            <div class="material-dialog-body">
              <input type="text" id="materialInput" class="material-input" placeholder="输入内容...">
              <input type="file" id="materialFileInput" accept=".pdf,.doc,.docx,.txt" style="display: none;">
            </div>
            <div class="material-dialog-footer">
              <button class="material-dialog-cancel" onclick="closeMaterialDialog()">取消</button>
              <button id="materialDialogSubmit" class="material-dialog-submit" onclick="submitMaterial()">添加</button>
            </div>
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
          <!-- 播客脚本（可编辑） -->
          <div class="result-card" id="scriptCard">
            <div class="result-card-header">
              <div class="result-card-title">
                <span>📜</span> 播客脚本
                <span id="scriptEditHint" class="edit-hint">（可编辑，确认后点击合成语音）</span>
              </div>
              <div class="result-card-actions">
                <button id="copyScriptBtn" class="copy-btn">
                  <span>📋</span> 复制
                </button>
              </div>
            </div>
            <textarea id="scriptEditor" class="script-editor" placeholder="脚本内容..."></textarea>
            <div id="scriptContent" class="script-content" style="display: none;"></div>
            <div id="synthesizeSection" class="synthesize-section">
              <button id="synthesizeBtn" class="synthesize-btn">
                <span>🎵</span> 合成语音
              </button>
              <button id="generatePPTBtn" class="ppt-btn">
                <span>📊</span> 生成PPT
              </button>
              <span class="synthesize-hint">确认脚本内容后，点击合成语音或生成PPT</span>
            </div>
          </div>

          <!-- PPT 编辑区域 -->
          <div class="result-card" id="pptEditorSection" style="display: none;">
            <div class="result-card-header">
              <div class="result-card-title">
                <span>📊</span> PPT 编辑器
                <span class="edit-hint">（可编辑 Slidev Markdown）</span>
              </div>
            </div>
            <div class="ppt-toolbar">
              <button id="previewSlidesBtn" class="ppt-toolbar-btn">
                <span>👁️</span> 预览
              </button>
              <button id="exportPdfBtn" class="ppt-toolbar-btn">
                <span>📄</span> 导出 PDF
              </button>
              <button id="exportPptxBtn" class="ppt-toolbar-btn">
                <span>📊</span> 导出 PPTX
              </button>
              <button id="downloadMarkdownBtn" class="ppt-toolbar-btn secondary">
                <span>⬇️</span> 下载 Markdown
              </button>
            </div>
            <textarea id="slidesMarkdown" class="markdown-editor" placeholder="Slidev Markdown 内容..."></textarea>
            <div id="pptStatusMessage" class="ppt-status-message"></div>
          </div>

          <!-- PPT 预览模态框 -->
          <div id="previewModal" class="preview-modal">
            <div class="preview-modal-content">
              <div class="preview-modal-header">
                <span class="preview-modal-title">幻灯片预览</span>
                <button id="closePreviewBtn" class="preview-close-btn">×</button>
              </div>
              <div class="preview-navigation">
                <button id="prevSlideBtn" class="nav-btn">◀ 上一页</button>
                <span id="slideCounter" class="slide-counter">1 / 1</span>
                <button id="nextSlideBtn" class="nav-btn">下一页 ▶</button>
              </div>
              <div id="previewContainer" class="preview-container"></div>
            </div>
          </div>

          <!-- 音频播放器（合成后显示） -->
          <div class="result-card" id="audioCard" style="display: none;">
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
