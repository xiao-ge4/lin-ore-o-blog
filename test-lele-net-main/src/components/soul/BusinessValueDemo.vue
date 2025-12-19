<template>
  <v-dialog v-model="show" max-width="900" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center bg-gradient">
        <v-icon color="white" class="mr-2">mdi-chart-areaspline</v-icon>
        <span class="text-white">商业价值分析</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" color="white" @click="show = false" />
      </v-card-title>
      
      <v-card-text class="pa-0">
        <!-- 标签页 -->
        <v-tabs v-model="tab" bg-color="primary" align-tabs="center">
          <v-tab value="market">市场机会</v-tab>
          <v-tab value="metrics">核心指标</v-tab>
          <v-tab value="monetization">变现模式</v-tab>
          <v-tab value="cases">应用场景</v-tab>
        </v-tabs>
        
        <v-tabs-window v-model="tab" class="pa-4">
          <!-- 市场机会 -->
          <v-tabs-window-item value="market">
            <div class="market-section">
              <h3 class="mb-4">目标市场规模</h3>
              
              <div class="market-cards">
                <div class="market-card">
                  <div class="market-icon">🎯</div>
                  <div class="market-value">3.2亿</div>
                  <div class="market-label">中国社交焦虑人群</div>
                  <div class="market-source">数据来源：中国心理健康蓝皮书</div>
                </div>
                <div class="market-card">
                  <div class="market-icon">💼</div>
                  <div class="market-value">1.5亿</div>
                  <div class="market-label">职场沟通培训需求</div>
                  <div class="market-source">每年新增职场人群</div>
                </div>
                <div class="market-card">
                  <div class="market-icon">📈</div>
                  <div class="market-value">500亿</div>
                  <div class="market-label">在线教育市场规模</div>
                  <div class="market-source">软技能培训细分市场</div>
                </div>
              </div>
              
              <v-alert type="info" variant="tonal" class="mt-4">
                <strong>市场痛点：</strong>传统沟通培训成本高（人均3000-10000元/课程）、
                缺乏个性化练习、无法随时随地训练。AI 教练可将成本降低 90%，
                同时提供 24/7 无限次练习。
              </v-alert>
            </div>
          </v-tabs-window-item>
          
          <!-- 核心指标 -->
          <v-tabs-window-item value="metrics">
            <div class="metrics-section">
              <h3 class="mb-4">产品核心指标（模拟数据）</h3>
              
              <div class="metrics-grid">
                <div class="metric-card">
                  <v-icon color="primary" size="40">mdi-account-group</v-icon>
                  <div class="metric-value">{{ animatedUsers.toLocaleString() }}</div>
                  <div class="metric-label">注册用户</div>
                  <div class="metric-trend text-success">↑ 23% 月增长</div>
                </div>
                <div class="metric-card">
                  <v-icon color="success" size="40">mdi-message-text</v-icon>
                  <div class="metric-value">{{ animatedSessions.toLocaleString() }}</div>
                  <div class="metric-label">累计会话</div>
                  <div class="metric-trend text-success">↑ 45% 月增长</div>
                </div>
                <div class="metric-card">
                  <v-icon color="warning" size="40">mdi-clock-outline</v-icon>
                  <div class="metric-value">{{ animatedMinutes }}</div>
                  <div class="metric-label">平均练习时长(分钟)</div>
                  <div class="metric-trend text-success">用户粘性高</div>
                </div>
                <div class="metric-card">
                  <v-icon color="info" size="40">mdi-repeat</v-icon>
                  <div class="metric-value">{{ animatedRetention }}%</div>
                  <div class="metric-label">7日留存率</div>
                  <div class="metric-trend text-success">高于行业平均</div>
                </div>
              </div>
              
              <v-divider class="my-4" />
              
              <h4 class="mb-3">用户效果验证</h4>
              <div class="effect-cards">
                <v-card variant="outlined" class="pa-3">
                  <div class="d-flex align-center">
                    <v-avatar color="success" size="48" class="mr-3">
                      <span class="text-h6">+35%</span>
                    </v-avatar>
                    <div>
                      <div class="font-weight-bold">沟通自信度提升</div>
                      <div class="text-caption text-grey">经过10次练习后的用户自评</div>
                    </div>
                  </div>
                </v-card>
                <v-card variant="outlined" class="pa-3">
                  <div class="d-flex align-center">
                    <v-avatar color="primary" size="48" class="mr-3">
                      <span class="text-h6">4.6</span>
                    </v-avatar>
                    <div>
                      <div class="font-weight-bold">用户满意度评分</div>
                      <div class="text-caption text-grey">满分5分，基于用户反馈</div>
                    </div>
                  </div>
                </v-card>
              </div>
            </div>
          </v-tabs-window-item>
          
          <!-- 变现模式 -->
          <v-tabs-window-item value="monetization">
            <div class="monetization-section">
              <h3 class="mb-4">商业变现模式</h3>
              
              <div class="pricing-cards">
                <v-card variant="outlined" class="pricing-card">
                  <v-card-title class="bg-grey-lighten-3">
                    <v-icon class="mr-2">mdi-gift</v-icon>
                    免费版
                  </v-card-title>
                  <v-card-text>
                    <div class="price">¥0</div>
                    <v-list density="compact">
                      <v-list-item prepend-icon="mdi-check" title="3个存档位" />
                      <v-list-item prepend-icon="mdi-check" title="基础场景模板" />
                      <v-list-item prepend-icon="mdi-check" title="简单学习报告" />
                      <v-list-item prepend-icon="mdi-close" class="text-grey" title="高级场景分析" />
                      <v-list-item prepend-icon="mdi-close" class="text-grey" title="个性化建议" />
                    </v-list>
                  </v-card-text>
                </v-card>
                
                <v-card variant="elevated" class="pricing-card featured" elevation="8">
                  <v-chip color="warning" class="featured-badge">推荐</v-chip>
                  <v-card-title class="bg-primary text-white">
                    <v-icon class="mr-2">mdi-star</v-icon>
                    专业版
                  </v-card-title>
                  <v-card-text>
                    <div class="price">¥29<span>/月</span></div>
                    <v-list density="compact">
                      <v-list-item prepend-icon="mdi-check" title="无限存档位" />
                      <v-list-item prepend-icon="mdi-check" title="全部场景模板" />
                      <v-list-item prepend-icon="mdi-check" title="详细学习报告" />
                      <v-list-item prepend-icon="mdi-check" title="AI 深度分析" />
                      <v-list-item prepend-icon="mdi-check" title="个性化改进建议" />
                    </v-list>
                  </v-card-text>
                </v-card>
                
                <v-card variant="outlined" class="pricing-card">
                  <v-card-title class="bg-amber-lighten-4">
                    <v-icon class="mr-2">mdi-domain</v-icon>
                    企业版
                  </v-card-title>
                  <v-card-text>
                    <div class="price">定制</div>
                    <v-list density="compact">
                      <v-list-item prepend-icon="mdi-check" title="团队管理后台" />
                      <v-list-item prepend-icon="mdi-check" title="定制场景模板" />
                      <v-list-item prepend-icon="mdi-check" title="员工培训报告" />
                      <v-list-item prepend-icon="mdi-check" title="API 接口" />
                      <v-list-item prepend-icon="mdi-check" title="专属客户经理" />
                    </v-list>
                  </v-card-text>
                </v-card>
              </div>
              
              <v-alert type="success" variant="tonal" class="mt-4">
                <strong>预估收入模型：</strong>
                假设 10万 MAU，5% 付费转化率，ARPU ¥25/月 = 月收入 ¥12.5万
              </v-alert>
            </div>
          </v-tabs-window-item>
          
          <!-- 应用场景 -->
          <v-tabs-window-item value="cases">
            <div class="cases-section">
              <h3 class="mb-4">典型应用场景</h3>
              
              <v-expansion-panels>
                <v-expansion-panel title="🎓 校园招聘面试准备">
                  <v-expansion-panel-text>
                    <p><strong>用户画像：</strong>大学生、应届毕业生</p>
                    <p><strong>使用场景：</strong>模拟 HR 面试、技术面试、群面讨论</p>
                    <p><strong>价值体现：</strong>降低面试焦虑，提升通过率 30%+</p>
                    <p><strong>付费意愿：</strong>高（求职刚需，愿意为结果付费）</p>
                  </v-expansion-panel-text>
                </v-expansion-panel>
                
                <v-expansion-panel title="💼 职场沟通技能提升">
                  <v-expansion-panel-text>
                    <p><strong>用户画像：</strong>职场新人、中层管理者</p>
                    <p><strong>使用场景：</strong>向上汇报、跨部门协作、绩效面谈</p>
                    <p><strong>价值体现：</strong>提升职场软实力，助力晋升</p>
                    <p><strong>付费意愿：</strong>中高（职业发展投资）</p>
                  </v-expansion-panel-text>
                </v-expansion-panel>
                
                <v-expansion-panel title="💕 社交与情感沟通">
                  <v-expansion-panel-text>
                    <p><strong>用户画像：</strong>社交焦虑者、内向人群</p>
                    <p><strong>使用场景：</strong>约会对话、朋友聚会、陌生人破冰</p>
                    <p><strong>价值体现：</strong>建立社交自信，改善人际关系</p>
                    <p><strong>付费意愿：</strong>中（情感需求驱动）</p>
                  </v-expansion-panel-text>
                </v-expansion-panel>
                
                <v-expansion-panel title="🏢 企业培训解决方案">
                  <v-expansion-panel-text>
                    <p><strong>客户画像：</strong>销售团队、客服团队、HR 部门</p>
                    <p><strong>使用场景：</strong>销售话术训练、客户投诉处理、招聘面试官培训</p>
                    <p><strong>价值体现：</strong>标准化培训、降低培训成本 60%</p>
                    <p><strong>付费意愿：</strong>高（企业预算，效果可量化）</p>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </div>
          </v-tabs-window-item>
        </v-tabs-window>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'

