import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  // 不需要在这里配置路由，因为App.vue直接处理条件渲染
  // 但是需要定义路由让vue-router识别路径
  { path: '/', name: 'home' },
  { path: '/soul-talkbuddy', name: 'soul-talkbuddy' },
  { path: '/podcast', name: 'podcast' },
  { path: '/blog', name: 'blog' },
  { path: '/blog/:id', name: 'blog-detail' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
