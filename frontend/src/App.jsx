
import { useState } from "react";
import {
  Package, Clock3, MapPin, ShieldCheck, Truck,
  Mail, LockKeyhole, Eye, EyeOff, ArrowRight,
  Menu, CheckCircle2
} from "lucide-react";
import "./App.css";

export default function App() {
  const [role, setRole] = useState("Customer");
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e) {
    e.preventDefault();

    if (!email || !password) {
      alert("Please enter your email and password.");
      return;
    }

    alert(`${mode === "login" ? "Login" : "Signup"} requested for ${role}. Authentication will be connected to the backend later.`);
  }

  return (
    <div className="app">
      <nav className="navbar">
        <a className="brand" href="#">
          <span className="brand-icon"><Package size={23} /></span>
          <span>Swift<span>Slot</span></span>
        </a>

        <div className="nav-links">
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <a href="#help">Help</a>
        </div>

        <a className="nav-login" href="#login">Login <ArrowRight size={15} /></a>
      </nav>

      <main className="main-content" id="home">
        <section className="hero-section">
          <div className="hero-content">
            <div className="eyebrow">
              <span className="live-dot"></span>
              SMARTER DELIVERY. YOUR WAY.
            </div>

            <h1>
              Your Delivery.<br />
              <span>Your Time.</span>
            </h1>

            <p className="hero-description">
              Book, track and manage your deliveries with complete
              flexibility. Choose a delivery time that works for you.
            </p>

            <div className="feature-list" id="features">
              <div className="feature">
                <span className="feature-icon"><Clock3 size={20} /></span>
                <div>
                  <strong>Choose Your Time Slot</strong>
                  <small>Delivery when it suits you</small>
                </div>
              </div>

              <div className="feature">
                <span className="feature-icon"><MapPin size={20} /></span>
                <div>
                  <strong>Track in Real Time</strong>
                  <small>Know exactly where your parcel is</small>
                </div>
              </div>

              <div className="feature">
                <span className="feature-icon"><ShieldCheck size={20} /></span>
                <div>
                  <strong>Safe & Reliable</strong>
                  <small>Your parcels are in trusted hands</small>
                </div>
              </div>
            </div>

            <div className="hero-art">
              <div className="art-circle"></div>
              <div className="art-package package-one"><Package size={40} /></div>
              <div className="art-package package-two"><Package size={27} /></div>
              <div className="art-route route-one"></div>
              <div className="art-route route-two"></div>
              <div className="delivery-rider">🛵</div>
              <div className="art-label">
                <CheckCircle2 size={16} />
                <span>On-time delivery, every time</span>
              </div>
            </div>

            <div className="trust-line">
              <div className="trust-avatars">
                <span>R</span><span>A</span><span>S</span>
              </div>
              <p><strong>Smarter deliveries.</strong> Happier customers.</p>
            </div>
          </div>
        </section>

        <section className="auth-section" id="login">
          <div className="auth-card">
            <div className="auth-heading">
              <span className="auth-kicker">WELCOME TO SWIFTSLOT</span>
              <h2>{mode === "login" ? "Welcome Back!" : "Create Account"}</h2>
              <p>
                {mode === "login"
                  ? "Login to continue your smart delivery journey."
                  : "Create your account and experience smarter delivery."}
              </p>
            </div>

            <div className="role-heading">Continue as</div>
            <div className="role-selector">
              {["Customer", "Delivery Agent", "Admin"].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`role-button ${role === item ? "active" : ""}`}
                  onClick={() => setRole(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="role-caption">
              Signing in as <strong>{role}</strong>
            </div>

            <div className="auth-tabs">
              <button
                className={mode === "login" ? "tab active" : "tab"}
                onClick={() => setMode("login")}
              >
                Login
              </button>
              <button
                className={mode === "signup" ? "tab active" : "tab"}
                onClick={() => setMode("signup")}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="input-label">Email Address</label>
              <div className="input-wrap">
                <Mail size={19} />
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <label className="input-label">Password</label>
              <div className="input-wrap">
                <LockKeyhole size={19} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="eye-button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>

              <div className="form-options">
                <label className="remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  className="forgot"
                  onClick={() => alert("Password recovery will be connected later.")}
                >
                  Forgot Password?
                </button>
              </div>

              <button type="submit" className="primary-button">
                {mode === "login" ? "Login to Account" : "Create Account"}
                <ArrowRight size={19} />
              </button>
            </form>

            <div className="divider"><span>OR CONTINUE WITH</span></div>

            <div className="social-buttons">
              <button type="button" onClick={() => alert("Google login will be integrated later.")}>
                <span className="google-logo">G</span>
                Google
              </button>
              <button type="button" onClick={() => alert("Apple login will be integrated later.")}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M16.4 12.8c0-2.1 1.7-3.1 1.8-3.2-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.7-.4 6.7 1.1 8.9.7 1.1 1.5 2.3 2.6 2.2 1-.1 1.4-.7 2.7-.7s1.7.7 2.8.7c1.2 0 1.9-1.1 2.6-2.2.8-1.2 1.1-2.4 1.1-2.5-.1 0-2.4-.9-2.4-3.7ZM14.2 6.5c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-.9 2.8 1 .1 2-.5 2.7-1.3Z"/>
                </svg>
                Apple
              </button>
            </div>

            <p className="signup-text">
              {mode === "login" ? "Don't have an account?" : "Already have an account?"}
              <button onClick={() => setMode(mode === "login" ? "signup" : "login")}>
                {mode === "login" ? "Sign Up" : "Login"}
              </button>
            </p>

            <div className="security-note">
              <ShieldCheck size={15} />
              Your information is protected and secure
            </div>
          </div>
        </section>
      </main>

      <footer className="footer" id="help">
        <div className="footer-brand">
          <Package size={18} />
          <strong>SwiftSlot</strong>
        </div>
        <p>Smarter scheduling. Better delivery.</p>
        <span>© 2026 SwiftSlot. All rights reserved.</span>
      </footer>
    </div>
  );
}