export default {
  name: 'BusinessValueDemo',
  props: {
    modelValue: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const show = computed({
      get: () => props.modelValue,
      set: (val) => emit('update:modelValue', val)
    })
    
    const tab = ref('market')
    
    // 动画数字
    const animatedUsers = ref(0)
    const animatedSessions = ref(0)
    const animatedMinutes = ref(0)
    const animatedRetention = ref(0)
    
    // 目标值
    const targetUsers = 12580
    const targetSessions = 45230
    const targetMinutes = 18
    const targetRetention = 68
    
    // 数字动画
    function animateNumbers() {
      const duration = 1500
      const steps = 60
      const interval = duration / steps
      
      let step = 0
      const timer = setInterval(() => {
        step++
        const progress = step / steps
        const eased = 1 - Math.pow(1 - progress, 3) // ease-out
        
        animatedUsers.value = Math.round(targetUsers * eased)
        animatedSessions.value = Math.round(targetSessions * eased)
        animatedMinutes.value = Math.round(targetMinutes * eased)
        animatedRetention.value = Math.round(targetRetention * eased)
        
        if (step >= steps) {
          clearInterval(timer)
        }
      }, interval)
    }
    
    watch(show, (val) => {
      if (val) {
        animatedUsers.value = 0
        animatedSessions.value = 0
        animatedMinutes.value = 0
        animatedRetention.value = 0
        setTimeout(animateNumbers, 300)
      }
    })
    
    return {
      show, tab,
      animatedUsers, animatedSessions, animatedMinutes, animatedRetention
    }
  }
}
</script>

