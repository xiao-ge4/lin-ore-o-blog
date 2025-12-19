<template>
  <div class="soul-wrapper">
    <!-- 登录弹窗 -->
    <LoginModal
      v-model="showLogin"
      :api-base="apiBase"
      @login-success="handleLoginSuccess"
    />
    
    <!-- 主界面 -->
    <div v-if="isLoggedIn" class="soul-main">
      <!-- 顶部用户栏 -->
      <div class="user-bar">
        <div class="user-info">
          <v-icon size="20" color="white">mdi-account-circle</v-icon>
          <span class="nickname">{{ nickname }}</span>
          <span v-if="currentSave" class="save-name">| {{ currentSave.name }}</span>
        </div>
        <div class="user-actions">
          <v-btn 
            icon="mdi-folder" 
            variant="text" 
            size="small"
            color="white"
            @click="showSaveManager = true"
            title="存档管理"
          />
          <v-btn 
            icon="mdi-chart-timeline-variant" 
            variant="text" 
            size="small"
            color="white"
            @click="showProgress = true"
            title="学习进度"
          />
          <v-btn 
            icon="mdi-chart-line" 
            variant="text" 
            size="small"
            color="white"
            @click="handleViewReport(currentSave)"
            :disabled="!currentSave"
            title="查看报告"
          />
          <v-btn 
            icon="mdi-chart-areaspline" 
            variant="text" 
            size="small"
            color="amber"
            @click="showBusinessValue = true"
            title="商业价值分析"
          />
          <v-btn 
            icon="mdi-logout" 
            variant="text" 
            size="small"
            color="white"
            @click="handleLogout"
            title="退出登录"
          />
        </div>
      </div>
      
      <!-- 存档管理抽屉 -->
      <v-navigation-drawer v-model="showSaveManager" location="right" width="380" temporary>
        <SaveManager
          :saves="saves"
          :max-saves="maxSaves"
          :loading="loadingSaves"
          :current-save-id="currentSave?.id"
          @new-save="showNewSave = true"
          @continue-save="handleContinueSave"
          @restart-save="handleRestartSave"
          @view-report="handleViewReport"
          @delete-save="handleDeleteSave"
        />
      </v-navigation-drawer>
      
      <!-- Soul TalkBuddy 主界面 -->
      <div class="soul-content">
        <!-- 始终渲染 SoulTalkBuddy，但在没有存档时隐藏 -->
        <div :class="{ 'hidden-content': !currentSave }">
          <SoulTalkBuddy
            :save-data="currentSave"
            :api-base="apiBase"
            @update-save="handleAutoSave"
          />
        </div>
        <div v-if="!currentSave" class="no-save-hint">
          <v-card class="pa-8 text-center" max-width="400" elevation="8">
            <v-icon size="80" color="primary">mdi-message-text-outline</v-icon>
            <h2 class="mt-4">开始你的对话练习</h2>
            <p class="text-grey mt-2">选择一个存档继续，或创建新存档开始</p>
            <v-btn color="primary" size="large" class="mt-4" @click="showSaveManager = true">
              打开存档管理
            </v-btn>
          </v-card>
        </div>
      </div>
    </div>
    
    <!-- 新建存档弹窗 -->
    <NewSaveModal
      v-model="showNewSave"
      :loading="creatingNewSave"
      @create="handleCreateSave"
    />
    
    <!-- 重新开始确认弹窗 -->
    <RestartConfirmModal
      v-model="showRestartConfirm"
      :save-name="restartingSave?.name || ''"
      :loading="restarting"
      @confirm="handleConfirmRestart"
    />
    
    <!-- 报告查看弹窗 -->
    <ReportViewer
      v-model="showReport"
      :report="currentReport"
      :loading="generatingReport"
      @generate="handleGenerateReport"
    />
    
    <!-- 进度查看弹窗 -->
    <ProgressViewer
      v-model="showProgress"
      :nickname="nickname"
      :api-base="apiBase"
    />
    
    <!-- 商业价值展示弹窗 -->
    <BusinessValueDemo v-model="showBusinessValue" />
    
    <!-- 删除确认 -->
    <v-dialog v-model="showDeleteConfirm" max-width="400">
      <v-card>
        <v-card-title>确认删除</v-card-title>
        <v-card-text>
          确定要删除存档「{{ deletingSave?.name }}」吗？此操作无法撤销。
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showDeleteConfirm = false">取消</v-btn>
          <v-btn color="error" :loading="deleting" @click="handleConfirmDelete">删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    
    <!-- 全局提示 -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import LoginModal from './LoginModal.vue'
import SaveManager from './SaveManager.vue'
import NewSaveModal from './NewSaveModal.vue'
import RestartConfirmModal from './RestartConfirmModal.vue'
import ReportViewer from './ReportViewer.vue'
import ProgressViewer from './ProgressViewer.vue'
import BusinessValueDemo from './BusinessValueDemo.vue'
import SoulTalkBuddy from '../SoulTalkBuddy.vue'

