// ===== D.LAB MMS 프론트엔드 (vanilla SPA) =====
const S = {
  token: localStorage.getItem("mms_token") || null,
  user: JSON.parse(localStorage.getItem("mms_user") || "null"),
  view: "market",
  selectedId: null,
};

// ---- API ----
async function api(path, { method = "GET", body, form } = {}) {
  const headers = {};
  if (S.token) headers.Authorization = "Bearer " + S.token;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const res = await fetch("/api" + path, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "요청 실패");
  return data;
}

// ---- utils ----
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const won = (n) => new Intl.NumberFormat("ko-KR").format(Math.round(n)) + "원";
const GRADE = { Draft:["초안",""], Review:["검토중","blue"], Revision:["보완요청","yellow"], Rejected:["반려","red"], Verified:["승인","green"], Popular:["인기","violet"], Signature:["대표","orange"] };
const PUBLIC = ["Verified","Popular","Signature"];
const isPublic = (s) => PUBLIC.includes(s);
function gradeTag(s){ const g = GRADE[s] || [s,""]; return `<span class="tag ${g[1]}">${s} · ${g[0]}</span>`; }
function toast(msg, err){ const t=document.getElementById("toast"); t.textContent=msg; t.className="toast show"+(err?" err":""); clearTimeout(window._t); window._t=setTimeout(()=>t.className="toast",2600); }
const ROLE_LABEL = { creator:"콘텐츠 제작자", campus_director:"캠퍼스장", hq_reviewer:"본사 검수자", hq_admin:"본사 관리자" };

// ---- nav by role ----
function navFor(role){
  const market = ["market","🛒 콘텐츠 마켓"];
  if(role==="creator") return [market,["register","➕ 콘텐츠 등록"],["mine","📦 내가 만든 콘텐츠"],["lessons","🎙️ 수업 기록·AI"]];
  if(role==="campus_director") return [market,["kiosk","📲 출석 키오스크"],["usage","📝 수업 사용 등록"],["payments","💳 결제 관리"],["settlement","📃 정산 내역"]];
  return [market,["review","🔎 본사 검수"],["settlement","📃 정산 내역"],["notifications","🔔 알림톡 로그"],["curriculum","📚 커리큘럼"]]; // hq
}

// ===== render root =====
function render(){
  const app = document.getElementById("app");
  if(!S.user){ renderLogin(app); return; }
  const nav = navFor(S.user.role);
  if(!nav.some(n=>n[0]===S.view)) S.view = "market";
  app.innerHTML = `
    <div class="shell">
      <aside class="rail">
        <div class="brand"><div class="brand-mark">D</div><div><div class="brand-title">D.LAB MMS</div><div class="brand-sub">콘텐츠 마켓</div></div></div>
        <div class="who"><div class="n">${esc(S.user.name)}</div><div class="r">${ROLE_LABEL[S.user.role]||S.user.role}${S.user.campusName?" · "+esc(S.user.campusName):""}</div></div>
        <nav>${nav.map(([id,label])=>`<button class="nav-btn ${S.view===id?"active":""}" data-nav="${id}"><span>${label}</span></button>`).join("")}</nav>
        <button class="logout" data-logout>로그아웃</button>
      </aside>
      <main class="main">
        <div class="topbar"><div><h1 class="page-title" id="pt"></h1><p class="page-copy" id="pc"></p></div></div>
        <div class="content" id="view"></div>
      </main>
    </div>`;
  app.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>{S.view=b.dataset.nav;S.selectedId=null;render();});
  app.querySelector("[data-logout]").onclick=logout;
  renderView();
}

function setTitle(t,c){ document.getElementById("pt").textContent=t; document.getElementById("pc").textContent=c||""; }
function logout(){ S.token=null;S.user=null; localStorage.removeItem("mms_token");localStorage.removeItem("mms_user"); render(); }

// ===== login =====
async function renderLogin(app){
  app.innerHTML = `<div class="login-wrap"><div class="login-card">
    <div class="logo"><div class="logo-mark">D</div><div class="logo-text">D.LAB MMS</div></div>
    <div class="login-sub">콘텐츠 마켓 — Verified 콘텐츠만 유통되는 교육 콘텐츠 플랫폼</div>
    <label class="fld"><span class="lab">아이디</span><input class="input" id="u" placeholder="soojin"></label>
    <label class="fld"><span class="lab">비밀번호</span><input class="input" id="p" type="password" placeholder="1234"></label>
    <button class="btn primary" id="login" style="width:100%">로그인</button>
    <div class="demo-accounts"><div class="t">데모 계정 (비밀번호 1234) — 클릭하면 자동 입력</div><div class="demo-grid" id="demo"></div></div>
  </div></div>`;
  const doLogin = async (username,password)=>{
    try{ const r = await api("/auth/login",{method:"POST",body:{username,password}});
      S.token=r.token; S.user=r.user; localStorage.setItem("mms_token",r.token); localStorage.setItem("mms_user",JSON.stringify(r.user));
      S.view="market"; render(); toast(`${r.user.name}님 환영합니다`);
    }catch(e){ toast(e.message,true); }
  };
  document.getElementById("login").onclick=()=>doLogin(document.getElementById("u").value.trim(),document.getElementById("p").value);
  document.getElementById("p").addEventListener("keydown",e=>{if(e.key==="Enter")document.getElementById("login").click();});
  try{
    const accs = await api("/auth/demo-accounts");
    document.getElementById("demo").innerHTML = accs.map(a=>`<button class="demo-chip" data-u="${a.username}">${esc(a.name)} · ${ROLE_LABEL[a.role]||a.role}</button>`).join("");
    document.querySelectorAll(".demo-chip").forEach(c=>c.onclick=()=>{document.getElementById("u").value=c.dataset.u;document.getElementById("p").value="1234";doLogin(c.dataset.u,"1234");});
  }catch{}
}

