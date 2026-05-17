"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  type AuthError,
} from "firebase/auth";
import Link from "next/link";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Building2,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuthStore, getOnboardingStep } from "@/lib/store";
import { UserService } from "@/lib/services/user-service";
import { getWebDeviceToken } from "@/lib/device-token";
import { saveApiAuthToken } from "@/lib/api-auth-token";

type AuthMode = "signIn" | "signUp" | "forgot";

const STEP_ROUTES: Record<string, string> = {
  interests: "/onboarding/interests",
  username: "/onboarding/username",
};

function firebaseErrorToFrench(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as AuthError).code
      : "";
  switch (code) {
    case "auth/user-not-found":
      return "Aucun compte trouvé avec cet email. Vérifiez l'adresse ou créez un compte.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email ou mot de passe incorrect. Veuillez réessayer.";
    case "auth/email-already-in-use":
      return "Un compte existe déjà avec cet email. Essayez de vous connecter.";
    case "auth/weak-password":
      return "Le mot de passe doit contenir au moins 6 caractères.";
    case "auth/invalid-email":
      return "L'adresse email n'est pas valide.";
    case "auth/too-many-requests":
      return "Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.";
    case "auth/network-request-failed":
      return "Problème de connexion réseau. Vérifiez votre connexion internet.";
    case "auth/popup-closed-by-user":
      return "";
    case "auth/popup-blocked":
      return "Le popup de connexion a été bloqué. Autorisez les popups pour ce site.";
    case "auth/unauthorized-domain":
      return "Ce domaine web n'est pas autorise dans Firebase Authentication. Ajoutez le domaine actuel dans Firebase Console > Authentication > Settings > Authorized domains.";
    case "auth/account-exists-with-different-credential":
      return "Un compte existe avec cet email mais via un autre mode de connexion.";
    case "auth/user-disabled":
      return "Ce compte a été désactivé. Contactez le support.";
    default:
      if (code) return `Erreur d'authentification (${code.replace("auth/", "")}).`;
      return "Une erreur est survenue. Veuillez réessayer.";
  }
}

// ─── Particle Canvas ───────────────────────────────────────────────────────────
type ParticlePoint = { x: number; y: number };
type ParticleBounds = { width: number; height: number };

class AuthParticle {
  x = 0;
  y = 0;
  r = 0;
  speed = 0;
  vx = 0;
  color = "";
  alpha = 0;
  pulse = 0;

  constructor(
    private readonly getBounds: () => ParticleBounds,
    private readonly getMouse: () => ParticlePoint,
    private readonly colors: string[],
    init = false,
  ) {
    this.reset(init);
  }

  reset(init = false) {
    const { width, height } = this.getBounds();
    this.x = Math.random() * width;
    this.y = init ? Math.random() * height : height + 10;
    this.r = Math.random() * 1.8 + 0.3;
    this.speed = Math.random() * 0.35 + 0.08;
    this.vx = (Math.random() - 0.5) * 0.25;
    this.color = this.colors[Math.floor(Math.random() * this.colors.length)];
    this.alpha = Math.random() * 0.55 + 0.1;
    this.pulse = Math.random() * Math.PI * 2;
  }

  update() {
    const { width } = this.getBounds();
    this.pulse += 0.018;
    const { x: mx, y: my } = this.getMouse();
    const dx = this.x - mx;
    const dy = this.y - my;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0 && dist < 100) {
      const f = (100 - dist) / 100;
      this.x += (dx / dist) * f * 1.2;
      this.y += (dy / dist) * f * 1.2;
    }

    this.y -= this.speed;
    this.x += this.vx;
    const a = Math.sin(this.pulse) * 0.12;
    this.alpha = Math.max(0, (this.alpha + a) * 0.99);

