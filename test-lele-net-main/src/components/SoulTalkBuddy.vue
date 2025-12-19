<template>
  <div class="soul-talkbuddy-wrapper">
    <!-- 原生 Soul TalkBuddy 界面 -->
    <div id="soul-app">
      <header class="app-header">
        <div class="title">
          <img src="https://static.thenounproject.com/png/4595375-200.png" alt="logo" class="logo"/>
          <span>Soul TalkBuddy - AI社交对话教练</span>
        </div>
        <div class="actions">
          <div class="relation">
            <span>关系晴雨表</span>
            <div class="meter"><div id="relBar" class="meter-bar" style="width:50%"></div></div>
            <span id="relText">50</span>
          </div>
          <button id="btnPersona" class="primary">MBTI / 八维</button>
        </div>
      </header>

      <main class="container">
        <aside id="scenarioPanel" class="persona">
          <h3>场景与角色</h3>
          <div class="toggle"><label><input type="checkbox" id="scenarioEnabled" /> 使当前场景生效</label></div>
          <div class="toggle" style="margin-top:6px;"><label><input type="checkbox" id="scenarioAutoAnalyze" /> 自动分析</label></div>
          <div style="margin-top:12px; padding-top:12px; border-top:1px solid #eee;">
            <label>对手难度</label>
            <select id="opponentDifficulty" class="small" style="width:100%; margin-top:4px;">
              <option value="friendly">友善模式 - 总是积极回应</option>
              <option value="realistic" selected>真实模式 - 随机态度</option>
              <option value="challenging">挑战模式 - 更多拒绝</option>
              <option value="custom">自定义模式 - 手动选择</option>
            </select>
            <div style="font-size:11px; color:#2993d9; margin-top:4px;">控制对方回复的态度分布</div>
          </div>
          <div style="margin-top:8px;">
            <label>选择模板</label>
            <select id="scenarioTemplate" class="small" style="width:100%; margin-top:4px;">
              <option value="campus">校园破冰</option>
              <option value="interview">求职面试</option>
              <option value="cowork">同事请教</option>
              <option value="dating">首次约会</option>
              <option value="reunion">同学聚会</option>
              <option value="custom" selected>自定义</option>
            </select>
          </div>
          <div style="margin-top:8px;">
            <label>场景描述</label>
            <textarea id="scenarioText" rows="3" placeholder="例如：社团招新现场，初次认识一位学弟..."></textarea>
          </div>
          <div id="analysisResultBlock" class="hidden">
            <div style="margin-top:8px;">
              <label>对方角色称谓</label>
              <label style="float:right; font-size:12px;"><input type="checkbox" id="lockRoleTitle" /> 锁定</label>
              <input id="opponentRoleTitle" type="text" placeholder="如 学弟 / 面试官 / 同事" style="width:100%;"/>
            </div>
            <div style="margin-top:8px;">
              <label>对方形象</label>
              <label style="float:right; font-size:12px;"><input type="checkbox" id="lockTraits" /> 锁定</label>
              <div id="opponentTraits" class="chips"></div>
              <input id="opponentTraitsInput" type="text" class="small" placeholder="输入形象短语并回车添加" style="width:100%; margin-top:4px;" />
            </div>
            <div style="margin-top:8px;">
              <label>我的目标</label>
              <label style="float:right; font-size:12px;"><input type="checkbox" id="lockGoal" /> 锁定</label>
              <input id="userGoal" type="text" placeholder="如 建立融洽/推进邀约/拿到信息" style="width:100%;"/>
              <div id="userGoalReason" class="hint" style="font-size:12px; color:#2993d9; margin-top:4px;"></div>
              <div style="margin-top:6px;"><button id="btnRegenGoal" class="secondary small">重新生成目标</button></div>
            </div>
          </div>
          <div style="margin-top:10px; display:flex; gap:8px;">
            <button id="btnAnalyzeScenario" class="secondary small">智能分析</button>
            <button id="btnAnalyzeApplyScenario" class="secondary small">分析并应用</button>
            <button id="btnApplyScenario" class="primary small">保存并应用</button>
          </div>
          <div id="analyzeStatus" style="margin-top:6px; font-size:12px; color:#888;"></div>
        </aside>
        <aside id="personaPanel" class="persona hidden">
          <h3>用户画像</h3>
          <div id="personaSummary">未设置</div>
          <div class="toggle">
            <label><input type="checkbox" id="personaEnabled" /> 应用到建议</label>
          </div>
          <button id="btnInfer" class="secondary small">基于会话推断</button>
        </aside>

        <section class="chat">
          <div id="scenarioAppliedChip" class="chip hidden" style="margin-bottom:8px; display:flex; gap:8px; align-items:center;">
            <span id="scenarioAppliedText">未生效</span>
            <button id="btnEditScenario" class="secondary small">编辑</button>
            <button id="btnDisableScenario" class="secondary small">停用</button>
          </div>
          <div id="openingGuidance" class="hidden" style="margin-bottom:8px; padding:12px; background:#f0f8ff; border-radius:4px; border:1px solid #b3d9ff;">
            <div style="font-size:14px; margin-bottom:8px;"><strong>开场指引</strong></div>
            <div id="openingText" style="font-size:13px; color:#555; margin-bottom:8px;">当前场景通常由对方先开场。</div>
            <div style="display:flex; gap:8px;">
              <button id="btnLetOpponentStart" class="secondary small">让对方先开场</button>
              <button id="btnUserStartOverride" class="secondary small">我先开场</button>
            </div>
          </div>
          <div class="tip-row">
            <button id="btnFetchTip" class="secondary small">提示</button>
            <div class="tip" id="tipBar">点击"提示"获取建议</div>
          </div>
          <div id="messages" class="messages"></div>

          <div id="cands" class="candidates"></div>

          <div class="input-area">
            <textarea id="draft" rows="2" placeholder="输入消息..."></textarea>
            <div class="input-actions">
              <div class="left">
                <label><input type="checkbox" id="alwaysOn" /> 始终提示</label>
                <label style="margin-left:8px;"><input type="checkbox" id="aiOpponent" /> AI对手</label>
              </div>
              <div class="right">
                <button id="btnPeer" class="secondary">对方回复</button>
                <button id="btnSend" class="primary">发送</button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <!-- MBTI 弹窗 -->
      <div id="mbtiModal" class="modal hidden">
        <div class="modal-content">
          <div class="modal-header">
            <h3>MBTI / 荣格八维</h3>
            <button id="modalClose" class="icon-btn">×</button>
          </div>
          <div class="modal-body">
            <div id="quizContainer"></div>
            <div class="modal-actions">
              <button id="btnSubmitQuiz" class="primary">提交测评</button>
            </div>
            <div id="quizResult" class="quiz-result hidden"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { onMounted, onUnmounted, watch } from 'vue'

