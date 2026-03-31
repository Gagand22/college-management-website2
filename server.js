const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// --- 1. DATABASE CONNECTION (Local File) ---
// On Render, this file will persist. On Vercel, it will be wiped.
const dbPath = path.resolve(__dirname, 'uniportal.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Error opening database', err);
    else console.log('✅ Connected to SQLite database');
});

// --- 2. CREATE TABLES & SEED DATA ---
db.serialize(() => {
    // Create Users Table
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

    // Create Attendance Table
    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        studentId INTEGER,
        date TEXT,
        subject TEXT,
        period INTEGER,
        status TEXT
    )`);

    // Seed Admin User if not exists
    db.get("SELECT count(*) as count FROM users WHERE role='admin'", (err, row) => {
        if (row.count === 0) {
            console.log("🌱 Seeding Admin User...");
            const stmt = db.prepare("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)");
            stmt.run("admin", "admin123", "admin", "System Admin");
            stmt.finalize();
        }
    });
});

// --- 3. MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend'))); // Make sure your HTML/CSS is in 'frontend' folder
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

// --- 4. HELPERS ---

// Mock Timetable Generator (Same as before)
function generateTimetable(courseName) {
    const subjects = {
        "BCA": ["Java Programming", "Data Structures", "DBMS", "Computer Networks", "Operating Systems"],
        "BBA": ["Business Studies", "Marketing Mgmt", "HR Management", "Business Law", "Business Ethics"],
        "BCOM": ["Accounting", "Economics", "Taxation", "Business Stats", "Banking"]
    };
    const subs = subjects[courseName] || [];
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let schedule = {};
    days.forEach((day, index) => {
        let isOddDay = ((index + 1) % 2 !== 0);
        schedule[day] = isOddDay ? [
            { time: "02:00 PM - 02:50 PM", subject: subs[0] || "General", room: "Room 101", period: 1 },
            { time: "02:50 PM - 03:40 PM", subject: subs[1] || "General", room: "Room 102", period: 2 },
            { time: "03:40 PM - 04:30 PM", subject: subs[2] || "General", room: "Lab A", period: 3 },
            { time: "04:30 PM - 05:20 PM", subject: subs[3] || "General", room: "Lab B", period: 4 }
        ] : [
            { time: "09:00 AM - 09:50 AM", subject: subs[4] || "General", room: "Room 201", period: 1 },
            { time: "09:50 AM - 10:40 AM", subject: subs[0] || "General", room: "Room 202", period: 2 },
            { time: "10:40 AM - 11:30 AM", subject: subs[1] || "General", room: "Room 203", period: 3 },
            { time: "11:30 AM - 12:20 PM", subject: subs[2] || "General", room: "Lab C", period: 4 }
        ];
    });
    return schedule;
}

// --- 5. ROUTES ---

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
        if (err) return res.status(500).json({ success: false, message: "Server Error" });
        if (user) {
            const { password, ...safeUser } = user;
            res.json({ success: true, user: safeUser });
        } else {
            res.status(401).json({ success: false, message: "Invalid Credentials" });
        }
    });
});

app.get('/api/student/subjects/:course', (req, res) => {
    const subjects = {
        "BCA": ["Java Programming", "Data Structures", "DBMS", "Computer Networks", "Operating Systems"],
        "BBA": ["Business Studies", "Marketing Mgmt", "HR Management", "Business Law", "Business Ethics"],
        "BCOM": ["Accounting", "Economics", "Taxation", "Business Stats", "Banking"]
    };
    res.json(subjects[req.params.course] || []);
});

app.get('/api/student/timetable/:course', (req, res) => {
    res.json(generateTimetable(req.params.course));
});

app.get('/api/student/attendance/:id', (req, res) => {
    const studentId = req.params.id;
    db.all("SELECT * FROM attendance WHERE studentId = ? ORDER BY date DESC", [studentId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Calculate Stats (Same logic as before)
        const totalClasses = rows.length;
        const presentCount = rows.filter(r => r.status === 'present').length;
        const semesterPercentage = totalClasses === 0 ? 0 : ((presentCount / totalClasses) * 100).toFixed(1);

        const currentMonth = new Date().getMonth();
        const monthlyRecords = rows.filter(r => new Date(r.date).getMonth() === currentMonth);
        const monthlyTotal = monthlyRecords.length;
        const monthlyPresent = monthlyRecords.filter(r => r.status === 'present').length;
        const monthlyPercentage = monthlyTotal === 0 ? 0 : ((monthlyPresent / monthlyTotal) * 100).toFixed(1);

        // Subject Stats
        let subjectStats = {};
        rows.forEach(r => {
            if (!subjectStats[r.subject]) subjectStats[r.subject] = { total: 0, present: 0 };
            subjectStats[r.subject].total++;
            if (r.status === 'present') subjectStats[r.subject].present++;
        });
        let subjectsResult = [];
        for (let sub in subjectStats) {
            let s = subjectStats[sub];
            let p = ((s.present / s.total) * 100).toFixed(1);
            subjectsResult.push({ subject: sub, present: s.present, total: s.total, percentage: p, isShortage: p < 75 });
        }

        res.json({ 
            overall: { semesterPercentage, total: totalClasses, present: presentCount, monthlyPercentage, monthlyTotal, monthlyPresent }, 
            subjects: subjectsResult, 
            history: rows 
        });
    });
});

app.post('/api/teacher/today', (req, res) => {
    // Simplified for SQLite demo
    res.json({ day: "Monday", classes: [] }); 
});

app.get('/api/admin/students/:course', async (req, res) => {
    db.all("SELECT * FROM users WHERE course = ? AND role = 'student'", [req.params.course], (err, students) => {
        if (err) return res.status(500).json({ error: err.message });
        // Note: Calculating stats for every student in SQLite requires a loop or complex SQL.
        // For now, returning students with empty stats to keep it simple.
        res.json(students.map(s => ({ ...s, stats: { semesterPercentage: 0 } }))); 
    });
});

app.post('/api/admin/attendance', (req, res) => {
    const { courseId, subject, date, period, absentRollNumbers } = req.body;
    
    db.all("SELECT * FROM users WHERE course = ? AND role = 'student' ORDER BY id ASC", [courseId], (err, students) => {
        if (err) return res.status(500).json({ error: err.message });

        const absentIndices = absentRollNumbers.map(r => parseInt(r.trim()));
        let count = 0;

        students.forEach((student, index) => {
            const isAbsent = absentIndices.includes(index + 1);
            const status = isAbsent ? 'absent' : 'present';

            db.run("INSERT INTO attendance (studentId, date, subject, period, status) VALUES (?, ?, ?, ?, ?)", 
                [student.id, date, subject, period, status], (err) => {
                    if (err) console.error(err);
                });
            count++;
        });

        res.json({ success: true, message: "Attendance Updated Successfully" });
    });
});

app.get('/api/admin/shortage/:course', (req, res) => {
    res.json([]); // Placeholder
});

// IMPORTANT: FOR RENDER
module.exports = app;