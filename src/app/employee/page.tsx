"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BadgeCheck,
  Building2,
  BriefcaseBusiness,
  FileText,
  LockKeyhole,
  MessageCircle,
  Quote,
  ShieldCheck,
  Sparkles,
  Video,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PasswordInput } from "@/components/ui/password-input";
import ThemeToggle from "@/components/ThemeToggle";


const initialState = {
  employeeId: "",
  password: "",
  loading: false,
  error: "",
  info: "",
};

const welcomeTitleColors = ["#d8ffe9", "#ffd166", "#ffc6df", "#b8d8ff", "#d6c5ff"];
const motivationalQuotes = [
  "Every conversation is a chance to show how you think.",
  "Your next opportunity can start with one confident answer.",
  "Progress begins when you give yourself room to grow.",
  "Bring your experience. Your perspective matters.",
];
const quoteAccents = [
  { background: "#ffe4ec", border: "#f5b3c7", text: "#703449", accent: "#d94d79" },
  { background: "#fff0bf", border: "#f0d270", text: "#614a15", accent: "#c68d00" },
  { background: "#dcf6ff", border: "#a6e2f3", text: "#20556a", accent: "#1684a7" },
  { background: "#eee4ff", border: "#d1bdf6", text: "#51377a", accent: "#8154c8" },
];
const floatingResumeTiles = Array.from({ length: 36 }, (_, index) => {
  const column = index % 6;
  const row = Math.floor(index / 6);
  const movesUp = (column + row) % 2 === 0;
  return {
    left: `${3 + column * 16}%`,
    top: `${4 + row * 15}%`,
    x: ["-0.7vw", "0.7vw", "-0.7vw"],
    y: movesUp ? [0, -15, 0] : [0, 15, 0],
    duration: 3.8 + (index % 5) * 0.32,
    delay: (index % 12) * 0.11,
    kind: ["resume", "briefcase", "conversation", "assessment", "company", "infinite"][index % 6],
  };
});
const floatingWalkers = Array.from({ length: 18 }, (_, index) => {
  const column = index % 6;
  const row = Math.floor(index / 6);
  const walksRight = (column + row) % 2 === 0;
  return {
    left: `${11 + column * 16}%`,
    top: `${11.5 + row * 30}%`,
    x: walksRight ? [0, 24, 48, 24, 0] : [0, -24, -48, -24, 0],
    duration: 2.9 + (index % 4) * 0.28,
    delay: (index % 9) * 0.18,
    tone: ["text-[#43886d]/50", "text-[#bd7184]/45", "text-[#687ca2]/45", "text-[#a77a42]/45"][index % 4],
  };
});

