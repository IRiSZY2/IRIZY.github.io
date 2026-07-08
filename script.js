// ==========================================================================
// STATE MANAGEMENT & LOCAL STORAGE
// ==========================================================================
let tasks = [];
let isLocalStorageAvailable = false;

// ตรวจสอบและดึงข้อมูลจาก Local Storage
try {
    if (typeof localStorage !== 'undefined') {
        const localData = localStorage.getItem("ios_taskflow_data");
        tasks = localData ? JSON.parse(localData) : [];
        if (!Array.isArray(tasks)) tasks = [];
        isLocalStorageAvailable = true;
    }
} catch (err) {
    console.warn("เข้าถึง Local Storage ไม่ได้ ระบบสลับไปใช้ RAM ชั่วคราวแทน");
    tasks = [];
    isLocalStorageAvailable = false;
}

let currentFilterStatus = "all";
let currentlyEditingId = null;
let identityOfFreshTask = null; // มาร์ก ID ของงานใหม่ที่เพิ่งกดสร้าง เพื่อยิง Animation Pop แค่อันเดียว

// ==========================================================================
// DOM REGISTRATION
// ==========================================================================
const DOM = {
    settingsPanel: document.getElementById("settingsPanel"),
    settingsBtn: document.getElementById("settingsBtn"),
    closeSettings: document.getElementById("closeSettings"),
    themeSelect: document.getElementById("themeSelect"),
    accentSelect: document.getElementById("accentSelect"),
    taskTitle: document.getElementById("taskTitle"),
    taskSubject: document.getElementById("taskSubject"),
    dueDate: document.getElementById("dueDate"),
    initialStatus: document.getElementById("initialStatus"),
    priority: document.getElementById("priority"),
    addTaskBtn: document.getElementById("addTaskBtn"),
    taskList: document.getElementById("taskList"),
    searchInput: document.getElementById("searchInput"),
    filterSubject: document.getElementById("filterSubject"),
    filterPriority: document.getElementById("filterPriority"),
    clearDoneBtn: document.getElementById("clearDoneBtn"),
    segmentBtns: document.querySelectorAll(".segment-btn"),
    statTotal: document.getElementById("statTotal"),
    statTodo: document.getElementById("statTodo"),
    statDoing: document.getElementById("statDoing"),
    statDone: document.getElementById("statDone"),
    subjectBreakdown: document.getElementById("subjectBreakdown"),
    urgentTasksList: document.getElementById("urgentTasksList"),
    editModal: document.getElementById("editModal"),
    editTitle: document.getElementById("editTitle"),
    editSubject: document.getElementById("editSubject"),
    editDate: document.getElementById("editDate"),
    editStatus: document.getElementById("editStatus"),
    editPriority: document.getElementById("editPriority"),
    saveEditBtn: document.getElementById("saveEditBtn"),
    cancelEditBtn: document.getElementById("cancelEditBtn"),
    toast: document.getElementById("toastNotification")
};

// ==========================================================================
// BACKGROUND CANVAS ENGINE & SCROLL BLUR
// ==========================================================================
const canvas = document.getElementById("bgCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;
const bgWrapper = document.getElementById("bgWrapper");
let nodes = [];
let scrollTimeout;

function initGeometry() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    nodes = [];
    for (let i = 0; i < 75; i++) {
        nodes.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.35,
            vy: (Math.random() - 0.5) * 0.35,
            r: Math.random() * 2 + 1
        });
    }
}

function runGeometryAnimation() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const isDark = document.body.classList.contains("dark");
    ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.06)";
    ctx.strokeStyle = isDark ? "rgba(0, 122, 255, 0.05)" : "rgba(0, 122, 255, 0.03)";

    for (let i = 0; i < nodes.length; i++) {
        let n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;

        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < nodes.length; j++) {
            let n2 = nodes[j];
            let dist = Math.hypot(n.x - n2.x, n.y - n2.y);
            if (dist < 100) {
                ctx.beginPath();
                ctx.moveTo(n.x, n.y);
                ctx.lineTo(n2.x, n2.y);
                ctx.lineWidth = (1 - dist / 100);
                ctx.stroke();
            }
        }
    }
    requestAnimationFrame(runGeometryAnimation);
}

// Scroll Event: เบลอพื้นหลังเมื่อสกรอลล์หน้าจอ สไตล์ iOS
window.addEventListener("scroll", () => {
    if (bgWrapper) bgWrapper.classList.add("scroll-blur");
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        if (bgWrapper) bgWrapper.classList.remove("scroll-blur");
    }, 200);
});

