<template>
  <v-dialog v-model="show" max-width="700" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center bg-primary">
        <v-icon color="white" class="mr-2">mdi-chart-timeline-variant</v-icon>
        <span class="text-white">学习进度</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" color="white" @click="show = false" />
      </v-card-title>
      
      <v-card-text class="pa-4">
        <!-- 加载状态 -->
        <div v-if="loading" class="text-center py-8">
          <v-progress-circular indeterminate color="primary" />
          <div class="mt-2 text-grey">加载进度数据...</div>
        </div>
        
        <!-- 进度内容 -->
        <div v-else-if="progress">
          <!-- 总体统计卡片 -->
          <div class="stats-grid mb-6">
            <div class="stat-card">
              <v-icon color="primary" size="32">mdi-message-text</v-icon>
              <div class="stat-value">{{ progress.total_sessions }}</div>
              <div class="stat-label">总会话数</div>
            </div>
            <div class="stat-card">
              <v-icon color="success" size="32">mdi-chat-processing</v-icon>
              <div class="stat-value">{{ progress.total_turns }}</div>
              <div class="stat-label">总对话轮数</div>
            </div>
            <div class="stat-card">
              <v-icon color="info" size="32">mdi-folder-multiple</v-icon>
              <div class="stat-value">{{ progress.total_saves }}</div>
              <div class="stat-label">存档数量</div>
            </div>
            <div class="stat-card">
              <v-icon :color="avgGainColor" size="32">mdi-trending-up</v-icon>
              <div class="stat-value" :class="avgGainClass">
                {{ progress.avg_relationship_gain > 0 ? '+' : '' }}{{ progress.avg_relationship_gain }}
              </div>
              <div class="stat-label">平均关系增长</div>
            </div>
          </div>
          
          <!-- 最佳记录 -->
          <v-card variant="outlined" class="mb-4" v-if="progress.best_relationship_gain > 0">
            <v-card-text class="d-flex align-center">
              <v-icon color="amber" size="40" class="mr-3">mdi-trophy</v-icon>
              <div>
                <div class="text-subtitle-1 font-weight-bold">最佳表现</div>
                <div class="text-body-2 text-grey">
                  单次会话最高关系指数增长：
                  <span class="text-success font-weight-bold">+{{ progress.best_relationship_gain }}</span>
                </div>
              </div>
            </v-card-text>
          </v-card>
          
          <!-- 成就徽章 -->
          <div class="mb-4" v-if="achievements.length > 0">
            <div class="text-subtitle-1 font-weight-bold mb-2">
              <v-icon size="20" class="mr-1">mdi-medal</v-icon>
              已获得成就
            </div>
            <div class="achievements-grid">
              <v-chip
                v-for="achievement in achievements"
                :key="achievement.id"
                :color="achievement.color"
                variant="elevated"
                class="ma-1"
              >
                <v-icon start size="18">{{ achievement.icon }}</v-icon>
                {{ achievement.name }}
              </v-chip>
            </div>
          </div>

          <!-- 场景统计 -->
          <div v-if="progress.scenario_stats && progress.scenario_stats.length > 0">
            <div class="text-subtitle-1 font-weight-bold mb-2">
              <v-icon size="20" class="mr-1">mdi-chart-bar</v-icon>
              场景表现
            </div>
            <v-table density="compact">
              <thead>
                <tr>
                  <th>场景类型</th>
                  <th class="text-center">会话数</th>
                  <th class="text-center">对话轮数</th>
                  <th class="text-center">平均增长</th>
                  <th class="text-center">最佳增长</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="stat in progress.scenario_stats" :key="stat.scenario_type">
                  <td>
                    <v-chip size="small" variant="tonal" color="primary">
                      {{ truncateScenario(stat.scenario_type) }}
                    </v-chip>
                  </td>
                  <td class="text-center">{{ stat.session_count }}</td>
                  <td class="text-center">{{ stat.total_turns }}</td>
                  <td class="text-center">
                    <span :class="stat.avg_relationship_gain >= 0 ? 'text-success' : 'text-error'">
                      {{ stat.avg_relationship_gain > 0 ? '+' : '' }}{{ stat.avg_relationship_gain.toFixed(1) }}
                    </span>
                  </td>
                  <td class="text-center">
                    <span class="text-success font-weight-bold">+{{ stat.best_relationship_gain }}</span>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>
          
          <!-- 空状态 -->
          <div v-if="progress.total_sessions === 0" class="text-center py-8">
            <v-icon size="64" color="grey-lighten-1">mdi-emoticon-happy-outline</v-icon>
            <div class="text-h6 mt-2 text-grey">还没有练习记录</div>
            <div class="text-body-2 text-grey">开始你的第一次对话练习吧！</div>
          </div>
        </div>
        
        <!-- 错误状态 -->
        <div v-else class="text-center py-8">
          <v-icon size="64" color="error">mdi-alert-circle-outline</v-icon>
          <div class="text-h6 mt-2">加载失败</div>
          <v-btn color="primary" variant="text" @click="loadProgress" class="mt-2">
            重试
          </v-btn>
        </div>
      </v-card-text>
      
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="show = false">关闭</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { ref, computed, watch } from 'vue'