// ===== views =====
async function renderView(){
  const el = document.getElementById("view");
  el.innerHTML = `<div style="color:var(--muted);padding:20px">불러오는 중…</div>`;
  try{
    if(S.view==="market") return await viewMarket(el);
    if(S.view==="detail") return await viewDetail(el);
    if(S.view==="register") return await viewRegister(el);
    if(S.view==="mine") return await viewMine(el);
    if(S.view==="review") return await viewReview(el);
    if(S.view==="usage") return await viewUsage(el);
    if(S.view==="settlement") return await viewSettlement(el);
    if(S.view==="kiosk") return await viewKiosk(el);
    if(S.view==="payments") return await viewPayments(el);
    if(S.view==="lessons") return await viewLessons(el);
    if(S.view==="notifications") return await viewNotifications(el);
    if(S.view==="curriculum") return await viewCurriculum(el);
  }catch(e){ el.innerHTML=`<div class="notice" style="background:rgba(255,69,58,.12);border-color:rgba(255,69,58,.28)">오류: ${esc(e.message)}</div>`; }
}

function go(view,id){ S.view=view; if(id!==undefined)S.selectedId=id; render(); }
window.__go = go;

// --- 콘텐츠 마켓 ---
async function viewMarket(el){
  setTitle("콘텐츠 마켓","Verified 이상은 구매·도입 가능 · 검수 단계는 열람만");
  const list = await api("/contents?scope=listed");
  el.innerHTML = `
    <div class="notice">✅ <b>Verified 이상</b>은 구매·도입할 수 있고, 검수 단계(Draft·검토중·보완요청)는 <b>열람만</b> 가능합니다.</div>
    <div class="cards">${list.sort((a,b)=>(isPublic(b.status)?1:0)-(isPublic(a.status)?1:0)).map(c=>`
      <div class="ccard ${isPublic(c.status)?"":"locked"}" data-id="${c.id}">
        <div class="thumb" style="${isPublic(c.status)?"":"filter:grayscale(.5)"}">📚<div class="badge">${gradeTag(c.status)}</div>${isPublic(c.status)?"":'<div class="lock"><span class="tag red">🔒 구매 불가</span></div>'}</div>
        <div class="body">
          <div class="ttl">${esc(c.title)}</div>
          <div class="meta">${esc(c.gradeLevel)} · 난이도 ${esc(c.difficulty)}</div>
          ${isPublic(c.status)
            ? `<div class="price">학생당 ${won(c.pricePerStudent)}</div><div class="meta">⭐ ${c.rating||"-"} · ${c.totalStudents}명 · ${c.campusCount}캠퍼스</div>`
            : `<div class="meta" style="margin-top:8px">검수 단계 · 구매·사용 불가</div>`}
          <div class="meta">${esc(c.creator?.name||"")}${c.campusName?" · "+esc(c.campusName):""}</div>
        </div>
      </div>`).join("")}</div>`;
  el.querySelectorAll(".ccard").forEach(card=>card.onclick=()=>go("detail",card.dataset.id));
}