export default function EmployeeLoginPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [employeeId, setEmployeeId] = useState(initialState.employeeId);
  const [password, setPassword] = useState(initialState.password);
  const [loading, setLoading] = useState(initialState.loading);
  const [error, setError] = useState(initialState.error);
  const [info, setInfo] = useState(initialState.info);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [org, setOrg] = useState<string | null>(null);
  
  // First time login choices modal states
  const [firstTimeModalData, setFirstTimeModalData] = useState<{
    token: string;
    employee_id: string;
    full_name: string;
    mustChangePassword: boolean;
  } | null>(null);
  const [changePasswordMode, setChangePasswordMode] = useState(false);
  const [modalNewPassword, setModalNewPassword] = useState("");
  const [modalConfirmPassword, setModalConfirmPassword] = useState("");
  const [modalOtp, setModalOtp] = useState("");
  const [modalOtpSent, setModalOtpSent] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [welcomeColorIndex, setWelcomeColorIndex] = useState(0);
  const [showMotivationalQuote, setShowMotivationalQuote] = useState(false);
  const [motivationalQuoteIndex, setMotivationalQuoteIndex] = useState(-1);

  useEffect(() => {
    if (!showWelcome) return;
    const colorTimer = window.setInterval(() => {
      setWelcomeColorIndex((current) => (current + 1) % welcomeTitleColors.length);
    }, 10_000);
    return () => window.clearInterval(colorTimer);
  }, [showWelcome]);

  useEffect(() => {
    if (!showWelcome) return;
    let hideTimer: number | undefined;
    const showQuote = () => {
      setMotivationalQuoteIndex((current) => (current + 1) % motivationalQuotes.length);
      setShowMotivationalQuote(true);
      if (hideTimer) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setShowMotivationalQuote(false), 5_000);
    };
    const firstQuoteTimer = window.setTimeout(showQuote, 4_000);
    const quoteInterval = window.setInterval(showQuote, 17_000);
    return () => {
      window.clearTimeout(firstQuoteTimer);
      window.clearInterval(quoteInterval);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [showWelcome]);

  useEffect(() => {
    const syncRouteState = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const reason = searchParams.get("reason");
      const ssoError = searchParams.get("sso_error");
      // Chooser stays on screen; password sign-in opens as a modal overlay.
      const passwordMode = searchParams.get("mode") === "signin";
      setShowWelcome(true);
      setShowPasswordModal(passwordMode);

      if (reason === "inactivity") {
        setError("You have been logged out due to inactivity.");
      } else if (ssoError) {
        setError(ssoError);
      } else if (!passwordMode) {
        setError("");
      }
      const organization = searchParams.get("org");
      if (organization) {
        setOrg(organization);
      }
    };

    syncRouteState();
    window.addEventListener("popstate", syncRouteState);
    return () => window.removeEventListener("popstate", syncRouteState);
  }, []);

  const openPasswordSignIn = () => {
    setError("");
    setInfo("");
    setIsResetPassword(false);
    setShowPasswordModal(true);
    const next = org
      ? `/employee?mode=signin&org=${encodeURIComponent(org)}`
      : "/employee?mode=signin";
    window.history.replaceState(null, "", next);
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setIsResetPassword(false);
    setError("");
    setInfo("");
    const next = org ? `/employee?org=${encodeURIComponent(org)}` : "/employee";
    window.history.replaceState(null, "", next);
  };

  const handleInfiniteLogin = () => {
    window.location.assign("/api/employee/auth/saml");
  };

  const handleKeepPassword = async () => {
    if (!firstTimeModalData) return;
    setModalSubmitting(true);
    setModalError("");

    try {
      const res = await fetch("/api/employee/auth/confirm-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firstTimeModalData.token}`,
        },
        body: JSON.stringify({ action: "keep" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || "Failed to confirm password.");
        return;
      }
      window.localStorage.setItem("employee_token", firstTimeModalData.token);
      router.push("/employee/dashboard");
    } catch (err: any) {
      setModalError(err.message || "An unexpected error occurred.");
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstTimeModalData) return;
    setModalError("");

    if (modalNewPassword !== modalConfirmPassword) {
      setModalError("Passwords do not match.");
      return;
    }
    if (!/^\d{6}$/.test(modalOtp)) {
      setModalError("Enter the 6-digit verification code sent to your registered email.");
      return;
    }
    if (modalNewPassword.length < 8) {
      setModalError("Password must be at least 8 characters long.");
      return;
    }

    setModalSubmitting(true);
    try {
      const res = await fetch("/api/employee/auth/confirm-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firstTimeModalData.token}`,
        },
        body: JSON.stringify({ action: "change", password: modalNewPassword, otp: modalOtp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || "Failed to update password.");
        return;
      }
      window.localStorage.setItem("employee_token", firstTimeModalData.token);
      router.push("/employee/dashboard");
    } catch (err: any) {
      setModalError(err.message || "An unexpected error occurred.");
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleFirstLoginOtp = async () => {
    if (!firstTimeModalData) return;
    setModalSubmitting(true);
    setModalError("");
    try {
      const response = await fetch("/api/employee/auth/request-password-change-otp", {
        method: "POST",
        headers: { Authorization: `Bearer ${firstTimeModalData.token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setModalError(data.error || "Could not send a verification code.");
        return;
      }
      setModalOtpSent(true);
      setModalError("");
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Could not send a verification code.");
    } finally {
      setModalSubmitting(false);
    }
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");

    const trimmedId = employeeId.trim();
    if (!trimmedId) {
      setError("Please enter your Employee ID.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/employee/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: trimmedId, password }),
      });

      let result: any = null;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        result = await response.json();
      }

      if (!response.ok) {
        setError(result?.error || `Login failed (Server returned status ${response.status}).`);
        setLoading(false);
        return;
      }

      if (result && result.status === "first_time_modal") {
        setFirstTimeModalData({
          token: result.token,
          employee_id: result.employee?.employee_id || trimmedId,
          full_name: result.employee?.full_name || trimmedId,
          mustChangePassword: result.mustChangePassword === true,
        });
        setChangePasswordMode(result.mustChangePassword === true);
        setModalOtp("");
        setModalOtpSent(false);
        setModalError("");
        return;
      }

      if (result && result.status === "first_time") {
        const orgParam = org ? `&org=${encodeURIComponent(org)}` : "";
        router.push(`/employee/set-password?employee_id=${encodeURIComponent(trimmedId)}${orgParam}`);
        return;
      }

      if (result && result.status === "ok" && result.token) {
        window.localStorage.setItem("employee_token", result.token);
        router.push("/employee/dashboard");
        return;
      }

      setError("Unable to authenticate. Please try again.");
    } catch (err: any) {
      setError(err?.message || "Unexpected error during login.");
    } finally {
      setLoading(false);
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    const trimmedId = employeeId.trim();
    if (!trimmedId) {
      setError("Please enter your Employee ID.");
      return;
    }
    setLoading(true);
    try {
      if (!resetOtpSent) {
        const requestResponse = await fetch("/api/employee/auth/request-password-reset-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employee_id: trimmedId, email: resetEmail }),
        });
        const requestData = await requestResponse.json().catch(() => ({}));
        if (!requestResponse.ok) {
          setError(requestData?.error || "Could not send a verification code.");
          return;
        }
        setResetOtpSent(true);
        setInfo(requestData?.message || "A verification code has been sent to your registered email.");
        return;
      }
      if (!/^\d{6}$/.test(resetOtp)) {
        setError("Enter the 6-digit verification code.");
        return;
      }
      if (resetNewPassword !== resetConfirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      const response = await fetch("/api/employee/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: trimmedId,
          otp: resetOtp,
          password: resetNewPassword
        }),
      });

      let result: any = null;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        result = await response.json();
      }

      if (!response.ok) {
        setError(result?.error || "Failed to reset password.");
        return;
      }

      setInfo("Password reset successfully. You can now sign in.");
      setIsResetPassword(false);
      setPassword("");
      setResetEmail("");
      setResetNewPassword("");
      setResetConfirmPassword("");
      setResetOtp("");
      setResetOtpSent(false);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative h-dvh overflow-hidden bg-background text-foreground transition-colors duration-300">
      <div className="absolute inset-0 pointer-events-none opacity-60" aria-hidden="true">
        <motion.div
          className="absolute inset-0 bg-[linear-gradient(rgb(var(--foreground)_/_0.035)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--foreground)_/_0.035)_1px,transparent_1px)] bg-[size:44px_44px]"
          animate={prefersReducedMotion ? undefined : { backgroundPosition: ["0px 0px", "44px 44px"] }}
          transition={prefersReducedMotion ? undefined : { duration: 18, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute -left-40 top-1/4 h-[34rem] w-[34rem] rounded-full bg-primary/10 blur-3xl" />
        <motion.div
          className="absolute -left-[18%] top-[22%] h-px w-[136%] rotate-[-13deg] bg-gradient-to-r from-transparent via-[#45b99a]/35 to-transparent"
          animate={prefersReducedMotion ? undefined : { x: ["-8%", "8%", "-8%"], opacity: [0.3, 0.75, 0.3] }}
          transition={prefersReducedMotion ? undefined : { duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-[9%] top-[38%] h-[220px] w-[360px] rotate-[-18deg] rounded-[28px] border border-[#e2a7c2]/20"
          animate={prefersReducedMotion ? undefined : { x: [0, -32, 0], y: [0, 24, 0], rotate: [-18, -14, -18] }}
          transition={prefersReducedMotion ? undefined : { duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -left-[16%] bottom-[14%] h-px w-[132%] rotate-[9deg] bg-gradient-to-r from-transparent via-[#e9bd63]/30 to-transparent"
          animate={prefersReducedMotion ? undefined : { x: ["6%", "-6%", "6%"], opacity: [0.25, 0.65, 0.25] }}
          transition={prefersReducedMotion ? undefined : { duration: 17, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div
          aria-hidden="true"
          data-testid="interview-background-hud"
          className="absolute right-[3%] top-[43%] hidden h-[176px] w-[258px] overflow-hidden rounded-[26px] border border-[#176b55]/15 bg-white/30 p-3 shadow-[0_24px_70px_rgba(34,73,62,0.08)] backdrop-blur-[2px] lg:block"
          animate={prefersReducedMotion ? undefined : { y: [0, -10, 0], rotate: [1.5, 0, 1.5] }}
          transition={prefersReducedMotion ? undefined : { duration: 9, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="flex items-center justify-between border-b border-[#176b55]/10 pb-2">

            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#315e4b]/55">
              <Video className="h-3 w-3" />
              Interview room
            </div>
            <span className="flex items-center gap-1 text-[8px] font-semibold text-[#d94d63]/70">
              <motion.span
                className="h-1.5 w-1.5 rounded-full bg-[#e56478]"
                animate={prefersReducedMotion ? undefined : { opacity: [0.45, 1, 0.45] }}
                transition={prefersReducedMotion ? undefined : { duration: 1.4, repeat: Infinity }}
              />
              LIVE
            </span>
          </div>
          <div className="relative mt-2 flex h-[92px] items-center justify-center gap-4 overflow-hidden rounded-[18px] border border-white/45 bg-gradient-to-br from-[#d7ede1]/70 via-[#e7edf3]/65 to-[#f3dfe8]/60">
            <div className="absolute left-2 top-2 h-3 w-3 border-l border-t border-[#176b55]/25" />
            <div className="absolute right-2 top-2 h-3 w-3 border-r border-t border-[#176b55]/25" />
            <div className="absolute bottom-2 left-2 h-3 w-3 border-b border-l border-[#176b55]/25" />
            <div className="absolute bottom-2 right-2 h-3 w-3 border-b border-r border-[#176b55]/25" />
            <div className="flex flex-col items-center gap-1 opacity-65">
              <span className="h-7 w-7 rounded-full bg-gradient-to-br from-[#e5aa86] to-[#bd775f] shadow-sm" />
              <span className="h-5 w-12 rounded-t-full bg-[#e8eee8]" />
            </div>
            <div className="flex flex-col items-center gap-1 opacity-65">
              <span className="h-7 w-7 rounded-full bg-gradient-to-br from-[#efc4a5] to-[#c78f75] shadow-sm" />
              <span className="h-5 w-12 rounded-t-full bg-[#879dad]" />
            </div>
            <motion.div
              className="absolute bottom-2 right-3 flex h-7 w-10 items-center justify-center rounded-lg border border-white/50 bg-white/55 text-[#40715e]/55"
              animate={prefersReducedMotion ? undefined : { scale: [1, 1.05, 1] }}
              transition={prefersReducedMotion ? undefined : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            >
              <Video className="h-3.5 w-3.5" />
            </motion.div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[8px] font-medium text-[#315e4b]/50">
              <AudioLines className="h-3 w-3" />
              Voice activity
            </div>
            <div className="flex h-4 items-center gap-[2px]">
              {[5, 9, 13, 7, 15, 10, 5, 12, 7, 4, 10, 6].map((height, index) => (
                <motion.span
                  key={index}
                  className="w-[2px] origin-center rounded-full bg-[#4d9d7e]/45"
                  style={{ height }}
                  animate={prefersReducedMotion ? undefined : { scaleY: [0.55, 1, 0.7, 0.9, 0.55] }}
                  transition={prefersReducedMotion ? undefined : { duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: index * 0.06 }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <div
        data-testid="floating-resume-motifs"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] hidden overflow-hidden sm:block"
      >
        {floatingResumeTiles.map((tile, index) => (
          <motion.div
            key={`resume-tile-${index}`}
            className="absolute flex h-12 w-[68px] items-center gap-1 rounded-lg border border-foreground/[0.07] bg-card/55 p-1 opacity-40 shadow-[0_8px_22px_rgba(30,65,54,0.06)] backdrop-blur-[1px]"
            style={{ left: tile.left, top: tile.top }}
            animate={prefersReducedMotion ? undefined : { x: tile.x, y: tile.y, rotate: [index % 2 ? -5 : 4, index % 2 ? 3 : -4, index % 2 ? -5 : 4] }}
            transition={prefersReducedMotion ? undefined : { duration: tile.duration, delay: tile.delay, repeat: Infinity, ease: "easeInOut" }}
          >
            {tile.kind === "resume" && (
              <>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary/75">
                  <UserRound className="h-5 w-5" />
                </span>
                <span className="flex h-9 flex-1 flex-col justify-center gap-1 rounded-md border border-border/70 bg-background/70 px-1.5">
                  <FileText className="h-3 w-3 text-[#d77791]" />
                  <span className="h-[2px] w-full rounded-full bg-muted-foreground/25" />
                  <span className="h-[2px] w-2/3 rounded-full bg-muted-foreground/15" />
                </span>
              </>
            )}
            {tile.kind === "briefcase" && (
              <>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e6b86b]/20 text-[#a9772e]">
                  <BriefcaseBusiness className="h-4 w-4" />
                </span>
                <span className="flex h-9 flex-1 flex-col justify-center gap-1 rounded-md border border-[#e6b86b]/20 bg-background/70 px-1.5">
                  <span className="h-[3px] w-3/4 rounded-full bg-[#bf975a]/40" />
                  <span className="h-[2px] w-full rounded-full bg-muted-foreground/20" />
                  <span className="h-[2px] w-1/2 rounded-full bg-muted-foreground/15" />
                </span>
              </>
            )}
            {tile.kind === "conversation" && (
              <>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#70b9a2]/15 text-[#38856e]">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <span className="flex h-9 flex-1 flex-col justify-center gap-1 rounded-md border border-[#70b9a2]/20 bg-background/70 px-1.5">
                  <span className="h-[3px] w-full rounded-full bg-[#70b9a2]/35" />
                  <span className="h-[2px] w-3/4 rounded-full bg-muted-foreground/20" />
                  <span className="h-[2px] w-1/2 self-end rounded-full bg-[#d77791]/30" />
                </span>
              </>
            )}
            {tile.kind === "assessment" && (
              <>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#8f75bd]/15 text-[#7557a8]">
                  <BadgeCheck className="h-4 w-4" />
                </span>
                <span className="flex h-9 flex-1 flex-col justify-center gap-1 rounded-md border border-[#8f75bd]/20 bg-background/70 px-1.5">
                  <span className="flex items-center gap-1 text-[#638d6f]/70"><BadgeCheck className="h-2.5 w-2.5" /><span className="h-[2px] w-2/3 rounded-full bg-muted-foreground/20" /></span>
                  <span className="h-[2px] w-full rounded-full bg-muted-foreground/20" />
                  <span className="h-[2px] w-3/5 rounded-full bg-muted-foreground/15" />
                </span>
              </>
            )}
            {tile.kind === "company" && (
              <>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#6d9fae]/15 text-[#507f91]">
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="flex h-9 flex-1 items-end justify-center gap-[3px] rounded-md border border-[#6d9fae]/20 bg-background/70 px-1.5 pb-1">
                  <span className="flex h-5 w-2 flex-col gap-[2px] rounded-t-sm bg-[#83a8b5]/55 p-[2px]"><span className="h-1 w-full rounded-[1px] bg-white/80" /><span className="h-1 w-full rounded-[1px] bg-white/80" /></span>
                  <span className="flex h-7 w-2.5 flex-col gap-[2px] rounded-t-sm bg-[#678e9e]/60 p-[2px]"><span className="h-1 w-full rounded-[1px] bg-white/80" /><span className="h-1 w-full rounded-[1px] bg-white/80" /><span className="h-1 w-full rounded-[1px] bg-white/80" /></span>
                  <span className="flex h-4 w-2 flex-col gap-[2px] rounded-t-sm bg-[#9ab7bf]/60 p-[2px]"><span className="h-1 w-full rounded-[1px] bg-white/80" /><span className="h-1 w-full rounded-[1px] bg-white/80" /></span>
                </span>
              </>
            )}
            {tile.kind === "infinite" && (
              <span className="flex h-9 w-full flex-col items-center justify-center rounded-md border border-[#176b55]/15 bg-gradient-to-r from-[#e7f4ec]/80 via-[#fff3d1]/80 to-[#f7e4ee]/80 px-0.5 font-extrabold leading-[1.15] text-transparent bg-clip-text bg-gradient-to-r from-[#176b55] via-[#c57a42] to-[#a75f8d] shadow-sm">
                <span className="text-[6px] tracking-[0.08em]">INFINITE</span>
                <span className="whitespace-nowrap text-[4px] tracking-[0.025em]">COMPUTER SOLUTIONS</span>
              </span>
            )}
          </motion.div>
        ))}
        {floatingWalkers.map((walker, index) => (
          <motion.div
            key={`walking-person-${index}`}
            data-testid="walking-person"
            className={`absolute flex h-8 w-5 items-start justify-center opacity-45 ${walker.tone}`}
            style={{ left: walker.left, top: walker.top }}
            animate={prefersReducedMotion ? undefined : { x: walker.x, y: [0, -2, 0, -2, 0] }}
            transition={prefersReducedMotion ? undefined : { duration: walker.duration, delay: walker.delay, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="relative block h-9 w-5">
              <span className="absolute left-[7px] top-0 h-[6px] w-[6px] rounded-full bg-current" />
              <span className="absolute left-[8px] top-[7px] h-[11px] w-[4px] rounded-full bg-current" />
              <motion.span
                className="absolute left-[4px] top-[9px] h-[2px] w-[5px] rounded-full bg-current"
                animate={prefersReducedMotion ? undefined : { rotate: [24, -24, 24] }}
                transition={prefersReducedMotion ? undefined : { duration: walker.duration / 2, delay: walker.delay, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.span
                className="absolute left-[10px] top-[9px] h-[2px] w-[5px] origin-left rounded-full bg-current"
                animate={prefersReducedMotion ? undefined : { rotate: [-24, 24, -24] }}
                transition={prefersReducedMotion ? undefined : { duration: walker.duration / 2, delay: walker.delay, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.span
                className="absolute left-[11px] top-[9px] h-[2px] w-[6px] origin-left rounded-full bg-current"
                animate={prefersReducedMotion ? undefined : { rotate: [-58, -82, -58] }}
                transition={prefersReducedMotion ? undefined : { duration: walker.duration, delay: walker.delay, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.span
                className="absolute left-[15px] top-[2px] flex h-[11px] w-[8px] items-center justify-center rounded-[2px] border border-white/80 bg-white/90 text-[#d77791] shadow-sm"
                animate={prefersReducedMotion ? undefined : { y: [0, -3, 0], rotate: [7, -5, 7] }}
                transition={prefersReducedMotion ? undefined : { duration: walker.duration, delay: walker.delay, repeat: Infinity, ease: "easeInOut" }}
              >
                <FileText className="h-[6px] w-[6px]" />
              </motion.span>
              <motion.span
                className="absolute left-[7px] top-[17px] h-[8px] w-[2px] origin-top rounded-full bg-current"
                animate={prefersReducedMotion ? undefined : { rotate: [-20, 22, -20] }}
                transition={prefersReducedMotion ? undefined : { duration: walker.duration / 2, delay: walker.delay, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.span
                className="absolute left-[11px] top-[17px] h-[8px] w-[2px] origin-top rounded-full bg-current"
                animate={prefersReducedMotion ? undefined : { rotate: [22, -20, 22] }}
                transition={prefersReducedMotion ? undefined : { duration: walker.duration / 2, delay: walker.delay, repeat: Infinity, ease: "easeInOut" }}
              />
            </span>
          </motion.div>
        ))}
      </div>

      <header className="relative z-30 flex h-14 shrink-0 items-center justify-between px-5 sm:h-16 sm:px-8 lg:px-12">
        <Link href="/" className="group inline-flex items-center gap-3" aria-label="TalentScope home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#176b55] text-white shadow-lg shadow-[#176b55]/20">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="text-sm font-bold tracking-[0.02em]">TalentScope</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="relative">
            <Link
              href="/"
              className="group inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#176b55] bg-[#176b55] px-4 text-xs font-bold text-white shadow-md shadow-[#176b55]/25 transition duration-200 hover:-translate-y-0.5 hover:bg-[#125943] hover:shadow-lg hover:shadow-[#176b55]/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#176b55]/30 sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              Candidate portal
            </Link>
            {showMotivationalQuote && motivationalQuoteIndex >= 0 && (
              <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
                <motion.div
                  key={motivationalQuoteIndex}
                  role="status"
                  aria-live="polite"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4 }}
                  style={{
                    backgroundColor: quoteAccents[motivationalQuoteIndex].background,
                    borderColor: quoteAccents[motivationalQuoteIndex].border,
                    color: quoteAccents[motivationalQuoteIndex].text,
                  }}
                  className="flex w-full max-w-[360px] items-start gap-2.5 rounded-xl border px-4 py-3 shadow-xl"
                >
                  <Quote className="mt-0.5 h-4 w-4 shrink-0" style={{ color: quoteAccents[motivationalQuoteIndex].accent }} />
                  <span className="text-xs font-semibold leading-5">{motivationalQuotes[motivationalQuoteIndex]}</span>
                </motion.div>
              </div>
            )}
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="relative z-10 mx-auto grid h-[calc(100dvh-3.5rem)] max-w-[1440px] grid-cols-1 grid-rows-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-stretch gap-3 overflow-hidden px-4 pb-3 pt-1 sm:h-[calc(100dvh-4rem)] sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:grid-rows-1 lg:gap-8 lg:px-10 lg:pb-4 lg:pt-2">
        <section className="relative flex h-full min-h-0 flex-col justify-start gap-4 overflow-hidden rounded-[1.5rem] bg-[#176b55] px-6 py-5 text-white shadow-2xl shadow-[#176b55]/20 transition-colors duration-300 sm:gap-5 sm:rounded-[2rem] sm:px-8 sm:py-7 lg:gap-6 lg:px-10 lg:py-8">
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_16%_10%,rgba(255,255,255,0.18),transparent_42%),radial-gradient(ellipse_at_92%_88%,rgba(8,44,35,0.2),transparent_40%)]" />
            <div className="absolute -right-24 top-16 h-72 w-72 rounded-full border border-white/10" />
            <div className="absolute -right-12 top-28 h-48 w-48 rounded-full border border-white/10" />
            <div className="absolute bottom-0 left-0 h-1/2 w-full bg-gradient-to-t from-[#0d302a]/20 to-transparent" />
          </div>

          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
            <motion.div
              data-testid="interview-illustration"
              className="absolute bottom-3 right-0 h-[26%] w-[68%] max-w-[350px] sm:right-3 sm:w-[58%] lg:bottom-6 lg:right-5 lg:h-[34%] lg:w-[34%] lg:max-w-[210px]"
              animate={prefersReducedMotion ? undefined : { x: [0, -28, -70, -36, -12, 0], y: [0, -18, -42, -30, -12, 0] }}
              transition={prefersReducedMotion ? undefined : { duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="absolute inset-5 rounded-[28px] border border-white/20 bg-gradient-to-br from-white/20 via-white/8 to-[#b9efd2]/10 shadow-[0_24px_60px_rgba(3,34,25,0.22)] backdrop-blur-[2px]" />
              <div className="absolute left-[17%] top-[12%] h-[72%] w-[31%]">
                <div className="absolute bottom-0 left-1/2 h-[48%] w-[94%] -translate-x-1/2 rounded-t-[48%] bg-gradient-to-b from-[#e9a77f] to-[#cb7959] shadow-[inset_-10px_0_0_rgba(91,44,33,0.12)]" />
                <div className="absolute bottom-[35%] left-1/2 h-[24%] w-[56%] -translate-x-1/2 rounded-[48%] bg-[#d99872] shadow-[inset_-7px_-3px_0_rgba(116,57,40,0.12)]" />
                <div className="absolute bottom-[52%] left-[24%] h-[12%] w-[56%] rounded-t-full bg-[#352a2b]" />
                <div className="absolute bottom-[40%] left-[57%] h-[2px] w-1 rounded-full bg-[#52332d]" />
                <div className="absolute bottom-[22%] left-1/2 h-[28%] w-[110%] -translate-x-1/2 rounded-t-[55%] bg-[#e6eee7] shadow-[0_7px_16px_rgba(7,39,30,0.15)]" />
              </div>
              <div className="absolute right-[16%] top-[10%] h-[75%] w-[31%]">
                <div className="absolute bottom-0 left-1/2 h-[48%] w-[94%] -translate-x-1/2 rounded-t-[48%] bg-gradient-to-b from-[#71889a] to-[#425c73] shadow-[inset_-10px_0_0_rgba(26,48,66,0.18)]" />
                <div className="absolute bottom-[35%] left-1/2 h-[24%] w-[56%] -translate-x-1/2 rounded-[48%] bg-[#f0bf9c] shadow-[inset_-7px_-3px_0_rgba(135,79,55,0.12)]" />
                <div className="absolute bottom-[52%] left-[22%] h-[12%] w-[58%] rounded-t-full bg-[#493a35]" />
                <div className="absolute bottom-[40%] left-[34%] h-[2px] w-1 rounded-full bg-[#684639]" />
                <div className="absolute bottom-[22%] left-1/2 h-[28%] w-[110%] -translate-x-1/2 rounded-t-[55%] bg-[#d6e0e8] shadow-[0_7px_16px_rgba(7,39,30,0.15)]" />
              </div>
              <div className="absolute bottom-[21%] left-[10%] right-[10%] h-[15%] rounded-[50%] border-t border-white/35 bg-gradient-to-b from-[#d6c6b5]/90 to-[#9e8975] shadow-[0_12px_18px_rgba(3,34,25,0.2)]" />
              <div className="absolute bottom-[27%] left-1/2 h-[18%] w-[20%] -translate-x-1/2 rounded-t-md border border-white/50 bg-gradient-to-br from-[#f5f4eb] to-[#bac8c3] shadow-[0_8px_18px_rgba(3,34,25,0.2)]">
                <div className="absolute inset-x-[18%] top-[18%] h-[50%] rounded-sm bg-[#92b8a5]" />
                <div className="absolute -bottom-1 left-[-12%] right-[-12%] h-1.5 rounded-full bg-[#dce3df]" />
              </div>
              <div className="absolute left-[8%] top-[8%] inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-[#f5faf6]/90 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#315e4b] shadow-lg">
                <BriefcaseBusiness className="h-3 w-3" />
                Talent interview
              </div>
            </motion.div>
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <span className="h-8 w-1 rounded-full bg-gradient-to-b from-[#ffe17a] to-[#ff8eb5] shadow-[0_0_16px_rgba(255,205,116,0.45)]" />
            <motion.span
              className="bg-[linear-gradient(105deg,#fff1a8_0%,#ffffff_28%,#ff9cc6_54%,#c4f5df_78%,#fff1a8_100%)] bg-[length:220%_100%] bg-clip-text text-base font-extrabold text-transparent drop-shadow-[0_2px_12px_rgba(255,231,164,0.22)] sm:text-lg"
              animate={prefersReducedMotion ? undefined : { backgroundPosition: ["100% 50%", "0% 50%", "100% 50%"] }}
              transition={prefersReducedMotion ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              Your next chapter starts here
            </motion.span>
          </div>

          <motion.div
            className="relative z-10 max-w-xl lg:max-w-[56%]"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          >
            <motion.h1
              className="max-w-[12ch] text-4xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-5xl lg:text-6xl"
              animate={{ color: welcomeTitleColors[welcomeColorIndex] }}
              transition={{ duration: prefersReducedMotion ? 0 : 1.2, ease: "easeInOut" }}
            >
              Welcome to TalentScope
            </motion.h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/75 sm:mt-4 sm:text-base sm:leading-7">
              A clearer view of your skills, your progress, and the opportunities ahead.
            </p>
          </motion.div>

        </section>

        <section className="relative mx-auto flex h-full min-h-0 w-full max-w-[520px] flex-col justify-center overflow-hidden py-1 lg:ml-0 lg:py-2">
          <div className="mb-4 shrink-0 lg:mb-6">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Employee portal</p>
            <h2 className="font-display text-2xl font-extrabold leading-[1.08] text-foreground sm:text-3xl">
              Choose how you
              <span className="mt-1 block text-primary">sign in</span>
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              Sign in with Microsoft, or use your Employee ID and password.
            </p>
          </div>

          {error && !showPasswordModal ? (
            <div className="mb-3 w-full max-w-[360px] rounded-xl bg-red-500/10 border border-red-500/25 px-4 py-2.5 text-xs text-red-500 flex items-center gap-2">
              <span className="text-sm leading-none">⚠</span>
              <span className="font-medium">{error}</span>
            </div>
          ) : null}

          <div className="w-full max-w-[360px] shrink-0 space-y-3">
            <motion.button
              type="button"
              onClick={handleInfiniteLogin}
              animate={prefersReducedMotion ? undefined : { y: [0, -3, 0] }}
              transition={prefersReducedMotion ? undefined : { duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
              whileHover={prefersReducedMotion ? undefined : { y: -5, scale: 1.015 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
              className="group flex min-h-[72px] w-full items-center gap-3 rounded-2xl border border-[#edc4d1] bg-gradient-to-br from-[#fff3f6] via-[#f8e3ea] to-[#edc6d3] px-3.5 py-3 text-left text-[#573543] shadow-[0_16px_34px_-16px_rgba(164,94,121,0.42)] transition-colors duration-200 hover:border-[#e6b1c2] hover:from-[#fff5f7] hover:to-[#eebdcd] hover:shadow-[0_22px_40px_-16px_rgba(164,94,121,0.52)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d890aa]/30 sm:px-4"
            >
              <motion.span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/90 bg-white text-[#c05a7b] shadow-[0_8px_16px_-6px_rgba(127,55,82,0.35)] ring-1 ring-[#e6bdcb]/70"
                animate={prefersReducedMotion ? undefined : { y: [0, -4, 0] }}
                transition={prefersReducedMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <img src="/infinite-logo.jpg" alt="" className="h-9 w-9 object-contain" />
              </motion.span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold">Infinite Login</span>
                <span className="mt-1 block text-xs text-[#785c68]">Sign in with your Microsoft account</span>
              </span>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-[#a16c80] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </motion.button>

            <motion.button
              type="button"
              onClick={openPasswordSignIn}
              animate={prefersReducedMotion ? undefined : { y: [0, -3, 0] }}
              transition={prefersReducedMotion ? undefined : { duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 0.65 }}
              whileHover={prefersReducedMotion ? undefined : { y: -5, scale: 1.015 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
              className="group flex min-h-[72px] w-full items-center gap-3 rounded-2xl border border-[#d9c9ef] bg-gradient-to-br from-[#fbf8ff] via-[#f0e8fb] to-[#dfd1f2] px-3.5 py-3 text-left text-[#49395d] shadow-[0_16px_34px_-16px_rgba(116,83,157,0.34)] transition-colors duration-200 hover:border-[#ccb9e8] hover:from-[#fdfbff] hover:to-[#d8c8ed] hover:shadow-[0_22px_40px_-16px_rgba(116,83,157,0.44)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a886ce]/30 sm:px-4"
            >
              <motion.span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white bg-white text-[#8062a4] shadow-[0_8px_16px_-6px_rgba(72,49,102,0.28)] ring-1 ring-[#ded3ec]"
                animate={prefersReducedMotion ? undefined : { y: [0, -4, 0] }}
                transition={prefersReducedMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.45 }}
              >
                <LockKeyhole className="h-5 w-5" />
              </motion.span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold">Employee ID and password</span>
                <span className="mt-1 block text-xs text-[#716382]">Sign in with your Employee ID and password</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-[#8062a4] transition-transform group-hover:translate-x-1" />
            </motion.button>
          </div>

          <div className="mt-4 flex shrink-0 items-start gap-3 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Building2 className="h-3.5 w-3.5" />
            </span>
            <span>Protected employee access. Your assessments and progress stay connected to your account.</span>
          </div>
        </section>
      </div>

      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-fade-in"
          onClick={(event) => {
            if (event.target === event.currentTarget) closePasswordModal();
          }}
        >
          <Card className="w-full max-w-md p-6 md:p-7 shadow-2xl relative overflow-hidden border border-border bg-card">
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
            <button
              type="button"
              onClick={closePasswordModal}
              className="absolute top-4 right-4 z-20 text-muted-foreground hover:text-foreground font-bold"
              aria-label="Close"
            >
              ✕
            </button>

            <div className="mb-5 text-center relative z-10">
              <div className="mx-auto mb-3 app-brand-mark h-12 w-12">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
                {isResetPassword ? "Reset Portal Password" : "Employee ID and password"}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                {isResetPassword
                  ? resetOtpSent ? "Enter the code sent to your registered email and choose a new password." : "We will send a verification code to your registered email."
                  : org
                    ? `Sign in to ${org} with your Employee ID and password.`
                    : "Sign in with your Employee ID and password."}
              </p>
            </div>

            <div className="flex justify-center mb-4 relative z-10">
              <Badge variant="default">
                {org ? `${org.toUpperCase()} · Secure access` : "Secure access"}
              </Badge>
            </div>

            {error ? (
              <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-4 py-2.5 text-xs text-red-400 mb-4 flex items-center gap-2 relative z-10">
                <span className="text-sm leading-none">⚠</span>
                <span className="font-medium">{error}</span>
              </div>
            ) : null}

            {info ? (
              <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/25 px-4 py-2.5 text-xs text-indigo-300 mb-4 flex items-center gap-2 relative z-10">
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-medium">{info}</span>
              </div>
            ) : null}

            {!isResetPassword ? (
              <form className="space-y-4 relative z-10" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Employee ID</label>
                  <input
                    className="w-full text-sm rounded-xl border-2 border-border bg-muted/40 px-4 py-2.5 text-foreground font-medium placeholder:text-muted-foreground outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                    value={employeeId}
                    onChange={(event) => setEmployeeId(event.target.value)}
                    placeholder="e.g. E1234"
                    autoComplete="username"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Password</label>
                  <PasswordInput
                    className="w-full text-sm rounded-xl border-2 border-border bg-muted/40 px-4 py-2.5 text-foreground font-medium placeholder:text-muted-foreground outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <div className="flex justify-end mt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setInfo("");
                        setIsResetPassword(true);
                        setResetOtpSent(false);
                        setResetOtp("");
                      }}
                      className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </div>

                <Button
                  className="w-full px-4 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-indigo-500/30 hover:shadow-xl transition-all duration-200"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in…
                    </span>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            ) : (
              <form className="space-y-4 relative z-10" onSubmit={handleResetPassword}>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Employee ID</label>
                  <input
                    className="w-full text-sm rounded-xl border-2 border-border bg-muted/40 px-4 py-2.5 text-foreground font-medium placeholder:text-muted-foreground outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                    value={employeeId}
                    onChange={(event) => {
                      setEmployeeId(event.target.value);
                      setResetOtpSent(false);
                      setResetOtp("");
                    }}
                    placeholder="e.g. EMP001"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Registered Email</label>
                  <input
                    type="email"
                    className="w-full text-sm rounded-xl border-2 border-border bg-muted/40 px-4 py-2.5 text-foreground font-medium placeholder:text-muted-foreground outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                    value={resetEmail}
                    onChange={(event) => {
                      setResetEmail(event.target.value);
                      setResetOtpSent(false);
                      setResetOtp("");
                    }}
                    placeholder="Your registered email"
                    required
                  />
                </div>
                {resetOtpSent && <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Email verification code</label>
                  <input
                    className="w-full text-sm rounded-xl border-2 border-border bg-muted/40 px-4 py-2.5 text-foreground font-medium tracking-[0.3em] placeholder:text-muted-foreground outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                    value={resetOtp}
                    onChange={(event) => setResetOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                </div>}
                {resetOtpSent && <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">New Password</label>
                  <PasswordInput
                    className="w-full text-sm rounded-xl border-2 border-border bg-muted/40 px-4 py-2.5 text-foreground font-medium placeholder:text-muted-foreground outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                    value={resetNewPassword}
                    onChange={(event) => setResetNewPassword(event.target.value)}
                    placeholder="Min 8 chars, uppercase, digit, special"
                    required
                    autoComplete="new-password"
                  />
                </div>}
                {resetOtpSent && <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Confirm New Password</label>
                  <PasswordInput
                    className="w-full text-sm rounded-xl border-2 border-border bg-muted/40 px-4 py-2.5 text-foreground font-medium placeholder:text-muted-foreground outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                    value={resetConfirmPassword}
                    onChange={(event) => setResetConfirmPassword(event.target.value)}
                    placeholder="Repeat password"
                    required
                    autoComplete="new-password"
                  />
                </div>}
                <Button
                  className="w-full px-4 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-indigo-500/30 transition-all duration-200"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (resetOtpSent ? "Resetting password…" : "Sending code…") : resetOtpSent ? "Reset Password" : "Send verification code"}
                </Button>
                <div className="text-center mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setInfo("");
                      setIsResetPassword(false);
                      setResetOtpSent(false);
                      setResetOtp("");
                    }}
                    className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}

      {firstTimeModalData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <Card className="w-full max-w-md p-6 bg-card border border-border shadow-2xl rounded-3xl relative text-left">
            <button
              type="button"
              onClick={() => setFirstTimeModalData(null)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground font-bold"
            >
              ✕
            </button>
            <div className="text-center mb-4">
              <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-extrabold text-foreground">Welcome, {firstTimeModalData.full_name}!</h2>
              <p className="text-xs text-muted-foreground mt-1">Employee ID: {firstTimeModalData.employee_id}</p>
            </div>
            {modalError && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-4 py-2.5 text-xs text-red-400 mb-4 font-semibold flex items-center gap-2">
                <span>⚠</span>
                <span>{modalError}</span>
              </div>
            )}
            {!changePasswordMode ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 text-xs text-muted-foreground leading-relaxed">
                  <p className="font-bold text-primary mb-1">First Time Login</p>
                  {firstTimeModalData.mustChangePassword
                    ? "This is your initial Employee ID password. Verify your registered email and choose a new password to continue."
                    : "You are logging in for the first time. You can set a new password now or continue with your current sign-in method."}
                </div>
                {!firstTimeModalData.mustChangePassword && <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleKeepPassword}
                    disabled={modalSubmitting}
                    className="w-full py-2.5 rounded-xl bg-primary text-white font-bold"
                  >
                    {modalSubmitting ? "Processing..." : "Keep Same Password & Continue"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setChangePasswordMode(true);
                      setModalNewPassword("");
                      setModalConfirmPassword("");
                      setModalOtp("");
                      setModalOtpSent(false);
                    }}
                    disabled={modalSubmitting}
                    className="w-full py-2.5 rounded-xl border-border font-bold"
                  >
                    Set a New Password
                  </Button>
                </div>}
              </div>
            ) : (
              <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label htmlFor="first-login-otp" className="block text-xs font-bold text-foreground">Email verification code</label>
                    <Button type="button" size="sm" variant="outline" onClick={handleFirstLoginOtp} disabled={modalSubmitting}>
                      {modalSubmitting ? "Sending…" : modalOtpSent ? "Resend code" : "Send code"}
                    </Button>
                  </div>
                  <input
                    id="first-login-otp"
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="w-full text-sm rounded-xl border-2 border-border bg-muted/40 px-4 py-2.5 text-foreground font-medium tracking-[0.3em] outline-none focus:border-indigo-500 transition-all"
                    placeholder="6-digit code"
                    value={modalOtp}
                    onChange={(e) => setModalOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">New Password</label>
                  <PasswordInput
                    required
                    className="w-full text-sm rounded-xl border-2 border-border bg-muted/40 px-4 py-2.5 text-foreground font-medium outline-none focus:border-indigo-500 transition-all"
                    placeholder="Create a strong password"
                    value={modalNewPassword}
                    onChange={(e) => setModalNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Confirm New Password</label>
                  <PasswordInput
                    required
                    className="w-full text-sm rounded-xl border-2 border-border bg-muted/40 px-4 py-2.5 text-foreground font-medium outline-none focus:border-indigo-500 transition-all"
                    placeholder="Repeat your password"
                    value={modalConfirmPassword}
                    onChange={(e) => setModalConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  {!firstTimeModalData.mustChangePassword && <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setChangePasswordMode(false);
                      setModalOtp("");
                      setModalOtpSent(false);
                    }}
                    disabled={modalSubmitting}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                  >
                    ← Back
                  </Button>}
                  <Button type="submit" disabled={modalSubmitting || !modalOtpSent} className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold">
                    {modalSubmitting ? "Saving..." : "Save & Continue"}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}
    </main>
  );
}
