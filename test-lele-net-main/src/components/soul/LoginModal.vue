<template>
  <v-dialog v-model="show" persistent max-width="400">
    <v-card class="login-card">
      <v-card-title class="text-h5 text-center py-4">
        <v-icon size="32" color="primary" class="mr-2">mdi-account-circle</v-icon>
        欢迎使用 Soul TalkBuddy
      </v-card-title>
      
      <v-card-text>
        <v-form ref="form" v-model="valid" @submit.prevent="handleLogin">
          <v-text-field
            v-model="nickname"
            label="请输入昵称"
            :rules="nicknameRules"
            :error-messages="errorMessage"
            variant="outlined"
            prepend-inner-icon="mdi-account"
            counter="6"
            maxlength="6"
            autofocus
            @keyup.enter="handleLogin"
          />
          
          <div class="text-caption text-grey mt-2">
            <v-icon size="14">mdi-information-outline</v-icon>
            昵称仅支持中文或英文字符，1-6个字符
          </div>
        </v-form>
      </v-card-text>
      
      <v-card-actions class="px-6 pb-4">
        <v-spacer />
        <v-btn
          color="primary"
          size="large"
          :loading="loading"
          :disabled="!valid || !nickname"
          @click="handleLogin"
          block
        >
          {{ loading ? '登录中...' : '开始使用' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { ref, computed, watch } from 'vue'

export default {
  name: 'LoginModal',
  props: {
    modelValue: { type: Boolean, default: false },
    apiBase: { type: String, default: '' }
  },
  emits: ['update:modelValue', 'login-success'],
  setup(props, { emit }) {
    const show = computed({
      get: () => props.modelValue,
      set: (val) => emit('update:modelValue', val)
    })
    
    const nickname = ref('')
    const valid = ref(false)
    const loading = ref(false)
    const errorMessage = ref('')
    const form = ref(null)
    
    // 昵称验证规则：1-6个字符，仅中文或英文
    const nicknameRules = [
      v => !!v || '请输入昵称',
      v => (v && v.length >= 1 && v.length <= 6) || '昵称长度为1-6个字符',
      v => /^[a-zA-Z\u4e00-\u9fa5]+$/.test(v) || '昵称仅支持中文或英文字符'
    ]
    
    // 清除错误信息
    watch(nickname, () => {
      errorMessage.value = ''
    })
    
    async function handleLogin() {
      if (!valid.value || !nickname.value) return
      
      loading.value = true
      errorMessage.value = ''
      
      try {
        const response = await fetch(`${props.apiBase}/api/user/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nickname: nickname.value })
        })
        
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.detail || '登录失败')
        }
        
        const data = await response.json()
        
        // 保存到 localStorage
        localStorage.setItem('soul_nickname', nickname.value)
        
        // 触发成功事件
        emit('login-success', {
          nickname: nickname.value,
          status: data.status,
          message: data.message
        })
        
        show.value = false
      } catch (err) {
        errorMessage.value = err.message || '登录失败，请稍后重试'
      } finally {
        loading.value = false
      }
    }
    
    return {
      show,
      nickname,
      valid,
      loading,
      errorMessage,
      form,
      nicknameRules,
      handleLogin
    }
  }
}
</script>

<style scoped>
.login-card {
  border-radius: 16px !important;
  background: white !important;
}
.login-card .v-card-title {
  color: #333 !important;
}
.login-card .text-caption {
  color: #666 !important;
}
</style>
