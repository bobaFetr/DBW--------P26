"use client";

import { useEffect, useState } from "react";

export default function AdminLogin({ onLogin, onRegisterContentAdmin, initialNotice = "" }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(initialNotice);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await onLogin(username.trim(), password);
      } else {
        await onRegisterContentAdmin({
          username: username.trim(),
          email: email.trim(),
          displayName: displayName.trim(),
          password
        });
        setNotice("Your content admin request was sent to the super admin.");
        setMode("login");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setPassword("");
      setIsSubmitting(false);
    }
  }

  const isLogin = mode === "login";

  useEffect(() => {
    setNotice(initialNotice);
  }, [initialNotice]);

  return (
    <section className="admin-login-wrap">
      <div className="admin-login-box">
        <span className="eyebrow">Admin</span>
        <h2 className="section-title">{isLogin ? "Sign In" : "Request Access"}</h2>
        <div className="admin-actions">
          <button type="button" onClick={() => setMode("login")}>
            Sign In
          </button>
          <button type="button" onClick={() => setMode("request")}>
            Content Admin Signup
          </button>
        </div>
        <form className="admin-login-form" onSubmit={handleSubmit}>
          <label>
            <span>{isLogin ? "Email or username" : "Username"}</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          {!isLogin && (
            <>
              <label>
                <span>Display name</span>
                <input
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
            </>
          )}
          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={isLogin ? undefined : 12}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="admin-login-error" role="alert">{error}</p>}
          {notice && <p className="admin-empty-state">{notice}</p>}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Working..." : isLogin ? "Sign In" : "Create Request"}
          </button>
        </form>
      </div>
    </section>
  );
}
