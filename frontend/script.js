let currentUser = null;

// ============================================================
// AUTH
// ============================================================
async function handleLogin(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = 'Signing in...';
    btn.disabled = true;

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showLoginError('Please enter username and password.');
        btn.innerText = originalText;
        btn.disabled = false;
        return;
    }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (data.success) {
            currentUser = data.user;
            initApp();
        } else {
            showLoginError(data.message || 'Invalid credentials. Please try again.');
            btn.innerText = originalText;
            btn.disabled = false;
        }
    } catch (err) {
        showLoginError('Cannot reach server. Make sure node server.js is running.');
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function showLoginError(msg) {
    // Remove existing error if any
    const existing = document.getElementById('login-error');
    if (existing) existing.remove();

    const err = document.createElement('div');
    err.id = 'login-error';
    err.style.cssText = `
        background: #fee2e2;
        color: #991b1b;
        border: 1px solid #fca5a5;
        border-radius: 10px;
        padding: 12px 16px;
        margin-top: 15px;
        font-size: 0.9rem;
        text-align: center;
    `;
    err.innerText = '⚠️ ' + msg;

    // Insert after the form
    const form = document.querySelector('#login-screen form');
    form.appendChild(err);

    // Auto-remove after 5 seconds
    setTimeout(() => err.remove(), 5000);
}

// ============================================================
// APP INIT
// ============================================================
function initApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
    document.getElementById('user-name-display').innerText = currentUser.name;
    document.getElementById('user-role-display').innerText = currentUser.role.toUpperCase();
    document.getElementById('user-avatar').innerText = currentUser.name.charAt(0).toUpperCase();

    const menu = document.getElementById('nav-menu');

    if (currentUser.role === 'student') {
        menu.innerHTML = `
            <div class="nav-item active" onclick="navigate('dashboard', this)">📊 Dashboard</div>
            <div class="nav-item" onclick="navigate('timetable', this)">📅 Timetable</div>
            <div class="nav-item" onclick="navigate('attendance', this)">📈 Attendance</div>
        `;
        navigate('dashboard');
    } else if (currentUser.role === 'teacher') {
        menu.innerHTML = `
            <div class="nav-item active" onclick="navigate('dashboard', this)">🏫 My Schedule</div>
        `;
        navigate('dashboard');
    } else {
        // Admin
        menu.innerHTML = `
            <div class="nav-item active" onclick="navigate('dashboard', this)">🏫 Overview</div>
            <div class="nav-item" onclick="navigate('mark-attendance', this)">✏️ Mark Attendance</div>
            <div class="nav-item" onclick="navigate('students', this)">👥 Students</div>
            <div class="nav-item" onclick="navigate('shortage', this)">⚠️ Shortage List</div>
        `;
        navigate('dashboard');
    }
}

function logout() {
    currentUser = null;
    location.reload();
}

// ============================================================
// NAVIGATION
// ============================================================
function navigate(page, el) {
    // Update active nav highlight
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');

    const titles = {
        'dashboard':       'Dashboard',
        'timetable':       'Class Timetable',
        'attendance':      'Attendance Report',
        'mark-attendance': 'Mark Attendance',
        'students':        'Student Directory',
        'shortage':        'Attendance Shortage'
    };
    document.getElementById('page-title').innerText = titles[page] || 'Dashboard';

    const content = document.getElementById('main-content');
    content.innerHTML = '<div style="padding:40px; text-align:center; color:#6b7280;">Loading...</div>';
    content.className = 'content-area fade-in';

    if (currentUser.role === 'student') {
        loadStudentPage(page);
    } else {
        loadAdminPage(page);
    }
}

// Tab switching for attendance page
window.switchTab = function(tabName, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    const tab = document.getElementById(`tab-${tabName}`);
    if (tab) tab.style.display = 'block';
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
};