    if (this.y < -10 || this.x < -10 || this.x > width + 10) {
      this.reset(false);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fill();
    ctx.restore();
  }
}

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -999, y: -999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0, H = 0, animId = 0;
    const COLORS = ["#00e5ff", "#7b2fff", "#ff6bac", "#00e5b0", "#a78bfa"];

    const getBounds = () => ({ width: W, height: H });
    const getMouse = () => mouseRef.current;
    const particles: AuthParticle[] = [];

    function resize() {
      W = canvas!.width = window.innerWidth;
      H = canvas!.height = window.innerHeight;
    }

    function drawGrid() {
      if (!ctx) return;
      ctx.save();
      ctx.strokeStyle = "rgba(0,229,255,0.035)";
      ctx.lineWidth = 0.5;
      const sz = 80;
      for (let x = 0; x < W; x += sz) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += sz) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.restore();
    }

    function drawConnections() {
      if (!ctx) return;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < Math.min(i + 6, particles.length); j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 110) {
            ctx.save();
            ctx.globalAlpha = (1 - d / 110) * 0.1;
            ctx.strokeStyle = "#00e5ff";
            ctx.lineWidth = 0.4;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    }

    function animate() {
      if (!ctx) return;
      ctx.fillStyle = "rgba(3,10,20,0.14)";
      ctx.fillRect(0, 0, W, H);
      drawGrid();
      particles.forEach(p => { p.update(); p.draw(ctx); });
      drawConnections();
      animId = requestAnimationFrame(animate);
    }

    const onMouseMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", resize);
    resize();
    for (let i = 0; i < 130; i++) particles.push(new AuthParticle(getBounds, getMouse, COLORS, true));
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      style={{ background: "#030a14" }}
    />
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="relative flex-1 min-w-[80px] rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 backdrop-blur-xl overflow-hidden">
      <div
        className="absolute inset-0 opacity-5"
        style={{ background: `radial-gradient(circle at top left, ${color}, transparent)` }}
      />
      <div className="mb-1 h-1 w-1 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      <p className="text-base font-black tracking-tight text-white">{value}</p>
      <p className="mt-0 text-[10px] text-white/50">{label}</p>
    </div>
  );
}

// ─── Feature Row ───────────────────────────────────────────────────────────────
function FeatureRow({ icon, text, accent }: { icon: string; text: string; accent: string }) {
  return (
    <div
      className="group flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2 backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08] cursor-default"
    >
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-xs border"
        style={{
          background: `${accent}18`,
          borderColor: `${accent}44`,
        }}
      >
        {icon}
      </div>
      <span className="text-[12px] font-medium text-white/75 group-hover:text-white/95 transition-colors">{text}</span>
    </div>
  );
}

