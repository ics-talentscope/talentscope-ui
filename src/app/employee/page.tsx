"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BadgeCheck,
  Bot,
  Building2,
  BriefcaseBusiness,
  FileText,
  Key,
  LockKeyhole,
  MessageCircle,
  Mic,
  MicOff,
  Network,
  Paperclip,
  Quote,
  Send,
  ShieldCheck,
  Sparkles,
  Video,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

type AssistantMessage = { role: "assistant" | "user"; text: string };
type AssistantLanguage = "en" | "es" | "fr" | "hi" | "de" | "pt" | "zh" | "ja";
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const assistantGreetings: Record<AssistantLanguage, string> = {
  en: "Hi, I’m Buddy Bot. I can help you choose a sign-in option or reset your portal password.",
  es: "Hola, soy Buddy Bot. Puedo ayudarte a elegir cómo iniciar sesión o restablecer tu contraseña.",
  fr: "Bonjour, je suis Buddy Bot. Je peux vous aider à choisir une méthode de connexion ou à réinitialiser votre mot de passe.",
  hi: "नमस्ते, मैं Buddy Bot हूँ। मैं साइन-इन विकल्प चुनने या पासवर्ड रीसेट करने में मदद कर सकता हूँ।",
  de: "Hallo, ich bin Buddy Bot. Ich helfe dir bei der Anmeldung oder beim Zurücksetzen deines Passworts.",
  pt: "Olá, sou o Buddy Bot. Posso ajudar você a escolher uma forma de entrar ou redefinir sua senha.",
  zh: "你好，我是 Buddy Bot。我可以帮你选择登录方式或重置门户密码。",
  ja: "こんにちは、Buddy Botです。サインイン方法の選択やパスワードのリセットをお手伝いします。",
};

