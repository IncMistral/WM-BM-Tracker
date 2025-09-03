'use strict';

/* ===================== STATE ===================== */
let isAdmin = false;
/* ===================== MODAL HELPERS ===================== */
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display = "flex";  
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display = "none";
  }
}


function showLoginModal() {
  openModal("loginModal");
}

function openGroupModal(gi) {
  console.log("openGroupModal called with group index:", gi);
}
function openProjectModal(gi, pi) {
  console.log("openProjectModal called with group index:", gi, "project index:", pi);
}
function openNewGroupModal() {
  console.log("openNewGroupModal called");
}
function saveToJSON() {
  console.log("saveToJSON called");
}
function loadFromJSON() {
  console.log("loadFromJSON called");
}

function attemptLogin() {
  const user = document.getElementById("loginUser").value.trim();
  const pass = document.getElementById("loginPass").value.trim();

  if (user === "admin" && pass === "password123") {
    isAdmin = true;

    // Hide login, show logout
    document.getElementById("btnShowLogin").style.display = "none";
    document.getElementById("btnLogout").style.display = "inline-block";

    // Hide error if it was shown before
    document.getElementById("loginError").style.display = "none";

    // Close modal safely
    if (typeof closeModal === "function") {
      closeModal("loginModal");
    } else {
      document.getElementById("loginModal").style.display = "none";
    }

    alert("Admin login successful");
  } else {
    document.getElementById("loginError").style.display = "block";
  }
}

function logoutAdmin() {
  isAdmin = false;

  // Show login, hide logout
  document.getElementById("btnShowLogin").style.display = "inline-block";
  document.getElementById("btnLogout").style.display = "none";

  alert("Logged out");
}


document.addEventListener("DOMContentLoaded", () => {
  const btnShowLogin = document.getElementById("btnShowLogin");
  if (btnShowLogin) btnShowLogin.addEventListener("click", showLoginModal);

  const btnLogin = document.getElementById("btnLogin");
  if (btnLogin) btnLogin.addEventListener("click", attemptLogin);

  const btnLoginCancel = document.getElementById("btnLoginCancel");
  if (btnLoginCancel) btnLoginCancel.addEventListener("click", () => closeModal("loginModal"));

  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) btnLogout.addEventListener("click", logoutAdmin);
});


const STORAGE_KEY = "bm-tracker:v1";

let groups = [{
  name: "GROUP NAME",
  teamMembers: [],
  projects: [{
    name: "PROJECT NAME",
    startDate: new Date().toISOString().split("T")[0],
    completionDate: "2025-12-31",
    milestones: []
  }]
}];

let contextTarget = null; // { groupIndex: number|null, projectIndex?: number|null }
let editingMilestoneIndex = null;
let editingMemberIndex = null;

/* ===================== XLSX EXPORT HELPERS ===================== */
function fmtMMDDYYYY(iso) {
  if (!iso) return "";
  const d = (typeof parseLocalDate === "function") ? parseLocalDate(iso) : new Date(iso + "T00:00:00");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}
function daysBetween(a, b) { return Math.round((b - a) / (24*60*60*1000)); }
function sanitizeName(s) { return (s || "export").replace(/[^\w\-]+/g, "_"); }

function projectToRow(g, p) {
  const today = new Date();
  const start = p.startDate ? parseLocalDate(p.startDate) : null;
  const end   = p.completionDate ? parseLocalDate(p.completionDate) : null;

  const durationDays  = (start && end) ? Math.max(0, daysBetween(start, end)) : "";
  const daysRemaining = end ? Math.max(0, daysBetween(today, end)) : "";

  const teamStr = (g.teamMembers || [])
    .map(m => `${m.role || ""} ${m.name || ""}`.trim())
    .filter(Boolean)
    .join(" | ");

  const milestones = (p.milestones || []).slice().sort((a,b) => {
    const da = a.date ? parseLocalDate(a.date) : new Date(0);
    const db = b.date ? parseLocalDate(b.date) : new Date(0);
    return da - db;
  });
  const milestoneStr = milestones.map(m => {
    let status = "Incomplete";
    if (m.completed) status = m.completedLate ? "Completed Late" : "Completed";
    return `${m.label || ""} (${fmtMMDDYYYY(m.date)}) - ${status}`;
  }).join(" | ");

  return [
    g.name || "",
    p.name || "",
    fmtMMDDYYYY(p.startDate),
    fmtMMDDYYYY(p.completionDate),
    durationDays,
    daysRemaining,
    teamStr,
    milestoneStr
  ];
}