export default {
  name: 'SoulTalkBuddy',
  props: {
    saveData: {
      type: Object,
      default: null
    },
    apiBase: {
      type: String,
      default: ''
    }
  },
  emits: ['update-save'],
  setup(props, { emit }) {
    let appScript = null
    let scriptLoaded = false

    onMounted(() => {
      loadSoulApp()
    })

    onUnmounted(() => {
      // 清理回调
      if (window.SoulApp) {
        window.SoulApp.onStateChange = null
      }
      // 清理脚本
      if (appScript && appScript.parentNode) {
        appScript.parentNode.removeChild(appScript)
      }
    })

    // 监听 saveData 变化，加载存档
    watch(() => props.saveData, (newSave, oldSave) => {
      console.log('📂 saveData 变化:', newSave?.id, '旧:', oldSave?.id)
      if (newSave && scriptLoaded && window.SoulApp) {
        // 如果是不同的存档，先清空再加载
        if (!oldSave || newSave.id !== oldSave.id) {
          window.SoulApp.clearState()
        }
        window.SoulApp.loadFromSave(newSave)
      }
    }, { deep: true, immediate: false })

    function loadSoulApp() {
      // 设置 API 基础地址
      window.SOUL_API_BASE = props.apiBase || import.meta.env.VITE_SOUL_API_BASE || 'http://localhost:8000'

      // 检查是否已经加载过脚本
      if (window.SoulApp) {
        console.log('📂 SoulApp 已存在，直接加载存档')
        scriptLoaded = true
        
        // 注册状态变化回调
        window.SoulApp.onStateChange = (data) => {
          emit('update-save', data)
        }
        
        // 如果有存档数据，加载它
        if (props.saveData) {
          // 延迟一下确保 DOM 已渲染
          setTimeout(() => {
            window.SoulApp.loadFromSave(props.saveData)
          }, 100)
        }
        return
      }

      // 动态加载 app.js
      appScript = document.createElement('script')
      appScript.src = '/soul-assets/app.js'
      appScript.type = 'module'
      appScript.onload = () => {
        scriptLoaded = true
        
        // 等待 SoulApp 初始化完成
        const waitForSoulApp = setInterval(() => {
          if (window.SoulApp) {
            clearInterval(waitForSoulApp)
            
            // 注册状态变化回调（用于自动保存）
            window.SoulApp.onStateChange = (data) => {
              emit('update-save', data)
            }
            
            // 如果有存档数据，加载它
            if (props.saveData) {
              window.SoulApp.loadFromSave(props.saveData)
            }
          }
        }, 100)
        
        // 超时保护
        setTimeout(() => clearInterval(waitForSoulApp), 5000)
      }
      document.body.appendChild(appScript)
    }

    return {}
  }
}
</script>

<style>
@import '/soul-assets/styles.css';
</style>
<style scoped>
.soul-talkbuddy-wrapper {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  margin: 0;
  padding: 0;
}

#soul-app {
  isolation: isolate;
  width: 100%;
  min-height: 100vh;
  margin: 0;
  padding: 0;
}
</style>