// --- 콘텐츠 상세 ---
async function viewDetail(el){
  const c = await api("/contents/"+S.selectedId);
  setTitle("콘텐츠 상세");
  const pub = c.isPublic;
  const me = S.user;
  const mine = c.creator && me.role==="creator" && c.creator.id===me.id;
  const hq = me.role==="hq_reviewer"||me.role==="hq_admin";
  let actions = "";
  if(pub && (me.role==="campus_director")) actions += `<button class="btn primary" data-use>✅ 우리 캠퍼스에 도입 / 사용 등록</button>`;
  if(mine && (c.status==="Draft"||c.status==="Revision")) actions += `<button class="btn primary" data-submit>📤 검토 요청</button>`;
  if(hq && !pub) actions += `<button class="btn primary" data-rv="Verified">Verified 승인</button><button class="btn" data-rv="Revision">보완 요청</button><button class="btn red" data-rv="Rejected">반려</button>`;
  if(hq && c.status==="Verified") actions += `<button class="btn" data-rv="Popular">Popular 승격</button>`;
  if(hq && c.status==="Popular") actions += `<button class="btn" data-rv="Signature">Signature 지정</button>`;

  el.innerHTML = `
    <div class="breadcrumb"><a data-back>콘텐츠 마켓</a> › <strong>${esc(c.title)}</strong></div>
    <div class="grid cols-3">
      <div style="grid-column:span 2"><div class="panel">
        <div class="thumb" style="height:200px;font-size:60px">📚<div class="badge">${gradeTag(c.status)}</div></div>
        <div style="padding:20px">
          <h2 style="margin:0 0 8px;font-size:22px">${esc(c.title)}</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
            <span class="tag blue">${esc(c.gradeLevel)}</span><span class="tag">${esc(c.difficulty)}</span><span class="tag yellow">⭐ ${c.rating||"-"}</span><span class="tag">${c.totalStudents}명 수강</span><span class="tag">${c.campusCount}캠퍼스</span>
          </div>
          <p style="color:var(--ink-soft);line-height:1.7">${esc(c.description||c.summary)}</p>
          ${c.teacherGuide?`<div style="margin-top:10px;font-size:13px"><b>교사 가이드</b> · ${esc(c.teacherGuide)}</div>`:""}
          ${c.outcome?`<div style="margin-top:4px;font-size:13px"><b>최종 결과물</b> · ${esc(c.outcome)}</div>`:""}
          ${c.reviewNote?`<div class="notice" style="margin-top:12px;background:rgba(255,159,10,.12);border-color:rgba(255,159,10,.3)">검수 코멘트: ${esc(c.reviewNote)}</div>`:""}
          ${c.files.length?`<div style="margin-top:12px;font-size:13px;color:var(--muted)">📎 첨부 ${c.files.length}개: ${c.files.map(f=>esc(f.name)).join(", ")}</div>`:""}
          ${pub?"":`<div class="notice" style="margin-top:14px;background:rgba(255,69,58,.12);border-color:rgba(255,69,58,.28)">⚠️ ${GRADE[c.status][0]} 상태 — 본사 검수(Verified) 전이라 구매·사용할 수 없습니다.</div>`}
          <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">${actions||'<span style="color:var(--muted);font-size:13px">가능한 작업이 없습니다.</span>'}</div>
        </div>
      </div></div>
      <div><div class="panel pad">
        <div style="font-weight:800;margin-bottom:12px">정산 정보</div>
        ${[["제작자",c.creator?.name||"-"],["제작 캠퍼스",c.campusName||"-"],["학생당 단가",won(c.pricePerStudent)],["대상 학년",c.gradeLevel],["수강 학생",c.totalStudents+"명"],["사용 캠퍼스",c.campusCount+"곳"]].map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px"><span style="color:var(--muted)">${k}</span><span style="font-weight:700">${esc(v)}</span></div>`).join("")}
        <div style="margin-top:14px;font-weight:800;margin-bottom:6px">수익 분배 (1인당)</div>
        <div style="font-size:13px;display:flex;justify-content:space-between"><span>본사 운영비 (30%)</span><span style="font-weight:700">${won(c.pricePerStudent*0.3)}</span></div>
        <div style="font-size:13px;display:flex;justify-content:space-between"><span>제작자 (70%)</span><span style="font-weight:700;color:var(--green)">${won(c.pricePerStudent*0.7)}</span></div>
        <div style="margin-top:10px;font-size:12px;color:var(--muted);line-height:1.6">학생이 사용한 만큼 월말 자동 정산 · 본사 운영비 30% / 제작자 70%</div>
      </div></div>
    </div>`;
  el.querySelector("[data-back]").onclick=()=>go("market");
  el.querySelector("[data-use]")?.addEventListener("click",()=>go("usage"));
  el.querySelector("[data-submit]")?.addEventListener("click",async()=>{ try{ await api(`/contents/${c.id}/submit`,{method:"POST"}); toast("검토 요청 완료 — 본사 검수로 넘어갑니다."); renderView(); }catch(e){toast(e.message,true);} });
  el.querySelectorAll("[data-rv]").forEach(b=>b.onclick=async()=>{
    let note="";
    if(b.dataset.rv==="Revision"||b.dataset.rv==="Rejected"){ note=prompt(b.dataset.rv==="Revision"?"보완 요청 사유:":"반려 사유:")||""; }
    try{ await api(`/contents/${c.id}/review`,{method:"POST",body:{toStatus:b.dataset.rv,note}}); toast(`${b.dataset.rv} 처리되었습니다.`); renderView(); }catch(e){toast(e.message,true);}
  });
}

// --- 콘텐츠 등록 ---
async function viewRegister(el){
  setTitle("콘텐츠 등록","수업 패키지를 등록하면 Draft로 저장되고, 검토 요청 시 본사 검수로 넘어갑니다");
  el.innerHTML = `<div class="panel pad" style="max-width:680px">
    <div class="notice">📦 단순 파일이 아니라 다른 캠퍼스 강사가 바로 수업할 수 있는 <b>수업 패키지</b>로 등록하세요.</div>
    <div class="grid cols-2">
      <label class="fld"><span class="lab">수업명 *</span><input class="input" id="f-title" placeholder="예: 코딩 사고력"></label>
      <label class="fld"><span class="lab">학생 1인당 단가(원) *</span><input class="input" id="f-price" type="number" placeholder="15000"></label>
      <label class="fld"><span class="lab">대상 학년 *</span><select class="select" id="f-grade"><option>초등 1~2</option><option>초등 3~4</option><option>초등 5~6</option><option>중등</option></select></label>
      <label class="fld"><span class="lab">난이도 *</span><select class="select" id="f-diff"><option>입문</option><option>중급</option><option>고급</option></select></label>
    </div>
    <label class="fld"><span class="lab">한 줄 요약</span><input class="input" id="f-sum" placeholder="수업 핵심 요약"></label>
    <label class="fld"><span class="lab">수업 설명</span><textarea class="textarea" id="f-desc" placeholder="수업 목표·내용"></textarea></label>
    <div class="grid cols-2">
      <label class="fld"><span class="lab">교사용 가이드</span><textarea class="textarea" id="f-tg" placeholder="수업 흐름·교사 멘트"></textarea></label>
      <label class="fld"><span class="lab">학생용 자료</span><textarea class="textarea" id="f-sm" placeholder="활동지·미션지"></textarea></label>
      <label class="fld"><span class="lab">최종 결과물</span><input class="input" id="f-out" placeholder="학생 산출물"></label>
      <label class="fld"><span class="lab">평가 기준(루브릭)</span><input class="input" id="f-rub" placeholder="창의성·완성도 등"></label>
    </div>
    <label class="fld"><span class="lab">자료 첨부 (PPT/PDF 등)</span><input class="input" id="f-files" type="file" multiple></label>
    <div style="display:flex;gap:10px;margin-top:6px">
      <button class="btn primary" id="save">Draft 저장</button>
      <button class="btn" id="saveSubmit">저장 후 바로 검토 요청</button>
    </div>
  </div>`;
  const create = async ()=>{
    const body = {
      title:val("f-title"), pricePerStudent:val("f-price"), gradeLevel:val("f-grade"), difficulty:val("f-diff"),
      summary:val("f-sum"), description:val("f-desc"), teacherGuide:val("f-tg"), studentMaterial:val("f-sm"), outcome:val("f-out"), rubric:val("f-rub"),
    };
    if(!body.title||!body.pricePerStudent){ toast("수업명·단가는 필수입니다.",true); return null; }
    const c = await api("/contents",{method:"POST",body});
    const files = document.getElementById("f-files").files;
    if(files.length){ const fd=new FormData(); for(const f of files) fd.append("files",f); await api(`/contents/${c.id}/files`,{method:"POST",form:fd}); }
    return c;
  };
  document.getElementById("save").onclick=async()=>{ try{ const c=await create(); if(c){toast("Draft로 저장되었습니다."); go("mine");} }catch(e){toast(e.message,true);} };
  document.getElementById("saveSubmit").onclick=async()=>{ try{ const c=await create(); if(c){ await api(`/contents/${c.id}/submit`,{method:"POST"}); toast("저장 후 검토 요청 완료."); go("mine"); } }catch(e){toast(e.message,true);} };
}
const val = (id)=>document.getElementById(id).value.trim();

// --- 내가 만든 콘텐츠 ---
async function viewMine(el){
  setTitle("내가 만든 콘텐츠","Draft → 검토 요청 → 본사 승인(Verified) → 마켓 공개");
  const list = await api("/contents?scope=mine");
  const live = list.filter(c=>isPublic(c.status));
  const earn = live.reduce((a,c)=>a+c.pricePerStudent*c.totalStudents*0.7,0);
  el.innerHTML = `
    <div class="grid cols-3">
      ${metric("등록 콘텐츠",list.length+"개",`공개 ${live.length} · 검수단계 ${list.length-live.length}`)}
      ${metric("총 수강 학생",list.reduce((a,c)=>a+c.totalStudents,0)+"명","공개 콘텐츠 합산")}
      ${metric("이번 달 수익(70%)",won(earn),"사용량 기반")}
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><div><h2 class="panel-title">내 콘텐츠 상태</h2></div><button class="btn primary sm" id="new">+ 새 콘텐츠</button></div>
      <div class="table-wrap"><table><thead><tr><th>콘텐츠</th><th>등급</th><th>수강/캠퍼스</th><th>1인 단가</th><th>내 수익(70%)</th><th>관리</th></tr></thead>
      <tbody>${list.map(c=>`<tr>
        <td style="font-weight:700">${esc(c.title)}</td><td>${gradeTag(c.status)}</td><td>${c.totalStudents}명 / ${c.campusCount}곳</td><td>${won(c.pricePerStudent)}</td>
        <td style="color:var(--green);font-weight:700">${isPublic(c.status)?won(c.pricePerStudent*c.totalStudents*0.7):"-"}</td>
        <td>${(c.status==="Draft"||c.status==="Revision")?`<button class="btn sm primary" data-submit="${c.id}">검토 요청</button> `:""}<button class="btn sm" data-open="${c.id}">상세</button></td>
      </tr>`).join("")}</tbody></table></div>
    </div>`;
  document.getElementById("new").onclick=()=>go("register");
  el.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>go("detail",b.dataset.open));
  el.querySelectorAll("[data-submit]").forEach(b=>b.onclick=async()=>{ try{ await api(`/contents/${b.dataset.submit}/submit`,{method:"POST"}); toast("검토 요청 완료."); renderView(); }catch(e){toast(e.message,true);} });
}

// --- 본사 검수 ---
async function viewReview(el){
  setTitle("본사 검수","Verified 승인 전에는 다른 캠퍼스에 노출되지 않습니다");
  const pending = await api("/contents?scope=pending");
  const live = await api("/contents?scope=market");
  const checklist = ["수업 가능성","자료 완성도","디랩 적합성","학생 결과물","난이도 적합성","저작권 안정성"];
  const card = (c,isLive)=>`<div class="panel"><div class="panel-head"><div><h2 class="panel-title">${esc(c.title)}</h2><p class="panel-sub">${esc(c.gradeLevel)} · ${esc(c.difficulty)} · ${esc(c.creator?.name||"")}</p></div>${gradeTag(c.status)}</div>
    <div style="padding:14px">
      <div class="meta" style="color:var(--muted);font-size:13px">${esc(c.description||c.summary)}</div>
      <div style="margin-top:8px;font-size:12px;color:var(--muted)">학생당 ${won(c.pricePerStudent)} · 사용 ${c.totalStudents}명/${c.campusCount}캠퍼스</div>
      ${!isLive?`<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">${checklist.map(x=>`<label style="font-size:12px;color:var(--ink-soft);display:inline-flex;gap:4px;align-items:center"><input type="checkbox" checked>${x}</label>`).join("")}</div>
        <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm primary" data-rv="Verified" data-id="${c.id}">Verified 승인</button><button class="btn sm" data-rv="Revision" data-id="${c.id}">보완 요청</button><button class="btn sm red" data-rv="Rejected" data-id="${c.id}">반려</button></div>`
      :`<div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap"><span class="tag green">마켓 공개 중</span>${c.status==="Verified"?`<button class="btn sm" data-rv="Popular" data-id="${c.id}">Popular 승격</button>`:""}${c.status==="Popular"?`<button class="btn sm" data-rv="Signature" data-id="${c.id}">Signature 지정</button>`:""}</div>`}
    </div></div>`;
  el.innerHTML = `
    <div class="grid cols-3">
      ${metric("검수 대기",pending.length+"건","Draft·검토중·보완요청")}
      ${metric("마켓 공개",live.length+"건","Verified 이상")}
      ${metric("Signature",live.filter(c=>c.status==="Signature").length+"건","대표 콘텐츠")}
    </div>
    <div class="panel" style="margin-top:14px"><div class="panel-head"><div><h2 class="panel-title">검수 대기 (${pending.length})</h2></div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;padding:16px">${pending.length?pending.map(c=>card(c,false)).join(""):'<div style="color:var(--muted);padding:12px">대기 콘텐츠가 없습니다.</div>'}</div></div>
    <div class="panel" style="margin-top:14px"><div class="panel-head"><div><h2 class="panel-title">공개 콘텐츠 (${live.length})</h2><p class="panel-sub">사용량·만족도 기반 승격</p></div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;padding:16px">${live.map(c=>card(c,true)).join("")}</div></div>`;
  el.querySelectorAll("[data-rv]").forEach(b=>b.onclick=async()=>{
    let note=""; if(b.dataset.rv==="Revision"||b.dataset.rv==="Rejected") note=prompt("사유:")||"";
    try{ await api(`/contents/${b.dataset.id}/review`,{method:"POST",body:{toStatus:b.dataset.rv,note}}); toast(`${b.dataset.rv} 처리 완료.`); renderView(); }catch(e){toast(e.message,true);}
  });
}