const assistantReplies: Record<AssistantLanguage, { sso: string; password: string; login: string; default: string }> = {
  en: {
    sso: "Choose Infinite Login to continue through your organization’s secure sign-on. If it fails, try again or contact your IT support team.",
    password: "Choose Non-SSO Sign in, then select Forgot Password? on the login form to reset your portal password.",
    login: "Use Non-SSO Sign in for your employee ID and password, or Infinite Login for organization SSO.",
    default: "I can help with Infinite Login, employee ID sign-in, or password resets. Which one do you need?",
  },
  es: {
    sso: "Elige Infinite Login para continuar con el acceso seguro de tu organización. Si falla, inténtalo de nuevo o contacta con soporte técnico.",
    password: "Elige Non-SSO Sign in y selecciona «¿Olvidaste tu contraseña?» para restablecerla.",
    login: "Usa Non-SSO Sign in con tu ID y contraseña, o Infinite Login para el acceso SSO de tu organización.",
    default: "Puedo ayudarte con Infinite Login, el acceso con ID de empleado o el restablecimiento de contraseña. ¿Qué necesitas?",
  },
  fr: {
    sso: "Choisissez Infinite Login pour utiliser l’accès sécurisé de votre organisation. En cas d’échec, réessayez ou contactez le support informatique.",
    password: "Choisissez Non-SSO Sign in, puis sélectionnez « Mot de passe oublié ? » pour réinitialiser votre mot de passe.",
    login: "Utilisez Non-SSO Sign in avec votre identifiant et votre mot de passe, ou Infinite Login pour le SSO.",
    default: "Je peux vous aider avec Infinite Login, la connexion par identifiant ou la réinitialisation du mot de passe. De quoi avez-vous besoin ?",
  },
  hi: {
    sso: "अपने संगठन के सुरक्षित साइन-ऑन के लिए Infinite Login चुनें। समस्या होने पर फिर कोशिश करें या IT सहायता से संपर्क करें।",
    password: "Non-SSO Sign in चुनें और पासवर्ड रीसेट करने के लिए लॉगिन फ़ॉर्म पर Forgot Password? चुनें।",
    login: "कर्मचारी ID और पासवर्ड के लिए Non-SSO Sign in, या संगठन SSO के लिए Infinite Login चुनें।",
    default: "मैं Infinite Login, कर्मचारी ID साइन-इन या पासवर्ड रीसेट में मदद कर सकता हूँ। आपको किसमें मदद चाहिए?",
  },
  de: {
    sso: "Wähle Infinite Login für die sichere Anmeldung deiner Organisation. Falls es nicht funktioniert, versuche es erneut oder wende dich an den IT-Support.",
    password: "Wähle Non-SSO Sign in und dann „Passwort vergessen?“, um dein Portalpasswort zurückzusetzen.",
    login: "Nutze Non-SSO Sign in mit Mitarbeiter-ID und Passwort oder Infinite Login für das SSO deiner Organisation.",
    default: "Ich helfe bei Infinite Login, der Anmeldung mit Mitarbeiter-ID oder beim Zurücksetzen des Passworts. Wobei brauchst du Hilfe?",
  },
  pt: {
    sso: "Escolha Infinite Login para acessar com segurança pela sua organização. Se não funcionar, tente novamente ou fale com o suporte de TI.",
    password: "Escolha Non-SSO Sign in e selecione “Esqueceu a senha?” para redefinir sua senha do portal.",
    login: "Use Non-SSO Sign in com seu ID e senha, ou Infinite Login para o SSO da organização.",
    default: "Posso ajudar com Infinite Login, acesso pelo ID de funcionário ou redefinição de senha. Do que você precisa?",
  },
  zh: {
    sso: "选择 Infinite Login，通过组织的安全登录方式继续。如果失败，请重试或联系 IT 支持。",
    password: "选择 Non-SSO Sign in，然后在登录表单中选择“忘记密码？”来重置门户密码。",
    login: "使用 Non-SSO Sign in 输入员工 ID 和密码，或使用 Infinite Login 进行组织 SSO 登录。",
    default: "我可以协助 Infinite Login、员工 ID 登录或重置密码。你需要哪方面的帮助？",
  },
  ja: {
    sso: "組織の安全なサインインを利用するには Infinite Login を選択してください。失敗する場合は再試行するか、IT サポートにお問い合わせください。",
    password: "Non-SSO Sign in を選び、ログインフォームの「パスワードをお忘れですか？」からリセットしてください。",
    login: "社員 ID とパスワードには Non-SSO Sign in、組織の SSO には Infinite Login をご利用ください。",
    default: "Infinite Login、社員 ID でのサインイン、パスワードのリセットをお手伝いできます。どのようなご用件ですか？",
  },
};

