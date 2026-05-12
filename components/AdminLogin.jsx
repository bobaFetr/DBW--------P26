"use client";

import { useState } from "react";

export default function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const ok = onLogin(username.trim(), password);
    if (!ok) {
      setError("Invalid username or password.");
      setPassword("");
    }
  }

  return (
    <section className="admin-login-wrap">
      <div className="admin-login-box">
        <span className="eyebrow">Admin</span>
        <h2 className="section-title">Sign In</h2>
        <form className="admin-login-form" onSubmit={handleSubmit} noValidate>
          <label>
            <span>Username</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="admin-login-error" role="alert">{error}</p>}
          <button type="submit">Sign In</button>
        </form>
      </div>
    </section>
  );
}