window.addEventListener("resize", initGeometry);
initGeometry();
runGeometryAnimation();

// ==========================================================================
// CORE DATA LOGIC & DASHBOARD
// ==========================================================================
function triggerToast(message) {
    if (!DOM.toast) return;
    DOM.toast.innerText = message;
    DOM.toast.classList.add("show");
    setTimeout(() => DOM.toast.classList.remove("show"), 2000);
}

function commitDataChanges() {
    if (isLocalStorageAvailable) {
        localStorage.setItem("ios_taskflow_data", JSON.stringify(tasks));
    }
    calculateDashboard();
    populateSubjectDropdown();
    refreshTaskListView();
}

function calculateDashboard() {
    const total = tasks.length;
    const todoCount = tasks.filter(t => t.status === "todo").length;
    const doingCount = tasks.filter(t => t.status === "doing").length;
    const doneCount = tasks.filter(t => t.status === "done").length;

    if (DOM.statTotal) DOM.statTotal.innerText = total;
    if (DOM.statTodo) DOM.statTodo.innerText = todoCount;
    if (DOM.statDoing) DOM.statDoing.innerText = doingCount;
    if (DOM.statDone) DOM.statDone.innerText = doneCount;

    // 1. แยกตามรายวิชา
    if (DOM.subjectBreakdown) {
        DOM.subjectBreakdown.innerHTML = "";
        let counts = {};
        tasks.forEach(t => {
            let subj = t.subject.trim() || "ทั่วไป";
            counts[subj] = (counts[subj] || 0) + 1;
        });
        for (let s in counts) {
            let li = document.createElement("li");
            li.innerHTML = `<span>${s}</span> <strong>${counts[s]} งาน</strong>`;
            DOM.subjectBreakdown.appendChild(li);
        }
    }

    // 2. งานเร่งด่วนส่งภายใน 3 วัน
    if (DOM.urgentTasksList) {
        DOM.urgentTasksList.innerHTML = "";
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const threshold = new Date(now);
        threshold.setDate(now.getDate() + 3);

        const urgentItems = tasks.filter(t => {
            if (t.status === "done" || !t.date) return false;
            const tDate = new Date(t.date);
            return tDate >= now && tDate <= threshold;
        });

        if (urgentItems.length === 0) {
            DOM.urgentTasksList.innerHTML = "<li>🎉 ไม่มีงานเร่งด่วน</li>";
        } else {
            urgentItems.forEach(t => {
                let li = document.createElement("li");
                li.innerText = `⚠️ ${t.title} (${t.subject}) - ส่ง ${t.date}`;
                DOM.urgentTasksList.appendChild(li);
            });
        }
    }
}

function populateSubjectDropdown() {
    if (!DOM.filterSubject) return;
    const previousSelection = DOM.filterSubject.value;
    DOM.filterSubject.innerHTML = '<option value="all">📚 ทุกรายวิชา</option>';
    
    let subjects = [...new Set(tasks.map(t => t.subject.trim()).filter(Boolean))];
    subjects.forEach(s => {
        let opt = document.createElement("option");
        opt.value = s;
        opt.innerText = s;
        DOM.filterSubject.appendChild(opt);
    });
    DOM.filterSubject.value = previousSelection;
}

