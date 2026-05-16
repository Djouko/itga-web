"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Mail,
  Lock,
  User as UserIcon,
  Briefcase,
  ArrowLeft,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { CompanyService } from "@/lib/services/company-service";
import { useAuthStore, useTranslation } from "@/lib/store";
import type { Company, User } from "@/lib/types";
import { getWebDeviceToken } from "@/lib/device-token";
import { saveApiAuthToken } from "@/lib/api-auth-token";

type Mode = "login" | "register" | "verify";
type CompanyAuthMeta = {
  message?: string;
  auth_token?: string | null;
  owner_user?: User | null;
  owner_user_auto_created?: boolean;
  owner_user_auto_linked?: boolean;
};

const COMPANY_NOTICE_KEY = "itga-company-notice";

type ParticlePoint = { x: number; y: number };
type ParticleBounds = { width: number; height: number };

class CompanyAuthParticle {
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
    const context = ctx;

    let W = 0;
    let H = 0;
    let animId = 0;
    const COLORS = ["#00e5ff", "#5DCCC6", "#2AABAB", "#a78bfa", "#ff6bac"];

    const getBounds = () => ({ width: W, height: H });
    const getMouse = () => mouseRef.current;
    const particles: CompanyAuthParticle[] = [];

    function resize() {
      W = canvas!.width = window.innerWidth;
      H = canvas!.height = window.innerHeight;
    }

    function drawGrid() {
      context.save();
      context.strokeStyle = "rgba(0,229,255,0.035)";
      context.lineWidth = 0.5;
      const sz = 80;
      for (let x = 0; x < W; x += sz) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, H);
        context.stroke();
      }
      for (let y = 0; y < H; y += sz) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(W, y);
        context.stroke();
      }
      context.restore();
    }

    function drawConnections() {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < Math.min(i + 6, particles.length); j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 110) {
            context.save();
            context.globalAlpha = (1 - d / 110) * 0.1;
            context.strokeStyle = "#00e5ff";
            context.lineWidth = 0.4;
            context.beginPath();
            context.moveTo(particles[i].x, particles[i].y);
            context.lineTo(particles[j].x, particles[j].y);
            context.stroke();
            context.restore();
          }
        }
      }
    }

    function animate() {
      context.fillStyle = "rgba(3,10,20,0.14)";
      context.fillRect(0, 0, W, H);
      drawGrid();
      particles.forEach((p) => {
        p.update();
        p.draw(context);
      });
      drawConnections();
      animId = requestAnimationFrame(animate);
    }

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", resize);
    resize();
    for (let i = 0; i < 120; i++) particles.push(new CompanyAuthParticle(getBounds, getMouse, COLORS, true));
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

function StatCard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="relative min-w-[92px] flex-1 overflow-hidden rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 backdrop-blur-xl">
      <div
        className="absolute inset-0 opacity-5"
        style={{ background: `radial-gradient(circle at top left, ${color}, transparent)` }}
      />
      <div
        className="mb-1 h-1 w-1 rounded-full"
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
      <p className="text-base font-black tracking-tight text-white">{value}</p>
      <p className="mt-0 text-[10px] text-white/50">{label}</p>
    </div>
  );
}

function FeatureRow({ icon, text, accent }: { icon: string; text: string; accent: string }) {
  return (
    <div className="group flex cursor-default items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2 backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08]">
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border text-xs"
        style={{
          background: `${accent}18`,
          borderColor: `${accent}44`,
        }}
      >
        {icon}
      </div>
      <span className="text-[12px] font-medium text-white/75 transition-colors group-hover:text-white/95">
        {text}
      </span>
    </div>
  );
}