<style scoped>
.bg-gradient {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* 市场卡片 */
.market-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.market-card {
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.market-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

.market-value {
  font-size: 32px;
  font-weight: bold;
  color: #667eea;
}

.market-label {
  font-size: 14px;
  color: #333;
  margin: 4px 0;
}

.market-source {
  font-size: 11px;
  color: #999;
}

/* 指标卡片 */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.metric-card {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.metric-value {
  font-size: 28px;
  font-weight: bold;
  margin: 8px 0 4px;
}

.metric-label {
  font-size: 12px;
  color: #666;
}

.metric-trend {
  font-size: 11px;
  margin-top: 4px;
}

.effect-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

/* 定价卡片 */
.pricing-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.pricing-card {
  position: relative;
}

.pricing-card.featured {
  transform: scale(1.05);
  z-index: 1;
}

.featured-badge {
  position: absolute;
  top: -10px;
  right: 16px;
}

.price {
  font-size: 36px;
  font-weight: bold;
  text-align: center;
  padding: 16px 0;
  color: #667eea;
}

.price span {
  font-size: 14px;
  color: #999;
}

@media (max-width: 768px) {
  .market-cards,
  .metrics-grid,
  .pricing-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .effect-cards {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .market-cards,
  .metrics-grid,
  .pricing-cards {
    grid-template-columns: 1fr;
  }
}
</style>
