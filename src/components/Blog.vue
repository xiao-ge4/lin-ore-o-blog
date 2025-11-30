<template>
  <div>
    <h1>我的博客</h1>
    <div v-for="post in posts" :key="post.id" class="blog-post">
      <h2>{{ post.title }}</h2>
      <img v-if="post.img" :src="post.img" style="max-width:300px;">
      <p>{{ post.content }}</p>
    </div>
  </div>
</template>

<script setup>
const posts = [
  { id: 1, title: '第一篇文章', img: '/img/blog1.jpg', content: '这里是内容...' },
  { id: 2, title: '第二篇文章', img: '/img/blog2.jpg', content: '更多内容...' }
]
</script>

<style scoped>
.blog-post {
  margin-bottom: 20px;
}
</style> 