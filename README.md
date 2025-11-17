---	# Echo 共情对话教练（交个朋友｜社交智能体） Demo
# 详细文档见https://modelscope.cn/docs/%E5%88%9B%E7%A9%BA%E9%97%B4%E5%8D%A1%E7%89%87	 
domain: #领域：cv/nlp/audio/multi-modal/AutoML	基于 FastAPI + ModelScope(Qwen/Qwen3-8B) 的演示项目：始终提示 + 三条候选卡片 + MBTI/荣格八维测评与会话推断。
# - cv	 
tags: #自定义标签	## 目录结构
-	 
datasets: #关联数据集	```
  evaluation:	backend/
  #- iic/ICDAR13_HCTR_Dataset	  main.py
  test:	  requirements.txt
  #- iic/MTWI	  config/
  train:	    config.py
  #- iic/SIBR	    modelscope_token.txt   # 存放 ModelScope Token（已放置）
models: #关联模型	  clients/
#- iic/ofa_ocr-recognition_general_base_zh	    llm_client.py
 	  models/
## 启动文件(若SDK为Gradio/Streamlit，默认为app.py, 若为Static HTML, 默认为index.html)	    types.py
# deployspec:	  services/
#   entry_file: app.py	    suggest_service.py
license: Apache License 2.0	    persona_service.py
---	    safety_service.py
#### Clone with HTTP	    memory_service.py