function getAssistantReply(message: string, language: AssistantLanguage): string {
  const normalized = message.toLowerCase();
  const replies = assistantReplies[language];
  if (normalized.includes("sso") || normalized.includes("infinite")) {
    return replies.sso;
  }
  if (normalized.includes("password") || normalized.includes("reset")) {
    return replies.password;
  }
  if (normalized.includes("id") || normalized.includes("sign in") || normalized.includes("login")) {
    return replies.login;
  }
  return replies.default;
}

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
  const [org, setOrg] = useState<string | null>(null);
  
  // First time login choices modal states
  const [firstTimeModalData, setFirstTimeModalData] = useState<{
    token: string;
    employee_id: string;
    full_name: string;
  } | null>(null);
  const [changePasswordMode, setChangePasswordMode] = useState(false);
  const [modalNewPassword, setModalNewPassword] = useState("");
  const [modalConfirmPassword, setModalConfirmPassword] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [welcomeColorIndex, setWelcomeColorIndex] = useState(0);
  const [showMotivationalQuote, setShowMotivationalQuote] = useState(false);
  const [motivationalQuoteIndex, setMotivationalQuoteIndex] = useState(-1);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLanguage, setAssistantLanguage] = useState<AssistantLanguage>("en");
  const [isListening, setIsListening] = useState(false);
  const [assistantNotice, setAssistantNotice] = useState("");
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
    { role: "assistant", text: assistantGreetings.en },
  ]);

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

  const handleAssistantSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = assistantInput.trim();
    if (!question) return;
    setAssistantMessages((messages) => [
      ...messages,
      { role: "user", text: question },
      { role: "assistant", text: getAssistantReply(question, assistantLanguage) },
    ]);
    setAssistantInput("");
  };

  const handleAssistantLanguageChange = (language: AssistantLanguage) => {
    setAssistantLanguage(language);
    setAssistantMessages((messages) => {
      const firstAssistantIndex = messages.findIndex((message) => message.role === "assistant");
      if (firstAssistantIndex < 0) return [{ role: "assistant", text: assistantGreetings[language] }];
      return messages.map((message, index) =>
        index === firstAssistantIndex ? { ...message, text: assistantGreetings[language] } : message
      );
    });
  };

  const handleAssistantMic = () => {
    if (isListening) {
      speechRecognitionRef.current?.stop();
      return;
    }
    const speechWindow = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setAssistantNotice("Voice input is not supported in this browser.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = {
      en: "en-US",
      es: "es-ES",
      fr: "fr-FR",
      hi: "hi-IN",
      de: "de-DE",
      pt: "pt-BR",
      zh: "zh-CN",
      ja: "ja-JP",
    }[assistantLanguage];
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) setAssistantInput((current) => [current, transcript].filter(Boolean).join(" "));
    };
    recognition.onerror = () => setAssistantNotice("Could not capture voice input. Check microphone access and try again.");
    recognition.onend = () => {
      setIsListening(false);
      speechRecognitionRef.current = null;
    };
    speechRecognitionRef.current = recognition;
    setAssistantNotice("");
    setIsListening(true);
    recognition.start();
  };

  const handleAssistantAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    let detail = `Attached ${file.name} (${Math.ceil(file.size / 1024)} KB).`;
    if (file.size > 1_000_000) {
      detail += " It is over 1 MB, so Buddy Bot only received its file name.";
    } else if (file.type.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(file.name)) {
      const content = (await file.text()).trim().slice(0, 1200);
      if (content) detail += ` File text: ${content}`;
    } else {
      detail += " You can ask Buddy Bot about sign-in help related to this file.";
    }
    setAssistantMessages((messages) => [
      ...messages,
      { role: "user", text: detail },
      { role: "assistant", text: getAssistantReply(`${file.name} ${assistantInput}`, assistantLanguage) },
    ]);
    setAssistantNotice("");
  };

  useEffect(() => () => speechRecognitionRef.current?.stop(), []);

  const [ssoEnabled, setSsoEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/employee/auth/saml/status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSsoEnabled(Boolean(data?.enabled)))
      .catch(() => setSsoEnabled(false));
  }, []);

  useEffect(() => {
    const syncRouteState = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const reason = searchParams.get("reason");
      const ssoError = searchParams.get("sso_error");
      setShowWelcome(searchParams.get("mode") !== "signin" && !reason && !ssoError);

      if (reason === "inactivity") {
        setError("You have been logged out due to inactivity.");
      }
      if (ssoError) {
        setError(ssoError);
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
    setShowWelcome(false);
    router.push(`/employee?mode=signin${org ? `&org=${encodeURIComponent(org)}` : ""}`);
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
        body: JSON.stringify({ action: "change", password: modalNewPassword }),
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

  const handleMicrosoftSSO = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setError("");
    setInfo("Redirecting to Microsoft…");
    window.location.assign("/api/employee/auth/saml");
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
        });
        setChangePasswordMode(false);
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
    if (resetNewPassword !== resetConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch("/api/employee/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: trimmedId,
          email: resetEmail,
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
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return showWelcome ? (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground transition-colors duration-300">
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

      <header className="relative z-30 flex h-20 items-center justify-between px-5 sm:px-8 lg:px-12">
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

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] max-w-[1440px] grid-cols-1 items-center gap-12 px-5 pb-12 pt-4 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-16 lg:pb-20">
        <section className="relative flex min-h-[580px] flex-col justify-start gap-8 overflow-hidden rounded-[2rem] bg-[#176b55] px-7 py-9 text-white shadow-2xl shadow-[#176b55]/20 transition-colors duration-300 sm:px-10 sm:py-11 lg:min-h-[620px] lg:gap-10 lg:px-14 lg:py-12">
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

            <motion.div
              className="absolute right-[5%] top-[66%] flex max-w-[170px] items-start gap-2 rounded-2xl rounded-br-sm border border-white/35 bg-white/95 px-2.5 py-2 text-[#315044] shadow-[0_14px_28px_rgba(2,32,23,0.22)] sm:top-[62%]"
              animate={prefersReducedMotion ? undefined : { x: [0, -12, -5, 0], y: [0, 8, 17, 0], rotate: [0, -1, 1, 0] }}
              transition={prefersReducedMotion ? undefined : { duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
            >
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#368368]" />
              <span className="text-[10px] font-semibold leading-4">Tell me about a challenge you solved.</span>
            </motion.div>

            <motion.div
              className="absolute bottom-[10%] right-[5%] flex items-center gap-2 rounded-full border border-white/20 bg-[#0e4e3e]/90 px-2.5 py-1.5 text-[9px] font-semibold text-white shadow-lg"
              animate={prefersReducedMotion ? undefined : { x: [0, -15, -7, 0], y: [0, -8, -15, 0] }}
              transition={prefersReducedMotion ? undefined : { duration: 7.5, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
            >
              <span className="h-2 w-2 rounded-full bg-[#a8e5bd] shadow-[0_0_10px_rgba(168,229,189,0.85)]" />
              Conversation in progress
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
              className="max-w-[12ch] text-5xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-7xl"
              animate={{ color: welcomeTitleColors[welcomeColorIndex] }}
              transition={{ duration: prefersReducedMotion ? 0 : 1.2, ease: "easeInOut" }}
            >
              Welcome to TalentScope
            </motion.h1>
            <p className="mt-6 max-w-md text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
              A clearer view of your skills, your progress, and the opportunities ahead.
            </p>
          </motion.div>

        </section>

        <section className="mx-auto w-full max-w-[520px] py-4 lg:ml-0 lg:py-10">
          <div className="mb-10">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Employee portal</p>
            <h2 className="font-display text-3xl font-extrabold leading-[1.08] text-foreground sm:text-4xl">
              Choose how you
              <span className="mt-1 block text-primary">sign in</span>
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              Continue with your Infinite account or use your employee credentials.
            </p>
          </div>

          <div className="relative flex w-full items-center justify-between gap-3">
          <div className="min-w-0 w-[calc(100%-96px)] max-w-[300px] space-y-3">
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
                <Network className="h-5 w-5" />
              </motion.span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold">Infinite Login</span>
                <span className="mt-1 block text-xs text-[#785c68]">Secure single sign-on</span>
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
                <span className="block text-base font-bold">Non-SSO Sign in</span>
                <span className="mt-1 block text-xs text-[#716382]">Use your ID and password</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-[#8062a4] transition-transform group-hover:translate-x-1" />
            </motion.button>
          </div>

          <button
            type="button"
            onClick={() => setIsAssistantOpen((open) => !open)}
            aria-label={isAssistantOpen ? "Close Buddy Bot" : "Open Buddy Bot"}
            aria-expanded={isAssistantOpen}
            className="inline-flex min-h-[92px] w-[78px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-[#b8d8c9] bg-white px-2 py-3 text-[#176b55] shadow-[0_14px_30px_-12px_rgba(23,107,85,0.42)] transition hover:-translate-y-1 hover:bg-[#edf6f0] hover:shadow-[0_18px_34px_-12px_rgba(23,107,85,0.5)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#176b55]/25"
            title="Buddy Bot sign-in help"
          >
            <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#176b55] to-[#7860b2] text-white shadow-md shadow-[#176b55]/20">
              {isAssistantOpen ? <X className="h-5 w-5" /> : <Bot className="h-6 w-6" />}
              {!isAssistantOpen && <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-white p-0.5 text-[#a56bcb] shadow-sm" />}
            </span>
            <span className="text-xs font-bold">Buddy Bot</span>
            <span className="text-[9px] text-[#70887b]">Sign-in help</span>
          </button>

          {isAssistantOpen && (
            <motion.section
              aria-label="Buddy Bot chat"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute right-0 top-full z-40 mt-3 flex w-[min(320px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl"
            >
              <div className="flex items-center gap-3 bg-[#176b55] px-4 py-3 text-white">
                <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-white/25 to-[#c5a9fa]/40">
                  <Bot className="h-5 w-5" />
                  <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-white p-0.5 text-[#8154c8] shadow-sm" />
                </span>
                <div>
                  <p className="text-sm font-bold">Buddy Bot</p>
                  <p className="text-[10px] text-white/75">Sign-in help</p>
                </div>
                <label className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-2 py-1.5 text-[10px] font-semibold text-white">
                  <span className="sr-only">Choose Buddy Bot language</span>
                  <select
                    aria-label="Choose Buddy Bot language"
                    value={assistantLanguage}
                    onChange={(event) => handleAssistantLanguageChange(event.target.value as AssistantLanguage)}
                    className="max-w-[112px] cursor-pointer bg-transparent text-white outline-none [&>option]:text-[#24352e]"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="hi">हिन्दी</option>
                    <option value="de">Deutsch</option>
                    <option value="pt">Português</option>
                    <option value="zh">中文</option>
                    <option value="ja">日本語</option>
                  </select>
                </label>
              </div>
              <input
                ref={attachmentInputRef}
                type="file"
                accept=".txt,.md,.csv,.json,.pdf,image/*"
                className="hidden"
                onChange={handleAssistantAttachment}
                aria-label="Attach a file to Buddy Bot"
              />
              <div role="log" aria-live="polite" className="flex max-h-56 flex-col gap-2 overflow-y-auto p-3">
                {assistantMessages.map((message, index) => (
                  <p
                    key={`${message.role}-${index}`}
                    className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-5 ${
                      message.role === "user"
                        ? "self-end rounded-br-sm bg-[#e7eef2] text-[#344252]"
                        : "self-start rounded-bl-sm bg-[#edf5ef] text-[#315044]"
                    }`}
                  >
                    {message.text}
                  </p>
                ))}
              </div>
              {assistantNotice && <p role="status" className="px-3 pb-2 text-[10px] leading-4 text-muted-foreground">{assistantNotice}</p>}
              <form onSubmit={handleAssistantSubmit} className="flex items-center gap-1.5 border-t border-border p-3">
                <button
                  type="button"
                  onClick={() => attachmentInputRef.current?.click()}
                  aria-label="Attach a file"
                  title="Attach a file"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b55]/30"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleAssistantMic}
                  aria-label={isListening ? "Stop voice input" : "Start voice input"}
                  title={isListening ? "Stop voice input" : "Voice input"}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b55]/30 ${isListening ? "bg-rose-100 text-rose-700" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                <input
                  value={assistantInput}
                  onChange={(event) => setAssistantInput(event.target.value)}
                  aria-label="Message Buddy Bot"
                  placeholder="Ask about signing in..."
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-[#176b55]/50 focus:ring-2 focus:ring-[#176b55]/15"
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={!assistantInput.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#176b55] text-white transition hover:bg-[#125943] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </motion.section>
          )}
          </div>

          <div className="mt-8 flex items-start gap-3 border-t border-border pt-6 text-xs leading-5 text-muted-foreground">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Building2 className="h-3.5 w-3.5" />
            </span>
            <span>Protected employee access. Your assessments and progress stay connected to your account.</span>
          </div>
        </section>
      </div>
    </main>
  ) : (
    <div className="min-h-screen app-canvas flex items-center justify-center px-4 py-6 relative overflow-hidden transition-colors duration-300">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-72 h-72 bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Theme Toggler */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* ── Return to employee sign-in options ─────────────────────── */}
      <div className="absolute top-4 left-4 z-20">
        <Link
          href={org ? `/employee?org=${encodeURIComponent(org)}` : "/employee"}
          onClick={() => setShowWelcome(true)}
          className="group inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
          <span className="text-xs font-semibold">Sign-in options</span>
        </Link>
      </div>

      <Card className="w-full max-w-md p-6 md:p-7 shadow-card relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />

        <div className="mb-5 text-center relative z-10">
          <div className="mx-auto mb-3 app-brand-mark h-12 w-12">
            <ShieldCheck className="h-6 w-6" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
            {isResetPassword
              ? "Reset Portal Password"
              : org
                ? `${org} · TalentScope`
                : "TalentScope Login"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            {isResetPassword 
              ? "Verify your Employee ID and Email to set a new password." 
              : `Access your TalentScope assessments, performance analytics, and growth path.`}
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
          <>
            <form className="space-y-4 relative z-10" onSubmit={handleSubmit}>
              {/* Employee ID */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  Employee ID
                </label>
                <div className="relative">
                  <input
                    className="w-full text-sm rounded-xl border-2 border-slate-200 dark:border-slate-600/80 bg-slate-50/50 dark:bg-slate-900/60 px-4 py-2.5 text-slate-900 dark:text-white font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:bg-white dark:focus:bg-slate-900/80 transition-all"
                    value={employeeId}
                    onChange={(event) => setEmployeeId(event.target.value)}
                    placeholder="e.g. E1234"
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    className="w-full text-sm rounded-xl border-2 border-slate-200 dark:border-slate-600/80 bg-slate-50/50 dark:bg-slate-900/60 px-4 py-2.5 text-slate-900 dark:text-white font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:bg-white dark:focus:bg-slate-900/80 transition-all"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <Key className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                </div>
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setInfo("");
                      setIsResetPassword(true);
                    }}
                    className="text-[11px] font-semibold text-primary hover:text-primary dark:hover:text-indigo-300 transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              {/* Submit */}
              <Button
                className="w-full px-4 py-2.5 rounded-xl bg-primary hover:from-indigo-500 hover:to-violet-500 text-white font-bold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-200"
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

            {ssoEnabled && (
            <>
            {/* Divider */}
            <div className="relative my-4 z-10 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700/40"></div>
              </div>
              <span className="relative px-3 text-[9px] font-black text-slate-500 bg-slate-800 dark:bg-slate-850 uppercase tracking-widest">
                Or continue with
              </span>
            </div>

            {/* Outlook SSO Button */}
            <Button
              type="button"
              onClick={handleMicrosoftSSO}
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-700/80 hover:border-slate-500 bg-slate-900/40 hover:bg-slate-900 text-white font-bold transition-all duration-200 flex items-center justify-center gap-2.5 relative z-10 shadow-sm"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 0H11V11H0V0Z" fill="#F25022"/>
                <path d="M12 0H23V11H12V0Z" fill="#7FBA00"/>
                <path d="M0 12H11V23H0V12Z" fill="#00A4EF"/>
                <path d="M12 12H23V23H12V12Z" fill="#FFB900"/>
              </svg>
              <span className="text-xs">Sign in with Microsoft</span>
            </Button>
            </>
            )}

            {/* First-time hint */}
            <div className="mt-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 relative z-10">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider mb-0.5">First time logging in?</p>
                  <p className="text-xs text-slate-700 dark:text-slate-350 leading-relaxed">
                    Use your <span className="text-foreground font-semibold">Employee ID</span> with a <span className="text-foreground font-semibold">blank password</span> or your assigned initial password.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <form className="space-y-4 relative z-10" onSubmit={handleResetPassword}>
            {/* Employee ID */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                Employee ID
              </label>
              <input
                className="w-full text-sm rounded-xl border-2 border-slate-200 dark:border-slate-600/80 bg-slate-50/50 dark:bg-slate-900/60 px-4 py-2.5 text-slate-900 dark:text-white font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:bg-white dark:focus:bg-slate-900/80 transition-all"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                placeholder="e.g. EMP001"
                required
              />
            </div>

            {/* Registered Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                Registered Email
              </label>
              <input
                type="email"
                className="w-full text-sm rounded-xl border-2 border-slate-200 dark:border-slate-600/80 bg-slate-50/50 dark:bg-slate-900/60 px-4 py-2.5 text-slate-900 dark:text-white font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:bg-white dark:focus:bg-slate-900/80 transition-all"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                placeholder="e.g. sofia@example.com (Leave blank if none)"
              />
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                className="w-full text-sm rounded-xl border-2 border-slate-200 dark:border-slate-600/80 bg-slate-50/50 dark:bg-slate-900/60 px-4 py-2.5 text-slate-900 dark:text-white font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:bg-white dark:focus:bg-slate-900/80 transition-all"
                value={resetNewPassword}
                onChange={(event) => setResetNewPassword(event.target.value)}
                placeholder="Min 8 chars, uppercase, digit, special"
                required
              />
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                className="w-full text-sm rounded-xl border-2 border-slate-200 dark:border-slate-600/80 bg-slate-50/50 dark:bg-slate-900/60 px-4 py-2.5 text-slate-900 dark:text-white font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:bg-white dark:focus:bg-slate-900/80 transition-all"
                value={resetConfirmPassword}
                onChange={(event) => setResetConfirmPassword(event.target.value)}
                placeholder="Repeat password"
                required
              />
            </div>

            {/* Reset Submit */}
            <Button
              className="w-full px-4 py-2.5 rounded-xl bg-primary hover:from-indigo-500 hover:to-violet-500 text-white font-bold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-200"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Resetting password…
                </span>
              ) : (
                "Reset Password"
              )}
            </Button>

            {/* Back to Login link */}
            <div className="text-center mt-3">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setInfo("");
                  setIsResetPassword(false);
                }}
                className="text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}
      </Card>

      {firstTimeModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <Card className="w-full max-w-md p-6 bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 shadow-2xl rounded-3xl relative text-left">
            <button
              type="button"
              onClick={() => setFirstTimeModalData(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
            >
              ✕
            </button>

            <div className="text-center mb-4">
              <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Welcome, {firstTimeModalData.full_name}!</h2>
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
                <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 text-xs text-slate-700 dark:text-slate-350 leading-relaxed">
                  <p className="font-bold text-primary dark:text-indigo-300 mb-1">🔐 First Time Login</p>
                  You are logging in with your initial assigned password. You can choose to keep this password or set a new custom one now.
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleKeepPassword}
                    disabled={modalSubmitting}
                    className="w-full py-2.5 rounded-xl bg-primary text-white font-bold shadow-md shadow-indigo-500/20 hover:shadow-lg transition-all"
                  >
                    {modalSubmitting ? "Processing..." : "Keep Same Password & Continue"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setChangePasswordMode(true);
                      setModalNewPassword("");
                      setModalConfirmPassword("");
                    }}
                    disabled={modalSubmitting}
                    className="w-full py-2.5 rounded-xl border-border font-bold hover:bg-secondary"
                  >
                    Set a New Password
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      className="w-full text-sm rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/60 px-4 py-2.5 text-slate-900 dark:text-white font-medium outline-none focus:border-indigo-500 transition-all"
                      placeholder="Create a strong password"
                      value={modalNewPassword}
                      onChange={(e) => setModalNewPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      className="w-full text-sm rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/60 px-4 py-2.5 text-slate-900 dark:text-white font-medium outline-none focus:border-indigo-500 transition-all"
                      placeholder="Repeat your password"
                      value={modalConfirmPassword}
                      onChange={(e) => setModalConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setChangePasswordMode(false)}
                    disabled={modalSubmitting}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold border-border"
                  >
                    ← Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={modalSubmitting}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold"
                  >
                    {modalSubmitting ? "Saving..." : "Save & Continue"}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
