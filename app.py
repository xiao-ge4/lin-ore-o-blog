import os

# 复用我们在 deploy/gradio_app.py 中定义的 Gradio Blocks 实例
from gradio_app import demo as gradio_demo

# 有的托管平台直接查找变量名为 app 的对象；因此兼容暴露一个同名引用
app = gradio_demo

if __name__ == "__main__":
	# 本地/平台通用启动
	port = int(os.getenv("PORT", "7860"))
	# 使用队列避免并发时阻塞，监听 0.0.0.0 以对外暴露
	gradio_demo.queue().launch(server_name="0.0.0.0", server_port=port)


