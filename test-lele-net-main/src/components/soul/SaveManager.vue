<template>
  <v-card class="save-manager" elevation="2">
    <v-card-title class="d-flex align-center">
      <v-icon class="mr-2">mdi-content-save-all</v-icon>
      我的存档
      <v-spacer />
      <v-chip size="small" color="primary" variant="outlined">
        {{ saves.length }} / {{ maxSaves }}
      </v-chip>
    </v-card-title>
    
    <v-card-text>
      <!-- 加载状态 -->
      <div v-if="loading" class="text-center py-8">
        <v-progress-circular indeterminate color="primary" />
        <div class="mt-2 text-grey">加载存档中...</div>
      </div>
      
      <!-- 空状态 -->
      <div v-else-if="saves.length === 0" class="text-center py-8">
        <v-icon size="64" color="grey-lighten-1">mdi-folder-open-outline</v-icon>
        <div class="mt-2 text-grey">暂无存档，创建一个开始练习吧</div>
      </div>
      
      <!-- 存档列表 -->
      <v-list v-else lines="three">
        <v-list-item
          v-for="save in saves"
          :key="save.id"
          class="save-item mb-2"
          :class="{ 'save-item-active': save.id === currentSaveId }"
          rounded
          @click="$emit('continue-save', save)"
        >
          <template v-slot:prepend>
            <v-avatar color="primary" variant="tonal">
              <v-icon>mdi-message-text</v-icon>
            </v-avatar>
          </template>
          
          <v-list-item-title class="font-weight-medium">
            {{ save.name }}
          </v-list-item-title>
          
          <v-list-item-subtitle>
            <div class="d-flex align-center gap-2 mt-1">
              <v-chip size="x-small" :color="getRelationColor(save.relationship_index)">
                关系: {{ save.relationship_index }}
              </v-chip>
              <v-chip size="x-small" variant="outlined">
                会话: {{ save.session_count }}
              </v-chip>
              <v-chip size="x-small" variant="outlined">
                对话: {{ save.total_turns }}轮
              </v-chip>
            </div>
            <div class="text-caption text-grey mt-1">
              更新于 {{ formatTime(save.updated_at) }}
            </div>
          </v-list-item-subtitle>
          
          <template v-slot:append>
            <v-menu>
              <template v-slot:activator="{ props }">
                <v-btn icon="mdi-dots-vertical" variant="text" size="small" v-bind="props" @click.stop />
              </template>
              <v-list density="compact">
                <v-list-item @click.stop="$emit('continue-save', save)">
                  <template v-slot:prepend><v-icon size="small">mdi-play</v-icon></template>
                  <v-list-item-title>继续对话</v-list-item-title>
                </v-list-item>
                <v-list-item @click.stop="$emit('restart-save', save)">
                  <template v-slot:prepend><v-icon size="small">mdi-restart</v-icon></template>
                  <v-list-item-title>重新开始</v-list-item-title>
                </v-list-item>
                <v-list-item @click.stop="$emit('view-report', save)">
                  <template v-slot:prepend><v-icon size="small">mdi-file-document</v-icon></template>
                  <v-list-item-title>查看报告</v-list-item-title>
                </v-list-item>
                <v-divider />
                <v-list-item @click.stop="$emit('delete-save', save)" class="text-error">
                  <template v-slot:prepend><v-icon size="small" color="error">mdi-delete</v-icon></template>
                  <v-list-item-title>删除存档</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </template>
        </v-list-item>
      </v-list>
    </v-card-text>
    
    <v-card-actions class="px-4 pb-4">
      <v-btn
        color="primary"
        variant="elevated"
        prepend-icon="mdi-plus"
        :disabled="saves.length >= maxSaves"
        @click="$emit('new-save')"
        block
      >
        新建存档
      </v-btn>
    </v-card-actions>
    
    <v-alert
      v-if="saves.length >= maxSaves"
      type="warning"
      variant="tonal"
      density="compact"
      class="mx-4 mb-4"
    >
      存档已达上限，请删除旧存档后再创建
    </v-alert>
  </v-card>
</template>

<script>
export default {
  name: 'SaveManager',
  props: {
    saves: { type: Array, default: () => [] },
    maxSaves: { type: Number, default: 10 },
    loading: { type: Boolean, default: false },
    currentSaveId: { type: String, default: null }
  },
  emits: ['select-save', 'continue-save', 'restart-save', 'view-report', 'delete-save', 'new-save'],
  setup() {
    function getRelationColor(index) {
      if (index >= 70) return 'success'
      if (index >= 40) return 'warning'
      return 'error'
    }
    
    function formatTime(isoString) {
      if (!isoString) return '-'
      const date = new Date(isoString)
      const now = new Date()
      const diff = now - date
      
      if (diff < 60000) return '刚刚'
      if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
      if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
      
      return date.toLocaleDateString('zh-CN')
    }
    
    return { getRelationColor, formatTime }
  }
}
</script>

<style scoped>
.save-manager {
  border-radius: 12px;
}
.save-item {
  border: 1px solid rgba(0,0,0,0.08);
  transition: all 0.2s;
}
.save-item:hover {
  background: rgba(var(--v-theme-primary), 0.05);
  border-color: rgba(var(--v-theme-primary), 0.3);
}
.save-item-active {
  background: rgba(var(--v-theme-primary), 0.1);
  border-color: rgba(var(--v-theme-primary), 0.5);
}
</style>
