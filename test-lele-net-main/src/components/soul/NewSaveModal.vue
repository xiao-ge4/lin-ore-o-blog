<template>
  <v-dialog v-model="show" max-width="400">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon color="primary" class="mr-2">mdi-plus-circle</v-icon>
        创建新存档
      </v-card-title>
      
      <v-card-text>
        <v-form ref="form" v-model="valid">
          <v-text-field
            v-model="saveName"
            label="存档名称"
            :rules="nameRules"
            variant="outlined"
            counter="50"
            maxlength="50"
            prepend-inner-icon="mdi-tag"
            autofocus
            @keyup.enter="handleCreate"
          />
          
          <div class="text-caption text-grey mt-2">
            <v-icon size="14">mdi-information-outline</v-icon>
            创建后可在聊天界面配置场景和角色
          </div>
        </v-form>
      </v-card-text>
      
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="show = false">取消</v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          :loading="loading"
          :disabled="!valid || !saveName.trim()"
          @click="handleCreate"
        >
          创建存档
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { ref, computed, watch } from 'vue'

export default {
  name: 'NewSaveModal',
  props: {
    modelValue: { type: Boolean, default: false },
    loading: { type: Boolean, default: false }
  },
  emits: ['update:modelValue', 'create'],
  setup(props, { emit }) {
    const show = computed({
      get: () => props.modelValue,
      set: (val) => emit('update:modelValue', val)
    })
    
    const form = ref(null)
    const valid = ref(false)
    const saveName = ref('')
    
    const nameRules = [
      v => !!v?.trim() || '请输入存档名称',
      v => (v && v.length <= 50) || '名称不能超过50个字符'
    ]
    
    // 重置表单
    watch(show, (val) => {
      if (val) {
        saveName.value = ''
      }
    })
    
    function handleCreate() {
      if (!valid.value || !saveName.value.trim()) return
      
      emit('create', {
        name: saveName.value.trim(),
        scenario_config: {
          scenario: '',
          opponent: { roleTitle: '', traits: [] },
          userGoal: { goal: '', reason: '' },
          difficulty: 'realistic'
        }
      })
    }
    
    return {
      show, form, valid, saveName,
      nameRules, handleCreate
    }
  }
}
</script>