// ==========================================================================
// TASK LIST RENDERER & SINGLE ITEM ANIMATIONS
// ==========================================================================
function refreshTaskListView() {
    if (!DOM.taskList) return;

    const query = DOM.searchInput ? DOM.searchInput.value.toLowerCase() : "";
    const chosenSubject = DOM.filterSubject ? DOM.filterSubject.value : "all";
    const chosenPriority = DOM.filterPriority ? DOM.filterPriority.value : "all";

    // เรียงลำดับงานตามกำหนดส่งที่ใกล้ที่สุดขึ้นก่อนเสมอ
    let sortedTasks = [...tasks].sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date) - new Date(b.date);
    });

    // กำจัด Element การ์ดที่ไม่มีใน Array ข้อมูลแล้ว
    Array.from(DOM.taskList.children).forEach(node => {
        const id = node.id.replace("task-id-", "");
        if (!tasks.some(t => t.id === id)) {
            node.remove();
        }
    });

    // สร้างหรืออัปเดต Element การ์ดงาน
    sortedTasks.forEach((task, index) => {
        let taskNode = document.getElementById(`task-id-${task.id}`);
        
        if (!taskNode) {
            taskNode = generateTaskHTMLNode(task);
            if (index === 0) {
                DOM.taskList.insertBefore(taskNode, DOM.taskList.firstChild);
            } else {
                DOM.taskList.appendChild(taskNode);
            }
        } else {
            // อัปเดตข้อมูลในการ์ดเดิม
            if (!taskNode.classList.contains("ios-deleting")) {
                taskNode.className = `task status-${task.status}`;
            }
            const h3 = taskNode.querySelector(".t-title");
            if (h3) h3.innerText = task.title || "ไม่ได้ระบุชื่องาน";
            const pSubj = taskNode.querySelector(".t-subj");
            if (pSubj) pSubj.innerText = `วิชา: ${task.subject || "ทั่วไป"}`;
            const sDate = taskNode.querySelector(".t-date");
            if (sDate) sDate.innerText = task.date ? `📅 กำหนดส่ง: ${task.date}` : "📅 ไม่มีกำหนดส่ง";
            
            const badge = taskNode.querySelector(".priority-badge");
            if (badge) {
                badge.className = `priority-badge badge-${task.priority}`;
                badge.innerText = task.priority === "high" ? "สูง" : task.priority === "medium" ? "ปานกลาง" : "ต่ำ";
            }
        }

        // เล่นอนิเมชัน Pop-in เฉพาะรายการงานใหม่ที่เพิ่งสร้างเท่านั้น!
        if (task.id === identityOfFreshTask) {
            taskNode.classList.add("ios-pop-in");
        }

        // การคัดกรองการแสดงผล
        const matchesSearch = (task.title || "").toLowerCase().includes(query);
        const matchesSubject = (chosenSubject === "all" || task.subject === chosenSubject);
        const matchesPriority = (chosenPriority === "all" || task.priority === chosenPriority);
        const matchesStatus = (currentFilterStatus === "all" || task.status === currentFilterStatus);

        if (matchesSearch && matchesSubject && matchesPriority && matchesStatus) {
            taskNode.classList.remove("ios-hidden");
        } else {
            taskNode.classList.add("ios-hidden");
        }
    });

    identityOfFreshTask = null; // รีเซ็ต มาร์กการ์ดงานใหม่
}

function generateTaskHTMLNode(task) {
    const container = document.createElement("div");
    container.id = `task-id-${task.id}`;
    container.className = `task status-${task.status}`;

    let pText = task.priority === "high" ? "สูง" : task.priority === "medium" ? "ปานกลาง" : "ต่ำ";

    container.innerHTML = `
        <div class="task-info-side">
            <h3 class="t-title">${task.title}</h3>
            <p class="t-subj">วิชา: ${task.subject || "ทั่วไป"}</p>
            <p><small class="t-date">${task.date ? '📅 กำหนดส่ง: ' + task.date : '📅 ไม่มีกำหนดส่ง'}</small></p>
            <span class="priority-badge badge-${task.priority}">${pText}</span>
        </div>
        <div class="task-actions-side">
            <button title="แก้ไขข้อมูล" onclick="openEditViewSheet('${task.id}')">✏️</button>
            <button title="ลบงานนี้" onclick="dispatchDeleteSingleTask('${task.id}')">🗑️</button>
        </div>
    `;
    return container;
}

// ==========================================================================
// INTERACTIVE USER EVENTS
// ==========================================================================

// 1. เพิ่มงานใหม่ (พร้อมตัวเลือกสถานะ)
if (DOM.addTaskBtn) {
    DOM.addTaskBtn.onclick = () => {
        const titleValue = DOM.taskTitle.value.trim();
        const subjectValue = DOM.taskSubject.value.trim();

        if (!titleValue) {
            triggerToast("❌ กรุณากรอกชื่องานก่อนบันทึก!");
            return;
        }

        const newId = Date.now().toString();
        identityOfFreshTask = newId;

        tasks.unshift({
            id: newId,
            title: titleValue,
            subject: subjectValue || "ทั่วไป",
            date: DOM.dueDate.value,
            status: DOM.initialStatus.value || "todo", // รับค่าสถานะตั้งต้นที่เลือกไว้
            priority: DOM.priority.value
        });

        commitDataChanges();

        // เคลียร์อินพุต
        DOM.taskTitle.value = "";
        DOM.taskSubject.value = "";
        DOM.dueDate.value = "";
        triggerToast("🚀 เพิ่มรายการงานสำเร็จ!");
    };
}

