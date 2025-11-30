<template>
  <div>
    <v-btn @click="$router.back()" class="mb-4">返回</v-btn>
    <div v-if="post">
      <h1>{{ post.title }}</h1>
      <v-img v-if="post.img" :src="post.img" height="220px" cover class="mb-4"></v-img>
      <div style="white-space: pre-line;">{{ post.content }}</div>
    </div>
    <div v-else>
      <p>未找到该文章</p>
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
const route = useRoute()
const posts = [
  { id: 1, title: '第一篇文章：Vue3 + Vite 入门体验', img: '/img/blog1.jpg', content: '这是第一篇文章的内容。\n\nVue3 + Vite 的开发体验非常棒，热更新快，配置简单。\n\n欢迎关注我的博客！' },
  { id: 2, title: '第二篇文章：我的前端成长之路', img: '/img/blog2.jpg', content: '这是第二篇文章的内容。\n\n从 jQuery 到 Vue，再到现代前端工程化，收获很多。\n\n持续学习，持续成长！' }
]
const post = posts.find(p => p.id === Number(route.params.id))
</script> 