// ─── Main Auth Page ────────────────────────────────────────────────────────────
export default function AuthPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const navigateAfterAuth = useCallback(
    (user: Parameters<typeof setUser>[0]) => {
      setUser(user);
      const step = getOnboardingStep(user);
      if (step === "complete") {
        router.replace("/feed");
      } else {
        router.replace(STEP_ROUTES[step]);
      }
    },
    [setUser, router]
  );

  const registerWithBackend = useCallback(
    async (identity: string, fullName: string | null, loginType: number) => {
      const deviceToken = getWebDeviceToken();
      const res = await UserService.addUser(identity, fullName, loginType, deviceToken);
      if (res.data) {
        saveApiAuthToken(res.auth_token);
        navigateAfterAuth(res.data);
      } else {
        setError(res.message || "L'inscription a échoué. Veuillez réessayer.");
      }
    },
    [navigateAfterAuth]
  );

  const handleGoogleSignIn = async () => {
    setError(""); setSuccess(""); setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const u = result.user;
      await registerWithBackend(u.email ?? u.uid, u.displayName, 0);
    } catch (err: unknown) {
      const msg = firebaseErrorToFrench(err);
      if (msg) setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.email.trim()) { setError("Veuillez saisir votre adresse email."); return; }
    setIsLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user);
        setError("Votre email n'est pas encore vérifié. Un nouveau lien de vérification vient d'être envoyé.");
        setIsLoading(false);
        return;
      }
      await registerWithBackend(form.email.trim(), null, 2);
    } catch (err: unknown) {
      setError(firebaseErrorToFrench(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.fullName.trim()) { setError("Veuillez saisir votre nom complet."); return; }
    if (!form.email.trim()) { setError("Veuillez saisir votre adresse email."); return; }
    if (form.password.length < 6) { setError("Le mot de passe doit contenir au moins 6 caractères."); return; }
    if (form.password !== form.confirmPassword) { setError("Les mots de passe ne correspondent pas."); return; }
    setIsLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      await sendEmailVerification(cred.user);
      const deviceToken = getWebDeviceToken();
      await UserService.addUser(form.email.trim(), form.fullName.trim(), 2, deviceToken);
      setSuccess("Compte créé. Vérifiez votre email, puis connectez-vous.");
      setMode("signIn");
      setForm({ ...form, password: "", confirmPassword: "" });
    } catch (err: unknown) {
      setError(firebaseErrorToFrench(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.email.trim()) { setError("Veuillez saisir votre adresse email."); return; }
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, form.email.trim());
      setSuccess("Lien de réinitialisation envoyé. Vérifiez votre email.");
      setMode("signIn");
    } catch (err: unknown) {
      setError(firebaseErrorToFrench(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit =
    mode === "signIn" ? handleEmailSignIn
    : mode === "signUp" ? handleEmailSignUp
    : handleForgotPassword;

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setError("");
    setSuccess("");
  };

  const titles: Record<AuthMode, { heading: string; sub: string }> = {
    signIn: { heading: "Bon retour parmi nous", sub: "Connectez-vous pour continuer sur ITGA" },
    signUp: { heading: "Créez votre compte", sub: "Rejoignez la communauté des femmes dans la tech" },
    forgot: { heading: "Mot de passe oublié", sub: "Recevez un lien de réinitialisation par email" },
  };

  return (
    <>
      <style>{`
        @keyframes gradShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes shineSlide {
          0%   { left: -80%; }
          100% { left: 200%; }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(28px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.75); }
        }
        .auth-card-in  { animation: cardIn 0.65s cubic-bezier(0.16,1,0.3,1) forwards; }
        .auth-fade-up  { animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .btn-grad {
          background: linear-gradient(135deg,#00c4d4,#7b2fff,#c0356b,#00c4d4);
          background-size: 300% 300%;
          animation: gradShift 4s ease infinite;
        }
        .btn-grad:hover { transform: translateY(-1px); box-shadow: 0 10px 36px rgba(123,47,255,0.45); }
        .btn-grad:active { transform: translateY(0); }
        .btn-shine::after {
          content:''; position:absolute; top:0; left:-80%; width:55%; height:100%;
          background: linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent);
          transform: skewX(-20deg);
          animation: shineSlide 3.5s infinite;
        }
        .tab-active {
          background: linear-gradient(135deg,rgba(0,229,255,0.12),rgba(167,139,250,0.12));
          color: #fff !important;
          border: 1px solid rgba(0,229,255,0.3) !important;
        }
        .inp-field {
          width:100%; height:36px;
          background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.1);
          border-radius:10px;
          padding: 0 12px 0 32px;
          color:#fff; font-size:12px; outline:none;
          transition: border-color .25s, background .25s, box-shadow .25s;
        }
        .inp-field::placeholder { color: rgba(100,130,160,0.8); font-size:11px; }
        .inp-field:focus {
          border-color: rgba(0,229,255,0.5);
          background: rgba(0,229,255,0.05);
          box-shadow: 0 0 0 3px rgba(0,229,255,0.08);
        }
      `}</style>

      <div className="relative h-[100dvh] overflow-hidden" style={{ background: "#030a14", color: "#fff" }}>
        <ParticleCanvas />

        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full opacity-20"
            style={{ background: "radial-gradient(circle,#00e5ff,transparent 70%)", filter: "blur(80px)" }} />
          <div className="absolute -bottom-40 right-0 h-[400px] w-[400px] rounded-full opacity-15"
            style={{ background: "radial-gradient(circle,#7b2fff,transparent 70%)", filter: "blur(80px)" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full opacity-5"
            style={{ background: "radial-gradient(circle,#ff6bac,transparent 70%)" }} />
        </div>

        <div className="relative z-10 grid h-full lg:grid-cols-[1.1fr_0.9fr]">

          {/* LEFT PANEL - scaled for 100% zoom */}
          <section className="hidden lg:flex flex-col justify-center px-10 py-1 xl:px-14">
            <div className="auth-fade-up mb-8 flex items-center gap-3" style={{ animationDelay: "0.05s" }}>
              <Image
                src="/itga_logo.png"
                alt="ITGA"
                width={106}
                height={56}
                className="object-contain"
                style={{ height: "auto" }}
                priority
              />
              <div className="text-[9px] tracking-[0.15em] text-white/40">IT Girls</div>
              <div className="ml-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-white/50">
                Academy
              </div>
            </div>

            <div className="auth-fade-up mb-3" style={{ animationDelay: "0.12s" }}>
              <h1 className="text-[clamp(26px,3.5vw,46px)] font-black leading-[1.1] tracking-[-0.03em]">
                La communauté<br />
                <span style={{ background: "linear-gradient(90deg,#00e5ff 0%,#a78bfa 45%,#ff6bac 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  des femmes
                </span><br />
                dans la tech
              </h1>
              <p className="mt-3 max-w-[340px] text-[13px] leading-relaxed text-white/50">
                Réseau social, mentorat intelligent et opportunités professionnelles. Tout ce qu&apos;il faut pour évoluer dans l&apos;écosystème tech.
              </p>
            </div>

            <div className="auth-fade-up mb-6 flex gap-2" style={{ animationDelay: "0.2s" }}>
              <StatCard value="15K+" label="Membres actives" color="#00e5ff" />
              <StatCard value="120K" label="Posts partagés" color="#a78bfa" />
              <StatCard value="50+" label="Pays" color="#ff6bac" />
            </div>

            <div className="auth-fade-up flex flex-col gap-2" style={{ animationDelay: "0.28s" }}>
              <FeatureRow icon="🌐" text="Social Feed · Reels · Rooms en temps réel" accent="#00e5ff" />
              <FeatureRow icon="💼" text="Tech Jobs · Mentorat · Matching intelligent" accent="#a78bfa" />
              <FeatureRow icon="🎯" text="Conférences · Événements · Communautés" accent="#ff6bac" />
            </div>
          </section>

          {/* RIGHT AUTH CARD - scaled for 100% zoom */}
          <section className="flex h-full items-center justify-center px-4 py-5 sm:px-6">
            <div
              className={`auth-card-in w-full max-w-[380px] relative overflow-hidden rounded-[22px] p-5 sm:p-6`}
              style={{
                background: "linear-gradient(145deg,rgba(255,255,255,0.07) 0%,rgba(255,255,255,0.03) 100%)",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(48px)",
                WebkitBackdropFilter: "blur(48px)",
                boxShadow: "0 0 80px rgba(0,229,255,0.06), 0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            >
              <div className="pointer-events-none absolute -top-20 -right-20 h-52 w-52 rounded-full opacity-30"
                style={{ background: "radial-gradient(circle,#00e5ff,transparent 70%)", filter: "blur(40px)" }} />
              <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full opacity-20"
                style={{ background: "radial-gradient(circle,#a78bfa,transparent 70%)", filter: "blur(40px)" }} />

              <div className="mb-4 flex items-center justify-center gap-3 lg:hidden">
                <Image src="/itga_logo.png" alt="ITGA" width={80} height={43} className="object-contain" style={{ height: "auto" }} priority />
              </div>

              {mode !== "signIn" && (
                <button
                  onClick={() => switchMode("signIn")}
                  className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-white/50 transition-colors hover:text-white/90"
                >
                  <ArrowLeft size={12} /> Retour à la connexion
                </button>
              )}

              <div className="mb-3 inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5"
                style={{ background: "rgba(0,229,255,0.08)", borderColor: "rgba(0,229,255,0.25)" }}>
                <span className="h-1 w-1 rounded-full" style={{ background: "#00e5ff", boxShadow: "0 0 5px #00e5ff", animation: "pulseDot 1.5s infinite" }} />
                <span className="text-[9px] font-semibold tracking-[0.16em] text-[#00e5ffcc]">CONNEXION SÉCURISÉE</span>
              </div>

              <h2 className="text-[18px] font-black tracking-tight text-white">{titles[mode].heading}</h2>
              <p className="mb-3 mt-0.5 text-[11px] leading-relaxed text-white/50">{titles[mode].sub}</p>

              {success && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-2.5">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-300" />
                  <p className="text-[11px] leading-relaxed text-emerald-100/90">{success}</p>
                </div>
              )}
              {error && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 p-2.5">
                  <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-300" />
                  <p className="text-[11px] leading-relaxed text-rose-100/90">{error}</p>
                </div>
              )}

              {mode !== "forgot" && (
                <div className="mb-4 flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1">
                  {(["signIn", "signUp"] as AuthMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => switchMode(m)}
                      className={`flex-1 rounded-lg py-1.5 text-[12px] font-semibold transition-all duration-250 ${mode === m ? "tab-active" : "text-white/40 hover:text-white/70"}`}
                    >
                      {m === "signIn" ? "Se connecter" : "S'inscrire"}
                    </button>
                  ))}
                </div>
              )}

              {mode !== "forgot" && (
                <>
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="mb-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl border font-semibold text-[12px] text-[#14263f] transition-all hover:shadow-[0_0_20px_rgba(0,229,255,0.2)] disabled:opacity-50"
                    style={{ background: "rgba(255,255,255,0.95)", borderColor: "rgba(255,255,255,0.2)" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {mode === "signIn" ? "Se connecter avec Google" : "S'inscrire avec Google"}
                  </button>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.1)" }} />
                    <span className="text-[9px] font-semibold tracking-[0.14em] text-white/30">OU PAR EMAIL</span>
                    <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.1)" }} />
                  </div>
                </>
              )}

              <form onSubmit={handleSubmit} className="space-y-2.5">
                {mode === "signUp" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <User size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                      <input
                        className="inp-field"
                        type="text"
                        placeholder="Nom complet"
                        value={form.fullName}
                        onChange={e => setForm({ ...form, fullName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="relative">
                      <Mail size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                      <input
                        className="inp-field"
                        type="email"
                        placeholder="Email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                )}

                {mode !== "signUp" && (
                  <div className="relative">
                    <Mail size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      className="inp-field"
                      type="email"
                      placeholder="Adresse email"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      required
                      autoFocus={mode === "signIn"}
                    />
                  </div>
                )}

                {mode === "signIn" && (
                  <div className="relative">
                    <Lock size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      className="inp-field"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mot de passe"
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      required
                      minLength={6}
                      style={{ paddingRight: "36px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white/70"
                    >
                      {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                )}

                {mode === "signUp" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <Lock size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                      <input
                        className="inp-field"
                        type={showPassword ? "text" : "password"}
                        placeholder="Mot de passe"
                        value={form.password}
                        onChange={e => setForm({ ...form, password: e.target.value })}
                        required
                        minLength={6}
                        style={{ paddingRight: "36px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white/70"
                      >
                        {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                      <input
                        className="inp-field"
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirmer"
                        value={form.confirmPassword}
                        onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                )}

                {mode === "signIn" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-[10px] font-semibold text-white/40 transition-colors hover:text-[#00e5ff]"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-grad btn-shine relative mt-0.5 flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-[13px] font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ boxShadow: "0 4px 20px rgba(123,47,255,0.35)" }}
                >
                  {isLoading ? (
                    <>
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Chargement…
                    </>
                  ) : (
                    <>
                      {mode === "signIn" ? "Se connecter" : mode === "signUp" ? "Créer mon compte" : "Envoyer le lien"}
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>

              {mode !== "forgot" && (
                <p className="mt-3 text-center text-[11px] text-white/35">
                  {mode === "signIn" ? "Pas encore de compte ? " : "Déjà un compte ? "}
                  <button
                    onClick={() => switchMode(mode === "signIn" ? "signUp" : "signIn")}
                    className="font-bold text-[#00e5ff] hover:underline"
                  >
                    {mode === "signIn" ? "S'inscrire" : "Se connecter"}
                  </button>
                </p>
              )}

              {/* Company portal link */}
              <div className="mt-3 flex items-center gap-2">
                <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.08)" }} />
                <span className="text-[9px] font-semibold tracking-[0.14em] text-white/25">ENTREPRISE</span>
                <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.08)" }} />
              </div>
              <Link
                href="/company/auth"
                className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-white/70 transition-all hover:border-[#00e5ff]/30 hover:bg-white/[0.06] hover:text-white"
              >
                <Building2 size={13} className="text-[#00e5ff]" />
                <span>Se connecter en tant qu&apos;entreprise</span>
                <ArrowRight size={11} className="text-white/40" />
              </Link>

              <p className="mt-2 text-center text-[9px] leading-relaxed text-white/25">
                En continuant, vous acceptez nos{" "}
                <a href="https://itga.kekottech.com/termsOfUse" target="_blank" rel="noopener noreferrer" className="text-white/45 hover:text-[#00e5ff] transition-colors">
                  Conditions d&apos;utilisation
                </a>{" "}
                et notre{" "}
                <a href="https://itga.kekottech.com/privacyPolicy" target="_blank" rel="noopener noreferrer" className="text-white/45 hover:text-[#00e5ff] transition-colors">
                  Politique de confidentialité
                </a>
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