function autoSizeColumns(ws, header, rows) {
  const canvas = autoSizeColumns._canvas || (autoSizeColumns._canvas = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  ctx.font = '11pt Calibri';
  const measure = (text) => {
    const s = (text == null) ? '' : String(text);
    return ctx.measureText(s).width;
  };
  const pxToWch = (px) => Math.ceil(px / 7);

  const colSpecs = header.map((h, c) => {
    const headerPx = measure(h);
    let maxPx = headerPx;
    for (const r of rows) {
      const cellPx = measure(r[c]);
      if (cellPx > maxPx) maxPx = cellPx;
    }
    return { wch: Math.min(pxToWch(maxPx) + 2, 100) };
  });
  ws['!cols'] = colSpecs;
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  const ref = XLSX.utils.encode_range({ s: { r:0, c:0 }, e: { r:0, c: header.length - 1 } });
  ws['!autofilter'] = { ref };
}

function buildSheetFromRows(rows, sheetName) {
  const header = ["Group","Project","Start Date","Completion Date","Duration (days)","Days Remaining","Team","Milestones"];
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  autoSizeColumns(ws, header, rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}
/* ===================== GROUP MODAL EXPORT UI ===================== */
function renderGroupProjectList(gi) {
  const holder = document.getElementById("groupProjectList");
  if (!holder) return;

  // New mode (no group index yet)
  if (gi == null || gi === undefined) {
    holder.innerHTML = '<div class="proj-row" aria-disabled="true">No projects yet. Save this group, then click “New Project”.</div>';
    return;
  }

  const g = groups[gi];
  holder.innerHTML = "";
  (g.projects || []).forEach((p, pi) => {
    const row = document.createElement("div");
    row.className = "proj-row";

    const name = document.createElement("span");
    name.textContent = p.name || `Project ${pi+1}`;
    row.appendChild(name);

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = true;
    chk.id = `projChk_${gi}_${pi}`;
    chk.setAttribute("data-gi", String(gi));
    chk.setAttribute("data-pi", String(pi));
    row.appendChild(chk);

    holder.appendChild(row);
  });
}

function exportSelectedFromCurrentGroup() {
  if (!contextTarget || contextTarget.groupIndex == null) { alert("Open a group first."); return; }
  const gi = contextTarget.groupIndex;
  const g = groups[gi];

  const holder = document.getElementById("groupProjectList");
  if (!holder) return;

  const checks = holder.querySelectorAll('input[type="checkbox"]');
  const rows = [];
  checks.forEach(chk => {
    if (chk instanceof HTMLInputElement && chk.checked) {
      const pi = Number(chk.getAttribute("data-pi"));
      const p = g.projects[pi];
      if (p) rows.push(projectToRow(g, p));
    }
  });

  if (!rows.length) { alert("Please select at least one project to export."); return; }

  const wb = buildSheetFromRows(rows, "Projects");
  const fname = `${sanitizeName(g.name)}_selected.xlsx`;
  XLSX.writeFile(wb, fname);
}

function selectAllInCurrentGroup(value) {
  const holder = document.getElementById("groupProjectList");
  if (!holder) return;
  holder.querySelectorAll('input[type="checkbox"]').forEach(chk => {
    if (chk instanceof HTMLInputElement) chk.checked = !!value;
  });
}

function openTeamFromGroup(){
  if (!contextTarget || contextTarget.groupIndex == null) return;
  const gi = contextTarget.groupIndex;
  openTeamModal(gi);
}
function newProjectFromGroup(){
  if (!contextTarget || contextTarget.groupIndex == null) return;
  const gi = contextTarget.groupIndex;
  addProject(gi);
}

/* ===================== DATE / TIMELINE ===================== */
function parseLocalDate(yyyy_mm_dd) {
  const [y, m, d] = yyyy_mm_dd.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDaysLocal(date, days) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

const BAR_HEIGHT = 24, GAP = 25, LEFT_MARGIN = 200;
const roleColors = { TEAM_LEAD:"orange", WELDER:"lightblue", INSTALLER:"limegreen", QC:"violet" };
const MAX_DAYS_VIEW = 15;
const DAY_MS = 24*60*60*1000;
const projectViewState = {};
let dragState = null;

/* === Per-group hover tracking === */
let groupCardRegions = [];
let groupHoverHandlersAttached = false;
function attachGroupHoverHandlers(){
  const wrapper = document.getElementById('trackerWrapper');
  if (!wrapper || groupHoverHandlersAttached) return;

  wrapper.addEventListener('mousemove', (e) => {
    const r = wrapper.getBoundingClientRect();
    const x = e.clientX - r.left + wrapper.scrollLeft;
    const y = e.clientY - r.top  + wrapper.scrollTop;

    let active = null;
    for (const region of groupCardRegions){
      if (x >= region.x1 && x <= region.x2 && y >= region.y1 && y <= region.y2){
        active = region; break;
      }
    }
    groupCardRegions.forEach(region =>
      region.el.classList.toggle('is-hovered', region === active)
    );
  });

  wrapper.addEventListener('mouseleave', () => {
    groupCardRegions.forEach(region => region.el.classList.remove('is-hovered'));
  });

  groupHoverHandlersAttached = true;
}

function keyFor(gi, pi){ return `${gi}:${pi}`; }
function getOffset(gi, pi){
  const k = keyFor(gi,pi);
  return (projectViewState[k] && projectViewState[k].offsetDays) || 0;
}
function setOffset(gi, pi, v){
  const k = keyFor(gi,pi);
  if (!projectViewState[k]) projectViewState[k] = { offsetDays: 0 };
  projectViewState[k].offsetDays = v;
}
function startDrag(e, gi, pi, barW, totalDays){
  const viewportDays = Math.min(totalDays, MAX_DAYS_VIEW);
  const maxOffset = Math.max(0, totalDays - viewportDays);
  const cellW = barW / viewportDays;

  dragState = {
    gi, pi,
    startX: e.clientX,
    initOffset: Math.min(getOffset(gi,pi), maxOffset),
    cellW, maxOffset
  };
  document.body.classList.add('dragging');
  e.preventDefault();
}
function onMouseMove(e){
  if (!dragState) return;
  const dx = e.clientX - dragState.startX;
  const deltaDays = Math.round(-dx / dragState.cellW);
  let newOffset = dragState.initOffset + deltaDays;
  newOffset = Math.max(0, Math.min(dragState.maxOffset, newOffset));
  if (newOffset !== getOffset(dragState.gi, dragState.pi)) {
    setOffset(dragState.gi, dragState.pi, newOffset);
    render();
  }
}
function endDrag(){
  if (!dragState) return;
  dragState = null;
  document.body.classList.remove('dragging');
}
function fmtMilestoneDate(iso) {
  const d = parseLocalDate(iso);
  const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${M[d.getMonth()]}/${String(d.getDate()).padStart(2,"0")}`;
}
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('mouseup', endDrag);
document.addEventListener('mouseleave', endDrag);
/* ===================== TEAM MODAL ===================== */
function renderMemberList(g) {
  const list = document.getElementById("memberList");
  if (!list) return;
  list.innerHTML = "";
  g.teamMembers.forEach((m, idx) => {
    const div = document.createElement("div");
    const label = document.createElement("span");
    label.textContent = `${m.role} ${m.name}`;
    div.appendChild(label);

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.addEventListener('click', () => {
      const roleSel = document.getElementById("roleSelect");
      const nameInp = document.getElementById("memberName");
      if (roleSel instanceof HTMLSelectElement) roleSel.value = m.role;
      if (nameInp instanceof HTMLInputElement) nameInp.value = m.name;
      editingMemberIndex = idx;
    });
    div.appendChild(editBtn);

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.addEventListener('click', () => {
      if (confirm("Delete this team member?")) {
        g.teamMembers.splice(idx, 1);
        saveData();
        renderMemberList(g);
        render();
      }
    });
    div.appendChild(delBtn);

    list.appendChild(div);
  });
}

/* ===================== RENDER TIMELINE ===================== */
function render(){
  const wrapper = document.getElementById("trackerWrapper");
  if (!wrapper) return;
  wrapper.innerHTML = "";
  let y = 48;

  groupCardRegions = [];
  attachGroupHoverHandlers();

  groups.forEach((g, gi) => {
    const sidePad = 10;               // consistent 30px left/right pad
    const labelColWidth = 70;         // width for project labels
    const labelGutter = 10;           // space between labels and bar
    const barXBase = sidePad + labelColWidth + labelGutter;

    const groupStartY = y - 45;

    const card = document.createElement('div');
    card.className = 'group-card';
    card.style.left = sidePad + 'px';
    card.style.top  = groupStartY + 'px';
    card.style.width  = (wrapper.clientWidth - sidePad * 2) + 'px';
    card.style.height = '1px';
    wrapper.appendChild(card);

    const teamContainer = document.createElement("div");
    teamContainer.className = "absolute";
    teamContainer.style.left = "50%";
    teamContainer.style.top = (y - 40) + "px";
    teamContainer.style.transform = "translateX(-50%)";
    teamContainer.style.display = "flex";
    teamContainer.style.gap = "16px";

    g.teamMembers.forEach((member) => {
      const box = document.createElement("div");
      box.style.display = "flex";
      box.style.flexDirection = "column";
      box.style.alignItems = "center";
      box.style.minWidth = "90px";
      box.style.gap = "8px";

      const roleEl = document.createElement("div");
      roleEl.className = "teamRole";
      roleEl.style.color = (roleColors[member.role] || "gray");
      roleEl.textContent = member.role;

      const nameEl = document.createElement("div");
      nameEl.style.color = "white";
      nameEl.style.fontSize = "0.75rem"; /* 12px */
      nameEl.textContent = member.name;

      box.appendChild(roleEl);
      box.appendChild(nameEl);
      teamContainer.appendChild(box);
    });
    wrapper.appendChild(teamContainer);

    const groupLabel = document.createElement("span");
    groupLabel.className = "absolute clickable";
    groupLabel.style.left = sidePad + "px";
    groupLabel.style.top = (y - 40) + "px";
    groupLabel.style.fontWeight = "700";
    groupLabel.style.fontSize = "1rem"; /* 16px */
    groupLabel.style.color = "yellow";
    groupLabel.textContent = g.name;
    groupLabel.setAttribute('role','button');
    groupLabel.setAttribute('tabindex','0');
    groupLabel.setAttribute('aria-label', `Edit group ${g.name}`);
    groupLabel.setAttribute('aria-controls','groupModal');
    groupLabel.addEventListener('click', () => openGroupModal(gi));
    groupLabel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGroupModal(gi); }
    });
    wrapper.appendChild(groupLabel);

    (g.projects || []).forEach((p, pi) => {
      const projName = document.createElement("span");
      projName.className = "absolute clickable";
      projName.style.left = sidePad + "px";
      projName.style.top = (y + BAR_HEIGHT/2 - 10) + "px";
      projName.style.width = labelColWidth + "px";
      projName.style.textAlign = "right";
      projName.style.fontSize = "1rem";
      projName.style.color = "white";
      projName.textContent = p.name;
      projName.setAttribute('role','button');
      projName.setAttribute('tabindex','0');
      projName.setAttribute('aria-label', `Edit project ${p.name}`);
      projName.setAttribute('aria-controls','projectModal');
      projName.addEventListener('click', () => openProjectModal(gi, pi));
      projName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProjectModal(gi, pi); }
      });
      wrapper.appendChild(projName);

      if (p.startDate) {
        const startLabel = document.createElement("span");
        startLabel.className = "absolute";
        startLabel.style.left = (barXBase -10) + "px";
        startLabel.style.top  = (y - 10) + "px";
        startLabel.style.transform = "translateX(-100%) translateY(-50%)";
        startLabel.style.fontSize = "0.5rem"; /* 8px */
        startLabel.style.color = "#ccc";
        startLabel.textContent = p.startDate;
        wrapper.appendChild(startLabel);
      }

      const barX = barXBase;
      const barW = Math.max(200, wrapper.clientWidth - barX - sidePad);

      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.left = barX + "px";
      bar.style.top = y + "px";
      bar.style.width = barW + "px";
      bar.style.height = BAR_HEIGHT + "px";
      bar.setAttribute('role','img');
      bar.setAttribute('aria-label', (p.startDate && p.completionDate)
        ? `Timeline for ${p.name} from ${p.startDate} to ${p.completionDate}`
        : `Timeline for ${p.name}`);
      wrapper.appendChild(bar);

      const border = document.createElement("div");
      border.className = "bar-border";
      border.style.left = barX + "px";
      border.style.top = y + "px";
      border.style.width = barW + "px";
      border.style.height = BAR_HEIGHT + "px";
      wrapper.appendChild(border);

      // ... continues into milestones, ticks, and completion date
          if (p.startDate && p.completionDate) {
        const start = parseLocalDate(p.startDate);
        const end   = parseLocalDate(p.completionDate);

        const totalDays = Math.max(1, Math.ceil(
          (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
           Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / DAY_MS
        ));
        const viewportDays = Math.min(totalDays, MAX_DAYS_VIEW);
        const maxOffset = Math.max(0, totalDays - viewportDays);

        let offsetDays = Math.min(getOffset(gi,pi), maxOffset);
        setOffset(gi,pi, offsetDays);

        const visibleStart = addDaysLocal(start, offsetDays);
        const visibleEnd   = addDaysLocal(visibleStart, viewportDays);
        const cellW = barW / viewportDays;

        const now = new Date();
        const nowClamped = now < visibleStart ? visibleStart : (now > visibleEnd ? visibleEnd : now);
        const progress = Math.max(0, Math.min(1, (nowClamped - visibleStart) / (visibleEnd - visibleStart)));
        const fillW = barW * progress;
        const fill = document.createElement("div");
        fill.className = "bar-fill";
        fill.style.left = barX + "px";
        fill.style.top = y + "px";
        fill.style.width = fillW + "px";
        fill.style.height = BAR_HEIGHT + "px";
        wrapper.appendChild(fill);

        if (totalDays > MAX_DAYS_VIEW) {
          const startDragHandler = (evt) => startDrag(evt, gi, pi, barW, totalDays);
          bar.classList.add('draggable');  bar.onmousedown = startDragHandler;
          fill.classList.add('draggable'); fill.onmousedown = startDragHandler;
        } else {
          bar.classList.remove('draggable');  bar.onmousedown = null;
          fill.classList.remove('draggable'); fill.onmousedown = null;
        }

        for (let i = 0; i <= viewportDays; i++) {
          const curDate = addDaysLocal(visibleStart, i);
          const dayOfWeek = curDate.getDay();
          const x = barX + (i / viewportDays) * barW;

          const tick = document.createElement("div");
          tick.className = "absolute tick";
          tick.style.left = x + "px";
          tick.style.top = y + "px";
          tick.style.width = "1px";
          tick.style.height = BAR_HEIGHT + "px";
          tick.style.background = "rgba(0,0,0,0.1)";
          wrapper.appendChild(tick);

          if (i < viewportDays) {
            const label = document.createElement("div");
            label.className = "dayLetter";
            label.style.left = (x + cellW / 2) + "px";
            label.style.top  = (y + BAR_HEIGHT / 2) + "px";

            const month = curDate.getMonth() + 1;
            const date  = curDate.getDate();
            const dow   = ['S','M','T','W','T','F','S'][dayOfWeek];

            label.innerHTML = `<div>${dow}</div><div style="font-size:0.75rem;">${month}/${String(date).padStart(2,"0")}</div>`;
            wrapper.appendChild(label);
          }

          if (i < viewportDays && (dayOfWeek === 0 || dayOfWeek === 6)) {
            const weekend = document.createElement("div");
            weekend.className = "absolute weekendHatch";
            weekend.style.left = x + "px";
            weekend.style.top = y + "px";
            weekend.style.width = cellW + "px";
            weekend.style.height = BAR_HEIGHT + "px";
            wrapper.appendChild(weekend);
          }
        }

        if (p.milestones && p.milestones.length) {
          p.milestones.forEach(m => {
            const d = parseLocalDate(m.date);
            if (d >= visibleStart && d <= visibleEnd) {
              const ratio = (d - visibleStart) / (visibleEnd - visibleStart);
              const mx = barX + ratio * barW + cellW;  // shifted one day right

              const ms = document.createElement("div");
              ms.className = "milestone";
              ms.style.left = (mx - 20) + "px";
              ms.style.top = y + "px";
              ms.style.width = "6px";
              ms.style.height = BAR_HEIGHT + "px";
              if (m.completedLate) {
                ms.style.background = "repeating-linear-gradient(45deg, red, red 4px, limegreen 4px, limegreen 8px)";
              } else if (m.completed) {
                ms.classList.add("complete");
              } else if (d < new Date()) {
                ms.classList.add("overdue");
              } else {
                ms.style.background = "orange";
              }
              wrapper.appendChild(ms);

              const labelWrap = document.createElement("div");
              labelWrap.style.position = "absolute";
              labelWrap.style.left = (mx - 10) + "px";   
              labelWrap.style.top = (y + BAR_HEIGHT + 4) + "px";
              labelWrap.style.transform = "translateX(-50%)";
              labelWrap.style.display = "flex";
              labelWrap.style.flexDirection = "column";
              labelWrap.style.alignItems = "center";

              const lbl = document.createElement("div");
              lbl.className = "milestone-label";
              lbl.textContent = m.label;

              const dateLbl = document.createElement("div");
              dateLbl.className = "milestone-date";
              dateLbl.textContent = fmtMilestoneDate(m.date);

              labelWrap.appendChild(lbl);
              labelWrap.appendChild(dateLbl);
              wrapper.appendChild(labelWrap);
            }
          });
        }
      }

      if (p.completionDate) {
        const today = new Date();
        const end = new Date(p.completionDate);
        const diff = Math.max(0, Math.ceil((end - today) / (1000*60*60*24)));
        const comp = document.createElement("div");
        comp.className = "completion";
        comp.style.left = (barX + barW - 80) + "px";
        comp.style.top = (y - 16) + "px";
        comp.style.fontSize = "0.5rem";
        comp.textContent = `${p.completionDate} | T - ${diff}`;
        wrapper.appendChild(comp);
      }

      y += BAR_HEIGHT + GAP;
    });

    const groupEndY = y;
    const height = groupEndY - groupStartY;
    card.style.height = height + 'px';

    groupCardRegions.push({
      x1: sidePad,
      y1: groupStartY,
      x2: sidePad + (wrapper.clientWidth - sidePad * 2),
      y2: groupStartY + height,
      el: card
    });

    y += 50; // space after each group
  });
}

/* ===================== STORAGE + SERVER ===================== */
function saveData() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(groups)); }
  catch(e) { console.warn("LocalStorage save failed:", e); }
}
async function saveToServer() {
  if (!isAdmin) {
    console.log("[tracker] Not admin, skipping save.");
    return false;
  }
  try {
    const res = await fetch("https://bm-tracker-backend.onrender.com/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(groups)
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    console.log("[tracker] Saved to server");
    return true;
  } catch (e) {
    console.warn("[tracker] saveToServer failed:", e);
    return false;
  }
}
async function loadFromServer() {
  try {
    const res = await fetch('https://bm-tracker-backend.onrender.com/load', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (Array.isArray(data)) {
      groups = data;
      saveData();
      render();
      return true;
    }
  } catch (e) {
    console.warn('[tracker] loadFromServer failed:', e);
  }
  return false;
}

/* ===================== EVENTS ===================== */
function wireEvents(){
  const btnNewGroup = document.getElementById('btnNewGroup');
  const btnSave = document.getElementById('btnSave');
  const btnLoad = document.getElementById('btnLoad');
  const jsonInput = document.getElementById('jsonFileInput');

  if (btnNewGroup) btnNewGroup.addEventListener('click', openNewGroupModal); 

  if (btnSave) btnSave.addEventListener('click', async () => {
    if (!isAdmin) { alert("Only admins can save."); return; }
    const ok = await saveToServer();
    if (!ok) {
      saveToJSON();
      alert('Server save failed; backup saved locally.');
    } else {
      alert('Saved to server.');
    }
  });

  if (btnLoad) btnLoad.addEventListener('click', () => { if (jsonInput) jsonInput.click(); });
  if (jsonInput) jsonInput.addEventListener('change', loadFromJSON);

  // ... wire up other buttons like milestones, groups, etc. (unchanged)
}

/* ===================== INIT ===================== */
(function init(){
  wireEvents();

  // Always render something immediately (offline fallback)
  render();

  // Then try loading from server (will overwrite groups if successful)
  loadFromServer().then(ok => {
    if (ok) {
      console.log("[tracker] Loaded data from server");
      render();
    } else {
      console.warn("[tracker] Using local default data");
    }
  });

  // Auto-save + refresh every 5 minutes
  setInterval(async () => {
    if (isAdmin) {
      try {
        await saveToServer();   // push to server
        render();               // refresh UI
        console.log("[tracker] Auto-saved and refreshed");
      } catch (e) {
        console.warn("[tracker] Auto-save failed:", e);
      }
    } else {
      render(); // non-admins just re-render
      console.log("[tracker] Refreshed (non-admin)");
    }
  }, 300000); // 5 minutes
})();



