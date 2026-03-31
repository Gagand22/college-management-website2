const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
// Serve static files from the current directory (Root) AND 'frontend' folder if it exists
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'frontend')));

// --- SMART ROUTE TO FIND INDEX.HTML ---
app.get('/', (req, res) => {
    const rootPath = path.join(__dirname, 'index.html');
    const frontendPath = path.join(__dirname, 'frontend', 'index.html');

    if (fs.existsSync(rootPath)) {
        console.log("✅ Serving index.html from Root Folder");
        res.sendFile(rootPath);
    } else if (fs.existsSync(frontendPath)) {
        console.log("✅ Serving index.html from 'frontend' Folder");
        res.sendFile(frontendPath);
    } else {
        console.error("❌ CRITICAL ERROR: index.html not found!");
        console.log("Files in Root:", fs.readdirSync(__dirname));
        if (fs.existsSync(path.join(__dirname, 'frontend'))) {
            console.log("Files in Frontend:", fs.readdirSync(path.join(__dirname, 'frontend')));
        }
        res.status(500).send("<h1>Server Error</h1><p>Could not find index.html. Check terminal for details.</p>");
    }
});
// ------------------------------------

// --- 1. DATABASE CONNECTION (SQLite) ---
const db = new sqlite3.Database('./uniportal.db', (err) => {
    if (err) console.error('❌ Error opening database', err);
    else console.log('✅ Connected to SQLite database');
});

// --- 2. CREATE TABLES & SEED DATA ---
db.serialize(() => {
    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT,
        name TEXT,
        course TEXT,
        rollNumber TEXT,
        email TEXT,
        mobile TEXT,
        semester INTEGER,
        subjects TEXT
    )`);

    // Attendance Table
    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        studentId INTEGER,
        date TEXT,
        subject TEXT,
        period INTEGER,
        status TEXT
    )`);

    // Seed Data (Only if users table is empty)
    db.get("SELECT count(*) as count FROM users", (err, row) => {
        if (row.count === 0) {
            console.log("🌱 Seeding Initial Data...");
            const stmt = db.prepare("INSERT INTO users (username, password, role, name, course, rollNumber, email, mobile, semester, subjects) VALUES (?,?,?,?,?,?,?,?,?,?)");
            
            // Admin
            stmt.run("admin", "admin123", "admin", "System Admin", null, null, null, null, null, null);
            
            // Teachers (Subjects stored as JSON string)
            stmt.run("teacher1", "teacher123", "teacher", "Mr. Anil Kumar", null, null, null, null, null, JSON.stringify(["Java Programming", "Data Structures"]));
            stmt.run("teacher2", "teacher123", "teacher", "Ms. Sunita Singh", null, null, null, null, null, JSON.stringify(["Business Studies", "Marketing Mgmt"]));

            // Students
            stmt.run("student1", "123", "student", "Rahul Sharma", "BCA", "BCA-01", "rahul@college.edu", "9876543210", 3, null);
            stmt.run("student2", "123", "student", "Priya Singh", "BCA", "BCA-02", "priya@college.edu", "9876543211", 3, null);
            stmt.run("student3", "123", "student", "Amit Verma", "BBA", "BBA-01", "amit@college.edu", "9876543212", 3, null);
            stmt.run("student4", "123", "student", "Sneha Kapoor", "BBA", "BBA-02", "sneha@college.edu", "9876543213", 3, null);
            stmt.run("student5", "123", "student", "Vijay Kumar", "BCOM", "BCOM-01", "vijay@college.edu", "9876543214", 3, null);
            
            stmt.finalize();
        }
    });
});

// --- 3. HELPERS ---
const subjects = {
    "BCA": ["Java Programming", "Data Structures", "DBMS", "Computer Networks", "Operating Systems"],
    "BBA": ["Business Studies", "Marketing Mgmt", "HR Management", "Business Law", "Business Ethics"],
    "BCOM": ["Accounting", "Economics", "Taxation", "Business Stats", "Banking"]
};

function generateTimetable(courseName) {
    const subs = subjects[courseName] || [];
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let schedule = {};
    days.forEach((day, index) => {
        let isOddDay = ((index + 1) % 2 !== 0);
        if (isOddDay) {
            schedule[day] = [
                { time: "02:00 PM - 02:50 PM", subject: subs[0] || "General", room: "Room 101", period: 1 },
                { time: "02:50 PM - 03:40 PM", subject: subs[1] || "General", room: "Room 102", period: 2 },
                { time: "03:40 PM - 04:30 PM", subject: subs[2] || "General", room: "Lab A", period: 3 },
                { time: "04:30 PM - 05:20 PM", subject: subs[3] || "General", room: "Room B", period: 4 }
            ];
        } else {
            schedule[day] = [
                { time: "09:00 AM - 09:50 AM", subject: subs[4] || "General", room: "Room 201", period: 1 },
                { time: "09:50 AM - 10:40 AM", subject: subs[0] || "General", room: "Room 202", period: 2 },
                { time: "10:40 AM - 11:30 AM", subject: subs[1] || "General", room: "Room 203", period: 3 },
                { time: "11:30 AM - 12:20 PM", subject: subs[2] || "General", room: "Lab C", period: 4 }
            ];
        }
    });
    return schedule;
}

