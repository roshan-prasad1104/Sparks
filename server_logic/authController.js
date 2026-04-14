// In-memory user database
const usersDB = [
  { email: "roshan@example.com", userid: "roshan", password: "password123" }
];

function setupAuthRoutes(app) {
  // --- Auth Routes ---
  app.post('/api/signup', (req, res) => {
    const { email, userid, password } = req.body;
    if (!email || !userid || !password) return res.status(400).json({ error: "Missing fields" });

    const extraUser = usersDB.find(u => u.userid === userid || u.email === email);
    if (extraUser) {
      return res.status(400).json({ error: "User ID or Email already exists! Please use a different one or login." });
    }

    usersDB.push({ email, userid, password });
    return res.json({ success: true, message: "Registered successfully" });
  });

  app.post('/api/login', (req, res) => {
    const { userid, password } = req.body;
    if (!userid || !password) return res.status(400).json({ error: "Missing fields" });

    // Can be email or userid
    const user = usersDB.find(u => u.userid === userid || u.email === userid);
    
    if (!user) {
      return res.status(404).json({ error: "Account not found. Please sign up first!" });
    }
    
    if (user.password !== password) {
      return res.status(401).json({ error: "Incorrect password." });
    }

    return res.json({ success: true, userid: user.userid, email: user.email });
  });
}

module.exports = { setupAuthRoutes };