// --- 수업 사용 등록 ---
async function viewUsage(el){
  setTitle("수업 사용 등록","실제 수강 학생 수를 입력하면 정산·등급 평가에 누적됩니다");
  const market = await api("/contents?scope=market");
  const campusId = S.user.campusId;
  const usages = campusId ? await api("/usage?campusId="+campusId) : [];
  const total = usages.reduce((a,u)=>a+u.charge,0);
  el.innerHTML = `<div class="grid cols-2">
    <div class="panel pad">
      <div style="font-weight:800;margin-bottom:14px">사용 등록</div>
      <label class="fld"><span class="lab">콘텐츠 (Verified 이상)</span><select class="select" id="u-content">${market.map(c=>`<option value="${c.id}">${esc(c.title)} · 학생당 ${won(c.pricePerStudent)}</option>`).join("")}</select></label>
      <div class="grid cols-2">
        <label class="fld"><span class="lab">반</span><input class="input" id="u-class" placeholder="알고리즘 A"></label>
        <label class="fld"><span class="lab">수업 날짜</span><input class="input" id="u-date" type="date" value="2026-05-30"></label>
        <label class="fld"><span class="lab">담당 강사</span><input class="input" id="u-teacher" placeholder="이수진"></label>
        <label class="fld"><span class="lab">실제 수강 학생 수 *</span><input class="input" id="u-count" type="number" placeholder="12"></label>
      </div>
      <label class="fld"><span class="lab">강사 후기 / 결과물 메모</span><textarea class="textarea" id="u-note" placeholder="운영 팁·학생 결과물"></textarea></label>
      <button class="btn primary" id="u-save">사용 등록</button>
    </div>
    <div class="panel"><div class="panel-head"><div><h2 class="panel-title">우리 캠퍼스 사용 기록</h2><p class="panel-sub">${esc(S.user.campusName||"")} · 누적 청구 ${won(total)}</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>콘텐츠</th><th>반</th><th>학생</th><th>청구</th></tr></thead>
      <tbody>${usages.length?usages.map(u=>`<tr><td style="font-weight:700">${esc(u.contentTitle)}</td><td>${esc(u.classroom||"-")}</td><td>${u.studentCount}명</td><td>${won(u.charge)}</td></tr>`).join(""):'<tr><td colspan="4" style="color:var(--muted)">아직 사용 기록이 없습니다.</td></tr>'}</tbody></table></div>
    </div></div>`;
  document.getElementById("u-save").onclick=async()=>{
    const body={contentId:document.getElementById("u-content").value,classroom:val("u-class"),teacher:val("u-teacher"),studentCount:document.getElementById("u-count").value,sessionDate:val("u-date"),note:val("u-note")};
    if(!body.studentCount){toast("수강 학생 수를 입력하세요.",true);return;}
    try{ await api("/usage",{method:"POST",body}); toast("사용 등록 완료 — 학생 수가 누적됩니다."); renderView(); }catch(e){toast(e.message,true);}
  };
}