// 2. ลบงานทีละรายการ พร้อม iOS Blur & Fade Animation
window.dispatchDeleteSingleTask = (id) => {
    const el = document.getElementById(`task-id-${id}`);
    if (el) {
        // เพิ่ม Class เพื่อเล่นแอนิเมชัน Blur Tween + Scale ยุบตัวลง
        el.classList.add("ios-deleting");
        
        // รอแอนิเมชันทำงานเสร็จ 400ms ค่อยลบออกจากข้อมูล
        setTimeout(() => {
            tasks = tasks.filter(t => t.id !== id);
            commitDataChanges();
            triggerToast("🗑️ ลบรายการงานเรียบร้อย");
        }, 400);
    } else {
        tasks = tasks.filter(t => t.id !== id);
        commitDataChanges();
    }
};

// 3. แก้ไขงาน
window.openEditViewSheet = (id) => {
    const target = tasks.find(t => t.id === id);
    if (!target || !DOM.editModal) return;

    currentlyEditingId = id;
    DOM.editTitle.value = target.title || "";
    DOM.editSubject.value = target.subject || "";
    DOM.editDate.value = target.date || "";
    DOM.editStatus.value = target.status || "todo";
    DOM.editPriority.value = target.priority || "low";

    DOM.editModal.classList.add("show");
};

if (DOM.saveEditBtn) {
    DOM.saveEditBtn.onclick = () => {
        tasks = tasks.map(t => t.id === currentlyEditingId ? {
            ...t,
            title: DOM.editTitle.value.trim() || "ไม่มีชื่อ",
            subject: DOM.editSubject.value.trim() || "ทั่วไป",
            date: DOM.editDate.value,
            status: DOM.editStatus.value,
            priority: DOM.editPriority.value
        } : t);

        if (DOM.editModal) DOM.editModal.classList.remove("show");
        commitDataChanges();
        triggerToast("💾 บันทึกการแก้ไขเรียบร้อย!");
    };
}

if (DOM.cancelEditBtn && DOM.editModal) {
    DOM.cancelEditBtn.onclick = () => DOM.editModal.classList.remove("show");
}

// 4. ลบงานที่เสร็จแล้วทั้งหมด
if (DOM.clearDoneBtn) {
    DOM.clearDoneBtn.onclick = () => {
        const doneTasks = tasks.filter(t => t.status === "done");
        if (doneTasks.length === 0) {
            triggerToast("ไม่มีงานที่เสร็จแล้วให้ลบ!");
            return;
        }

        if (confirm(`คุณต้องการลบงานที่เสร็จแล้วทั้งหมดจำนวน ${doneTasks.length} รายการ ใช่หรือไม่?`)) {
            doneTasks.forEach(t => {
                const node = document.getElementById(`task-id-${t.id}`);
                if (node) node.classList.add("ios-deleting");
            });

            setTimeout(() => {
                tasks = tasks.filter(t => t.status !== "done");
                commitDataChanges();
                triggerToast("🗑️ ล้างงานที่เสร็จสิ้นทั้งหมดแล้ว!");
            }, 400);
        }
    };
}

// 5. ปุ่มกรองสถานะแบบ Segment
DOM.segmentBtns.forEach(btn => {
    btn.onclick = () => {
        DOM.segmentBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilterStatus = btn.getAttribute("data-filter") || "all";
        refreshTaskListView();
    };
});

// ดักจับการค้นหาและกรอง
if (DOM.searchInput) DOM.searchInput.oninput = () => refreshTaskListView();
if (DOM.filterSubject) DOM.filterSubject.onchange = () => refreshTaskListView();
if (DOM.filterPriority) DOM.filterPriority.onchange = () => refreshTaskListView();

// 6. ระบบสลับ Theme & Accent Color (ปรับจูน Dropdown และ Font สดใส)
if (DOM.settingsBtn && DOM.settingsPanel) {
    DOM.settingsBtn.onclick = () => DOM.settingsPanel.classList.add("show");
}
if (DOM.closeSettings && DOM.settingsPanel) {
    DOM.closeSettings.onclick = () => DOM.settingsPanel.classList.remove("show");
}

if (DOM.themeSelect) {
    DOM.themeSelect.onchange = (e) => {
        document.body.classList.toggle("dark", e.target.value === "dark");
    };
}
if (DOM.accentSelect) {
    DOM.accentSelect.onchange = (e) => {
        document.body.className = document.body.className.replace(/accent-\w+/g, '');
        document.body.classList.add(`accent-${e.target.value}`);
    };
}

// ==========================================================================
// INIT APP
// ==========================================================================
calculateDashboard();
populateSubjectDropdown();
refreshTaskListView();