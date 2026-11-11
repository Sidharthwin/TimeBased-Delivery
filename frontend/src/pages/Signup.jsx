
import { useState } from "react";
import { User, Mail, Phone, LockKeyhole } from "lucide-react";

export default function Signup({ onSwitch }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: ""
  });

  function update(field, value) {
    setForm({
      ...form,
      [field]: value
    });
  }

  function handleSignup(e) {
    e.preventDefault();

    if (Object.values(form).some(value => !value.trim())) {
      alert("Please fill all fields.");
      return;
    }

    if (form.password.length < 8) {
      alert("Password must have at least 8 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    alert("Customer registration UI working!");
  }

  return (
    <>
      <div className="auth-tabs">
        <button className="auth-tab" onClick={onSwitch}>
          Login
        </button>

        <button className="auth-tab active">
          Sign Up
        </button>
      </div>

      <div className="auth-heading">
        <h2>Create Account</h2>
        <p>Join SwiftSlot today!</p>
      </div>

      <form onSubmit={handleSignup}>

        <label className="input-wrap">
          <User size={21} />
          <input
            placeholder="Full Name"
            value={form.name}
            onChange={e => update("name", e.target.value)}
          />
        </label>

        <label className="input-wrap">
          <Mail size={21} />
          <input
            type="email"
            placeholder="Email Address"
            value={form.email}
            onChange={e => update("email", e.target.value)}
          />
        </label>

        <label className="input-wrap">
          <Phone size={21} />
          <input
            type="tel"
            placeholder="Phone Number"
            value={form.phone}
            onChange={e => update("phone", e.target.value)}
          />
        </label>

        <label className="input-wrap">
          <LockKeyhole size={21} />
          <input
            type="password"
            placeholder="Create Password"
            value={form.password}
            onChange={e => update("password", e.target.value)}
          />
        </label>

        <label className="input-wrap">
          <LockKeyhole size={21} />
          <input
            type="password"
            placeholder="Confirm Password"
            value={form.confirmPassword}
            onChange={e => update("confirmPassword", e.target.value)}
          />
        </label>

        <button className="primary-submit" type="submit">
          Create Account →
        </button>

      </form>

      <p className="switch-copy">
        Already have an account?
        <button onClick={onSwitch}> Login</button>
      </p>
    </>
  );
}