async function calculateAttendance(studentId) {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM attendance WHERE studentId = ?", [studentId], (err, rows) => {
            if (err) return reject(err);
            
            const totalClasses = rows.length;
            const presentCount = rows.filter(r => r.status === 'present').length;
            const semesterPercentage = totalClasses === 0 ? 0 : ((presentCount / totalClasses) * 100).toFixed(1);

            const currentMonth = new Date().getMonth();
            const monthlyRecords = rows.filter(r => new Date(r.date).getMonth() === currentMonth);
            const monthlyTotal = monthlyRecords.length;
            const monthlyPresent = monthlyRecords.filter(r => r.status === 'present').length;
            const monthlyPercentage = monthlyTotal === 0 ? 0 : ((monthlyPresent / monthlyTotal) * 100).toFixed(1);

            resolve({ semesterPercentage, total: totalClasses, present: presentCount, monthlyPercentage, monthlyTotal, monthlyPresent });
        });
    });
}

async function calculateSubjectAttendance(studentId) {
    return new Promise((resolve) => {
        db.all("SELECT * FROM attendance WHERE studentId = ?", [studentId], (err, rows) => {
            if (err || !rows) return resolve([]);
            let subjectStats = {};
            rows.forEach(record => {
                if (!subjectStats[record.subject]) subjectStats[record.subject] = { total: 0, present: 0 };
                subjectStats[record.subject].total++;
                if (record.status === 'present') subjectStats[record.subject].present++;
            });
            let result = [];
            for (let sub in subjectStats) {
                let stats = subjectStats[sub];
                let percent = ((stats.present / stats.total) * 100).toFixed(1);
                result.push({ subject: sub, present: stats.present, total: stats.total, percentage: percent, isShortage: percent < 75 });
            }
            resolve(result);
        });
    });
}

// --- 4. ROUTES ---

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
        if (err) return res.status(500).json({ success: false, message: "Server Error" });
        if (user) {
            const { password, ...safeUser } = user;
            if (user.subjects) {
                safeUser.subjects = JSON.parse(user.subjects);
            }
            res.json({ success: true, user: safeUser });
        } else {
            res.status(401).json({ success: false, message: "Invalid Credentials" });
        }
    });
});

app.get('/api/student/subjects/:course', (req, res) => res.json(subjects[req.params.course] || []));

app.get('/api/student/timetable/:course', (req, res) => res.json(generateTimetable(req.params.course)));

app.get('/api/student/attendance/:id', async (req, res) => {
    try {
        const overall = await calculateAttendance(req.params.id);
        const subjectWise = await calculateSubjectAttendance(req.params.id);
        
        db.all("SELECT * FROM attendance WHERE studentId = ? ORDER BY date DESC", [req.params.id], (err, history) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ overall, subjects: subjectWise, history });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/teacher/today', (req, res) => {
    const { subjectsAssigned } = req.body;
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = dayNames[new Date().getDay()];
    let todayClasses = [];
    
    Object.keys(subjects).forEach(course => {
        const schedule = generateTimetable(course);
        (schedule[today] || []).forEach(slot => {
            if (subjectsAssigned.includes(slot.subject)) todayClasses.push({ ...slot, course });
        });
    });
    res.json({ day: today, classes: todayClasses });
});

app.get('/api/admin/students/:course', async (req, res) => {
    db.all("SELECT * FROM users WHERE course = ? AND role = 'student' ORDER BY id ASC", [req.params.course], async (err, students) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const studentsWithStats = await Promise.all(students.map(async (s) => {
            const stats = await calculateAttendance(s.id);
            return { ...s, stats };
        }));
        
        res.json(studentsWithStats);
    });
});

app.post('/api/admin/attendance', (req, res) => {
    const { date, subject, courseId, period, absentRollNumbers } = req.body;
    
    db.all("SELECT * FROM users WHERE course = ? AND role = 'student' ORDER BY id ASC", [courseId], async (err, students) => {
        if (err) return res.status(500).json({ error: err.message });

        const absentIndices = absentRollNumbers.map(r => parseInt(r.trim()));

        students.forEach((student, index) => {
            const isAbsent = absentIndices.includes(index + 1);
            const status = isAbsent ? 'absent' : 'present';

            db.run("DELETE FROM attendance WHERE studentId = ? AND date = ? AND subject = ? AND period = ?", 
                [student.id, date, subject, period], () => {
                db.run("INSERT INTO attendance (studentId, date, subject, period, status) VALUES (?, ?, ?, ?, ?)", 
                    [student.id, date, subject, period, status]);
            });
        });
        
        res.json({ success: true, message: "Attendance Updated Successfully" });
    });
});

app.get('/api/admin/shortage/:course', async (req, res) => {
    db.all("SELECT * FROM users WHERE course = ? AND role = 'student'", [req.params.course], async (err, students) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const shortageList = [];
        for (const s of students) {
            const stats = await calculateAttendance(s.id);
            if (stats.total > 0 && stats.semesterPercentage < 75) {
                shortageList.push({ ...s, stats });
            }
        }
        res.json(shortageList);
    });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