// --- 정산 내역 ---
async function viewSettlement(el){
  setTitle("정산 내역","콘텐츠: 1인 단가×학생수 → 본사 운영비 30%/제작자 70% · 로열티: 교육매출 6%(별개)");
  const set = await api("/settlement");
  const byc = await api("/settlement/by-campus");
  el.innerHTML = `
    <div class="grid cols-3">
      ${metric("콘텐츠 총 사용료",won(set.summary.totalGross),"1인 단가 × 수강 학생")}
      ${metric("본사 운영비 (30%)",won(set.summary.hqOperating),"콘텐츠 정산 수익")}
      ${metric("제작자 정산 (70%)",won(set.summary.creatorPayout),"제작자 지급")}
    </div>
    <div class="panel" style="margin-top:14px"><div class="panel-head"><div><h2 class="panel-title">캠퍼스별 본사 납부 (로열티 6% + 콘텐츠)</h2><p class="panel-sub">로열티와 콘텐츠 사용료는 별개 항목</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>캠퍼스</th><th>교육 매출</th><th>로열티(6%)</th><th>콘텐츠 사용료</th><th>본사 납부 합계</th></tr></thead>
      <tbody>${byc.rows.map(r=>`<tr><td style="font-weight:700">${esc(r.campusName)}</td><td>${won(r.revenue)}</td><td style="color:var(--brand);font-weight:700">${won(r.royalty)}</td><td>${won(r.contentCost)}</td><td style="font-weight:800">${won(r.hqTotal)}</td></tr>`).join("")}</tbody></table></div>
    </div>
    <div class="panel" style="margin-top:14px"><div class="panel-head"><div><h2 class="panel-title">콘텐츠 × 캠퍼스 상세 정산</h2><p class="panel-sub">본사 운영비 30% / 제작자 70%</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>콘텐츠</th><th>제작자</th><th>캠퍼스</th><th>학생</th><th>사용료</th><th>본사 30%</th><th>제작자 70%</th></tr></thead>
      <tbody>${set.rows.map(r=>`<tr><td style="font-weight:700">${esc(r.contentTitle)}</td><td style="color:var(--muted);font-size:12px">${esc(r.creator)}</td><td>${esc(r.campusName)}</td><td>${r.students}명</td><td style="font-weight:700">${won(r.gross)}</td><td>${won(r.hqShare)}</td><td style="color:var(--green)">${won(r.creatorShare)}</td></tr>`).join("")}</tbody></table></div>
    </div>`;
}