export default function CompanyAuthPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
    setNotice("");
  };

  const isStrongPassword = (value: string): boolean =>
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(value);

  const persistCompanySession = (company: Company, meta: CompanyAuthMeta) => {
    localStorage.setItem("itga-company", JSON.stringify(company));
    saveApiAuthToken(meta.auth_token);
    if (meta.owner_user) {
      setUser(meta.owner_user);
    }
    if (meta.owner_user_auto_created) {
      localStorage.setItem(
        COMPANY_NOTICE_KEY,
        "Un profil ITGA associe a ete cree automatiquement. Vous pouvez maintenant activer le mode entreprise et interagir sur le feed."
      );
    } else if (meta.owner_user_auto_linked) {
      localStorage.setItem(
        COMPANY_NOTICE_KEY,
        "Votre entreprise est maintenant associee a un profil ITGA. Le mode entreprise est disponible sur le feed."
      );
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setError("Saisissez votre email pour recevoir un nouveau code.");
      return;
    }

    setResendingCode(true);
    setError("");
    setNotice("");

    try {
      const res = await CompanyService.resendVerification(email.trim());
      if (res.status) {
        setNotice(res.message || "Nouveau code envoyé.");
      } else {
        setError(res.message || t("company.errorGeneric"));
      }
    } catch {
      setError(t("company.errorGeneric"));
    } finally {
      setResendingCode(false);
    }
  };

  const handleSubmit = async () => {
    setError("");

    if (!email.trim()) {
      setError(t("company.errorRequired"));
      return;
    }

    if (mode === "verify") {
      if (verificationCode.trim().length !== 6) {
        setError("Le code de verification doit contenir 6 chiffres.");
        return;
      }

      setLoading(true);
      try {
        const deviceToken = getWebDeviceToken();
        const res = await CompanyService.verifyEmail(email.trim(), verificationCode.trim(), user?.id, deviceToken);
        if (res.status && res.data) {
          const company = res.data as Company;
          persistCompanySession(company, res as CompanyAuthMeta);
          router.push("/company/dashboard");
          return;
        }
        setError(res.message || t("company.errorGeneric"));
      } catch {
        setError(t("company.errorGeneric"));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password.trim()) {
      setError(t("company.errorRequired"));
      return;
    }

    if (mode === "register" && !name.trim()) {
      setError(t("company.errorNameRequired"));
      return;
    }

    if (mode === "register" && !isStrongPassword(password)) {
      setError("Mot de passe faible: 8 caracteres minimum avec majuscule, minuscule, chiffre et symbole.");
      return;
    }

    setLoading(true);
    setNotice("");
    try {
      const deviceToken = getWebDeviceToken();
      let res;
      if (mode === "register") {
        res = await CompanyService.register(name.trim(), email.trim(), password, sector.trim() || undefined, user?.id, deviceToken);
      } else {
        res = await CompanyService.login(email.trim(), password, user?.id, deviceToken);
      }

      if (res.status && res.data && mode === "login") {
        const company = res.data as Company;
        persistCompanySession(company, res as CompanyAuthMeta);
        router.push("/company/dashboard");
      } else if (res.status && mode === "register") {
        setMode("verify");
        setPassword("");
        setVerificationCode("");
        setNotice(res.message || "Compte cree. Verifiez votre email avec le code recu.");
      } else {
        const payload = res as unknown as {
          message?: string;
          error_code?: string;
          data?: { email?: string };
        };

        if (payload.error_code === "email_not_verified") {
          setMode("verify");
          setNotice(payload.message || "Votre email n'est pas encore verifie. Saisissez le code recu.");
          if (payload.data?.email) setEmail(payload.data.email);
        } else {
          setError(res.message || t("company.errorGeneric"));
        }
      }
    } catch {
      setError(t("company.errorGeneric"));
    } finally {
      setLoading(false);
    }
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
          width:100%; height:38px;
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
          <div
            className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full opacity-20"
            style={{
              background: "radial-gradient(circle,#00e5ff,transparent 70%)",
              filter: "blur(80px)",
            }}
          />
          <div
            className="absolute -bottom-40 right-0 h-[400px] w-[400px] rounded-full opacity-15"
            style={{
              background: "radial-gradient(circle,#7b2fff,transparent 70%)",
              filter: "blur(80px)",
            }}
          />
          <div
            className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-5"
            style={{ background: "radial-gradient(circle,#ff6bac,transparent 70%)" }}
          />
        </div>

        <div className="relative z-10 grid h-full lg:grid-cols-[1.1fr_0.9fr]">
          <section className="hidden flex-col justify-center px-10 py-6 lg:flex xl:px-14">
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
              <div className="text-[9px] tracking-[0.15em] text-white/40">COMPANY HUB</div>
              <div className="ml-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-white/50">
                AUTH MATRIX
              </div>
            </div>

            <div className="auth-fade-up mb-3" style={{ animationDelay: "0.12s" }}>
              <h1 className="text-[clamp(26px,3.5vw,46px)] font-black leading-[1.1] tracking-[-0.03em]">
                Recrutez les
                <br />
                <span
                  style={{
                    background: "linear-gradient(90deg,#00e5ff 0%,#a78bfa 45%,#ff6bac 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  meilleurs talents
                </span>
                <br />
                en un espace
              </h1>
              <p className="mt-3 max-w-[360px] text-[13px] leading-relaxed text-white/50">
                Gérez vos offres, vos candidatures et votre marque employeur dans un environnement visuel premium.
              </p>
            </div>

            <div className="auth-fade-up mb-6 flex gap-2" style={{ animationDelay: "0.2s" }}>
              <StatCard value="20K+" label="Talents actifs" color="#00e5ff" />
              <StatCard value="8K+" label="Candidatures/mois" color="#a78bfa" />
              <StatCard value="94%" label="Retention" color="#ff6bac" />
            </div>

            <div className="auth-fade-up flex flex-col gap-2" style={{ animationDelay: "0.28s" }}>
              <FeatureRow icon="💼" text="Offres d'emploi · Pipeline candidatures" accent="#00e5ff" />
              <FeatureRow icon="🎯" text="Matching intelligent · Talents qualifiés" accent="#a78bfa" />
              <FeatureRow icon="📊" text="Suivi RH · Analytics recrutement" accent="#ff6bac" />
            </div>
          </section>

          <section className="flex h-full items-center justify-center px-4 py-5 sm:px-6">
            <div
              className={`auth-card-in relative w-full max-w-[390px] overflow-hidden rounded-[22px] p-5 sm:p-6 ${
                mounted ? "opacity-100" : "opacity-0"
              }`}
              style={{
                background:
                  "linear-gradient(145deg,rgba(255,255,255,0.07) 0%,rgba(255,255,255,0.03) 100%)",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(48px)",
                WebkitBackdropFilter: "blur(48px)",
                boxShadow:
                  "0 0 80px rgba(0,229,255,0.06), 0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            >
              <div
                className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full opacity-30"
                style={{
                  background: "radial-gradient(circle,#00e5ff,transparent 70%)",
                  filter: "blur(40px)",
                }}
              />
              <div
                className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full opacity-20"
                style={{
                  background: "radial-gradient(circle,#a78bfa,transparent 70%)",
                  filter: "blur(40px)",
                }}
              />

              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={() => router.back()}
                  className="flex items-center gap-1 text-[10px] font-semibold text-white/55 transition-colors hover:text-white/90"
                >
                  <ArrowLeft size={13} /> Retour
                </button>
                <div className="flex items-center gap-2 lg:hidden">
                  <Image
                    src="/itga_logo.png"
                    alt="ITGA"
                    width={78}
                    height={42}
                    className="object-contain"
                    style={{ height: "auto" }}
                    priority
                  />
                </div>
                <div className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-white/45">
                  COMPANY
                </div>
              </div>

              <div
                className="mb-3 inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5"
                style={{
                  background: "rgba(0,229,255,0.08)",
                  borderColor: "rgba(0,229,255,0.25)",
                }}
              >
                <span
                  className="h-1 w-1 rounded-full"
                  style={{
                    background: "#00e5ff",
                    boxShadow: "0 0 5px #00e5ff",
                    animation: "pulseDot 1.5s infinite",
                  }}
                />
                <span className="text-[9px] font-semibold tracking-[0.16em] text-[#00e5ffcc]">
                  ESPACE ENTREPRISE
                </span>
              </div>

              <h2 className="text-[18px] font-black tracking-tight text-white">
                {mode === "login"
                  ? t("company.loginTitle")
                  : mode === "register"
                    ? t("company.registerTitle")
                    : "Verification email"}
              </h2>
              <p className="mb-3 mt-0.5 text-[11px] leading-relaxed text-white/50">
                {mode === "login"
                  ? t("company.loginDesc")
                  : mode === "register"
                    ? t("company.registerDesc")
                    : "Saisissez le code a 6 chiffres recu par email pour activer votre compte entreprise."}
              </p>

              {mode !== "verify" && (
                <div className="mb-4 flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1">
                  {(["login", "register"] as Mode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => switchMode(m)}
                      className={`flex-1 rounded-lg py-1.5 text-[12px] font-semibold transition-all duration-250 ${
                        mode === m ? "tab-active" : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      {m === "login" ? t("company.login") : t("company.register")}
                    </button>
                  ))}
                </div>
              )}

              {mode === "verify" && (
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="mb-4 text-[11px] font-semibold text-[#00e5ff] hover:underline"
                >
                  Retour a la connexion
                </button>
              )}

              <div className="space-y-2.5">
                {mode === "register" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <UserIcon
                        size={13}
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30"
                      />
                      <input
                        className="inp-field"
                        type="text"
                        placeholder={t("company.nameField")}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="relative">
                      <Briefcase
                        size={13}
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30"
                      />
                      <input
                        className="inp-field"
                        type="text"
                        placeholder={t("company.sectorField")}
                        value={sector}
                        onChange={(e) => setSector(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="relative">
                  <Mail
                    size={13}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30"
                  />
                  <input
                    className="inp-field"
                    type="email"
                    placeholder={t("company.emailField")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                {mode !== "verify" && (
                  <div className="relative">
                    <Lock
                      size={13}
                      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30"
                    />
                    <input
                      className="inp-field"
                      type={showPassword ? "text" : "password"}
                      placeholder={t("company.passwordField")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{ paddingRight: "36px" }}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
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

                {mode === "verify" && (
                  <div className="relative">
                    <ShieldCheck
                      size={13}
                      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30"
                    />
                    <input
                      className="inp-field"
                      type="text"
                      maxLength={6}
                      inputMode="numeric"
                      placeholder="Code a 6 chiffres"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    />
                  </div>
                )}

                {notice && (
                  <div className="flex items-start gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-2.5">
                    <p className="text-[11px] leading-relaxed text-cyan-100/90">{notice}</p>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 p-2.5">
                    <p className="text-[11px] leading-relaxed text-rose-100/90">{error}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="btn-grad btn-shine relative mt-0.5 flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-[13px] font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ boxShadow: "0 4px 20px rgba(123,47,255,0.35)" }}
                >
                  {loading ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Chargement...
                    </>
                  ) : (
                    <>
                      {mode === "login"
                        ? t("company.loginBtn")
                        : mode === "register"
                          ? t("company.registerBtn")
                          : "Verifier mon email"}
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>

                {mode === "verify" && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendingCode}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 text-[12px] font-semibold text-white/75 transition-all hover:bg-white/10 disabled:opacity-60"
                  >
                    {resendingCode ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Renvoi...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={13} /> Renvoyer le code
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