// ============================================================
// STUDENT PAGES
// ============================================================
async function loadStudentPage(page) {
    const content = document.getElementById('main-content');

    try {
        if (page === 'dashboard') {
            // Fetch attendance data — handle gracefully if empty
            let attData = { overall: { semesterPercentage: 0, monthlyPercentage: 0, present: 0, total: 0, monthlyPresent: 0, monthlyTotal: 0 }, subjects: [], history: [] };

            try {
                const attRes = await fetch(`/api/student/attendance/${currentUser.id}?t=${Date.now()}`);
                if (attRes.ok) attData = await attRes.json();
            } catch (_) { /* attendance fetch failed — show zeros, don't crash */ }

            const isLow = attData.overall.total > 0 && parseFloat(attData.overall.semesterPercentage) < 75;

            content.innerHTML = `
                ${isLow ? `
                <div class="card" style="background:#fee2e2; border:1px solid #fca5a5; margin-bottom:24px; display:flex; align-items:center; gap:15px;">
                    <div style="font-size:2.5rem;">🚨</div>
                    <div>
                        <h3 style="color:#991b1b; margin-bottom:5px;">Low Attendance Warning</h3>
                        <p style="color:#b91c1c;">You are below 75%. Please improve immediately.</p>
                    </div>
                </div>` : ''}
                <div class="grid-dashboard">
                    <div class="card stat-card">
                        <div class="stat-icon" style="background:#e0f2fe; color:#0284c7">📅</div>
                        <div class="stat-info">
                            <h3>${attData.overall.monthlyPercentage}%</h3>
                            <p>Monthly Attendance</p>
                            <small style="color:var(--text-muted)">${attData.overall.monthlyPresent}/${attData.overall.monthlyTotal} Classes</small>
                        </div>
                    </div>
                    <div class="card stat-card">
                        <div class="stat-icon">🎓</div>
                        <div class="stat-info">
                            <h3>${attData.overall.semesterPercentage}%</h3>
                            <p>Semester Attendance</p>
                            <small style="color:var(--text-muted)">${attData.overall.present}/${attData.overall.total} Classes</small>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <h3 style="margin-bottom:15px; border-bottom:1px solid #f3f4f6; padding-bottom:10px;">My Profile</h3>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                        <div><strong>Roll Number:</strong> ${currentUser.rollNumber || 'N/A'}</div>
                        <div><strong>Course:</strong> ${currentUser.course || 'N/A'}</div>
                        <div><strong>Email:</strong> ${currentUser.email || 'N/A'}</div>
                        <div><strong>Semester:</strong> ${currentUser.semester || 'N/A'}</div>
                    </div>
                </div>
            `;

        } else if (page === 'attendance') {
            let attData = { overall: { semesterPercentage: 0, present: 0, total: 0 }, subjects: [], history: [] };

            try {
                const attRes = await fetch(`/api/student/attendance/${currentUser.id}?t=${Date.now()}`);
                if (attRes.ok) attData = await attRes.json();
            } catch (_) {}

            const total = attData.overall.total;
            const present = attData.overall.present;
            const absent = total - present;

            const dailyLogHtml = attData.history.length
                ? attData.history.map(h => `
                    <tr>
                        <td><strong>${h.date}</strong></td>
                        <td>${h.subject}</td>
                        <td><span class="badge ${h.status === 'present' ? 'badge-green' : 'badge-red'}">${h.status.toUpperCase()}</span></td>
                        <td>Period ${h.period}</td>
                    </tr>`).join('')
                : '<tr><td colspan="4" style="text-align:center; padding:30px; color:#6b7280;">No attendance records found. Run seedAttendance.js to generate data.</td></tr>';

            const subjectHtml = attData.subjects.length
                ? attData.subjects.map(s => `
                    <tr>
                        <td><strong>${s.subject}</strong></td>
                        <td style="text-align:center">${s.total}</td>
                        <td style="text-align:center; color:#059669">${s.present}</td>
                        <td style="text-align:center; color:#dc2626">${s.total - s.present}</td>
                        <td style="text-align:center"><span class="badge ${s.isShortage ? 'badge-red' : 'badge-green'}">${s.percentage}%</span></td>
                    </tr>`).join('')
                : '<tr><td colspan="5" style="text-align:center; padding:30px; color:#6b7280;">No data available.</td></tr>';

            content.innerHTML = `
                <div class="tabs">
                    <button class="tab-btn active" onclick="switchTab('overview', this)">📊 Overview</button>
                    <button class="tab-btn" onclick="switchTab('subjects', this)">📚 Class-wise</button>
                    <button class="tab-btn" onclick="switchTab('daily', this)">📅 Daily Log</button>
                </div>
                <div id="tab-overview" class="tab-content">
                    <div class="grid-dashboard">
                        <div class="card stat-card"><div class="stat-icon" style="background:#f3f4f6; color:#4b5563">📚</div><div class="stat-info"><h3>${total}</h3><p>Total Classes</p></div></div>
                        <div class="card stat-card"><div class="stat-icon" style="background:#d1fae5; color:#059669">✅</div><div class="stat-info"><h3>${present}</h3><p>Present</p></div></div>
                        <div class="card stat-card"><div class="stat-icon" style="background:#fee2e2; color:#dc2626">❌</div><div class="stat-info"><h3>${absent}</h3><p>Absent</p></div></div>
                    </div>
                </div>
                <div id="tab-subjects" class="tab-content" style="display:none;">
                    <div class="card" style="padding:0; overflow:hidden;">
                        <div class="table-container" style="border:none; border-radius:0;">
                            <table><thead><tr><th>Subject</th><th style="text-align:center">Total</th><th style="text-align:center">Present</th><th style="text-align:center">Absent</th><th style="text-align:center">%</th></tr></thead>
                            <tbody>${subjectHtml}</tbody></table>
                        </div>
                    </div>
                </div>
                <div id="tab-daily" class="tab-content" style="display:none;">
                    <div class="card" style="padding:0; overflow:hidden;">
                        <div class="table-container" style="border:none; border-radius:0;">
                            <table><thead><tr><th>Date</th><th>Subject</th><th>Status</th><th>Period</th></tr></thead>
                            <tbody>${dailyLogHtml}</tbody></table>
                        </div>
                    </div>
                </div>
            `;

        } else if (page === 'timetable') {
            const res = await fetch(`/api/student/timetable/${currentUser.course}`);
            const schedule = await res.json();
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

            let html = '<div class="card">';
            days.forEach(day => {
                const slots = schedule[day] || [];
                html += `
                    <div style="margin-bottom:20px; padding-bottom:20px; border-bottom:1px solid #f3f4f6;">
                        <h4 style="color:var(--primary); margin-bottom:12px; font-size:1.2rem;">${day}</h4>
                        ${slots.map(s => `
                            <div style="background:#f9fafb; padding:15px; margin-bottom:10px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; border-left:5px solid var(--primary); box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                                <div><span style="font-weight:700; font-size:1.05rem; color:var(--text-main);">${s.subject}</span></div>
                                <div style="text-align:right;">
                                    <span style="font-size:0.9rem; color:var(--text-muted); display:block;">${s.time}</span>
                                    <span style="font-size:0.85rem; color:var(--primary); font-weight:600;">${s.room}</span>
                                </div>
                            </div>`).join('')}
                    </div>`;
            });
            html += '</div>';
            content.innerHTML = html;
        }

    } catch (err) {
        content.innerHTML = `<div class="card" style="text-align:center; padding:40px; color:#dc2626;">
            <div style="font-size:2rem; margin-bottom:10px;">⚠️</div>
            <h3>Something went wrong</h3>
            <p style="color:#6b7280; margin-top:8px;">${err.message}</p>
        </div>`;
    }
}