function metric(l,v,n){ return `<div class="metric"><div class="l">${l}</div><div class="v">${v}</div><div class="n">${n||""}</div></div>`; }

// --- 출석 키오스크 ---
let kioskDigits = "";
async function viewKiosk(el){
  setTitle("출석 키오스크","전화번호 뒤 4자리로 출석 · 학부모 알림톡 자동 발송");
  kioskDigits=""; el.innerHTML = `<div id="k"></div>`; renderKiosk();
}
function renderKiosk(result, multi){
  const k=document.getElementById("k"); if(!k)return;
  if(result){
    const s=result.student;
    k.innerHTML = `<div style="max-width:680px;margin:0 auto;display:grid;gap:14px">
      <div class="hero"><div style="font-size:46px">🎉</div><div class="hi">${esc(s.name)}, 환영해요!</div><div class="sub">${result.checkinTime} 입실 · ${esc(s.className||"")} · Lv.${s.level} · ${s.rank}위</div>
        <div class="chips"><span class="chip">⭐ +${s.earned}P</span><span class="chip">🎮 ${s.points}P</span><span class="chip">🏆 ${s.rank}위</span></div></div>
      <div class="panel"><div class="panel-head"><div><h2 class="panel-title">🏆 포인트 랭킹</h2></div></div>${result.leaderboard.map((r,i)=>`<div class="lb"><div class="rk ${i===0?'g':''}">${i+1}</div><div class="nm">${esc(r.name)}${r.id===s.id?' (나)':''}</div><div class="pt">${r.points}P</div></div>`).join("")}</div>
      <div class="notice">📱 학부모님께 알림톡 발송: ${esc(result.notification.body.split("\n")[0])}</div>
      <button class="btn primary" data-again>다른 학생 출석</button>
    </div>`;
    k.querySelector("[data-again]").onclick=()=>{kioskDigits="";renderKiosk();};
    return;
  }
  const sideHtml = multi
    ? `<div class="panel"><div class="panel-head"><div><h2 class="panel-title">학생 선택</h2><p class="panel-sub">동일 번호 학생이 여러 명입니다</p></div></div>${multi.map(m=>`<div class="row"><div class="row-top"><div><div class="rt">${esc(m.name)}</div><div class="rc">${esc(m.className||"")}</div></div><button class="btn primary sm" data-pick="${m.id}">출석</button></div></div>`).join("")}</div>`
    : `<div class="panel pad" style="display:grid;place-items:center;text-align:center;min-height:200px"><div style="font-size:40px">👋</div><div style="font-weight:700;margin-top:8px">번호를 누르면 정보가 나와요</div><div class="rc" style="color:var(--muted);margin-top:6px">테스트: 1842 · 3074 · 9201 · 4456</div></div>`;
  k.innerHTML = `<div class="grid cols-2">
    <div class="panel pad" style="max-width:420px">
      <div style="text-align:center;margin-bottom:14px"><div style="font-size:30px">📲</div><div style="font-weight:750;font-size:18px">D.LAB 출석 체크</div><div style="color:var(--muted);font-size:13px">전화번호 뒤 4자리</div></div>
      <div class="kdisp">${(kioskDigits||"").padEnd(4,"·").split("").join(" ")}</div>
      <div class="kpad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button data-key="${n}">${n}</button>`).join("")}<button data-key="c" class="act">C</button><button data-key="0">0</button><button data-key="back" class="act">←</button></div>
    </div>
    <div>${sideHtml}</div>
  </div>`;
  k.querySelectorAll("[data-key]").forEach(b=>b.onclick=()=>press(b.dataset.key));
  k.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>checkinStudent(b.dataset.pick));
}
async function press(key){
  if(key==="c") kioskDigits="";
  else if(key==="back") kioskDigits=kioskDigits.slice(0,-1);
  else if(kioskDigits.length<4) kioskDigits+=key;
  if(kioskDigits.length===4){
    try{ const r=await api("/attendance/checkin",{method:"POST",body:{phoneLast4:kioskDigits,campusId:S.user.campusId}});
      if(r.multiple){ renderKiosk(null,r.students); } else { renderKiosk(r); }
    }catch(e){ toast(e.message,true); kioskDigits=""; renderKiosk(); }
  } else renderKiosk();
}
async function checkinStudent(id){ try{ const r=await api("/attendance/checkin/"+id,{method:"POST"}); renderKiosk(r); }catch(e){toast(e.message,true);} }

// --- 결제 관리 ---
async function viewPayments(el){
  setTitle("결제 관리","수강료·예치금 결제 (stub PG) · 수강료 결제 시 학부모 알림톡");
  const campusId=S.user.campusId;
  const data = await api("/payments?campusId="+campusId);
  const students = await api("/students?campusId="+campusId);
  el.innerHTML = `
    <div class="grid cols-3">
      ${metric("수납 완료",won(data.summary.완료),`${data.summary.count}건`)}
      ${metric("미납",won(data.summary.미납),"")}
      ${metric("건수",data.summary.count+"건","최근 100건")}
    </div>
    <div class="grid cols-2" style="margin-top:14px">
      <div class="panel pad"><div style="font-weight:800;margin-bottom:14px">새 결제 / 충전</div>
        <label class="fld"><span class="lab">유형</span><select class="select" id="p-type"><option value="tuition">수강료</option><option value="deposit">예치금 충전</option><option value="material">교재/재료비</option></select></label>
        <label class="fld"><span class="lab">학생(수강료 시)</span><select class="select" id="p-student"><option value="">— 없음 —</option>${students.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></label>
        <label class="fld"><span class="lab">금액(원)</span><input class="input" id="p-amount" type="number" placeholder="330000"></label>
        <label class="fld"><span class="lab">결제 수단</span><select class="select" id="p-method"><option>card</option><option>auto</option><option>vbank</option></select></label>
        <button class="btn primary" id="p-save">결제 처리</button>
      </div>
      <div class="panel"><div class="panel-head"><div><h2 class="panel-title">결제 내역</h2></div></div>
        <div class="table-wrap"><table><thead><tr><th>유형</th><th>학생</th><th>금액</th><th>수단</th><th>상태</th></tr></thead>
        <tbody>${data.rows.length?data.rows.map(p=>`<tr><td>${({tuition:"수강료",deposit:"예치금",content:"콘텐츠",material:"교재"})[p.type]||p.type}</td><td>${esc(p.studentName||"-")}</td><td>${won(p.amount)}</td><td>${esc(p.method)}</td><td><span class="tag ${p.status==="완료"?"green":p.status==="미납"?"red":""}">${p.status}</span></td></tr>`).join(""):'<tr><td colspan="5" style="color:var(--muted)">내역이 없습니다.</td></tr>'}</tbody></table></div>
      </div>
    </div>`;
  document.getElementById("p-save").onclick=async()=>{
    const body={campusId,type:document.getElementById("p-type").value,studentId:document.getElementById("p-student").value||undefined,amount:document.getElementById("p-amount").value,method:document.getElementById("p-method").value};
    if(!body.amount){toast("금액을 입력하세요.",true);return;}
    try{ await api("/payments",{method:"POST",body}); toast("결제 처리 완료."); renderView(); }catch(e){toast(e.message,true);}
  };
}

// --- 수업 기록 · AI ---
async function viewLessons(el){
  setTitle("수업 기록 · AI 요약","녹취 입력 → AI 요약 생성 → 학부모 리포트 발송");
  const lessons = await api("/lessons");
  // 반 목록은 학생 API로 유추 (campus 기준)
  el.innerHTML = `
    <div class="grid cols-2">
      <div class="panel pad"><div style="font-weight:800;margin-bottom:14px">새 수업 기록</div>
        <label class="fld"><span class="lab">반 ID</span><input class="input" id="l-cg" placeholder="반 ID (관리자에게 문의 또는 시드값)"></label>
        <label class="fld"><span class="lab">수업 날짜</span><input class="input" id="l-date" type="date" value="2026-05-30"></label>
        <label class="fld"><span class="lab">수업 녹취 (STT 결과)</span><textarea class="textarea" id="l-tr" placeholder="오늘은 조건문을 배웠어요.&#10;if 안에 if 넣어도 되나요?&#10;네, 중첩 조건문이라고 해요."></textarea></label>
        <button class="btn primary" id="l-save">AI 요약 생성</button>
        <div id="l-result" style="margin-top:12px"></div>
      </div>
      <div class="panel"><div class="panel-head"><div><h2 class="panel-title">수업 기록</h2></div></div>
        ${lessons.length?lessons.map(l=>`<div class="row"><div class="rt">${esc(l.classGroup?.name||l.classGroupId)} · ${esc(l.date||"")}</div><div class="rc">${esc(l.aiSummary||"(요약 없음)")}</div>${l.reportSent?'<span class="tag green" style="margin-top:6px">리포트 발송됨</span>':`<button class="btn sm" style="margin-top:6px" data-report="${l.id}">학부모 리포트 발송</button>`}</div>`).join(""):'<div class="row rc" style="color:var(--muted)">수업 기록이 없습니다.</div>'}
      </div>
    </div>`;
  document.getElementById("l-save").onclick=async()=>{
    const body={classGroupId:val("l-cg"),date:val("l-date"),transcript:document.getElementById("l-tr").value};
    if(!body.classGroupId){toast("반 ID를 입력하세요. (커리큘럼/반 관리에서 확인)",true);return;}
    try{ const r=await api("/lms/lessons",{method:"POST",body});
      document.getElementById("l-result").innerHTML=`<div class="notice">🤖 AI 요약(${r.ai.mode==="live"?"실연동":"stub"}): ${esc(r.ai.summary)}</div>`;
      toast("AI 요약 생성 완료."); }catch(e){toast(e.message,true);}
  };
  el.querySelectorAll("[data-report]").forEach(b=>b.onclick=async()=>{ try{ const r=await api(`/lms/lessons/${b.dataset.report}/send-report`,{method:"POST"}); toast(`학부모 ${r.sent}명에게 리포트 발송.`); renderView(); }catch(e){toast(e.message,true);} });
}

// --- 알림톡 로그 ---
async function viewNotifications(el){
  setTitle("알림톡 로그","카카오 알림톡 발송 내역 (stub: DB 기록)");
  const list = await api("/notifications");
  el.innerHTML = `<div class="panel"><div class="panel-head"><div><h2 class="panel-title">발송 내역 (${list.length})</h2></div></div>
    <div class="table-wrap"><table><thead><tr><th>시각</th><th>템플릿</th><th>수신</th><th>내용</th><th>상태</th></tr></thead>
    <tbody>${list.length?list.map(n=>`<tr><td style="white-space:nowrap">${new Date(n.createdAt).toLocaleString("ko-KR",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}</td><td>${esc(n.template)}</td><td>${esc(n.to)}</td><td style="color:var(--muted)">${esc(n.body.split("\n")[0])}</td><td><span class="tag ${n.status==="sent"?"green":"red"}">${n.status}</span></td></tr>`).join(""):'<tr><td colspan="5" style="color:var(--muted)">발송 내역이 없습니다.</td></tr>'}</tbody></table></div></div>`;
}

// --- 커리큘럼 ---
async function viewCurriculum(el){
  setTitle("LMS 커리큘럼","주차별 커리큘럼 · 진도");
  const curs = await api("/lms/curriculum");
  el.innerHTML = curs.map(c=>`<div class="panel" style="margin-bottom:14px"><div class="panel-head"><div><h2 class="panel-title">${esc(c.name)}</h2><p class="panel-sub">총 ${c.totalWeeks}주</p></div></div>
    <div style="padding:6px 0">${c.weeks.map(w=>`<div class="row"><div class="row-top"><div><div class="rt">${w.week}주차 · ${esc(w.theme)}</div><div class="rc">${esc(w.topic)}</div></div><span class="tag">${w.missions}개 미션</span></div></div>`).join("")}</div></div>`).join("") || '<div class="notice">커리큘럼이 없습니다.</div>';
}

render();
