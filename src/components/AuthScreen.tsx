import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Moon, Sun, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";

import type { Theme } from "../hooks/useTheme";
import logo from "../logo.png";

type AuthMode = "login" | "register";

const USERS_KEY = "helio-users";

type DemoUser = { name: string; email: string; password: string };

function getUsers(): DemoUser[] {
  try {
    return JSON.parse(window.localStorage.getItem(USERS_KEY) ?? "[]") as DemoUser[];
  } catch {
    return [];
  }
}

export function AuthScreen({
  theme,
  onToggleTheme,
  onAuthenticated,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  onAuthenticated: (name: string) => void;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    const users = getUsers();

    if (mode === "register") {
      if (!name.trim()) return setError("Enter your full name.");
      if (users.some((user) => user.email === normalizedEmail)) {
        return setError("An account already exists for this email.");
      }
      const user = { name: name.trim(), email: normalizedEmail, password };
      window.localStorage.setItem(USERS_KEY, JSON.stringify([...users, user]));
      onAuthenticated(user.name);
      return;
    }

    const user = users.find((candidate) => candidate.email === normalizedEmail && candidate.password === password);
    if (!user) return setError("Email or password is incorrect.");
    onAuthenticated(user.name);
  }

  return (
    <main className="auth-shell min-h-screen px-5 py-6 sm:px-10">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Helio" className="h-12 w-12 rounded-2xl object-cover" />
          <div>
            <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Helio</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Hospital capacity, made clear.</p>
          </div>
        </div>
        <button className="theme-toggle" onClick={onToggleTheme} aria-label="Toggle theme">
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-116px)] max-w-[1180px] items-center gap-12 py-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:block">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
            <span className="h-2 w-2 rounded-full bg-teal-500" /> Live operations platform
          </div>
          <h1 className="max-w-xl text-6xl font-bold leading-[0.98] tracking-[-0.04em] text-slate-900 dark:text-white">
            Keep every patient moving.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600 dark:text-slate-300">
            See capacity, understand the bottleneck, and make safer decisions across the hospital in one calm workspace.
          </p>
          <div className="mt-10 flex gap-8 text-sm text-slate-500 dark:text-slate-400">
            <span><strong className="block text-2xl text-slate-900 dark:text-white">24/7</strong> operational visibility</span>
            <span><strong className="block text-2xl text-slate-900 dark:text-white">1</strong> source of truth</span>
          </div>
        </section>

        <section className="auth-card mx-auto w-full max-w-md">
          <div className="mb-8 flex gap-6 border-b border-slate-200 dark:border-slate-700">
            {(["login", "register"] as AuthMode[]).map((item) => (
              <button key={item} onClick={() => { setMode(item); setError(null); }} className={`auth-tab ${mode === item ? "active" : ""}`}>
                {item === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
          <div className="mb-7">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{mode === "login" ? "Welcome back" : "Start with Helio"}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{mode === "login" ? "Sign in to your hospital operations workspace." : "Create a local demo account for this prototype."}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && <label className="auth-field"><span>Full name</span><UserRound size={17} /><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Dr. Anjali Rao" /></label>}
            <label className="auth-field"><span>Work email</span><Mail size={17} /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@hospital.org" /></label>
            <label className="auth-field"><span>Password</span><LockKeyhole size={17} /><input type={showPassword ? "text" : "password"} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></label>
            {error && <p className="auth-error">{error}</p>}
            <button className="auth-submit" type="submit">{mode === "login" ? "Enter Helio" : "Create account"}<ArrowRight size={17} /></button>
          </form>
          <p className="mt-6 text-center text-xs text-slate-400">For prototype use only. Account data stays in this browser.</p>
        </section>
      </div>
    </main>
  );
}