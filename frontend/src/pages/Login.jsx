
import { useState } from "react";
import {
  UserRound, UserRoundPlus,
  Mail, LockKeyhole,
  Eye, EyeOff, ArrowRight
} from "lucide-react";

export default function Login({ role, onSignup }) {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);

  function handleLogin(e) {
    e.preventDefault();

    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }

    alert(`Login attempted as ${role}`);

    // Backend authentication will be connected later.
    // Customer -> Customer Dashboard
    // Delivery Agent -> Agent Dashboard
    // Admin -> Admin Dashboard
  }

  return (
    <>

      <div className="login-heading">
        <h2>Welcome Back!</h2>
        <p>
          Login to continue your smart delivery journey
        </p>
        <small>Signing in as: <b>{role}</b></small>
      </div>

      <form onSubmit={handleLogin}>

        {/* EMAIL */}
        <div className="input-box">
          <Mail size={24} />

          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {/* PASSWORD */}
        <div className="input-box">

          <LockKeyhole size={24} />

          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="button"
            className="eye-button"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <Eye /> : <EyeOff />}
          </button>

        </div>

        {/* REMEMBER ME */}
        <div className="form-options">

          <label>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Remember Me
          </label>

          <button
            type="button"
            className="forgot-button"
            onClick={() => alert("Forgot password feature coming soon.")}
          >
            Forgot Password?
          </button>

        </div>

        {/* LOGIN BUTTON */}
        <button className="login-submit" type="submit">
          Login <ArrowRight size={23} />
        </button>

      </form>

      {/* DIVIDER */}
      <div className="divider">
        <span></span>
        or
        <span></span>
      </div>

      {/* SOCIAL LOGIN */}
      <div className="social-buttons">

        <button
          type="button"
          onClick={() => alert("Google authentication coming soon.")}
        >
          <span className="google-logo">G</span>
          Continue with Google
        </button>

        <button
          type="button"
          onClick={() => alert("Apple authentication coming soon.")}
        >
          <span className="apple-logo">●</span>
          Continue with Apple
        </button>

      </div>

      {/* SIGNUP LINK */}
      <p className="signup-text">
        Don't have an account?
        <button onClick={onSignup}> Sign Up</button>
      </p>

    </>
  );
}