// ============================================================
// ADMIN / TEACHER PAGES
// ============================================================
async function loadAdminPage(page) {
    const content = document.getElementById('main-content');

    try {
        if (page === 'dashboard') {
            if (currentUser.role === 'teacher') {
                const res = await fetch('/api/teacher/today', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subjectsAssigned: currentUser.subjects || [] })
                });
                const data = await res.json();

                content.innerHTML = `
                    <div style="margin-bottom:20px;">
                        <h2 style="margin-bottom:5px;">Good Day, ${currentUser.name}! 👋</h2>
                        <p style="color:var(--text-muted);">Here is your schedule for <strong>${data.day}</strong>.</p>
                    </div>
                    <div class="card" style="margin-bottom:30px; background:linear-gradient(135deg, #0d9488, #0f766e); color:white;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <h3 style="font-size:1.1rem; opacity:0.9; margin-bottom:5px;">Classes Scheduled Today</h3>
                                <div style="font-size:3rem; font-weight:800;">${data.classes.length}</div>
                            </div>
                            <div style="font-size:4rem; opacity:0.3;">📅</div>
                        </div>
                    </div>
                    <h3 style="margin-bottom:20px;">Today's Classes</h3>
                    <div class="grid-dashboard">
                        ${data.classes.length > 0
                            ? data.classes.map(c => `
                                <div class="card stat-card">
                                    <div class="stat-icon" style="background:#e0e7ff; color:#4338ca">🔔</div>
                                    <div class="stat-info">
                                        <h3 style="font-size:1.2rem; line-height:1.3; margin-bottom:5px;">${c.subject}</h3>
                                        <p style="margin-bottom:2px;">Period ${c.period} • ${c.room}</p>
                                        <small style="color:var(--text-muted); font-weight:600;">${c.time}</small>
                                        <div style="margin-top:8px;"><span class="badge badge-blue">${c.course}</span></div>
                                    </div>
                                </div>`).join('')
                            : '<p style="color:#6b7280;">No classes scheduled for today.</p>'}
                    </div>
                `;
            } else {
                // Admin dashboard
                content.innerHTML = `
                    <div class="card" style="text-align:center; padding:50px;">
                        <div style="font-size:3rem; margin-bottom:15px;">👨‍💻</div>
                        <h2>Welcome, ${currentUser.name}</h2>
                        <p style="color:var(--text-muted); margin-top:8px;">System is running smoothly. Use the sidebar to manage records.</p>
                    </div>`;
            }

        } else if (page === 'mark-attendance') {
            content.innerHTML = `
                <div class="card" style="max-width:800px; margin:0 auto;">
                    <h3 style="margin-bottom:20px; border-bottom:1px solid #f3f4f6; padding-bottom:15px;">Mark Attendance</h3>
                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label">Course</label>
                            <select id="courseSelect" class="form-input" onchange="loadSubjects()">
                                <option value="">Select Course</option>
                                <option>BCA</option><option>BBA</option><option>BCOM</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Subject</label>
                            <select id="subjectSelect" class="form-input"><option>Select Course First</option></select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Date</label>
                            <input type="date" id="attDate" class="form-input" value="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Period</label>
                            <select id="periodSelect" class="form-input">
                                <option value="1">Period 1</option><option value="2">Period 2</option>
                                <option value="3">Period 3</option><option value="4">Period 4</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" style="color:#dc2626;">Absent Students (Serial Numbers)</label>
                        <textarea id="absentList" class="form-input" rows="3" placeholder="e.g. 1, 3, 5" style="resize:vertical;"></textarea>
                        <small style="color:var(--text-muted); font-size:0.85rem; margin-top:5px; display:block;">
                            Enter serial numbers of absent students separated by commas. Leave blank if all are present.
                        </small>
                    </div>
                    <button class="btn-primary" onclick="submitAttendance()">Submit Attendance</button>
                    <div id="attendance-msg" style="margin-top:15px;"></div>
                </div>
            `;

        } else if (page === 'students') {
            content.innerHTML = `
                <div class="card">
                    <div style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0;">Student Directory</h3>
                        <select id="studentCourse" class="form-input" style="max-width:200px" onchange="loadStudents()">
                            <option value="">Select Course</option>
                            <option>BCA</option><option>BBA</option><option>BCOM</option>
                        </select>
                    </div>
                    <div id="studentTable" class="table-container">
                        <p style="color:#6b7280; text-align:center; padding:30px;">Select a course to view students.</p>
                    </div>
                </div>`;

        } else if (page === 'shortage') {
            content.innerHTML = `
                <div class="card">
                    <div style="margin-bottom:20px;">
                        <h3 style="margin-bottom:10px;">Attendance Shortage</h3>
                        <select id="shortCourse" class="form-input" style="max-width:200px" onchange="loadShortage()">
                            <option value="">Select Course</option>
                            <option>BCA</option><option>BBA</option><option>BCOM</option>
                        </select>
                    </div>
                    <div id="shortTable" class="table-container">
                        <p style="color:#6b7280; text-align:center; padding:30px;">Select a course to view shortage list.</p>
                    </div>
                </div>`;
        }

    } catch (err) {
        content.innerHTML = `<div class="card" style="text-align:center; padding:40px; color:#dc2626;">
            <div style="font-size:2rem; margin-bottom:10px;">⚠️</div>
            <h3>Something went wrong</h3>
            <p style="color:#6b7280; margin-top:8px;">${err.message}</p>
        </div>`;
    }
}

