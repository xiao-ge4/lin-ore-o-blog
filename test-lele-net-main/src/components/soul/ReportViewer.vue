<template>
  <v-dialog v-model="show" max-width="600">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon color="primary" class="mr-2">mdi-file-document-outline</v-icon>
        学习报告
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="show = false" />
      </v-card-title>
      
      <v-card-text v-if="report">
        <!-- 关系变化 -->
        <v-card variant="tonal" class="mb-4">
          <v-card-text class="d-flex align-center justify-space-between">
            <div>
              <div class="text-caption text-grey">关系变化</div>
              <div class="d-flex align-center gap-2 mt-1">
                <span class="text-h6">{{ report.relationship_change?.start || 50 }}</span>
                <v-icon :color="deltaColor">{{ deltaIcon }}</v-icon>
                <span class="text-h6">{{ report.relationship_change?.end || 50 }}</span>
                <v-chip :color="deltaColor" size="small" class="ml-2">
                  {{ deltaText }}
                </v-chip>
              </div>
            </div>
            <div class="text-right">
              <div class="text-caption text-grey">对话轮数</div>
              <div class="text-h5">{{ report.total_turns || 0 }}</div>
            </div>
          </v-card-text>
        </v-card>
        
        <!-- 亮点 -->
        <div class="mb-4">
          <div class="text-subtitle-2 mb-2">
            <v-icon size="small" color="success" class="mr-1">mdi-star</v-icon>
            表现亮点
          </div>
          <v-list density="compact" v-if="report.highlights?.length">
            <v-list-item v-for="(item, idx) in report.highlights" :key="idx" class="px-0">
              <template v-slot:prepend>
                <v-icon size="small" color="success">mdi-check-circle</v-icon>
              </template>
              <v-list-item-title class="text-body-2">{{ item }}</v-list-item-title>
            </v-list-item>
          </v-list>
          <div v-else class="text-grey text-body-2">暂无亮点记录</div>
        </div>
        
        <!-- 改进建议 -->
        <div class="mb-4">
          <div class="text-subtitle-2 mb-2">
            <v-icon size="small" color="warning" class="mr-1">mdi-lightbulb</v-icon>
            改进建议
          </div>
          <v-list density="compact" v-if="report.improvements?.length">
            <v-list-item v-for="(item, idx) in report.improvements" :key="idx" class="px-0">
              <template v-slot:prepend>
                <v-icon size="small" color="warning">mdi-arrow-right-circle</v-icon>
              </template>
              <v-list-item-title class="text-body-2">{{ item }}</v-list-item-title>
            </v-list-item>
          </v-list>
          <div v-else class="text-grey text-body-2">暂无改进建议</div>
        </div>
        
        <!-- 总体评价 -->
        <v-alert type="info" variant="tonal" v-if="report.overall_comment">
          <div class="text-subtitle-2 mb-1">总体评价</div>
          <div class="text-body-2">{{ report.overall_comment }}</div>
        </v-alert>
        
        <div class="text-caption text-grey mt-4 text-right">
          生成于 {{ formatTime(report.generated_at) }}
        </div>
      </v-card-text>
      
      <v-card-text v-else class="text-center py-8">
        <v-icon size="64" color="grey-lighten-1">mdi-file-document-outline</v-icon>
        <div class="mt-2 text-grey">暂无报告</div>
        <v-btn 
          color="primary" 
          variant="tonal" 
          class="mt-4" 
          :loading="loading"
          @click="$emit('generate')"
        >
          生成报告
        </v-btn>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'ReportViewer',
  props: {
    modelValue: { type: Boolean, default: false },
    report: { type: Object, default: null },
    loading: { type: Boolean, default: false }
  },
  emits: ['update:modelValue', 'generate'],
  setup(props, { emit }) {
    const show = computed({
      get: () => props.modelValue,
      set: (val) => emit('update:modelValue', val)
    })
    
    const delta = computed(() => props.report?.relationship_change?.delta || 0)
    
    const deltaColor = computed(() => {
      if (delta.value > 0) return 'success'
      if (delta.value < 0) return 'error'
      return 'grey'
    })
    
    const deltaIcon = computed(() => {
      if (delta.value > 0) return 'mdi-arrow-up'
      if (delta.value < 0) return 'mdi-arrow-down'
      return 'mdi-minus'
    })
    
    const deltaText = computed(() => {
      if (delta.value > 0) return `+${delta.value}`
      return String(delta.value)
    })
    
    function formatTime(isoString) {
      if (!isoString) return '-'
      return new Date(isoString).toLocaleString('zh-CN')
    }
    
    return { show, deltaColor, deltaIcon, deltaText, formatTime }
  }
}
</script>
