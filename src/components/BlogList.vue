<template>
  <div>
    <h1>我的博客</h1>
    <v-row>
      <v-col cols="12" md="6" v-for="post in posts" :key="post.id">
        <v-card class="mb-4" @click="goDetail(post.id)" style="cursor:pointer;">
          <v-card-title>{{ post.title }}</v-card-title>
          <v-img v-if="post.img" :src="post.img" height="180px" cover></v-img>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
const posts = [
  { id: 1, title: '第一篇文章：Vue3 + Vite 入门体验', img: '/img/blog1.jpg' },
  { id: 2, title: '第二篇文章：我的前端成长之路', img: '/img/blog2.jpg' }
]
function goDetail(id) {
  router.push(`/blog/${id}`)
}
</script> 