// ============================================================
// ADMIN ACTIONS
// ============================================================
async function loadSubjects() {
    const c = document.getElementById('courseSelect').value;
    if (!c) return;
    try {
        const res = await fetch(`/api/student/subjects/${c}`);
        const subs = await res.json();
        document.getElementById('subjectSelect').innerHTML = subs.map(s => `<option>${s}</option>`).join('');
    } catch (err) {
        console.error('Failed to load subjects:', err);
    }
}

async function submitAttendance() {
    const courseId = document.getElementById('courseSelect').value;
    const subject  = document.getElementById('subjectSelect').value;
    const date     = document.getElementById('attDate').value;
    const period   = document.getElementById('periodSelect').value;
    const absentRaw = document.getElementById('absentList').value.trim();

    if (!courseId || !subject || !date || !period) {
        return alert('Please fill all fields before submitting.');
    }

    // Parse absent list — filter out empty strings
    const absentRollNumbers = absentRaw
        ? absentRaw.split(',').map(s => s.trim()).filter(s => s !== '')
        : [];

    const msgDiv = document.getElementById('attendance-msg');
    msgDiv.innerHTML = '<span style="color:#6b7280;">Saving...</span>';

    try {
        const res = await fetch('/api/admin/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId, subject, date, period: parseInt(period), absentRollNumbers })
        });
        const data = await res.json();

        if (data.success) {
            msgDiv.innerHTML = `<span style="color:#059669; font-weight:600;">✅ ${data.message}</span>`;
            document.getElementById('absentList').value = '';
        } else {
            msgDiv.innerHTML = `<span style="color:#dc2626;">❌ ${data.message}</span>`;
        }
    } catch (err) {
        msgDiv.innerHTML = `<span style="color:#dc2626;">❌ Server error: ${err.message}</span>`;
    }
}

