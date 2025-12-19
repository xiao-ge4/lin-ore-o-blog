<template>
  <v-dialog v-model="show" max-width="450">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon color="warning" class="mr-2">mdi-restart</v-icon>
        重新开始对话
      </v-card-title>
      
      <v-card-text>
        <p class="mb-4">确定要重新开始「{{ saveName }}」吗？</p>
        
        <v-radio-group v-model="preserveHistory" hide-details>
          <v-radio :value="true" color="primary">
            <template v-slot:label>
              <div>
                <div class="font-weight-medium">保留历史记录</div>
                <div class="text-caption text-grey">当前对话将归档，可在历史中查看</div>
              </div>
            </template>
          </v-radio>
          <v-radio :value="false" color="warning" class="mt-2">
            <template v-slot:label>
              <div>
                <div class="font-weight-medium">不保留历史</div>
                <div class="text-caption text-grey">当前对话将被清空，无法恢复</div>
              </div>
            </template>
          </v-radio>
        </v-radio-group>
        
        <v-alert
          v-if="!preserveHistory"
          type="warning"
          variant="tonal"
          density="compact"
          class="mt-4"
        >
          当前对话内容将被永久删除
        </v-alert>
      </v-card-text>
      
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="show = false">取消</v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          :loading="loading"
          @click="handleConfirm"
        >
          确认重新开始
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { ref, computed } from 'vue'

export default {
  name: 'RestartConfirmModal',
  props: {
    modelValue: { type: Boolean, default: false },
    saveName: { type: String, default: '' },
    loading: { type: Boolean, default: false }
  },
  emits: ['update:modelValue', 'confirm'],
  setup(props, { emit }) {
    const show = computed({
      get: () => props.modelValue,
      set: (val) => emit('update:modelValue', val)
    })
    
    const preserveHistory = ref(true)
    
    function handleConfirm() {
      emit('confirm', { preserveHistory: preserveHistory.value })
    }
    
    return { show, preserveHistory, handleConfirm }
  }
}
</script>