export default {
  name: 'ProgressViewer',
  props: {
    modelValue: { type: Boolean, default: false },
    nickname: { type: String, required: true },
    apiBase: { type: String, default: '' }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const show = computed({
      get: () => props.modelValue,
      set: (val) => emit('update:modelValue', val)
    })
    
    const loading = ref(false)
    const progress = ref(null)
    
    // 计算平均增长的颜色
    const avgGainColor = computed(() => {
      if (!progress.value) return 'grey'
      return progress.value.avg_relationship_gain >= 0 ? 'success' : 'error'
    })
    
    const avgGainClass = computed(() => {
      if (!progress.value) return ''
      return progress.value.avg_relationship_gain >= 0 ? 'text-success' : 'text-error'
    })
    
    // 计算成就
    const achievements = computed(() => {
      if (!progress.value) return []
      const list = []
      const p = progress.value
      
      // 会话数成就
      if (p.total_sessions >= 1) {
        list.push({ id: 'first_chat', name: '初次交流', icon: 'mdi-hand-wave', color: 'blue' })
      }
      if (p.total_sessions >= 10) {
        list.push({ id: 'chat_10', name: '对话达人', icon: 'mdi-message-badge', color: 'green' })
      }
      if (p.total_sessions >= 50) {
        list.push({ id: 'chat_50', name: '社交高手', icon: 'mdi-star', color: 'amber' })
      }
      
      // 对话轮数成就
      if (p.total_turns >= 100) {
        list.push({ id: 'turns_100', name: '话痨初级', icon: 'mdi-chat', color: 'teal' })
      }
      if (p.total_turns >= 500) {
        list.push({ id: 'turns_500', name: '话痨高级', icon: 'mdi-chat-processing', color: 'purple' })
      }
      
      // 关系增长成就
      if (p.best_relationship_gain >= 10) {
        list.push({ id: 'gain_10', name: '魅力初现', icon: 'mdi-heart', color: 'pink' })
      }
      if (p.best_relationship_gain >= 20) {
        list.push({ id: 'gain_20', name: '魅力四射', icon: 'mdi-heart-multiple', color: 'red' })
      }
      
      // 场景多样性成就
      if (p.scenario_stats && p.scenario_stats.length >= 3) {
        list.push({ id: 'diverse', name: '多面手', icon: 'mdi-shape', color: 'indigo' })
      }
      
      return list
    })
    
    // 加载进度
    async function loadProgress() {
      if (!props.nickname) return
      loading.value = true
      try {
        const res = await fetch(`${props.apiBase}/api/user/${props.nickname}/progress`)
        if (res.ok) {
          progress.value = await res.json()
        } else {
          progress.value = null
        }
      } catch (e) {
        console.error('加载进度失败:', e)
        progress.value = null
      } finally {
        loading.value = false
      }
    }
    
    // 截断场景描述
    function truncateScenario(text) {
      if (!text) return '未知场景'
      return text.length > 15 ? text.slice(0, 15) + '...' : text
    }
    
    // 监听显示状态，打开时加载数据
    watch(show, (val) => {
      if (val) {
        loadProgress()
      }
    })
    
    return {
      show, loading, progress,
      avgGainColor, avgGainClass, achievements,
      loadProgress, truncateScenario
    }
  }
}
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

@media (max-width: 600px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.stat-card {
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  margin: 8px 0 4px;
}

.stat-label {
  font-size: 12px;
  color: #666;
}

.achievements-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
