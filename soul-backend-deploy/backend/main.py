from __future__ import annotations
from typing import Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.models.types import (
	SuggestRequest, SuggestResponse,
	MBTISubmitRequest, MBTISubmitResponse,
	MBTIInferRequest, MBTIInferResponse,
	PersonaState,
	PeerReplyRequest, PeerReplyResponse,
	ScenarioInput, ScenarioContext
)
from backend.models.user_types import (
	LoginRequest, LoginResponse, UserInfoResponse
)
from backend.services.suggest_service import handle_suggest
from backend.services.persona_service import compute_mbti_submit
from backend.clients.llm_client import infer_mbti_from_chat
from backend.services.memory_service import get_persona_state, apply_persona_state
from backend.services.peer_service import generate_peer_reply
from backend.services.scenario_service import analyze_scenario
from backend.services.user_service import login_or_register, get_user_info, validate_nickname
from backend.clients.soul_cos_client import init_soul_cos_client

app = FastAPI(title="Soul-Agent Demo", version="0.2.0")

# 初始化 COS 客户端
soul_cos_client = None

@app.on_event("startup")
async def startup_event():
	"""应用启动时初始化 COS 客户端"""
	global soul_cos_client
	soul_cos_client = init_soul_cos_client()
	if soul_cos_client:
		print("✅ Soul COS 客户端初始化成功")
	else:
		print("⚠️ Soul COS 客户端未启用或初始化失败")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

# API
@app.post("/api/suggest", response_model=SuggestResponse)
def api_suggest(req: SuggestRequest):
	return handle_suggest(req)


@app.post("/api/mbti/submit", response_model=MBTISubmitResponse)
def api_mbti_submit(req: MBTISubmitRequest):
	return compute_mbti_submit(req)


@app.post("/api/mbti/infer-from-chat", response_model=MBTIInferResponse)
def api_mbti_infer_from_chat(req: MBTIInferRequest):
	data = infer_mbti_from_chat([t.model_dump() for t in req.conversation])
	return MBTIInferResponse(
		mbtiGuess=data.get("mbti") or "",
		confidence=float(data.get("confidence", 0.0)),
		functionsGuess=data.get("functions") or {},
		notes=data.get("notes") or "",
	)


@app.get("/api/persona", response_model=PersonaState)
def api_get_persona():
	return get_persona_state()


@app.post("/api/persona/apply", response_model=PersonaState)
def api_apply_persona(state: PersonaState):
	return apply_persona_state(state.mbti, state.functions, state.enabled)

@app.post("/api/peer/reply", response_model=PeerReplyResponse)
def api_peer_reply(req: PeerReplyRequest):
	return generate_peer_reply(req)


# 场景分析
@app.post("/api/scenario/analyze", response_model=ScenarioContext)
def api_scenario_analyze(req: ScenarioInput):
	return analyze_scenario(req)


# ============================================
# 用户 API
# ============================================

@app.post("/api/user/login", response_model=LoginResponse)
def api_user_login(req: LoginRequest):
	"""
	用户登录或注册
	
	- 昵称存在：返回 status="login"
	- 昵称不存在：创建新用户，返回 status="register"
	"""
	try:
		return login_or_register(req.nickname)
	except ValueError as e:
		raise HTTPException(status_code=400, detail=str(e))
	except RuntimeError as e:
		raise HTTPException(status_code=503, detail=str(e))


@app.get("/api/user/{nickname}", response_model=UserInfoResponse)
def api_get_user(nickname: str):
	"""获取用户信息"""
	# 验证昵称格式
	is_valid, error = validate_nickname(nickname)
	if not is_valid:
		raise HTTPException(status_code=400, detail=error)
	
	user = get_user_info(nickname)
	if user is None:
		raise HTTPException(status_code=404, detail="用户不存在")
	
	return UserInfoResponse(
		nickname=user.nickname,
		created_at=user.created_at,
		last_login_at=user.last_login_at,
		save_count=user.save_count
	)


@app.get("/api/user/{nickname}/exists")
def api_user_exists(nickname: str):
	"""检查用户是否存在"""
	is_valid, error = validate_nickname(nickname)
	if not is_valid:
		raise HTTPException(status_code=400, detail=error)
	
	from backend.services.user_service import user_exists
	exists = user_exists(nickname)
	return {"exists": exists, "nickname": nickname}


# ============================================
# 存档 API
# ============================================

from backend.models.save_types import (
	CreateSaveRequest, UpdateSaveRequest, RestartSaveRequest,
	SaveListResponse, SaveDetailResponse, Save
)
from backend.services.save_service import (
	list_saves, create_save, get_save, update_save, delete_save, restart_save,
	MAX_SAVES_PER_USER
)


@app.get("/api/user/{nickname}/saves", response_model=SaveListResponse)
def api_list_saves(nickname: str):
	"""获取用户的存档列表"""
	is_valid, error = validate_nickname(nickname)
	if not is_valid:
		raise HTTPException(status_code=400, detail=error)
	
	saves = list_saves(nickname)
	return SaveListResponse(
		saves=saves,
		count=len(saves),
		max_saves=MAX_SAVES_PER_USER
	)