async function loadStudents() {
    const c = document.getElementById('studentCourse').value;
    if (!c) return;
    const tableDiv = document.getElementById('studentTable');
    tableDiv.innerHTML = '<p style="color:#6b7280; padding:20px;">Loading...</p>';
    try {
        const res = await fetch(`/api/admin/students/${c}`);
        const students = await res.json();
        if (!students.length) {
            tableDiv.innerHTML = '<p style="color:#6b7280; text-align:center; padding:30px;">No students found.</p>';
            return;
        }
        tableDiv.innerHTML = `
            <table>
                <thead><tr><th>S.No</th><th>Name</th><th>Roll No</th><th>Course</th><th>Attendance %</th></tr></thead>
                <tbody>
                    ${students.map((x, i) => `
                        <tr>
                            <td><strong>${i + 1}</strong></td>
                            <td>${x.name}</td>
                            <td>${x.rollNumber}</td>
                            <td>${x.course}</td>
                            <td><span class="badge ${parseFloat(x.stats.semesterPercentage) < 75 ? 'badge-red' : 'badge-green'}">${x.stats.semesterPercentage}%</span></td>
                        </tr>`).join('')}
                </tbody>
            </table>`;
    } catch (err) {
        tableDiv.innerHTML = `<p style="color:#dc2626;">Error loading students: ${err.message}</p>`;
    }
}

async function loadShortage() {
    const c = document.getElementById('shortCourse').value;
    if (!c) return;
    const tableDiv = document.getElementById('shortTable');
    tableDiv.innerHTML = '<p style="color:#6b7280; padding:20px;">Loading...</p>';
    try {
        const res = await fetch(`/api/admin/shortage/${c}`);
        const students = await res.json();
        tableDiv.innerHTML = students.length
            ? `<table>
                <thead><tr><th>Name</th><th>Roll No</th><th>Attendance %</th></tr></thead>
                <tbody>
                    ${students.map(x => `
                        <tr>
                            <td><strong>${x.name}</strong></td>
                            <td>${x.rollNumber}</td>
                            <td><span class="badge badge-red">${x.stats.semesterPercentage}%</span></td>
                        </tr>`).join('')}
                </tbody>
               </table>`
            : '<div style="padding:40px; text-align:center; color:#6b7280;">✅ No shortage found in this course.</div>';
    } catch (err) {
        tableDiv.innerHTML = `<p style="color:#dc2626;">Error: ${err.message}</p>`;
    }
}