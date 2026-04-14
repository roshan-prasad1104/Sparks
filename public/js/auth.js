const splashScreen = document.getElementById('splash-screen');

function enterApp() {
  switchScreen(splashScreen, authLoginScreen);
}

function switchToLogin() {
  switchScreen(signupScreen, authLoginScreen);
}

function switchToSignup() {
  switchScreen(authLoginScreen, signupScreen);
}

function mockGoogleLogin() {
  alert("Google Auth is connecting... (Mock success!)");
  const activeScreen = document.querySelector('.screen.active');
  document.getElementById('player-name-input').value = 'GooglePartner';
  switchScreen(activeScreen, nameScreen);
}

async function doSignup() {
  const email = document.getElementById('signup-email').value.trim();
  const userid = document.getElementById('signup-userid').value.trim();
  const pass = document.getElementById('signup-password').value;
  const confPass = document.getElementById('signup-confirm-password').value;

  if (!email || !userid || !pass) {
    alert("Please fill in all fields.");
    return;
  }
  if (pass !== confPass) {
    alert("Passwords do not match!");
    return;
  }
  
  try {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, userid, password: pass })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Registration failed");
    } else {
      alert("Registration successful for " + userid + "! You can now log in.");
      switchToLogin();
    }
  } catch(e) {
    alert("Error connecting to server");
  }
}

async function doAuthLogin() {
  const userid = document.getElementById('login-userid').value.trim();
  const pass = document.getElementById('login-password').value;
  
  if (!userid || !pass) {
    alert("Please enter both User ID and Password.");
    return;
  }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userid, password: pass })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Login failed");
    } else {
      document.getElementById('player-name-input').value = data.userid;
      switchScreen(authLoginScreen, nameScreen);
    }
  } catch(e) {
    alert("Error connecting to server");
  }
}

function doNameEntry() {
  const nameInput = document.getElementById('player-name-input').value.trim();
  if (!nameInput) {
    alert("Please enter a name");
    return;
  }
  playerName = nameInput;
  lobbyGreeting.innerText = "Welcome, " + playerName + "!";
  socket.emit('set-name', playerName);
  switchScreen(nameScreen, lobbyScreen);
}