export default {
  name: 'SoulTalkBuddyWrapper',
  components: { 
    LoginModal, 
    SaveManager, 
    NewSaveModal, 
    RestartConfirmModal, 
    ReportViewer,
    ProgressViewer,
    BusinessValueDemo,
    SoulTalkBuddy
  },
  props: {
    apiBase: { type: String, default: '' }
  },
  setup(props) {
    // 用户状态
    const nickname = ref('')
    const showLogin = ref(false)
    const isLoggedIn = computed(() => !!nickname.value)
    
    // 存档状态
    const saves = ref([])
    const maxSaves = ref(10)
    const loadingSaves = ref(false)
    const currentSave = ref(null)
    const showSaveManager = ref(false)
    
    // 自动保存相关
    let autoSaveTimer = null
    let pendingSaveData = null
    let lastSavedConvLength = 0
    
    // 弹窗状态
    const showNewSave = ref(false)
    const creatingNewSave = ref(false)
    const showRestartConfirm = ref(false)
    const restartingSave = ref(null)
    const restarting = ref(false)
    const showReport = ref(false)
    const currentReport = ref(null)
    const generatingReport = ref(false)
    const showProgress = ref(false)
    const showBusinessValue = ref(false)
    const showDeleteConfirm = ref(false)
    const deletingSave = ref(null)
    const deleting = ref(false)
    
    // 提示
    const snackbar = ref({ show: false, text: '', color: 'success' })
    
    function showMessage(text, color = 'success') {
      snackbar.value = { show: true, text, color }
    }
    
    // 初始化：检查本地存储的登录状态
    onMounted(() => {
      const savedNickname = localStorage.getItem('soul_nickname')
      if (savedNickname) {
        nickname.value = savedNickname
        loadSaves()
      } else {
        showLogin.value = true
      }
      
      // 监听页面卸载事件
      window.addEventListener('beforeunload', handleBeforeUnload)
      // 监听页面可见性变化（切换标签页时保存）
      document.addEventListener('visibilitychange', handleVisibilityChange)
    })
    
    // 组件卸载时清理
    onUnmounted(() => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      // 立即保存待保存的数据
      if (pendingSaveData) {
        doSave(pendingSaveData)
      }
    })
    
    // 登录成功
    function handleLoginSuccess(data) {
      nickname.value = data.nickname
      showMessage(data.status === 'register' ? '注册成功，欢迎！' : '欢迎回来！')
      loadSaves()
    }
    
    // 登出
    function handleLogout() {
      localStorage.removeItem('soul_nickname')
      nickname.value = ''
      saves.value = []
      currentSave.value = null
      // 清空 SoulApp 状态
      if (window.SoulApp) {
        window.SoulApp.clearState()
      }
      showLogin.value = true
    }
    
    // 加载存档列表
    async function loadSaves() {
      if (!nickname.value) return
      loadingSaves.value = true
      try {
        const res = await fetch(`${props.apiBase}/api/user/${nickname.value}/saves`)
        const data = await res.json()
        saves.value = data.saves || []
        maxSaves.value = data.max_saves || 10
      } catch (e) {
        showMessage('加载存档失败', 'error')
      } finally {
        loadingSaves.value = false
      }
    }
    
    // 创建存档
    async function handleCreateSave(saveData) {
      creatingNewSave.value = true
      try {
        const res = await fetch(`${props.apiBase}/api/user/${nickname.value}/saves`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saveData)
        })
        if (!res.ok) throw new Error((await res.json()).detail)
        const newSave = await res.json()
        showNewSave.value = false
        showMessage('存档创建成功')
        await loadSaves()
        currentSave.value = newSave
        // 新存档，对话长度为0
        lastSavedConvLength = 0
        showSaveManager.value = false
      } catch (e) {
        showMessage(e.message || '创建失败', 'error')
      } finally {
        creatingNewSave.value = false
      }
    }
    
    // 继续存档
    async function handleContinueSave(save) {
      try {
        const res = await fetch(`${props.apiBase}/api/user/${nickname.value}/saves/${save.id}`)
        if (!res.ok) throw new Error('加载失败')
        const loadedSave = await res.json()
        currentSave.value = loadedSave
        // 初始化已保存的对话长度
        lastSavedConvLength = loadedSave?.current_session?.conversation?.length || 0
        showSaveManager.value = false
        showMessage(`已加载存档: ${save.name}`)
      } catch (e) {
        showMessage('加载存档失败', 'error')
      }
    }
    
    // 执行保存
    async function doSave(data) {
      if (!data || !currentSave.value || !nickname.value) return
      try {
        console.log('📤 发送保存请求')
        await fetch(`${props.apiBase}/api/user/${nickname.value}/saves/${currentSave.value.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
        console.log('✅ 保存成功')
        pendingSaveData = null
      } catch (e) {
        console.error('保存失败:', e)
      }
    }
    
    // 自动保存
    
    function handleAutoSave(updateData) {
      if (!currentSave.value || !nickname.value) return
      
      pendingSaveData = updateData
      const newConvLength = updateData?.conversation?.length || 0
      
      clearTimeout(autoSaveTimer)
      
      // 有新消息时立即保存
      if (newConvLength > lastSavedConvLength) {
        console.log('📤 检测到新消息，立即保存', lastSavedConvLength, '->', newConvLength)
        lastSavedConvLength = newConvLength
        doSave(updateData)
      } else {
        // 其他变化，短防抖后保存
        autoSaveTimer = setTimeout(() => doSave(updateData), 300)
      }
    }
    
    // 页面卸载前立即保存
    function handleBeforeUnload() {
      if (pendingSaveData && currentSave.value && nickname.value) {
        // 使用 sendBeacon（更可靠，专为页面卸载设计）
        const url = `${props.apiBase}/api/user/${nickname.value}/saves/${currentSave.value.id}/sync`
        const blob = new Blob([JSON.stringify(pendingSaveData)], { type: 'application/json' })
        const success = navigator.sendBeacon(url, blob)
        console.log('📤 页面卸载前保存:', success ? '已发送' : '发送失败')
      }
    }
    
    // 页面可见性变化时保存（切换标签页、最小化窗口）
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden' && pendingSaveData) {
        // 页面隐藏时立即保存
        doSave(pendingSaveData)
      }
    }
    
    // 重新开始
    function handleRestartSave(save) {
      restartingSave.value = save
      showRestartConfirm.value = true
    }
    
    async function handleConfirmRestart({ preserveHistory }) {
      restarting.value = true
      try {
        const res = await fetch(
          `${props.apiBase}/api/user/${nickname.value}/saves/${restartingSave.value.id}/restart`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preserve_history: preserveHistory })
          }
        )
        if (!res.ok) throw new Error()
        const updatedSave = await res.json()
        showRestartConfirm.value = false
        showMessage('已重新开始')
        await loadSaves()
        
        // 如果当前正在使用这个存档，更新它
        if (currentSave.value?.id === restartingSave.value.id) {
          currentSave.value = updatedSave
          // 清空 SoulApp 状态并重新加载
          if (window.SoulApp) {
            window.SoulApp.clearState()
            window.SoulApp.loadFromSave(updatedSave)
          }
        }
      } catch (e) {
        showMessage('操作失败', 'error')
      } finally {
        restarting.value = false
      }
    }
    
    // 查看报告
    async function handleViewReport(save) {
      if (!save) return
      try {
        const res = await fetch(`${props.apiBase}/api/user/${nickname.value}/saves/${save.id}`)
        const data = await res.json()
        currentReport.value = data.current_session?.report || null
        showReport.value = true
      } catch (e) {
        showMessage('加载报告失败', 'error')
      }
    }
    
    // 生成报告
    async function handleGenerateReport() {
      if (!currentSave.value) return
      generatingReport.value = true
      try {
        const res = await fetch(
          `${props.apiBase}/api/user/${nickname.value}/saves/${currentSave.value.id}/report`,
          { method: 'POST' }
        )
        if (!res.ok) throw new Error((await res.json()).detail)
        currentReport.value = await res.json()
        showMessage('报告生成成功')
      } catch (e) {
        showMessage(e.message || '生成失败', 'error')
      } finally {
        generatingReport.value = false
      }
    }
    
    // 删除存档
    function handleDeleteSave(save) {
      deletingSave.value = save
      showDeleteConfirm.value = true
    }
    
    async function handleConfirmDelete() {
      deleting.value = true
      try {
        await fetch(`${props.apiBase}/api/user/${nickname.value}/saves/${deletingSave.value.id}`, {
          method: 'DELETE'
        })
        showDeleteConfirm.value = false
        showMessage('存档已删除')
        await loadSaves()
        if (currentSave.value?.id === deletingSave.value.id) {
          currentSave.value = null
          if (window.SoulApp) {
            window.SoulApp.clearState()
          }
        }
      } catch (e) {
        showMessage('删除失败', 'error')
      } finally {
        deleting.value = false
      }
    }
    
    return {
      nickname, showLogin, isLoggedIn,
      saves, maxSaves, loadingSaves, currentSave, showSaveManager,
      showNewSave, creatingNewSave,
      showRestartConfirm, restartingSave, restarting,
      showReport, currentReport, generatingReport,
      showProgress,
      showBusinessValue,
      showDeleteConfirm, deletingSave, deleting,
      snackbar,
      handleLoginSuccess, handleLogout,
      handleCreateSave, handleContinueSave, handleAutoSave,
      handleRestartSave, handleConfirmRestart,
      handleViewReport, handleGenerateReport,
      handleDeleteSave, handleConfirmDelete
    }
  }
}
</script>

<style scoped>
.soul-wrapper {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.soul-main {
  min-height: 100vh;
}

.user-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 48px;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 100;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: white;
}

.nickname {
  font-weight: 500;
}

.save-name {
  opacity: 0.8;
  font-size: 14px;
}

.user-actions {
  display: flex;
  gap: 4px;
}

.soul-content {
  padding-top: 48px;
  min-height: calc(100vh - 48px);
}

.no-save-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 48px);
}

.hidden-content {
  display: none;
}
</style>