@app.post("/api/user/{nickname}/saves", response_model=Save)
def api_create_save(nickname: str, req: CreateSaveRequest):
	"""创建新存档"""
	is_valid, error = validate_nickname(nickname)
	if not is_valid:
		raise HTTPException(status_code=400, detail=error)
	
	try:
		return create_save(nickname, req)
	except ValueError as e:
		raise HTTPException(status_code=400, detail=str(e))
	except RuntimeError as e:
		raise HTTPException(status_code=503, detail=str(e))


@app.get("/api/user/{nickname}/saves/{save_id}", response_model=Save)
def api_get_save(nickname: str, save_id: str):
	"""获取存档详情"""
	is_valid, error = validate_nickname(nickname)
	if not is_valid:
		raise HTTPException(status_code=400, detail=error)
	
	save = get_save(nickname, save_id)
	if save is None:
		raise HTTPException(status_code=404, detail="存档不存在")
	
	return save


@app.put("/api/user/{nickname}/saves/{save_id}", response_model=Save)
def api_update_save(nickname: str, save_id: str, req: UpdateSaveRequest):
	"""更新存档"""
	is_valid, error = validate_nickname(nickname)
	if not is_valid:
		raise HTTPException(status_code=400, detail=error)
	
	save = update_save(nickname, save_id, req)
	if save is None:
		raise HTTPException(status_code=404, detail="存档不存在")
	
	return save


@app.post("/api/user/{nickname}/saves/{save_id}/sync")
def api_sync_save(nickname: str, save_id: str, req: UpdateSaveRequest):
	"""同步保存存档（用于 sendBeacon，支持 POST）"""
	is_valid, error = validate_nickname(nickname)
	if not is_valid:
		raise HTTPException(status_code=400, detail=error)
	
	save = update_save(nickname, save_id, req)
	if save is None:
		raise HTTPException(status_code=404, detail="存档不存在")
	
	return {"success": True}


@app.delete("/api/user/{nickname}/saves/{save_id}")
def api_delete_save(nickname: str, save_id: str):
	"""删除存档"""
	is_valid, error = validate_nickname(nickname)
	if not is_valid:
		raise HTTPException(status_code=400, detail=error)
	
	success = delete_save(nickname, save_id)
	if not success:
		raise HTTPException(status_code=404, detail="存档不存在或删除失败")
	
	return {"success": True, "message": "存档已删除"}


@app.post("/api/user/{nickname}/saves/{save_id}/restart", response_model=Save)
def api_restart_save(nickname: str, save_id: str, req: RestartSaveRequest):
	"""重新开始存档"""
	is_valid, error = validate_nickname(nickname)
	if not is_valid:
		raise HTTPException(status_code=400, detail=error)
	
	save = restart_save(nickname, save_id, req)
	if save is None:
		raise HTTPException(status_code=404, detail="存档不存在")
	
	return save


# ============================================
# 报告 API
# ============================================

from backend.models.save_types import Report
from backend.services.report_service import generate_report, get_session_report


@app.post("/api/user/{nickname}/saves/{save_id}/report", response_model=Report)
def api_generate_report(nickname: str, save_id: str):
	"""
	生成学习报告
	
	为当前会话生成学习报告，包含亮点、改进建议和总体评价
	"""
	is_valid, error = validate_nickname(nickname)
	if not is_valid:
		raise HTTPException(status_code=400, detail=error)
	
	try:
		report = generate_report(nickname, save_id)
		if report is None:
			raise HTTPException(status_code=404, detail="存档不存在")
		return report
	except ValueError as e:
		raise HTTPException(status_code=400, detail=str(e))
	except Exception as e:
		raise HTTPException(status_code=503, detail=f"报告生成失败: {str(e)}")


@app.get("/api/user/{nickname}/saves/{save_id}/sessions/{session_index}/report", response_model=Report)
def api_get_session_report(nickname: str, save_id: str, session_index: int):
	"""获取指定会话的报告"""
	is_valid, error = validate_nickname(nickname)
	if not is_valid:
		raise HTTPException(status_code=400, detail=error)
	
	report = get_session_report(nickname, save_id, session_index)
	if report is None:
		raise HTTPException(status_code=404, detail="报告不存在")
	
	return report


# ============================================
# 进度 API
# ============================================

from backend.models.progress_types import Progress, ProgressResponse
from backend.services.progress_service import get_progress


@app.get("/api/user/{nickname}/progress", response_model=Progress)
def api_get_progress(nickname: str):
	"""
	获取用户的学习进度
	
	包含总会话数、总对话轮数、平均关系增益、场景统计等
	"""
	is_valid, error = validate_nickname(nickname)
	if not is_valid:
		raise HTTPException(status_code=400, detail=error)
	
	progress = get_progress(nickname)
	if progress is None:
		raise HTTPException(status_code=503, detail="无法获取进度数据")
	
	return progress


# 静态资源（前端）- 前端独立部署，不需要挂载
# app.mount("/", StaticFiles(directory="frontend", html=True), name="static")


